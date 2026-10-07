// Lê a ordem de serviço que a clicheria manda em PDF e devolve as linhas de
// cobrança prontas para o "Clichê chegou".
//
// Digitar cor por cor e valor por valor é o trecho mais chato — e mais fácil de
// errar — do registro de chegada. A nota já traz tudo: cores, quantidade,
// valor de cada clichê e o total. Aqui a gente só transcreve.
//
// A leitura é guiada por RÓTULOS ("Cobrança", "Produto", "Valor total"), não por
// coordenadas fixas: se a clicheria mexer no layout, o mesmo código continua
// achando a tabela. O que não dá para adivinhar, a tela pede à mão.
//
// A leitura do PDF (pdf.js) entra por import dinâmico: assim a interpretação da
// nota é código puro, que roda e se confere fora do navegador.

export type ItemNota = { descricao: string; valor: number };

export type NotaCliche = {
  /** Número da ordem de serviço impresso no topo ("230024-1 / 518565-1"). */
  os: string;
  /** Título do trabalho — normalmente o nome do cliente final. */
  titulo: string;
  /** Razão social no campo "Cliente" (quem a clicheria fatura: nós). */
  cliente: string;
  /** "Data de despacho" em ISO (aaaa-mm-dd); vazio quando não vier na nota. */
  despacho: string;
  /** Uma linha por clichê, já com o nome de cor no vocabulário do hub. */
  itens: ItemNota[];
  /** "Valor total" impresso — serve de conferência contra a soma das linhas. */
  total: number | null;
  /** Cores da tabela "Medidas", como estão escritas na nota. */
  cores: string[];
};

type Seg = { x: number; s: string };
export type Linha = { segs: Seg[]; texto: string };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (s: string) =>
  semAcento(String(s || "")).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Dinheiro da nota. A clicheria imprime "R$74.91" (ponto decimal), mas nota
 * emitida por outro sistema pode vir "R$ 1.234,56" — o separador decimal é
 * sempre o ÚLTIMO sinal que aparece, e ponto/vírgula com 3 dígitos atrás é
 * milhar. Sem isso "1.500" viraria um e meio.
 */
export function valorDaNota(txt: string): number | null {
  const bruto = String(txt || "").replace(/r\$/i, "").replace(/\s/g, "");
  const achado = bruto.match(/-?[\d.,]+/);
  if (!achado) return null;
  let n = achado[0];
  const v = n.lastIndexOf(","), p = n.lastIndexOf(".");
  if (v > -1 && p > -1) n = v > p ? n.replace(/\./g, "").replace(",", ".") : n.replace(/,/g, "");
  else if (v > -1) n = /,\d{1,2}$/.test(n) ? n.replace(",", ".") : n.replace(/,/g, "");
  else if (p > -1 && !/\.\d{1,2}$/.test(n)) n = n.replace(/\./g, "");
  const num = Number(n);
  return Number.isFinite(num) ? num : null;
}

