// Pedidos — Hub 1.0. Fonte: design_handoff_hub_1.0/Pedido 1.0.dc.html
//
// O coração do hub: substitui a lista PedidosV1a e, quando o painel de
// detalhe estiver pronto, também a PedidoModalV1a.
//
// Mora numa tela própria (`pedidos10`) enquanto não está completa — a lista
// V1a segue no ar em `pedidos`. Trocar as duas de lugar é uma linha na rota,
// no dia em que o detalhe fechar.
//
// Diferenças conscientes em relação ao protótipo:
//
//  · O protótipo decide o que aparece por uma prop `papel` de três valores
//    (Designer/Vendedora/Admin). Aqui quem decide são as PERMISSÕES, que é
//    como o hub funciona de verdade — um gestor pode ter parte do que o
//    protótipo chama de Designer sem ser designer.
//  · Os status são os do banco, traduzidos para os nomes e cores do projeto.
//  · A fila e o aviso de resposta nova vêm do servidor (coluna `fila` e
//    `pedido_vistos`), não do armazenamento local do protótipo.
import { Children, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as PointerEventReact, ReactNode } from "react";

import { AvisoV1a } from "../v1a/HubV1a";
import { RefazerClicheHub10, type DadosRefazerCliche } from "./RefazerClicheHub10";
import { ClicheChegouHub10 } from "./ClicheChegouHub10";
import { DesignCriadoHub10 } from "./DesignCriadoHub10";
import {
  AMARELO_MAIS, BarraTopoHub10, CampoHub10, FECHAR_DA_LISTA, FR, FUNDO, FUNDO_PAGINA, INTER, LINHA_DA_GRADE_HUB, NIVEL, PRETO, PalcoFixo, TOPO_DA_LISTA,
  NomeDoCartaoV4, PeDoCartaoV4, numeroPedido, textoNaGrade, tituloDaLista, topoDoControle, useEscDoTopo,
} from "./ChromeHub10";
import { baseFraunces, baseInter, folgaFraunces, folgaInter } from "./grade-hub10";
import { LOTTIE, LottieHub10, SetaDaTrilha } from "./LottieHub10";
import { useEncaixeDaTrilha } from "./trilha-encaixe";
import { CAPA_V4 } from "./CapaV4Hub10";
import { entrarNoCartao, jeitoDoCartao, posicaoNaTrilha, sairDaTrilha, sairDoCartao, voltarATrilha, type JeitoDoCartao } from "@/lib/transicao-cartao";
import { ModalSucesso, PedidoDetalheHub10, ehEntregaDeArte } from "./PedidoDetalheHub10";
import { PastaClienteHub10 } from "./PastaClienteHub10";
import type { AcoesPedido, DetalhePedido, PodeNoPedido } from "./PedidoDetalheHub10";
import type { SessionUser } from "@/lib/session";
import { alvoBusca, criarBusca, normalizarBusca } from "@/lib/busca";
import { erroLegivel } from "@/lib/erro-legivel";
import { coresEfetivas, numeroDeCores, separarCores } from "@/lib/cores";
import { PALETA } from "@/lib/paleta-hub";

/* ————— status: chave do banco → nome e cores do projeto 1.0 ————— */
type Estilo = { rotulo: string; cor: string; tinta: string };
/* As cores da FormFrom nos cartões (Augusto, 05/10/2026: "veja as
   cores que o formfrom design usa, vamos testá-las nos cards do hub"). As
   cores saíram dos pixels das ilustrações deles (formfrom.design): roxo e
   lima são a assinatura da casa; ciano elétrico, azul, laranja, framboesa,
   marinho e cinza vêm das outras coleções; o amarelo é o da ilustração que
   ele mandou. Cada status fica na família de cor de hoje (ciano, lilás,
   azul, amarelo, verde, rosa, pêssego, vermelho, cinza), só que viva: a
   lavanda do "Aguardando design" estava "morta" e virou o ciano elétrico; a
   Clicheria pediu "um tom mais elétrico" e virou o rosa #ff3ec8 (a FormFrom
   não tem rosa elétrico; é o mais distante das outras cores). Tinta preta
   pura no azul e no laranja e branca na framboesa (sempre branca no
   Cancelado, pedido dele), onde o #252425 ficava abaixo de 4,5 de
   contraste; o Finalizado continua azul com a letra verde, como ele prefere,
   só que elétrico: o azul #1e40ff e o verde neon #5ffc3f da FormFrom (4,8 de
   contraste; o par de antes dava 3,2). Aprovadas com a paleta nova em
   08/10/2026 ("a paleta nova com certeza"): são as únicas. */
const STATUS: Record<string, Estilo> = {
  nova: { rotulo: "Aguardando design", cor: "#00f2ff", tinta: "#252425" },
  criacao: { rotulo: "Criação", cor: "#a66cff", tinta: "#252425" },
  aguardando: { rotulo: "Design criado", cor: "#666bff", tinta: "#000000" },
  revisao: { rotulo: "Revisão", cor: "#ffce22", tinta: "#252425" },
  aprovada: { rotulo: "Aprovado", cor: "#d0f500", tinta: "#252425" },
  cliche: { rotulo: "Clicheria", cor: "#ff3ec8", tinta: "#252425" },
  refazer_cliche: { rotulo: "Refazer clichê", cor: "#f25218", tinta: "#000000" },
  concluido: { rotulo: "Finalizado", cor: "#1e40ff", tinta: "#5ffc3f" },
  cancelado: { rotulo: "Cancelado", cor: "#b82573", tinta: "#ffffff" },
  aguardando_cliente: { rotulo: "Aguardando cliente", cor: "#c2c8cf", tinta: "#252425" },
};
const estiloDe = (st: string): Estilo => STATUS[st] ?? { rotulo: st, cor: PALETA.amarelo, tinta: "#252425" };
/** O nome do status no 1.0, para quem mostra status fora desta tela (a
    busca do topo). */
export const rotuloDoStatus = (st: string) => estiloDe(st).rotulo;
/** O fundo e a tinta de um status, na paleta ligada (os cartões de Relatórios
    usam as cores dos status: uma cor viva por assunto). */
export const estiloDoStatus = (st: string) => estiloDe(st);

/* Só estes dois ganham as ondas animadas — é o que o projeto pede. */
/* ARQUIVADAS (Augusto, 25/09/2026): as ondas saíram dos cards de Criação e
   Revisão — e do painel do pedido, que usa a mesma tabela. O código e as
   animações (public/p10/waves-*.json) ficam guardados: para voltar, é trocar
   ONDAS_LIGADAS para true. */
const ONDAS_ARQUIVADAS: Record<string, string> = { criacao: LOTTIE.ondasRoxo, revisao: LOTTIE.ondasAmarelo };
const ONDAS_LIGADAS = false;
const ONDAS: Record<string, string> = ONDAS_LIGADAS ? ONDAS_ARQUIVADAS : {};

const CINZA = "#8f8f8f";

