// Solicitações de clichê (e-mail direto à clicheria) e apontamentos gerenciais.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid } from "@/server/db.server";
import { requirePerm } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";
import { saveSolicitacaoClicheFile } from "@/server/files.server";
import { clicheEmailDestino, enviarEmail } from "@/server/email.server";
import { valorOuZero } from "@/lib/valor";

/* ===================== MOTIVOS ===================== */

export const listMotivosCliche = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    return getDb()
      .prepare("SELECT id, nome FROM cliche_motivos ORDER BY nome COLLATE NOCASE ASC")
      .all() as { id: string; nome: string }[];
  });

export const addMotivoCliche = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().min(2).max(60) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cliche.motivo_criar");
    const db = getDb();
    const nome = data.nome.trim();
    const existe = db.prepare("SELECT id FROM cliche_motivos WHERE nome = ?").get(nome);
    if (existe) throw new Error("Esse motivo já existe.");
    db.prepare("INSERT INTO cliche_motivos (id, nome, created_at) VALUES (?,?,?)").run(
      uuid(), nome, agora(),
    );
    audit({ id: user.id, nome: user.nome }, "cliche.motivo_criar", "cliche_motivos", null, { nome });
    return { ok: true };
  });

/* ===================== SOLICITAÇÃO ===================== */

const MAX_BASE64 = 50_000_000;

export const criarSolicitacaoCliche = createServerFn({ method: "POST" })
  .validator(
    z.object({
      tipo: z.enum(["1.70", "1.14"]),
      cliente: z.string().nullish(),
      cores: z.array(z.string().min(1)).min(1),
      motivo: z.string().min(1),
      observacao: z.string().nullish(),
      anexos: z
        .array(z.object({ nome: z.string().min(1), dataBase64: z.string().min(1).max(MAX_BASE64) }))
        .max(10),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cliche.solicitar");

    const db = getDb();
    const { numero } = db
      .prepare("SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM cliche_solicitacoes")
      .get() as { numero: number };

    // Guarda os anexos na rede antes de qualquer coisa — nada se perde se o e-mail falhar.
    const salvos: { nome: string; path: string; conteudo: Buffer }[] = [];
    for (const a of data.anexos) {
      const conteudo = Buffer.from(a.dataBase64, "base64");
      const { fullPath, nomeSalvo } = saveSolicitacaoClicheFile(numero, a.nome, conteudo);
      salvos.push({ nome: nomeSalvo, path: fullPath, conteudo });
    }

    // O motivo da solicitação é APENAS interno (registro/apontamentos) — não vai no e-mail.
    const destino = clicheEmailDestino();
    const linhasCores = data.cores
      .map((c) => `<li style="padding:2px 0">${c}</li>`)
      .join("");
    const html = `
      <div style="font-family:Arial,sans-serif;font-size:14px;color:#222">
        <h2 style="margin:0 0 4px">Solicitação de Clichê #${String(numero).padStart(4, "0")}</h2>
        <p style="margin:0 0 12px;color:#666">R2 Etiquetas — enviada por ${user.nome} em ${new Date().toLocaleString("pt-BR")}</p>
        ${data.cliente ? `<p><b>Cliente/Referência:</b> ${data.cliente}</p>` : ""}
        <p><b>Tipo de clichê:</b> ${data.tipo}</p>
        <p style="margin-bottom:4px"><b>Cores (${data.cores.length}):</b></p>
        <ul style="margin:0 0 0 18px;padding:0;font-size:14px">${linhasCores}</ul>
        ${data.observacao ? `<p style="margin-top:12px"><b>Observações:</b><br>${data.observacao.replace(/\n/g, "<br>")}</p>` : ""}
        <p style="margin-top:12px;color:#666">${salvos.length} arquivo(s) em anexo.</p>
      </div>`;

    const resultado = await enviarEmail({
      para: destino ?? "",
      assunto: `Solicitação de Clichê #${String(numero).padStart(4, "0")}${data.cliente ? ` — ${data.cliente}` : ""} — R2 Etiquetas`,
      html,
      anexos: salvos.map((s) => ({ nome: s.nome, conteudo: s.conteudo })),
    });

    const id = uuid();
    db.prepare(
      `INSERT INTO cliche_solicitacoes
        (id, numero, user_id, user_nome, cliente, tipo, cores, motivo, observacao, anexos, email_para, email_enviado, email_erro, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id, numero, user.id, user.nome, data.cliente?.trim() || null, data.tipo,
      JSON.stringify(data.cores), data.motivo, data.observacao?.trim() || null,
      JSON.stringify(salvos.map((s) => ({ nome: s.nome, path: s.path }))),
      destino, resultado.enviado ? 1 : 0, resultado.erro, agora(),
    );

    notifyUsers(
      usersWithRoles(["gestor", "admin"]),
      user.id,
      "Solicitação de clichê",
      `#${String(numero).padStart(4, "0")} — ${data.motivo}${data.cliente ? ` (${data.cliente})` : ""}`,
      "/hub?tela=aprovacao",
    );
    audit({ id: user.id, nome: user.nome }, "cliche.solicitar", "cliche_solicitacoes", id, {
      numero, tipo: data.tipo, motivo: data.motivo, cliente: data.cliente ?? null,
      cores: data.cores, emailEnviado: resultado.enviado, emailErro: resultado.erro,
    });

    return { id, numero, emailEnviado: resultado.enviado, emailErro: resultado.erro };
  });

export const listSolicitacoesCliche = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "tab.cliches");
    const rows = getDb()
      .prepare(
        "SELECT id, numero, user_nome, cliente, tipo, cores, motivo, observacao, email_enviado, email_erro, created_at FROM cliche_solicitacoes ORDER BY created_at DESC LIMIT 100",
      )
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({ ...r, cores: JSON.parse(r.cores as string) }));
  });

