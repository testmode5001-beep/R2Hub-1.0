// Apresentação do hub (Hub 1.0): o tour do primeiro acesso e as novidades.
//
// Pedido do Augusto (06/10/2026): "uma apresentação para o hub final, para os
// usuários que entrarem nele a primeira vez; apresentação interativa, sem
// vídeos". Escolhas dele: tour nas telas reais; "faça você" nos passos
// principais (o tour espera a tela reagir e segue sozinho); um roteiro por
// papel; no primeiro acesso e nas novidades. Os roteiros moram em
// `apresentacao-roteiros.ts`.
//
// Por cima de todas as telas, num palco de 1920×1080 na mesma escala do
// PalcoFixo: um véu escuro com furos arredondados em volta do que o passo
// mostra (um por item, nos itens do menu; contorno amarelo; o furo deixa o
// clique passar só nos passos de "faça você") e o cartão preto das legendas
// dos tutoriais em vídeo (pílula amarela, título em Fraunces, texto em Inter,
// controles em texto). Nada grava: o que criaria ou mudaria um pedido só é
// mostrado, e no "faça você" do cartão o + da fila e o selo valem como clique
// no cartão. O que a pessoa já viu fica no servidor (user_config
// "apresentacao"), para não repetir noutro computador.
//
// Revisões de código e de design de 06/10/2026: ESC e Enter não brigam com a
// tela (o ESC do passo do ✕ fecha o pedido; Enter num botão é do botão), o
// foco vai para o cartão a cada passo, passo sem alvo segue logo (o quadro
// vazio da vendedora nova deixava a tela escura 13 s), Voltar só volta para
// passo de "Próximo", as boas-vindas e o cartão caem na grade.
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MutableRefObject, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { AMARELO, FR, FUNDO_PAGINA, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { AvisoV1a } from "../v1a/HubV1a";
import { LINHA_DA_GRADE, baseFraunces, baseInter, folgaFR, folgaIN } from "./grade-hub10";
import type { SessionUser } from "@/lib/session";
import { NOVIDADES, promessaDe, roteiroDe } from "./apresentacao-roteiros";
import type { Alvo, EstadoApresentacao, Espera, Passo } from "./apresentacao-roteiros";

/* ————— o "ver de novo", para a Home (Tutoriais) e as Preferências ————— */
const Contexto = createContext<{ verDeNovo: () => void } | null>(null);
export function ProvedorApresentacao({ verDeNovo, children }: { verDeNovo: () => void; children: ReactNode }) {
  const valor = useMemo(() => ({ verDeNovo }), [verDeNovo]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
export const useApresentacao = () => useContext(Contexto);

/* ————— achar o alvo na tela ————— */
const textoDe = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
/** visível de verdade: com tamanho, sem visibility hidden, fora de [inert] e
    sem ancestral transparente (os cartões da capa que saem da janela ficam
    com opacidade 0 e continuam no DOM) */
function visivel(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  if (el.closest("[inert]")) return false;
  const s = getComputedStyle(el);
  if (s.visibility === "hidden" || s.display === "none") return false;
  for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
    if (Number(getComputedStyle(a).opacity) < 0.05) return false;
  }
  return true;
}
function acharAlvo(alvo: Alvo): HTMLElement[] {
  let lista = [...document.querySelectorAll<HTMLElement>(alvo.sel)].filter((el) => !el.closest("[data-apresentacao]") && visivel(el));
  if (alvo.texto) lista = lista.filter((el) => textoDe(el) === alvo.texto);
  if (alvo.textos) lista = lista.filter((el) => alvo.textos!.includes(textoDe(el)));
  if (alvo.contem) {
    lista = lista.filter((el) => textoDe(el).includes(alvo.contem!));
    /* o mais de dentro: um contêiner de fora também "tem" o texto e acenderia a página toda */
    lista = lista.filter((el) => !lista.some((outro) => outro !== el && el.contains(outro)));
  }
  return alvo.todos || alvo.textos ? lista : lista.slice(0, 1);
}
/** o alvo existe na tela, mesmo fora da janela (o cartão da capa que só
    aparece rolando a trilha fica com opacidade 0): é o que a novidade usa
    para saber se a pessoa tem aquilo */
function existeNaTela(alvo: Alvo): HTMLElement[] {
  let lista = [...document.querySelectorAll<HTMLElement>(alvo.sel)].filter((el) => !el.closest("[data-apresentacao]"));
  if (alvo.texto) lista = lista.filter((el) => textoDe(el) === alvo.texto);
  if (alvo.textos) lista = lista.filter((el) => alvo.textos!.includes(textoDe(el)));
  if (alvo.contem) lista = lista.filter((el) => textoDe(el).includes(alvo.contem!));
  return lista;
}
/** O quadro de Pedidos vai ter cartão: um pedido em aberto, ou fechado neste
    mês (o período que a tela abre, "Esse mês", vale só para o que fechou, pela
    data em que fechou, como em PedidoHub10). */
type PedidoDaLista = { status?: string; cliche_concluido_em?: string | null; cancelado_em?: string | null; updated_at?: string | null; created_at?: string | null };
function temPedidoNoQuadro(pedidos: PedidoDaLista[]): boolean {
  const hoje = new Date();
  return pedidos.some((p) => {
    const quando = p.status === "concluido" ? (p.cliche_concluido_em || p.updated_at || p.created_at)
      : p.status === "cancelado" ? (p.cancelado_em || p.updated_at || p.created_at) : null;
    if (!quando) return true;
    const d = new Date(quando);
    return Number.isNaN(d.getTime()) || (d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth());
  });
}
/** o texto como literal de XPath (com os dois tipos de aspas, vira concat) */
function literalXPath(s: string): string {
  if (!s.includes('"')) return `"${s}"`;
  if (!s.includes("'")) return `'${s}'`;
  return `concat(${s.split('"').map((p) => `"${p}"`).join(`, '"', `)})`;
}
/** há um elemento visível com exatamente esse texto (o painel "Especificações") */
function temTexto(texto: string): boolean {
  try {
    const xp = document.evaluate(`//*[normalize-space(text())=${literalXPath(texto)}]`, document.body, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0; i < xp.snapshotLength; i++) {
      const el = xp.snapshotItem(i) as Element;
      if (!el.closest("[data-apresentacao]") && visivel(el)) return true;
    }
  } catch {
    /* expressão que o navegador recusa: conta como "não tem" (o passo segue pelo tempo) */
  }
  return false;
}
/** o carregamento do hub (CarregandoHub10) está por cima: a tela ainda não chegou */
const carregandoNaTela = () => !!document.querySelector('[role="status"][aria-label="Carregando"]');

/* ————— o palco: a mesma escala do PalcoFixo ————— */
type Palco = { escala: number; x0: number; y0: number };
function medirPalco(): Palco {
  /* o tamanho que a camada fixa ocupa (sem barra de rolagem), como o PalcoFixo mede o dele */
  const w = document.documentElement.clientWidth || window.innerWidth, h = document.documentElement.clientHeight || window.innerHeight;
  const escala = Math.min(w / 1920, h / 1080);
  return { escala, x0: (w - 1920 * escala) / 2, y0: (h - 1080 * escala) / 2 };
}
/** um furo, em pixels do hub; `r` é o raio que ele pede */
type Caixa = { x: number; y: number; w: number; h: number; r: number };
type Retangulo = { left: number; top: number; right: number; bottom: number };
/** o raio do furo: o do alvo mais a folga, para os cantos ficarem paralelos;
    alvo sem raio (texto do menu, ícone) vira pílula */
function raioDo(el: HTMLElement, folga: number): number {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  return r > 0 ? r + folga : Infinity;
}
/** os furos em volta dos alvos (o que passa da janela não conta). Juntos, um
    furo só (os cartões lado a lado); separados, um por alvo (os itens do menu,
    que têm outros no meio), e os que se tocam viram um: o véu, com evenodd,
    fecharia de novo o pedaço sobreposto */
function furosDos(els: HTMLElement[], p: Palco, folga: number, separados: boolean): Caixa[] {
  const noHub = (q: Retangulo, r: number): Caixa | null => {
    const l = Math.max(q.left, 0), t = Math.max(q.top, 0), d = Math.min(q.right, window.innerWidth), b = Math.min(q.bottom, window.innerHeight);
    if (d - l < 2 || b - t < 2) return null;
    return { x: (l - p.x0) / p.escala - folga, y: (t - p.y0) / p.escala - folga, w: (d - l) / p.escala + 2 * folga, h: (b - t) / p.escala + 2 * folga, r };
  };
  if (!els.length) return [];
  if (!separados) {
    const u = els.map((el) => el.getBoundingClientRect() as Retangulo)
      .reduce((a, q) => ({ left: Math.min(a.left, q.left), top: Math.min(a.top, q.top), right: Math.max(a.right, q.right), bottom: Math.max(a.bottom, q.bottom) }));
    const c = noHub(u, raioDo(els[0], folga));
    return c ? [c] : [];
  }
  const furos = els.map((el) => noHub(el.getBoundingClientRect(), raioDo(el, folga))).filter((c): c is Caixa => !!c);
  for (let juntou = true; juntou; ) {
    juntou = false;
    procura: for (let i = 0; i < furos.length; i++) {
      for (let j = i + 1; j < furos.length; j++) {
        const a = furos[i], b = furos[j];
        if (a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
          furos[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y, r: Math.min(a.r, b.r) };
          furos.splice(j, 1);
          juntou = true;
          break procura;
        }
      }
    }
  }
  return furos;
}
/** a caixa que junta os furos: é perto dela que o cartão fica */
function uniao(cs: Caixa[]): Caixa | null {
  if (!cs.length) return null;
  const x = Math.min(...cs.map((c) => c.x)), y = Math.min(...cs.map((c) => c.y));
  return { x, y, w: Math.max(...cs.map((c) => c.x + c.w)) - x, h: Math.max(...cs.map((c) => c.y + c.h)) - y, r: 0 };
}
const mesmosFuros = (a: Caixa[], b: Caixa[]) =>
  a.length === b.length && a.every((c, i) => Math.abs(c.x - b[i].x) < 0.5 && Math.abs(c.y - b[i].y) < 0.5 && Math.abs(c.w - b[i].w) < 0.5 && Math.abs(c.h - b[i].h) < 0.5);
/** o contorno arredondado de um furo, para o caminho do véu */
function contorno(c: Caixa): string {
  const r = Math.min(c.r, c.h / 2, c.w / 2);
  return `M${c.x + r} ${c.y}H${c.x + c.w - r}A${r} ${r} 0 0 1 ${c.x + c.w} ${c.y + r}V${c.y + c.h - r}A${r} ${r} 0 0 1 ${c.x + c.w - r} ${c.y + c.h}H${c.x + r}A${r} ${r} 0 0 1 ${c.x} ${c.y + c.h - r}V${c.y + r}A${r} ${r} 0 0 1 ${c.x + r} ${c.y}Z`;
}

/* ————— onde fica o cartão: perto do alvo, onde couber, nas colunas ————— */
const LG = LINHA_DA_GRADE;
/* no máximo 8 colunas de largura (o cartão abraça o conteúdo: sem a sobra à
   direita que o Augusto apontou em 06/10/2026); dos lados, as margens da
   grade (c1 e c23) */
const LARGURA = 640, M = 80, M_TOPO = 40, ESPACO = 30;
/* no pé, o cartão termina onde terminam as pílulas do pé das páginas (0,85 acima da linha 63) */
const PE = 63 * LG - 0.85;
type Lado = "baixo" | "cima" | "direita" | "esquerda" | "pe-meio" | "pe-direita" | "pe-esquerda" | "topo";
type Medida = { w: number; h: number };
function posicaoNo(lado: Lado, c: Caixa, { w, h }: Medida): { left: number; top: number } {
  const cabeX = (x: number) => Math.min(Math.max(x, M), 1920 - M - w);
  const cabeY = (y: number) => Math.min(Math.max(y, M_TOPO), PE - h);
  switch (lado) {
    case "baixo": return { left: cabeX(c.x), top: c.y + c.h + ESPACO };
    case "cima": return { left: cabeX(c.x), top: c.y - ESPACO - h };
    case "direita": return { left: c.x + c.w + ESPACO, top: cabeY(c.y) };
    case "esquerda": return { left: c.x - ESPACO - w, top: cabeY(c.y) };
    case "pe-meio": return { left: (1920 - w) / 2, top: PE - h };
    case "pe-direita": return { left: 1920 - M - w, top: PE - h };
    case "pe-esquerda": return { left: M, top: PE - h };
    case "topo": return { left: (1920 - w) / 2, top: 9 * LG };
  }
}
function cabeNo(lado: Lado, c: Caixa, { w, h }: Medida): boolean {
  if (lado === "baixo") return c.y + c.h + ESPACO + h <= PE;
  if (lado === "cima") return c.y - ESPACO - h >= M_TOPO;
  if (lado === "direita") return c.x + c.w + ESPACO + w <= 1920 - M;
  if (lado === "esquerda") return c.x - ESPACO - w >= M;
  return true;
}
function escolherLado(c: Caixa, med: Medida): Lado {
  for (const lado of ["baixo", "cima", "direita", "esquerda"] as const) if (cabeNo(lado, c, med)) return lado;
  /* o alvo ocupa quase a tela toda (as quatro etapas, os painéis do pedido):
     o lugar que menos o cobre; quase empatados (o cartão no hover cresce uns
     pixels), fica embaixo à direita, onde os painéis costumam estar vazios */
  const cobre = (lado: Lado) => {
    const o = posicaoNo(lado, c, med);
    return Math.max(0, Math.min(o.left + med.w, c.x + c.w) - Math.max(o.left, c.x)) * Math.max(0, Math.min(o.top + med.h, c.y + c.h) - Math.max(o.top, c.y));
  };
  return (["pe-direita", "pe-meio", "pe-esquerda", "topo"] as const).reduce((a, b) => (cobre(b) < cobre(a) * 0.85 ? b : a));
}
/* para onde a seta da faixa amarela aponta: do cartão para o alvo */
const SETA: Record<Lado, { giro: number; dx: number; dy: number }> = {
  baixo: { giro: 0, dx: 0, dy: -4 }, "pe-meio": { giro: 0, dx: 0, dy: -4 }, "pe-direita": { giro: 0, dx: 0, dy: -4 }, "pe-esquerda": { giro: 0, dx: 0, dy: -4 },
  cima: { giro: 180, dx: 0, dy: 4 }, topo: { giro: 180, dx: 0, dy: 4 },
  direita: { giro: -90, dx: -4, dy: 0 }, esquerda: { giro: 90, dx: 4, dy: 0 },
};

/* ————— o que está acontecendo ————— */
/* `deNovo`: pedida pela Home ou pelas Preferências (não é o primeiro acesso) */
type Modo = null | { tipo: "principal"; i: number; deNovo: boolean } | { tipo: "novidade"; id: string; i: number };
const BOAS_VINDAS: Passo = { id: "boas-vindas", titulo: "", texto: "" };
const FIM: Passo = {
  id: "fim", titulo: "Você já conhece o hub",
  texto: "Para os detalhes, os tutoriais em vídeo ficam na Home, em Tutoriais. Esta apresentação também fica lá e nas Preferências.",
};
/* as telas do 1.0 onde a apresentação pode começar sozinha */
const TELAS_1_0 = new Set(["home", "inicio", "pedidos10", "aprovacao10", "ferramentais10", "pantone10", "calculadoras10", "arquivos10", "clientes10", "equipe10", "relatorios10"]);
/** com a tela parada (sem carregar), quanto o alvo pode demorar a aparecer */
const ESPERA_ALVO = 2500;
/** quanto a tela do passo pode demorar a chegar */
const ESPERA_TELA = 4500;
/** depois do clique no "faça você", quanto a tela pode demorar a reagir */
const ESPERA_FACA = 9000;
/** o alvo achado que some e não volta */
const SUMIU = 1500;
/* o dia de hoje no relógio de quem usa (o toISOString é UTC: das 21h à meia-noite gravava o dia seguinte) */
const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const reduzir = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const INTERATIVO = "button, a, input, textarea, select, [contenteditable=true]";

export function ApresentacaoHub10({ profile, tela, estado, aoSalvar, irPara, pedido }: {
  profile: SessionUser;
  /** a tela aberta (?tela=) */
  tela: string;
  /** o que a pessoa já viu, do servidor */
  estado: EstadoApresentacao;
  aoSalvar: (novo: EstadoApresentacao) => void;
  /** leva a uma tela (nos passos de "Próximo" que mudam de tela) */
  irPara: (tela: string) => void;
  /** cresce quando alguém pede para ver de novo (Home ou Preferências) */
  pedido: number;
}) {
  const [modo, setModo] = useState<Modo>(null);
  /* o passo chegou pelo gesto da pessoa (não pelo tour): a tela já é a dele */
  const [viaFaca, setViaFaca] = useState(false);
  const papel = profile.role;
  const telaRef = useRef(tela);
  telaRef.current = tela;
  /* quando a tela mudou: o carregando do hub só aparece 300 ms depois */
  const telaMudouEm = useRef(0);
  useEffect(() => { telaMudouEm.current = performance.now(); }, [tela]);

  /* o que foi gravado e ainda não voltou do servidor (o setQueryData avisa a
     rota depois): quem grava em seguida parte daqui, não do estado velho */
  const salvo = useRef<EstadoApresentacao | null>(null);
  useEffect(() => { salvo.current = null; }, [estado]);
  const salvar = useCallback((novo: EstadoApresentacao) => { salvo.current = novo; aoSalvar(novo); }, [aoSalvar]);

  /* ————— começar ————— */
  /* os pedidos da pessoa, os mesmos que a rota já leu (a apresentação só
     olha, não lê de novo): sem pedido no quadro, os passos do pedido aberto
     saem do roteiro */
  const pedidosQ = useQuery<PedidoDaLista[]>({ queryKey: ["pedidos"], enabled: false, staleTime: Infinity });
  const pedidosRef = useRef<PedidoDaLista[] | undefined>(undefined);
  pedidosRef.current = pedidosQ.data;
  /* a lista já chegou (ou falhou: aí o roteiro vai inteiro, e o passo sem cartão é pulado) */
  const pedidosProntos = pedidosQ.isFetched;
  const [temPedido, setTemPedido] = useState(true);
  /* o roteiro do papel, sem os passos de algo que a pessoa não tem (o + de
     quem não cria pedido, o menu que ela não vê, o pedido aberto de quem não
     tem pedido): a contagem e a lista das boas-vindas batem com o que ela vai ver */
  const [principal, setPrincipal] = useState<Passo[]>([]);
  const jaComecou = useRef(false);
  const comecar = useCallback((deNovo: boolean) => {
    jaComecou.current = true;
    const lidos = pedidosRef.current;
    const comPedido = !lidos || temPedidoNoQuadro(lidos);
    setTemPedido(comPedido);
    setPrincipal([BOAS_VINDAS, ...roteiroDe(papel).filter((p) => (!p.soSe || acharAlvo(p.soSe).length > 0) && (!p.soComPedido || comPedido)), FIM]);
    setViaFaca(false);
    setModo({ tipo: "principal", i: 0, deNovo });
  }, [papel]);
  useEffect(() => {
    if (jaComecou.current || modo || estado.principal || !TELAS_1_0.has(tela) || !pedidosProntos) return;
    /* um instante para a tela se assentar (a barra e o menu já no lugar) */
    const t = window.setTimeout(() => { if (!jaComecou.current) comecar(false); }, 400);
    return () => window.clearTimeout(t);
  }, [estado.principal, tela, modo, comecar, pedidosProntos]);
  /* ver de novo */
  const ultimoPedido = useRef(pedido);
  useEffect(() => {
    if (pedido === ultimoPedido.current) return;
    ultimoPedido.current = pedido;
    comecar(true);
  }, [pedido, comecar]);
  /* A novidade da tela: uma vez para cada pessoa que já passou pela
     apresentação, na primeira visita à tela até a data final dela. A
     apresentação não marca as novidades como vistas: ela não as mostra, e a
     equipe que já usava o hub é justamente quem precisa delas. */
  /* Só os passos do que a pessoa tem na tela, com o texto do que ela vê
     (simulação 6, 07/10/2026: a vendedora, sem a calculadora de Substrato,
     ficava 3 s com a tela escura e sem cartão, lia sobre a de Etiqueta, que
     ela não tem, e o Voltar repetia o escuro). Sem nenhum passo, a novidade
     não aparece. */
  const [passosNovidade, setPassosNovidade] = useState<Passo[]>([]);
  useEffect(() => {
    if (modo || !estado.principal) return;
    const n = NOVIDADES.find((x) => x.tela === tela && !estado.novidades.includes(x.id) && hoje() <= x.ate);
    if (!n) return;
    const t = window.setTimeout(() => {
      if (telaRef.current !== n.tela) return;
      const passos = n.passos.flatMap((p): Passo[] => {
        if (!p.alvo) return [p];
        const achados = existeNaTela(p.alvo);
        if (!achados.length) return [];
        return [p.doAlvo ? { ...p, ...p.doAlvo(achados.map((el) => el.getAttribute("aria-label") || textoDe(el))) } : p];
      });
      if (!passos.length) return;
      setPassosNovidade(passos);
      setModo({ tipo: "novidade", id: n.id, i: 0 });
    }, 900);
    return () => window.clearTimeout(t);
  }, [tela, modo, estado]);

  const lista: Passo[] = !modo ? [] : modo.tipo === "principal" ? principal : passosNovidade;
  const passo = modo ? lista[modo.i] : undefined;
  const modoRef = useRef<Modo>(null);
  modoRef.current = modo;
  const listaRef = useRef<Passo[]>([]);
  listaRef.current = lista;

  /* ————— terminar ————— */
  const [avisoSaida, setAvisoSaida] = useState(false);
  const terminar = useCallback((como: "vista" | "pulada" | "adiada") => {
    const m = modoRef.current;
    if (!m) return;
    const e = salvo.current ?? estado;
    if (m.tipo === "principal") {
      /* rever e sair no meio (ou "Ver depois") não muda o que já estava guardado */
      if (!(m.deNovo && como !== "vista" && e.principal)) salvar({ ...e, principal: `${como}:${hoje()}` });
      /* quem sai no meio fica sabendo onde rever */
      if (como === "pulada") setAvisoSaida(true);
    } else {
      salvar({ ...e, novidades: Array.from(new Set([...e.novidades, m.id])) });
    }
    setModo(null);
  }, [estado, salvar]);

  /* ————— andar ————— */
  const direcao = useRef<1 | -1>(1);
  /* Voltar só volta para o passo de antes, e só se ele for de "Próximo": o
     "faça você" não se desfaz (o pedido aberto continuaria aberto, e o cartão
     do quadro, escondido); pular por cima dele levava de volta à Home */
  const anterior = (i: number): number => {
    const minimo = modoRef.current?.tipo === "principal" ? 1 : 0;
    const j = i - 1;
    return j >= minimo && !listaRef.current[j]?.faca ? j : -1;
  };
  const ir = useCallback((delta: 1 | -1, pelaMao = false) => {
    const m = modoRef.current;
    if (!m) return;
    let i = m.i + 1;
    if (delta < 0) {
      const j = anterior(m.i);
      if (j >= 0) i = j;
      else direcao.current = 1; /* nada para trás: segue */
    }
    setModo({ ...m, i });
    setViaFaca(pelaMao);
  }, []);
  const avancar = useCallback((pelaMao = false) => { direcao.current = 1; ir(1, pelaMao); }, [ir]);
  const voltar = useCallback(() => { direcao.current = -1; ir(-1); }, [ir]);
  const podeVoltar = !!modo && !!passo && passo !== FIM && anterior(modo.i) >= 0;
  /* passou do último passo da lista: acabou */
  useEffect(() => {
    if (modo && !passo) terminar("vista");
  }, [modo, passo, terminar]);

  /* ————— o alvo do passo ————— */
  const [palco, setPalco] = useState<Palco>(() => (typeof window === "undefined" ? { escala: 1, x0: 0, y0: 0 } : medirPalco()));
  useEffect(() => {
    const medir = () => setPalco(medirPalco());
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  const chave = modo ? `${modo.tipo}:${modo.tipo === "novidade" ? modo.id : ""}:${modo.i}` : "";
  const [alvos, setAlvos] = useState<HTMLElement[]>([]);
  /* os elementos de agora (a tela pode trocar o nó no meio do passo) */
  const alvosRef = useRef<HTMLElement[]>([]);
  /* os furos guardam de que passo são: o cartão do passo novo não aparece,
     nem por um quadro, no lugar do furo do passo anterior */
  const [furosDe, setFurosDe] = useState<{ chave: string; furos: Caixa[] }>({ chave: "", furos: [] });
  const furos = furosDe.chave === chave ? furosDe.furos : [];
  const caixa = uniao(furos);
  const [procurando, setProcurando] = useState(false);

  useEffect(() => {
    setAlvos([]); alvosRef.current = [];
    if (!passo || !passo.alvo) { setProcurando(false); return; }
    /* nos passos de "Próximo" (e no Voltar), o tour leva à tela do passo */
    if (passo.tela && telaRef.current !== passo.tela && !viaFaca) irPara(passo.tela);
    if (passo.antes) {
      const trilha = [...document.querySelectorAll<HTMLElement>(".p10-trilha")].find((e) => e.querySelector(".pd4-cartao"));
      if (trilha) trilha.scrollTo({ left: passo.antes === "rolar-trilha-fim" ? trilha.scrollWidth : 0, behavior: reduzir() ? "auto" : "smooth" });
    }
    setProcurando(true);
    const t0 = performance.now();
    let parada = 0, insistiu = false, vivo = true, tm = 0;
    const seguir = () => { setProcurando(false); ir(direcao.current); };
    const procurar = () => {
      if (!vivo) return;
      const agora = performance.now();
      /* a tela do passo não chegou (o voltar do navegador no meio, por exemplo): pede de novo, e desiste */
      if (passo.tela && telaRef.current !== passo.tela) {
        if (!insistiu && agora - t0 > 1500) { insistiu = true; irPara(passo.tela); }
        if (agora - t0 > ESPERA_TELA) { seguir(); return; }
        tm = window.setTimeout(procurar, 120);
        return;
      }
      /* a tela acabou de mudar ou ainda carrega: espera, sem contar o tempo (o
         cartão do tour sumia embaixo do carregamento, e com o servidor lento
         o passo era pulado) */
      if (agora - telaMudouEm.current < 400 || carregandoNaTela()) { parada = 0; tm = window.setTimeout(procurar, 120); return; }
      if (!parada) parada = agora;
      /* falta o que o passo explica (o pedido aberto, depois de pular o clique no cartão): segue na hora */
      if (passo.precisa && !acharAlvo(passo.precisa).length) { seguir(); return; }
      const achados = acharAlvo(passo.alvo!);
      if (achados.length) { alvosRef.current = achados; setAlvos(achados); setProcurando(false); return; }
      /* com a tela parada, o alvo não apareceu: a pessoa não tem aquilo (o quadro vazio da vendedora nova); segue */
      if (agora - parada > ESPERA_ALVO) { seguir(); return; }
      tm = window.setTimeout(procurar, 120);
    };
    /* a rolagem da capa leva um instante */
    tm = window.setTimeout(procurar, passo.antes ? 450 : 60);
    return () => { vivo = false; window.clearTimeout(tm); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  /* os furos acompanham o alvo (o cartão sobe no hover, a trilha rola, a tela
     re-renderiza); parado, não redesenha */
  const clicouEm = useRef(0);
  useEffect(() => {
    if (!alvos.length || !passo) return;
    let raf = 0, conta = 0, sumiuEm = 0;
    const quadro = () => {
      /* de tempos em tempos, procura de novo: a tela pode ter trocado o elemento */
      if (++conta % 30 === 0 && passo.alvo) {
        const novos = acharAlvo(passo.alvo);
        if (novos.length) { alvosRef.current = novos; sumiuEm = 0; }
        else if (!sumiuEm) sumiuEm = performance.now();
        /* sumiu e não voltou, sem ser o gesto do "faça você": segue (o véu ficava sem cartão) */
        else if (performance.now() - sumiuEm > SUMIU && !(passo.faca && clicouEm.current)) { ir(direcao.current); return; }
      }
      const novos = furosDos(alvosRef.current.filter((el) => el.isConnected), palco, passo.folga ?? 10, !!passo.alvo?.textos);
      setFurosDe((v) => (v.chave === chave && mesmosFuros(v.furos, novos) ? v : { chave, furos: novos }));
      raf = requestAnimationFrame(quadro);
    };
    raf = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(raf);
  }, [alvos, passo, palco, chave, ir]);

  /* ————— faça você: a tela reagir, por clique, teclado ou ESC ————— */
  const [clicou, setClicou] = useState(false);
  useEffect(() => { setClicou(false); clicouEm.current = 0; }, [chave]);
  useEffect(() => {
    if (!passo?.faca || !alvos.length) return;
    /* um controle de dentro do alvo (o + da fila, o selo 01 DA FILA): no tour
       nada grava, e o clique vale como clique no alvo (abre o pedido) */
    const antes = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const alvo = t ? alvosRef.current.find((el) => el.contains(t)) : undefined;
      if (!t || !alvo) return;
      const controle = t.closest(`${INTERATIVO}, [role=button], [data-pop]`);
      if (controle && controle !== alvo && alvo.contains(controle)) { e.preventDefault(); e.stopPropagation(); alvo.click(); }
    };
    const marcar = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && alvosRef.current.some((el) => el.contains(t))) { clicouEm.current = performance.now(); setClicou(true); }
    };
    window.addEventListener("click", antes, true);
    document.addEventListener("click", marcar, true);
    return () => { window.removeEventListener("click", antes, true); document.removeEventListener("click", marcar, true); };
  }, [passo, alvos]);
  useEffect(() => {
    if (!passo?.faca || !alvos.length) return;
    const espera: Espera = passo.faca;
    const vale = () => (espera.tela ? telaRef.current === espera.tela : true)
      && (espera.texto ? temTexto(espera.texto) : true)
      && (espera.semTexto ? !temTexto(espera.semTexto) : true);
    /* segue quando a condição vira (pelo clique, pelo Enter no alvo ou pelo
       ESC no passo do ✕); se ela já valia, segue um instante depois do clique */
    const jaValia = vale();
    let vivo = true, tm = 0;
    const conferir = () => {
      if (!vivo) return;
      const desde = clicouEm.current ? performance.now() - clicouEm.current : 0;
      if ((!jaValia && vale()) || (clicouEm.current && desde > (jaValia ? 600 : ESPERA_FACA))) { avancar(true); return; }
      tm = window.setTimeout(conferir, 120);
    };
    tm = window.setTimeout(conferir, 150);
    return () => { vivo = false; window.clearTimeout(tm); };
  }, [passo, alvos, avancar]);

  /* ————— teclado ————— */
  /* ESC sai; no passo do ✕ ele é da tela (fecha o pedido, como o texto diz) */
  const sair = useCallback(() => terminar(modoRef.current?.tipo === "principal" ? "pulada" : "vista"), [terminar]);
  useEscDoTopo(!!modo && !passo?.escPassa, NIVEL.apresentacao, sair);
  /* Enter e as setas andam, fora do "faça você"; Enter num botão é do botão */
  const podeVoltarRef = useRef(false);
  podeVoltarRef.current = podeVoltar;
  useEffect(() => {
    if (!modo) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (passo?.faca || passo === BOAS_VINDAS) return;
      if ((e.target as HTMLElement | null)?.closest?.(INTERATIVO)) return;
      if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); passo === FIM ? terminar("vista") : avancar(); }
      else if (e.key === "ArrowLeft" && podeVoltarRef.current) { e.preventDefault(); voltar(); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [modo, passo, avancar, voltar, terminar]);
  /* fora do "faça você", o Tab circula dentro do cartão (a página atrás do véu
     não recebe o foco); no "faça você" ele precisa chegar ao alvo */
  const cartaoRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!modo || !passo || passo.faca) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const cartao = cartaoRef.current;
      e.preventDefault();
      if (!cartao) return;
      const focaveis = [...cartao.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
      if (!focaveis.length) { cartao.focus(); return; }
      const i = focaveis.indexOf(document.activeElement as HTMLElement);
      const prox = e.shiftKey ? (i <= 0 ? focaveis[focaveis.length - 1] : focaveis[i - 1]) : (i < 0 || i === focaveis.length - 1 ? focaveis[0] : focaveis[i + 1]);
      prox.focus();
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [modo, passo]);

  /* ————— o aviso de quem sai no meio ————— */
  const fecharAviso = useCallback(() => setAvisoSaida(false), []);
  useEscDoTopo(avisoSaida && !modo, NIVEL.painel, fecharAviso);
  useEffect(() => {
    if (!avisoSaida) return;
    const t = window.setTimeout(fecharAviso, 7000);
    return () => window.clearTimeout(t);
  }, [avisoSaida, fecharAviso]);
  useEffect(() => { if (modo) setAvisoSaida(false); }, [modo]);

  /* ————— o cartão ————— */
  /* o tamanho de verdade do cartão (ele abraça o conteúdo), para achar o lugar */
  const [medida, setMedida] = useState<Medida>({ w: LARGURA, h: 240 });
  useLayoutEffect(() => {
    const el = cartaoRef.current;
    if (!el || passo === BOAS_VINDAS) return;
    if (Math.abs(el.offsetWidth - medida.w) > 1 || Math.abs(el.offsetHeight - medida.h) > 1) setMedida({ w: el.offsetWidth, h: el.offsetHeight });
  });
  /* enquanto procura o alvo (a tela mudando), o véu fica e o cartão espera */
  const mostraCartao = !!passo && (passo === BOAS_VINDAS || passo === FIM || !!caixa || !passo.alvo);
  /* o foco vai para o cartão quando ele aparece, a cada passo (o leitor de
     tela lê o título e o texto); nas boas-vindas fica no "Começar" */
  useEffect(() => {
    if (!mostraCartao || passo === BOAS_VINDAS) return;
    cartaoRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, mostraCartao]);
  /* o lado escolhido fica até o passo acabar (ou até não caber mais): com a
     caixa mudando a cada quadro (o cartão sobe no hover), dois lados quase
     empatados faziam o cartão do tour trocar de canto sozinho */
  const ladoDoPasso = useRef<{ chave: string; lado: Lado } | null>(null);
  const idTitulo = useId(), idTexto = useId();
  /* a máscara do halo do "faça você" (o id do React tem dois-pontos, que o url(#) não aceita) */
  const idMascara = `apr-mascara-${useId().replace(/[^\w-]/g, "")}`;

  if (!modo || !passo) {
    if (!avisoSaida) return null;
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: NIVEL.apresentacao, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080, transform: `translate(-50%,-50%) scale(${palco.escala})`, transformOrigin: "center center" }}>
          <div style={{ pointerEvents: "auto" }}>
            <AvisoV1a tipo="ok" texto="Dá para ver a apresentação de novo nas Preferências ou na Home, em Tutoriais." onFechar={fecharAviso} />
          </div>
        </div>
      </div>
    );
  }

  const ePrincipal = modo.tipo === "principal";
  const reais = ePrincipal ? lista.length - 2 : lista.length;
  const numero = ePrincipal ? modo.i : modo.i + 1;
  const ultimoDaNovidade = !ePrincipal && modo.i === lista.length - 1;
  let pos = { left: (1920 - medida.w) / 2, top: (1080 - medida.h) / 2 };
  let lado: Lado = "baixo";
  if (caixa) {
    const guardado = ladoDoPasso.current?.chave === chave ? ladoDoPasso.current.lado : null;
    lado = guardado && cabeNo(guardado, caixa, medida) ? guardado : escolherLado(caixa, medida);
    ladoDoPasso.current = { chave, lado };
    pos = posicaoNo(lado, caixa, medida);
  }
  const seta = SETA[lado];
  const furo = furos.map(contorno).join(" ");

  return (
    <div data-apresentacao="" style={{ position: "fixed", inset: 0, zIndex: NIVEL.apresentacao, pointerEvents: "none" }}>
      {/* a seta da faixa amarela cutuca na direção do alvo */}
      <style>{"@keyframes apr-cutuca{0%,100%{transform:translate(0,0)}50%{transform:translate(var(--dx),var(--dy))}}.apr-seta{display:inline-flex;animation:apr-cutuca 1.1s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.apr-seta{animation:none}}"}</style>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080, transform: `translate(-50%,-50%) scale(${palco.escala})`, transformOrigin: "center center" }}>
        {/* o véu, com os furos; ele passa do palco para cobrir as sobras da janela */}
        <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden>
          <path d={`M-6000 -6000H8000V8000H-6000Z ${furo}`} fillRule="evenodd" fill="rgba(24,22,24,.62)" style={{ pointerEvents: "auto" }} />
          {caixa && (
            <path d={furo} fill="none" stroke={AMARELO} strokeWidth={3}>
              {passo.faca && !reduzir() && <animate attributeName="stroke-opacity" values="1;.35;1" dur="1.6s" repeatCount="indefinite" />}
            </path>
          )}
          {/* faça você: um halo amarelo se espalha em volta do alvo, só do lado de fora do furo
              (Augusto, 06/10/2026: "o usuário mais desatento não vai ver nem entender") */}
          {caixa && passo.faca && !reduzir() && (
            <>
              <defs>
                <mask id={idMascara} maskUnits="userSpaceOnUse" x={-6000} y={-6000} width={14000} height={14000}>
                  <rect x={-6000} y={-6000} width={14000} height={14000} fill="#fff" />
                  <path d={furo} fill="#000" />
                </mask>
              </defs>
              <path d={furo} fill="none" stroke={AMARELO} strokeWidth={3} mask={`url(#${idMascara})`}>
                <animate attributeName="stroke-width" values="3;48" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values=".8;0" dur="1.6s" repeatCount="indefinite" />
              </path>
            </>
          )}
          {/* fora do "faça você", o furo não deixa o clique passar */}
          {caixa && !passo.faca && <path d={furo} fill="rgba(0,0,0,.001)" style={{ pointerEvents: "auto" }} />}
        </svg>

        {passo === BOAS_VINDAS ? (
          <BoasVindas nome={profile.nome} papel={papel} temPedido={temPedido} deNovo={ePrincipal && modo.deNovo} curtos={lista.filter((p) => p.curto).map((p) => p.curto!)}
            aoComecar={() => avancar()} aoAdiar={() => terminar("adiada")} cartaoRef={cartaoRef} />
        ) : mostraCartao && (
          /* no "faça você" o gesto é fora do cartão: ele não é modal ali */
          <div ref={cartaoRef} tabIndex={-1} role="dialog" aria-modal={!passo.faca} aria-labelledby={idTitulo} aria-describedby={idTexto}
            style={{ position: "absolute", left: pos.left, top: pos.top, width: "max-content", maxWidth: LARGURA, boxSizing: "border-box", pointerEvents: "auto", outline: "none",
              background: PRETO, color: "#fff", borderRadius: 26, padding: "22px 30px 22px", boxShadow: "0 18px 50px rgba(0,0,0,.35)",
              transition: reduzir() ? undefined : "left .25s ease, top .25s ease" }}>
            {/* a pílula e, na mesma linha, os pontinhos do andamento */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <span style={{ display: "inline-block", height: 30, padding: "0 14px", borderRadius: 999, background: AMARELO, color: PRETO, fontFamily: INTER, fontWeight: 600, fontSize: 16, lineHeight: "30px", whiteSpace: "nowrap" }}>
                {passo === FIM ? "Pronto" : ePrincipal ? `Passo ${numero} de ${reais}${passo.faca ? " · Faça você" : ""}` : passo.faca ? "Novidade · Faça você" : "Novidade"}
              </span>
              {passo !== FIM && reais > 1 && (
                <span aria-hidden style={{ display: "flex", gap: 7, marginLeft: "auto" }}>
                  {Array.from({ length: reais }, (_, k) => (
                    <b key={k} style={{ width: 8, height: 8, borderRadius: 999, background: k === numero - 1 ? AMARELO : "rgba(255,255,255,.35)" }} />
                  ))}
                </span>
              )}
            </div>
            <div id={idTitulo} style={{ ...FR, fontSize: 40, lineHeight: 1.06, letterSpacing: "-.02em", textWrap: "balance" }}>{passo.titulo}</div>
            {/* o texto enche a linha, sem palavra sozinha na última (o "balance" deixava uma sobra à direita) */}
            <div id={idTexto} style={{ fontFamily: INTER, fontSize: 21, lineHeight: 1.35, letterSpacing: "-.012em", color: "rgba(255,255,255,.84)", marginTop: 8, textWrap: "pretty" }}>{passo.texto}</div>
            {/* faça você: a vez da pessoa, numa faixa amarela que não passa despercebida, com o gesto
                escrito e a seta para o alvo (a linha pequena "Esperando o seu clique" ninguém via) */}
            {passo.faca && (
              <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18, minHeight: 52, padding: "0 18px", boxSizing: "border-box", borderRadius: 14,
                background: AMARELO, color: PRETO, fontFamily: INTER, fontSize: 20, fontWeight: 700, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>
                {clicou ? (
                  <svg aria-hidden width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                ) : (
                  <span aria-hidden className="apr-seta" style={{ "--dx": `${seta.dx}px`, "--dy": `${seta.dy}px` } as CSSProperties}>
                    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${seta.giro}deg)` }}><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></svg>
                  </span>
                )}
                {clicou ? "Boa! Seguindo…" : `Sua vez: ${passo.acao ?? "clique no que está aceso"}`}
              </div>
            )}
            {/* o que anda vem sempre primeiro; o Voltar depois; a saída longe, na ponta */}
            <div style={{ display: "flex", alignItems: "center", gap: 26, marginTop: passo.faca ? 12 : 20, fontFamily: INTER, fontSize: 17, whiteSpace: "nowrap" }}>
              {passo === FIM ? (
                <button type="button" onClick={() => terminar("vista")} style={BOTAO_CLARO}>Concluir</button>
              ) : (
                <>
                  {passo.faca ? (
                    <button type="button" onClick={() => avancar()} style={LINK}>Pular este passo</button>
                  ) : (
                    <button type="button" onClick={() => avancar()} style={BOTAO_CLARO}>
                      {ultimoDaNovidade ? "Entendi" : <>Próximo <span aria-hidden>→</span></>}
                    </button>
                  )}
                  {podeVoltar && <button type="button" onClick={voltar} style={LINK}>Voltar</button>}
                  {!ultimoDaNovidade && <button type="button" onClick={sair} style={{ ...LINK, marginLeft: "auto" }}>{ePrincipal ? "Sair da apresentação" : "Fechar"}</button>}
                </>
              )}
            </div>
          </div>
        )}
        {procurando && !caixa && passo !== BOAS_VINDAS && <span className="h10-so-leitor" role="status">Preparando o próximo passo</span>}
      </div>
    </div>
  );
}

/* os links do cartão: a área do clique passa de 44 de altura sem mexer no desenho */
const LINK: CSSProperties = { background: "none", border: "none", padding: "12px 0", margin: "-12px 0", cursor: "pointer", fontFamily: INTER, fontSize: 17, color: "rgba(255,255,255,.72)", textDecoration: "underline", textUnderlineOffset: 3 };
const BOTAO_CLARO: CSSProperties = { height: 44, padding: "0 22px", borderRadius: 999, border: "none", background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 17, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" };

/* ————— as boas-vindas, na grade ————— */
/* A caixa vai da c4 à c20 e da linha 12 à 55 (centrada, como estava); dentro,
   a tinta abre na c5, as bases caem nas linhas e a ilustração vai da c14 à
   c19. Branca, com o raio e a sombra das camadas v4 (Home, Preferências): a
   ilustração, de fundo branco, some na caixa. */
const BV = { esq: 320, topo: 12 * LG, largura: 1280, altura: 43 * LG } as const;
const xCol = (coluna: number) => coluna * 80 - BV.esq;
const yLinha = (linha: number) => linha * LG - BV.topo;
const CINZA_TEXTO = "#5b595b";
const FR_96: CSSProperties = { ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96" };

function BoasVindas({ nome, papel, temPedido, deNovo, curtos, aoComecar, aoAdiar, cartaoRef }: {
  nome: string; papel: string; temPedido: boolean; deNovo: boolean; curtos: string[]; aoComecar: () => void; aoAdiar: () => void; cartaoRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const primeiro = (nome || "").trim().split(/\s+/)[0] || "";
  const sobrancelha = deNovo ? "Apresentação do R2 Hub" : "Primeira vez no R2 Hub";
  const promessa = promessaDe(papel, temPedido);
  const linha1 = primeiro ? "Boas-vindas," : "Boas-vindas";
  /* a base de cada texto numa linha da grade: top = linha − a base dentro da caixa da linha */
  const naBase = (linha: number, corpo: number, lh: number, fraunces = false) => yLinha(linha) - (fraunces ? baseFraunces(corpo, lh) : baseInter(corpo, lh));
  return (
    <div ref={cartaoRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={sobrancelha}
      style={{ position: "absolute", left: BV.esq, top: BV.topo, width: BV.largura, height: BV.altura, boxSizing: "border-box", pointerEvents: "auto", outline: "none",
        background: "#fff", color: PRETO, borderRadius: 20, boxShadow: "7px 7px 42px rgba(0,0,0,.2)", overflow: "hidden", fontFamily: INTER }}>
      <div style={{ position: "absolute", left: xCol(5) - folgaIN(400, 22, sobrancelha.charAt(0)), top: naBase(16, 22, 28), fontSize: 22, lineHeight: "28px", color: CINZA_TEXTO, whiteSpace: "nowrap" }}>{sobrancelha}</div>
      {/* "Boas-vindas", que serve para todo mundo (bem-vindo/bem-vinda pediria saber o gênero) */}
      <div style={{ position: "absolute", left: xCol(5) - folgaFR(84, "B"), top: naBase(22, 84, 100, true), ...FR_96, fontSize: 84, lineHeight: "100px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{linha1}</div>
      {primeiro && (
        <div style={{ position: "absolute", left: xCol(5) - folgaFR(84, primeiro.charAt(0)), top: naBase(27, 84, 100, true), ...FR_96, fontSize: 84, lineHeight: "100px", letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{primeiro}</div>
      )}
      <div style={{ position: "absolute", left: xCol(5) - folgaIN(400, 24, promessa.charAt(0)), top: naBase(31, 24, 32), width: 640, fontSize: 24, lineHeight: "32.24px", color: "#252425", letterSpacing: "-.012em" }}>{promessa}</div>
      {/* o que o roteiro mostra: uma lista numerada (não são botões), em duas colunas */}
      <ol aria-label="O que a apresentação mostra" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {curtos.map((c, i) => (
          <li key={c} style={{ position: "absolute", left: xCol(5) + (i % 2) * 320, top: naBase(39 + 2 * Math.floor(i / 2), 19, 26), height: 26, display: "flex", alignItems: "center", gap: 12, fontSize: 19, lineHeight: "26px", fontWeight: 500, color: "#252425", whiteSpace: "nowrap" }}>
            <b aria-hidden style={{ width: 26, height: 26, borderRadius: 999, background: FUNDO_PAGINA, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: PRETO }}>{i + 1}</b>
            {c}
          </li>
        ))}
      </ol>
      {/* o Começar na c5 e o Ver depois na c8, as bases na linha 50; a nota embaixo do Ver depois, na linha 52 */}
      <button type="button" onClick={aoComecar} autoFocus
        style={{ position: "absolute", left: xCol(5), top: yLinha(50) - (56 - 24) / 2 - baseInter(20, 24), height: 56, padding: "0 30px", borderRadius: 999, border: "none", background: PRETO, color: "#fff", fontFamily: INTER, fontSize: 20, lineHeight: "24px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
        Começar <span aria-hidden style={{ fontSize: 22 }}>→</span>
      </button>
      <button type="button" onClick={aoAdiar}
        style={{ position: "absolute", left: xCol(8) - folgaIN(400, 19, "V"), top: naBase(50, 19, 26) - 9, padding: "9px 0", background: "none", border: "none", cursor: "pointer", fontFamily: INTER, fontSize: 19, lineHeight: "26px", color: "#252425", textDecoration: "underline", textUnderlineOffset: 4 }}>Ver depois</button>
      <div style={{ position: "absolute", left: xCol(8) - folgaIN(400, 16, "D"), top: naBase(52, 16, 22), fontSize: 16, lineHeight: "22px", color: CINZA_TEXTO, whiteSpace: "nowrap" }}>Dá para ver depois nas Preferências ou na Home, em Tutoriais.</div>
      <img src="/np10/bp-joinha2.png" alt="" draggable={false} style={{ position: "absolute", left: xCol(14), top: yLinha(15), width: 400, height: "auto" }} />
    </div>
  );
}
