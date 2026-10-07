// Confere a matemática das calculadoras contra contas feitas por fora — o
// desenho a gente valida na tela, a conta não dá para validar de olho.
// Roda o código de VERDADE (compila o .tsx com esbuild e importa):
//   node scripts/verificar-calculadoras.mjs
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// dentro do projeto de propósito: o bundle ainda importa "react" e só resolve
// se o arquivo morar onde o node_modules alcança
const dir = path.resolve("node_modules/.cache/r2calc");
mkdirSync(dir, { recursive: true });
const saida = path.join(dir, "calc.mjs");
// Só interessa a matemática. React e o casco do hub viram cascas vazias — o
// bundle fica autocontido e não arrasta a árvore de componentes.
const OCOS = {
  "react": "export const useState=()=>[];export const useEffect=()=>{};export default {};",
  "react-dom": "export const createPortal=()=>null;export default {};",
  "react/jsx-runtime": "export const jsx=()=>null,jsxs=()=>null,Fragment=null;",
  "./HubV1a": "export const AMARELO='#ffe815',INK='#252425',MONO='mono',FUNDO='#f1f1f1';"
    + "export const fr=()=>({});export const EstagioV1a=()=>null,TopbarV1a=()=>null,RailV1a=()=>null,AvisoV1a=()=>null;",
};
const oco = {
  name: "oco",
  setup(b) {
    const alvo = new RegExp(`^(${Object.keys(OCOS).map((k) => k.replace(/[./]/g, "\\$&")).join("|")})$`);
    b.onResolve({ filter: alvo }, (a) => ({ path: a.path, namespace: "oco" }));
    b.onLoad({ filter: /.*/, namespace: "oco" }, (a) => ({ contents: OCOS[a.path], loader: "js" }));
  },
};
await build({
  entryPoints: ["src/components/v1a/CalculadorasV1a.tsx"],
  bundle: true, format: "esm", platform: "node", outfile: saida,
  plugins: [oco], jsx: "automatic", logLevel: "error",
});
const { calcular, gabaritoSVG, PADROES } = await import("file://" + saida.replace(/\\/g, "/"));

let falhas = 0;
const ok = (nome, cond, detalhe) => {
  console.log(`${cond ? "  ok  " : "FALHA "} ${nome}${detalhe ? " · " + detalhe : ""}`);
  if (!cond) falhas++;
};
const PASSO_PI = Math.PI;
const PARQUE = [50, 51, 52, 53, 54, 55, 59, 60, 63, 65, 70, 72, 74, 77, 78, 79, 81, 84, 86, 91, 96, 102];

/* ── facas, padrões de fábrica (X=50, Y=50, Classic 160, só produção) ── */
{
  const r = calcular("facas", PADROES.facas);
  const Z = Number(String(r.destaque.valor).replace("Z", ""));
  const dia = (Z * PASSO_PI) / Math.PI;                 // Dev/π = Z·passo/π
  const noParque = PARQUE.some((d) => Math.abs(Math.round(dia * 10) / 10 - d) < 0.5);
  ok("facas · recomenda um cilindro do parque", noParque, `Z${Z} → Ø ${dia.toFixed(2)}`);
  ok("facas · selo bate com o parque", r.selo.startsWith("★") === noParque, r.selo);

  // a perda anunciada tem de fechar com (Dev − Rep×X)/Rep
  const m = /(\d+) repetições .* perda de ([\d,]+) mm/.exec(r.dica || "");
  if (m) {
    const rep = Number(m[1]), perdaTela = Number(m[2].replace(",", "."));
    const perdaConta = (Z * PASSO_PI - rep * 50) / rep;
    ok("facas · perda confere com a conta", Math.abs(perdaTela - perdaConta) < 0.001,
      `tela ${perdaTela} · conta ${perdaConta.toFixed(3)}`);
    ok("facas · perda dentro do filtro 2,10–3,50", perdaConta >= 2.1 - 1e-9 && perdaConta <= 3.5 + 1e-9);
  } else { ok("facas · frase do resultado traz repetições e perda", false, r.dica); }

  // Total = faca + engrenagem (o único card amarelo)
  const val = (rot) => r.linhas.find((l) => l.label === rot)?.valor ?? "";
  const brl = (s) => Number(String(s).replace("R$", "").trim().replace(/\./g, "").replace(",", "."));
  const faca = brl(val("Preço da faca")), engr = brl(val("Preço da engrenagem")), tot = brl(val("Total faca + engrenagem"));
  ok("facas · total = faca + engrenagem", Math.abs(tot - (faca + engr)) < 0.011, `${faca} + ${engr} = ${tot}`);
  ok("facas · faca SAE 4140 = 17,61Z − 2,98Y − 29,32", Math.abs(faca - (17.61 * Z - 2.98 * 50 - 29.32)) < 0.011);
  ok("facas · engrenagem = Z × 1,76", Math.abs(engr - Z * 1.76) < 0.011);
  ok("facas · total é o card amarelo", r.linhas.find((l) => l.amarelo)?.label === "Total faca + engrenagem");

  // perda entre carreiras é 3 mm de fábrica, não o resto da divisão
  const carreiras = val("Carreiras (largura Y)");
  ok("facas · perda entre carreiras = 3,000 mm", /perda 3,000 mm/.test(carreiras), carreiras);
  const larg = val("Total na largura · Classic 160");
  const mm = /^([\d,]+) de 160 mm · sobra ([\d,]+)$/.exec(larg);
  if (mm) {
    const total = Number(mm[1].replace(",", ".")), sobra = Number(mm[2].replace(",", "."));
    const k = Number(/^(\d+)×/.exec(carreiras)[1]);
    ok("facas · total = k × (Y + 3)", Math.abs(total - k * (50 + 3)) < 0.001, `${k} × 53 = ${total}`);
    ok("facas · sobra = largura útil − total", Math.abs(sobra - (160 - total)) < 0.001, `${sobra} mm`);
    ok("facas · cabe na largura útil", total <= 160 + 1e-9);
    ok("facas · não caberia mais uma carreira", (k + 1) * 53 > 160);
  } else { ok("facas · linha da largura no formato esperado", false, larg); }
}

