// Ferramentais — Hub 1.0. É a tela de Facas do 1.0, no molde de Aprovações:
// uma trilha de cartões de 480px que rola para o lado, tarja preta embaixo,
// título em Fraunces.
//
// A diferença é que aqui o cartão não é um pedido, é uma FAMÍLIA de faca. São
// oito, e são exatamente os oito sistemas que a equipe mantém na Relação de
// Ferramentais — só com os nomes que se usam na fábrica:
//
//   Figura → Retangular        Especiais      → Especial
//   Redonda → Redondas e ovais Gap            → Gaps e serrilhas
//   Tag → Tags                 Etiquetadoras  → Manuais
//   Picote → Picotes           Cortes e vincos
//
// A capa segue o conceito do Novo pedido: título grande, ilustração e, embaixo
// dela, quanta faca existe ali. As ilustrações são SVG desenhado aqui, não PNG:
// o que elas mostram É a forma da faca, e em linha preta sobre o amarelo isso
// fica legível em qualquer escala do palco.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as KeyboardEventReact, MouseEvent as MouseEventReact, PointerEvent as PointerEventReact, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { FACAS } from "../v1a/dados/facas";
import { CILINDRO, MEDIDAS, MORTAS_INICIAIS, NUM, PASSO_MM, PDF_DE } from "../v1a/dados/facas-cilindro";
import { getFichaDesenho, getMiniaturaFaca, getPdfFaca, listCatalogoFacas, listRelacaoFacas, listZDasFacas, salvarMiniaturaFaca } from "@/lib/api/facas.functions";
import type { FichaDoDesenho } from "@/server/facas-ficha.server";
import { pdfPrimeiraPagina } from "@/lib/pdf-preview";
import { chaveFaca } from "@/lib/chave-faca";
import { alvoBusca, criarBusca, normalizarBusca } from "@/lib/busca";
import { colherBusca, espiarBusca } from "@/lib/busca-semente";
import { AvisoV1a } from "../v1a/HubV1a";
import { useFacasVivas } from "./facas-vivas";
import { DerrameHub10 } from "./DerrameHub10";
import { SetaDaTrilha } from "./LottieHub10";
import {
  AMARELO_MAIS, BarraTopoHub10, FR, FUNDO, FUNDO_PAGINA, INTER, MARCA_DO_RODAPE, NIVEL, PRETO, PalcoFixo, RAIO_DA_PESQUISA, RESUMO_DA_FAIXA,
  linhaDoResumo, noRodape, rodapeDaFaixa, tituloDaFaixa, useEscDoTopo,
} from "./ChromeHub10";
import { CAPA_V4, CartaoV4, DENTRO_V4, ResumoDoPeV4, RotuloV4, TituloV4, TrilhaV4, tituloDoPeV4 } from "./CapaV4Hub10";
import type { SessionUser } from "@/lib/session";
import { PALETA } from "@/lib/paleta-hub";
import { listPortaCliches } from "@/lib/api/porta-cliches.functions";
import type { PortaCliche } from "@/lib/porta-cliches";
import { PortaClichesHub10 } from "./PortaClichesHub10";

const CINZA = "#8f8f8f";

/* ————— apelidos de fábrica —————
   A faca de 38,66 mm todo mundo chama de "40", e a de 59,5 de "60". São duas
   das medidas mais usadas da casa, e ninguém digita o número cheio: quem
   procura "40" quer a 38,66 e não acha nada se o hub for literal.

   Vale num sentido só — o apelido acha a medida real; a medida real não vira
   apelido. E a lista continua mostrando 38,66, que é o que está no desenho e
   o que a máquina precisa. */
const APELIDO_DE: Record<string, string> = { "40": "38,66", "60": "59,5" };
/** Para a busca livre: "38,66x30" também responde por "40x30". */
const APELIDOS_NA_MEDIDA: [RegExp, string][] = [
  [/38[.,]66/g, "40"],
  [/59[.,]5(?!\d)/g, "60"],
];
const apelidoDaMedida = (medida: string): string => {
  let s = APELIDOS_NA_MEDIDA.reduce((t, [re, ap]) => t.replace(re, ap), String(medida || ""));
  /* a faca da Force aparece como "F 59,5X130", mas quem procura pode digitar
     "force" — o nome da máquina continua achando ela */
  if (/^F\s/i.test(s)) s = `FORCE ${s.slice(2)}`;
  return s === medida ? "" : s;
};

type Faca = { cod: string; medida: string; sistema: string; secao: string; arquivo?: string };
/** O que a pasta "Facas por Z" sabe de uma faca. */
type ZArquivado = { z: number; maquina: string | null; morta: boolean };

/* ————— as oito famílias ————— */
/* `sistema` é a chave que vem da Relação; `t1`/`t2` são as duas linhas do
   título, quebradas à mão porque Fraunces em 64px não quebra sozinho onde a
   gente quer. */
type Familia = { sistema: string; t1: string; t2?: string; nome: string };
const FAMILIAS: Familia[] = [
  { sistema: "Figura", nome: "Retangular", t1: "Retangular" },
  { sistema: "Especiais", nome: "Especial", t1: "Especial" },
  { sistema: "Redonda", nome: "Redondas e ovais", t1: "Redondas", t2: "e ovais" },
  { sistema: "Gap", nome: "Gaps e serrilhas", t1: "Gaps e", t2: "serrilhas" },
  { sistema: "Tag", nome: "Tags", t1: "Tags" },
  { sistema: "Etiquetadoras", nome: "Manuais", t1: "Manuais" },
  { sistema: "Picote", nome: "Picotes", t1: "Picotes" },
  { sistema: "Cortes e vincos", nome: "Cortes e vincos", t1: "Cortes", t2: "e vincos" },
];

