// Consolida as varreduras (texto + OCR verificado) na convenção da ficha
// (diâmetro = piso de circ/3,14 — evidência: 093.01 Z94 → "95Ø") e imprime:
//   - correções de Z para códigos que já estão na Z_TABELA
//   - adições de Z para códigos sem dentes na tabela
//   - conferência: onde a troca π→3,14 muda o número exibido
//   node scripts/aplicar-varredura.mjs
import { readFileSync, existsSync } from "node:fs";

const PASSO = 3.175;
const D = (z) => Math.floor((z * PASSO) / 3.14);          // como a ficha mostra
const Z = (d) => Math.ceil((d * 3.14) / PASSO);           // ficha → dentes

const src = readFileSync("src/components/v1a/dados/facas-cilindro.ts", "utf8");
const zTab = JSON.parse(src.match(/Z_TABELA: Record<string, number> = (\{.*?\});/s)[1]);

// fonte da verdade por código: texto (1ª varredura) > verificação hi-res > OCR bruto
const fichas = {};
const texto = existsSync("src/components/v1a/dados/facas-fichas.json")
  ? JSON.parse(readFileSync("src/components/v1a/dados/facas-fichas.json", "utf8")) : {};
const ocr1 = JSON.parse(readFileSync("scripts/varredura-ocr-resultado.json", "utf8"));
const veri = JSON.parse(readFileSync("scripts/varredura-ocr-verificacao.json", "utf8"));
for (const [cod, i] of Object.entries(ocr1)) if (i.diam != null && !i.erro) fichas[cod] = { diam: i.diam, fonte: "ocr" };
for (const [cod, i] of Object.entries(veri)) if (i.diam != null && !i.erro) fichas[cod] = { diam: i.diam, fonte: "verificado" };
for (const [cod, i] of Object.entries(texto)) if (i.diam != null) fichas[cod] = { diam: Math.floor(i.diam), fonte: "texto" };

// correções manuais confirmadas olhando o PDF renderizado
const OLHO = {
  "093.01": 95, "135.01": 42, "190.01": 53, "198.01": 60, "FAC0256.01": 81, "FAC0267.01": 96,
  "SN9.01": 102, "FAC0147.01": 43, "A011.02": 48, "265.01": 42, "078.01": 91, "FAC0073.01": 61,
  "SN22.01": 55,
  // indefinidos do OCR onde as duas passadas concordam nos 2 primeiros dígitos
  "FAC0102.01": 50, "FAC0119.01": 70, "FAC0178.01": 50, "SN28.01": 70,
};
for (const [cod, d] of Object.entries(OLHO)) fichas[cod] = { diam: d, fonte: "visual" };

// ida e volta precisa fechar para todo diâmetro usado
for (const { diam } of Object.values(fichas)) {
  if (D(Z(diam)) !== diam) console.log(`AVISO ida-e-volta: Ø${diam} → Z${Z(diam)} → Ø${D(Z(diam))}`);
}

// onde π→3,14 muda o que a pílula mostra (para códigos que JÁ têm Z)
console.log("Exibição muda com a fórmula nova (π → 3,14):");
for (const [cod, z] of Object.entries(zTab)) {
  const velho = Math.floor((z * PASSO) / Math.PI);
  if (velho !== D(z)) console.log(`  ${cod}: Z${z} mostrava ${velho}, agora ${D(z)}${fichas[cod] ? ` · ficha Ø${fichas[cod].diam} (${fichas[cod].fonte})` : " · SEM ficha lida"}`);
}

const corrigir = [], adicionar = [];
for (const [cod, { diam, fonte }] of Object.entries(fichas)) {
  const z = zTab[cod];
  if (z == null) adicionar.push(`"${cod}":${Z(diam)}`);
  else if (D(z) !== diam) corrigir.push(`${cod}: Z${z} (mostra ${D(z)}) → Z${Z(diam)} (ficha Ø${diam}, ${fonte})`);
}
console.log(`\nCorreções (${corrigir.length}):`);
corrigir.forEach((c) => console.log("  " + c));
console.log(`\nAdições (${adicionar.length}):`);
console.log(adicionar.join(","));
