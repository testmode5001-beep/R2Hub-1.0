// A grade do hub 1.0: 24 colunas de 80 e 67 linhas de 1080/67. Como nas
// páginas da Obys que o Augusto mandou de referência ("veja como o
// alinhamento segue sempre o grid", 28/09/2026), a tinta de cada texto que
// abre uma coluna cai em cima dela, e a linha de base cai em cima de uma
// linha da grade.
//
// Os ajudantes são os do "dentro" da página de Facas (FerramentaisHub10),
// a primeira tela feita assim; moram aqui para as outras telas usarem as
// MESMAS contas (a calculadora de facas foi a segunda).

export const LINHA_DA_GRADE = 1080 / 67;

/** Onde o navegador põe a linha de base numa linha de altura lh: arredonda
    a ascendente e a descendente da fonte para pixels inteiros e divide o
    resto da entrelinha em cima e embaixo, arredondando para baixo (medido
    no Chrome: sem o arredondamento, a base caía meio pixel acima da linha). */
export function baseDaLinha(corpo: number, lh: number, ascendente: number, descendente: number): number {
  const asc = Math.round(corpo * ascendente), desc = Math.round(corpo * descendente);
  return asc + Math.floor((lh - asc - desc) / 2);
}
/** Inter: ascendente de 0,96875 do corpo, descendente de 0,2421875. */
export const baseInter = (corpo: number, lh: number) => baseDaLinha(corpo, lh, 0.96875, 0.2421875);
/** Fraunces: 0,982 acima da base, 0,259 abaixo. */
export const baseFraunces = (corpo: number, lh: number) => baseDaLinha(corpo, lh, 0.982, 0.259);

/* A folga lateral da primeira letra muda de letra para letra e de corpo para
   corpo (na Inter 24, o "E" tem 1 px; no 140 pesado, o "R" tem bem mais).
   Medida uma vez por fonte e caractere, no canvas; enquanto a fonte não
   carregou, vale a reserva. */
const FOLGAS = new Map<string, number>();
export function folga(fonte: string, c: string, reserva: number): number {
  const chave = `${fonte}|${c}`;
  const f = FOLGAS.get(chave);
  if (f != null) return f;
  if (!c || typeof document === "undefined" || !document.fonts?.check(fonte)) return reserva;
  const cv = document.createElement("canvas").getContext("2d");
  if (!cv) return reserva;
  cv.font = fonte;
  const medida = -cv.measureText(c).actualBoundingBoxLeft;
  FOLGAS.set(chave, medida);
  return medida;
}
export const folgaInter = (peso: number, corpo: number, c: string) => folga(`${peso} ${corpo}px Inter`, c, 1);

/* A folga do outro lado: da tinta da ÚLTIMA letra até o fim do avanço dela.
   Serve para a última letra de uma linha terminar em cima de uma coluna
   (o menu da barra, que acaba na c17). */
const FOLGAS_DIREITA = new Map<string, number>();
export function folgaDireita(fonte: string, c: string, reserva: number): number {
  const chave = `${fonte}|${c}`;
  const f = FOLGAS_DIREITA.get(chave);
  if (f != null) return f;
  if (!c || typeof document === "undefined" || !document.fonts?.check(fonte)) return reserva;
  const cv = document.createElement("canvas").getContext("2d");
  if (!cv) return reserva;
  cv.font = fonte;
  const m = cv.measureText(c);
  const medida = m.width - m.actualBoundingBoxRight;
  FOLGAS_DIREITA.set(chave, medida);
  return medida;
}
export const folgaDireitaInter = (peso: number, corpo: number, c: string) => folgaDireita(`${peso} ${corpo}px Inter`, c, 1);
export const folgaFraunces = (peso: number, corpo: number, c: string) => folga(`${peso} ${corpo}px Fraunces`, c, 3);

/* ————— folga corrigida das telas do rework v4 (Solicitação, capas, pedido aberto) ————— */
/* O canvas que mede a folga não aplica o SOFT e o opsz 72 da Fraunces, e a
   tinta caía de 0,4 a 3 px depois da coluna conforme a letra. A correção de
   cada corpo e 1ª letra usados aqui, medida no pixel (como o acerto do título
   de Pedidos; scratchpad v4sol/folgas-fr.py, 01/10/2026). */