/** Clareia uma cor em direção ao branco. t=0 não muda, t=1 vira branco. */
function clarear(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => Math.round(c + (255 - c) * t);
  return "#" + [canal((n >> 16) & 255), canal((n >> 8) & 255), canal(n & 255)]
    .map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* Os oito cartões são o mesmo azul claro clareando 12% a cada um — o passo dos
   cards de pedido quando a cor se repete; o oitavo cai em 84%, que é o teto de
   lá. Eram amarelos (Augusto, 30/09/2026: "vamos trocar a cor dos cards para
   azul claro"). O azul é o #79cdf4 do "Design criado" nos pedidos, que pela
   regra de luz de lá é cor forte: passo de 12%, não o de 20% das claras. Com
   ele, o brilho amarelo dos ícones aparece (no amarelo parecia recorte). Em
   30/09 testamos cinza (#b3b1b3, #c8c6c8, #d4d2d4) e ele ficou com o azul
   (01/10/2026: "a azul era a melhor mesmo"). O mesmo tom é a cor da família
   lá dentro. */
const AZUL_CLARO = PALETA.azulCartao;
const TOM = FAMILIAS.map((_, i) => clarear(AZUL_CLARO, i * 0.12));

/* ————— ícones ————— */
/* Os ícones das famílias no estilo que o Augusto desenhou para a retangular
   (hubv3/referencia icone facas.svg, 30/09/2026): a placa em isométrico, face
   de cima branca, contorno preto, lateral preta com o brilho amarelo na face
   iluminada. Os outros sete saíram das formas dos ícones antigos da equipe
   (os do índice da Relação de Ferramentais, que a fábrica reconhece): o selo,
   o disco, a serrilha, a tag com cordão, a etiqueta de etiquetadora, os
   picotes, o vinco. Todos na mesma prancheta (1920 × 1248,5), com a mesma
   área branca, para pesarem igual nos cartões. */
const ILUSTRACAO: Record<string, string> = {
  "Figura": "/fer10/icone-retangular.svg",
  "Especiais": "/fer10/icone-especial.svg",
  "Redonda": "/fer10/icone-redonda.svg",
  "Gap": "/fer10/icone-gaps.svg",
  "Tag": "/fer10/icone-tags.svg",
  "Etiquetadoras": "/fer10/icone-manuais.svg",
  "Picote": "/fer10/icone-picotes.svg",
  "Cortes e vincos": "/fer10/icone-cortes.svg",
};
/* a prancheta dos ícones no cartão, 460 de largura (0,24 px por unidade) */
const ICONE_L = 460, ICONE_A = Math.round(ICONE_L * 1248.5 / 1920);
/* O centro da caixa de cada desenho na prancheta, medido nos arquivos: o
   cartão centra o DESENHO, não a prancheta. A tag tem o cordão para a
   esquerda e para cima, e com a prancheta centrada ela ficava torta. */
const CENTRO_DO_ICONE: Record<string, [number, number]> = {
  "Figura": [960, 624], "Especiais": [960, 628], "Redonda": [960, 628], "Gap": [960, 628],
  "Tag": [912, 601], "Etiquetadoras": [960, 628], "Picote": [960, 628], "Cortes e vincos": [960, 628],
};
/* Onde o desenho se centra no cartão: no meio do vão entre o título de duas
   linhas (111 + 2 × 80) e a seta do pé (525), 8 px acima: a lateral preta pesa
   embaixo, e o centro de conta parece baixo (centro óptico). */
const CENTRO_Y_DO_ICONE = (111 + 2 * 80 + 525) / 2 - 8;
/* A capa no molde v4 (Augusto, 02/10/2026: "atualizar a capa de facas para o
   novo design"): o desenho no meio do vão entre o título e a seta do cartão
   de 720, e a pílula do pé como a das outras capas (44 de altura, 0,85 acima
   da linha 63) */
const MEIO_DO_ICONE_V4 = 430;
const PILULA_PE_ALT_V4 = 44.04;
const TOPO_PILULA_PE_V4 = CAPA_V4.basePe - 0.85 - PILULA_PE_ALT_V4;

/* ————— o topo do cartão ————— */
/* Marca pequena e cinza em cima, título Fraunces embaixo: é o mesmo cabeçalho
   dos painéis do pedido ("3 evento(s)" sobre "Histórico"), nas mesmas medidas.
   O 1.0 já ensinou esse par em toda tela de detalhe — repetir aqui é o que faz
   o cartão parecer do mesmo hub, e não de outro. */
const MARCA: CSSProperties = { position: "absolute", left: 76, top: 58, fontSize: 18, fontWeight: 600, color: "#8f8f8f", whiteSpace: "nowrap" };
/* título em 80 (era 56; Augusto, 30/09/2026: "aumente o tamanho da fonte dos
   títulos para preencher mais área do card"): o maior corpo em que a linha
   mais larga, "Retangular" (371 px), cabe no cartão com a margem do título
   dos cartões das Calculadoras */
const TITULO_CARTAO: CSSProperties = { position: "absolute", left: 76, top: 111, width: 384, ...FR, fontSize: 80, lineHeight: "80px", letterSpacing: "-.04em" };

/* O porta-clichê deitado, para o card da área (08/10/2026): o cilindro com a
   face da ponta, o eixo dos dois lados e as divisas da fita, em linha preta
   sobre o branco, como os desenhos das famílias. */
function IlustracaoPortaCliche() {
  return (
    <svg viewBox="0 0 340 170" width={340} height={170} fill="none" stroke={PRETO} strokeWidth={5} strokeLinejoin="round" style={{ display: "block" }}>
      <rect x="8" y="72" width="52" height="26" rx="6" fill="#fff" />
      <rect x="282" y="72" width="50" height="26" rx="6" fill="#fff" />
      <path d="M58 30 L282 30 L282 140 L58 140 A22 55 0 0 1 58 30 Z" fill="#fff" />
      <ellipse cx="282" cy="85" rx="22" ry="55" fill="#fff" />
      <path d="M120 30 V140 M196 30 V140" strokeWidth={3} />
    </svg>
  );
}

function Ilustracao({ sistema }: { sistema: string }) {
  const src = ILUSTRACAO[sistema];
  return src ? <img src={src} alt="" width={ICONE_L} height={ICONE_A} draggable={false} style={{ display: "block" }} /> : null;
}

/** O palco da página aberta como pop-up (o catálogo da etapa 2 da
    Solicitação): o mesmo 1920×1080, sem o PalcoFixo, que já existe por fora. */
function PalcoDoPopup({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "relative", width: 1920, height: 1080, background: FUNDO, overflow: "hidden", color: PRETO, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }}>
      {children}
    </div>
  );
}

/* ————— a tela ————— */
export function FerramentaisHub10({ profile, aoNavegar, onNova, onLogout, disponiveis, podeCadastrar = false, aoCadastrar, emPopup }: {
  profile: SessionUser;
  aoNavegar: (label: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  /** permissão `cadastro.medidas` — sem ela o "+" nem aparece */
  podeCadastrar?: boolean;
  aoCadastrar?: (faca: Faca) => Promise<unknown>;
  /** Aberta como pop-up por cima de outra tela (o "Ver catálogo de facas" da
      Solicitação; Augusto, 02/10/2026: "o catálogo de facas abre como um pop
      up na tela"): no lugar da barra do topo, o título e o Fechar. */
  emPopup?: { aoFechar: () => void };
}) {
  const Palco = emPopup ? PalcoDoPopup : PalcoFixo;
  const [aberta, setAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  /* o desenho aberto grande — mora aqui, e não no painel, porque o visor
     cobre o palco inteiro e o painel corta o que passa da borda dele */
  const [desenhoAberto, setDesenhoAberto] = useState<DesenhoAberto | null>(null);
  /* A comparação mora só no visor ("na comparação usamos apenas essa tela",
     Augusto, 28/09/2026): clicar no desenho abre ele sozinho; o Comparar do
     trilho abre o visor já comparando, com o lugar para somar outra. */
  const [visorComparando, setVisorComparando] = useState(false);
  const abrirDesenho = useCallback((d: DesenhoAberto) => { setVisorComparando(false); setDesenhoAberto(d); }, []);
  const abrirComparando = useCallback((d: DesenhoAberto) => { setVisorComparando(true); setDesenhoAberto(d); }, []);
  const [aviso, setAviso] = useState("");
  const [rolou, setRolou] = useState(false);
  const trilha = useRef<HTMLDivElement | null>(null);

  /* ————— cadastro de faca nova —————
     Abre pelo rodapé da faixa (Augusto, 30/09/2026); antes cada cartão tinha
     o seu "Cadastrar nova" e a família vinha dele. Agora a família é o
     primeiro campo da caixa, e as seções aparecem depois dela. */
  const [cadastroAberto, setCadastroAberto] = useState(false);
  const [cadastroEm, setCadastroEm] = useState<string | null>(null);
  const [nCod, setNCod] = useState("");
  const [nMedida, setNMedida] = useState("");
  const [nSecao, setNSecao] = useState("");
  const [gravando, setGravando] = useState(false);
  const emVoo = useRef(false);
  const abrirCadastro = () => {
    setCadastroAberto(true); setCadastroEm(null); setNCod(""); setNMedida(""); setNSecao("");
  };

  /* A Relação de Ferramentais é a fonte da verdade; o catálogo antigo entra só
     com o que ela não tem, e as mortas saem da conta. A lista mora em
     facas-vivas.ts, a mesma que a calculadora de facas usa. */
  const { vivas, relacaoRaw, relacaoLendo, relacaoFalhou } = useFacasVivas();
  /* Z arquivado à mão pela equipe em "Facas por Z". Onde ele existe a ficha
     para de estimar — e com ele vêm as repetições e o diâmetro certos. */
  const { data: zRaw } = useQuery<any>({
    queryKey: ["facas-z"],
    queryFn: () => listZDasFacas() as Promise<any>,
    staleTime: 5 * 60_000,
  });
  const zs: Record<string, ZArquivado> = zRaw?.zs ?? {};
  /* Os porta-clichês de cada máquina: o card no fim da trilha e a área que ele
     abre (Augusto, 08/10/2026: "vamos criar em um card em facas com os portas") */
  const { data: portas, isLoading: portasLendo, isError: portasFalhou } = useQuery<PortaCliche[]>({
    queryKey: ["porta-cliches"],
    queryFn: () => listPortaCliches() as Promise<PortaCliche[]>,
    staleTime: 60_000,
  });
  const totalPortas = (portas ?? []).reduce((soma, x) => soma + (x.quantidade || 0), 0);
  const [portasAbertas, setPortasAbertas] = useState(false);

  const porSistema = useMemo(() => {
    const m = new Map<string, Faca[]>();
    for (const f of FAMILIAS) m.set(f.sistema, []);
    for (const f of vivas) m.get(f.sistema)?.push(f);
    return m;
  }, [vivas]);

  const total = FAMILIAS.reduce((s, f) => s + (porSistema.get(f.sistema)?.length ?? 0), 0);
  /* o fim do título do pé (v4), para a pílula vir 44 depois dele, nunca antes da c6 */
  const tituloPeRef = useRef<HTMLDivElement | null>(null);
  const [fimTituloPe, setFimTituloPe] = useState(80 + 440);
  useEffect(() => {
    const el = tituloPeRef.current;
    if (!el) return;
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo && el.isConnected) setFimTituloPe(el.offsetLeft + el.offsetWidth); });
    return () => { vivo = false; };
  }, []);
  const pilulaPeX = Math.max(480 - 2.21 / 2, Math.ceil(fimTituloPe + 44));
  /* Quantas ainda não têm desenho arquivado numa pasta de Z. É pendência de
     arquivo, e mostrar o número é o que faz alguém arquivar. */
  const semZ = Object.keys(zs).length ? vivas.filter((f) => !zs[chaveFaca(f.cod)]).length : 0;
  /* "Lendo" enquanto a Relação não volta. Era enquanto nada voltava: o
     catálogo do banco chega antes, e a capa mostrava a conta da lista
     embutida até a Relação chegar; e, com as duas consultas caídas, ficava
     "Lendo" para sempre. Se ela falha, para de ler e o pé avisa. */
  const carregando = relacaoLendo;

  /* Rodinha vertical vira rolagem horizontal, um cartão por giro — igual à
     trilha de pedidos. Com oito cartões e quatro na tela, sem isto metade da
     página fica fora do alcance de quem só tem mouse. */
  useEffect(() => {
    const el = trilha.current;
    if (!el) return;
    let liberadoEm = 0;
    const aoRodar = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      const agora = performance.now();
      if (agora < liberadoEm) return;
      liberadoEm = agora + 220;
      el.scrollBy({ left: Math.sign(e.deltaY) * (el.clientWidth / 4), behavior: "smooth" });
      setRolou(true);
    };
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  }, []);

  /* Arrastar com o ponteiro, com a mesma proteção de caneta da trilha de
     pedidos: sem `buttons === 0` a trilha segue a caneta pela tela. */
  const arrasto = useRef({ ativo: false, x0: 0, scroll0: 0, andou: false });
  const aoApontar = (e: PointerEventReact<HTMLDivElement>) => {
    const el = trilha.current;
    if (!el || e.button !== 0) return;
    arrasto.current = { ativo: true, x0: e.clientX, scroll0: el.scrollLeft, andou: false };
  };
  useEffect(() => {
    const soltar = () => { arrasto.current.ativo = false; };
    const mover = (e: PointerEvent) => {
      const a = arrasto.current, el = trilha.current;
      if (!a.ativo || !el) return;
      if (e.buttons === 0) { soltar(); return; }
      const d = e.clientX - a.x0;
      if (Math.abs(d) > 4) { a.andou = true; setRolou(true); }
      el.scrollLeft = a.scroll0 - d;
    };
    document.addEventListener("pointermove", mover);
    document.addEventListener("pointerup", soltar);
    document.addEventListener("pointercancel", soltar);
    window.addEventListener("blur", soltar);
    return () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerup", soltar);
      document.removeEventListener("pointercancel", soltar);
      window.removeEventListener("blur", soltar);
    };
  }, []);

  const fecharPainel = useCallback(() => { setAberta(null); setBusca(""); }, []);
  useEscDoTopo(aberta !== null, NIVEL.painel, fecharPainel);

  /* A faca escolhida na busca do topo chega aqui como semente: a família dela
     abre com a faca na ficha. Antes a página abria na capa e o rodapé da busca
     prometia "abrem a página já filtrada". Semente que não é código de faca
     (nome de cliente, de outra tela) fica para quem é. */
  useEffect(() => {
    const colher = () => {
      const alvo = espiarBusca().trim().toUpperCase();
      const f = alvo ? vivas.find((x) => x.cod.toUpperCase() === alvo) : undefined;
      if (!f) return;
      colherBusca();
      setAberta(f.sistema);
      setBusca(f.cod);
    };
    colher();
    window.addEventListener("hub:semente", colher);
    return () => window.removeEventListener("hub:semente", colher);
  }, [vivas]);

  const familiaAberta = FAMILIAS.find((f) => f.sistema === aberta) ?? null;

  const fecharCadastro = useCallback(() => setCadastroAberto(false), []);
  useEscDoTopo(cadastroAberto, NIVEL.caixa, fecharCadastro);
  const familiaCadastro = FAMILIAS.find((f) => f.sistema === cadastroEm) ?? null;
  /* As seções que ESTA família já usa: quem cadastra escolhe uma delas em vez
     de digitar "3 Cores" e criar um grupo novo por causa da maiúscula. */
  const secoesDaFamilia = useMemo(() => {
    if (!cadastroEm) return [];
    return [...new Set((porSistema.get(cadastroEm) ?? []).map((f) => f.secao?.trim()).filter(Boolean) as string[])]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cadastroEm, porSistema]);

  const codLimpo = nCod.trim();
  const medidaLimpa = nMedida.trim();
  /* família sem seção nenhuma cadastra sem seção (a caixa já dizia isso, mas
     a trava pedia uma seção e o botão nunca acendia) */
  const podeGravar = !!cadastroEm && codLimpo.length >= 2 && !!medidaLimpa && (!!nSecao || secoesDaFamilia.length === 0) && !gravando;
  /* Código repetido é o erro que mais dói aqui: a faca entra no catálogo, some
     dentro da lista e só aparece quando alguém procura pelo código e acha duas. */
  const codigoRepetido = !!codLimpo && vivas.some((f) => f.cod.toLowerCase() === codLimpo.toLowerCase());

  const gravarFaca = () => {
    if (!podeGravar || !cadastroEm || codigoRepetido || emVoo.current) return;
    emVoo.current = true;
    setGravando(true);
    void Promise.resolve(
      aoCadastrar?.({ cod: codLimpo, medida: medidaLimpa, sistema: cadastroEm, secao: nSecao }),
    )
      .then(() => { setCadastroAberto(false); })
      .catch(() => setAviso("Não deu para cadastrar a faca. Tente de novo."))
      .finally(() => { emVoo.current = false; setGravando(false); });
  };

  return (
    <Palco>
      {/* A capa no molde v4: o cinza da barra ao pé, sem a faixa preta; as
          oito famílias em cartões de 440 com raio e sombra, no degradê do
          azul claro; o título no pé, a ação em pílula e o resumo à direita
          (Augusto, 02/10/2026: "atualizar a capa de facas para o novo
          design"). A trilha v4 tem a roda, o arrastar e a seta de rolar. */}
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />

      {/* ————— as oito famílias ————— */}
      <TrilhaV4 quantos={FAMILIAS.length + 1} rotulo="Famílias de facas e porta-clichês">
        {FAMILIAS.map((f, i) => {
          const n = porSistema.get(f.sistema)?.length ?? 0;
          const quantas = `${n} ${n === 1 ? "faca" : "facas"}`;
          const [cx, cy] = CENTRO_DO_ICONE[f.sistema] ?? [960, 628];
          const k = ICONE_L / 1920;
          return (
            <CartaoV4 key={f.sistema} indice={i} cor={TOM[i]} aoAbrir={() => setAberta(f.sistema)}
              rotulo={`${f.t1}${f.t2 ? ` ${f.t2}` : ""}, ${carregando ? "lendo a lista de facas" : quantas}`}>
              {/* a quantidade em cima do título, como o "Calcular" das Calculadoras */}
              <RotuloV4 texto={carregando ? "—" : quantas} />
              <TituloV4 linhas={f.t2 ? [f.t1, f.t2] : [f.t1]} />
              {/* o desenho da família centrado no cartão, no vão entre o título e a seta */}
              <div aria-hidden style={{ position: "absolute", left: CAPA_V4.cartao / 2 - cx * k, top: MEIO_DO_ICONE_V4 - cy * k, width: ICONE_L, height: ICONE_A, pointerEvents: "none" }}>
                <Ilustracao sistema={f.sistema} />
              </div>
              {/* a seta das faixas de Pantones: o cartão abre a família */}
              <span aria-hidden className="pn10-seta" style={{ position: "absolute", left: DENTRO_V4.descX, top: CAPA_V4.altura - 46 - 44, width: 44, height: 44, boxSizing: "border-box",
                border: `1.5px solid ${PRETO}`, borderRadius: 999, display: "grid", placeItems: "center", ["--tinta" as string]: PRETO, ["--faixa" as string]: TOM[i] } as CSSProperties}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7" /><polyline points="8 7 17 7 17 16" />
                </svg>
              </span>
            </CartaoV4>
          );
        })}
        {/* o card dos porta-clichês, depois das famílias, no amarelo: não é
            uma família de faca, é o que roda com ela */}
        <CartaoV4 key="porta-cliches" indice={FAMILIAS.length} cor={PALETA.amarelo} aoAbrir={() => setPortasAbertas(true)}
          rotulo={`Porta-clichês, ${portasLendo ? "lendo os porta-clichês" : `${totalPortas} porta-clichês em quatro máquinas`}`}>
          <RotuloV4 texto={portasLendo ? "—" : `${totalPortas} porta-clichês`} />
          <TituloV4 linhas={["Porta-", "clichês"]} />
          <div aria-hidden style={{ position: "absolute", left: CAPA_V4.cartao / 2 - 170, top: MEIO_DO_ICONE_V4 - 85, width: 340, height: 170, pointerEvents: "none" }}>
            <IlustracaoPortaCliche />
          </div>
          <span aria-hidden className="pn10-seta" style={{ position: "absolute", left: DENTRO_V4.descX, top: CAPA_V4.altura - 46 - 44, width: 44, height: 44, boxSizing: "border-box",
            border: `1.5px solid ${PRETO}`, borderRadius: 999, display: "grid", placeItems: "center", ["--tinta" as string]: PRETO, ["--faixa" as string]: PALETA.amarelo } as CSSProperties}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="7" y1="17" x2="17" y2="7" /><polyline points="8 7 17 7 17 16" />
            </svg>
          </span>
        </CartaoV4>
      </TrilhaV4>

      {/* ————— o pé (v4): o título na c1, a ação em pílula 44 depois dele e
          o resumo à direita, terminando na c23 (a fonte em cinza em cima) ————— */}
      <div ref={tituloPeRef} style={tituloDoPeV4("Ferramentais")}>Ferramentais</div>
      {podeCadastrar && (
        <button onClick={abrirCadastro} className="np4-pilula"
          style={{ position: "absolute", left: pilulaPeX, top: TOPO_PILULA_PE_V4, height: PILULA_PE_ALT_V4, boxSizing: "border-box", padding: "2px 22px 0", border: `2.21px solid ${PRETO}`,
            borderRadius: 999, display: "flex", alignItems: "center", background: "transparent", font: `500 20.5px/1 ${INTER}`, letterSpacing: "-.014em", color: PRETO,
            cursor: "pointer", whiteSpace: "nowrap", zIndex: 3 }}>Cadastrar faca nova</button>
      )}
      <ResumoDoPeV4 linhas={[
        /* A Relação não abriu: o aviso no lugar da fonte, em preto. A conta de
           baixo sai do catálogo embutido no hub (ou da última leitura), e só a
           data sumindo da "Fonte" não dizia isso a ninguém (06/10/2026). A
           data sai no fuso do navegador: o servidor manda em UTC, e cortar o
           texto punha a edição feita depois das 21h no dia seguinte. */
        relacaoFalhou ? <span key="fora" role="status">A Relação de Ferramentais não abriu agora.</span> : (
          <span key="fonte" style={{ color: CINZA }}>
            Fonte: Relação de Ferramentais{relacaoRaw?.atualizadaEm ? `, atualizada em ${new Date(relacaoRaw.atualizadaEm).toLocaleDateString("pt-BR")}` : ""}
          </span>
        ),
        relacaoFalhou ? "A lista pode estar incompleta." : undefined,
        carregando ? "Lendo a Relação de Ferramentais…" : `${total} facas em uso, em oito famílias`,
        !carregando && semZ > 0 ? `${semZ} ${semZ === 1 ? "faca" : "facas"} sem Z arquivado` : undefined,
      ]} />

      {/* ————— a família aberta ————— */}
      {familiaAberta && (
        <PainelFamilia familia={familiaAberta} indice={FAMILIAS.indexOf(familiaAberta)}
          facas={porSistema.get(familiaAberta.sistema) ?? []} todas={vivas} zs={zs}
          contagem={Object.fromEntries(FAMILIAS.map((f) => [f.sistema, porSistema.get(f.sistema)?.length ?? 0]))}
          aoTrocarFamilia={setAberta}
          busca={busca} setBusca={setBusca} fechar={fecharPainel} aoAmpliar={abrirDesenho} aoComparar={abrirComparando} />
      )}

      {/* a área dos porta-clichês */}
      {portasAbertas && (
        <PortaClichesHub10 portas={portas ?? []} lendo={portasLendo} falhou={portasFalhou} fechar={() => setPortasAbertas(false)} />
      )}

      {desenhoAberto && (
        /* O visor compara SOZINHO, lado a lado: é o único lugar da comparação */
        <VisorDesenho desenho={desenhoAberto} fechar={() => setDesenhoAberto(null)}
          comecarComparando={visorComparando} todas={vivas} zs={zs} />
      )}

      {/* ————— cadastrar faca nova ————— */}
      {cadastroAberto && (
        <div onClick={fecharCadastro}
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(37,36,37,.78)" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ boxSizing: "border-box", width: 660, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, overflow: "hidden", boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>
            <div style={{ padding: "26px 36px 20px", background: familiaCadastro ? TOM[FAMILIAS.indexOf(familiaCadastro)] : AZUL_CLARO, borderBottom: `1px solid ${PRETO}` }}>
              <div style={{ font: `700 13px/1.2 ${INTER}`, letterSpacing: ".16em", textTransform: "uppercase", opacity: .6 }}>Faca nova{familiaCadastro ? ` · ${familiaCadastro.nome}` : ""}</div>
              <div style={{ ...FR, fontSize: 40, lineHeight: 1, letterSpacing: "-.03em", marginTop: 10 }}>Cadastrar ferramental</div>
            </div>

            <div style={{ padding: "24px 36px 8px", display: "flex", flexDirection: "column", gap: 16 }}>
              {/* a família primeiro: dela saem as seções */}
              <div role="group" aria-label="Família" style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={{ font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA }}>Família</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {FAMILIAS.map((f) => (
                    <button key={f.sistema} onClick={() => { setCadastroEm(f.sistema); setNSecao(""); }} className="p10-flat" aria-pressed={cadastroEm === f.sistema}
                      style={{ height: 38, padding: "0 16px", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer", background: cadastroEm === f.sistema ? PRETO : "#fff", color: cadastroEm === f.sistema ? "#fff" : PRETO, font: `700 14px/1 ${INTER}`, whiteSpace: "nowrap" }}>{f.nome}</button>
                  ))}
                </div>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA }}>Código</span>
                <input value={nCod} onChange={(e) => setNCod(e.target.value)} autoFocus placeholder="FAC0275.01"
                  style={{ height: 48, boxSizing: "border-box", padding: "0 18px", border: `1.5px solid ${codigoRepetido ? PALETA.perigo : PRETO}`, borderRadius: 999, outline: "none", font: `600 18px/1 ${INTER}`, color: PRETO }} />
                {codigoRepetido && <span style={{ fontSize: 14, color: PALETA.perigo }}>Esse código já está no catálogo.</span>}
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <span style={{ font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA }}>Medida</span>
                <input value={nMedida} onChange={(e) => setNMedida(e.target.value)} placeholder="40×60"
                  style={{ height: 48, boxSizing: "border-box", padding: "0 18px", border: `1.5px solid ${PRETO}`, borderRadius: 999, outline: "none", font: `600 18px/1 ${INTER}`, color: PRETO }} />
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={{ font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA }}>Seção</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {secoesDaFamilia.map((s) => (
                    <button key={s} onClick={() => setNSecao(s)} className="p10-flat"
                      style={{ height: 38, padding: "0 16px", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer", background: nSecao === s ? PRETO : "#fff", color: nSecao === s ? "#fff" : PRETO, font: `700 14px/1 ${INTER}`, whiteSpace: "nowrap" }}>{s}</button>
                  ))}
                  {!cadastroEm
                    ? <span style={{ fontSize: 16, color: CINZA }}>Escolha a família para ver as seções dela.</span>
                    : secoesDaFamilia.length === 0 && <span style={{ fontSize: 16, color: CINZA }}>Esta família ainda não tem seções. O cadastro entra sem seção.</span>}
                </div>
              </div>
            </div>

            {/* o pé na mesma margem de 36 do corpo: o texto começa na coluna dos
                campos e o último botão termina onde eles terminam (Augusto,
                05/10/2026: "aprimorar alinhamento do texto em relação aos cards") */}
            <div style={{ marginTop: 20, padding: "16px 36px", background: PRETO, display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#8f8d8f" }}>
                O desenho em PDF continua indo para a pasta da Relação de Ferramentais.
              </span>
              <button onClick={fecharCadastro} className="p10-flat"
                style={{ flex: "none", height: 48, padding: "0 22px", border: "1.5px solid #555355", borderRadius: 999, background: "none", color: "#f1f1f1", font: `600 16px/1 ${INTER}`, cursor: "pointer" }}>Cancelar</button>
              <button onClick={gravarFaca} disabled={!podeGravar || codigoRepetido}
                style={{ flex: "none", height: 48, padding: "0 26px", border: "none", borderRadius: 999, font: `800 16px/1 ${INTER}`, whiteSpace: "nowrap", cursor: podeGravar && !codigoRepetido ? "pointer" : "not-allowed", background: podeGravar && !codigoRepetido ? PALETA.amareloForte : "#4a484a", color: podeGravar && !codigoRepetido ? PRETO : CINZA }}>
                {gravando ? "Cadastrando…" : "Cadastrar faca"}
              </button>
            </div>
          </div>
        </div>
      )}

      {emPopup ? (
        /* no pop-up, a faixa do topo diz o que é e fecha; o menu do hub fica
           na tela de baixo */
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 112, background: FUNDO, zIndex: 40 }}>
          <div style={{ ...tituloDoPopup, position: "absolute", left: 80, top: 34 }}>Catálogo de facas</div>
          <button onClick={emPopup.aoFechar} className="p10-flat"
            style={{ position: "absolute", right: 80, top: 34, height: 44, padding: "0 26px", boxSizing: "border-box", border: `2.21px solid ${PRETO}`, borderRadius: 999, background: "transparent", color: PRETO, font: `500 20.5px/1 ${INTER}`, letterSpacing: "-.014em", cursor: "pointer" }}>Fechar</button>
        </div>
      ) : (
        <BarraTopoHub10 profile={profile} paginaAtiva="Facas" aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis} />
      )}

      {aviso && <AvisoV1a texto={aviso} tipo="alerta" onFechar={() => setAviso("")} />}
    </Palco>
  );
}

