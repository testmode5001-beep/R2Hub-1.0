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

/**
 * Separa "medida - código" do rótulo do link.
 *
 * Não dá para partir no primeiro " - ": os rótulos não seguem um padrão só —
 * há "15X42 - FAC0002.01", "Ser. 160x30- fr2-SN23.01" (sem espaço antes do
 * traço) e "70mm- fr2-171.01P". O que é firme é o NOME DO ARQUIVO: ele
 * aparece dentro do código, então procuramos por ele e cortamos ali.
 */
function partirRotulo(rotulo: string, arquivo: string): { cod: string; medida: string } {
  const base = arquivo.replace(/\.pdf$/i, "");
  const i = rotulo.toLowerCase().lastIndexOf(base.toLowerCase());
  if (i <= 0) return { cod: base, medida: rotulo.trim() };

  let cod = rotulo.slice(i).trim();
  const antes = rotulo.slice(0, i);
  const comFr2 = antes.match(/(fr2-)\s*$/i);   // "fr2-" faz parte do código
  if (comFr2) cod = comFr2[1] + cod;
  const medida = antes
    .replace(/(fr2-)\s*$/i, "")
    .replace(/[\s\-–—]+$/, "")
    .trim();
  return { cod, medida: medida || rotulo.trim() };
}

/* As páginas somam ~50 KB numa unidade de rede: lê uma vez e guarda. */
let cache: { quando: number; itens: FacaRelacao[] } | null = null;
const CACHE_MS = 5 * 60_000;

export function lerRelacaoFacas(forcar = false): FacaRelacao[] {
  if (!forcar && cache && Date.now() - cache.quando < CACHE_MS) return cache.itens;

  const dir = relacaoDir();
  const itens: FacaRelacao[] = [];
  for (const [pagina, sistema] of Object.entries(PAGINAS)) {
    const arq = path.join(dir, pagina);
    let html: string;
    try {
      if (!existsSync(arq)) continue;
      html = readFileSync(arq, "utf8");
    } catch {
      continue;   // share fora do ar: fica com o que o hub já tem
    }
    // Percorre na ordem: cada <section id> troca a seção corrente dali para baixo.
    let secao = sistema === "Picote" ? "Picote" : "";   // a página de picote não tem seções
    const re = /<section id="([^"]+)"|<li>\s*<a href="facas[\\/]([^"]+\.pdf)"[^>]*>([^<]*)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (m[1]) { secao = SECOES[m[1].toLowerCase()] ?? m[1]; continue; }
      const arquivo = m[2];
      const { cod, medida } = partirRotulo((m[3] ?? "").trim(), arquivo);
      if (cod) itens.push({ cod, medida, sistema, secao: secao || "Diversas", arquivo });
    }
  }

  // página vazia/ilegível não pode apagar o catálogo inteiro
  if (!itens.length && cache) return cache.itens;
  cache = { quando: Date.now(), itens };
  return itens;
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
