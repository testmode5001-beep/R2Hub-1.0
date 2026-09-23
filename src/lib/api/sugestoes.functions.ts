// Sugestões — o "Conte pra gente" do rodapé da Home 1.0.
// Grava na tabela `sugestoes` e avisa quem administra o hub. Sem permissão
// própria: qualquer pessoa logada pode sugerir, é esse o ponto.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid } from "@/server/db.server";
import { audit } from "@/server/audit.server";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";

export const enviarSugestao = createServerFn({ method: "POST" })
  .validator(z.object({ texto: z.string().trim().min(3).max(2000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const id = uuid();
    const ts = agora();
    getDb()
      .prepare("INSERT INTO sugestoes (id, user_id, user_nome, texto, created_at) VALUES (?,?,?,?,?)")
      .run(id, user.id, user.nome, data.texto, ts);

    notifyUsers(
      usersWithRoles(["admin", "gestor"]),
      user.id,
      `Sugestão de ${user.nome.split(" ")[0]}`,
      data.texto.slice(0, 140),
      "/hub?tela=home",
    );
    audit({ id: user.id, nome: user.nome }, "sugestao.enviar", "sugestoes", id, { tamanho: data.texto.length });
    return { ok: true, id };
  });
