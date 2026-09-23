// Painel administrativo (Etapa 2): usuários, permissões por usuário, sessões e auditoria.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import {
  PERMISSIONS, agora, getDb, roleExists, roleLabel, roleTemplate, userPermissions, uuid,
  type LinhaSQL,
} from "@/server/db.server";
import { requirePerm, temPerm, destroyUserSessions } from "@/server/auth.server";
import { hashPassword } from "@/server/password.server";
import { audit } from "@/server/audit.server";

// Cargos são dinâmicos (tabela `roles`), então validamos a existência no handler.
const roleSchema = z.string().min(2).max(30);

function assertRoleExiste(nome: string) {
  if (!roleExists(nome)) throw new Error("Cargo não encontrado.");
}

export const listUsuarios = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "usuarios.gerenciar");
    return getDb()
      .prepare(
        `SELECT u.id, u.username, u.nome, u.role, u.ativo, u.created_at,
                (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS sessoes_ativas
         FROM users u ORDER BY u.created_at ASC`,
      )
      .all(agora()) as LinhaSQL[];
  });

// Permissões concedidas de TODOS os usuários de uma vez — a tela Equipe (v1a)
// mostra a contagem por pessoa nos cards, sem uma consulta por usuário.
export const listPermissoesEquipe = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "permissoes.gerenciar");
    const db = getDb();
    return {
      permissoes: [...PERMISSIONS],
      concedidas: db.prepare("SELECT user_id, permission FROM user_permissions").all() as {
        user_id: string;
        permission: string;
      }[],
    };
  });

export const createUsuario = createServerFn({ method: "POST" })
  .validator(
    z.object({
      username: z
        .string()
        .min(3)
        .max(40)
        .regex(/^[a-z0-9._-]+$/i, "Use apenas letras, números, ponto, hífen ou underline."),
      nome: z.string().min(2),
      senha: z.string().min(6, "A senha precisa de pelo menos 6 caracteres."),
      role: roleSchema,
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    // usuarios.criar_departamento: pode cadastrar, mas SÓ com o próprio cargo
    // (o vendedor cria outro vendedor; nunca um gestor ou designer).
    const porDepartamento = !temPerm(user, "usuarios.gerenciar");
    if (porDepartamento) {
      requirePerm(user, "usuarios.criar_departamento");
      if (data.role !== user.role) {
        throw new Error(`Seu acesso cria contas apenas do seu departamento (${user.role}).`);
      }
    }

    assertRoleExiste(data.role);

    const db = getDb();
    const existe = db
      .prepare("SELECT id FROM users WHERE username = ?")
      .get(data.username.trim());
    if (existe) throw new Error("Já existe um usuário com esse login.");

    const id = uuid();
    const ts = agora();
    // precisa_trocar_senha = 1: a senha que o gestor digita aqui é provisória e
    // só serve para o primeiro acesso — ninguém além do dono fica sabendo a
    // senha de verdade.
    db.prepare(
      "INSERT INTO users (id, username, nome, password_hash, role, ativo, precisa_trocar_senha, created_at, updated_at) VALUES (?,?,?,?,?,1,1,?,?)",
    ).run(id, data.username.trim().toLowerCase(), data.nome.trim(), hashPassword(data.senha), data.role, ts, ts);

    // Semeia as permissões individuais a partir do template do cargo escolhido.
    // Quem cadastrou pelo acesso de departamento NÃO passa adiante o poder de
    // cadastrar: senão a permissão se multiplicaria sozinha pela empresa.
    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    const semAdmin = new Set(["usuarios.gerenciar", "usuarios.criar_departamento"]);
    for (const p of roleTemplate(data.role)) {
      if (porDepartamento && semAdmin.has(p)) continue;
      insUP.run(id, p);
    }

    audit({ id: user.id, nome: user.nome }, "usuario.criar", "users", id, {
      username: data.username,
      nome: data.nome,
      role: data.role,
    });
    return { id };
  });

export const updateUsuario = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      nome: z.string().min(2).optional(),
      role: roleSchema.optional(),
      ativo: z.boolean().optional(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "usuarios.gerenciar");

    const db = getDb();
    const alvo = db.prepare("SELECT * FROM users WHERE id = ?").get(data.id) as
      | Record<string, unknown>
      | undefined;
    if (!alvo) throw new Error("Usuário não encontrado.");

    if (data.id === user.id && (data.role !== undefined || data.ativo === false)) {
      throw new Error("Você não pode alterar seu próprio cargo nem se desativar.");
    }
    if (data.role !== undefined) assertRoleExiste(data.role);

    const mudancas: Record<string, { de: unknown; para: unknown }> = {};
    const sets: string[] = [];
    const valores: unknown[] = [];

    if (data.nome !== undefined && data.nome !== alvo.nome) {
      mudancas.nome = { de: alvo.nome, para: data.nome };
      sets.push("nome = ?");
      valores.push(data.nome.trim());
    }
    if (data.role !== undefined && data.role !== alvo.role) {
      mudancas.role = { de: alvo.role, para: data.role };
      sets.push("role = ?");
      valores.push(data.role);
    }
    if (data.ativo !== undefined && (alvo.ativo === 1) !== data.ativo) {
      mudancas.ativo = { de: !!alvo.ativo, para: data.ativo };
      sets.push("ativo = ?");
      valores.push(data.ativo ? 1 : 0);
    }
    if (sets.length === 0) return { ok: true };

    sets.push("updated_at = ?");
    valores.push(agora(), data.id);
    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...(valores as never[]));

    // Desativação derruba as sessões abertas. (Cargo é só rótulo/template — as
    // permissões efetivas são por usuário e resolvidas a cada requisição.)
    if (data.ativo === false) destroyUserSessions(data.id);

    audit({ id: user.id, nome: user.nome }, "usuario.editar", "users", data.id, mudancas);
    return { ok: true };
  });

