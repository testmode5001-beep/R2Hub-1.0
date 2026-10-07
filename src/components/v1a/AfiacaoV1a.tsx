// Afiação — v1a. Fonte: design_handoff_r2_hub/telas/Afiacao.dc.html (frame 8a).
// Fluxo: enviar faca → fila "Em afiação" → "faca chegou" (estado bom/regular/
// ruim + valor) → tabela Recebidas; retorno ruim entra na fila de faca nova.
// Modo monitor via ?so=afiacao (só o painel Em afiação, sem chrome).
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { criarBusca } from "@/lib/busca";
import { valorOuZero } from "@/lib/valor";
import { FACAS } from "./dados/facas";
import { MEDIDAS, PDF_DE } from "./dados/facas-cilindro";
import { desenhoDaFaca, medidaValida } from "./dados/facas-desenho";
import {
  AMARELO, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";

const SUBSTRATOS = ["BOPP brilho", "BOPP fosco", "Térmico", "Couché", "Polietileno", "Cartão couché"];

const ESTADOS: Record<string, { label: string; bg: string; fg: string; paths: string[] }> = {
  bom: { label: "Bom", bg: "#d8ecd9", fg: "#1e5b2a", paths: ["M7 20.5V10.5l4.5-7 1.5 1.2v5.3h5.5a2 2 0 0 1 2 2.3l-1.2 6.2a2 2 0 0 1-2 1.6H7z", "M3.5 10.5H7v10H3.5z"] },
  regular: { label: "Regular", bg: "#f8ecc9", fg: "#7a5c00", paths: ["M4.5 12h15", "M8 7.5h8", "M8 16.5h8"] },
  ruim: { label: "Ruim", bg: "#f5d9d9", fg: "#8e2020", paths: ["M17 3.5v10l-4.5 7L11 19.3V14H5.5a2 2 0 0 1-2-2.3l1.2-6.2a2 2 0 0 1 2-1.6H17z", "M20.5 13.5H17v-10h3.5z"] },
};

type Registro = {
  /** id da linha em faca_afiacoes — só no modo real */
  id?: string;
  n: number; medida: string; substrato: string; envio: number; quem: string;
  /** "nova" = pedido de faca nova feito na mão; nunca foi para a afiação */
  status: "enviada" | "recebida" | "nova"; retorno?: number; recPor?: string;
  estado?: string; valor?: number; obs?: string; nova?: boolean;
  /** faca nova JÁ pedida ao fornecedor (coluna nova_pedida) */
  pedida?: boolean;
  /** datas reais; sem elas o protótipo calcula a partir de "dias atrás" */
  envioISO?: string; retornoISO?: string;
};

/** Linha de faca_afiacoes → Registro da tela. */
const diasDesde = (iso?: string | null) =>
  iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000)) : 0;

function daBase(f: Record<string, unknown>): Registro {
  const iso = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  return {
    id: String(f.id),
    n: Number(f.numero),
    medida: String(f.medida ?? ""),
    substrato: String(f.substrato ?? ""),
    envio: diasDesde(iso(f.created_at)),
    envioISO: iso(f.created_at),
    quem: String(f.user_nome ?? "—"),
    status: f.status === "recebida" ? "recebida" : f.status === "nova" ? "nova" : "enviada",
    retorno: iso(f.recebida_em) ? diasDesde(iso(f.recebida_em)) : undefined,
    retornoISO: iso(f.recebida_em),
    recPor: iso(f.recebida_por),
    estado: iso(f.estado),
    valor: f.valor != null ? Number(f.valor) : undefined,
    obs: iso(f.observacao) ?? "",
    nova: !!f.nova_solicitada,
    pedida: !!f.nova_pedida,
  };
}

/* semente do protótipo — envio/retorno são "dias atrás" */
const FACAS_SEMENTE: Registro[] = [
  { n: 41, medida: "59,5 × 40", substrato: "BOPP brilho", envio: 9, quem: "Marcos", status: "enviada" },
  { n: 40, medida: "80 × 60", substrato: "Térmico", envio: 6, quem: "Danilo", status: "enviada" },
  { n: 39, medida: "100 × 60", substrato: "Couché", envio: 3, quem: "Rafa", status: "enviada" },
  { n: 38, medida: "38,66 × 60", substrato: "BOPP fosco", envio: 1, quem: "Cleber", status: "enviada" },
  { n: 37, medida: "45 × 30", substrato: "Térmico", envio: 12, retorno: 4, quem: "Danilo", recPor: "Marcos", status: "recebida", estado: "bom", valor: 180, obs: "" },
  { n: 36, medida: "70 × 50", substrato: "BOPP brilho", envio: 15, retorno: 6, quem: "Rafa", recPor: "Danilo", status: "recebida", estado: "regular", valor: 240, obs: "Fio irregular no canto direito." },
  { n: 35, medida: "110 × 80", substrato: "Polietileno", envio: 19, retorno: 9, quem: "Marcos", recPor: "Rafa", status: "recebida", estado: "ruim", valor: 260, obs: "Faca abriu no vinco. Não segura mais registro.", nova: true },
  { n: 34, medida: "50 × 40", substrato: "Couché", envio: 22, retorno: 12, quem: "Danilo", recPor: "Cleber", status: "recebida", estado: "bom", valor: 165, obs: "" },
  { n: 33, medida: "90 × 60", substrato: "Cartão couché", envio: 26, retorno: 16, quem: "Cleber", recPor: "Danilo", status: "recebida", estado: "bom", valor: 210, obs: "" },
  { n: 32, medida: "60 × 40", substrato: "Térmico", envio: 30, retorno: 21, quem: "Rafa", recPor: "Marcos", status: "recebida", estado: "regular", valor: 195, obs: "Reafiar em 3 meses." },
  { n: 31, medida: "75 × 45", substrato: "BOPP fosco", envio: 34, retorno: 25, quem: "Danilo", recPor: "Danilo", status: "recebida", estado: "ruim", valor: 250, obs: "Serrilha gasta.", nova: true },
  { n: 30, medida: "80 × 60", substrato: "Térmico", envio: 46, retorno: 38, quem: "Marcos", recPor: "Danilo", status: "recebida", estado: "bom", valor: 175, obs: "" },
  { n: 29, medida: "59,5 × 40", substrato: "BOPP brilho", envio: 52, retorno: 44, quem: "Rafa", recPor: "Marcos", status: "recebida", estado: "regular", valor: 230, obs: "Leve rebarba na emenda." },
  { n: 28, medida: "45 × 30", substrato: "Couché", envio: 58, retorno: 49, quem: "Cleber", recPor: "Rafa", status: "recebida", estado: "bom", valor: 160, obs: "" },
  { n: 27, medida: "100 × 60", substrato: "Polietileno", envio: 66, retorno: 57, quem: "Danilo", recPor: "Cleber", status: "recebida", estado: "bom", valor: 255, obs: "" },
  { n: 26, medida: "80 × 60", substrato: "BOPP brilho", envio: 74, retorno: 66, quem: "Marcos", recPor: "Danilo", status: "recebida", estado: "ruim", valor: 245, obs: "Perdeu o corte no meio.", nova: true },
  { n: 25, medida: "70 × 50", substrato: "Térmico", envio: 80, retorno: 71, quem: "Rafa", recPor: "Rafa", status: "recebida", estado: "bom", valor: 185, obs: "" },
];

/** Chave da medida: "100 × 140", "100x140", "100 x 140 mm" viram a mesma coisa.
    A ordem conta — 100×140 não é a mesma faca que 140×100. */
const chaveMedida = (t: string) => MEDIDAS(t).slice(0, 2).join("x");
const mm = (n: number) => String(n).replace(".", ",") + " mm";

/** PNG do desenho técnico já baixado, por código — a mesma faca não é buscada
    duas vezes enquanto a tela estiver aberta. "" = não existe desenho no acervo. */
const MINI_FACA = new Map<string, string>();

const CH_REG = "r2.afiacao.registros.v1";
const CH_PEDIDAS = "r2.afiacao.pedidas.v1";

function lerLS<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;
  try {
    const cru = localStorage.getItem(chave);
    if (cru) {
      const v = JSON.parse(cru);
      if (v !== null && v !== undefined) return v as T;
    }
  } catch { /* corrompido → padrão */ }
  return padrao;
}
const gravarLS = (chave: string, v: unknown) => { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* indisponível */ } };

