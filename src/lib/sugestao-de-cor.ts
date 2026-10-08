// "Você quis dizer preto?" no campo de cores do Novo pedido (Augusto,
// 08/10/2026: "conseguimos avisar o usuário de erros de ortografia?", com
// "preot" escrito nas cores).
//
// O corretor do navegador não serve neste campo: marca Reflex Blue e Warm Red
// como erro e não sabe quais palavras são cor. E a cor escrita errado não é
// só feia: separarCores (lib/cores.ts) separa as cores pelos nomes, então
// "Laranja preot rosa" vira duas cores ("Laranja preot" e "Rosa"), a conta com
// o número de cores marcado não bate e o designer recebe "Preot".
//
// A conta: cada palavra do campo que o hub não conhece (as cores, os tons, as
// palavras dos nomes de cor da busca de Pantones, os nomes em inglês do livro
// e as palavras comuns de um pedido) é comparada com as palavras de cor. Se
// estiver a uma letra de uma delas (uma trocada, uma a mais, uma a menos ou
// duas vizinhas invertidas), a tela sugere a troca. Com duas letras de
// diferença o palpite erra demais ("amarelado" virava "amarelo"): fica sem
// sugestão. A palavra que ainda está sendo digitada (a última, sem nada
// depois) não conta enquanto for o começo de uma palavra conhecida ("pret" a
// caminho de "preto").
import { CORES_BASE, CORES_COMPOSTAS } from "./cores";
import { NOMES_DE_COR } from "./nomes-de-cor";

const chave = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/* os tons e acabamentos que acompanham a cor: também são sugeridos */
const TONS = [
  "claro", "clara", "escuro", "escura", "médio", "média", "forte", "suave", "intenso", "intensa", "pastel",
  "metálico", "metálica", "metalizado", "metalizada", "perolado", "perolada", "fosco", "fosca", "brilho",
  "brilhante", "fluorescente", "neon", "verniz", "pantone", "transparente", "chapado", "chapada", "lima",
];
/* os nomes do livro Pantone que não são número (Reflex Blue C, Warm Red C,
   Cool Gray 7 C...) e as tintas de escala em inglês */
const PANTONE_EM_INGLES = [
  "black", "blue", "bright", "cool", "gray", "grey", "dark", "green", "medium", "purple", "orange", "pink",
  "process", "reflex", "rhodamine", "rubine", "violet", "warm", "yellow", "cyan", "magenta", "white", "red",
];
/* palavras que aparecem num pedido de cores e não são cor: conhecidas, mas
   nunca sugeridas */
const COMUNS = [
  "e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas", "com", "sem", "para", "pra", "por", "ou", "o", "a",
  "os", "as", "um", "uma", "uns", "umas", "que", "ao", "aos", "se", "já", "não", "sim", "tem", "como", "cada", "só",
  "apenas", "somente", "também", "até", "mais", "menos", "mesmo", "mesma", "igual", "iguais", "outro", "outra", "todo",
  "toda", "todas", "todos", "cor", "cores", "tom", "tons", "tonalidade", "fundo", "texto", "letra", "letras", "logo",
  "logotipo", "marca", "nome", "borda", "detalhe", "detalhes", "faixa", "faixas", "contorno", "fio", "linha", "linhas",
  "imagem", "foto", "desenho", "arte", "tinta", "tintas", "papel", "etiqueta", "etiquetas", "rótulo", "frente", "verso",
  "lado", "cliente", "amostra", "referência", "conforme", "padrão", "anterior", "atual", "novo", "nova", "antiga",
  "pantones", "pms", "cmyk", "cmy", "rgb", "policromia", "quadricromia", "processo", "escala", "especial", "especiais",
  "retícula", "degradê", "gradiente", "opaco", "opaca", "uv", "localizado", "localizada", "total", "hot", "stamping",
  "laminação", "laminado", "laminada", "relevo", "leve", "fraco", "fraca", "rosé",
];
/* a grafia certa das palavras de cor que levam acento (as listas guardam sem) */
const COM_ACENTO: Record<string, string> = {
  lilas: "lilás", salmao: "salmão", fucsia: "fúcsia", bordo: "bordô", petroleo: "petróleo", agua: "água", limao: "limão",
  bebe: "bebê", ceu: "céu", perola: "pérola", pessego: "pêssego", abobora: "abóbora", cafe: "café", canario: "canário",
  indigo: "índigo", orquidea: "orquídea", medio: "médio", acafrao: "açafrão", acai: "açaí", ambar: "âmbar", avela: "avelã",
  carvao: "carvão", eletrico: "elétrico", fumaca: "fumaça", glace: "glacê", hortensia: "hortênsia", maca: "maçã",
  onix: "ônix", purpura: "púrpura", salvia: "sálvia", metalico: "metálico", metalica: "metálica",
};

