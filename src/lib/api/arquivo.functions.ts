// Arquivo físico (pastas nas gavetas) no banco.
//
// A tela guardava as ~1.900 pastas inteiras no localStorage a cada mudança:
// além de ninguém ver o cadastro do colega, duas pessoas editando ao mesmo
// tempo se sobrescreviam. Agora é uma linha por pasta.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, type LinhaSQL } from "@/server/db.server";
import { requirePerm } from "@/server/auth.server";
import { audit } from "@/server/audit.server";

const pastaZ = z.object({
  id: z.string().min(1).max(80),
  nome: z.string().trim().max(200),
  codigo: z.number().int().min(0).max(1_000_000),
  gaveta: z.string().trim().max(60).optional().default(""),
  pasta: z.string().trim().max(60).optional().default(""),
  obs: z.string().trim().max(500).optional().default(""),
  vaga: z.boolean().optional().default(false),
  consultas: z.array(z.string().max(40)).max(200).optional().default([]),
});

export const listArquivo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    const db = getDb();
    const linhas = db
      .prepare("SELECT id, nome, codigo, gaveta, pasta, obs, vaga, consultas_json FROM arquivo_pastas")
      .all() as LinhaSQL[];
    return { linhas };
  });

/** Primeira carga: manda o acervo conhecido se o banco ainda estiver vazio. */
export const semearArquivo = createServerFn({ method: "POST" })
  .validator(z.object({ pastas: z.array(pastaZ).max(5000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const n = (db.prepare("SELECT COUNT(*) AS n FROM arquivo_pastas").get() as { n: number }).n;
    if (n > 0) return { semeado: false, total: n };  // já tem cadastro: não mexe

    const ins = db.prepare(
      `INSERT OR IGNORE INTO arquivo_pastas (id, nome, codigo, gaveta, pasta, obs, vaga, consultas_json, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
    );
    const ts = agora();
    for (const p of data.pastas) {
      ins.run(p.id, p.nome, p.codigo, p.gaveta, p.pasta, p.obs, p.vaga ? 1 : 0, JSON.stringify(p.consultas ?? []), ts);
    }
    audit({ id: user.id, nome: user.nome }, "arquivo.semear", "arquivo_pastas", "-", { total: data.pastas.length });
    return { semeado: true, total: data.pastas.length };
  });

/** Cria ou altera UMA pasta (inclusive o registro de consulta). */
export const salvarPasta = createServerFn({ method: "POST" })
  .validator(pastaZ)
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cliente.editar");
    const db = getDb();
    db.prepare(
      `INSERT INTO arquivo_pastas (id, nome, codigo, gaveta, pasta, obs, vaga, consultas_json, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, codigo = excluded.codigo, gaveta = excluded.gaveta,
         pasta = excluded.pasta, obs = excluded.obs, vaga = excluded.vaga,
         consultas_json = excluded.consultas_json, updated_at = excluded.updated_at`,
    ).run(
      data.id, data.nome, data.codigo, data.gaveta, data.pasta, data.obs,
      data.vaga ? 1 : 0, JSON.stringify(data.consultas ?? []), agora(),
    );
    return { ok: true };
  });

/** Registrar consulta é abrir a pasta — não exige permissão de cadastro. */
export const registrarConsulta = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), quando: z.string().min(4).max(40) }))
  .middleware([requireAuth])
  .handler(async ({ data }) => {
    const db = getDb();
    const linha = db.prepare("SELECT consultas_json FROM arquivo_pastas WHERE id = ?").get(data.id) as
      | { consultas_json: string } | undefined;
    if (!linha) return { ok: false };
    let lista: string[] = [];
    try { lista = JSON.parse(linha.consultas_json) || []; } catch { lista = []; }
    lista = [data.quando, ...lista].slice(0, 50);
    db.prepare("UPDATE arquivo_pastas SET consultas_json = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(lista), agora(), data.id);
    return { ok: true };
  });

export const excluirPasta = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cliente.editar");
    const db = getDb();
    const p = db.prepare("SELECT nome FROM arquivo_pastas WHERE id = ?").get(data.id) as { nome: string } | undefined;
    db.prepare("DELETE FROM arquivo_pastas WHERE id = ?").run(data.id);
    audit({ id: user.id, nome: user.nome }, "arquivo.excluir", "arquivo_pastas", data.id, { nome: p?.nome });
    return { ok: true };
  });
