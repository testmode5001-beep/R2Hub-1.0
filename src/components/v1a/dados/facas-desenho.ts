// Desenho em miniatura da faca a partir da MEDIDA escrita ("100 x 140").
// Estava só dentro do formulário de nova solicitação; a Afiação passou a usar o
// mesmo desenho ao pedir faca nova, então virou peça única.
import type { CSSProperties } from "react";

import { MEDIDAS } from "./facas-cilindro";

export type FacaDesenho = { medida: string; sistema?: string; secao?: string };

/** Caixa proporcional à medida: retângulo, redonda ou tag, tracejada no picote. */
export function desenhoDaFaca(f: FacaDesenho, maxW: number, maxH: number, cor = "#252425"): CSSProperties {
  const nums = MEDIDAS(f.medida);
  const l = nums[0] || 50;
  const a = nums[1] || nums[0] || 50;
  const esc = Math.min(maxW / l, maxH / a);
  const w = Math.max(12, Math.round(l * esc));
  const h = Math.max(10, Math.round(a * esc));
  const redondo = f.sistema === "Redonda";
  const tag = f.sistema === "Tag";
  const tracejado = f.sistema === "Picote" || /serrilha/i.test(f.secao || "");
  const raio = redondo ? 999 : tag ? Math.round(Math.min(w, h) * 0.18) : 5;
  return { width: w, height: h, border: `1.5px ${tracejado ? "dashed" : "solid"} ${cor}`, borderRadius: raio, background: "transparent" };
}

/** A medida tem números de verdade? ("100 x 140" sim, "faca do zé" não). */
export function medidaValida(medida: string): boolean {
  const nums = MEDIDAS(medida);
  return nums.length > 0 && nums[0] > 0;
}
