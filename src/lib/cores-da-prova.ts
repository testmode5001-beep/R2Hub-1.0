// Cores da prova: lê a legenda "Cores" que o designer escreve na prova de arte
// (PDF) e devolve a lista pronta para o "Design criado".
//
// A fonte é a LEGENDA, não os nomes de cor especial gravados no arquivo.
// Conferido em provas reais em 29/09/2026: na Boutique da Carne o arquivo traz
// Pantone 1345 C, 355 C e 185 C e a legenda diz Ciano, Magenta, Amarelo e
// Preto; na Frios & Cia traz 220 C e a legenda diz as quatro de escala e
// Verniz. Vale o que a legenda diz.
//
// Nas provas de hoje a folha inteira é uma imagem de 300 dpi, então a legenda
// não é texto. A leitura desenha a página com o pdf.js e passa o OCR (o
// tesseract local, o mesmo de ocr-op.ts) na coluna da direita, onde o modelo
// da R2 põe a legenda.
//
// Desenhar respeita as camadas desligadas, e isso importa: o modelo novo tem
// uma camada "CMYK", escondida, com "Ciano, Magenta, Amarelo, Preto" em
// texto. Ler o texto do PDF, como na nota da clicheria, pegaria essa lista.
// Por isso o texto do PDF só confirma: quando diz a mesma cor no mesmo lugar
// em que o OCR leu, a leitura é certa.
//
// Os nomes de cor especial do arquivo também conferem: completam o "C" que a
// legenda omite ("Pantone 2314" vira "P 2314 C") e apontam o que não bate, nos
// dois sentidos. Tudo avisa, nada trava: quem confirma é o designer, e a caixa
// guarda o que estava antes para desfazer.

import { prefixoPantone, sugestoesPantone } from "../components/v1a/dados/pantone-busca";
import { OCR_LOCAL } from "./ocr-op";

export type LinhaLida = {
  texto: string;
  x0: number; y0: number; x1: number; y1: number;
  /** palavras do OCR, com onde começam e a confiança (0 a 100); o texto do
      PDF não tem */
  palavras?: { texto: string; x0: number; confianca: number }[];
};

export type LeituraDaProva =
  | {
      ok: true;
      /** na ordem da legenda, no jeito que o hub escreve ("P 2314 C") */
      cores: string[];
      /** o texto do PDF confirmou todas as linhas: a legenda era texto */
      certa: boolean;
      /** leitura que não deu para confirmar: Pantone que o arquivo não tem,
          nome fora do vocabulário, OCR com pouca confiança */
      conferir: string[];
      /** Pantones que o arquivo tem e a legenda não cita */
      foraDaLegenda: string[];
    }
  | { ok: false; motivo: "nao-e-prova" | "sem-legenda" };

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Primeira palavra da linha → nome do hub. */
const NOMES = new Map<string, string>([
  ["ciano", "Ciano"], ["cyan", "Ciano"],
  ["magenta", "Magenta"],
  ["amarelo", "Amarelo"], ["yellow", "Amarelo"],
  ["preto", "Preto"], ["black", "Preto"],
  ["branco", "Branco"], ["white", "Branco"],
  ["verniz", "Verniz"], ["varnish", "Verniz"],
  ["dourado", "Dourado"], ["gold", "Dourado"],
  ["prata", "Prata"], ["silver", "Prata"],
]);
const ESCALA = new Set(["Ciano", "Magenta", "Amarelo", "Preto"]);
const PALAVRA_DE_COR = new RegExp(`\\b(pantone|${[...NOMES.keys()].join("|")})\\b`);
const SUFIXO = /\s(C|U|CP|UP)$/i;

/** Abaixo disso a cor lida vai para "conferir". Nas 12 provas conferidas em
    29/09/2026, as palavras de cor vieram com confiança entre 84 e 96. */
const CONFIANCA_MINIMA = 75;

export type CorLida = { nome: string; livre: boolean; sufixo: boolean };

/** "2314", "2314C", "2314 c", "Reflex Blue C" → "2314", "2314 C", "Reflex Blue C" */
function codigoPantone(s: string): string {
  const t = s.replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  const numero = /^(\d{3,5})(?:\s*(cp|up|c|u)\b)?/i.exec(t);
  if (numero) return numero[2] ? `${numero[1]} ${numero[2].toUpperCase()}` : numero[1];
  return t;
}

