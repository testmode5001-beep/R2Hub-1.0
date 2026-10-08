// As cores de um pedido, separadas como a vendedora pensou.
//
// Ela raramente põe vírgula entre as cores: "Azul claro, Azul marinho, Branco
// roxo" virava três cores, com "Branco roxo" numa só (Augusto, 02/10/2026:
// "precisamos nos prevenir"). Aqui a separação vem da vírgula, do ";", do "/",
// da quebra de linha e do "e" entre cores, e dentro de cada pedaço pelos
// nomes de cor: cada cor-base ("branco", "roxo") começa uma cor nova, e o que
// vem depois dela ("claro", "marinho", ou uma palavra que não é cor-base,
// como "piscina") fica com ela. Pantone ("P 485 C", "Pantone 286 C", "485C")
// é uma cor só.

/* cores que quase sempre aparecem sozinhas: cada uma começa uma cor nova */
const BASE = new Set([
  "preto", "preta", "branco", "branca", "azul", "vermelho", "vermelha", "amarelo", "amarela", "verde", "roxo", "roxa",
  "rosa", "laranja", "marrom", "cinza", "prata", "dourado", "dourada", "bege", "vinho", "lilas", "violeta",
  "magenta", "ciano", "creme", "bordo", "pink", "fucsia", "salmao", "coral", "grafite", "caramelo", "mostarda",
  "cobre", "bronze", "nude", "ouro", "turquesa",
]);
/* duas cores-base que juntas são uma cor só */
const COMPOSTAS = new Set([
  "amarelo ouro", "azul turquesa", "verde turquesa", "rosa pink", "vermelho vinho", "branco gelo", "verde agua",
  "azul petroleo", "verde oliva", "rosa salmao", "laranja coral", "cinza grafite", "marrom chocolate",
]);

/* as mesmas listas, só leitura, para a sugestão de grafia do campo de cores
   (lib/sugestao-de-cor.ts) */
export const CORES_BASE: ReadonlySet<string> = BASE;
export const CORES_COMPOSTAS: ReadonlySet<string> = COMPOSTAS;

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ehPantone = (palavra: string) => /^(p|pantone)$/i.test(palavra) || /^\d{2,4}[a-z]{0,2}$/i.test(palavra);
const ehFimDePantone = (palavra: string) => /^(c|u|cp|up|m|tpx|tcx)$/i.test(palavra);

/** separa um pedaço sem vírgula ("Branco roxo", "P 485 C Preto") pelas cores */
function separarPedaco(pedaco: string): string[] {
  const palavras = pedaco.split(/\s+/).filter(Boolean);
  const cores: string[][] = [];
  let atual: string[] | null = null;
  let emPantone = false;
  for (const palavra of palavras) {
    const chave = semAcento(palavra);
    if (emPantone) {
      /* o Pantone vai até o "C"/"U", ou até uma cor-base */
      if (BASE.has(chave)) { emPantone = false; atual = [palavra]; cores.push(atual); continue; }
      atual!.push(palavra);
      if (ehFimDePantone(palavra)) emPantone = false;
      continue;
    }
    if (ehPantone(palavra)) {
      atual = [palavra];
      cores.push(atual);
      emPantone = !/[a-z]$/i.test(palavra) || /^(p|pantone)$/i.test(palavra);
      continue;
    }
    if (BASE.has(chave)) {
      const anterior = atual ? semAcento(atual[atual.length - 1]) : "";
      if (atual && COMPOSTAS.has(`${anterior} ${chave}`)) { atual.push(palavra); continue; }
      atual = [palavra];
      cores.push(atual);
      continue;
    }
    /* "claro", "marinho", ou palavra que não é cor-base: fica com a cor de antes */
    if (atual) atual.push(palavra);
    else { atual = [palavra]; cores.push(atual); }
  }
  return cores.map((c) => c.join(" "));
}

/** A lista de cores: "Azul claro, Azul marinho, Branco roxo" vira quatro cores. */
export function separarCores(texto: string | null | undefined): string[] {
  return String(texto ?? "")
    .split(/[,;\n/·]|\s+e\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(separarPedaco)
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1));
}

/* As duas listas do pedido. Desde 07/10/2026 o pedido guarda as cores que a vendedora pediu
   (cores_desc) e, ao lado, as da arte, lidas da prova no Design criado
   (cores_arte). Antes a prova gravava por cima do pedido: no que veio antes,
   cores_desc já são as da arte. */
type ComCores = { cores?: unknown; cores_desc?: unknown; cores_arte?: unknown } | null | undefined;

/** As cores que a etiqueta tem: as da arte quando a prova foi lida; senão as pedidas. */
export function coresEfetivas(p: ComCores): string {
  const daArte = String(p?.cores_arte ?? "").trim();
  return daArte || String(p?.cores_desc ?? "").trim();
}

/** Quantas cores: as da arte quando houver; senão o número que a vendedora escreveu. */
export function numeroDeCores(p: ComCores): string {
  const daArte = separarCores(String(p?.cores_arte ?? "")).length;
  return daArte ? String(daArte) : String(p?.cores ?? "").trim();
}

/* "P 485 C", "Pantone 485 C" e "485C" são a mesma cor (o "C" e o "U" do fim
   são o papel, não a tinta); "Preta" e "Preto" também */
function chaveDaCor(cor: string): string {
  const k = semAcento(cor).trim().replace(/\b(pret|branc|amarel|vermelh|rox|dourad)a\b/g, "$1o");
  const semPrefixo = k.replace(/^(?:pantone\s*|p\s+|p(?=\d))/, "");
  if (semPrefixo !== k || /^\d/.test(k)) return "p:" + semPrefixo.replace(/\s*(cp|up|c|u)$/, "").replace(/[^a-z0-9]/g, "");
  return k.replace(/[^a-z0-9]/g, "");
}

/** As duas listas têm as mesmas cores, sem contar a ordem nem a grafia? */
export function mesmasCores(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = new Set(separarCores(a).map(chaveDaCor));
  const kb = new Set(separarCores(b).map(chaveDaCor));
  return ka.size === kb.size && [...ka].every((k) => kb.has(k));
}
