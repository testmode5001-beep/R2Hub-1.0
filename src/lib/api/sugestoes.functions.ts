// Sugestões — o "Conte pra gente" do rodapé da Home 1.0.
// Grava na tabela `sugestoes` e avisa quem administra o hub. Sem permissão
// própria: qualquer pessoa logada pode sugerir, é esse o ponto.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid } from "@/server/db.server";
import { audit } from "@/server/audit.server";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";
import { TELA_GERAL, TELAS_DO_HUB } from "@/lib/telas-do-hub";

export const enviarSugestao = createServerFn({ method: "POST" })
  .validator(z.object({
    texto: z.string().trim().min(3).max(2000),
    /* de qual tela é a sugestão: só um nome da lista da caixa */
    tela: z.string().refine((t) => TELAS_DO_HUB.includes(t), "Tela desconhecida.").optional(),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const id = uuid();
    const ts = agora();
    const tela = data.tela ?? null;
    getDb()
      .prepare("INSERT INTO sugestoes (id, user_id, user_nome, texto, tela, created_at) VALUES (?,?,?,?,?,?)")
      .run(id, user.id, user.nome, data.texto, tela, ts);

    const deQuem = `Sugestão de ${user.nome.split(" ")[0]}`;
    notifyUsers(
      usersWithRoles(["admin", "gestor"]),
      user.id,
      tela && tela !== TELA_GERAL ? `${deQuem} · ${tela}` : deQuem,
      data.texto.slice(0, 140),
      "/hub?tela=home",
    );
    audit({ id: user.id, nome: user.nome }, "sugestao.enviar", "sugestoes", id, { tamanho: data.texto.length, tela });
    return { ok: true, id };
  });
