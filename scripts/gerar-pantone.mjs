/* Regera src/components/v1a/dados/pantone.ts a partir do color book oficial
   da Adobe (.acb). É assim que a tabela do hub se mantém em dia quando a
   Pantone lança cores novas: quem atualiza o livro é o próprio Illustrator.

   Uso:
     node scripts/gerar-pantone.mjs                    (acha o livro sozinho)
     node scripts/gerar-pantone.mjs "C:\\...\\livro.acb"  (aponta um livro)
     node scripts/gerar-pantone.mjs --conferir         (só compara, não grava)

   Depois de gerar: npx tsc --noEmit && npm run build && reiniciar o hub. */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SAIDA = "src/components/v1a/dados/pantone.ts";

/* ---------- onde o Illustrator/Photoshop guardam os livros ---------- */
function acharLivro() {
  const raizes = ["C:\\Program Files\\Adobe", "C:\\Program Files (x86)\\Adobe"];
  const achados = [];
  for (const raiz of raizes) {
    if (!existsSync(raiz)) continue;
    for (const app of readdirSync(raiz)) {
      /* pt_BR e en_US mudam o nome da pasta de amostras */
      for (const meio of ["Presets\\pt_BR\\Amostras\\Livros coloridos", "Presets\\en_US\\Swatches\\Color Books", "Presets\\Swatch Libraries"]) {
        const dir = join(raiz, app, meio);
        if (!existsSync(dir)) continue;
        for (const arq of readdirSync(dir)) {
          if (!/\.acb$/i.test(arq)) continue;
          /* Solid Coated é o leque que a R2 usa; "Uncoated" e os -336 antigos ficam de fora */
          if (!/solid\s*coated/i.test(arq) || /uncoated|-336/i.test(arq)) continue;
          achados.push(join(dir, arq));
        }
      }
    }
  }
  /* ganha o livro com MAIS cores: é sempre o mais novo, e o critério não
     depende do nome (as versões antigas se chamam "PANTONE+ Solid Coated") */
  let melhor = null;
  for (const arq of achados.sort()) {
    try {
      const q = lerAcb(arq).qtde;
      if (!melhor || q > melhor.q) melhor = { arq, q };
    } catch { /* livro em CMYK/RGB ou corrompido: ignora */ }
  }
  return melhor ? melhor.arq : null;
}

/* ---------- leitura do .acb (formato 8BCB da Adobe) ---------- */
function lerAcb(arq) {
  const b = readFileSync(arq);
  if (b.toString("latin1", 0, 4) !== "8BCB") throw new Error("não é um color book .acb: " + arq);
  let p = 4;
  const u16 = () => { const v = b.readUInt16BE(p); p += 2; return v; };
  const u32 = () => { const v = b.readUInt32BE(p); p += 4; return v; };
  /* as strings são UTF-16 big-endian com o tamanho em caracteres */
  /* nos livros antigos as strings vêm como chave de tradução
     ("$$$/colorbook/PANTONE/postfix= C") — o que vale é o depois do "=" */
  const str = () => {
    const n = u32(); const ini = p; p += n * 2;
    const s = Buffer.from(b.subarray(ini, p)).swap16().toString("utf16le");
    return s.startsWith("$$$/") ? s.slice(s.indexOf("=") + 1) : s;
  };
  u16(); u16();                       // versão, id
  const titulo = str(); str(); const posfixo = str(); str();
  const qtde = u16(); u16(); u16();
  const espaco = u16();
  if (espaco !== 7) throw new Error("o livro não está em Lab (espaço " + espaco + ") — o hub guarda o Lab oficial");
  const cores = [];
  for (let i = 0; i < qtde; i++) {
    const nome = str();
    const cod = b.toString("latin1", p, p + 6).trim(); p += 6;
    const L = b[p] / 2.55, a = b[p + 1] - 128, bb = b[p + 2] - 128; p += 3;
    /* o nome vem "100" e o sufixo do livro é " C" — é assim que a equipe escreve */
    const rotulo = (nome.replace(/\s*\(.*?\)\s*$/, "").replace(/^\s*PANTONE\s+/i, "").trim() + posfixo).replace(/\s+/g, " ").trim();
    cores.push({ c: rotulo, cod, l: [Math.round(L * 10) / 10, a, bb] });
  }
  return { titulo, qtde, cores };
}

