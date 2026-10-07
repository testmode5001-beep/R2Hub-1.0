// Catálogo de facas lido da RELAÇÃO DE FERRAMENTAIS — as páginas que a equipe
// mantém em \\server\Arte\Clientes\Relação de Ferramentais.
//
// Por que ler daqui: o catálogo do hub era um retrato tirado uma vez dessas
// páginas (294 facas fixas no código). Elas continuam sendo editadas — a
// facas-especiais.html mudou em 20/07/2026 — e o retrato foi ficando velho:
// 5 facas listadas lá não apareciam no hub. Lendo a fonte, medida, sistema e
// seção passam a vir sempre do que a equipe mantém.
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { facasPdfDir } from "./facas-pdf.server";

/** As páginas ficam UM nível acima da pasta dos PDFs (…\Relação de Ferramentais\facas). */
function relacaoDir(): string {
  return path.dirname(facasPdfDir());
}

/** Cada página é um sistema de faca. */
const PAGINAS: Record<string, string> = {
  "facas-figura.html": "Figura",
  "facas-picote.html": "Picote",
  "facas-gap.html": "Gap",
  "facas-tag.html": "Tag",
  "facas-redonda.html": "Redonda",
  "facas-etiquetadoras.html": "Etiquetadoras",
  "facas-cortesevincos.html": "Cortes e vincos",
  "facas-especiais.html": "Especiais",
};

/** id da <section> na página → nome da seção como a tela mostra. */
const SECOES: Record<string, string> = {
  neutras: "Neutras", "2cores": "2 cores", "3cores": "3 cores", "4cores": "4 cores",
  serrilhas: "Serrilhas", diversas: "Diversas", westman: "Westman", metiq: "Metiq",
  open: "Open", mx5500: "MX5500", pico: "Pico", cortes: "Cortes", vincos: "Vincos",
};

export type FacaRelacao = { cod: string; medida: string; sistema: string; secao: string; arquivo: string };

/* Abreviações da lista, pedidas pelo Augusto (25/09/2026). Na lista a medida
   sai em 96px, e o texto a mais empurrava o número — que é o que se procura —
   para fora da coluna. Só a exibição muda; a Relação continua escrevendo
   por extenso.
   · "FORCE 59,5X130" → "F 59,5X130" (a faca da máquina Force)
   · "70X40+SERR"     → "70X40+SER"  (serrilha, com um R — como a "100X100 SER") */
const encurtarMedida = (medida: string) =>
  medida.replace(/^FORCE\s+/i, "F ").replace(/\bSERR\b/gi, "SER");

/**
 * Separa "medida - código" do rótulo do link.
 *
 * Não dá para partir no primeiro " - ": os rótulos não seguem um padrão só —
 * há "15X42 - FAC0002.01", "Ser. 160x30- fr2-SN23.01" (sem espaço antes do
 * traço) e "70mm- fr2-171.01P". O que é firme é o NOME DO ARQUIVO: ele
 * aparece dentro do código, então procuramos por ele e cortamos ali. Quando
 * nem isso vale — o arquivo foi renomeado e o rótulo não —, corta no último
 * traço que tem espaço ao lado.
 */
function partirRotulo(rotulo: string, arquivo: string): { cod: string; medida: string } {
  const base = arquivo.replace(/\.pdf$/i, "");
  const i = rotulo.toLowerCase().lastIndexOf(base.toLowerCase());
  if (i > 0) {
    let cod = rotulo.slice(i).trim();
    const antes = rotulo.slice(0, i);
    const comFr2 = antes.match(/(fr2-)\s*$/i);   // "fr2-" faz parte do código
    if (comFr2) cod = comFr2[1] + cod;
    const medida = antes
      .replace(/(fr2-)\s*$/i, "")
      .replace(/[\s\-–—]+$/, "")
      .trim();
    if (medida) return { cod, medida };
  }

  /* Plano B: o nome do arquivo não está dentro do código. Acontece em quatro
     linhas da Relação, onde o arquivo foi renomeado e o rótulo não — "87X40 -
     fr2-020.01M" aponta para 020.02.pdf. Sem plano B a medida saía sendo o
     rótulo inteiro na tela, e o código saía sendo o nome do arquivo, o que
     ainda fazia a MESMA faca entrar de novo pelo catálogo antigo.
     O corte é no traço COM espaço ao lado: o traço de dentro de "fr2-020.01M"
     é colado nas duas pontas, então não serve de corte e o código sai inteiro. */
  const m = /^(.*)[-–—]\s+(\S.*)$/.exec(rotulo) || /^(.*\S)\s+[-–—](\S.*)$/.exec(rotulo);
  if (m) {
    const medida = m[1].replace(/[\s\-–—]+$/, "").trim();
    const cod = m[2].trim();
    if (medida && cod) return { cod, medida };
  }
  return { cod: base, medida: rotulo.trim() };
}

