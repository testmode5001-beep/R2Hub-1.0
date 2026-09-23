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
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as PointerEventReact, ReactNode } from "react";

import { AvisoV1a } from "../v1a/HubV1a";
import { DesignCriadoHub10 } from "./DesignCriadoHub10";
import { BarraTopoHub10, CampoHub10, FR, FUNDO, INTER, PRETO, PalcoFixo, numeroPedido } from "./ChromeHub10";
import { LOTTIE, LottieHub10 } from "./LottieHub10";
import { ModalSucesso, PedidoDetalheHub10 } from "./PedidoDetalheHub10";
import type { AcoesPedido, DetalhePedido, PodeNoPedido } from "./PedidoDetalheHub10";
import type { SessionUser } from "@/lib/session";

/* ————— status: chave do banco → nome e cores do projeto 1.0 ————— */
type Estilo = { rotulo: string; cor: string; tinta: string };
const STATUS: Record<string, Estilo> = {
  nova: { rotulo: "Aguardando design", cor: "#c2ffff", tinta: "#252425" },
  criacao: { rotulo: "Criação", cor: "#aba9fc", tinta: "#252425" },
  aguardando: { rotulo: "Design criado", cor: "#79cdf4", tinta: "#252425" },
  revisao: { rotulo: "Revisão", cor: "#fff079", tinta: "#252425" },
  aprovada: { rotulo: "Aprovado", cor: "#6ede8a", tinta: "#252425" },
  cliche: { rotulo: "Clicheria", cor: "#ffbcf2", tinta: "#252425" },
  refazer_cliche: { rotulo: "Refazer clichê", cor: "#f9caaa", tinta: "#252425" },
  concluido: { rotulo: "Finalizado", cor: "#315bf4", tinta: "#6ede8a" },
  cancelado: { rotulo: "Cancelado", cor: "#f96767", tinta: "#252425" },
};
const estiloDe = (st: string): Estilo => STATUS[st] ?? { rotulo: st, cor: "#fff079", tinta: "#252425" };

/* Só estes dois ganham as ondas animadas — é o que o projeto pede. */
const ONDAS: Record<string, string> = { criacao: LOTTIE.ondasRoxo, revisao: LOTTIE.ondasAmarelo };

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

/* Cards vizinhos de mesmo status vão clareando, e a escala reinicia quando a
   cor muda. É o que separa visualmente blocos longos do mesmo status. */
const DEGRAUS = [0, 0.36, 0.6, 0.78, 0.88];
/* Devolve a cor já clareada E o fator usado. O fator importa para os cards
   animados: a Lottie cobre o card inteiro, então clarear o fundo deles não
   muda nada — o degradê precisa ir POR CIMA da animação. Véu branco em
   opacidade `t` dá exatamente o mesmo resultado que clarear(cor, t): as duas
   coisas são a mesma composição. */
function corSequencia(cores: string[]): { cor: string; clareamento: number; seguidos: number }[] {
  let seguidos = 0;
  return cores.map((cor, i) => {
    if (i > 0 && cores[i - 1] === cor) seguidos++; else seguidos = 0;
    const t = DEGRAUS[Math.min(seguidos, DEGRAUS.length - 1)];
    return { cor: clarear(cor, t), clareamento: t, seguidos };
  });
}

export type PedidoLinha = {
  id: string; numero: number; cliente: string; status: string;
  materia?: string | null; largura?: string | null; altura?: string | null;
  cores?: string | null; cores_desc?: string | null;
  vendedor_id?: string; vendedor_nome?: string | null; designer_nome?: string | null;
  fila?: number | null; respostas_novas?: number; perguntas_abertas?: number;
  created_at: string;
};

const dataCurta = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
};
const medidaDe = (p: PedidoLinha) =>
  p.largura && p.altura ? `${p.largura}×${p.altura}` : (p.largura || p.altura || "—");

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