/** Clareia uma cor em direção ao branco. t=0 não muda, t=1 vira branco. */
function clarear(hex: string, t: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6 || !t) return hex;
  const n = parseInt(h, 16);
  const canal = (c: number) => Math.round(c + (255 - c) * t);
  return "#" + [canal((n >> 16) & 255), canal((n >> 8) & 255), canal(n & 255)]
    .map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* Cards vizinhos de mesmo status vão clareando: 12% da cor a cada card, e 20%
   quando a cor de base já é clara — regra do Augusto. Num "Aguardando design"
   (#c2ffff) ou num "Revisão" (#fff079) o passo de 12% não se enxerga: a cor já
   está quase no branco, e clarear mais 12% dela quase não mexe no pixel.
   A escala reinicia quando a cor muda, e o teto de 84% impede que uma fila
   longa do mesmo status termine em branco. Chegando na última cor do
   degradê, ela volta para a primeira e recomeça o ciclo (Augusto,
   29/09/2026): travada no teto, uma fila longa virava um bloco de cards
   iguais, quase brancos. */
const PASSO_EM_FORTE = 0.12, PASSO_EM_CLARA = 0.2, LIMIAR_CLARA = 0.8, TETO = 0.84;
/* Cinza percebido da cor: 0 é preto, 1 é branco. Os pesos são os do olho —
   verde pesa cinco vezes mais que azul —, senão o #315bf4 do "Finalizado"
   entraria como claro só por ter o azul no talo. */
function luz(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 1;
  const n = parseInt(h, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
/* A tinta clara (branca no Cancelado, verde no Finalizado) só vale enquanto o
   fundo é escuro: o degradê dos vizinhos clareia o cartão e, a partir do
   terceiro de uma sequência, a letra branca sumia. A letra do Cancelado é
   sempre branca (Augusto, 05/10/2026), então quem cede é o degradê: com
   tinta clara, os vizinhos vão ESCURECENDO, nos mesmos 12% por cartão, em
   quatro degraus (até 36%), e o contraste só sobe. Cor cuja tinta já não
   dava 4,5 de contraste (WCAG) no tom cheio (o Finalizado azul e verde de
   hoje) segue a regra de sempre. */
function luzWcag(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 6) return 1;
  const n = parseInt(h, 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
/** Escurece uma cor em direção ao preto. t=0 não muda, t=1 vira preto. */
function escurecer(hex: string, t: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6 || !t) return hex;
  const n = parseInt(h, 16);
  const canal = (c: number) => Math.round(c * (1 - t));
  return "#" + [canal((n >> 16) & 255), canal((n >> 8) & 255), canal(n & 255)]
    .map((x) => x.toString(16).padStart(2, "0")).join("");
}
function contrasteWcag(a: string, b: string): number {
  const [x, y] = [luzWcag(a), luzWcag(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/* Devolve a cor já clareada E o fator usado. O fator importa para os cards
   animados: a Lottie cobre o card inteiro, então clarear o fundo deles não
   muda nada — o degradê precisa ir POR CIMA da animação. Véu branco em
   opacidade `t` dá exatamente o mesmo resultado que clarear(cor, t): as duas
   coisas são a mesma composição. */
function corSequencia(cores: string[], tintas: string[] = []): { cor: string; clareamento: number; seguidos: number }[] {
  let seguidos = 0;
  return cores.map((cor, i) => {
    if (i > 0 && cores[i - 1] === cor) seguidos++; else seguidos = 0;
    const passo = luz(cor) >= LIMIAR_CLARA ? PASSO_EM_CLARA : PASSO_EM_FORTE;
    /* degraus do ciclo: 0, passo, 2·passo… até o último que cabe no teto
       (8 nas cores fortes, até 84%; 5 nas claras, até 80%) */
    const tinta = tintas[i];
    if (tinta && luzWcag(tinta) > 0.5 && contrasteWcag(tinta, cor) >= 4.5) {
      const t = (seguidos % 4) * PASSO_EM_FORTE;
      return { cor: escurecer(cor, t), clareamento: 0, seguidos };
    }
    const degraus = Math.floor(TETO / passo + 1e-9) + 1;
    const t = (seguidos % degraus) * passo;
    return { cor: clarear(cor, t), clareamento: t, seguidos };
  });
}

export type PedidoLinha = {
  id: string; numero: number; cliente: string; status: string;
  /** "cliche" no cartão de refação e de reposição de clichê */
  tipo?: string | null;
  /** 1 no cartão de Refazer clichê de cliente antigo (quem cadastra é o design
      ou o admin, não uma vendedora) */
  cartao_refacao?: number | boolean | null;
  materia?: string | null; largura?: string | null; altura?: string | null;
  /** cores_desc: as que a vendedora pediu; cores_arte: as lidas da prova
      (desde 07/10/2026; numeroDeCores e coresEfetivas escolhem) */
  cores?: string | null; cores_desc?: string | null; cores_arte?: string | null;
  vendedor_id?: string; vendedor_nome?: string | null; designer_nome?: string | null;
  fila?: number | null; respostas_novas?: number; perguntas_abertas?: number;
  /** perguntas esperando a MINHA resposta (sem destinatário conta para o design) */
  perguntas_para_mim?: number;
  urgente?: number | null; faca_cod?: string | null; faca_nova?: number | null;
  /** onde o pedido estava antes de ir esperar o cliente */
  status_anterior?: string | null;
  created_at: string;
  /** quando fechou: o período vale para finalizado e cancelado por estas datas */
  updated_at?: string | null; cliche_concluido_em?: string | null; cancelado_em?: string | null;
};

/* Urgência só vale enquanto o pedido anda: finalizado ou cancelado não passa
   na frente nem ganha selo. */
const ehUrgente = (p: PedidoLinha) => Number(p.urgente) === 1 && p.status !== "concluido" && p.status !== "cancelado";
/* Fim do mês (Augusto, 30/09/2026): no último dia do mês, o pedido que ainda
   não foi finalizado (nem cancelado) ganha o calendário pulsando, no mesmo
   padrão do urgente. Vale a data do computador de quem olha. */
const ehUltimoDiaDoMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getDate() === 1;
const abertoNoFimDoMes = (p: PedidoLinha, hoje: Date) => ehUltimoDiaDoMes(hoje) && p.status !== "concluido" && p.status !== "cancelado";
const AVISO_FIM_DO_MES = "Último dia do mês: pedido ainda não finalizado";

/** O calendário do fim do mês, no círculo preto do urgente. No card vai com o
    dia escrito; na linha da lista (32 px) o número não se leria. */
function MarcaFimDoMes({ tam, dia }: { tam: number; dia?: number }) {
  return (
    <span role="img" aria-label={AVISO_FIM_DO_MES} title={AVISO_FIM_DO_MES} className="p10-fimdomes"
      style={{ flex: "none", width: tam, height: tam, borderRadius: 999, background: PRETO, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={Math.round(tam * 0.52)} height={Math.round(tam * 0.52)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <line x1="3.5" y1="10" x2="20.5" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
        {dia != null && <text x="12" y="18.3" textAnchor="middle" fontSize="7.4" fontWeight="800" fill="#fff" stroke="none" fontFamily="Inter, sans-serif">{dia}</text>}
      </svg>
    </span>
  );
}
/** Conversa esperando você: resposta nova a uma pergunta sua, ou pergunta
    que espera a sua resposta. */
const conversaParaMim = (p: PedidoLinha) => (p.respostas_novas ?? 0) > 0 || (p.perguntas_para_mim ?? 0) > 0;

const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
/* "—" é campo sem dado (o cartão de refação de clichê): não vira "—×—" */
const comValor = (v?: string | null) => (v && v !== "—" ? v : "");
const medidaDe = (p: PedidoLinha) =>
  comValor(p.largura) && comValor(p.altura) ? `${p.largura}×${p.altura}` : (comValor(p.largura) || comValor(p.altura) || "—");

const PERIODOS = ["Tudo", "Hoje", "Essa semana", "Esse mês"] as const;
type Periodo = (typeof PERIODOS)[number] | "Data";

/* Entrada e Cores ficam 12px mais baixos que Medida e Substrato, e com caixa
   fixa — é a diagramação do projeto. */
const CAIXA_DESLOCADA: CSSProperties = { width: 200, maxWidth: "100%", height: 62, position: "relative", top: 12 };

const CAIXA_POP: CSSProperties = {
  position: "absolute", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12,
  padding: 8, zIndex: 40, boxShadow: "0 -14px 40px -16px rgba(0,0,0,.6)",
  display: "flex", flexDirection: "column", gap: 3,
};

/* ————— Pedidos no rework v4 —————
   O desenho do Augusto (01/10/2026, Desktop/hubv3/v4/Pedidos.svg), medido no
   SVG com scripts/conferir-layout.py. Sem a faixa preta: a página toda no
   cinza, quatro cartões soltos e colados de c1 a c23 (440 cada, a 1,5 px do
   que ele desenhou: as bordas foram para as colunas), raio 20 e a sombra do
   Illustrator (deslocamento 7/7, desfoque 21, preto a 20%). Por dentro, as
   posições do desenho relativas ao cartão: os textos com a origem em 48 (a
   coluna de dentro) e em 258,4 (a segunda), o nome em 43,23 e a pílula de
   status com a borda em 34,84; as bases, relativas ao topo do cartão. No pé,
   o título em Fraunces 104 com a tinta na c1 e a base na linha 63, e os
   filtros em pílulas a partir da c6. As letras foram calibradas pela largura
   da tinta: Inter 24 com -0,03em, Fraunces 23 bold SuperSoft com -0,04em e
   Inter 20,5 nas pílulas. */
const V4 = {
  cartao: 440, altura: 720, topo: 152.22, raio: 20, sombra: "7px 7px 42px rgba(0,0,0,.2)",
  col1: 48, col2: 258.4, basePessoa: 71.78,
  mais: { tam: 20.46, braco: 3.27, centroDir: 72.34, centroY: 63.47 },
  /* o nome (Fraunces 58, entrelinha 52, até quatro linhas) mora em ChromeHub10
     (NomeDoCartaoV4), comum ao cartão do pedido aberto */
  pilula: { x: 34.84, topo: 414.43, altura: 49.92, borda: 2.37, esq: 32.68, dir: 45.82 },
  /* o pé do cartão (Entrada, Cores, Medida, Substrato) mora em ChromeHub10
     (PE_CARTAO_V4), comum ao cartão do pedido aberto */
  /* pé: base do título na linha 63; as pílulas (44 de altura, borda 2,21)
     terminam 0,85 acima dela, como no desenho; o vão entre elas é o dele */
  basePe: 63 * LINHA_DA_GRADE_HUB, pilulaAlt: 44.04, pilulaBorda: 2.21, vao: 29,
};
/* o canvas que mede a folga não aplica o SOFT e o opsz 72: no "P" de 104 a
   tinta caía 1 px depois da c1, e no "A" de Aprovações 3 (medido no pixel) */
const ACERTO_TITULO_PE: Record<string, number> = { P: 1, A: 3 };
const ROTULO_V4: CSSProperties = { position: "absolute", fontFamily: INTER, fontSize: 24, fontWeight: 400, letterSpacing: "-.03em", lineHeight: "24px", whiteSpace: "nowrap", zIndex: 1 };
/* as pílulas do pé em Inter média, como no desenho (medido pela massa de
   tinta, 01/10/2026; a normal saía 18% mais clara) */
const PILULA_PE: CSSProperties = { boxSizing: "border-box", height: V4.pilulaAlt, border: `${V4.pilulaBorda}px solid ${PRETO}`, borderRadius: 999, background: "transparent",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "2px 22px 0", fontFamily: INTER, fontSize: 20.5, fontWeight: 500, letterSpacing: "-.014em", color: PRETO, whiteSpace: "nowrap", cursor: "pointer" };
/* o botão de cadastrar a refação, no pé de Aprovações (o mesmo nome do status) */
const TEXTO_REFAZER = "Refazer clichê";

/* As colunas da tabela do "Ver todos": começam em c1, c4, c8, c11, c15, c17,
   c18 e c21 e terminam na c23 (1760 px de c1 a c23). Cada controle de cima
   começa numa delas (Augusto, 29/09/2026: "alinhe o cliente com a carteira e
   ajuste os demais"): Lista/Cards e Pedido na c1, Transferir carteira e
   Cliente na c4, busca e Vendedora na c8, Período e Medida na c15, Status e
   Substrato na c18. */
const COLUNAS_DA_LISTA = "240px 320px 240px 320px 160px 80px 240px 160px";
/* quanto o texto de uma linha desce para a base cair três linhas da grade
   abaixo do topo dela (a linha tem cinco; medido no hub de teste) */
const ACERTO_LINHA_DA_LISTA = 4;

/** Os filtros do "Ver todos" à direita, do jeito que são (largura do texto),
    só alinhados: o último termina na c23 e cada um dos outros termina na
    coluna antes do seguinte (com pelo menos 16 px entre eles). Um filtro pode
    começar numa coluna marcada (`inicios[i]`: o Período na c15, a coluna da
    Medida; o Status na c18, a do Substrato), se couber antes do seguinte. */
function PilulasADireita({ topo, inicios = [], children }: { topo: number; inicios?: (number | undefined)[]; children: ReactNode }) {
  const itens = Children.toArray(children).filter(Boolean);
  const caixas = useRef<(HTMLDivElement | null)[]>([]);
  const [direitas, setDireitas] = useState<number[]>([]);
  useLayoutEffect(() => {
    const calcular = () => {
      const larguras = itens.map((_, i) => caixas.current[i]?.offsetWidth ?? 0);
      const dir: number[] = [];
      let limite = 1840;
      for (let i = larguras.length - 1; i >= 0; i--) {
        const ultimo = i === larguras.length - 1;
        const inicio = inicios[i];
        if (inicio != null && inicio + larguras[i] + (ultimo ? 0 : 16) <= limite) dir[i] = inicio + larguras[i];
        else dir[i] = ultimo ? 1840 : Math.floor((limite - 16) / 80) * 80;
        limite = dir[i] - larguras[i];
      }
      setDireitas((antes) => (antes.length === dir.length && antes.every((v, j) => v === dir[j]) ? antes : dir));
    };
    calcular();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(calcular);
    caixas.current.slice(0, itens.length).forEach((el) => el && ro.observe(el));
    return () => ro.disconnect();
  }, [itens.length]);
  return (
    <>
      {itens.map((filho, i) => (
        <div key={i} ref={(el) => { caixas.current[i] = el; }}
          style={{ position: "absolute", top: topo, right: 1920 - (direitas[i] ?? 1840), visibility: direitas.length === itens.length ? "visible" : "hidden" }}>
          {filho}
        </div>
      ))}
    </>
  );
}

/* Pílula de filtro do "Ver todos". Diferente das do rodapé: fundo branco com
   contorno, e o menu abre PARA BAIXO — no rodapé ele abre para cima porque
   está colado na base da tela. */
function FiltroPilula({ rotulo, valor, aberto, aoAbrir, children }: {
  rotulo: string; valor: string; aberto: boolean; aoAbrir: () => void; children: ReactNode;
}) {
  return (
    <div data-pop style={{ position: "relative" }}>
      <button onClick={aoAbrir} className="p10-flat"
        style={{ display: "flex", alignItems: "center", gap: 8, height: 52, padding: "0 20px", border: `1px solid ${PRETO}`, borderRadius: 999, background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 16, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
        <span style={{ color: CINZA }}>{rotulo}:</span>{valor}
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .6 }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {aberto && children}
    </div>
  );
}

function OpcoesPop({ lista, atual, aoEscolher, style }: {
  lista: string[]; atual: string; aoEscolher: (v: string) => void; style?: CSSProperties;
}) {
  return (
    <div style={{ ...CAIXA_POP, ...style }}>
      {lista.map((v) => (
        <button key={v} onClick={() => aoEscolher(v)}
          style={{ textAlign: "left", height: 38, padding: "0 14px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: INTER, fontSize: 16, fontWeight: 500, background: v === atual ? PRETO : "transparent", color: v === atual ? "#fff" : PRETO }}>{v}</button>
      ))}
    </div>
  );
}

export function PedidoHub10({ profile, pedidos, aoNavegar, onNova, onLogout, disponiveis, detalheId, detalhe, podeNoPedido, acoesPedido, aoAbrirDetalhe, aoFecharDetalhe, podeFila, aoDefinirFila, aoEnfileirar, aoLimparFila, aoTransferir, children, titulo = "Pedidos", tituloTodos = "Todos os pedidos", vazioTitulo = "Nenhum pedido", vazioTexto = "Ajuste os filtros para ver mais pedidos.", somenteStatus, paginaAtiva = "Pedidos", faixaResumo = "pedidos", aoCadastrarRefacao, motivosDoCliche }: {
  profile: SessionUser;
  pedidos: PedidoLinha[];
  aoNavegar: (label: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  /** pedido aberto no painel 1.0 (null = trilha) */
  detalheId: string | null;
  /** dados do pedido aberto; null enquanto carrega */
  detalhe: DetalhePedido | null;
  podeNoPedido: PodeNoPedido;
  acoesPedido: AcoesPedido;
  aoAbrirDetalhe: (id: string) => void;
  aoFecharDetalhe: () => void;
  /** quem pode mexer na fila do design */
  podeFila?: boolean;
  aoDefinirFila?: (id: string, posicao: number | null) => Promise<unknown>;
  /** o "+" do card: o servidor escolhe a primeira vaga livre */
  aoEnfileirar?: (id: string) => Promise<unknown>;
  aoLimparFila?: () => Promise<unknown>;
  /** abre "Transferir carteira" — ausente para quem não tem a permissão.
      Não vem do handoff: é recurso do hub que a lista V1a tinha e que não
      podia se perder na troca das telas. */
  aoTransferir?: () => void;
  /** modais hospedados pela rota */
  children?: ReactNode;
  /* ————— variante da tela —————
     "Aprovações 1.0" é esta mesma tela com outro recorte: mesma trilha, mesmos
     filtros, mesmo Ver todos, só que restrita a um status e com outros textos.
     Parametrizar sai mais honesto que duplicar setecentas linhas que iam
     divergir na primeira correção. */
  titulo?: string;
  tituloTodos?: string;
  vazioTitulo?: string;
  vazioTexto?: string;
  /** mostra só pedidos nestes status (chaves do banco) */
  somenteStatus?: string[];
  /** qual item do menu fica sublinhado */
  paginaAtiva?: string;
  /** quais contagens vão na faixa preta — cada tela olha para o seu trecho
      do fluxo, e a de Aprovações não tem por que falar de fila de design */
  faixaResumo?: "pedidos" | "aprovacoes";
  /** "Refazer clichê" de Aprovações (só para designers e admin): cadastra o
      cartão do clichê de cliente que não está no hub */
  aoCadastrarRefacao?: (d: DadosRefazerCliche) => Promise<unknown>;
  motivosDoCliche?: () => Promise<{ id: string; nome: string }[]>;
}) {
  const [periodo, setPeriodo] = useState<Periodo>("Esse mês");
  const [dataEsp, setDataEsp] = useState("");
  const [fStatus, setFStatus] = useState("Todos");
  const [fVendedora, setFVendedora] = useState("Todas");
  const [menu, setMenu] = useState<null | "periodo" | "status" | "vendedora">(null);
  const [filaAberta, setFilaAberta] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [modo, setModo] = useState<"lista" | "grade">("lista");
  const [busca, setBusca] = useState("");
  /* confirmação "Arte enviada" — mora aqui porque quem hospeda a modal de
     devolver arte é esta tela, não o painel */
  /* caixa "Clichê chegou", que o Finalizar abre */
  const [finalizando, setFinalizando] = useState(false);
  /* lembrete antes do Finalizar quando o pedido não tem arte anexada */
  const [semArte, setSemArte] = useState(false);
  const [anexandoArte, setAnexandoArte] = useState(false);
  const [arteEnviada, setArteEnviada] = useState<{ resumo: string; numero: string; para: string } | null>(null);
  /* O aviso de resposta nova vive no card e some assim que o pedido é
     marcado como visto — o que acontece no próprio ato de abrir. Guardo o
     valor do clique para o painel saber se deve saltar a resposta. */
  const [respostaNova, setRespostaNova] = useState(false);
  /* confirmação do "Limpar fila" */
  const [limparFila, setLimparFila] = useState(false);
  const [rolou, setRolou] = useState(false);
  const [aviso, setAviso] = useState("");
  /* "Refazer clichê" de Aprovações (Augusto, 02/10/2026): o cadastro do clichê
     de cliente antigo, e o recado de que o cartão entrou */
  const [refazendo, setRefazendo] = useState(false);
  const [recadoOk, setRecadoOk] = useState("");
  useEffect(() => {
    if (!recadoOk) return;
    const t = setTimeout(() => setRecadoOk(""), 6000);
    return () => clearTimeout(t);
  }, [recadoOk]);
  const clientesDosPedidos = useMemo(() => [...new Set(pedidos.map((p) => String(p.cliente ?? "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, 500), [pedidos]);
  const [devolver, setDevolver] = useState(false);
  /* caixa "Pasta do cliente": abre antes de iniciar a criação — ou antes de
     entregar a arte, se o pedido chegou até ali sem pasta — e depois segue
     para o que a pessoa tinha pedido */
  const [pastaPara, setPastaPara] = useState<null | "iniciar" | "arte">(null);

  const trilha = useRef<HTMLDivElement | null>(null);

  /* ESC fecha o que esta tela abriu */
  const escDaTela = useCallback(() => {
    /* o menu aberto fecha antes da tela de baixo: com um filtro aberto no
       "Ver todos", o ESC fechava o "Ver todos" e deixava o menu */
    if (menu || filaAberta) { setMenu(null); setFilaAberta(null); return; }
    if (verTodos) setVerTodos(false);
  }, [menu, filaAberta, verTodos]);
  /* "Ver todos" fica por cima da trilha, então sobe de nível enquanto aberto */
  useEscDoTopo(true, verTodos ? NIVEL.verTodos : 1, escDaTela);
  const fecharSemArte = useCallback(() => { if (!anexandoArte) setSemArte(false); }, [anexandoArte]);
  useEscDoTopo(semArte, NIVEL.caixa, fecharSemArte);
  const fecharLimparFila = useCallback(() => setLimparFila(false), []);
  useEscDoTopo(limparFila, NIVEL.caixa, fecharLimparFila);

  /* Aberto pela busca do topo, por um aviso ou pelo "Ver pedido" do Novo
     pedido, o pedido não passa pelo `abrir` daqui, e a resposta nova se
     perdia: a marca de visto a zera logo depois. Lida da lista que já estava
     na tela. */
  const abertoPorAqui = useRef<string | null>(null);
  const lidoPara = useRef<string | null>(null);
  useEffect(() => {
    if (!detalheId) { abertoPorAqui.current = null; lidoPara.current = null; return; }
    if (lidoPara.current === detalheId || abertoPorAqui.current === detalheId) return;
    const p = pedidos.find((x) => x.id === detalheId);
    if (!p) return;   // a lista ainda não chegou: espera por ela
    lidoPara.current = detalheId;
    setRespostaNova((p.respostas_novas ?? 0) > 0);
  }, [detalheId, pedidos]);

  /* Clicar fora fecha os menus do rodapé e o seletor de fila. */
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest?.("[data-pop]")) return;
      setMenu(null); setFilaAberta(null);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, []);

  /* As margens ficam limpas, como no desenho (v4): o cartão cujo meio sai da
     janela de c1 a c23 some, e a sombra dos que estão dentro continua inteira
     (cortar a trilha nas colunas cortaria a sombra). Direto no DOM, sem estado:
     a rolagem dispara dezenas de vezes e não precisa redesenhar 180 cartões. */
  const atualizarJanela = useCallback(() => {
    const el = trilha.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>(".pd4-cartao").forEach((c) => {
      const meio = c.offsetLeft + c.offsetWidth / 2 - el.scrollLeft;
      const dentro = meio >= 80 && meio <= 1840;
      c.style.opacity = dentro ? "" : "0";
      c.style.pointerEvents = dentro ? "" : "none";
    });
  }, []);
  const quadroJanela = useRef(0);
  const aoRolarTrilha = () => {
    setRolou(true);
    cancelAnimationFrame(quadroJanela.current);
    quadroJanela.current = requestAnimationFrame(atualizarJanela);
  };

  /* Arrastar com o ponteiro. Guarda se houve movimento para não abrir o
     pedido quando o clique foi, na verdade, um arrasto. */
  const arrasto = useRef({ ativo: false, x0: 0, scroll0: 0, escala: 1, andou: false });
  const aoApontar = (e: PointerEventReact<HTMLDivElement>) => {
    const el = trilha.current;
    if (!el || e.button !== 0) return;
    /* com o palco em escala (janela menor que 1920), a trilha anda o que a
       mão andou, na medida da página */
    const escala = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
    arrasto.current = { ativo: true, x0: e.clientX, scroll0: el.scrollLeft, escala, andou: false };
  };
  /* A roda vertical anda um cartão por giro, e a trilha encaixa no cartão
     pela conta (trilha-encaixe.ts): o scroll-snap do CSS media o cartão em
     hover, que cresce, e deixava a trilha 8 px fora da coluna; no arrasto
     ele prendia a trilha, que pulava um cartão inteiro de uma vez (Augusto,
     07/10/2026: "alguns tem um comportamento estranho no scroll"). */
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
      /* Caneta digitalizadora: ao levantar a ponta o `pointerup` nem sempre
         chega (vem `pointercancel`, ou nada, quando o snap rola a trilha por
         baixo). O arrasto ficava ligado e a trilha seguia a caneta pela tela
         sem ninguém estar arrastando. `buttons === 0` quer dizer que nada
         está pressionado — então acabou, seja lá qual evento faltou. */
      if (e.buttons === 0) { soltar(); return; }
      const d = e.clientX - a.x0;
      if (Math.abs(d) > 4) { a.andou = true; setRolou(true); }
      el.scrollLeft = a.scroll0 - d / a.escala;
    };
    /* Com o botão apertado na trilha, arrastar é rolar: a seleção de texto não
       começa. Antes o arrasto pintava o texto dos cartões com o marca-texto
       (Augusto, 06/10/2026: "corrija o arrastar"). */
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

  /* ————— filtros —————
     O período vale só para o que FECHOU (finalizado e cancelado), pela data
     em que fechou. Pedido em aberto aparece sempre: com "Esse mês", um
     pedido de agosto ainda na criação sumia da tela em setembro (Augusto,
     29/09/2026). */
  const dataDoPeriodo = (p: PedidoLinha) =>
    p.status === "concluido" ? (p.cliche_concluido_em || p.updated_at || p.created_at)
      : p.status === "cancelado" ? (p.cancelado_em || p.updated_at || p.created_at)
        : null;
  const noPeriodo = (p: PedidoLinha) => {
    if (periodo === "Tudo") return true;
    const quando = dataDoPeriodo(p);
    if (!quando) return true;   // em aberto: sempre
    const d = new Date(quando);
    if (Number.isNaN(d.getTime())) return true;
    const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (periodo === "Data") {
      if (!dataEsp) return true;
      const [a, m, dd] = dataEsp.split("-").map(Number);
      return dia.getFullYear() === a && dia.getMonth() === m - 1 && dia.getDate() === dd;
    }
    const hj = new Date();
    const hoje = new Date(hj.getFullYear(), hj.getMonth(), hj.getDate());
    if (periodo === "Hoje") return dia.getTime() === hoje.getTime();
    if (periodo === "Essa semana") { const dif = (hoje.getTime() - dia.getTime()) / 86_400_000; return dif >= 0 && dif < 7; }
    return dia.getFullYear() === hoje.getFullYear() && dia.getMonth() === hoje.getMonth();
  };

  /* Os filtros só podem oferecer o que existe *dentro* do escopo da tela.
     Em Aprovações, que já é presa a um status, a lista inteira de status
     dava opções que nunca devolvem nada — escolher "Criação" ali zerava a
     tela sem explicação. */
  const escopo = somenteStatus?.join(",") ?? "";
  /* Esperando o cliente, o pedido é do trecho onde parou: em Aprovações só
     entra o que parou numa etapa dela (o que parou na Criação é do design). */
  const noEscopo = (p: PedidoLinha) => !somenteStatus || (somenteStatus.includes(p.status)
    && (p.status !== "aguardando_cliente" || !p.status_anterior || somenteStatus.includes(p.status_anterior)));
  const doEscopo = useMemo(
    () => pedidos.filter(noEscopo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pedidos, escopo],
  );
  const statusUnicos = useMemo(
    () => [...new Set(doEscopo.map((p) => estiloDe(p.status).rotulo))].sort(),
    [doEscopo],
  );
  /* quem cadastrou cartão de Refazer clichê não é vendedora (Augusto,
     07/10/2026: "Admin" e "Design" apareciam no filtro); quem fez pedido de
     verdade continua, seja do papel que for */
  const vendedoras = useMemo(
    () => [...new Set(doEscopo.filter((p) => !p.cartao_refacao).map((p) => p.vendedor_nome).filter(Boolean) as string[])].sort(),
    [doEscopo],
  );
  /* Se a escolha deixou de existir — o último cancelado voltou a andar, a
     vendedora não tem mais pedido no período — o filtro se desfaz sozinho em
     vez de deixar a tela vazia com um controle que sumiu. */
  const eStatus = statusUnicos.includes(fStatus) ? fStatus : "Todos";
  const eVendedora = vendedoras.includes(fVendedora) ? fVendedora : "Todas";
  /* "Limpar filtros" (Augusto, 02/10/2026: "precisamos de um botão limpar
     filtros em todas as páginas que usam filtros"): volta Status, Vendedora,
     Período e a busca ao começo. Aparece só com algum filtro ligado. */
  const filtrando = eStatus !== "Todos" || eVendedora !== "Todas" || periodo !== "Esse mês" || !!busca.trim();
  const limparFiltros = () => { setFStatus("Todos"); setFVendedora("Todas"); setPeriodo("Esse mês"); setDataEsp(""); setBusca(""); setMenu(null); };

  const filtrados = useMemo(
    () => pedidos.filter((p) =>
      noEscopo(p)
      && noPeriodo(p)
      && (eStatus === "Todos" || estiloDe(p.status).rotulo === eStatus)
      && (eVendedora === "Todas" || p.vendedor_nome === eVendedora)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pedidos, periodo, dataEsp, eStatus, eVendedora, escopo],
  );

  /* Na fila primeiro, na ordem marcada; depois os urgentes; o resto pela
     chegada, como vem. A fila é decisão da designer e vale mais que a marca
     de urgência. Em Pedidos (a fila do design), o "Aguardando design" vem
     sempre na frente (Augusto, 05/10/2026: "na fila de design o aguardando
     design sempre aparece primeiro na ordem"): primeiro o bloco dele, com a
     mesma regra (fila, urgentes, o resto), depois os outros status. */
  const ordenados = useMemo(() => {
    const ordenar = (lista: PedidoLinha[]) => {
      const naFila = lista.filter((p) => p.fila != null).sort((a, b) => (a.fila ?? 0) - (b.fila ?? 0));
      const fora = lista.filter((p) => p.fila == null);
      return [...naFila, ...fora.filter(ehUrgente), ...fora.filter((p) => !ehUrgente(p))];
    };
    if (escopo) return ordenar(filtrados);
    const naFrente = (p: PedidoLinha) => p.status === "nova" || p.fila != null;
    return [...ordenar(filtrados.filter(naFrente)), ...ordenar(filtrados.filter((p) => !naFrente(p)))];
  }, [filtrados, escopo]);

  const quantosNaFila = ordenados.filter((p) => p.fila != null).length;

  const fundos = useMemo(() => corSequencia(ordenados.map((p) => estiloDe(p.status).cor), ordenados.map((p) => estiloDe(p.status).tinta)), [ordenados]);

  /* a lista mudou (filtro, atualização de 5 em 5 s): os cartões novos entram
     já sabendo se estão na janela */
  useLayoutEffect(() => { atualizarJanela(); }, [ordenados, atualizarJanela]);

  /* As pílulas do pé começam na c6, como no desenho; um título mais comprido
     que "Pedidos" (Aprovações) as empurra, para nunca encostarem nele. */
  const tituloRef = useRef<HTMLDivElement | null>(null);
  const [pilulasEsq, setPilulasEsq] = useState(480 - V4.pilulaBorda / 2);
  useLayoutEffect(() => {
    const el = tituloRef.current;
    if (!el) return;
    const medir = () => {
      const esq = Math.max(480 - V4.pilulaBorda / 2, Math.ceil(el.offsetLeft + el.offsetWidth + 44));
      setPilulasEsq((antes) => (antes === esq ? antes : esq));
    };
    medir();
    void document.fonts?.ready.then(medir);
  }, [titulo]);

  /* A mesma regra de busca do hub (criarBusca): sem acento ("laticinios" acha
     "Laticínios") e com a medida escrita de qualquer jeito ("41x16", "41 × 16",
     "38,66x40"). Antes era um includes cru, que dependia de acento e não
     olhava a medida. */
  /* "Vendas Simulação 2" trazia os pedidos da outra vendedora: o "2" casava
     com o 2 de "#25", "#21" e "P 2042 C" (simulação 6, 07/10/2026). Agora,
     fora a medida (que segue a regra do hub, criarBusca):
       - número sozinho casa com número inteiro: "2" acha "#2" e "V2", não
         "#25" nem "2042"; "#24" acha o #24 e não o #245; "38" ainda acha a
         38,66 (a parte inteira);
       - a frase inteira num campo só vale mais que as palavras espalhadas:
         se algum pedido tem a frase ("Vendas Simulação 2" na vendedora),
         ficam só eles. */
  const naBusca = useMemo(() => {
    const q = normalizarBusca(busca);
    if (!q) return ordenados;
    /* as duas grafias do número entram no texto procurado: quem digita
       "#3" e quem digita "#03" acham a mesma linha */
    const partes = (p: PedidoLinha) => [p.cliente, numeroPedido(p.numero), `#${p.numero}`, p.vendedor_nome, p.designer_nome, estiloDe(p.status).rotulo,
      p.largura && p.altura ? `${p.largura}x${p.altura}` : p.largura || p.altura,
      /* a faca serve deitada: "30x50" acha o pedido de 50×30 */
      p.largura && p.altura ? `${p.altura}x${p.largura}` : undefined, p.materia, p.cores_desc, p.cores_arte];
    const junto = q.replace(/ /g, "");
    if (/^\d+(?:\.\d+)?x\d+(?:\.\d+)?$/.test(junto)) {
      const casa = criarBusca(busca);
      return ordenados.filter((p) => casa(...partes(p)));
    }
    const alvos = ordenados.map((p) => alvoBusca(...partes(p)));
    const termos = q.split(" ");
    if (termos.length > 1) {
      const naFrase = ordenados.filter((_, i) => alvos[i].includes(junto));
      if (naFrase.length) return naFrase;
    }
    const testes = termos.map((t) => {
      const n = /^(#?)(\d+)$/.exec(t);
      if (!n) return (alvo: string) => alvo.includes(t);
      /* nem dígito antes (nem a parte decimal, "66" de "38.66"), nem depois */
      const re = new RegExp(n[1] ? `#${n[2]}(?!\\d)` : `(?<!\\d)(?<!\\d\\.)${n[2]}(?!\\d)`);
      return (alvo: string) => re.test(alvo);
    });
    return ordenados.filter((_, i) => testes.every((casa) => casa(alvos[i])));
  }, [ordenados, busca]);

  /* ————— estatísticas da faixa preta ————— */
  const est = useMemo(() => {
    const dois = (n: number) => String(n).padStart(2, "0");
    /* a faixa conta o recorte da tela: os abertos todos e os fechados do
       período (antes ela contava tudo e não batia com a lista), e também os
       filtros de Status e Vendedora do rodapé (Augusto, 30/09/2026: com a
       vendedora escolhida, a faixa ainda falava do hub inteiro) */
    const noRecorte = pedidos.filter((p) => noPeriodo(p)
      && (eStatus === "Todos" || estiloDe(p.status).rotulo === eStatus)
      && (eVendedora === "Todas" || p.vendedor_nome === eVendedora));
    const conta = (k: string) => noRecorte.filter((p) => p.status === k).length;
    /* Aprovações conta o trecho do fluxo que ela governa — do design pronto
       até o clichê — e não a fila de design, que é assunto de Pedidos. */
    if (faixaResumo === "aprovacoes") {
      /* "pedidos no total" é o total DA TELA (o trecho que ela lista); antes
         contava o hub inteiro e não batia com os cards (simulação 3,
         30/09/2026). "finalizados" fica: é a saída deste trecho no período. */
      const doTrecho = noRecorte.filter(noEscopo);
      return {
        l1: `${dois(conta("aprovada"))} aprovados · ${dois(conta("cliche"))} na clicheria · ${dois(conta("aguardando"))} aguardando aprovação · ${dois(conta("refazer_cliche"))} refazer clichê`,
        l2: `${dois(doTrecho.length)} pedidos no total · ${dois(doTrecho.filter((p) => p.status === "aguardando_cliente").length)} aguardando cliente · ${dois(conta("concluido"))} finalizados`,
      };
    }
    return {
      l1: `${dois(conta("nova"))} aguardando design · ${dois(conta("revisao"))} em revisão · ${dois(conta("aprovada"))} aprovados · ${dois(conta("aguardando"))} design criado`,
      l2: `${dois(noRecorte.length)} pedidos no total · ${dois(conta("aguardando_cliente"))} aguardando cliente · ${dois(conta("cancelado"))} cancelados`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidos, faixaResumo, periodo, dataEsp, escopo, eStatus, eVendedora]);

  /* Abrir fecha o "Ver todos": ele cobre o palco (z 50) e o painel do pedido
     fica embaixo (z 38) — o clique na linha abria o pedido escondido, e parecia
     que nada tinha acontecido. */
  /* Entrar e sair dos cartões (transicao-cartao.ts; Augusto, 07/10/2026:
     "adicione transições ao entrar e sair dos cards"). Abrir pelo cartão
     anima a saída da trilha, e o pedido aberto só aparece quando ela acaba
     e os dados chegaram (até lá a trilha fica, sem receber clique); fechar
     anima a saída do pedido e depois a volta da trilha. Pelo "Ver todos",
     pela busca ou pelo aviso, abre como antes. */
  const [saindoDaTrilha, setSaindoDaTrilha] = useState(false);
  const entrada = useRef<{ id: string; jeito: JeitoDoCartao; centro: { x: number; y: number } } | null>(null);
  const volta = useRef<{ id: string; jeito: JeitoDoCartao } | null>(null);
  const fechando = useRef(false);
  /* onde o cartão do pedido aberto mora no palco (a c1, no alto das capas) */
  const LUGAR_DO_PEDIDO = { x: 80, y: CAPA_V4.topo };
  const abrir = (p: PedidoLinha, cartao?: HTMLElement) => {
    abertoPorAqui.current = p.id;
    setRespostaNova((p.respostas_novas ?? 0) > 0);
    setVerTodos(false);
    const jeito = jeitoDoCartao(), el = trilha.current;
    if (jeito && el && cartao && !detalheId) {
      const de = posicaoNaTrilha(el, cartao);
      entrada.current = { id: p.id, jeito, centro: { x: de.x + cartao.offsetWidth / 2, y: de.y + cartao.offsetHeight / 2 } };
      const ms = sairDaTrilha(el, cartao, jeito, LUGAR_DO_PEDIDO);
      setSaindoDaTrilha(true);
      window.setTimeout(() => setSaindoDaTrilha(false), ms);
    } else entrada.current = null;
    aoAbrirDetalhe(p.id);
  };
  const detalheNaTela = !!(detalheId && detalhe && !saindoDaTrilha);
  /* o pedido aberto acabou de aparecer: entra com o jeito do clique */
  useLayoutEffect(() => {
    if (!detalheNaTela) return;
    const e = entrada.current;
    entrada.current = null;
    const raiz = document.querySelector<HTMLElement>("[data-pedido-aberto]");
    if (e && e.id === detalheId && raiz) entrarNoCartao(raiz, e.jeito, e.centro);
  }, [detalheNaTela, detalheId]);
  /* fechar: o pedido aberto sai, depois fecha de fato */
  const fecharComTransicao = useCallback(() => {
    if (fechando.current) return;
    const jeito = jeitoDoCartao(), el = trilha.current, id = detalheId;
    const raiz = document.querySelector<HTMLElement>("[data-pedido-aberto]");
    if (!jeito || !el || !id || !raiz) { aoFecharDetalhe(); return; }
    const cartao = el.querySelector<HTMLElement>(`[data-pedido-id="${CSS.escape(id)}"]`);
    let destino: { x: number; y: number } | undefined;
    if (cartao) {
      const d = posicaoNaTrilha(el, cartao);
      destino = { x: d.x + cartao.offsetWidth / 2, y: d.y + cartao.offsetHeight / 2 };
    }
    fechando.current = true;
    const ms = sairDoCartao(raiz, jeito, destino);
    volta.current = { id, jeito };
    window.setTimeout(() => { fechando.current = false; aoFecharDetalhe(); }, ms);
  }, [aoFecharDetalhe, detalheId]);
  /* fechou (ou o pedido não chegou a abrir): a trilha volta; sem a volta
     animada, só desfaz a saída */
  useLayoutEffect(() => {
    if (detalheId) return;
    const el = trilha.current;
    if (!el) return;
    const v = volta.current;
    volta.current = null;
    entrada.current = null;
    const cartao = v ? el.querySelector<HTMLElement>(`[data-pedido-id="${CSS.escape(v.id)}"]`) : null;
    voltarATrilha(el, cartao, v?.jeito ?? null, LUGAR_DO_PEDIDO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalheId]);

  const enfileirar = (id: string) => {
    if (!aoEnfileirar) return;
    void Promise.resolve(aoEnfileirar(id))
      .catch((e: unknown) => setAviso(erroLegivel(e, "Não deu para pôr na fila.")));
  };

  const mudarFila = (id: string, posicao: number | null) => {
    setFilaAberta(null);
    if (!aoDefinirFila) return;
    void Promise.resolve(aoDefinirFila(id, posicao))
      .catch((e: unknown) => setAviso(erroLegivel(e, "Não deu para mudar a fila.")));
  };

  const rotuloPeriodo = periodo === "Data"
    ? (dataEsp ? dataEsp.split("-").reverse().join("/") : "Data específica")
    : periodo;

  /* As pílulas do pé não podem passar por baixo do "Ver todos": com filtro
     de texto comprido (o "Status: Refazer clichê", uma vendedora de nome
     grande), o "Limpar filtros" chegava nele (simulação 6, 07/10/2026). Sem
     espaço, ele vira só "Limpar". Medido com o texto inteiro, uma vez por
     combinação de filtros, e de novo quando a fonte chega. */
  const pilulasRef = useRef<HTMLDivElement | null>(null);
  const verTodosRef = useRef<HTMLButtonElement | null>(null);
  const [fontesDoPe, setFontesDoPe] = useState(0);
  useEffect(() => { void document.fonts?.ready.then(() => setFontesDoPe((n) => n + 1)); }, []);
  const chaveDoPe = [eStatus, eVendedora, rotuloPeriodo, filtrando, pilulasEsq, fontesDoPe].join("|");
  const [apertoDoPe, setApertoDoPe] = useState({ chave: "", apertado: false });
  const peApertado = apertoDoPe.chave === chaveDoPe && apertoDoPe.apertado;
  useLayoutEffect(() => {
    if (apertoDoPe.chave === chaveDoPe) return;
    const el = pilulasRef.current, vt = verTodosRef.current;
    if (!el || !vt) return;
    setApertoDoPe({ chave: chaveDoPe, apertado: el.offsetLeft + el.offsetWidth > vt.offsetLeft - V4.vao });
  }, [chaveDoPe, apertoDoPe.chave]);

  /* ————— o cartão —————
     Função que desenha, e não componente: declarado aqui dentro, um
     componente é um TIPO novo a cada render, e o React desmontava e remontava
     todos os cards a cada atualização da lista (que vem a cada 5 s). Os cards
     "andavam" sob o mouse e um clique caía no card errado (simulação de
     28/09/2026). */
  const desenharCartao = ({ p, fundo, clareamento, seguidos, indice, semBase = false }: { p: PedidoLinha; fundo: string; clareamento: number; seguidos: number; indice: number; semBase?: boolean }) => {
    const e = estiloDe(p.status);
    const ondas = ONDAS[p.status];
    const naFila = p.fila != null;
    /* o cartão de clichê fica com quem cadastrou (Augusto, 02/10/2026), como no filtro Vendedora */
    const pessoa = p.tipo === "cliche" ? (p.vendedor_nome ?? "—") : p.vendedor_id === profile.id ? (p.designer_nome ?? "A definir") : (p.vendedor_nome ?? "—");
    /* Este cartão só aparece no "Ver todos" (Cards), que não arrasta. O teste
       do arrasto ficava com o último arrasto da trilha e o cartão não abria
       depois que alguém arrastava a trilha (06/10/2026). */
    return (
      <div key={p.id} onClick={() => abrir(p)} className="p10-card"
        /* Sem contorno lateral: quem separa um card do vizinho é o degradê
           sequencial da cor, não um traço. Na trilha o traço de baixo fecha a
           faixa; no "Ver todos", onde os cards se empilham em várias
           fileiras, ele virava risco no meio da grade e sai. */
        style={{ position: "relative", flex: "0 0 25%", background: ondas ? e.cor : fundo, borderBottom: semBase ? undefined : `1px solid ${PRETO}`, cursor: "pointer", color: e.tinta, height: 616 }}>
        {/* Vizinhos de mesmo status animado alternam o espelho da animação.
            Só o degradê não bastava: as ondas nascem de um canto, e dois cards
            seguidos com o mesmo canto de origem continuavam lendo como um
            painel único. Espelhado, o segundo tem a origem no canto oposto. */}
        {ondas && (
          <LottieHub10 src={ondas}
            /* Cada card entra num ponto diferente do laço. 0,37 é irracional o
               bastante para que a volta não caia em uníssono: com 1/4 ou 1/2,
               um em cada quatro cards voltaria a bater com o vizinho. */
            inicio={(indice * 0.37) % 1} encaixe="slice"
            style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden",
              transform: seguidos % 2 === 1 ? "scaleX(-1)" : undefined }} />
        )}
        {/* o degradê dos vizinhos, aplicado por cima da animação */}
        {ondas && clareamento > 0 && (
          <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, background: "#fff", opacity: clareamento, pointerEvents: "none" }} />
        )}

        <span style={{ position: "absolute", left: 80, top: 58, fontSize: 24, fontWeight: 500, letterSpacing: "-.02em", zIndex: 1 }}>{pessoa}</span>


        {/* Canto superior direito, como no handoff. Dividi esse canto com o
            "+" e com o selo da fila — quando os três aparecem juntos eles se
            sobrepõem. Foi escolha do Augusto manter assim. */}
        {/* O balão acende para a conversa que espera por você: resposta nova
            a uma pergunta sua, ou pergunta esperando a sua resposta. Antes só
            a primeira acendia, e a pergunta ficava sem ninguém ver (simulação
            de 28/09/2026). Abrir o pedido salta a caixa da conversa. */}
        {conversaParaMim(p) && (
          <LottieHub10 src={LOTTIE.chat} style={{ position: "absolute", right: 35, top: 18, width: 64, height: 64, zIndex: 12, pointerEvents: "none" }} />
        )}

        {podeFila && !naFila && p.status === "nova" && (
          <svg onClick={(ev) => { ev.stopPropagation(); enfileirar(p.id); }} className="p10-plus"
            width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={e.tinta} strokeWidth={2} strokeLinecap="round"
            style={{ position: "absolute", right: 73, top: 57, cursor: "pointer", zIndex: 2 }}>
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}

        {naFila && (
          <>
            <div data-pop onClick={(ev) => { ev.stopPropagation(); if (podeFila) setFilaAberta(filaAberta === p.id ? null : p.id); }}
              style={{ position: "absolute", right: 78, top: 0, width: 80, height: 88, background: PRETO, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 15, lineHeight: 1, cursor: podeFila ? "pointer" : "default", zIndex: 3 }}>
              <span style={{ fontSize: 32, fontWeight: 900 }}>{String(p.fila).padStart(2, "0")}</span>
              {/* Este selo é exceção à regra de minúscula dos cards: o Augusto
                  pediu a caixa alta do handoff de volta em 23/09/2026. */}
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>da fila</span>
            </div>
            {filaAberta === p.id && (
              <div data-pop onClick={(ev) => ev.stopPropagation()}
                style={{ position: "absolute", right: 0, top: 70, width: 196, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12, padding: 12, zIndex: 20, boxShadow: "0 18px 40px -16px rgba(0,0,0,.5)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PRETO }}>Posição na fila</div>
                  <button onClick={() => setFilaAberta(null)} title="Fechar" style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
                {/* A fila começa em 01. O protótipo oferecia o zero e um card
                    escrito "00 da fila" não quer dizer nada ao lado de um
                    "01" — Augusto, 23/09/2026. */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5 }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => mudarFila(p.id, n)}
                      style={{ height: 28, border: `1px solid ${PRETO}`, borderRadius: 7, cursor: "pointer", padding: 0, fontFamily: INTER, fontSize: 14, fontWeight: 700, background: p.fila === n ? PRETO : "#fff", color: p.fila === n ? "#fff" : PRETO }}>{n}</button>
                  ))}
                </div>
                <button onClick={() => mudarFila(p.id, null)} style={{ marginTop: 10, width: "100%", height: 32, border: `1px solid ${PRETO}`, borderRadius: 8, background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Tirar da fila</button>
                {/* "Limpar fila" tira TODOS de uma vez e a ordem não fica
                    guardada em lugar nenhum — desfazer é remontar na mão. Um
                    clique ao lado de "Tirar da fila", que mexe só num pedido,
                    era perto demais. */}
                <button onClick={() => { setFilaAberta(null); setLimparFila(true); }}
                  style={{ marginTop: 6, width: "100%", height: 32, border: `1px solid ${PALETA.perigo}`, borderRadius: 8, background: "#fff", color: PALETA.perigo, fontFamily: INTER, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Limpar fila</button>
              </div>
            )}
          </>
        )}

        {/* quatro linhas no máximo: um nome comprido descia por cima do status.
            O paddingBottom deixa ver a perna do g, do p e do ç da última linha,
            que passa 5,5 px da entrelinha de 58 e era cortada pelo limite
            (Augusto, 30/09/2026: "o G está cortando na parte de baixo"). */}
        <div title={p.cliente} style={{ position: "absolute", left: 76, top: 113, width: 335, ...FR, fontSize: 56, lineHeight: "58px", letterSpacing: "-.04em", zIndex: 1,
          display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere", paddingBottom: 8 }}>{p.cliente}</div>

        {/* Status e urgência na mesma linha: o círculo preto com "!" vem
            colado na pílula, na mesma altura, e pulsa (Augusto, 28/09/2026:
            a marca é parte do estado do pedido; o selo solto na margem
            parecia perdido). A pílula continua em 76/351. */}
        {/* Urgente e fim do mês juntos: os dois círculos encolhem para 44 e
            chegam mais perto. Em 50, ao lado de "Aguardando cliente", o
            calendário encostava na borda do card e o anel era cortado pelo
            card vizinho (Augusto, 30/09/2026). */}
        {(() => {
          const hoje = new Date();
          const fimDoMes = abertoNoFimDoMes(p, hoje);
          const dois = ehUrgente(p) && fimDoMes;
          const selo = dois ? 44 : 50;
          return (
            <div style={{ position: "absolute", left: 76, top: 351, display: "flex", alignItems: "center", gap: dois ? 8 : 12, zIndex: 1 }}>
              <div style={{ height: 50, display: "inline-flex", alignItems: "center", padding: "0 24px", border: `2px solid ${e.tinta}`, borderRadius: 999, fontSize: 24, fontWeight: 600, whiteSpace: "nowrap" }}>{e.rotulo}</div>
              {ehUrgente(p) && (
                <div role="img" aria-label="Pedido urgente" title="Pedido urgente" className="p10-urgente"
                  style={{ flex: "none", width: selo, height: selo, borderRadius: 999, background: PRETO, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: dois ? 23 : 26, fontWeight: 900, lineHeight: 1 }}>
                  <span>!</span>
                </div>
              )}
              {fimDoMes && <MarcaFimDoMes tam={selo} dia={hoje.getDate()} />}
            </div>
          );
        })()}

        {/* `auto` na segunda coluna herdava os 200px fixos de "Entrada"/"Cores"
            e a grade somava 406 numa faixa de 358 — o substrato longo saía
            pela direita do card. minmax(0,1fr) prende a coluna ao que sobra e
            deixa o texto quebrar dentro dela. */}
        <div style={{ position: "absolute", left: 82, right: 40, top: 413, display: "grid", gridTemplateColumns: "206px minmax(0, 1fr)", rowGap: 30, zIndex: 1 }}>
          <CampoHub10 rotulo="Entrada:" valor={dataCurta(p.created_at)} caixa={CAIXA_DESLOCADA} />
          <CampoHub10 rotulo="Cores:" valor={numeroDeCores(p) || "—"} caixa={CAIXA_DESLOCADA} />
          <CampoHub10 rotulo="Medida:" valor={medidaDe(p)} />
          <CampoHub10 rotulo="Substrato:" valor={p.materia || "—"} />
        </div>
      </div>
    );
  };

  /* O cartão do rework v4, na trilha: solto, com raio e sombra, e por dentro
     as posições do desenho. Tudo o que o cartão fazia continua (Augusto,
     01/10/2026: "as funcionalidades atuais continuam"): a cor de cada status
     com o degradê dos vizinhos, o selo "01 da fila" e o "+" no mesmo canto
     (um ou outro), a conversa esperando, a urgência e o fim do mês ao lado do
     status. As ondas, arquivadas, não entram. O cartão de cima fica por cima
     do seguinte, como no desenho: a sombra cai no vizinho da direita. */
  const desenharCartaoV4 = ({ p, fundo, indice, total }: { p: PedidoLinha; fundo: string; indice: number; total: number }) => {
    const e = estiloDe(p.status);
    const naFila = p.fila != null;
    /* o cartão de clichê fica com quem cadastrou (Augusto, 02/10/2026), como no filtro Vendedora */
    const pessoa = p.tipo === "cliche" ? (p.vendedor_nome ?? "—") : p.vendedor_id === profile.id ? (p.designer_nome ?? "A definir") : (p.vendedor_nome ?? "—");
    const hoje = new Date();
    const fimDoMes = abertoNoFimDoMes(p, hoje);
    const dois = ehUrgente(p) && fimDoMes;
    const selo = dois ? 44 : 50;
    const meio = V4.mais.tam / 2;
    /* o desenho pinta o texto do cartão de preto puro; o #252425 do mapa de
       status continua no "Ver todos" e no painel do pedido (conferente de
       layout, 01/10/2026). O Finalizado, azul, mantém o verde. */
    const tinta = e.tinta === "#252425" ? PRETO : e.tinta;
    return (
      <div key={p.id} data-pedido-id={p.id} onClick={(ev) => { if (!arrasto.current.andou) abrir(p, ev.currentTarget); }} className="pd4-cartao"
        style={{ position: "relative", flex: `0 0 ${V4.cartao}px`, height: V4.altura, borderRadius: V4.raio, background: fundo, color: tinta, boxShadow: V4.sombra, zIndex: total - indice, cursor: "pointer" }}>
        <span style={{ ...ROTULO_V4, left: V4.col1, top: V4.basePessoa - baseInter(24, 24), maxWidth: V4.cartao - V4.col1 - 112, overflow: "hidden", textOverflow: "ellipsis" }}>{pessoa}</span>

        {conversaParaMim(p) && (
          <LottieHub10 src={LOTTIE.chat} style={{ position: "absolute", right: 35, top: 18, width: 64, height: 64, zIndex: 12, pointerEvents: "none" }} />
        )}

        {/* o "+" do desenho (20,5 px, braço de 3,3): põe o pedido na fila */}
        {podeFila && !naFila && p.status === "nova" && (
          <svg onClick={(ev) => { ev.stopPropagation(); enfileirar(p.id); }} className="p10-plus" role="button" aria-label="Pôr na fila"
            width={V4.mais.tam} height={V4.mais.tam} viewBox={`0 0 ${V4.mais.tam} ${V4.mais.tam}`}
            style={{ position: "absolute", left: V4.cartao - V4.mais.centroDir - meio, top: V4.mais.centroY - meio, cursor: "pointer", zIndex: 2 }}>
            <rect x={0} y={meio - V4.mais.braco / 2} width={V4.mais.tam} height={V4.mais.braco} fill={tinta} />
            <rect x={meio - V4.mais.braco / 2} y={0} width={V4.mais.braco} height={V4.mais.tam} fill={tinta} />
          </svg>
        )}

        {/* o selo da fila no lugar do "+", centrado no mesmo eixo */}
        {naFila && (
          <>
            <div data-pop onClick={(ev) => { ev.stopPropagation(); if (podeFila) setFilaAberta(filaAberta === p.id ? null : p.id); }}
              style={{ position: "absolute", right: V4.mais.centroDir - 40, top: 0, width: 80, height: 88, background: PRETO, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 15, boxSizing: "border-box", lineHeight: 1, cursor: podeFila ? "pointer" : "default", zIndex: 3 }}>
              <span style={{ fontSize: 32, fontWeight: 900 }}>{String(p.fila).padStart(2, "0")}</span>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>da fila</span>
            </div>
            {filaAberta === p.id && (
              <div data-pop onClick={(ev) => ev.stopPropagation()}
                style={{ position: "absolute", right: 16, top: 70, width: 196, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12, padding: 12, zIndex: 20, boxShadow: "0 18px 40px -16px rgba(0,0,0,.5)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PRETO }}>Posição na fila</div>
                  <button onClick={() => setFilaAberta(null)} title="Fechar" style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 5 }}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => mudarFila(p.id, n)}
                      style={{ height: 28, border: `1px solid ${PRETO}`, borderRadius: 7, cursor: "pointer", padding: 0, fontFamily: INTER, fontSize: 14, fontWeight: 700, background: p.fila === n ? PRETO : "#fff", color: p.fila === n ? "#fff" : PRETO }}>{n}</button>
                  ))}
                </div>
                <button onClick={() => mudarFila(p.id, null)} style={{ marginTop: 10, width: "100%", height: 32, border: `1px solid ${PRETO}`, borderRadius: 8, background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Tirar da fila</button>
                <button onClick={() => { setFilaAberta(null); setLimparFila(true); }}
                  style={{ marginTop: 6, width: "100%", height: 32, border: `1px solid ${PALETA.perigo}`, borderRadius: 8, background: "#fff", color: PALETA.perigo, fontFamily: INTER, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Limpar fila</button>
              </div>
            )}
          </>
        )}

        {/* o nome: o mesmo do cartão do pedido aberto (ChromeHub10) */}
        <NomeDoCartaoV4 nome={p.cliente ?? ""} />

        {/* status e, colados nele, a urgência e o fim do mês */}
        <div style={{ position: "absolute", left: V4.pilula.x, top: V4.pilula.topo, height: V4.pilula.altura, display: "flex", alignItems: "center", gap: dois ? 8 : 12, zIndex: 1 }}>
          <div style={{ boxSizing: "border-box", height: V4.pilula.altura, display: "inline-flex", alignItems: "center", padding: `0 ${V4.pilula.dir}px 0 ${V4.pilula.esq}px`,
            border: `${V4.pilula.borda}px solid ${tinta}`, borderRadius: 999, fontFamily: INTER, fontSize: 24, fontWeight: 400, letterSpacing: "-.03em", whiteSpace: "nowrap" }}>{e.rotulo}</div>
          {ehUrgente(p) && (
            <div role="img" aria-label="Pedido urgente" title="Pedido urgente" className="p10-urgente"
              style={{ flex: "none", width: selo, height: selo, borderRadius: 999, background: PRETO, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: dois ? 23 : 26, fontWeight: 900, lineHeight: 1 }}>
              <span>!</span>
            </div>
          )}
          {fimDoMes && <MarcaFimDoMes tam={selo} dia={hoje.getDate()} />}
        </div>

        {/* o pé (Entrada, Cores, Medida, Substrato): o mesmo do cartão do pedido aberto */}
        <PeDoCartaoV4 entrada={dataCurta(p.created_at)} cores={numeroDeCores(p) || "—"} medida={medidaDe(p)} substrato={p.materia || "—"} />
      </div>
    );
  };

  /* os filtros do pé: o nome do filtro na pílula; escolhido um valor, a
     pílula mostra o valor e acende no amarelo do hub. `comRotulo` escreve
     "Status: Refazer clichê", para quando o valor sozinho repete o texto de
     outra pílula do pé. */
  const pilulaDoPe = (chave: "periodo" | "status" | "vendedora", rotulo: string, valor: string, ligado: boolean, minimo: number, menuAberto: ReactNode, comRotulo = false) => (
    <div key={chave} data-pop style={{ position: "relative", flex: "none" }}>
      <button onClick={() => setMenu(menu === chave ? null : chave)} className="p10-flat" aria-haspopup="menu" aria-expanded={menu === chave}
        aria-label={ligado ? `${rotulo}: ${valor}` : rotulo}
        style={{ ...PILULA_PE, minWidth: minimo, background: ligado ? AMARELO_MAIS : "transparent" }}>{ligado ? (comRotulo ? `${rotulo}: ${valor}` : valor) : rotulo}</button>
      {menu === chave && !verTodos && menuAberto}
    </div>
  );

  return (
    <PalcoFixo>
      {/* a página toda no cinza do rework, da barra ao pé (sem a faixa preta) */}
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />

      {/* a trilha (v4): os cartões começam na c1 e andam um por vez; o que
          passa das colunas some (atualizarJanela) e a sombra fica inteira.
          Vai até 957: a sombra do cartão no hover (que sobe e cresce) chega
          perto disso, e com 932 aparecia o corte dela. Em cima começa em 40,
          por baixo da barra (que aqui fica transparente): começando em 112, a
          sombra do hover saía cortada reta ali (conferente de layout). */}
      <div ref={trilha} className="p10-trilha" onPointerDown={aoApontar} onScroll={aoRolarTrilha}
        style={{ position: "absolute", left: 0, top: 40, width: 1920, height: 917, boxSizing: "border-box", padding: `${V4.topo - 40}px 0 0 80px`,
          display: "flex", alignItems: "flex-start", overflowX: ordenados.length > 4 ? "auto" : "hidden", overflowY: "hidden", scrollPaddingLeft: 80, zIndex: 2,
          /* com um pedido aberto, o painel cobre só até 728 e a trilha (até 872)
             aparecia por baixo dele: antes a faixa preta a escondia */
          visibility: detalheNaTela || (detalheId && !entrada.current) ? "hidden" : undefined,
          /* abrindo pelo cartão, a trilha fica na tela enquanto sai, mas não recebe clique */
          pointerEvents: detalheId ? "none" : undefined }}>
        {ordenados.map((p, i) => desenharCartaoV4({ p, fundo: fundos[i].cor, indice: i, total: ordenados.length }))}
        {/* a margem da direita: o último cartão para na c23 */}
        {ordenados.length > 4 && <div aria-hidden style={{ flex: "0 0 80px", height: 1 }} />}
      </div>

      {!ordenados.length && (
        <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 760, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 2, color: PRETO }}>
          <div style={{ ...FR, fontSize: 44, letterSpacing: "-.02em" }}>{vazioTitulo}</div>
          {/* "ajuste os filtros" só com filtro ligado: com o hub vazio e os
              filtros no começo, o texto mandava mexer no que nem estava
              ligado (simulação 5, 05/10/2026) */}
          <div style={{ fontSize: 20, color: CINZA }}>
            {filtrando ? vazioTexto
              : faixaResumo === "aprovacoes" ? "Os pedidos aparecem aqui quando o design for criado." : "Os pedidos aparecem aqui assim que entrarem."}
          </div>
        </div>
      )}

      {/* O rótulo em pé na margem, centrado nos cartões: Inter 20 média lendo de
          baixo para cima, a base em x = 56,5 e o "F" começando em 559,17, como
          no desenho. Só em Pedidos (em Aprovações não há fila do design). */}
      {!somenteStatus && ordenados.length > 0 && !detalheId && (
        <span aria-hidden style={{ position: "absolute", left: 56.5 - baseInter(20, 20), top: 559.17 + folgaInter(500, 20, "F") + 1, transformOrigin: "0 0", transform: "rotate(-90deg)",
          fontFamily: INTER, fontSize: 20, fontWeight: 500, lineHeight: "20px", whiteSpace: "nowrap", color: PRETO, zIndex: 3 }}>Fila design</span>
      )}

      {/* a seta de rolar: a animada, padrão das trilhas, no lugar da seta
          parada do desenho (margem da direita, meio dos cartões; Augusto,
          02/10/2026: "devolva a animação da seta"); some quando a pessoa rola */}
      {!rolou && ordenados.length > 4 && !detalheId && <SetaDaTrilha centro={[1867.3, 512.2]} />}

      {/* ————— o pé (v4): a página e os filtros —————
          O título em Fraunces 104 com a tinta na c1 e a base na linha 63; as
          pílulas a partir da c6 (o meio do traço na coluna, como o Illustrator
          desenha) e "Ver todos" terminando na c23. Os dados da faixa preta
          (título grande, resumo de contagens) saíram com ela. */}
      <div ref={tituloRef} style={{ position: "absolute", left: 80 - folgaFraunces(600, 104, titulo.charAt(0)) - (ACERTO_TITULO_PE[titulo.charAt(0)] ?? 0), top: V4.basePe - baseFraunces(104, 104),
        ...FR, fontSize: 104, lineHeight: "104px", letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO, zIndex: 3 }}>{titulo}</div>

      <div ref={pilulasRef} style={{ position: "absolute", left: pilulasEsq, top: V4.basePe - 0.85 - V4.pilulaAlt, display: "flex", alignItems: "center", gap: V4.vao, zIndex: NIVEL.painel + 2 /* acima do pedido aberto: a lista do filtro abria por trás dos painéis (Augusto, 02/10/2026) */ }}>
        {/* Em Aprovações, com o Status em "Refazer clichê", a pílula do filtro
            e o botão de cadastrar diziam as duas "Refazer clichê", lado a lado
            (simulação 6, 07/10/2026): aí o filtro diz que é o Status. */}
        {statusUnicos.length > 1 && pilulaDoPe("status", "Status", eStatus, eStatus !== "Todos", 143.29,
          <OpcoesPop lista={["Todos", ...statusUnicos]} atual={eStatus}
            aoEscolher={(v) => { setFStatus(v); setMenu(null); }}
            style={{ left: 0, bottom: "calc(100% + 16px)", minWidth: 230 }} />,
          !!(aoCadastrarRefacao && motivosDoCliche) && eStatus === TEXTO_REFAZER)}
        {vendedoras.length > 1 && pilulaDoPe("vendedora", "Vendedora", eVendedora, eVendedora !== "Todas", 178.24,
          <OpcoesPop lista={["Todas", ...vendedoras]} atual={eVendedora}
            aoEscolher={(v) => { setFVendedora(v); setMenu(null); }}
            style={{ left: 0, bottom: "calc(100% + 16px)", minWidth: 230 }} />)}
        {pilulaDoPe("periodo", "Período", rotuloPeriodo, periodo !== "Esse mês", 143.29,
          <div style={{ ...CAIXA_POP, left: 0, bottom: "calc(100% + 16px)", minWidth: 210 }}>
            {PERIODOS.map((v) => (
              <button key={v} onClick={() => { setPeriodo(v); setMenu(null); }}
                style={{ textAlign: "left", height: 38, padding: "0 14px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: INTER, fontSize: 16, fontWeight: 500, background: v === periodo ? PRETO : "transparent", color: v === periodo ? "#fff" : PRETO }}>{v}</button>
            ))}
            <div style={{ height: 1, background: "rgba(37,36,37,.12)", margin: "5px 6px" }} />
            <label style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 8px 6px", cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: periodo === "Data" ? PRETO : CINZA }}>Data específica</span>
              <input type="date" value={dataEsp} onChange={(ev) => { setDataEsp(ev.target.value); setPeriodo("Data"); }}
                style={{ height: 36, border: `1px solid ${PRETO}`, borderRadius: 8, padding: "0 10px", fontFamily: INTER, fontSize: 15, color: PRETO, background: periodo === "Data" ? PALETA.amarelo : "#fff", outline: "none" }} />
            </label>
          </div>)}
        {/* o "Refazer clichê" (só em Aprovações, para designers e admin): o
            clichê de cliente que não está no hub, danificado ou gasto */}
        {aoCadastrarRefacao && motivosDoCliche && (
          <button onClick={() => { setRefazendo(true); setMenu(null); }} className="p10-flat" style={{ ...PILULA_PE, minWidth: 143.29 }}>{TEXTO_REFAZER}</button>
        )}
        {filtrando && (
          <button onClick={limparFiltros} className="p10-flat" style={PILULA_PE} aria-label="Limpar filtros" title={peApertado ? "Limpar filtros" : undefined}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>{peApertado ? "Limpar" : "Limpar filtros"}
          </button>
        )}
      </div>

      <button ref={verTodosRef} onClick={() => { setVerTodos(true); setMenu(null); }} className="p10-flat"
        style={{ ...PILULA_PE, position: "absolute", right: 1920 - (1840 + V4.pilulaBorda / 2), top: V4.basePe - 0.85 - V4.pilulaAlt, minWidth: 143.29, zIndex: 30 }}>Ver todos</button>

      {/* ————— Ver todos ————— */}
      {verTodos && (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO, zIndex: 50, color: PRETO }}>
          {/* Na grade, sem mudar nada do desenho (Augusto, 29/09/2026: "só
              alinhe, não altere nada"; ChromeHub10, listas "Ver todos"):
              título na c1/linha 7, contagem na 10, fechar terminando na c23;
              os controles centrados na linha 14, cada um da esquerda começando
              numa coluna (c1, c4, c7) e os filtros terminando em colunas, o
              último na c23; a lista a partir da linha 17. */}
          <div style={tituloDaLista(tituloTodos.charAt(0))}>{tituloTodos}</div>
          <div style={{ ...textoNaGrade(80, 10, 20, 400, String(naBusca.length).charAt(0)), color: CINZA }}>{naBusca.length} {naBusca.length === 1 ? "pedido" : "pedidos"}</div>
          <button onClick={() => setVerTodos(false)} className="p10-dot" aria-label="Fechar"
            style={{ ...FECHAR_DA_LISTA, width: 56, height: 56, borderRadius: 999, border: `1px solid ${PRETO}`, background: PRETO, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>

          <div>
            {/* Lista/Cards da c1 à c3, terminando onde começa a coluna do
                Cliente (marcado pelo Augusto, 29/09/2026): as duas metades
                iguais, no lugar do respiro de 26 px de cada lado */}
            <div style={{ position: "absolute", left: 80, top: topoDoControle(54.5), boxSizing: "border-box", width: 160, display: "flex", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 999, padding: 4 }}>
              {(["lista", "grade"] as const).map((m) => (
                <button key={m} onClick={() => setModo(m)}
                  style={{ flex: 1, border: 0, borderRadius: 999, padding: "11px 0", fontFamily: INTER, fontSize: 15, fontWeight: 600, cursor: "pointer", background: modo === m ? PRETO : "transparent", color: modo === m ? "#fff" : PRETO }}>{m === "lista" ? "Lista" : "Cards"}</button>
              ))}
            </div>
            {aoTransferir && (
              <button onClick={aoTransferir} className="p10-flat" title="Passar os clientes de uma vendedora para outra"
                style={{ position: "absolute", left: 320, top: topoDoControle(52), height: 52, padding: "0 22px", border: `1px solid ${PRETO}`, borderRadius: 999, background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 9 }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4" /><path d="M21 7H8" /><path d="M7 21l-4-4 4-4" /><path d="M3 17h13" /></svg>
                Transferir carteira
              </button>
            )}
            {/* a busca da c8 à c14, começando com a coluna da Vendedora e um
                pouco menor que antes (480; eram 560): pedido do Augusto em
                29/09/2026, marcado na tela */}
            <label style={{ position: "absolute", left: 640, top: topoDoControle(52), boxSizing: "border-box", height: 52, width: 480, border: `1.5px dashed ${PRETO}`, borderRadius: 999, background: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "0 22px", cursor: "text" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></svg>
              <input value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar cliente, nº, medida, vendedora ou status" aria-label="Buscar pedido"
                style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontFamily: INTER, fontSize: 17, color: PRETO }} />
            </label>

            {/* Os mesmos três filtros do rodapé, repetidos aqui: o "Ver todos"
                cobre a tela inteira e esconde o rodapé, então sem isto não há
                como filtrar de dentro dele. */}
            <PilulasADireita topo={topoDoControle(52)} inicios={statusUnicos.length > 1 ? [1200, 1440] : [1200]}>
              <FiltroPilula rotulo="Período" valor={rotuloPeriodo} aberto={menu === "periodo"} aoAbrir={() => setMenu(menu === "periodo" ? null : "periodo")}>
                <div style={{ ...CAIXA_POP, right: 0, top: "calc(100% + 10px)", minWidth: 220, zIndex: 60, boxShadow: "0 20px 44px -16px rgba(0,0,0,.5)" }}>
                  {PERIODOS.map((v) => (
                    <button key={v} onClick={() => { setPeriodo(v); setMenu(null); }}
                      style={{ textAlign: "left", height: 38, padding: "0 14px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: INTER, fontSize: 16, fontWeight: 500, background: v === periodo ? PRETO : "transparent", color: v === periodo ? "#fff" : PRETO }}>{v}</button>
                  ))}
                  <div style={{ height: 1, background: "rgba(37,36,37,.12)", margin: "5px 6px" }} />
                  <label style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 8px 6px", cursor: "pointer" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: periodo === "Data" ? PRETO : CINZA }}>Data específica</span>
                    <input type="date" value={dataEsp} onChange={(ev) => { setDataEsp(ev.target.value); setPeriodo("Data"); }}
                      style={{ height: 36, border: `1px solid ${PRETO}`, borderRadius: 8, padding: "0 10px", fontFamily: INTER, fontSize: 15, color: PRETO, background: periodo === "Data" ? PALETA.amarelo : "#fff", outline: "none" }} />
                  </label>
                </div>
              </FiltroPilula>

              {statusUnicos.length > 1 && (
                <FiltroPilula rotulo="Status" valor={eStatus} aberto={menu === "status"} aoAbrir={() => setMenu(menu === "status" ? null : "status")}>
                  <OpcoesPop lista={["Todos", ...statusUnicos]} atual={eStatus}
                    aoEscolher={(v) => { setFStatus(v); setMenu(null); }}
                    style={{ right: 0, top: "calc(100% + 10px)", minWidth: 240, zIndex: 60, boxShadow: "0 20px 44px -16px rgba(0,0,0,.5)" }} />
                </FiltroPilula>
              )}

              {vendedoras.length > 1 && (
                <FiltroPilula rotulo="Vendedora" valor={eVendedora} aberto={menu === "vendedora"} aoAbrir={() => setMenu(menu === "vendedora" ? null : "vendedora")}>
                  <OpcoesPop lista={["Todas", ...vendedoras]} atual={eVendedora}
                    aoEscolher={(v) => { setFVendedora(v); setMenu(null); }}
                    style={{ right: 0, top: "calc(100% + 10px)", minWidth: 240, zIndex: 60, boxShadow: "0 20px 44px -16px rgba(0,0,0,.5)" }} />
                </FiltroPilula>
              )}
              {filtrando && (
                <button onClick={limparFiltros} className="p10-flat"
                  style={{ display: "flex", alignItems: "center", gap: 8, height: 52, padding: "0 20px", border: `1px solid ${PRETO}`, borderRadius: 999, background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 16, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>Limpar filtros
                </button>
              )}
            </PilulasADireita>
          </div>

          {/* a tabela na grade: as colunas começam em c1, c3, c8, c11, c15,
              c17, c18 e c21 e terminam na c23; o cabeçalho tem três linhas da
              grade (rótulo com a base na linha 19) e cada pedido cinco (texto
              com a base três linhas abaixo do topo da faixa dele) */}
          {modo === "lista" ? (
            <div className="p10-trilha" style={{ position: "absolute", left: 0, top: TOPO_DA_LISTA, width: 1920, bottom: 0, boxSizing: "border-box", overflowY: "auto", overflowX: "hidden", padding: "0 80px 60px" }}>
              <div style={{ display: "grid", gridTemplateColumns: COLUNAS_DA_LISTA, boxSizing: "border-box", height: 3 * LINHA_DA_GRADE_HUB, paddingTop: 2 * LINHA_DA_GRADE_HUB - baseInter(13, 13), alignItems: "start", fontSize: 13, lineHeight: "13px", fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: CINZA, borderBottom: `1.5px solid ${PRETO}`, position: "sticky", top: 0, background: FUNDO, zIndex: 1 }}>
                <span>Pedido</span><span>Cliente</span><span>Vendedora</span><span>Status</span><span>Medida</span><span>Cores</span><span>Substrato</span><span>Entrada</span>
              </div>
              {naBusca.map((p) => {
                const e = estiloDe(p.status);
                return (
                  <div key={p.id} className="p10-linha" onClick={() => abrir(p)}
                    style={{ display: "grid", gridTemplateColumns: COLUNAS_DA_LISTA, alignItems: "center", boxSizing: "border-box", height: 5 * LINHA_DA_GRADE_HUB, paddingTop: ACERTO_LINHA_DA_LISTA, borderBottom: "1px solid rgba(37,36,37,.12)", fontSize: 18, cursor: "pointer" }}>
                    <span style={{ fontWeight: 700 }}>{numeroPedido(p.numero)}</span>
                    {/* as reticências param 16 px antes da coluna da Vendedora:
                        no fim da coluna, o nome comprido encostava nela (vão de
                        0 a 3,4 px, simulação 6, 07/10/2026). O nome inteiro, no title. */}
                    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, paddingRight: 16 }}>
                      <span title={p.cliente ?? undefined} style={{ ...FR, fontSize: 22, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.cliente}</span>
                    </span>
                    <span>{p.vendedor_nome ?? "—"}</span>
                    {/* a urgência e a conversa na linha do status, como no card */}
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", whiteSpace: "nowrap", height: 32, padding: "0 16px", borderRadius: 999, background: e.cor, color: e.tinta, fontSize: 14, fontWeight: 700 }}>{e.rotulo}</span>
                      {ehUrgente(p) && (
                        <span role="img" aria-label="Pedido urgente" title="Pedido urgente" className="p10-urgente"
                          style={{ flex: "none", width: 32, height: 32, borderRadius: 999, background: PRETO, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 900, lineHeight: 1 }}>
                          <span>!</span>
                        </span>
                      )}
                      {abertoNoFimDoMes(p, new Date()) && <MarcaFimDoMes tam={32} />}
                      {/* o balão do card, no tamanho do "!": a Lottie tem margem
                          própria, então a caixa de 32 leva um desenho de 39
                          (a mesma conta do painel do pedido, 53 para 44) */}
                      {conversaParaMim(p) && (
                        <span role="img" aria-label="Conversa esperando você" title="Conversa esperando você"
                          style={{ flex: "none", width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <LottieHub10 src={LOTTIE.chat} style={{ width: 39, height: 39, flex: "none", transform: "translateY(-2.6px)", pointerEvents: "none" }} />
                        </span>
                      )}
                    </span>
                    <span>{medidaDe(p)}</span><span>{numeroDeCores(p) || "—"}</span><span>{p.materia || "—"}</span><span>{dataCurta(p.created_at)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p10-trilha" style={{ position: "absolute", left: 0, top: TOPO_DA_LISTA, width: 1920, bottom: 0, overflowY: "auto", overflowX: "hidden" }}>
              <div style={{ display: "flex", flexWrap: "wrap", width: 1920, borderTop: `1px solid ${PRETO}` }}>
                {(() => {
                  const seq = corSequencia(naBusca.map((x) => estiloDe(x.status).cor), naBusca.map((x) => estiloDe(x.status).tinta));
                  return naBusca.map((p, i) => desenharCartao({ p, fundo: seq[i].cor, clareamento: seq[i].clareamento, seguidos: seq[i].seguidos, indice: i, semBase: true }));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {detalheId && detalhe && !saindoDaTrilha && (() => {
        const e = estiloDe(String(detalhe.pedido.status ?? ""));
        /* key por pedido: abrir outro pedido (busca, aviso) com um em edição
           levava junto o formulário aberto, e o Salvar gravava os dados do
           primeiro no segundo (revisão de 28/09/2026) */
        return (
          <PedidoDetalheHub10 key={detalheId} dados={detalhe} cor={e.cor} tinta={e.tinta} statusRotulo={e.rotulo}
            temOndas={ONDAS[String(detalhe.pedido.status ?? "")]}
            souVendedor={detalhe.pedido.vendedor_id === profile.id}
            euId={profile.id} respostaNova={respostaNova} souAdmin={profile.role === "admin"}
            pode={podeNoPedido}
            acoes={{ ...acoesPedido,
              /* entregar ou reenviar a arte não pergunta a pasta: ela se escolhe
                 só no "Iniciar criação" (Augusto, 02/10/2026: "ao reenviar arte o
                 designer não precisa escolher a pasta novamente"). Pedido antigo,
                 de antes da regra, sem pasta: a arte espera na pasta do hub. */
              enviarArte: () => setDevolver(true),
              /* Pedido sem arte anexada: lembra antes do Finalizar. Tem
                 cliente que não precisa de arte, então não trava (Augusto,
                 28/09/2026). */
              finalizar: () => (detalhe.anexos.some((a) => a.tipo === "arte") ? setFinalizando(true) : setSemArte(true)),
              pedirPasta: () => setPastaPara("iniciar") }}
            aoFechar={fecharComTransicao} />
        );
      })()}

      {pastaPara && detalhe && (
        <PastaClienteHub10
          pedido={{ num: numeroPedido(Number(detalhe.pedido.numero)), cliente: String(detalhe.pedido.cliente ?? "") }}
          /* pedido sem pasta tem TODOS os anexos esperando no hub */
          anexos={detalhe.anexos.length}
          corStatus={estiloDe(String(detalhe.pedido.status ?? "")).cor}
          acao={pastaPara === "iniciar" ? "Iniciar criação" : "Continuar"}
          fechar={() => setPastaPara(null)}
          onConfirmar={async (d) => {
            /* pasta já confirmada (a tentativa anterior confirmou e o passo
               seguinte falhou): não confirma de novo, segue direto */
            const r = detalhe.pasta ? undefined : (await acoesPedido.confirmarPasta(d)) as { falhas?: string[] } | undefined;
            const depois = pastaPara;
            if (depois === "iniciar") await acoesPedido.mudarStatus("criacao", "Criação iniciada");
            setPastaPara(null);
            if (depois === "arte") setDevolver(true);
            if (r?.falhas?.length) {
              setAviso(`Pasta confirmada, mas nem todo anexo foi para ela: ${r.falhas.join(" · ")}. Eles continuam ligados ao pedido.`);
            }
          }} />
      )}

      {devolver && detalhe && (
        <DesignCriadoHub10
          pedido={{
            num: numeroPedido(Number(detalhe.pedido.numero)),
            cliente: String(detalhe.pedido.cliente ?? ""),
            spec: numeroDeCores(detalhe.pedido) ? `${numeroDeCores(detalhe.pedido)} cores` : "",
            /* as cores que a vendedora já escreveu no briefing entram
               preenchidas (o designer confere em vez de digitar de novo); da
               segunda entrega em diante, as da arte anterior */
            coresNomes: separarCores(coresEfetivas(detalhe.pedido)),
          }}
          /* v1 na primeira entrega, v2 na segunda. Conta as entregas no
             HISTÓRICO, não os anexos: entregar sem arquivo anexado é comum e
             assim a versão não avançava. É também o que o projeto faz. */
          versaoSugerida={`v${detalhe.historico.filter(ehEntregaDeArte).length + 1}`}
          fechar={() => setDevolver(false)}
          onEnviar={(d) => {
            const cliente = String(detalhe.pedido.cliente ?? "");
            const num = numeroPedido(Number(detalhe.pedido.numero));
            const quantas = d.cores.filter(Boolean).length;
            /* quem recebe a arte, pelo nome — "para a vendedora" não dizia
               para quem (Augusto, 25/09/2026) */
            const para = String(detalhe.pedido.vendedor_nome ?? "").trim() || "a vendedora";
            /* A caixa espera: fecha aqui, no sucesso; o erro ela mostra e
               continua aberta com o que foi preenchido. */
            return Promise.resolve(acoesPedido.enviarArteFinal({ versao: d.versao, cores: d.cores, obs: d.obs, arquivos: d.arquivos }))
              /* a tela de "Arte enviada" é do handoff; sem ela a modal só
                 sumia e o designer não tinha como saber se foi */
              .then(() => {
                setDevolver(false);
                setArteEnviada({
                  resumo: [cliente, `Arte ${d.versao || "final"}`, quantas ? `${quantas} ${quantas === 1 ? "cor" : "cores"}` : ""]
                    .filter(Boolean).join("  ·  "),
                  numero: num,
                  para,
                });
              });
          }}
        />
      )}

      {finalizando && detalhe && (
        <ClicheChegouHub10
          pedido={{
            num: numeroPedido(Number(detalhe.pedido.numero)),
            cliente: String(detalhe.pedido.cliente ?? ""),
            /* as cores da ARTE, que é o que virou clichê (não as pedidas) */
            cores: coresEfetivas(detalhe.pedido) || String(detalhe.pedido.cores ?? ""),
          }}
          fechar={() => setFinalizando(false)}
          /* a caixa espera: fecha no sucesso, e no erro fica aberta com os
             valores e a nota, mostrando o motivo */
          onSalvar={(r) => Promise.resolve(acoesPedido.registrarCliche(r)).then(() => setFinalizando(false))}
        />
      )}

      {semArte && detalhe && (
        <div onClick={() => { if (!anexandoArte) setSemArte(false); }}
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 70, background: "rgba(37,36,37,.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(ev) => ev.stopPropagation()} role="dialog" aria-label="Pedido sem arte"
            style={{ width: 640, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, padding: "40px 44px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)" }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>Este pedido não tem arte anexada</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              Tem cliente que não precisa de arte, e dá para finalizar assim. Se houver arte, anexe agora: ela fica guardada com o pedido.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12 }}>
              <button onClick={() => setSemArte(false)} disabled={anexandoArte} className="p10-flat"
                style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
              <div style={{ display: "flex", gap: 12 }}>
                <label className="p10-flat"
                  style={{ display: "inline-flex", alignItems: "center", height: 50, padding: "0 24px", border: `1.5px dashed ${PRETO}`, borderRadius: 999, color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: anexandoArte ? "wait" : "pointer" }}>
                  <input type="file" multiple disabled={anexandoArte} style={{ display: "none" }}
                    onChange={(ev) => {
                      const fs = Array.from(ev.target.files ?? []);
                      ev.target.value = "";
                      if (!fs.length) return;
                      setAnexandoArte(true);
                      void Promise.resolve(acoesPedido.anexarArte(fs))
                        .then(() => { setSemArte(false); setFinalizando(true); })
                        .catch((e: unknown) => setAviso(erroLegivel(e, "Não deu para anexar a arte.")))
                        .finally(() => setAnexandoArte(false));
                    }} />
                  {anexandoArte ? "Enviando…" : "Anexar arte"}
                </label>
                <button onClick={() => { setSemArte(false); setFinalizando(true); }} disabled={anexandoArte} className="p10-flat"
                  style={{ height: 50, padding: "0 26px", border: "none", borderRadius: 999, background: PRETO, color: "#fff", fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Finalizar sem arte</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {arteEnviada && (
        <ModalSucesso titulo={`Arte enviada\npara ${arteEnviada.para || "a vendedora"}`} resumo={arteEnviada.resumo} numero={arteEnviada.numero}
          aoFechar={() => setArteEnviada(null)} />
      )}

      {limparFila && (
        <div onClick={() => setLimparFila(false)}
          style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 70, background: "rgba(37,36,37,.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(ev) => ev.stopPropagation()}
            style={{ width: 520, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, padding: "40px 44px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)" }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>Limpar a fila inteira?</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              Os {quantosNaFila} pedidos que estão na fila perdem a posição de uma vez. A ordem não fica guardada. Para voltar, é enfileirar um por um.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setLimparFila(false)} className="p10-flat"
                style={{ height: 50, padding: "0 24px", border: `2px solid ${PRETO}`, borderRadius: 999, background: "none", color: PRETO, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Voltar</button>
              <button onClick={() => { setLimparFila(false); void aoLimparFila?.().catch(() => setAviso("Não deu para limpar a fila.")); }} className="p10-flat"
                style={{ height: 50, padding: "0 26px", border: "none", borderRadius: 999, background: PALETA.perigo, color: PALETA.perigoTinta, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer" }}>Sim, limpar a fila</button>
            </div>
          </div>
        </div>
      )}

      <BarraTopoHub10 profile={profile} paginaAtiva={paginaAtiva} aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis}
        fundo="transparent" />

      {refazendo && aoCadastrarRefacao && motivosDoCliche && (
        <RefazerClicheHub10 motivosDoCliche={motivosDoCliche} clientes={clientesDosPedidos} aoFechar={() => setRefazendo(false)}
          aoCadastrar={async (d) => {
            await aoCadastrarRefacao(d);
            setRefazendo(false);
            setRecadoOk(`Refação de ${d.cliente} cadastrada: o cartão entrou em Aprovações.`);
          }} />
      )}
      {recadoOk && <AvisoV1a texto={recadoOk} tipo="ok" onFechar={() => setRecadoOk("")} />}
      {aviso && <AvisoV1a texto={aviso} tipo="alerta" onFechar={() => setAviso("")} />}
      {children}
    </PalcoFixo>
  );
}