/** o título da faixa do pop-up: Fraunces 40, a tinta na c1 */
const tituloDoPopup: CSSProperties = { ...FR, fontSize: 40, lineHeight: "44px", letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO };


/* ————— dentro do cartão: as medidas e o desenho da faca —————
   Primeiro foi o handoff `inside facas.svg` (duas metades: a lista à
   esquerda, a ficha em branco à direita). Desde 28/09/2026 é a diagramação
   do Éminente, descrita logo abaixo.

   A medida vem GRANDE de propósito: quem procura faca procura por medida, não
   por código — "tem uma 40x60?" é a pergunta que se ouve na fábrica. O código
   aparece na ficha, que é onde ele serve. */

const ALTURA = 968;             /* 1080 menos a barra do topo */

/* ————— dentro da família: a diagramação do Éminente —————
   Referência do Augusto (28/09/2026): a página "Work" do site Éminente, da
   Obys. Dela vêm a diagramação e o funcionamento; tipos, cores, botões e
   margens seguem as regras do hub ("a diagramação e funcionamento, as regras
   de design do hub ainda continuam"). Um livro aberto, e as duas páginas com
   a mesma ordem: em cima um item em cada ponta, no meio o conteúdo, embaixo
   a faixa de informação.
   - página esquerda: branca, como a área do desenho era antes, e o PDF em
     toda ela, de filete a filete ("o pdf deve abrir em toda área");
   - uma linha vertical só, separando o desenho da lista (Augusto: "o
     problema era a quantidade de linhas");
   - página direita: a lista, mais estreita que a do Éminente (medida é curta,
     nome de cliente não), com filete entre as linhas e a medida ativa em
     preto e sublinhada;
   - a família e o Comparar em pé no trilho da margem (c0), como a marca e o
     "Contents" do Éminente (o título grande saiu: quem entrou já sabe onde
     está); no rodapé, a medida, o código e a ficha do cilindro em casas de
     duas colunas de um lado, e a busca e a contagem do outro;
   - parar o mouse numa medida abre ela, sem clique. */
/* ————— a grade —————
   A do hub: 24 colunas de 80 e 67 linhas de 1080/67 (a prancha `inside
   facas.svg`; no hub de teste, Alt+G desenha as duas por cima da tela). Como
   nas páginas da Obys que o Augusto mandou de referência ("veja como o
   alinhamento segue sempre o grid", 28/09/2026), tudo aqui cai numa linha
   dela: a tinta do texto em cima de uma coluna, os filetes e as linhas da
   lista em cima de uma linha. */
const LINHA_DA_GRADE = 1080 / 67;
/** A linha k da grade (contada do alto do palco) em coordenadas do painel, que começa em 112. */
const linhaDoPainel = (k: number) => k * LINHA_DA_GRADE - 112;
/* A única linha vertical, na coluna 15. A lista não precisa de meia tela ("o
   tamanho da área dos números das facas pode ser menor na largura", Augusto,
   28/09/2026): fica com 9 colunas, e o PDF com 15. */
/* Os degradês das seções "3 cores" e "4 cores", feitos dos SVGs do Augusto
   (hubv3/facas 3 cores.svg e facas 4 cores.svg) e clareados pela metade com
   branco: ele pediu mais claro que o original (30/09/2026). */
const DEGRADES: Record<string, string> = { "3 cores": "/fer10/degrade-3cores.webp", "4 cores": "/fer10/degrade-4cores.webp" };
const degradeDaSecao = (s: string | null) => (s ? DEGRADES[s.trim().toLowerCase().replace(/\s+/g, " ")] ?? null : null);
const IMAGENS_DOS_DEGRADES = Object.values(DEGRADES);

const LV_DIVISA = 1200;
/* As duas páginas com as mesmas margens, contadas da borda de cada uma: uma
   coluna. O texto começa em cima da coluna (c1 = 80, a da marca R2 na barra
   do topo; c16 = 1280) e os controles terminam na coluna da outra ponta
   (c14 = 1120; c23 = 1840). Antes o texto ficava a 76, quatro pixels fora. */
const LV_TEXTO_ESQ = 80;
const LV_DESENHO_FIM = LV_DIVISA - 80;
const LV_TEXTO_DIR = LV_DIVISA + 80;
/* Os filetes nas linhas 15 e 63 da grade e, entre eles, oito medidas de seis
   linhas cada: as linhas da lista caem nas linhas 21, 27, 33 ... 57. A faixa
   de baixo fica com as quatro últimas (63 a 67), e o que vai nela se centra
   na 65. */
const LV_FIL_TOPO = linhaDoPainel(15);                     /* 129,8 */
const LV_FIL_PE = linhaDoPainel(63);                       /* 903,5 */
const LV_LINHAS = 8;
const LV_LINHA = (LV_FIL_PE - LV_FIL_TOPO) / LV_LINHAS;    /* 96,7: seis linhas da grade */
/* A página do desenho não tem mais item na linha de cabeçalho (a família e o
   Comparar foram para o trilho), e a faixa vazia em cima deixava o desenho
   baixo na tela ("o desenho do pdf está mais pra baixo", Augusto,
   28/09/2026). A área do desenho vai da linha 8 à 62 da grade: 16 px abaixo
   da barra do topo e 16 px acima do filete do rodapé. O filete de cima fica
   só na página da lista. */
const LV_AREA_TOPO = linhaDoPainel(8);
const LV_AREA_PE = linhaDoPainel(62);
/* O corpo da lista: 86, e não os 96 do hub. No Éminente a letra ocupa 62% da
   altura da linha (maiúscula de 46 num passo de 74) e sobra ar entre um nome e
   outro; em 96 ela ocupava 70% e a lista ficava apertada ("os itens têm um bom
   espaço para ar entre eles", Augusto, 28/09/2026). */
const LV_CORPO = 86;
/* Onde o navegador põe a linha de base numa linha de altura lh: arredonda a
   ascendente e a descendente da fonte para pixels inteiros e divide o resto
   da entrelinha em cima e embaixo, arredondando para baixo (medido no
   Chrome: sem o arredondamento, a base caía meio pixel acima da linha da
   grade). */
function baseDaLinha(corpo: number, lh: number, ascendente: number, descendente: number): number {
  const asc = Math.round(corpo * ascendente), desc = Math.round(corpo * descendente);
  return asc + Math.floor((lh - asc - desc) / 2);
}
/* A linha de base de cada medida na quinta das suas seis linhas da grade: a
   letra senta a uma linha do filete, como os nomes do Éminente. É quanto
   descer a partir da base que a entrelinha daria (Fraunces: 0,982 do corpo
   acima da base, 0,259 abaixo). */
const LV_BASE_AJUSTE = 5 * LINHA_DA_GRADE - baseDaLinha(LV_CORPO, LV_LINHA, 0.982, 0.259);
/* A tinta de cada texto que abre uma coluna cai em cima dela. A folga lateral
   muda de letra para letra e de corpo para corpo (na lista, o "4" encosta na
   origem e o "5" tem 3 px; na Inter 24, o "E" tem 1 px). Medida uma vez por
   fonte e caractere, no canvas; enquanto a fonte não carregou, vale a
   reserva. */
const FOLGAS = new Map<string, number>();
function folga(fonte: string, c: string, reserva: number): number {
  const chave = `${fonte}|${c}`;
  const f = FOLGAS.get(chave);
  if (f != null) return f;
  if (!c || typeof document === "undefined" || !document.fonts?.check(fonte)) return reserva;
  const cv = document.createElement("canvas").getContext("2d");
  if (!cv) return reserva;
  cv.font = fonte;
  const medida = -cv.measureText(c).actualBoundingBoxLeft;
  FOLGAS.set(chave, medida);
  return medida;
}
const folgaDaLista = (c: string) => folga(`600 ${LV_CORPO}px Fraunces`, c, 3);
const folgaInter = (peso: number, corpo: number, c: string) => folga(`${peso} ${corpo}px Inter`, c, 1);
const LV_FILETE = "rgba(0,0,0,.12)";
/* O PDF entre as margens da página (c1 a c14) e na área do desenho (linhas 8
   a 62), sem a margem branca da própria ficha (ver useTintaDoDesenho): a
   ficha em pé encosta a tinta nas linhas 8 e 62, a deitada nas colunas 1 e
   14. */
const LV_DESENHO = { x: LV_TEXTO_ESQ, y: LV_AREA_TOPO, w: LV_DESENHO_FIM - LV_TEXTO_ESQ, h: LV_AREA_PE - LV_AREA_TOPO };
/* O rodapé da página do desenho: uma casa de duas colunas para cada
   informação (c1, c3, c5 ... c13), o rótulo com a base na linha 65 da grade e
   o valor na 66. */
const RODAPE_CASA = 160;
const RODAPE_CASAS = 7;
/* Onde a Inter põe a linha de base numa linha de altura lh (ascendente de
   0,96875 do corpo, descendente de 0,2421875; ver baseDaLinha). */
const baseInter = (corpo: number, lh: number) => baseDaLinha(corpo, lh, 0.96875, 0.2421875);

/* ————— o desenho de verdade —————
   O quadro de cotas que eu gerava era uma REPRESENTAÇÃO: a etiqueta repetida
   no cilindro, montada a partir da medida. Servia de ilustração e não de
   desenho — a faca real tem contorno, furos, sangria, e nada disso sai de
   "40×60". O desenho existe: são os 353 PDFs da Relação, e o hub já sabe lê-los.

   Cada PDF vira PNG uma vez (pdf.js) e fica guardado no acervo pelo próprio
   hub, então a segunda abertura é imediata. O quadro gerado continua como
   reserva, para a faca que ainda não tem desenho arquivado. */
const DESENHOS = new Map<string, string>();

/** Largura real de um PNG em data-url, sem pôr nada na tela. */
const larguraDaImagem = (src: string) =>
  new Promise<number>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth);
    img.onerror = () => resolve(0);
    img.src = src;
  });

/* O PDF original, em bytes. Guardado porque o visor usa duas vezes — para
   renderizar grande e para baixar — e cada leitura atravessa a rede até o
   share. */
const PDFS = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
function pdfDaFaca(arquivo: string): Promise<Uint8Array<ArrayBuffer>> {
  let p = PDFS.get(arquivo);
  if (!p) {
    p = (getPdfFaca({ data: { arquivo } }) as Promise<{ dataBase64: string }>)
      .then((r) => Uint8Array.from(atob(r.dataBase64), (c) => c.charCodeAt(0)));
    p.catch(() => PDFS.delete(arquivo));   // falhou: a próxima tentativa lê de novo
    PDFS.set(arquivo, p);
  }
  return p;
}

