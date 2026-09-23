// Anotações pessoais do usuário — card da Central, lembretes da Home e modal
// "Anotações" do topo (design v1a) compartilham a mesma lista.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid } from "@/server/db.server";

export const listNotas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const linhas = getDb()
      .prepare(
        "SELECT id, texto, quando, feito, created_at FROM user_notas WHERE user_id = ? ORDER BY feito ASC, created_at DESC LIMIT 200",
      )
      .all(user.id) as { id: string; texto: string; quando: string | null; feito: number; created_at: string }[];
    return linhas.map((n) => ({
      id: n.id,
      texto: n.texto,
      quando: n.quando ?? null,
      feito: !!n.feito,
      created_at: n.created_at,
    }));
  });

export const criarNota = createServerFn({ method: "POST" })
  .validator(z.object({ texto: z.string().trim().min(1).max(500), quando: z.string().max(20).nullish() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const id = uuid();
    const ts = agora();
    getDb()
      .prepare("INSERT INTO user_notas (id, user_id, texto, quando, feito, created_at, updated_at) VALUES (?,?,?,?,0,?,?)")
      .run(id, user.id, data.texto.trim(), data.quando ?? null, ts, ts);
    return { id };
  });

export const alternarNota = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), feito: z.boolean() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    getDb()
      .prepare("UPDATE user_notas SET feito = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(data.feito ? 1 : 0, agora(), data.id, user.id);
    return { ok: true };
  });

export const excluirNota = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    getDb().prepare("DELETE FROM user_notas WHERE id = ? AND user_id = ?").run(data.id, user.id);
    return { ok: true };
  });

export const limparNotasConcluidas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    getDb().prepare("DELETE FROM user_notas WHERE user_id = ? AND feito = 1").run(user.id);
    return { ok: true };
  });
