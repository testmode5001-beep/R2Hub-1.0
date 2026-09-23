// Varredura dos diâmetros das facas: lê o TEXTO de cada Ficha Técnica (PDF do
// acervo na rede), extrai Diâmetro/Repetições/Carreiras/Medida e compara com o
// que o catálogo calcula pela tabela de dentes (Z_TABELA). Divergência vira
// linha de relatório; no final o script grava um JSON com os valores das
// fichas para o catálogo passar a usar como fonte da verdade.
//
//   node scripts/varredura-facas.mjs            → só relatório
//   node scripts/varredura-facas.mjs --gravar   → relatório + dados/facas-fichas.json
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const DIR = process.env.FACAS_PDF_DIR ?? "\\\\server\\Arte\\Clientes\\Modelos\\Design\\R2 Hub\\Facas";
const PASSO = 3.175;

// pdfjs no Node: build legacy, sem worker
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");

async function textoDoPdf(caminho) {
  const data = new Uint8Array(readFileSync(caminho));
  const tarefa = getDocument({ data, useSystemFonts: true });
  const doc = await tarefa.promise;
  let texto = "";
  for (let p = 1; p <= Math.min(doc.numPages, 2); p++) {
    const page = await doc.getPage(p);
    const c = await page.getTextContent();
    texto += c.items.map((i) => i.str).join(" ") + "\n";
  }
  await tarefa.destroy();   // no pdfjs novo o destroy é da TAREFA, não do doc
  return texto.replace(/\s+/g, " ");
}

const num = (s) => (s == null ? null : parseFloat(String(s).replace(",", ".")));

function extrair(texto) {
  const diam = num((texto.match(/Di[âa]metro:\s*([\d.,]+)/i) || [])[1]);
  const rep = num((texto.match(/Repeti[çc][õo]es:\s*([\d.,]+)/i) || [])[1]);
  const carr = num((texto.match(/Carreiras:\s*([\d.,]+)/i) || [])[1]);
  const medida = (texto.match(/Medida:\s*([\d.,]+\s*[xX×]\s*[\d.,]+)/) || [])[1] ?? null;
  return { diam, rep, carr, medida: medida ? medida.replace(/\s+/g, "") : null };
}

const arquivos = readdirSync(DIR).filter((n) => n.toLowerCase().endsWith(".pdf")).sort();
console.log(`Acervo: ${arquivos.length} PDFs em ${DIR}\n`);

const fichas = {};
const divergencias = [];
const semTexto = [];
let ok = 0;

for (const nome of arquivos) {
  const cod = nome.replace(/\.pdf$/i, "");
  let info;
  try {
    info = extrair(await textoDoPdf(path.join(DIR, nome)));
  } catch (e) {
    semTexto.push(`${cod} (erro: ${e?.message?.slice(0, 60)})`);
    continue;
  }
  if (info.diam == null) { semTexto.push(cod); continue; }
  fichas[cod] = info;
  ok++;
}

// compara com a tabela do catálogo
const src = readFileSync("src/components/v1a/dados/facas-cilindro.ts", "utf8");
const zTab = JSON.parse(src.match(/Z_TABELA: Record<string, number> = (\{.*?\});/s)[1]);

for (const [cod, info] of Object.entries(fichas)) {
  const z = zTab[cod];
  const diamCatalogo = z ? Math.round((z * PASSO) / Math.PI) : null; // como a pílula mostra
  const zDaFicha = Math.round((info.diam * Math.PI) / PASSO);
  if (diamCatalogo == null) {
    divergencias.push(`${cod}: SEM Z na tabela — ficha diz Ø${info.diam} (Z~${zDaFicha}); o catálogo estava estimando`);
  } else if (Math.abs(diamCatalogo - info.diam) > 1) {
    divergencias.push(`${cod}: catálogo Ø${diamCatalogo} (Z${z}) ≠ ficha Ø${info.diam} (Z~${zDaFicha})`);
  } else if (diamCatalogo !== Math.round(info.diam)) {
    divergencias.push(`${cod}: arredondamento — catálogo Ø${diamCatalogo} (Z${z}), ficha Ø${info.diam}`);
  } else { continue; }
}

console.log(`Fichas lidas com diâmetro: ${ok}`);
console.log(`Sem texto/diâmetro no PDF: ${semTexto.length}`);
console.log(`Divergências: ${divergencias.length}\n`);
divergencias.forEach((d) => console.log("  · " + d));
if (semTexto.length) console.log("\nPDFs ilegíveis (imagem pura?):\n  " + semTexto.join(", "));

if (process.argv.includes("--gravar")) {
  writeFileSync("src/components/v1a/dados/facas-fichas.json", JSON.stringify(fichas, null, 1));
  console.log(`\nGravado: src/components/v1a/dados/facas-fichas.json (${Object.keys(fichas).length} fichas)`);
}