export function PedidoHub10({ profile, pedidos, aoNavegar, onNova, onLogout, disponiveis, detalheId, detalhe, podeNoPedido, acoesPedido, aoAbrirDetalhe, aoFecharDetalhe, podeFila, aoDefinirFila, aoEnfileirar, aoLimparFila, aoTransferir, children, titulo = "Pedidos", tituloTodos = "Todos os pedidos", vazioTitulo = "Nenhum pedido", vazioTexto = "Ajuste os filtros para ver mais pedidos.", somenteStatus, paginaAtiva = "Pedidos", faixaResumo = "pedidos" }: {
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
  /** mostra só pedidos neste status (chave do banco) */
  somenteStatus?: string;
  /** qual item do menu fica sublinhado */
  paginaAtiva?: string;
  /** quais contagens vão na faixa preta — cada tela olha para o seu trecho
      do fluxo, e a de Aprovações não tem por que falar de fila de design */
  faixaResumo?: "pedidos" | "aprovacoes";
}) {
  const [periodo, setPeriodo] = useState<Periodo>("Esse mês");
  const [dataEsp, setDataEsp] = useState("");
  const [fStatus, setFStatus] = useState("Todos");
  const [fVendedora, setFVendedora] = useState("Todos");
  const [menu, setMenu] = useState<null | "periodo" | "status" | "vendedora">(null);
  const [filaAberta, setFilaAberta] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [modo, setModo] = useState<"lista" | "grade">("lista");
  const [busca, setBusca] = useState("");
  /* confirmação "Arte enviada" — mora aqui porque quem hospeda a modal de
     devolver arte é esta tela, não o painel */
  const [arteEnviada, setArteEnviada] = useState<{ resumo: string; numero: string } | null>(null);
  /* O aviso de resposta nova vive no card e some assim que o pedido é
     marcado como visto — o que acontece no próprio ato de abrir. Guardo o
     valor do clique para o painel saber se deve saltar a resposta. */
  const [respostaNova, setRespostaNova] = useState(false);
  const [rolou, setRolou] = useState(false);
  const [aviso, setAviso] = useState("");
  const [devolver, setDevolver] = useState(false);

  const trilha = useRef<HTMLDivElement | null>(null);

  /* ESC fecha o que esta tela abriu */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (verTodos) { setVerTodos(false); return; }
      setMenu(null); setFilaAberta(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [verTodos]);

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

  /* Rodinha vertical vira rolagem horizontal na trilha — sem isso o mouse
     comum não anda nos cards, que é a navegação principal da tela.
     Anda um CARD por vez, e não os ~120px do giro: a trilha tem
     `scroll-snap-type: x mandatory`, então qualquer passo menor que meio card
     era desfeito pelo próprio snap — a roda parecia morta. A trava de 220ms
     evita que um giro de trackpad, que dispara dezenas de eventos, atravesse
     a fila inteira de uma vez. */
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
      const card = el.querySelector<HTMLElement>(".p10-card");
      const passo = card?.offsetWidth || el.clientWidth / 4;
      el.scrollBy({ left: Math.sign(e.deltaY) * passo, behavior: "smooth" });
      setRolou(true);
    };
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  }, []);

  /* Arrastar com o ponteiro. Guarda se houve movimento para não abrir o
     pedido quando o clique foi, na verdade, um arrasto. */
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
      /* Caneta digitalizadora: ao levantar a ponta o `pointerup` nem sempre
         chega (vem `pointercancel`, ou nada, quando o snap rola a trilha por
         baixo). O arrasto ficava ligado e a trilha seguia a caneta pela tela
         sem ninguém estar arrastando. `buttons === 0` quer dizer que nada
         está pressionado — então acabou, seja lá qual evento faltou. */
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

  /* ————— filtros ————— */
  const noPeriodo = (p: PedidoLinha) => {
    if (periodo === "Tudo") return true;
    const d = new Date(p.created_at);
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
  const doEscopo = useMemo(
    () => (somenteStatus ? pedidos.filter((p) => p.status === somenteStatus) : pedidos),
    [pedidos, somenteStatus],
  );
  const statusUnicos = useMemo(
    () => [...new Set(doEscopo.map((p) => estiloDe(p.status).rotulo))].sort(),
    [doEscopo],
  );
  const vendedoras = useMemo(
    () => [...new Set(doEscopo.map((p) => p.vendedor_nome).filter(Boolean) as string[])].sort(),
    [doEscopo],
  );
  /* Se a escolha deixou de existir — o último cancelado voltou a andar, a
     vendedora não tem mais pedido no período — o filtro se desfaz sozinho em
     vez de deixar a tela vazia com um controle que sumiu. */
  const eStatus = statusUnicos.includes(fStatus) ? fStatus : "Todos";
  const eVendedora = vendedoras.includes(fVendedora) ? fVendedora : "Todos";

  const filtrados = useMemo(
    () => pedidos.filter((p) =>
      (!somenteStatus || p.status === somenteStatus)
      && noPeriodo(p)
      && (eStatus === "Todos" || estiloDe(p.status).rotulo === eStatus)
      && (eVendedora === "Todos" || p.vendedor_nome === eVendedora)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pedidos, periodo, dataEsp, eStatus, eVendedora, somenteStatus],
  );

  /* Na fila primeiro, na ordem marcada; o resto pela chegada, como vem. */
  const ordenados = useMemo(() => {
    const naFila = filtrados.filter((p) => p.fila != null).sort((a, b) => (a.fila ?? 0) - (b.fila ?? 0));
    return [...naFila, ...filtrados.filter((p) => p.fila == null)];
  }, [filtrados]);

  const fundos = useMemo(() => corSequencia(ordenados.map((p) => estiloDe(p.status).cor)), [ordenados]);

  const naBusca = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return ordenados;
    return ordenados.filter((p) =>
      /* as duas grafias do número entram no texto procurado: quem digita
         "#3" e quem digita "#03" acham a mesma linha */
      `${p.cliente} ${numeroPedido(p.numero)} #${p.numero} ${p.vendedor_nome ?? ""} ${p.designer_nome ?? ""} ${estiloDe(p.status).rotulo}`
        .toLowerCase().includes(t));
  }, [ordenados, busca]);

  /* ————— estatísticas da faixa preta ————— */
  const est = useMemo(() => {
    const dois = (n: number) => String(n).padStart(2, "0");
    const conta = (k: string) => pedidos.filter((p) => p.status === k).length;
    /* Aprovações conta o trecho do fluxo que ela governa — do design pronto
       até o clichê — e não a fila de design, que é assunto de Pedidos. */
    if (faixaResumo === "aprovacoes") {
      return {
        l1: `${dois(conta("aprovada"))} aprovados · ${dois(conta("cliche"))} na clicheria · ${dois(conta("aguardando"))} aguardando aprovação · ${dois(conta("refazer_cliche"))} refazer clichê`,
        l2: `${dois(pedidos.length)} pedidos no total · ${dois(conta("concluido"))} finalizados`,
      };
    }
    return {
      l1: `${dois(conta("nova"))} aguardando design · ${dois(conta("revisao"))} em revisão · ${dois(conta("aprovada"))} aprovados · ${dois(conta("aguardando"))} design criado`,
      l2: `${dois(pedidos.length)} pedidos no total · ${dois(conta("cancelado"))} cancelados`,
    };
  }, [pedidos, faixaResumo]);

  const abrir = (p: PedidoLinha) => {
    setRespostaNova((p.respostas_novas ?? 0) > 0);
    aoAbrirDetalhe(p.id);
  };

  const enfileirar = (id: string) => {
    if (!aoEnfileirar) return;
    void Promise.resolve(aoEnfileirar(id))
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para pôr na fila."));
  };

  const mudarFila = (id: string, posicao: number | null) => {
    setFilaAberta(null);
    if (!aoDefinirFila) return;
    void Promise.resolve(aoDefinirFila(id, posicao))
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para mudar a fila."));
  };

  const rotuloPeriodo = periodo === "Data"
    ? (dataEsp ? dataEsp.split("-").reverse().join("/") : "Data específica")
    : periodo;

  /* ————— o cartão ————— */
  const Cartao = ({ p, fundo, clareamento, seguidos, indice, semBase = false }: { p: PedidoLinha; fundo: string; clareamento: number; seguidos: number; indice: number; semBase?: boolean }) => {
    const e = estiloDe(p.status);
    const ondas = ONDAS[p.status];
    const naFila = p.fila != null;
    const pessoa = p.vendedor_id === profile.id ? (p.designer_nome ?? "A definir") : (p.vendedor_nome ?? "—");
    return (
      <div onClick={() => { if (!arrasto.current.andou) abrir(p); }} className="p10-card"
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
        {(p.respostas_novas ?? 0) > 0 && (
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
                <button onClick={() => { setFilaAberta(null); void aoLimparFila?.().catch(() => setAviso("Não deu para limpar a fila.")); }}
                  style={{ marginTop: 6, width: "100%", height: 32, border: "1px solid #f96767", borderRadius: 8, background: "#fff", color: "#f96767", fontFamily: INTER, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Limpar fila</button>
              </div>
            )}
          </>
        )}

        <div style={{ position: "absolute", left: 76, top: 113, width: 335, ...FR, fontSize: 56, lineHeight: "58px", letterSpacing: "-.04em", zIndex: 1 }}>{p.cliente}</div>

        <div style={{ position: "absolute", left: 76, top: 351, height: 50, display: "inline-flex", alignItems: "center", padding: "0 24px", border: `2px solid ${e.tinta}`, borderRadius: 999, fontSize: 24, fontWeight: 600, whiteSpace: "nowrap", zIndex: 1 }}>{e.rotulo}</div>

        {/* `auto` na segunda coluna herdava os 200px fixos de "Entrada"/"Cores"
            e a grade somava 406 numa faixa de 358 — o substrato longo saía
            pela direita do card. minmax(0,1fr) prende a coluna ao que sobra e
            deixa o texto quebrar dentro dela. */}
        <div style={{ position: "absolute", left: 82, right: 40, top: 413, display: "grid", gridTemplateColumns: "206px minmax(0, 1fr)", rowGap: 30, zIndex: 1 }}>
          <CampoHub10 rotulo="Entrada:" valor={dataCurta(p.created_at)} caixa={CAIXA_DESLOCADA} />
          <CampoHub10 rotulo="Cores:" valor={p.cores || "—"} caixa={CAIXA_DESLOCADA} />
          <CampoHub10 rotulo="Medida:" valor={medidaDe(p)} />
          <CampoHub10 rotulo="Substrato:" valor={p.materia || "—"} />
        </div>
      </div>
    );
  };

  return (
    <PalcoFixo>
      <div style={{ position: "absolute", left: 0, top: 726, width: 1920, height: 354, background: PRETO, zIndex: 1 }} />

      {/* trilha de cards */}
      <div ref={trilha} className="p10-trilha" onPointerDown={aoApontar} onScroll={() => setRolou(true)}
        style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 616, display: "flex", alignItems: "stretch", overflowX: "auto", overflowY: "hidden", zIndex: 2 }}>
        {ordenados.map((p, i) => <Cartao key={p.id} p={p} fundo={fundos[i].cor} clareamento={fundos[i].clareamento} seguidos={fundos[i].seguidos} indice={i} />)}
        {/* Folga no fim da trilha. O hover aplica scale(1.015) e o transform
            CONTA para a área rolável: no último card não há vizinho para
            absorver a sobra, então o scrollWidth crescia no hover e o navegador
            empurrava o scrollLeft para seguir no fim — a trilha inteira dava um
            pulo para o lado.

            24px foi MEDIDO, não calculado: a conta do scale dá 3,6px de cada
            lado, mas 8px não bastaram (scrollWidth ainda subia 4px) e 24
            zeraram. O `will-change: transform` põe o card numa camada composta,
            e o Chrome arredonda os limites dela para cima.

            Espaçador, e não padding-right: os cards são `flex: 0 0 25%` do
            CONTEÚDO do contêiner, e o padding encolheria os 480px de cada um —
            foi o que aconteceu na primeira tentativa. */}
        {!!ordenados.length && <div aria-hidden style={{ flex: "0 0 24px", height: 616 }} />}
      </div>

      {!ordenados.length && (
        <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 616, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 2, color: PRETO }}>
          <div style={{ ...FR, fontSize: 44, letterSpacing: "-.02em" }}>{vazioTitulo}</div>
          <div style={{ fontSize: 20, color: CINZA }}>{vazioTexto}</div>
        </div>
      )}

      {!rolou && ordenados.length > 4 && (
        /* Só a seta: o "Arraste para o lado" saiu a pedido do Augusto em
           23/09/2026 — a seta piscando já diz o que fazer, e agora a roda do
           mouse também rola a trilha. */
        <div className="p10-dica" style={{ position: "absolute", left: 1776, top: 392, width: 64, zIndex: 30, pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LottieHub10 src={LOTTIE.seta} style={{ width: 64, height: 64, transform: "rotate(-90deg)" }} />
        </div>
      )}

      <div style={{ position: "absolute", left: 72, top: 813, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontWeight: 600, fontSize: 112, lineHeight: 1, letterSpacing: "-.01em", color: FUNDO, zIndex: 3 }}>{titulo}</div>

      <div style={{ position: "absolute", left: 960, top: 849, width: 888, color: FUNDO, fontSize: 24, lineHeight: 1.5, zIndex: 3, display: "flex", flexDirection: "column", gap: 6 }}>
        <div>{est.l1}</div><div>{est.l2}</div>
      </div>

      {/* filtros do rodapé */}
      <div style={{ position: "absolute", left: 72, top: 998, right: 72, display: "flex", alignItems: "center", fontSize: 19, color: FUNDO, zIndex: 30 }}>
        <div data-pop style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <div className="p10-flat" onClick={() => setMenu(menu === "periodo" ? null : "periodo")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ opacity: .62 }}>Período:</span><span style={{ fontWeight: 500 }}>{rotuloPeriodo}</span>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={FUNDO} strokeWidth={2.4} strokeLinecap="round" style={{ opacity: .7 }}><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          {menu === "periodo" && !verTodos && (
            <div style={{ ...CAIXA_POP, left: 0, bottom: "calc(100% + 16px)", minWidth: 210 }}>
              {PERIODOS.map((v) => (
                <button key={v} onClick={() => { setPeriodo(v); setMenu(null); }}
                  style={{ textAlign: "left", height: 38, padding: "0 14px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: INTER, fontSize: 16, fontWeight: 500, background: v === periodo ? PRETO : "transparent", color: v === periodo ? "#fff" : PRETO }}>{v}</button>
              ))}
              <div style={{ height: 1, background: "rgba(37,36,37,.12)", margin: "5px 6px" }} />
              <label style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 8px 6px", cursor: "pointer" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: periodo === "Data" ? PRETO : CINZA }}>Data específica</span>
                <input type="date" value={dataEsp} onChange={(ev) => { setDataEsp(ev.target.value); setPeriodo("Data"); }}
                  style={{ height: 36, border: `1px solid ${PRETO}`, borderRadius: 8, padding: "0 10px", fontFamily: INTER, fontSize: 15, color: PRETO, background: periodo === "Data" ? "#fff079" : "#fff", outline: "none" }} />
              </label>
            </div>
          )}
        </div>

        {statusUnicos.length > 1 && (
          <div data-pop style={{ position: "relative", display: "flex", alignItems: "center", marginLeft: 150 }}>
            <div className="p10-flat" onClick={() => setMenu(menu === "status" ? null : "status")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ opacity: .62 }}>Status:</span><span style={{ fontWeight: 500 }}>{eStatus}</span>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={FUNDO} strokeWidth={2.4} strokeLinecap="round" style={{ opacity: .7 }}><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            {menu === "status" && !verTodos && (
              <OpcoesPop lista={["Todos", ...statusUnicos]} atual={eStatus}
                aoEscolher={(v) => { setFStatus(v); setMenu(null); }}
                style={{ left: 0, bottom: "calc(100% + 16px)", minWidth: 230 }} />
            )}
          </div>
        )}

        {vendedoras.length > 1 && (
          <div data-pop style={{ position: "relative", display: "flex", alignItems: "center", marginLeft: 150 }}>
            <div className="p10-flat" onClick={() => setMenu(menu === "vendedora" ? null : "vendedora")} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ opacity: .62 }}>Vendedora:</span><span style={{ fontWeight: 500 }}>{eVendedora}</span>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={FUNDO} strokeWidth={2.4} strokeLinecap="round" style={{ opacity: .7 }}><polyline points="6 9 12 15 18 9" /></svg>
            </div>
            {menu === "vendedora" && !verTodos && (
              <OpcoesPop lista={["Todos", ...vendedoras]} atual={eVendedora}
                aoEscolher={(v) => { setFVendedora(v); setMenu(null); }}
                style={{ left: 0, bottom: "calc(100% + 16px)", minWidth: 230 }} />
            )}
          </div>
        )}

        <div className="p10-flat" onClick={() => { setVerTodos(true); setMenu(null); }} style={{ marginLeft: "auto", fontWeight: 500, cursor: "pointer" }}>Ver todos</div>
      </div>

      {/* ————— Ver todos ————— */}
      {verTodos && (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO, zIndex: 50, display: "flex", flexDirection: "column", color: PRETO }}>
          <div style={{ flex: "none", padding: "56px 72px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontWeight: 600, fontSize: 72, lineHeight: 1, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{tituloTodos}</div>
              <div style={{ marginTop: 12, fontSize: 20, color: CINZA }}>{naBusca.length} {naBusca.length === 1 ? "pedido" : "pedidos"}</div>
            </div>
            <button onClick={() => setVerTodos(false)} className="p10-dot" aria-label="Fechar"
              style={{ width: 56, height: 56, borderRadius: 999, border: `1px solid ${PRETO}`, background: PRETO, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>

          <div style={{ flex: "none", padding: "32px 72px 28px", display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 999, padding: 4 }}>
              {(["lista", "grade"] as const).map((m) => (
                <button key={m} onClick={() => setModo(m)}
                  style={{ border: 0, borderRadius: 999, padding: "11px 26px", fontFamily: INTER, fontSize: 15, fontWeight: 600, cursor: "pointer", background: modo === m ? PRETO : "transparent", color: modo === m ? "#fff" : PRETO }}>{m === "lista" ? "Lista" : "Cards"}</button>
              ))}
            </div>
            {aoTransferir && (
              <button onClick={aoTransferir} className="p10-flat" title="Passar os clientes de uma vendedora para outra"
                style={{ height: 52, padding: "0 22px", border: `1px solid ${PRETO}`, borderRadius: 999, background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 15, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 9 }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4" /><path d="M21 7H8" /><path d="M7 21l-4-4 4-4" /><path d="M3 17h13" /></svg>
                Transferir carteira
              </button>
            )}
            <label style={{ height: 52, flex: 1, maxWidth: 560, border: `1.5px dashed ${PRETO}`, borderRadius: 999, background: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "0 22px", cursor: "text" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.6-3.6" /></svg>
              <input value={busca} onChange={(ev) => setBusca(ev.target.value)} placeholder="Buscar cliente, nº, vendedora, status" aria-label="Buscar pedido"
                style={{ flex: 1, border: 0, outline: 0, background: "transparent", fontFamily: INTER, fontSize: 17, color: PRETO }} />
            </label>

            {/* Os mesmos três filtros do rodapé, repetidos aqui: o "Ver todos"
                cobre a tela inteira e esconde o rodapé, então sem isto não há
                como filtrar de dentro dele. */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
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
                      style={{ height: 36, border: `1px solid ${PRETO}`, borderRadius: 8, padding: "0 10px", fontFamily: INTER, fontSize: 15, color: PRETO, background: periodo === "Data" ? "#fff079" : "#fff", outline: "none" }} />
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
                  <OpcoesPop lista={["Todos", ...vendedoras]} atual={eVendedora}
                    aoEscolher={(v) => { setFVendedora(v); setMenu(null); }}
                    style={{ right: 0, top: "calc(100% + 10px)", minWidth: 240, zIndex: 60, boxShadow: "0 20px 44px -16px rgba(0,0,0,.5)" }} />
                </FiltroPilula>
              )}
            </div>
          </div>

          {modo === "lista" ? (
            <div className="p10-trilha" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "0 72px 60px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 220px 260px 130px 80px 200px 140px", gap: "0 20px", padding: "0 24px 16px", fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: CINZA, borderBottom: `1.5px solid ${PRETO}`, position: "sticky", top: 0, background: FUNDO, zIndex: 1 }}>
                <span>Pedido</span><span>Cliente</span><span>Vendedora</span><span>Status</span><span>Medida</span><span>Cores</span><span>Substrato</span><span>Entrada</span>
              </div>
              {naBusca.map((p) => {
                const e = estiloDe(p.status);
                return (
                  <div key={p.id} className="p10-linha" onClick={() => abrir(p)}
                    style={{ display: "grid", gridTemplateColumns: "120px 1fr 220px 260px 130px 80px 200px 140px", gap: "0 20px", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid rgba(37,36,37,.12)", fontSize: 18, cursor: "pointer" }}>
                    <span style={{ fontWeight: 700 }}>{numeroPedido(p.numero)}</span>
                    <span style={{ ...FR, fontSize: 22, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.cliente}</span>
                    <span>{p.vendedor_nome ?? "—"}</span>
                    <span><span style={{ display: "inline-flex", alignItems: "center", whiteSpace: "nowrap", height: 32, padding: "0 16px", borderRadius: 999, background: e.cor, color: e.tinta, fontSize: 14, fontWeight: 700 }}>{e.rotulo}</span></span>
                    <span>{medidaDe(p)}</span><span>{p.cores || "—"}</span><span>{p.materia || "—"}</span><span>{dataCurta(p.created_at)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p10-trilha" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              <div style={{ display: "flex", flexWrap: "wrap", width: 1920, borderTop: `1px solid ${PRETO}` }}>
                {naBusca.map((p, i) => { const s = corSequencia(naBusca.map((x) => estiloDe(x.status).cor))[i]; return <Cartao key={p.id} p={p} fundo={s.cor} clareamento={s.clareamento} seguidos={s.seguidos} indice={i} semBase />; })}
              </div>
            </div>
          )}
        </div>
      )}

      {detalheId && detalhe && (() => {
        const e = estiloDe(String(detalhe.pedido.status ?? ""));
        return (
          <PedidoDetalheHub10 dados={detalhe} cor={e.cor} tinta={e.tinta} statusRotulo={e.rotulo}
            temOndas={ONDAS[String(detalhe.pedido.status ?? "")]}
            souVendedor={detalhe.pedido.vendedor_id === profile.id}
            euId={profile.id} respostaNova={respostaNova} souAdmin={profile.role === "admin"}
            pode={podeNoPedido} acoes={{ ...acoesPedido, enviarArte: () => setDevolver(true) }} aoFechar={aoFecharDetalhe} />
        );
      })()}

      {devolver && detalhe && (
        <DesignCriadoHub10
          pedido={{
            num: numeroPedido(Number(detalhe.pedido.numero)),
            cliente: String(detalhe.pedido.cliente ?? ""),
            spec: detalhe.pedido.cores ? `${detalhe.pedido.cores} cores` : "",
            /* as cores que a vendedora já escreveu no briefing entram
               preenchidas — o designer confere em vez de digitar de novo */
            coresNomes: String(detalhe.pedido.cores_desc ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean),
          }}
          /* v1 na primeira entrega, v2 na segunda. Conta as entregas no
             HISTÓRICO, não os anexos: entregar sem arquivo anexado é comum e
             assim a versão não avançava. É também o que o projeto faz. */
          versaoSugerida={`v${detalhe.historico.filter((h) => h.status === "aguardando").length + 1}`}
          fechar={() => setDevolver(false)}
          onEnviar={(d) => {
            setDevolver(false);
            const cliente = String(detalhe.pedido.cliente ?? "");
            const num = numeroPedido(Number(detalhe.pedido.numero));
            const quantas = d.cores.filter(Boolean).length;
            void Promise.resolve(acoesPedido.enviarArteFinal({ versao: d.versao, cores: d.cores, obs: d.obs, arquivos: d.arquivos }))
              /* a tela de "Arte enviada" é do handoff; sem ela a modal só
                 sumia e o designer não tinha como saber se foi */
              .then(() => setArteEnviada({
                resumo: [cliente, `Arte ${d.versao || "final"}`, quantas ? `${quantas} ${quantas === 1 ? "cor" : "cores"}` : ""]
                  .filter(Boolean).join("  ·  "),
                numero: num,
              }))
              .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para enviar a arte."));
          }}
        />
      )}

      {arteEnviada && (
        <ModalSucesso titulo={"Arte enviada\npara a vendedora"} resumo={arteEnviada.resumo} numero={arteEnviada.numero}
          aoFechar={() => setArteEnviada(null)} />
      )}

      <BarraTopoHub10 profile={profile} paginaAtiva={paginaAtiva} aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis} />

      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </PalcoFixo>
  );
}
