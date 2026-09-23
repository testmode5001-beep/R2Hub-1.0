// Verificação da varredura OCR: re-lê APENAS as fichas apontadas como
// divergentes, em resolução maior, guardando o texto bruto ao redor de
// "Diâmetro" — para separar erro real de dado de ruído do OCR (o "Ø"
// colado no número vira dígito: "55Ø" → "550" / "669").
//
//   node scripts/varredura-ocr-verificar.mjs
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DIR = process.env.FACAS_PDF_DIR ?? "\\\\server\\Arte\\Clientes\\Modelos\\Design\\R2 Hub\\Facas";
const PASSO = 3.175;
const ENTRADA = "scripts/varredura-ocr-resultado.json";
const SAIDA = "scripts/varredura-ocr-verificacao.json";

const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { createCanvas } = await import("@napi-rs/canvas");
const { createWorker } = await import("tesseract.js");

async function paginaComoPng(caminho) {
  const tarefa = getDocument({ data: new Uint8Array(readFileSync(caminho)), useSystemFonts: true });
  const doc = await tarefa.promise;
  const page = await doc.getPage(1);
  const v1 = page.getViewport({ scale: 1 });
  const escala = Math.min(4.5, 2600 / v1.width); // maior que a 1ª passada
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

// interpreta o número lido: aceita 30–130 direto; acima disso assume que o
// OCR colou um glifo (Ø no fim → 550/669, Ø no começo → 938/242) e testa
// tirar o último ou o primeiro dígito.
function interpretar(bruto) {
  const n = parseInt(bruto, 10);
  if (!Number.isFinite(n)) return null;
  if (n >= 30 && n <= 130) return n;
  if (String(n).length === 3) {
    const semUltimo = Math.floor(n / 10);
    const semPrimeiro = n % 100;
    if (semUltimo >= 30 && semUltimo <= 130) return semUltimo;
    if (semPrimeiro >= 30 && semPrimeiro <= 130) return semPrimeiro;
  }
  return null;
}

const resultado = JSON.parse(readFileSync(ENTRADA, "utf8"));
const src = readFileSync("src/components/v1a/dados/facas-cilindro.ts", "utf8");
const zTab = JSON.parse(src.match(/Z_TABELA: Record<string, number> = (\{.*?\});/s)[1]);

// mesmos critérios do relatório da 1ª passada
const alvos = [];
for (const [cod, info] of Object.entries(resultado)) {
  if (info.erro || info.diam == null) continue;
  const z = zTab[cod];
  const diamCat = z ? Math.floor((z * PASSO) / Math.PI) : null;
  if (diamCat == null || diamCat !== info.diam) alvos.push(cod);
}
console.log(`Verificando ${alvos.length} fichas divergentes em alta resolução…`);

const worker = await createWorker("por", 1, {
  langPath: path.resolve("public/tesseract"),
  gzip: true,
});

const veri = existsSync(SAIDA) ? JSON.parse(readFileSync(SAIDA, "utf8")) : {};
let feitos = 0;
for (const cod of alvos) {
  if (veri[cod]) { feitos++; continue; }
  try {
    const png = await paginaComoPng(path.join(DIR, cod + ".pdf"));
    const r = await worker.recognize(png);
    const t = (r.data.text || "").replace(/\s+/g, " ");
    const m = t.match(/Di[âa&]metro[:;.]?\s*(\S+(?:\s\S+)?)/i);
    const bruto = m ? m[1] : null;
    const digitos = bruto ? (bruto.match(/[0-9]+/) || [])[0] : null;
    veri[cod] = { bruto, diam: interpretar(digitos), medida: resultado[cod].medida };
  } catch (e) {
    veri[cod] = { erro: String(e?.message ?? e).slice(0, 80) };
  }
  feitos++;
  if (feitos % 10 === 0) {
    writeFileSync(SAIDA, JSON.stringify(veri, null, 1));
    console.log(`  ${feitos}/${alvos.length}…`);
  }
}
writeFileSync(SAIDA, JSON.stringify(veri, null, 1));
await worker.terminate();

// veredito final
const reais = [], semZ = [], ruido = [], indefinidos = [];
for (const cod of alvos) {
  const v = veri[cod];
  const z = zTab[cod];
  const diamCat = z ? Math.floor((z * PASSO) / Math.PI) : null;
  if (!v || v.erro || v.diam == null) { indefinidos.push(`${cod}: bruto="${v?.bruto ?? v?.erro ?? "?"}" (catálogo Ø${diamCat ?? "—"})`); continue; }
  const zFicha = Math.ceil((v.diam * Math.PI) / PASSO);
  if (diamCat == null) semZ.push(`${cod}: ficha Ø${v.diam} → Z${zFicha}  [bruto "${v.bruto}"]${v.medida ? " · " + v.medida : ""}`);
  else if (diamCat === v.diam) ruido.push(cod);
  else reais.push(`${cod}: catálogo Ø${diamCat} (Z${z}) ≠ ficha Ø${v.diam} → Z${zFicha}  [bruto "${v.bruto}"]${v.medida ? " · " + v.medida : ""}`);
}
console.log(`\nRuído de OCR confirmado (catálogo já certo): ${ruido.length}`);
console.log(`\nDIVERGÊNCIAS REAIS (${reais.length}):`);
reais.forEach((f) => console.log("  · " + f));
console.log(`\nSEM Z NA TABELA (${semZ.length}):`);
semZ.forEach((f) => console.log("  · " + f));
console.log(`\nINDEFINIDOS — revisar manualmente (${indefinidos.length}):`);
indefinidos.forEach((f) => console.log("  · " + f));
