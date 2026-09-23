// Busca de texto do hub — a mesma regra em todas as telas.
//
// O problema que ela resolve: as medidas são escritas de jeitos diferentes pelo
// sistema ("40×30" no catálogo de facas, "40x30" nos pedidos, "59,5 × 40" na
// afiação). Quem digita "40x" está procurando a mesma coisa nos três casos, e
// antes não achava nada. Aqui tudo vira a mesma forma antes de comparar:
// minúsculas, sem acento, "×"/"*" viram "x", vírgula vira ponto.

export function normalizarBusca(texto: string): string {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[×✕✖*]/g, "x")
    .replace(/,/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Texto onde a busca procura: a forma normalizada mais uma cópia sem espaço
 * nenhum — é a cópia que faz "40x" achar "40 × 30" e "40 x 30" achar "40x30".
 */
export function alvoBusca(...partes: unknown[]): string {
  const t = normalizarBusca(partes.filter((p) => p != null && p !== "").join(" "));
  return t + " " + t.replace(/ /g, "");
}

/**
 * Devolve o comparador já com a consulta preparada (normaliza uma vez só, não
 * uma vez por linha da lista). Consulta vazia deixa tudo passar.
 *
 *   const casa = criarBusca(busca);
 *   lista.filter((p) => casa(p.cliente, p.num, p.medida))
 */
export function criarBusca(consulta: string) {
  const q = normalizarBusca(consulta);
  const junto = q.replace(/ /g, "");
  const termos = q ? q.split(" ") : [];
  return (...partes: unknown[]): boolean => {
    if (!q) return true;
    const alvo = alvoBusca(...partes);
    // "40 x 30" digitado inteiro vira "40x30" e casa com qualquer escrita;
    // senão, cada palavra tem de aparecer em algum lugar do texto.
    return alvo.includes(junto) || termos.every((t) => alvo.includes(t));
  };
}