export const ACERTO_FR: Record<string, number> = {
  "104A": 3, "104P": 1, "104S": 0.95, "104B": 0.91, "104M": 2.95, "104C": 1.7, "104R": 0.91, "104N": 3.18, "1046": 0.7, "72L": 0.8,
  "48P": -0.13, "48T": 0.97, "48C": 0.76, "48V": 0.76, "48L": -0.13, "481": 0.47, "480": 0.76,
  "40M": 0.87, "40L": 0.67, "40C": 0.42,
  "32D": 0.38, "32A": 0.67, "32V": 0.47, "32C": 1.26, "32B": 0.38, "32M": 0.81, "32S": 0.42, "32E": 0.38,
  "24B": 0.98, "24E": 0.98,
};
/* Na Inter é parecido: o navegador aplica o tamanho óptico (opsz) que o
   canvas não aplica, e a tinta caía de 0,4 a 1,4 px depois da conta (medido
   no pixel, scratchpad v4sol/folgas-inter.py). Chave: corpo/peso e a letra. */
export const ACERTO_IN: Record<string, number> = {
  "20.5/500P": 0.76, "20.5/500A": 0.78, "20.5/500C": 1.26, "20.5/500H": 0.76, "20.5/500S": 1.25,
  "21/500F": 0.76, "21/500+": 0.97, "21/500N": 0.76, "21/500L": 0.76, "21/500C": 1.26, "21/500M": 0.76, "21/500P": 0.76, "21/500R": 0.76, "21/500O": 1.26, "21/500B": 0.76, "21/500T": 0.97, "21/5001": 0.97, "21/5002": 0.61, "21/5003": 1.33, "21/5004": 1.26, "21/5005": 1.33, "21/5006": 1.26, "21/5007": 0.97, "21/5008": 1.26, "21/5009": 1.26, "21/5000": 1.26, "21/500.": 0.76,
  "24/800iB": 0.42, "24/800iC": 1.26, "24/800iP": 0.42, "24/800iT": 1.19, "24/800iN": 0.42,
  "24/400E": 1.26, "24/400O": 0.61, "24/400M": 1.26, "24/400C": 0.61, "24/400Q": 0.61, "24/400B": 1.26, "24/400N": 1.26, "24/400P": 1.26, "24/400T": 1.26,
  "18/400D": 0.61, "18/400•": 1.38, "18/400R": 0.61, "18/400E": 0.61, "18/400N": 0.61, "18/400C": 0.97, "18/400F": 0.61, "18/400A": 0.71, "18/400P": 0.61,
  "20/400R": 0.87,
  "21/400F": 0.87, "21/400+": 0.97, "21/400N": 0.87, "21/400L": 0.87, "21/400C": 1.38, "21/400M": 0.87, "21/400P": 0.87, "21/400R": 0.87, "21/400O": 1.38, "21/400.": 0.76, "21/400B": 0.87, "21/400T": 0.97, "21/4001": 0.97, "21/4002": 0.61, "21/4003": 0.49, "21/4004": 1.27, "21/4005": 0.49, "21/4006": 1.4, "21/4007": 0.97, "21/4008": 1.4, "21/4009": 1.38, "21/4000": 1.38,
  "20.5/400P": 0.87, "20.5/400A": 0.78, "20.5/400C": 1.26, "20.5/400H": 0.87, "20.5/400S": 1.27,
  "55/5000": 0.9,
  "24/800B": 0.42, "24/800C": 0.97, "24/800P": 0.42, "24/800T": 0.87, "24/800N": 0.42,
  "16/4000": 0.97, "16/4001": 0.76, "16/4002": 1.26, "16/4003": 0.97, "16/4004": 0.97, "16/4005": 0.98, "16/4006": 0.97, "16/4007": 0.91, "16/4008": 0.97, "16/4009": 0.97,
};
/* letra fora das tabelas: o meio do que foi medido (todas deram positivas) */
/** a folga da 1ª letra na Fraunces do hub (SOFT 100, opsz 72), já corrigida */
export const folgaFR = (corpo: number, letra: string) => folgaFraunces(600, corpo, letra) + (ACERTO_FR[`${corpo}${letra}`] ?? 0.7);
/** a folga da 1ª letra na Inter, já corrigida */
export const folgaIN = (peso: number, corpo: number, letra: string) => folgaInter(peso, corpo, letra) + (ACERTO_IN[`${corpo}/${peso}${letra}`] ?? 0.8);
