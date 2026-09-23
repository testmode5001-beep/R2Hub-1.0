// Zoom do Hub — preferência do COMPUTADOR, não da conta (quem senta na
// máquina da produção acerta o tamanho daquele monitor; a mesma pessoa noutro
// PC não é afetada).
//
// Um número só: a porcentagem. 100% = texto no tamanho de projeto (o mesmo
// corpo que o desenho pede) sempre que a janela tiver pelo menos LARGURA_MIN.
// Abaixo de 100% o palco alarga e tudo encolhe até caber na tela; acima, o
// conteúdo passa da janela e ela rola.
const CHAVE = "r2hub.v1a.zoom.pct";

/** Altura de projeto do palco (a mesma do HubV1a). */
export const ALTURA_PADRAO = 1290;

/**
 * Largura de projeto MÍNIMA. Medido tela a tela em 05/08/2026 estreitando o
 * palco e procurando conteúdo cortado: tudo aguenta 1400px (a Central estoura
 * em 1350 e Pedidos em 1280). 1440 dá folga. É o que permite ao texto crescer
 * em monitor pequeno — só encolher a escala de um palco de 1920 deixa tudo
 * miúdo.
 */
export const LARGURA_MIN = 1440;

/**
 * Em monitor CURTO (16:9 de 768/720 pontos de altura) o palco de 1290 obrigava
 * a escala a cair para ~0,60 e o texto ficava ilegível. Antes de encolher a
 * letra, o palco agora encolhe a PRÓPRIA ALTURA (até ALTURA_MIN): as telas
 * comprimem as áreas internas (que já rolam) e a escala sobe para perto de
 * ESCALA_LEGIVEL. Monitor com altura folgada não muda nada.
 */
export const ALTURA_MIN = 960;
/* 0,80 deixa o corpo de 15px com 12px na tela — o piso do confortável.
   (0,72 foi a primeira tentativa; o usuário conferiu num 1366×768 real e
   ainda achou pequeno.) */
export const ESCALA_LEGIVEL = 0.8;

export const PCT_MIN = 50;
export const PCT_MAX = 200;
export const PASSO_PCT = 10;

const limita = (n: number) => Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(n)));

/** Porcentagem em que tudo cabe na tela, sem rolar. */
export function pctQueCabe(larguraJanela: number, alturaJanela: number, altura = ALTURA_PADRAO): number {
  const base = larguraJanela / Math.max(LARGURA_MIN, larguraJanela);
  const alturaMin = Math.min(ALTURA_MIN, altura);
  // escala com o palco na altura cheia; se ficar ilegível, deixa o palco
  // encolher a altura (até alturaMin) para a escala subir até o teto legível
  const cheia = alturaJanela / altura;
  const comprimida = Math.min(alturaJanela / alturaMin, ESCALA_LEGIVEL);
  const cabe = Math.min(larguraJanela / LARGURA_MIN, Math.max(cheia, comprimida));
  return limita((cabe / base) * 100);
}

/** Primeira vez na máquina: a página INTEIRA cabe na tela, sem rolagem — o
    padrão de sempre. Quem quiser letra maior sobe a porcentagem na topbar (e
    aí a tela rola, mas é escolha de quem está usando). */
export function pctSugerido(): number {
  if (typeof window === "undefined") return 100;
  return pctQueCabe(window.innerWidth, window.innerHeight);
}

export function lerZoomPct(): number {
  if (typeof window === "undefined") return 100;
  try {
    const n = parseInt(localStorage.getItem(CHAVE) ?? "", 10);
    return Number.isFinite(n) ? limita(n) : pctSugerido();
  } catch { return 100; }
}

export function gravarZoomPct(n: number) {
  try {
    localStorage.setItem(CHAVE, String(limita(n)));
    // avisa os palcos abertos nesta aba (o evento `storage` só cruza abas)
    window.dispatchEvent(new Event("r2hub-zoom"));
  } catch { /* storage bloqueado */ }
}

/**
 * A conta do palco, em um lugar só (EstagioV1a e usePalcoLargura usam esta).
 * `larguraPalco` é a largura de PROJETO: abaixo de 100% ela cresce (o palco
 * estica e o conteúdo encolhe até caber); em 100% fica na largura da janela
 * (piso LARGURA_MIN) e acima passa disso, com rolagem lateral.
 */
export function medidasDoPalco(
  larguraJanela: number, alturaJanela: number, pct: number, altura = ALTURA_PADRAO,
): { escala: number; larguraPalco: number; alturaPalco: number } {
  const base = larguraJanela / Math.max(LARGURA_MIN, larguraJanela);
  const escala = base * (pct / 100);
  const larguraPalco = Math.max(LARGURA_MIN, larguraJanela / escala);
  // a altura do palco acompanha a janela: comprime até alturaMin antes de
  // deixar a página rolar (e nunca passa da altura de projeto)
  const alturaMin = Math.min(ALTURA_MIN, altura);
  const alturaPalco = Math.round(Math.min(altura, Math.max(alturaMin, alturaJanela / escala)));
  return { escala, larguraPalco, alturaPalco };
}
