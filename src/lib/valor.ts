// Leitura de valor em dinheiro digitado por gente — que escreve dos dois jeitos.
//
// Havia duas regras diferentes no hub, e cada uma errava um caso plausível:
// a modal do clichê lia "1.500" como R$ 1,50 (ponto = decimal) e a tela de
// afiação lia "84.37" como R$ 8.437,00 (apagava todo ponto). Em campo de
// dinheiro, errar por 100× é o tipo de coisa que só se descobre no fechamento.
//
// A regra aqui: a VÍRGULA sempre manda como decimal. Sem vírgula, o ponto é
// milhar apenas quando está escrito como milhar (grupos de 3 dígitos até o
// fim: "1.500", "1.234.567"); em qualquer outro caso ele é decimal ("84.37").

/** Número a partir do que a pessoa digitou. `NaN` se não der para ler. */
export function parseValorBR(entrada: unknown): number {
  const s = String(entrada ?? "").trim().replace(/\s|R\$/gi, "");
  if (!s) return NaN;
  if (!/^-?[\d.,]+$/.test(s)) return NaN;

  const negativo = s.startsWith("-");
  const corpo = negativo ? s.slice(1) : s;

  let normal: string;
  if (corpo.includes(",")) {
    // vírgula decidiu: o que vem depois dela é decimal, ponto é separador de milhar
    const [inteiro, ...resto] = corpo.split(",");
    normal = `${inteiro.replace(/\./g, "")}.${resto.join("")}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(corpo)) {
    normal = corpo.replace(/\./g, "");            // 1.500 · 1.234.567 = milhar
  } else {
    normal = corpo;                                // 84.37 · 1500 = como está
  }

  const n = Number(normal);
  return Number.isFinite(n) ? (negativo ? -n : n) : NaN;
}

/** Igual ao anterior, mas devolve 0 no lugar de NaN (para somas). */
export const valorOuZero = (entrada: unknown): number => {
  const v = parseValorBR(entrada);
  return Number.isFinite(v) ? v : 0;
};