/** dd/mm/aaaa → aaaa-mm-dd (o que o <input type="date"> entende). */
function dataISO(txt: string): string {
  const m = String(txt || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** Nomes de cor no vocabulário do hub — a nota vem em inglês em algumas linhas. */
const APELIDOS = new Map<string, string>([
  ["black", "Preto"], ["preto", "Preto"], ["k", "Preto"],
  ["cyan", "Ciano"], ["ciano", "Ciano"],
  ["magenta", "Magenta"],
  ["yellow", "Amarelo"], ["amarelo", "Amarelo"],
  ["white", "Branco"], ["branco", "Branco"],
  ["gold", "Dourado"], ["dourado", "Dourado"],
]);

export function nomeDeCorDaNota(s: string): string {
  const bruto = String(s || "").trim().replace(/\s+/g, " ");
  const k = chave(bruto);
  const apelido = APELIDOS.get(k);
  if (apelido) return apelido;
  const pant = bruto.match(/^pantone\s+(.+)$/i);
  if (pant) return "Pantone " + pant[1].trim();
  return bruto;
}

/** Coluna de cada pedaço de texto: a última cuja borda esquerda cabe antes dele. */
function coluna(x: number, bordas: number[]): number {
  let idx = 0;
  for (let i = 0; i < bordas.length; i++) if (x + 12 >= bordas[i]) idx = i;
  return idx;
}

function celulas(linha: Linha, bordas: number[]): string[] {
  const out = bordas.map(() => "");
  for (const seg of linha.segs) {
    const i = coluna(seg.x, bordas);
    out[i] = (out[i] ? out[i] + " " : "") + seg.s.trim();
  }
  return out.map((c) => c.trim());
}

/** Índice da coluna cujo cabeçalho começa com uma das palavras dadas. */
function acharColuna(cabecalho: string[], ...palavras: string[]): number {
  return cabecalho.findIndex((c) => palavras.some((p) => chave(c).startsWith(p)));
}

/** Linha (índice) cujo texto contém todos os termos. */
function acharLinha(linhas: Linha[], de: number, ...termos: string[]): number {
  for (let i = de; i < linhas.length; i++) {
    const k = chave(linhas[i].texto);
    if (termos.every((t) => k.includes(t))) return i;
  }
  return -1;
}

/** Uma tabela: cabeçalho + as linhas até o "Total" (ou até o fim da seção). */
function tabela(linhas: Linha[], iCab: number): { cab: string[]; bordas: number[]; linhas: string[][] } {
  const bordas = linhas[iCab].segs.map((s) => s.x).sort((a, b) => a - b);
  const cab = celulas(linhas[iCab], bordas);
  const corpo: string[][] = [];
  for (let i = iCab + 1; i < linhas.length; i++) {
    const k = chave(linhas[i].texto);
    if (k.startsWith("total") || k.startsWith("valor total")) break;
    // cabeçalho da próxima seção: linha com uma célula só, alinhada à esquerda
    if (linhas[i].segs.length === 1 && linhas[i].segs[0].x < bordas[0] + 4 && corpo.length) break;
    corpo.push(celulas(linhas[i], bordas));
  }
  return { cab, bordas, linhas: corpo };
}

/* ————— cobrança ————— */

type LinhaCobranca = { produto: string; descricao: string; qtd: number; valor: number };

function lerCobranca(linhas: Linha[]): { itens: LinhaCobranca[]; total: number | null } {
  const iSecao = acharLinha(linhas, 0, "cobranca");
  const iCab = acharLinha(linhas, iSecao < 0 ? 0 : iSecao, "produto", "valor");
  if (iCab < 0) return { itens: [], total: null };

  const t = tabela(linhas, iCab);
  const cProduto = acharColuna(t.cab, "produto");
  const cDesc = acharColuna(t.cab, "descric", "descri");
  const cQtd = acharColuna(t.cab, "quantidade", "qtd");
  const cValor = acharColuna(t.cab, "valor", "preco");
  if (cValor < 0) return { itens: [], total: null };

  const itens: LinhaCobranca[] = [];
  for (const c of t.linhas) {
    const valor = valorDaNota(c[cValor] ?? "");
    if (valor === null) continue;
    const qtd = Math.min(Math.max(parseInt(c[cQtd] ?? "1", 10) || 1, 1), 40);
    itens.push({
      produto: cProduto >= 0 ? c[cProduto] ?? "" : "",
      descricao: cDesc >= 0 ? c[cDesc] ?? "" : "",
      qtd,
      valor,
    });
  }

  // "Valor total" fica logo abaixo da tabela, às vezes na linha seguinte.
  let total: number | null = null;
  const iTotal = acharLinha(linhas, iCab, "valor total");
  if (iTotal > -1) {
    total = valorDaNota(linhas[iTotal].texto.replace(/valor\s*total/i, ""));
    if (total === null && linhas[iTotal + 1]) total = valorDaNota(linhas[iTotal + 1].texto);
  }
  return { itens, total };
}

/**
 * Cobrança → uma linha por clichê.
 *
 * Duas decisões que a nota não diz explicitamente:
 * - **Quantidade > 1 vira N linhas.** No hub cada linha é um clichê, e é assim
 *   que o pódio e o gasto do mês contam. Se o "Valor" da nota é unitário ou o
 *   total da linha, a gente descobre conferindo qual das duas somas fecha com o
 *   "Valor total" impresso.
 * - **Prova/serviço zerado não entra.** Seria um clichê a mais na contagem sem
 *   ser um clichê. Zerado só entra se a própria nota chamar de clichê (refação,
 *   cortesia) — aí é clichê de verdade, só não custou nada.
 */
function itensDoRegistro(cobranca: LinhaCobranca[], total: number | null): ItemNota[] {
  const ehCliche = (l: LinhaCobranca) => chave(l.produto).includes("cliche");
  const usar = cobranca.filter((l) => l.valor > 0 || ehCliche(l));

  const temMultiplo = usar.some((l) => l.qtd > 1);
  const somaDireta = usar.reduce((s, l) => s + l.valor, 0);
  const somaPorQtd = usar.reduce((s, l) => s + l.valor * l.qtd, 0);
  const perto = (a: number, b: number) => Math.abs(a - b) < 0.02;
  const unitario =
    temMultiplo && total !== null && perto(somaPorQtd, total) && !perto(somaDireta, total);

  const itens: ItemNota[] = [];
  for (const l of usar) {
    const nome = ehCliche(l) ? nomeDeCorDaNota(l.descricao || l.produto) : rotuloServico(l);
    const totalLinha = unitario ? l.valor * l.qtd : l.valor;
    let resto = Math.round(totalLinha * 100);
    for (let i = 0; i < l.qtd; i++) {
      // o arredondamento sobra na última linha: a soma bate com a nota ao centavo
      const cent = i === l.qtd - 1 ? resto : Math.round(totalLinha * 100 / l.qtd);
      resto -= cent;
      itens.push({ descricao: nome, valor: cent / 100 });
    }
  }
  return itens;
}

/** Serviço que não é clichê (prova, arte, frete): mantém o tipo visível na linha. */
function rotuloServico(l: LinhaCobranca): string {
  const desc = String(l.descricao || "").trim();
  const prod = String(l.produto || "").trim();
  if (!desc) return prod;
  if (!prod || chave(desc).includes(chave(prod))) return desc;
  return `${prod}: ${desc}`;
}

/* ————— nota inteira ————— */

export function interpretarNota(linhas: Linha[]): NotaCliche {
  const { itens: cobranca, total } = lerCobranca(linhas);

  // Cores da tabela "Medidas" — conferência, e salvação quando a cobrança falha.
  const cores: string[] = [];
  const iMed = acharLinha(linhas, 0, "cor", "altura", "largura");
  if (iMed > -1) {
    const t = tabela(linhas, iMed);
    const cCor = acharColuna(t.cab, "cor");
    for (const c of t.linhas) {
      const nome = (cCor >= 0 ? c[cCor] : c[0]) ?? "";
      if (nome && chave(nome) !== "total") cores.push(nome);
    }
  }

  const iOs = acharLinha(linhas, 0, "ordem de servico");
  const os = iOs > -1 ? linhas[iOs].texto.replace(/.*ordem de servi(ç|c)o\s*/i, "").trim() : "";
  const titulo = iOs > -1 && linhas[iOs + 1] ? linhas[iOs + 1].texto.trim() : "";

  const iCli = acharLinha(linhas, 0, "cliente");
  const cliente = iCli > -1 && linhas[iCli + 1] ? linhas[iCli + 1].texto.trim() : "";

  let despacho = "";
  const iDesp = acharLinha(linhas, 0, "data de despacho");
  if (iDesp > -1) {
    const xRotulo = linhas[iDesp].segs.find((s) => chave(s.s).startsWith("data de despacho"))?.x ?? 0;
    for (let i = iDesp + 1; i < Math.min(iDesp + 4, linhas.length) && !despacho; i++) {
      const naColuna = linhas[i].segs.find((s) => Math.abs(s.x - xRotulo) < 24 && dataISO(s.s));
      despacho = dataISO(naColuna ? naColuna.s : linhas[i].texto);
    }
  }

  const itens = cobranca.length
    ? itensDoRegistro(cobranca, total)
    : cores.map((c) => ({ descricao: nomeDeCorDaNota(c), valor: 0 }));

  return { os, titulo, cliente, despacho, itens, total, cores };
}

/**
 * Sinaliza nota de OUTRO pedido — o engano fácil de cometer com a pasta de
 * downloads cheia de ordens de serviço parecidas.
 *
 * Confere o título do trabalho contra o cliente do pedido por palavra inteira,
 * ignorando termos genéricos do ramo ("etiqueta", "selo", "industria"...) que
 * casariam com qualquer nota. Só avisa; nunca impede — nome de trabalho na
 * clicheria e nome de cliente no hub não são obrigados a ser iguais.
 */
const GENERICOS = new Set([
  "etiqueta", "etiquetas", "rotulo", "rotulos", "selo", "selos", "adesivo", "adesivos",
  "industria", "comercio", "servicos", "ltda", "me", "epp", "eireli", "distribuidora",
  "alimentos", "produtos", "brasil", "novo", "nova", "cliche", "cliches",
]);

export function pareceOutroCliente(nota: NotaCliche, clienteDoPedido?: string): boolean {
  const alvo = chave(clienteDoPedido ?? "");
  const naNota = ` ${chave(nota.titulo + " " + nota.cliente)} `;
  if (!alvo || !naNota.trim()) return false;
  const palavras = alvo.split(" ").filter((p) => p.length >= 4 && !GENERICOS.has(p));
  if (!palavras.length) return false;
  return !palavras.some((p) => naNota.includes(` ${p} `));
}

/* ————— PDF → linhas ————— */

/** Itens de texto viram linhas: mesma altura (±2,5pt) é a mesma linha. */
export function agruparEmLinhas(itens: { s: string; x: number; y: number }[]): Linha[] {
  const ordenados = itens.filter((i) => i.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: Linha[] = [];
  let atualY = Infinity;
  let atual: Seg[] = [];
  const fechar = () => {
    if (!atual.length) return;
    const segs = atual.sort((a, b) => a.x - b.x);
    linhas.push({ segs, texto: segs.map((s) => s.s.trim()).join(" ").replace(/\s+/g, " ") });
    atual = [];
  };
  for (const it of ordenados) {
    if (Math.abs(it.y - atualY) > 2.5) { fechar(); atualY = it.y; }
    atual.push({ x: it.x, s: it.s });
  }
  fechar();
  return linhas;
}

/**
 * Lê o PDF da nota. Erra alto e claro: nota escaneada (sem camada de texto) e
 * PDF que não é nota são coisas diferentes, e a tela avisa cada uma.
 */
export async function lerNotaClichePdf(arquivo: Blob): Promise<NotaCliche> {
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const { libPdfJs } = await import("./pdf-preview");
  const pdfjs = await libPdfJs();
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  try {
    const brutos: { s: string; x: number; y: number }[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pagina = await doc.getPage(p);
      const conteudo = await pagina.getTextContent();
      const alturaPagina = pagina.getViewport({ scale: 1 }).height;
      for (const item of conteudo.items) {
        const t = item as { str?: string; transform?: number[] };
        if (!t.str || !t.transform) continue;
        // páginas seguintes entram embaixo das anteriores, na mesma régua;
        // a folga extra impede que a última linha de uma cole na primeira da outra
        brutos.push({ s: t.str, x: t.transform[4], y: t.transform[5] - (p - 1) * (alturaPagina + 100) });
      }
    }
    if (!brutos.some((b) => b.s.trim())) {
      throw new Error("Este PDF não tem texto: parece uma nota escaneada. Preencha à mão.");
    }
    const nota = interpretarNota(agruparEmLinhas(brutos));
    if (!nota.itens.length) {
      throw new Error("Não achei a tabela de cobrança neste PDF. Confira se é a ordem de serviço da clicheria.");
    }
    return nota;
  } finally {
    void doc.cleanup();
  }
}