/** Código → como o hub escreve. A legenda costuma omitir o "C"; a tabela do
    hub é a Solid Coated, e ela diz se o código existe com "C". */
function nomePantone(codigo: string): string {
  if (SUFIXO.test(codigo)) return prefixoPantone(codigo);
  const s = sugestoesPantone(codigo, 1)[0];
  if (s && s.codigo.toLowerCase() === `${codigo} c`.toLowerCase()) return s.nome;
  return prefixoPantone(codigo);
}

/**
 * Uma linha da legenda vira o nome da cor, ou null quando a linha não é cor
 * (a frase "As cores podem apresentar variação..." que fecha a legenda).
 * O OCR lê a bolinha colorida da frente como "O", "O&" ou "(>": tudo o que
 * vem antes da primeira palavra de cor cai fora.
 */
export function corDaLinha(texto: string): CorLida | null {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  const k = semAcento(t).toLowerCase();
  /* "P 185 C" (o jeito do hub) e "PMS 185": Pantone sem a palavra inteira,
     mesmo com a bolinha lida na frente ("O P 185 C") */
  const curto = /(?:^|\s)(?:p|pms)\.?\s*(\d{2,5}(?:\s*(?:cp|up|c|u)\b)?)/i.exec(t);
  if (curto) {
    const codigo = codigoPantone(curto[1]);
    return { nome: nomePantone(codigo), livre: false, sufixo: SUFIXO.test(codigo) };
  }
  const achou = k.length === t.length ? PALAVRA_DE_COR.exec(k) : null;
  if (achou) {
    const palavras = t.slice(achou.index).split(" ");
    if (achou[1] === "pantone") {
      const codigo = codigoPantone(palavras.slice(1).join(" "));
      return codigo ? { nome: nomePantone(codigo), livre: false, sufixo: SUFIXO.test(codigo) } : null;
    }
    /* pela palavra achada, não pela escrita: "Preto." com o ponto do OCR é Preto */
    const base = NOMES.get(achou[1]) ?? palavras[0];
    if (ESCALA.has(base)) return { nome: base, livre: false, sufixo: false };
    // "Verniz fosco", "Branco opaco": o complemento fica, o lixo do OCR não
    const resto = palavras.slice(1).filter((p) => /^\p{L}{2,}$/u.test(p));
    return { nome: [base, ...resto].join(" "), livre: false, sufixo: false };
  }
  // Fora do vocabulário, nome curto entra para conferir; frase não entra.
  if (/\b(cores|podem|apresentar|variacao|tonalidade)\b/.test(k)) return null;
  const palavras = t.split(" ").filter((p) => /\p{L}{2,}/u.test(p));
  if (!palavras.length || palavras.length > 3) return null;
  return { nome: palavras.join(" "), livre: true, sufixo: false };
}

/** O título "Cores" (ou "Cor"). Letra solta ao lado é a bolinha ou sujeira. */
const palavraDeTitulo = (p: string) => /^cor(es)?[:.]?$/i.test(semAcento(p));
function ehTitulo(texto: string): boolean {
  const palavras = texto.split(/\s+/).filter((p) => /\p{L}{2,}/u.test(p));
  return palavras.length === 1 && palavraDeTitulo(palavras[0]);
}

/** Onde a linha começa de verdade. O OCR às vezes gruda na frente pedaços do
    que está ao lado (as cotas da arte), e a caixa da linha estica até lá; a
    palavra de cor (ou o título) é que diz a coluna. */
function inicio(l: LinhaLida): number {
  const p = l.palavras?.find((w) => {
    const k = semAcento(w.texto).toLowerCase();
    return PALAVRA_DE_COR.test(k) || palavraDeTitulo(w.texto);
  });
  return p ? p.x0 : l.x0;
}

/** As linhas da legenda: as que vêm logo abaixo do título "Cores", na mesma
    coluna, até a primeira que não é cor. */
export function legendaDasLinhas(linhas: LinhaLida[]): LinhaLida[] {
  const ordem = [...linhas].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  const iTitulo = ordem.findIndex((l) => ehTitulo(l.texto));
  if (iTitulo < 0) return [];
  const titulo = ordem[iTitulo];
  const x = inicio(titulo);
  const h = Math.max(8, titulo.y1 - titulo.y0);
  const itens: LinhaLida[] = [];
  let fundo = titulo.y1;
  for (const l of ordem.slice(iTitulo + 1)) {
    if (l.y0 < titulo.y1 - h / 2) continue;                    // na altura do título
    const xl = inicio(l);
    if (xl < x - 2 * h || xl > x + 3 * h) continue;            // outra coluna
    if (l.y0 - fundo > 3 * h) break;                           // buraco: acabou
    if (!corDaLinha(l.texto)) {
      if (!/\p{L}{2,}/u.test(l.texto)) continue;              // só a bolinha, lida à parte
      break;                                                   // a frase do fim
    }
    itens.push(l);
    fundo = l.y1;
  }
  return itens;
}

