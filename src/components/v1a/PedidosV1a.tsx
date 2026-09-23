// Pedidos V1a — recriação fiel de `Pedidos.dc.html` (handoff v1a, hifi):
//   · coluna esquerda (400px): título Fraunces 82, card Status (lista com
//     orelha de 4px + contagem), card Origem (chips + "Somente atrasados"),
//     2 KPIs-filtro (Clichês para aprovar / na clicheria) e card Medidas
//   · coluna direita: "Fila de produção" + Novo pedido/Exportar, faixa de
//     cards recentes (aberto 560 / fechados 98 com nome vertical) e a tabela
//     completa com colunas ordenáveis (Nº, Cliente, Medida, Substrato,
//     Solicitação, Origem, Status, Prazo), orelha de status por linha e paginação.
//   · dados reais adaptados: status do app → workflow v1a; prazo/origem
//     derivados quando o campo ainda não existe no banco.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { criarBusca } from "@/lib/busca";
import { prazoDoPedido } from "@/lib/prazo";
import { colherBusca } from "@/lib/busca-semente";
import type { SessionUser } from "@/lib/session";
import {
  AMARELO, AvisoV1a, EstagioV1a, FUNDO, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr, nomeEmPe,
} from "./HubV1a";
import { useHubDados } from "./HubDadosV1a";

/* Workflow v1a (STATUS de Pedidos.dc.html — chip bg/fg + orelha). */
/** Corpo do valor no cartão: encolhe conforme o texto cresce ("CÓD PRD-30045"
    é bem mais largo que "70×50") para o cartão não quebrar. */
const corpoValor = (v: string) => (v.length <= 8 ? 20 : v.length <= 12 ? 16.5 : 14);

/** Marca de alteração na linha da tabela. Só aparece quando diz algo que a
    pílula "Alteração pedida" já não diz — mais de uma alteração em aberto, ou
    uma esperando há dois dias ou mais. Marcar "1 · 0d" em toda linha em
    alteração seria repetir a pílula e virar ruído: a marca existe justamente
    para o olho achar a linha FORA do normal. */
function avisoAlteracao(n: number, dias: number | null) {
  const velha = dias !== null && dias >= 2;
  if (n <= 1 && !velha) return null;
  return {
    rotulo: [n > 1 ? String(n) : "", velha ? `${dias}d` : ""].filter(Boolean).join(" · "),
    titulo: [
      n > 1 ? `${n} alterações em aberto` : "1 alteração em aberto",
      velha ? `a mais antiga espera há ${dias} ${dias === 1 ? "dia" : "dias"}` : "",
    ].filter(Boolean).join(" · "),
  };
}

/* `aguardando` e `revisao` eram os DOIS a mesma pílula "Revisão" — e são
   lados opostos: num a arte foi entregue e espera a vendedora, no outro a
   vendedora pediu alteração e a bola está com o design. Quem olhava o cartão
   não sabia de quem era a vez e só descobria pelo sino. */
const ALTERACAO = "Alteração pedida";
const APROVACAO = "Aguardando aprovação";
const STATUS_V1A: Record<string, { bg: string; fg: string; orelha: string }> = {
  "Aguardando Design": { bg: "#f1f1f1", fg: INK, orelha: "#d6d5d6" },
  "Clichê solicitado": { bg: AMARELO, fg: INK, orelha: "#8d8b8d" },
  "Aguardando clichê": { bg: AMARELO, fg: INK, orelha: "#4a484a" },
  "Design aprovado": { bg: INK, fg: AMARELO, orelha: INK },
  [ALTERACAO]: { bg: INK, fg: "#f1f1f1", orelha: AMARELO },
  [APROVACAO]: { bg: "#f1f1f1", fg: "#6f6d6f", orelha: "#b3b1b3" },
  "Clichê recebido": { bg: "#fffbe0", fg: INK, orelha: AMARELO },
  "Em produção": { bg: INK, fg: AMARELO, orelha: AMARELO },
  "Finalizado": { bg: "#f1f1f1", fg: "#8d8b8d", orelha: "#f1f1f1" },
};
const ORDEM_STATUS = ["Aguardando Design", ALTERACAO, APROVACAO, "Design aprovado", "Clichê solicitado", "Aguardando clichê", "Clichê recebido", "Em produção", "Finalizado"];
const APP_PARA_V1A: Record<string, string> = {
  nova: "Aguardando Design",
  criacao: "Aguardando Design",
  aguardando: APROVACAO,
  revisao: ALTERACAO,
  aprovada: "Design aprovado",
  cliche: "Clichê solicitado",
  concluido: "Finalizado",
  cancelado: "Finalizado",
};

const DIA_MS = 86_400_000;
const fmt2 = (n: number) => String(n).padStart(2, "0");
const fmtData = (d: Date) => `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;

/** Adaptador: pedido do app → linha/card de Pedidos v1a (paraPedidos). */
function paraPedido(p: any) {
  const status = APP_PARA_V1A[p.status] ?? "Aguardando Design";
  const isCliche = p.tipo === "cliche";
  const prazoDate = prazoDoPedido(p);
  const dias = Math.round((prazoDate.getTime() - Date.now()) / DIA_MS); // negativo = atrasado
  /* solicitacao = quando o pedido entrou (created_at). Pedido antigo importado sem
     data fica com "—" e vai para o fim da ordenação, nos dois sentidos. */
  const solicitacaoMs = p.created_at ? new Date(p.created_at).getTime() : NaN;
  const solicitacaoOk = !Number.isNaN(solicitacaoMs);
  return {
    raw: p,
    num: `#${String(p.numero).padStart(2, "0")}`,
    cliente: p.cliente as string,
    perguntasAbertas: Number(p.perguntas_abertas ?? 0),
    /* Só vale enquanto o pedido ESTÁ em alteração. Fora disso a conta engana:
       o designer que refez a arte sem marcar as caixinhas deixa alterações
       "abertas" para sempre — o #14 tem oito assim, e já foi entregue. */
    alteracoesAbertas: status === ALTERACAO ? Number(p.alteracoes_abertas ?? 0) : 0,
    alteracaoDias: status === ALTERACAO && p.alteracao_desde
      ? Math.floor((Date.now() - new Date(p.alteracao_desde as string).getTime()) / DIA_MS)
      : null,
    medida: isCliche ? `CÓD ${p.codigo_produto ?? "—"}` : `${p.largura}x${p.altura}`,
    substrato: isCliche ? "Clichê" : (p.materia ?? "—"),
    cores: p.cores ?? "—",
    origem: (p.origem ?? (isCliche ? "interno" : "vendas")) as "vendas" | "producao" | "interno",
    status,
    solicitacao: solicitacaoOk ? fmtData(new Date(solicitacaoMs)) : "—",
    solicitacaoMs: solicitacaoOk ? solicitacaoMs : null,
    prazo: fmtData(prazoDate),
    dias,
  };
}
type PedidoV1a = ReturnType<typeof paraPedido>;

