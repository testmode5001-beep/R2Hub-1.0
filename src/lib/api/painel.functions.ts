// Painel de produção no banco: máquinas do parque, o que cada uma está
// rodando agora e o histórico de produção apontada.
//
// Isto vivia no localStorage de cada computador, o que é o contrário do que a
// tela serve: o Mural no monitor da fábrica mostrava todas as máquinas livres
// porque quem carregou a OP foi outra pessoa, em outro PC.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid, type LinhaSQL } from "@/server/db.server";
import { requirePerm } from "@/server/auth.server";
import { audit } from "@/server/audit.server";

/** Máquinas + estado de cada uma + produção recente, numa consulta só. */
export const listPainel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = getDb();
    const maquinas = db
      .prepare("SELECT k, nome, valor, setor, fixa, ordem FROM painel_maquinas ORDER BY ordem, nome")
      .all() as LinhaSQL[];
    const estados = db
      .prepare("SELECT maquina, estado_json FROM painel_estado")
      .all() as { maquina: string; estado_json: string }[];
    const producao = db
      .prepare(
        `SELECT id, maquina, os, cliente, substrato, medida, ms, custo, metros, tag, user_nome, created_at
         FROM producao_apontamentos ORDER BY created_at DESC LIMIT 300`,
      )
      .all() as LinhaSQL[];

    // devolve o JSON cru; quem monta o mapa é o cliente (o serializador do
    // TanStack não aceita Record<string, unknown> como retorno)
    return { maquinas, estados, producao };
  });

/** Grava o estado de UMA máquina (carregar OP, rodar, pausar, limpar). */
export const salvarEstadoMaquina = createServerFn({ method: "POST" })
  .validator(z.object({ maquina: z.string().min(1).max(60), estado: z.any() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "tab.painel");
    const db = getDb();

    /* O estado da máquina carrega os CUSTOS (valor/hora, base por OS e a
       observação). A tela só deixa quem tem painel.custos editar, mas trancar
       apenas na tela não tranca nada: quem chama esta função direto passava
       por cima. Aqui a permissão só é exigida quando o custo MUDA de fato —
       carregar OS e apontar produção continuam livres para a fábrica. */
    const linha = db.prepare("SELECT estado_json FROM painel_estado WHERE maquina = ?").get(data.maquina) as
      | { estado_json: string } | undefined;
    let anterior: Record<string, unknown> = {};
    try { anterior = linha ? (JSON.parse(linha.estado_json) ?? {}) : {}; } catch { anterior = {}; }
    if (!linha) {
      /* Máquina que ainda não tem linha de estado (era o caso das 7 do parque):
         a tela manda o valor/hora CADASTRADO junto na primeira gravação. Sem
         esta linha isso contaria como "mudou o custo" e o operador não
         conseguiria nem carregar a primeira OS. */
      const m = db.prepare("SELECT valor FROM painel_maquinas WHERE k = ?").get(data.maquina) as
        | { valor: number } | undefined;
      if (m) anterior = { valor: m.valor };
    }
    const novo = (data.estado ?? {}) as Record<string, unknown>;
    const CAMPOS_CUSTO = ["valor", "base", "obs"];
    const mexeuNoCusto = CAMPOS_CUSTO.some(
      (k) => JSON.stringify(anterior[k] ?? null) !== JSON.stringify(novo[k] ?? null),
    );
    if (mexeuNoCusto) requirePerm(user, "painel.custos");

    db.prepare(
      `INSERT INTO painel_estado (maquina, estado_json, updated_at) VALUES (?,?,?)
       ON CONFLICT(maquina) DO UPDATE SET estado_json = excluded.estado_json, updated_at = excluded.updated_at`,
    ).run(data.maquina, JSON.stringify(data.estado ?? null), agora());
    return { ok: true };
  });

/** Cadastro do parque: incluir ou alterar uma máquina. */
export const salvarMaquina = createServerFn({ method: "POST" })
  .validator(
    z.object({
      k: z.string().min(1).max(60),
      nome: z.string().trim().min(1).max(80),
      valor: z.number().min(0).max(100_000),
      setor: z.string().max(40).optional().nullable(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "painel.maquinas");
    const db = getDb();
    const ordem = (db.prepare("SELECT COALESCE(MAX(ordem), 0) + 1 AS o FROM painel_maquinas").get() as { o: number }).o;
    db.prepare(
      `INSERT INTO painel_maquinas (k, nome, valor, setor, fixa, ordem) VALUES (?,?,?,?,0,?)
       ON CONFLICT(k) DO UPDATE SET nome = excluded.nome, valor = excluded.valor, setor = excluded.setor`,
    ).run(data.k, data.nome, data.valor, data.setor || null, ordem);
    audit({ id: user.id, nome: user.nome }, "painel.maquina_salvar", "painel_maquinas", data.k, { nome: data.nome, valor: data.valor });
    return { ok: true };
  });

export const removerMaquina = createServerFn({ method: "POST" })
  .validator(z.object({ k: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "painel.maquinas");
    const db = getDb();
    const m = db.prepare("SELECT nome, fixa FROM painel_maquinas WHERE k = ?").get(data.k) as
      | { nome: string; fixa: number } | undefined;
    if (!m) throw new Error("Máquina não encontrada.");
    // as 5 impressoras e as 2 rebobinadeiras são o parque real: não saem pela tela
    if (m.fixa) throw new Error(`${m.nome} faz parte do parque e não pode ser removida.`);
    db.prepare("DELETE FROM painel_maquinas WHERE k = ?").run(data.k);
    db.prepare("DELETE FROM painel_estado WHERE maquina = ?").run(data.k);
    audit({ id: user.id, nome: user.nome }, "painel.maquina_remover", "painel_maquinas", data.k, { nome: m.nome });
    return { ok: true };
  });

/** Fecha a produção de uma OP (finalizada ou cancelada) no histórico. */
export const registrarProducao = createServerFn({ method: "POST" })
  .validator(
    z.object({
      maquina: z.string().trim().min(1).max(80),
      os: z.string().trim().max(40).optional().default(""),
      cliente: z.string().trim().max(160).optional().default(""),
      substrato: z.string().trim().max(120).optional().default(""),
      medida: z.string().trim().max(80).optional().default(""),
      ms: z.number().min(0),
      custo: z.number().min(0),
      metros: z.number().min(0),
      tag: z.enum(["Finalizado", "Cancelado"]),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, data.tag === "Cancelado" ? "painel.cancelar" : "painel.finalizar");
    const db = getDb();
    const id = uuid();
    db.prepare(
      `INSERT INTO producao_apontamentos (id, maquina, os, cliente, substrato, medida, ms, custo, metros, tag, user_nome, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id, data.maquina, data.os, data.cliente, data.substrato, data.medida,
      Math.round(data.ms), data.custo, data.metros, data.tag, user.nome, agora(),
    );
    audit({ id: user.id, nome: user.nome }, "painel.producao", "producao_apontamentos", id, {
      maquina: data.maquina, os: data.os, tag: data.tag, metros: data.metros,
    });
    return { id };
  });
