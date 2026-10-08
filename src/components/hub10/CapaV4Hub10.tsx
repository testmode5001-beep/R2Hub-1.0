// Capa no molde do rework v4 (os desenhos do Augusto em hubv3/v4, 01/10/2026),
// para as páginas que entram no rework sem desenho próprio (Augusto,
// 02/10/2026: Calculadoras, Arquivos e Pantones, "só a capa").
//
// O molde é o de Pedidos e o da capa da Solicitação: a página no cinza da barra
// ao pé, sem a faixa preta; os cartões soltos, com raio e sombra, da c1 à c23,
// o da direita por cima (a ordem do desenho da Solicitação); o que passa das
// colunas some e entra rolando, um cartão por giro, com a seta animada na
// margem; no pé, o título em Fraunces 104 com a tinta na c1 e a base na linha
// 63, e o resumo em duas linhas à direita, terminando na c23. Dentro do
// cartão, o rótulo, o título e a linha de baixo ficam onde o cartão da capa da
// Solicitação os põe.
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as KeyboardEventReact, PointerEvent as PointerEventReact, ReactNode } from "react";

import { FR, INTER, LINHA_DA_GRADE_HUB, PRETO } from "./ChromeHub10";
import { baseFraunces, baseInter, folgaDireitaInter, folgaFR, folgaIN } from "./grade-hub10";
import { SetaDaTrilha } from "./LottieHub10";
import { useEncaixeDaTrilha } from "./trilha-encaixe";

const LG = LINHA_DA_GRADE_HUB;

/** As medidas do molde: topo na linha 9, cartão de 440 por 720, a sombra do
    Illustrator (7/7, desfoque 21, 20%) e o pé na linha 63. */
export const CAPA_V4 = { topo: 9 * LG, cartao: 440, altura: 720, raio: 20, sombra: "7px 7px 42px rgba(0,0,0,.2)", basePe: 63 * LG };

/** Dentro do cartão: as posições do cartão da capa da Solicitação. */
export const DENTRO_V4 = { rotuloX: 51.69, rotuloBase: 81.66, tituloX: 48.64, tituloBase: 164.08, descX: 46, descBase: 637.16, descLargura: 330 };

/** O rótulo do alto do cartão, em Inter 24 com a tinta na coluna de dentro. */
export function RotuloV4({ texto, style }: { texto: string; style?: CSSProperties }) {
  return (
    <span style={{ position: "absolute", left: DENTRO_V4.rotuloX - folgaIN(400, 24, texto.charAt(0)), top: DENTRO_V4.rotuloBase - baseInter(24, 24),
      fontFamily: INTER, fontSize: 24, lineHeight: "24px", letterSpacing: "-.02em", whiteSpace: "nowrap", ...style }}>{texto}</span>
  );
}

/** O título do cartão, em Fraunces 70 com entrelinha 60, uma linha por item. */
export function TituloV4({ linhas, style }: { linhas: string[]; style?: CSSProperties }) {
  return (
    <span style={{ position: "absolute", left: DENTRO_V4.tituloX, top: DENTRO_V4.tituloBase - baseFraunces(70, 60), ...FR, fontSize: 70, lineHeight: "60px", letterSpacing: "-.02em", whiteSpace: "nowrap", ...style }}>
      {linhas.map((l, i) => <Fragment key={i}>{i ? <br /> : null}{l}</Fragment>)}
    </span>
  );
}

/** A linha de baixo do cartão (o que ele faz), em Inter 24. */
export function DescricaoV4({ texto, style }: { texto: string; style?: CSSProperties }) {
  return (
    <span style={{ position: "absolute", left: DENTRO_V4.descX - folgaIN(400, 24, texto.charAt(0)), top: DENTRO_V4.descBase - baseInter(24, 29), width: DENTRO_V4.descLargura,
      fontFamily: INTER, fontSize: 24, lineHeight: "29px", letterSpacing: "-.035em", ...style }}>{texto}</span>
  );
}

