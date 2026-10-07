// Nomes populares de cor para a busca de Pantones do 1.0 (Augusto, 02/10/2026:
// "tornar a pesquisa por nomes de cores como 'rosa choque' ou 'azul bic' mais
// precisa, hoje aparecem muitos resultados, alguns vêm vagos, e também aumentar
// o leque de nomes de cores populares").
//
// O livro Pantone não dá nome às cores: é código e medida. A busca antiga
// transformava o nome numa faixa (família, claridade e saturação), e "rosa
// choque" trazia 126 cores, roxos inclusive. Agora há dois tipos de nome:
// - de referência ("ancora"): o nome aponta para os Pantones que a equipe
//   reconhece como aquela cor (rosa choque: Rhodamine Red C, 219 C, 806 C), e
//   a tela mostra só os mais parecidos com eles, do mais perto ao mais longe
//   (ΔE2000 no Lab oficial do livro, até o raio do nome e no máximo
//   LIMITE_DO_NOME cores). Os metálicos ficam de fora (o Lab medido deles cai
//   perto das cores chapadas e enchia a lista: em "terracota" eram 9 de 21),
//   menos nos nomes de metal, que mostram só metálicos ("somente"), como os de
//   neon mostram só neons;
// - de faixa: a família com claro, escuro, vivo ou suave ("azul claro") e a
//   família sozinha ("azul") continuam como faixa, porque pedem a família; o
//   "matiz" separa roxo de rosa, que moram na mesma família.
// A ORDEM MANDA: vale o primeiro termo da lista que aparecer inteiro, em
// palavras, na busca. Por isso o específico vem antes do genérico que ele
// contém ("azul bic" antes de "azul"); o gerador recusa termo engolido.
// As referências são escolha da casa, não nome oficial da Pantone (as de marca
// são aproximação pelo hex público, ver as notas): quem discordar de uma troca
// o código aqui (tem de existir no livro).
//
// Gerado em 02/10/2026 a partir da lista conferida no livro, cor por cor, em
// folhas de amostras (288 nomes, 219 de referência); pode editar à mão, mantendo
// a ordem.

export type NomeDeCor =
  | { termo: string; tipo: "ancora"; refs: string[]; raio: number; somente?: "metalicos" | "neons" }
  | { termo: string; tipo: "faixa"; familias: string[]; L?: [number, number]; croma?: [number, number]; matiz?: [number, number] };

/** quantas cores um nome de referência mostra, no máximo (três fileiras da grade) */
export const LIMITE_DO_NOME = 21;

/** Metálico (871 a 877, 8001 a 8999, 10101 a 10499), neon (801 a 814, 901 a 942) ou outro. */
export function tipoDoCodigo(codigo: string): "metalico" | "neon" | "outro" {
  const m = /^(\d+) C$/.exec(codigo);
  if (!m) return "outro";
  const n = Number(m[1]);
  if ((n >= 10101 && n <= 10499) || (n >= 8001 && n <= 8999) || (n >= 871 && n <= 877)) return "metalico";
  if ((n >= 801 && n <= 814) || (n >= 901 && n <= 942)) return "neon";
  return "outro";
}

/** O ângulo do matiz no Lab (0 a 360), para o "matiz" das faixas. */
export const matizDoLab = (a: number, b: number) => ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
/** O matiz está na faixa [de, ate)? A faixa pode dar a volta no 0 (rosa: 330 a 50). */
export const noMatiz = (h: number, [de, ate]: [number, number]) => (de <= ate ? h >= de && h < ate : h >= de || h < ate);

