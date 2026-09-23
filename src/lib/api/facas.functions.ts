// Facas para afiação: envio (medida + substrato), retorno com estado
// (bom/regular/ruim) e solicitação de faca nova. Alimenta os apontamentos.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import {
  gravarMiniatura, lerMiniatura, lerPdfFaca, listarMiniaturas, listarPdfsFacas,
} from "@/server/facas-pdf.server";
import { lerRelacaoFacas, relacaoAtualizadaEm } from "@/server/facas-catalogo.server";
import { agora, getDb, uuid } from "@/server/db.server";
import { requirePerm } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";

export const listSubstratos = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    return getDb()
      .prepare("SELECT id, nome FROM faca_substratos ORDER BY nome COLLATE NOCASE ASC")
      .all() as { id: string; nome: string }[];
  });

export const addSubstrato = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().min(2).max(60) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "faca.substrato_criar");
    const db = getDb();
    const nome = data.nome.trim();
    const existe = db.prepare("SELECT id FROM faca_substratos WHERE nome = ?").get(nome);
    if (existe) throw new Error("Esse substrato já existe.");
    db.prepare("INSERT INTO faca_substratos (id, nome, created_at) VALUES (?,?,?)").run(
      uuid(), nome, agora(),
    );
    audit({ id: user.id, nome: user.nome }, "faca.substrato_criar", "faca_substratos", null, { nome });
    return { ok: true };
  });

export const enviarFacaAfiacao = createServerFn({ method: "POST" })
  .validator(z.object({ medida: z.string().min(1).max(80), substrato: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "faca.enviar_afiacao");

    const db = getDb();
    const { numero } = db
      .prepare("SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM faca_afiacoes")
      .get() as { numero: number };

    const id = uuid();
    db.prepare(
      "INSERT INTO faca_afiacoes (id, numero, user_id, user_nome, medida, substrato, status, created_at) VALUES (?,?,?,?,?,?,'enviada',?)",
    ).run(id, numero, user.id, user.nome, data.medida.trim(), data.substrato, agora());

    notifyUsers(
      usersWithRoles(["gestor", "admin"]),
      user.id,
      "Faca enviada para afiação",
      `#${String(numero).padStart(4, "0")} — ${data.medida} (${data.substrato})`,
      "/hub?tela=afiacao",
    );
    audit({ id: user.id, nome: user.nome }, "faca.enviar_afiacao", "faca_afiacoes", id, {
      numero, medida: data.medida, substrato: data.substrato,
    });
    return { id, numero };
  });

export const receberFaca = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      estado: z.enum(["bom", "regular", "ruim"]),
      solicitarNova: z.boolean(),
      observacao: z.string().nullish(),
      valor: z.number().nonnegative().nullish(),
      /* quem recebeu no balcão, digitado na tela — o PC da fábrica fica
         logado numa conta compartilhada */
      recebidaPor: z.string().trim().max(80).nullish(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "faca.receber");

    const db = getDb();
    const faca = db.prepare("SELECT * FROM faca_afiacoes WHERE id = ?").get(data.id) as
      | Record<string, unknown>
      | undefined;
    if (!faca) throw new Error("Faca não encontrada.");
    if (faca.status === "recebida") throw new Error("Essa faca já foi registrada como recebida.");

    db.prepare(
      "UPDATE faca_afiacoes SET status = 'recebida', estado = ?, nova_solicitada = ?, observacao = ?, valor = ?, recebida_por = ?, recebida_em = ? WHERE id = ?",
    ).run(data.estado, data.solicitarNova ? 1 : 0, data.observacao?.trim() || null, data.valor ?? null, data.recebidaPor?.trim() || user.nome, agora(), data.id);

    const rotuloEstado = { bom: "Bom", regular: "Regular", ruim: "Ruim" }[data.estado];
    const valorTxt = data.valor != null ? ` · R$ ${data.valor.toFixed(2).replace(".", ",")}` : "";
    notifyUsers(
      usersWithRoles(["gestor", "admin"]),
      user.id,
      "Faca voltou da afiação",
      `#${String(faca.numero as number).padStart(4, "0")} — ${faca.medida} · estado ${rotuloEstado}${valorTxt}${data.solicitarNova ? " · FACA NOVA SOLICITADA" : ""}`,
      "/hub?tela=afiacao",
    );
    audit({ id: user.id, nome: user.nome }, "faca.receber", "faca_afiacoes", data.id, {
      numero: faca.numero, medida: faca.medida, substrato: faca.substrato,
      estado: data.estado, novaSolicitada: data.solicitarNova,
      observacao: data.observacao?.trim() || null,
      valor: data.valor ?? null,
    });
    return { ok: true };
  });

