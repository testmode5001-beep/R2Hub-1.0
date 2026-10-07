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
