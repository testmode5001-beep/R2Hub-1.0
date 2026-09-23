// Estoque no banco: falta de matéria-prima e etiquetas por caixa.
//
// Ficava tudo em localStorage, e isso quebrava o propósito da tela: falta de MP
// é recado para a fábrica inteira, mas só aparecia para quem apontou — em
// outro computador a lista estava vazia, e limpar o cache do navegador apagava
// o histórico. Agora é uma coisa só para todo mundo.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid, type LinhaSQL } from "@/server/db.server";
import { audit } from "@/server/audit.server";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";

const STATUS = ["aberta", "resolvida", "substituida"] as const;

/** Falta + etiquetas numa consulta só (a tela mostra as duas abas). */
export const listEstoque = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = getDb();
    const faltas = db
      .prepare(
        `SELECT id, pedido_num, motivo, obs, previsao, status, substituto,
                user_nome, resolvido_em, resolvido_por, created_at
         FROM estoque_faltas ORDER BY created_at DESC`,
      )
      .all() as LinhaSQL[];
    const etiquetas = db
      .prepare(
        `SELECT id, medida, substrato, cliente, caixas, por_caixa, minimo
         FROM estoque_etiquetas ORDER BY created_at DESC`,
      )
      .all() as LinhaSQL[];
    return { faltas, etiquetas };
  });

export const registrarFalta = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pedidoNum: z.string().trim().min(1).max(20),
      motivo: z.string().trim().min(1).max(120),
      obs: z.string().trim().max(500).optional().default(""),
      previsao: z.string().trim().max(40).optional().default(""),
      /* quem ACHOU a falta, digitado na tela — o PC do estoque fica logado
         numa conta só, então o usuário da sessão não diz quem apontou */
      quem: z.string().trim().max(80).optional().default(""),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const id = uuid();
    db.prepare(
      `INSERT INTO estoque_faltas (id, pedido_num, motivo, obs, previsao, status, user_id, user_nome, created_at)
       VALUES (?,?,?,?,?,'aberta',?,?,?)`,
    ).run(id, data.pedidoNum, data.motivo, data.obs, data.previsao, user.id, data.quem || user.nome, agora());

    // a fábrica precisa saber na hora — é o motivo de existir desta tela.
    // A vendedora do pedido também: é o pedido DELA que vai atrasar.
    const numero = parseInt(data.pedidoNum.replace(/^#/, ""), 10);
    const dono = Number.isFinite(numero)
      ? (db.prepare("SELECT vendedor_id FROM pedidos WHERE numero = ?").get(numero) as { vendedor_id: string } | undefined)
      : undefined;
    notifyUsers(
      [...usersWithRoles(["gestor", "admin", "producao", "estoque"]), ...(dono?.vendedor_id ? [dono.vendedor_id] : [])],
      user.id,
      `Falta de MP na OS ${data.pedidoNum}`,
      `${data.motivo}${data.obs ? " — " + data.obs : ""}`,
      "/hub?tela=estoque",
    );
    audit({ id: user.id, nome: user.nome }, "estoque.falta_apontar", "estoque_faltas", id, {
      pedido: data.pedidoNum, motivo: data.motivo, apontadoPor: data.quem || undefined,
    });
    return { id };
  });

/** Resolve (MP chegou), substitui por outro substrato, ou reabre. */
export const mudarFalta = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      status: z.enum(STATUS),
      substituto: z.string().trim().max(120).optional().default(""),
      /** quem recebeu/resolveu, digitado na tela (PC compartilhado) */
      quem: z.string().trim().max(80).optional().default(""),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const falta = db.prepare("SELECT pedido_num, motivo FROM estoque_faltas WHERE id = ?").get(data.id) as
      | { pedido_num: string; motivo: string } | undefined;
    if (!falta) throw new Error("Apontamento não encontrado.");

    if (data.status === "aberta") {
      db.prepare(
        "UPDATE estoque_faltas SET status = 'aberta', substituto = NULL, resolvido_em = NULL, resolvido_por = NULL WHERE id = ?",
      ).run(data.id);
    } else {
      db.prepare(
        "UPDATE estoque_faltas SET status = ?, substituto = ?, resolvido_em = ?, resolvido_por = ? WHERE id = ?",
      ).run(data.status, data.substituto || null, agora(), data.quem || user.nome, data.id);

      // a tela promete "vendedora e gestor avisados" — agora é verdade
      const numero = parseInt(String(falta.pedido_num).replace(/^#/, ""), 10);
      const dono = Number.isFinite(numero)
        ? (db.prepare("SELECT vendedor_id FROM pedidos WHERE numero = ?").get(numero) as { vendedor_id: string } | undefined)
        : undefined;
      notifyUsers(
        [...usersWithRoles(["gestor", "admin"]), ...(dono?.vendedor_id ? [dono.vendedor_id] : [])],
        user.id,
        data.status === "substituida"
          ? `MP substituída na OS ${falta.pedido_num}`
          : `MP chegou — OS ${falta.pedido_num}`,
        `${falta.motivo}${data.substituto ? " → " + data.substituto : ""}`,
        "/hub?tela=estoque",
      );
    }
    audit({ id: user.id, nome: user.nome }, "estoque.falta_" + data.status, "estoque_faltas", data.id, {
      pedido: falta.pedido_num, substituto: data.substituto || undefined, recebidoPor: data.quem || undefined,
    });
    return { ok: true };
  });

export const salvarEtiquetaEstoque = createServerFn({ method: "POST" })
  .validator(
    z.object({
      medida: z.string().trim().min(1).max(60),
      substrato: z.string().trim().max(80).optional().default(""),
      cliente: z.string().trim().max(120).optional().default(""),
      caixas: z.number().int().min(0).max(100_000),
      porCaixa: z.number().int().min(0).max(100_000),
      minimo: z.number().int().min(0).max(100_000),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const id = uuid();
    const ts = agora();
    db.prepare(
      `INSERT INTO estoque_etiquetas (id, medida, substrato, cliente, caixas, por_caixa, minimo, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    ).run(id, data.medida, data.substrato, data.cliente, data.caixas, data.porCaixa, data.minimo, ts, ts);
    audit({ id: user.id, nome: user.nome }, "estoque.etiqueta_criar", "estoque_etiquetas", id, { medida: data.medida });
    return { id };
  });

/** Entrada/saída de caixa. O total nunca fica negativo. */
export const ajustarEtiquetaEstoque = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), delta: z.number().int().min(-10_000).max(10_000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const linha = db.prepare("SELECT caixas, medida FROM estoque_etiquetas WHERE id = ?").get(data.id) as
      | { caixas: number; medida: string } | undefined;
    if (!linha) throw new Error("Etiqueta não encontrada.");
    const novo = Math.max(0, (Number(linha.caixas) || 0) + data.delta);
    db.prepare("UPDATE estoque_etiquetas SET caixas = ?, updated_at = ? WHERE id = ?").run(novo, agora(), data.id);
    audit({ id: user.id, nome: user.nome }, "estoque.etiqueta_ajustar", "estoque_etiquetas", data.id, {
      medida: linha.medida, de: linha.caixas, para: novo,
    });
    return { caixas: novo };
  });

export const removerEtiquetaEstoque = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const linha = db.prepare("SELECT medida FROM estoque_etiquetas WHERE id = ?").get(data.id) as
      | { medida: string } | undefined;
    db.prepare("DELETE FROM estoque_etiquetas WHERE id = ?").run(data.id);
    audit({ id: user.id, nome: user.nome }, "estoque.etiqueta_excluir", "estoque_etiquetas", data.id, {
      medida: linha?.medida,
    });
    return { ok: true };
  });