export const listFacas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "tab.afiacao");
    // Tipado campo a campo: o cliente recebe isto serializado e `unknown` não passa.
    return getDb()
      .prepare(
        "SELECT id, numero, user_nome, medida, substrato, status, estado, nova_solicitada, nova_pedida, observacao, valor, recebida_por, recebida_em, created_at FROM faca_afiacoes ORDER BY (status = 'enviada') DESC, created_at DESC LIMIT 150",
      )
      .all() as {
        id: string; numero: number; user_nome: string | null; medida: string; substrato: string;
        status: string; estado: string | null; nova_solicitada: number; nova_pedida: number; observacao: string | null;
        valor: number | null; recebida_por: string | null; recebida_em: string | null; created_at: string;
      }[];
  });

/* ————— Desenhos técnicos (PDF) do acervo de facas ————— */

/** Nomes dos PDFs no share — a tela usa para saber quem tem desenho de verdade. */
export const listPdfsFacas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => listarPdfsFacas());

/** Catálogo mantido pela equipe na Relação de Ferramentais (fonte da verdade). */
export const listRelacaoFacas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => ({
    facas: lerRelacaoFacas(),
    atualizadaEm: relacaoAtualizadaEm(),
  }));

/** Conteúdo de um desenho, em base64 (o navegador monta o blob e exibe). */
export const getPdfFaca = createServerFn({ method: "POST" })
  .validator(z.object({ arquivo: z.string().min(5).max(120) }))
  .middleware([requireAuth])
  .handler(async ({ data }) => {
    const buf = lerPdfFaca(data.arquivo);
    if (!buf) throw new Error("Desenho não encontrado no acervo.");
    return { nome: data.arquivo, dataBase64: buf.toString("base64") };
  });

/** Miniatura pronta (PNG) de um desenho — `null` quando ainda não foi desenhada. */
export const getMiniaturaFaca = createServerFn({ method: "POST" })
  .validator(z.object({ arquivo: z.string().min(5).max(120) }))
  .middleware([requireAuth])
  .handler(async ({ data }) => {
    const buf = lerMiniatura(data.arquivo);
    return { dataBase64: buf ? buf.toString("base64") : null };
  });

/** Guarda no acervo a miniatura que o navegador desenhou. */
export const salvarMiniaturaFaca = createServerFn({ method: "POST" })
  .validator(z.object({ arquivo: z.string().min(5).max(120), dataBase64: z.string().min(1).max(3_000_000) }))
  .middleware([requireAuth])
  .handler(async ({ data }) => ({
    ok: gravarMiniatura(data.arquivo, Buffer.from(data.dataBase64, "base64")),
  }));

/** Quais desenhos já têm miniatura — a tela só desenha os que faltam. */
export const listMiniaturasFacas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => listarMiniaturas());

/** Marca (ou desmarca) que a faca nova já foi pedida ao fornecedor. */
/** Pedir uma faca nova SEM passar pela afiação. Antes a fila de facas novas só
 *  enchia sozinha (retorno marcado como ruim) — faca quebrada, perdida ou
 *  medida que ainda não existe não tinha por onde entrar. A linha nasce com
 *  status "nova": não é envio para afiar nem recebimento, só o pedido. */
