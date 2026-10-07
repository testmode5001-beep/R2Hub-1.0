// A paleta do hub 1.0 e o teste da paleta nova.
//
// Augusto, 05/10/2026: "as cores do hub serão as que seguem na ilustração em
// anexo", "veja as cores que o formfrom design usa, vamos testá-las nos cards
// do hub" e "vamos testar com a nova paleta de cores". As cores novas saíram
// dos pixels: fundo, amarelo e roxo da ilustração que ele mandou (a "Crypto
// insights" da FormFrom, na versão amarela e roxa); as dos cartões de status,
// das outras ilustrações da FormFrom (formfrom.design).
//
// Só no hub de teste (vite dev): abre na paleta nova e Alt+C alterna com a de
// hoje (a página recarrega). A produção segue com a de hoje até ele aprovar;
// aprovando, a nova vira a única e o teste sai.

export type NomePaleta = "hoje" | "nova";

const CHAVE = "r2hub.teste.paleta";

/* O servidor de teste também responde "nova": era "hoje" no servidor e "nova"
   no navegador, e o React acusava hidratação diferente a cada carregamento
   (achado do agente de buscas, 05/10/2026). Só quem escolheu "hoje" no Alt+C
   ainda difere do servidor, e só no hub de teste. */
export function paletaEmTeste(): NomePaleta {
  if (!import.meta.env.DEV) return "hoje";
  if (typeof window === "undefined") return "nova";
  try { return localStorage.getItem(CHAVE) === "hoje" ? "hoje" : "nova"; } catch { return "nova"; }
}

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

const HOJE: Paleta = {
  fundo: "#ece9ea",
  amarelo: "#fff079",
  amareloForte: "#FFE815",
  lilas: "#aba9fc",
  azulCartao: "#79cdf4",
  espectro: ["#fff079", "#e2ec7c", "#c5e980", "#a8e583", "#8be287", "#6ede8a", "#70db9f", "#72d7b4",
    "#75d4ca", "#77d0df", "#79cdf4", "#83c6f6", "#8dbff7", "#97b7f9", "#a1b0fa", "#aba9fc"],
  perigo: "#b3352f",
  perigoTinta: "#ffffff",
  confere: "#000000",
  confereTraco: "#ffffff",
  sino: "#f96767",
  sinoTinta: "#ffffff",
};

/* o amarelo é um só na ilustração (#ffce22), e o "+" fica com ele; o degradê
   de Arquivos passa pelas cores novas dos cartões (amarelo, lima, ciano e
   roxo), em passos iguais de OKLab, como o de hoje */
const NOVA: Paleta = {
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

export const PALETA: Paleta = paletaEmTeste() === "nova" ? NOVA : HOJE;

if (import.meta.env.DEV && typeof window !== "undefined") {
  /* o CSS também tem amarelo (marca-texto do Novo pedido, botão da entrada).
     Vai numa <style> do <head>, não no atributo style do <html>: o React
     confere o <html> na hidratação e pula o que entra a mais no <head>. */
  if (paletaEmTeste() === "nova" && !document.getElementById("r2-paleta-teste")) {
    const s = document.createElement("style");
    s.id = "r2-paleta-teste";
    s.textContent = `:root{--amarelo-marca:${NOVA.amarelo};--yellow:${NOVA.amarelo}}::selection{background:${NOVA.lilas};color:#000}`;
    document.head.appendChild(s);
  }
  const w = window as unknown as { __r2PaletaTeste?: boolean };
  if (!w.__r2PaletaTeste) {
    w.__r2PaletaTeste = true;
    window.addEventListener("keydown", (ev) => {
      if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.code !== "KeyC") return;
      ev.preventDefault();
      try { localStorage.setItem(CHAVE, paletaEmTeste() === "nova" ? "hoje" : "nova"); } catch { return; }
      window.location.reload();
    });
  }
}
