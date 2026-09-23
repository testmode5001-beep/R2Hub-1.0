// Animações Lottie da geração 1.0.
//
// O protótipo carrega o lottie-web de um CDN. Aqui ele é dependência do
// projeto: o hub roda na rede interna da fábrica e não dá para depender de
// cdnjs estar acessível — a animação simplesmente não apareceria.
//
// O import é dinâmico porque a biblioteca mexe em DOM na avaliação do módulo,
// e esta rota passa por SSR.
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

type Anim = { destroy: () => void; goToAndPlay: (valor: number, ehQuadro?: boolean) => void; totalFrames: number };

/** Caminhos servidos de /public/p10. */
export const LOTTIE = {
  ondasRoxo: "/p10/waves-roxo.json",
  ondasAmarelo: "/p10/waves-hub.json",
  chat: "/p10/lottieflow-chat-17-5-000000-easey.json",
  seta: "/p10/lottieflow-scroll-down-04-2-000000-easey.json",
  sucesso: "/p10/lottieflow-success-02-000000-easey.json",
} as const;

export function LottieHub10({ src, loop = true, className, style, ariaHidden = true, inicio = 0, encaixe = "meet" }: {
  src: string;
  loop?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaHidden?: boolean;
  /** Onde começar no laço, de 0 a 1. Serve para dessincronizar animações
      iguais que aparecem lado a lado — juntas elas pulsam em uníssono e os
      cards leem como um painel só. */
  inicio?: number;
  /** "slice" preenche a caixa e corta o que sobra — é o certo para as ondas,
      que são fundo do card. "meet" cabe inteira dentro, sem corte, que é o
      certo para ícones: o JSON do chat é 904×804 e num quadrado de 64 o slice
      decepava as laterais. */
  encaixe?: "slice" | "meet";
}) {
  const caixa = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    /* Respeita quem desligou animação no sistema: a Lottie não obedece a
       prefers-reduced-motion sozinha, e as ondas são decorativas. */
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let vivo = true;
    let anim: Anim | null = null;
    void import("lottie-web")
      .then((mod) => {
        if (!vivo || !caixa.current) return;
        anim = mod.default.loadAnimation({
          container: caixa.current,
          renderer: "svg",
          loop,
          autoplay: true,
          path: src,
          rendererSettings: { preserveAspectRatio: `xMidYMid ${encaixe}` },
        }) as unknown as Anim;
        /* O salto só pode ser dado depois que o JSON chegou: antes disso
           totalFrames é 0 e goToAndPlay não tem para onde ir. O evento
           "DOMLoaded" não se mostrou confiável aqui (as animações continuavam
           todas no mesmo quadro), então é tentativa com limite — o mesmo
           padrão usado para medir o papel de parede em vídeo na Home. */
        if (inicio > 0) {
          let tentativas = 0;
          const pular = () => {
            if (!vivo || !anim) return;
            if (!anim.totalFrames) {
              if (tentativas++ < 40) setTimeout(pular, 50);
              return;
            }
            anim.goToAndPlay(Math.floor((inicio % 1) * anim.totalFrames), true);
          };
          pular();
        }
      })
      .catch(() => { /* sem animação é só perda decorativa — a tela funciona */ });

    return () => { vivo = false; anim?.destroy(); };
    /* `src` na dependência é de propósito: trocar o arquivo (ondas roxas →
       amarelas quando o status muda) tem de remontar a animação, senão a cor
       antiga fica na tela. */
  }, [src, loop, inicio, encaixe]);

  return <div ref={caixa} className={className} style={style} aria-hidden={ariaHidden} />;
}
