// Cromo compartilhado da geração 1.0 — o palco e a barra do topo.
//
// Nasceu de dentro da HomeHub10 quando a segunda tela 1.0 (Novo pedido) ia
// copiar a mesma barra. Barra duplicada é barra que diverge: um dia alguém
// acrescenta um item de menu num arquivo e esquece o outro, e o hub passa a
// ter duas navegações diferentes dependendo de onde você está.
//
// A barra cuida do próprio estado (pesquisa, notificações, configurações,
// sair) e lê o resto do contexto do hub. Quem a usa só diz qual página está
// ativa e o que fazer ao navegar.
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { BuscaGlobalV1a } from "../v1a/BuscaGlobalV1a";
import { AvisoV1a } from "../v1a/HubV1a";
import { useHubDados } from "../v1a/HubDadosV1a";
/* As Preferências no molde 1.0 (Augusto, 02/10/2026), num arquivo carregado à
   parte: o arquivo delas usa as peças daqui (cores, ESC), e o import direto
   faria um ciclo que lê as constantes antes de elas existirem. A barra pede o
   arquivo logo que monta (carregarPreferencias): a aba aberta antes de uma
   publicação já o tem na memória, e a engrenagem não vai buscar no servidor
   um arquivo que a publicação trocou. Se mesmo assim falhar, a proteção avisa
   em vez de derrubar a página (revisão de 02/10/2026). */
const carregarPreferencias = () => import("./PreferenciasHub10");
const PreferenciasHub10 = lazy(() => carregarPreferencias().then((m) => ({ default: m.PreferenciasHub10 })));
class ProtecaoDasPreferencias extends Component<{ fechar: () => void; children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    if (!this.state.falhou) return this.props.children;
    return <AvisoV1a texto="As Preferências não abriram. Atualize a página (F5) e tente de novo." tipo="alerta" onFechar={this.props.fechar} />;
  }
}
import { baseFraunces, baseInter, folgaDireitaInter, folgaFraunces, folgaInter } from "./grade-hub10";
import type { SessionUser } from "@/lib/session";
import { PALETA } from "@/lib/paleta-hub";

/* ————— kit 1.0 —————
   Preto #000 e amarelo #fff079 (o #FFE815 só no "+"), que NÃO são os do kit
   V1a. É decisão do design, seguida à risca. As cores moram em
   lib/paleta-hub, que no hub de teste troca para a paleta nova (05/10/2026). */
export const PRETO = "#000000";
export const AMARELO = PALETA.amarelo;
export const AMARELO_MAIS = PALETA.amareloForte;

/* O carregando entre as telas (Augusto, 02/10/2026: "um loading e uma
   animação ao mudar de tela entre as páginas do hub quando demorarem para
   carregar... degradê, cores passando"): dez faixas do amarelo do hub, do
   claro ao forte e de volta, correndo da esquerda para a direita. Quem decide
   quando aparece é a rota (hub.tsx).
   Desde 05/10/2026 ("vamos deixar pegando a tela inteira abaixo do rail dos
   menus") as faixas tomam tudo o que fica abaixo da barra do topo, que
   continua à vista e funcionando; antes era um cartão de 330 × 120 no meio,
   sobre a tela esmaecida. A barra mora no palco escalado (PalcoFixo), então
   o pé dela na janela é a mesma conta do palco: a escala que cabe e o palco
   centrado. */
/* dez tons em passos iguais de cor percebida (OKLab), do amarelo claro ao
   forte. A escala antiga começava num quase branco (#fffbe6) e os passos do
   lado claro eram o dobro dos do forte: a faixa mais clara saltava (Augusto,
   05/10/2026: "conseguimos uma transição de cor mais suave na mais clara,
   ela é muito aparente") */
const TONS_DO_CARREGANDO = ["#fff3b8", "#ffeeab", "#ffea9e", "#ffe590", "#ffe081", "#ffdc72", "#ffd761", "#ffd24e", "#ffcd35", "#ffc800"];
/* uma volta de cores vira as faixas: a imagem leva duas voltas e anda meia
   imagem por ciclo, então a faixa encaixa sem salto */
function faixasDaVolta(volta: string[]): string {
  const todas = [...volta, ...volta];
  return todas.map((cor, i) => `${cor} ${(i * 100) / todas.length}% ${((i + 1) * 100) / todas.length}%`).join(", ");
}
/* do claro ao forte e de volta, sem repetir as pontas: com o forte e o claro
   duas vezes seguidas, cada virada saía uma faixa larga da mesma cor
   (Augusto, 05/10/2026: "as duas faixas com a mesma cor do meio não está
   legal") */
/* (Uma prévia nas cores da impressão, CMY e CMYK, foi vista e recusada em
   05/10/2026: ficou o amarelo.) */
