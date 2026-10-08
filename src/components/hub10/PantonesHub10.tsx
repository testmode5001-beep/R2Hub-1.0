// Pantones — Hub 1.0.
//
// A primeira versão desta página era a caixa "Escolher cor" (PantoneHub10)
// esticada até o palco: tarja amarela com o título em cima, busca em pílula,
// fileira de pílulas de família e um painel arredondado flutuando à direita.
// Tudo isso é vocabulário de MODAL, e o Augusto recusou (25/09/2026): a página
// tinha de ser do hub. Agora ela é gêmea de Ferramentais — capa com o módulo e
// a faixa preta embaixo; um clique abre o painel de duas colunas (índice
// cinza à esquerda, a cor escolhida no branco à direita) — e a capa segue a
// referência que ele trouxe (Metrium, Dribbble): um bloco neutro à esquerda e
// as oito famílias como faixas verticais encostadas, com o nome girado, um
// círculo com a contagem em cima e a seta embaixo. Os números vão para o
// resumo de duas linhas da faixa preta, como nas outras páginas 1.0 (a linha
// de números com o entalhe curvo da referência saiu em 28/09/2026).
//
// Guia: docs/DESIGN-HUB-1.0.md. Spec desta página: três propostas julgadas por
// coerência com o hub, fidelidade à referência e uso real na fábrica.
//
// Regra 60/30/10 (telas novas): o neutro é a barra, o bloco da busca e a
// faixa preta; as faixas das famílias são a secundária (~37%, a proporção da
// referência — declarado); o preto fica nos círculos, no Copiar e no que está
// ligado. As faixas são pintadas com Pantones REAIS da própria família: um
// catálogo de cor não pode abrir com tintas que não existem no livro.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FocusEvent as FocusEventReact, KeyboardEvent as KeyboardEventReact, ReactNode } from "react";

import { useHubDados } from "../v1a/HubDadosV1a";
import { PROCESSO, chaveNome, cmykDe, familiaDe } from "../v1a/PantoneV1a";
import type { Recorte } from "../v1a/PantoneV1a";
import { nomeDaBusca } from "@/lib/nomes-de-cor";
/* a conta dos nomes de cor é a mesma da caixa "Escolher cor" (simulação 5, 05/10/2026) */
import { naFaixaDoNome, parecidasComNome } from "./PantoneHub10";
import { PANTONE_SC } from "../v1a/dados/pantone";
import { prefixoPantone } from "../v1a/dados/pantone-busca";
import { tabelaViva, type ExtrasPantone } from "../v1a/dados/pantone-vivo";
import { AMARELO, AMARELO_MAIS, BOTAO_CLARO, BOTAO_ESCURO, BarraTopoHub10, FECHAR_X, FR, FUNDO, FUNDO_PAGINA, FUNDO_PESQUISA, INTER, NIVEL, PRETO, PalcoFixo, RAIO_DA_PESQUISA, numeroPedido, useEscDoTopo } from "./ChromeHub10";
import { CAPA_V4, ResumoDoPeV4, TrilhaV4, tituloDoPeV4 } from "./CapaV4Hub10";
import { LINHA_DA_GRADE, baseFraunces, baseInter, folgaDireitaInter, folgaFraunces, folgaInter } from "./grade-hub10";
import { criarBusca } from "@/lib/busca";
import { colherBusca, espiarBusca, semearBusca } from "@/lib/busca-semente";
import { hasPerm } from "@/lib/session";
import type { SessionUser } from "@/lib/session";
import { PALETA } from "@/lib/paleta-hub";
import { coresEfetivas } from "@/lib/cores";

/* ————— medidas e tintas (as de Ferramentais, copiadas — ela está finalizada) ————— */
const CINZA = "#8f8f8f";
const TINTA2 = "#5b595b";
const TINTA3 = "#6f6d6f";
const MARCA: CSSProperties = { fontSize: 18, fontWeight: 600, color: CINZA, whiteSpace: "nowrap" };
const TITULO: CSSProperties = { ...FR, fontSize: 56, lineHeight: "56px", letterSpacing: "-.04em" };
const ALTURA = 968;            /* 1080 menos a barra */
const COL_ESQ = 720;           /* 9 colunas */
/* O menu da página (rodapé de Pedidos): borda 1px, raio 12 — não a caixa de
   borda 1,5 e sombra pesada dos modais. */
const CAIXA_POP: CSSProperties = {
  position: "absolute", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12,
  padding: 8, display: "flex", flexDirection: "column", gap: 3,
};
const SOMBRA_BAIXO = "0 20px 44px -16px rgba(0,0,0,.5)";
const SOMBRA_CIMA = "0 -14px 40px -16px rgba(0,0,0,.6)";

/* A capa: o bloco da busca ocupa 8 colunas; as faixas, 2 colunas cada. */
/* A capa (v4, Augusto, 02/10/2026: "e a pantones também", só a capa; a
   mesma estrutura de Arquivos, que ele escolheu): o painel da busca da c1 à
   c9 (640) e as famílias em cartões de 160 a partir da c9; cabem 7, a oitava
   chega pela rolagem. O que fica no pé do painel e das faixas desce o que o
   cartão v4 cresceu (720 contra os 616 da faixa preta). */
const HERO_L = 640;
const FAIXA = 160;
const FAIXAS_X = 80 + HERO_L;
const DESCE = CAPA_V4.altura - 616;
/* a pílula do pé: a do pé da Solicitação (44 de altura, borda 2,21, 0,85
   acima da linha 63) */
const PILULA_PE_ALT = 44.04;
const TOPO_PILULA_PE = CAPA_V4.basePe - 0.85 - PILULA_PE_ALT;
/* Cada faixa é pintada com um Pantone da própria família, conferido na régua
   de família (dados/familia-cor.ts). A tinta do texto sai do contraste: preto
   onde o preto passa de 4,5:1; senão o cinza-claro do fundo. */
const FAIXAS = [
  { k: "amarelo", label: "Amarelos", pl: "amarelos", cod: "7403 C", tinta: PRETO },
  { k: "laranja", label: "Laranjas", pl: "laranjas", cod: "1565 C", tinta: PRETO },
  { k: "vermelho", label: "Vermelhos", pl: "vermelhos", cod: "7625 C", tinta: PRETO },
  { k: "rosa", label: "Rosas e roxos", pl: "rosas e roxos", cod: "197 C", tinta: PRETO },
  { k: "azul", label: "Azuis", pl: "azuis", cod: "7700 C", tinta: FUNDO },
  { k: "verde", label: "Verdes", pl: "verdes", cod: "7730 C", tinta: PRETO },
  { k: "marrom", label: "Marrons", pl: "marrons", cod: "10363 C", tinta: FUNDO },
  { k: "neutro", label: "Neutros", pl: "neutros", cod: "Warm Gray 3 C", tinta: PRETO },
] as const;
const HEX_DE = new Map(PANTONE_SC.map((c) => [c.c, c.h]));
const hexFaixa = (k: string) => HEX_DE.get(FAIXAS.find((f) => f.k === k)?.cod ?? "") ?? "#cccccc";

/* Status em que a arte já foi aprovada pelo cliente. "Refazer clichê" só
   existe depois do clichê (e volta para ele): a cor continua aprovada. */
const APROVADOS = new Set(["aprovada", "cliche", "refazer_cliche", "concluido"]);

/* Tons: L do Lab oficial. */
const TONS = [
  { k: "claras", rot: "Claras", sing: "claro", ok: (L: number) => L >= 70 },
  { k: "medias", rot: "Médias", sing: "médio", ok: (L: number) => L >= 45 && L < 70 },
  { k: "escuras", rot: "Escuras", sing: "escuro", ok: (L: number) => L < 45 },
] as const;
type TomK = (typeof TONS)[number]["k"];
const tomDe = (L: number | null) => (L == null ? null : TONS.find((t) => t.ok(L)) ?? null);

/* ————— o painel na grade —————
   O painel começa embaixo da barra (112): a linha k da grade fica em k·LG − 112
   aqui dentro. Tinta na coluna e base na linha, como nas outras telas 1.0
   (Augusto, 30/09/2026: "fora do grid e veja o que mais está fora nessa
   página"). */
const LG = LINHA_DA_GRADE;
const naLinha = (k: number) => k * LG - 112;

/* A grade desenha só as linhas à vista (mais uma folga): com as 3.225 cores
   montadas, cada clique levava de 50 a 390 ms para responder. */
const COLS = 7;
/* Cada fileira de amostras ocupa 6 linhas da grade. Com 90 px ela saía do
   ritmo e só o código da 1ª fileira caía numa linha. */
const LINHA = 6 * LG;
const ALTURA_GRADE = 7 * LINHA;   /* 7 fileiras à vista */
const FOLGA = 4;
/* a base do código dentro da amostra (rótulo 14/15 a 56 do topo) */
const BASE_NA_AMOSTRA = 56 + baseInter(14, 15);
/* o código da 1ª fileira na linha 22, a mesma do código grande à direita */
const TOPO_DA_GRADE = naLinha(22) - BASE_NA_AMOSTRA;
/* a borda direita da última coluna de amostras: onde terminam os tons e o "Ordem" */
const FIM_DAS_AMOSTRAS = 80 + COLS * 80 - 8;
/* a pesquisa (37 de altura, texto 14/1 no meio) com a base na linha 63 */
const TOPO_DO_PE = naLinha(63) - ((37 - 14) / 2 + baseInter(14, 14));

const EXEMPLOS = ["485", "P 185", "#D7271B", "vermelho sangue"];
const NOMES_SUGERIDOS = ["azul bic", "vinho", "verde bandeira", "off white", "cinza chumbo", "mostarda"];

type Cor = {
  codigo: string; nome: string; hex: string; cmyk: string; lab: string;
  L: number | null; croma: number; familia: string; origem: "processo" | "sc" | "extra"; nota?: string; i: number;
  /** o Lab oficial do livro, para a busca por nome de referência (processo não tem) */
  lab3: [number, number, number] | null;
};
type CorCrua = { c: string; h: string; l: [number, number, number] };
type Uso = { numero: string; cliente: string; id: string };
type RecorteK = "todas" | "processo" | "usados" | (typeof FAIXAS)[number]["k"];
type Ordem = "claras" | "escuras" | "codigo" | "usados";
type Copia = { alvo: "nome" | "lab" | "hex" | "cmyk"; ok: boolean; codigo: string } | null;

const ROTULO_ORDEM: Record<Ordem, string> = {
  usados: "Mais usados primeiro", claras: "Claras primeiro", escuras: "Escuras primeiro", codigo: "Por código",
};
const FRASE_ORDEM: Record<Ordem, string> = {
  usados: "do mais usado ao menos usado", claras: "das mais claras às mais escuras",
  escuras: "das mais escuras às mais claras", codigo: "em ordem de código",
};
const ordemPadrao = (r: RecorteK): Ordem => (r === "usados" ? "usados" : "claras");

/* ————— ajudantes ————— */
/** A semente da busca do topo é para esta página? Código, hex ou nome de cor.
    Sem isso, uma semente de outra tela ("Cliente X") abriria "0 cores". */
function sementeValida(s: string): boolean {
  if (!s) return false;
  const q = limpar(s).toUpperCase();
  return PANTONE_SC.some((c) => { const k = c.c.toUpperCase(); return k === q || k === `${q} C` || k.startsWith(q) || k.replace(/ C$/, "").split(" ").includes(q); })
    || PROCESSO.some((c) => semAcento(c.codigo) === semAcento(s))
    || ehHex(s) || !!nomeDaBusca(s);
}
const fmt = (n: number) => n.toLocaleString("pt-BR");
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/** "P 185", "P185", "Pantone 485", "pantone485" → o código como a tabela escreve. */
const limpar = (q: string) => q.replace(/^\s*p(antone)?\s*(?=\d)/i, "").replace(/^\s*p(antone)?\s+/i, "").trim();
const idCel = (codigo: string) => `pn10-${codigo.replace(/[^A-Za-z0-9]/g, "")}`;
const ehHex = (q: string) => /^#?[0-9a-f]{6}$/i.test(q.trim());

/* Quem digita "485" quer a 485 C, e não a 1485 C que vem antes no livro:
   exato, começa com, contém; por último o que só bateu no hex ou no CMYK. */
function relevancia(c: Cor, termo: string): number {
  const q = limpar(termo).toUpperCase();
  if (!q) return 0;
  const cod = c.codigo.toUpperCase();
  /* palavra inteira também é exata: "021" é a Orange 021 C */
  if (cod === q || cod === `${q} C` || cod.replace(/ C$/, "").split(" ").includes(q.replace(/ C$/, ""))) return 0;
  if (cod.startsWith(q)) return 1;
  if (cod.includes(q)) return 2;
  return 3;
}

function luminancia(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}

/* Lab de TELA (sRGB D65) a partir do hex — só para achar o hex mais próximo:
   os dois lados da conta são conversão de tela, e a página diz isso. */
function labDoHex(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const lin = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const r = lin((n >> 16) & 255), g = lin((n >> 8) & 255), b = lin(n & 255);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* A cópia de antes dizia "Código copiado" nos dois casos (`.then(marcar,
   marcar)`) — e sem área de transferência, sem nem tentar. O designer colava no
   Illustrator o que estava copiado antes. Agora só diz que copiou se copiou. */
async function copiarTexto(t: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(t); return true; }
  } catch { /* sem permissão ou sem contexto seguro: tenta o caminho antigo */ }
  /* O caminho antigo copia o que está selecionado na página. Se a seleção do
     textarea não pegava (navegador embutido), ia o texto selecionado antes: o
     Hex de uma cópia que falhou (Augusto, 02/10/2026: "ao clicar no botão
     copiar, copio o HEX da cor"). O evento de cópia põe o texto certo. */
  const porTexto = (e: ClipboardEvent) => { e.clipboardData?.setData("text/plain", t); e.preventDefault(); };
  document.addEventListener("copy", porTexto, true);
  const antes = document.activeElement as HTMLElement | null;
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.readOnly = true;
    Object.assign(ta.style, { position: "fixed", opacity: "0", left: "0", top: "0" });
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    ta.remove(); antes?.focus();
    return ok;
  } catch { antes?.focus(); return false; }
  finally { document.removeEventListener("copy", porTexto, true); }
}

