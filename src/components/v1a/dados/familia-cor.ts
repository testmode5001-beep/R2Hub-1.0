// Família de uma cor Pantone — a faixa ("Azuis", "Vermelhos"…) em que ela mora
// na tela de Pantones, na caixa "Escolher cor" e na busca por nome de cor.
//
// A régua antiga cortava pelo ÂNGULO DO LAB (azul até 260°). No Lab o azul
// escuro "puxa" para o roxo: o 286 C fica em 290°, o Reflex Blue em 297°, o
// Blue 072 em 301° — todos caíam em "Rosas e roxos", e quem abria "Azuis" não
// achava o azul mais pedido da casa. Do outro lado, Rhodamine Red, Pink C e o
// 225 C (magentas, 346–354°) caíam em "Vermelhos". Conferido cor por cor em
// 25/09/2026.
//
// A régua nova mede o ângulo no OKLab, que foi feito justamente para corrigir
// esse desvio do azul: lá os azuis ficam juntos (224–268°), os roxos e lilases
// também (280–307°) e as magentas vão para perto dos rosas (340–15°). A conta
// parte do Lab OFICIAL do color book (D50), não do hex de tela — cor fora do
// gamut da tela não perde a família por ter sido cortada na conversão.
//
// Entre magenta e vinho o ângulo não decide (o 1767 C, rosa-claro, e o 208 C,
// vinho, estão a dois graus um do outro): quem decide é a claridade. Escuro é
// vinho, e vinho mora em Vermelhos, que é onde a equipe procura.

type Lab = [number, number, number];

/** Lab D50 (o do .acb) → OKLCH. L de 0 a 1, C a partir de 0, h em graus. */
export function oklchDoLab([L, a, b]: Lab): { L: number; C: number; h: number } {
  /* Lab → XYZ, branco D50 */
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const X50 = 0.96422 * inv(fx), Y50 = L > 8 ? fy ** 3 : L / (24389 / 27), Z50 = 0.82521 * inv(fz);
  /* D50 → D65 (Bradford) */
  const X = 0.9555766 * X50 - 0.0230393 * Y50 + 0.0631636 * Z50;
  const Y = -0.0282895 * X50 + 1.0099416 * Y50 + 0.0210077 * Z50;
  const Z = 0.0122982 * X50 - 0.020483 * Y50 + 1.3299098 * Z50;
  /* XYZ D65 → OKLab */
  const l = Math.cbrt(0.8189330101 * X + 0.3618667424 * Y - 0.1288597137 * Z);
  const m = Math.cbrt(0.0329845436 * X + 0.9293118715 * Y + 0.0361456387 * Z);
  const s = Math.cbrt(0.0482003018 * X + 0.2643662691 * Y + 0.633851707 * Z);
  const OL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const Oa = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Ob = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let h = (Math.atan2(Ob, Oa) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L: OL, C: Math.hypot(Oa, Ob), h };
}

/* Os cortes, em graus do OKLab, e o que decidiu cada um:
   - CINZA: croma abaixo disso é neutro (cinzas, beges muito apagados, pretos);
   - 12°: vermelho começa (201 C a 18°, 186 C a 22°, 1945 C a 12°);
   - 38°: laranja começa (Orange 021 C a 38°, 485 C a 29°);
   - 111°: verde começa (101 C a 105°, 394 C a 109°, 396 C a 110° ainda são
     amarelos; 382 C a 116° e 375 C a 129° já são verdes);
   - 200°: azul começa (os petróleos e verdes-água ficam em Verdes);
   - 275°: roxo começa (2735 C a 280°; o azul mais "roxo", 2736 C, a 268°);
   - 335°: magenta/rosa começa (Purple C a 328°, 2425 C a 340°);
   - MARROM: laranja e amarelo escuros (4625 C, 469 C) e os tons de croma
     baixo que o olho chama de caqui/bege-escuro (2470 C, 7504 C, 7503 C);
   - SALMÃO: vermelho claro e pouco saturado é rosa (2445 C, 177 C, 487 C);
     o coral forte continua vermelho (178 C, 7416 C);
   - VINHO: magenta/rosa escuro vira vermelho (208 C, 222 C, 1955 C). */
const CINZA = 0.035;
const MARROM_L = 0.56;
const CAQUI = { C: 0.07, L: 0.74 };
const SALMAO = { L: 0.69, C: 0.16 };
const VINHO_L = 0.47;

export function familiaDe(lab: Lab): string {
  const { L, C, h } = oklchDoLab(lab);
  if (C < CINZA) return "neutro";
  if (h >= 12 && h < 38) return L >= SALMAO.L && C <= SALMAO.C ? "rosa" : "vermelho";
  if (h >= 38 && h < 111) {
    if (L < MARROM_L || (C < CAQUI.C && L < CAQUI.L)) return "marrom";
    return h < 70 ? "laranja" : "amarelo";
  }
  if (h >= 111 && h < 200) return "verde";
  if (h >= 200 && h < 275) return "azul";
  if (h >= 275 && h < 335) return "rosa";
  /* 335°..12°: magentas e rosas; os escuros são vinho */
  return L < VINHO_L ? "vermelho" : "rosa";
}
