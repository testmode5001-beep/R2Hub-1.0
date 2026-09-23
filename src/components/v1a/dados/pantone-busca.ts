// Busca rápida na tabela Pantone Solid Coated + escala de processo.
// Fonte: design_handoff_r2_hub/telas/pantone-busca.js (portado de window.pantoneSugestoes).
import { PANTONE_SC } from "./pantone";

export type SugestaoPantone = { nome: string; codigo: string; hex: string; cmyk: string };

const PROCESSO = [
  { c: "Ciano", h: "#009FE3", k: "100/0/0/0" },
  { c: "Magenta", h: "#E5007E", k: "0/100/0/0" },
  { c: "Amarelo", h: "#FFED00", k: "0/0/100/0" },
  { c: "Preto", h: "#1D1D1B", k: "0/0/0/100" },
  /* tintas especiais: entram na lista de cores do pedido como qualquer outra */
  { c: "Dourado", h: "#C6A15B", k: "—" },
  { c: "Branco", h: "#FFFFFF", k: "—" },
];

export function cmykDeHex(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return "0/0/0/100";
  const c = (1 - r - k) / (1 - k), m = (1 - g - k) / (1 - k), y = (1 - b - k) / (1 - k);
  const p = (v: number) => Math.round(v * 100);
  return `${p(c)}/${p(m)}/${p(y)}/${p(k)}`;
}

export function sugestoesPantone(termo: string, limite = 6): SugestaoPantone[] {
  const q = String(termo || "").trim().toLowerCase().replace(/^pantone\s+/, "");
  if (!q) return [];
  const fora: SugestaoPantone[] = [], dentro: SugestaoPantone[] = [];

  for (const p of PROCESSO) {
    if (p.c.toLowerCase().startsWith(q)) fora.push({ nome: p.c, codigo: p.c, hex: p.h, cmyk: p.k });
  }

  for (const p of PANTONE_SC) {
    const alvo = p.c.toLowerCase();
    if (alvo.startsWith(q)) {
      fora.push({ nome: "Pantone " + p.c, codigo: p.c, hex: p.h.toUpperCase(), cmyk: cmykDeHex(p.h) });
      if (fora.length >= limite) break;
    } else if (dentro.length < limite && alvo.indexOf(q) > -1) {
      dentro.push({ nome: "Pantone " + p.c, codigo: p.c, hex: p.h.toUpperCase(), cmyk: cmykDeHex(p.h) });
    }
  }
  return fora.concat(dentro).slice(0, limite);
}
