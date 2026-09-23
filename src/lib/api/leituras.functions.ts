// Fila de leituras de OP: o celular (ou a tela Leitura) registra, o painel da
// Fábrica carrega na máquina e marca como usada. Substitui o localStorage —
// a fila agora é uma só para a fábrica inteira.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid, type LinhaSQL } from "@/server/db.server";
import { requirePerm, temPerm } from "@/server/auth.server";

/** OP e Painel enxergam a fila: a página OP ganhou permissão própria. */
function exigeOpOuPainel(user: Parameters<typeof temPerm>[0]) {
  if (!temPerm(user, "tab.op") && !temPerm(user, "tab.painel")) {
    throw new Error("Seu acesso não inclui a leitura de OP.");
  }
}
import { audit } from "@/server/audit.server";

export const listLeituras = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    exigeOpOuPainel(user);
    return getDb()
      .prepare(
        `SELECT id, user_nome, op, cliente, descricao, medida, substrato, metragem,
                carreiras, nucleo, rolos, entrega, usada, created_at
         FROM leituras ORDER BY created_at DESC LIMIT 100`,
      )
      .all() as LinhaSQL[];
  });

export const registrarLeituraOp = createServerFn({ method: "POST" })
  .validator(z.object({
    op: z.string().trim().min(1).max(40),
    cliente: z.string().trim().max(120).nullish(),
    descricao: z.string().trim().max(2000).nullish(),
    medida: z.string().trim().min(1).max(40),
    substrato: z.string().trim().min(1).max(60),
    metragem: z.string().trim().min(1).max(20),
    carreiras: z.string().trim().max(10).nullish(),
    nucleo: z.string().trim().max(20).nullish(),
    rolos: z.string().trim().max(10).nullish(),
    entrega: z.string().trim().max(20).nullish(),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    exigeOpOuPainel(user);
    const id = uuid();
    const ts = agora();
    getDb()
      .prepare(
        `INSERT INTO leituras (id, user_id, user_nome, op, cliente, descricao, medida, substrato,
                               metragem, carreiras, nucleo, rolos, entrega, usada, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`,
      )
      .run(
        id, user.id, user.nome, data.op, data.cliente ?? null, data.descricao ?? null,
        data.medida, data.substrato, data.metragem, data.carreiras ?? null,
        data.nucleo ?? null, data.rolos ?? null, data.entrega ?? null, ts,
      );
    audit({ id: user.id, nome: user.nome }, "leitura.registrar", "leituras", id, {
      op: data.op, medida: data.medida,
    });
    return { id, created_at: ts };
  });

export const marcarLeituraUsadaFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    // marcar usada acontece ao carregar a OS na máquina
    requirePerm(user, "painel.carregar_os");
    getDb().prepare("UPDATE leituras SET usada = 1 WHERE id = ?").run(data.id);
    return { ok: true };
  });
