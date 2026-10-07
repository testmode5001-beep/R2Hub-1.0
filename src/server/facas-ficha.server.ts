// A ficha técnica ESCRITA no desenho da faca.
//
// O PDF de cada faca traz, num quadro ao lado do desenho, os dados que o hub
// vinha deduzindo: carreiras, repetições, diâmetro, engrenagem (o Z), máquina
// e espaçamentos. Deduzir o que está escrito é errado — então aqui lemos.
//
// A pegadinha: em boa parte do acervo esse texto foi CONVERTIDO EM CURVAS na
// exportação, e aí não existe texto nenhum para extrair, só vetor. Nesses o
// hub continua calculando, e a tela diz que o número é estimado. Onde o texto
// sobreviveu, o que aparece na tela é o que está no desenho.
//
// pdf.js roda aqui na compilação `legacy`, que não depende de DOM.
import { readFileSync } from "node:fs";
import path from "node:path";

import { facasPdfDir } from "./facas-pdf.server";

export type FichaDoDesenho = {
  medida: string | null;
  carreiras: string | null;
  repeticoes: string | null;
  diametro: string | null;
  /** "Engrenagem: 51 Dentes" — é o Z do cilindro, escrito pelo desenhista. */
  dentes: number | null;
  maquina: string | null;
  espacamentoH: string | null;
  espacamentoV: string | null;
  /** "Substrato: BOPP" ou "Material: …" — o desenho usa os dois rótulos. */
  substrato: string | null;
  corteFio: string | null;
  /** "Corte Total", "Micro Serrilha", "Temperada: Sim"… */
  observacoes: string[];
};

const VAZIA: FichaDoDesenho = {
  medida: null, carreiras: null, repeticoes: null, diametro: null,
  dentes: null, maquina: null, espacamentoH: null, espacamentoV: null,
  substrato: null, corteFio: null, observacoes: [],
};

/* O rodapé do desenho é o endereço da fábrica e o slogan — não são dados da
   faca, e sem tirar eles a lista de observações vira propaganda. */
const LIXO = /GUAB[ÁA]|CEP:|TELEFONE|WWW\.|QUALIDADE|MERECE|VOC[ÊE]|O que voc[êe] procura|^com a$/i;

/** "Carreiras: 01" → "01". Aceita o rótulo com ou sem acento e com espaço solto. */
function valor(itens: string[], rotulo: RegExp): string | null {
  for (const s of itens) {
    const m = rotulo.exec(s);
    if (m && m[1]?.trim()) return m[1].trim();
  }
  return null;
}

let pdfjs: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;
async function lib() {
  if (!pdfjs) pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs;
}

/* Desenho lido é desenho lido: o arquivo no share só muda quando alguém o
   redesenha, e aí o hub reinicia mais cedo ou mais tarde. Guardar evita
   reabrir um PDF de 700KB a cada vez que a ficha aparece na tela. */
const cache = new Map<string, FichaDoDesenho>();

const NOME_OK = /^[A-Za-z0-9._ -]+\.pdf$/i;
/* Nome reservado do Windows (CON, PRN, AUX, NUL, COM1..9, LPT1..9), mesmo com
   extensão, aponta para um dispositivo em disco local: "CON.pdf" leria o
   console e prenderia o servidor. Nenhum desenho do acervo tem esse nome. */
const RESERVADO = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
const nomeOk = (arquivo: string) => NOME_OK.test(arquivo) && !RESERVADO.test(arquivo);

export async function lerFichaDoDesenho(arquivo: string): Promise<FichaDoDesenho> {
  if (!nomeOk(arquivo)) return VAZIA;
  const guardada = cache.get(arquivo);
  if (guardada) return guardada;

  let itens: string[];
  try {
    const dados = new Uint8Array(readFileSync(path.join(facasPdfDir(), arquivo)));
    const { getDocument } = await lib();
    const doc = await getDocument({ data: dados }).promise;
    const conteudo = await (await doc.getPage(1)).getTextContent();
    itens = conteudo.items
      .map((i) => ("str" in i ? String(i.str) : ""))
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  } catch {
    cache.set(arquivo, VAZIA);   // ilegível ou fora do ar: não insiste a cada abertura
    return VAZIA;
  }

  const dentesTxt = valor(itens, /engrenagem:\s*(.+)/i);
  const ficha: FichaDoDesenho = {
    medida: valor(itens, /medida:\s*(.+)/i),
    carreiras: valor(itens, /carreiras:\s*(.+)/i),
    repeticoes: valor(itens, /repeti[çc][õo]es:\s*(.+)/i),
    diametro: valor(itens, /di[âa]metro:\s*(.+)/i),
    dentes: dentesTxt ? Number(/(\d+)/.exec(dentesTxt)?.[1] ?? NaN) || null : null,
    maquina: valor(itens, /m[áa]quina:\s*(.+)/i),
    espacamentoH: valor(itens, /espa[çc]amento horizontal:\s*(.+)/i),
    espacamentoV: valor(itens, /espa[çc]amento vertical:\s*(.+)/i),
    /* o desenho usa "Substrato:" em uns e "Material:" em outros */
    substrato: valor(itens, /(?:substrato|material):\s*(.+)/i),
    corteFio: valor(itens, /corte\/fio:\s*(.+)/i),
    observacoes: itens.filter((s) => !s.includes(":") && !LIXO.test(s) && s.length > 3 && s.length < 60),
  };
  cache.set(arquivo, ficha);
  return ficha;
}
