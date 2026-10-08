// Novo pedido — Hub 1.0. Fonte: design_handoff_hub_1.0/Novo pedido 1.0.dc.html
//
// Substitui a NovaArteModalV1a: deixa de ser modal e vira TELA. A diferença
// não é só de moldura — a modal abria por cima de onde a pessoa estava e o
// formulário cabia numa caixa; aqui as quatro etapas são cartões grandes e
// cada uma abre com espaço para o catálogo de facas, o desenho da faca e as
// cores lado a lado.
//
// Campos: os do projeto 1.0, que é mais enxuto que a modal. Saíram pasta da
// rede, altura, forma, descrição das cores, link de referência e observação
// da matéria. Decisão do Augusto em 22/09/2026 — "seguir como o protótipo".
//
// Medidas: a FACA define a medida da etiqueta. Em vez de digitar largura e
// altura, escolhe-se a faca no catálogo e a medida dela vira a medida do
// pedido; "Largura" e "Carreiras" na etapa 2 são da BOBINA, não da etiqueta.
//
// Ainda sem coluna própria no banco: Laminação fosca e Laminação brilho. Elas
// entram no briefing para o designer ver — é o que importa hoje. Coluna certa
// (como picote/verniz/cold stamp têm) fica para quando o resto do hub souber
// filtrar por elas.
//
// Rework v4 (Augusto, 01/10/2026, Desktop/hubv3/v4/Solicitação*.svg): a tela
// virou "Solicitação" no molde novo. Sem faixa preta: a capa tem os quatro
// cartões amarelos soltos (raio 20 e sombra) e cada etapa abre em dois
// painéis brancos; embaixo, o número da etapa em cinza, o título grande e as
// ações em pílulas. As funcionalidades continuam ("as funcionalidades atuais
// continuam"); o pé da capa ganhou "Salvar" (guarda o que já foi preenchido,
// no servidor) e "Histórico" (as solicitações anteriores da vendedora, com a
// opção de copiar uma delas).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, DragEvent as ArrastoReact, KeyboardEvent as TeclaReact, Ref } from "react";

import { MEDIDAS, PDF_DE } from "../v1a/dados/facas-cilindro";
import { PANTONE_SC } from "../v1a/dados/pantone";
import { prefixoPantone } from "../v1a/dados/pantone-busca";
import { AvisoV1a } from "../v1a/HubV1a";
import { criarBusca } from "@/lib/busca";
import { coresEfetivas, separarCores } from "@/lib/cores";
import { sugestoesDeCor, trocarPalavra, type SugestaoDeCor } from "@/lib/sugestao-de-cor";
import type { CadastrosV1a } from "../v1a/dados/cadastros";
import type { NovaSolicitacaoDados } from "../v1a/modais/NovaArteModalV1a";
import {
  AMARELO, BarraTopoHub10, FR, FUNDO, FUNDO_PAGINA, INTER, LINHA_DA_GRADE_HUB, NIVEL, PRETO, PalcoFixo, numeroPedido, useEscDoTopo,
} from "./ChromeHub10";
import { ACERTO_FR, ACERTO_IN, baseFraunces, baseInter, folga, folgaDireitaInter, folgaFR, folgaFraunces, folgaIN, folgaInter } from "./grade-hub10";
import { chaveFaca, facasPerto, formaDoSistema, medidaBonita, medidaEmLados, useFacasVivas } from "./facas-vivas";
import { pdfPrimeiraPagina } from "@/lib/pdf-preview";
import { FerramentaisHub10 } from "./FerramentaisHub10";
import { erroLegivel } from "@/lib/erro-legivel";
import type { SessionUser } from "@/lib/session";
import { pantonesPeloNome } from "./PantoneHub10";
import { PALETA } from "@/lib/paleta-hub";
import { listZDasFacas } from "@/lib/api/facas.functions";
/* a chave das pastas "Facas por Z" (sem os zeros: FAC0004.03 é FAC4.03),
   não a de facas-vivas */
import { chaveFaca as chaveDoZ } from "@/lib/chave-faca";
import { listPortaCliches } from "@/lib/api/porta-cliches.functions";
import { avisoDaFaca, type PortaCliche } from "@/lib/porta-cliches";

/** O que a rota recebe: os campos de sempre, a urgência e a faca nova. */
export type DadosNovoPedido = NovaSolicitacaoDados & { urgente?: boolean; facaNova?: boolean };

/** Um pedido da lista do hub, no que o Histórico e os Pantones usam. */
type PedidoDaLista = {
  id?: string; numero?: number; cliente?: string | null; vendedor_id?: string | null; created_at?: string | null;
  largura?: string | null; altura?: string | null; materia?: string | null; cores_desc?: string | null; cores_arte?: string | null; faca_cod?: string | null;
};

/* Rascunho do formulário nesta aba do navegador: sair para outra tela (o
   catálogo, o menu) apagava tudo o que tinha sido preenchido (simulação de
   28/09/2026). Arquivo não cabe aqui; o aviso pede para escolher de novo.
   O "Salvar" do pé guarda no servidor, para valer depois de fechar a aba. */
const CHAVE_RASCUNHO = "r2-novo-pedido-10";

/* Formatos da faca nova: sem faca do catálogo, o formato não tem de onde
   sair e é escolhido aqui. Os mesmos nomes da modal antiga. */
const FORMAS_FACA_NOVA = ["Retangular", "Quadrada", "Oval/Elipse", "Recorte especial", "Redonda", "GAP"];
const CINZA = "#8a8a8a";
const CLARO = "#b3b1b3";
/* o cinza das dicas dos campos no desenho ("*Nome do cliente") */
const DICA = "#c7c7c7";

/* `cartao` só existe onde o texto do cartão da capa é diferente do da etapa
   aberta: na etapa 3. */
type Passo = { etapa: string; t1: string; t2: string; titulo: string; sub: string; cartao?: string };
const PASSOS: Passo[] = [
  { etapa: "Etapa 1", t1: "Briefing", t2: "e anexos", titulo: "Briefing e anexos", sub: "O que precisa ser criado, anexos e referências." },
  { etapa: "Etapa 2", t1: "Medidas", t2: "e substrato", titulo: "Medidas e substrato", sub: "Medidas e matéria-prima necessária para produção." },
  { etapa: "Etapa 3", t1: "Cores e", t2: "acabamento", titulo: "Cores e acabamento", sub: "Cores, com picote, verniz... especifique aqui.", cartao: "Quantas cores, com picote, verniz... especifique aqui." },
  { etapa: "Etapa 4", t1: "Revisão", t2: "e concluir", titulo: "Revisão e concluir", sub: "Confira antes de mandar para a fila do design." },
];

/* As duas colunas de substrato são as do handoff, na ordem dele. Não são as
   mesmas da modal V1a ("Papel couché", "BOPP Matte"…): o design renomeou e
   encurtou a lista. Substrato fora da lista entra pelo "Novo substrato". */
const SUB_COL_A = ["BOPP Removível", "BOPP metalizado", "BOPP transparente", "BOPP fosco", "Pérola"];
const SUB_COL_B = ["Couché", "Cartão", "Térmico", "Nylon", "Polietileno"];
/* sete, como no desenho v4 (eram seis) */
const QTD_CORES = [1, 2, 3, 4, 5, 6, 7];

/* Os quatro primeiros têm coluna no banco; os dois últimos ainda não. */
const ACABAMENTOS: { nome: string; desc: string; campo?: "picote" | "tarjaVerso" | "coldStamp" | "verniz" }[] = [
  { nome: "Picote", desc: "Corte pontilhado que facilita o destaque manual.", campo: "picote" },
  { nome: "Tarja no verso", desc: "Faixa adesiva impressa no verso da etiqueta.", campo: "tarjaVerso" },
  { nome: "Cold stamp", desc: "Aplicação metalizada a frio para brilho.", campo: "coldStamp" },
  { nome: "Verniz", desc: "Camada que protege e realça áreas da arte.", campo: "verniz" },
  { nome: "Laminação fosca", desc: "Película fosca que reduz o reflexo." },
  { nome: "Laminação brilho", desc: "Película brilhante que intensifica as cores." },
];

/* com o nome como a tabela escreve: "021 C" e "032 C" não casavam com a
   "Orange 021 C" e a "Red 032 C" e saíam com a bolinha cinza (simulação 6,
   07/10/2026) */
const PANTONE_PADRAO = ["485 C", "185 C", "300 C", "877 C", "355 C", "Orange 021 C", "2945 C", "Red 032 C", "1235 C", "476 C", "Black 6 C", "424 C"];

/** hex de um código Pantone, ou cinza quando não está na tabela */
const hexPant = (cod: string) => PANTONE_SC.find((p) => p.c.toLowerCase() === cod.toLowerCase())?.h ?? "#d9d9d9";

/** Só dígitos, com uma vírgula decimal. Campo de medida não recebe letra:
    "BOPP" digitado na Largura vira largura inválida e chega assim no pedido.
    Ponto do teclado numérico vira vírgula, que é como o hub escreve. */
const soNumero = (v: string) => {
  const limpo = v.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [inteiro, ...resto] = limpo.split(",");
  return resto.length ? inteiro + "," + resto.join("") : inteiro;
};

/* Medida da faca nova digitada no campo grande, como "60x40" ou "60 × 40":
   vira largura e altura. Só um número é largura, ainda sem altura. */
function partirMedida(v: string): { largura: string; altura: string } {
  const [a = "", b = ""] = v.split(/\s*[xX×*]\s*/);
  return { largura: soNumero(a), altura: soNumero(b) };
}

/* ————— medidas do desenho v4 —————
   Do SVG dele, medidas pelo conferente-layout; o que caía a até 6 px de uma
   coluna ou linha da grade foi para ela. */
const LG = LINHA_DA_GRADE_HUB;
const V4 = {
  topo: 9 * LG,               // cartões e painéis começam na linha 9 (desenho 144,74)
  pePainel: 51 * LG,          // os painéis terminam na linha 51 (desenho 822,44)
  cartao: 440, alturaCartao: 720, raio: 20, sombra: "7px 7px 42px rgba(0,0,0,.2)",
  basePe: 63 * LG,            // base do título do pé, como em Pedidos
  baseNumero: 57 * LG,        // o "01" cinza acima do título
  baseCampo: 19 * LG,         // a linha dos campos grandes (nome, medida, cores)
  pilulaAlt: 44.04, pilulaBorda: 2.21,
  direita: 1409,              // a tinta dos textos do painel da direita (49 da borda dele)
};
const TOPO_PILULA = V4.basePe - 0.85 - V4.pilulaAlt;
/* Dentro do cartão da capa, relativo a ele (o desenho repete as mesmas
   posições nos quatro). Rótulo em Inter 24, título em Fraunces 70 com
   entrelinha 60, texto em Inter 24 com entrelinha 29. */
const CARTAO_V4 = { rotuloX: 51.69, rotuloBase: 81.66, tituloX: 48.64, tituloBase: 164.08, descX: 46, descBase: 637.16, descLargura: 330 };
/* As ilustrações são as do hub, exportadas do desenho dele (maiores, e a
   régua do cartão 2 por baixo do papel); posição relativa ao cartão. */
const ILU_V4 = [
  { src: "/np10/v4-ilu1.png", x: 26.59, y: 313.28, w: 379, h: 232 },
  { src: "/np10/v4-ilu2.png", x: 21.2, y: 282.19, w: 339, h: 285 },
  { src: "/np10/v4-ilu3.png", x: 30.01, y: 339.14, w: 365, h: 185 },
  { src: "/np10/v4-ilu4.png", x: 31.44, y: 228.91, w: 303, h: 319 },
];
/* Pílulas do pé: a caixa de fora (o traço de 2,21 do Illustrator fica metade
   para fora do desenho). Nas etapas, o Anterior vem primeiro e termina na
   borda do painel da esquerda (1320), o Próximo (Concluir na revisão) começa
   na borda do da direita (c17) e o Sair termina na c23, sempre com o traço
   centrado na linha, como no desenho (Augusto, 02/10/2026: "alinhe o botão
   próximo à linha que tracei" e depois "inverter posição dos botões, voltar
   em primeiro"; no desenho o Próximo começava na c13 e o Anterior na c17).
   Na etapa 1 não há Anterior e o Próximo fica no mesmo lugar das outras.
   Na capa elas vêm depois do título com
   44 de ar e 29 entre elas, a regra das pílulas de Aprovações: o desenho
   deixava 6,65 entre o "Solicitação" e o "Salvar", e ficou encostado
   (Augusto, 01/10/2026: "precisa de ar entre os elementos"). */
const PE = {
  salvar: { w: 143.29 }, historico: { w: 211.23 }, comecar: { w: 211.23 },
  anterior: { x: 1320 + 1.105 - 211.23, w: 211.23 }, proximo: { x: 1358.895, w: 211.23 }, sair: { x: 1735.245, w: 105.86 },
};
/** o mínimo de palavras do briefing para seguir (Augusto, 02/10/2026) */
const BRIEFING_MIN_PALAVRAS = 5;
/** o ar entre o título e a 1ª pílula, e entre a última e o texto da direita */
const AR_DO_PE = 44;
/** o vão entre as pílulas do pé (o de Pedidos) */
const VAO_DO_PE = 29;

const PILULA_V4: CSSProperties = {
  position: "absolute", top: TOPO_PILULA, height: V4.pilulaAlt, boxSizing: "border-box", border: `${V4.pilulaBorda}px solid ${PRETO}`,
  borderRadius: 999, display: "flex", alignItems: "center", padding: 0, fontFamily: INTER, fontSize: 20.5, fontWeight: 500, letterSpacing: "-.014em", color: PRETO,
  whiteSpace: "nowrap", cursor: "pointer", zIndex: 30,
};
/* o texto da pílula desce 1 px para ficar no meio dela (medido em Pedidos) */
const TEXTO_PILULA: CSSProperties = { paddingTop: 2 };
const PAINEL_V4: CSSProperties = { position: "absolute", top: V4.topo, height: V4.pePainel - V4.topo, background: "#fff", borderRadius: V4.raio, boxShadow: V4.sombra, zIndex: 1 };
/* as pílulas de arquivo e de Pantone do desenho: 148,9 × 31,19 no traço */
const CHIP_V4: CSSProperties = {
  position: "relative", boxSizing: "border-box", width: 151.11, height: 33.4, border: `${V4.pilulaBorda}px solid ${PRETO}`, borderRadius: 999,
  background: FUNDO_PAGINA, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 15.7px 0 20.3px",
  fontFamily: INTER, fontSize: 13.5, fontWeight: 500, letterSpacing: "-.027em", color: PRETO, whiteSpace: "nowrap",
};
/* a pílula de anexo: o × fica sempre à vista, e o nome para antes dele (com
   o padding do desenho, o "…" caía embaixo do círculo) */
const CHIP_ANEXO_V4: CSSProperties = { ...CHIP_V4, padding: "0 30px 0 20.3px" };
const CAIXA_POP_V4: CSSProperties = {
  position: "absolute", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12, padding: 8, zIndex: 40,
  boxShadow: "0 18px 40px -16px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", gap: 3,
};
const BOTAO_LIMPO: CSSProperties = { background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", color: PRETO, textAlign: "left" };

/** Texto em Fraunces 600 com a tinta da 1ª letra em x e a base em `base`. */
function frEm(texto: string, corpo: number, x: number, base: number): CSSProperties {
  return {
    position: "absolute", left: x - folgaFR(corpo, texto.charAt(0)), top: base - baseFraunces(corpo, corpo),
    ...FR, fontSize: corpo, lineHeight: `${corpo}px`, letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO, zIndex: 2,
  };
}
/** Texto em Inter com a tinta da 1ª letra em x e a base da 1ª linha em `base`.
    Itálico é o de verdade (pedido em __root.tsx), com a folga dele. */
function interEm(texto: string, corpo: number, x: number, base: number, lh: number, peso = 400, italico = false): CSSProperties {
  const c = texto.charAt(0);
  const f = italico ? folga(`italic ${peso} ${corpo}px Inter`, c, 1) + (ACERTO_IN[`${corpo}/${peso}i${c}`] ?? 0.8) : folgaIN(peso, corpo, c);
  return {
    position: "absolute", left: x - f, top: base - baseInter(corpo, lh),
    fontFamily: INTER, fontSize: corpo, fontWeight: peso, fontStyle: italico ? "italic" : "normal", lineHeight: `${lh}px`, color: PRETO, zIndex: 2,
  };
}
/** O título do pé (Fraunces 104): tinta na c1 e base na linha 63, como em Pedidos. */
function tituloDoPe(texto: string): CSSProperties {
  const c = texto.charAt(0);
  return {
    position: "absolute", left: 80 - folgaFR(104, c), top: V4.basePe - baseFraunces(104, 104),
    ...FR, fontSize: 104, lineHeight: "104px", letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO, zIndex: 3,
  };
}

/* A fileira que passa da largura (as pílulas de Pantone escolhidas) rola de
   lado com a roda do mouse, como as trilhas (Augusto, 02/10/2026: "veja isso
   nas outras páginas também"). React 19: o ref devolve a limpeza. */
function rodaDeLado(el: HTMLDivElement | null) {
  if (!el) return;
  const aoRodar = (e: WheelEvent) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth + 1) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  };
  el.addEventListener("wheel", aoRodar, { passive: false });
  return () => el.removeEventListener("wheel", aoRodar);
}
/* o degradê padrão dos cartões do hub: cada um 12% mais claro que o
   anterior (o mesmo de Calculadoras e Pedidos) */
function clarear(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => Math.round(c + (255 - c) * t);
  return "#" + [canal((n >> 16) & 255), canal((n >> 8) & 255), canal(n & 255)]
    .map((x) => x.toString(16).padStart(2, "0")).join("");
}
/* o teto de cada anexo: o mesmo MAX_ANEXO_MB da rota (hub.tsx), que recusa
   acima disso no envio */