/* ── faca de gap: perda zero e altura ajustada ── */
{
  const r = calcular("facas", { ...PADROES.facas, espMin: "0", espMax: "0" });
  ok("gap · destaque vira a altura ajustada", r.destaque.label.includes("Altura ajustada"), r.destaque.valor + " mm");
  ok("gap · perda anunciada é zero exata", r.linhas.some((l) => l.valor === "0,000 mm exata"));
  ok("gap · a barra fala em folga, não em esqueleto",
    (r.visual?.partes ?? []).some((p) => p.label.startsWith("Folga")));
  const alt = Number(String(r.destaque.valor).replace(",", "."));
  const exato = (n) => Math.abs(alt * n - Math.round((alt * n) / PASSO_PI) * PASSO_PI) < 0.01;
  ok("gap · altura × repetições fecha um Z inteiro", [1, 2, 3, 4, 5, 6, 7, 8].some(exato), `${alt} mm`);
}

/* ── gabarito SVG (o desenho que vai para a gravação) ── */
{
  const r = calcular("facas", PADROES.facas);
  const g = r.gabarito;
  ok("gabarito · a calculadora de facas produz um", !!g);
  const svg = gabaritoSVG(g);
  const [, w, h] = /width="([\d.]+)mm" height="([\d.]+)mm"/.exec(svg) || [];
  ok("gabarito · sai em mm (escala 1:1)", !!w, `${w} × ${h} mm`);
  // largura = largura útil + 2 margens de 26
  ok("gabarito · largura = largura útil + margens", Math.abs(Number(w) - (160 + 52)) < 0.01);
  ok("gabarito · altura = desenvolvimento + margens + ficha", Math.abs(Number(h) - (g.dev + 52 + 40)) < 0.01);
  for (const camada of ["Facas", "Cotas", "Eixos", "Area-util", "Ficha-tecnica"]) {
    ok(`gabarito · camada ${camada}`, svg.includes(`id="${camada}"`));
  }
  const nEtq = (svg.match(/<rect[^>]*rx="2"/g) || []).length;
  ok("gabarito · uma faca por carreira × repetição", nEtq === g.rep * g.carr, `${nEtq} = ${g.rep}×${g.carr}`);
  ok("gabarito · não vaza preço para a produção", !svg.includes("R$"));
}