/* ————— Colunas da tabela —————
   A ORDEM é preferência de cada usuário: arrastar o cabeçalho reordena e o
   resultado fica em user_config/prefs. As duas pontas ficam de fora — a orelha
   de status e o olho de abrir não são dados, são a moldura da linha.
   Cliente é `minmax(0,1fr)`, não `1fr`: com `truncate` o conteúdo não encolhe
   sozinho, o mínimo automático da faixa vira a largura do nome inteiro e a
   tabela ganha barra horizontal em vez de cortar o nome com reticências. */
type ColunaId = "num" | "cliente" | "medida" | "substrato" | "solicitacao" | "origem" | "status" | "prazo";
/** `flex`: a coluna também estica para ocupar o que sobrar, e a largura vale
    como PISO. Só o Cliente é assim — é o texto que mais varia e quem absorve
    a folga da tabela. */
const COLUNAS: Record<ColunaId, { label: string; largura: number; flex?: boolean }> = {
  num: { label: "Nº", largura: 74 },
  cliente: { label: "Cliente", largura: 200, flex: true },
  medida: { label: "Medida", largura: 92 },
  substrato: { label: "Substrato", largura: 116 },
  solicitacao: { label: "Solicitação", largura: 104 },
  origem: { label: "Origem", largura: 88 },
  status: { label: "Status", largura: 152 },
  prazo: { label: "Prazo (até)", largura: 96 },
};
/* Padrão: medida junto do substrato (as duas falam da etiqueta) e as duas
   datas lado a lado no fim — chegou / vence, na ordem em que acontecem. */
const ORDEM_COLUNAS: ColunaId[] = ["num", "cliente", "medida", "substrato", "origem", "status", "solicitacao", "prazo"];
const PREF_COLUNAS = "pedidosColunas";
const PREF_LARGURAS = "pedidosLarguras";
/* Respiro entre as colunas. Era 8 e as da direita — medida, substrato, origem,
   status e as duas datas — encostavam umas nas outras. */
const AR_COLUNAS = 18;
const LARGURA_MIN = 56;
const LARGURA_MAX = 560;

/** Nomes que a coluna já teve. Sem isto, o id antigo cairia como
    "desconhecido" e a coluna renascia no fim da fila, desarrumando a tela de
    quem já tinha escolhido a ordem. */
const APELIDOS: Record<string, ColunaId> = { chegada: "solicitacao" };
const idDeColuna = (cru: string): ColunaId | null => {
  const id = APELIDOS[cru] ?? cru;
  return id in COLUNAS ? (id as ColunaId) : null;
};

/** Ordem salva → lista utilizável: joga fora id desconhecido e repetido, e
    acrescenta no fim o que faltar — coluna criada depois não some da tela de
    quem já tinha salvado uma ordem. */
function lerOrdemColunas(cru: unknown): ColunaId[] {
  const pedida = String(cru ?? "").split("|").map(idDeColuna).filter((id): id is ColunaId => !!id);
  const ordem = pedida.filter((id, i) => pedida.indexOf(id) === i);
  for (const id of ORDEM_COLUNAS) if (!ordem.includes(id)) ordem.push(id);
  return ordem;
}

/** Larguras salvas ("medida:120|status:180") → só as que existem e cabem no
    limite; qualquer sujeira é ignorada e a coluna volta ao padrão. */
function lerLarguras(cru: unknown): Partial<Record<ColunaId, number>> {
  const out: Partial<Record<ColunaId, number>> = {};
  for (const par of String(cru ?? "").split("|")) {
    const [cru2, valor] = par.split(":");
    const id = idDeColuna(cru2);
    const n = Math.round(Number(valor));
    if (id && Number.isFinite(n) && n >= LARGURA_MIN && n <= LARGURA_MAX) out[id] = n;
  }
  return out;
}
const escreverLarguras = (l: Partial<Record<ColunaId, number>>) =>
  Object.entries(l).map(([id, n]) => `${id}:${n}`).join("|");

const ORIGENS = [
  ["todas", "Todas"], ["producao", "Produção"], ["interno", "Interno"], ["vendas", "Vendas"],
] as const;