/* ---------- Lab (D50, como no livro) -> sRGB para mostrar na tela ---------- */
function labParaHex([L, a, bStar]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bStar / 200;
  const g = (t) => (t > 6 / 29 ? t * t * t : 3 * (6 / 29) ** 2 * (t - 4 / 29));
  /* branco D50 do arquivo */
  const X = 0.96422 * g(fx), Y = 1.0 * g(fy), Z = 0.82521 * g(fz);
  /* Bradford D50 -> D65 */
  const x = 0.9555766 * X - 0.0230393 * Y + 0.0631636 * Z;
  const y = -0.0282895 * X + 1.0099416 * Y + 0.0210077 * Z;
  const z = 0.0122982 * X - 0.0204830 * Y + 1.3299098 * Z;
  const lin = [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.9692660 * x + 1.8760108 * y + 0.0415560 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
  ];
  const canal = (v) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(c * 255)));
  };
  return "#" + lin.map(canal).map((n) => n.toString(16).padStart(2, "0")).join("");
}

/* ---------- gera o arquivo ---------- */
const args = process.argv.slice(2);
const conferir = args.includes("--conferir");
const alvo = args.find((a) => !a.startsWith("--")) || acharLivro();
if (!alvo) {
  console.error("Não achei nenhum 'Solid Coated .acb' instalado. Passe o caminho do livro como argumento.");
  process.exit(1);
}

const livro = lerAcb(alvo);
const linhas = livro.cores.map((c) => `{c:${JSON.stringify(c.c)},h:${JSON.stringify(labParaHex(c.l))},l:[${c.l.join(",")}]}`);
const texto =
  `// Pantone ${livro.titulo.replace(/^Pantone\s*/i, "")} — extraído do color book oficial (.acb, espaço Lab/D50).\n` +
  `// h = conversão Lab->sRGB para exibição em tela; l = Lab oficial do arquivo.\n` +
  `// GERADO por scripts/gerar-pantone.mjs — não edite à mão.\n` +
  `export const PANTONE_SC: { c: string; h: string; l: [number, number, number] }[] = [\n` +
  linhas.join(",\n") + `,\n];\n`;

const atual = existsSync(SAIDA) ? readFileSync(SAIDA, "utf8") : "";
const codigosAtuais = new Set([...atual.matchAll(/\{c:"([^"]+)"/g)].map((m) => m[1]));
const novos = livro.cores.filter((c) => !codigosAtuais.has(c.c)).map((c) => c.c);
const sumidos = [...codigosAtuais].filter((c) => !livro.cores.some((x) => x.c === c));

console.log("livro:  " + alvo);
console.log("título: " + livro.titulo + "  ·  " + livro.qtde + " cores");
console.log("no hub hoje: " + codigosAtuais.size + " cores");
console.log("novas: " + novos.length + (novos.length ? "  (" + novos.slice(0, 12).join(", ") + (novos.length > 12 ? ", …" : "") + ")" : ""));
console.log("saíram do livro: " + sumidos.length + (sumidos.length ? "  (" + sumidos.slice(0, 12).join(", ") + (sumidos.length > 12 ? ", …" : "") + ")" : ""));

if (conferir) {
  console.log(texto === atual ? "\nIGUAL ao arquivo do hub — nada a atualizar." : "\nDIFERENTE do arquivo do hub. Rode sem --conferir para gravar.");
  process.exit(0);
}
if (texto === atual) { console.log("\nNada mudou: o arquivo do hub já está igual ao livro."); process.exit(0); }
writeFileSync(SAIDA, texto);
console.log("\ngravado em " + SAIDA + "\nAgora: npx tsc --noEmit && npm run build && criar reiniciar.txt na raiz.");