export const NOMES_DE_COR: NomeDeCor[] = [
  { termo: "vermelho ferrari", tipo: "ancora", refs: ["2347 C", "485 C"], raio: 7 },  // Aproximação de marca: Rosso Corsa pelo hex público #D40000 (sem Pantone oficial confirmado).
  { termo: "vermelho coca", tipo: "ancora", refs: ["Bright Red C", "2347 C"], raio: 7 },  // Aproximação de marca pelo hex público #F40009 (sem Pantone oficial confirmado).
  { termo: "coca cola", tipo: "ancora", refs: ["Bright Red C", "2347 C"], raio: 7 },  // Aproximação de marca pelo hex público #F40009 (sem Pantone oficial confirmado).
  { termo: "vermelho bombeiro", tipo: "ancora", refs: ["485 C", "1795 C"], raio: 8 },
  { termo: "vermelho natal", tipo: "ancora", refs: ["186 C", "200 C"], raio: 8 },
  { termo: "vermelho batom", tipo: "ancora", refs: ["199 C", "1935 C"], raio: 7 },
  { termo: "vermelho sangue", tipo: "ancora", refs: ["187 C", "7622 C"], raio: 7 },
  { termo: "vermelho fogo", tipo: "ancora", refs: ["Bright Red C", "Warm Red C"], raio: 7 },
  { termo: "vermelho tomate", tipo: "ancora", refs: ["179 C", "7417 C", "Warm Red C"], raio: 7 },
  { termo: "tomate", tipo: "ancora", refs: ["179 C", "7417 C", "Warm Red C"], raio: 7 },
  { termo: "escarlate", tipo: "ancora", refs: ["Bright Red C", "2347 C", "485 C"], raio: 7 },
  { termo: "cereja", tipo: "ancora", refs: ["200 C", "193 C"], raio: 7 },
  { termo: "carmim", tipo: "ancora", refs: ["187 C", "7427 C", "200 C"], raio: 7 },
  { termo: "carmin", tipo: "ancora", refs: ["187 C", "7427 C", "200 C"], raio: 7 },
  { termo: "rubi", tipo: "ancora", refs: ["1945 C", "207 C"], raio: 7 },
  { termo: "granada", tipo: "ancora", refs: ["1815 C", "7629 C"], raio: 7 },
  { termo: "bordo", tipo: "ancora", refs: ["202 C", "188 C"], raio: 7 },
  { termo: "bordeaux", tipo: "ancora", refs: ["202 C", "188 C"], raio: 7 },
  { termo: "vinho", tipo: "ancora", refs: ["7421 C", "209 C"], raio: 7 },
  { termo: "marsala", tipo: "ancora", refs: ["4985 C", "7524 C"], raio: 7 },  // Cor do Ano Pantone (guia de tecido, TCX 18-1438); não existe no livro coated. Referências = as mais próximas do hex publicado #955251 (aproximação). O mais perto de todos é o 8880 C, metálico.
  { termo: "terracota", tipo: "ancora", refs: ["7592 C", "7585 C"], raio: 8 },
  { termo: "telha", tipo: "ancora", refs: ["7580 C", "7598 C"], raio: 7 },
  { termo: "tijolo", tipo: "ancora", refs: ["484 C", "7599 C"], raio: 7 },
  { termo: "ferrugem", tipo: "ancora", refs: ["1675 C", "7526 C"], raio: 7 },
  { termo: "morango", tipo: "ancora", refs: ["192 C", "1787 C"], raio: 7 },  // Escolha: a cor da fruta (vermelho puxado para o rosa), não o rosa do milk-shake.
  { termo: "melancia", tipo: "ancora", refs: ["1785 C", "1777 C"], raio: 7 },
  { termo: "laranja neon", tipo: "ancora", refs: ["804 C", "811 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "laranja fluor", tipo: "ancora", refs: ["804 C", "811 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "laranja queimado", tipo: "ancora", refs: ["159 C", "1595 C"], raio: 7 },
  { termo: "cenoura", tipo: "ancora", refs: ["165 C", "1655 C"], raio: 7 },
  { termo: "abobora", tipo: "ancora", refs: ["158 C", "1585 C"], raio: 7 },
  { termo: "tangerina", tipo: "ancora", refs: ["151 C", "1505 C"], raio: 7 },
  { termo: "damasco", tipo: "ancora", refs: ["157 C", "1565 C"], raio: 7 },
  { termo: "peach fuzz", tipo: "ancora", refs: ["1555 C", "162 C"], raio: 6 },  // Cor do Ano Pantone (guia de tecido, TCX 13-1023); não existe no livro coated. Referências = as mais próximas do hex publicado #FFBE98 (aproximação).
  { termo: "pessego", tipo: "ancora", refs: ["162 C", "1555 C", "712 C"], raio: 7 },
  { termo: "salmao", tipo: "ancora", refs: ["1625 C", "170 C"], raio: 7 },
  { termo: "living coral", tipo: "ancora", refs: ["2345 C", "178 C"], raio: 7 },  // Cor do Ano Pantone (guia de tecido, TCX 16-1546); não existe no livro coated. Referências = as mais próximas do hex publicado #FF6F61 (aproximação).
  { termo: "coral", tipo: "ancora", refs: ["7416 C", "178 C", "2345 C"], raio: 7 },
  { termo: "acafrao", tipo: "ancora", refs: ["130 C", "7409 C"], raio: 7 },
  { termo: "ambar", tipo: "ancora", refs: ["1375 C", "130 C"], raio: 7 },
  { termo: "ocre", tipo: "ancora", refs: ["7510 C", "7563 C"], raio: 8 },
  { termo: "mel", tipo: "ancora", refs: ["7509 C", "7510 C"], raio: 8 },
  { termo: "amarelo neon", tipo: "ancora", refs: ["803 C", "809 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "amarelo fluor", tipo: "ancora", refs: ["803 C", "809 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "amarelo limao", tipo: "ancora", refs: ["102 C", "3945 C"], raio: 7 },
  { termo: "amarelo canario", tipo: "ancora", refs: ["Yellow C", "108 C", "109 C"], raio: 6 },
  { termo: "amarelo canarinho", tipo: "ancora", refs: ["Yellow C", "108 C", "109 C"], raio: 6 },
  { termo: "amarelo ouro", tipo: "ancora", refs: ["123 C", "7408 C", "1235 C"], raio: 7 },
  { termo: "amarelo dourado", tipo: "ancora", refs: ["123 C", "7408 C", "1235 C"], raio: 7 },
  { termo: "amarelo gema", tipo: "ancora", refs: ["1235 C", "7409 C"], raio: 7 },
  { termo: "amarelo queimado", tipo: "ancora", refs: ["7563 C", "1245 C"], raio: 7 },
  { termo: "mostarda", tipo: "ancora", refs: ["7555 C", "110 C"], raio: 8 },
  { termo: "amarelo manteiga", tipo: "ancora", refs: ["7401 C", "1205 C"], raio: 7 },
  { termo: "amarelo bebe", tipo: "ancora", refs: ["600 C", "1205 C"], raio: 7 },
  { termo: "baunilha", tipo: "ancora", refs: ["7499 C"], raio: 7 },
  { termo: "milho", tipo: "ancora", refs: ["1225 C", "7404 C"], raio: 7 },
  { termo: "palha", tipo: "ancora", refs: ["7500 C", "4545 C"], raio: 7 },
  { termo: "trigo", tipo: "ancora", refs: ["7506 C", "7507 C"], raio: 7 },
  { termo: "champanhe", tipo: "ancora", refs: ["7501 C", "7506 C"], raio: 6 },
  { termo: "champagne", tipo: "ancora", refs: ["7501 C", "7506 C"], raio: 6 },
  { termo: "verde neon", tipo: "ancora", refs: ["802 C", "902 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "verde fluor", tipo: "ancora", refs: ["802 C", "902 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "verde tiffany", tipo: "ancora", refs: ["7471 C", "324 C"], raio: 6 },  // Aproximação de marca: o azul da Tiffany é um Pantone exclusivo (1837), fora do livro. Referências = as mais próximas do hex público #81D8D0.
  { termo: "verde turquesa", tipo: "ancora", refs: ["3265 C", "3262 C"], raio: 7 },
  { termo: "verde petroleo", tipo: "ancora", refs: ["3302 C", "7722 C"], raio: 7 },
  { termo: "verde bandeira", tipo: "ancora", refs: ["355 C", "356 C"], raio: 7 },
  { termo: "verde agua", tipo: "ancora", refs: ["337 C", "7464 C"], raio: 7 },
  { termo: "verde menta", tipo: "ancora", refs: ["351 C", "352 C"], raio: 7 },
  { termo: "menta", tipo: "ancora", refs: ["351 C", "352 C"], raio: 7 },
  { termo: "verde limao", tipo: "ancora", refs: ["375 C", "382 C"], raio: 7 },
  { termo: "limao", tipo: "ancora", refs: ["375 C", "382 C"], raio: 7 },  // Escolha: limão sozinho no Brasil é verde. Amarelo é só em "amarelo limao".
  { termo: "verde maca", tipo: "ancora", refs: ["367 C", "2285 C"], raio: 7 },
  { termo: "verde folha", tipo: "ancora", refs: ["363 C", "7739 C"], raio: 7 },
  { termo: "verde grama", tipo: "ancora", refs: ["361 C", "362 C"], raio: 7 },
  { termo: "verde abacate", tipo: "ancora", refs: ["7490 C", "576 C"], raio: 8 },
  { termo: "abacate", tipo: "ancora", refs: ["7490 C", "576 C"], raio: 8 },
  { termo: "verde pistache", tipo: "ancora", refs: ["578 C", "7494 C"], raio: 7 },
  { termo: "pistache", tipo: "ancora", refs: ["578 C", "7494 C"], raio: 7 },
  { termo: "verde oliva", tipo: "ancora", refs: ["5767 C", "582 C"], raio: 8 },
  { termo: "oliva", tipo: "ancora", refs: ["5767 C", "582 C"], raio: 8 },
  { termo: "verde musgo", tipo: "ancora", refs: ["574 C", "371 C"], raio: 7 },
  { termo: "musgo", tipo: "ancora", refs: ["574 C", "371 C"], raio: 7 },
  { termo: "verde militar", tipo: "ancora", refs: ["5743 C", "5747 C"], raio: 8 },
  { termo: "verde garrafa", tipo: "ancora", refs: ["343 C", "3435 C"], raio: 7 },
  { termo: "verde floresta", tipo: "ancora", refs: ["357 C", "349 C"], raio: 7 },
  { termo: "verde esmeralda", tipo: "ancora", refs: ["340 C", "3415 C"], raio: 7 },
  { termo: "esmeralda", tipo: "ancora", refs: ["340 C", "3415 C"], raio: 7 },
  { termo: "jade", tipo: "ancora", refs: ["3278 C", "2251 C"], raio: 7 },
  { termo: "verde salvia", tipo: "ancora", refs: ["7494 C", "5783 C"], raio: 7 },
  { termo: "salvia", tipo: "ancora", refs: ["7494 C", "5783 C"], raio: 7 },
  { termo: "greenery", tipo: "ancora", refs: ["2276 C", "576 C"], raio: 7 },  // Cor do Ano Pantone (guia de tecido, TCX 15-0343); não existe no livro coated. Referências = as mais próximas do hex publicado #88B04B (aproximação).
  { termo: "azul neon", tipo: "ancora", refs: ["801 C", "901 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "azul tiffany", tipo: "ancora", refs: ["7471 C", "324 C"], raio: 6 },  // Aproximação de marca: o azul da Tiffany é um Pantone exclusivo (1837), fora do livro. Referências = as mais próximas do hex público #81D8D0.
  { termo: "tiffany", tipo: "ancora", refs: ["7471 C", "324 C"], raio: 6 },  // Aproximação de marca: o azul da Tiffany é um Pantone exclusivo (1837), fora do livro. Referências = as mais próximas do hex público #81D8D0.
  { termo: "azul turquesa", tipo: "ancora", refs: ["3125 C", "7466 C"], raio: 7 },
  { termo: "turquesa", tipo: "ancora", refs: ["3125 C", "7466 C"], raio: 7 },
  { termo: "azul petroleo", tipo: "ancora", refs: ["3035 C", "302 C", "7708 C"], raio: 7 },
  { termo: "petroleo", tipo: "ancora", refs: ["3035 C", "302 C", "7708 C"], raio: 7 },  // Escolha: petróleo sozinho vira azul petróleo (o verde é só em "verde petroleo").
  { termo: "azul bic", tipo: "ancora", refs: ["2728 C", "286 C"], raio: 8 },  // Aproximação: tinta de caneta, sem Pantone oficial.
  { termo: "azul caneta", tipo: "ancora", refs: ["2728 C", "286 C"], raio: 8 },  // Aproximação: tinta de caneta, sem Pantone oficial.
  { termo: "azul klein", tipo: "ancora", refs: ["286 C", "2736 C"], raio: 6 },  // Aproximação: o azul Klein (IKB) é pigmento, não Pantone. Referências perto do hex usual #002FA7, puxando para o ultramar.
  { termo: "azul royal", tipo: "ancora", refs: ["286 C", "293 C", "2935 C"], raio: 7 },
  { termo: "azul cobalto", tipo: "ancora", refs: ["2728 C", "293 C"], raio: 7 },
  { termo: "azul eletrico", tipo: "ancora", refs: ["2132 C", "2387 C"], raio: 7 },
  { termo: "azul ultramar", tipo: "ancora", refs: ["Blue 072 C", "2736 C", "Reflex Blue C"], raio: 7 },
  { termo: "anil", tipo: "ancora", refs: ["Reflex Blue C", "2758 C"], raio: 7 },  // Escolha: azul-escuro tirante a violeta (sentido de dicionário), não o azul de lavar roupa claro.
  { termo: "indigo", tipo: "ancora", refs: ["2758 C", "2766 C"], raio: 7 },  // Escolha: o índigo do jeans (azul muito escuro). O "indigo" das tabelas da web é roxo.
  { termo: "azul marinho", tipo: "ancora", refs: ["282 C", "2767 C", "289 C"], raio: 7 },
  { termo: "marinho", tipo: "ancora", refs: ["282 C", "2767 C", "289 C"], raio: 7 },
  { termo: "navy", tipo: "ancora", refs: ["282 C", "2767 C", "289 C"], raio: 7 },
  { termo: "azul noite", tipo: "ancora", refs: ["2965 C", "296 C"], raio: 7 },
  { termo: "azul meia noite", tipo: "ancora", refs: ["2965 C", "296 C"], raio: 7 },
  { termo: "classic blue", tipo: "ancora", refs: ["301 C", "2154 C"], raio: 6 },  // Cor do Ano Pantone (guia de tecido, TCX 19-4052); não existe no livro coated. Referências = as mais próximas do hex publicado #0F4C81 (aproximação).
  { termo: "safira", tipo: "ancora", refs: ["2935 C", "2132 C"], raio: 7 },
  { termo: "azul jeans", tipo: "ancora", refs: ["7684 C", "647 C"], raio: 7 },
  { termo: "azul denim", tipo: "ancora", refs: ["7684 C", "647 C"], raio: 7 },
  { termo: "jeans", tipo: "ancora", refs: ["7684 C", "647 C"], raio: 7 },
  { termo: "azul aco", tipo: "ancora", refs: ["5415 C", "7698 C"], raio: 7 },
  { termo: "azul serenity", tipo: "ancora", refs: ["2134 C", "7681 C"], raio: 6 },  // Cor do Ano Pantone (guia de tecido, TCX 15-3919); não existe no livro coated. Referências = as mais próximas do hex publicado #92A8D1 (aproximação).
  { termo: "azul hortensia", tipo: "ancora", refs: ["2716 C", "7451 C"], raio: 7 },
  { termo: "azul piscina", tipo: "ancora", refs: ["2985 C", "298 C"], raio: 7 },
  { termo: "ciano", tipo: "ancora", refs: ["299 C", "2925 C"], raio: 7 },  // Aproximação: o ciano de processo não está no livro; 299 C e 2925 C são os chapados que a gráfica usa como ciano vivo.
  { termo: "agua marinha", tipo: "ancora", refs: ["2975 C", "636 C"], raio: 6 },
  { termo: "azul ceu", tipo: "ancora", refs: ["291 C", "2905 C", "2915 C"], raio: 7 },
  { termo: "celeste", tipo: "ancora", refs: ["284 C", "2915 C"], raio: 7 },
  { termo: "azul calcinha", tipo: "ancora", refs: ["278 C", "2905 C"], raio: 7 },  // Gíria para o azul claro de lingerie: escolha entre o azul bebê e o celeste.
  { termo: "azul bebe", tipo: "ancora", refs: ["277 C", "290 C"], raio: 7 },
  { termo: "azul gelo", tipo: "ancora", refs: ["656 C", "7457 C"], raio: 7 },
  { termo: "roxo nubank", tipo: "ancora", refs: ["266 C", "2592 C"], raio: 7 },  // Aproximação de marca pelo hex público #820AD1; nenhum Pantone do livro fica perto (o mais próximo está a ΔE 6).
  { termo: "very peri", tipo: "ancora", refs: ["7669 C", "2116 C"], raio: 6 },  // Cor do Ano Pantone (guia de tecido, TCX 17-3938); não existe no livro coated. Referências = as mais próximas do hex publicado #6667AB (aproximação).
  { termo: "ultra violet", tipo: "ancora", refs: ["7678 C", "3574 C"], raio: 7 },  // Cor do Ano Pantone (guia de tecido, TCX 18-3838); não existe no livro coated. Referências = as mais próximas do hex publicado #5F4B8B (aproximação).
  { termo: "violeta", tipo: "ancora", refs: ["266 C", "2665 C"], raio: 7 },
  { termo: "ametista", tipo: "ancora", refs: ["2587 C", "2593 C"], raio: 7 },
  { termo: "uva", tipo: "ancora", refs: ["268 C", "2607 C"], raio: 7 },
  { termo: "acai", tipo: "ancora", refs: ["2627 C", "2617 C"], raio: 7 },
  { termo: "berinjela", tipo: "ancora", refs: ["519 C", "7449 C", "5115 C"], raio: 7 },
  { termo: "ameixa", tipo: "ancora", refs: ["249 C", "255 C"], raio: 7 },
  { termo: "purpura", tipo: "ancora", refs: ["248 C", "2425 C"], raio: 7 },  // Escolha: púrpura como roxo avermelhado (sentido de dicionário). O Purple C fica entre os resultados, não é referência.
  { termo: "orquidea", tipo: "ancora", refs: ["252 C", "245 C"], raio: 7 },
  { termo: "malva", tipo: "ancora", refs: ["5145 C", "7654 C"], raio: 7 },
  { termo: "lavanda", tipo: "ancora", refs: ["2645 C", "2635 C"], raio: 7 },
  { termo: "lilas claro", tipo: "ancora", refs: ["530 C", "2635 C"], raio: 6 },
  { termo: "lilas", tipo: "ancora", refs: ["2563 C", "2573 C", "257 C"], raio: 7 },
  { termo: "ouro rose", tipo: "ancora", refs: ["10156 C", "10149 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "ouro rosa", tipo: "ancora", refs: ["10156 C", "10149 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "rose gold", tipo: "ancora", refs: ["10156 C", "10149 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "rosa neon", tipo: "ancora", refs: ["806 C", "812 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "rosa fluor", tipo: "ancora", refs: ["806 C", "812 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "pink neon", tipo: "ancora", refs: ["806 C", "812 C"], raio: 12, somente: "neons" },  // Neon: mostra só os códigos neon perto das referências (a tela não mostra a fluorescência).
  { termo: "rosa choque", tipo: "ancora", refs: ["Rhodamine Red C", "219 C", "806 C"], raio: 8 },
  { termo: "rosa barbie", tipo: "ancora", refs: ["219 C"], raio: 6 },  // Fontes públicas citam o 219 C como o rosa da Barbie.
  { termo: "rosa pink", tipo: "ancora", refs: ["219 C", "213 C", "Pink C"], raio: 7 },
  { termo: "pink", tipo: "ancora", refs: ["219 C", "213 C", "Pink C"], raio: 7 },
  { termo: "viva magenta", tipo: "ancora", refs: ["7636 C", "193 C"], raio: 6 },  // Cor do Ano Pantone (guia de tecido, TCX 18-1750); não existe no livro coated. Referências = as mais próximas do hex publicado #BB2649 (aproximação).
  { termo: "magenta", tipo: "ancora", refs: ["219 C", "226 C", "Rubine Red C"], raio: 7 },  // Aproximação: o magenta de processo não está no livro; 219 C e 226 C são os mais próximos de um magenta de impressão típico.
  { termo: "fucsia", tipo: "ancora", refs: ["233 C", "240 C", "247 C"], raio: 7 },
  { termo: "fuchsia", tipo: "ancora", refs: ["233 C", "240 C", "247 C"], raio: 7 },
  { termo: "pitaya", tipo: "ancora", refs: ["226 C", "233 C"], raio: 7 },
  { termo: "framboesa", tipo: "ancora", refs: ["214 C", "7636 C"], raio: 7 },
  { termo: "rosa chiclete", tipo: "ancora", refs: ["211 C", "2038 C"], raio: 7 },
  { termo: "goiaba", tipo: "ancora", refs: ["177 C", "1777 C"], raio: 7 },
  { termo: "rosa bebe", tipo: "ancora", refs: ["182 C", "189 C"], raio: 7 },
  { termo: "rosa quartzo", tipo: "ancora", refs: ["503 C", "7422 C"], raio: 6 },  // Cor do Ano Pantone (guia de tecido, TCX 13-1520); não existe no livro coated. Referências = as mais próximas do hex publicado #F7CAC9 (aproximação).
  { termo: "rose", tipo: "ancora", refs: ["7605 C", "699 C"], raio: 6 },  // Rosê (a busca tira o acento). Escolha: rosa claro com fundo bege, como em maquiagem e moda.
  { termo: "rosa cha", tipo: "ancora", refs: ["7520 C", "489 C"], raio: 6 },  // Escolha: rosa bem claro puxado para o bege (cor da rosa-chá).
  { termo: "rosa antigo", tipo: "ancora", refs: ["694 C", "5005 C"], raio: 7 },
  { termo: "rosa seco", tipo: "ancora", refs: ["7612 C", "5015 C"], raio: 7 },
  { termo: "rosa queimado", tipo: "ancora", refs: ["695 C", "2447 C"], raio: 8 },
  { termo: "mocha mousse", tipo: "ancora", refs: ["479 C", "4645 C"], raio: 6 },  // Cor do Ano Pantone (guia de tecido, TCX 17-1230); não existe no livro coated. Referências = as mais próximas do hex publicado #A47864 (aproximação).
  { termo: "marrom glace", tipo: "ancora", refs: ["4725 C", "4735 C"], raio: 7 },  // Escolha: marrom claro rosado, como se usa em tinta e moda no Brasil.
  { termo: "cafe com leite", tipo: "ancora", refs: ["4655 C", "4665 C"], raio: 7 },
  { termo: "cafe", tipo: "ancora", refs: ["4625 C", "7533 C"], raio: 7 },
  { termo: "chocolate", tipo: "ancora", refs: ["469 C", "4625 C"], raio: 7 },
  { termo: "cacau", tipo: "ancora", refs: ["4695 C", "7596 C"], raio: 7 },
  { termo: "mogno", tipo: "ancora", refs: ["7595 C", "4975 C", "483 C"], raio: 7 },
  { termo: "conhaque", tipo: "ancora", refs: ["7517 C", "1535 C"], raio: 7 },
  { termo: "tabaco", tipo: "ancora", refs: ["7568 C", "4635 C"], raio: 7 },
  { termo: "couro", tipo: "ancora", refs: ["7516 C", "730 C"], raio: 7 },
  { termo: "caramelo", tipo: "ancora", refs: ["7510 C", "730 C"], raio: 7 },
  { termo: "canela", tipo: "ancora", refs: ["7525 C", "7516 C"], raio: 7 },
  { termo: "castanho", tipo: "ancora", refs: ["4705 C", "478 C"], raio: 7 },
  { termo: "avela", tipo: "ancora", refs: ["4715 C", "7504 C"], raio: 7 },
  { termo: "madeira", tipo: "ancora", refs: ["7505 C", "4635 C"], raio: 8 },
  { termo: "terra", tipo: "ancora", refs: ["7581 C", "4705 C"], raio: 8 },
  { termo: "camelo", tipo: "ancora", refs: ["7508 C", "729 C"], raio: 7 },
  { termo: "caqui", tipo: "ancora", refs: ["7502 C", "4515 C"], raio: 7 },
  { termo: "khaki", tipo: "ancora", refs: ["7502 C", "4515 C"], raio: 7 },
  { termo: "areia", tipo: "ancora", refs: ["7501 C", "4535 C"], raio: 7 },
  { termo: "nude", tipo: "ancora", refs: ["726 C", "7520 C", "4675 C"], raio: 7 },  // Escolha: bege rosado (tom de pele claro).
  { termo: "fendi", tipo: "ancora", refs: ["7530 C", "Warm Gray 7 C"], raio: 7 },  // Marca usada como nome de cor (cinza amarronzado, taupe). Escolha.
  { termo: "bege claro", tipo: "ancora", refs: ["7527 C", "9224 C"], raio: 7 },
  { termo: "bege", tipo: "ancora", refs: ["7501 C", "4685 C"], raio: 7 },
  { termo: "off white", tipo: "ancora", refs: ["9224 C", "9180 C"], raio: 5 },
  { termo: "offwhite", tipo: "ancora", refs: ["9224 C", "9180 C"], raio: 5 },
  { termo: "branco neve", tipo: "ancora", refs: ["9063 C", "9345 C"], raio: 4 },
  { termo: "branco gelo", tipo: "ancora", refs: ["7541 C", "9040 C"], raio: 5 },
  { termo: "branco perola", tipo: "ancora", refs: ["9224 C", "9285 C"], raio: 5 },
  { termo: "marfim", tipo: "ancora", refs: ["9180 C", "9160 C"], raio: 5 },
  { termo: "creme", tipo: "ancora", refs: ["7499 C", "9140 C"], raio: 6 },
  { termo: "cinza perola", tipo: "ancora", refs: ["427 C", "Cool Gray 2 C"], raio: 5 },
  { termo: "perola", tipo: "ancora", refs: ["9224 C", "9285 C"], raio: 5 },  // Escolha: pérola sozinha vira branco pérola (o cinza é só em "cinza perola").
  { termo: "gelo", tipo: "ancora", refs: ["7541 C", "Cool Gray 1 C"], raio: 6 },
  { termo: "cinza prata", tipo: "ancora", refs: ["428 C", "Cool Gray 4 C"], raio: 5 },
  { termo: "cinza rato", tipo: "ancora", refs: ["Warm Gray 8 C", "Cool Gray 8 C"], raio: 6 },
  { termo: "cinza quente", tipo: "ancora", refs: ["Warm Gray 3 C", "Warm Gray 7 C", "Warm Gray 11 C"], raio: 5 },
  { termo: "cinza frio", tipo: "ancora", refs: ["Cool Gray 3 C", "Cool Gray 7 C", "Cool Gray 11 C"], raio: 5 },
  { termo: "fumaca", tipo: "ancora", refs: ["430 C", "7544 C"], raio: 6 },
  { termo: "cinza chumbo", tipo: "ancora", refs: ["Cool Gray 11 C", "425 C"], raio: 7 },
  { termo: "chumbo", tipo: "ancora", refs: ["Cool Gray 11 C", "425 C"], raio: 7 },
  { termo: "grafite", tipo: "ancora", refs: ["7540 C", "446 C"], raio: 7 },
  { termo: "carvao", tipo: "ancora", refs: ["426 C", "447 C"], raio: 6 },
  { termo: "preto onix", tipo: "ancora", refs: ["Black 6 C", "Black C"], raio: 6 },
  { termo: "ouro velho", tipo: "ancora", refs: ["873 C", "7557 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela). O 7557 C (chapado) entra como referência para quem quer o ouro velho sem metálico.
  { termo: "dourado", tipo: "ancora", refs: ["871 C", "10122 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "ouro", tipo: "ancora", refs: ["871 C", "10122 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "prateado", tipo: "ancora", refs: ["877 C", "10103 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "prata", tipo: "ancora", refs: ["877 C", "10103 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "cobre", tipo: "ancora", refs: ["876 C", "10152 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "bronze", tipo: "ancora", refs: ["875 C", "10140 C"], raio: 7, somente: "metalicos" },  // Metálico: mostra só os códigos metálicos perto das referências (o Lab medido do metálico parece fosco na tela).
  { termo: "vermelho claro", tipo: "faixa", familias: ["vermelho"], L: [52, 100] },
  { termo: "vermelho escuro", tipo: "faixa", familias: ["vermelho"], L: [0, 35] },
  { termo: "vermelho vivo", tipo: "faixa", familias: ["vermelho"], croma: [60, 999] },
  { termo: "vermelho", tipo: "faixa", familias: ["vermelho"] },
  { termo: "vermelha", tipo: "faixa", familias: ["vermelho"] },
  { termo: "avermelhado", tipo: "faixa", familias: ["vermelho"] },
  { termo: "rubro", tipo: "faixa", familias: ["vermelho"], croma: [55, 999] },
  { termo: "laranja claro", tipo: "faixa", familias: ["laranja"], L: [72, 100] },
  { termo: "laranja escuro", tipo: "faixa", familias: ["laranja"], L: [0, 55] },
  { termo: "laranja vivo", tipo: "faixa", familias: ["laranja"], croma: [65, 999] },
  { termo: "laranja", tipo: "faixa", familias: ["laranja"] },
  { termo: "alaranjado", tipo: "faixa", familias: ["laranja"] },
  { termo: "amarelo claro", tipo: "faixa", familias: ["amarelo"], L: [86, 100] },
  { termo: "amarelo escuro", tipo: "faixa", familias: ["amarelo"], L: [0, 65] },
  { termo: "amarelo vivo", tipo: "faixa", familias: ["amarelo"], croma: [70, 999] },
  { termo: "amarelo pastel", tipo: "faixa", familias: ["amarelo"], L: [85, 100], croma: [0, 45] },
  { termo: "amarelo", tipo: "faixa", familias: ["amarelo"] },
  { termo: "amarela", tipo: "faixa", familias: ["amarelo"] },
  { termo: "amarelado", tipo: "faixa", familias: ["amarelo"] },
  { termo: "verde claro", tipo: "faixa", familias: ["verde"], L: [70, 100] },
  { termo: "verde escuro", tipo: "faixa", familias: ["verde"], L: [0, 42] },
  { termo: "verde vivo", tipo: "faixa", familias: ["verde"], croma: [55, 999] },
  { termo: "verde pastel", tipo: "faixa", familias: ["verde"], L: [75, 100], croma: [0, 35] },
  { termo: "verde", tipo: "faixa", familias: ["verde"] },
  { termo: "esverdeado", tipo: "faixa", familias: ["verde"] },
  { termo: "azul claro", tipo: "faixa", familias: ["azul"], L: [65, 100] },
  { termo: "azul escuro", tipo: "faixa", familias: ["azul"], L: [0, 32] },
  { termo: "azul vivo", tipo: "faixa", familias: ["azul"], croma: [45, 999] },
  { termo: "azul pastel", tipo: "faixa", familias: ["azul"], L: [70, 100], croma: [0, 30] },
  { termo: "azul acinzentado", tipo: "faixa", familias: ["azul"], croma: [0, 20] },
  { termo: "azul", tipo: "faixa", familias: ["azul"] },
  { termo: "azuis", tipo: "faixa", familias: ["azul"] },
  { termo: "azulado", tipo: "faixa", familias: ["azul"] },
  { termo: "roxo claro", tipo: "faixa", familias: ["rosa"], L: [60, 100], matiz: [270, 330] },
  { termo: "roxo escuro", tipo: "faixa", familias: ["rosa"], L: [0, 35], matiz: [270, 330] },
  { termo: "roxo vivo", tipo: "faixa", familias: ["rosa"], croma: [50, 999], matiz: [270, 330] },
  { termo: "roxo", tipo: "faixa", familias: ["rosa"], matiz: [270, 330] },
  { termo: "roxa", tipo: "faixa", familias: ["rosa"], matiz: [270, 330] },
  { termo: "arroxeado", tipo: "faixa", familias: ["rosa"], matiz: [270, 330] },
  { termo: "rosa claro", tipo: "faixa", familias: ["rosa"], L: [70, 100], matiz: [330, 50] },
  { termo: "rosa escuro", tipo: "faixa", familias: ["rosa"], L: [0, 45], matiz: [330, 50] },
  { termo: "rosa vivo", tipo: "faixa", familias: ["rosa"], croma: [55, 999], matiz: [330, 50] },
  { termo: "rosa pastel", tipo: "faixa", familias: ["rosa"], L: [75, 100], croma: [0, 35], matiz: [330, 50] },
  { termo: "rosa", tipo: "faixa", familias: ["rosa"], matiz: [330, 50] },
  { termo: "rosado", tipo: "faixa", familias: ["rosa"], matiz: [330, 50] },
  { termo: "marrom claro", tipo: "faixa", familias: ["marrom"], L: [55, 100] },
  { termo: "marrom escuro", tipo: "faixa", familias: ["marrom"], L: [0, 38] },
  { termo: "marrom", tipo: "faixa", familias: ["marrom"] },
  { termo: "amarronzado", tipo: "faixa", familias: ["marrom"] },
  { termo: "cinza claro", tipo: "faixa", familias: ["neutro"], L: [70, 88] },
  { termo: "cinza medio", tipo: "faixa", familias: ["neutro"], L: [45, 70] },
  { termo: "cinza escuro", tipo: "faixa", familias: ["neutro"], L: [22, 45] },
  { termo: "cinza", tipo: "faixa", familias: ["neutro"], L: [25, 88] },
  { termo: "cinzento", tipo: "faixa", familias: ["neutro"], L: [25, 88] },
  { termo: "acinzentado", tipo: "faixa", familias: ["neutro"], L: [25, 88] },
  { termo: "preto fosco", tipo: "faixa", familias: ["neutro"], L: [0, 26] },  // Fosco é acabamento (verniz), não muda o Pantone: mesma faixa de preto.
  { termo: "preto", tipo: "faixa", familias: ["neutro"], L: [0, 26] },
  { termo: "preta", tipo: "faixa", familias: ["neutro"], L: [0, 26] },
  { termo: "branco", tipo: "faixa", familias: ["neutro"], L: [88, 100] },
  { termo: "branca", tipo: "faixa", familias: ["neutro"], L: [88, 100] },
  { termo: "pastel", tipo: "faixa", familias: ["amarelo", "laranja", "vermelho", "rosa", "azul", "verde"], L: [80, 100], croma: [8, 35] },
  { termo: "vermelhos", tipo: "faixa", familias: ["vermelho"] },
  { termo: "verdes", tipo: "faixa", familias: ["verde"] },
  { termo: "amarelos", tipo: "faixa", familias: ["amarelo"] },
  { termo: "laranjas", tipo: "faixa", familias: ["laranja"] },
  { termo: "rosas", tipo: "faixa", familias: ["rosa"] },
  { termo: "marrons", tipo: "faixa", familias: ["marrom"] },
  { termo: "neutro", tipo: "faixa", familias: ["neutro"] },
  { termo: "neutros", tipo: "faixa", familias: ["neutro"] },
];

const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** O nome de cor dentro da busca, em palavras inteiras: "caramelo" não casa
    com "mel", nem "dourado" com "ouro". Hífen vira espaço ("verde-água"). */
export function nomeDaBusca(consulta: string): NomeDeCor | null {
  const q = ` ${semAcento(consulta).replace(/[^a-z0-9]+/g, " ").trim()} `;
  if (!q.trim()) return null;
  for (const n of NOMES_DE_COR) if (q.includes(` ${n.termo} `)) return n;
  return null;
}

type Lab = readonly [number, number, number];
/** Diferença entre duas cores pelo CIEDE2000, a conta do mercado gráfico
    (abaixo de 1 o olho não separa as duas). */
export function de2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const ang = (a: number, b: number) => { if (a === 0 && b === 0) return 0; const x = Math.atan2(b, a) / rad; return x < 0 ? x + 360 : x; };
  const h1p = ang(a1p, b1), h2p = ang(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * rad);
  const Lm = (L1 + L2) / 2, Cmp = (C1p + C2p) / 2;
  let hm = h1p + h2p;
  if (C1p * C2p !== 0) hm = Math.abs(h1p - h2p) > 180 ? (h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2) : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dth = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cmp ** 7 / (Cmp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cmp, Sh = 1 + 0.015 * Cmp * T;
  const Rt = -Math.sin(2 * dth * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}
