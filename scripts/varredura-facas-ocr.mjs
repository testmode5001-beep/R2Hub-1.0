// Varredura 2 — OCR das fichas que são imagem pura (335 dos 352 PDFs).
// Desenha a 1ª página com o pdfjs num canvas, OCR com o tesseract local
// (public/tesseract, sem internet) e compara Diâmetro/Medida com a Z_TABELA.
// Resultado em scripts/varredura-ocr-resultado.json + relatório no console.
//
//   node scripts/varredura-facas-ocr.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DIR = process.env.FACAS_PDF_DIR ?? "\\\\server\\Arte\\Clientes\\Modelos\\Design\\R2 Hub\\Facas";
const PASSO = 3.175;
const SAIDA = "scripts/varredura-ocr-resultado.json";

const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { createCanvas } = await import("@napi-rs/canvas");
const { createWorker } = await import("tesseract.js");

async function paginaComoPng(caminho) {
  const tarefa = getDocument({ data: new Uint8Array(readFileSync(caminho)), useSystemFonts: true });
  const doc = await tarefa.promise;
  const page = await doc.getPage(1);
  // escala mirando ~2000px de largura — corpo 10-12pt vira ~30px, OCR confortável
  const v1 = page.getViewport({ scale: 1 });
  const escala = Math.min(3.5, 2000 / v1.width);
  const viewport = page.getViewport({ scale: escala });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const png = canvas.toBuffer("image/png");
  await tarefa.destroy();
  return png;
}

const num = (s) => (s == null ? null : parseFloat(String(s).replace(",", ".")));
function extrair(texto) {
  const t = texto.replace(/\s+/g, " ");
  // OCR troca Ø por 0/O/@ e às vezes cola; aceita "Diâmetro: 66Ø", "Diametro 660", "Diâmetro: 66"
  const mDiam = t.match(/Di[âa&]metro[:;.]?\s*([0-9]{2,3})(?:[ØO0@ ]|$)/i);
  const mRep = t.match(/Repeti[çc][õoã]es[:;.]?\s*([0-9]{1,2})\b/i);
  const mCarr = t.match(/Carreiras?[:;.]?\s*([0-9]{1,2})\b/i);
  const mMed = t.match(/Medida[:;.]?\s*([0-9.,]+)\s*[xX×]\s*([0-9.,]+)/);
  return {
    diam: num(mDiam?.[1]),
    rep: num(mRep?.[1]),
    carr: num(mCarr?.[1]),
    medida: mMed ? `${mMed[1]}x${mMed[2]}` : null,
  };
}

// já sabemos por texto (varredura 1): pula
const jaLidas = existsSync("src/components/v1a/dados/facas-fichas.json")
  ? new Set(Object.keys(JSON.parse(readFileSync("src/components/v1a/dados/facas-fichas.json", "utf8"))))
  : new Set();

const arquivos = readdirSync(DIR).filter((n) => n.toLowerCase().endsWith(".pdf"))
  .filter((n) => !jaLidas.has(n.replace(/\.pdf$/i, ""))).sort();
console.log(`OCR em ${arquivos.length} PDFs (pulando ${jaLidas.size} já lidos por texto)…`);

const worker = await createWorker("por", 1, {
  langPath: path.resolve("public/tesseract"),
  gzip: true,
});

const resultado = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, "utf8")) : {};
let feitos = 0, falhas = 0;

for (const nome of arquivos) {
  const cod = nome.replace(/\.pdf$/i, "");
  if (resultado[cod]) { feitos++; continue; }   // retomável
  try {
    const png = await paginaComoPng(path.join(DIR, nome));
    const r = await worker.recognize(png);
    resultado[cod] = extrair(r.data.text || "");
    feitos++;
  } catch (e) {
    resultado[cod] = { erro: String(e?.message ?? e).slice(0, 80) };
    falhas++;
  }
  if (feitos % 10 === 0) {
    writeFileSync(SAIDA, JSON.stringify(resultado, null, 1));
    console.log(`  ${feitos}/${arquivos.length}…`);
  }
}
writeFileSync(SAIDA, JSON.stringify(resultado, null, 1));
await worker.terminate();

// relatório: compara com a Z_TABELA (convenção da ficha = piso)
const src = readFileSync("src/components/v1a/dados/facas-cilindro.ts", "utf8");
const zTab = JSON.parse(src.match(/Z_TABELA: Record<string, number> = (\{.*?\});/s)[1]);
const flags = [];
let comDiam = 0;
for (const [cod, info] of Object.entries(resultado)) {
  if (info.erro || info.diam == null) continue;
  comDiam++;
  const z = zTab[cod];
  const diamCat = z ? Math.floor((z * PASSO) / Math.PI) : null;
  const zFicha = Math.ceil((info.diam * Math.PI) / PASSO);
  if (diamCat == null) flags.push(`${cod}: SEM Z — ficha Ø${info.diam} (Z${zFicha})${info.medida ? " · " + info.medida : ""}`);
  else if (diamCat !== info.diam) flags.push(`${cod}: catálogo Ø${diamCat} (Z${z}) ≠ ficha Ø${info.diam} (Z${zFicha})${info.medida ? " · " + info.medida : ""}`);
}
console.log(`\nOCR concluído: ${feitos} lidos, ${falhas} falhas, ${comDiam} com diâmetro extraído.`);
console.log(`Divergências (${flags.length}):`);
flags.forEach((f) => console.log("  · " + f));
console.log(`\nDetalhe completo: ${SAIDA}`);
