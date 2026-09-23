// Sessões próprias (V3): token aleatório guardado como hash no banco.
// Substitui o Supabase Auth — o gestor cria usuários e senhas no painel.
import { createHash, randomBytes } from "node:crypto";

import { agora, effectivePermissions, getDb, type Permission } from "./db.server";

export type AuthUser = {
  id: string;
  username: string;
  nome: string;
  role: string;
  permissions: Permission[];
};

const SESSION_DIAS = 30;

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + SESSION_DIAS * 86_400_000).toISOString();
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(agora());
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)",
  ).run(sha256(token), userId, agora(), expira);
  return token;
}

export function destroySession(token: string) {
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function destroyUserSessions(userId: string) {
  getDb().prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function userFromToken(token: string): AuthUser | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT s.expires_at, u.id, u.username, u.nome, u.role, u.ativo
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .get(sha256(token)) as
    | { expires_at: string; id: string; username: string; nome: string; role: string; ativo: number }
    | undefined;
  if (!row) return null;
  if (row.expires_at < agora() || !row.ativo) return null;
  return {
    id: row.id,
    username: row.username,
    nome: row.nome,
    role: row.role,
    permissions: effectivePermissions(row.id, row.role),
  };
}

/** Lança erro se o usuário não tiver a permissão (admin sempre passa). */
export function requirePerm(user: AuthUser, perm: Permission) {
  if (user.role === "admin") return;
  if (!user.permissions.includes(perm)) {
    throw new Error("Sem permissão para esta ação.");
  }
}

/** Versão de consulta do requirePerm — mesmo critério, sem lançar. */
export function temPerm(user: AuthUser, perm: Permission): boolean {
  return user.role === "admin" || user.permissions.includes(perm);
}