async function desenhoDaFaca(arquivo: string): Promise<string> {
  const guardado = DESENHOS.get(arquivo);
  if (guardado) return guardado;

  const pronta = await getMiniaturaFaca({ data: { arquivo } }) as { dataBase64: string | null };
  if (pronta.dataBase64) {
    const png = `data:image/png;base64,${pronta.dataBase64}`;
    /* A miniatura guardada pode ser a de 320 que a tela antiga pediu, e aqui o
       desenho ocupa mais de mil pixels: esticar 320 borra a cota a ponto de
       não se ler a medida. Sendo pequena, refaz do PDF e regrava — a tela
       antiga também sai ganhando. */
    if (await larguraDaImagem(png) >= 700) {
      DESENHOS.set(arquivo, png);
      return png;
    }
  }

  const bin = await pdfDaFaca(arquivo);
  const url = URL.createObjectURL(new Blob([bin], { type: "application/pdf" }));
  try {
    /* 900px: o quadro tem 410 no palco, e o desenho é linha fina cheia de
       cota — em 320, que é o que a tela de Facas do V1a pede, a cota borra. */
    const png = await pdfPrimeiraPagina(url, 900, arquivo);
    const corpo = png.split(",")[1];
    if (corpo) void salvarMiniaturaFaca({ data: { arquivo, dataBase64: corpo } }).catch(() => { /* a miniatura é só cache (data/miniaturas-facas): sem ela o desenho continua aparecendo; a falha fica no log do servidor */ });
    DESENHOS.set(arquivo, png);
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ————— o desenho grande —————
   Clicar no desenho abre ele na tela inteira, para ler a cota miúda sem
   precisar baixar. A roda do mouse aproxima NO PONTO do cursor (é onde está a
   cota que se quer ler), arrastar move, e duplo clique alterna entre caber na
   tela e 1:1. "Baixar PDF" entrega o arquivo original do acervo, não a imagem:
   é o PDF que vai para a gravação.

   "Comparar" compara AQUI MESMO, lado a lado — o Augusto não quer ser
   devolvido ao painel no meio da leitura (25/09/2026). Por isso o visor é
   feito de colunas: uma faca é uma coluna, comparar são várias, e a vista é
   UMA só para todas. Aproximar numa aproxima o mesmo ponto nas outras, e
   arrastar move todas juntas — é o que deixa comparar a mesma cota nas duas. */
const LARG_VISOR = 2400;
const TOPO_VISOR = 112;
/* faixa com a medida e o código de cada coluna — só na comparação, quando o
   cabeçalho já não diz qual é qual */
const ROTULO_COLUNA = 64;
/* Na grade (Augusto, 30/09/2026, "ajustar alinhamento", marcando o título, a
   legenda e a divisa): a vaga ocupa as duas últimas colunas, então a divisa
   cai na c22, onde terminam os comandos do cabeçalho, e o "+" e o × ficam no
   mesmo eixo, a c23. Uma faca ocupa 22 colunas; duas, 11 cada; quatro (sem
   vaga), 6 cada. O texto de cada coluna (medida e legenda) começa 80 depois
   da borda dela: na primeira, na c1, embaixo do título. */
const VAGA_VISOR = 160;
const EIXO_DA_VAGA = 1920 - VAGA_VISOR / 2;
const RECUO_DA_COLUNA = 80;
/* quatro lado a lado em 1920 ainda dão ~425px de coluna; cinco já não se lê */
const MAX_NO_VISOR = 4;
const FOLGA_VISOR = 48;
const ZOOM_MAX = 12;

export type DesenhoAberto = { arquivo: string; medida: string; cod: string; sistema: string; secao: string };

const paraAberto = (f: Faca): DesenhoAberto => ({
  arquivo: f.arquivo || PDF_DE(f.cod).replace(/^facas\//, ""),
  medida: f.medida, cod: f.cod, sistema: f.sistema, secao: f.secao,
});
const nomeFamilia = (sistema: string) => FAMILIAS.find((f) => f.sistema === sistema)?.nome ?? sistema;

/** A vista, uma só para todas as colunas: `z` é o zoom relativo ao "cabe na
    coluna" (1 = 100%), e `px/py` é quanto o centro do desenho saiu do centro
    da coluna, em pixels do palco. */
type Vista = { z: number; px: number; py: number };
type Dim = { w: number; h: number };
const VISTA_INICIAL: Vista = { z: 1, px: 0, py: 0 };

const escalaQueCabeEm = (d: Dim, cw: number, ch: number) =>
  Math.max(0.01, Math.min((cw - FOLGA_VISOR * 2) / d.w, (ch - FOLGA_VISOR * 2) / d.h));

/** Onde o desenho fica na coluna para uma vista: escala e canto superior. */
function posicao(d: Dim, cw: number, ch: number, v: Vista) {
  const s = escalaQueCabeEm(d, cw, ch) * v.z;
  return { s, x: cw / 2 - (d.w * s) / 2 + v.px, y: ch / 2 - (d.h * s) / 2 + v.py };
}

async function baixarPdf(arquivo: string) {
  const bin = await pdfDaFaca(arquivo);
  const url = URL.createObjectURL(new Blob([bin], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url; a.download = arquivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* Um desenho numa coluna. Duas resoluções do mesmo PDF: a de 900 (a do
   módulo, que já está pronta) e a de 2400, que chega depois. Não é só para
   aparecer rápido: reduzir a de 2400 para os ~550px que o desenho ocupa quando
   cabe na tela é encolher 4 vezes num passo, e o navegador serrilha o traço
   fino — a cota fica com falhas. A de 900 aparece enquanto o desenho está
   pequeno na tela, e a de 2400 só quando o zoom pede mais pixels do que a de
   900 tem. As duas ficam montadas, uma por cima da outra, para a troca não
   piscar. */
function ColunaDesenho({ desenho, cw, ch, vista, escalaPalco, aoDim, aoErro }: {
  desenho: DesenhoAberto; cw: number; ch: number; vista: Vista; escalaPalco: number;
  aoDim: (arquivo: string, d: Dim) => void; aoErro: (m: string) => void;
}) {
  const { arquivo } = desenho;
  const [src, setSrc] = useState(() => DESENHOS.get(arquivo) ?? "");
  const [srcGrande, setSrcGrande] = useState("");
  const [largBase, setLargBase] = useState(0);
  const [dim, setDim] = useState<Dim | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!DESENHOS.get(arquivo)) void desenhoDaFaca(arquivo).then((p) => { if (vivo) setSrc(p); }).catch(() => {});
    void pdfDaFaca(arquivo)
      .then(async (bin) => {
        const url = URL.createObjectURL(new Blob([bin], { type: "application/pdf" }));
        try { return await pdfPrimeiraPagina(url, LARG_VISOR, arquivo); } finally { URL.revokeObjectURL(url); }
      })
      /* a grande NUNCA ocupa o lugar da leve: se ocupasse, as duas camadas
         seriam a de 2400 e o desenho pequeno voltaria a serrilhar */
      .then((grande) => { if (vivo) setSrcGrande(grande); })
      .catch(() => { if (vivo) aoErro("Não deu para abrir o desenho em tamanho grande."); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo]);

  const aoCarregar = (img: HTMLImageElement, base: boolean) => {
    if (!img.naturalWidth) return;
    /* só a imagem de BAIXO diz quantos pixels a versão leve tem */
    if (base) setLargBase(img.naturalWidth);
    if (dim) return;
    /* tamanho LÓGICO, sempre o da renderização grande: trocar a de 900 pela
       de 2400 não pode mudar o tamanho na tela */
    const d = { w: LARG_VISOR, h: Math.round((LARG_VISOR * img.naturalHeight) / img.naturalWidth) };
    setDim(d);
    aoDim(arquivo, d);
  };

  if (!src && !srcGrande) {
    return <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 16, color: CINZA }}>abrindo o desenho…</div>;
  }
  const p = dim ? posicao(dim, cw, ch, vista) : { s: 1, x: 0, y: 0 };
  /* `maxWidth/maxHeight: none`: o reset do Tailwind põe max-width 100% em
     toda <img>. Com 2400 de largura lógica numa área menor, a largura era
     cortada e a altura não — o desenho saía 24% mais alto que largo (a faca
     100×100 virava retângulo). */
  const estilo: CSSProperties = { position: "absolute", left: 0, top: 0, transformOrigin: "0 0",
    width: dim?.w, height: dim?.h, maxWidth: "none", maxHeight: "none",
    transform: `translate(${p.x}px, ${p.y}px) scale(${p.s})`, userSelect: "none", pointerEvents: "none" };
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  /* quantos pixels de tela o desenho ocupa agora na largura */
  const naTela = dim ? dim.w * p.s * escalaPalco * dpr : 0;
  /* sem a leve (falhou ou ainda não veio), a grande aparece sozinha */
  const usarGrande = !!srcGrande && (!src || !largBase || naTela > largBase * 1.15);
  return (
    <>
      {src && (
        <img src={src} alt={`Desenho técnico ${arquivo}`} draggable={false}
          onLoad={(e) => aoCarregar(e.currentTarget, true)}
          style={{ ...estilo, visibility: dim && !usarGrande ? "visible" : "hidden" }} />
      )}
      {srcGrande && (
        <img src={srcGrande} alt="" aria-hidden draggable={false}
          onLoad={(e) => aoCarregar(e.currentTarget, false)}
          style={{ ...estilo, visibility: dim && usarGrande ? "visible" : "hidden" }} />
      )}
    </>
  );
}

function VisorDesenho({ desenho, fechar, comecarComparando = false, todas, zs }: {
  desenho: DesenhoAberto; fechar: () => void;
  /** aberto pelo Comparar do trilho: já nasce comparando, com esta faca e o
      lugar para somar outra */
  comecarComparando?: boolean;
  /** o acervo inteiro, para somar à comparação */
  todas: Faca[];
  /** o Z que a equipe arquivou, para a legenda de cada coluna */
  zs: Record<string, ZArquivado>;
}) {
  const area = useRef<HTMLDivElement | null>(null);
  const [lista, setLista] = useState<DesenhoAberto[]>([desenho]);
  const [comparando, setComparando] = useState(comecarComparando);
  const [vista, setVista] = useState<Vista>(VISTA_INICIAL);
  const [dims, setDims] = useState<Record<string, Dim>>({});
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [seletor, setSeletor] = useState(false);
  const [buscaSel, setBuscaSel] = useState("");
  const [escalaPalco, setEscalaPalco] = useState(1);
  /* altura natural da legenda de cada coluna — a faixa de baixo usa a MAIOR,
     para todas as colunas terem a mesma área de desenho (a vista é uma só, e
     com alturas diferentes o "mesmo ponto" não seria o mesmo) */
  const [alturas, setAlturas] = useState<Record<string, number>>({});

  const fecharSeletor = useCallback(() => { setSeletor(false); setBuscaSel(""); }, []);
  /* ESC fecha o que estiver por cima: o seletor, e só depois o visor */
  useEscDoTopo(!seletor, NIVEL.caixa, fechar);
  useEscDoTopo(seletor, NIVEL.pantone, fecharSeletor);

  /* O palco é escalado para caber na janela: o que o mouse mede em pixels de
     tela precisa voltar para pixels do palco. */
  useEffect(() => {
    const medir = () => {
      const el = area.current;
      if (el && el.offsetWidth) setEscalaPalco(el.getBoundingClientRect().width / el.offsetWidth || 1);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  /* ————— geometria das colunas ————— */
  const AREA_W = 1920, AREA_H = 1080 - TOPO_VISOR;
  const n = lista.length;
  const temVaga = comparando && n < MAX_NO_VISOR;
  const cw = (AREA_W - (temVaga ? VAGA_VISOR : 0)) / n;
  const topoImg = comparando ? ROTULO_COLUNA : 0;
  /* a legenda embaixo de cada coluna, como no módulo do painel: seção,
     dentes, repetições, diâmetro — o que se compara além do desenho */
  const rodape = comparando ? Math.max(56, ...lista.map((d) => alturas[d.cod] ?? 0)) : 0;
  const ch = AREA_H - topoImg - rodape;

  /** Em que coluna está o ponteiro, e onde dentro da área do desenho dela. */
  const colunaEm = (clientX: number, clientY: number) => {
    const el = area.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const x = (clientX - r.left) / escalaPalco, y = (clientY - r.top) / escalaPalco - topoImg;
    const i = Math.floor(x / cw);
    /* acima (rótulo) ou abaixo (legenda) da área do desenho não conta */
    if (i < 0 || i >= n || y < 0 || y > ch) return null;
    return { i, mx: x - i * cw, my: y };
  };

  /* zoom em torno de um ponto da coluna i: o ponto do desenho que está sob o
     cursor continua sob o cursor. As outras colunas andam junto porque a
     vista é a mesma. */
  const zoomEm = (fator: number, i: number, mx: number, my: number) => {
    const d = dims[lista[i]?.arquivo];
    setVista((v) => {
      const z = Math.min(ZOOM_MAX, Math.max(0.5, v.z * fator));
      if (!d) return { ...v, z };
      const a = posicao(d, cw, ch, v), b = posicao(d, cw, ch, { ...v, z });
      const u = (mx - a.x) / a.s, w = (my - a.y) / a.s;
      return { z, px: v.px + (mx - u * b.s - b.x), py: v.py + (my - w * b.s - b.y) };
    });
  };
  const zoomNoMeio = (fator: number) => zoomEm(fator, 0, cw / 2, ch / 2);

  /* roda do mouse — o ouvinte é registrado uma vez e chama sempre a versão
     mais nova do cálculo, que depende das colunas do momento */
  const aoRodarRef = useRef<(e: WheelEvent) => void>(() => {});
  aoRodarRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const c = colunaEm(e.clientX, e.clientY);
    if (!c) return;
    /* fator contínuo: trackpad manda dezenas de passos pequenos, a roda
       manda poucos grandes — os dois dão um zoom proporcional ao giro */
    zoomEm(Math.exp(-e.deltaY * 0.0016), c.i, c.mx, c.my);
  };
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ouvir = (e: WheelEvent) => aoRodarRef.current(e);
    el.addEventListener("wheel", ouvir, { passive: false });
    return () => el.removeEventListener("wheel", ouvir);
  }, []);

  /* arrastar para mover — todas as colunas juntas */
  const arrasto = useRef<{ x0: number; y0: number; vx: number; vy: number } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const aoApertar = (e: PointerEventReact<HTMLDivElement>) => {
    /* botão dentro da área (baixar, tirar, o "+") não começa arrasto: com a
       captura do ponteiro na área, o clique dele se perderia */
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    /* caneta e toque às vezes chegam com um ponteiro que o navegador já
       soltou, e aí a captura lança erro — o arrasto segue sem ela */
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* segue */ }
    arrasto.current = { x0: e.clientX, y0: e.clientY, vx: vista.px, vy: vista.py };
    setArrastando(true);
  };
  const aoMover = (e: PointerEventReact<HTMLDivElement>) => {
    const a = arrasto.current;
    if (!a) return;
    if (e.buttons === 0) { arrasto.current = null; setArrastando(false); return; }
    setVista((v) => ({ ...v, px: a.vx + (e.clientX - a.x0) / escalaPalco, py: a.vy + (e.clientY - a.y0) / escalaPalco }));
  };
  const aoSoltar = () => { arrasto.current = null; setArrastando(false); };

  /* duplo clique: cabendo, vai para 1:1 no ponto clicado; senão volta a caber */
  const aoDuploClique = (e: MouseEventReact<HTMLDivElement>) => {
    const c = colunaEm(e.clientX, e.clientY);
    if (!c) return;
    const d = dims[lista[c.i].arquivo];
    if (!d) return;
    if (vista.z > 1.05) { setVista(VISTA_INICIAL); return; }
    zoomEm(1 / escalaQueCabeEm(d, cw, ch) / vista.z, c.i, c.mx, c.my);
  };

  /* ————— comparar ————— */
  const ligarComparacao = () => {
    setLista([lista[0]]);
    setComparando(true);
    setVista(VISTA_INICIAL);
  };
  const sairDaComparacao = () => {
    setLista([lista[0]]);
    setComparando(false);
    setVista(VISTA_INICIAL);
  };
  const tirar = (cod: string) => setLista((l) => (l.length > 1 ? l.filter((d) => d.cod !== cod) : l));
  const somar = (f: Faca) => {
    setLista((l) => (l.length < MAX_NO_VISOR && !l.some((d) => d.cod === f.cod) ? [...l, paraAberto(f)] : l));
    fecharSeletor();
  };

  const casaSel = criarBusca(buscaSel, { deitada: true });
  const candidatas = todas
    .filter((f) => !lista.some((d) => d.cod === f.cod)
      && casaSel(f.cod, f.medida, f.secao, nomeFamilia(f.sistema), apelidoDaMedida(f.medida)))
    /* a família da primeira faca vem na frente: é de onde se compara quase sempre */
    .sort((a, b) => Number(b.sistema === lista[0].sistema) - Number(a.sistema === lista[0].sistema));

  const baixar = async (arquivo: string) => {
    if (baixando) return;
    setBaixando(arquivo);
    try { await baixarPdf(arquivo); }
    catch { setErro("Não deu para baixar o PDF. Tente de novo."); }
    finally { setBaixando(null); }
  };

  const pct = Math.round(vista.z * 100);
  /* Regra 60/30/10 do Augusto (25/09/2026): 60% neutro — o branco do desenho;
     30% a cor secundária — o cabeçalho, no mesmo tom do card da família, que
     diz de onde a faca veio; 10% o destaque — o preto, só no comando
     principal (Baixar PDF com uma faca; Sair da comparação comparando). Os
     outros comandos ficam brancos de contorno para não disputar com ele. */
  const idxFamilia = FAMILIAS.findIndex((f) => f.sistema === lista[0].sistema);
  const corDaFamilia = idxFamilia >= 0 ? TOM[idxFamilia] : FUNDO;
  const PILULA: CSSProperties = { height: 46, boxSizing: "border-box", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer",
    fontFamily: INTER, fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 10 };
  const REDONDO = (tam: number): CSSProperties => ({ flex: "none", width: tam, height: tam, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center",
    background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" });
  const ICONE_COMPARAR = (cor: string) => (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={2.2} strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="7" height="14" rx="1.5" /><rect x="14" y="5" width="7" height="14" rx="1.5" />
    </svg>
  );
  const ICONE_BAIXAR = (cor: string, tam = 18) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" />
    </svg>
  );

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa, background: "#fff", color: PRETO, fontFamily: INTER }}>
      {/* cabeçalho: o que é, à esquerda; os comandos, à direita — e o ×
          sozinho no canto, longe dos outros, pela mesma razão do "Comparar".
          Na grade: a tinta do título na c1 (era 76), os comandos terminando
          na c22 (a divisa da vaga) e o × centrado na c23, em cima do "+". */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: TOPO_VISOR, boxSizing: "border-box", background: corDaFamilia, borderBottom: `1px solid ${PRETO}`, zIndex: 2 }}>
        <div style={{ position: "absolute", left: 80 - folga("600 48px Fraunces", comparando ? "C" : (lista[0].medida || lista[0].cod).charAt(0), 3), top: 0, height: TOPO_VISOR, display: "flex", alignItems: "baseline", gap: 18, paddingTop: 36, boxSizing: "border-box" }}>
          {comparando ? (
            <>
              <span style={{ ...FR, fontSize: 48, lineHeight: 1, letterSpacing: "-.03em", whiteSpace: "nowrap" }}>Comparação</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: CINZA, whiteSpace: "nowrap" }}>{n === 1 ? "1 faca" : `${n} facas lado a lado`}</span>
            </>
          ) : (
            <>
              <span style={{ ...FR, fontSize: 48, lineHeight: 1, letterSpacing: "-.03em", whiteSpace: "nowrap" }}>{lista[0].medida || lista[0].cod}</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: CINZA, whiteSpace: "nowrap" }}>{lista[0].cod}</span>
            </>
          )}
        </div>

        <div style={{ position: "absolute", right: VAGA_VISOR, top: 33, height: 46, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", height: 46, boxSizing: "border-box", border: `1.5px solid ${PRETO}`, borderRadius: 999, background: "#fff", overflow: "hidden" }}>
            <button onClick={() => zoomNoMeio(1 / 1.25)} className="p10-flat" aria-label="Afastar"
              style={{ width: 50, height: "100%", padding: 0, border: "none", background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
            <span style={{ minWidth: 64, textAlign: "center", fontSize: 16, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
            <button onClick={() => zoomNoMeio(1.25)} className="p10-flat" aria-label="Aproximar"
              style={{ width: 50, height: "100%", padding: 0, border: "none", background: "none", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>
          <button onClick={() => setVista(VISTA_INICIAL)} className="p10-flat" style={{ ...PILULA, padding: "0 20px", background: "#fff" }}>
            Ajustar à tela
          </button>
          {/* as ações ficam num grupo à parte das de vista */}
          <span aria-hidden style={{ width: 22 }} />
          {comparando ? (
            <button onClick={sairDaComparacao} className="p10-flat" aria-pressed
              style={{ ...PILULA, padding: "0 22px 0 18px", background: PRETO, color: "#fff" }}>
              {ICONE_COMPARAR("#fff")}Sair da comparação
            </button>
          ) : (
            <>
              <button onClick={ligarComparacao} className="p10-flat" aria-pressed={false} title="Ver outras facas lado a lado com esta"
                style={{ ...PILULA, padding: "0 22px 0 18px", background: "#fff", color: PRETO }}>
                {ICONE_COMPARAR(PRETO)}Comparar
              </button>
              <button onClick={() => void baixar(lista[0].arquivo)} className="p10-flat" disabled={!!baixando}
                style={{ ...PILULA, padding: "0 22px 0 18px", background: PRETO, color: "#fff", cursor: baixando ? "wait" : "pointer" }}>
                {ICONE_BAIXAR("#fff")}{baixando ? "Baixando…" : "Baixar PDF"}
              </button>
            </>
          )}
        </div>

        <button onClick={fechar} className="p10-flat" aria-label="Fechar o desenho"
          style={{ ...REDONDO(46), position: "absolute", left: EIXO_DA_VAGA - 23, top: 33 }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
        </button>
      </div>

      {/* os desenhos, uma coluna por faca */}
      <div ref={area} onPointerDown={aoApertar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}
        onDoubleClick={aoDuploClique}
        style={{ position: "absolute", left: 0, top: TOPO_VISOR, width: AREA_W, height: AREA_H, overflow: "hidden",
          cursor: arrastando ? "grabbing" : "grab", touchAction: "none", background: "#fff" }}>
        {lista.map((d, i) => (
          <div key={d.cod} className="fer10-modulo"
            style={{ position: "absolute", left: i * cw, top: 0, width: cw, height: AREA_H, boxSizing: "border-box",
              borderRight: i < n - 1 || temVaga ? "1px solid rgba(0,0,0,.12)" : undefined }}>
            {comparando && (
              /* Medida e código de cada coluna, e as duas ações dela. O "tirar"
                 só aparece no hover da coluna — com quatro facas seriam quatro
                 × em repouso, e o Augusto já reclamou de tela cheia de x. */
              <div style={{ position: "absolute", left: 0, top: 0, width: cw, height: ROTULO_COLUNA, boxSizing: "border-box",
                padding: `0 18px 0 ${RECUO_DA_COLUNA - folga("600 26px Fraunces", (d.medida || d.cod).charAt(0), 3)}px`,
                borderBottom: "1px solid rgba(0,0,0,.12)", display: "flex", alignItems: "center", gap: 12, background: "#fff", cursor: "default" }}>
                <span style={{ flex: "none", ...FR, fontSize: 26, lineHeight: 1, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{d.medida || d.cod}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {d.cod} · {nomeFamilia(d.sistema)}
                </span>
                <button onClick={() => void baixar(d.arquivo)} className="p10-flat" disabled={!!baixando}
                  aria-label={`Baixar o PDF de ${d.cod}`} title="Baixar PDF"
                  style={{ ...REDONDO(34), cursor: baixando ? "wait" : "pointer" }}>
                  {ICONE_BAIXAR(PRETO, 15)}
                </button>
                {n > 1 && (
                  <button onClick={() => tirar(d.cod)} className="p10-flat fer10-tirar" aria-label={`Tirar ${d.cod} da comparação`}
                    style={REDONDO(34)}>
                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                  </button>
                )}
              </div>
            )}
            <div style={{ position: "absolute", left: 0, top: topoImg, width: cw, height: ch, overflow: "hidden" }}>
              <ColunaDesenho desenho={d} cw={cw} ch={ch} vista={vista} escalaPalco={escalaPalco}
                aoDim={(arquivo, dd) => setDims((m) => (m[arquivo] ? m : { ...m, [arquivo]: dd }))} aoErro={setErro} />
            </div>
            {comparando && (
              <div style={{ position: "absolute", left: 0, top: AREA_H - rodape, width: cw, height: rodape, boxSizing: "border-box",
                borderTop: "1px solid rgba(0,0,0,.12)", background: "#fff", cursor: "default", overflow: "hidden" }}>
                <MedeAltura aoMedir={(h) => setAlturas((m) => (m[d.cod] === h ? m : { ...m, [d.cod]: h }))}>
                  <LegendaFaca faca={{ cod: d.cod, medida: d.medida, sistema: d.sistema, secao: d.secao, arquivo: d.arquivo }}
                    arquivado={zs[chaveFaca(d.cod)] ?? null} style={{ padding: `14px 24px 16px ${RECUO_DA_COLUNA - folgaInter(400, 14, "S")}px` }} />
                </MedeAltura>
              </div>
            )}
          </div>
        ))}

        {temVaga && (
          /* o lugar vago é um BOTÃO, como na faixa do painel: um "+" diz
             sozinho que cabe mais uma */
          <button onClick={() => setSeletor(true)} className="p10-flat"
            style={{ position: "absolute", left: n * cw, top: 0, width: VAGA_VISOR, height: AREA_H, border: "none", background: "none",
              cursor: "pointer", display: "grid", placeItems: "center", alignContent: "center", gap: 14, padding: 0 }}>
            <span style={{ width: 62, height: 62, display: "grid", placeItems: "center", borderRadius: 999, background: AMARELO_MAIS, border: `1.5px solid ${PRETO}` }}>
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </span>
            <span style={{ font: `600 18px/1 ${INTER}`, color: PRETO, whiteSpace: "nowrap" }}>Adicionar faca</span>
          </button>
        )}
      </div>

      {/* ————— escolher a próxima ————— */}
      {seletor && (
        <>
          <div onClick={fecharSeletor} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.pantone - 1, background: "rgba(0,0,0,.18)" }} />
          <div style={{ position: "absolute", left: 1920 - VAGA_VISOR - 560, top: TOPO_VISOR + 40, width: 520, maxHeight: 700, zIndex: NIVEL.pantone, boxSizing: "border-box",
            background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 20, boxShadow: "0 30px 70px rgba(0,0,0,.28)",
            display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* cabeçalho na cor da família — os 30% da regra 60/30/10 */}
            <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "18px 22px 16px",
              background: corDaFamilia, borderBottom: `1px solid ${PRETO}` }}>
              <span style={{ ...FR, fontSize: 26, lineHeight: 1, letterSpacing: "-.03em" }}>Adicionar à comparação</span>
              <button onClick={fecharSeletor} className="p10-flat" aria-label="Fechar" style={REDONDO(33)}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <label style={{ flex: "none", margin: "16px 22px 14px", display: "flex", alignItems: "center", gap: 10, height: 44, boxSizing: "border-box",
              padding: "0 16px", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "text" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={buscaSel} onChange={(e) => setBuscaSel(e.target.value)} autoFocus
                placeholder="Medida, código ou tipo" aria-label="Procurar faca para comparar"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", font: `600 16px/1 ${INTER}`, color: PRETO }} />
            </label>
            <div style={{ flex: "none", padding: "0 22px 12px", font: `400 14px/1.4 ${INTER}`, color: CINZA }}>
              {candidatas.length} de {todas.length} facas do acervo
            </div>
            <div className="p10-trilha" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "0 10px 14px" }}>
              {candidatas.map((f) => (
                <button key={f.cod} className="p10-linha" onClick={() => somar(f)}
                  style={{ width: "100%", display: "flex", alignItems: "baseline", gap: 14, padding: "11px 12px", border: "none",
                    background: "none", cursor: "pointer", fontFamily: INTER, textAlign: "left", borderRadius: 10 }}>
                  <span style={{ flex: "none", ...FR, fontSize: 22, letterSpacing: "-.02em", color: PRETO }}>{f.medida || f.cod}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.cod}</span>
                  <span style={{ flex: "none", fontSize: 13, color: CINZA }}>{nomeFamilia(f.sistema)}</span>
                </button>
              ))}
              {candidatas.length === 0 && (
                <div style={{ padding: "18px 12px", fontSize: 16, color: CINZA }}>
                  {buscaSel.trim() ? "Nenhuma faca com esse código, medida ou tipo." : "Todas as facas já estão na comparação."}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {erro && <AvisoV1a texto={erro} tipo="alerta" onFechar={() => setErro("")} />}
    </div>
  );
}

const ROTULO_FICHA: CSSProperties = { font: `700 10.5px/1.25 ${INTER}`, letterSpacing: ".02em", color: "#5b595b" };
const VALOR_FICHA: CSSProperties = { font: `600 12px/1.25 ${INTER}`, color: PRETO, marginBottom: 9 };

/** Marca de cota: o tracinho que sai da caixa, como num desenho técnico. */
const COTA = { stroke: "#00a0e4", strokeWidth: 0.6, fill: "none" } as const;

function PainelFamilia({ familia, indice, facas, todas, zs, contagem, aoTrocarFamilia, busca, setBusca, fechar, aoAmpliar, aoComparar }: {
  familia: Familia; indice: number; facas: Faca[];
  /** o acervo inteiro (a comparação, no visor, atravessa famílias) */
  todas: Faca[];
  zs: Record<string, ZArquivado>;
  contagem: Record<string, number>;
  aoTrocarFamilia: (sistema: string) => void;
  busca: string; setBusca: (s: string) => void; fechar: () => void;
  aoAmpliar: (d: DesenhoAberto) => void;
  /** abre o visor já comparando: a comparação mora só nele */
  aoComparar: (d: DesenhoAberto) => void;
}) {
  /* Trocar de família sem fechar o painel. */
  const [familiasAberto, setFamiliasAberto] = useState(false);
  const fecharFamilias = useCallback(() => setFamiliasAberto(false), []);
  useEscDoTopo(familiasAberto, NIVEL.verTodos, fecharFamilias);
  const [secao, setSecao] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const lista = useRef<HTMLDivElement | null>(null);

  /* O degradê de "3 cores" e "4 cores" no fundo da lista (DerrameHub10):
     entra pelo canto como café no leite; trocando de uma para a outra, a nova
     derrama por cima; desligando, a cor esmaece. */
  const degrade = degradeDaSecao(secao);
  const comDegrade = !!degrade;

  /* ————— filtros do rodapé ————— */
  /* O handoff põe "Filtros" no pé da coluna, ao lado da busca. Os recortes de
     seção já estão lá em cima, então o que cabe aqui é o que a seção não diz:
     o Z do cilindro — agora que ele vem arquivado — e a faixa de largura.
     "Quais facas rodam no Z72?" e "tem alguma entre 30 e 40?" são as duas
     perguntas que se ouvem na produção. */
  const [filtrosAberto, setFiltrosAberto] = useState(false);
  const [zFiltro, setZFiltro] = useState<number | null>(null);
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  /* A medida que o cliente pediu ("82x43"). Não filtra: ORDENA — a mais
     próxima primeiro. Faca exata quase nunca existe, e o que a pessoa fazia
     era abrir uma por uma procurando a que chega mais perto. */
  const [proxima, setProxima] = useState("");
  /* Até quantos mm de diferença, em CADA dimensão, a faca ainda conta como
     próxima. Sem isso a busca só ordenava a família inteira e ficava vaga:
     depois das duas que servem vinham noventa que não servem (Augusto,
     25/09/2026). 5mm é o padrão porque é o que se aceita no dia a dia. */
  const [tolerancia, setTolerancia] = useState(5);

  const zDaFaca = (f: Faca) => zs[chaveFaca(f.cod)]?.z ?? null;
  const zDisponiveis = [...new Set(facas.map(zDaFaca).filter((z): z is number => z != null))]
    .sort((a, b) => a - b);

  /* Um campo por dimensão, e não faixa "de/até": ninguém procura faca por
     intervalo, procura pela medida que tem na mão. Casa por começo do número
     para não obrigar a digitar a vírgula inteira — "38" acha a 38,66. */
  const casaDimensao = (valor: number | undefined, txt: string) => {
    const t = txt.trim().replace(".", ",");
    if (!t) return true;
    if (valor == null) return false;
    const n = NUM(valor);
    if (n.startsWith(t)) return true;
    const real = APELIDO_DE[t];        /* "40" também acha a 38,66 */
    return !!real && n.startsWith(real);
  };

  /* "82x43", "82 x 43", "82X43", "82,5x43" — os números, na ordem largura ×
     altura. Um número só compara a largura. */
  const alvo = (() => {
    const n = MEDIDAS(proxima);
    return n.length ? { l: n[0], a: n[1] ?? null } : null;
  })();
  /** Diferença da faca para a medida pedida, em cada dimensão (faca − pedido).
      A faca vale nas DUAS orientações: uma 43×82 corta a etiqueta de 82×43
      com a etiqueta DEITADA no rolo, e a produção usa isso (Augusto,
      25/09/2026 — "deitada" é o nome que a fábrica usa; "girada" não se
      entendia). Fica a orientação que chega mais perto; `deitada` diz quando
      foi a outra, e aí L e A já são os da etiqueta como ela sai — é isso que
      se compara com o pedido. Empate fica com a reta: não há por que deitar
      à toa. */
  const diferenca = (f: Faca) => {
    if (!alvo) return null;
    const n = MEDIDAS(f.medida);
    if (!n.length) return null;
    const w = n[0], h = n[1] ?? n[0];
    if (alvo.a == null) return { dl: w - alvo.l, da: null, deitada: false };
    const reta = { dl: w - alvo.l, da: h - alvo.a, deitada: false };
    const outra = { dl: h - alvo.l, da: w - alvo.a, deitada: true };
    return Math.hypot(outra.dl, outra.da) < Math.hypot(reta.dl, reta.da) - 1e-9 ? outra : reta;
  };
  /* Distância pela diagonal: 2mm na largura e 3 na altura ficam mais perto
     que 0 na largura e 6 na altura — que é como se escolhe faca de verdade,
     olhando as duas medidas juntas. */
  const distancia = (f: Faca) => {
    const d = diferenca(f);
    return !d ? Infinity : d.da == null ? Math.abs(d.dl) : Math.hypot(d.dl, d.da);
  };

  const quantosFiltros = (zFiltro != null ? 1 : 0) + (largura.trim() ? 1 : 0) + (altura.trim() ? 1 : 0) + (alvo ? 1 : 0);

  /* a medida nos dois sentidos: "25x40" acha a 40×25 deitada (Augusto, 02/10/2026) */
  const casa = criarBusca(busca, { deitada: true });
  const casaBusca = (f: Faca) => casa(f.cod, f.medida, f.secao, apelidoDaMedida(f.medida));
  const filtradas = facas.filter((f) => {
    if (secao && (f.secao || "").trim() !== secao) return false;
    if (!casaBusca(f)) return false;
    if (zFiltro != null && zDaFaca(f) !== zFiltro) return false;
    const n = MEDIDAS(f.medida);
    if (!casaDimensao(n[0], largura)) return false;
    if (!casaDimensao(n[1], altura)) return false;
    return true;
  });
  /* Medida digitada: a exata primeiro, depois a que só começa igual e por
     último a deitada. "100x50" abria a 50X100, que vem antes na Relação
     (simulação 5, 05/10/2026; a Solicitação já punha a exata na frente).
     Busca que não é medida fica na ordem da Relação. */
  const medidaDigitada = normalizarBusca(busca).replace(/ /g, "");
  const medidaIgual = /^\d+(?:\.\d+)?x\d+(?:\.\d+)?$/.test(medidaDigitada)
    ? new RegExp(`(?<![\\d.])${medidaDigitada.replace(/\./g, "\\.")}(?![\\d.])`) : null;
  const casaReta = criarBusca(busca);
  const naOrdemDaBusca = medidaIgual
    ? filtradas.map((f, i) => {
      const partes = [f.cod, f.medida, f.secao, apelidoDaMedida(f.medida)];
      return { f, i, p: medidaIgual.test(alvoBusca(...partes)) ? 0 : casaReta(...partes) ? 1 : 2 };
    }).sort((a, b) => a.p - b.p || a.i - b.i).map((x) => x.f)
    : filtradas;
  /* Com a medida próxima: só as que ficam dentro da tolerância nas duas
     dimensões, da mais perto para a mais longe. Se nenhuma couber, as 3 mais
     perto assim mesmo — lista vazia não diz à pessoa o que existe, e "a mais
     perto tem 7mm a mais" já é resposta. Sem a medida, a ordem da Relação. */
  const MAIS_PERTO_SE_NENHUMA = 3;
  const dentroDaTolerancia = (f: Faca) => {
    const d = diferenca(f);
    return !!d && Math.abs(d.dl) <= tolerancia + 1e-9 && (d.da == null || Math.abs(d.da) <= tolerancia + 1e-9);
  };
  const ordenadas = alvo
    ? filtradas.map((f) => ({ f, d: distancia(f) })).filter((x) => x.d < Infinity).sort((x, y) => x.d - y.d).map((x) => x.f)
    : naOrdemDaBusca;
  const naTolerancia = alvo ? ordenadas.filter(dentroDaTolerancia) : ordenadas;
  /** nenhuma coube na tolerância: a lista mostra as poucas mais perto */
  const foraDaTolerancia = !!alvo && naTolerancia.length === 0 && ordenadas.length > 0;
  const achadas = foraDaTolerancia ? ordenadas.slice(0, MAIS_PERTO_SE_NENHUMA) : naTolerancia;
  const quantasDeitadas = alvo ? achadas.filter((f) => diferenca(f)?.deitada).length : 0;
  /* A pesquisa não acha nada nesta família, mas a faca existe em outra: diz
     em qual e leva até lá. Em Retangular, "fr2-067" dizia só "Nenhuma faca",
     e ela está em Tags (simulação 5, 05/10/2026). Ir até lá limpa a seção e
     os filtros, que eram desta família, para a faca aparecer. */
  const emOutras = busca.trim() && achadas.length === 0 && !facas.some(casaBusca)
    ? FAMILIAS.filter((fa) => fa.sistema !== familia.sistema)
      .map((fa) => ({ familia: fa, n: todas.filter((f) => f.sistema === fa.sistema && casaBusca(f)).length }))
      .filter((x) => x.n > 0)
    : [];
  /* A exata em outra família quando esta não tem a exata, só as parecidas:
     em Retangular, "60x40" mostrava 59,5×40 e 38,66×60 e calava a 40×60 de
     Tags, que a Solicitação oferece em 1º lugar (simulação 6, 07/10/2026).
     Exata é o número igual, reto ou deitado, sem apelido: a 59,5 é o "60" da
     fábrica, mas não é 60. O recado fica na 1ª casa da lista. */
  const ladosDaBusca = medidaIgual ? medidaDigitada.split("x").map(Number) : null;
  const exataDaBusca = (f: Faca): null | "reta" | "deitada" => {
    if (!ladosDaBusca) return null;
    const n = MEDIDAS(f.medida);
    if (n.length < 2) return null;
    const [l, a] = ladosDaBusca;
    const igual = (x: number, y: number) => Math.abs(x - y) < 1e-6;
    if (igual(n[0], l) && igual(n[1], a)) return "reta";
    return igual(n[0], a) && igual(n[1], l) ? "deitada" : null;
  };
  const exatasFora = ladosDaBusca && achadas.length > 0 && !facas.some((f) => exataDaBusca(f))
    ? FAMILIAS.filter((fa) => fa.sistema !== familia.sistema)
      .map((fa) => {
        const tipos = todas.filter((f) => f.sistema === fa.sistema).map(exataDaBusca).filter(Boolean);
        return { familia: fa, n: tipos.length, deitadas: tipos.filter((t) => t === "deitada").length };
      })
      .filter((x) => x.n > 0)
    : [];
  /* todas as exatas de fora são deitadas: o recado diz, como a lista diz "deitada" */
  const exatasForaDeitadas = exatasFora.length > 0 && exatasFora.every((x) => x.deitadas === x.n);
  /* com o recado, a lista começa na 2ª casa (as linhas continuam na grade) */
  const topoDaLista = LV_FIL_TOPO + (exatasFora.length ? LV_LINHA : 0);
  /* O vazio no painel Filtros diz de onde ele vem e o que fazer: sem filtro
     marcado, "Nenhuma faca com esses filtros" culpava filtros que não
     existiam, e o vazio era da pesquisa (simulação 6, 07/10/2026). */
  const vazioDosFiltros = quantosFiltros > 0 ? "Nenhuma faca com esses filtros"
    : busca.trim()
      ? (secao ? "Nenhuma faca com essa pesquisa neste recorte. Apague a pesquisa ou tire o recorte." : "Nenhuma faca com essa pesquisa. Apague a pesquisa para ver todas.")
      : secao ? "Nenhuma faca neste recorte. Clique nele de novo para ver todas."
        : "Nenhuma faca nesta família.";

  /* Mudou a medida pedida: a lista volta ao topo e a ficha abre a mais
     próxima — a escolha anterior era para outra pergunta. */
  useEffect(() => {
    if (!alvo) return;
    setEscolhida(null);
    if (lista.current) lista.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo?.l, alvo?.a, tolerancia]);

  const limparFiltros = () => { setZFiltro(null); setLargura(""); setAltura(""); setProxima(""); };
  const fecharFiltros = useCallback(() => setFiltrosAberto(false), []);
  useEscDoTopo(filtrosAberto, NIVEL.verTodos, fecharFiltros);

  /* As seções desta família, na ordem em que a Relação as escreve. */
  const secoes = [...new Set(facas.map((f) => (f.secao || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  /* A primeira da lista já abre a ficha: painel aberto com o lado direito vazio
     não diz para que ele serve. */
  const atual = achadas.find((f) => f.cod === escolhida) ?? achadas[0] ?? null;


  /* A roda do mouse rola a lista — são seis medidas por vez, e nenhuma família
     cabe inteira. Aqui a rolagem é vertical mesmo: a lista é uma coluna. */
  useEffect(() => { if (lista.current) lista.current.scrollTop = 0; }, [familia.sistema, secao, busca]);


  /* O funcionamento do Éminente: parar o mouse numa medida abre ela na página
     esquerda, sem clique. Um instante de espera, para o mouse que só atravessa
     a lista não trocar o desenho a cada linha. */
  const passando = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pararDePassar = () => { if (passando.current) { clearTimeout(passando.current); passando.current = null; } };
  const aoPassar = (cod: string) => {
    pararDePassar();
    passando.current = setTimeout(() => setEscolhida(cod), 220);
  };
  useEffect(() => pararDePassar, []);

  /* Setas na lista e no campo de busca andam de medida em medida. */
  const posAtual = atual ? achadas.findIndex((f) => f.cod === atual.cod) : -1;
  const andar = (j: number) => {
    const f = achadas[Math.max(0, Math.min(achadas.length - 1, j))];
    if (!f) return;
    setEscolhida(f.cod);
    const el = lista.current;
    if (!el) return;
    const i = achadas.indexOf(f);
    const y = i * LV_LINHA;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + LV_LINHA > el.scrollTop + el.clientHeight) el.scrollTop = y + LV_LINHA - el.clientHeight;
  };
  const teclaLista = (e: KeyboardEventReact<HTMLElement>) => {
    const passos: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: LV_LINHAS, PageUp: -LV_LINHAS };
    if (e.key in passos) { e.preventDefault(); andar((posAtual < 0 ? 0 : posAtual) + passos[e.key]); }
    else if (e.key === "Home" && e.currentTarget === lista.current) { e.preventDefault(); andar(0); }
    else if (e.key === "End" && e.currentTarget === lista.current) { e.preventDefault(); andar(achadas.length - 1); }
  };

  const dois = (n: number) => String(n).padStart(2, "0");
  const arquivadoDe = (f: Faca) => zs[chaveFaca(f.cod)] ?? null;
  const RECORTE_OFF = "#6f6d6f";

  return (
    <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: ALTURA, background: FUNDO, zIndex: NIVEL.painel, overflow: "hidden", color: PRETO, fontFamily: INTER }}>

      {/* a página do desenho é branca, como a área do desenho era antes: o
          papel da ficha técnica some nela, e o PDF ocupa a página toda */}
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: LV_DIVISA, height: ALTURA, background: "#fff" }} />

      {/* o degradê da seção, no fundo da página da lista: embaixo dos filetes
          e dos textos */}
      <DerrameHub10 src={degrade} left={LV_DIVISA + 1} top={0} width={1920 - LV_DIVISA - 1} height={ALTURA} imagens={IMAGENS_DOS_DEGRADES} />

      {/* ————— as linhas: a divisa, a única vertical, entre o
          desenho e a lista; e os filetes das duas faixas, finos. A lombada
          dupla, as guias, o trilho e a linha da rolagem da referência saíram:
          eram linha demais (Augusto, 28/09/2026). ————— */}
      <svg aria-hidden width={1920} height={ALTURA} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
        fill="none" strokeWidth={1} shapeRendering="crispEdges">
        {/* o filete de cima, na linha 15 da grade, só na página da lista (a do
            desenho vai até a barra do topo); o de baixo, na 63, nas duas, e é
            também o filete da oitava medida. Com crispEdges, acende o pixel
            que contém a linha. */}
        <g stroke={LV_FILETE}>
          <line x1={LV_DIVISA + 1} y1={LV_FIL_TOPO} x2={1920} y2={LV_FIL_TOPO} />
          <line x1={0} y1={LV_FIL_PE} x2={1920} y2={LV_FIL_PE} />
        </g>
        <line x1={LV_DIVISA + 0.5} y1={0} x2={LV_DIVISA + 0.5} y2={ALTURA} stroke={PRETO} />
      </svg>

      {/* ————— o trilho: a margem da esquerda (c0), com os dois comandos da
          página do desenho em pé, lidos de baixo para cima, como a marca e o
          "Contents" do Éminente ("vc tinha colocado esses itens
          verticalmente na primeira versão, ficou melhor", Augusto,
          28/09/2026). Em cima a família, no topo da linha de cabeçalho;
          embaixo Comparar, com o pé na linha 62 da grade. ————— */}
      {/* A família: quem entrou no cartão já sabe onde está, então ela fica
          pequena. É o seletor de família do hub: troca sem fechar o painel. */}
      <button onClick={() => setFamiliasAberto((v) => !v)} className="p10-flat" aria-expanded={familiasAberto}
        aria-label={`Família ${familia.nome}: trocar de família`}
        style={{ position: "absolute", left: 0, top: 58, width: LV_TEXTO_ESQ, padding: 0, border: "none", background: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: PRETO, zIndex: 2 }}>
        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: INTER, fontSize: 18, fontWeight: 600, lineHeight: 1,
          letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{familia.nome}</span>
        {/* a seta aponta para onde o menu abre, ao lado do trilho */}
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden
          style={{ opacity: .65, transform: familiasAberto ? "rotate(180deg)" : undefined }}><polyline points="9 6 15 12 9 18" /></svg>
      </button>

      {/* ————— página do desenho ————— */}
      {familiasAberto && (
        <>
          <div onClick={fecharFamilias} style={{ position: "absolute", inset: 0, zIndex: NIVEL.verTodos - 1 }} />
          <div style={{ position: "absolute", left: LV_TEXTO_ESQ, top: 58, width: 340, zIndex: NIVEL.verTodos, background: "#fff",
            border: `1.5px solid ${PRETO}`, borderRadius: 18, boxShadow: "0 22px 54px rgba(0,0,0,.22)", overflow: "hidden", padding: "8px 0" }}>
            {FAMILIAS.map((f) => {
              const on = f.sistema === familia.sistema;
              return (
                <button key={f.sistema} className="p10-linha"
                  /* O recorte não atravessa a troca de família: "3 cores" não
                     existe em Manuais, e a lista abria vazia sem nenhum
                     recorte marcado para explicar o porquê. */
                  onClick={() => { setSecao(null); aoTrocarFamilia(f.sistema); fecharFamilias(); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 22px", border: "none",
                    background: on ? "rgba(0,0,0,.06)" : "none", cursor: "pointer", fontFamily: INTER, fontSize: 18,
                    fontWeight: on ? 700 : 400, color: PRETO, textAlign: "left" }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.nome}</span>
                  <span style={{ flex: "none", fontSize: 15, color: CINZA }}>{contagem[f.sistema] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Comparar, no pé do trilho, no lugar do "Contents" do Éminente. Abre o
          visor grande já comparando, com esta faca e o lugar para somar outra:
          a comparação mora só lá (Augusto, 28/09/2026). */}
      {atual && (
        <button onClick={() => aoComparar(paraAberto(atual))} className="p10-flat" title="Ver outras facas lado a lado com esta, no visor grande"
          style={{ position: "absolute", left: 0, bottom: ALTURA - linhaDoPainel(62), zIndex: 3, width: LV_TEXTO_ESQ, boxSizing: "border-box", padding: 0,
            border: "none", background: "none", color: PRETO, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: INTER, fontSize: 18, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}>Comparar</span>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="7" height="14" rx="1.5" /><rect x="14" y="5" width="7" height="14" rx="1.5" />
          </svg>
        </button>
      )}

      {/* O desenho, no lugar da foto do Éminente, entre as margens da página e
          na área do desenho (linhas 8 a 62). */}
      {atual && (
        <DesenhoNaPagina key={atual.cod} faca={atual} arquivado={arquivadoDe(atual)} {...LV_DESENHO} aoAmpliar={() => aoAmpliar(paraAberto(atual))} />
      )}

      {/* O rodapé da página do desenho, como os rodapés das referências da
          Obys (Augusto, 28/09/2026): a medida, o código e a ficha do cilindro,
          o que o PDF não sabe (o Z arquivado e as contas que saem dele), cada
          um numa casa de duas colunas. */}
      {atual && <RodapeFicha faca={atual} arquivado={arquivadoDe(atual)} />}

      {/* ————— página da lista ————— */}
      {/* Os recortes da família no lugar do "About, Work, Contact": texto
          separado por vírgula, sublinhado quando ligado. Sem botão de limpar:
          clicar de novo no que está ligado desliga. */}
      {/* Centrados na linha de cabeçalho (58 a 104), no eixo do ×: presos em
          63, ficavam 3,4 px acima dela (a linha da maiúscula tem de cair no
          eixo dos botões, em 81). Menos a folga da primeira letra: a tinta cai
          em cima de c16 (1280), a coluna das medidas. */}
      <div style={{ position: "absolute", left: LV_TEXTO_DIR - folgaInter(secao === secoes[0] ? 700 : 400, 24, (secoes[0] ?? "").charAt(0)), top: 58, minHeight: 46, right: 80 + 46 + 24, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "center", alignContent: "center", fontSize: 24, lineHeight: "29px" }}>
          {secoes.map((s, i) => (
            <span key={s} style={{ whiteSpace: "nowrap" }}>
              <button onClick={() => setSecao(secao === s ? null : s)} className="p10-flat"
                title={secao === s ? "Clique de novo para tirar o recorte" : undefined}
                style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 24, lineHeight: "29px",
                  fontWeight: secao === s ? 700 : 400, color: secao === s ? PRETO : RECORTE_OFF,
                  textDecoration: secao === s ? "underline" : "none", textUnderlineOffset: 6, whiteSpace: "nowrap" }}>{s}</button>
              {i < secoes.length - 1 && <span aria-hidden style={{ color: RECORTE_OFF }}>,&nbsp;</span>}
            </span>
          ))}
        </div>
        {/* A referência da medida próxima, sempre à vista: sem ela, "L +5" não
            dizia +5 em relação a quê. No cabeçalho da lista, antes do ×: é a
            referência dos números da lista. No tom da família: é bloco de
            informação, os 30% da regra 60/30/10. */}
        {alvo && (
          <div title={foraDaTolerancia ? `Nenhuma até ±${tolerancia} mm. Estas são as ${achadas.length} mais perto` : undefined}
            style={{ flex: "none", height: 40, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 10,
              padding: "0 6px 0 18px", background: TOM[indice], border: `1px solid ${PRETO}`, color: PRETO, borderRadius: 999, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: "#5b595b" }}>{foraDaTolerancia ? "Mais perto de" : `Até ±${tolerancia} mm de`}</span>
            <span style={{ ...FR, fontSize: 22, lineHeight: 1, letterSpacing: "-.02em" }}>
              {NUM(alvo.l)}{alvo.a != null ? ` × ${NUM(alvo.a)}` : ""}
            </span>
            <button onClick={() => setProxima("")} className="p10-flat" aria-label="Desfazer a medida próxima"
              style={{ flex: "none", width: 28, height: 28, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center",
                background: "none", border: "none", borderRadius: 999, cursor: "pointer" }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.8} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Fechar, no lugar da bolinha preta do Éminente: o botão de painel do
          hub, em right 80 e top 58 (o ESC também fecha) */}
      <button onClick={fechar} className="p10-flat" aria-label="Fechar ferramenta"
        style={{ position: "absolute", right: 80, top: 58, boxSizing: "border-box", width: 46, height: 46, padding: 0, display: "grid", placeItems: "center",
          background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
      </button>

      {/* A lista: oito medidas entre os dois filetes, cada linha com o filete
          embaixo, que sai da divisa. A rolagem encaixa linha a linha, para as
          medidas nunca ficarem cortadas contra as faixas. */}
      {/* A exata que está em outra família, quando esta só tem as parecidas:
          na 1ª das oito casas, fora da lista de opções (é recado, não faca),
          com o filete das linhas embaixo. Até duas linhas de Inter 20, a 1ª
          base na linha 18 e a 2ª na 20 (a das medidas). */}
      {exatasFora.length > 0 && (
        <div style={{ position: "absolute", left: LV_DIVISA + 1, top: LV_FIL_TOPO, width: 1920 - LV_DIVISA - 1, height: LV_LINHA, boxSizing: "border-box", borderBottom: `1px solid ${LV_FILETE}` }}>
          <div style={{ position: "absolute", left: LV_TEXTO_DIR - LV_DIVISA - 1 - folgaInter(400, 20, "A"), right: 80, top: 3 * LINHA_DA_GRADE - baseInter(20, 2 * LINHA_DA_GRADE),
            maxHeight: 4 * LINHA_DA_GRADE, overflow: "hidden", fontSize: 20, lineHeight: `${2 * LINHA_DA_GRADE}px`, color: CINZA }}>
            {exatasForaDeitadas ? "A medida exata, deitada, está em " : "A medida exata está em "}
            {exatasFora.map(({ familia: fa, n }, i) => (
              <span key={fa.sistema}>
                {i > 0 && (i === exatasFora.length - 1 ? " e " : ", ")}
                <button onClick={() => { setSecao(null); limparFiltros(); aoTrocarFamilia(fa.sistema); }} className="p10-flat"
                  title={`Abrir ${fa.nome} com a pesquisa “${busca.trim()}”`}
                  style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 20, fontWeight: 600, color: PRETO,
                    textDecoration: "underline", textUnderlineOffset: 4 }}>{fa.nome}{n > 1 ? ` (${n})` : ""}</button>
              </span>
            ))}
            .
          </div>
        </div>
      )}
      {/* lista vazia não é lista de opções: o recado de vazio leva botões (a família em que a faca está) */}
      <div ref={lista} className="fer10-lista" role={achadas.length ? "listbox" : undefined} aria-label={`Facas de ${familia.nome}`}
        onKeyDown={teclaLista} onMouseLeave={pararDePassar}
        style={{ position: "absolute", left: LV_DIVISA + 1, top: topoDaLista, width: 1920 - LV_DIVISA - 1, height: LV_FIL_PE - topoDaLista,
          overflowY: "auto", overflowX: "hidden", scrollSnapType: "y mandatory" }}>
        {achadas.length === 0 ? (
          <div style={{ padding: `20px 0 0 ${LV_TEXTO_DIR - LV_DIVISA - 1 - folgaInter(400, 20, "N")}px`, fontSize: 20, color: CINZA }}>
            {!busca.trim() ? "Nenhuma faca nesta seção."
              : emOutras.length ? `Nenhuma faca com esse código ou medida em ${familia.nome}.`
                : "Nenhuma faca com esse código ou medida."}
            {emOutras.length > 0 && (
              /* a tinta das aspas na c16, como a do "N" de cima */
              <div style={{ marginTop: 8, marginLeft: folgaInter(400, 20, "N") - folgaInter(400, 20, "“"), lineHeight: "30px" }}>
                “{busca.trim()}” está em{" "}
                {emOutras.map(({ familia: fa, n }, i) => (
                  <span key={fa.sistema}>
                    {i > 0 && (i === emOutras.length - 1 ? " e " : ", ")}
                    <button onClick={() => { setSecao(null); limparFiltros(); aoTrocarFamilia(fa.sistema); }} className="p10-flat"
                      title={`Abrir ${fa.nome} com a pesquisa “${busca.trim()}”`}
                      style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 20, fontWeight: 600, color: PRETO,
                        textDecoration: "underline", textUnderlineOffset: 4 }}>{fa.nome}{n > 1 ? ` (${n})` : ""}</button>
                  </span>
                ))}
                .
              </div>
            )}
          </div>
        ) : achadas.map((f) => {
          const on = atual?.cod === f.cod;
          return (
            <button key={f.cod} role="option" aria-selected={on} className={`fer10-item${on ? " on" : ""}`}
              onClick={() => setEscolhida(f.cod)}
              onMouseEnter={() => aoPassar(f.cod)}
              title={`${f.cod} · ${f.secao || "sem seção"}`}
              /* menos a folga do primeiro algarismo: a tinta da medida cai em
                 cima de c16, a coluna da busca e dos recortes; e a linha de
                 base desce até a quinta linha da grade */
              style={{ position: "relative", display: "block", width: "100%", height: LV_LINHA, boxSizing: "border-box", margin: 0,
                padding: `${LV_BASE_AJUSTE}px 0 0 ${LV_TEXTO_DIR - LV_DIVISA - 1 - folgaDaLista((f.medida || f.cod).charAt(0))}px`, border: "none", background: "none", textAlign: "left", cursor: "pointer",
                scrollSnapAlign: "start", ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: LV_CORPO, lineHeight: `${LV_LINHA}px`,
                /* sobre o degradê, o cinza some: um preto translúcido acompanha a cor de baixo */
                letterSpacing: "-.03em", color: on ? PRETO : comDegrade ? "rgba(0,0,0,.45)" : "#9a989a", whiteSpace: "nowrap", overflow: "hidden" }}>
              {f.medida || f.cod}
              {/* Com a medida próxima, quanto esta faca difere do pedido (faca
                  menos pedido), empilhado: L em cima, A embaixo. O tom diz se
                  serve: até 2mm preto, até 5mm cinza escuro, além disso cinza
                  claro. Tinta, e não cor: a regra 60/30/10 não deixa sobrar
                  cor para isso. */}
              {alvo && (() => {
                const d = diferenca(f);
                if (!d) return null;
                const texto = (v: number) => {
                  const r = Math.round(v * 100) / 100;
                  return r === 0 ? "0" : `${r > 0 ? "+" : "−"}${NUM(Math.abs(r))}`;
                };
                const cor = (v: number) => (Math.abs(v) <= 2 ? PRETO : Math.abs(v) <= 5 ? "#5b595b" : CINZA);
                const dizer = (rot: string, v: number) =>
                  Math.abs(v) < 0.005 ? `${rot} igual ao pedido` : `${rot} ${NUM(Math.round(Math.abs(v) * 100) / 100)} mm ${v > 0 ? "maior" : "menor"} que o pedido`;
                const igual = Math.abs(d.dl) < 0.005 && (d.da == null || Math.abs(d.da) < 0.005);
                const linha = (rot: string, v: number) => (
                  <span style={{ display: "flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: CINZA, width: 11 }}>{rot}</span>
                    <span style={{ color: cor(v) }}>{texto(v)}</span>
                  </span>
                );
                return (
                  <span title={[d.deitada ? `Usada deitada: a arte vira 90° e a etiqueta sai deitada no rolo` : "",
                    dizer("Largura", d.dl), d.da != null ? dizer("Altura", d.da) : ""].filter(Boolean).join(" · ")}
                    style={{ display: "inline-flex", flexDirection: "column", justifyContent: "center", gap: 3, marginLeft: 16, verticalAlign: "middle",
                      fontFamily: INTER, fontVariationSettings: "normal", fontSize: 18, lineHeight: 1.1, fontWeight: 700, letterSpacing: 0 }}>
                    {/* "deitada" em cima, pequeno: é informação sobre COMO usar a
                        faca, e o número embaixo continua sendo o que se lê primeiro */}
                    {d.deitada && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#5b595b", whiteSpace: "nowrap" }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#5b595b" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
                        </svg>
                        deitada
                      </span>
                    )}
                    {igual
                      ? <span style={{ color: PRETO }}>igual</span>
                      : <>{linha("L", d.dl)}{d.da != null && linha("A", d.da)}</>}
                  </span>
                );
              })()}
            </button>
          );
        })}
      </div>

      {/* Busca e filtros no pé da coluna da lista, na faixa de baixo, centrados
          na linha 65. A busca com três colunas (c16 a c19), a largura da busca
          da barra do topo; "Filtros" depois de uma coluna de vão (c20). */}
      <label style={{ position: "absolute", left: LV_TEXTO_DIR, top: LV_FIL_PE + (ALTURA - LV_FIL_PE - 37) / 2, width: 240, height: 37, boxSizing: "border-box",
        display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: RAIO_DA_PESQUISA, cursor: "text" }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={teclaLista} autoFocus
          placeholder="PESQUISA" aria-label="Pesquisar faca"
          style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "none", textAlign: "center",
            font: `600 14px/1 ${INTER}`, letterSpacing: ".08em", color: PRETO }} />
      </label>
      <button onClick={() => setFiltrosAberto((v) => !v)} className="p10-flat"
        style={{ position: "absolute", left: LV_TEXTO_DIR + 320 - folgaInter(quantosFiltros ? 700 : 400, 24, "F"), top: LV_FIL_PE + (ALTURA - LV_FIL_PE - 37) / 2, height: 37, padding: 0, border: "none", background: "none", cursor: "pointer",
          fontFamily: INTER, fontSize: 24, fontWeight: quantosFiltros ? 700 : 400, color: PRETO, whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
        {/* com filtro ligado o rótulo fica em negrito, e nada mais */}
        Filtros
      </button>
      {/* a contagem no lugar do número da página do Éminente: qual medida está
          aberta e quantas a lista tem */}
      <div style={{ position: "absolute", right: 80, top: LV_FIL_PE, height: ALTURA - LV_FIL_PE, display: "flex", alignItems: "center",
        fontSize: 18, fontWeight: 600, color: CINZA, whiteSpace: "nowrap" }}>
        {achadas.length === 0 ? "Nenhuma"
            : foraDaTolerancia ? `${dois(achadas.length)} mais perto`
              : `${dois(posAtual + 1)} de ${dois(achadas.length)}`}
      </div>

      {filtrosAberto && (
        <>
          {/* fundo que fecha no clique, sem escurecer a tela: é um menu, não
              uma caixa modal */}
          <div onClick={fecharFiltros} style={{ position: "absolute", inset: 0, zIndex: NIVEL.verTodos - 1 }} />
          {/* nasce em cima da busca que o abriu, alinhado com ela */}
          <div style={{ position: "absolute", left: LV_TEXTO_DIR, bottom: ALTURA - linhaDoPainel(62), width: 560, boxSizing: "border-box", zIndex: NIVEL.verTodos,
            background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 18, boxShadow: "0 22px 54px rgba(0,0,0,.22)", padding: 24, overflow: "hidden" }}>

            {/* Cabeçalho na cor da família, com a saída: os 30% da regra
                60/30/10, corpo branco e preto só no que está ligado */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, margin: "-24px -24px 20px", padding: "16px 24px",
              background: TOM[indice], borderBottom: `1px solid ${PRETO}` }}>
              <span style={{ ...FR, fontSize: 26, lineHeight: 1, letterSpacing: "-.03em", color: PRETO }}>Filtros</span>
              <button onClick={fecharFiltros} className="p10-flat" aria-label="Fechar filtros"
                style={{ flex: "none", boxSizing: "border-box", width: 33, height: 33, padding: 0, display: "grid", placeItems: "center", background: "#fff",
                  border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>

            {/* Medida primeiro: é por ela que se procura faca. Largura e
                altura FILTRAM; a medida próxima ORDENA — por isso ela é mais
                larga: é onde se digita a medida inteira que o cliente pediu. */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.45fr", gap: 14 }}>
              {([
                ["Largura (mm)", largura, setLargura, "—", "Largura da faca, em milímetros"],
                ["Altura (mm)", altura, setAltura, "—", "Altura da faca, em milímetros"],
                ["Medida próxima", proxima, setProxima, "82x43", "Medida pedida pelo cliente, para achar as facas mais próximas"],
              ] as const).map(([rot, val, set, ph, aria]) => (
                <label key={rot} style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA, whiteSpace: "nowrap" }}>{rot}</span>
                  <span style={{ position: "relative", display: "block" }}>
                    <input value={val} onChange={(e) => set(e.target.value)} inputMode={rot === "Medida próxima" ? "text" : "decimal"} placeholder={ph} aria-label={aria}
                      style={{ width: "100%", height: 44, boxSizing: "border-box", padding: "0 44px 0 16px", border: `1.5px solid ${PRETO}`, borderRadius: 999,
                        outline: "none", font: `600 17px/1 ${INTER}`, color: PRETO, background: "none" }} />
                    <span aria-hidden style={{ position: "absolute", right: 17, top: "50%", transform: "translateY(-50%)", font: `600 13px/1 ${INTER}`, color: CINZA, pointerEvents: "none" }}>mm</span>
                  </span>
                </label>
              ))}
            </div>

            {/* A tolerância só aparece quando há medida próxima: sem ela não
                quer dizer nada, e seria mais uma fileira de botões parados. */}
            {alvo && (
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA, marginRight: 6, whiteSpace: "nowrap" }}>Diferença até</span>
                {[2, 5, 10].map((t) => (
                  <button key={t} onClick={() => setTolerancia(t)} className="p10-flat" aria-pressed={tolerancia === t}
                    style={{ height: 34, padding: "0 14px", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer",
                      background: tolerancia === t ? PRETO : "#fff", color: tolerancia === t ? "#fff" : PRETO, font: `700 13px/1 ${INTER}`, whiteSpace: "nowrap" }}>±{t} mm</button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 22, font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA }}>
              Z do cilindro
            </div>
            {zDisponiveis.length === 0 ? (
              <div style={{ marginTop: 10, fontSize: 15, color: CINZA }}>Nenhuma faca desta família está arquivada por Z.</div>
            ) : (
              /* Grade de colunas iguais, e não `flex-wrap`: com 27 pílulas de
                 larguras diferentes as linhas saíam desencontradas. */
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7 }}>
                {zDisponiveis.map((z) => (
                  <button key={z} onClick={() => setZFiltro(zFiltro === z ? null : z)} className="p10-flat"
                    style={{ height: 34, padding: 0, border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer",
                      background: zFiltro === z ? PRETO : "#fff", color: zFiltro === z ? "#fff" : PRETO, font: `700 13px/1 ${INTER}` }}>Z{z}</button>
                ))}
              </div>
            )}

            <div style={{ marginTop: 22, paddingTop: 15, borderTop: "1px solid rgba(0,0,0,.12)", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ flex: 1, fontSize: 15, color: achadas.length ? CINZA : PALETA.perigo }}>
                {!achadas.length
                  ? vazioDosFiltros
                  : foraDaTolerancia
                    ? `Nenhuma até ±${tolerancia} mm · mostrando as ${achadas.length} mais perto`
                    : alvo
                      ? `${achadas.length} ${achadas.length === 1 ? "faca" : "facas"} até ±${tolerancia} mm de ${NUM(alvo.l)}${alvo.a != null ? `×${NUM(alvo.a)}` : ""}${quantasDeitadas ? ` · ${quantasDeitadas} deitada${quantasDeitadas === 1 ? "" : "s"}` : ""}`
                      : `${achadas.length} de ${facas.length} ${facas.length === 1 ? "faca" : "facas"}`}
              </span>
              {quantosFiltros > 0 && (
                <button onClick={limparFiltros} className="p10-flat"
                  style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 15, color: PRETO, textDecoration: "underline", textUnderlineOffset: 4 }}>Limpar</button>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

/* ————— o desenho na página esquerda —————
   O PNG do desenho (do acervo, ou refeito do PDF) e o tamanho natural dele:
   a caixa segue a proporção do próprio desenho, deitado ou em pé, para a
   legenda encostar na borda dele e não no vazio da caixa. */
function useDesenho(arquivo: string) {
  const [png, setPng] = useState(() => (arquivo ? DESENHOS.get(arquivo) ?? "" : ""));
  const [dim, setDim] = useState<Dim | null>(null);
  /* o desenho que não abriu (fora do acervo, acima de 30 MB, rede ou sessão
     caída): sem isto a ficha ficava em "abrindo o desenho…" para sempre */
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    setFalhou(false);
    if (!arquivo) { setPng(""); return; }
    const guardado = DESENHOS.get(arquivo);
    if (guardado) { setPng(guardado); return; }
    let vivo = true;
    setPng("");
    desenhoDaFaca(arquivo)
      .then((img) => { if (vivo) { if (img) setPng(img); else setFalhou(true); } })
      .catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [arquivo]);
  useEffect(() => {
    if (!png) { setDim(null); return; }
    let vivo = true;
    const img = new Image();
    img.onload = () => { if (vivo && img.naturalWidth) setDim({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = png;
    return () => { vivo = false; };
  }, [png]);
  return { png, dim, falhou };
}

/* A tinta do desenho. O PNG da ficha vem com a margem branca da página do
   PDF, e ela não é igual em cima e embaixo (na FAC0262.01, 44 px em cima e
   136 embaixo): contida na área, a ficha ficava menor e fora do lugar. A
   caixa da tinta (tudo o que não é branco) é medida uma vez por desenho, no
   canvas, e a página mostra só ela. */
type CaixaDaTinta = { x: number; y: number; w: number; h: number; W: number; H: number };
const TINTAS = new Map<string, CaixaDaTinta>();
function useTintaDoDesenho(arquivo: string, png: string): CaixaDaTinta | null {
  const [caixa, setCaixa] = useState<CaixaDaTinta | null>(() => TINTAS.get(arquivo) ?? null);
  useEffect(() => {
    const guardada = TINTAS.get(arquivo);
    if (guardada) { setCaixa(guardada); return; }
    setCaixa(null);
    if (!png) return;
    let vivo = true;
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const c = cv.getContext("2d", { willReadFrequently: true });
      if (!vivo || !W || !H || !c) return;
      c.drawImage(img, 0, 0);
      const d = c.getImageData(0, 0, W, H).data;
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = (y * W + x) * 4;
          /* tinta é o que não é branco: a margem da página sai em 255 */
          if (d[p + 3] > 10 && 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2] < 245) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      /* página em branco: fica a página inteira */
      const r = x1 < 0 ? { x: 0, y: 0, w: W, h: H, W, H } : { x: x0, y: y0, w: x1 + 1 - x0, h: y1 + 1 - y0, W, H };
      TINTAS.set(arquivo, r);
      setCaixa(r);
    };
    img.src = png;
    return () => { vivo = false; };
  }, [arquivo, png]);
  return caixa;
}

/* O PDF em toda a página esquerda ("o pdf deve abrir em toda área", Augusto,
   28/09/2026): a ficha técnica inteira, sem a margem branca da página dela,
   do tamanho que couber na área do desenho, no centro (ou sentada no pé da
   caixa, na comparação). Clicar abre o visor grande, com zoom e download. */
function DesenhoNaPagina({ faca, arquivado, x, y, w, h, alinhar = "centro", aoAmpliar }: {
  faca: Faca; arquivado: ZArquivado | null; x: number; y: number; w: number; h: number;
  alinhar?: "centro" | "pe";
  aoAmpliar: () => void;
}) {
  const { larg, alt, rep, arquivo } = useFichaDaFaca(faca, arquivado);
  const { png, falhou } = useDesenho(arquivo);
  const tinta = useTintaDoDesenho(arquivo, png);
  /* a tinta contida na área: a ficha em pé encosta em cima e embaixo, a
     deitada nos dois lados; a imagem inteira vai junto, deslocada, e a caixa
     corta a margem */
  const k = tinta ? Math.min(w / tinta.w, h / tinta.h) : 0;
  return (
    <button onClick={aoAmpliar} disabled={!png} aria-label={`Abrir o desenho grande de ${faca.medida || faca.cod}`} title={png ? "Abrir o desenho grande" : undefined}
      style={{ position: "absolute", left: x, top: y, width: w, height: h, padding: 0, border: "none", background: "none",
        cursor: png ? "zoom-in" : "default", display: "grid", placeItems: "center", overflow: "hidden" }}>
      {png && tinta ? (
        <img src={png} alt={`Desenho técnico ${arquivo}`} draggable={false}
          style={{ position: "absolute", left: (w - tinta.w * k) / 2 - tinta.x * k, top: (h - tinta.h * k) / (alinhar === "pe" ? 1 : 2) - tinta.y * k,
            width: tinta.W * k, height: tinta.H * k, maxWidth: "none", display: "block" }} />
      ) : arquivo && !falhou ? (
        <span style={{ font: `400 14px/1 ${INTER}`, color: CINZA }}>abrindo o desenho…</span>
      ) : (
        /* sem desenho no acervo (ou o dele não abriu): a etiqueta repetida no
           cilindro, montada só com a medida, no tamanho da página */
        <>
          <span style={{ display: "block", transform: `scale(${Math.min(w / 410, h / 600)})`, transformOrigin: "center" }}>
            <CotasGeradas larg={larg} alt={alt} linhas={Math.min(rep || 1, 4)} carreiras={2} />
          </span>
          {falhou && <span style={{ position: "absolute", left: 0, right: 0, bottom: 6, textAlign: "center", font: `400 14px/1 ${INTER}`, color: CINZA }}>Sem desenho no acervo</span>}
        </>
      )}
    </button>
  );
}


/* ————— a ficha técnica ————— */
/* As cotas e a grade azul do handoff são desenho técnico de verdade: o bloco
   central repete a etiqueta como ela sai no cilindro (carreiras × repetições),
   com os tracinhos de cota em volta. Repetições e diâmetro saem do cálculo de
   cilindro que o hub já faz (CILINDRO), e não de um número escrito à mão.

/* ————— a ficha de uma faca —————
   Na ordem de confiança: o que está ESCRITO no desenho, depois o Z que a
   equipe arquivou na pasta, e só por último a conta pela medida. Hook e
   componente à parte porque a mesma legenda aparece no módulo do painel e em
   cada coluna da comparação no visor — duas cópias iam divergir na primeira
   correção. */
function useFichaDaFaca(faca: Faca, arquivado: ZArquivado | null) {
  const cil = CILINDRO(faca.medida, faca.cod);
  const n = MEDIDAS(faca.medida);
  const larg = n[0] || 0, alt = n[1] || n[0] || 0;

  /* Com o Z da pasta, refazemos a conta do cilindro em cima dele — as mesmas
     fórmulas do CILINDRO, só que partindo de um Z que alguém mediu. O diâmetro
     divide por 3,14 e não por π: é assim que as fichas antigas escrevem. */
  const zReal = arquivado?.z ?? (cil.real ? cil.z : null);
  const passoEtiqueta = (alt || 0) + 3;
  const circ = zReal ? zReal * PASSO_MM : 0;
  const rep = zReal && passoEtiqueta > 0 ? Math.max(1, Math.round(circ / passoEtiqueta)) : cil.rep;
  const diam = zReal ? Math.floor(circ / 3.14) : cil.diamFicha;

  const arquivo = faca.arquivo || PDF_DE(faca.cod).replace(/^facas\//, "");

  /* O desenho TRAZ a ficha escrita — carreiras, repetições, diâmetro,
     engrenagem, máquina. Onde ela sobreviveu como texto (em boa parte do
     acervo o desenhista converteu tudo em curvas na exportação), é ela que
     manda: deduzir o que está escrito seria errado. */
  const { data: doDesenho } = useQuery<FichaDoDesenho | null>({
    queryKey: ["faca-ficha", arquivo],
    queryFn: () => getFichaDesenho({ data: { arquivo } }) as Promise<FichaDoDesenho>,
    enabled: !!arquivo,
    staleTime: Infinity,
  });

  const zDesenho = doDesenho?.dentes ?? null;
  const zFinal = zDesenho ?? zReal;
  const repFinal = doDesenho?.repeticoes ?? (rep ? String(rep) : null);
  /* a ficha às vezes escreve "Ø 63" ou "95Ø": o símbolo sai aqui, porque
     quem mostra põe o dele ("Ø 63 Ø" na FAC0169.01; simulação 3) */
  const diamFinal = doDesenho?.diametro ? doDesenho.diametro.replace(/Ø/g, "").trim() || null : (diam ? String(diam) : null);
  /* "Estimado" só quando nem o desenho nem a pasta de Z souberam dizer. */
  const estimado = !zDesenho && !zReal;
  return { cil, larg, alt, rep, arquivo, doDesenho, zFinal, repFinal, diamFinal, estimado };
}

/* ————— as casas da ficha —————
   Rótulo pequeno em cima e valor embaixo, cada um com a base numa linha da
   grade e a tinta na borda da casa: o rodapé da página de uma faca e a página
   pequena de cada faca na comparação. */
type Casa = { r: string; v: string; cor?: string };
/** A ficha de uma faca em casas: as seis de sempre, o cilindro (medido ou
    chutado: é o que a produção precisa saber dos números dele) e o que o
    desenho trouxer a mais. Valor que falta aparece como "não consta". */
function useCasasDaFicha(faca: Faca, arquivado: ZArquivado | null): { fixas: Casa[]; cilindro: Casa; extras: Casa[] } {
  const { cil, doDesenho, zFinal, repFinal, diamFinal, estimado } = useFichaDaFaca(faca, arquivado);
  const FALTA = "não consta";
  const extras = ([
    ["Máquina", doDesenho?.maquina ?? arquivado?.maquina],
    ["Carreiras", doDesenho?.carreiras],
    ["Substrato", doDesenho?.substrato],
    ["Corte/Fio", doDesenho?.corteFio],
    ["Espaç. horizontal", doDesenho?.espacamentoH],
  ] as [string, string | number | null | undefined][])
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([r, v]) => ({ r, v: String(v) }));
  return {
    fixas: [
      { r: "Medida", v: faca.medida || FALTA },
      { r: "Código", v: faca.cod },
      { r: "Seção", v: faca.secao || FALTA },
      { r: "Dentes", v: zFinal ? `Z${zFinal}` : cil.z ? `Z${cil.z}` : FALTA },
      { r: "Repetições", v: repFinal ?? FALTA },
      { r: "Diâmetro", v: diamFinal ? `${diamFinal} Ø` : FALTA },
    ],
    cilindro: { r: "Cilindro", v: estimado ? "estimado" : "medido", cor: estimado ? PALETA.perigo : undefined },
    extras,
  };
}

/** Uma fileira de casas: a primeira com a tinta em x0 e as outras a cada
    `passo`; o rótulo com a base na linha k da grade e o valor na k+1. `topo`
    é onde começa quem as contém, em coordenadas do painel. O que sobrar vai
    no título da última casa. */
function FileiraDeCasas({ casas, sobra = [], x0, passo, k, topo = 0, ultimaLargura }: {
  casas: Casa[]; sobra?: Casa[]; x0: number; passo: number; k: number; topo?: number;
  /** largura da última casa, quando ela encosta na margem */
  ultimaLargura?: number;
}) {
  const linha = (x: number, kk: number, texto: string, peso: number, corpo: number, cor: string, largura: number, titulo?: string) => (
    <div key={`${x}-${kk}`} title={titulo} style={{ position: "absolute", left: x - folgaInter(peso, corpo, texto.charAt(0)),
      top: linhaDoPainel(kk) - topo - baseInter(corpo, LINHA_DA_GRADE), width: largura, height: LINHA_DA_GRADE,
      fontFamily: INTER, fontWeight: peso, fontSize: corpo, lineHeight: `${LINHA_DA_GRADE}px`, color: cor,
      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{texto}</div>
  );
  return (
    <>
      {casas.flatMap((c, i) => {
        const x = x0 + passo * i;
        const ultima = i === casas.length - 1;
        const largura = (ultima && ultimaLargura != null ? ultimaLargura : passo) - 8;
        const titulo = ultima && sobra.length ? [c, ...sobra].map((s) => `${s.r}: ${s.v}`).join(" · ") : c.v;
        return [
          linha(x, k, c.r, 500, 12, "#6f6d6f", largura),
          linha(x, k + 1, c.v, 600, 14, c.cor ?? PRETO, largura, titulo),
        ];
      })}
    </>
  );
}

/** O rodapé da página do desenho, como os das referências da Obys: cada
    informação numa casa de duas colunas a partir de c1, com a base nas linhas
    65 e 66 da grade. As casas ficam sempre no mesmo lugar (quem passa o mouse
    pela lista lê o mesmo lugar de faca em faca), e as sete estão sempre
    cheias: a sétima diz se o cilindro é medido ou estimado. O que o desenho
    trouxer a mais (máquina, carreiras...) vai no título dela. */
function RodapeFicha({ faca, arquivado }: { faca: Faca; arquivado: ZArquivado | null }) {
  const { fixas, cilindro, extras } = useCasasDaFicha(faca, arquivado);
  const casas = [...fixas, cilindro, ...extras];
  const vistas = casas.slice(0, RODAPE_CASAS);
  /* a última casa (c13) tem uma coluna só até a margem */
  const xUltima = LV_TEXTO_ESQ + RODAPE_CASA * (vistas.length - 1);
  return (
    <FileiraDeCasas casas={vistas} sobra={casas.slice(RODAPE_CASAS)} x0={LV_TEXTO_ESQ} passo={RODAPE_CASA} k={65}
      ultimaLargura={Math.min(RODAPE_CASA, LV_DESENHO_FIM - xUltima)} />
  );
}

function LegendaFaca({ faca, arquivado, style, comMedida = false }: {
  faca: Faca; arquivado: ZArquivado | null; style?: CSSProperties;
  /** a medida e o código na frente: dentro da família, o PDF ocupa a página
      e a faixa de baixo faz o papel da legenda da foto */
  comMedida?: boolean;
}) {
  const { cil, doDesenho, zFinal, repFinal, diamFinal, estimado } = useFichaDaFaca(faca, arquivado);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 26px", font: `400 14px/1.3 ${INTER}`, color: "#3c3a3c", ...style }}>
      {([
        ...(comMedida ? [["Medida", faca.medida || "—"], ["Código", faca.cod]] as [string, string][] : []),
        ["Seção", faca.secao || "—"],
        ...(doDesenho?.carreiras ? [["Carreiras", doDesenho.carreiras] as [string, string]] : []),
        ["Dentes", zFinal ? `Z${zFinal}` : cil.z ? `Z${cil.z}` : "—"],
        ["Repetições", repFinal ?? "—"],
        ["Diâmetro", diamFinal ? `${diamFinal} Ø` : "—"],
        ...(doDesenho?.espacamentoH ? [["Espaç. horizontal", doDesenho.espacamentoH] as [string, string]] : []),
        ...(doDesenho?.substrato ? [["Substrato", doDesenho.substrato] as [string, string]] : []),
        ...(doDesenho?.corteFio ? [["Corte/Fio", doDesenho.corteFio] as [string, string]] : []),
        ...((doDesenho?.maquina ?? arquivado?.maquina)
          ? [["Máquina", (doDesenho?.maquina ?? arquivado?.maquina) as string] as [string, string]]
          : []),
      ] as [string, string][]).map(([r, v]) => (
        <span key={r} style={{ whiteSpace: "nowrap" }}>
          <span style={{ color: CINZA }}>{r}: </span>
          <b style={{ fontWeight: 600, color: PRETO }}>{v}</b>
        </span>
      ))}
      {/* Antes havia um til em cada número e uma frase embaixo falando de
          pasta e de arquivo — explicação de quem fez o sistema, não de quem
          usa. Quem está na produção precisa de uma coisa só: se os números
          do cilindro foram medidos ou chutados. E "medido" inclui o que está
          escrito no desenho: antes a marca olhava só a pasta de Z, e faca com
          a engrenagem escrita no PDF aparecia como estimada. */}
      {estimado && <span style={{ whiteSpace: "nowrap", color: PALETA.perigo }}>Cilindro estimado</span>}
    </div>
  );
}

/** Mede a altura natural do que está dentro e avisa quando muda. */
function MedeAltura({ aoMedir, children }: { aoMedir: (h: number) => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const avisar = useRef(aoMedir);
  avisar.current = aoMedir;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => avisar.current(el.offsetHeight));
    ro.observe(el);
    avisar.current(el.offsetHeight);
    return () => ro.disconnect();
  }, []);
  return <div ref={ref}>{children}</div>;
}

/* Reserva: a etiqueta repetida no cilindro, montada só com a medida. Não é o
   desenho da faca — é o que dá para mostrar enquanto ela não tem PDF. */
function CotasGeradas({ larg, alt, linhas, carreiras }: {
  larg: number; alt: number; linhas: number; carreiras: number;
}) {
  return (
      <svg style={{ pointerEvents: "none" }} width={410} height={600} viewBox="0 0 410 600">
        {Array.from({ length: linhas }, (_, l) => Array.from({ length: carreiras }, (_, c) => {
          const x = 23.5 + c * 178, y = 72 + l * 123;
          return (
            <g key={`${c}-${l}`}>
              <rect x={x} y={y} width={163} height={107.4} rx={3.2} {...COTA} />
              {/* cotas de cima e de baixo */}
              {[0, 1, 2, 3, 4].map((k) => (
                <g key={k}>
                  <line x1={x + 24.5 + k * 28.5} y1={y} x2={x + 24.5 + k * 28.5} y2={y - 20} {...COTA} />
                  <line x1={x + 24.5 + k * 28.5} y1={y + 107.4} x2={x + 24.5 + k * 28.5} y2={y + 127.4} {...COTA} />
                </g>
              ))}
              {/* cotas laterais */}
              {[0, 1, 2].map((k) => (
                <g key={k}>
                  <line x1={x} y1={y + 28.5 + k * 28.5} x2={x - 20} y2={y + 28.5 + k * 28.5} {...COTA} />
                  <line x1={x + 163} y1={y + 28.5 + k * 28.5} x2={x + 183} y2={y + 28.5 + k * 28.5} {...COTA} />
                </g>
              ))}
            </g>
          );
        }))}
        {/* a medida anotada em cima, em magenta — a cota que o desenhista lê */}
        <g stroke="#e32681" strokeWidth={1} fill="none">
          <polyline points="76,20 76,30 204,30 204,20" />
          <polyline points="218,32 218,0 238,0 238,32" transform="translate(0 0)" />
        </g>
        <text x={140} y={16} textAnchor="middle" fill="#e32681" style={{ font: `600 11px/1 ${INTER}` }}>{larg ? `${NUM(larg)} mm` : ""}</text>
        <text x={228} y={48} textAnchor="middle" fill="#e32681" style={{ font: `600 11px/1 ${INTER}` }}>{alt ? `${NUM(alt)} mm` : ""}</text>
      </svg>

  );
}
