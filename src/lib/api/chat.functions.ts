// Chat da equipe — o canal geral, sem pedido no meio. As conversas de cada
// pedido continuam em pedido_comentarios (listConversas); aqui é o corredor.
// Sem permissão especial: quem entra no hub conversa.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid } from "@/server/db.server";

const LIMITE = 100;

export const listChatGeral = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    const linhas = getDb()
      .prepare(
        `SELECT id, user_id, user_nome, texto, created_at
           FROM chat_mensagens WHERE canal = 'geral'
          ORDER BY created_at DESC LIMIT ${LIMITE}`,
      )
      .all() as { id: string; user_id: string | null; user_nome: string | null; texto: string; created_at: string }[];
    return linhas.reverse();   // do mais antigo para o mais novo, como se lê
  });

/** Colegas com quem dá para conversar (ativos, menos eu). Só nome e id. */
export const listColegas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    return getDb()
      .prepare("SELECT id, nome, role FROM users WHERE ativo = 1 AND id <> ? ORDER BY nome COLLATE NOCASE")
      .all(user.id) as { id: string; nome: string; role: string }[];
  });

/**
 * TODAS as minhas conversas diretas de uma vez (as 300 últimas linhas em que
 * eu falei ou fui falado). A modal agrupa por pessoa — numa equipe deste
 * tamanho isso é bem mais simples do que uma chamada por conversa aberta.
 */
export const listChatDireto = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const linhas = getDb()
      .prepare(
        `SELECT id, user_id, user_nome, para_id, para_nome, texto, created_at
           FROM chat_mensagens
          WHERE canal = 'dm' AND (user_id = ? OR para_id = ?)
          ORDER BY created_at DESC LIMIT 300`,
      )
      .all(user.id, user.id) as {
        id: string; user_id: string | null; user_nome: string | null;
        para_id: string | null; para_nome: string | null; texto: string; created_at: string;
      }[];
    return linhas.reverse();
  });

export const enviarChatDireto = createServerFn({ method: "POST" })
  .validator(z.object({ paraId: z.string().min(1), texto: z.string().min(1).max(2000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const destino = db.prepare("SELECT id, nome, ativo FROM users WHERE id = ?").get(data.paraId) as
      | { id: string; nome: string; ativo: number }
      | undefined;
    if (!destino || !destino.ativo) throw new Error("Essa pessoa não está mais no sistema.");

    const id = uuid();
    db.prepare(
      `INSERT INTO chat_mensagens (id, canal, user_id, user_nome, para_id, para_nome, texto, created_at)
       VALUES (?,'dm',?,?,?,?,?,?)`,
    ).run(id, user.id, user.nome, destino.id, destino.nome, data.texto.trim(), agora());
    return { id };
  });

export const enviarChatGeral = createServerFn({ method: "POST" })
  .validator(z.object({ texto: z.string().min(1).max(2000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const id = uuid();
    getDb()
      .prepare("INSERT INTO chat_mensagens (id, canal, user_id, user_nome, texto, created_at) VALUES (?,'geral',?,?,?,?)")
      .run(id, user.id, user.nome, data.texto.trim(), agora());
    return { id };
  });