/** Marcas do modelo de prova da R2 na coluna da direita. Sem legenda e sem
    elas, o PDF não é prova (arte final, faca) e a tela não diz nada. */
const eDoModelo = (l: LinhaLida) =>
  ehTitulo(l.texto) || /cores podem apresentar|etiquetas no rolo/.test(semAcento(l.texto).toLowerCase());

/** Duas grafias da mesma cor ("Pantone 2314", "P 2314 C", "PANTONE 2314 C"). */
function chaveCor(nome: string): string {
  const k = semAcento(nome).toLowerCase().trim();
  const p = /^(?:pantone|p)\s+(.+)$/.exec(k);
  if (p) return "p:" + p[1].replace(/\s+(cp|up|c|u)$/, "").replace(/[^a-z0-9]/g, "");
  return k.replace(/[^a-z0-9]/g, "");
}

/** Confiança do OCR só nas palavras da cor: a bolinha lida como "O&" não conta. */
function confiancaDaCor(l: LinhaLida): number {
  if (!l.palavras?.length) return 100;
  const i = l.palavras.findIndex((p) => PALAVRA_DE_COR.test(semAcento(p.texto).toLowerCase()));
  const daCor = (i < 0 ? l.palavras.filter((p) => /\p{L}{2,}/u.test(p.texto)) : l.palavras.slice(i));
  return daCor.length ? Math.min(...daCor.map((p) => p.confianca)) : 0;
}

/** O texto do PDF que diz a mesma cor no mesmo lugar em que o OCR leu. Texto
    em camada escondida pode estar ali, mas só confirma se disser a mesma cor. */
function confirmadaPeloTexto(l: LinhaLida, cor: CorLida, texto: LinhaLida[]): CorLida | null {
  const h = l.y1 - l.y0;
  for (const t of texto) {
    if (t.y1 < l.y0 || t.y1 > l.y1 + h / 4) continue;
    if (t.x1 < l.x0 - h || t.x0 > l.x1 + h) continue;
    const c = corDaLinha(t.texto);
    if (c && chaveCor(c.nome) === chaveCor(cor.nome)) return c;
  }
  return null;
}

/** Separação do arquivo ("PANTONE 2314 C") → como o hub escreve ("P 2314 C"). */
const nomeDaSeparacao = (s: string) => prefixoPantone(s.replace(/^pantone\s*/i, "").trim());

/** "A, B e C", para os avisos. */
export const juntarCores = (xs: string[]) =>
  xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;

/** Leitura pura: linhas do OCR, linhas do texto do PDF e separações do arquivo. */
export function interpretarLeitura(linhasOcr: LinhaLida[], linhasTexto: LinhaLida[], separacoes: string[]): LeituraDaProva {
  const legenda = legendaDasLinhas(linhasOcr);
  if (!legenda.length) return { ok: false, motivo: linhasOcr.some(eDoModelo) ? "sem-legenda" : "nao-e-prova" };

  const doArquivo: { nome: string; chave: string }[] = [];
  for (const s of separacoes) {
    if (!/^pantone\s/i.test(s)) continue;
    const chave = chaveCor(s);
    if (!doArquivo.some((d) => d.chave === chave)) doArquivo.push({ nome: nomeDaSeparacao(s), chave });
  }

  const usados = new Set<string>();
  const cores: string[] = [];
  const conferir: string[] = [];
  let certa = true;
  for (const l of legenda) {
    const lida = corDaLinha(l.texto);
    if (!lida) continue;
    const doTexto = confirmadaPeloTexto(l, lida, linhasTexto);
    if (!doTexto) certa = false;
    const cor = doTexto ?? lida;
    let nome = cor.nome;
    let segura = !!doTexto || confiancaDaCor(l) >= CONFIANCA_MINIMA;
    if (chaveCor(nome).startsWith("p:")) {
      const sep = doArquivo.find((d) => d.chave === chaveCor(nome));
      if (sep) {
        usados.add(sep.chave);
        if (!cor.sufixo) nome = sep.nome;
        segura = true;
      } else {
        segura = false;
      }
    }
    if (cor.livre || !segura) conferir.push(nome);
    if (!cores.includes(nome)) cores.push(nome);
  }
  return {
    ok: true,
    cores,
    certa,
    conferir: [...new Set(conferir)],
    foraDaLegenda: doArquivo.filter((d) => !usados.has(d.chave)).map((d) => d.nome),
  };
}