const LIMITE_ANEXO_MB = 35;
/* o canvas de medir o texto da direita do pé da capa (o campo grande mede no
   DOM, ver `medidor`) */
let canvasDeMedir: CanvasRenderingContext2D | null = null;
/* O texto da direita do pé da capa (Inter 21): cortado pelo CSS com "…", o
   corte vinha onde a letra acabava e a linha não terminava na c23 como a de
   cima. Cabe inteiro, medido aqui (com 2% de folga: o canvas não aplica o
   tamanho óptico da Inter). */
function larguraDoStatus(texto: string): number {
  if (typeof document === "undefined") return 0;
  canvasDeMedir ??= document.createElement("canvas").getContext("2d");
  if (!canvasDeMedir) return 0;
  canvasDeMedir.font = "500 21px Inter";
  return (canvasDeMedir.measureText(texto).width - 0.028 * 21 * texto.length) * 1.02;
}
/** corta com "…" o que não cabe na largura */
function caberNoStatus(texto: string, largura: number): string {
  if (larguraDoStatus(texto) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && larguraDoStatus(t.trimEnd() + "…") > largura) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
/** "Falta: A, B, C e mais 2." no lugar da lista que não cabe */
function faltaNoStatus(campos: string[], largura: number): string {
  for (let n = campos.length; n >= 1; n--) {
    const resto = campos.length - n;
    const t = `Falta: ${campos.slice(0, n).join(", ")}${resto ? ` e mais ${resto}` : ""}.`;
    if (larguraDoStatus(t) <= largura) return t;
  }
  return caberNoStatus(`Falta: ${campos.join(", ")}.`, largura);
}

/* O campo grande mede o texto numa cópia escondida com a mesma letra (a
   Fraunces com SOFT e opsz, que o canvas não aplica: pelo canvas a conta saía
   menor que a tinta, e o nome comprido era cortado ou pedia uma terceira
   linha). É o medidor do nome dos cartões de Pedidos. */
let medidorDoCampo: HTMLDivElement | null = null;
function medidor(corpo: number, ls: number): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  if (!medidorDoCampo) {
    medidorDoCampo = document.createElement("div");
    medidorDoCampo.setAttribute("aria-hidden", "true");
    Object.assign(medidorDoCampo.style, { position: "absolute", left: "-99999px", top: "0", visibility: "hidden", pointerEvents: "none", padding: "0", margin: "0",
      fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 72", fontWeight: "600" });
    document.body.appendChild(medidorDoCampo);
  }
  medidorDoCampo.style.fontSize = `${corpo}px`;
  medidorDoCampo.style.letterSpacing = `${ls}em`;
  return medidorDoCampo;
}
/** a largura do texto numa linha, na letra do campo */
function larguraNoCampo(texto: string, corpo: number, ls: number): number {
  const m = medidor(corpo, ls);
  if (!m) return 0;
  Object.assign(m.style, { whiteSpace: "pre", width: "auto", lineHeight: "normal" });
  m.textContent = texto;
  return m.getBoundingClientRect().width;
}
/** quantas linhas o texto ocupa na largura da caixa, quebrando como o textarea */
function linhasNoCampo(texto: string, corpo: number, ls: number, largura: number, lh: number): number {
  const m = medidor(corpo, ls);
  if (!m) return 1;
  Object.assign(m.style, { whiteSpace: "pre-wrap", overflowWrap: "anywhere", width: `${largura}px`, lineHeight: `${lh}px` });
  m.textContent = texto;
  return Math.max(1, Math.round(m.scrollHeight / lh));
}

/** Campo grande do desenho (nome do cliente, medida, cores): Fraunces com a
    dica em cinza e o texto começando na coluna. Sem o asterisco de
    obrigatório que o desenho pendurava à esquerda (Augusto, 02/10/2026:
    "retire o asterisco de todos em todas as etapas"). Numa linha, texto
    comprido encolhe a letra para caber (até `minimo`, a metade sem ele). Com
    `linhas={2}` (o nome do cliente na etapa 1; ele, 02/10/2026: "clientes com
    nomes que não cabem na linha ficam em duas linhas"), o que não cabe numa
    linha passa para a segunda no tamanho cheio, e só encolhe se nem em duas
    couber. Faltando depois de tentar concluir, a dica ganha o marca-texto,
    por uma cópia dela em letra transparente atrás do campo.
    Com `encolherAntes` (a revisão), o nome encolhe numa linha até o mínimo e
    só então passa para duas, no mínimo, crescendo para cima. */
function CampoGrande({ valor, aoMudar, dica, corpo, ls, x, base, largura, rotulo, falta, autoFocus, inputMode, aoTeclar, linhas = 1, minimo, encolherAntes, campoRef, marcar }: {
  valor: string; aoMudar: (v: string) => void; dica: string; corpo: number; ls: number; x: number; base: number; largura: number;
  rotulo: string; falta?: boolean; autoFocus?: boolean; inputMode?: "decimal" | "text"; aoTeclar?: (e: TeclaReact<HTMLInputElement>) => void;
  linhas?: 1 | 2; minimo?: number; encolherAntes?: boolean; campoRef?: Ref<HTMLInputElement>;
  /* um trecho do que foi escrito com o marca-texto atrás (a cor escrita errado) */
  marcar?: { inicio: number; fim: number } | null;
}) {
  const piso = minimo ?? Math.round(corpo / 2);
  let c = corpo, n = 1;
  if (linhas === 2 && encolherAntes) {
    /* A revisão (simulação 6, 07/10/2026): o nome comprido encolhia até o
       mínimo e era cortado no fim, sem reticências ("...Representações Ltd").
       Encolhe numa linha como antes e, se nem no mínimo couber, vai para duas
       linhas no mínimo, crescendo para cima: Briefing, Medida e Cores, logo
       embaixo, ficam onde estão. */
    const w = larguraNoCampo(valor || dica, corpo, ls);
    c = w > largura ? Math.max(Math.floor((corpo * largura) / w), piso) : corpo;
    if (valor && larguraNoCampo(valor, c, ls) > largura + 24) n = 2;
  } else if (linhas === 2 && valor && larguraNoCampo(valor, corpo, ls) > largura + 24) {
    n = 2;
    while (c > piso && linhasNoCampo(valor, c, ls, largura + 24, Math.round(c * 1.05)) > 2) c -= 2;
  } else if (linhas === 1) {
    const w = larguraNoCampo(valor || dica, corpo, ls);
    c = w > largura ? Math.max(Math.floor((corpo * largura) / w), piso) : corpo;
  }
  /* duas linhas com a entrelinha fechada de título; a 1ª linha fica na mesma
     base. Crescendo para cima, a última fica na base e a entrelinha é de
     linhas inteiras da grade, para as duas bases caírem nela. */
  const lh = n === 2
    ? (encolherAntes ? Math.ceil((c * 1.05) / LINHA_DA_GRADE_HUB) * LINHA_DA_GRADE_HUB : Math.round(c * 1.05))
    : Math.round(c * 1.3);
  const esq = x - folgaFraunces(600, c, dica.charAt(0)) - ((ACERTO_FR[`${corpo}${dica.charAt(0)}`] ?? 0.7) * c) / corpo;
  const topo = base - (encolherAntes ? (n - 1) * lh : 0) - baseFraunces(c, lh);
  /* nem em duas linhas no mínimo coube (nome de mais de uns 160 caracteres):
     o nome inteiro fica no title */
  const cortado = n === 2 && linhasNoCampo(valor, c, ls, largura + 24, lh) > 2;
  const letra: CSSProperties = { ...FR, fontSize: c, lineHeight: `${lh}px`, letterSpacing: `${ls}em`, whiteSpace: "nowrap" };
  const caixa: CSSProperties = { ...letra, position: "absolute", left: esq, top: topo, width: largura + 24, height: lh * n, boxSizing: "border-box", padding: 0, border: "none", outline: "none", background: "transparent", color: PRETO, zIndex: 3 };
  /* Na entrelinha fechada das duas linhas, a letra passa da linha em cima e
     embaixo, e o textarea rolava uns 7 px ao digitar (a 1ª linha subia e
     cortava). A folga acolhe essa sobra; a base fica onde estava. */
  const folga = n === 2 ? Math.ceil(c * 0.12) : 0;
  return (
    <>
      {falta && !valor && (
        <span aria-hidden style={{ ...letra, position: "absolute", left: esq, top: topo, height: lh, color: "transparent", pointerEvents: "none", zIndex: 2 }}>
          <span className="np10-falta">{dica}</span>
        </span>
      )}
      {/* o marca-texto atrás da palavra: a mesma letra do campo, transparente,
          com o texto até ela antes ("pre" mantém os espaços como o input) */}
      {marcar && valor && linhas === 1 && (
        <span aria-hidden data-marca-campo style={{ ...letra, whiteSpace: "pre", position: "absolute", left: esq, top: topo, height: lh, color: "transparent", pointerEvents: "none", zIndex: 2 }}>
          {valor.slice(0, marcar.inicio)}<span className="np10-falta">{valor.slice(marcar.inicio, marcar.fim)}</span>
        </span>
      )}
      {linhas === 2 ? (
        /* duas linhas: textarea sem Enter (o nome é uma linha só que quebra) */
        <textarea value={valor} onChange={(e) => aoMudar(e.target.value.replace(/\s*\n\s*/g, " "))} placeholder={dica} aria-label={rotulo} autoFocus={autoFocus} title={cortado ? valor : undefined}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} spellCheck={false} autoComplete="off" rows={n} className="np4-campo"
          style={{ ...caixa, top: topo - folga, height: lh * n + 2 * folga, padding: `${folga}px 0`, whiteSpace: "pre-wrap", overflowWrap: "anywhere", overflow: "hidden", resize: "none" }} />
      ) : (
        <input ref={campoRef} value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={dica} aria-label={rotulo} autoFocus={autoFocus} inputMode={inputMode}
          onKeyDown={aoTeclar} spellCheck={false} autoComplete="off" className="np4-campo" style={caixa} />
      )}
    </>
  );
}

/** A seta das pílulas do desenho (a mesma da seta de rolar de Pedidos). */
function SetaV4({ volta = false }: { volta?: boolean }) {
  return (
    <svg width={18.56} height={16.36} viewBox="0 0 18.56 16.36" aria-hidden style={{ flex: "none", display: "block", transform: volta ? "scaleX(-1)" : undefined }}>
      <line x1={0} y1={8.18} x2={16.39} y2={8.18} stroke="currentColor" strokeWidth={2} />
      <polygon points="9.76 16.36 8.39 14.89 15.62 8.18 8.39 1.47 9.76 0 18.55 8.18" fill="currentColor" />
    </svg>
  );
}
/** O "+" do desenho: 20,46 com braço de 3,27, o mesmo de Pedidos. */
function MaisV4() {
  const t = 20.46, b = 3.27;
  return (
    <svg width={t} height={t} viewBox={`0 0 ${t} ${t}`} aria-hidden style={{ display: "block" }}>
      <rect x={0} y={(t - b) / 2} width={t} height={b} fill="currentColor" /><rect x={(t - b) / 2} y={0} width={b} height={t} fill="currentColor" />
    </svg>
  );
}
/** Bolinha de opção do desenho ("Faca nova"): aro fino de 27,32; marcada, cheia. */
function BolinhaV4({ ligada }: { ligada: boolean }) {
  return <span aria-hidden style={{ display: "block", boxSizing: "border-box", width: 28, height: 28, borderRadius: 999, border: `1px solid ${PRETO}`, background: ligada ? PRETO : "transparent", flex: "none" }} />;
}
/** ✓ preto: etapa completa na capa, acabamento escolhido. */
/* o número de cores dentro do círculo de 52 (etapa 3 e revisão) */
const NUMERO_NO_CIRCULO: CSSProperties = { ...FR, fontSize: 28, lineHeight: "28px", letterSpacing: "-.02em", transform: "translate(-0.5px, -0.5px)" };
function ConfereV4({ rotulo }: { rotulo: string }) {
  return (
    <span aria-label={rotulo} role="img" style={{ width: 24, height: 24, borderRadius: 999, background: PALETA.confere, display: "grid", placeItems: "center", flex: "none" }}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PALETA.confereTraco} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
    </span>
  );
}
function XisPequeno({ tamanho = 13, cor = PRETO }: { tamanho?: number; cor?: string }) {
  return <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} style={{ flex: "none" }} fill="none" stroke={cor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}

