// Auditoria (Etapa 2): registra quem fez o quê, quando e com quais valores.
import { agora, getDb, uuid } from "./db.server";

export type AuditActor = { id: string; nome: string } | null;

export function audit(
  actor: AuditActor,
  acao: string,
  entidade: string,
  entidadeId: string | null,
  detalhe?: Record<string, unknown>,
) {
  getDb()
    .prepare(
      "INSERT INTO audit_log (id, user_id, user_nome, acao, entidade, entidade_id, detalhe, created_at) VALUES (?,?,?,?,?,?,?,?)",
    )
    .run(
      uuid(),
      actor?.id ?? null,
      actor?.nome ?? null,
      acao,
      entidade,
      entidadeId,
      detalhe ? JSON.stringify(detalhe) : null,
      agora(),
    );
}