export function PedidosV1a({ profile, pedidos, versao, onOpen, aoNavegar, onNova, onLogout, disponiveis, children, aoVoltarFila, aoAprovarPedido, aoTransferir }: {
  profile: SessionUser;
  pedidos: any[];
  versao?: string;
  onOpen: (id: string) => void;
  aoNavegar: (label: string) => void;
  onNova: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  /** devolve o pedido para a fila do design (arrastar a linha para os cartões) */
  aoVoltarFila?: (pedidoId: string) => Promise<unknown>;
  /** tira o pedido da fila: arte aprovada (arrastar o cartão para a tabela) */
  aoAprovarPedido?: (pedidoId: string) => Promise<unknown>;
  /** abre "Transferir carteira" — ausente para quem não tem a permissão */
  aoTransferir?: () => void;
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
}) {
  /* veio de um resultado da busca do topo? já entra filtrado por ele */
  const [busca, setBusca] = useState(() => colherBusca());
  /* preferência "modo compacto das listas": linhas mais baixas na tabela */
  const dadosHub = useHubDados();
  const compacto = dadosHub.prefs?.compacto === true;
  const [aviso, setAviso] = useState("");
  const [status, setStatus] = useState("Todos");
  const [grupo, setGrupo] = useState<"" | "clicheria" | "aprovar">("");
  const [origem, setOrigem] = useState<string>("todas");
  const [soAtraso, setSoAtraso] = useState(false);
  const [linha, setLinha] = useState(0);
  const [recIdx, setRecIdx] = useState(0);
  const [ordem, setOrdem] = useState<{ campo: string | null; dir: 1 | -1 }>({ campo: null, dir: 1 });
  /* ordem das colunas: preferência do usuário, arrastando o cabeçalho */
  const [colunas, setColunas] = useState<ColunaId[]>(() => lerOrdemColunas(dadosHub.prefs?.[PREF_COLUNAS]));
  const [colPegada, setColPegada] = useState<ColunaId | null>(null);
  const [colAlvo, setColAlvo] = useState<ColunaId | null>(null);
  /* quem está sendo arrastada mora TAMBÉM num ref: `dragover` precisa chamar
     preventDefault já na primeira vez para o `drop` chegar a acontecer, e o
     estado só valeria depois de um novo render. O estado fica para o desenho
     (a coluna apagada e o sublinhado do alvo); o ref é quem decide. */
  const colPegadaRef = useRef<ColunaId | null>(null);
  /* largura por coluna: puxar a alça no cabeçalho. Vazio = tudo no padrão. */
  const [larguras, setLarguras] = useState<Partial<Record<ColunaId, number>>>(() => lerLarguras(dadosHub.prefs?.[PREF_LARGURAS]));
  /* as prefs chegam do servidor depois da primeira pintura; só que se o usuário
     já mexeu nas colunas enquanto isso, a resposta não pode desfazer o gesto */
  const mexiColunas = useRef(false);
  useEffect(() => {
    if (mexiColunas.current || !dadosHub.prefs) return;
    setColunas(lerOrdemColunas(dadosHub.prefs[PREF_COLUNAS]));
    setLarguras(lerLarguras(dadosHub.prefs[PREF_LARGURAS]));
  }, [dadosHub.prefs]);
  /* arrastar uma linha da tabela de volta para a faixa da fila (mesmo gesto da
     tela de Aprovação) */
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [sobreFila, setSobreFila] = useState(false);
  /* cartão da fila sendo puxado para a tabela = sai da fila (arte aprovada) */
  const [arrastandoCard, setArrastandoCard] = useState<string | null>(null);
  const [sobreTabela, setSobreTabela] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  const todos = useMemo(() => pedidos.map(paraPedido), [pedidos]);
  const atrasados = todos.filter((p) => p.dias < 0);
  const totalClicheria = todos.filter((p) => p.status === "Clichê solicitado" || p.status === "Aguardando clichê").length;
  /* mesmo conjunto de antes de "Revisão" virar dois status — o grupo continua
     sendo tudo que já passou pelo design e ainda não virou clichê */
  const EM_APROVACAO = [ALTERACAO, APROVACAO, "Design aprovado"];
  const totalAprovar = todos.filter((p) => EM_APROVACAO.includes(p.status)).length;

  const vis = useMemo(() => {
    const casa = criarBusca(busca);
    let l = todos.filter((p) => {
      const okS = grupo === "clicheria"
        ? (p.status === "Clichê solicitado" || p.status === "Aguardando clichê")
        : grupo === "aprovar"
          ? EM_APROVACAO.includes(p.status)
          : (status === "Todos" || p.status === status);
      const okO = origem === "todas" || p.origem === origem;
      const okA = !soAtraso || p.dias < 0;
      const okQ = casa(p.cliente, p.num, p.medida, p.substrato);
      return okS && okO && okA && okQ;
    });
    const { campo, dir } = ordem;
    if (campo) {
      const num = (m: string) => { const p = m.toLowerCase().split("x"); return [parseFloat(p[0]) || 0, parseFloat(p[1]) || 0]; };
      const data = (d: string) => { const p = d.split("/"); return new Date(2000 + +p[2], +p[1] - 1, +p[0]).getTime(); };
      const cmp: Record<string, (a: PedidoV1a, b: PedidoV1a) => number> = {
        num: (a, b) => a.num.localeCompare(b.num),
        cliente: (a, b) => a.cliente.localeCompare(b.cliente, "pt"),
        medida: (a, b) => { const x = num(a.medida), y = num(b.medida); return x[0] - y[0] || x[1] - y[1]; },
        substrato: (a, b) => a.substrato.localeCompare(b.substrato, "pt"),
        /* sem data conhecida vai para o fim nos dois sentidos (o `* dir` de
           baixo inverteria um valor fixo junto com o resto) */
        solicitacao: (a, b) => (a.solicitacaoMs === null || b.solicitacaoMs === null)
          ? (a.solicitacaoMs === b.solicitacaoMs ? 0 : (a.solicitacaoMs === null ? 1 : -1) * dir)
          : a.solicitacaoMs - b.solicitacaoMs,
        origem: (a, b) => a.origem.localeCompare(b.origem),
        status: (a, b) => ORDEM_STATUS.indexOf(a.status) - ORDEM_STATUS.indexOf(b.status),
        prazo: (a, b) => data(a.prazo) - data(b.prazo),
      };
      l = l.slice().sort((a, b) => cmp[campo](a, b) * dir);
    }
    return l;
  }, [todos, busca, status, grupo, origem, soAtraso, ordem]);

  /* Medidas mais pedidas (contagem real dos pedidos em aberto). */
  const medidas = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of todos) if (!p.medida.startsWith("CÓD")) m[p.medida] = (m[p.medida] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nome, n]) => ({ nome, n }));
  }, [todos]);
  const maxMedida = Math.max(1, ...medidas.map((c) => c.n));

  /* A faixa de cartões é a FILA: o que ainda depende do design. Depois de
     aprovado o pedido sai daqui e segue só na tabela de baixo — senão a fila
     vira uma lista de tudo e perde a função de dizer "olhe para estes". */
  const NA_FILA = [ALTERACAO, "Aguardando Design", APROVACAO];
  /* Duas vezes, não três: alteração pedida e aguardando design são as duas a
     vez do DESIGN e disputam as vagas em pé de igualdade — quem espera há mais
     tempo passa na frente. Separar os dois faria quatro alterações expulsarem
     da faixa um pedido novo que ninguém pegou. "Aguardando aprovação" é a vez
     da vendedora e só aparece se sobrar vaga. */
  const VEZ_DO_DESIGN = (s: string) => s === ALTERACAO || s === "Aguardando Design";
  const recentes = useMemo(
    /* QUATRO, não seis: com seis os cartões somavam 1100px numa faixa de 896
       e os dois últimos ficavam fora da tela — a fila mostrava menos do que
       parecia. Com quatro eles cabem inteiros e ficam maiores; o resto da
       fila está na tabela logo abaixo.

       A ordem é a URGÊNCIA, não o número. Ordenando pelo nº o pedido mais
       recente empurrava para fora da faixa a alteração que já estava pedida
       há dias — era o caso do #27, em alteração e invisível na fila. Dentro
       do mesmo grupo vem primeiro quem está esperando há mais tempo. */
    () => todos.filter((p) => NA_FILA.includes(p.status))
      .slice()
      .sort((a, b) =>
        Number(VEZ_DO_DESIGN(b.status)) - Number(VEZ_DO_DESIGN(a.status))
        || a.dias - b.dias
        || b.num.localeCompare(a.num))
      .slice(0, 4),
    [todos],
  );

  /* grade da tabela: cabeçalho e linhas leem daqui para não saírem de sincronia */
  const larguraDe = (id: ColunaId) => larguras[id] ?? COLUNAS[id].largura;
  const grade = useMemo(
    () => `40px ${colunas.map((id) => (COLUNAS[id].flex ? `minmax(${larguraDe(id)}px,1fr)` : `${larguraDe(id)}px`)).join(" ")} 36px`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colunas, larguras],
  );
  const colunasNoPadrao = colunas.join("|") === ORDEM_COLUNAS.join("|") && Object.keys(larguras).length === 0;

  /* Guarda espalhando as prefs que já existem: o objeto salvo SUBSTITUI o
     anterior no user_config, então mandar só a chave nova apagaria som,
     modo compacto e tela inicial. */
  function salvarColunas(nova: ColunaId[], novasLarguras = larguras) {
    mexiColunas.current = true;
    setColunas(nova);
    setLarguras(novasLarguras);
    if (!dadosHub.aoSalvarPrefs) return;
    void Promise.resolve(dadosHub.aoSalvarPrefs({
      ...dadosHub.prefs,
      [PREF_COLUNAS]: nova.join("|"),
      [PREF_LARGURAS]: escreverLarguras(novasLarguras),
    })).catch(() => setAviso("Valeu nesta tela, mas não deu para guardar para as próximas visitas."));
  }
  /* Solta em cima de outra coluna: indo para a direita entra DEPOIS dela,
     indo para a esquerda entra ANTES — que é para onde a mão está apontando. */
  function moverColuna(de: ColunaId, para: ColunaId) {
    if (de === para) return;
    const paraDireita = colunas.indexOf(de) < colunas.indexOf(para);
    const nova = colunas.filter((c) => c !== de);
    nova.splice(nova.indexOf(para) + (paraDireita ? 1 : 0), 0, de);
    salvarColunas(nova);
  }

  /* Alça de largura. Arrasta com pointer (não com o drag-and-drop do HTML, que
     é o gesto de REORDENAR logo ao lado) e só grava no soltar — gravar a cada
     pixel seria uma rajada de escritas no servidor.
     A escala vem medida do próprio elemento: a tela inteira vive dentro de um
     `scale()` (o zoom do topo), então o movimento do mouse em pixels de janela
     não é o mesmo tanto em pixels de layout. */
  function puxarLargura(e: React.PointerEvent<HTMLElement>, id: ColunaId) {
    e.preventDefault(); e.stopPropagation();
    const alca = e.currentTarget;
    const escala = alca.getBoundingClientRect().width / (alca.offsetWidth || 1) || 1;
    const x0 = e.clientX;
    const inicial = larguraDe(id);
    let ultima = inicial;
    const mover = (ev: PointerEvent) => {
      ultima = Math.min(LARGURA_MAX, Math.max(LARGURA_MIN, Math.round(inicial + (ev.clientX - x0) / escala)));
      setLarguras((L) => ({ ...L, [id]: ultima }));
    };
    const soltar = () => {
      alca.removeEventListener("pointermove", mover);
      try { alca.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
      if (ultima !== inicial) salvarColunas(colunas, { ...larguras, [id]: ultima });
    };
    alca.setPointerCapture(e.pointerId);
    alca.addEventListener("pointermove", mover);
    alca.addEventListener("pointerup", soltar, { once: true });
    alca.addEventListener("pointercancel", soltar, { once: true });
  }

  const CARD_BRANCO = { background: "#fff", borderRadius: 12, boxShadow: SOMBRA_CARD } as const;
  const chipOrigem = (o: PedidoV1a["origem"]) => ({
    label: o === "producao" ? "Produção" : o === "interno" ? "Interno" : "Vendas",
    bg: o === "producao" ? AMARELO : o === "interno" ? INK : FUNDO,
    fg: o === "interno" ? "#f1f1f1" : INK,
  });

  return (
    <EstagioV1a>
      <TopbarV1a
        nome={profile.nome.split(" ")[0]}
        busca={busca}
        aoBuscar={setBusca}
        onSair={onLogout}
        inputRef={buscaRef}
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
        <RailV1a
          ativo="Pedidos"
          permitidas={disponiveis}
          aoNavegar={aoNavegar}
          onNovo={onNova}
          versao={versao}
        />

        {/* ————— Coluna esquerda (400px) ————— */}
        <div style={{ flex: "0 0 400px", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 className="select-none" style={{ ...fr(144, 900), fontSize: 82, lineHeight: 0.8, color: INK, margin: "2px 0 2px 6px" }}>Pedidos</h1>

          {/* Status */}
          <div style={{ ...CARD_BRANCO, padding: "20px 22px 16px" }}>
            <div className="select-none" style={{ font: "800 19px/1 Inter, sans-serif", color: INK, marginBottom: 16, letterSpacing: "-.01em" }}>Status</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {["Todos", ...ORDEM_STATUS].map((nome) => {
                const on = !grupo && status === nome;
                const n = nome === "Todos" ? todos.length : todos.filter((p) => p.status === nome).length;
                const s = STATUS_V1A[nome];
                return (
                  <button
                    key={nome}
                    onClick={() => { setStatus(nome); setGrupo(""); setLinha(0); }}
                    style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: 0, cursor: "pointer", borderRadius: 6, padding: "11px 12px", font: `${on ? 600 : 500} 14px/1 Inter, sans-serif`, background: on ? INK : "transparent", color: on ? AMARELO : INK }}
                  >
                    <span style={{ flex: "0 0 4px", height: 18, borderRadius: 1, background: s ? s.orelha : on ? AMARELO : "#d6d5d6" }} />
                    <span className="truncate" style={{ flex: 1, minWidth: 0, lineHeight: 1 }}>{nome}</span>
                    <span style={{ font: "800 13.5px/1 Inter, sans-serif", padding: "4px 7px", borderRadius: 999, background: on ? "#3a383a" : FUNDO, color: on ? AMARELO : "#5c5a5c" }}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Origem + Somente atrasados */}
          <div style={{ ...CARD_BRANCO, padding: "20px 22px 18px" }}>
            <div className="select-none" style={{ font: "800 19px/1 Inter, sans-serif", color: INK, marginBottom: 16, letterSpacing: "-.01em" }}>Origem</div>
            <div style={{ display: "flex", gap: 6 }}>
              {ORIGENS.map(([k, label]) => {
                const on = origem === k;
                return (
                  <button key={k} onClick={() => setOrigem(k)} className="r2chip" style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "600 14.5px/1 Inter, sans-serif", whiteSpace: "nowrap", background: on ? AMARELO : FUNDO, color: INK }}>
                    {label}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
              <button onClick={() => setSoAtraso((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", border: 0, background: "transparent", padding: 0, font: "500 15px/1 Inter, sans-serif", color: INK, whiteSpace: "nowrap" }}>
                <span style={{ flex: "0 0 22px", height: 22, display: "grid", placeItems: "center", borderRadius: 4, background: soAtraso ? INK : FUNDO }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={soAtraso ? AMARELO : "#d6d5d6"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                </span>
                <span style={{ lineHeight: "22px" }}>Somente atrasados</span>
              </button>
            </div>
          </div>

          {/* KPIs-filtro */}
          <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
            <button onClick={() => { setGrupo(grupo === "aprovar" ? "" : "aprovar"); setStatus("Todos"); setLinha(0); }} className="r2chip"
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", border: 0, cursor: "pointer", borderRadius: 12, padding: "18px 18px 16px", background: grupo === "aprovar" ? INK : AMARELO }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={grupo === "aprovar" ? AMARELO : INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
                <span style={{ font: "800 34px/1 Inter, sans-serif", letterSpacing: "-.03em", color: grupo === "aprovar" ? "#f1f1f1" : INK }}>{totalAprovar}</span>
              </div>
              <div style={{ font: "600 12.5px/1.3 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10, color: grupo === "aprovar" ? "#b3b1b3" : INK }}>
                {grupo === "aprovar" ? "Filtrando aprovação" : "Clichês para aprovar"}
              </div>
            </button>
            <button onClick={() => { setGrupo(grupo === "clicheria" ? "" : "clicheria"); setStatus("Todos"); setLinha(0); }} className="r2chip"
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", border: 0, cursor: "pointer", borderRadius: 12, padding: "18px 18px 16px", background: grupo === "clicheria" ? AMARELO : INK }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={grupo === "clicheria" ? INK : AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M2.5 6.5h11v10h-11z" /><path d="M13.5 10.5h4l3 3.5v2.5h-7z" /><path d="M7 20.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4" /><path d="M18 20.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4" /></svg>
                <span style={{ font: "800 34px/1 Inter, sans-serif", letterSpacing: "-.03em", color: grupo === "clicheria" ? INK : "#f1f1f1" }}>{totalClicheria}</span>
              </div>
              <div style={{ font: "600 12.5px/1.3 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10, color: grupo === "clicheria" ? INK : "#b3b1b3" }}>
                {grupo === "clicheria" ? "Filtrando a clicheria" : "Clichês na clicheria"}
              </div>
            </button>
          </div>

          {/* Medidas */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", ...CARD_BRANCO, padding: "20px 22px 16px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
              <span className="select-none" style={{ font: "800 19px/1 Inter, sans-serif", color: INK, letterSpacing: "-.01em" }}>Medidas</span>
              {/* dizia "apontamentos do mês" e não era nem uma coisa nem outra:
                  conta TODOS os pedidos da lista, de qualquer mês e qualquer
                  status. O card gêmeo da Central conta só os em aberto. */}
              <span style={{ font: "400 13.5px/1 Inter, sans-serif", color: "#b3b1b3" }}>todos os pedidos</span>
            </div>
            {medidas.length === 0 && <div style={{ font: "400 14px/1.4 Inter, sans-serif", color: "#b3b1b3" }}>Sem dados ainda.</div>}
            {medidas.map((c) => (
              <div key={c.nome} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, minHeight: 34 }}>
                <span style={{ flex: "0 0 auto", font: "400 15px/1.2 Inter, sans-serif", color: INK, whiteSpace: "nowrap" }}>{c.nome}</span>
                <span style={{ position: "relative", flex: "1 1 auto", height: 20, background: "#e8e8e8", borderRadius: 3, overflow: "hidden" }}>
                  <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 7, width: `${Math.round(38 + 62 * (c.n / maxMedida))}%`, background: INK, borderRadius: 3 }}>
                    <span style={{ font: "800 12.5px/1 Inter, sans-serif", color: AMARELO }}>{c.n}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ————— Coluna direita ————— */}
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 12, minWidth: 0, minHeight: 0 }}>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 83, padding: "0 4px 10px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <h2 className="select-none" style={{ font: "800 38px/1 Inter, sans-serif", letterSpacing: "-.03em", color: INK, margin: 0, whiteSpace: "nowrap" }}>Fila de produção</h2>
              <span style={{ font: "400 15px/1 Inter, sans-serif", color: "#8d8b8d" }}>
                {vis.length} de {todos.length} pedidos · {atrasados.length} atrasados
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!!aoTransferir && (
                <button onClick={aoTransferir} className="r2chip" title="Passar os clientes de uma vendedora para outra"
                  style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: 0, borderRadius: 999, padding: "10px 16px", cursor: "pointer", font: "600 15px/1 Inter, sans-serif", color: INK, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 8.5h13" /><path d="m13.5 5 3.5 3.5-3.5 3.5" /><path d="M20 15.5H7" /><path d="M10.5 12 7 15.5l3.5 3.5" /></svg>
                  <span style={{ lineHeight: "16px" }}>Transferir carteira</span>
                </button>
              )}
              <button onClick={onNova} className="r2chip" style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: 0, borderRadius: 999, padding: "10px 16px", cursor: "pointer", font: "600 15px/1 Inter, sans-serif", color: INK, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                <span style={{ lineHeight: "16px" }}>Novo pedido</span>
              </button>
              <button onClick={() => setAviso("Exportar — em breve.")} className="r2chip" style={{ display: "flex", alignItems: "center", gap: 9, background: INK, border: 0, borderRadius: 999, padding: "10px 16px", cursor: "pointer", font: "600 15px/1 Inter, sans-serif", color: AMARELO }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 3.5v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4.5 20.5h15" /></svg>
                <span style={{ lineHeight: "16px" }}>Exportar</span>
              </button>
            </div>
          </div>

          {/* Recentes — card aberto 560 + fechados 98 */}
          <div
            onDragOver={(e) => { if (arrastando && aoVoltarFila) { e.preventDefault(); setSobreFila(true); } }}
            onDragLeave={() => setSobreFila(false)}
            onDrop={(e) => {
              e.preventDefault();
              const id = arrastando;
              setSobreFila(false); setArrastando(null);
              if (id && aoVoltarFila) {
                void Promise.resolve(aoVoltarFila(id))
                  .then(() => setAviso("Pedido de volta na fila do design."))
                  .catch((err: unknown) => setAviso(err instanceof Error ? err.message : "Não deu para voltar o pedido."));
              }
            }}
            style={{ display: "flex", justifyContent: "flex-start", gap: 10, height: 230, minWidth: 0, overflow: "hidden", borderRadius: 14, outline: sobreFila ? `3px dashed ${AMARELO}` : "none", outlineOffset: 6, transition: "outline-color .15s ease" }}>
            {recentes.length === 0 && (
              <div style={{ flex: "0 0 560px", display: "grid", placeItems: "center", background: "#fff", border: "2px dashed #e0e0e0", borderRadius: 12, padding: 20, textAlign: "center" }}>
                <div>
                  <div style={{ font: "700 16px/1.3 Inter, sans-serif", color: INK }}>{sobreFila ? "Solte aqui" : "Fila vazia"}</div>
                  <div style={{ font: "400 14.5px/1.4 Inter, sans-serif", color: "#8d8b8d", marginTop: 6 }}>
                    {sobreFila
                      ? "O pedido volta para a fila do design."
                      : "Nenhum pedido esperando design. Arraste uma linha da tabela para trazer de volta."}
                  </div>
                </div>
              </div>
            )}
            {recentes.map((p, i) => {
              const aberto = Math.min(recIdx, recentes.length - 1) === i;
              const s = STATUS_V1A[p.status];
              const prod = p.origem === "producao";
              const interno = p.origem === "interno";
              const atraso = p.dias < 0;
              /* amarelo = ALGUÉM PRECISA AGIR AGORA: a vendedora pediu
                 alteração, ou é pedido da produção. "Aguardando aprovação"
                 fica branco de propósito — a arte já foi entregue, a bola é
                 da vendedora, e pintar os dois de amarelo era justamente o
                 que fazia o cartão perder a função. */
              const amarelo = !interno && (prod || p.status === ALTERACAO);
              const bg = amarelo ? AMARELO : interno ? INK : "#fff";
              /* sem orelha no card: o fundo já diz o status, e a faixa colorida
                 era um segundo código de cor para a mesma informação. A marca
                 de 4px do filtro lateral e da tabela continua. */
              const chip = interno ? { bg: "#3a383a", fg: "#f1f1f1" } : amarelo ? { bg: "#fff", fg: INK } : { bg: s.bg, fg: s.fg };
              return (
                <div
                  key={p.raw.id}
                  className="r2card"
                  draggable={!!aoAprovarPedido}
                  onDragStart={() => setArrastandoCard(p.raw.id)}
                  onDragEnd={() => { setArrastandoCard(null); setSobreTabela(false); }}
                  title={aoAprovarPedido ? "Arraste para a tabela para tirar da fila (arte aprovada)" : undefined}
                  onClick={() => { if (aberto) onOpen(p.raw.id); else setRecIdx(i); }}
                  /* encolhe se faltar espaço (`0 1`), em vez de vazar para fora
                     da faixa como acontecia com `0 0` */
                  style={{ flex: aberto ? "0 1 600px" : "0 1 88px", minWidth: aberto ? 460 : 64, position: "relative", textAlign: "left", overflow: "hidden", cursor: "pointer", borderRadius: 12, background: bg, boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.28)" }}
                >
                  {aberto ? (
                    <div style={{ display: "flex", alignItems: "stretch", gap: 20, height: "100%", padding: "22px 26px 20px" }}>
                      <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", whiteSpace: "nowrap", color: interno ? "#b3b1b3" : amarelo ? "rgba(37,36,37,.62)" : "#8d8b8d" }}>
                          {p.num} / {prod ? "PRODUÇÃO" : interno ? "INTERNO" : "VENDAS"}
                        </span>
                        <h3 style={{ margin: "auto 0 0", ...fr(96, 700), fontSize: 38, lineHeight: 0.98, letterSpacing: "-.03em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", color: interno ? "#f1f1f1" : INK }}>
                          {p.cliente}
                        </h3>
                        {/* Três pílulas com nome de status comprido ("Aguardando
                            design") passam dos 285px que sobram e invadiam o
                            bloco da direita. A do prazo saiu (ENTREGA já está
                            na grade ao lado, no mesmo cartão) e a de status
                            encurta com reticências em vez de transbordar. */}
                        {/* com o cartão mais alto as pílulas QUEBRAM em vez de
                            cortar: "Aguardando design" aparecia como
                            "Aguardando des…" por falta de largura */}
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, margin: "12px 0 0 -1px", minWidth: 0 }}>
                          <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "9px 13px", font: `600 12.5px/1 ${MONO}`, letterSpacing: ".12em", textTransform: "uppercase", whiteSpace: "nowrap", border: `1.5px solid ${interno ? "rgba(241,241,241,.5)" : amarelo ? "rgba(37,36,37,.4)" : "#d6d5d6"}`, color: interno ? "#f1f1f1" : INK }}>
                            Abrir pedido
                          </span>
                          <span style={{ flex: "0 0 auto", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 11px 6px", borderRadius: 999, background: chip.bg, color: chip.fg }}>
                            {p.status}
                          </span>
                          {(atraso || p.status === "Finalizado") && (
                            <span style={{ flex: "0 0 auto", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 11px 6px", borderRadius: 999, background: atraso ? (interno || amarelo ? INK : AMARELO) : interno ? "#3a383a" : FUNDO, color: atraso ? (interno || amarelo ? AMARELO : INK) : interno ? "#b3b1b3" : "#8d8b8d" }}>
                              {p.status === "Finalizado" ? "entregue" : `há ${Math.abs(p.dias)}d`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ width: 1, alignSelf: "stretch", background: interno ? "rgba(241,241,241,.16)" : amarelo ? "rgba(37,36,37,.16)" : "#ececec" }} />
                      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
                        <span style={{ display: "grid", placeItems: "center", flex: "none", width: 26, height: 26, borderRadius: 999, border: `1.5px solid ${interno ? "rgba(241,241,241,.45)" : amarelo ? "rgba(37,36,37,.35)" : "#d6d5d6"}` }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={interno ? "#f1f1f1" : INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 17.5 17.5 6.5" /><path d="M9.5 6.5h8v8" /></svg>
                        </span>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "18px 30px", justifyItems: "end", maxWidth: 330 }}>
                          {[["Medida", p.medida], ["Substrato", p.substrato], ["Cores", String(p.cores)], ["Entrega", p.prazo]].map(([k, v]) => (
                            <div key={k} style={{ minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                              <span style={{ font: `600 12.5px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", whiteSpace: "nowrap", color: interno ? "#8d8b8d" : amarelo ? "rgba(37,36,37,.5)" : "#b3b1b3" }}>{k}</span>
                              {/* valor longo (ex.: CÓD PRD-30045) diminui em vez de empurrar o cartão */}
                              <span title={String(v)}
                                style={{ ...fr(48, 700), fontSize: corpoValor(String(v)), lineHeight: 1.05, letterSpacing: "-.01em", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", color: interno ? "#f1f1f1" : INK }}>
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: 12, height: "100%", padding: "20px 8px 18px" }}>
                      <span style={{ font: `600 13.5px/1 ${MONO}`, letterSpacing: ".06em", color: interno ? "#8d8b8d" : "#b3b1b3" }}>{String(i + 1).padStart(2, "0")}</span>
                      <span title={p.cliente} style={{ flex: 1, minHeight: 0, writingMode: "vertical-rl", transform: "rotate(180deg)", ...fr(72, 700), ...nomeEmPe(p.cliente), letterSpacing: "-.02em", textAlign: "left", overflow: "hidden", color: interno ? "#f1f1f1" : INK }}>
                        {p.cliente}
                      </span>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: atraso ? AMARELO : interno ? "#3a383a" : "#e0e0e0" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tabela — também é onde se solta o cartão que sai da fila */}
          <div
            onDragOver={(e) => { if (arrastandoCard && aoAprovarPedido) { e.preventDefault(); setSobreTabela(true); } }}
            onDragLeave={() => setSobreTabela(false)}
            onDrop={(e) => {
              e.preventDefault();
              const id = arrastandoCard;
              setSobreTabela(false); setArrastandoCard(null);
              if (id && aoAprovarPedido) {
                void Promise.resolve(aoAprovarPedido(id))
                  .then(() => setAviso("Arte aprovada — o pedido saiu da fila."))
                  .catch((err: unknown) => setAviso(err instanceof Error ? err.message : "Não deu para aprovar."));
              }
            }}
            style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", ...CARD_BRANCO, padding: "4px 26px 14px", outline: sobreTabela ? `3px dashed ${AMARELO}` : "none", outlineOffset: -3 }}>
            <div style={{ display: "grid", gridTemplateColumns: grade, alignItems: "center", gap: AR_COLUNAS, padding: "18px 0 16px", borderBottom: "1px solid #e8e8e8" }}>
              <span style={{ display: "grid", placeItems: "center" }}>
                {!colunasNoPadrao && (
                  <button onClick={() => salvarColunas([...ORDEM_COLUNAS], {})} title="Restaurar as colunas: ordem e largura originais"
                    style={{ display: "grid", placeItems: "center", width: 22, height: 22, border: 0, borderRadius: 5, cursor: "pointer", background: FUNDO, font: "700 13px/1 Inter, sans-serif", color: "#8d8b8d" }}>
                    ↺
                  </button>
                )}
              </span>
              {colunas.map((campo, iCol) => {
                const on = ordem.campo === campo;
                const pegada = colPegada === campo;
                const alvo = !!colPegada && colPegada !== campo && colAlvo === campo;
                return (
                  /* O invólucro é a casa da grade: recebe o SOLTAR (vale em toda
                     a faixa da coluna) e hospeda a alça de largura, que fica
                     FORA do botão de propósito — encostar nela não pode disparar
                     o arrasto de reordenar. */
                  <span
                    key={campo}
                    style={{ position: "relative", display: "flex", alignItems: "center", minWidth: 0 }}
                    onDragOver={(e) => { if (colPegadaRef.current) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setColAlvo(campo); } }}
                    onDragLeave={() => setColAlvo((c) => (c === campo ? null : c))}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      const de = colPegadaRef.current;
                      colPegadaRef.current = null; setColPegada(null); setColAlvo(null);
                      if (de) moverColuna(de, campo);
                    }}
                  >
                    <button
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; colPegadaRef.current = campo; setColPegada(campo); }}
                      onDragEnd={() => { colPegadaRef.current = null; setColPegada(null); setColAlvo(null); }}
                      onClick={() => setOrdem((s) => ({ campo, dir: s.campo === campo ? (s.dir === 1 ? -1 : 1) : 1 }))}
                      title="Clique para ordenar · arraste para mudar a coluna de lugar"
                      style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 6, background: "transparent", border: 0, padding: 0, cursor: colPegada ? "grabbing" : "pointer", textAlign: "left", whiteSpace: "nowrap", font: `${on || alvo ? 600 : 400} 15px/1 Inter, sans-serif`, color: INK, opacity: pegada ? 0.35 : 1, boxShadow: alvo ? `0 3px 0 0 ${AMARELO}` : "none" }}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{COLUNAS[campo].label}</span>
                      <span style={{ flex: "none", font: "700 13.5px/1 Inter, sans-serif", color: on ? INK : "#d6d5d6" }}>{on ? (ordem.dir === 1 ? "↑" : "↓") : "↕"}</span>
                    </button>
                    {/* alça no meio do vão para a próxima coluna; a última não
                        tem vizinha para roubar espaço, então não ganha alça */}
                    {iCol < colunas.length - 1 && (
                      <span
                        onPointerDown={(e) => puxarLargura(e, campo)}
                        onDoubleClick={() => { const { [campo]: _fora, ...resto } = larguras; salvarColunas(colunas, resto); }}
                        onDragStart={(e) => e.preventDefault()}
                        title="Puxe para mudar a largura · dois cliques volta ao padrão"
                        style={{ position: "absolute", top: -18, bottom: -16, right: -AR_COLUNAS / 2 - 5, width: 10, cursor: "col-resize", display: "grid", placeItems: "center", touchAction: "none" }}
                      >
                        <span style={{ width: 2, height: 15, borderRadius: 1, background: larguras[campo] ? "#b3b1b3" : "#e0e0e0" }} />
                      </span>
                    )}
                  </span>
                );
              })}
              <span />
            </div>

            {vis.length === 0 && (
              <div style={{ flex: 1, display: "grid", placeItems: "center", font: "400 15px/1.4 Inter, sans-serif", color: "#8d8b8d", padding: "40px 0" }}>
                Nenhum pedido com esses filtros.
              </div>
            )}
            {vis.map((p, i) => {
              const s = STATUS_V1A[p.status];
              const on = linha === i;
              const atraso = p.dias < 0;
              const og = chipOrigem(p.origem);
              const aviso = avisoAlteracao(p.alteracoesAbertas, p.alteracaoDias);
              const celula: Record<ColunaId, ReactNode> = {
                num: <span key="num" style={{ font: `500 15px/1 ${MONO}`, color: "#5c5a5c" }}>{p.num}</span>,
                /* Pergunta esperando resposta aparece AQUI, na lista: dentro
                   da ficha só vê quem já abriu o pedido — foi assim que a
                   dúvida do #34 ficou dias parada sem ninguém saber. */
                cliente: (
                  <span key="cliente" style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    {p.perguntasAbertas > 0 && (
                      <span title={`${p.perguntasAbertas} ${p.perguntasAbertas === 1 ? "pergunta esperando resposta" : "perguntas esperando resposta"}`}
                        style={{ flex: "none", width: 8, height: 8, borderRadius: 999, background: AMARELO, boxShadow: "0 0 0 3px rgba(255,232,21,.35)" }} />
                    )}
                    {/* fica junto do ponto de pergunta: um lugar só para o olho
                        procurar o que está pendurado neste pedido */}
                    {aviso && (
                      <span title={aviso.titulo}
                        style={{ flex: "none", padding: "3px 7px 2px", borderRadius: 999, background: INK, color: AMARELO, font: "700 10.5px/1 Inter, sans-serif", letterSpacing: ".04em", whiteSpace: "nowrap" }}>
                        {aviso.rotulo}
                      </span>
                    )}
                    <span className="truncate" style={{ flex: 1, minWidth: 0, font: "600 16px/1.2 Inter, sans-serif", color: INK }}>{p.cliente}</span>
                  </span>
                ),
                medida: <span key="medida" style={{ font: "400 15px/1.2 Inter, sans-serif", color: "#5c5a5c" }}>{p.medida}</span>,
                substrato: <span key="substrato" className="truncate" style={{ font: "400 15px/1.2 Inter, sans-serif", color: "#5c5a5c" }}>{p.substrato}</span>,
                solicitacao: <span key="solicitacao" style={{ font: "400 13px/1 Inter, sans-serif", whiteSpace: "nowrap", color: "#8d8b8d" }}>{p.solicitacao}</span>,
                origem: <span key="origem" style={{ justifySelf: "start", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 8px 5px", borderRadius: 999, background: og.bg, color: og.fg }}>{og.label}</span>,
                status: <span key="status" style={{ justifySelf: "start", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 8px 5px", borderRadius: 999, background: s.bg, color: s.fg }}>{p.status}</span>,
                prazo: atraso && p.status !== "Finalizado" ? (
                  <span key="prazo" style={{ justifySelf: "start", font: "700 10px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", color: INK, background: AMARELO, padding: "7px 12px 5px", borderRadius: 999, minWidth: 78, textAlign: "center" }}>
                    há {Math.abs(p.dias)}d
                  </span>
                ) : (
                  <span key="prazo" style={{ font: "400 13px/1 Inter, sans-serif", whiteSpace: "nowrap", color: "#8d8b8d" }}>
                    {p.status === "Finalizado" ? "entregue" : p.prazo}
                  </span>
                ),
              };
              return (
                <div
                  key={p.raw.id}
                  className="r2row"
                  draggable={!!aoVoltarFila && !NA_FILA.includes(p.status)}
                  onDragStart={() => setArrastando(p.raw.id)}
                  onDragEnd={() => { setArrastando(null); setSobreFila(false); }}
                  title={!NA_FILA.includes(p.status) && aoVoltarFila ? "Arraste para os cartões acima para voltar à fila" : undefined}
                  onClick={() => { setLinha(i); onOpen(p.raw.id); }}
                  style={{ display: "grid", gridTemplateColumns: grade, alignItems: "center", gap: AR_COLUNAS, padding: compacto ? "6px 0" : "13px 0", cursor: "pointer", borderBottom: i === vis.length - 1 ? 0 : `1px solid ${FUNDO}`, background: on ? "#fafafa" : "transparent" }}
                >
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ width: 4, height: 26, borderRadius: 1, background: s.orelha }} />
                  </span>
                  {colunas.map((id) => celula[id])}
                  <span style={{ display: "grid", placeItems: "center" }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12" /><circle cx="12" cy="12" r="2.6" /></svg>
                  </span>
                </div>
              );
            })}

            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: `1px solid ${FUNDO}` }}>
              <span style={{ font: "400 15px/1 Inter, sans-serif", color: "#8d8b8d" }}>Mostrando 1–{vis.length} de {todos.length}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: FUNDO, borderRadius: 5, font: "600 15px/1 Inter, sans-serif", color: INK }}>‹</span>
                <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: INK, borderRadius: 5, font: "700 15px/1 Inter, sans-serif", color: AMARELO }}>1</span>
                <span style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: FUNDO, borderRadius: 5, font: "600 15px/1 Inter, sans-serif", color: INK }}>›</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </EstagioV1a>
  );
}
