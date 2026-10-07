// Busca rápida na tabela Pantone Solid Coated + escala de processo.
// Fonte: design_handoff_r2_hub/telas/pantone-busca.js (portado de window.pantoneSugestoes).
import { PANTONE_SC } from "./pantone";
import { nomeDaBusca } from "@/lib/nomes-de-cor";

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

/** Como o hub ESCREVE um Pantone: "P 185 C". Era "Pantone 185 C" e não cabia
    nos campos estreitos — a caixa do clichê mostrava "Pantone 48…" e o código,
    que é a única parte que importa, ficava cortado. Augusto, 23/09/2026. */
export const prefixoPantone = (codigo: string) => `P ${codigo}`;

/** Tira o "Pantone"/"P" da frente e devolve só o código, em minúscula. Serve
    para comparar duas grafias do mesmo nome — o que está gravado nos pedidos
    antigos ("Pantone 294 C") e o que o hub escreve hoje ("P 294 C"). */
const soOCodigo = (nome: string) =>
  String(nome || "").trim().toLowerCase().replace(/^(pantone|p)\s+/, "").trim();

export function sugestoesPantone(termo: string, limite = 6): SugestaoPantone[] {
  const q = soOCodigo(termo);
  if (!q) return [];
  /* Três degraus: o código exato ou uma palavra inteira dele ("021" é a
     Orange 021 C, que ficava atrás de 10210…10215 e saía da lista), depois o
     que começa igual, depois o que só contém. */
  const qSemC = q.replace(/ c$/, "");
  const exatos: SugestaoPantone[] = [], fora: SugestaoPantone[] = [], dentro: SugestaoPantone[] = [];
  const item = (p: { c: string; h: string }): SugestaoPantone =>
    ({ nome: prefixoPantone(p.c), codigo: p.c, hex: p.h.toUpperCase(), cmyk: cmykDeHex(p.h) });

  for (const p of PROCESSO) {
    if (p.c.toLowerCase().startsWith(q)) fora.push({ nome: p.c, codigo: p.c, hex: p.h, cmyk: p.k });
  }

  for (const p of PANTONE_SC) {
    const alvo = p.c.toLowerCase();
    if (alvo === q || alvo.replace(/ c$/, "").split(" ").includes(qSemC)) {
      if (exatos.length < limite) exatos.push(item(p));
    } else if (alvo.startsWith(q)) {
      if (fora.length < limite) fora.push(item(p));
    } else if (dentro.length < limite && alvo.indexOf(q) > -1) {
      dentro.push(item(p));
    }
  }
  return exatos.concat(fora, dentro).slice(0, limite);
}

/** Cor real de um nome escrito por gente — "P 294 C", "Pantone 294 C" (como
    ficou gravado antes), "Preto", "Verde". Devolve null quando o nome não é
    uma cor conhecida, e aí quem chama mostra a bolinha neutra.
    Só casa código EXATO: "P 2" é começo de dezenas de cores e pintar a
    bolinha com a primeira seria chute. */
/* Nomes de cor que a vendedora escreve no lugar do Pantone: a bolinha saía
   cinza para "Vermelho" e "Azul" (simulação de 28/09/2026). Tons de tela,
   só para a bolinha; o Pantone de verdade continua vindo da tabela. */
const NOMES_COMUNS: Record<string, string> = {
  vermelho: "#E30613", azul: "#0057B8", "azul marinho": "#1F2A5A", "azul claro": "#6CACE4", verde: "#009A44",
  "verde limao": "#9ACD32", "verde escuro": "#00563F", laranja: "#FF7F00", rosa: "#F48FB1", pink: "#E6007E",
  roxo: "#6A1B9A", lilas: "#B39DDB", violeta: "#7F3F98", marrom: "#6D4C41", cinza: "#9E9E9E", prata: "#C0C0C0",
  bege: "#E8D8B8", vinho: "#7B1E2B", bordo: "#7B1E2B", creme: "#F3E5C0", ouro: "#C6A15B", turquesa: "#00A8B5",
};

export function corDoNome(nome: string): string | null {
  const n = String(nome || "").trim();
  if (!n) return null;
  /* as tintas de processo e especiais ("Dourado", "Branco") têm a cor delas */
  const proc = PROCESSO.find((p) => p.c.toLowerCase() === n.toLowerCase());
  if (proc) return proc.h;
  /* nome de referência ("rosa choque", "azul bic", lib/nomes-de-cor): a
     bolinha sai na cor do 1º Pantone dele, o mesmo que a busca de Pantones usa */
  const ref = nomeDaBusca(n);
  if (ref?.tipo === "ancora") {
    const p = PANTONE_SC.find((x) => x.c === ref.refs[0]);
    if (p) return p.h.toUpperCase();
  }
  const comum = NOMES_COMUNS[n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ")];
  if (comum) return comum;
  const s = sugestoesPantone(n, 1)[0];
  return s && soOCodigo(s.nome) === soOCodigo(n) ? s.hex : null;
}