export function NovoPedidoHub10({ profile, aoNavegar, onLogout, disponiveis, cadastros, podeCadastrarMateria, aoCadastrarMateria, pedidos = [], pedidosProntos = true, aoCriar, aoVerPedido, aoCarregarPdfFaca, aoCarregarSalvo, aoSalvar, aoCarregarPedido, aoAvisoFora }: {
  profile: SessionUser;
  aoNavegar: (label: string) => void;
  onLogout: () => void;
  disponiveis?: string[];
  cadastros?: CadastrosV1a;
  /** quem pode cadastrar matéria-prima para todo mundo (cadastro.materiais) */
  podeCadastrarMateria?: boolean;
  aoCadastrarMateria?: (nome: string) => Promise<unknown>;
  /** pedidos já carregados: alimentam o Histórico e os Pantones "usados por clientes" */
  pedidos?: PedidoDaLista[];
  /** a lista de pedidos já chegou do servidor (antes, vazia não quer dizer nenhum) */
  pedidosProntos?: boolean;
  aoCriar?: (dados: DadosNovoPedido) => Promise<{ num?: string; aviso?: string; id?: string } | void> | void;
  /** abre o pedido recém-criado na tela de Pedidos */
  aoVerPedido?: (id: string) => void;
  /** devolve uma object URL do PDF da faca (a rota já tem o carregador) */
  aoCarregarPdfFaca?: (arquivo: string) => Promise<string>;
  /** o pedido salvo pelo "Salvar" (no servidor), ou nada */
  aoCarregarSalvo?: () => Promise<{ rascunho: Record<string, unknown> | null }>;
  /** guarda o que foi preenchido; null apaga o salvo */
  aoSalvar?: (rascunho: Record<string, unknown> | null) => Promise<unknown>;
  /** o pedido inteiro, para o "Copiar" do Histórico */
  aoCarregarPedido?: (id: string) => Promise<{ pedido: Record<string, unknown>; anexos?: unknown[] }>;
  /** o recado do envio quando a tela já saiu (o menu do topo no meio do
      "Enviando…"): a rota mostra na tela para onde a pessoa foi */
  aoAvisoFora?: (texto: string) => void;
}) {
  /* ————— etapa aberta ————— */
  const [etapa, setEtapa] = useState<number | null>(null);

  /* ————— campos ————— */
  const [nome, setNome] = useState("");
  const [briefing, setBriefing] = useState("");
  const [anexos, setAnexos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);
  /* o seletor de arquivos dos anexos: o "+" e a área de soltar abrem o mesmo */
  const entradaAnexosRef = useRef<HTMLInputElement | null>(null);

  const [facaCod, setFacaCod] = useState("");
  const [buscaFaca, setBuscaFaca] = useState("");
  const [materia, setMateria] = useState("");
  const [novoSubAberto, setNovoSubAberto] = useState(false);
  const [novoSubTexto, setNovoSubTexto] = useState("");
  /* digitar já escolhe o substrato; cancelar tem de devolver o de antes, e
     não deixar o pedaço digitado valendo como matéria-prima */
  const [materiaAntes, setMateriaAntes] = useState("");
  const [largura, setLargura] = useState("");
  const [carreiras, setCarreiras] = useState("");

  const [qtdCores, setQtdCores] = useState("");
  const [coresTexto, setCoresTexto] = useState("");
  const coresRef = useRef<HTMLInputElement>(null);
  const [buscaPant, setBuscaPant] = useState("");
  /* a caixa de Pantone: aberta pela "Ver paleta de cores" (busca na tabela)
     ou pela "Cores de outros clientes" (as mais usadas nos pedidos) */
  const [pantPop, setPantPop] = useState<"paleta" | "outros" | null>(null);
  const verUsados = pantPop === "outros";
  const [pantSel, setPantSel] = useState<string[]>([]);
  const [acab, setAcab] = useState<Record<string, boolean>>({});
  /* Faca nova: a medida não está no catálogo e a faca ainda vai ser feita.
     A medida e o formato são digitados (sem faca, não há de onde tirar). */
  const [facaNova, setFacaNova] = useState(false);
  const [largFaca, setLargFaca] = useState("");
  const [altFaca, setAltFaca] = useState("");
  /* o que foi digitado no campo grande da faca nova ("60x40"): vira largura
     e altura, mas o texto fica como a pessoa escreveu enquanto digita */
  const [medidaNova, setMedidaNova] = useState("");
  const [formaFaca, setFormaFaca] = useState("");
  const [urgente, setUrgente] = useState(false);
  /* Faca de uma medida só (as de gap): a medida é a ALTURA, que é fixa, e
     a largura da etiqueta é digitada (Augusto, 29/09/2026). Sem ela o
     servidor recusava o pedido, e a tela não tinha onde completar. */
  const [larguraExtra, setLarguraExtra] = useState("");

  /* ————— envio ————— */
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ num: string; aviso?: string; id?: string } | null>(null);
  /* o aviso de campo faltando só aparece depois de tentar concluir, e se
     desfaz sozinho conforme a pessoa preenche (antes ficava preso na tela) */
  const [tentouEnviar, setTentouEnviar] = useState(false);
  /* O Próximo não avança com a etapa incompleta (Augusto, 02/10/2026: "as
     etapas precisam estar preenchidas para o usuário ir para a próxima
     etapa"); pela capa, começa por qualquer etapa. Guarda a etapa em que a
     pessoa tentou seguir: nela o que falta ganha o marca-texto e a pílula
     vermelha diz o quê. */
  const [tentouSeguir, setTentouSeguir] = useState<number | null>(null);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [aviso, setAviso] = useState("");
  const [avisoTipo, setAvisoTipo] = useState<"ok" | "alerta">("alerta");
  /* o aviso de anexo recusado é da etapa 1: mudando de etapa ele sai (ficava
     empilhado com a pílula vermelha nas outras; simulação 4) */
  useEffect(() => { setAviso((a) => (a.startsWith("Não entrou:") ? "" : a)); }, [etapa]);
  const avisar = (texto: string, tipo: "ok" | "alerta" = "alerta") => { setAviso(texto); setAvisoTipo(tipo); };
  /* o aviso de "feito" (salvo, copiado) some sozinho; o de erro espera fechar */
  useEffect(() => {
    if (!aviso || avisoTipo !== "ok") return;
    const t = window.setTimeout(() => setAviso(""), 6000);
    return () => window.clearTimeout(t);
  }, [aviso, avisoTipo]);
  const [pdfAmpliado, setPdfAmpliado] = useState(false);
  /* Rascunho achado ao abrir: espera a pessoa dizer se continua. Entrar
     direto nele misturava o pedido de ontem no pedido novo (simulação de
     28/09/2026). `_salvo` = veio do "Salvar" (servidor), não desta aba. */
  const [rascunhoAchado, setRascunhoAchado] = useState<Record<string, any> | null>(null);

  /* ————— Salvar e Histórico (pé da capa) ————— */
  const [salvando, setSalvando] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [buscaHist, setBuscaHist] = useState("");
  const [copiarDe, setCopiarDe] = useState<PedidoDaLista | null>(null);
  const [copiando, setCopiando] = useState<string | null>(null);
  /* o formulário veio do salvo (ou foi salvo agora): enviado o pedido, o
     salvo sai do servidor, para não voltar como "pedido salvo" e ser mandado
     de novo */
  const usouSalvoRef = useRef(false);
  /* O mesmo, em estado: o rascunho da aba é regravado assim que o Salvar
     confirma. Só com a ref, a aba guardava "não veio do salvo" até algum
     campo mudar, e quem salvava, saía e voltava mandava o pedido deixando o
     salvo no servidor, que voltava depois e podia ser mandado de novo
     (revisão de código, 02/10/2026). */
  const [formDoSalvo, setFormDoSalvo] = useState(false);
  const marcarSalvo = (v: boolean) => { usouSalvoRef.current = v; setFormDoSalvo(v); };

  /* Precisa marcar vivo NA MONTAGEM, não só na declaração: em StrictMode o
     efeito monta, desmonta e monta de novo, e a limpeza do primeiro ciclo
     deixaria a ref em false para sempre — o envio ficava preso em
     "Enviando…" com o pedido já criado no servidor. */
  const vivoRef = useRef(true);
  /* trava de clique repetido: ref muda na hora, estado só no render seguinte */
  const emVooRef = useRef(false);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  /* As folgas das letras (que põem a tinta na coluna) são medidas com a
     fonte carregada: um render a mais quando ela chega. Junto, o fim do
     título da capa, de onde as pílulas do pé começam (com 44 de ar). */
  const [, setFontesProntas] = useState(0);
  const tituloCapaRef = useRef<HTMLDivElement | null>(null);
  const [fimDoTitulo, setFimDoTitulo] = useState(80 + 482);
  useEffect(() => {
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo) setFontesProntas((n) => n + 1); });
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    const el = tituloCapaRef.current;
    if (!el) return;
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo && el.isConnected) setFimDoTitulo(el.offsetLeft + el.offsetWidth); });
    return () => { vivo = false; };
  }, [etapa]);

  /* ————— o formulário como dado (rascunho da aba e "Salvar") ————— */
  const vazio = !nome.trim() && !briefing.trim() && !facaCod && !facaNova && !largFaca && !altFaca && !materia && !largura && !carreiras
    && !qtdCores && !coresTexto.trim() && !pantSel.length && !Object.values(acab).some(Boolean) && !anexos.length && !urgente;
  const vazioRef = useRef(vazio);
  vazioRef.current = vazio;
  const formulario = () => ({
    nome, briefing, facaCod, facaNova, largFaca, altFaca, formaFaca, materia, largura, carreiras,
    qtdCores, coresTexto, pantSel, acab, urgente, larguraExtra, anexos: anexos.length,
  });

  /* ESC desfaz uma camada por vez, e só quando esta tela está por cima —
     os Ajustes da barra abrem sobre ela. */
  const algoAbertoAqui = !!rascunhoAchado || confirmarApagar || !!copiarDe || pdfAmpliado || historicoAberto || !!pantPop || (novoSubAberto && etapa === 1) || etapa !== null;
  const escDoNovoPedido = useCallback(() => {
    /* enviando, a revisão fica: saindo no meio, o erro do envio não aparecia */
    if (enviando) return;
    /* ESC na pergunta do rascunho é continuar: não apaga nada */
    if (rascunhoAchado) { continuarRascunho(); return; }
    if (confirmarApagar) { setConfirmarApagar(false); return; }
    if (copiarDe) { setCopiarDe(null); return; }
    if (pdfAmpliado) { setPdfAmpliado(false); return; }
    if (historicoAberto) { setHistoricoAberto(false); return; }
    if (pantPop) { setPantPop(null); return; }
    if (novoSubAberto && etapa === 1) { setNovoSubAberto(false); setNovoSubTexto(""); setMateria(materiaAntes); return; }
    if (etapa !== null) { setTentouSeguir(null); setEtapa(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enviando, rascunhoAchado, confirmarApagar, copiarDe, pdfAmpliado, historicoAberto, pantPop, novoSubAberto, materiaAntes, etapa]);
  /* O catálogo de facas abre por cima, como pop-up (Augusto, 02/10/2026; antes
     abria em outra aba para não perder o formulário). Com ele aberto, o ESC é
     dele: fecha primeiro o que estiver aberto dentro (família, desenho) e só
     depois o catálogo, por isso o nível fica abaixo do painel das Facas. */
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const fecharCatalogo = useCallback(() => setCatalogoAberto(false), []);
  useEscDoTopo(catalogoAberto, NIVEL.painel - 8, fecharCatalogo);
  useEscDoTopo(algoAbertoAqui && !catalogoAberto, pdfAmpliado ? NIVEL.pantone : confirmarApagar || rascunhoAchado || copiarDe ? NIVEL.caixa : NIVEL.verTodos, escDoNovoPedido);

  /* trocar de etapa fecha as duas caixas: abertas e escondidas, o primeiro
     ESC da etapa seguinte não fazia nada visível */
  useEffect(() => { setHistoricoAberto(false); setPantPop(null); }, [etapa]);
  /* clique fora fecha a caixa do Histórico e a de Pantone */
  useEffect(() => {
    if (!historicoAberto && !pantPop) return;
    const fora = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.("[data-pop]")) return;
      setHistoricoAberto(false);
      setPantPop(null);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [historicoAberto, pantPop]);

  /* ————— rascunho —————
     Lido depois de montar (no servidor não há sessionStorage, e ler antes
     desencontraria a hidratação). Gravado a cada mudança; some quando o
     formulário esvazia ou o pedido é enviado. Sem rascunho na aba, pergunta
     ao servidor pelo pedido salvo no "Salvar". */
  const [rascunhoLido, setRascunhoLido] = useState(false);
  const carregarSalvoRef = useRef(aoCarregarSalvo);
  carregarSalvoRef.current = aoCarregarSalvo;
  useEffect(() => {
    let daAba: Record<string, any> | null = null;
    try {
      const bruto = sessionStorage.getItem(CHAVE_RASCUNHO);
      const r = bruto ? JSON.parse(bruto) : null;
      /* de outra pessoa (saiu e outra entrou na mesma aba): não é deste
         formulário, e continuar e enviar apagaria o salvo de quem entrou */
      if (r && typeof r === "object" && r.dono && r.dono !== profile.id) sessionStorage.removeItem(CHAVE_RASCUNHO);
      else if (r && typeof r === "object") daAba = r;
    } catch { /* sem armazenamento no navegador: começa em branco */ }
    setRascunhoLido(true);
    if (daAba) { setRascunhoAchado(daAba); return; }
    const carregar = carregarSalvoRef.current;
    if (!carregar) return;
    let vivo = true;
    carregar()
      .then((r) => {
        const s = r?.rascunho;
        /* só pergunta se a pessoa ainda não começou a preencher */
        if (vivo && s && typeof s === "object" && vazioRef.current) setRascunhoAchado({ ...s, _salvo: true });
      })
      .catch((e: unknown) => { if (vivo) avisar(erroLegivel(e, "Não deu para conferir se há um pedido salvo.")); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* "Continuar": o formulário volta como estava. Arquivo não fica no
     rascunho, e o aviso pede para escolher de novo. */
  function continuarRascunho() {
    const r = rascunhoAchado;
    setRascunhoAchado(null);
    if (!r) return;
    if (r._salvo || r.veioDoSalvo) marcarSalvo(true);
    setNome(String(r.nome ?? "")); setBriefing(String(r.briefing ?? ""));
    setFacaCod(String(r.facaCod ?? "")); setFacaNova(!!r.facaNova); setLarguraExtra(String(r.larguraExtra ?? ""));
    const lf = String(r.largFaca ?? ""), af = String(r.altFaca ?? "");
    setLargFaca(lf); setAltFaca(af); setMedidaNova(lf && af ? `${lf}x${af}` : lf); setFormaFaca(String(r.formaFaca ?? ""));
    setMateria(String(r.materia ?? "")); setLargura(String(r.largura ?? "")); setCarreiras(String(r.carreiras ?? ""));
    setQtdCores(String(r.qtdCores ?? "")); setCoresTexto(String(r.coresTexto ?? ""));
    setPantSel(Array.isArray(r.pantSel) ? r.pantSel.map(String) : []);
    setAcab(r.acab && typeof r.acab === "object" ? r.acab : {});
    setUrgente(!!r.urgente);
    const n = Number(r.anexos) || 0;
    if (n) avisar(`Escolha de novo ${n === 1 ? "o anexo" : `os ${n} anexos`}: arquivo não fica guardado no rascunho.`);
  }
  /* "Começar do zero": o rascunho sai e o formulário fica em branco. O
     salvo no servidor também sai (a caixa avisa antes). */
  const descartarRascunho = () => {
    const r = rascunhoAchado;
    setRascunhoAchado(null);
    try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ }
    if ((r?._salvo || r?.veioDoSalvo) && aoSalvar) {
      void Promise.resolve(aoSalvar(null)).catch((e: unknown) => avisar(erroLegivel(e, "Não deu para apagar o pedido salvo.")));
    }
  };
  useEffect(() => {
    /* durante o envio o rascunho fica fora: quem sai e volta antes do fim
       não pode achar o pedido de novo no formulário e mandar duas vezes.
       Com a pergunta do rascunho aberta, o formulário ainda vazio não pode
       apagar o rascunho que está sendo perguntado. */
    if (!rascunhoLido || enviando || rascunhoAchado) return;
    try {
      if (vazio || enviado) sessionStorage.removeItem(CHAVE_RASCUNHO);
      else sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ ...formulario(), veioDoSalvo: formDoSalvo, dono: profile.id }));
    } catch { /* idem */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunhoLido, enviando, rascunhoAchado, enviado, vazio, formDoSalvo, nome, briefing, facaCod, facaNova, largFaca, altFaca, formaFaca, materia, largura, carreiras,
    qtdCores, coresTexto, pantSel, acab, urgente, larguraExtra, anexos.length]);

  /* "Salvar": guarda no servidor o que já foi preenchido (Augusto,
     01/10/2026). Só diz "salvo" depois de o servidor confirmar. */
  const salvar = async () => {
    if (salvando) return;
    if (vazio) { avisar("Ainda não há nada preenchido para salvar."); return; }
    if (!aoSalvar) { avisar("Salvar não está disponível para você."); return; }
    setSalvando(true);
    try {
      await aoSalvar(formulario());
      if (!vivoRef.current) return;
      marcarSalvo(true);
      avisar(anexos.length
        ? "Pedido salvo, sem os anexos: ao continuar, escolha os arquivos de novo."
        : "Pedido salvo. Ao abrir a Solicitação de novo, você continua de onde parou.", "ok");
    } catch (e: unknown) {
      if (vivoRef.current) avisar(erroLegivel(e, "Não deu para salvar."));
    } finally {
      if (vivoRef.current) setSalvando(false);
    }
  };

  /* O catálogo e a tabela Pantone abrem em outra aba: sair desta tela para
     consultar apagava o formulário (simulação de 28/09/2026). */
  const abrirEmOutraAba = (tela: string) => { window.open(`/hub?tela=${tela}`, "_blank", "noopener"); };

  /* "Próximo" e "Concluir" moram no mesmo lugar: o segundo clique de um
     duplo clique no "Próximo" da etapa 3 caía no "Concluir" e mandava o
     pedido sem a revisão. Na etapa 4 o Concluir só vale depois de um
     instante. */
  const revisaoAbertaEm = useRef(0);
  useEffect(() => { if (etapa === 3) revisaoAbertaEm.current = performance.now(); }, [etapa]);

  /* ————— faca escolhida e seu desenho ————— */
  /* A lista viva (Relação de Ferramentais + catálogo antigo), a MESMA da
     página de Facas: o retrato fixo do código não tinha as facas novas. */
  const { vivas } = useFacasVivas();
  /* O código do retrato antigo ("263.01") some da lista quando a Relação
     chega ("fr2-263.01M" é a mesma faca): acha pela chave e passa a usar o
     código da Relação. Sem isto a faca escolhida virava "nenhuma" e o pedido
     saía sem medida. */
  const faca = useMemo(() => vivas.find((f) => f.cod === facaCod)
    ?? (facaCod ? vivas.find((f) => chaveFaca(f.cod) === chaveFaca(facaCod)) : undefined) ?? null, [vivas, facaCod]);
  useEffect(() => { if (faca && faca.cod !== facaCod) setFacaCod(faca.cod); }, [faca, facaCod]);
  const ladosFaca = faca ? medidaEmLados(faca.medida) : { largura: "", altura: "" };
  const umLado = !!ladosFaca.largura && !ladosFaca.altura;
  const arquivoFaca = facaCod ? (faca?.arquivo || PDF_DE(facaCod).replace(/^facas\//, "")) : "";
  const [desenho, setDesenho] = useState("");
  const [desenhoFalhou, setDesenhoFalhou] = useState(false);
  /* O carregador vem da rota, que o recria a cada render. Se ele entrasse nas
     dependências, o efeito reexecutaria sem parar: revogaria a URL do blob
     com o pdf.js ainda lendo e recomeçaria o download. Guardado em ref, só o
     arquivo dispara o carregamento — é o que o FacasV1a já fazia. */
  const carregaRef = useRef(aoCarregarPdfFaca);
  carregaRef.current = aoCarregarPdfFaca;
  useEffect(() => {
    const carregar = carregaRef.current;
    if (!arquivoFaca || !carregar) { setDesenho(""); setDesenhoFalhou(false); return; }
    let vivo = true;
    let url = "";
    setDesenho("");
    setDesenhoFalhou(false);
    carregar(arquivoFaca)
      .then(async (u) => {
        if (!vivo) { URL.revokeObjectURL(u); return; }
        url = u;
        const png = await pdfPrimeiraPagina(u, 1400, arquivoFaca);
        if (vivo) setDesenho(png);
      })
      .catch(() => { if (vivo) setDesenhoFalhou(true); /* sem desenho no acervo: a área diz isso */ });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [arquivoFaca]);
  /* Voltando à etapa 2 com a faca já escolhida e a busca vazia, o campo
     grande mostra a medida dela: as pílulas filtram pela medida e a
     escolhida aparece acesa (sem isso ela podia ficar fora das oito à vista). */
  useEffect(() => {
    if (etapa === 1 && !facaNova && !buscaFaca && faca) setBuscaFaca(medidaBonita(faca.medida));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa]);

  /* `criarBusca` em vez de `includes` cru: a medida é gravada com "×" e
     quem digita escreve "x" — "38,66×40" não casava com "38,66x40" e o
     catálogo dizia que a faca não existe. A regra é a mesma do resto do
     hub (sem acento, ×/* viram x, vírgula vira ponto, com e sem espaço). */
  /* Medida digitada ("30x40", "30 x 40 mm") procura pela MEDIDA, nas duas
     orientações e até 5 mm, como a página de Facas: pelo texto, quem
     digitava 30x40 não achava a 40×30, que serve deitada. */
  /* As pílulas só aparecem depois de digitar, com as facas mais próximas do
     que foi digitado (Augusto, 02/10/2026: "essa área só aparece após
     preencher a medida e mostra as mais próximas que o usuário digitou"). Um
     número só procura as facas de um lado só (as de gap) perto dele; código
     (com letra, ou do tipo 263.01) procura pelo texto. "Nenhuma faca" só com
     a busca completa: no meio da medida ("60") a pessoa ainda está digitando. */
  const { facasFiltradas, buscaCompleta } = useMemo(() => {
    const q = buscaFaca.replace(/mm/gi, "").trim();
    if (!q) return { facasFiltradas: [] as typeof vivas, buscaCompleta: false };
    const temLetra = /[a-zà-ú]/i.test(q.replace(/(\d)\s*[x×*]\s*(?=\d)/gi, "$1 "));
    const n = MEDIDAS(q);
    if (!temLetra && n.length >= 2) {
      return { facasFiltradas: facasPerto(vivas, n[0], n[1], 5, 120).map((p) => p.faca), buscaCompleta: true };
    }
    if (!temLetra && n.length === 1 && !/^\d+\.\d{2}$/.test(q)) {
      const deUmLado = vivas
        .map((f) => ({ f, m: MEDIDAS(f.medida) }))
        .filter(({ m }) => m.length === 1 && Math.abs(m[0] - n[0]) <= 5)
        .sort((a, b) => Math.abs(a.m[0] - n[0]) - Math.abs(b.m[0] - n[0]))
        .map(({ f }) => f);
      return { facasFiltradas: deUmLado.slice(0, 120), buscaCompleta: false };
    }
    const casa = criarBusca(q);
    return { facasFiltradas: vivas.filter((f) => casa(f.cod, f.medida)).slice(0, 120), buscaCompleta: true };
  }, [buscaFaca, vivas]);

  /* ————— substratos —————
     As colunas são só as dez fixas do handoff. Substrato fora da lista não
     entra nas colunas — fica na linha de baixo, escolhido, com o × para
     tirar. */
  const substratoDigitado = !!materia && !SUB_COL_A.includes(materia) && !SUB_COL_B.includes(materia);

  /* Digitar já escolhe o substrato, como no handoff — não é preciso confirmar
     para que ele valha. O ✓ e o Enter só fecham a caixinha.
     O cadastro na tabela `cadastros` é acréscimo nosso: as colunas continuam
     sendo as dez do handoff, mas o nome fica guardado para as outras telas do
     hub, que é o que a modal antiga já fazia. Falhar nisso não desfaz a
     escolha — o pedido segue com o substrato digitado. */
  const digitarSubstrato = (v: string) => { setNovoSubTexto(v); setMateria(v.trim()); };
  const confirmarSubstrato = () => {
    const v = novoSubTexto.trim();
    setNovoSubAberto(false);
    setNovoSubTexto("");
    if (!v) { setMateria(materiaAntes); return; }
    setMateria(v);
    if (podeCadastrarMateria && aoCadastrarMateria && !(cadastros?.materiais ?? []).some((m) => m.nome.toLowerCase() === v.toLowerCase())) {
      void Promise.resolve(aoCadastrarMateria(v))
        .catch(() => avisar(`"${v}" vale para este pedido, mas não deu para guardar na lista de matérias-primas.`));
    }
  };
  const cancelarSubstrato = () => { setNovoSubAberto(false); setNovoSubTexto(""); setMateria(materiaAntes); };
  /* Sair da etapa 2 com a caixa do substrato aberta: o que foi digitado vale
     (é o mesmo que o ✓); em branco, volta o de antes. Aberta e escondida, o
     ESC de outra etapa desfazia a matéria-prima sem aviso (revisão de
     28/09/2026). */
  useEffect(() => {
    if (etapa === 1 || !novoSubAberto) return;
    if (novoSubTexto.trim()) confirmarSubstrato(); else cancelarSubstrato();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa]);

  /* ————— Pantone ————— */
  /* As cores das artes aprovadas em TODO o hub, não só da carteira de quem
     pede (Augusto, 07/10/2026: "mostra todas as cores aprovadas no hub"; a
     vendedora nova via "nenhum pedido usou Pantone"). Vem só o texto das
     cores, sem cliente. null = ainda carregando. */
  const [coresAprovadas, setCoresAprovadas] = useState<string[] | null>(null);
  useEffect(() => {
    let vivo = true;
    void import("@/lib/api/pantone.functions")
      .then((m) => m.listCoresAprovadas())
      .then((r) => { if (vivo) setCoresAprovadas(Array.isArray(r) ? (r as string[]) : []); })
      .catch(() => { if (vivo) setCoresAprovadas([]); });
    return () => { vivo = false; };
  }, []);
  const usadosPorClientes = useMemo(() => {
    /* só Pantone de verdade: "Preto" e "Vermelho" não são cor da tabela e
       entravam na lista com a bolinha cinza */
    const codigos = new Map(PANTONE_SC.map((p) => [p.c.toLowerCase(), p.c]));
    const conta: Record<string, number> = {};
    for (const desc of coresAprovadas ?? []) {
      for (const c of separarCores(desc)) {
        const cod = codigos.get(c.trim().replace(/^(pantone|p)\s+/i, "").toLowerCase());
        if (cod) conta[cod] = (conta[cod] ?? 0) + 1;
      }
    }
    const ordenados = Object.keys(conta).sort((a, b) => conta[b] - conta[a]);
    return (ordenados.length ? ordenados : PANTONE_PADRAO).slice(0, 12);
  }, [coresAprovadas]);
  /* sem Pantone nos pedidos, a lista é a fixa: é sugestão, não "a mais usada"
     (a dica ao lado diz que a usada tem amostra na produção) */
  const usadosSaoDosPedidos = useMemo(() => {
    const codigos = new Set(PANTONE_SC.map((p) => p.c.toLowerCase()));
    return (coresAprovadas ?? []).some((desc) => separarCores(desc)
      .some((c) => codigos.has(c.trim().replace(/^(pantone|p)\s+/i, "").toLowerCase())));
  }, [coresAprovadas]);

  const pantResultados = useMemo(() => {
    if (verUsados) return usadosPorClientes.map((c) => ({ c, h: hexPant(c) }));
    const t = buscaPant.trim().toLowerCase().replace(/^(pantone|p)\s+/, "");
    if (!t) return PANTONE_SC.slice(0, 12).map((p) => ({ c: p.c, h: p.h }));
    /* nome de cor ("rosa choque", "azul bic") acha pela conta da tela Pantones
       (simulação 5: a paleta da Solicitação não achava cor pelo nome); nome de
       faixa ("azul") traz a família inteira, cortada nas 21 primeiras */
    const doNome = pantonesPeloNome(buscaPant);
    if (doNome) return doNome.slice(0, 21);
    /* o código exato primeiro ("021" acha a 021 C antes da 2021 C), depois o
       que começa igual, depois o que só contém */
    const nivel = (c: string) => {
      const x = c.toLowerCase();
      /* palavra inteira também é exata: "021" é a Orange 021 C, que ficava
         atrás de 10210…10219 e saía da lista de 12 */
      if (x === t || x.replace(/ c$/, "") === t || x.replace(/ c$/, "").split(" ").includes(t.replace(/ c$/, ""))) return 0;
      return x.startsWith(t) ? 1 : 2;
    };
    return PANTONE_SC.filter((p) => p.c.toLowerCase().includes(t))
      .map((p, i) => ({ p, i, n: nivel(p.c) }))
      .sort((a, b) => a.n - b.n || a.i - b.i)
      .slice(0, 12)
      .map(({ p }) => ({ c: p.c, h: p.h }));
  }, [verUsados, buscaPant, usadosPorClientes]);

  const alternarPant = (cod: string) =>
    setPantSel((s) => (s.includes(cod) ? s.filter((x) => x !== cod) : [...s, cod]));

  /* ————— anexos ————— */
  /* Arquivo solto fora do lugar abria no navegador e tirava a pessoa da
     tela: na página toda o soltar é bloqueado, e vale só onde há anexos. */
  useEffect(() => {
    const bloquear = (e: DragEvent) => { if (e.dataTransfer?.types?.includes("Files")) e.preventDefault(); };
    /* a área de anexos já tratou o soltar (preventDefault do React, antes
       daqui); fora dela, o arquivo não entra e a tela diz onde soltar */
    const soltouFora = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      const tratado = e.defaultPrevented;
      e.preventDefault();
      if (!tratado) avisar("Para anexar, solte o arquivo na área de anexos, na etapa 1, ou use o + de Anexos.");
    };
    window.addEventListener("dragover", bloquear);
    window.addEventListener("drop", soltouFora);
    return () => { window.removeEventListener("dragover", bloquear); window.removeEventListener("drop", soltouFora); };
  }, []);
  const temArquivo = (e: ArrastoReact<HTMLElement>) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const zonaDeAnexos = {
    onDragOver: (e: ArrastoReact<HTMLElement>) => { if (!temArquivo(e)) return; e.preventDefault(); setArrastando(true); },
    onDragLeave: () => setArrastando(false),
    onDrop: (e: ArrastoReact<HTMLElement>) => {
      if (!temArquivo(e)) return;
      e.preventDefault();
      setArrastando(false);
      /* a pasta arrastada chega como arquivo de 0 byte; o item diz que é pasta
         (só dá para perguntar durante o soltar) */
      const pastas = new Set(Array.from(e.dataTransfer?.items ?? [])
        .filter((it) => it.kind === "file" && it.webkitGetAsEntry?.()?.isDirectory)
        .map((it) => it.getAsFile()?.name ?? "").filter(Boolean));
      somarAnexos(e.dataTransfer?.files, pastas);
    },
  };
  const somarAnexos = (lista: FileList | null | undefined, pastas?: Set<string>) => {
    if (!lista || !lista.length) return;
    /* Copia JÁ: a FileList do input é viva, e o `value = ""` logo depois a
       esvazia antes de o React rodar o atualizador. A simulação de 28/09/2026
       perdeu assim 154 de 166 anexos escolhidos pelo botão. */
    const todos = Array.from(lista);
    /* O que não vai subir é dito na hora, e não depois do pedido criado,
       embaixo do ✓ (o envio recusa arquivo vazio e acima do limite da rota,
       o MAX_ANEXO_MB de hub.tsx) */
    const fora: string[] = [];
    const novos = todos.filter((f) => {
      if (pastas?.has(f.name)) fora.push(`${f.name} é uma pasta (arraste os arquivos de dentro dela)`);
      else if (f.size === 0) fora.push(`${f.name} está vazio`);
      else if (f.size > LIMITE_ANEXO_MB * 1024 * 1024) fora.push(`${f.name} tem ${(f.size / 1048576).toFixed(1).replace(".", ",")} MB (o limite é ${LIMITE_ANEXO_MB} MB)`);
      else return true;
      return false;
    });
    if (novos.length) setAnexos((a) => [...a, ...novos]);
    if (fora.length) avisar(`Não entrou: ${fora.join("; ")}.`);
  };

  /* ————— o que falta, por etapa ————— */
  /* As cores: o que foi escrito no campo e os Pantones escolhidos. O Pantone
     escolhido que já está escrito no campo não conta duas vezes. Vai escrito
     como o hub escreve Pantone ("P 186 C"). */
  /* separadas pelos nomes: a vendedora quase nunca põe vírgula, e "Branco
     roxo" são duas cores (Augusto, 02/10/2026) */
  const nomesCores = separarCores(coresTexto);
  const soCodigo = (s: string) => s.trim().toLowerCase().replace(/^(pantone|p)\s+/, "");
  const pantExtras = pantSel.filter((c) => !nomesCores.some((n) => soCodigo(n) === c.toLowerCase()));
  const coresLista = [...nomesCores, ...pantExtras.map(prefixoPantone)];
  const nCoresListadas = coresLista.length;
  /* Não basta escrever qualquer coisa: o briefing precisa dizer o que o
     cliente pediu (pelo menos 5 palavras de duas letras ou mais; "asdasd"
     passava) e as cores, quantas e quais, com a conta batendo (Augusto,
     02/10/2026: "não basta preencher, também precisa colocar as informações
     que a tela está pedindo"). Anexo e acabamento continuam opcionais. */
  const palavrasBriefing = briefing.match(/[\p{L}\p{N}]{2,}/gu)?.length ?? 0;
  const faltas = useMemo(() => {
    /* `campo` é a chave (o marca-texto procura por ela); `texto`, quando há,
       é o que a pílula vermelha e o pé da capa dizem */
    const f: { etapa: number; campo: string; texto?: string }[] = [];
    /* medida é número maior que zero: "," sozinha passava como preenchida */
    const num = (v: string) => parseFloat(v.replace(",", "."));
    if (!nome.trim()) f.push({ etapa: 0, campo: "Nome do cliente" });
    if (!briefing.trim()) f.push({ etapa: 0, campo: "Briefing" });
    else if (palavrasBriefing < BRIEFING_MIN_PALAVRAS) f.push({ etapa: 0, campo: "Briefing", texto: `Briefing com pelo menos ${BRIEFING_MIN_PALAVRAS} palavras` });
    if (facaNova) {
      if (!(num(largFaca) > 0) || !(num(altFaca) > 0)) f.push({ etapa: 1, campo: "Medida da faca nova" });
      if (!formaFaca) f.push({ etapa: 1, campo: "Formato" });
    } else if (!facaCod) f.push({ etapa: 1, campo: "Faca" });
    /* a faca escolhida não está na lista, ou tem uma medida só e falta a
       altura: sem os dois lados o servidor recusa o pedido */
    else if (!faca) f.push({ etapa: 1, campo: "Faca" });
    else if (umLado && !(num(larguraExtra) > 0)) f.push({ etapa: 1, campo: "Largura da etiqueta" });
    if (!materia.trim()) f.push({ etapa: 1, campo: "Matéria-prima" });
    if (!(num(largura) > 0)) f.push({ etapa: 1, campo: "Largura" });
    if (!carreiras.trim()) f.push({ etapa: 1, campo: "Carreiras" });
    /* cores: o círculo (quantas) e o campo ou os Pantones (quais), batendo.
       Pantone escolhido conta como cor listada. */
    const qtd = Number(qtdCores) || 0;
    if (!qtd && !nCoresListadas) f.push({ etapa: 2, campo: "Cores" });
    else if (!qtd) f.push({ etapa: 2, campo: "Cores", texto: "Quantidade de cores" });
    else if (!nCoresListadas) f.push({ etapa: 2, campo: "Cores", texto: "Nome das cores ou Pantone" });
    else if (qtd !== nCoresListadas) {
      f.push({ etapa: 2, campo: "Cores", texto: `Cores (${qtd} ${qtd === 1 ? "marcada" : "marcadas"} e ${nCoresListadas} ${nCoresListadas === 1 ? "listada" : "listadas"})` });
    }
    return f;
  }, [nome, briefing, palavrasBriefing, facaCod, facaNova, faca, umLado, larguraExtra, largFaca, altFaca, formaFaca, materia, largura, carreiras, qtdCores, nCoresListadas]);
  /* O que falta NESTA etapa acende ou não o Próximo. Depois de tentar
     concluir, o título do campo que falta ganha o marca-texto (.np10-falta)
     na etapa dele (Augusto, 30/09/2026, UX do Novo pedido). Era letra
     vermelha e ficou ruim; a letra fica preta. */
  const faltasAqui = etapa !== null ? faltas.filter((f) => f.etapa === etapa) : [];
  const destacar = (...campos: string[]) => (tentouEnviar || (tentouSeguir !== null && tentouSeguir === etapa)) && faltas.some((f) => campos.includes(f.campo));
  const faltaCampo = (...campos: string[]) => faltas.some((f) => campos.includes(f.campo));
  /** o texto (título do campo), com o marca-texto quando um dos campos falta */
  const marcado = (texto: string, ...campos: string[]) => <span className={destacar(...campos) ? "np10-falta" : undefined}>{texto}</span>;
  const falta = <span className="np10-falta-valor">Falta</span>;

  /* com uma medida só, o número da faca é a altura (medidaEmLados o põe em
     "largura" por ser o primeiro) */
  const lados = umLado ? { largura: larguraExtra, altura: ladosFaca.largura } : ladosFaca;
  const acabEscolhidos = ACABAMENTOS.filter((a) => acab[a.nome]);

  /* Número de cores marcado e cores listadas que não batem: o card mostrava
     um número e a arte tinha outro. Desde 02/10/2026 trava o Próximo (veja
     `faltas`); este aviso, embaixo dos círculos, diz por quê. */
  const avisoCores = qtdCores && coresLista.length && Number(qtdCores) !== coresLista.length
    ? `${qtdCores === "1" ? "1 cor marcada" : `${qtdCores} cores marcadas`} e ${coresLista.length} ${coresLista.length === 1 ? "listada" : "listadas"}. Confira.`
    : "";
  /* Cor escrita errado ("preot"): a tela pergunta "Você quis dizer preto?" e
     troca com um clique (Augusto, 08/10/2026: "conseguimos avisar o usuário
     de erros de ortografia?"). Não é só grafia: as cores são separadas pelos
     nomes, e "Laranja preot rosa" contava duas cores. Uma palavra por vez, a
     primeira do campo; a conta está em lib/sugestao-de-cor.ts. */
  const sugestaoCor = useMemo(() => sugestoesDeCor(coresTexto)[0] ?? null, [coresTexto]);
  /* A faca e os porta-clichês (Augusto, 08/10/2026: "se uma máquina não tem
     um porta-clichê de tamanho x e gravamos o clichê para ela, não dá para
     rodar o pedido"): com o Z da faca (pastas "Facas por Z" da Relação) e as
     cores já ditas, onde roda; nenhuma máquina, no marca-texto. A conta é a
     de lib/porta-cliches.ts, a mesma da área dos porta-clichês em Facas. */
  const { data: zsFacas } = useQuery<{ zs: Record<string, { z: number }> }>({
    queryKey: ["facas-z"], queryFn: () => listZDasFacas() as Promise<{ zs: Record<string, { z: number }> }>, staleTime: 5 * 60_000,
  });
  const { data: portasCliche } = useQuery<PortaCliche[]>({
    queryKey: ["porta-cliches"], queryFn: () => listPortaCliches() as Promise<PortaCliche[]>, staleTime: 60_000,
  });
  const zDaFaca = !facaNova && faca ? zsFacas?.zs?.[chaveDoZ(faca.cod)]?.z ?? null : null;
  const avisoFaca = zDaFaca ? avisoDaFaca({ z: zDaFaca, cores: Number(qtdCores) || coresLista.length, verniz: !!acab["Verniz"] }, portasCliche ?? []) : null;
  const trocarCor = (sug: SugestaoDeCor, opcao: string) => {
    setCoresTexto(trocarPalavra(coresTexto, sug, opcao));
    /* o foco volta ao campo, com o cursor logo depois da palavra trocada */
    requestAnimationFrame(() => {
      const el = coresRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(sug.inicio + opcao.length, sug.inicio + opcao.length);
    });
  };

  const enviar = () => {
    /* ref e não estado: dois cliques no mesmo instante criavam dois pedidos */
    if (enviando || emVooRef.current) return;
    /* A trava só liga DEPOIS das recusas. Ligada antes, quem clicasse com
       campo faltando deixava o botão morto para sempre — não há `finally`
       nesses dois caminhos, porque eles nem chegam a enviar. */
    if (faltas.length) {
      setEtapa(faltas[0].etapa);
      setTentouEnviar(true);
      return;
    }
    if (!aoCriar) { avisar("Você não tem permissão para criar pedidos."); return; }
    emVooRef.current = true;
    setErro("");
    setEnviando(true);
    /* sai já; se o envio falhar, o efeito do rascunho grava de novo. Se a tela
       já tiver saído (o menu do topo), quem grava de novo é o próprio envio,
       com esta cópia: o rascunho é da aba, não da tela */
    const rascunhoDoEnvio = JSON.stringify({ ...formulario(), veioDoSalvo: usouSalvoRef.current, dono: profile.id });
    try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ }

    /* Laminação não tem coluna: vai no briefing para o designer ver. */
    const semColuna = acabEscolhidos.filter((a) => !a.campo).map((a) => a.nome);
    const descricao = [briefing.trim(), semColuna.length ? `Acabamento: ${semColuna.join(", ")}.` : ""]
      .filter(Boolean).join("\n");
    const ligado = (campo: string) => (acabEscolhidos.some((a) => a.campo === campo) ? "1" : "0");
    /* faca nova: a medida e o formato digitados; senão, os da faca */
    const medidaEtiqueta = facaNova ? { largura: largFaca, altura: altFaca } : lados;

    Promise.resolve(aoCriar({
      cliente: nome.trim(),
      medida: facaNova ? `${largFaca}×${altFaca}` : faca ? (umLado ? `${lados.largura}×${lados.altura}` : medidaBonita(faca.medida)) : "",
      substrato: materia,
      cores: coresLista,
      obs: descricao,
      origem: "Vendas",
      arquivos: anexos,
      facaCod: facaNova ? "" : facaCod,
      facaNova,
      urgente,
      detalhes: {
        materia,
        /* "Largura" da etapa 2 é a da BOBINA; a da etiqueta sai da faca */
        largMateria: largura,
        largura: medidaEtiqueta.largura,
        altura: medidaEtiqueta.altura,
        forma: facaNova ? formaFaca : faca ? formaDoSistema(faca.sistema, lados.largura, lados.altura) : "",
        cores: qtdCores || String(coresLista.length || 1),
        coresDesc: coresLista.join(", "),
        carreiras,
        descricao,
        linkRef: "",
        picote: ligado("picote"),
        tarjaVerso: ligado("tarjaVerso"),
        coldStamp: ligado("coldStamp"),
        verniz: ligado("verniz"),
      },
    }))
      .then(async (r) => {
        /* o rascunho sai já: ele é deste pedido, que foi */
        try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ }
        /* o salvo também: se ficasse, voltaria como "pedido salvo" e podia
           ser mandado de novo. Sai antes da caixa "Pedido enviado", e a falha
           vai dentro dela (atrás da caixa, o aviso não se lia). */
        let avisoDoSalvo = "";
        if (usouSalvoRef.current && aoSalvar) {
          marcarSalvo(false);
          try { await aoSalvar(null); } catch {
            avisoDoSalvo = "O pedido foi enviado, mas a cópia salva continuou no hub. Se ela aparecer ao abrir a Solicitação, escolha Começar do zero.";
          }
        }
        const avisoDoEnvio = [r?.aviso, avisoDoSalvo].filter(Boolean).join(" ");
        if (!vivoRef.current) {
          /* a tela saiu no meio do envio: o anexo que não subiu não pode se
             perder com ela (o pedido apareceria sem ele, sem ninguém saber) */
          aoAvisoFora?.(`Pedido ${r?.num ?? ""} enviado para a fila do design.${avisoDoEnvio ? ` ${avisoDoEnvio}` : ""}`);
          return;
        }
        setEnviado({ num: r?.num ?? "", aviso: avisoDoEnvio || undefined, id: r?.id });
        setEtapa(null);
        setTentouEnviar(false);
      })
      .catch((e: unknown) => {
        if (vivoRef.current) { setErro(erroLegivel(e, "Não deu para enviar o pedido.")); return; }
        try { sessionStorage.setItem(CHAVE_RASCUNHO, rascunhoDoEnvio); } catch { /* sem armazenamento */ }
        aoAvisoFora?.(`O pedido não foi enviado: ${erroLegivel(e, "erro ao enviar")}. O que foi preenchido continua na Solicitação.`);
      })
      .finally(() => { emVooRef.current = false; if (vivoRef.current) setEnviando(false); });
  };

  /* No meio do "Enviando…" a tela não sai: o menu e o Sair esperam, e fechar
     a aba pergunta antes. Saindo, o anexo que não subisse ou o pedido que não
     fosse se perdiam com a tela, sem ninguém saber (revisão de 02/10/2026). */
  const ESPERE_O_ENVIO = "Espere o envio terminar. O pedido está subindo para o hub.";
  const navegarSeLivre = (label: string) => { if (emVooRef.current) { avisar(ESPERE_O_ENVIO); return; } aoNavegar(label); };
  const sairSeLivre = () => { if (emVooRef.current) { avisar(ESPERE_O_ENVIO); return; } onLogout(); };
  useEffect(() => {
    if (!enviando) return;
    const segurar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [enviando]);

  const recomeçar = () => {
    setNome(""); setBriefing(""); setAnexos([]);
    setFacaCod(""); setBuscaFaca(""); setMateria(""); setLargura(""); setCarreiras("");
    setQtdCores(""); setCoresTexto(""); setPantSel([]); setAcab({}); setBuscaPant(""); setPantPop(null);
    setFacaNova(false); setLargFaca(""); setAltFaca(""); setMedidaNova(""); setFormaFaca(""); setUrgente(false);
    setLarguraExtra(""); setNovoSubAberto(false); setNovoSubTexto(""); setMateriaAntes("");
    setErro(""); setEnviado(null); setEtapa(null); setTentouEnviar(false); setTentouSeguir(null);
    /* o formulário deixa de ser o salvo: enviar outro pedido depois não
       apaga o que ficou salvo no servidor */
    marcarSalvo(false);
    try { sessionStorage.removeItem(CHAVE_RASCUNHO); } catch { /* sem armazenamento */ }
  };

  /* ————— Histórico: as solicitações anteriores da vendedora —————
     "Mostra as solicitações anteriores da vendedora e dá a opção de copiar"
     (Augusto, 01/10/2026). A lista é a que o hub já carregou; o "Copiar"
     busca o pedido inteiro (o briefing, as carreiras e os acabamentos não
     vêm na lista) e preenche o formulário. Arquivo não vem junto. */
  const minhas = useMemo(() => pedidos.filter((p) => p.id && p.vendedor_id === profile.id), [pedidos, profile.id]);
  const historico = useMemo(() => {
    const casa = criarBusca(buscaHist);
    return minhas.filter((p) => casa(String(p.cliente ?? ""), String(p.numero ?? ""), String(p.materia ?? ""))).slice(0, 60);
  }, [minhas, buscaHist]);
  const pedirCopia = (p: PedidoDaLista) => { if (vazio) void copiar(p); else setCopiarDe(p); };
  const copiar = async (p: PedidoDaLista) => {
    setCopiarDe(null);
    if (!p.id || !aoCarregarPedido) return;
    setCopiando(p.id);
    try {
      const r = await aoCarregarPedido(p.id);
      if (!vivoRef.current) return;
      const d = r.pedido ?? {};
      const txt = (k: string) => (d[k] == null ? "" : String(d[k]));
      /* as laminações (sem coluna) foram no fim do briefing: voltam a ser
         acabamento e saem do texto */
      const desc = txt("descricao");
      const m = desc.match(/(?:^|\n)Acabamento: ([^\n]*?)\.?\s*$/);
      const itens = m ? m[1].split(",").map((s) => s.trim()) : [];
      /* é a linha que o hub escreve só se todos os itens forem laminação;
         "Acabamento: verniz no logo" escrito no briefing fica no texto */
      const nomesLaminacao = ACABAMENTOS.filter((a) => !a.campo).map((a) => a.nome);
      const daLinhaDoHub = itens.length > 0 && itens.every((x) => nomesLaminacao.includes(x));
      const laminacoes = daLinhaDoHub ? itens : [];
      const ac: Record<string, boolean> = {};
      for (const a of ACABAMENTOS) {
        const col = a.campo === "tarjaVerso" ? "tarja_verso" : a.campo === "coldStamp" ? "cold_stamp" : a.campo;
        if (col ? Number(d[col]) === 1 : laminacoes.includes(a.nome)) ac[a.nome] = true;
      }
      recomeçar();
      setNome(txt("cliente"));
      setBriefing(m && daLinhaDoHub ? desc.slice(0, m.index).trimEnd() : desc);
      const nova = Number(d.faca_nova) === 1;
      setFacaNova(nova);
      if (nova) {
        setLargFaca(txt("largura")); setAltFaca(txt("altura")); setFormaFaca(txt("forma"));
        setMedidaNova(txt("largura") && txt("altura") ? `${txt("largura")}x${txt("altura")}` : txt("largura"));
      } else {
        setFacaCod(txt("faca_cod"));
        /* faca de uma medida só: a largura da etiqueta foi digitada */
        setLarguraExtra(txt("largura"));
      }
      setMateria(txt("materia")); setLargura(txt("larg_materia")); setCarreiras(txt("carreiras"));
      /* as cores da arte, quando a prova foi lida: repetir o pedido é
         imprimir a mesma etiqueta (as pedidas podem ter mudado na arte) */
      const daArte = separarCores(txt("cores_arte"));
      setQtdCores(daArte.length ? String(daArte.length) : txt("cores")); setCoresTexto(daArte.length ? txt("cores_arte") : txt("cores_desc"));
      setAcab(ac);
      setHistoricoAberto(false);
      const n = p.numero != null ? numeroPedido(p.numero) : "anterior";
      avisar(`Copiado do pedido ${n}. ${r.anexos?.length ? "Os anexos não vêm junto. " : ""}Confira cada etapa antes de concluir.`, "ok");
    } catch (e: unknown) {
      if (vivoRef.current) avisar(erroLegivel(e, "Não deu para copiar esse pedido."));
    } finally {
      if (vivoRef.current) setCopiando(null);
    }
  };

  const lista = (fs: { campo: string; texto?: string }[]) => fs.map((f) => f.texto ?? f.campo).join(", ");
  /* na etapa em que a pessoa tentou seguir, só o que falta nela; some
     sozinho quando ela preenche */
  const faltaParaSeguir = tentouSeguir !== null && tentouSeguir === etapa && faltasAqui.length ? `Para seguir, preencha: ${lista(faltasAqui)}.` : "";
  /* o "Para seguir" do Próximo vem antes da lista do Concluir barrado, que
     fica até tudo ser preenchido: vale a mensagem da ação mais recente */
  const erroNaTela = erro || faltaParaSeguir || (tentouEnviar && faltas.length ? `Faltam campos obrigatórios: ${lista(faltas)}.` : "");
  /** Abre a etapa i pela capa. Começa por qualquer uma (Augusto, 02/10/2026:
      "uma vez na página solicitação o usuário pode começar por qual ele
      quiser clicar"); a trava é a do Próximo, que só avança com a etapa
      completa, e a do Concluir, que só envia com tudo preenchido. */
  const abrirEtapa = (i: number) => {
    setErro("");
    setTentouSeguir(null);
    setEtapa(i);
  };
  /* as duas linhas da capa (eram as da faixa preta): o pedido e o que falta */
  const linhaPedido = nome.trim() ? `Pedido de ${nome.trim()}${urgente ? " · urgente" : ""}` : "Comece pelo nome do cliente e o briefing.";
  const linhaFalta = !faltas.length
    ? (avisoCores ? `Tudo preenchido. ${avisoCores}` : "Tudo preenchido. Abra a revisão para conferir e concluir.")
    : `Falta: ${lista(faltas)}.`;
  /* o Próximo acende quando a etapa está pronta, e o Concluir quando tudo
     está: a ação certa se destaca sem mudar o desenho (a preocupação dele,
     30/09: "o usuário menos atento pode não perceber o concluir"). Acende no
     amarelo padrão do hub, #fff079, como tudo que fica aceso nesta tela (ele,
     02/10/2026; o #FFE815 é só do "+") */
  const prontoParaSeguir = etapa !== null && (etapa < 3 ? !faltasAqui.length : !faltas.length);

  /* o pé da capa: as pílulas depois do título (44 de ar, 29 entre elas, nunca
     antes da c6) e o texto da direita até 44 depois da última */
  const xSalvar = Math.max(480 - V4.pilulaBorda / 2, Math.ceil(fimDoTitulo + AR_DO_PE));
  const xHistorico = xSalvar + PE.salvar.w + VAO_DO_PE;
  const xComecar = xHistorico + PE.historico.w + VAO_DO_PE;
  const larguraStatusCapa = Math.min(700, 1840 - (xComecar + PE.comecar.w + AR_DO_PE));

  /* ————— peças da tela ————— */
  /** Os anexos: título, o "+" que escolhe arquivos e as pílulas (2 colunas).
      Com `area` (a etapa 1), as pílulas ficam numa área pontilhada de soltar
      arquivos, que também abre a escolha no clique (Augusto, 02/10/2026:
      "uma área para o usuário arrastar o anexo"). */
  const blocoAnexos = (x: number, base: number, chipsX: number, chipsTopo: number, linhas: number, area?: { largura: number; altura: number }) => (
    <>
      <div style={frEm("Anexos", 32, x, base)}>Anexos</div>
      <label title="Escolher arquivos. Os anexos ficam no pedido; a pasta do cliente o designer escolhe ao iniciar a criação." className="np4-opcao"
        style={{ position: "absolute", left: x + 124, top: base - 20.08, width: 20.46, height: 20.46, cursor: "pointer", color: PRETO, zIndex: 3 }}>
        <input ref={entradaAnexosRef} type="file" multiple aria-label="Adicionar anexos" onChange={(e) => { somarAnexos(e.target.files); e.target.value = ""; }} className="h10-so-leitor" />
        <MaisV4 />
      </label>
      {area && (
        <div {...zonaDeAnexos} role="button" tabIndex={0} aria-label="Área de anexos: arraste os arquivos aqui ou clique para escolher"
          onClick={(e) => { if ((e.target as HTMLElement).closest(".np4-chip")) return; entradaAnexosRef.current?.click(); }}
          onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); entradaAnexosRef.current?.click(); } }}
          className="np4-rolagem"
          style={{ position: "absolute", left: chipsX, top: chipsTopo - 7, width: area.largura, height: area.altura, boxSizing: "border-box", padding: anexos.length ? 8 : 0,
            border: "1.5px dashed #b9b6b7", borderRadius: 14, background: "transparent", cursor: "pointer", overflowY: "auto", zIndex: 3 }}>
          {anexos.length === 0 ? (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center", fontFamily: INTER, fontSize: 16, lineHeight: 1.35, color: CINZA, pointerEvents: "none" }}>
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 16V4" /><polyline points="7 9 12 4 17 9" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
              <span>Arraste os arquivos aqui<br />ou clique para escolher</span>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "151.11px 151.11px", columnGap: 7, rowGap: 6.35, alignContent: "start" }}>
              {anexos.map((a, i) => (
                <div key={`${a.name}-${i}`} className="np4-chip" title={a.name} style={CHIP_ANEXO_V4}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); setAnexos((lst) => lst.filter((_, k) => k !== i)); }} aria-label={`Tirar ${a.name}`} title="Tirar o anexo" className="np4-chip-x"
                    style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, display: "grid", placeItems: "center", borderRadius: 999, border: "none", background: FUNDO_PAGINA, cursor: "pointer", padding: 0 }}>
                    <XisPequeno tamanho={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!area && anexos.length > 0 && (
        <div className="np4-rolagem" {...zonaDeAnexos} style={{ position: "absolute", left: chipsX, top: chipsTopo, width: 2 * 151.11 + 7 + 10, maxHeight: linhas * 33.4 + (linhas - 1) * 6.35,
          overflowY: "auto", display: "grid", gridTemplateColumns: "151.11px 151.11px", columnGap: 7, rowGap: 6.35, alignContent: "start", zIndex: 3 }}>
          {anexos.map((a, i) => (
            <div key={`${a.name}-${i}`} className="np4-chip" title={a.name} style={CHIP_ANEXO_V4}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</span>
              <button onClick={() => setAnexos((lst) => lst.filter((_, k) => k !== i))} aria-label={`Remover ${a.name}`} className="np4-chip-x"
                style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, display: "grid", placeItems: "center", borderRadius: 999, border: "none", background: FUNDO_PAGINA, cursor: "pointer", padding: 0 }}>
                <XisPequeno tamanho={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  /** A área do desenho da faca (etapas 2 e 4): a faca escolhida, ou o vazio. */
  const areaDoDesenho = (x: number, y: number, w: number, h: number) => (
    <div style={{ position: "absolute", left: x, top: y, width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
      {facaNova ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: CLARO, textAlign: "center" }}>
          <span style={{ ...FR, fontSize: 44, letterSpacing: "-.02em", color: largFaca && altFaca ? PRETO : CLARO }}>{largFaca && altFaca ? `${largFaca}×${altFaca}` : "?"}</span>
          <span style={{ fontFamily: INTER, fontSize: 17 }}>Faca nova: ainda sem desenho</span>
        </div>
      ) : desenho ? (
        <img onClick={() => setPdfAmpliado(true)} src={desenho} alt={`Desenho ${facaCod}`} title="Ampliar" style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in" }} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: CLARO, textAlign: "center" }}>
          <svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h10M7 13h6" /></svg>
          <span style={{ fontFamily: INTER, fontSize: 17 }}>{facaCod ? (arquivoFaca && !desenhoFalhou ? "Abrindo o desenho…" : "Sem desenho no acervo para esta faca") : "Escolha uma faca ao lado"}</span>
        </div>
      )}
    </div>
  );

  /** Pílula de escolha (facas e formatos da etapa 2): acesa no amarelo do hub. */
  const pilulaEscolha = (chave: string, texto: string, ligada: boolean, aoEscolher: () => void, dica?: string) => (
    <button key={chave} onClick={aoEscolher} title={dica} aria-pressed={ligada} className="np4-pilula"
      style={{ boxSizing: "border-box", height: V4.pilulaAlt, border: `${V4.pilulaBorda}px solid ${PRETO}`, borderRadius: 999, background: ligada ? AMARELO : undefined,
        display: "flex", alignItems: "center", justifyContent: "center", padding: "0 14px", fontFamily: INTER, fontSize: 20.5, fontWeight: 500, letterSpacing: "-.02em", color: PRETO, whiteSpace: "nowrap", overflow: "hidden", cursor: "pointer" }}>
      <span style={{ ...TEXTO_PILULA, overflow: "hidden", textOverflow: "ellipsis" }}>{texto}</span>
    </button>
  );

  /** A caixa de Pantone: busca na tabela ou as cores mais usadas nos pedidos. */
  const caixaPantone = (x: number) => (
    <div data-pop role="dialog" aria-label={pantPop === "paleta" ? "Paleta Pantone" : "Cores de outros clientes"} style={{ ...CAIXA_POP_V4, left: x, top: 32 * LG + 22, width: 360 }}>
      {pantPop === "paleta" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 10, height: 42, padding: "0 12px", border: `1px solid ${PRETO}`, borderRadius: 10, marginBottom: 4 }}>
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input autoFocus value={buscaPant} onChange={(e) => setBuscaPant(e.target.value)} placeholder="Buscar Pantone (ex.: 021)" aria-label="Buscar Pantone"
            style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: INTER, fontSize: 16, color: PRETO }} />
        </label>
      ) : (
        <div style={{ padding: "6px 8px 8px", fontFamily: INTER, fontSize: 13, fontWeight: 600, color: CINZA }}>
          {coresAprovadas === null ? "Carregando as cores aprovadas…" : usadosSaoDosPedidos ? "As mais usadas nas artes aprovadas do hub" : "Sugestões: nenhuma arte aprovada usou Pantone ainda"}
        </div>
      )}
      <div className="np4-rolagem" style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 300, overflowY: "auto" }}>
        {pantResultados.map((p) => (
          <button key={p.c} onClick={() => alternarPant(p.c)} title={p.c} aria-pressed={pantSel.includes(p.c)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", border: "none", borderRadius: 8, background: pantSel.includes(p.c) ? "#f4f4f2" : "transparent", cursor: "pointer", textAlign: "left" }}>
            <span style={{ flex: "none", width: 24, height: 24, borderRadius: 7, background: p.h, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.14)" }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
              <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 700, color: PRETO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.c}</span>
              <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: CLARO }}>{p.h}</span>
            </span>
            {pantSel.includes(p.c) && <svg width={16} height={16} style={{ flex: "none" }} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>}
          </button>
        ))}
        {!pantResultados.length && <div style={{ padding: "10px 12px", fontFamily: INTER, fontSize: 14, color: CLARO }}>Nenhum Pantone encontrado</div>}
      </div>
      <button onClick={() => abrirEmOutraAba("pantone10")} className="np4-opcao" title="Abre a tabela em outra aba"
        style={{ ...BOTAO_LIMPO, display: "flex", alignItems: "center", gap: 6, padding: "10px 8px 4px", fontFamily: INTER, fontSize: 14, fontWeight: 600, color: CINZA }}>
        Abrir a tabela inteira<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
      </button>
    </div>
  );

  /* a medida e a faca, para a revisão */
  const medidaRevisao = facaNova ? (largFaca && altFaca ? `${largFaca}×${altFaca}` : "")
    : faca ? (umLado ? (lados.largura ? `${lados.largura}×${lados.altura}` : "") : medidaBonita(faca.medida)) : "";
  const facaRevisao = facaNova ? `Faca nova${formaFaca ? ` · ${formaFaca}` : ""}` : facaCod;

  return (
    <PalcoFixo>
      {/* a página toda no cinza do rework, da barra ao pé (sem a faixa preta) */}
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />

      {/* ————— capa: os quatro cartões ————— */}
      {etapa === null && (
        <>
          <div style={{ position: "absolute", left: 80, top: V4.topo, width: 1760, height: V4.alturaCartao, display: "flex", zIndex: 2 }}>
            {PASSOS.map((p, i) => {
              const texto = p.cartao ?? p.sub;
              const ilu = ILU_V4[i];
              return (
                <button key={p.etapa} onClick={() => abrirEtapa(i)} className="np4-cartao"
                  style={{ position: "relative", flex: `0 0 ${V4.cartao}px`, height: V4.alturaCartao, padding: 0, border: "none", borderRadius: V4.raio,
                    /* o degradê padrão do hub (Augusto, 02/10/2026: "o degradê nos cards em solicitação você não colocou") */
                    background: clarear(AMARELO, i * 0.12),
                    boxShadow: V4.sombra, zIndex: i + 1, cursor: "pointer", color: PRETO, textAlign: "left", font: "inherit" }}>
                  {/* etapa completa ganha o ✓ ao lado do nome: a capa mostra o que já foi feito */}
                  <span style={{ position: "absolute", left: CARTAO_V4.rotuloX - folgaIN(400, 24, "E"), top: CARTAO_V4.rotuloBase - baseInter(24, 24),
                    display: "flex", alignItems: "center", gap: 10, fontFamily: INTER, fontSize: 24, lineHeight: "24px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>
                    {p.etapa}
                    {i < 3 && !faltas.some((f) => f.etapa === i) && <ConfereV4 rotulo="Etapa completa" />}
                  </span>
                  <span style={{ position: "absolute", left: CARTAO_V4.tituloX, top: CARTAO_V4.tituloBase - baseFraunces(70, 60), ...FR, fontSize: 70, lineHeight: "60px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>
                    {p.t1}<br />{p.t2}
                  </span>
                  <img src={ilu.src} alt="" draggable={false} style={{ position: "absolute", left: ilu.x, top: ilu.y, width: ilu.w, height: ilu.h, pointerEvents: "none" }} />
                  <span style={{ position: "absolute", left: CARTAO_V4.descX - folgaIN(400, 24, texto.charAt(0)), top: CARTAO_V4.descBase - baseInter(24, 29), width: CARTAO_V4.descLargura,
                    fontFamily: INTER, fontSize: 24, lineHeight: "29px", letterSpacing: "-.035em" }}>{texto}</span>
                </button>
              );
            })}
          </div>

          <div ref={tituloCapaRef} style={tituloDoPe("Solicitação")}>Solicitação</div>
          {/* Salvar, Histórico e Começar do zero (Augusto, 01/10/2026): "o
              salvar salva o que já foi preenchido e o histórico mostra as
              solicitações anteriores da vendedora e dá a opção de copiar"; "o
              sair precisa mudar para começar do zero" (para sair, o menu do
              topo; o que foi preenchido fica nesta aba) */}
          <button onClick={() => void salvar()} disabled={salvando} className="np4-pilula"
            style={{ ...PILULA_V4, left: xSalvar, width: PE.salvar.w, justifyContent: "center", cursor: salvando ? "wait" : "pointer", opacity: salvando ? 0.6 : 1 }}>
            <span style={TEXTO_PILULA}>{salvando ? "Salvando…" : "Salvar"}</span>
          </button>
          <div data-pop style={{ position: "absolute", left: xHistorico, top: TOPO_PILULA, width: PE.historico.w, height: V4.pilulaAlt, zIndex: 31 }}>
            <button onClick={() => setHistoricoAberto((v) => !v)} aria-haspopup="dialog" aria-expanded={historicoAberto} className="np4-pilula"
              style={{ ...PILULA_V4, position: "relative", top: 0, width: "100%", justifyContent: "space-between", paddingLeft: 24.285 - V4.pilulaBorda - folgaIN(500, 20.5, "H"), paddingRight: 27.94 - V4.pilulaBorda,
                background: historicoAberto ? AMARELO : undefined }}>
              <span style={TEXTO_PILULA}>Histórico</span>
              <svg width={14} height={9} viewBox="0 0 14 9" aria-hidden style={{ display: "block", transform: historicoAberto ? "rotate(180deg)" : undefined }}><polyline points="1.5 7.5 7 2 12.5 7.5" fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            {historicoAberto && (
              <div role="dialog" aria-label="Suas solicitações" style={{ ...CAIXA_POP_V4, left: 0, bottom: "calc(100% + 16px)", width: 640, padding: 0, gap: 0, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 18px 12px", borderBottom: "1px solid rgba(0,0,0,.1)" }}>
                  <span style={{ ...FR, fontSize: 26, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>Suas solicitações</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, width: 260, height: 38, padding: "0 12px", border: `1px solid ${PRETO}`, borderRadius: 999 }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input autoFocus value={buscaHist} onChange={(e) => setBuscaHist(e.target.value)} placeholder="Cliente ou número" aria-label="Buscar nas solicitações"
                      style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: INTER, fontSize: 15, color: PRETO }} />
                  </label>
                </div>
                <div className="np4-rolagem" style={{ maxHeight: 520, overflowY: "auto", padding: "6px 8px 8px" }}>
                  {historico.map((p) => {
                    const medida = p.largura && p.altura ? medidaBonita(`${p.largura}x${p.altura}`) : "";
                    const data = p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 10px", borderRadius: 10 }} className="np4-linha">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: INTER, fontSize: 13, color: CINZA }}>{[p.numero != null ? numeroPedido(p.numero) : "", data].filter(Boolean).join(" · ")}</div>
                          <div style={{ fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100", fontWeight: 700, fontSize: 21, letterSpacing: "-.03em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.cliente || "Sem nome"}</div>
                          <div style={{ fontFamily: INTER, fontSize: 14, color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[medida, p.materia, coresEfetivas(p)].filter(Boolean).join(" · ")}</div>
                        </div>
                        <button onClick={() => pedirCopia(p)} disabled={!!copiando} className="np4-pilula"
                          aria-label={`Copiar o pedido ${p.numero != null ? numeroPedido(p.numero) : ""} de ${p.cliente || "sem nome"}`}
                          style={{ flex: "none", height: 36, padding: "0 18px", boxSizing: "border-box", border: `2px solid ${PRETO}`, borderRadius: 999, fontFamily: INTER, fontSize: 16, color: PRETO, cursor: copiando ? "wait" : "pointer" }}>
                          {copiando === p.id ? "Copiando…" : "Copiar"}
                        </button>
                      </div>
                    );
                  })}
                  {!historico.length && (
                    <div style={{ padding: "18px 10px", fontFamily: INTER, fontSize: 15, color: CINZA }}>
                      {!pedidosProntos ? "Carregando suas solicitações…"
                        : minhas.length ? "Nenhuma solicitação com esse nome ou número. Confira a grafia ou apague a busca."
                          : "Você ainda não tem solicitações. Os pedidos que você mandar aparecem aqui."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button onClick={() => { if (vazio) { avisar("O formulário já está em branco.", "ok"); return; } setConfirmarApagar(true); }} className="np4-pilula"
            style={{ ...PILULA_V4, left: xComecar, width: PE.comecar.w, justifyContent: "center" }}>
            <span style={TEXTO_PILULA}>Começar do zero</span>
          </button>
          {/* as duas linhas da antiga faixa, à direita do pé: termina na c23 */}
          <div style={{ position: "absolute", right: 80 - folgaDireitaInter(500, 21, "."), top: V4.basePe - 3.26 - 28 - baseInter(21, 28), width: larguraStatusCapa,
            textAlign: "right", fontFamily: INTER, fontSize: 21, fontWeight: 500, lineHeight: "28px", letterSpacing: "-.028em", color: PRETO, zIndex: 3 }}>
            <div title={linhaPedido} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{caberNoStatus(linhaPedido, larguraStatusCapa)}</div>
            <div title={linhaFalta} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {faltas.length ? faltaNoStatus(faltas.map((x) => x.texto ?? x.campo), larguraStatusCapa) : caberNoStatus(linhaFalta, larguraStatusCapa)}
            </div>
          </div>
        </>
      )}

      {/* ————— etapa aberta: dois painéis, o número, o título e as pílulas ————— */}
      {etapa !== null && (
        <>
          <div style={{ ...PAINEL_V4, left: 80, width: 1240 }} />
          <div style={{ ...PAINEL_V4, left: 1360, width: 480 }} {...(etapa === 0 ? zonaDeAnexos : {})} />

          {/* ——— etapa 1: briefing e anexos ——— */}
          {etapa === 0 && (
            <>
              {/* o piso é o da revisão: no de 52 (a metade), nome de mais de uns 95
                  caracteres ia para a 3ª linha, que some (simulação 6, 07/10/2026) */}
              <CampoGrande valor={nome} aoMudar={setNome} dica="Nome do cliente" corpo={104} ls={-0.02} x={160} base={V4.baseCampo} largura={1120} linhas={2} minimo={28}
                rotulo="Nome do cliente" falta={destacar("Nome do cliente")} autoFocus={!nome.trim()} />
              <div style={frEm("Boas práticas na solicitação", 24, 160, 588.66)}>Boas práticas na solicitação</div>
              <div style={{ ...interEm("D", 18, 160, 620.3, 30), width: 560, letterSpacing: "-.035em" }}>
                Detalhe o que o cliente pediu de forma clara e organizada. Textos que devem aparecer na arte (nomes, ingredientes, validade, peso, CNPJ, etc.), referências visuais do que o cliente gostou e o que ele NÃO quer. Evite frases vagas como “arte bonita” ou “algo diferente”. Quanto mais completo o pedido, mais rápido e fiel será o resultado, evitando retrabalhos.
              </div>
              <div style={frEm("Exemplo", 24, 800, 588.66)}>Exemplo</div>
              <div style={{ ...interEm("R", 18, 800, 620.3, 30), width: 480, letterSpacing: "-.035em" }}>
                Rótulo para pote de geleia artesanal. Textos: “Geleia Artesanal de Morango”, Ingredientes, Validade: 12 meses, Peso: 250g e logo. Referência: o cliente gostou do rótulo da Cacau Show, fundo claro, letra elegante e simples, e um desenho de fruta no cantinho. O cliente NÃO quer: cores escuras ou letra difícil de ler.
              </div>

              <div style={frEm("Detalhe o que o cliente pediu:", 32, V4.direita, 14 * LG)}>{marcado("Detalhe o que o cliente pediu:", "Briefing")}</div>
              <textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} aria-label="Briefing" className="np4-texto" {...zonaDeAnexos}
                placeholder="Rótulo para pote de geleia artesanal. Textos: “Geleia Artesanal de Morango”, Ingredientes, Validade: 12 meses, Peso: 250g e logo da marca. Referência: o cliente gostou do rótulo da Cacau Show, fundo claro, letra elegante e simples, e um desenho pequeno de fruta no cantinho. O cliente NÃO quer: cores escuras ou letra difícil de ler."
                style={{ position: "absolute", left: V4.direita - folgaIN(400, 20, "R"), top: 18 * LG - baseInter(20, 32), width: 382, height: 320, boxSizing: "border-box", padding: 0,
                  border: "none", outline: "none", resize: "none", background: "transparent", fontFamily: INTER, fontSize: 20, lineHeight: "32px", letterSpacing: "-.034em", color: PRETO, zIndex: 3 }} />
              {/* a área de soltar: da coluna do briefing até a borda dele, e 16 acima do pé do painel */}
              {blocoAnexos(V4.direita, 42 * LG, 1406.085, 699.495, 3, { largura: 1790 - 1406, altura: V4.pePainel - 16 - (699.495 - 7) })}
              {arrastando && (
                <div aria-hidden style={{ position: "absolute", left: 1372, top: V4.topo + 12, width: 456, height: V4.pePainel - V4.topo - 24, border: `2px dashed ${PRETO}`, borderRadius: 14, background: "rgba(255,232,21,.18)", pointerEvents: "none", zIndex: 4,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {/* a pílula acesa do hub, para ler por cima do exemplo do briefing */}
                  <span style={{ ...PILULA_V4, position: "static", padding: "0 26px", background: AMARELO, cursor: "default", boxShadow: "0 6px 22px rgba(0,0,0,.14)" }}>
                    <span style={TEXTO_PILULA}>Solte para anexar</span>
                  </span>
                </div>
              )}
            </>
          )}

          {/* ——— etapa 2: medidas e substrato ——— */}
          {etapa === 1 && (
            <>
              {/* o campo grande busca a faca (código ou medida); com "Faca nova",
                  é a medida dela, digitada como 60x40 */}
              <CampoGrande valor={facaNova ? medidaNova : buscaFaca} dica="60x40" corpo={104} ls={0.06} x={160} base={V4.baseCampo} largura={540}
                aoMudar={facaNova
                  ? (v) => { setMedidaNova(v); const m = partirMedida(v); setLargFaca(m.largura); setAltFaca(m.altura); }
                  : setBuscaFaca}
                rotulo={facaNova ? "Medida da faca nova (largura x altura)" : "Buscar faca por código ou medida"}
                falta={destacar(facaNova ? "Medida da faca nova" : "Faca")} autoFocus={!facaCod && !facaNova} />
              {facaNova && (
                <div style={{ ...interEm("D", 18, 160, 360, 24), width: 540, letterSpacing: "-.02em", color: CINZA }}>
                  Digite a medida da etiqueta e escolha o {marcado("formato", "Formato")} abaixo.
                </div>
              )}
              {/* as pílulas: as facas que casam com a busca (ou os formatos da
                  faca nova), duas colunas de c2 a c8, quatro linhas à vista */}
              <div className="np4-rolagem" style={{ position: "absolute", left: 160 - V4.pilulaBorda / 2, top: 25 * LG - V4.pilulaBorda / 2, width: 2 * 211.23 + 59.75 + 12, maxHeight: 4 * 54.81 - 10.77,
                overflowY: "auto", display: "grid", gridTemplateColumns: "211.23px 211.23px", columnGap: 59.75, rowGap: 10.77, alignContent: "start", zIndex: 3 }}>
                {facaNova
                  ? FORMAS_FACA_NOVA.map((f) => pilulaEscolha(f, f, formaFaca === f, () => setFormaFaca(f)))
                  : facasFiltradas.map((f) => pilulaEscolha(f.cod, medidaBonita(f.medida), f.cod === facaCod,
                    () => { if (f.cod !== facaCod) setLarguraExtra(""); setFacaCod(f.cod); }, f.cod))}
              </div>
              {!facaNova && buscaCompleta && !facasFiltradas.length && (
                <div style={{ ...interEm("N", 18, 160, 425, 24), width: 480, letterSpacing: "-.02em", color: CINZA }}>Nenhuma faca encontrada. Se a medida não existe, marque faca nova.</div>
              )}
              {!facaNova && umLado && (
                <>
                  <div style={{ ...interEm("E", 18, 160, 650, 24), width: 540, letterSpacing: "-.02em", color: CINZA }}>
                    Esta faca tem só a altura ({ladosFaca.largura} mm). {marcado("Digite a largura da etiqueta.", "Largura da etiqueta")}
                  </div>
                  <input value={larguraExtra} onChange={(e) => setLarguraExtra(soNumero(e.target.value))} inputMode="decimal" placeholder="Largura" aria-label="Largura da etiqueta em mm" className="np4-campo"
                    style={{ position: "absolute", left: 160 - folgaFR(40, "L"), top: 702 - baseFraunces(40, 52), width: 240, height: 52, padding: 0, border: "none", outline: "none", background: "transparent",
                      ...FR, fontSize: 40, lineHeight: "52px", letterSpacing: "-.02em", color: PRETO, zIndex: 3 }} />
                </>
              )}
              {/* a faca escolhida e os porta-clichês, no vão entre as pílulas e
                  o "Ver catálogo de facas" (na faca de uma medida só, o vão é
                  da largura: o aviso fica para o Enviar p/ clicheria) */}
              {!facaNova && !umLado && avisoFaca && (
                <div role="status" data-aviso-faca style={{ ...interEm(avisoFaca.texto, 16, 160, 42 * LG, 22), width: 480, letterSpacing: "-.01em", color: avisoFaca.alerta ? PRETO : "#5b595b" }}>
                  {avisoFaca.alerta ? <span className="np10-falta">{avisoFaca.texto}</span> : avisoFaca.texto}
                </div>
              )}
              <button onClick={() => setCatalogoAberto(true)} title="Abre o catálogo por cima do pedido" aria-haspopup="dialog" className="np4-opcao"
                style={{ ...BOTAO_LIMPO, ...frEm("Ver catálogo de facas", 32, 160, 47 * LG), zIndex: 3 }}>Ver catálogo de facas</button>
              {/* Faca nova: a medida não está no catálogo. O campo grande vira a
                  medida e as pílulas, os formatos. */}
              <button onClick={() => setFacaNova((v) => !v)} aria-pressed={facaNova} className="np4-opcao"
                style={{ ...BOTAO_LIMPO, position: "absolute", left: 481, top: Math.round(47 * LG - 9.16 - 14), height: 28, display: "flex", alignItems: "center", zIndex: 3 }}>
                <BolinhaV4 ligada={facaNova} />
                <span style={{ ...FR, position: "absolute", left: 34.57, top: 47 * LG - Math.round(47 * LG - 9.16 - 14) - baseFraunces(32, 32), fontSize: 32, lineHeight: "32px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>Faca nova</span>
              </button>
              {/* o traço entre as facas e o desenho, no cinza das dicas da tela (Augusto,
                  02/10/2026: "esse traço ficará na cor cinza que já usamos na tela") */}
              <div aria-hidden style={{ position: "absolute", left: 720 - V4.pilulaBorda / 2, top: 184.75, width: V4.pilulaBorda, height: 600, background: DICA, zIndex: 2 }} />
              {areaDoDesenho(762, 170, 508, 627)}

              {/* painel da direita: matéria-prima, largura e carreiras da bobina */}
              <div style={frEm("Matéria-prima", 40, V4.direita, 232.92)}>{marcado("Matéria-prima", "Matéria-prima")}</div>
              {[SUB_COL_A, SUB_COL_B].flatMap((coluna, ci) => coluna.map((m, k) => {
                const on = materia === m;
                return (
                  <button key={m} onClick={() => setMateria(m)} aria-pressed={on} className="np4-opcao"
                    style={{ ...BOTAO_LIMPO, ...interEm(m, 24, ci === 0 ? V4.direita : 1648, 322.4 + 48.5 * k, 30, on ? 800 : 400, on), letterSpacing: "-.02em", whiteSpace: "nowrap", zIndex: 3 }}>{m}</button>
                );
              }))}
              {/* substrato fora da lista: escolhido, na linha de baixo, com o × */}
              {substratoDigitado && !novoSubAberto && (
                <div style={{ ...interEm(materia, 24, V4.direita, 322.4 + 48.5 * 5, 30, 800, true), letterSpacing: "-.02em", display: "flex", alignItems: "center", gap: 10, maxWidth: 400, zIndex: 3 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{materia}</span>
                  <button onClick={() => setMateria("")} aria-label="Tirar o substrato" className="np4-opcao" style={{ ...BOTAO_LIMPO, display: "grid", placeItems: "center", width: 22, height: 22 }}><XisPequeno tamanho={14} /></button>
                </div>
              )}
              {novoSubAberto ? (
                <div style={{ position: "absolute", left: V4.direita - 8, top: 37 * LG - 30, width: 392, height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 6px 0 8px", boxSizing: "border-box", border: `1.5px dashed ${PRETO}`, borderRadius: 12, background: "#fff", zIndex: 5 }}>
                  <input autoFocus value={novoSubTexto} onChange={(e) => digitarSubstrato(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmarSubstrato(); else if (e.key === "Escape") { e.stopPropagation(); cancelarSubstrato(); } }}
                    placeholder="Digite o substrato" aria-label="Novo substrato" className="np4-texto"
                    style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: INTER, fontSize: 22, letterSpacing: "-.02em", color: PRETO }} />
                  <button onClick={confirmarSubstrato} aria-label="Confirmar substrato"
                    style={{ flex: "none", width: 30, height: 30, borderRadius: 999, border: "none", background: PRETO, display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="20 6 9 17 4 12" /></svg>
                  </button>
                </div>
              ) : (
                <button onClick={() => { setMateriaAntes(materia); setNovoSubAberto(true); setNovoSubTexto(""); }} className="np4-opcao"
                  style={{ ...BOTAO_LIMPO, position: "absolute", left: V4.direita + 1.55, top: 37 * LG - 19.27, height: 20.46, display: "flex", alignItems: "center", zIndex: 3 }}>
                  <MaisV4 />
                  <span style={{ position: "absolute", left: 33.24 - folgaIN(400, 24, "N"), top: 19.27 - baseInter(24, 24), fontFamily: INTER, fontSize: 24, lineHeight: "24px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>Novo substrato</span>
                </button>
              )}
              <div style={frEm("Largura", 40, V4.direita, 43 * LG)}>{marcado("Largura", "Largura")}</div>
              <div style={frEm("Carreiras", 40, 1648, 43 * LG)}>{marcado("Carreiras", "Carreiras")}</div>
              {/* Largura é medida em mm: só número, com vírgula ou ponto para a
                  fração. Letra aqui vira matéria-prima escrita no campo errado
                  e chega assim no pedido. Carreiras é contagem: inteiro. */}
              <input value={largura} onChange={(e) => setLargura(soNumero(e.target.value))} inputMode="decimal" placeholder="120" aria-label="Largura da bobina em mm" className="np4-campo"
                style={{ position: "absolute", left: V4.direita - folgaFR(48, "1"), top: 47 * LG - baseFraunces(48, 62), width: 210, height: 62, padding: 0, border: "none", outline: "none", background: "transparent", ...FR, fontSize: 48, lineHeight: "62px", color: PRETO, zIndex: 3 }} />
              <input value={carreiras} onChange={(e) => setCarreiras(e.target.value.replace(/\D/g, "").replace(/^0+/, ""))} inputMode="numeric" placeholder="04" aria-label="Carreiras" className="np4-campo"
                style={{ position: "absolute", left: 1648 - folgaFR(48, "0"), top: 47 * LG - baseFraunces(48, 62), width: 150, height: 62, padding: 0, border: "none", outline: "none", background: "transparent", ...FR, fontSize: 48, lineHeight: "62px", color: PRETO, zIndex: 3 }} />
            </>
          )}

          {/* ——— etapa 3: cores e acabamento ——— */}
          {etapa === 2 && (
            <>
              <CampoGrande valor={coresTexto} aoMudar={setCoresTexto} dica="Laranja, preto, rosa" corpo={72} ls={-0.02} x={160} base={V4.baseCampo} largura={1080}
                rotulo="Cores" falta={destacar("Cores")} campoRef={coresRef} marcar={sugestaoCor} />
              {/* quantas cores: os círculos do desenho, de 01 a 07; o escolhido acende */}
              {QTD_CORES.map((q, i) => {
                const on = qtdCores === String(q);
                return (
                  <button key={q} onClick={() => setQtdCores(on ? "" : String(q))} aria-pressed={on} aria-label={`${q} ${q === 1 ? "cor" : "cores"}`} className="np4-pilula"
                    style={{ position: "absolute", left: Math.round(160 + i * 76.76), top: Math.round(23 * LG), width: 52, height: 52, boxSizing: "border-box", borderRadius: 999, border: `1px solid ${PRETO}`,
                      background: on ? AMARELO : undefined, display: "grid", placeItems: "center", padding: 0, cursor: "pointer", color: PRETO, zIndex: 3 }}>
                    {/* 28 e não 32: com 32 a tinta (23,5 px de altura) quase encostava
                        no anel; o meio pixel para cima e para a esquerda é o desvio
                        medido da tinta (Augusto, 05/10/2026: "diminuir ligeiramente
                        o tamanho dos números e alinhá-los opticamente") */}
                    <span style={NUMERO_NO_CIRCULO}>{String(q).padStart(2, "0")}</span>
                  </button>
                );
              })}
              {/* embaixo dos círculos: a sugestão de grafia e o aviso da conta;
                  com os dois, a sugestão em cima (trocar a palavra costuma
                  desfazer o aviso) e os dois centrados no vão */}
              <div role="status" aria-live="polite" style={{ ...interEm("Você", 16, 160, avisoCores ? 446 : 456, 20), color: "#5b595b", whiteSpace: "nowrap", zIndex: 4 }}>
                {sugestaoCor && (
                  <>
                    Você quis dizer{" "}
                    {sugestaoCor.opcoes.map((op, i) => (
                      <span key={op}>
                        {i > 0 && " ou "}
                        <button type="button" onClick={() => trocarCor(sugestaoCor, op)} className="np10-falta np4-opcao" title={`Trocar “${sugestaoCor.palavra}” por “${op}”`}
                          aria-label={`Trocar ${sugestaoCor.palavra} por ${op}`}
                          style={{ border: "none", cursor: "pointer", font: "inherit", fontWeight: 600, color: PRETO }}>{op}</button>
                      </span>
                    ))}
                    ?
                  </>
                )}
              </div>
              {avisoCores && <div style={{ ...interEm(avisoCores, 16, 160, sugestaoCor ? 470 : 456, 20), color: "#5b595b", whiteSpace: "nowrap" }}>{avisoCores}</div>}
              <button data-pop onClick={() => setPantPop((v) => (v === "paleta" ? null : "paleta"))} aria-expanded={pantPop === "paleta"} className="np4-opcao"
                style={{ ...BOTAO_LIMPO, ...frEm("Ver paleta de cores", 32, 160, 32 * LG), zIndex: 3 }}>Ver paleta de cores</button>
              <button data-pop onClick={() => setPantPop((v) => (v === "outros" ? null : "outros"))} aria-expanded={pantPop === "outros"} className="np4-opcao"
                style={{ ...BOTAO_LIMPO, ...frEm("Cores de outros clientes", 32, 560, 32 * LG), zIndex: 3 }}>Cores de outros clientes</button>
              {pantPop && caixaPantone(pantPop === "paleta" ? 160 : 560)}
              {/* os Pantones escolhidos, em pílulas como as de arquivo */}
              {pantSel.length > 0 && (
                <div ref={rodaDeLado} className="np4-rolagem" style={{ position: "absolute", left: 160, top: 545, width: 1120, display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, zIndex: 3 }}>
                  {pantSel.map((c) => (
                    <div key={c} className="np4-chip" title={c} style={{ ...CHIP_V4, flex: "none", width: "auto", minWidth: 120, padding: "0 30px 0 10px", justifyContent: "flex-start" }}>
                      <span style={{ flex: "none", width: 16, height: 16, borderRadius: 999, background: hexPant(c), boxShadow: "inset 0 0 0 1px rgba(0,0,0,.18)" }} />
                      <span>{prefixoPantone(c)}</span>
                      <button onClick={() => alternarPant(c)} aria-label={`Tirar ${c}`} className="np4-chip-x"
                        style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, display: "grid", placeItems: "center", borderRadius: 999, border: "none", background: FUNDO_PAGINA, cursor: "pointer", padding: 0 }}>
                        <XisPequeno tamanho={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* as boas práticas das cores, em três colunas (c2, c7, c11) */}
              <div style={{ ...interEm("•", 18, 160, 39 * LG, 25), width: 340, letterSpacing: "-.035em" }}>
                • A cor na tela pode enganar. Monitores mostram cores com luz (RGB), enquanto a impressão usa tinta sobre papel, plástico ou filme (CMYK/Pantone). Por isso, o tom final pode ficar mais claro, escuro ou vibrante do que você vê no computador.
              </div>
              <div style={{ ...interEm("•", 18, 560, 39 * LG, 25), width: 240, letterSpacing: "-.035em" }}>
                • Prefira Pantones que já foram usados por outros clientes; assim, a produção já tem uma amostra para seguir.
              </div>
              <div style={{ ...interEm("•", 18, 880, 39 * LG, 25), width: 340, letterSpacing: "-.035em" }}>
                <div style={{ width: 320 }}>• Sempre peça uma amostra de cor ao cliente; assim, conseguimos aproximar ao máximo a cor.</div>
                {/* o 1º parágrafo tem três linhas: o 2º começa na linha 45 da grade */}
                <div style={{ marginTop: 45 * LG - 39 * LG - 3 * 25 }}>• Cor é algo relativo: o que é laranja para você pode ser amarelo para outra pessoa.</div>
              </div>

              {/* painel da direita: os acabamentos; o escolhido ganha o ✓ */}
              {ACABAMENTOS.map((a, i) => {
                const on = !!acab[a.nome];
                const base = 14 * LG + 100.5 * i;
                return (
                  <button key={a.nome} onClick={() => setAcab((s) => ({ ...s, [a.nome]: !s[a.nome] }))} aria-pressed={on} className="np4-opcao"
                    style={{ ...BOTAO_LIMPO, position: "absolute", left: V4.direita - 4, top: base - 44, width: 420, height: 92, zIndex: 3 }}>
                    <span style={{ ...frEm(a.nome, 48, 4, 44), display: "flex", alignItems: "center", gap: 14 }}>
                      {a.nome}{on && <ConfereV4 rotulo="Escolhido" />}
                    </span>
                    <span style={{ ...interEm(a.desc, 18, 4, 44 + 30.95, 20), width: 320, letterSpacing: "-.04em", color: DICA }}>{a.desc}</span>
                  </button>
                );
              })}
            </>
          )}

          {/* ——— etapa 4: revisão ——— */}
          {etapa === 3 && (
            <>
              <CampoGrande valor={nome} aoMudar={setNome} dica="Nome do cliente" corpo={104} ls={-0.02} x={160} base={V4.baseCampo} largura={1120} minimo={28}
                linhas={2} encolherAntes rotulo="Nome do cliente" falta={destacar("Nome do cliente")} />

              {/* cada bloco leva à etapa dele; o que falta diz "Falta", com o marca-texto */}
              <div style={frEm("Briefing", 32, 160, 24 * LG)}>Briefing</div>
              <button onClick={() => setEtapa(0)} disabled={enviando} title="Editar na etapa 1" className="np4-opcao"
                style={{ ...BOTAO_LIMPO, ...interEm(briefing.trim() || "F", 20, 160, 27 * LG, 28), width: 384, maxHeight: 9 * 28, overflow: "hidden", letterSpacing: "-.034em",
                  display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 9, whiteSpace: "pre-line", overflowWrap: "anywhere", zIndex: 3 }}>
                {briefing.trim() || <span className="np10-falta-valor">Falta o briefing.</span>}
              </button>

              <div style={frEm("Medida", 32, 640, 24 * LG)}>Medida</div>
              <button onClick={() => setEtapa(1)} disabled={enviando} title="Editar na etapa 2" className="np4-opcao"
                style={{ ...BOTAO_LIMPO, ...interEm(medidaRevisao || "F", 21, 640, 27 * LG, 28, 500), width: 280, letterSpacing: "-.022em", zIndex: 3 }}>
                <div style={{ whiteSpace: "nowrap" }}>{medidaRevisao || falta}</div>
                {facaRevisao && <div style={{ fontSize: 16, lineHeight: "24px", color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{facaRevisao}</div>}
              </button>
              <div style={frEm("Substrato", 32, 640, 32 * LG)}>Substrato</div>
              <button onClick={() => setEtapa(1)} disabled={enviando} title="Editar na etapa 2" className="np4-opcao"
                style={{ ...BOTAO_LIMPO, ...interEm("+", 21, 640, 35 * LG, 28, 500), width: 280, letterSpacing: "-.022em", whiteSpace: "nowrap", zIndex: 3 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>+ {materia || <>{falta} matéria-prima</>}</div>
                <div>+ {largura ? `Largura de ${largura}` : <>{falta} largura</>}</div>
                <div>+ {carreiras ? `${carreiras} ${carreiras === "1" ? "carreira" : "carreiras"}` : <>{falta} carreiras</>}</div>
              </button>
              {/* Urgência: marcada aqui, na conferência, que é por onde todo
                  pedido passa antes de concluir. Entra no card como selo. Fica
                  na linha do Editar, como o "Faca nova" ao lado do "Ver catálogo
                  de facas" na etapa 2 (Augusto, 02/10/2026: "urgente na linha ao
                  lado de editar, seguindo o grid"; era a c8 na linha 43). Na c5:
                  na c6, onde ele apontou, o texto ficava a 15 do "Começar do
                  zero" (c8). */}
              <button onClick={() => setUrgente((u) => !u)} aria-pressed={urgente} title="Urgente passa na frente da fila do design" className="np4-opcao"
                style={{ ...BOTAO_LIMPO, position: "absolute", left: 401, top: Math.round(47 * LG - 9.16 - 14), height: 28, display: "flex", alignItems: "center", zIndex: 3 }}>
                <BolinhaV4 ligada={urgente} />
                <span style={{ ...FR, position: "absolute", left: 34.57, top: 47 * LG - Math.round(47 * LG - 9.16 - 14) - baseFraunces(32, 32), fontSize: 32, lineHeight: "32px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>Urgente</span>
              </button>

              <div style={frEm("Cores", 32, 960, 24 * LG)}>Cores</div>
              <button onClick={() => setEtapa(2)} disabled={enviando} title="Editar na etapa 3" className="np4-opcao"
                style={{ ...BOTAO_LIMPO, position: "absolute", left: 960, top: 414, width: 320, height: 60, zIndex: 3 }}>
                {qtdCores || coresLista.length ? (
                  <>
                    <span style={{ position: "absolute", left: 0, top: 0, width: 52, height: 52, boxSizing: "border-box", borderRadius: 999, border: `1px solid ${PRETO}`, display: "grid", placeItems: "center" }}>
                      <span style={NUMERO_NO_CIRCULO}>{String(qtdCores || coresLista.length).padStart(2, "0")}</span>
                    </span>
                    <span style={{ ...interEm(coresLista.join(", ") || "-", 21, 80, 28 * LG - 414, 28, 500), width: 240, letterSpacing: "-.022em", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>
                      {coresLista.join(", ")}
                    </span>
                  </>
                ) : (
                  <span style={{ ...interEm("F", 21, 0, 28 * LG - 414, 28, 500), letterSpacing: "-.022em" }}>{falta}</span>
                )}
              </button>
              {/* o aviso de cores que não batem fica no pé (cabia mal aqui: a 2ª
                  linha das cores encostava nele) */}
              <div style={frEm("Acabamento", 32, 960, 32 * LG)}>Acabamento</div>
              <button onClick={() => setEtapa(2)} disabled={enviando} title="Editar na etapa 3" className="np4-opcao"
                style={{ ...BOTAO_LIMPO, ...interEm(acabEscolhidos[0]?.nome ?? "N", 21, 960, 35 * LG, 28, 500), width: 320, letterSpacing: "-.022em", zIndex: 3 }}>
                {!acabEscolhidos.length ? <span style={{ color: CINZA }}>Nenhum</span>
                  : acabEscolhidos.length <= 3
                    ? acabEscolhidos.map((a, i) => <div key={a.nome} style={{ whiteSpace: "nowrap" }}>{i ? `+ ${a.nome}` : a.nome}</div>)
                    : <div style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden" }}>{acabEscolhidos.map((a) => a.nome).join(" + ")}</div>}
              </button>
              {blocoAnexos(960, 670.12, 960 - V4.pilulaBorda / 2, 693.49 - V4.pilulaBorda / 2, 3)}

              <button onClick={() => setEtapa(0)} disabled={enviando} className="np4-opcao" style={{ ...BOTAO_LIMPO, ...frEm("Editar", 32, 160, 47 * LG), zIndex: 3 }}>Editar</button>
              {/* o formulário inteiro só sai com confirmação */}
              <button onClick={() => setConfirmarApagar(true)} disabled={enviando} className="np4-opcao" style={{ ...BOTAO_LIMPO, ...frEm("Começar do zero", 32, 640, 47 * LG), zIndex: 3 }}>Começar do zero</button>

              {areaDoDesenho(1362, 192, 467, 577)}
            </>
          )}

          {/* ——— o pé da etapa ———
              Sem a linha do que falta à direita (Augusto, 02/10/2026: "não vejo
              necessidade nessa mensagem"; o desenho também não tem): o Próximo
              aceso diz que a etapa está pronta, e o Concluir barrado marca os
              campos que faltam. O aviso de cores fica na etapa 3 e na capa. */}
          <div style={{ ...interEm("0", 55, 80, V4.baseNumero, 55, 500), letterSpacing: ".035em", color: DICA, zIndex: 3 }}>{String(etapa + 1).padStart(2, "0")}</div>
          <div style={tituloDoPe(PASSOS[etapa].titulo)}>{PASSOS[etapa].titulo}</div>
          {/* Anterior antes do Próximo também no código: o Tab segue a tela */}
          {etapa > 0 && (
            <button onClick={() => { setTentouSeguir(null); setEtapa(etapa - 1); }} disabled={enviando} className="np4-pilula"
              style={{ ...PILULA_V4, left: PE.anterior.x, width: PE.anterior.w, justifyContent: "space-between",
                paddingLeft: 23.135 - V4.pilulaBorda - folgaIN(500, 20.5, "A"), paddingRight: 33.69 - V4.pilulaBorda }}>
              <span style={TEXTO_PILULA}>Anterior</span>
              <SetaV4 volta />
            </button>
          )}
          <button onClick={() => {
            if (etapa < 3) {
              /* etapa incompleta não avança: marca o que falta nela */
              if (faltasAqui.length) { setTentouSeguir(etapa); return; }
              setTentouSeguir(null);
              setEtapa(etapa + 1);
              return;
            }
            if (performance.now() - revisaoAbertaEm.current < 700) return;
            enviar();
          }} disabled={enviando} className="np4-pilula"
            style={{ ...PILULA_V4, left: PE.proximo.x, width: PE.proximo.w, justifyContent: "space-between",
              paddingLeft: (etapa >= 3 ? 28.755 : 29.245) - V4.pilulaBorda - folgaIN(500, 20.5, etapa >= 3 ? "C" : "P"), paddingRight: 27.94 - V4.pilulaBorda,
              background: prontoParaSeguir ? AMARELO : undefined, cursor: enviando ? "wait" : "pointer", opacity: enviando ? 0.6 : 1 }}>
            <span style={TEXTO_PILULA}>{etapa >= 3 ? (enviando ? "Enviando…" : "Concluir") : "Próximo"}</span>
            <SetaV4 />
          </button>
          {/* nas etapas, Sair volta para a capa (como o ESC) */}
          <button onClick={() => { setTentouSeguir(null); setEtapa(null); }} disabled={enviando} className="np4-pilula" title="Volta para as quatro etapas"
            style={{ ...PILULA_V4, left: PE.sair.x, width: PE.sair.w, justifyContent: "flex-start", paddingLeft: 33 - V4.pilulaBorda - folgaIN(500, 20.5, "S") }}>
            <span style={TEXTO_PILULA}>Sair</span>
          </button>
        </>
      )}

      {/* O aviso de erro fica entre os painéis e o pé: dentro do painel ele
          cobria a área de anexos e o fim da lista de facas. */}
      {etapa !== null && erroNaTela && (
        <div role="alert" style={{ position: "absolute", left: "50%", top: 834, transform: "translateX(-50%)", zIndex: 60, display: "flex", alignItems: "center", gap: 12, maxWidth: 1400, background: PALETA.perigo, color: PALETA.perigoTinta, borderRadius: 999, padding: "14px 26px", boxShadow: "0 20px 44px -18px rgba(0,0,0,.55)", fontFamily: INTER, fontSize: 18, fontWeight: 600 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={PALETA.perigoTinta} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" /></svg>
          <span>{erroNaTela}</span>
        </div>
      )}

      {/* ————— pedido enviado ————— */}
      {enviado && (
        <div role="dialog" aria-modal="true" aria-label="Pedido enviado" style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: "rgba(37,36,37,.86)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 760, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 24, padding: "60px 64px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", boxShadow: "0 50px 110px -30px rgba(0,0,0,.6)" }}>
            <div style={{ width: 96, height: 96, borderRadius: 999, background: AMARELO, border: `1px solid ${PRETO}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ ...FR, fontSize: 42, letterSpacing: "-.02em", lineHeight: 1.06, color: PRETO }}>Pedido enviado<br />para a fila do design</div>
            <div style={{ marginTop: 20, fontFamily: INTER, fontSize: 20, lineHeight: 1.5, color: CINZA }}>
              {`${nome.trim() || "Pedido"}  ·  ${facaNova ? "faca nova" : facaCod || "sem faca"}  ·  ${materia || "sem substrato"}`}
            </div>
            {enviado.num && (
              <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 12, height: 44, padding: "0 22px", borderRadius: 999, background: "#f4f4f2", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, fontWeight: 600, color: PRETO }}>Nº do pedido {enviado.num}</div>
            )}
            {enviado.aviso && (
              <div style={{ marginTop: 18, maxWidth: 560, fontFamily: INTER, fontSize: 15, lineHeight: 1.45, color: PALETA.perigo }}>{enviado.aviso}</div>
            )}
            {/* "Voltar ao início" não dizia para onde voltava (era o começo
                do formulário, não a Home). Agora são os dois caminhos de
                verdade: outro pedido, com o formulário limpo, ou o pedido que
                acabou de ser criado. */}
            <div style={{ marginTop: 36, display: "flex", gap: 14 }}>
              <button onClick={recomeçar} className="np10-flat" autoFocus={!(enviado.id && aoVerPedido)}
                style={{ height: 56, padding: "0 32px", borderRadius: 999, border: `2px solid ${PRETO}`, background: "none", color: PRETO, fontFamily: INTER, fontSize: 19, fontWeight: 600, cursor: "pointer" }}>Fazer outro pedido</button>
              {enviado.id && aoVerPedido && (
                <button onClick={() => aoVerPedido(enviado.id!)} className="np10-flat" autoFocus
                  style={{ height: 56, padding: "0 40px", borderRadius: 999, border: "none", background: PRETO, color: FUNDO, fontFamily: INTER, fontSize: 19, fontWeight: 600, cursor: "pointer" }}>Ver pedido</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ————— apagar o formulário inteiro: com confirmação ————— */}
      {confirmarApagar && (
        <div onClick={() => setConfirmarApagar(false)}
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 85, background: "rgba(37,36,37,.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(ev) => ev.stopPropagation()} role="dialog" aria-label="Começar do zero"
            style={{ width: 560, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, padding: "40px 44px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)" }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em", color: PRETO }}>Começar do zero?</div>
            <div style={{ fontFamily: INTER, fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              Nome, briefing, anexos, faca, cores e acabamentos saem do formulário.{formDoSalvo ? " O pedido salvo também sai." : ""} Não tem como desfazer.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setConfirmarApagar(false)} className="np10-flat" autoFocus
                style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
              <button onClick={() => {
                /* começar do zero joga fora este pedido, inclusive a cópia salva
                   dele (a caixa avisa); um salvo de outro pedido fica */
                if (usouSalvoRef.current && aoSalvar) {
                  void Promise.resolve(aoSalvar(null)).catch((e: unknown) => avisar(erroLegivel(e, "Não deu para apagar o pedido salvo.")));
                }
                setConfirmarApagar(false);
                recomeçar();
              }} className="np10-flat"
                style={{ height: 50, padding: "0 26px", border: "none", borderRadius: 999, background: PALETA.perigo, color: PALETA.perigoTinta, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Apagar tudo</button>
            </div>
          </div>
        </div>
      )}

      {/* ————— copiar do Histórico por cima do que já foi preenchido ————— */}
      {copiarDe && (
        <div onClick={() => setCopiarDe(null)}
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 85, background: "rgba(37,36,37,.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(ev) => ev.stopPropagation()} role="dialog" aria-label="Copiar a solicitação"
            style={{ width: 600, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, padding: "40px 44px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)" }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em", color: PRETO }}>Trocar pelo pedido copiado?</div>
            <div style={{ fontFamily: INTER, fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              O que já foi preenchido sai, e entra o pedido {copiarDe.numero != null ? numeroPedido(copiarDe.numero) : ""}{copiarDe.cliente ? ` de ${copiarDe.cliente}` : ""}.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setCopiarDe(null)} className="np10-flat"
                style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
              <button onClick={() => void copiar(copiarDe)} className="np10-flat" autoFocus
                style={{ height: 50, padding: "0 30px", border: "none", borderRadius: 999, background: PRETO, color: FUNDO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Copiar</button>
            </div>
          </div>
        </div>
      )}

      {/* ————— rascunho achado: continuar ou começar do zero ————— */}
      {rascunhoAchado && (
        <div onClick={continuarRascunho}
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 85, background: "rgba(37,36,37,.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(ev) => ev.stopPropagation()} role="dialog" aria-label={rascunhoAchado._salvo ? "Pedido salvo" : "Pedido começado"}
            style={{ width: 600, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, padding: "40px 44px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)" }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em", color: PRETO }}>{rascunhoAchado._salvo ? "Continuar o pedido salvo?" : "Continuar o pedido começado?"}</div>
            <div style={{ fontFamily: INTER, fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              {(() => {
                const quem = String(rascunhoAchado.nome ?? "").trim();
                if (!rascunhoAchado._salvo) return `${quem ? `O pedido de ${quem} ficou pela metade nesta aba.` : "Um pedido ficou pela metade nesta aba."}${rascunhoAchado.veioDoSalvo ? " Começar do zero apaga também o que foi salvo." : ""}`;
                const quando = rascunhoAchado.salvoEm ? new Date(String(rascunhoAchado.salvoEm)) : null;
                const em = quando && !Number.isNaN(quando.getTime())
                  ? ` em ${quando.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}, às ${quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : "";
                return `Você salvou ${quem ? `o pedido de ${quem}` : "um pedido"}${em}. Começar do zero apaga o que foi salvo.`;
              })()}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={descartarRascunho} className="np10-flat"
                style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Começar do zero</button>
              <button onClick={continuarRascunho} className="np10-flat" autoFocus
                style={{ height: 50, padding: "0 30px", border: "none", borderRadius: 999, background: PRETO, color: FUNDO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Continuar</button>
            </div>
          </div>
        </div>
      )}

      {/* ————— desenho ampliado ————— */}
      {/* ————— o catálogo de facas em pop-up —————
          A página de Facas inteira, da c1 à c23, reduzida para caber
          (1760/1920), sobre a Solicitação escurecida; o formulário fica como
          está embaixo. Clique fora, ESC ou Fechar saem. */}
      {catalogoAberto && (
        <div onClick={fecharCatalogo} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: "rgba(37,36,37,.72)", zIndex: 75 }}>
          <div role="dialog" aria-modal="true" aria-label="Catálogo de facas" onClick={(e) => e.stopPropagation()}
            style={{ position: "absolute", left: 80, top: (1080 - 990) / 2, width: 1760, height: 990, borderRadius: V4.raio, overflow: "hidden", boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)" }}>
            <div style={{ width: 1920, height: 1080, transform: `scale(${1760 / 1920})`, transformOrigin: "0 0" }}>
              <FerramentaisHub10 profile={profile} aoNavegar={aoNavegar} onLogout={onLogout} emPopup={{ aoFechar: fecharCatalogo }} />
            </div>
          </div>
        </div>
      )}

      {pdfAmpliado && desenho && (
        <div onClick={() => setPdfAmpliado(false)} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: "rgba(37,36,37,.72)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <div style={{ position: "relative", width: 760, height: 940, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)" }}>
            <img src={desenho} alt={`Desenho ${facaCod}`} style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            <button onClick={() => setPdfAmpliado(false)} aria-label="Fechar"
              style={{ position: "absolute", right: -18, top: -18, width: 40, height: 40, borderRadius: 999, border: `1px solid ${PRETO}`, background: AMARELO, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <XisPequeno tamanho={20} />
            </button>
          </div>
        </div>
      )}

      {/* a capa deixa a barra transparente: a sombra do cartão em hover passa
          por baixo dela sem corte (como em Pedidos) */}
      <BarraTopoHub10 profile={profile} paginaAtiva="Novo pedido" aoNavegar={navegarSeLivre} onLogout={sairSeLivre} disponiveis={disponiveis}
        fundo={etapa === null ? "transparent" : undefined} />

      {/* o aviso fica logo acima das pílulas do pé: no rodapé, onde ele mora
          nas outras telas, cobria o Histórico e o Sair */}
      {aviso && (
        <div className="np4-aviso" style={{ position: "absolute", left: 0, top: 0, width: 1920, height: TOPO_PILULA - 18 + 34, pointerEvents: "none", zIndex: 70 }}>
          <AvisoV1a texto={aviso} tipo={avisoTipo} onFechar={() => setAviso("")} />
        </div>
      )}
    </PalcoFixo>
  );
}
