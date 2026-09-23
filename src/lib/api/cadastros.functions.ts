// Cadastros compartilhados da solicitação de arte: formatos/medidas, matéria-
// prima e cores. Cada tipo tem a sua permissão — é o que dá efeito às três
// permissões "Cadastrar ..." da tela Equipe. Quem não pode cadastrar continua
// escolhendo normalmente entre o que já existe.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid, type Permission } from "@/server/db.server";
import { requirePerm } from "@/server/auth.server";
import { audit } from "@/server/audit.server";

/** tipo do cadastro → permissão que autoriza criar/remover. */
const PERM_DO_TIPO: Record<string, Permission> = {
  medida: "cadastro.medidas",
  material: "cadastro.materiais",
  cor: "cadastro.cores",
};

const tipoSchema = z.enum(["medida", "material", "cor"]);

export const listCadastros = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    const linhas = getDb()
      .prepare("SELECT id, tipo, nome, extra FROM cadastros ORDER BY tipo ASC, nome COLLATE NOCASE ASC")
      .all() as { id: string; tipo: string; nome: string; extra: string | null }[];
    return {
      medidas: linhas.filter((l) => l.tipo === "medida"),
      materiais: linhas.filter((l) => l.tipo === "material"),
      cores: linhas.filter((l) => l.tipo === "cor"),
    };
  });

export const addCadastro = createServerFn({ method: "POST" })
  .validator(z.object({
    tipo: tipoSchema,
    nome: z.string().trim().min(1).max(60),
    /** hex da cor, quando for cor */
    extra: z.string().trim().max(20).nullish(),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, PERM_DO_TIPO[data.tipo]);

    const db = getDb();
    const nome = data.nome.trim();
    const existe = db.prepare("SELECT id FROM cadastros WHERE tipo = ? AND nome = ?").get(data.tipo, nome);
    if (existe) throw new Error("Esse cadastro já existe.");

    const id = uuid();
    db.prepare(
      "INSERT INTO cadastros (id, tipo, nome, extra, user_id, user_nome, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(id, data.tipo, nome, data.extra ?? null, user.id, user.nome, agora());

    audit({ id: user.id, nome: user.nome }, "cadastro.criar", "cadastros", id, { tipo: data.tipo, nome });
    return { id, tipo: data.tipo, nome, extra: data.extra ?? null };
  });

export const removerCadastro = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const item = db.prepare("SELECT id, tipo, nome FROM cadastros WHERE id = ?").get(data.id) as
      | { id: string; tipo: string; nome: string }
      | undefined;
    if (!item) return { ok: true };

    requirePerm(user, PERM_DO_TIPO[item.tipo]);
    db.prepare("DELETE FROM cadastros WHERE id = ?").run(data.id);
    audit({ id: user.id, nome: user.nome }, "cadastro.excluir", "cadastros", data.id, {
      tipo: item.tipo, nome: item.nome,
    });
    return { ok: true };
  });