export const resetSenha = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), novaSenha: z.string().min(6) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "senha.resetar");

    const db = getDb();
    const alvo = db.prepare("SELECT nome FROM users WHERE id = ?").get(data.id) as
      | { nome: string }
      | undefined;
    if (!alvo) throw new Error("Usuário não encontrado.");

    // a senha do reset também é provisória — quem entrar com ela troca na hora
    db.prepare("UPDATE users SET password_hash = ?, precisa_trocar_senha = 1, updated_at = ? WHERE id = ?").run(
      hashPassword(data.novaSenha),
      agora(),
      data.id,
    );
    destroyUserSessions(data.id);

    audit({ id: user.id, nome: user.nome }, "usuario.resetar_senha", "users", data.id, {
      usuario: alvo.nome,
    });
    return { ok: true };
  });

export const excluirUsuario = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "usuarios.gerenciar");
    if (data.id === user.id) throw new Error("Você não pode excluir a si mesmo.");

    const db = getDb();
    const alvo = db.prepare("SELECT username, nome FROM users WHERE id = ?").get(data.id) as
      | { username: string; nome: string }
      | undefined;
    if (!alvo) throw new Error("Usuário não encontrado.");

    try {
      db.prepare("DELETE FROM users WHERE id = ?").run(data.id);
    } catch {
      throw new Error(
        "Este usuário possui pedidos vinculados e não pode ser excluído. Desative-o em vez de excluir.",
      );
    }

    audit({ id: user.id, nome: user.nome }, "usuario.excluir", "users", data.id, {
      username: alvo.username,
      nome: alvo.nome,
    });
    return { ok: true };
  });

/** Permissões de um usuário específico (para o modal de edição por usuário). */
export const getUsuarioPermissoes = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "permissoes.gerenciar");
    const alvo = getDb().prepare("SELECT id, nome, role FROM users WHERE id = ?").get(data.id) as
      | { id: string; nome: string; role: string }
      | undefined;
    if (!alvo) throw new Error("Usuário não encontrado.");
    return {
      permissions: [...PERMISSIONS],
      granted: alvo.role === "admin" ? [...PERMISSIONS] : userPermissions(data.id),
      role: alvo.role,
      roleLabel: roleLabel(alvo.role),
      isAdmin: alvo.role === "admin",
      isSelf: alvo.id === user.id,
    };
  });

export const setUsuarioPermissao = createServerFn({ method: "POST" })
  .validator(
    z.object({ id: z.string().min(1), permission: z.enum(PERMISSIONS), habilitada: z.boolean() }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "permissoes.gerenciar");

    const db = getDb();
    const alvo = db.prepare("SELECT id, nome, role FROM users WHERE id = ?").get(data.id) as
      | { id: string; nome: string; role: string }
      | undefined;
    if (!alvo) throw new Error("Usuário não encontrado.");
    if (alvo.role === "admin") throw new Error("Administrador tem acesso total (não editável).");
    if (alvo.id === user.id) throw new Error("Você não pode alterar as suas próprias permissões.");

    if (data.habilitada) {
      db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)").run(
        data.id,
        data.permission,
      );
    } else {
      db.prepare("DELETE FROM user_permissions WHERE user_id = ? AND permission = ?").run(
        data.id,
        data.permission,
      );
    }

    audit({ id: user.id, nome: user.nome }, "permissao.alterar", "user_permissions", data.id, {
      usuario: alvo.nome,
      permissao: data.permission,
      habilitada: data.habilitada,
    });
    return { ok: true };
  });

/** Redefine as permissões do usuário para o padrão (template) do cargo atual dele. */
export const aplicarTemplateCargo = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "permissoes.gerenciar");

    const db = getDb();
    const alvo = db.prepare("SELECT id, nome, role FROM users WHERE id = ?").get(data.id) as
      | { id: string; nome: string; role: string }
      | undefined;
    if (!alvo) throw new Error("Usuário não encontrado.");
    if (alvo.role === "admin") throw new Error("Administrador tem acesso total (não editável).");
    if (alvo.id === user.id) throw new Error("Você não pode redefinir as suas próprias permissões.");

    db.prepare("DELETE FROM user_permissions WHERE user_id = ?").run(data.id);
    const ins = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    for (const p of roleTemplate(alvo.role)) ins.run(data.id, p);

    audit({ id: user.id, nome: user.nome }, "permissao.aplicar_template", "user_permissions", data.id, {
      usuario: alvo.nome,
      cargo: alvo.role,
    });
    return { ok: true, granted: userPermissions(data.id) };
  });

