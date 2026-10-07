// Notificações internas (Etapa 3): sino com contador, via polling curto.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { getDb, type LinhaSQL } from "@/server/db.server";

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const { unread } = db
      .prepare("SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND lida = 0")
      .get(user.id) as { unread: number };
    const items = db
      .prepare(
        "SELECT id, titulo, corpo, url, lida, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
      )
      .all(user.id) as LinhaSQL[];
    return { unread, items };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.string()).optional(), todas: z.boolean().optional() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    if (data.todas) {
      db.prepare("UPDATE notifications SET lida = 1 WHERE user_id = ?").run(user.id);
    } else if (data.ids?.length) {
      const marks = data.ids.map(() => "?").join(",");
      db.prepare(
        `UPDATE notifications SET lida = 1 WHERE user_id = ? AND id IN (${marks})`,
      ).run(user.id, ...data.ids);
    }
    return { ok: true };
  });