/** As facas lidas e as páginas que não abriram (ou abriram sem render faca
    nenhuma). Sem `faltaram`, a falha morria aqui: com o share fora do ar a
    leitura voltava vazia (ou com a da última vez), a tela de Facas caía no
    catálogo embutido e ninguém ficava sabendo (06/10/2026). Com página em
    `faltaram`, a tela avisa. */
export type LeituraDaRelacao = { itens: FacaRelacao[]; faltaram: string[] };

/* As páginas somam ~50 KB numa unidade de rede: lê uma vez e guarda. */
let cache: { quando: number; itens: FacaRelacao[]; faltaram: string[] } | null = null;
const CACHE_MS = 5 * 60_000;

export function lerRelacaoFacas(forcar = false): LeituraDaRelacao {
  if (!forcar && cache && Date.now() - cache.quando < CACHE_MS) return { itens: cache.itens, faltaram: cache.faltaram };

  const dir = relacaoDir();
  const itens: FacaRelacao[] = [];
  const faltaram: string[] = [];
  for (const [pagina, sistema] of Object.entries(PAGINAS)) {
    const arq = path.join(dir, pagina);
    let html: string;
    try {
      if (!existsSync(arq)) { faltaram.push(pagina); continue; }
      html = readFileSync(arq, "utf8");
    } catch {
      faltaram.push(pagina);
      continue;   // share fora do ar: fica com o que o hub já tem
    }
    // Percorre na ordem: cada <section id> troca a seção corrente dali para baixo.
    let secao = sistema === "Picote" ? "Picote" : "";   // a página de picote não tem seções
    const re = /<section id="([^"]+)"|<li>\s*<a href="facas[\\/]([^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;
    let m: RegExpExecArray | null;
    const antes = itens.length;
    while ((m = re.exec(html)) !== null) {
      if (m[1]) { secao = SECOES[m[1].toLowerCase()] ?? m[1]; continue; }
      const arquivo = m[2];
      const { cod, medida } = partirRotulo((m[3] ?? "").trim(), arquivo);
      if (cod) itens.push({ cod, medida: encurtarMedida(medida), sistema, secao: secao || "Diversas", arquivo });
    }
    /* Abriu e não rendeu faca: a marcação mudou (a regex não casa mais) ou a
       página foi esvaziada. Para a tela é o mesmo que não abrir, a família cai
       no catálogo embutido. Hoje toda página rende: a menor, Cortes e vincos,
       tem 4 facas (06/10/2026). */
    if (itens.length === antes) faltaram.push(pagina);
  }

  // página vazia/ilegível não pode apagar o catálogo inteiro (as que não
  // abriram vão junto, para a tela avisar que a lista é a da última leitura)
  if (!itens.length && cache) return { itens: cache.itens, faltaram };
  cache = { quando: Date.now(), itens, faltaram };
  return { itens, faltaram };
}

/** Quando as páginas foram editadas pela última vez (para a tela mostrar). */
export function relacaoAtualizadaEm(): string | null {
  const dir = relacaoDir();
  let maior = 0;
  for (const pagina of Object.keys(PAGINAS)) {
    try {
      const st = statSync(path.join(dir, pagina));
      if (st.mtimeMs > maior) maior = st.mtimeMs;
    } catch { /* segue */ }
  }
  return maior ? new Date(maior).toISOString() : null;
}
