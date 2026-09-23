// Prazo de entrega da arte: DOIS DIAS ÚTEIS a partir da entrada do pedido.
//
// Úteis, e não corridos, por um motivo prático: pedido que entra na sexta
// venceria no domingo, e na segunda de manhã ele já nasceria "atrasado" sem
// ninguém ter feito nada de errado. Sábado, domingo e feriado (nacional ou da
// cidade de São Paulo) não contam.
import { feriadoEm } from "./feriados";

/** Dias úteis que a arte tem, contados da entrada do pedido. */
export const PRAZO_ARTE_DIAS_UTEIS = 2;
/** Dias úteis que a clicheria leva, contados da solicitação do clichê. */
export const PRAZO_CLICHE_DIAS_UTEIS = 3;

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function ehUtil(d: Date): boolean {
  const semana = d.getDay();
  if (semana === 0 || semana === 6) return false;
  const f = feriadoEm(iso(d));
  // ponto facultativo (Carnaval, Corpus Christi) também não conta: a fábrica para
  return !f;
}

/** Data de entrega a partir de uma entrada, pulando fim de semana e feriado. */
export function prazoDaEntrada(entrada: Date | string, dias = PRAZO_ARTE_DIAS_UTEIS): Date {
  const base = typeof entrada === "string" ? new Date(entrada) : entrada;
  const d = new Date(base.getTime());
  if (Number.isNaN(d.getTime())) return new Date();
  let restantes = Math.max(0, dias);
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    if (ehUtil(d)) restantes--;
  }
  return d;
}

/**
 * Prazo do pedido: o gravado, se houver. Senão, o padrão da etapa —
 *   · arte: 2 dias úteis da ENTRADA do pedido;
 *   · clichê solicitado: 3 dias úteis da SOLICITAÇÃO (updated_at, que é quando
 *     o status virou "cliche").
 * Os dois são "até": a entrega pode acontecer antes.
 */
export function prazoDoPedido(p: {
  prazo?: string | null; created_at?: string | null; updated_at?: string | null; status?: string | null;
}): Date {
  if (p.prazo) {
    const d = new Date(p.prazo);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (p.status === "cliche") {
    return prazoDaEntrada(p.updated_at ?? p.created_at ?? new Date(), PRAZO_CLICHE_DIAS_UTEIS);
  }
  return prazoDaEntrada(p.created_at ?? new Date());
}
