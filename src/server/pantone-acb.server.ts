/* Leitura do color book oficial da Pantone (.acb da Adobe) direto do disco.
   É a mesma fonte do scripts/gerar-pantone.mjs; aqui serve para o botão
   "Procurar cores novas" da tela Pantone conferir sem ninguém rodar nada no
   terminal. O livro vem com o Illustrator/Photoshop — quando a Adobe atualiza
   o app, a leva nova de cores chega junto. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type CorPantone = { c: string; h: string; l: [number, number, number] };
export type LivroPantone = { arquivo: string; titulo: string; cores: CorPantone[] };

/* Onde o Illustrator/Photoshop guardam os livros (pt_BR e en_US mudam a pasta). */
const RAIZES = ["C:\\Program Files\\Adobe", "C:\\Program Files (x86)\\Adobe"];
const MEIOS = [
  "Presets\\pt_BR\\Amostras\\Livros coloridos",
  "Presets\\en_US\\Swatches\\Color Books",
  "Presets\\Swatch Libraries",
];

function candidatos(): string[] {
  const fora = process.env.PANTONE_ACB;
  if (fora && existsSync(fora)) return [fora];
  const achados: string[] = [];
  for (const raiz of RAIZES) {
    if (!existsSync(raiz)) continue;
    for (const app of readdirSync(raiz)) {
      for (const meio of MEIOS) {
        const dir = join(raiz, app, meio);
        if (!existsSync(dir)) continue;
        for (const arq of readdirSync(dir)) {
          if (!/\.acb$/i.test(arq)) continue;
          /* Solid Coated é o leque da casa; Uncoated e os "-336" antigos ficam fora */
          if (!/solid\s*coated/i.test(arq) || /uncoated|-336/i.test(arq)) continue;
          achados.push(join(dir, arq));
        }
      }
    }
  }
  return achados.sort();
}

/** Lab (D50, como no livro) → sRGB, só para exibir na tela. */
function labParaHex([L, a, bStar]: [number, number, number]): string {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bStar / 200;
  const g = (t: number) => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) ** 2 * (t - 4 / 29));
  const X = 0.96422 * g(fx), Y = 1.0 * g(fy), Z = 0.82521 * g(fz);
  const x = 0.9555766 * X - 0.0230393 * Y + 0.0631636 * Z;
  const y = -0.0282895 * X + 1.0099416 * Y + 0.0210077 * Z;
  const z = 0.0122982 * X - 0.0204830 * Y + 1.3299098 * Z;
  const lin = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.9692660 * x + 1.8760108 * y + 0.0415560 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
  const canal = (v: number) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  };
  return "#" + lin.map(canal).map((n) => n.toString(16).padStart(2, "0")).join("");
}

/** Formato 8BCB da Adobe. Lança se o arquivo não for um livro em Lab. */
function lerAcb(arq: string): LivroPantone {
  const b = readFileSync(arq);
  if (b.toString("latin1", 0, 4) !== "8BCB") throw new Error("não é um color book .acb");
  let p = 4;
  const u16 = () => { const v = b.readUInt16BE(p); p += 2; return v; };
  const u32 = () => { const v = b.readUInt32BE(p); p += 4; return v; };
  /* strings em UTF-16 big-endian; nos livros antigos vêm como chave de
     tradução ("$$$/colorbook/PANTONE/postfix= C") e o que vale é depois do "=" */
  const str = () => {
    const n = u32(); const ini = p; p += n * 2;
    const s = Buffer.from(b.subarray(ini, p)).swap16().toString("utf16le");
    return s.startsWith("$$$/") ? s.slice(s.indexOf("=") + 1) : s;
  };
  u16(); u16();
  const titulo = str(); str(); const posfixo = str(); str();
  const qtde = u16(); u16(); u16();
  const espaco = u16();
  if (espaco !== 7) throw new Error("o livro não está em Lab");
  const cores: CorPantone[] = [];
  for (let i = 0; i < qtde; i++) {
    const nome = str();
    p += 6; // código interno do livro, não usado
    const L = Math.round((b[p] / 2.55) * 10) / 10, a = b[p + 1] - 128, bb = b[p + 2] - 128;
    p += 3;
    const rotulo = (nome.replace(/\s*\(.*?\)\s*$/, "").replace(/^\s*PANTONE\s+/i, "").trim() + posfixo)
      .replace(/\s+/g, " ").trim();
    const l: [number, number, number] = [L, a, bb];
    cores.push({ c: rotulo, h: labParaHex(l), l });
  }
  return { arquivo: arq, titulo, cores };
}

/** O livro instalado com MAIS cores — sempre o mais novo. Null se não achar. */
export function lerLivroPantone(): LivroPantone | null {
  let melhor: LivroPantone | null = null;
  for (const arq of candidatos()) {
    try {
      const livro = lerAcb(arq);
      if (!melhor || livro.cores.length > melhor.cores.length) melhor = livro;
    } catch { /* livro em CMYK/RGB ou corrompido: ignora */ }
  }
  return melhor;
}
