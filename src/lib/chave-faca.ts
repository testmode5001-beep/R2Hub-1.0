// A mesma ferramenta aparece escrita de três jeitos no sistema:
//
//   Relação de Ferramentais   fr2-263.01M
//   catálogo antigo do código 263.01
//   PDF em "Facas por Z"      FAC00173.01.pdf   (com um zero a mais)
//
// Sem uma chave única, a faca conta duas vezes na família e o Z arquivado na
// pasta nunca encontra a faca do catálogo. Esta função é a chave, e vive em
// `lib` de propósito: o servidor a usa para indexar as pastas e a tela a usa
// para procurar — se cada lado tivesse a sua, elas divergiriam na primeira
// exceção que aparecesse.
//
// O que ela tira, em ordem: a extensão, o prefixo `fr2-`, o sufixo de material
// (P de papel, M de metal, D de dupla) que a Relação cola no fim, tudo que não
// é letra/número/ponto, e os zeros à esquerda depois do prefixo da família.
export function chaveFaca(cod: unknown): string {
  return String(cod ?? "")
    .replace(/\.pdf$/i, "")
    .replace(/^fr2-/i, "")
    .replace(/([\d.]+)[PMD]$/i, "$1")
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, "")
    .replace(/^(FAC|P|D|SN|PA|PSN)0+/, "$1");
}