/** "azul" → azuis; "marrom" → marrons; "verde" → verdes */
function plurais(p: string): string[] {
  if (p.endsWith("l")) return [p.slice(0, -1) + "is", p + "s"];
  if (p.endsWith("m")) return [p.slice(0, -1) + "ns"];
  if (/[rz]$/.test(p)) return [p + "es"];
  return [p + "s"];
}

/* as palavras de cor, na ordem de preferência: as cores-base primeiro, na
   ordem da lista ("preto" antes de "preta") */
const FONTES = [...new Set([
  ...CORES_BASE,
  ...[...CORES_COMPOSTAS].flatMap((c) => c.split(" ")),
  ...TONS,
  ...NOMES_DE_COR.flatMap((n) => n.termo.split(/\s+/)),
  ...PANTONE_EM_INGLES,
].map(chave))];
/* só as de quatro letras ou mais são sugeridas ("mel", "red" e "bic" são
   conhecidas, mas sugerir palavra de três letras erra demais) */
const DE_COR = FONTES.filter((p) => p.length >= 4);
/* o feminino dos tons: "clara", "rosada", "marinha" */
const FEMININOS = DE_COR.filter((p) => p.endsWith("o")).map((p) => p.slice(0, -1) + "a");
/* tudo o que o hub conhece: as de cor, o feminino, os plurais e as comuns */
const CONHECIDAS = new Set<string>([
  ...FONTES,
  ...FEMININOS,
  ...[...DE_COR, ...FEMININOS].flatMap(plurais),
  ...COMUNS.map(chave),
]);
const CONHECIDAS_LISTA = [...CONHECIDAS];
const EM_INGLES = new Set(PANTONE_EM_INGLES);

/** a e b diferem em uma letra: trocada, a mais, a menos, ou duas vizinhas invertidas */
export function aUmaLetra(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return i + 1 < a.length && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** A palavra escrita e as trocas sugeridas (até duas), com a posição no texto. */
export type SugestaoDeCor = { palavra: string; inicio: number; fim: number; opcoes: string[] };

/** As palavras do campo de cores que parecem cor escrita errado, na ordem do texto. */
export function sugestoesDeCor(texto: string): SugestaoDeCor[] {
  const saida: SugestaoDeCor[] = [];
  for (const m of texto.matchAll(/\p{L}+/gu)) {
    const palavra = m[0];
    const inicio = m.index ?? 0;
    const fim = inicio + palavra.length;
    const k = chave(palavra);
    if (k.length < 3 || CONHECIDAS.has(k)) continue;
    /* grudada num número ("485C", "4cores"): é código, não nome */
    if (/\d/.test(texto.charAt(inicio - 1)) || /\d/.test(texto.charAt(fim))) continue;
    /* ainda digitando: a última palavra que é começo de uma conhecida */
    if (fim === texto.length && CONHECIDAS_LISTA.some((c) => c.startsWith(k))) continue;
    const todas = DE_COR.filter((c) => aUmaLetra(k, c));
    /* com uma em português por perto, a do livro em inglês sai ("Cian" é ciano, não cyan) */
    const perto = todas.some((c) => !EM_INGLES.has(c)) ? todas.filter((c) => !EM_INGLES.has(c)) : todas;
    /* "pretx" fica perto de "preto" e de "preta": basta a primeira */
    const opcoes = perto.filter((c, i) => !perto.slice(0, i).some((d) => d.slice(0, -1) === c.slice(0, -1) && /[oa]$/.test(d) && /[oa]$/.test(c)))
      .slice(0, 2)
      .map((c) => COM_ACENTO[c] ?? c);
    if (opcoes.length) saida.push({ palavra, inicio, fim, opcoes });
  }
  return saida;
}

/** O texto com a palavra trocada, na caixa em que foi escrita ("Preot" → "Preto"). */
export function trocarPalavra(texto: string, s: SugestaoDeCor, opcao: string): string {
  const { palavra } = s;
  const nova = palavra.length > 1 && palavra === palavra.toUpperCase() ? opcao.toUpperCase()
    : palavra.charAt(0) === palavra.charAt(0).toUpperCase() ? opcao.charAt(0).toUpperCase() + opcao.slice(1)
    : opcao;
  return texto.slice(0, s.inicio) + nova + texto.slice(s.fim);
}
