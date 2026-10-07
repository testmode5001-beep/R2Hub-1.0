// Notificações internas (Etapa 3): gravadas no banco e entregues ao navegador
// por polling curto (sino), sem depender de serviços externos.
import { agora, getDb, uuid } from "./db.server";

/** Cria uma notificação para cada usuário da lista (exceto o próprio autor da ação). */
export function notifyUsers(
  userIds: string[],
  autorId: string | null,
  titulo: string,
  corpo: string,
  url: string,
) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO notifications (id, user_id, titulo, corpo, url, lida, created_at) VALUES (?,?,?,?,?,0,?)",
  );
  const unique = [...new Set(userIds)].filter((id) => id && id !== autorId);
  /* Avisar é o passo SECUNDÁRIO: o que importa já foi gravado quando se chega
     aqui. Um destinatário que não existe mais (usuário removido, id órfão)
     quebrava o insert, a server fn inteira rejeitava e a tela dizia que a
     ação falhou — enquanto o banco já tinha a alteração. Aconteceu ao
     responder uma pergunta: a resposta gravou e a modal manteve o diálogo
     aberto, convidando a responder de novo. Cada aviso agora falha sozinho. */
  for (const id of unique) {
    try {
      stmt.run(uuid(), id, titulo, corpo, url, agora());
    } catch {
      /* sem destinatário não há aviso — a operação que chamou continua de pé */
    }
  }
}

/** IDs de todos os usuários ativos que têm um dos papéis informados. */
export function usersWithRoles(roles: string[]): string[] {
  const db = getDb();
  const placeholders = roles.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id FROM users WHERE ativo = 1 AND role IN (${placeholders})`)
    .all(...roles) as { id: string }[];
  return rows.map((r) => r.id);
}