/* ── contas que já tinham valor conferido antes ── */
{
  const r = calcular("distorcao", { dentes: "96", modulo: "M1 (π)", chapa: "1,70 mm", arte: "" });
  const pct = r.linhas.find((l) => l.label === "Distorção do clichê")?.valor;
  ok("distorção · Z96 M1 chapa 1,70 = 3,277 %", pct === "3,277 %", String(pct));
  const R = 96 * Math.PI, K = 2 * Math.PI * (1.7 - 0.127);
  ok("distorção · destaque = R − K", Math.abs(Number(r.destaque.valor.replace(".", "").replace(",", ".")) - (R - K)) < 0.001);
}
/* ── valor do clichê contra os orçamentos da clicheria ──
   Desktop/Valor Facas/Clichê (A a H): cada orçamento traz o diâmetro, a chapa,
   a largura da chapa de cada cor e o valor de cada uma. A conta tem de dar a
   mesma altura, a mesma área e o mesmo valor, e o total é a soma das linhas
   arredondadas ao centavo, como a clicheria cobra. Onde as cores têm larguras
   diferentes (D, E, F), confere cor por cor. O D diz "1,70" no nome do
   arquivo, mas a altura (255) e o preço (0,235/cm²) só fecham com 1,14. */
{
  const casos = [
    // nome, Ø, chapa, largura, carreiras, cores, altura, área, valor por cor, total
    ["A (Ø72, 1,14, 2 cores)", "72", "1,14 mm", "125", "1", "2", "260 mm", "325,00 cm²", "R$ 76,38", "152,76"],
    ["B (Ø63, 1,70)", "63", "1,70 mm", "135", "1", "1", "230 mm", "310,50 cm²", "R$ 68,31", "68,31"],
    ["C (Ø53, 1,70)", "53", "1,70 mm", "135", "1", "1", "195 mm", "263,25 cm²", "R$ 57,92", "57,92"],
    ["D, cor de 110 (Ø70, 1,14)", "70", "1,14 mm", "110", "1", "1", "255 mm", "280,50 cm²", "R$ 65,92", "65,92"],
    ["D, cor de 115 (Ø70, 1,14)", "70", "1,14 mm", "115", "1", "1", "255 mm", "293,25 cm²", "R$ 68,91", "68,91"],
    ["E, cor de 125 (Ø41, 1,70)", "41", "1,70 mm", "125", "1", "1", "160 mm", "200,00 cm²", "R$ 44,00", "44,00"],
    ["E, cor de 120 (Ø41, 1,70)", "41", "1,70 mm", "120", "1", "1", "160 mm", "192,00 cm²", "R$ 42,24", "42,24"],
    ["F, cor de 145 (Ø65, 1,14)", "65", "1,14 mm", "145", "1", "1", "240 mm", "348,00 cm²", "R$ 81,78", "81,78"],
    ["F, cor de 115 (Ø65, 1,14)", "65", "1,14 mm", "115", "1", "1", "240 mm", "276,00 cm²", "R$ 64,86", "64,86"],
    ["F, cor de 95 (Ø65, 1,14)", "65", "1,14 mm", "95", "1", "1", "240 mm", "228,00 cm²", "R$ 53,58", "53,58"],
    ["G (Ø52, 1,14, 2 cores)", "52", "1,14 mm", "150", "1", "2", "195 mm", "292,50 cm²", "R$ 68,74", "137,48"],
    ["H (Ø52, 1,14, 4 cores)", "52", "1,14 mm", "150", "1", "4", "195 mm", "292,50 cm²", "R$ 68,74", "274,96"],
    // o PDF que a calculadora antiga gerou em 13/08/2026 (Downloads): ela
    // dizia 639,25 porque somava sem arredondar cada cor (4 × 159,81175);
    // como a clicheria cobra, são 4 × 159,81 = 639,24
    ["PDF da calculadora (Ø96, 100 mm, 2 carreiras, 4 cores)", "96", "1,14 mm", "100", "2", "4", "335 mm", "680,05 cm²", "R$ 159,81", "639,24"],
  ];
  for (const [nome, dia, chapa, largEtq, carreiras, cores, altura, area, cor, total] of casos) {
    const r = calcular("valorcliche", { ...PADROES.valorcliche, dia, chapa, largEtq, carreiras, cores, jogos: "1", prova: "0" });
    const val = (rot) => r.linhas.find((l) => l.label === rot)?.valor;
    const visto = [val("Altura da chapa"), val("Área"), val("Valor por cor"), r.destaque.valor];
    const certo = [altura, area, cor, total];
    ok(`clichê · orçamento ${nome}`, visto.every((x, i) => x === certo[i]), visto.join(" · "));
  }
}
{
  const r = calcular("substrato", PADROES.substrato);      // 6 carreiras de 38,66, camerom entre
  ok("substrato · 6 × (38,66 + 3) = 249,96 mm", r.destaque.valor === "249,96", r.destaque.valor);
}
{
  const r = calcular("bobinas", PADROES.bobinas);          // Ø500/76, esp 0,080
  const L = Math.PI * (500 * 500 - 76 * 76) / (4 * 0.08) / 1000;
  ok("bobinas · L = π(Øe²−Øi²)/4e", Math.abs(Number(r.destaque.valor.replace(/\./g, "").replace(",", ".")) - L) < 0.01, `${r.destaque.valor} m`);
}
{
  const r = calcular("caixa", { etiq: "1000", rolos: "12", caixas: "3" });
  ok("caixa · 1000 × 12 = 12.000 por caixa", r.destaque.valor === "12.000", r.destaque.valor);
  ok("caixa · 3 caixas = 36.000 no pedido", r.linhas.find((l) => l.label === "Total do pedido")?.valor === "36.000");
}

// o bundle fica em node_modules/.cache (é cache, não sujeira no projeto) para
// dar para gerar um gabarito de amostra sem recompilar
console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTudo confere.");
process.exit(falhas ? 1 : 0);
