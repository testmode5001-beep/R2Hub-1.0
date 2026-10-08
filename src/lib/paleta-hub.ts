// A paleta do hub 1.0.
//
// Augusto, 05/10/2026: "as cores do hub serão as que seguem na ilustração em
// anexo", "veja as cores que o formfrom design usa, vamos testá-las nos cards
// do hub" e "vamos testar com a nova paleta de cores". As cores saíram dos
// pixels: fundo, amarelo e roxo da ilustração que ele mandou (a "Crypto
// insights" da FormFrom, na versão amarela e roxa); as dos cartões de status,
// das outras ilustrações da FormFrom (formfrom.design).
//
// Ficou em teste de 05 a 08/10/2026: o hub de teste abria nela e o Alt+C
// alternava com a de antes. Aprovada em 08/10/2026 ("a paleta nova com
// certeza"), virou a única e o teste saiu. O amarelo da marca e a cor da
// seleção, que o CSS também usa, estão no styles.css.

type Paleta = {
  /** fundo das páginas v4 */
  fundo: string;
  /** o amarelo de tudo que fica aceso (pílula ligada, marca-texto, destaque) */
  amarelo: string;
  /** o amarelo do "+" e dos botões de ação */
  amareloForte: string;
  /** o lilás da agenda, das calculadoras e do card "Criação" */
  lilas: string;
  /** os cartões de Facas (o mesmo azul do "Design criado") */
  azulCartao: string;
  /** o degradê dos cartões de Arquivos, do amarelo ao lilás */
  espectro: string[];
  /** ação que apaga ou cancela (Excluir, Cancelar pedido) e erro: o vermelho
      de hoje; na paleta nova, o roxo (Augusto, 05/10/2026: "em situações como
      a circulada vamos usar o roxo da nova paleta") */
  perigo: string;
  /** a letra sobre o fundo `perigo` (branca no vermelho, preta no roxo) */
  perigoTinta: string;
  /** o selo do ✓ (etapa completa, acabamento escolhido): preto hoje, roxo na
      nova ("área sinalizada ficará no roxo do hub") */
  confere: string;
  /** o traço do ✓ sobre o selo */
  confereTraco: string;
  /** o número de recados novos no sino */
  sino: string;
  sinoTinta: string;
};

/* o amarelo é um só na ilustração (#ffce22), e o "+" fica com ele; o degradê
   de Arquivos passa pelas cores novas dos cartões (amarelo, lima, ciano e
   roxo), em passos iguais de OKLab, como o de hoje */
export const PALETA: Paleta = {
  fundo: "#f3f0f1",
  amarelo: "#ffce22",
  amareloForte: "#ffce22",
  lilas: "#a66cff",
  azulCartao: "#666bff",
  espectro: ["#ffce22", "#f7d61e", "#eede19", "#e5e614", "#dbee0b", "#d0f500", "#b4ed6a", "#96e494",
    "#75dab4", "#4fcfcf", "#00c3e8", "#54b4ed", "#73a4f2", "#8893f7", "#9981fb", "#a66cff"],
  /* o roxo com letra preta (5,2 de contraste); o roxo como letra sobre o branco
     dá 3,4, que passa em botão e texto grande, não em texto miúdo */
  perigo: "#a66cff",
  perigoTinta: "#000000",
  confere: "#a66cff",
  confereTraco: "#000000",
  sino: "#a66cff",
  sinoTinta: "#000000",
};