/* ————— arquivo ————— */

/** Nomes de cor especial declarados no arquivo (/Separation e /DeviceN). */
export function separacoesDoPdf(textos: string[]): string[] {
  const dec = (s: string) => s.replace(/#([0-9A-Fa-f]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  const nomes: string[] = [];
  const guardar = (n: string) => { const d = dec(n); if (!nomes.includes(d)) nomes.push(d); };
  for (const t of textos) {
    for (const m of t.matchAll(/\/Separation\s*\/([^\s/[\]<>()%]+)/g)) guardar(m[1]);
    for (const m of t.matchAll(/\/DeviceN\s*\[([^\]]*)\]/g)) {
      for (const n of m[1].matchAll(/\/([^\s/[\]<>()%]+)/g)) guardar(n[1]);
    }
  }
  return nomes;
}

async function inflar(dados: Uint8Array): Promise<string> {
  const fluxo = new Blob([dados.slice()]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new TextDecoder("latin1").decode(await new Response(fluxo).arrayBuffer());
}

/** O PDF como texto, mais os object streams abertos (PDF 1.5 em diante guarda
    objetos comprimidos). As provas do Illustrator de hoje não usam, mas outro
    exportador pode usar. */
export async function textosDoPdf(bytes: Uint8Array): Promise<string[]> {
  const bruto = new TextDecoder("latin1").decode(bytes);
  const textos = [bruto];
  let de = 0;
  for (let n = 0; n < 500; n++) {
    const p = bruto.indexOf("/ObjStm", de);
    if (p < 0) break;
    de = p + 7;
    const ini = bruto.indexOf("stream", p);
    if (ini < 0) break;
    /* o (?!\d) impede que "/Length 1234 0 R" (referência) vire o número 123 */
    const tam = /\/Length\s+(\d+)(?!\d)(?!\s+\d+\s+R)/.exec(bruto.slice(Math.max(0, bruto.lastIndexOf("obj", p)), ini));
    let corpo = ini + 6;
    if (bruto[corpo] === "\r") corpo++;
    if (bruto[corpo] === "\n") corpo++;
    let fim = tam ? corpo + Number(tam[1]) : bruto.indexOf("endstream", corpo);
    /* sem o tamanho, o fim de linha antes de "endstream" não é do stream: o
       DecompressionStream recusa dado sobrando */
    if (!tam) while (fim > corpo && (bruto[fim - 1] === "\n" || bruto[fim - 1] === "\r")) fim--;
    if (fim <= corpo) continue;
    try {
      textos.push(await inflar(bytes.subarray(corpo, fim)));
    } catch {
      // Stream que não abre fica de fora: ele só serviria para conferir os
      // Pantones, e a legenda continua sendo lida.
    }
  }
  return textos;
}

/* ————— navegador ————— */

/** A prova da R2 é A4 em pé. Arte final e faca vêm no tamanho da etiqueta. */
const ehA4EmPe = (w: number, h: number) => Math.abs(w - 595.3) < 12 && Math.abs(h - 841.9) < 17;
/** A legenda fica na coluna da direita do modelo (começa em 74% da largura);
    o OCR lê só os 30% da direita. Cortar antes disso pegava as cotas da arte,
    que vão até 66%. */
export const COLUNA_DA_LEGENDA = 0.3;
/** .ai de centenas de MB travaria a aba; prova tem poucos MB. */
const LIMITE_BYTES = 80 * 1024 * 1024;

type Caixa = { x0: number; y0: number; x1: number; y1: number };
type ResultadoOcr = {
  blocks?: { paragraphs: { lines: { text: string; bbox: Caixa; words: { text: string; bbox: Caixa; confidence: number }[] }[] }[] }[] | null;
};

/** Resultado do tesseract em linhas. Exportada para conferir fora do navegador. */
export function linhasDoResultadoOcr(r: ResultadoOcr): LinhaLida[] {
  const linhas: LinhaLida[] = [];
  for (const b of r.blocks ?? []) {
    for (const p of b.paragraphs) {
      for (const l of p.lines) {
        linhas.push({
          texto: l.text.trim(),
          x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1,
          palavras: l.words.map((w) => ({ texto: w.text, x0: w.bbox.x0, confianca: w.confidence })),
        });
      }
    }
  }
  return linhas;
}

async function linhasDoOcr(tela: HTMLCanvasElement, aoProgresso?: (pct: number) => void): Promise<LinhaLida[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por", 1, {
    ...OCR_LOCAL,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") aoProgresso?.(Math.round(m.progress * 100));
    },
  });
  try {
    const r = await worker.recognize(tela, {}, { blocks: true });
    return linhasDoResultadoOcr(r.data);
  } finally {
    await worker.terminate();
  }
}