const num = (n: number) => "#" + String(n).padStart(4, "0");
const brlNum = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const diasTexto = (d: number) => (d <= 0 ? "hoje" : d === 1 ? "há 1 dia" : `há ${d} dias`);
const menos = (dias: number) => new Date(Date.now() - dias * 86_400_000);
/** data real quando existe; senão a reconstruída pelos "dias atrás" do protótipo */
const quando = (iso: string | undefined, dias: number) => (iso ? new Date(iso) : menos(dias));
const dataBR = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const dataHora = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

/* últimos 3 meses (chips Mai/Jun/Jul do protótipo, dinâmicos).
   A chave é ANO-MÊS, não o número do mês: só com o mês, em janeiro a janela
   pega nov/dez e passaria a contar também o nov/dez do ano passado. */
const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const MESES = [2, 1, 0].map((atras) => {
  const d = new Date();
  d.setDate(1);                       // dia 1 antes de voltar o mês: em 31/03, setMonth(-1) cairia em março de novo
  d.setMonth(d.getMonth() - atras);
  const l = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return { l: l.charAt(0).toUpperCase() + l.slice(1), m: chaveMes(d) };
});

export function AfiacaoV1a({
  profile, versao, aoNavegar, onNova, onLogout, disponiveis, children,
  facas: facasReais, substratos: substratosReais, podeEditar = true, podeVerCusto = true,
  aoEnviarFaca, aoReceberFaca, aoAddSubstrato, aoMarcarPedida, aoSolicitarNova, aoMiniatura,
}: {
  profile: { nome: string; role?: string };
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
  /** linhas de faca_afiacoes; ausente = protótipo com dados de exemplo */
  facas?: Record<string, unknown>[];
  substratos?: string[];
  podeEditar?: boolean;
  /** faca.custo_ver — sem isso, nenhum valor em R$ aparece na tela */
  podeVerCusto?: boolean;
  aoEnviarFaca?: (medida: string, substrato: string) => Promise<unknown>;
  aoReceberFaca?: (d: {
    id: string; estado: string; solicitarNova: boolean; observacao: string; valor: number | null;
    /** quem recebeu no balcão (digitado — o PC da fábrica é compartilhado) */
    recebidaPor?: string;
  }) => Promise<unknown>;
  aoAddSubstrato?: (nome: string) => Promise<unknown>;
  /** marca que a faca nova já foi pedida ao fornecedor (fila compartilhada) */
  aoMarcarPedida?: (id: string, pedida: boolean) => Promise<unknown>;
  /** pedido de faca nova feito na mão (quebrou, sumiu, medida que não existe) */
  aoSolicitarNova?: (d: { medida: string; substrato: string; motivo: string }) => Promise<unknown>;
  /** desenho técnico (PNG) do acervo — o mesmo da tela Facas */
  aoMiniatura?: (arquivo: string) => Promise<string>;
}) {
  const real = Array.isArray(facasReais);
  /** Quem não tem faca.custo_ver não vê valor nenhum — nem em cartão, nem em tabela. */
  const brl = (v: number) => (podeVerCusto ? brlNum(v) : "—");
  const soPainel = typeof window !== "undefined" && /(\?|&)so=afiacao/.test(window.location.search);
  const comChrome = !soPainel;

  const [buscaTopo, setBuscaTopo] = useState("");
  const [registrosDemo, setRegistrosDemo] = useState<Registro[]>(() => lerLS(CH_REG, FACAS_SEMENTE));
  const registros = useMemo(
    () => (facasReais ? facasReais.map(daBase) : registrosDemo),
    [facasReais, registrosDemo],
  );
  const [novasPedidas, setNovasPedidas] = useState<number[]>(() => lerLS(CH_PEDIDAS, [] as number[]));
  const [situacao, setSituacao] = useState("Todas");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const [mes, setMes] = useState(MESES[2].m);
  const [mesMedidas, setMesMedidas] = useState(MESES[2].m);
  const [pagina, setPagina] = useState(1);
  const [ordem, setOrdem] = useState<{ campo: string; asc: boolean }>({ campo: "num", asc: false });
  // modal enviar
  const [envioAberto, setEnvioAberto] = useState(false);
  // modal pedir faca nova (sem passar pela afiação)
  const [novaAberto, setNovaAberto] = useState(false);
  const [nnMedida, setNnMedida] = useState("");
  const [nnSubstrato, setNnSubstrato] = useState("");
  const [nnMotivo, setNnMotivo] = useState("");
  /* A medida escrita vira desenho, e o catálogo mostra as facas com a mesma
     medida — quem pede a faca nova confere o formato sem sair da tela. */
  type FacaCat = { cod: string; medida: string; sistema: string; secao: string; arquivo?: string };
  /* O catálogo de verdade é a Relação de Ferramentais (a equipe mantém à mão);
     a lista embutida entra só com o que ela não tem. Sem isso, faca cadastrada
     esta semana não apareceria aqui — foi exatamente o que aconteceu com a
     FAC0274.01. Carrega quando o modal abre, não no carregamento da tela. */
  const [catalogo, setCatalogo] = useState<FacaCat[]>(() => FACAS as FacaCat[]);
  const buscouCatalogo = useRef(false);
  useEffect(() => {
    if (!novaAberto || buscouCatalogo.current) return;
    buscouCatalogo.current = true;
    void import("@/lib/api/facas.functions")
      .then((m) => m.listRelacaoFacas())
      .then((r) => {
        const rel = ((r as { facas?: FacaCat[] }).facas ?? []);
        if (!rel.length) return;
        const tem = new Set(rel.map((f) => f.cod.toUpperCase()));
        setCatalogo(rel.concat((FACAS as FacaCat[]).filter((f) => !tem.has(f.cod.toUpperCase()))));
      })
      .catch(() => { /* sem a Relação vale a lista embutida */ });
  }, [novaAberto]);

  /** "100×140" e "100x140" são a mesma medida — o catálogo usa o × tipográfico. */
  const mesmoX = (t: string) => String(t || "").replace(/×/g, "x");
  const nnChave = chaveMedida(nnMedida);
  const parecidasNoCatalogo = useMemo(() => {
    const termo = mesmoX(nnMedida).trim();
    if (termo.length < 2) return [] as FacaCat[];
    const casa = criarBusca(termo);
    const achadas = catalogo.filter((f) => casa(mesmoX(f.medida), f.cod));
    /* a faca com a medida exata vem primeiro: é a que interessa */
    const alvo = chaveMedida(nnMedida);
    return achadas
      .sort((a, b) => Number(chaveMedida(b.medida) === alvo) - Number(chaveMedida(a.medida) === alvo))
      .slice(0, 5);
  }, [nnMedida, catalogo]);
  const facaDoCatalogo = parecidasNoCatalogo.find((f) => chaveMedida(f.medida) === nnChave) ?? parecidasNoCatalogo[0] ?? null;
  /** É a mesma medida, não só parecida — muda o texto do painel. */
  const catalogoExato = !!facaDoCatalogo && chaveMedida(facaDoCatalogo.medida) === nnChave && !!nnChave;
  /* O que o hub JÁ tem dessa medida: afiações antigas, último estado, substratos
     usados e pedido de faca nova já na fila (evita pedir duas vezes). */
  const noHub = useMemo(() => {
    if (!nnChave) return null;
    const iguais = registros.filter((f) => chaveMedida(f.medida) === nnChave);
    if (!iguais.length) return null;
    const passaram = iguais.filter((f) => f.status !== "nova");
    const ultima = passaram
      .filter((f) => f.status === "recebida")
      .sort((a, b) => (a.retorno ?? 0) - (b.retorno ?? 0))[0] ?? null;
    const conta: Record<string, number> = {};
    iguais.forEach((f) => { if (f.substrato) conta[f.substrato] = (conta[f.substrato] || 0) + 1; });
    return {
      total: passaram.length,
      emAfiacao: iguais.filter((f) => f.status === "enviada").length,
      ultima,
      naFila: iguais.find((f) => f.status === "nova" || f.nova) ?? null,
      subs: Object.keys(conta).sort((a, b) => conta[b] - conta[a]),
    };
  }, [nnChave, registros]);
  /* Desenha a medida digitada; se ainda só tem o código, desenha a do catálogo. */
  const nnNums = MEDIDAS(nnMedida).slice(0, 2);
  const desenhoMedida = nnNums.length >= 2 ? nnMedida : facaDoCatalogo?.medida ?? "";
  const desenhoNums = MEDIDAS(desenhoMedida).slice(0, 2);
  const temDesenho = desenhoNums.length >= 2 && medidaValida(desenhoMedida);
  /* Desenho DE VERDADE: quando a medida bate com uma faca do catálogo, busca o
     mesmo PNG que a tela Facas mostra (acervo da rede). Só na medida exata —
     numa faca só "parecida" o desenho real enganaria. */
  const facaExata = catalogoExato ? facaDoCatalogo : null;
  const [mini, setMini] = useState("");
  useEffect(() => {
    if (!novaAberto || !facaExata || !aoMiniatura) { setMini(""); return; }
    const guardada = MINI_FACA.get(facaExata.cod);
    if (guardada !== undefined) { setMini(guardada); return; }
    let vivo = true;
    /* o nome do arquivo vem do mapa da migração, da Relação ou do próprio
       código — a mesma ordem que a tela Facas usa */
    const nomes = [...new Set([
      PDF_DE(facaExata.cod).replace(/^facas\//, ""),
      facaExata.arquivo ?? "",
      facaExata.cod + ".pdf",
    ].filter(Boolean))];
    void (async () => {
      for (const arq of nomes) {
        try {
          const png = await aoMiniatura(arq);
          MINI_FACA.set(facaExata.cod, png);
          if (vivo) setMini(png);
          return;
        } catch { /* não é esse arquivo: tenta o próximo nome */ }
      }
      MINI_FACA.set(facaExata.cod, "");   // sem desenho no acervo: não tenta de novo
      if (vivo) setMini("");
    })();
    return () => { vivo = false; };
  }, [novaAberto, facaExata, aoMiniatura]);
  const [novaMedida, setNovaMedida] = useState("");
  const [novoSubstrato, setNovoSubstrato] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [subNovo, setSubNovo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // modal receber
  const [receberN, setReceberN] = useState<number | null>(null);
  const [recEstado, setRecEstado] = useState("");
  const [recValor, setRecValor] = useState("");
  const [recObs, setRecObs] = useState("");
  const [recPor, setRecPor] = useState(() => String(profile.nome || "").trim().split(/\s+/)[0] || "");
  const [recNova, setRecNova] = useState(false);

  const gravarRegistros = (r: Registro[]) => { setRegistrosDemo(r); gravarLS(CH_REG, r); };
  /* A fila "faca nova pedida ao fornecedor" não tem coluna no banco — fica local
     em qualquer modo, marcada pelo número da faca. */
  const gravarPedidas = (p: number[]) => { setNovasPedidas(p); gravarLS(CH_PEDIDAS, p); };
  /** No modo real quem manda é a coluna nova_pedida (fila compartilhada);
      no protótipo, a lista local de números. */
  const jaPedida = (f: Registro) => (real ? !!f.pedida : novasPedidas.includes(f.n));

  const listaSubstratos = real ? (substratosReais ?? []) : SUBSTRATOS.concat(extras);

  const filtradas = () => {
    const casa = criarBusca(busca);
    return registros.filter((f) => {
      /* pedido de faca nova não é envio nem recebimento: vive só na fila */
      if (f.status === "nova") return false;
      if (situacao === "Em afiação" && f.status !== "enviada") return false;
      if (situacao === "Recebidas" && f.status !== "recebida") return false;
      if (estadoFiltro !== "Todos") {
        const e = f.estado ? ESTADOS[f.estado] : null;
        if (!e || e.label.toLowerCase() !== estadoFiltro.toLowerCase()) return false;
      }
      return casa(num(f.n), f.medida, f.substrato, f.quem, f.recPor || "", f.obs || "", f.estado ? ESTADOS[f.estado]?.label ?? "" : "");
    });
  };

  const lista = filtradas();
  const emAfiacao = lista.filter((f) => f.status === "enviada").sort((a, b) => b.envio - a.envio);
  const recebidasBase = lista.filter((f) => f.status === "recebida");
  const atrasadas = registros.filter((f) => f.status === "enviada" && f.envio >= 7);
  const novas = registros.filter((f) => f.nova);
  const recebidasMes = registros.filter((f) => f.status === "recebida" && chaveMes(quando(f.retornoISO, f.retorno ?? 0)) === mes);
  const custo = recebidasMes.reduce((s, f) => s + (f.valor || 0), 0);
  const mesLabel = (MESES.find((m) => m.m === mes) || MESES[2]).l;
  const sel = receberN !== null ? registros.find((f) => f.n === receberN) : null;

  const chaveOrd = (f: Registro): string | number => ({
    num: f.n,
    medida: parseFloat(String(f.medida).replace(",", ".")) || 0,
    substrato: f.substrato,
    estado: f.estado ? ESTADOS[f.estado]?.label ?? "" : "",
    valor: f.valor || 0,
    datas: -(f.retorno ?? 0),
    obs: f.obs || "",
  } as Record<string, string | number>)[ordem.campo];
  const ordenadas = [...recebidasBase].sort((a, b) => {
    const va = chaveOrd(a), vb = chaveOrd(b);
    if (typeof va === "string") return ordem.asc ? va.localeCompare(vb as string, "pt-BR") : (vb as string).localeCompare(va, "pt-BR");
    return ordem.asc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });
  const PP = 9;
  const totalPag = Math.max(1, Math.ceil(ordenadas.length / PP));
  const pag = Math.min(pagina, totalPag);
  const recebidas = ordenadas.slice((pag - 1) * PP, pag * PP);

  const porSub: Record<string, number> = {};
  recebidasMes.forEach((f) => { porSub[f.substrato] = (porSub[f.substrato] || 0) + (f.valor || 0); });
  const maxSub = Math.max(1, ...Object.values(porSub));

  const medidasMes = registros.filter((f) => f.status === "recebida" && chaveMes(quando(f.retornoISO, f.retorno ?? 0)) === mesMedidas);
  const mesMedidasLabel = (MESES.find((m) => m.m === mesMedidas) || MESES[2]).l;
  const porMedida: Record<string, { qtd: number; total: number; ruim: number }> = {};
  medidasMes.forEach((f) => {
    const m = porMedida[f.medida] || (porMedida[f.medida] = { qtd: 0, total: 0, ruim: 0 });
    m.qtd += 1;
    m.total += f.valor || 0;
    if (f.estado === "ruim") m.ruim += 1;
  });
  const maxMedidaQtd = Math.max(1, ...Object.keys(porMedida).map((k) => porMedida[k].qtd));

  const proximoNumero = registros.length ? Math.max(...registros.map((f) => f.n)) + 1 : 1;

  /* Pedido de faca nova na mão: entra direto na fila de compra, sem fingir que
     passou pela afiação (status "nova"). */
  function solicitarNova() {
    if (!nnMedida.trim() || !nnSubstrato || ocupado) return;
    const limpar = () => { setNnMedida(""); setNnSubstrato(""); setNnMotivo(""); setNovaAberto(false); };
    if (real) {
      if (!aoSolicitarNova) return;
      setOcupado(true);
      aoSolicitarNova({ medida: nnMedida.trim(), substrato: nnSubstrato, motivo: nnMotivo.trim() })
        .then(() => { limpar(); setAviso("Faca nova solicitada. Está na fila de compra."); })
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para registrar o pedido."))
        .finally(() => setOcupado(false));
      return;
    }
    const n = proximoNumero;
    gravarRegistros([{ n, medida: nnMedida.trim(), substrato: nnSubstrato, envio: 0, quem: recPor || "—", status: "nova", nova: true, obs: nnMotivo.trim() }, ...registros]);
    limpar();
    setAviso(`Faca nova ${num(n)} solicitada. Está na fila de compra.`);
  }

  function enviarFaca() {
    if (!novaMedida.trim() || !novoSubstrato || ocupado) return;
    if (real) {
      if (!aoEnviarFaca) return;
      setOcupado(true);
      aoEnviarFaca(novaMedida.trim(), novoSubstrato)
        .then(() => {
          setNovaMedida(""); setNovoSubstrato(""); setEnvioAberto(false);
          setAviso("Faca registrada, aguardando retorno da afiação.");
        })
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para registrar o envio."))
        .finally(() => setOcupado(false));
      return;
    }
    const n = proximoNumero;
    gravarRegistros([{ n, medida: novaMedida.trim(), substrato: novoSubstrato, envio: 0, quem: recPor || "—", status: "enviada" }, ...registros]);
    setNovaMedida(""); setNovoSubstrato(""); setEnvioAberto(false);
    setAviso(`Faca ${num(n)} registrada, aguardando retorno da afiação.`);
  }

  function adicionarSubstrato() {
    const nome = (subNovo ?? "").trim();
    if (!nome || ocupado) return;
    if (real) {
      if (!aoAddSubstrato) return;
      setOcupado(true);
      aoAddSubstrato(nome)
        .then(() => { setNovoSubstrato(nome); setSubNovo(null); })
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para salvar a matéria-prima."))
        .finally(() => setOcupado(false));
      return;
    }
    setExtras([...extras, nome]);
    setNovoSubstrato(nome);
    setSubNovo(null);
  }

  function confirmarReceber() {
    if (!recEstado || receberN === null || ocupado) return;
    const valor = valorOuZero(recValor);
    const fechar = (n: number) => {
      setReceberN(null);
      setAviso(`Faca ${num(n)} recebida${recNova ? ". Solicitação de faca nova registrada." : " e registrada."}`);
    };
    if (real) {
      if (!sel?.id || !aoReceberFaca) return;
      setOcupado(true);
      aoReceberFaca({ id: sel.id, estado: recEstado, solicitarNova: recNova, observacao: recObs.trim(), valor: valor || null, recebidaPor: recPor.trim() })
        .then(() => fechar(receberN))
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para registrar a chegada."))
        .finally(() => setOcupado(false));
      return;
    }
    gravarRegistros(registros.map((f) => (f.n !== receberN ? f : {
      ...f, status: "recebida" as const, retorno: 0, estado: recEstado, valor, obs: recObs.trim(), nova: recNova, recPor,
    })));
    fechar(receberN);
  }

  const mesChip = (on: boolean): CSSProperties => ({ border: 0, cursor: "pointer", borderRadius: 999, padding: "7px 12px", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" });
  const inp: CSSProperties = { width: "100%", boxSizing: "border-box", background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 7, padding: "12px 14px", font: "600 15px/1.2 Inter,sans-serif", color: INK, outline: "none" };
  const rotulo: CSSProperties = { display: "block", font: "600 15px/1 Inter,sans-serif", color: "#5c5a5c", marginBottom: 8 };
  const gridRecebidas = "90px 1.1fr 1.1fr 110px 110px 1fr 1.3fr";

  const painelEmAfiacao = (
    <div style={{ minWidth: 0, ...(soPainel ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column" } : {}), background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Em afiação</span>
        <span style={{ font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: "#f1f1f1", color: "#5c5a5c", borderRadius: 999, padding: "7px 11px" }}>
          {emAfiacao.length} {emAfiacao.length === 1 ? "faca" : "facas"}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>clique em “faca chegou” para registrar o retorno</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {emAfiacao.map((f) => {
          const atrasada = f.envio >= 7;
          return (
            <div key={f.n} style={{ display: "flex", flexDirection: "column", background: "#fafafa", borderRadius: 10, borderLeft: `4px solid ${atrasada ? INK : AMARELO}`, padding: "16px 18px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ font: `600 14.5px/1 ${MONO}`, color: "#8d8b8d" }}>{num(f.n)}</span>
                <span style={{ flex: 1 }} />
                <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, whiteSpace: "nowrap", background: atrasada ? INK : AMARELO, color: atrasada ? AMARELO : INK }}>{diasTexto(f.envio)}</span>
              </div>
              <div style={{ ...fr(72, 700), fontSize: 32, lineHeight: 1, letterSpacing: "-.02em", color: INK, marginTop: 14 }}>{f.medida}</div>
              <div style={{ font: "500 15px/1.3 Inter,sans-serif", color: "#5c5a5c", marginTop: 9 }}>{f.substrato}</div>
              <div style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#b3b1b3", marginTop: 5 }}>Enviada {dataBR(quando(f.envioISO, f.envio))} · {f.quem}</div>
              <button type="button" className="r2chip" onClick={() => { setReceberN(f.n); setRecEstado(""); setRecValor(""); setRecObs(""); setRecNova(false); }}
                style={{ display: podeEditar ? "flex" : "none", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 16, background: INK, border: 0, borderRadius: 7, padding: 13, cursor: "pointer", font: "700 15px/1 Inter,sans-serif", color: AMARELO }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 3.5v11" /><path d="m8 10.5 4 4 4-4" /><path d="M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16" /></svg>
                <span style={{ lineHeight: "16px" }}>Faca chegou</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <EstagioV1a>
      {comChrome && (
        <TopbarV1a
          nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""}
          busca={buscaTopo}
          aoBuscar={setBuscaTopo}
         
          onSair={onLogout}
        />
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: comChrome ? 14 : 0 }}>
        {comChrome && <RailV1a ativo="Afiação" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />}

        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {comChrome && (
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "0 6px 14px" }}>
              <div>
                <h1 style={{ ...fr(144, 900), fontSize: 56, lineHeight: 1, letterSpacing: "-.02em", textIndent: "-.045em", whiteSpace: "nowrap", color: INK, margin: 0 }}>Afiação</h1>
                <div style={{ font: "400 17px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>
                  {emAfiacao.length} {emAfiacao.length === 1 ? "faca fora" : "facas fora"} · {atrasadas.length} há mais de 7 dias · {novas.length} aguardando faca nova
                </div>
              </div>
              <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" className="r2chip" title="Abrir apenas o painel Em afiação numa nova aba"
                  onClick={() => {
                    try {
                      window.open(window.location.href + (window.location.search ? "&" : "?") + "so=afiacao", "_blank");
                    } catch { /* pop-up bloqueado */ }
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: 0, borderRadius: 7, padding: "16px 20px", cursor: "pointer", font: "600 15px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap", boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M13.5 4.5h6v6" /><path d="M19.5 4.5 11 13" /><path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" /></svg>
                  <span style={{ lineHeight: "16px" }}>Painel em nova aba</span>
                </button>
                <button type="button" className="r2chip" title="Pedir uma faca nova sem passar pela afiação" onClick={() => setNovaAberto(true)} hidden={!podeEditar}
                  style={{ display: podeEditar ? "flex" : "none", alignItems: "center", gap: 9, background: "#fff", border: 0, borderRadius: 7, padding: "16px 20px", cursor: "pointer", font: "600 15px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap", boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                  <span style={{ lineHeight: "16px" }}>Solicitar faca nova</span>
                </button>
                <button type="button" className="r2chip" onClick={() => setEnvioAberto(true)} hidden={!podeEditar}
                  style={{ display: podeEditar ? "flex" : "none", alignItems: "center", gap: 10, background: AMARELO, border: 0, borderRadius: 7, padding: "16px 22px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M6.5 6.5 20 20" /><path d="M20 4 10.5 13.5" /><path d="M6 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" /><path d="M6 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" /></svg>
                  <span style={{ lineHeight: "18px" }}>Enviar faca para afiação</span>
                </button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
            {comChrome && (
              <div style={{ flex: "0 0 320px", width: 320, maxWidth: 320, minWidth: 0, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" className="r2chip" title="Ver as facas em afiação" onClick={() => { setSituacao("Em afiação"); setEstadoFiltro("Todos"); setBusca(""); }}
                    style={{ flex: 1, textAlign: "left", border: 0, cursor: "pointer", background: AMARELO, borderRadius: 12, padding: "18px 18px 16px", boxShadow: situacao === "Em afiação" ? `0 0 0 3px ${INK}` : "none" }}>
                    <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: INK }}>{registros.filter((f) => f.status === "enviada").length}</div>
                    <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", color: INK, letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Em afiação</div>
                  </button>
                  <button type="button" className="r2chip" title="Ver as facas há mais de 7 dias fora" onClick={() => { setSituacao("Em afiação"); setEstadoFiltro("Todos"); setBusca(""); }}
                    style={{ flex: 1, textAlign: "left", border: 0, cursor: "pointer", background: INK, borderRadius: 12, padding: "18px 18px 16px" }}>
                    <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: "#f1f1f1" }}>{atrasadas.length}</div>
                    <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", color: "#b3b1b3", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Mais de 7 dias</div>
                  </button>
                  <button type="button" className="r2chip" title="Ver a fila de facas novas" onClick={() => { setSituacao("Todas"); setEstadoFiltro("Ruim"); setBusca(""); }}
                    style={{ flex: 1, textAlign: "left", border: 0, cursor: "pointer", background: "#fff", borderRadius: 12, padding: "18px 18px 16px", boxShadow: `${estadoFiltro === "Ruim" ? `0 0 0 3px ${INK},` : ""}0 1px 0 rgba(0,0,0,.04),0 20px 40px -30px rgba(0,0,0,.25)` }}>
                    <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: INK }}>{novas.length}</div>
                    <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", color: "#8d8b8d", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Faca nova</div>
                  </button>
                </div>

                {/* custo de afiação — só para quem tem faca.custo_ver */}
                <div style={{ display: podeVerCusto ? "block" : "none", minWidth: 0, background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14, minWidth: 0 }}>
                    <span style={{ flex: "1 1 auto", minWidth: 0, font: "700 12.5px/1.2 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Custo de afiação</span>
                    <div style={{ display: "flex", flex: "none", gap: 5 }}>
                      {MESES.map((m) => (
                        <button key={m.m} type="button" className="r2chip" onClick={() => setMes(m.m)} style={mesChip(mes === m.m)}>{m.l}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                    <span style={{ ...fr(96, 700), fontSize: 40, lineHeight: 1, letterSpacing: "-.03em", color: INK }}>{brl(custo)}</span>
                    <span style={{ font: "600 15px/1 Inter,sans-serif", color: "#8d8b8d", paddingBottom: 5 }}>
                      em {recebidasMes.length}{recebidasMes.length === 1 ? " afiação · " : " afiações · "}{mesLabel}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 18 }}>
                    {Object.keys(porSub).sort((a, b) => porSub[b] - porSub[a]).slice(0, 5).map((nome) => (
                      <div key={nome}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                          <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.2 Inter,sans-serif", color: "#5c5a5c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
                          <span style={{ font: `700 14.5px/1 ${MONO}`, color: INK, whiteSpace: "nowrap" }}>{brl(porSub[nome])}</span>
                        </div>
                        <div style={{ height: 9, borderRadius: 999, background: "#f1f1f1", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.round((porSub[nome] / maxSub) * 100)}%`, borderRadius: 999, background: AMARELO }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* medidas afiadas */}
                <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14, minWidth: 0 }}>
                    <span style={{ flex: "1 1 auto", minWidth: 0, font: "700 12.5px/1.2 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Medidas afiadas</span>
                    <div style={{ display: "flex", flex: "none", gap: 5 }}>
                      {MESES.map((m) => (
                        <button key={m.m} type="button" className="r2chip" onClick={() => setMesMedidas(m.m)} style={mesChip(mesMedidas === m.m)}>{m.l}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#b3b1b3", margin: "-6px 0 14px" }}>
                    {medidasMes.length ? `${medidasMes.length}${medidasMes.length === 1 ? " afiação em " : " afiações em "}${mesMedidasLabel}` : `nenhuma afiação em ${mesMedidasLabel}`}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {Object.keys(porMedida).sort((a, b) => porMedida[b].qtd - porMedida[a].qtd || porMedida[b].total - porMedida[a].total).slice(0, 4).map((nome) => {
                      const m = porMedida[nome];
                      return (
                        <div key={nome}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                            <span style={{ flex: 1, minWidth: 0, font: "700 15px/1.2 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</span>
                            <span style={{ font: `700 14.5px/1 ${MONO}`, color: INK, whiteSpace: "nowrap" }}>{brl(m.total)}</span>
                          </div>
                          <div style={{ height: 9, borderRadius: 999, background: "#f1f1f1", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.round((m.qtd / maxMedidaQtd) * 100)}%`, borderRadius: 999, background: m.ruim > 0 ? INK : AMARELO }} />
                          </div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
                            <span style={{ flex: 1, minWidth: 0, font: "500 14px/1.2 Inter,sans-serif", color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.qtd}{m.qtd === 1 ? " afiação" : " afiações"} · média {brl(m.total / m.qtd)}
                            </span>
                            {m.ruim > 0 && (
                              <span style={{ flex: "none", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: INK, color: AMARELO, borderRadius: 999, padding: "6px 10px 5px", whiteSpace: "nowrap" }}>
                                {m.ruim} retorno(s) ruim
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ font: "400 14.5px/1.45 Inter,sans-serif", color: "#b3b1b3", marginTop: 16 }}>
                    Facas com estado <strong style={{ color: "#5c5a5c" }}>ruim</strong> entram na fila de faca nova automaticamente quando marcadas no retorno.
                  </div>
                </div>
              </div>
            )}

            {/* coluna direita */}
            <div style={{ flex: "1 1 auto", minHeight: 0, overflow: soPainel ? "hidden" : "auto", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
              {aviso && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, background: AMARELO, borderRadius: 8, padding: "14px 18px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
                  <span style={{ flex: 1, font: "600 15px/1.3 Inter,sans-serif", color: INK }}>{aviso}</span>
                  <button type="button" onClick={() => setAviso("")} style={{ width: 26, height: 26, flex: "none", display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 6, cursor: "pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
              )}

              {comChrome && (
                <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#fff", borderRadius: 10, padding: "11px 14px" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["Todas", "Em afiação", "Recebidas"].map((nome) => {
                      const on = situacao === nome;
                      const conta = nome === "Todas" ? registros.length : nome === "Em afiação" ? registros.filter((f) => f.status === "enviada").length : registros.filter((f) => f.status === "recebida").length;
                      return (
                        <button key={nome} type="button" className="r2chip" onClick={() => setSituacao(nome)}
                          style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 7, padding: "11px 14px", cursor: "pointer", whiteSpace: "nowrap", font: "600 15px/1 Inter,sans-serif", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                          <span style={{ lineHeight: "15px" }}>{nome}</span>
                          <span style={{ font: "800 13.5px/1 Inter,sans-serif", padding: "5px 8px", borderRadius: 999, background: on ? AMARELO : "#fff", color: INK }}>{conta}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ flex: "none", width: 2, height: 28, background: "#f1f1f1", borderRadius: 999 }} />
                  <span style={{ flex: "none", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Estado</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["Todos", "Bom", "Regular", "Ruim"].map((nome) => {
                      const on = estadoFiltro === nome;
                      return (
                        <button key={nome} type="button" className="r2chip" onClick={() => setEstadoFiltro(nome)}
                          style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                          {nome}
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>Custo total no período: {brl(ordenadas.reduce((s, f) => s + (f.valor || 0), 0))}</span>
                </div>
              )}

              {emAfiacao.length > 0 && painelEmAfiacao}

              {comChrome && (
                <div style={{ minWidth: 0, background: INK, borderRadius: 12, padding: "20px 22px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                    <span style={{ font: "800 19px/1 Inter,sans-serif", color: "#f1f1f1", letterSpacing: "-.01em" }}>Fila de facas novas</span>
                    <span style={{ flex: "none", whiteSpace: "nowrap", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: AMARELO, color: INK, borderRadius: 999, padding: "7px 11px" }}>
                      {novas.length}{novas.length === 1 ? " faca · " : " facas · "}{novas.length - novas.filter(jaPedida).length} a pedir
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>retorno ruim entra aqui automaticamente</span>
                    {podeEditar && (
                      <button type="button" className="r2chip" onClick={() => setNovaAberto(true)}
                        style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, border: 0, cursor: "pointer", borderRadius: 999, padding: "8px 13px", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: AMARELO, color: INK, whiteSpace: "nowrap" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                        Solicitar faca nova
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 12, overflowX: "auto", overflowY: "hidden", paddingBottom: 4 }}>
                    {novas.map((f) => {
                      const pedida = jaPedida(f);
                      return (
                        <div key={f.n} style={{ flex: "0 0 268px", height: 196, display: "flex", flexDirection: "column", minWidth: 0, background: "#2f2d2f", border: 0, borderLeft: `3px solid ${pedida ? AMARELO : "#8d8b8d"}`, borderRadius: 8, padding: "14px 15px 13px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                            <span style={{ font: `500 13px/1 ${MONO}`, color: "#8d8b8d" }}>{num(f.n)}</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", borderRadius: 999, padding: "6px 11px 5px", whiteSpace: "nowrap", background: pedida ? AMARELO : "#454345", color: pedida ? INK : "#c9c8c9" }}>
                              {pedida ? "Pedida" : "Aguardando pedido"}
                            </span>
                          </div>
                          <div style={{ ...fr(72, 700), fontSize: 26, lineHeight: 1, letterSpacing: "-.02em", color: "#f1f1f1" }}>{f.medida}</div>
                          <div style={{ font: "500 14px/1.3 Inter,sans-serif", color: "#b3b1b3", marginTop: 8 }}>{f.substrato}</div>
                          <div style={{ flex: 1, minHeight: 0, font: "400 13.5px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {f.obs || (f.status === "nova" ? "Pedido direto, sem passar pela afiação." : "Retorno ruim na afiação.")}
                          </div>
                          <button type="button" className="r2chip"
                            onClick={() => {
                              const dentro = jaPedida(f);
                              if (real && f.id && aoMarcarPedida) {
                                void aoMarcarPedida(f.id, !dentro)
                                  .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para registrar o pedido."));
                              } else {
                                gravarPedidas(dentro ? novasPedidas.filter((x) => x !== f.n) : [...novasPedidas, f.n]);
                              }
                              setAviso(dentro ? `Pedido da faca ${num(f.n)} cancelado.` : `Faca nova ${num(f.n)} pedida ao fornecedor.`);
                            }}
                            style={{ flex: "none", marginTop: 12, border: 0, borderRadius: 7, padding: "11px 13px", cursor: "pointer", font: "700 13px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: pedida ? "#454345" : AMARELO, color: pedida ? "#f1f1f1" : INK }}>
                            {pedida ? "Cancelar pedido" : "Pedir faca nova"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {novas.length === 0 && (
                    <div style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
                      Nenhuma faca na fila. Marque um retorno como <strong style={{ color: "#f1f1f1" }}>ruim</strong>, ou use <strong style={{ color: "#f1f1f1" }}>Solicitar faca nova</strong> quando a faca quebrou, sumiu ou ainda não existe.
                    </div>
                  )}
                </div>
              )}

              {comChrome && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "20px 22px 16px", boxShadow: SOMBRA_CARD }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Recebidas</span>
                    <span style={{ font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: "#f1f1f1", color: "#5c5a5c", borderRadius: 999, padding: "7px 11px" }}>
                      {ordenadas.length} {ordenadas.length === 1 ? "faca" : "facas"}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>Custo total no período: {brl(ordenadas.reduce((s, f) => s + (f.valor || 0), 0))}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: gridRecebidas, gap: 10, padding: "0 8px 9px", borderBottom: "2px solid #f1f1f1" }}>
                    {[
                      { campo: "num", label: "Nº" },
                      { campo: "medida", label: "Medida" },
                      { campo: "substrato", label: "Substrato" },
                      { campo: "estado", label: "Estado" },
                      { campo: "valor", label: "Valor" },
                      { campo: "datas", label: "Envio · retorno" },
                      { campo: "obs", label: "Observação" },
                    ].map((c) => {
                      const on = ordem.campo === c.campo;
                      return (
                        <button key={c.campo} type="button"
                          onClick={() => setOrdem((s) => ({ campo: c.campo, asc: s.campo === c.campo ? !s.asc : true }))}
                          style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0, background: "transparent", border: 0, padding: 0, textAlign: "left", cursor: "pointer", font: `${on ? 800 : 600} 11.5px/1.2 Inter,sans-serif`, letterSpacing: ".06em", textTransform: "uppercase", color: on ? INK : "#8d8b8d" }}>
                          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                          <span style={{ flex: "none", font: "700 12.5px/1 Inter,sans-serif" }}>{on ? (ordem.asc ? "↑" : "↓") : "↕"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ flex: 1, minHeight: 0 }}>
                    {recebidas.map((f, i) => {
                      const e = ESTADOS[f.estado ?? "bom"] ?? ESTADOS.bom;
                      return (
                        <div key={f.n} className="r2row" style={{ display: "grid", gridTemplateColumns: gridRecebidas, gap: 10, alignItems: "center", minHeight: 56, padding: "11px 8px", borderRadius: 6, background: i % 2 ? "#fafafa" : "transparent" }}>
                          <span style={{ font: `600 15px/1.2 ${MONO}`, color: "#8d8b8d" }}>{num(f.n)}</span>
                          <span style={{ font: "700 15px/1.2 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.medida}</span>
                          <span style={{ font: "500 15px/1.2 Inter,sans-serif", color: "#5c5a5c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.substrato}</span>
                          <span style={{ justifySelf: "start", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "8px 13px 7px", borderRadius: 999, whiteSpace: "nowrap", background: e.bg, color: e.fg }}>{e.label}</span>
                          <span style={{ font: `700 15px/1.2 ${MONO}`, color: INK, whiteSpace: "nowrap" }}>{f.valor != null ? brl(f.valor) : "—"}</span>
                          <span style={{ font: "500 15px/1.35 Inter,sans-serif", color: "#8d8b8d" }}>{dataHora(quando(f.envioISO, f.envio))} → {dataHora(quando(f.retornoISO, f.retorno ?? 0))}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            {f.nova && (
                              <span style={{ flex: "none", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: INK, color: AMARELO, borderRadius: 999, padding: "7px 12px 6px", whiteSpace: "nowrap" }}>nova solicitada</span>
                            )}
                            <span style={{ flex: 1, minWidth: 0, font: "400 15px/1.35 Inter,sans-serif", color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.obs || "—"}</span>
                          </span>
                        </div>
                      );
                    })}
                    {recebidas.length === 0 && emAfiacao.length === 0 && (
                      <div style={{ padding: "60px 0", textAlign: "center", font: "400 15px/1.5 Inter,sans-serif", color: "#8d8b8d" }}>Nenhuma faca encontrada com esse filtro.</div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 2px", borderTop: "2px solid #f1f1f1" }}>
                    <span style={{ flex: 1, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
                      Mostrando {ordenadas.length === 0 ? 0 : (pag - 1) * PP + 1} a {Math.min(pag * PP, ordenadas.length)} de {ordenadas.length}
                    </span>
                    <button type="button" className="r2chip" onClick={() => setPagina(Math.max(1, pag - 1))}
                      style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 6, background: "#f1f1f1", cursor: pag > 1 ? "pointer" : "not-allowed", opacity: pag > 1 ? 1 : 0.4 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5 8 12l6.5 7" /></svg>
                    </button>
                    {Array.from({ length: totalPag }, (_, i) => i + 1).map((p) => (
                      <button key={p} type="button" className="r2chip" onClick={() => setPagina(p)}
                        style={{ minWidth: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 6, cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", padding: "0 9px", background: p === pag ? INK : "#f1f1f1", color: p === pag ? AMARELO : "#5c5a5c" }}>
                        {p}
                      </button>
                    ))}
                    <button type="button" className="r2chip" onClick={() => setPagina(Math.min(totalPag, pag + 1))}
                      style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 6, background: "#f1f1f1", cursor: pag < totalPag ? "pointer" : "not-allowed", opacity: pag < totalPag ? 1 : 0.4 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 5 16 12l-6.5 7" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* modal — enviar faca */}
      {/* modal — solicitar faca nova */}
      {novaAberto && (
        <div onClick={() => setNovaAberto(false)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          {/* altura FIXA: com 1 ou com 5 facas parecidas o card é o mesmo — quem
              cresce é a lista, que rola dentro da coluna da esquerda */}
          <div onClick={(e) => e.stopPropagation()} style={{ width: 1080, height: 720, maxWidth: "100%", maxHeight: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>R2 Hub · ferramental</div>
                <div style={{ ...fr(96, 700), fontSize: 44, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>Solicitar faca nova</div>
              </div>
              <button type="button" className="r2ic" onClick={() => setNovaAberto(false)} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            {/* esquerda: o que se preenche · direita: o que o hub já sabe da medida */}
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "stretch", gap: 14 }}>
              <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD }}>
                <label style={rotulo}>Medida da faca <span style={{ color: INK }}>*</span></label>
                <input value={nnMedida} onChange={(e) => setNnMedida(e.target.value)}
                  onBlur={() => { const n = MEDIDAS(nnMedida).slice(0, 2); if (n.length === 2) setNnMedida(n.map((x) => String(x).replace(".", ",")).join(" × ")); }}
                  placeholder="100 × 140  ·  ou o código da faca"
                  style={{ ...inp, font: `700 22px/1.2 ${MONO}`, padding: "14px 16px" }} />
                {/* lê em voz alta o que foi digitado: largura, altura e o que falta */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, minHeight: 18, font: "500 13.5px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>
                  {nnNums.length >= 2
                    ? <>Largura <strong style={{ color: INK }}>{mm(nnNums[0])}</strong> · Altura <strong style={{ color: INK }}>{mm(nnNums[1])}</strong></>
                    : nnMedida.trim()
                      ? (facaDoCatalogo ? <>Sem largura × altura. Clique na faca do catálogo abaixo para preencher.</> : <>Escreva a largura e a altura, separadas por × (ex.: 100 × 140).</>)
                      : <>A medida vira desenho aqui do lado enquanto você escreve.</>}
                </div>
                {/* facas do catálogo com medida parecida: clicar preenche o campo
                    (é a mesma faca, só que nova) */}
                {parecidasNoCatalogo.length > 0 && (
                  /* só a LISTA rola: o card não muda de tamanho com 1 ou 5 facas */
                  <div style={{ flex: "0 1 auto", minHeight: 0, display: "flex", flexDirection: "column", marginTop: 16 }}>
                    <div style={{ flex: "none", font: "600 12px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3", marginBottom: 8 }}>
                      já existe no catálogo{parecidasNoCatalogo.length > 1 ? ` · ${parecidasNoCatalogo.length} facas` : ""}
                    </div>
                    <div style={{ flex: "0 1 auto", minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
                      {parecidasNoCatalogo.map((f) => {
                        const on = chaveMedida(f.medida) === nnChave && !!nnChave;
                        return (
                          <button key={f.cod} type="button" className="r2chip" onClick={() => setNnMedida(f.medida)}
                            title={`${f.medida} · ${f.cod} · ${f.sistema}`}
                            style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 10, padding: "9px 14px", background: on ? "#fff" : "#f7f7f7" }}>
                            <span style={{ flex: "none", width: 30, height: 30, display: "grid", placeItems: "center" }}>
                              <span style={desenhoDaFaca(f, 28, 28, on ? INK : "#5c5a5c")} />
                            </span>
                            <span style={{ flex: "none", width: 118, font: "700 14.5px/1 Inter,sans-serif", color: INK }}>{f.medida}</span>
                            <span style={{ flex: "none", font: `500 12.5px/1 ${MONO}`, color: "#8d8b8d" }}>{f.cod}</span>
                            <span style={{ flex: "1 1 auto", minWidth: 0, textAlign: "right", font: "500 12.5px/1.2 Inter,sans-serif", color: "#b3b1b3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {[f.sistema, f.secao].filter(Boolean).join(" · ")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <label style={{ ...rotulo, flex: "none", margin: "20px 0 10px" }}>
                  Substrato <span style={{ color: INK }}>*</span>
                  {!!noHub?.subs.length && <span style={{ font: "500 13px/1 Inter,sans-serif", color: "#b3b1b3", marginLeft: 8 }}>• já usado nessa medida</span>}
                </label>
                <div style={{ flex: "none", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {listaSubstratos.map((nome) => {
                    const on = nnSubstrato === nome;
                    /* ponto = essa medida já foi afiada nesse substrato */
                    const usado = !!noHub?.subs.includes(nome);
                    return (
                      <button key={nome} type="button" className="r2chip" onClick={() => setNnSubstrato(nome)}
                        title={usado ? "essa medida já apareceu nesse substrato" : undefined}
                        style={{ display: "flex", alignItems: "center", gap: 7, border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                        {usado && <span style={{ flex: "none", width: 6, height: 6, borderRadius: 999, background: on ? AMARELO : "#8d8b8d" }} />}
                        {nome}
                      </button>
                    );
                  })}
                </div>
                <label style={{ ...rotulo, flex: "none", margin: "20px 0 0" }}>Motivo</label>
                <input value={nnMotivo} onChange={(e) => setNnMotivo(e.target.value)} placeholder="Ex.: quebrou na produção · medida nova do cliente" style={{ ...inp, flex: "none" }} />
              </div>

              <div style={{ flex: "none", width: 384, display: "flex", flexDirection: "column", gap: 12, background: "#fff", borderRadius: 12, padding: 20, boxShadow: SOMBRA_CARD }}>
                {/* o desenho sai da própria medida digitada — confere o formato
                    antes de mandar gravar, do mesmo jeito da nova solicitação */}
                <div style={{ flex: "1 1 auto", minHeight: 0, display: "grid", placeItems: "center", background: "#f7f7f7", borderRadius: 10, padding: 24 }}>
                  {mini ? (
                    /* desenho técnico do acervo — o mesmo PNG da tela Facas */
                    <div style={{ display: "grid", gridTemplateRows: "1fr auto", gap: 10, justifyItems: "center", width: "100%", height: "100%", minHeight: 0 }}>
                      <img src={mini} alt={`desenho da faca ${facaExata?.cod ?? ""}`} style={{ width: "100%", height: "100%", minHeight: 0, objectFit: "contain" }} />
                      <span style={{ font: `600 12px/1 ${MONO}`, letterSpacing: ".08em", textTransform: "uppercase", color: "#b3b1b3" }}>desenho do acervo · {facaExata?.cod}</span>
                    </div>
                  ) : temDesenho ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ font: `600 12.5px/1 ${MONO}`, color: "#8d8b8d", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{mm(desenhoNums[1])}</span>
                      <div style={{ display: "grid", justifyItems: "center", gap: 9 }}>
                        <div style={desenhoDaFaca({ medida: desenhoMedida, sistema: facaDoCatalogo?.sistema, secao: facaDoCatalogo?.secao }, 250, 205)} />
                        <span style={{ font: `600 12.5px/1 ${MONO}`, color: "#8d8b8d" }}>{mm(desenhoNums[0])}</span>
                      </div>
                    </div>
                  ) : (
                    <span style={{ font: "500 14px/1.4 Inter,sans-serif", color: "#b3b1b3", textAlign: "center" }}>o desenho aparece<br />quando a medida estiver escrita</span>
                  )}
                </div>
                <div>
                  <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3", marginBottom: 8 }}>no catálogo</div>
                  {catalogoExato && facaDoCatalogo ? (
                    <div style={{ font: "500 14px/1.45 Inter,sans-serif", color: "#5c5a5c" }}>
                      <strong style={{ font: `700 16px/1 ${MONO}`, color: INK }}>{facaDoCatalogo.cod}</strong>
                      <span style={{ display: "block", marginTop: 5 }}>{[facaDoCatalogo.sistema, facaDoCatalogo.secao].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                  ) : facaDoCatalogo ? (
                    <div style={{ font: "500 14px/1.45 Inter,sans-serif", color: "#5c5a5c" }}>
                      Nada com essa medida exata. A mais próxima é <strong style={{ color: INK }}>{facaDoCatalogo.medida}</strong> ({facaDoCatalogo.cod}).
                    </div>
                  ) : (
                    <div style={{ font: "500 14px/1.45 Inter,sans-serif", color: "#5c5a5c" }}>
                      {nnChave ? "Medida que ainda não existe no catálogo: é faca nova mesmo." : "Escreva a medida para o hub procurar."}
                    </div>
                  )}
                </div>
                <div style={{ borderTop: "1px solid #f1f1f1", paddingTop: 12 }}>
                  <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3", marginBottom: 8 }}>na afiação</div>
                  {noHub ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, font: "500 14px/1.4 Inter,sans-serif", color: "#5c5a5c" }}>
                      <span>
                        <strong style={{ color: INK }}>{noHub.total}</strong> {noHub.total === 1 ? "passagem registrada" : "passagens registradas"}
                        {noHub.emAfiacao > 0 && <> · <strong style={{ color: INK }}>{noHub.emAfiacao}</strong> em afiação agora</>}
                      </span>
                      {noHub.ultima && (
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          último retorno {dataBR(quando(noHub.ultima.retornoISO, noHub.ultima.retorno ?? 0))}
                          {noHub.ultima.estado && ESTADOS[noHub.ultima.estado] && (
                            <span style={{ font: "700 12px/1 Inter,sans-serif", borderRadius: 999, padding: "5px 10px", background: ESTADOS[noHub.ultima.estado].bg, color: ESTADOS[noHub.ultima.estado].fg }}>
                              {ESTADOS[noHub.ultima.estado].label}
                            </span>
                          )}
                        </span>
                      )}
                      {noHub.naFila && (
                        <span style={{ borderRadius: 8, padding: "9px 12px", background: AMARELO, color: INK, font: "600 13.5px/1.35 Inter,sans-serif" }}>
                          Já existe pedido de faca nova nessa medida ({num(noHub.naFila.n)}). Confira a fila antes de repetir.
                        </span>
                      )}
                    </div>
                  ) : (
                    <div style={{ font: "500 14px/1.45 Inter,sans-serif", color: "#5c5a5c" }}>
                      {nnChave ? "Essa medida nunca passou pela afiação." : "—"}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 240px", minWidth: 180, font: "400 14.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>
                {nnMedida.trim() && nnSubstrato
                  ? "Entra na fila de facas novas, aguardando o pedido ao fornecedor."
                  : "Informe a medida e o substrato para registrar o pedido."}
              </span>
              <button type="button" className="r2chip" onClick={() => setNovaAberto(false)} style={{ flex: "none", background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>Cancelar</button>
              <button type="button" className="r2chip" onClick={solicitarNova} disabled={ocupado}
                style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: nnMedida.trim() && nnSubstrato && !ocupado ? "pointer" : "not-allowed", opacity: nnMedida.trim() && nnSubstrato && !ocupado ? 1 : 0.45 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                <span style={{ lineHeight: "18px" }}>{ocupado ? "Salvando…" : "Colocar na fila"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {envioAberto && (
        <div onClick={() => setEnvioAberto(false)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 640, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>R2 Hub · afiação</div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>Enviar faca</div>
              </div>
              <button type="button" className="r2ic" onClick={() => setEnvioAberto(false)} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD }}>
              <label style={rotulo}>Medida da faca <span style={{ color: INK }}>*</span></label>
              <input value={novaMedida} onChange={(e) => setNovaMedida(e.target.value)} placeholder="Ex.: 80 × 60" style={inp} />
              <label style={{ ...rotulo, margin: "20px 0 10px" }}>Substrato <span style={{ color: INK }}>*</span></label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {listaSubstratos.map((nome) => {
                  const on = novoSubstrato === nome;
                  return (
                    <button key={nome} type="button" className="r2chip" onClick={() => setNovoSubstrato(nome)}
                      style={{ border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                      {nome}
                    </button>
                  );
                })}
                {subNovo === null ? (
                  <button type="button" className="r2chip" title="Adicionar matéria-prima" onClick={() => setSubNovo("")}
                    style={{ display: "flex", alignItems: "center", gap: 6, border: "2px dashed #d6d5d6", cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: "transparent", color: "#8d8b8d" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="3" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                    nova matéria-prima
                  </button>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input autoFocus value={subNovo} onChange={(e) => setSubNovo(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") adicionarSubstrato(); if (e.key === "Escape") setSubNovo(null); }}
                      placeholder="Nome da matéria-prima"
                      style={{ width: 210, background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 999, padding: "9px 14px", font: "600 14.5px/1 Inter,sans-serif", color: INK, outline: "none" }} />
                    <button type="button" className="r2chip" onClick={adicionarSubstrato}
                      style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "700 14.5px/1 Inter,sans-serif", background: AMARELO, color: INK, whiteSpace: "nowrap" }}>
                      Adicionar
                    </button>
                    <button type="button" className="r2chip" onClick={() => setSubNovo(null)}
                      style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", background: "#f1f1f1", color: "#5c5a5c", whiteSpace: "nowrap" }}>
                      Cancelar
                    </button>
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 240px", minWidth: 180, font: "400 14.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>
                {novaMedida.trim() && novoSubstrato
                  ? real
                    ? "Entra na fila aguardando o retorno da afiação."
                    : `Entra como ${num(proximoNumero)} aguardando retorno da afiação.`
                  : "Informe a medida e o substrato para registrar o envio."}
              </span>
              <button type="button" className="r2chip" onClick={() => setEnvioAberto(false)} style={{ flex: "none", background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>Cancelar</button>
              <button type="button" className="r2chip" onClick={enviarFaca} disabled={ocupado}
                style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: novaMedida.trim() && novoSubstrato && !ocupado ? "pointer" : "not-allowed", opacity: novaMedida.trim() && novoSubstrato && !ocupado ? 1 : 0.45 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 3 10.5 13.5" /><path d="M21 3l-7 18-3.5-7.5L3 10z" /></svg>
                <span style={{ lineHeight: "18px" }}>{ocupado ? "Salvando…" : "Registrar envio"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal — faca chegou */}
      {sel && (
        <div onClick={() => setReceberN(null)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{num(sel.n)} · {sel.medida} · {sel.substrato}</div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>Faca chegou</div>
              </div>
              <button type="button" className="r2ic" onClick={() => setReceberN(null)} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD }}>
              <label style={{ ...rotulo, marginBottom: 10 }}>Estado da faca <span style={{ color: INK }}>*</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                {["bom", "regular", "ruim"].map((k) => {
                  const on = recEstado === k;
                  return (
                    <button key={k} type="button" className="r2chip"
                      onClick={() => { setRecEstado(k); if (k === "ruim") setRecNova(true); }}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 7, padding: "15px 12px", font: "700 15px/1 Inter,sans-serif", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={on ? AMARELO : "#5c5a5c"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                        {ESTADOS[k].paths.map((d) => <path key={d} d={d} />)}
                      </svg>
                      <span style={{ lineHeight: "19px" }}>{ESTADOS[k].label}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
                <div style={{ display: podeVerCusto ? "block" : "none" }}>
                  <label style={rotulo}>Valor da afiação (R$)</label>
                  <input value={recValor} onChange={(e) => setRecValor(e.target.value)} placeholder="0,00" style={inp} />
                </div>
                <div>
                  <label style={rotulo}>Recebida por</label>
                  {/* no modo real quem recebe é sempre o usuário logado — o banco grava o nome da sessão */}
                  <input value={recPor} onChange={(e) => setRecPor(e.target.value)} placeholder="Danilo"
                    readOnly={real} title={real ? "Fica registrado no seu nome de usuário" : undefined}
                    style={{ ...inp, ...(real ? { color: "#8d8b8d", cursor: "default" } : null) }} />
                </div>
              </div>

              <label style={{ ...rotulo, margin: "20px 0 8px" }}>Observação</label>
              <textarea value={recObs} onChange={(e) => setRecObs(e.target.value)} placeholder="Ex.: fio irregular no canto, afiação parcial..." style={{ ...inp, minHeight: 84, resize: "vertical" }} />

              <button type="button" className="r2chip" onClick={() => setRecNova(!recNova)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginTop: 20, border: `2px solid ${recNova ? INK : "#f1f1f1"}`, borderRadius: 7, padding: "14px 16px", cursor: "pointer", textAlign: "left", background: recNova ? AMARELO : "#fafafa" }}>
                <span style={{ flex: "none", width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 5, background: recNova ? INK : "#e0e0e0", color: recNova ? AMARELO : "#e0e0e0" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={recNova ? AMARELO : "#e0e0e0"} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                </span>
                <span style={{ font: "600 15px/1 Inter,sans-serif", color: INK }}>Solicitar faca nova</span>
                <span style={{ flex: 1 }} />
                <span style={{ font: "400 14.5px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>entra na fila de compra de ferramental</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 240px", minWidth: 180, font: "400 14.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>
                {recEstado
                  ? `Estado ${ESTADOS[recEstado].label.toLowerCase()}${recValor ? ` · ${recValor}` : ""}${recNova ? " · faca nova solicitada" : ""}`
                  : "Informe o estado da faca para confirmar."}
              </span>
              <button type="button" className="r2chip" onClick={() => setReceberN(null)} style={{ background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer" }}>Cancelar</button>
              <button type="button" className="r2chip" onClick={confirmarReceber} disabled={ocupado}
                style={{ display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: recEstado && !ocupado ? "pointer" : "not-allowed", opacity: recEstado && !ocupado ? 1 : 0.45 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
                <span style={{ lineHeight: "18px" }}>{ocupado ? "Salvando…" : "Confirmar recebimento"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </EstagioV1a>
  );
}