/* ===================== APONTAMENTOS ===================== */

export const getApontamentos = createServerFn({ method: "POST" })
  .validator(z.object({ de: z.string().min(10), ate: z.string().min(10) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "apontamentos.ver");

    const db = getDb();
    const de = data.de;
    const ate = data.ate;

    /* Clichês recebidos: o gasto entra no dia em que o clichê CHEGOU, não no
       dia em que alguém lançou o valor no sistema. Eram coisas diferentes toda
       vez que o lançamento (ou uma correção dele) acontecia dias depois — o
       gasto migrava de mês junto com a digitação. */
    const DIA_DO_GASTO = "COALESCE(data_chegada, date(created_at, 'localtime'))";
    const clichesResumo = db
      .prepare(
        `SELECT COUNT(*) AS qtde, COALESCE(SUM(total), 0) AS total
         FROM cliche_registros WHERE ${DIA_DO_GASTO} BETWEEN ? AND ?`,
      )
      .get(de, ate) as { qtde: number; total: number };

    const clichesPorDia = db
      .prepare(
        `SELECT ${DIA_DO_GASTO} AS dia, COUNT(*) AS qtde, COALESCE(SUM(total), 0) AS total
         FROM cliche_registros WHERE ${DIA_DO_GASTO} BETWEEN ? AND ?
         GROUP BY dia ORDER BY dia DESC`,
      )
      .all(de, ate);

    // Solicitações de clichê por motivo
    const solicitacoesPorMotivo = db
      .prepare(
        `SELECT motivo, COUNT(*) AS qtde
         FROM cliche_solicitacoes WHERE date(created_at, 'localtime') BETWEEN ? AND ?
         GROUP BY motivo ORDER BY qtde DESC`,
      )
      .all(de, ate);

    // Pedidos criados no período: matéria-prima, medidas e vendedoras
    const materias = db
      .prepare(
        `SELECT materia, COUNT(*) AS qtde
         FROM pedidos WHERE date(created_at, 'localtime') BETWEEN ? AND ?
         GROUP BY materia ORDER BY qtde DESC`,
      )
      .all(de, ate);

    const medidas = db
      .prepare(
        `SELECT (largura || ' × ' || altura || ' mm') AS medida, COUNT(*) AS qtde
         FROM pedidos WHERE date(created_at, 'localtime') BETWEEN ? AND ?
         GROUP BY medida ORDER BY qtde DESC LIMIT 12`,
      )
      .all(de, ate);

    const vendedoras = db
      .prepare(
        `SELECT COALESCE(u.nome, 'Desconhecido') AS nome, COUNT(*) AS qtde
         FROM pedidos p LEFT JOIN users u ON u.id = p.vendedor_id
         WHERE date(p.created_at, 'localtime') BETWEEN ? AND ?
         GROUP BY p.vendedor_id ORDER BY qtde DESC`,
      )
      .all(de, ate);

    // Artes enviadas (status → aguardando) e aprovações (status → aprovada) por dia
    const artesAprovacoesPorDia = db
      .prepare(
        `SELECT date(created_at, 'localtime') AS dia,
                SUM(CASE WHEN status = 'aguardando' THEN 1 ELSE 0 END) AS artes,
                SUM(CASE WHEN status = 'aprovada' THEN 1 ELSE 0 END) AS aprovacoes
         FROM pedido_historico
         WHERE date(created_at, 'localtime') BETWEEN ? AND ?
           AND status IN ('aguardando', 'aprovada')
         GROUP BY dia ORDER BY dia DESC`,
      )
      .all(de, ate);

    const pedidosResumo = db
      .prepare(
        `SELECT COUNT(*) AS qtde FROM pedidos WHERE date(created_at, 'localtime') BETWEEN ? AND ?`,
      )
      .get(de, ate) as { qtde: number };

    // Facas para afiação: eventos DO PERÍODO (enviadas, novas pedidas)
    const facasResumo = db
      .prepare(
        `SELECT COUNT(*) AS enviadas,
                SUM(CASE WHEN nova_solicitada = 1 THEN 1 ELSE 0 END) AS novas_solicitadas
         FROM faca_afiacoes WHERE date(created_at, 'localtime') BETWEEN ? AND ?`,
      )
      .get(de, ate) as { enviadas: number; novas_solicitadas: number };

    /* "Em afiação" é ESTADO DE AGORA, não evento do período: faca que saiu há
       60 dias e não voltou continua fora, e sumia do indicador quando alguém
       filtrava 7 dias — justamente a que mais precisa aparecer. */
    const emAfiacaoAgora = db
      .prepare("SELECT COUNT(*) AS n FROM faca_afiacoes WHERE status = 'enviada'")
      .get() as { n: number };

    // Gasto com afiação: valores lançados na chegada da faca dentro do período.
    const facasGasto = db
      .prepare(
        `SELECT COALESCE(SUM(valor), 0) AS gasto
         FROM faca_afiacoes
         WHERE valor IS NOT NULL AND date(recebida_em, 'localtime') BETWEEN ? AND ?`,
      )
      .get(de, ate) as { gasto: number };

    const facasPorSubstrato = db
      .prepare(
        `SELECT substrato, COUNT(*) AS qtde
         FROM faca_afiacoes WHERE date(created_at, 'localtime') BETWEEN ? AND ?
         GROUP BY substrato ORDER BY qtde DESC`,
      )
      .all(de, ate);

    const facasPorEstado = db
      .prepare(
        `SELECT estado, COUNT(*) AS qtde
         FROM faca_afiacoes
         WHERE status = 'recebida' AND estado IS NOT NULL
           AND date(recebida_em, 'localtime') BETWEEN ? AND ?
         GROUP BY estado ORDER BY qtde DESC`,
      )
      .all(de, ate);

    /* Facas COMPRADAS no período (cadastradas com valor no catálogo): antes o
       valor ficava no dados_json e nenhum relatório o lia — o aviso da tela
       até prometia "lançada em Apontamentos". O valor é texto pt-BR digitado. */
    const facasCompradas = (db
      .prepare("SELECT dados_json FROM facas_extras WHERE date(created_at, 'localtime') BETWEEN ? AND ?")
      .all(de, ate) as { dados_json: string }[])
      .reduce(
        (acc, r) => {
          try {
            const d = JSON.parse(r.dados_json) as { valor?: string };
            const v = valorOuZero(d?.valor);
            if (v > 0) { acc.qtde += 1; acc.total += v; }
          } catch { /* cadastro antigo sem JSON válido */ }
          return acc;
        },
        { qtde: 0, total: 0 },
      );

    return {
      pedidos: pedidosResumo,
      cliches: clichesResumo,
      clichesPorDia,
      solicitacoesPorMotivo,
      materias,
      medidas,
      vendedoras,
      artesAprovacoesPorDia,
      facas: { ...facasResumo, em_afiacao: emAfiacaoAgora.n },
      facasGasto: facasGasto.gasto,
      facasCompradas,
      facasPorSubstrato,
      facasPorEstado,
    };
  });