/** O cartão: botão de 440 por 720 (ou da largura pedida), com raio, sombra e o
    passar do mouse de Pedidos (.pd4-cartao: sobe, cresce e vem para a frente). */
export function CartaoV4({ indice, cor, aoAbrir, rotulo, largura = CAPA_V4.cartao, children }: {
  indice: number; cor: string; aoAbrir: () => void; rotulo: string; largura?: number; children: ReactNode;
}) {
  return (
    <button type="button" onClick={aoAbrir} aria-label={rotulo} className="pd4-cartao"
      style={{ position: "relative", flex: `0 0 ${largura}px`, height: CAPA_V4.altura, padding: 0, border: "none", borderRadius: CAPA_V4.raio, background: cor,
        boxShadow: CAPA_V4.sombra, zIndex: indice + 1, cursor: "pointer", color: PRETO, textAlign: "left", font: "inherit" }}>
      {children}
    </button>
  );
}

/** A trilha dos cartões: começa na c1 (ou em `inicio`, depois de um painel),
    anda um cartão por giro da roda, aceita arrastar, e o cartão cujo meio sai
    da janela (do começo à c23) some (a sombra dos de dentro fica inteira). Vai
    de 40 a 957, por baixo da barra transparente, para a sombra do cartão no
    hover não sair cortada. */
export function TrilhaV4({ quantos, oculta = false, inicio = 80, largura = CAPA_V4.cartao, rotulo, aoTeclar, children }: {
  quantos: number; oculta?: boolean;
  /** onde o primeiro cartão começa (80, a c1; 720 depois do painel da busca) */
  inicio?: number;
  /** a largura de cada cartão, para saber se a fileira passa da c23 */
  largura?: number;
  /** nome do grupo para o leitor de tela */
  rotulo?: string;
  aoTeclar?: (e: KeyboardEventReact<HTMLDivElement>) => void;
  children: ReactNode;
}) {
  const trilha = useRef<HTMLDivElement | null>(null);
  const [rolou, setRolou] = useState(false);
  const rola = quantos * largura > 1840 - inicio + 0.5;

  /* a janela de c1 a c23, direto no DOM (a rolagem dispara dezenas de vezes) */
  const atualizarJanela = useCallback(() => {
    const el = trilha.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>(".pd4-cartao").forEach((c) => {
      const meio = c.offsetLeft + c.offsetWidth / 2 - el.scrollLeft;
      const dentro = meio >= inicio && meio <= 1840;
      c.style.opacity = dentro ? "" : "0";
      c.style.pointerEvents = dentro ? "" : "none";
    });
  }, [inicio]);
  useLayoutEffect(() => { atualizarJanela(); }, [quantos, atualizarJanela]);
  const quadro = useRef(0);
  const aoRolar = () => {
    setRolou(true);
    cancelAnimationFrame(quadro.current);
    quadro.current = requestAnimationFrame(atualizarJanela);
  };

  /* arrastar com o ponteiro; o clique que fecha um arrasto não abre o cartão */
  const arrasto = useRef({ ativo: false, x0: 0, scroll0: 0, escala: 1, andou: false });
  const aoApontar = (e: PointerEventReact<HTMLDivElement>) => {
    const el = trilha.current;
    if (!el || e.button !== 0) return;
    /* com o palco em escala, a trilha anda o que a mão andou */
    const escala = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
    arrasto.current = { ativo: true, x0: e.clientX, scroll0: el.scrollLeft, escala, andou: false };
  };
  /* a roda anda um cartão por giro, e o encaixe no cartão é pela conta
     (trilha-encaixe.ts): o scroll-snap do CSS media o cartão em hover e
     deixava a trilha 8 px fora da coluna, e prendia o arrasto */
  const encaixar = useEncaixeDaTrilha(trilha, { seletor: ".pd4-cartao", arrastando: () => arrasto.current.ativo });
  useEffect(() => {
    /* soltou depois de arrastar: a trilha anda até o cartão mais perto */
    const soltar = () => {
      const a = arrasto.current;
      if (!a.ativo) return;
      a.ativo = false;
      if (a.andou) encaixar();
    };
    const mover = (e: PointerEvent) => {
      const a = arrasto.current, el = trilha.current;
      if (!a.ativo || !el) return;
      if (e.buttons === 0) { soltar(); return; }
      const d = e.clientX - a.x0;
      if (Math.abs(d) > 4) { a.andou = true; setRolou(true); }
      el.scrollLeft = a.scroll0 - d / a.escala;
    };
    /* com o botão apertado na trilha, arrastar é rolar: a seleção de texto não
       começa (o mesmo conserto da trilha de Pedidos, 06/10/2026) */
    const semSelecao = (e: Event) => { if (arrasto.current.ativo) e.preventDefault(); };
    document.addEventListener("pointermove", mover);
    document.addEventListener("pointerup", soltar);
    document.addEventListener("pointercancel", soltar);
    document.addEventListener("selectstart", semSelecao);
    window.addEventListener("blur", soltar);
    return () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerup", soltar);
      document.removeEventListener("pointercancel", soltar);
      document.removeEventListener("selectstart", semSelecao);
      window.removeEventListener("blur", soltar);
    };
  }, []);

  return (
    <>
      <div ref={trilha} className="p10-trilha" onPointerDown={aoApontar} onScroll={aoRolar} inert={oculta ? true : undefined}
        role={rotulo ? "group" : undefined} aria-label={rotulo} onKeyDown={aoTeclar}
        onClickCapture={(e) => { if (arrasto.current.andou) { e.stopPropagation(); e.preventDefault(); arrasto.current.andou = false; } }}
        style={{ position: "absolute", left: 0, top: 40, width: 1920, height: 917, boxSizing: "border-box", padding: `${CAPA_V4.topo - 40}px 0 0 ${inicio}px`,
          display: "flex", alignItems: "flex-start", overflowX: rola ? "auto" : "hidden", overflowY: "hidden", scrollPaddingLeft: inicio, zIndex: 2,
          visibility: oculta ? "hidden" : undefined }}>
        {children}
        {/* a margem da direita: o último cartão para na c23 */}
        {rola && <div aria-hidden style={{ flex: "0 0 80px", height: 1 }} />}
      </div>
      {!rolou && !oculta && rola && <SetaDaTrilha centro={[1867.3, CAPA_V4.topo + CAPA_V4.altura / 2]} />}
    </>
  );
}