/* ===================== CARGOS (templates de permissão) ===================== */

export const listRoles = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "usuarios.gerenciar");
    const db = getDb();
    return {
      roles: db
        .prepare("SELECT nome, label, sistema FROM roles ORDER BY sistema DESC, label COLLATE NOCASE ASC")
        .all() as { nome: string; label: string; sistema: number }[],
      permissoes: db.prepare("SELECT role, permission FROM role_permissions").all() as {
        role: string;
        permission: string;
      }[],
      usos: db.prepare("SELECT role, COUNT(*) AS qtde FROM users GROUP BY role").all() as {
        role: string;
        qtde: number;
      }[],
      todasPermissoes: [...PERMISSIONS],
    };
  });

export const createRole = createServerFn({ method: "POST" })
  .validator(
    z.object({
      nome: z
        .string()
        .min(2)
        .max(30)
        .regex(/^[a-z0-9_-]+$/i, "Use apenas letras, números, hífen ou underline."),
      label: z.string().min(2).max(40),
      permissoes: z.array(z.enum(PERMISSIONS)),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cargos.gerenciar");

    const db = getDb();
    const nome = data.nome.trim().toLowerCase();
    if (roleExists(nome)) throw new Error("Já existe um cargo com esse identificador.");

    db.prepare("INSERT INTO roles (nome, label, sistema, created_at) VALUES (?,?,0,?)").run(
      nome,
      data.label.trim(),
      agora(),
    );
    const ins = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    for (const p of data.permissoes) ins.run(nome, p);

    audit({ id: user.id, nome: user.nome }, "cargo.criar", "roles", nome, {
      label: data.label,
      permissoes: data.permissoes,
    });
    return { ok: true, nome };
  });

export const updateRole = createServerFn({ method: "POST" })
  .validator(
    z.object({
      nome: z.string().min(2),
      label: z.string().min(2).max(40).optional(),
      permissoes: z.array(z.enum(PERMISSIONS)).optional(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cargos.gerenciar");

    const db = getDb();
    const alvo = db.prepare("SELECT nome, label, sistema FROM roles WHERE nome = ?").get(data.nome) as
      | { nome: string; label: string; sistema: number }
      | undefined;
    if (!alvo) throw new Error("Cargo não encontrado.");
    if (alvo.sistema) throw new Error("O cargo Administrador é do sistema e não pode ser alterado.");

    if (data.label !== undefined) {
      db.prepare("UPDATE roles SET label = ? WHERE nome = ?").run(data.label.trim(), data.nome);
    }
    if (data.permissoes !== undefined) {
      db.prepare("DELETE FROM role_permissions WHERE role = ?").run(data.nome);
      const ins = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
      for (const p of data.permissoes) ins.run(data.nome, p);
    }

    audit({ id: user.id, nome: user.nome }, "cargo.editar", "roles", data.nome, {
      label: data.label ?? alvo.label,
      permissoes: data.permissoes,
    });
    return { ok: true };
  });

export const deleteRole = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().min(2) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cargos.gerenciar");

    const db = getDb();
    const alvo = db.prepare("SELECT nome, label, sistema FROM roles WHERE nome = ?").get(data.nome) as
      | { nome: string; label: string; sistema: number }
      | undefined;
    if (!alvo) throw new Error("Cargo não encontrado.");
    if (alvo.sistema) throw new Error("O cargo Administrador é do sistema e não pode ser excluído.");

    const emUso = db.prepare("SELECT COUNT(*) AS qtde FROM users WHERE role = ?").get(data.nome) as {
      qtde: number;
    };
    if (emUso.qtde > 0) {
      throw new Error(
        `Este cargo está em uso por ${emUso.qtde} usuário(s). Mude o cargo dessas pessoas antes de excluir.`,
      );
    }

    db.prepare("DELETE FROM role_permissions WHERE role = ?").run(data.nome);
    db.prepare("DELETE FROM roles WHERE nome = ?").run(data.nome);

    audit({ id: user.id, nome: user.nome }, "cargo.excluir", "roles", data.nome, { label: alvo.label });
    return { ok: true };
  });

/** Encerra todas as sessões abertas de um usuário (gestão de sessões). */
export const forcarLogout = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "sessoes.forcar_logout");
    const alvo = getDb().prepare("SELECT nome FROM users WHERE id = ?").get(data.id) as
      | { nome: string }
      | undefined;
    if (!alvo) throw new Error("Usuário não encontrado.");
    destroyUserSessions(data.id);
    audit({ id: user.id, nome: user.nome }, "usuario.forcar_logout", "users", data.id, {
      usuario: alvo.nome,
    });
    return { ok: true };
  });

export const listAuditoria = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "auditoria.ver");
    return getDb()
      .prepare(
        "SELECT id, user_nome, acao, entidade, entidade_id, detalhe, created_at FROM audit_log ORDER BY created_at DESC LIMIT 300",
      )
      .all() as LinhaSQL[];
  });
