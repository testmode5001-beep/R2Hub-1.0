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
import { separarCores } from "@/lib/cores";

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
        <p style="margin:0 0 12px;color:#666">R2 Etiquetas · enviada por ${user.nome} em ${new Date().toLocaleString("pt-BR")}</p>
        ${data.cliente ? `<p><b>Cliente/Referência:</b> ${data.cliente}</p>` : ""}
        <p><b>Tipo de clichê:</b> ${data.tipo}</p>
        <p style="margin-bottom:4px"><b>Cores (${data.cores.length}):</b></p>
        <ul style="margin:0 0 0 18px;padding:0;font-size:14px">${linhasCores}</ul>
        ${data.observacao ? `<p style="margin-top:12px"><b>Observações:</b><br>${data.observacao.replace(/\n/g, "<br>")}</p>` : ""}
        <p style="margin-top:12px;color:#666">${salvos.length} arquivo(s) em anexo.</p>
      </div>`;

    const resultado = await enviarEmail({
      para: destino ?? "",
      assunto: `Solicitação de Clichê #${String(numero).padStart(4, "0")}${data.cliente ? ` · ${data.cliente}` : ""} · R2 Etiquetas`,
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
      `#${String(numero).padStart(4, "0")} · ${data.motivo}${data.cliente ? ` (${data.cliente})` : ""}`,
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

/* O motivo no texto do histórico ("Clichê marcado para refação. Motivo: X
   (obs)"), lido sem regex: o texto vem da tela, e a regex de antes custava N³
   num texto com muitos espaços (travava o hub inteiro). Motivo da lista com
   parênteses ("Gasto (uso)") sai inteiro: confere primeiro com a lista. */
function motivoDaRefacao(obs: string | null, daLista: string[]): string {
  if (!obs) return "";
  const i = obs.indexOf("Motivo:");
  if (i < 0) return "";
  let resto = obs.slice(i + 7).trim();
  const achado = daLista
    .filter((m) => resto === m || resto === `${m}.` || resto.startsWith(`${m} (`))
    .sort((a, b) => b.length - a.length)[0];
  if (achado) return achado;
  const p = resto.indexOf(" (");
  if (p >= 0) resto = resto.slice(0, p);
  return resto.endsWith(".") ? resto.slice(0, -1).trim() : resto.trim();
}

/* As linhas do histórico que só ANOTAM algo na etapa em que o pedido está
   (e levam a chave dela): a mesma lista do pedido aberto (PedidoDetalheHub10). */
const ANOTACOES_DO_HISTORICO = ["Resposta ao cliente", "Prova de impressão", "Clichê chegou", "Valores do clichê", "Voltou para a clicheria"];

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
    /* `qtde` é o número de chegadas (registros); `itens`, o de clichês que
       chegaram (cada cor lançada num registro é um clichê). O relatório
       mostrava as chegadas como "clichês recebidos" (simulação 5, 05/10/2026:
       3 chegadas com 8 clichês). */
    const clichesResumo = db
      .prepare(
        `SELECT COUNT(*) AS qtde, COALESCE(SUM(total), 0) AS total,
                COALESCE(SUM(CASE WHEN json_valid(itens) THEN json_array_length(itens) ELSE 0 END), 0) AS itens
         FROM cliche_registros WHERE ${DIA_DO_GASTO} BETWEEN ? AND ?`,
      )
      .get(de, ate) as { qtde: number; total: number; itens: number };

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

    /* Refações de clichê por motivo: as marcadas dentro do pedido e as de
       clientes antigos cadastradas pelo "Refazer clichê" de Aprovações, juntas
       (Augusto, 02/10/2026). As duas gravam no histórico o mesmo texto,
       "Clichê marcado para refação. Motivo: X (observação)". */
    const refacoesNoPeriodo = db
      .prepare(
        `SELECT observacao FROM pedido_historico
         WHERE status = 'refazer_cliche' AND date(created_at, 'localtime') BETWEEN ? AND ?
           AND COALESCE(observacao, '') NOT LIKE 'Pedido reativado%'`,
      )
      .all(de, ate) as { observacao: string | null }[];
    const motivosDaLista = (db.prepare("SELECT nome FROM cliche_motivos").all() as { nome: string }[]).map((m) => m.nome);
    const contaRefacao = new Map<string, number>();
    for (const r of refacoesNoPeriodo) {
      const motivo = motivoDaRefacao(r.observacao, motivosDaLista) || "Sem motivo registrado";
      contaRefacao.set(motivo, (contaRefacao.get(motivo) ?? 0) + 1);
    }
    const refacoesPorMotivo = [...contaRefacao]
      .map(([motivo, qtde]) => ({ motivo, qtde }))
      .sort((a, b) => b.qtde - a.qtde);

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

    /* Os movimentos do período, do histórico dos pedidos: quando, qual pedido,
       para qual etapa e quem. A observação fica de fora (pode levar o valor do
       clichê, que nem todo mundo vê). Os "Últimos movimentos" do relatório
       eram os pedidos com o status de agora (simulação 5, 05/10/2026). */
    const movimentos = db
      .prepare(
        `SELECT h.created_at AS quando, p.numero AS numero, p.cliente AS cliente, h.status AS status, h.user_nome AS quem
         FROM pedido_historico h JOIN pedidos p ON p.id = h.pedido_id
         WHERE date(h.created_at, 'localtime') BETWEEN ? AND ?
         ORDER BY h.created_at DESC LIMIT 300`,
      )
      .all(de, ate) as { quando: string; numero: number; cliente: string; status: string; quem: string | null }[];

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
      refacoesPorMotivo,
      materias,
      medidas,
      vendedoras,
      artesAprovacoesPorDia,
      facas: { ...facasResumo, em_afiacao: emAfiacaoAgora.n },
      facasGasto: facasGasto.gasto,
      facasCompradas,
      facasPorSubstrato,
      facasPorEstado,
      movimentos,
      cartoes: cartoesDoRelatorio(db, de, ate),
    };
  });

