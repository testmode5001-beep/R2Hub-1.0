// Autenticação: login, logout, sessão atual e troca de senha.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, effectivePermissions, getDb } from "@/server/db.server";
import { hashPassword, verifyPassword } from "@/server/password.server";
import { createSession, destroySession } from "@/server/auth.server";
import { audit } from "@/server/audit.server";

type UserRow = {
  id: string;
  username: string;
  nome: string;
  password_hash: string;
  role: string;
  ativo: number;
  precisa_trocar_senha?: number;
};

export const login = createServerFn({ method: "POST" })
  .validator(z.object({ username: z.string().min(1), senha: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const row = db
      .prepare("SELECT id, username, nome, password_hash, role, ativo, precisa_trocar_senha FROM users WHERE username = ?")
      .get(data.username.trim()) as UserRow | undefined;

    if (!row || !row.ativo || !verifyPassword(data.senha, row.password_hash)) {
      throw new Error("Usuário ou senha inválidos.");
    }

    const token = createSession(row.id);
    audit({ id: row.id, nome: row.nome }, "login", "auth", row.id);

    return {
      token,
      user: {
        id: row.id,
        username: row.username,
        nome: row.nome,
        role: row.role,
        permissions: effectivePermissions(row.id, row.role),
        /** senha provisória do gestor: o hub manda trocar antes de abrir */
        precisaTrocarSenha: !!row.precisa_trocar_senha,
      },
    };
  });

/**
 * Primeira senha do dono da conta. Não pede a senha antiga de propósito: quem
 * chega aqui ACABOU de entrar com a provisória, e pedir de novo só atrapalha.
 * Vale uma vez — depois de trocar, a marca cai e a função passa a recusar.
 */
export const definirPrimeiraSenha = createServerFn({ method: "POST" })
  .validator(z.object({ novaSenha: z.string().min(6, "A senha precisa de pelo menos 6 caracteres.") }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const row = db
      .prepare("SELECT precisa_trocar_senha FROM users WHERE id = ?")
      .get(user.id) as { precisa_trocar_senha: number } | undefined;
    if (!row?.precisa_trocar_senha) throw new Error("Esta conta já tem senha definida. Troque em Preferências.");

    db.prepare("UPDATE users SET password_hash = ?, precisa_trocar_senha = 0, updated_at = ? WHERE id = ?").run(
      hashPassword(data.novaSenha),
      agora(),
      user.id,
    );
    audit({ id: user.id, nome: user.nome }, "usuario.primeira_senha", "users", user.id);
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user, token } = context as AuthContext;
    destroySession(token);
    audit({ id: user.id, nome: user.nome }, "logout", "auth", user.id);
    return { ok: true };
  });

export const getMe = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    return { user };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .validator(z.object({ senhaAtual: z.string().min(1), novaSenha: z.string().min(6) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(user.id) as { password_hash: string } | undefined;
    if (!row || !verifyPassword(data.senhaAtual, row.password_hash)) {
      throw new Error("Senha atual incorreta.");
    }
    db.prepare("UPDATE users SET password_hash = ?, precisa_trocar_senha = 0, updated_at = ? WHERE id = ?").run(
      hashPassword(data.novaSenha),
      agora(),
      user.id,
    );
    audit({ id: user.id, nome: user.nome }, "usuario.trocar_senha", "users", user.id);
    return { ok: true };
  });