/** Texto do PDF em linhas, na régua do desenho (px a 300 dpi, a partir da
    coluna). Exportada para conferir fora do navegador. */
export function linhasDoTextoDoPdf(
  itens: unknown[],
  vp: { scale: number; convertToViewportPoint(x: number, y: number): number[] },
  x0: number,
): LinhaLida[] {
  const pedacos: { s: string; x: number; y: number; w: number; h: number }[] = [];
  for (const item of itens) {
    const t = item as { str?: string; transform?: number[]; width?: number };
    if (!t.str?.trim() || !t.transform) continue;
    const [x, y] = vp.convertToViewportPoint(t.transform[4], t.transform[5]);
    const alto = Math.hypot(t.transform[2], t.transform[3]) * vp.scale;
    pedacos.push({ s: t.str, x: x - x0, y, w: (t.width ?? 0) * vp.scale, h: alto });
  }
  pedacos.sort((a, b) => a.y - b.y || a.x - b.x);
  const linhas: LinhaLida[] = [];
  for (const p of pedacos) {
    const ult = linhas[linhas.length - 1];
    if (ult && Math.abs(ult.y1 - p.y) < p.h / 3) {
      ult.texto += " " + p.s;
      ult.x0 = Math.min(ult.x0, p.x);
      ult.x1 = Math.max(ult.x1, p.x + p.w);
    } else {
      linhas.push({ texto: p.s, x0: p.x, y0: p.y - p.h, x1: p.x + p.w, y1: p.y });
    }
  }
  return linhas;
}

/**
 * Lê as cores da prova. "nao-e-prova" é silencioso (arte final, faca, CDR);
 * "sem-legenda" é uma prova em que a legenda não apareceu, e a tela avisa.
 */
export async function lerCoresDaProva(arquivo: Blob, aoProgresso?: (pct: number) => void): Promise<LeituraDaProva> {
  if (arquivo.size > LIMITE_BYTES) return { ok: false, motivo: "nao-e-prova" };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  // PDF, ou .ai salvo com o PDF junto: os dois começam com %PDF
  if (!new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-")) {
    return { ok: false, motivo: "nao-e-prova" };
  }
  // antes do pdf.js, que transfere o buffer para o worker dele
  const separacoes = separacoesDoPdf(await textosDoPdf(bytes));

  const { libPdfJs } = await import("./pdf-preview");
  const pdfjs = await libPdfJs();
  const tarefa = pdfjs.getDocument({ data: bytes });
  try {
    /* dentro do try: PDF com senha ou quebrado também solta o worker */
    const doc = await tarefa.promise;
    const pagina = await doc.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    if (!ehA4EmPe(base.width, base.height)) return { ok: false, motivo: "nao-e-prova" };

    const vp = pagina.getViewport({ scale: 300 / 72 });
    const x0 = Math.floor(vp.width * (1 - COLUNA_DA_LEGENDA));
    const tela = document.createElement("canvas");
    tela.width = Math.ceil(vp.width) - x0;
    tela.height = Math.ceil(vp.height);
    const g = tela.getContext("2d");
    if (!g) throw new Error("Sem canvas para desenhar a prova.");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, tela.width, tela.height);
    await pagina.render({ canvas: tela, canvasContext: g, viewport: vp, transform: [1, 0, 0, 1, -x0, 0] }).promise;

    const linhasOcr = await linhasDoOcr(tela, aoProgresso);
    const conteudo = await pagina.getTextContent();
    return interpretarLeitura(linhasOcr, linhasDoTextoDoPdf(conteudo.items, vp, x0), separacoes);
  } finally {
    // a imagem da prova tem dezenas de MB depois de aberta: solta tudo
    void tarefa.destroy();
  }
}