/** As contas dos cartões de Relatórios (Augusto, 07/10/2026): o que cada
    cartão precisa, do banco, sem teto (os movimentos acima param em 300).
    Pedidos: alterações (o Pedir revisão), cancelados e o tempo da
    solicitação à primeira aprovação. Clichês: cada chegada do período com a
    espessura do pedido, a primeira aprovação (a espera até a chegada) e se
    ela veio depois de uma refação (o valor dos refeitos); as refações por
    cliente, no período e desde sempre. */
function cartoesDoRelatorio(db: ReturnType<typeof getDb>, de: string, ate: string) {
  const NO_PERIODO = "date(h.created_at, 'localtime') BETWEEN ? AND ?";
  /* A linha que só ANOTA algo na etapa em que o pedido está (a resposta ao
     cliente, a prova, a chegada do clichê: a mesma lista do pedido aberto,
     em PedidoDetalheHub10) leva a chave da etapa no histórico, e a reativação
     grava a etapa para onde o pedido volta ("Pedido reativado. Volta para
     Revisão."). Nenhuma das duas é alteração pedida nem cancelamento
     (simulação 6, 07/10/2026: a reativação contava como alteração). */
  const SO_ACAO = ["Pedido reativado", ...ANOTACOES_DO_HISTORICO]
    .map((inicio) => `COALESCE(h.observacao, '') NOT LIKE '${inicio}%'`).join(" AND ");
  const alteracoes = db
    .prepare(
      `SELECT h.created_at AS quando, p.numero AS numero, p.cliente AS cliente
       FROM pedido_historico h JOIN pedidos p ON p.id = h.pedido_id
       WHERE h.status = 'revisao' AND ${SO_ACAO} AND ${NO_PERIODO} ORDER BY h.created_at`,
    )
    .all(de, ate) as { quando: string; numero: number; cliente: string }[];
  const cancelados = db
    .prepare(
      `SELECT p.numero AS numero, p.cliente AS cliente, MIN(h.created_at) AS quando
       FROM pedido_historico h JOIN pedidos p ON p.id = h.pedido_id
       WHERE h.status = 'cancelado' AND ${SO_ACAO} AND ${NO_PERIODO} GROUP BY p.id ORDER BY quando`,
    )
    .all(de, ate) as { numero: number; cliente: string; quando: string }[];
  /* O cartão de Refazer clichê de cliente antigo nasce como pedido (tipo
     'cliche', com a refação gravada no mesmo instante, em
     cadastrarRefazerCliche), mas não é pedido solicitado: ele já conta em
     Clichês refeitos. Quem cadastra é o design ou a administração, que
     apareciam como vendedoras (simulação 6, 07/10/2026). A reposição de
     clichê (solicitarCliche) também é tipo 'cliche', mas nasce sem refação e
     continua contando como pedido. */
  const CARTAO_DE_REFACAO = `p.tipo = 'cliche' AND EXISTS (SELECT 1 FROM pedido_historico hr
    WHERE hr.pedido_id = p.id AND hr.status = 'refazer_cliche' AND hr.created_at = p.created_at)`;
  const cartoesDeRefacao = (db
    .prepare(`SELECT p.numero AS numero FROM pedidos p WHERE date(p.created_at, 'localtime') BETWEEN ? AND ? AND ${CARTAO_DE_REFACAO}`)
    .all(de, ate) as { numero: number }[]).map((r) => r.numero);
  const vendedoras = db
    .prepare(
      `SELECT COALESCE(u.nome, 'Desconhecido') AS nome, COUNT(*) AS qtde
       FROM pedidos p LEFT JOIN users u ON u.id = p.vendedor_id
       WHERE date(p.created_at, 'localtime') BETWEEN ? AND ? AND NOT (${CARTAO_DE_REFACAO})
       GROUP BY p.vendedor_id ORDER BY qtde DESC`,
    )
    .all(de, ate) as { nome: string; qtde: number }[];
  /* a primeira aprovação de cada pedido, quando ela cai no período */
  const aprovacoes = db
    .prepare(
      `SELECT p.numero AS numero, p.cliente AS cliente, p.created_at AS entrada, MIN(h.created_at) AS aprovado
       FROM pedido_historico h JOIN pedidos p ON p.id = h.pedido_id
       WHERE h.status = 'aprovada' GROUP BY p.id
       HAVING date(MIN(h.created_at), 'localtime') BETWEEN ? AND ?`,
    )
    .all(de, ate) as { numero: number; cliente: string; entrada: string; aprovado: string }[];
  const chegadas = db
    .prepare(
      `SELECT r.total AS total, r.itens AS itens, r.data_chegada AS data_chegada, r.hora_chegada AS hora_chegada, r.created_at AS lancado,
              p.numero AS numero, p.cliente AS cliente, p.cliche_espessura AS espessura,
              (SELECT MIN(h.created_at) FROM pedido_historico h WHERE h.pedido_id = r.pedido_id AND h.status = 'aprovada') AS aprovado,
              (SELECT COUNT(*) FROM pedido_historico h WHERE h.pedido_id = r.pedido_id AND h.status = 'refazer_cliche'
                 AND COALESCE(h.observacao, '') NOT LIKE 'Pedido reativado%' AND h.created_at < r.created_at) AS refacoes_antes
       FROM cliche_registros r LEFT JOIN pedidos p ON p.id = r.pedido_id
       WHERE COALESCE(r.data_chegada, date(r.created_at, 'localtime')) BETWEEN ? AND ?
       ORDER BY r.created_at`,
    )
    .all(de, ate) as {
      total: number | null; itens: string | null; data_chegada: string | null; hora_chegada: string | null; lancado: string;
      numero: number | null; cliente: string | null; espessura: string | null; aprovado: string | null; refacoes_antes: number;
    }[];
  const REFACAO = "h.status = 'refazer_cliche' AND COALESCE(h.observacao, '') NOT LIKE 'Pedido reativado%'";
  const refacoesPorCliente = db
    .prepare(
      `SELECT p.cliente AS cliente, COUNT(*) AS qtde
       FROM pedido_historico h JOIN pedidos p ON p.id = h.pedido_id
       WHERE ${REFACAO} AND ${NO_PERIODO} GROUP BY p.cliente ORDER BY qtde DESC`,
    )
    .all(de, ate) as { cliente: string; qtde: number }[];
  const refacoesDesdeSempre = db
    .prepare(
      `SELECT p.cliente AS cliente, COUNT(*) AS qtde
       FROM pedido_historico h JOIN pedidos p ON p.id = h.pedido_id
       WHERE ${REFACAO} GROUP BY p.cliente`,
    )
    .all() as { cliente: string; qtde: number }[];
  /* Cada refação do período com quantos clichês ela refaz: cada cor é um
     clichê, como em Clichês aprovados (simulação 6, 07/10/2026: cada refação
     valia 1, tivesse 1 ou 3 cores). No cartão de Refazer clichê, as cores do
     cartão; na refação de dentro do pedido, as da arte (sem prova lida, as
     pedidas), porque o hub não guarda quais foram marcadas (o "Refazer
     clichê" do pedido pede só o motivo). Pedido sem as cores escritas conta 1 clichê (uma refação refaz
     pelo menos um), e a tela diz quantos foram assim. */
  const motivosDaLista = (db.prepare("SELECT nome FROM cliche_motivos").all() as { nome: string }[]).map((m) => m.nome);
  const refacoes = (db
    .prepare(
      `SELECT h.created_at AS quando, h.observacao AS observacao, p.numero AS numero, p.cliente AS cliente,
              p.cores AS cores, p.cores_desc AS cores_desc, p.cores_arte AS cores_arte,
              CASE WHEN p.tipo = 'cliche' AND h.created_at = p.created_at THEN 1 ELSE 0 END AS do_cartao
       FROM pedido_historico h JOIN pedidos p ON p.id = h.pedido_id
       WHERE ${REFACAO} AND ${NO_PERIODO} ORDER BY h.created_at`,
    )
    .all(de, ate) as { quando: string; observacao: string | null; numero: number; cliente: string; cores: string | null; cores_desc: string | null; cores_arte: string | null; do_cartao: number }[])
    .map((r) => {
      /* com a prova lida, as cores da arte: são os clichês que existem */
      const daArte = separarCores(r.cores_arte).length;
      const numero = /^\s*(\d+)/.exec(String(r.cores ?? ""));
      const escritas = daArte || (numero && Number(numero[1]) > 0 ? Number(numero[1]) : separarCores(r.cores_desc).length);
      return {
        quando: r.quando, numero: r.numero, cliente: r.cliente,
        motivo: motivoDaRefacao(r.observacao, motivosDaLista) || "Sem motivo registrado",
        cliches: Math.max(1, escritas), semCores: escritas === 0, doPedido: r.do_cartao !== 1,
      };
    });
  return {
    alteracoes,
    cancelados,
    cartoesDeRefacao,
    vendedoras,
    refacoes,
    aprovacoes,
    chegadas: chegadas.map((c) => {
      let n = 0;
      try { n = c.itens ? (JSON.parse(c.itens) as unknown[]).length : 0; } catch { n = 0; }
      return { ...c, itens: n };
    }),
    refacoesPorCliente,
    refacoesDesdeSempre,
  };
}