/* "vermelho sangue" → "vermelhos escuros": o que a busca por nome entendeu,
   em palavras da fábrica — sem "L até 42 · croma". */
function descrever(r: Recorte & { matiz?: [number, number] }): string {
  const fams = r.familias ?? (r.familia ? [r.familia] : FAIXAS.map((f) => f.k as string));
  /* com o matiz, a família "rosas e roxos" vira só uma das duas */
  const nomes = fams.map((k) => (k === "rosa" && r.matiz ? (r.matiz[0] >= 260 && r.matiz[0] < 330 ? "roxos" : "rosas") : FAIXAS.find((f) => f.k === k)?.pl ?? k));
  let t = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}` : nomes[0];
  if (r.L) { const [a, b] = r.L; t += b <= 45 ? " escuros" : a >= 60 ? " claros" : a >= 30 && b <= 75 ? " médios" : ""; }
  if (r.croma) { if (r.croma[0] >= 45) t += " vivos"; else if (r.croma[1] <= 45) t += " suaves"; }
  return t;
}

/* ————— a amostra da grade —————
   `memo` porque "Todas as cores" tem 3.225: trocar a seleção redesenha só as
   duas que mudaram. A amostra NUNCA muda de cor nem ganha transparência no
   hover — cor que muda na tela engana o olho; quem escurece é o rótulo. */
const Amostra = memo(function Amostra({ c, on, usoN, focavel, dE, pos, total, aoEscolher, aoCopiar }: {
  c: Cor; on: boolean; usoN: number; focavel: boolean; dE: number | null; pos: number; total: number;
  aoEscolher: (codigo: string) => void; aoCopiar: (codigo: string) => void;
}) {
  const claro = luminancia(c.hex) >= 0.8;
  const titulo = [c.nome, `Hex ${c.hex}`, c.cmyk !== "—" ? `CMYK ${c.cmyk}` : "",
    usoN ? `aprovada em ${usoN} ${usoN === 1 ? "pedido" : "pedidos"}` : "",
    dE != null ? `ΔE ${dE.toFixed(1).replace(".", ",")}` : ""].filter(Boolean).join(" · ");
  return (
    <button id={idCel(c.codigo)} role="option" aria-selected={on} aria-posinset={pos} aria-setsize={total} tabIndex={focavel ? 0 : -1} className="pn10-cel"
      onClick={() => aoEscolher(c.codigo)} onFocus={() => aoEscolher(c.codigo)} onDoubleClick={() => aoCopiar(c.codigo)} title={titulo}
      style={{ position: "relative", display: "block", width: 80, height: LINHA, padding: 0, border: 0, background: "none",
        cursor: "pointer", textAlign: "left", fontFamily: INTER, contentVisibility: "auto", containIntrinsicSize: `80px ${LINHA}px` } as CSSProperties}>
      <span aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 72, height: 52, background: c.hex,
        boxShadow: on ? "inset 0 0 0 3px #000, inset 0 0 0 5px #fff" : claro ? "inset 0 0 0 1px rgba(0,0,0,.12)" : "none" }} />
      {/* o código com a tinta na mesma coluna da amostra */}
      <span className="pn10-cod" style={{ position: "absolute", left: -folgaInter(600, 14, c.codigo.charAt(0)), top: 56, width: 76, font: `600 14px/15px ${INTER}`,
        display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", overflowWrap: "anywhere" } as CSSProperties}>
        {c.codigo}
        {usoN > 0 && <span aria-hidden style={{ display: "inline-block", width: 6, height: 6, borderRadius: 999, background: PRETO, marginLeft: 4, verticalAlign: 2 }} />}
      </span>
    </button>
  );
});

/** A marca de 14px do seletor: a cor da faixa, o CMYK do processo, um
    quadrado vazado para os usados. */
function MarcaRecorte({ k }: { k: RecorteK | "varias" }) {
  const base: CSSProperties = { flex: "none", width: 14, height: 14, boxSizing: "border-box" };
  if (k === "todas" || k === "varias") return <span aria-hidden style={{ ...base }} />;
  if (k === "usados") return <span aria-hidden style={{ ...base, border: `1.5px solid ${PRETO}` }} />;
  if (k === "processo") return (
    <span aria-hidden style={{ ...base, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
      {["#009FE3", "#E5007E", "#FFED00", "#1D1D1B"].map((h) => <span key={h} style={{ background: h }} />)}
    </span>
  );
  return <span aria-hidden style={{ ...base, background: hexFaixa(k), boxShadow: "inset 0 0 0 1px rgba(0,0,0,.18)" }} />;
}

/* ————— o que é cada valor —————
   Vendedora e produção não têm obrigação de saber o que é Lab ou por que o
   hex não serve para imprimir. Um "i" ao lado de cada rótulo abre o balão
   (Augusto, 25/09/2026). Texto honesto com o que o hub mostra: o CMYK daqui é
   uma conta a partir do hex, não a conversão oficial da Pantone. */
type Ajuda = { titulo: string; sub: string; oque: string; uso: string };
const AJUDA: Record<"lab" | "hex" | "cmyk" | "familia", Ajuda> = {
  lab: {
    titulo: "Lab",
    /* imprimimos em Pantone e em CMYK: o Lab é a cor que as duas têm de
       alcançar (Augusto, 02/10/2026: "o usuário não vai entender por que o
       Lab é a cor real") */
    sub: "A cor de verdade, medida no livro",
    oque: "Três números que um aparelho (o espectrofotômetro) lê na cor do livro da Pantone: o L diz se ela é clara ou escura; o a, se puxa para o verde ou para o vermelho; o b, se puxa para o azul ou para o amarelo. É a única medida da cor; o Hex e o CMYK são contas feitas a partir dela.",
    uso: "É o alvo da impressão. Imprimindo em Pantone (a tinta especial) ou em CMYK (as quatro tintas), a cor impressa tem de chegar perto destes números. É o que vale quando alguém diz que a cor não está igual.",
  },
  hex: {
    titulo: "Hex",
    sub: "A cor na tela",
    oque: "O código que o computador usa para mostrar a cor no monitor (começa com #). Cada tela mostra a mesma cor um pouco diferente.",
    uso: "Arte digital, mockup e apresentação para o cliente. Não serve para imprimir nem para aprovar cor.",
  },
  cmyk: {
    titulo: "CMYK",
    sub: "A cor em quatro tintas",
    oque: "Quanto de ciano, magenta, amarelo e preto (de 0 a 100) chega perto desta cor. É uma conta aproximada feita pelo hub, e muitos Pantones não saem só com essas quatro tintas.",
    uso: "Ponto de partida quando o cliente não vai pagar a cor especial e a arte vai em quatro cores. Sempre com prova de cor.",
  },
  familia: {
    titulo: "Família",
    sub: "Onde o hub guarda a cor",
    oque: "O grupo de tom em que esta cor aparece nas faixas da capa (Azuis, Vermelhos e as outras). Quem calcula é o hub, a partir da medida da cor. Não é uma informação da Pantone.",
    uso: "Achar a cor navegando, sem saber o código.",
  },
};

/** O "i" e o balão. Abre com o mouse em cima, com o foco do teclado ou no
    clique (que o deixa fixo); fecha ao sair, com ESC ou clicando fora. */
function InfoCor({ id, ajuda, aberto, fixo, lado, aoAbrir, aoFechar }: {
  id: string; ajuda: Ajuda; aberto: boolean; fixo: boolean; lado: "esq" | "dir";
  aoAbrir: (fixar: boolean) => void; aoFechar: (forcar: boolean) => void;
}) {
  return (
    <span data-pn10-ajuda style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: 8 }}
      onMouseEnter={() => aoAbrir(false)} onMouseLeave={() => aoFechar(false)}>
      <button className="pn10-info" aria-label={`O que é ${ajuda.titulo}?`} aria-expanded={aberto} aria-describedby={aberto ? id : undefined}
        onClick={() => (aberto && fixo ? aoFechar(true) : aoAbrir(true))} onFocus={() => aoAbrir(false)} onBlur={() => aoFechar(false)}
        style={{ width: 20, height: 20, boxSizing: "border-box", padding: 0, borderRadius: 999, border: `1.5px solid ${aberto ? PRETO : CINZA}`,
          background: aberto ? PRETO : "none", color: aberto ? "#fff" : TINTA2, cursor: "pointer", display: "grid", placeItems: "center",
          font: `700 12px/1 ${INTER}` }}>i</button>
      {aberto && (
        <span id={id} role="tooltip"
          style={{ ...CAIXA_POP, display: "block", top: 34, [lado === "esq" ? "left" : "right"]: 0, width: 360, padding: "16px 18px", zIndex: NIVEL.verTodos,
            boxShadow: SOMBRA_BAIXO, textAlign: "left", whiteSpace: "normal", cursor: "default" } as CSSProperties}>
          <span style={{ display: "block", font: `700 16px/1.3 ${INTER}`, color: PRETO }}>{ajuda.titulo}</span>
          <span style={{ display: "block", marginTop: 2, font: `600 15px/1.3 ${INTER}`, color: TINTA2 }}>{ajuda.sub}</span>
          <span style={{ display: "block", marginTop: 8, font: `400 15px/1.45 ${INTER}`, color: "#3c3a3c" }}>{ajuda.oque}</span>
          <span style={{ display: "block", marginTop: 10, font: `400 15px/1.45 ${INTER}`, color: "#3c3a3c" }}>
            <b style={{ fontWeight: 700, color: PRETO }}>Para que serve: </b>{ajuda.uso}
          </span>
        </span>
      )}
    </span>
  );
}

/** O par rótulo/valor das fichas 1.0 (CampoHub10), com o valor clicável para
    copiar só ele — quem monta a separação copia o CMYK, não o nome. */
function CampoCopiavel({ rotulo, valor, estado, aoCopiar, info, refValor }: {
  rotulo: string; valor: string; estado: "ok" | "falha" | null; aoCopiar?: () => void; info?: ReactNode;
  refValor?: (el: HTMLElement | null) => void;
}) {
  /* rótulo 24/24 e valor 24/30: a base do valor fica 2 linhas da grade abaixo
     da base do rótulo. O +1 é o do Fraunces 24 da marca do rodapé: medido,
     a base cai 1 px acima do que `baseFraunces` diz. */
  const valorEstilo: CSSProperties = { marginTop: 2 * LG - 24 + baseInter(24, 24) - baseFraunces(24, 30) + 1, fontSize: 24, lineHeight: "30px", fontWeight: 800, fontFamily: "Fraunces", letterSpacing: "-1px",
    overflowWrap: "anywhere", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", color: PRETO } as CSSProperties;
  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <div style={{ fontSize: 24, lineHeight: "24px", fontWeight: 400, color: estado ? PRETO : undefined }}>
        {estado === "ok" ? "Copiado" : estado === "falha" ? "Não deu: aperte Ctrl+C" : rotulo}
        {info}
      </div>
      {aoCopiar ? (
        <button ref={refValor} onClick={aoCopiar} className="pn10-valor" title={`Clique para copiar ${valor}`}
          style={{ ...valorEstilo, padding: 0, border: 0, background: "none", textAlign: "left", cursor: "copy" }}>{valor}</button>
      ) : <div style={valorEstilo}>{valor}</div>}
    </div>
  );
}

/* ————— a página ————— */
export function PantonesHub10({ profile, pedidos, pedidosProntos = true, aoNavegar, onNova, onLogout, disponiveis, podeAtualizar = false }: {
  profile: SessionUser;
  pedidos: any[];
  /** a lista de pedidos já chegou? Antes disso "nenhum aprovado" seria mentira */
  pedidosProntos?: boolean;
  aoNavegar: (label: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  /** config.sistema — só quem administra o hub procura cores novas */
  podeAtualizar?: boolean;
}) {
  const dados = useHubDados();
  /* Vendedora sem `pedidos.ver_todos` só recebe os PRÓPRIOS pedidos: dizer
     "ainda não aprovada em pedido" seria falso quando uma colega já aprovou. */
  const veTodos = hasPerm(profile, "pedidos.ver_todos");
  const nosPedidos = veTodos ? "em pedidos" : "nos seus pedidos";
  const podeArquivos = !disponiveis || disponiveis.includes("Arquivos");

  /* ————— cores que chegaram depois do build (color book novo) ————— */
  const [extras, setExtras] = useState<ExtrasPantone>({});
  const [extrasFalhou, setExtrasFalhou] = useState(false);
  const [recado, setRecado] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const recarregarExtras = useCallback(async () => {
    const m = await import("@/lib/api/pantone.functions");
    const r = await m.listPantoneExtras();
    setExtras(r as ExtrasPantone);
    setExtrasFalhou(false);
  }, []);
  useEffect(() => {
    let vivo = true;
    void import("@/lib/api/pantone.functions")
      .then((m) => m.listPantoneExtras())
      .then((r) => { if (vivo) setExtras(r as ExtrasPantone); })
      .catch(() => { if (vivo) setExtrasFalhou(true); });
    return () => { vivo = false; };
  }, []);
  /* a caixa terminou: relê a tabela e deixa o recado no rodapé */
  const aoAtualizarTabela = useCallback((frase: string) => {
    setRecado(frase);
    recarregarExtras().catch(() => setRecado(`${frase} Recarregue a página para ver as cores.`));
  }, [recarregarExtras]);

  /* ————— a pasta física do cliente (a mesma do Arquivos) ————— */
  const [pastas, setPastas] = useState<Record<string, { pasta: string; gaveta: string }>>({});
  const [pastasFalhou, setPastasFalhou] = useState(false);
  useEffect(() => {
    let vivo = true;
    void import("@/lib/api/arquivo.functions")
      .then((m) => m.listArquivo())
      .then((r) => {
        if (!vivo) return;
        const mapa: Record<string, { pasta: string; gaveta: string }> = {};
        for (const l of ((r as { linhas?: { nome?: string; pasta?: string; gaveta?: string }[] }).linhas ?? [])) {
          const chave = chaveNome(l.nome ?? "");
          if (chave && !mapa[chave]) mapa[chave] = { pasta: String(l.pasta ?? ""), gaveta: String(l.gaveta ?? "") };
        }
        setPastas(mapa);
      })
      .catch(() => { if (vivo) setPastasFalhou(true); });
    return () => { vivo = false; };
  }, []);

  /* ————— o catálogo ————— */
  const todas = useMemo<Cor[]>(() => {
    const proc: Cor[] = PROCESSO.map((c, i) => ({
      codigo: c.codigo, nome: c.codigo, hex: c.hex.toUpperCase(), cmyk: c.cmyk, lab: "—",
      L: null, croma: 0, familia: "processo", origem: "processo", nota: c.nota, i, lab3: null,
    }));
    /* a embutida com os valores do livro novo, mais as cores que só ele tem */
    const v = (n: number) => String(n).replace(".", ",");
    const crus = tabelaViva(extras).map((c) => [c, c.origem] as [CorCrua, "sc" | "extra"]);
    return proc.concat(crus.map(([c, origem], j) => ({
      codigo: c.c,
      nome: prefixoPantone(c.c),
      hex: c.h.toUpperCase(),
      cmyk: cmykDe(c.h),
      lab: `L ${v(c.l[0])}  a ${v(c.l[1])}  b ${v(c.l[2])}`,
      L: c.l[0],
      croma: Math.round(Math.hypot(c.l[1], c.l[2])),
      familia: familiaDe(c.l),
      origem,
      i: proc.length + j,
      lab3: c.l,
    })));
  }, [extras]);
  const porCodigo = useMemo(() => new Map(todas.map((c) => [c.codigo.toUpperCase(), c])), [todas]);
  const nExtras = todas.filter((c) => c.origem === "extra").length;
  const nPantones = todas.length - PROCESSO.length;
  const contagemFamilia = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of todas) m[c.familia] = (m[c.familia] ?? 0) + 1;
    return m;
  }, [todas]);

  /* Usado = cor de pedido cuja arte o cliente APROVOU (aprovada, clichê,
     concluído). O leitor antigo só aceitava "Pantone 485 C" e "485 C": o
     próprio hub grava "P 485 C" desde 23/09 (Design criado), e esses sumiam —
     com eles os códigos de 5 dígitos e os de nome ("Warm Red C"). Agora cada
     pedaço é conferido contra o catálogo. */
  const usados = useMemo(() => {
    const mapa: Record<string, Uso[]> = {};
    for (const p of pedidos) {
      const st = String(p?.status ?? "");
      if (!APROVADOS.has(st)) continue;
      const numero = String(p?.numero ?? ""), cliente = String(p?.cliente ?? ""), id = String(p?.id ?? "");
      /* as da arte quando a prova foi lida; senão as pedidas */
      for (const peca of coresEfetivas(p).split(/[+,;/\n]/)) {
        let s = peca.trim().toUpperCase().replace(/\s+/g, " ");
        if (!s) continue;
        s = s.replace(/^PANTONE\s*/, "").replace(/^P\s+/, "").replace(/^P(?=\d)/, "").replace(/(\d)C$/, "$1 C");
        let cor = porCodigo.get(s) ?? porCodigo.get(`${s} C`);
        /* "Pantone 117 C marca d'água": o código está no trecho, com texto em volta */
        if (!cor) { const m = /(?:^|\s)(?:P(?:ANTONE)?\s*)?(\d{3,5})\s*C\b/.exec(s); if (m) cor = porCodigo.get(`${m[1]} C`); }
        if (!cor || cor.origem === "processo") continue;      /* "Preto", "Verde", lixo: fora */
        const lista = mapa[cor.codigo] ?? (mapa[cor.codigo] = []);
        if (!lista.some((u) => u.numero === numero)) lista.push({ numero, cliente, id });
      }
    }
    for (const k of Object.keys(mapa)) mapa[k].sort((a, b) => (Number(b.numero) || 0) - (Number(a.numero) || 0));
    return mapa;
  }, [pedidos, porCodigo]);
  /* os mais aprovados primeiro; empate, o pedido mais recente */
  const rankUsados = useMemo(() => Object.keys(usados).sort((a, b) =>
    usados[b].length - usados[a].length || (Number(usados[b][0]?.numero) || 0) - (Number(usados[a][0]?.numero) || 0)), [usados]);
  const posUsado = useMemo(() => new Map(rankUsados.map((k, i) => [k, i])), [rankUsados]);

  /* ————— estado da página ————— */
  /* Veio de um resultado da busca do topo? Só entra direto na busca se a
     semente fizer sentido aqui — senão, uma semente velha de outra página
     abriria o painel com "0 cores para 'Cliente X'". */
  const [semente] = useState(() => {
    const s = colherBusca().trim();
    return sementeValida(s) ? s : "";
  });
  const [aberto, setAberto] = useState(!!semente);
  const [recorte, setRecorte] = useState<RecorteK>("todas");
  const [tom, setTom] = useState<TomK | null>(null);
  const [ordem, setOrdem] = useState<Ordem>("claras");
  const [busca, setBusca] = useState(semente);
  const [recorteAntes, setRecorteAntes] = useState<{ recorte: RecorteK; tom: TomK | null } | null>(semente ? { recorte: "todas", tom: null } : null);
  const [selCod, setSelCod] = useState<string | null>(null);
  const [menu, setMenu] = useState<null | "recorte" | "ordem">(null);
  const [copia, setCopia] = useState<Copia>(null);
  /* o balão de ajuda aberto (um de cada vez) e se foi fixado no clique */
  const [ajuda, setAjuda] = useState<{ k: keyof typeof AJUDA; fixo: boolean } | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [heroTexto, setHeroTexto] = useState("");
  const [pontas, setPontas] = useState({ topo: false, base: false });
  const [rolagem, setRolagem] = useState(0);

  const heroRef = useRef<HTMLInputElement | null>(null);
  const adminRef = useRef<HTMLDivElement | null>(null);
  /* o fim do título do pé (v4), para a pílula vir 44 depois dele */
  const tituloPeRef = useRef<HTMLDivElement | null>(null);
  const [fimTituloPe, setFimTituloPe] = useState(80 + 440);
  useEffect(() => {
    const el = tituloPeRef.current;
    if (!el) return;
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo && el.isConnected) setFimTituloPe(el.offsetLeft + el.offsetWidth); });
    return () => { vivo = false; };
  }, []);
  const estadoRef = useRef<HTMLDivElement | null>(null);
  /* a frase da grade vazia: com a lista vazia a contagem fica em branco e o leitor de tela lê esta */
  const vazioRef = useRef<HTMLDivElement | null>(null);
  /* A 1ª letra da contagem na c1: a folga muda com a letra e com o peso
     (a contagem costuma abrir em negrito, "287 cores"). Medida depois de
     desenhar, porque a frase muda a cada tecla. */
  const [folgaEstado, setFolgaEstado] = useState(1);
  useLayoutEffect(() => {
    const el = estadoRef.current;
    if (!el) return;
    const txt = (el.textContent ?? "").trimStart();
    const b = el.firstElementChild;
    const peso = b?.tagName === "B" && txt.startsWith((b.textContent ?? "").trimStart()) ? 600 : 400;
    const f = folgaInter(peso, 18, txt.charAt(0));
    setFolgaEstado((atual) => (Math.abs(atual - f) < 0.01 ? atual : f));
  });
  const pesquisaRef = useRef<HTMLInputElement | null>(null);
  const gradeRef = useRef<HTMLDivElement | null>(null);
  const codigoRef = useRef<HTMLButtonElement | null>(null);
  const seletorRef = useRef<HTMLButtonElement | null>(null);
  const ordemRef = useRef<HTMLButtonElement | null>(null);
  const origemRef = useRef<HTMLElement | null>(null);
  const focoAoAbrir = useRef<"grade" | "pesquisa" | "centro" | null>(semente ? "pesquisa" : null);
  const devolverFoco = useRef(false);
  const tCopia = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tCopia.current) clearTimeout(tCopia.current); }, []);

  /* ————— o que a busca é ————— */
  const q = busca.trim();
  /* Código exato vence nome de cor: "Pink C" e "Warm Red" são códigos, não a
     faixa "rosa vivo". */
  const exato = useMemo(() => {
    if (!q) return null;
    const k = limpar(q).toUpperCase();
    const c = porCodigo.get(k) ?? porCodigo.get(`${k} C`);
    return c && c.origem !== "processo" ? c : null;
  }, [q, porCodigo]);
  /* o nome de cor da busca (src/lib/nomes-de-cor): de referência ou de faixa */
  const nomeBusca = useMemo(() => (q && !exato ? nomeDaBusca(q) : null), [q, exato]);
  const procBusca = q ? todas.find((c) => c.origem === "processo" && semAcento(c.codigo) === semAcento(q)) ?? null : null;
  /* Lab de tela de cada cor — só se alguém digitar um hex que não existe */
  const labTela = useRef<Map<string, [number, number, number]> | null>(null);
  useEffect(() => { labTela.current = null; }, [todas]);

  const { achados, modo, dist, refDe } = useMemo((): {
    achados: Cor[]; modo: "nome" | "codigo" | "hexProximo" | null; dist: Map<string, number> | null;
    /** na busca por nome de referência, a referência mais perto de cada cor */
    refDe?: Map<string, string>;
  } => {
    const ordenar = (lista: Cor[]) => {
      const proc = lista.filter((c) => c.origem === "processo");
      const resto = lista.filter((c) => c.origem !== "processo");
      if (ordem === "codigo") resto.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
      else if (ordem === "usados") resto.sort((a, b) => (posUsado.get(a.codigo) ?? 1e9) - (posUsado.get(b.codigo) ?? 1e9) || a.i - b.i);
      else if (ordem === "escuras") resto.sort((a, b) => (a.L ?? 0) - (b.L ?? 0) || b.croma - a.croma || a.i - b.i);
      else resto.sort((a, b) => (b.L ?? 0) - (a.L ?? 0) || b.croma - a.croma || a.i - b.i);
      return proc.concat(resto);
    };
    if (!q) {
      let lista: Cor[];
      if (recorte === "todas") lista = todas;
      else if (recorte === "processo") return { achados: todas.filter((c) => c.origem === "processo"), modo: null, dist: null };
      else if (recorte === "usados") lista = todas.filter((c) => !!usados[c.codigo]);
      else {
        const t = tom ? TONS.find((x) => x.k === tom) : null;
        lista = todas.filter((c) => c.familia === recorte && (!t || (c.L != null && t.ok(c.L))));
      }
      return { achados: ordenar(lista), modo: null, dist: null };
    }
    if (nomeBusca?.tipo === "ancora") {
      /* Nome de referência ("rosa choque", "azul bic"): só os Pantones mais
         parecidos com as referências dele, do mais perto ao mais longe, pelo
         ΔE2000 no Lab do livro, até o raio do nome (Augusto, 02/10/2026: a
         faixa trazia muitas cores e algumas vagas). A Ordem não se aplica.
         A conta (metálico só nos nomes de metal, neon só nos de neon) mora
         na PantoneHub10: a caixa "Escolher cor" faz a mesma. */
      const lista = parecidasComNome(nomeBusca, todas, (c) => c.codigo, (c) => c.lab3);
      /* "dourado" é tinta especial: ela entra primeiro, junto com os parecidos */
      return { achados: procBusca ? [procBusca, ...lista.map((x) => x.cor)] : lista.map((x) => x.cor), modo: "nome",
        dist: new Map(lista.map((x) => [x.cor.codigo, x.d])), refDe: new Map(lista.map((x) => [x.cor.codigo, x.ref])) };
    }
    if (nomeBusca) {
      /* nome de faixa ("azul claro", "verde"): a família do nome e, quando o
         termo pede, um recorte de claridade e saturação. Ignora o recorte aberto. */
      const r = nomeBusca;
      /* a mesma regra da caixa "Escolher cor"; roxo e rosa moram na mesma família, o matiz separa */
      const lista = todas.filter((c) => c.origem !== "processo" && naFaixaDoNome(r, c.familia, c.lab3));
      return { achados: procBusca ? [procBusca, ...ordenar(lista)] : ordenar(lista), modo: "nome", dist: null };
    }
    /* Código, hex e CMYK procuram SEMPRE no livro inteiro — com o recorte
       aberto, Azuis + "485" escondia a própria 485 C. */
    /* Hex digitado casa com o hex INTEIRO: pela busca livre, "7271B0" achava
       a 485 C (fim do hex + começo do CMYK) e o Enter copiava a cor errada. */
    const hexQ = ehHex(q) ? `#${q.replace("#", "").toUpperCase()}` : null;
    const casa = criarBusca(limpar(q));
    const lista = hexQ ? todas.filter((c) => c.hex === hexQ) : todas.filter((c) => casa(c.codigo, c.hex, c.cmyk))
      .map((c) => ({ c, r: relevancia(c, q) })).sort((x, y) => x.r - y.r || x.c.i - y.c.i).map((x) => x.c);
    if (lista.length || !ehHex(q)) return { achados: lista, modo: "codigo" as const, dist: null };
    /* Hex que não existe no livro (o do PDF do cliente): os 12 mais perto */
    if (!labTela.current || labTela.current.size !== todas.length) labTela.current = new Map(todas.map((c) => [c.codigo, labDoHex(c.hex)]));
    const alvo = labDoHex(hexQ!);
    const perto = todas.map((c) => ({ c, d: deltaE(alvo, labTela.current!.get(c.codigo) ?? labDoHex(c.hex)) })).sort((a, b) => a.d - b.d).slice(0, 12);
    return { achados: perto.map((x) => x.c), modo: "hexProximo" as const, dist: new Map(perto.map((x) => [x.c.codigo, x.d])) };
  }, [todas, porCodigo, q, nomeBusca, procBusca, recorte, tom, ordem, usados, posUsado]);

  const sel = (selCod ? achados.find((c) => c.codigo === selCod) : null) ?? achados[0] ?? null;
  const selRef = useRef<Cor | null>(null);
  selRef.current = sel;
  const achadosRef = useRef<Cor[]>(achados);
  achadosRef.current = achados;

  /* recorte, tom ou busca mudaram: a grade volta ao topo */
  useEffect(() => {
    const el = gradeRef.current;
    if (!el) return;
    const i = selCod ? achadosRef.current.findIndex((c) => c.codigo === selCod) : -1;
    if (i >= 0) rolarPara(i, true);
    else { el.scrollTop = 0; setRolagem(0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorte, tom, q, ordem]);

  /* ————— copiar ————— */
  const copiar = useCallback(async (texto: string, alvo: NonNullable<Copia>["alvo"], rotulo?: string, codigo?: string) => {
    const ok = await copiarTexto(texto);
    setCopia({ alvo, ok, codigo: codigo ?? selRef.current?.codigo ?? "" });
    setAnuncio(ok ? `${rotulo ?? texto} copiado` : "Não deu para copiar. Aperte Ctrl+C");
    const alvoEl = textoDe.current[alvo];
    if (!ok && alvoEl) {
      /* falhou: o texto que a pessoa pediu fica selecionado, para o Ctrl+C */
      const sl = window.getSelection();
      sl?.removeAllRanges();
      sl?.selectAllChildren(alvoEl);
    }
    if (tCopia.current) clearTimeout(tCopia.current);
    /* limpar o anúncio também: copiar a mesma cor de novo é anunciado de novo */
    tCopia.current = setTimeout(() => { setCopia(null); setAnuncio(""); }, 2000);
  }, []);
  /** o nó com o texto exato de cada cópia (nome escondido, Lab, Hex, CMYK) */
  const textoDe = useRef<Partial<Record<NonNullable<Copia>["alvo"], HTMLElement | null>>>({});
  const copiarSel = useCallback(() => { const s = selRef.current; if (s) void copiar(s.nome, "nome"); }, [copiar]);
  const escolher = useCallback((codigo: string) => {
    if (selRef.current?.codigo !== codigo) setCopia(null);
    setSelCod(codigo);
  }, []);
  const copiarDaGrade = useCallback((codigo: string) => {
    const c = achadosRef.current.find((x) => x.codigo === codigo);
    setSelCod(codigo);
    if (c) void copiar(c.nome, "nome", undefined, c.codigo);
  }, [copiar]);

  /* ————— abrir e fechar o painel ————— */
  const abrirRecorte = (k: RecorteK, origem: HTMLElement | null, codigo?: string) => {
    origemRef.current = origem;
    setRecorte(k); setTom(null); setBusca(""); setRecorteAntes(null); setOrdem(ordemPadrao(k));
    setSelCod(codigo ?? null); setMenu(null); setCopia(null);
    focoAoAbrir.current = codigo ? "centro" : "grade";
    setAberto(true);
  };
  const abrirBusca = (texto: string, origem?: HTMLElement | null) => {
    origemRef.current = origem ?? heroRef.current;
    setRecorte("todas"); setTom(null); setOrdem("claras"); setRecorteAntes({ recorte: "todas", tom: null });
    setBusca(texto); setSelCod(null); setMenu(null); setCopia(null); setHeroTexto("");
    focoAoAbrir.current = "pesquisa";
    setAberto(true);
  };
  const fecharPainel = useCallback(() => {
    setAberto(false); setBusca(""); setTom(null); setSelCod(null); setRecorteAntes(null); setMenu(null); setCopia(null);
    devolverFoco.current = true;
  }, []);
  useEscDoTopo(aberto, NIVEL.painel, fecharPainel);

  /* Rola a grade até a posição i da lista — pela conta, porque a peça pode
     ainda não estar desenhada (a grade só monta as linhas à vista). */
  const rolarPara = (i: number, centro = false) => {
    const el = gradeRef.current;
    if (!el || i < 0) return;
    const topo = Math.floor(i / COLS) * LINHA;
    if (centro) el.scrollTop = Math.max(0, topo - (ALTURA_GRADE - LINHA) / 2);
    else if (topo < el.scrollTop) el.scrollTop = topo;
    else if (topo + LINHA > el.scrollTop + ALTURA_GRADE) el.scrollTop = topo + LINHA - ALTURA_GRADE;
    setRolagem(el.scrollTop);
  };
  /** foca a peça depois que ela entrar na janela (dois quadros) */
  const focarPeca = (codigo: string) => requestAnimationFrame(() => requestAnimationFrame(() =>
    document.getElementById(idCel(codigo))?.focus({ preventScroll: true })));

  /* o foco vai para onde a pessoa vai trabalhar — e volta para quem abriu */
  useLayoutEffect(() => {
    if (!aberto || !focoAoAbrir.current) return;
    const alvo = focoAoAbrir.current;
    focoAoAbrir.current = null;
    if (alvo === "pesquisa") {
      const el = pesquisaRef.current;
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      return;
    }
    const s = selRef.current;
    if (!s) return;
    rolarPara(achadosRef.current.findIndex((c) => c.codigo === s.codigo), alvo === "centro");
    focarPeca(s.codigo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
  useEffect(() => {
    if (aberto || !devolverFoco.current) return;
    devolverFoco.current = false;
    const volta = origemRef.current && document.contains(origemRef.current) ? origemRef.current : heroRef.current;
    volta?.focus();
  }, [aberto]);

  /* ————— busca dentro do painel ————— */
  const mudarBusca = (v: string) => {
    if (!busca.trim() && v.trim()) { setRecorteAntes({ recorte, tom }); if (ordem === "usados") setOrdem("claras"); }
    if (busca.trim() && !v.trim()) {
      /* esvaziou: volta ao recorte de antes, e a cor achada continua escolhida */
      if (recorteAntes) { setRecorte(recorteAntes.recorte); setTom(recorteAntes.tom); setOrdem(ordemPadrao(recorteAntes.recorte)); }
      setRecorteAntes(null);
      setBusca(v);
      return;
    }
    setBusca(v);
    setSelCod(null);
  };
  const sairDaBusca = () => mudarBusca("");

  /* anda na lista sem sair do campo (↓/↑) ou da grade (setas) */
  const andar = (passo: number, focarCelula: boolean) => {
    const lista = achadosRef.current;
    if (!lista.length) return;
    const atual = selRef.current ? lista.findIndex((c) => c.codigo === selRef.current!.codigo) : -1;
    const i = Math.max(0, Math.min(lista.length - 1, (atual < 0 ? 0 : atual) + passo));
    const alvo = lista[i];
    setSelCod(alvo.codigo);
    setCopia(null);
    rolarPara(i);
    if (focarCelula) focarPeca(alvo.codigo);
  };
  const teclaPesquisa = (e: KeyboardEventReact<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); andar(1, false); }
    else if (e.key === "ArrowUp") { e.preventDefault(); andar(-1, false); }
    else if (e.key === "PageDown") { e.preventDefault(); andar(49, false); }
    else if (e.key === "PageUp") { e.preventDefault(); andar(-49, false); }
    else if (e.key === "Enter") { e.preventDefault(); copiarSel(); }
    else if (e.key === "Escape" && busca) {
      /* ESC com texto limpa a busca; o do painel ignora quem já foi tratado */
      e.preventDefault(); sairDaBusca();
    }
  };
  const teclaGrade = (e: KeyboardEventReact<HTMLDivElement>) => {
    /* só vale em cima de uma peça: no vazio, as sugestões são botões comuns */
    if (!(e.target as HTMLElement).closest?.(".pn10-cel")) return;
    /* a seleção já segue o foco: o Espaço não faz nada (não é letra de busca) */
    if (e.key === " ") { e.preventDefault(); return; }
    const passos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7, PageDown: 49, PageUp: -49 };
    if (e.key in passos) { e.preventDefault(); andar(passos[e.key], true); return; }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const lista = achadosRef.current;
      if (lista.length) andar(e.key === "Home" ? -lista.length : lista.length, true);
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); copiarSel(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !window.getSelection()?.toString()) { e.preventDefault(); copiarSel(); return; }
    if (e.key === "/") { e.preventDefault(); pesquisaRef.current?.focus(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      /* começou a digitar em cima da grade: é busca */
      e.preventDefault();
      mudarBusca(busca + e.key);
      requestAnimationFrame(() => { const el = pesquisaRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
    }
  };

  /* Na capa, digitar em qualquer lugar é buscar — quem chega com um código
     na cabeça não precisa mirar o campo. O campo do topo fica de fora. */
  useEffect(() => {
    if (aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      const campo = !!alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable);
      if (campo || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (e.key === "/") { e.preventDefault(); heroRef.current?.focus(); return; }
      if (e.key.length === 1 && e.key !== " ") { e.preventDefault(); abrirBusca(e.key); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  /* Escolher uma cor na busca do topo estando JÁ nesta página não remonta a
     tela, então a semente ficava parada (e vazava para a próxima tela que lê
     a busca). O aviso chega na hora; espera-se um instante para a navegação
     acontecer: se o destino for outra página, esta desmonta antes e não pega
     a semente que era de lá. */
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const aoSemear = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const s = espiarBusca().trim();
        if (!sementeValida(s)) return;
        colherBusca();
        abrirBusca(s);
      }, 200);
    };
    window.addEventListener("hub:semente", aoSemear);
    return () => { window.removeEventListener("hub:semente", aoSemear); if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ————— menus ————— */
  /* Menu fechado pelo ESC ou pelo clique fora: o foco volta a quem o abriu. */
  const menuAtual = useRef(menu);
  menuAtual.current = menu;
  const fecharMenu = useCallback(() => {
    const qual = menuAtual.current;
    setMenu(null);
    requestAnimationFrame(() => (qual === "ordem" ? ordemRef.current : seletorRef.current)?.focus());
  }, []);
  useEscDoTopo(menu !== null, NIVEL.verTodos, fecharMenu);
  /* menu aberto: o foco entra na linha atual */
  const menuRecorteRef = useRef<HTMLDivElement | null>(null);
  const menuOrdemRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menu) return;
    const el = menu === "recorte" ? menuRecorteRef.current : menuOrdemRef.current;
    (el?.querySelector<HTMLButtonElement>("button[aria-selected=true]") ?? el?.querySelector<HTMLButtonElement>("button:not([disabled])"))?.focus();
  }, [menu]);
  const teclaMenu = (e: KeyboardEventReact<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const itens = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
    const i = itens.indexOf(document.activeElement as HTMLButtonElement);
    const j = e.key === "Home" ? 0 : e.key === "End" ? itens.length - 1 : Math.max(0, Math.min(itens.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
    itens[j]?.focus();
  };
  /* o foco saiu do menu pelo Tab: ele fecha, sem puxar o foco de volta */
  const saiuDoMenu = (e: FocusEventReact<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null) && e.relatedTarget) setMenu(null);
  };
  const escolherRecorte = (k: RecorteK) => {
    setRecorte(k); setTom(null); setBusca(""); setRecorteAntes(null); setSelCod(null); setOrdem(ordemPadrao(k)); setMenu(null);
    requestAnimationFrame(() => seletorRef.current?.focus());
  };

  /* ————— balão de ajuda ————— */
  const fecharAjuda = useCallback(() => setAjuda(null), []);
  const tAjuda = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tAjuda.current) clearTimeout(tAjuda.current); }, []);
  useEscDoTopo(ajuda !== null, NIVEL.verTodos, fecharAjuda);
  useEffect(() => {
    if (!ajuda?.fixo) return;
    const fora = (e: MouseEvent) => { if (!(e.target as HTMLElement | null)?.closest?.("[data-pn10-ajuda]")) setAjuda(null); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [ajuda?.fixo]);
  useEffect(() => { if (!aberto) setAjuda(null); }, [aberto]);
  const infoDe = (k: keyof typeof AJUDA, lado: "esq" | "dir") => (
    <InfoCor id={`pn10-ajuda-${k}`} ajuda={AJUDA[k]} lado={lado} aberto={ajuda?.k === k} fixo={ajuda?.k === k && ajuda.fixo}
      aoAbrir={(fixar) => {
        if (tAjuda.current) { clearTimeout(tAjuda.current); tAjuda.current = null; }
        setAjuda((a) => (a?.k === k && a.fixo && !fixar ? a : { k, fixo: fixar || (a?.k === k && a.fixo) }));
      }}
      aoFechar={(forcar) => {
        if (tAjuda.current) clearTimeout(tAjuda.current);
        const fechar = () => setAjuda((a) => (a?.k === k && (forcar || !a.fixo) ? null : a));
        if (forcar) fechar(); else tAjuda.current = setTimeout(fechar, 180);
      }} />
  );

  /* ————— leitor de tela: a contagem, 400 ms depois de mudar ————— */
  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(() => { const txt = estadoRef.current?.textContent || vazioRef.current?.textContent; if (txt) setAnuncio(txt); }, 400);
    return () => clearTimeout(t);
  }, [aberto, q, recorte, tom, ordem, achados.length]);

  /* ————— pontas da grade: estado só quando MUDA ————— */
  const medirPontas = useCallback(() => {
    const el = gradeRef.current;
    if (!el) return;
    const topo = el.scrollTop > 2, base = el.scrollTop < el.scrollHeight - el.clientHeight - 2;
    setPontas((p) => (p.topo === topo && p.base === base ? p : { topo, base }));
  }, []);
  useEffect(() => { medirPontas(); }, [achados, aberto, medirPontas]);

  /* ————— textos ————— */
  const rotuloRecorte = (k: RecorteK) =>
    k === "todas" ? "Todas as cores" : k === "processo" ? "Processo e especiais" : k === "usados" ? "Usados em pedidos" : FAIXAS.find((f) => f.k === k)?.label ?? k;
  /* as famílias do nome: as das referências (nome de referência) ou as da faixa */
  const famsDoNome = !nomeBusca ? [] : nomeBusca.tipo === "faixa" ? nomeBusca.familias
    : [...new Set(nomeBusca.refs.map((r) => porCodigo.get(r.toUpperCase())?.familia).filter((f): f is string => !!f))];
  const porReferencia = modo === "nome" && nomeBusca?.tipo === "ancora";
  /* o nome como a pessoa escreveu ("verde-água"), quando é o mesmo termo; senão
     o termo que a busca entendeu dentro do texto */
  const termoVisto = !nomeBusca ? "" : semAcento(q).replace(/[^a-z0-9]+/g, " ").trim() === nomeBusca.termo ? q.trim() : nomeBusca.termo;
  const seletor: { k: RecorteK | "varias"; rot: string } = modo === "codigo" || modo === "hexProximo"
    ? { k: "todas", rot: "Todas as cores" }
    : modo === "nome"
      ? famsDoNome.length === 1 ? { k: famsDoNome[0] as RecorteK, rot: rotuloRecorte(famsDoNome[0] as RecorteK) } : { k: "varias", rot: "Várias famílias" }
      : { k: recorte, rot: rotuloRecorte(recorte) };
  const ehFamilia = FAIXAS.some((f) => f.k === recorte);
  const tonsDoRecorte = ehFamilia && !q
    ? TONS.filter((t) => todas.some((c) => c.familia === recorte && c.L != null && t.ok(c.L)))
    : [];
  const n = achados.length;
  const nCores = (x: number, sing = "cor", plural = "cores") => `${fmt(x)} ${x === 1 ? sing : plural}`;

  const estado: ReactNode = (() => {
    const forte = (t: string) => <b style={{ fontWeight: 600, color: PRETO }}>{t}</b>;
    /* Lista vazia: a frase fica só na grade, onde a cor estaria. A contagem e
       a coluna da direita repetiam o mesmo "nenhuma", e "xyzabc" mostrava três
       frases ao mesmo tempo (simulação 5, 05/10/2026). O carregando continua. */
    if (n === 0 && !(recorte === "usados" && !q && !pedidosProntos)) return null;
    if (modo === "codigo") return <>{forte(nCores(n))} para “{q}”</>;
    if (modo === "hexProximo") return <>Nenhum Pantone tem o hex {q.toUpperCase().startsWith("#") ? q.toUpperCase() : `#${q.toUpperCase()}`} · {forte(`os ${n} mais próximos`)} na tela</>;
    if (modo === "nome" && nomeBusca) {
      const extra = procBusca ? `${procBusca.codigo} (${procBusca.nota?.includes("especial") ? "tinta especial" : "processo"}) + ` : "";
      if (nomeBusca.tipo === "ancora") {
        /* a ordem é a da semelhança: "as 21 mais parecidas" já diz isso */
        const parecidas = n - (procBusca ? 1 : 0);
        return !parecidas ? <>Nenhuma cor perto de “{termoVisto}”</>
          : parecidas === 1 ? <>{extra}{forte("1 cor")} parecida com “{termoVisto}”</>
            : <>{extra}{forte(`as ${fmt(parecidas)} mais parecidas`)} com “{termoVisto}”</>;
      }
      const frase = descrever({ familias: nomeBusca.familias, L: nomeBusca.L, croma: nomeBusca.croma, matiz: nomeBusca.matiz });
      return <>{forte(nCores(n))} · “{termoVisto}” → {extra}{frase}</>;
    }
    if (recorte === "processo") return <>{forte(nCores(n))} de processo e especiais</>;
    if (recorte === "usados" && !pedidosProntos) return <>Carregando os pedidos…</>;
    if (recorte === "usados") return <>{forte(`${fmt(n)} ${n === 1 ? "Pantone" : "Pantones"}`)} {n === 1 ? "aprovado" : "aprovados"} {nosPedidos} · {FRASE_ORDEM[ordem]}</>;
    if (ehFamilia && tom) {
      const t = TONS.find((x) => x.k === tom)!;
      const total = contagemFamilia[recorte] ?? 0;
      return <>{forte(`${fmt(n)} ${t.rot.toLowerCase()}`)} de {fmt(total)} {FAIXAS.find((f) => f.k === recorte)?.pl}</>;
    }
    return <>{forte(nCores(n))} · {FRASE_ORDEM[ordem]}</>;
  })();

  /* ————— a cor escolhida ————— */
  const usosSel = sel ? usados[sel.codigo] ?? null : null;
  const tomSel = sel ? tomDe(sel.L) : null;
  const familiaSel = sel ? (sel.origem === "processo" ? "Processo e especiais" : FAIXAS.find((f) => f.k === sel.familia)?.label ?? "") : "";
  const tamCodigo = (cod: string) => (cod.length <= 7 ? { fs: 96, lh: 97 } : cod.length <= 11 ? { fs: 72, lh: 80 } : { fs: 56, lh: 64 });
  const copiaDaSel = copia && sel && copia.codigo === sel.codigo ? copia : null;
  const estadoCampo = (alvo: NonNullable<Copia>["alvo"]) => (copiaDaSel?.alvo === alvo ? (copiaDaSel.ok ? "ok" : "falha") : null);

  /* ————— a janela da grade ————— */
  const janela = (() => {
    const linhas = Math.ceil(n / COLS);
    const primeira = Math.max(0, Math.floor(rolagem / LINHA) - FOLGA);
    const ultima = Math.min(linhas, Math.ceil((rolagem + ALTURA_GRADE) / LINHA) + FOLGA);
    const fatia = achados.slice(primeira * COLS, ultima * COLS);
    /* A escolhida fica montada mesmo fora da janela (em posição absoluta):
       rolando com a roda, a peça com foco saía do DOM, o foco caía no body e
       Enter, Ctrl+C e setas paravam de responder. Ela é a parada de Tab. */
    const iSel = sel ? achados.findIndex((c) => c.codigo === sel.codigo) : -1;
    /* cada peça com a posição dela na lista; a escolhida entra mesmo fora */
    const pecas = fatia.map((c, j) => ({ c, i: primeira * COLS + j }));
    if (iSel >= 0 && (iSel < primeira * COLS || iSel >= ultima * COLS)) {
      const p = { c: achados[iSel], i: iSel };
      if (iSel < primeira * COLS) pecas.unshift(p); else pecas.push(p);
    }
    return { pecas, focavel: sel?.codigo ?? fatia[0]?.codigo ?? null };
  })();

  /* ————— o pé (v4) —————
     A pílula do administrador vem 44 depois do fim do título, nunca antes da
     c6 (a regra do pé da Solicitação); o fim é medido com a fonte carregada. */
  const pilulaPeX = Math.max(480 - 2.21 / 2, Math.ceil(fimTituloPe + 44));

  return (
    <PalcoFixo>
      {/* ————— capa ————— */}
      {/* A capa sai do alcance do teclado enquanto o painel está aberto
          (inert), sem criar contexto de empilhamento. */}
      <div style={{ position: "absolute", inset: 0 }} inert={aberto}>
        {/* a página no cinza do rework, da barra ao pé (sem a faixa preta) */}
        <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />

        {/* ————— o bloco da busca (8 colunas, neutro) —————
            Anatomia do cartão 1.0: marca em 76/58, título em 76/111. */}
        <div style={{ position: "absolute", left: 80, top: CAPA_V4.topo, width: HERO_L, height: CAPA_V4.altura, boxSizing: "border-box", background: "#fff",
          borderRadius: CAPA_V4.raio, boxShadow: CAPA_V4.sombra, zIndex: 4 }}>
          <div style={{ position: "absolute", left: 76, top: 58, height: 22, display: "flex", alignItems: "center", gap: 10, ...MARCA, lineHeight: "22px" }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: PRETO }} />
            Pantone Solid Coated 2024
          </div>
          <div style={{ position: "absolute", left: 76, top: 111, width: 488, ...TITULO, color: PRETO }}>
            Qual cor<br />você procura?
          </div>
          {/* A instrução e o campo moram na BASE do bloco, com o pé do campo
              (569) no pé das setas das faixas — como a contagem que fecha o
              cartão de Ferramentais. Em cima fica só o título. (A colagem de
              aprovados que morava aqui saiu: o número "usados em pedidos" da
              faixa preta já leva a eles — Augusto, 25/09/2026.) */}
          <div style={{ position: "absolute", left: 76, top: 437 + DESCE, width: 488, font: `400 20px/28px ${INTER}`, color: TINTA2 }}>
            Pelo código, pelo hex ou pelo nome da cor:
            <div>
              {EXEMPLOS.map((ex, i) => (
                <span key={ex}>
                  {i > 0 && <span style={{ color: CINZA }}> · </span>}
                  <button onClick={(e) => abrirBusca(ex, e.currentTarget)} className="pn10-link" aria-label={`Pesquisar ${ex}`}
                    style={{ padding: 0, border: 0, background: "none", cursor: "pointer", font: `500 20px/28px ${INTER}`, color: PRETO }}>{ex}</button>
                </span>
              ))}
            </div>
          </div>
          {/* A busca de página: retângulo branco, sem borda e sem lupa, com o
              leve raio de todas as pesquisas (RAIO_DA_PESQUISA), a de
              Ferramentais na proporção da capa. */}
          <label style={{ position: "absolute", left: 76, top: 513 + DESCE, width: 480, height: 56, boxSizing: "border-box", display: "flex", alignItems: "center", background: FUNDO_PESQUISA, borderRadius: RAIO_DA_PESQUISA, cursor: "text" }}>
            <input ref={heroRef} value={heroTexto} autoFocus={!semente}
              onChange={(e) => {
                const v = e.target.value;
                if ((e.nativeEvent as InputEvent).isComposing) { setHeroTexto(v); return; }
                if (v.trim()) abrirBusca(v); else setHeroTexto(v);
              }}
              onCompositionEnd={(e) => { const v = e.currentTarget.value; if (v.trim()) abrirBusca(v); }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === "ArrowDown") && !heroTexto.trim()) { e.preventDefault(); abrirRecorte("todas", e.currentTarget); }
              }}
              placeholder="PESQUISA" aria-label="Pesquisar cor Pantone" spellCheck={false} autoComplete="off"
              style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "none", textAlign: heroTexto ? "left" : "center",
                padding: heroTexto ? "0 18px" : 0, font: `600 16px/1 ${INTER}`, letterSpacing: heroTexto ? 0 : ".08em", color: PRETO }} />
          </label>

        </div>

        {/* ————— as oito famílias: cartões de 160 com raio e sombra, a partir
            da c9; sete à vista, a oitava pela rolagem (TrilhaV4) ————— */}
        <TrilhaV4 quantos={FAIXAS.length} inicio={FAIXAS_X} largura={FAIXA} rotulo="Famílias de cor"
          aoTeclar={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            const botoes = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button.pd4-cartao"));
            const i = botoes.indexOf(document.activeElement as HTMLButtonElement);
            if (i < 0) return;
            e.preventDefault();
            const alvo = botoes[Math.max(0, Math.min(botoes.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)))];
            alvo?.focus();
            alvo?.scrollIntoView({ inline: "nearest", block: "nearest" });
          }}>
          {FAIXAS.map((f, i) => {
            const hex = hexFaixa(f.k);
            const total = contagemFamilia[f.k] ?? 0;
            return (
              <button key={f.k} className="pd4-cartao" onClick={(e) => abrirRecorte(f.k, e.currentTarget)}
                aria-label={`${f.label}, ${fmt(total)} cores`}
                style={{ position: "relative", flex: `0 0 ${FAIXA}px`, height: CAPA_V4.altura, boxSizing: "border-box", padding: 0, border: 0,
                  borderRadius: CAPA_V4.raio, background: hex, boxShadow: CAPA_V4.sombra, zIndex: i + 1, cursor: "pointer", textAlign: "left", font: "inherit",
                  ["--tinta" as string]: f.tinta, ["--faixa" as string]: hex } as CSSProperties}>
                <span aria-hidden style={{ position: "absolute", left: 58, top: 47, width: 44, height: 44, borderRadius: 999, background: PRETO, color: "#fff",
                  display: "grid", placeItems: "center", font: `700 14px/1 ${INTER}`, fontVariantNumeric: "tabular-nums",
                  boxShadow: f.tinta === FUNDO ? `0 0 0 1.5px ${FUNDO}` : "none" }}>{fmt(total)}</span>
                {/* nome girado, lendo de baixo para cima, ancorado embaixo */}
                <span aria-hidden style={{ position: "absolute", left: 52, top: 122, width: 56, height: 371 + DESCE, writingMode: "vertical-rl", transform: "rotate(180deg)",
                  ...TITULO, color: f.tinta, whiteSpace: "nowrap" }}>{f.label}</span>
                <span aria-hidden className="pn10-seta" style={{ position: "absolute", left: 58, top: 525 + DESCE, width: 44, height: 44, boxSizing: "border-box",
                  border: `1.5px solid ${f.tinta}`, borderRadius: 999, display: "grid", placeItems: "center" }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7" /><polyline points="8 7 17 7 17 16" />
                  </svg>
                </span>
              </button>
            );
          })}
        </TrilhaV4>

        {/* ————— o pé (v4): o título na c1, a ação do administrador em pílula
            e o resumo à direita, terminando na c23. A primeira linha (cinza)
            diz de onde vem a tabela; as outras duas, o que há no livro e o que
            a fábrica já usou, e cada número abre a lista dele. ————— */}
        <div ref={tituloPeRef} style={tituloDoPeV4("Pantones")}>Pantones</div>
        {podeAtualizar && (
          <div ref={adminRef} tabIndex={-1} style={{ position: "absolute", left: pilulaPeX, top: TOPO_PILULA_PE, height: PILULA_PE_ALT, display: "flex", alignItems: "center", outline: "none", zIndex: 3 }}>
            {recado ? (
              <>
                <span title={recado} style={{ font: `500 18px/1 ${INTER}`, color: TINTA2, maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{recado}</span>
                <button onClick={() => { setRecado(""); requestAnimationFrame(() => adminRef.current?.querySelector<HTMLButtonElement>("button")?.focus()); }} className="p10-flat" aria-label="Dispensar o recado"
                  style={{ marginLeft: 12, flex: "none", width: 28, height: 28, padding: 0, border: 0, background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                </button>
              </>
            ) : (
              <button onClick={() => setAtualizando(true)} className="np4-pilula" title="Escolher o arquivo do color book mais novo e atualizar a tabela"
                style={{ height: PILULA_PE_ALT, boxSizing: "border-box", padding: "2px 22px 0", border: `2.21px solid ${PRETO}`, borderRadius: 999, display: "flex", alignItems: "center",
                  font: `500 20.5px/1 ${INTER}`, letterSpacing: "-.014em", color: PRETO, cursor: "pointer", whiteSpace: "nowrap" }}>Atualizar tabela Pantone</button>
            )}
          </div>
        )}
        <ResumoDoPeV4 fim={!pedidosProntos ? "…" : rankUsados.length > 0 ? "s" : "a"} linhas={[
          <span key="fonte" style={{ color: CINZA }}>
            Fonte: {extras.livro || "Pantone Solid Coated 2024"}{extras.quando ? `, atualizada em ${new Date(extras.quando).toLocaleDateString("pt-BR")}` : ""}
            {extrasFalhou ? " · as cores novas do color book não carregaram" : ""}
          </span>,
          /* a linha dos totais da tabela saiu (Augusto, 02/10/2026: "essa linha é desnecessária") */
          !pedidosProntos ? "Carregando os pedidos…" : rankUsados.length > 0 ? (
            <button onClick={(ev) => abrirRecorte("usados", ev.currentTarget)} className="pn10-link"
              style={{ padding: 0, border: 0, background: "none", font: "inherit", color: "inherit", cursor: "pointer" }}>
              {fmt(rankUsados.length)} {rankUsados.length === 1 ? "usado" : "usados"} {veTodos ? "em pedidos com arte aprovada" : "nos seus pedidos aprovados"}
            </button>
          ) : `Nenhum Pantone usado ${nosPedidos} ainda`,
        ]} />
      </div>

      {/* ————— o painel: índice à esquerda, a cor à direita ————— */}
      {aberto && (
        <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: ALTURA, background: FUNDO, zIndex: NIVEL.painel, overflow: "hidden", color: PRETO, fontFamily: INTER }}>

          {/* seletor do recorte: a marca (ou a 1ª letra) na c1, base na linha 12 */}
          <button ref={seletorRef} onClick={() => setMenu((m) => (m === "recorte" ? null : "recorte"))} className="p10-flat"
            aria-haspopup="listbox" aria-expanded={menu === "recorte"}
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setMenu("recorte"); } }}
            style={{ position: "absolute", left: seletor.k !== "todas" && seletor.k !== "varias" ? 80 : 80 - folgaInter(600, 24, seletor.rot.charAt(0)),
              top: naLinha(12) - baseInter(24, 24), display: "flex", alignItems: "center", gap: 10, padding: 0, border: "none", background: "none",
              cursor: "pointer", fontFamily: INTER, fontSize: 24, lineHeight: "24px", fontWeight: 600, letterSpacing: "-.01em", color: PRETO, whiteSpace: "nowrap" }}>
            {seletor.k !== "todas" && seletor.k !== "varias" && <MarcaRecorte k={seletor.k} />}
            {seletor.rot}
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: .65, transform: menu === "recorte" ? "rotate(180deg)" : undefined }}><polyline points="6 9 12 15 18 9" /></svg>
          </button>

          {menu === "recorte" && (
            <>
              <div onClick={fecharMenu} style={{ position: "absolute", inset: 0, zIndex: NIVEL.verTodos - 1 }} />
              <div role="listbox" aria-label="Recorte de cores" style={{ ...CAIXA_POP, left: 80, top: naLinha(12) + 15, width: 340, zIndex: NIVEL.verTodos, boxShadow: SOMBRA_BAIXO }}
                onKeyDown={teclaMenu} onBlur={saiuDoMenu}
                ref={menuRecorteRef}>
                {([["todas", todas.length], ["processo", PROCESSO.length], ["usados", rankUsados.length]] as [RecorteK, number][]).map(([k, qtd]) => (
                  <LinhaMenu key={k} k={k} rot={rotuloRecorte(k)} qtd={qtd} on={!q && recorte === k} desligada={k === "usados" && qtd === 0} aoEscolher={escolherRecorte} />
                ))}
                <div aria-hidden style={{ height: 1, background: "rgba(37,36,37,.12)", margin: "5px 6px" }} />
                {FAIXAS.map((f) => (
                  <LinhaMenu key={f.k} k={f.k} rot={f.label} qtd={contagemFamilia[f.k] ?? 0} on={!q && recorte === f.k} desligada={false} aoEscolher={escolherRecorte} />
                ))}
              </div>
            </>
          )}

          {/* cortes de tom (texto, sublinhado quando ligado) ou, na busca por
              nome, o termo, que desfaz a busca no clique. Terminam onde
              termina o "Ordem", na borda direita das amostras, com a base na
              linha 12, a do seletor (Augusto, 30/09/2026: "deve alinhar com o
              m de Ordem"). */}
          <div style={{ position: "absolute",
            right: 1920 - FIM_DAS_AMOSTRAS - (modo === "nome" && nomeBusca
              ? folgaDireitaInter(700, 24, "”")
              : tonsDoRecorte.length ? folgaDireitaInter(tom === tonsDoRecorte[tonsDoRecorte.length - 1].k ? 700 : 400, 24, tonsDoRecorte[tonsDoRecorte.length - 1].rot.slice(-1)) : 0),
            top: naLinha(12) - baseInter(24, 24), width: 300, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: "8px 13px", fontSize: 24, lineHeight: "24px" }}>
            {modo === "nome" && nomeBusca ? (
              <button onClick={() => { sairDaBusca(); requestAnimationFrame(() => pesquisaRef.current?.focus()); }} className="p10-flat" title="Clique para limpar a busca"
                style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 24, lineHeight: "24px", fontWeight: 700, color: PRETO,
                  textDecoration: "underline", textUnderlineOffset: 6, whiteSpace: "nowrap", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>“{termoVisto}”</button>
            ) : tonsDoRecorte.map((t) => (
              <button key={t.k} onClick={() => { setTom(tom === t.k ? null : t.k); setSelCod(null); }} className="p10-flat" aria-pressed={tom === t.k}
                title={tom === t.k ? "Clique de novo para tirar o recorte" : undefined}
                style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 24, lineHeight: "24px",
                  fontWeight: tom === t.k ? 700 : 400, color: tom === t.k ? PRETO : TINTA3,
                  textDecoration: tom === t.k ? "underline" : "none", textUnderlineOffset: 6, whiteSpace: "nowrap" }}>{t.rot}</button>
            ))}
          </div>

          {/* o que está na grade, em palavras: a 1ª letra na c1, base na linha 16 */}
          <div ref={estadoRef} style={{ position: "absolute", left: 80 - folgaEstado, top: naLinha(16) - baseInter(18, 24), width: 560, height: 24, font: `400 18px/24px ${INTER}`, color: TINTA2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {estado}
          </div>

          {/* a grade: 7 colunas de 80 (a amostra na coluna), fileiras de 6
              linhas, amostra 72×52 com o cinza do fundo em volta: o entorno
              da amostra é neutro */}
          <div ref={gradeRef} className="p10-trilha" onScroll={(e) => { setRolagem(e.currentTarget.scrollTop); medirPontas(); }} onKeyDown={teclaGrade}
            style={{ position: "absolute", left: 80, top: TOPO_DA_GRADE, width: 560, height: ALTURA_GRADE, overflowY: "auto", overflowX: "hidden", scrollSnapType: "none" }}>
            {n === 0 ? (
              /* linhas de 2 da grade: a 1ª base na linha 20, as outras nas seguintes */
              <div style={{ paddingTop: naLinha(20) - TOPO_DA_GRADE - baseInter(20, 2 * LG), font: `400 20px/${2 * LG}px ${INTER}`, color: TINTA3 }}>
                {/* a única frase de lista vazia da página: o leitor de tela lê
                    esta (vazioRef) quando a contagem fica em branco */}
                {recorte === "usados" && !q ? (
                  /* carregando os pedidos: a contagem já diz, e "nenhum
                     aprovado" ainda não é verdade */
                  pedidosProntos && (
                    <>
                      <div ref={vazioRef}>Nenhum Pantone aprovado {nosPedidos} ainda.</div>
                      <div style={{ fontSize: 18, color: CINZA }}>Os Pantones entram aqui quando o cliente aprova a arte.</div>
                    </>
                  )
                ) : modo === "nome" && nomeBusca ? (
                  <>
                    <div ref={vazioRef}>{porReferencia ? `Nenhuma cor perto de “${termoVisto}”.` : `Nenhuma cor nessa faixa de “${termoVisto}”.`}</div>
                    <div style={{ fontSize: 18, color: CINZA }}>Procure pelo código ou tente outro nome.</div>
                  </>
                ) : (
                  <>
                    <div ref={vazioRef}>Nenhuma cor com “{q}”.</div>
                    {extrasFalhou && <div style={{ fontSize: 18, color: TINTA2 }}>As cores novas do color book não carregaram; a busca está só na tabela embutida.</div>}
                    <div style={{ fontSize: 18, color: CINZA }}>Tente o número sem o C, um hex (#D7271B) ou um nome de cor:</div>
                    <div style={{ maxWidth: 560 }}>
                      {NOMES_SUGERIDOS.map((nm, i) => (
                        <span key={nm}>
                          {i > 0 && <span style={{ color: CINZA }}> · </span>}
                          <button onClick={() => { mudarBusca(nm); requestAnimationFrame(() => pesquisaRef.current?.focus()); }} className="pn10-link"
                            style={{ padding: 0, border: 0, background: "none", cursor: "pointer", font: `500 20px/${2 * LG}px ${INTER}`, color: PRETO }}>{nm}</button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div role="listbox" id="pn10-grade" aria-label={`Cores: ${seletor.rot}`}
                style={{ position: "relative", height: Math.ceil(n / COLS) * LINHA }}>
                {/* Cada peça posicionada pela conta, todas irmãs no mesmo pai:
                    a escolhida é o MESMO elemento dentro ou fora da janela, e o
                    foco não cai quando a roda do mouse a tira da vista. */}
                {janela.pecas.map(({ c, i }) => (
                  <div key={c.codigo} style={{ position: "absolute", left: (i % COLS) * 80, top: Math.floor(i / COLS) * LINHA }}>
                    <Amostra c={c} on={sel?.codigo === c.codigo} focavel={janela.focavel === c.codigo}
                      usoN={usados[c.codigo]?.length ?? 0} dE={dist?.get(c.codigo) ?? null} pos={i + 1} total={n}
                      aoEscolher={escolher} aoCopiar={copiarDaGrade} />
                  </div>
                ))}
              </div>
            )}
          </div>
          {pontas.topo && <div aria-hidden style={{ position: "absolute", left: 80, top: TOPO_DA_GRADE, width: 560, height: 24, pointerEvents: "none", zIndex: 2, background: `linear-gradient(${FUNDO}, rgba(241,241,241,0))` }} />}
          {pontas.base && <div aria-hidden style={{ position: "absolute", left: 80, top: TOPO_DA_GRADE + ALTURA_GRADE - 24, width: 560, height: 24, pointerEvents: "none", zIndex: 2, background: `linear-gradient(rgba(241,241,241,0), ${FUNDO})` }} />}

          {/* busca e ordem, no pé da coluna (os lugares de PESQUISA e Filtros):
              pesquisa da c1 à c5, "Ordem" na c7 (a 7ª coluna de amostras),
              as duas com a base na linha 63 */}
          <label style={{ position: "absolute", left: 80, top: TOPO_DO_PE, width: 320, height: 37, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: RAIO_DA_PESQUISA, cursor: "text" }}>
            <input ref={pesquisaRef} value={busca} onChange={(e) => mudarBusca(e.target.value)} onKeyDown={teclaPesquisa}
              placeholder="PESQUISA" aria-label="Pesquisar cor Pantone" role="combobox" aria-controls="pn10-grade" aria-expanded="true"
              aria-activedescendant={sel ? idCel(sel.codigo) : undefined} spellCheck={false} autoComplete="off"
              style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "none", textAlign: "center",
                font: `600 14px/1 ${INTER}`, letterSpacing: ".08em", color: PRETO }} />
          </label>
          {modo !== "codigo" && modo !== "hexProximo" && !porReferencia && recorte !== "processo" && n > 1 && (
            <button ref={ordemRef} onClick={() => setMenu((m) => (m === "ordem" ? null : "ordem"))} className="p10-flat" aria-haspopup="listbox" aria-expanded={menu === "ordem"}
              onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setMenu("ordem"); } }}
              /* termina na borda direita das amostras, como os tons lá em cima;
                 no cinza dos tons, e em negrito preto quando a ordem não é a
                 de sempre (como o tom ligado) */
              style={{ position: "absolute", right: 1920 - FIM_DAS_AMOSTRAS - folgaDireitaInter(ordem !== ordemPadrao(recorte) ? 700 : 400, 24, "m"), top: naLinha(63) - baseInter(24, 24),
                padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 24, lineHeight: "24px",
                fontWeight: ordem !== ordemPadrao(recorte) ? 700 : 400, color: ordem !== ordemPadrao(recorte) ? PRETO : TINTA3, whiteSpace: "nowrap" }}>
              Ordem
            </button>
          )}
          {menu === "ordem" && (
            <>
              <div onClick={fecharMenu} style={{ position: "absolute", inset: 0, zIndex: NIVEL.verTodos - 1 }} />
              {/* abre para cima, da c5 até a borda direita das amostras */}
              <div role="listbox" aria-label="Ordem das cores" ref={menuOrdemRef} onKeyDown={teclaMenu} onBlur={saiuDoMenu}
                style={{ ...CAIXA_POP, left: 400, bottom: ALTURA - (TOPO_DO_PE - 16), width: 232, boxSizing: "border-box", zIndex: NIVEL.verTodos, boxShadow: SOMBRA_CIMA }}>
                {((recorte === "usados" && !q ? ["usados", "claras", "escuras", "codigo"] : ["claras", "escuras", "codigo"]) as Ordem[]).map((o) => (
                  <button key={o} role="option" aria-selected={ordem === o} onClick={() => { setOrdem(o); setMenu(null); requestAnimationFrame(() => ordemRef.current?.focus()); }}
                    className={ordem === o ? undefined : "p10-linha"}
                    style={{ textAlign: "left", height: 38, padding: "0 14px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: INTER, fontSize: 16, fontWeight: 500,
                      background: ordem === o ? PRETO : "transparent", color: ordem === o ? "#fff" : PRETO }}>{ROTULO_ORDEM[o]}</button>
                ))}
              </div>
            </>
          )}

          {/* ————— a coluna branca: a cor escolhida ————— */}
          <div style={{ position: "absolute", left: COL_ESQ, top: 1, width: 1920 - COL_ESQ, height: ALTURA - 1, boxSizing: "border-box", background: "#fff", borderLeft: `1px solid ${PRETO}` }} />

          {/* O Copiar mora logo abaixo do código grande, na coluna dos dados —
              junto do que ele copia. No alto (o lugar do Comparar de
              Ferramentais) ficava a 470px dos dados, sobre um branco vazio
              (Augusto, 25/09/2026). */}
          {sel && (
            <button onClick={copiarSel} className="p10-flat"
              style={{ position: "absolute", left: 1280, top: naLinha(25) - 23, height: 46, zIndex: 3, display: "flex", alignItems: "center", gap: 10, padding: "0 22px 0 18px",
                border: `1.5px solid ${PRETO}`, borderRadius: 999, background: PRETO, color: "#fff", fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {copiaDaSel?.alvo === "nome" && copiaDaSel.ok ? (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12.5 10 17.5 19 7" /></svg>
              ) : (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
                </svg>
              )}
              {copiaDaSel?.alvo === "nome" ? (copiaDaSel.ok ? "Código copiado" : "Não deu para copiar: aperte Ctrl+C") : `Copiar ${sel.nome}`}
            </button>
          )}
          <button onClick={fecharPainel} className="p10-flat" aria-label="Fechar cores"
            style={{ position: "absolute", right: 80, top: naLinha(12) - 23, zIndex: 3, width: 46, height: 46, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center",
              background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>

          {sel ? (
            <>
              {/* a cor, alta como uma faixa da capa — sem texto por cima e sem
                  transição: a amostra que se julga fica limpa */}
              {/* da linha 15 à 59 (a borda de baixo da lista de pedidos) */}
              <div aria-hidden style={{ position: "absolute", left: COL_ESQ + 80, top: naLinha(15), width: 400, height: 44 * LG, background: sel.hex, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.10)" }} />

              {/* base na linha 16, a mesma da contagem à esquerda */}
              <div style={{ position: "absolute", left: 1280 - folgaInter(600, 18, (sel.origem === "processo" ? "P" : familiaSel.charAt(0)) || "P"), top: naLinha(16) - baseInter(18, 24), width: 560, ...MARCA, lineHeight: "24px", overflow: "hidden", textOverflow: "ellipsis" }}>
                {sel.origem === "processo" ? `Processo e especiais · ${sel.nota ?? ""}` : `${familiaSel} · ${sel.origem === "extra" ? "color book instalado" : "Pantone Solid Coated"}`}
              </div>
              <span className="h10-so-leitor" ref={(el) => { textoDe.current.nome = el; }}>{sel.nome}</span>
              {/* o código grande com a base na linha 22, a do código da 1ª fileira de amostras */}
              <button ref={codigoRef} onClick={() => void copiar(sel.nome, "nome")} title={`Clique para copiar ${sel.nome}`}
                style={{ position: "absolute", left: 1280 - folgaFraunces(600, tamCodigo(sel.codigo).fs, sel.codigo.charAt(0)), top: naLinha(22) - baseFraunces(tamCodigo(sel.codigo).fs, tamCodigo(sel.codigo).lh),
                  maxWidth: 566, padding: 0, border: 0, background: "none", cursor: "copy", userSelect: "text",
                  ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: tamCodigo(sel.codigo).fs, lineHeight: `${tamCodigo(sel.codigo).lh}px`,
                  letterSpacing: "-.03em", color: PRETO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{sel.codigo}</button>

              {/* as fichas: rótulos nas linhas 30 e 36, valores 2 linhas abaixo;
                  a 2ª coluna na c20 (era 1560, entre colunas) */}
              <div style={{ position: "absolute", left: 1280, top: naLinha(30) - baseInter(24, 24), width: 560, display: "grid", gridTemplateColumns: "320px 240px", gridAutoRows: `${6 * LG}px` }}>
                {sel.origem === "processo" ? (
                  <CampoCopiavel rotulo="Tipo:" valor={sel.nota ?? "—"} estado={null} />
                ) : (
                  <CampoCopiavel rotulo="Lab:" valor={sel.lab} estado={estadoCampo("lab")} aoCopiar={() => void copiar(sel.lab, "lab", "Lab")} info={infoDe("lab", "esq")} refValor={(el) => { textoDe.current.lab = el; }} />
                )}
                <CampoCopiavel rotulo="Hex:" valor={sel.hex} estado={estadoCampo("hex")} aoCopiar={() => void copiar(sel.hex, "hex", sel.hex)} info={infoDe("hex", "dir")} refValor={(el) => { textoDe.current.hex = el; }} />
                <CampoCopiavel rotulo="CMYK:" valor={sel.cmyk} estado={estadoCampo("cmyk")} info={infoDe("cmyk", "esq")} refValor={(el) => { textoDe.current.cmyk = el; }}
                  aoCopiar={sel.cmyk !== "—" ? () => void copiar(sel.cmyk, "cmyk", "CMYK") : undefined} />
                <CampoCopiavel rotulo="Família:" valor={familiaSel || "—"} estado={null} info={sel.origem === "processo" ? undefined : infoDe("familia", "dir")} />
              </div>

              {/* Os pedidos em que a cor foi aprovada: um bloco à parte, com
                  respiro de 5 linhas depois das fichas e o título colado na
                  lista. Espremido entre o CMYK e os clientes, ele não era de
                  nenhum dos dois (Augusto, 30/09/2026). Título na linha 43. */}
              <div style={{ position: "absolute", left: 1280 - folgaInter(400, 24, sel.origem === "processo" || !pedidosProntos ? "C" : "A"), top: naLinha(43) - baseInter(24, 24), width: 560 }}>
                {sel.origem === "processo" ? (
                  <div style={{ font: `400 20px/24px ${INTER}`, marginTop: baseInter(24, 24) - baseInter(20, 24), color: TINTA3 }}>Cores de processo não são contadas nos pedidos.</div>
                ) : !pedidosProntos ? (
                  <div style={{ font: `400 24px/24px ${INTER}`, color: TINTA3 }}>Carregando os pedidos…</div>
                ) : usosSel ? (
                  <div style={{ font: `400 24px/24px ${INTER}`, color: PRETO }}>
                    Aprovada em {usosSel.length} {usosSel.length === 1 ? (veTodos ? "pedido" : "dos seus pedidos") : (veTodos ? "pedidos" : "dos seus pedidos")}
                  </div>
                ) : (
                  <div style={{ font: `400 24px/24px ${INTER}`, color: TINTA3 }}>Ainda não aprovada {nosPedidos}</div>
                )}
              </div>
              {/* A lista: fileiras de 3 linhas, a base de cada uma numa linha
                  (46, 49, 52…), 5 à vista até a linha 59. A chave pela cor
                  zera a rolagem: trocando de cor, a lista abria rolada pela
                  cor anterior e cortava o 1º cliente. */}
              {usosSel && sel.origem !== "processo" && (
                <div key={sel.codigo} className="p10-trilha" style={{ position: "absolute", left: 1280, top: naLinha(44), width: 560, maxHeight: 15 * LG, overflowY: "auto", scrollSnapType: "none" }}>
                  {usosSel.map((u) => {
                    const pa = pastas[chaveNome(u.cliente)] ?? null;
                    const num = /^\d+$/.test(u.numero) ? numeroPedido(Number(u.numero)) : `#${u.numero}`;
                    return (
                      <div key={`${u.numero}-${u.cliente}`} className="p10-linha"
                        /* número, cliente e pasta na mesma base, 2 linhas da grade
                           abaixo do topo da fileira; o 23 é a ascendente do
                           Fraunces 21 medida no Chrome (a conta dava 21) */
                        style={{ display: "grid", gridTemplateColumns: "64px minmax(0,1fr) auto", gap: "0 16px", alignItems: "baseline", boxSizing: "border-box", height: 3 * LG, paddingTop: 2 * LG - 23, borderBottom: "1px solid rgba(37,36,37,.12)" }}>
                        {u.id && dados.aoAbrirPedido ? (
                          <button onClick={() => dados.aoAbrirPedido?.(u.id)} className="p10-flat" title={`Abrir o pedido ${num}`}
                            style={{ padding: 0, border: 0, background: "none", cursor: "pointer", textAlign: "left", font: `500 19px ${INTER}`, color: PRETO }}>{num}</button>
                        ) : <span style={{ font: `500 19px ${INTER}` }}>{num}</span>}
                        <span title={u.cliente} style={{ ...FR, fontWeight: 400, fontSize: 21, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginLeft: -folgaFraunces(400, 21, u.cliente.charAt(0)) }}>{u.cliente}</span>
                        {pa && podeArquivos ? (
                          <button onClick={() => { semearBusca(u.cliente); aoNavegar("Arquivos"); }} className="pn10-link p10-flat" title={`Abrir ${u.cliente} no Arquivos`}
                            style={{ padding: 0, border: 0, background: "none", cursor: "pointer", font: `400 18px ${INTER}`, color: PRETO, whiteSpace: "nowrap" }}>
                            Pasta {pa.pasta || "—"}{pa.gaveta ? ` · ${pa.gaveta}` : ""}
                          </button>
                        ) : pa ? (
                          <span style={{ font: `400 18px ${INTER}`, color: TINTA3, whiteSpace: "nowrap" }}>Pasta {pa.pasta || "—"}{pa.gaveta ? ` · ${pa.gaveta}` : ""}</span>
                        ) : <span />}
                      </div>
                    );
                  })}
                  {pastasFalhou && <div style={{ paddingTop: 10, font: `400 16px/1.4 ${INTER}`, color: CINZA }}>As pastas do Arquivos não carregaram agora.</div>}
                </div>
              )}

              {/* legenda no pé, como a da ficha da faca. O fio que a separava
                  saiu (Augusto, 30/09/2026: desnecessário). "Tom" embaixo da
                  amostra (c10) e a frase na c16, com os outros textos da
                  coluna; a última linha da frase com a base na 63, a do
                  "Ordem" e do "Tom". */}
              {tomSel && (
                <div style={{ position: "absolute", left: COL_ESQ + 80 - folgaInter(400, 14, "T"), top: naLinha(63) - baseInter(14, 18), font: `400 14px/18px ${INTER}`, color: "#3c3a3c", whiteSpace: "nowrap" }}>
                  <span style={{ color: CINZA }}>Tom: </span><b style={{ fontWeight: 600, color: PRETO }}>{tomSel.sing}</b>
                </div>
              )}
              <div style={{ position: "absolute", left: 1280 - folgaInter(400, 14, sel.origem === "processo" ? "T" : "L"), bottom: ALTURA - (naLinha(63) + LG - baseInter(14, LG)),
                width: 560 + folgaInter(400, 14, "L") + folgaDireitaInter(400, 14, "."), font: `400 14px/${LG}px ${INTER}`, color: TINTA3 }}>
                {sel.origem === "processo"
                  ? "Tinta de processo ou especial: o hex é só aproximação para a tela."
                  : "Lab é a cor medida no livro da Pantone, o alvo da impressão. Hex e CMYK são contas aproximadas. Confira sempre no leque físico."}
                {modo === "hexProximo" && dist?.get(sel.codigo) != null ? ` ΔE ${dist.get(sel.codigo)!.toFixed(1).replace(".", ",")} da cor digitada.` : ""}
                {porReferencia && nomeBusca && dist?.get(sel.codigo) != null
                  ? dist.get(sel.codigo)! < 0.05
                    ? ` É uma das referências de “${termoVisto}”.`
                    : ` ΔE ${dist.get(sel.codigo)!.toFixed(1).replace(".", ",")} do ${refDe?.get(sel.codigo) ?? ""}, referência de “${termoVisto}”.`
                  : ""}
              </div>
            </>
          ) : null /* sem cor nenhuma: a frase de lista vazia fica só na grade (simulação 5, 05/10/2026) */}
        </div>
      )}

      {atualizando && <CaixaAtualizarTabela fechar={() => { setAtualizando(false); requestAnimationFrame(() => adminRef.current?.querySelector<HTMLButtonElement>("button")?.focus()); }} aoAtualizar={aoAtualizarTabela} />}

      <div className="h10-so-leitor" aria-live="polite">{anuncio}</div>

      {/* na capa a barra fica transparente: a sombra do cartão no hover passa
          por baixo dela sem corte (como em Pedidos) */}
      <BarraTopoHub10 profile={profile} paginaAtiva="Pantone" aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis}
        fundo={aberto ? undefined : "transparent"} />
    </PalcoFixo>
  );
}

/** Uma linha do menu do recorte: marca, rótulo e a contagem ao vivo. */
function LinhaMenu({ k, rot, qtd, on, desligada, aoEscolher }: {
  k: RecorteK; rot: string; qtd: number; on: boolean; desligada: boolean; aoEscolher: (k: RecorteK) => void;
}) {
  return (
    <button role="option" aria-selected={on} disabled={desligada} onClick={() => aoEscolher(k)} className={on || desligada ? undefined : "p10-linha"}
      style={{ display: "flex", alignItems: "center", gap: 10, height: 38, padding: "0 14px", border: "none", borderRadius: 8, textAlign: "left",
        cursor: desligada ? "default" : "pointer", fontFamily: INTER, fontSize: 16, fontWeight: 500,
        background: on ? PRETO : "transparent", color: desligada ? "#b3b1b3" : on ? "#fff" : PRETO }}>
      <MarcaRecorte k={k} />
      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rot}</span>
      <span style={{ flex: "none", fontSize: 14, fontWeight: 500, color: on ? "rgba(255,255,255,.7)" : CINZA }}>{fmt(qtd)}</span>
    </button>
  );
}

/* ————— atualizar a tabela (só administrador) —————
   A tabela Pantone muda quando a Pantone lança uma leva nova. Antes, só dava
   para ler o livro instalado no computador do hub; agora o administrador
   escolhe o arquivo novo (.acb) aqui, vê o que muda e confirma. Vale na hora,
   sem publicar, e o arquivo fica guardado na pasta do hub (data/pantone). */
type PreviaLivro = {
  origem: "arquivo" | "instalado"; titulo: string; noLivro: number; noHub: number;
  novas: { c: string; h: string }[]; alteradas: { c: string; antes: string; depois: string }[];
};

function CaixaAtualizarTabela({ fechar, aoAtualizar }: { fechar: () => void; aoAtualizar: (frase: string) => void }) {
  const [fase, setFase] = useState<"escolher" | "lendo" | "previa" | "aplicando">("escolher");
  const [erro, setErro] = useState("");
  const [arquivo, setArquivo] = useState<{ nome: string; base64: string } | null>(null);
  const [previa, setPrevia] = useState<PreviaLivro | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef<HTMLInputElement | null>(null);
  const fecharSeLivre = useCallback(() => { if (fase !== "aplicando") fechar(); }, [fase, fechar]);
  useEscDoTopo(true, NIVEL.caixa, fecharSeLivre);

  const lerArquivo = async (f: File | undefined) => {
    if (!f) return;
    if (!/\.acb$/i.test(f.name)) { setErro("Escolha o arquivo do color book, que termina em .acb."); return; }
    setErro(""); setFase("lendo");
    try {
      const base64 = await new Promise<string>((ok, falha) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = () => falha(r.error ?? new Error("Não deu para abrir o arquivo."));
        r.readAsDataURL(f);
      });
      const m = await import("@/lib/api/pantone.functions");
      const p = await m.previaLivroPantone({ data: { nome: f.name, base64 } });
      if (!p.ok) { setErro(p.motivo); setFase("escolher"); return; }
      setArquivo({ nome: f.name, base64 });
      setPrevia({ origem: "arquivo", titulo: p.titulo, noLivro: p.noLivro, noHub: p.noHub, novas: p.novas, alteradas: p.alteradas });
      setFase("previa");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para ler o arquivo.");
      setFase("escolher");
    }
  };
  const lerInstalado = async () => {
    setErro(""); setFase("lendo");
    try {
      const m = await import("@/lib/api/pantone.functions");
      const o = await m.conferirPantone({ data: { aplicar: false } });
      if (!o.ok) { setErro(o.motivo); setFase("escolher"); return; }
      setPrevia({ origem: "instalado", titulo: o.titulo, noLivro: o.noLivro, noHub: o.noHub, novas: o.novas.map((c) => ({ c, h: "" })), alteradas: [] });
      setFase("previa");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para ler o livro instalado.");
      setFase("escolher");
    }
  };
  const aplicar = async () => {
    if (!previa) return;
    setFase("aplicando"); setErro("");
    try {
      const m = await import("@/lib/api/pantone.functions");
      let novas = 0, alteradas = 0, titulo = previa.titulo;
      if (previa.origem === "arquivo" && arquivo) {
        const r = await m.aplicarLivroPantone({ data: arquivo });
        novas = r.novas; alteradas = r.alteradas; titulo = r.titulo;
      } else {
        const r = await m.conferirPantone({ data: { aplicar: true } });
        if (!r.ok) throw new Error(r.motivo);
        novas = r.aplicadas;
      }
      const partes = [novas ? `${fmt(novas)} ${novas === 1 ? "cor nova" : "cores novas"}` : "", alteradas ? `${fmt(alteradas)} com valores novos` : ""].filter(Boolean);
      aoAtualizar(partes.length ? `Tabela atualizada com ${titulo}: ${partes.join(" e ")}.` : `A tabela já estava em dia com ${titulo}.`);
      fechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu para atualizar a tabela.");
      setFase("previa");
    }
  };

  const nadaMuda = !!previa && !previa.novas.length && !previa.alteradas.length;
  const chip = (conteudo: ReactNode, chave: string) => (
    <span key={chave} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px 0 6px", borderRadius: 8, background: "#f1f1f1", font: `600 14px/1 ${INTER}`, color: PRETO, whiteSpace: "nowrap" }}>{conteudo}</span>
  );
  const amostra = (h: string) => h
    ? <span aria-hidden style={{ width: 18, height: 18, borderRadius: 4, background: h, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.14)" }} />
    : null;

  return (
    <div onClick={fecharSeLivre}
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(37,36,37,.78)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Atualizar a tabela Pantone"
        style={{ boxSizing: "border-box", width: 760, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, overflow: "hidden", boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>
        <div style={{ position: "relative", padding: "26px 36px 20px", background: AMARELO, borderBottom: `1px solid ${PRETO}` }}>
          <div style={{ font: `600 16px/1.2 ${INTER}`, color: TINTA2 }}>Tabela Pantone</div>
          <div style={{ ...FR, fontSize: 40, lineHeight: 1, letterSpacing: "-.03em", marginTop: 8 }}>Atualizar a tabela</div>
          <button onClick={fecharSeLivre} aria-label="Fechar" style={{ ...FECHAR_X, position: "absolute", right: 28, top: 26 }}>✕</button>
        </div>

        <div style={{ padding: "24px 36px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          {erro && <div role="alert" style={{ font: `500 17px/1.45 ${INTER}`, color: PALETA.perigo }}>{erro}</div>}

          {(fase === "escolher" || fase === "lendo") && (
            <>
              <div style={{ font: `400 18px/1.5 ${INTER}`, color: "#3c3a3c" }}>
                Escolha o color book Pantone Solid Coated mais novo (arquivo .acb). Ele vem com o Illustrator, na pasta Predefinições › Amostras › Livros coloridos.
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastando(false); void lerArquivo(e.dataTransfer.files?.[0]); }}
                style={{ height: 160, boxSizing: "border-box", border: `1.5px dashed ${PRETO}`, borderRadius: 14, background: arrastando ? "#fff9cc" : "#f8f8f8",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                {fase === "lendo" ? (
                  <span style={{ font: `500 18px ${INTER}`, color: TINTA2 }}>Lendo o livro…</span>
                ) : (
                  <>
                    <span style={{ font: `500 18px ${INTER}`, color: TINTA2 }}>Arraste o arquivo .acb para cá</span>
                    <button onClick={() => entrada.current?.click()} style={BOTAO_ESCURO}>Escolher arquivo</button>
                  </>
                )}
                <input ref={entrada} type="file" accept=".acb" style={{ display: "none" }}
                  onChange={(e) => { void lerArquivo(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              {fase === "escolher" && (
                <button onClick={() => void lerInstalado()} className="pn10-link"
                  style={{ alignSelf: "flex-start", padding: 0, border: 0, background: "none", cursor: "pointer", font: `500 17px ${INTER}`, color: PRETO }}>
                  Ou ler o livro instalado no computador do hub
                </button>
              )}
            </>
          )}

          {(fase === "previa" || fase === "aplicando") && previa && (
            <>
              <div>
                <div style={{ ...FR, fontSize: 28, lineHeight: 1.1, letterSpacing: "-.02em" }}>{previa.titulo}</div>
                <div style={{ marginTop: 6, font: `400 17px/1.4 ${INTER}`, color: TINTA2 }}>
                  {fmt(previa.noLivro)} cores no livro · a tabela do hub tem {fmt(previa.noHub)}
                </div>
              </div>
              {nadaMuda ? (
                <div style={{ font: `500 18px/1.5 ${INTER}` }}>A tabela já está em dia com esse livro. Nada muda.</div>
              ) : (
                <>
                  {previa.novas.length > 0 && (
                    <div>
                      <div style={{ font: `600 18px ${INTER}`, marginBottom: 10 }}>{fmt(previa.novas.length)} {previa.novas.length === 1 ? "cor nova" : "cores novas"}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 150, overflow: "hidden" }}>
                        {previa.novas.slice(0, 30).map((c) => chip(<>{amostra(c.h)}{c.c}</>, c.c))}
                        {previa.novas.length > 30 && chip(<>e mais {fmt(previa.novas.length - 30)}</>, "mais")}
                      </div>
                    </div>
                  )}
                  {previa.alteradas.length > 0 && (
                    <div>
                      <div style={{ font: `600 18px ${INTER}`, marginBottom: 10 }}>{fmt(previa.alteradas.length)} {previa.alteradas.length === 1 ? "cor com valores novos" : "cores com valores novos"}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 110, overflow: "hidden" }}>
                        {previa.alteradas.slice(0, 16).map((a) => chip(<>{amostra(a.antes)}{amostra(a.depois)}{a.c}</>, a.c))}
                        {previa.alteradas.length > 16 && chip(<>e mais {fmt(previa.alteradas.length - 16)}</>, "mais-alt")}
                      </div>
                      <div style={{ marginTop: 8, font: `400 15px/1.4 ${INTER}`, color: TINTA2 }}>Em cada uma, a primeira amostra é como está hoje e a segunda, como fica.</div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div style={{ padding: "16px 24px", background: PRETO, display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.4, color: "#8f8d8f" }}>
            Vale na hora, sem publicar. O arquivo fica guardado na pasta do hub.
          </span>
          {fase === "previa" && !nadaMuda ? (
            <>
              <button onClick={() => { setPrevia(null); setArquivo(null); setFase("escolher"); }} style={{ ...BOTAO_CLARO, flex: "none", background: "none", color: "#f1f1f1", borderColor: "#555355" }}>Escolher outro</button>
              <button onClick={() => void aplicar()} style={{ ...BOTAO_CLARO, flex: "none", border: "none", background: AMARELO_MAIS, color: PRETO, fontWeight: 800 }}>Atualizar tabela</button>
            </>
          ) : fase === "aplicando" ? (
            <span style={{ flex: "none", fontSize: 16, color: "#f1f1f1" }}>Atualizando…</span>
          ) : (
            <button onClick={fecharSeLivre} style={{ ...BOTAO_CLARO, flex: "none", background: "none", color: "#f1f1f1", borderColor: "#555355" }}>{nadaMuda ? "Fechar" : "Cancelar"}</button>
          )}
        </div>
      </div>
    </div>
  );
}
