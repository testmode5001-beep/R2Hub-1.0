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
 * Texto onde a busca procura: a forma normalizada mais uma cópia de cada parte
 * sem espaço — é a cópia que faz "40x" achar "40 × 30" e "40 x 30" achar
 * "40x30". Cópia por parte, e não do texto inteiro colado: colado, o fim de
 * um campo grudava no começo do outro ("Loja 1" + "20x35" virava "120x35").
 */
export function alvoBusca(...partes: unknown[]): string {
  const ps = partes.filter((p) => p != null && p !== "").map((p) => normalizarBusca(String(p)));
  return ps.join(" ") + " " + ps.map((p) => p.replace(/ /g, "")).join(" ");
}

/* "20x35", "30 x 40", "45,5x30": a consulta é uma medida inteira */
const MEDIDA_INTEIRA = /^\d+(?:\.\d+)?x\d+(?:\.\d+)?$/;

/**
 * Devolve o comparador já com a consulta preparada (normaliza uma vez só, não
 * uma vez por linha da lista). Consulta vazia deixa tudo passar.
 *
 *   const casa = criarBusca(busca);
 *   lista.filter((p) => casa(p.cliente, p.num, p.medida))
 */
export function criarBusca(consulta: string, opcoes?: { deitada?: boolean }) {
  const q = normalizarBusca(consulta);
  const junto = q.replace(/ /g, "");
  const termos = q ? q.split(" ") : [];
  /* Medida: casa a medida a partir do começo de um número, e só ela. Antes
     "20x35" achava o 120×35 (era pedaço do texto) e "30 x 40" caía na regra
     de palavra por palavra ("30" num lugar, "40" noutro) (simulação 3,
     30/09/2026). O fim fica livre: quem está digitando "20x3" ainda vê a
     20×35. */
  const medida = MEDIDA_INTEIRA.test(junto) ? new RegExp(`(?<![\\d.])${junto.replace(/\./g, "\\.")}`) : null;
  /* A faca deitada: com `deitada`, "25x40" acha também a 40×25, a medida
     inteira ao contrário (só nas Facas; Augusto, 02/10/2026) */
  const [lado1, lado2] = medida ? junto.split("x") : [];
  const ponto = (t: string) => t.replace(/\./g, "\\.");
  const deitada = medida && opcoes?.deitada && lado1 !== lado2
    ? new RegExp(`(?<![\\d.])${ponto(lado2)}x${ponto(lado1)}(?![\\d.])`) : null;
  return (...partes: unknown[]): boolean => {
    if (!q) return true;
    const alvo = alvoBusca(...partes);
    if (medida) return medida.test(alvo) || (!!deitada && deitada.test(alvo));
    // "40 x 30" digitado inteiro vira "40x30" e casa com qualquer escrita;
    // senão, cada palavra tem de aparecer em algum lugar do texto.
    return alvo.includes(junto) || termos.every((t) => alvo.includes(t));
  };
}