export const solicitarFacaNova = createServerFn({ method: "POST" })
  .validator(z.object({
    medida: z.string().trim().min(1).max(80),
    substrato: z.string().min(1),
    motivo: z.string().trim().max(300).optional().default(""),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "faca.enviar_afiacao");

    const db = getDb();
    const { numero } = db
      .prepare("SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM faca_afiacoes")
      .get() as { numero: number };

    const id = uuid();
    db.prepare(
      "INSERT INTO faca_afiacoes (id, numero, user_id, user_nome, medida, substrato, status, nova_solicitada, observacao, created_at) VALUES (?,?,?,?,?,?,'nova',1,?,?)",
    ).run(id, numero, user.id, user.nome, data.medida.trim(), data.substrato, data.motivo.trim(), agora());

    notifyUsers(
      usersWithRoles(["gestor", "admin"]),
      user.id,
      "Faca nova solicitada",
      `#${String(numero).padStart(4, "0")} — ${data.medida} (${data.substrato})${data.motivo ? " · " + data.motivo : ""}`,
      "/hub?tela=afiacao",
    );
    audit({ id: user.id, nome: user.nome }, "faca.solicitar_nova", "faca_afiacoes", id, {
      numero, medida: data.medida, substrato: data.substrato, motivo: data.motivo,
    });
    return { id, numero };
  });

export const marcarNovaPedida = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), pedida: z.boolean() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "faca.comprar");
    const db = getDb();
    const f = db.prepare("SELECT numero, medida FROM faca_afiacoes WHERE id = ?").get(data.id) as
      | { numero: number; medida: string } | undefined;
    if (!f) throw new Error("Faca não encontrada.");
    db.prepare("UPDATE faca_afiacoes SET nova_pedida = ?, nova_pedida_em = ? WHERE id = ?")
      .run(data.pedida ? 1 : 0, data.pedida ? agora() : null, data.id);
    audit({ id: user.id, nome: user.nome }, data.pedida ? "faca.nova_pedida" : "faca.nova_pedida_desfeita", "faca_afiacoes", data.id, {
      numero: f.numero, medida: f.medida,
    });
    return { ok: true };
  });

/* ————— Catálogo de facas (mortas, acrescentadas e seções) —————
   Estava no localStorage: marcar uma faca como morta valia só para quem
   clicou, e o colega continuava vendo a faca disponível no catálogo. */

export const listCatalogoFacas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = getDb();
    return {
      mortas: (db.prepare("SELECT cod FROM facas_mortas").all() as { cod: string }[]).map((r) => r.cod),
      extras: (db.prepare("SELECT dados_json FROM facas_extras ORDER BY created_at DESC").all() as { dados_json: string }[])
        .map((r) => r.dados_json),
      secoes: (db.prepare("SELECT nome FROM facas_secoes ORDER BY nome").all() as { nome: string }[]).map((r) => r.nome),
    };
  });

/** Tira a faca do catálogo (morta) ou devolve para as ativas. */
export const marcarFacaMorta = createServerFn({ method: "POST" })
  .validator(z.object({ cod: z.string().trim().min(1).max(60), morta: z.boolean() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "faca.marcar_morta");
    const db = getDb();
    if (data.morta) {
      db.prepare("INSERT OR IGNORE INTO facas_mortas (cod, user_nome, created_at) VALUES (?,?,?)")
        .run(data.cod, user.nome, agora());
    } else {
      db.prepare("DELETE FROM facas_mortas WHERE cod = ?").run(data.cod);
    }
    audit({ id: user.id, nome: user.nome }, data.morta ? "faca.marcar_morta" : "faca.restaurar", "facas_mortas", data.cod, {});
    return { ok: true };
  });

/** Faca acrescentada à mão ao catálogo. */
export const salvarFacaExtra = createServerFn({ method: "POST" })
  .validator(z.object({ cod: z.string().trim().min(1).max(60), dados: z.string().min(2).max(4000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cadastro.medidas");
    const db = getDb();
    db.prepare(
      `INSERT INTO facas_extras (cod, dados_json, user_nome, created_at) VALUES (?,?,?,?)
       ON CONFLICT(cod) DO UPDATE SET dados_json = excluded.dados_json`,
    ).run(data.cod, data.dados, user.nome, agora());
    audit({ id: user.id, nome: user.nome }, "faca.catalogo_add", "facas_extras", data.cod, {});
    return { ok: true };
  });

export const salvarSecaoFaca = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().trim().min(1).max(60) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cadastro.medidas");
    getDb().prepare("INSERT OR IGNORE INTO facas_secoes (nome, created_at) VALUES (?,?)").run(data.nome, agora());
    audit({ id: user.id, nome: user.nome }, "faca.secao_add", "facas_secoes", data.nome, {});
    return { ok: true };
  });