/** O título do pé: Fraunces 104, a tinta na c1 e a base na linha 63. */
export function tituloDoPeV4(texto: string): CSSProperties {
  return {
    position: "absolute", left: 80 - folgaFR(104, texto.charAt(0)), top: CAPA_V4.basePe - baseFraunces(104, 104),
    ...FR, fontSize: 104, lineHeight: "104px", letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO, zIndex: 3,
  };
}

/** O resumo do pé, à direita: linhas em Inter 21 média terminando na c23 (as
    linhas que eram da faixa preta, como no pé da Solicitação), a última com a
    base 3,26 acima da linha 63. Linha pode ter botão (as contagens de
    Arquivos); `fim` é o último caractere dela, para a tinta cair na c23. */
export function ResumoDoPeV4({ linhas, largura = 760, fim }: { linhas: (ReactNode | undefined)[]; largura?: number; fim?: string }) {
  const visiveis = linhas.filter((l) => l != null && l !== "" && l !== false);
  const ultima = visiveis[visiveis.length - 1];
  const fimDaUltima = fim ?? (typeof ultima === "string" ? ultima.charAt(ultima.length - 1) : ".");
  return (
    <div style={{ position: "absolute", right: 80 - folgaDireitaInter(500, 21, fimDaUltima), top: CAPA_V4.basePe - 3.26 - 28 * (visiveis.length - 1) - baseInter(21, 28), width: largura,
      textAlign: "right", fontFamily: INTER, fontSize: 21, fontWeight: 500, lineHeight: "28px", letterSpacing: "-.028em", color: PRETO, zIndex: 3 }}>
      {visiveis.map((l, i) => <div key={i} title={typeof l === "string" ? l : undefined} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l}</div>)}
    </div>
  );
}
