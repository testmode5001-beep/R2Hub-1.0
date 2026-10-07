// O Resumo da Home (Augusto, 05/10/2026: "o resumo é o que o usuário já fez,
// pedidos aprovados, alterações etc"): quanto a própria pessoa fez no período,
// lido do histórico dos pedidos (cada ação grava quem fez) e das alterações
// atendidas. Só leitura.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { getDb } from "@/server/db.server";

export const getMeuResumo = createServerFn({ method: "POST" })
  .validator(z.object({ dias: z.number().int().min(1).max(366) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const desde = new Date(Date.now() - data.dias * 86_400_000).toISOString();
    const db = getDb();
    const linhas = db
      .prepare("SELECT status, COUNT(*) AS n, COUNT(DISTINCT pedido_id) AS p FROM pedido_historico WHERE user_id = ? AND created_at >= ? GROUP BY status")
      .all(user.id, desde) as { status: string; n: number; p: number }[];
    const ev = (st: string) => linhas.find((l) => l.status === st)?.n ?? 0;
    const ped = (st: string) => linhas.find((l) => l.status === st)?.p ?? 0;
    const atendidas = (db
      .prepare("SELECT COUNT(*) AS n FROM pedido_revisoes_resolvidas WHERE user_id = ? AND created_at >= ?")
      .get(user.id, desde) as { n: number }).n;
    return {
      /* pedidos que a pessoa abriu */
      criados: ped("nova"),
      /* versões de arte enviadas (V1, V2... cada uma conta) */
      artes: ev("aguardando"),
      /* pedidos que a pessoa aprovou */
      aprovados: ped("aprovada"),
      /* alterações que a pessoa pediu e as que atendeu */
      alteracoesPedidas: ev("revisao"),
      alteracoesAtendidas: atendidas,
      /* pedidos mandados para a clicheria e finalizados */
      clicheria: ped("cliche"),
      finalizados: ped("concluido"),
      /* perguntas que a pessoa respondeu */
      respostas: ev("resposta"),
    };
  });
