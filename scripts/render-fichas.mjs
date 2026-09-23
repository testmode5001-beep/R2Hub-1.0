// Renderiza fichas específicas em PNG para conferência visual (uso pontual).
//   node scripts/render-fichas.mjs <pasta-saida> <cod> <cod> ...
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DIR = process.env.FACAS_PDF_DIR ?? "\\\\server\\Arte\\Clientes\\Modelos\\Design\\R2 Hub\\Facas";
const [saida, ...cods] = process.argv.slice(2);

const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { createCanvas } = await import("@napi-rs/canvas");

for (const cod of cods) {
  const tarefa = getDocument({ data: new Uint8Array(readFileSync(path.join(DIR, cod + ".pdf"))), useSystemFonts: true });
  const doc = await tarefa.promise;
  const page = await doc.getPage(1);
  const v1 = page.getViewport({ scale: 1 });
  const escala = Math.min(3, 1500 / v1.width);
  const viewport = page.getViewport({ scale: escala });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  writeFileSync(path.join(saida, cod.replace(/[^\w,.-]/g, "_") + ".png"), canvas.toBuffer("image/png"));
  await tarefa.destroy();
  console.log("ok " + cod);
}
