// O encaixe das trilhas de cartões (Pedidos, as capas v4 e os painéis do
// pedido aberto), feito pela conta no lugar do scroll-snap do CSS.
//
// Augusto, 07/10/2026: "revise o scroll dos cards em pedidos, alguns tem um
// comportamento estranho no scroll". Medido no hub de teste: o snap do
// navegador encaixa pela caixa do cartão já transformada, e o cartão em hover
// sobe 8 px e cresce 3,5%. Com o mouse no cartão da esquerda, a trilha parava
// e escorregava mais 8 px (432 em vez de 440), fora da coluna, e o giro
// seguinte andava 448 para voltar. No arrasto, cada passo era desfeito pelo
// snap: a trilha ficava parada e pulava um cartão inteiro de uma vez.
//
// Aqui o encaixe sai do layout (a largura do cartão, que o transform não
// muda): a roda anda um cartão por giro, contado a partir do destino (giros
// seguidos não recomeçam do meio do caminho); o arrasto segue a mão; e quando
// a rolagem para (arrasto solto, trackpad, Tab do teclado), a trilha anda até
// o cartão mais perto.
import { useCallback, useEffect, useRef, type RefObject } from "react";

/* a trava do trackpad: um giro dele dispara dezenas de eventos */
const TRAVA_MS = 220;
/* parada de rolar por este tempo, a trilha assenta no cartão mais perto */
const ASSENTA_MS = 250;

type Opcoes = {
  /** os cartões que encaixam, todos da mesma largura; o primeiro começa no ponto zero */
  seletor: string;
  /** true enquanto a pessoa arrasta: a trilha só assenta depois que ela solta */
  arrastando: () => boolean;
  /** false deixa o giro com quem está embaixo do mouse (um painel que rola por dentro) */
  podeGirar?: (e: WheelEvent) => boolean;
};

/** Liga o encaixe na trilha e devolve o "encaixar já" (para soltar um arrasto). */
export function useEncaixeDaTrilha(trilha: RefObject<HTMLElement | null>, opcoes: Opcoes): () => void {
  const atual = useRef(opcoes);
  atual.current = opcoes;
  const encaixarRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = trilha.current;
    if (!el) return;
    el.style.scrollSnapType = "none";
    const passo = () => el.querySelector<HTMLElement>(atual.current.seletor)?.offsetWidth || 0;
    const limite = (x: number) => Math.min(Math.max(0, el.scrollWidth - el.clientWidth), Math.max(0, x));
    const perto = (x: number) => { const p = passo(); return p ? limite(Math.round(x / p) * p) : x; };
    /* o cartão seguinte para um lado: de 432 (fora da coluna) um giro vai a
       440, e não a 872 */
    const seguinte = (x: number, lado: number) => {
      const p = passo();
      if (!p) return x;
      const k = lado > 0 ? Math.floor(x / p + 0.01) + 1 : Math.ceil(x / p - 0.01) - 1;
      return limite(k * p);
    };

    let destino: number | null = null;
    let liberadoEm = 0;
    const aoRodar = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (atual.current.podeGirar && !atual.current.podeGirar(e)) return;
      e.preventDefault();
      const agora = performance.now();
      if (agora < liberadoEm) return;
      liberadoEm = agora + TRAVA_MS;
      destino = seguinte(destino ?? el.scrollLeft, Math.sign(e.deltaY));
      el.scrollTo({ left: destino, behavior: "smooth" });
    };

    const encaixar = () => {
      destino = null;
      const x = el.scrollLeft, alvo = perto(x);
      if (Math.abs(alvo - x) > 1) el.scrollTo({ left: alvo, behavior: "smooth" });
    };
    encaixarRef.current = encaixar;
    let espera = 0;
    const assentar = () => {
      espera = 0;
      if (atual.current.arrastando()) { espera = window.setTimeout(assentar, ASSENTA_MS); return; }
      encaixar();
    };
    const aoRolar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(assentar, ASSENTA_MS);
    };

    el.addEventListener("wheel", aoRodar, { passive: false });
    el.addEventListener("scroll", aoRolar, { passive: true });
    return () => {
      el.removeEventListener("wheel", aoRodar);
      el.removeEventListener("scroll", aoRolar);
      window.clearTimeout(espera);
      encaixarRef.current = () => {};
    };
  }, [trilha]);

  return useCallback(() => encaixarRef.current(), []);
}