const FAIXAS_DO_CARREGANDO = faixasDaVolta([...TONS_DO_CARREGANDO, ...[...TONS_DO_CARREGANDO].reverse().slice(1, -1)]);
function peDaBarraNaJanela() {
  if (typeof window === "undefined") return 112;
  const w = window.innerWidth, h = window.innerHeight;
  const escala = Math.min(w / 1920, h / 1080);
  return (h - 1080 * escala) / 2 + 112 * escala;
}
export function CarregandoHub10() {
  const [topo, setTopo] = useState(peDaBarraNaJanela);
  useEffect(() => {
    const medir = () => setTopo(peDaBarraNaJanela());
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return (
    <div role="status" aria-label="Carregando" style={{ position: "fixed", left: 0, right: 0, top: topo, bottom: 0, zIndex: 10000,
      animation: "h10-carregando-entra .25s ease both" }}>
      <div className="h10-carregando-tela" style={{ position: "absolute", inset: 0,
        background: `linear-gradient(90deg, ${FAIXAS_DO_CARREGANDO})`, backgroundSize: "200% 100%" }} />
    </div>
  );
}
export const FUNDO = "#f1f1f1";
/** O rework de 01/10/2026 (desenhos do Augusto em hubv3/v4): o fundo das
    páginas é um cinza quente que vai da barra do topo até o pé, sem a faixa
    preta, e a caixa da pesquisa fica num cinza um pouco mais escuro. */
export const FUNDO_PAGINA = PALETA.fundo;
export const FUNDO_PESQUISA = "#e6e6e6";
/* o texto do menu no desenho do rework é azul quase preto, não preto */
export const TINTA_MENU = "#12243a";
export const INTER = "Inter, system-ui, sans-serif";
export const FR: CSSProperties = { fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 72", fontWeight: 600 };

export const BOTAO_CLARO: CSSProperties = { border: `1px solid ${PRETO}`, borderRadius: 999, background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 15, fontWeight: 600, padding: "9px 18px", cursor: "pointer" };
export const BOTAO_ESCURO: CSSProperties = { ...BOTAO_CLARO, background: PRETO, color: "#fff" };
export const FECHAR_X: CSSProperties = { width: 30, height: 30, borderRadius: 999, border: `1px solid ${PRETO}`, background: "#fff", fontSize: 16, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
export const CAIXA: CSSProperties = { position: "absolute", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 20, boxShadow: "0 18px 44px rgba(0,0,0,.22)", overflow: "hidden" };
export const CABECA = (bg: string): CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 15px", background: bg, borderBottom: `1px solid ${PRETO}` });
/** O raio das barras de pesquisa retangulares (a do topo, a das capas de
    Arquivos e Pantones, a das listas de Facas e Pantones): um leve
    arredondado, igual em todas (Augusto, 30/09/2026: "adicione um leve raio
    na borda em todas as barras de pesquisa"; as das capas não tinham raio e a
    do topo tinha 4). As de "Ver todos", em pílula tracejada, ficam como estão. */
export const RAIO_DA_PESQUISA = 6;
export const AREA_TEXTO: CSSProperties = { width: "100%", resize: "none", border: `1.5px dashed ${PRETO}`, borderRadius: 14, padding: "12px 14px", fontFamily: INTER, color: PRETO, background: "#f8f8f8", outline: "none", boxSizing: "border-box" };

/* ————— a faixa preta, na grade —————
   A faixa de baixo das páginas (Pedidos, Aprovações, Pantones, Ferramentais,
   Arquivos, Calculadoras, Novo pedido) era a mesma cópia em cada arquivo, com
   a margem antiga de 72 e nada nas linhas da grade (Augusto, 29/09/2026: "essa
   área em algumas páginas está fora de alinhamento"). Agora mora aqui:
   - o título (Fraunces 112) com a tinta da 1ª letra na c1 e a base na linha 56;
   - o resumo (Inter 24) na c12, com as bases nas linhas 54 e 56 (a 2ª na base
     do título);
   - o rodapé (Inter 19) com a base na linha 63, da c1 até a c23: o 1º item
     na c1, embaixo do título, e o que vem depois começando na c12, embaixo
     do resumo (Augusto, 30/09/2026: "a informação do rodapé deve estar
     alinhada aos dados"; antes ficavam na c5, c6, c9 ou c10). */
const LINHA_FAIXA = 1080 / 67;
/* O canvas que mede a folga não aplica SOFT nem opsz, e no corte de 144 a
   diferença muda com a letra: medido no print (29/09/2026), o "A", o "C" e o
   "N" dos títulos começavam 1, 1 e 2 px depois da c1; o "P" e o "F", nela. */
const FOLGA_TITULO_FAIXA: Record<string, number> = { A: 1, C: 1, N: 2 };
/** O título da faixa. `primeira` é a 1ª letra dele (a folga muda de letra para letra). */
export function tituloDaFaixa(primeira: string): CSSProperties {
  return {
    position: "absolute", left: 80 - folgaFraunces(600, 112, primeira) - (FOLGA_TITULO_FAIXA[primeira] ?? 0),
    top: 56 * LINHA_FAIXA - baseFraunces(112, 112),
    fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontWeight: 600,
    fontSize: 112, lineHeight: "112px", letterSpacing: "-.01em", color: FUNDO, whiteSpace: "nowrap", zIndex: 3, margin: 0,
  };
}
/** O resumo da faixa, duas linhas; cada linha usa `linhaDoResumo`. */
export const RESUMO_DA_FAIXA: CSSProperties = {
  position: "absolute", left: 960, top: 54 * LINHA_FAIXA - baseInter(24, 2 * LINHA_FAIXA), width: 880,
  color: FUNDO, fontFamily: INTER, fontSize: 24, lineHeight: `${2 * LINHA_FAIXA}px`, zIndex: 3,
};
/** Uma linha do resumo: recua a folga da 1ª letra para a tinta cair na c12. */
export const linhaDoResumo = (primeira: string): CSSProperties => ({ marginLeft: -folgaInter(400, 24, primeira), whiteSpace: "nowrap" });
/** O rodapé da faixa: a linha dos filtros ou da fonte, com a 1ª letra na c1. */
export function rodapeDaFaixa(primeira: string): CSSProperties {
  return {
    position: "absolute", left: 80 - folgaInter(400, 19, primeira), right: 80, top: 63 * LINHA_FAIXA - baseInter(19, 19), height: 19,
    display: "flex", alignItems: "center", fontFamily: INTER, fontSize: 19, lineHeight: "19px", color: FUNDO, zIndex: 30,
  };
}
/** Um grupo do rodapé que começa numa coluna (c12, a do resumo, e c16), com a tinta da
    1ª letra nela; a posição é dentro do rodapé, que começa na c1 menos a
    folga da 1ª letra DELE (`primeiraDoRodape`). */
export const noRodape = (coluna: number, primeira: string, primeiraDoRodape: string): CSSProperties => ({
  position: "absolute", left: (coluna * 80 - folgaInter(400, 19, primeira)) - (80 - folgaInter(400, 19, primeiraDoRodape)), top: 0, height: 19,
});
/* ————— as listas "Ver todos", na grade —————
   As camadas de lista que cobrem a tela (Todas as aprovações, a gaveta dos
   Arquivos…) com a mesma régua (Augusto, 29/09/2026: "só alinhe, não altere
   nada"): título com a tinta na c1 e a base na linha 7, a contagem na 10, o
   fechar terminando na c23, os controles centrados na linha 14 e a lista
   começando na 17. */
export const LINHA_DA_GRADE_HUB = LINHA_FAIXA;
/** Texto em Inter, no palco inteiro: a tinta em x e a base na linha k. */
export function textoNaGrade(x: number, k: number, corpo: number, peso: number, primeira: string): CSSProperties {
  return {
    position: "absolute", left: x - folgaInter(peso, corpo, primeira), top: k * LINHA_FAIXA - baseInter(corpo, corpo),
    fontFamily: INTER, fontSize: corpo, fontWeight: peso, lineHeight: `${corpo}px`, whiteSpace: "nowrap",
  };
}
/* o corte de 144 começa depois da folga do canvas, como no título da faixa
   (medido no de 112; no de 72 a diferença é a mesma proporção) */
const FOLGA_TITULO_LISTA: Record<string, number> = { A: 0.6, C: 0.6, N: 1.3, G: -2, T: -1 };
/** O título da lista (Fraunces 72): tinta da 1ª letra na c1, base na linha 7. */
export function tituloDaLista(primeira: string): CSSProperties {
  return {
    position: "absolute", left: 80 - folgaFraunces(600, 72, primeira) - (FOLGA_TITULO_LISTA[primeira] ?? 0),
    top: 7 * LINHA_FAIXA - baseFraunces(72, 72),
    fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontWeight: 600,
    fontSize: 72, lineHeight: "72px", letterSpacing: "-.02em", whiteSpace: "nowrap", margin: 0,
  };
}
/** O fechar da lista (56 px): termina na c23, centrado na linha 5,5 (o meio da maiúscula do título). */
export const FECHAR_DA_LISTA: CSSProperties = { position: "absolute", left: 1840 - 56, top: 5.5 * LINHA_FAIXA - 28 };
/** Topo de um controle de altura h centrado na linha 14. */
export const topoDoControle = (h: number) => 14 * LINHA_FAIXA - h / 2;
/** Onde a lista começa (linha 17). */
export const TOPO_DA_LISTA = 17 * LINHA_FAIXA;

/** O que fecha o rodapé à direita ("Ver todos"): termina na c23. */
export const FIM_DO_RODAPE: CSSProperties = { marginLeft: "auto" };
/** A marca "R2hub 1.0" (Fraunces 24) no fim do rodapé: termina na c23, com a
    base na mesma linha 63 dos textos em Inter (dentro do rodapé). */
export const MARCA_DO_RODAPE: CSSProperties = {
  /* +1: medido, a base do Fraunces 24 nessa caixa cai 1 px acima do que
     `baseFraunces` diz (sem ele, a marca ficava 2 px acima da linha 63) */
  ...FR, position: "absolute", right: 0, top: baseInter(19, 19) - baseFraunces(24, 24) + 1,
  fontSize: 24, lineHeight: "24px", whiteSpace: "nowrap",
};

/** Fundo dos painéis das telas 1.0 — cinza bem claro em vez de branco. Os
    menus e caixas que abrem POR CIMA continuam brancos, e é isso que os
    descola do painel em vez de deixá-los sumir nele. */
export const FUNDO_PAINEL = "#f5f5f5";

/** Campo sem dado: vazio ou só o traço que o hub grava no lugar do valor
    (a refação grava assim a largura, a altura e a matéria). */
const campoVazio = (s?: string | null) => !s || /^[\s\u2014\u2013-]*$/.test(s);

/** Número do pedido como o hub inteiro escreve: dois dígitos, com #. */
export const numeroPedido = (n: number) => `#${String(n).padStart(2, "0")}`;

/* ————— ESC: só a caixa de cima responde —————
   Cada tela e cada caixa do 1.0 tinha o seu próprio ouvinte de Escape, e
   todos disparavam juntos: apertar ESC dentro do "Design criado" fechava a
   caixa E o painel do pedido atrás dela — com as cores e o recado que a
   pessoa tinha acabado de digitar. É a mesma regra que o `esc-modal.ts` já
   aplica no V1a (fecha o overlay de maior z), escrita aqui do jeito que os
   componentes 1.0 pedem.

   `nivel` acompanha o z-index de cada camada, para a leitura bater com o que
   se vê na tela. */
/* `preferencias`: a camada das Preferências cobre a página inteira, inclusive
   os balões da Home (80 e 90); a barra fica um degrau acima dela, e a caixa
   de sair (95) acima de tudo. */
/* `apresentacao`: o tour do primeiro acesso (ApresentacaoHub10) fica por cima
   de tudo, Preferências e caixas inclusive; só o carregando (10000) passa dele. */
export const NIVEL = { painel: 38, verTodos: 50, caixa: 68, pantone: 76, preferencias: 92, apresentacao: 1000 } as const;

const pilhaEsc: { nivel: number }[] = [];

export function useEscDoTopo(ativo: boolean, nivel: number, fechar: () => void) {
  useEffect(() => {
    if (!ativo) return;
    const meu = { nivel };
    pilhaEsc.push(meu);
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      /* empate de nível: o último a abrir é o de cima */
      const topo = pilhaEsc.reduce((a, b) => (b.nivel >= a.nivel ? b : a), pilhaEsc[0]);
      if (topo !== meu) return;
      e.preventDefault();
      fechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      const i = pilhaEsc.indexOf(meu);
      if (i >= 0) pilhaEsc.splice(i, 1);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [ativo, nivel, fechar]);
}

/** Lista que rola por dentro de um painel (classe "p10-rola"): liga a classe
    "tem-mais" enquanto há conteúdo embaixo, e o CSS mostra o esmaecido com a
    seta (o aviso do pedido aberto, Augusto, 02/10/2026). Use como ref: o React
    chama a limpeza que ela devolve. A cor do esmaecido vem de `--fundo`. */
export function vigiarRolagem(el: HTMLDivElement | null) {
  if (!el) return;
  const medir = () => el.classList.toggle("tem-mais", el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  medir();
  el.addEventListener("scroll", medir, { passive: true });
  const tamanho = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
  tamanho?.observe(el);
  const conteudo = new MutationObserver(medir);
  conteudo.observe(el, { childList: true, subtree: true, characterData: true });
  return () => { el.removeEventListener("scroll", medir); tamanho?.disconnect(); conteudo.disconnect(); };
}

/** O pé do cartão v4 (Entrada, Cores, Medida, Substrato), nas posições do
    desenho de Pedidos subidas uma linha de valor (Augusto, 02/10/2026: "essa
    área está muito perto da borda do card, precisa de ar"). O cartão da
    trilha (Pedidos e Aprovações) e o cartão do pedido aberto desenham o mesmo
    pé daqui ("o alinhamento que fizemos em aprovação, estenda para pedidos"):
    o conserto de um chega no outro. Posições relativas ao cartão de 440; a
    cor vem do cartão. */
export const PE_CARTAO_V4 = {
  col1: 48, col2: 258.4, cartao: 440,
  rotulo1: 558.53 - 27, valor1: 590.28 - 27, rotulo2: 637.65 - 27, valor2: 669.28 - 27,
  /* a Fraunces 23 dos valores senta 1 px acima do que baseFraunces diz */
  acertoValor: 1,
  /* a pílula de status da trilha (e a fileira de ações do cartão aberto) */
  pilulaTopo: 414.43, pilulaAltura: 49.92,
};
const ROTULO_PE_V4: CSSProperties = { position: "absolute", fontFamily: INTER, fontSize: 24, fontWeight: 400, letterSpacing: "-.03em", lineHeight: "24px", whiteSpace: "nowrap", zIndex: 1 };
const VALOR_PE_V4: CSSProperties = { position: "absolute", fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100", fontSize: 23, fontWeight: 700, letterSpacing: "-.04em", lineHeight: "27px", zIndex: 1,
  display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" };
export function PeDoCartaoV4({ entrada, cores, medida, substrato }: { entrada: string; cores: string; medida: string; substrato: string }) {
  const c = PE_CARTAO_V4;
  const l1 = c.col2 - c.col1 - 16, l2 = c.cartao - c.col2 - 28;
  const r = (base: number) => base - baseInter(24, 24);
  const v = (base: number) => base - baseFraunces(23, 27) + c.acertoValor;
  return (
    <>
      <span style={{ ...ROTULO_PE_V4, left: c.col1, top: r(c.rotulo1) }}>Entrada:</span>
      <span style={{ ...VALOR_PE_V4, left: c.col1, top: v(c.valor1), width: l1, WebkitLineClamp: 1 }}>{entrada}</span>
      <span style={{ ...ROTULO_PE_V4, left: c.col2, top: r(c.rotulo1) }}>Cores:</span>
      <span style={{ ...VALOR_PE_V4, left: c.col2, top: v(c.valor1), width: l2, WebkitLineClamp: 1 }}>{cores}</span>
      <span style={{ ...ROTULO_PE_V4, left: c.col1, top: r(c.rotulo2) }}>Medida:</span>
      <span style={{ ...VALOR_PE_V4, left: c.col1, top: v(c.valor2), width: l1, WebkitLineClamp: 1 }}>{medida}</span>
      <span style={{ ...ROTULO_PE_V4, left: c.col2, top: r(c.rotulo2) }}>Substrato:</span>
      {/* o substrato comprido quebra em duas linhas, dentro do cartão */}
      <span style={{ ...VALOR_PE_V4, left: c.col2, top: v(c.valor2), width: l2, WebkitLineClamp: 2 }}>{substrato}</span>
    </>
  );
}

/** O nome do cliente no cartão v4: o mesmo no cartão da trilha (Pedidos e
    Aprovações) e no cartão do pedido aberto, que caía uns 60 px mais alto e
    em outra letra (Augusto, 02/10/2026: "o da tela Pedidos está correto").
    Fraunces 58 com entrelinha 52 (a do desenho, 47,73, fazia a perna do g
    encostar na linha de baixo; ele abriu para 52 em 01/10/2026), até quatro
    linhas; a 1ª base fica onde o desenho põe; o recuo de 14 em cima e embaixo
    deixa ver o alto das letras e a perna do g, maiores que a entrelinha. */
export const NOME_CARTAO_V4 = { x: 43.23, base: 219.03, corpo: 58, entrelinha: 52, largura: 360 };
/* Nome de cinco linhas ou mais: o -webkit-line-clamp põe o "…" na 4ª, mas a
   5ª continua desenhada por baixo, e o recuo de 14 que deixa ver a perna do g
   da 4ª mostrava o alto dela, cortado (com a entrelinha menor que a letra, a
   5ª sobe para dentro desse recuo). O texto já entra cortado em quatro
   linhas, medido numa cópia escondida com a mesma letra; o nome inteiro fica
   no title. Só guarda a conta depois que a fonte carregou. */
const NOMES_EM_QUATRO = new Map<string, string>();
let medidorDoNome: HTMLDivElement | null = null;
function pegarMedidorDoNome(): HTMLDivElement {
  if (!medidorDoNome) {
    medidorDoNome = document.createElement("div");
    medidorDoNome.setAttribute("aria-hidden", "true");
    Object.assign(medidorDoNome.style, {
      position: "absolute", left: "-10000px", top: "0", visibility: "hidden", pointerEvents: "none",
      fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 72", fontWeight: "600", letterSpacing: "-.02em", overflowWrap: "anywhere",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(medidorDoNome);
  }
  return medidorDoNome;
}
/* Palavra mais comprida que a linha ("Agroindustrial" não cabe em 360 a 58):
   só nesse caso a letra do nome encolhe até ela caber, em vez de a palavra
   quebrar no meio (Augusto, 02/10/2026: "apenas nesse caso"). Até 40. */
const CORPOS_DO_NOME = new Map<string, number>();
export function corpoDoNome(nome: string): number {
  const n = NOME_CARTAO_V4;
  if (typeof document === "undefined" || !nome) return n.corpo;
  const guardado = CORPOS_DO_NOME.get(nome);
  if (guardado != null) return guardado;
  const m = pegarMedidorDoNome();
  Object.assign(m.style, { width: "auto", whiteSpace: "nowrap", fontSize: `${n.corpo}px`, lineHeight: "normal" });
  let maior = 0;
  for (const palavra of nome.split(/\s+/).filter(Boolean)) {
    m.textContent = palavra;
    maior = Math.max(maior, m.getBoundingClientRect().width);
  }
  m.style.whiteSpace = "";
  const corpo = maior > n.largura ? Math.max(40, Math.floor((n.corpo * n.largura) / maior)) : n.corpo;
  if (document.fonts?.check(`600 ${n.corpo}px Fraunces`)) CORPOS_DO_NOME.set(nome, corpo);
  return corpo;
}
/** a entrelinha acompanha a letra (52 em 58) */
export const entrelinhaDoNome = (corpo: number) => Math.round((NOME_CARTAO_V4.entrelinha * corpo) / NOME_CARTAO_V4.corpo);
export function nomeEmQuatroLinhas(nome: string, corpo: number = NOME_CARTAO_V4.corpo): string {
  if (typeof document === "undefined" || !nome) return nome;
  const chave = `${corpo}|${nome}`;
  const guardado = NOMES_EM_QUATRO.get(chave);
  if (guardado != null) return guardado;
  const lh = entrelinhaDoNome(corpo);
  const medidor = pegarMedidorDoNome();
  Object.assign(medidor.style, { width: `${NOME_CARTAO_V4.largura}px`, fontSize: `${corpo}px`, lineHeight: `${lh}px` });
  const limite = 4 * lh + 1;
  const cabe = (t: string) => { medidor.textContent = t; return medidor.offsetHeight <= limite; };
  let saida = nome;
  if (!cabe(nome)) {
    let lo = 0, hi = nome.length;
    while (lo < hi) {
      const m = Math.ceil((lo + hi) / 2);
      if (cabe(nome.slice(0, m).trimEnd() + "…")) lo = m; else hi = m - 1;
    }
    /* corta numa palavra inteira quando dá (sem voltar mais que um terço) */
    const espaco = nome.lastIndexOf(" ", lo);
    saida = nome.slice(0, espaco > lo * 0.66 ? espaco : lo).trimEnd() + "…";
  }
  if (document.fonts?.check(`600 ${NOME_CARTAO_V4.corpo}px Fraunces`)) NOMES_EM_QUATRO.set(chave, saida);
  return saida;
}
export function NomeDoCartaoV4({ nome }: { nome: string }) {
  const n = NOME_CARTAO_V4;
  const corpo = corpoDoNome(nome);
  const lh = entrelinhaDoNome(corpo);
  return (
    <div title={nome || undefined} style={{ position: "absolute", left: n.x, top: n.base - baseFraunces(corpo, lh) - 14, width: n.largura,
      ...FR, fontSize: corpo, lineHeight: `${lh}px`, letterSpacing: "-.02em", zIndex: 1, padding: "14px 0",
      display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{nomeEmQuatroLinhas(nome, corpo)}</div>
  );
}

/** Rótulo + valor do rodapé dos cards 1.0 (Entrada, Cores, Medida,
    Substrato). Mora aqui porque o card da trilha e o cartão do painel de
    detalhe desenham o mesmo par — e, separados, o conserto de um não
    chegava no outro.

    O valor vai em no máximo duas linhas, com entrelinha fechada: o
    protótipo deixa a caixa crescer porque os dados dele são curtos, mas
    "BOPP metalizado" quebra em duas e a segunda vazava por baixo da borda
    do card. O nome inteiro continua nas Especificações. */
export function CampoHub10({ rotulo, valor, caixa }: {
  rotulo: string; valor: string; caixa?: CSSProperties;
}) {
  return (
    /* minWidth 0 + quebra em qualquer ponto: "metalizado" é uma palavra só e
       mais larga que a coluna. Sem isso a coluna `auto` da grade crescia até
       caber a palavra inteira e empurrava o bloco para fora do card. */
    <div style={{ minWidth: 0, ...caixa }}>
      <div style={{ fontSize: 24, fontWeight: 400 }}>{rotulo}</div>
      <div style={{ marginTop: 4, fontSize: 24, lineHeight: "30px", fontWeight: 800, fontFamily: "Fraunces", letterSpacing: "-1px", overflowWrap: "anywhere", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>{valor}</div>
    </div>
  );
}

/* [rótulo na barra, página do hub]. Central, Fábrica, OP, Afiação, Estoque e
   Mural ficaram de fora porque serão descontinuadas — não é lacuna. */
export const MENU: [string, string][] = [
  ["HOME", "Home"], ["PEDIDOS", "Pedidos"], ["APROVAÇÕES", "Aprovação"],
  ["PANTONES", "Pantone"], ["FACAS", "Facas"], ["CLIENTES", "Clientes"],
  ["ARQUIVOS", "Arquivos"], ["CALC'S", "Calculadoras"], ["RELATÓRIOS", "Apontamentos"],
  ["EQUIPE", "Equipe"],
];

/* O palco do 1.0 é 1920×1080 fixo, escalado para CABER na janela (min de
   largura/altura) — diferente da largura fluida do V1a. Toda tela cabe sem
   scroll, que é a regra estrutural do handoff. */
/* Grade de conferência, só no hub de desenvolvimento (dev e dev:teste; o build
   de produção não leva). São as 24 colunas de 80 e as 67 linhas de 1080/67 da
   prancha `inside facas.svg`, por cima de tudo e sem pegar clique. Cada linha
   leva o número dela nas duas margens; cada coluna, o nome (c0 a c23) no topo.
   Alt+G liga e desliga; `?grade=1` na URL liga e `?grade=0` desliga. Vale
   para a aba (sobrevive a recarregar), não para as outras abas. */
const LINHA_DA_GRADE = 1080 / 67;
function GradeDeConferencia() {
  const [ligada, setLigada] = useState(false);
  useEffect(() => {
    const lembrar = (v: boolean) => {
      try { sessionStorage.setItem("hub-grade", v ? "1" : "0"); } catch { /* sem armazenamento: vale até recarregar */ }
    };
    let v = false;
    try { v = sessionStorage.getItem("hub-grade") === "1"; } catch { /* idem */ }
    const pedido = new URLSearchParams(window.location.search).get("grade");
    if (pedido === "1" || pedido === "0") { v = pedido === "1"; lembrar(v); }
    setLigada(v);
    const aoTeclar = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== "KeyG") return;
      e.preventDefault();
      setLigada((atual) => { lembrar(!atual); return !atual; });
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);
  if (!ligada) return null;
  const colunas = Array.from({ length: 24 }, (_, i) => i);
  const linhas = Array.from({ length: 66 }, (_, k) => k + 1);
  const AZUL = "rgb(0,98,255)", ROSA = "rgb(230,0,118)";
  return (
    <svg aria-hidden width={1920} height={1080} viewBox="0 0 1920 1080" data-grade-conferencia=""
      style={{ position: "absolute", left: 0, top: 0, zIndex: 2147483000, pointerEvents: "none" }}>
      {colunas.filter((i) => i % 2 === 0).map((i) => <rect key={`f${i}`} x={i * 80} y={0} width={80} height={1080} fill={AZUL} fillOpacity={0.06} />)}
      <g stroke={AZUL} strokeOpacity={0.5}>
        {colunas.slice(1).map((i) => <line key={`c${i}`} x1={i * 80 + 0.5} y1={0} x2={i * 80 + 0.5} y2={1080} />)}
      </g>
      <g stroke={ROSA}>
        {linhas.map((k) => <line key={`l${k}`} x1={0} y1={k * LINHA_DA_GRADE} x2={1920} y2={k * LINHA_DA_GRADE} strokeOpacity={k % 5 === 0 ? 0.7 : 0.3} />)}
      </g>
      <g fontFamily={INTER} fontSize={10} fontWeight={600}>
        {colunas.map((i) => <text key={`tc${i}`} x={i * 80 + 40} y={11} textAnchor="middle" fill={AZUL}>c{i}</text>)}
        {linhas.map((k) => <text key={`te${k}`} x={4} y={k * LINHA_DA_GRADE - 3} fill={ROSA}>{k}</text>)}
        {linhas.map((k) => <text key={`td${k}`} x={1916} y={k * LINHA_DA_GRADE - 3} textAnchor="end" fill={ROSA}>{k}</text>)}
      </g>
    </svg>
  );
}

export function PalcoFixo({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0) setEscala(Math.min(w / 1920, h / 1080));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "#e4e4e4" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080, transform: `translate(-50%,-50%) scale(${escala})`, transformOrigin: "center center", background: FUNDO, overflow: "hidden", color: PRETO, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }}>
        {children}
        {import.meta.env.DEV && <GradeDeConferencia />}
      </div>
    </div>
  );
}

export function BarraTopoHub10({ profile, paginaAtiva, aoNavegar, onNova, onLogout, disponiveis, fundo = FUNDO_PAGINA }: {
  profile: SessionUser;
  /** página do hub que esta tela representa — fica sublinhada e não navega */
  paginaAtiva: string;
  aoNavegar: (label: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  /** páginas que a pessoa pode abrir; undefined = todas */
  disponiveis?: string[];
  /** fundo da barra. Transparente onde a página tem a mesma cor e algo passa
      por baixo dela (a sombra do cartão em hover, em Pedidos) */
  fundo?: string;
}) {
  const dados = useHubDados();
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [notifAberto, setNotifAberto] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);
  const [logoutAberto, setLogoutAberto] = useState(false);
  const fecharConfig = useCallback(() => setConfigAberta(false), []);

  /* ESC fecha o que a barra abriu — e SÓ isso. O ouvinte antigo era global e
     disparava junto com o do painel do pedido: fechar os Ajustes fechava também
     o pedido que estava aberto atrás. Entra na mesma pilha das caixas, e só
     enquanto há algo da barra aberto. As Preferências cuidam do próprio ESC;
     com elas abertas a barra fica por cima, e o ESC do sino, da pesquisa e do
     sair também: fecha o que está por cima primeiro (revisão de 02/10/2026). */
  const algoDaBarraAberto = buscaAberta || notifAberto || logoutAberto;
  const fecharDaBarra = useCallback(() => {
    setBuscaAberta(false); setNotifAberto(false); setLogoutAberto(false);
  }, []);
  useEscDoTopo(algoDaBarraAberto, configAberta ? NIVEL.preferencias + 2 : NIVEL.caixa, fecharDaBarra);
  /* pede o arquivo das Preferências logo (ver carregarPreferencias) */
  useEffect(() => {
    const t = setTimeout(() => { void carregarPreferencias().catch(() => { /* a proteção avisa se a engrenagem falhar */ }); }, 1500);
    return () => clearTimeout(t);
  }, []);

  const menu = MENU.filter(([, pagina]) => pagina === paginaAtiva || !disponiveis || disponiveis.includes(pagina));
  const podeCriar = !!onNova && (!disponiveis || disponiveis.includes("Novo pedido"));

  const notifs = dados.notificacoes ?? [];
  const naoLidas = notifs.filter((n) => !n.lida).length;
  /* As que estavam sem ler quando o sino abriu. Abrir marca tudo como lido na
     hora (de propósito), e um segundo depois o banco devolve todas lidas, com
     o mesmo fundo: não dava para saber quais eram novas (simulação 5,
     05/10/2026). Enquanto o painel está aberto elas ficam destacadas. */
  const [novasAoAbrir, setNovasAoAbrir] = useState<ReadonlySet<string>>(() => new Set<string>());
  const abrirNotif = () => {
    const abrir = !notifAberto;
    setNotifAberto(abrir);
    setNovasAoAbrir(abrir ? new Set<string>(notifs.filter((n) => !n.lida).map((n) => n.id)) : new Set<string>());
    if (abrir && naoLidas > 0 && dados.aoMarcarNotificacoes) void dados.aoMarcarNotificacoes().catch(() => { /* fica como não lida */ });
  };

  /* Campo vazio na busca do topo: as refações gravam o traço de "sem dado" na
     largura, na altura e na matéria, e o resultado saía com uma medida de dois
     traços e um × no meio. Sem medida, só o que existe: "Finalizado · Couché"
     (simulação 5, 05/10/2026). */
  const pedidosDaBusca = useMemo(() => dados.buscaPedidos?.map((p) => {
    const x = p as typeof p & { medida?: string; substrato?: string };
    return {
      ...x,
      medida: x.medida && x.medida.split("×").every((lado) => !campoVazio(lado)) ? x.medida : undefined,
      substrato: campoVazio(x.substrato) ? undefined : x.substrato,
    };
  }), [dados.buscaPedidos]);
  const quandoNotif = (isoData: string) => {
    const d = new Date(isoData);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}  ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <>
      {configAberta && (
        <ProtecaoDasPreferencias fechar={fecharConfig}>
          <Suspense fallback={null}>
            <PreferenciasHub10 nome={profile.nome} fechar={fecharConfig} />
          </Suspense>
        </ProtecaoDasPreferencias>
      )}

      {logoutAberto && (
        <div style={{ ...CAIXA, left: 760, top: 392, width: 400, zIndex: 95, boxShadow: "0 24px 60px rgba(0,0,0,.32)" }}>
          <div style={CABECA(AMARELO)}>
            <span style={{ ...FR, fontSize: 26, lineHeight: 1 }}>Sair da conta</span>
            <button onClick={() => setLogoutAberto(false)} aria-label="Fechar" style={FECHAR_X}>✕</button>
          </div>
          <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 17, lineHeight: 1.4, color: "#444" }}>Deseja encerrar a sessão no R2hub?</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setLogoutAberto(false)} style={{ ...BOTAO_CLARO, padding: "10px 20px" }}>Cancelar</button>
              <button onClick={onLogout} style={{ ...BOTAO_ESCURO, padding: "10px 20px" }}>Sair</button>
            </div>
          </div>
        </div>
      )}

      {/* O cabeçalho é o mesmo; no rework só muda a cor: o cinza da página e
          sem a linha preta embaixo (Augusto, 01/10/2026: "o cabeçalho é o
          mesmo que já usamos, só vai mudar a cor"; "a linha sai").
          Com as Preferências abertas a barra fica por cima delas (que cobrem
          a página como uma camada), transparente sobre o cinza delas: o menu
          continua levando às páginas, e o sino e a pesquisa abrem por cima. */}
      {/* Com a pesquisa, o sino ou o sair abertos, a barra sobe ao nível das
          caixas: as listas que descem dela passavam por baixo do desenho de
          Vendas da Home (z 45), que escondia nomes de pedidos e avisos
          (simulação 5, 05/10/2026). Fechadas, volta aos 40 de sempre. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 112, background: configAberta ? "transparent" : fundo,
        zIndex: configAberta ? NIVEL.preferencias + 1 : algoDaBarraAberto ? NIVEL.caixa : 40 }}>
        {/* o wordmark leva para a Home (Augusto, 06/10/2026: "clicar no
            wordmark da r2 leva para a home"), como o HOME do menu. O desenho
            continua em (80, 47); a folga em volta só aumenta a área do clique. */}
        <a href="#" onClick={(e) => { e.preventDefault(); setConfigAberta(false); if (paginaAtiva !== "Home") aoNavegar("Home"); }}
          className="h10-navi" aria-label="Ir para a Home" title="Ir para a Home"
          style={{ position: "absolute", left: 80 - 12, top: 47 - 13, padding: "13px 12px", display: "block", lineHeight: 0 }}>
          <img src="/home10/wordmark.svg" alt="R2 Etiquetas" draggable={false} style={{ display: "block", height: 17.56, width: "auto" }} />
        </a>
        {/* O menu ocupa da c6 à c17 (Augusto, 29/09/2026: "alinhe ao grid e
            leve esse ajuste do menu para todas as páginas"): a tinta da 1ª
            letra em cima da c6, a da última em cima da c17, e o espaço entre
            os itens repartido igual. Quem vê menos páginas tem mais ar entre
            elas, e as pontas continuam na grade. Antes era um passo fixo de
            15 px a partir da c6, e o "EQUIPE" passava 8 px da c17. */}
        <nav style={{ position: "absolute", left: 480 - folgaInter(500, 16, menu[0]?.[0].charAt(0) ?? "H"),
          width: 880 + folgaInter(500, 16, menu[0]?.[0].charAt(0) ?? "H") + folgaDireitaInter(500, 16, menu[menu.length - 1]?.[0].slice(-1) ?? "E") + 0.16,
          top: 0, height: 112, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {menu.map(([rotulo, pagina]) => (
            <a key={rotulo} href="#" onClick={(e) => { e.preventDefault(); setConfigAberta(false); if (pagina !== paginaAtiva) aoNavegar(pagina); }}
              className={`h10-navi${pagina === paginaAtiva ? " on" : ""}`}
              style={{ fontSize: 16, fontWeight: 500, letterSpacing: ".01em", color: TINTA_MENU, whiteSpace: "nowrap", textDecoration: "none" }}>{rotulo}</a>
          ))}
        </nav>
        {podeCriar && (
          <button onClick={() => { setConfigAberta(false); onNova?.(); }} className="h10-navi" title="Novo pedido" aria-label="Novo pedido"
            style={{ position: "absolute", left: 400, top: 36, display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: AMARELO_MAIS, border: `1px solid ${PRETO}`, borderRadius: 999, cursor: "pointer", padding: 0 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
        )}
        {/* pesquisa: o protótipo desenha só o rótulo; aqui é a busca real do hub */}
        <div style={{ position: "absolute", left: 1440, top: 37, width: 240, height: 38, background: FUNDO_PESQUISA, borderRadius: RAIO_DA_PESQUISA, display: "flex", alignItems: "center" }}>
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setBuscaAberta(true); }} onFocus={() => setBuscaAberta(true)}
            onClick={() => setBuscaAberta(true)}
            onKeyDown={(e) => { if (e.key === "Enter" && !buscaAberta) { e.preventDefault(); setBuscaAberta(true); } }}
            placeholder="PESQUISA" aria-label="Pesquisa" className="h10-pesquisa"
            style={{ flex: 1, minWidth: 0, height: "100%", border: 0, outline: 0, background: "transparent", textAlign: busca ? "left" : "center", padding: "0 12px", fontFamily: INTER, fontSize: 13, letterSpacing: busca ? 0 : ".18em", color: PRETO }} />
          {buscaAberta && (
            <BuscaGlobalV1a consulta={busca} pedidos={pedidosDaBusca} paginas={dados.paginasDisponiveis} alinhar="direita"
              /* ir a um pedido ou página fecha as Preferências: em Pedidos e Aprovações a tela não remonta e o pedido abria por trás delas */
              aoAbrirPedido={dados.aoAbrirPedido ? (id) => { setConfigAberta(false); dados.aoAbrirPedido!(id); } : undefined}
              aoNavegar={(p) => { setConfigAberta(false); (dados.aoNavegar ?? aoNavegar)(p); }} aoFechar={() => setBuscaAberta(false)} />
          )}
        </div>
        <div style={{ position: "absolute", right: 80, top: 0, height: 112, display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button onClick={abrirNotif} className="h10-dot" title="Notificações" aria-label="Notificações"
              style={{ position: "relative", width: 30, height: 30, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {naoLidas > 0 && (
                <span style={{ position: "absolute", top: -6, right: -7, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: PALETA.sino, color: PALETA.sinoTinta, fontFamily: INTER, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                  {naoLidas > 9 ? "9+" : naoLidas}
                </span>
              )}
            </button>
            {notifAberto && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 14px)", width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 14, padding: 10, zIndex: 60, boxShadow: "0 22px 50px -18px rgba(0,0,0,.5)" }}>
                <div style={{ padding: "6px 10px 10px", ...FR, fontSize: 20 }}>Notificações</div>
                {notifs.length ? notifs.slice(0, 40).map((n) => {
                  /* nova = sem ler agora ou sem ler quando o sino abriu */
                  const nova = !n.lida || novasAoAbrir.has(n.id);
                  return (
                    <div key={n.id} onClick={() => { if (n.url && dados.aoAbrirNotificacao) { setNotifAberto(false); setConfigAberta(false); dados.aoAbrirNotificacao(n.url); } }}
                      data-nova={nova ? "" : undefined}
                      style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 12px", borderRadius: 10, background: nova ? "#fff5a8" : "#f7f7f5", marginBottom: 6, cursor: n.url ? "pointer" : "default" }}>
                      <div style={{ fontSize: 14, lineHeight: 1.35, color: PRETO }}>{nova && <span className="h10-so-leitor">Nova. </span>}{n.titulo}{n.corpo ? <span style={{ display: "block" }}>{n.corpo}</span> : null}</div>
                      <div style={{ fontSize: 12, color: "#8f8f8f" }}>{quandoNotif(n.created_at)}</div>
                    </div>
                  );
                }) : (
                  <div style={{ padding: "12px 10px 14px", fontSize: 14, color: "#b3b1b3", fontStyle: "italic" }}>Sem notificações.</div>
                )}
              </div>
            )}
          </div>
          {/* a engrenagem abre e fecha as Preferências; aberta, fica acesa no amarelo do hub */}
          <button onClick={() => setConfigAberta((v) => !v)} className="h10-dot" title="Configurações" aria-label="Configurações" aria-expanded={configAberta}
            style={{ width: 30, height: 30, background: configAberta ? AMARELO : "none", boxShadow: configAberta ? `0 0 0 7px ${AMARELO}` : undefined, borderRadius: 999,
              border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button onClick={() => setLogoutAberto(true)} className="h10-dot" title="Sair" aria-label="Sair"
            style={{ width: 30, height: 30, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          </button>
        </div>
      </div>
    </>
  );
}
