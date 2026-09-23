// Fábrica (Painel) — v1a. Fonte: design_handoff_r2_hub/telas/Painel.dc.html.
// Frame 1920×1350 (único da família); modo monitor via ?so=paineis (sem chrome).
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import {
  AMARELO, AvisoV1a, EstagioV1a, FUNDO, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { valorOuZero } from "@/lib/valor";
import {
  listPainel, registrarProducao as registrarProducaoFn, removerMaquina as removerMaquinaFn,
  salvarEstadoMaquina, salvarMaquina as salvarMaquinaFn,
} from "@/lib/api/painel.functions";
import { lerLeituras, marcarLeituraUsada } from "./dados/leituras";
import type { Leitura } from "./dados/leituras";

const STAGE_H_FABRICA = 1350;

/* ————— dados fixos do painel (protótipo) ————— */
type MaqDef = { k: string; nome: string; valor: number; setor?: "rebobinagem"; fixa?: boolean };

const MAQUINAS_FIXAS: MaqDef[] = [
  { k: "classic", nome: "Classic", valor: 180 },
  { k: "force", nome: "Force", valor: 260 },
  { k: "maqflex", nome: "Maqflex", valor: 210 },
  { k: "delrey4", nome: "Del Rey 4", valor: 240 },
  { k: "delrey5", nome: "Del Rey 5", valor: 280 },
  { k: "rebob1", nome: "Rebobinadeira 1", valor: 90, setor: "rebobinagem" },
  { k: "rebob2", nome: "Rebobinadeira 2", valor: 90, setor: "rebobinagem" },
];

const CUSTO_BASE: Record<string, number> = {
  classic: 120, force: 180, maqflex: 150, delrey4: 160, delrey5: 200,
};
const CUSTO_BASE_OUTRAS = 140;

const EQUIPE = [
  { nome: "Danilo", cargo: "Diretor" },
  { nome: "Fernanda", cargo: "Comercial" },
  { nome: "Marcos", cargo: "Produção" },
  { nome: "Juliana", cargo: "Design" },
  { nome: "Rafael", cargo: "Clicheria" },
  { nome: "Patrícia", cargo: "Financeiro" },
  { nome: "Tiago", cargo: "Impressão" },
  { nome: "Camila", cargo: "Qualidade" },
];

const CHAVE_PERM = "r2.painel.custos.perm.v1";

/* ————— helpers ————— */
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
function gravarLS(chave: string, valor: unknown) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* cheio/indisponível */ }
}

const numero = (v: unknown) => Number(String(v ?? "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.]/g, "")) || 0;
const fmtM = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) + " m";
const brl = (n: number) => {
  const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split(".");
  return (n < 0 ? "-" : "") + "R$ " + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d;
};
function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  return `${h}:${m}:${String(s % 60).padStart(2, "0")}`;
}
const fmtData = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
};

const APP_PARA_V1A: Record<string, string> = {
  nova: "Aguardando Design", criacao: "Aguardando Design",
  aguardando: "Aguardando aprovação", revisao: "Alteração pedida",
  aprovada: "Design aprovado", cliche: "Clichê solicitado",
  concluido: "Finalizado", cancelado: "Finalizado",
};

/* pedido carregado numa máquina */
type Achado = {
  num: string; cliente: string; medida: string; substrato: string;
  cores: string; qtdCores: string; status: string; prazo: string;
  rolos?: string; metragem?: string;
};
type MaqEstado = {
  pedido: Achado | null; rodando: boolean; inicio: number; acumulado: number;
  valor: number; base?: string; obs?: string;
};
type Historico = {
  maquina: string; os: string; cliente: string; tempo: string;
  custo: string; metros: number; metrosLabel: string; tag: "Finalizado" | "Cancelado";
};

const metrosDe = (p: Achado | null) => (p ? numero(p.rolos) * numero(p.metragem) : 0);

const primeiroNome = (nome: string) => String(nome || "").trim().split(/\s+/)[0] || "";

/* ————— componente ————— */
export function PainelV1a({ profile, pedidos, versao, aoNavegar, onNova, onLogout, disponiveis, children, permissoes, leiturasReais, aoUsarLeitura }: {
  profile: { nome: string; role?: string };
  pedidos: any[];
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
  /** permissões painel.* — ausente = protótipo (usa a lista de nomes local) */
  permissoes?: {
    carregarOs?: boolean; rodar?: boolean; finalizar?: boolean;
    cancelar?: boolean; maquinas?: boolean; custosVer?: boolean; custosEditar?: boolean;
  };
  /** fila real (tabela `leituras`) — presente = desliga o localStorage */
  leiturasReais?: Leitura[];
  /** marca a leitura como usada no banco ao carregar a OS */
  aoUsarLeitura?: (id: string) => Promise<unknown>;
}) {
  const soPaineis = typeof window !== "undefined" && /(\?|&)so=paineis/.test(window.location.search);
  const comChrome = !soPaineis;

  const [busca, setBusca] = useState("");
  /* Máquinas e estado vêm do BANCO — antes cada computador tinha o seu, e o
     Mural da fábrica mostrava tudo livre porque a OP foi carregada noutro PC.
     A lista começa com o parque conhecido só para a tela não nascer vazia
     enquanto a primeira consulta não volta. */
  const [lista, setLista] = useState<MaqDef[]>(() => MAQUINAS_FIXAS.map((m) => ({ ...m, fixa: true })));
  const [maq, setMaq] = useState<Record<string, MaqEstado>>({});
  const [perm, setPerm] = useState<string[]>(() => lerLS(CHAVE_PERM, ["Danilo", "Patrícia"]));
  const [os, setOs] = useState("");
  const [achado, setAchado] = useState<Achado | null>(null);
  const [erroBusca, setErroBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [custosAberto, setCustosAberto] = useState(false);
  const [addAberto, setAddAberto] = useState(false);
  const [novaNome, setNovaNome] = useState("");
  const [novaValor, setNovaValor] = useState("");
  const [novaSetor, setNovaSetor] = useState<"impressao" | "rebobinagem">("impressao");
  const [addErro, setAddErro] = useState("");
  const realLeituras = Array.isArray(leiturasReais);
  const [leiturasDemo, setLeiturasDemo] = useState<Leitura[]>([]);
  const leituras = realLeituras ? leiturasReais! : leiturasDemo;
  const [leituraAtiva, setLeituraAtiva] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => { if (!realLeituras) setLeiturasDemo(lerLeituras()); }, [realLeituras]);

  const maqRef = useRef(maq);
  maqRef.current = maq;
  useEffect(() => {
    const t = setInterval(() => {
      if (Object.values(maqRef.current).some((m) => m && m.rodando)) setTick(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* Puxa o painel do servidor e repete a cada 10s: quem está nesta tela precisa
     ver a OP que o colega carregou na máquina ao lado, sem apertar F5.
     `mexendoRef` segura a atualização enquanto uma ação local está em voo,
     para a resposta antiga não desfazer o que a pessoa acabou de clicar. */
  const mexendoRef = useRef(0);
  async function puxarPainel() {
    if (mexendoRef.current > 0) return;
    const r = (await listPainel()) as any;
    const ms: MaqDef[] = (r?.maquinas ?? []).map((m: any) => ({
      k: String(m.k), nome: String(m.nome), valor: Number(m.valor) || 0,
      setor: m.setor === "rebobinagem" ? "rebobinagem" : undefined,
      fixa: !!m.fixa,
    }));
    if (ms.length) setLista(ms);
    const mapa: Record<string, MaqEstado> = {};
    for (const e of (r?.estados ?? [])) {
      try { mapa[String(e.maquina)] = JSON.parse(e.estado_json); } catch { /* linha corrompida: máquina entra livre */ }
    }
    setMaq(mapa);
    setProducaoServidor((r?.producao ?? []) as any[]);
  }
  const [producaoServidor, setProducaoServidor] = useState<any[]>([]);
  useEffect(() => {
    const puxar = () => { void puxarPainel().catch(() => { /* servidor fora: mantém o que está na tela */ }); };
    puxar();
    const t = setInterval(puxar, 10_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const estadoDe = (k: string): MaqEstado => maq[k] ?? {
    pedido: null, rodando: false, inicio: 0, acumulado: 0,
    valor: lista.find((m) => m.k === k)?.valor ?? 0,
  };
  /* Altera UMA máquina: a tela responde na hora e o servidor guarda em seguida
     (uma linha por máquina, então dois PCs em máquinas diferentes não brigam).
     Se o servidor recusar, a tela avisa e volta ao que está gravado. */
  const patchMaq = (k: string, patch: Partial<MaqEstado>) => {
    let novo: MaqEstado | null = null;
    setMaq((atual) => {
      const prox = { ...atual, [k]: { ...estadoDe(k), ...atual[k], ...patch } };
      novo = prox[k];
      return prox;
    });
    mexendoRef.current += 1;
    void salvarEstadoMaquina({ data: { maquina: k, estado: novo } })
      .catch((e: unknown) => {
        setAviso(e instanceof Error ? e.message : "Não foi possível salvar na fábrica.");
        void puxarPainel();
      })
      .finally(() => { mexendoRef.current = Math.max(0, mexendoRef.current - 1); });
  };
  const gravarLista = (l: MaqDef[]) => setLista(l);

  /* Custo é permissão do sistema (painel.custos_ver). A lista de nomes do
     protótipo continua valendo como filtro extra quando a rota não informa. */
  const podeRodar = permissoes ? !!permissoes.rodar : true;
  const podeFinalizar = permissoes ? !!permissoes.finalizar : true;
  const podeCancelar = permissoes ? !!permissoes.cancelar : true;
  const podeMaquinas = permissoes ? !!permissoes.maquinas : true;
  const podeCarregarOs = permissoes ? !!permissoes.carregarOs : true;
  const podeCustos = permissoes
    ? !!permissoes.custosVer
    : perm.includes(primeiroNome(profile.nome)) || profile.role === "admin";
  /* painel.custos (editar) é mais restrito que ver: o botão abria o cadastro
     para QUALQUER pessoa com acesso à Fábrica e os campos gravavam direto. */
  const podeCustosEditar = permissoes ? !!permissoes.custosEditar : true;
  const togglePerm = (nome: string) => {
    const prox = perm.includes(nome) ? perm.filter((n) => n !== nome) : [...perm, nome];
    setPerm(prox);
    gravarLS(CHAVE_PERM, prox);
  };

  const baseDe = (def: MaqDef, st: MaqEstado) => {
    if (st.base !== undefined && st.base !== null && st.base !== "") return valorOuZero(st.base);
    /* Com backend, setup não configurado = 0. A tabela CUSTO_BASE é chute do
       protótipo (R$ 120–200) e estava entrando nos custos REAIS dos
       apontamentos como se fosse tarifa da casa. Configure em Custos. */
    if (permissoes) return 0;
    return CUSTO_BASE[def.k] ?? CUSTO_BASE_OUTRAS;
  };
  const decorrido = (m: MaqEstado) => (m.acumulado || 0) + (m.rodando && m.inicio ? Date.now() - m.inicio : 0);
  const custoDe = (def: MaqDef, st: MaqEstado) => {
    const horas = decorrido(st) / 3_600_000;
    return horas * Number(st.valor || 0) + baseDe(def, st); // base cobrada como setup por OS
  };

  /* — busca de OS no cadastro real do app — */
  function buscar() {
    const bruto = os.trim().replace(/^#/, "");
    if (!bruto) { setAchado(null); setErroBusca("Digite o número da OS."); return; }
    const num = "#" + bruto.padStart(4, "0");
    const p = pedidos.find((x) => Number(x.numero) === Number(bruto));
    if (!p) { setAchado(null); setErroBusca(`OS ${num} não encontrada.`); return; }
    const status = APP_PARA_V1A[p.status] ?? p.status;
    const a: Achado = {
      num,
      cliente: p.cliente,
      medida: `${p.largura}×${p.altura}`,
      substrato: p.materia,
      cores: String(p.cores ?? "—"),
      qtdCores: String(p.cores ?? "—"),
      status,
      prazo: fmtData(p.prazo ?? new Date(new Date(p.created_at).getTime() + 7 * 86_400_000).toISOString()),
    };
    const jaNaMaquina = Object.entries(maq).find(([, m]) => m.pedido && m.pedido.num === num);
    setAchado(a);
    setErroBusca(jaNaMaquina
      ? `Esta OS já está na ${lista.find((x) => x.k === jaNaMaquina[0])?.nome ?? "máquina"}.`
      : ["Clichê recebido", "Em produção", "Finalizado"].includes(status)
        ? ""
        : `Atenção: ${num} está em "${status}" — o clichê ainda não chegou.`);
  }

  function carregar(k: string) {
    if (!achado) return;
    if (!podeCarregarOs) { setAviso("Seu acesso não inclui carregar OS na máquina."); return; }
    patchMaq(k, { pedido: achado, rodando: true, inicio: Date.now(), acumulado: 0 });
    const nome = lista.find((x) => x.k === k)?.nome ?? "máquina";
    if (leituraAtiva) {
      if (aoUsarLeitura) {
        aoUsarLeitura(leituraAtiva).catch(() => { /* a fila recarrega sozinha */ });
      } else {
        marcarLeituraUsada(leituraAtiva);
        setLeiturasDemo(lerLeituras());
      }
      setLeituraAtiva(null);
    }
    setAchado(null);
    setOs("");
    setAviso(`${achado.num} entrou na ${nome} — cronômetro rodando.`);
  }

  function encerrar(k: string, tipo: "fim" | "cancelado") {
    const st = estadoDe(k);
    if (!st.pedido) return;
    const def = lista.find((x) => x.k === k) ?? { k, nome: "máquina", valor: 0 };
    const ms = decorrido(st);
    const custo = custoDe(def, st);
    const registro: Historico = {
      maquina: def.nome, os: st.pedido.num, cliente: st.pedido.cliente,
      tempo: hms(ms), custo: brl(custo), metros: metrosDe(st.pedido),
      metrosLabel: metrosDe(st.pedido) ? fmtM(metrosDe(st.pedido)) : "—",
      tag: tipo === "fim" ? "Finalizado" : "Cancelado",
    };
    void registrarProducaoFn({
      data: {
        maquina: def.nome, os: st.pedido.num, cliente: st.pedido.cliente,
        substrato: st.pedido.substrato || "", medida: st.pedido.medida || "",
        ms, custo, metros: metrosDe(st.pedido), tag: registro.tag,
      },
    })
      .then(() => puxarPainel())
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Produção não foi registrada."));
    patchMaq(k, { pedido: null, rodando: false, inicio: 0, acumulado: 0 });
    setHistorico((h) => [registro, ...h].slice(0, 20));
    setAviso(`${tipo === "fim" ? "Produção de" : "Produção cancelada de"} ${st.pedido.num} na ${def.nome} · ${hms(ms)} · ${brl(custo)}`);
  }

  function addMaquina() {
    const nome = novaNome.trim();
    const valor = Number(novaValor.replace(",", ".")) || 0;
    if (!nome) { setAddErro("Dê um nome para a máquina."); return; }
    if (!valor) { setAddErro("Informe o valor por hora."); return; }
    const k = "m" + Date.now();
    gravarLista([...lista, { k, nome, valor, setor: novaSetor === "rebobinagem" ? "rebobinagem" : undefined }]);
    void salvarMaquinaFn({ data: { k, nome, valor, setor: novaSetor === "rebobinagem" ? "rebobinagem" : null } })
      .then(() => puxarPainel())
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Máquina não foi cadastrada."));
    patchMaq(k, { pedido: null, rodando: false, inicio: 0, acumulado: 0, valor });
    setNovaNome(""); setNovaValor(""); setAddAberto(false); setAddErro("");
    setAviso(`${nome} entrou no painel a ${brl(valor)}/h.`);
  }

  function removerMaquina(k: string) {
    const alvo = lista.find((m) => m.k === k);
    if (!alvo || alvo.fixa || MAQUINAS_FIXAS.some((x) => x.k === k)) return;
    gravarLista(lista.filter((m) => m.k !== k));
    setMaq((atual) => {
      const prox = { ...atual };
      delete prox[k];
      return prox;
    });
    void removerMaquinaFn({ data: { k } })
      .then(() => puxarPainel())
      .catch((e: unknown) => { setAviso(e instanceof Error ? e.message : "Máquina não foi removida."); void puxarPainel(); });
    setAviso(`${alvo.nome} removida do painel.`);
  }

  /* — agregados — */
  const impressoras = lista.filter((m) => m.setor !== "rebobinagem");
  const rebobs = lista.filter((m) => m.setor === "rebobinagem");
  const livres = lista.filter((m) => !estadoDe(m.k).pedido);
  const rodando = lista.filter((m) => estadoDe(m.k).rodando).length;
  const ocupadas = lista.filter((m) => estadoDe(m.k).pedido).length;
  const metrosFeitos = historico.reduce((s, h) => s + (Number(h.metros) || 0), 0);
  const metrosCurso = lista.reduce((s, m) => s + (estadoDe(m.k).pedido ? metrosDe(estadoDe(m.k).pedido) : 0), 0);
  const custoTotal = lista.reduce((s, m) => {
    const st = estadoDe(m.k);
    return s + (st.pedido ? custoDe(m, st) : 0);
  }, 0);
  const colunas = impressoras.length + 1;

  const microK: CSSProperties = { font: `600 12px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" };

  const kpis = [
    { valor: String(rodando), label: "Rodando agora", tema: "amarelo" },
    { valor: String(Math.max(0, impressoras.length - lista.filter((m) => m.setor !== "rebobinagem" && estadoDe(m.k).pedido).length)), label: "Máquinas livres", tema: "claro" },
    { valor: podeCustos ? brl(custoTotal) : "—", label: podeCustos ? "Custo em curso" : "Custo restrito", tema: "escuro" },
    { valor: String(historico.length), label: "Encerradas hoje", tema: "claro" },
    { valor: fmtM(metrosCurso), label: "Metragem em curso", tema: "claro" },
    { valor: fmtM(metrosFeitos), label: "Metragem rodada", tema: "amarelo" },
  ];

  const conteudo = (
    <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      {comChrome && (
        <>
          {/* header da tela */}
          <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "0 4px" }}>
            <div>
              <h1 style={{ ...fr(144, 900), fontSize: 80, lineHeight: 0.86, color: INK, margin: "2px 0 0 2px" }}>Fábrica</h1>
              <div style={{ font: "400 15px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>
                Produção em tempo real · {rodando} de {impressoras.length} máquinas rodando{podeCustos ? ` · ${brl(custoTotal)} em curso` : ""}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", borderRadius: 999, padding: "0 20px", height: 52, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                <span style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>Ordem de serviço</span>
                <input
                  value={os}
                  onChange={(e) => { setOs(e.target.value.replace(/[^0-9#]/g, "")); setErroBusca(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
                  placeholder="0412"
                  style={{ width: 120, border: 0, outline: 0, background: "transparent", font: `700 22px/1 ${MONO}`, color: INK }}
                />
              </div>
              <button type="button" onClick={buscar} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "16px 20px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: INK, color: AMARELO }}>
                Localizar pedido
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    const u = window.location.href + (window.location.search ? "&" : "?") + "so=paineis";
                    window.open(u, "_blank");
                  } catch { /* pop-up bloqueado */ }
                }}
                className="r2chip"
                title="Abrir apenas os painéis numa nova aba"
                style={{ display: "flex", alignItems: "center", gap: 9, height: 52, border: 0, borderRadius: 999, padding: "0 20px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", whiteSpace: "nowrap", background: "#fff", color: INK, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                  <path d="M13.5 4.5h6v6" /><path d="M19.5 4.5 11 13" /><path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" />
                </svg>
                <span style={{ lineHeight: "16px" }}>Painéis em nova aba</span>
              </button>
              <button
                type="button"
                onClick={() => { if (podeCustos || podeCustosEditar) setCustosAberto(true); }}
                className="r2chip"
                title={podeCustos || podeCustosEditar ? "Cadastro de custos" : "Sem permissão para ver custos"}
                style={{ display: "flex", alignItems: "center", gap: 9, height: 52, border: 0, borderRadius: 999, padding: "0 20px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", whiteSpace: "nowrap", background: podeCustos ? INK : "#fff", color: podeCustos ? "#f1f1f1" : "#8d8b8d" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={podeCustos ? AMARELO : "#8d8b8d"} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                  <path d="M6.5 10.5V8a5.5 5.5 0 0 1 11 0v2.5" /><path d="M5 10.5h14v10H5z" /><path d="M12 14v3" />
                </svg>
                <span style={{ lineHeight: "16px" }}>{podeCustos ? "Custos" : "Custos restritos"}</span>
              </button>
            </div>
          </div>

          {/* faixa da OS localizada */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, minHeight: 96, background: achado ? INK : "#2f2d2f", borderRadius: 12, padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 26, minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 12.5px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>
                  {achado ? `${achado.num} · ${achado.status}` : "Ordem de serviço"}
                </div>
                <div style={{ ...fr(96, 700), fontSize: 32, lineHeight: 1, letterSpacing: "-.03em", color: "#f1f1f1", marginTop: 9, whiteSpace: "nowrap" }}>
                  {achado ? achado.cliente : (erroBusca || "Digite a OS e clique em localizar")}
                </div>
              </div>
              {achado && (
                <>
                  <div style={{ width: 1, alignSelf: "stretch", background: "rgba(241,241,241,.16)" }} />
                  <div style={{ display: "flex", gap: 26 }}>
                    {[
                      { k: "Medida", v: achado.medida },
                      { k: "Substrato", v: achado.substrato },
                      { k: "Cores", v: achado.cores },
                      { k: "Entrega", v: achado.prazo },
                    ].map((s) => (
                      <div key={s.k}>
                        <div style={microK}>{s.k}</div>
                        <div style={{ font: "600 15px/1 Inter,sans-serif", color: "#f1f1f1", marginTop: 7, whiteSpace: "nowrap" }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
              <span style={{ font: "400 14.5px/1.45 Inter,sans-serif", color: "#8d8b8d", maxWidth: 270, textAlign: "right" }}>
                {achado
                  ? (livres.length ? "Escolha a máquina para iniciar:" : "Todas as máquinas estão ocupadas.")
                  : "O pedido vem do cadastro — matéria-prima e cores entram na máquina."}
              </span>
              {achado && livres.map((m) => (
                <button key={m.k} type="button" onClick={() => carregar(m.k)} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "12px 15px", cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", background: AMARELO, color: INK }}>
                  {m.nome}
                </button>
              ))}
            </div>
          </div>

          {/* leituras da produção (alimentadas pela tela Leitura — backend futuro) */}
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 12, padding: "12px 16px", boxShadow: SOMBRA_CARD }}>
            <span style={{ flex: "none", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>Leituras da produção</span>
            <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 7, overflow: "auto" }}>
              {leituras.filter((l) => !l.usada).length === 0 && (
                <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>nenhuma leitura na fila — capture pela tela Leitura</span>
              )}
              {leituras.filter((l) => !l.usada).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="r2chip"
                  onClick={() => {
                    const bruto = String(l.num || "").replace(/^#/, "");
                    const p = bruto ? pedidos.find((x) => Number(x.numero) === Number(bruto)) : null;
                    setOs(bruto);
                    setAchado(p
                      ? {
                          num: "#" + String(p.numero).padStart(4, "0"), cliente: p.cliente,
                          medida: `${p.largura}×${p.altura}`, substrato: p.materia,
                          cores: String(p.cores ?? "—"), qtdCores: String(p.cores ?? "—"),
                          status: APP_PARA_V1A[p.status] ?? p.status,
                          prazo: fmtData(p.prazo ?? p.created_at), rolos: l.rolos, metragem: l.metragem,
                        }
                      : {
                          num: l.op || "OP", cliente: l.cliente || "Leitura sem cadastro",
                          medida: l.medida, substrato: l.substrato, cores: "—", qtdCores: "—",
                          status: "Leitura de OP", prazo: l.entrega || "—", rolos: l.rolos, metragem: l.metragem,
                        });
                    setLeituraAtiva(l.id);
                    setErroBusca("");
                    if (p) setAviso(`Leitura de ${p.cliente} carregada · ${l.metragem ? l.metragem + " m" : "sem metragem"}`);
                  }}
                  style={{ flex: "none", display: "flex", alignItems: "center", gap: 9, border: "2px solid #f1f1f1", background: "#fff", borderRadius: 999, padding: "9px 13px", cursor: "pointer", color: INK, whiteSpace: "nowrap" }}
                >
                  <span style={{ font: `700 13.5px/1 ${MONO}` }}>{l.op || l.num || "sem nº"}</span>
                  <span style={{ font: "500 13.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>{[l.cliente, l.medida, l.substrato].filter(Boolean).join(" · ")}</span>
                  <span style={{ font: "700 13.5px/1 Inter,sans-serif" }}>{(l.rolos ? l.rolos + " RL × " : "") + (l.metragem ? l.metragem + " m" : "")}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => aoNavegar?.("OP")} className="r2chip" style={{ flex: "none", border: 0, borderRadius: 999, padding: "11px 14px", cursor: "pointer", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", background: INK, color: AMARELO }}>
              Abrir leitura
            </button>
          </div>
        </>
      )}

      {/* grade de impressoras */}
      <div style={{ flex: "none", display: "grid", gridTemplateColumns: `repeat(${colunas},minmax(0,1fr))`, gap: 10 }}>
        {impressoras.map((def) => (
          <CardMaquina key={def.k} def={def} st={estadoDe(def.k)} podeCustos={podeCustos} decorrido={decorrido} custoDe={custoDe}
            onPausar={podeRodar ? patchMaq : undefined}
            onFinalizar={podeFinalizar ? (k) => encerrar(k, "fim") : undefined}
            onCancelar={podeCancelar ? (k) => encerrar(k, "cancelado") : undefined}
            onRemover={podeMaquinas ? removerMaquina : undefined} />
        ))}
        {comChrome && podeMaquinas && (
          <button type="button" onClick={() => { setAddAberto(true); setAddErro(""); setNovaNome(""); setNovaValor(""); setNovaSetor("impressao"); }} className="r2chip"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, border: "2px dashed #d6d5d6", borderRadius: 14, padding: "20px 18px", cursor: "pointer", background: "transparent", textAlign: "center" }}>
            <span style={{ width: 44, height: 44, flex: "none", display: "grid", placeItems: "center", background: AMARELO, borderRadius: 999 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
            </span>
            <span style={{ font: "700 16px/1.25 Inter,sans-serif", color: INK }}>Adicionar máquina</span>
            <span style={{ font: "500 13.5px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>
              {lista.length} máquinas no painel · {lista.filter((m) => !m.fixa).length} adicionadas manualmente
            </span>
          </button>
        )}
      </div>

      {/* rebobinadeiras */}
      {rebobs.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "2px 4px" }}>
            <span style={{ font: "700 13px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>Rebobinadeiras</span>
            <span style={{ flex: 1, height: 2, background: "#e4e4e4", borderRadius: 999 }} />
            <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>
              {rebobs.length} {rebobs.length === 1 ? "máquina" : "máquinas"} · {rebobs.filter((m) => !estadoDe(m.k).pedido).length} livre{rebobs.filter((m) => !estadoDe(m.k).pedido).length === 1 ? "" : "s"}
            </span>
          </div>
          <div style={{ flex: "none", display: "grid", gridTemplateColumns: `repeat(${colunas},minmax(0,1fr))`, gap: 10 }}>
            {rebobs.map((def) => (
              <CardMaquina key={def.k} def={def} st={estadoDe(def.k)} podeCustos={podeCustos} decorrido={decorrido} custoDe={custoDe}
                onPausar={podeRodar ? patchMaq : undefined}
            onFinalizar={podeFinalizar ? (k) => encerrar(k, "fim") : undefined}
            onCancelar={podeCancelar ? (k) => encerrar(k, "cancelado") : undefined}
            onRemover={podeMaquinas ? removerMaquina : undefined} />
            ))}
          </div>
        </>
      )}

      {/* apontamentos + KPIs */}
      {comChrome && (
        <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
          <div style={{ flex: 1, background: "#fff", borderRadius: 12, padding: "18px 22px 16px", boxShadow: SOMBRA_CARD }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Últimos apontamentos</span>
              <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#b3b1b3" }}>{historico.length} nesta sessão · {fmtM(metrosFeitos)} rodados</span>
            </div>
            <div style={{ maxHeight: 150, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
              {historico.length === 0 && (
                <div style={{ padding: "26px 0", textAlign: "center", font: "400 15px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>
                  Nenhuma produção registrada nesta sessão.
                </div>
              )}
              {historico.map((h, i) => (
                <div key={i} className="r2row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 2px", borderBottom: i === historico.length - 1 ? 0 : "1px solid #f1f1f1" }}>
                  <span style={{ flex: "0 0 118px", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: INK }}>{h.maquina}</span>
                  <span style={{ flex: "0 0 70px", font: `500 14.5px/1 ${MONO}`, color: "#8d8b8d" }}>{h.os}</span>
                  <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.3 Inter,sans-serif", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.cliente}</span>
                  <span style={{ flex: "0 0 92px", font: `600 14.5px/1 ${MONO}`, color: INK }}>{h.tempo}</span>
                  <span style={{ flex: "0 0 92px", textAlign: "right", font: "600 14.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{h.metrosLabel}</span>
                  <span style={{ flex: "0 0 96px", textAlign: "right", font: "700 14.5px/1 Inter,sans-serif", color: INK }}>{h.custo}</span>
                  <span style={{ flex: "0 0 88px", textAlign: "center", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "6px 8px 4px", borderRadius: 999, background: h.tag === "Finalizado" ? AMARELO : "#f1f1f1", color: h.tag === "Finalizado" ? INK : "#8d8b8d" }}>{h.tag}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: "0 0 900px", display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
            {kpis.map((k) => {
              const escuro = k.tema === "escuro";
              const amarelo = k.tema === "amarelo";
              return (
                <div key={k.label} style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderRadius: 12, padding: "11px 16px", boxShadow: SOMBRA_CARD, background: escuro ? INK : amarelo ? AMARELO : "#fff" }}>
                  <div style={{ font: `800 ${k.valor.length > 6 ? 21 : 28}px/1 Inter,sans-serif`, letterSpacing: "-.03em", color: escuro ? "#f1f1f1" : INK }}>{k.valor}</div>
                  <div style={{ font: "600 12px/1.3 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 6, color: escuro ? "#b3b1b3" : "#5c5a5c" }}>{k.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <EstagioV1a altura={STAGE_H_FABRICA}>
      {comChrome && (
        <TopbarV1a
          nome={primeiroNome(profile.nome)}
          busca={busca}
          aoBuscar={setBusca}
          onSair={onLogout}
        />
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: comChrome ? 14 : 0 }}>
        {comChrome && (
          <RailV1a ativo="Fábrica" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />
        )}
        {conteudo}
      </div>

      {/* modal — cadastro de custos */}
      {custosAberto && (
        <div onClick={() => setCustosAberto(false)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 32, background: "rgba(37,36,37,.55)", backdropFilter: "blur(3px)" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 1180, maxWidth: "100%", maxHeight: "100%", display: "flex", flexDirection: "column", gap: 18, background: FUNDO, borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -40px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
              <div>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>R2 Hub · custos de máquina</div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Cadastro de custos</div>
                <div style={{ font: "400 15px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 10, maxWidth: 640 }}>
                  Cada máquina tem seu próprio cadastro: valor por hora, base por OS e observação. Só quem estiver liberado abaixo vê valores no painel.
                </div>
              </div>
              <button type="button" onClick={() => setCustosAberto(false)} className="r2ic" style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#fff", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 150px 1.3fr", gap: 12, paddingBottom: 12, borderBottom: "1px solid #ececec" }}>
                {["Máquina", "Valor por hora", "Base por OS", "Observação"].map((h) => (
                  <span key={h} style={{ font: `600 12px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3" }}>{h}</span>
                ))}
              </div>
              {lista.map((def) => {
                const st = estadoDe(def.k);
                return (
                  <div key={def.k} style={{ display: "grid", gridTemplateColumns: "1fr 150px 150px 1.3fr", gap: 12, alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f6f6f6" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ ...fr(48, 700), fontSize: 20, lineHeight: 1, letterSpacing: "-.02em", color: INK }}>{def.nome}</div>
                      <div style={{ font: `500 13.5px/1 ${MONO}`, letterSpacing: ".06em", textTransform: "uppercase", color: "#b3b1b3", marginTop: 7 }}>
                        {st.pedido ? `em uso · ${st.pedido.num}` : def.fixa ? "cadastro fixo" : "adicionada manualmente"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: FUNDO, borderRadius: 7, padding: "0 10px", height: 44 }}>
                      <span style={{ font: "600 13.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>R$</span>
                      <input
                        value={String(st.valor ?? def.valor ?? 0)}
                        readOnly={!podeCustosEditar}
                        onChange={(e) => { if (podeCustosEditar) patchMaq(def.k, { valor: Number(e.target.value.replace(/[^0-9.,]/g, "").replace(",", ".")) || 0 }); }}
                        style={{ flex: 1, minWidth: 0, textAlign: "right", background: "transparent", border: 0, outline: "none", font: "700 15px/1 Inter,sans-serif", color: podeCustosEditar ? INK : "#8d8b8d" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, background: FUNDO, borderRadius: 7, padding: "0 10px", height: 44 }}>
                      <span style={{ font: "600 13.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>R$</span>
                      <input
                        value={String(baseDe(def, st))}
                        readOnly={!podeCustosEditar}
                        /* guarda o que foi digitado; quem entende de vírgula e
                           ponto é o parseValorBR na hora de calcular */
                        onChange={(e) => { if (podeCustosEditar) patchMaq(def.k, { base: e.target.value.replace(/[^0-9.,]/g, "") }); }}
                        style={{ flex: 1, minWidth: 0, textAlign: "right", background: "transparent", border: 0, outline: "none", font: "700 15px/1 Inter,sans-serif", color: podeCustosEditar ? INK : "#8d8b8d" }}
                      />
                    </div>
                    <input
                      value={st.obs || ""}
                      readOnly={!podeCustosEditar}
                      onChange={(e) => { if (podeCustosEditar) patchMaq(def.k, { obs: e.target.value }); }}
                      placeholder={podeCustosEditar ? "Ex.: inclui tinta e mão de obra" : "somente leitura"}
                      style={{ width: "100%", background: FUNDO, border: 0, borderRadius: 7, padding: "0 12px", height: 44, outline: "none", font: "500 15px/1 Inter,sans-serif", color: podeCustosEditar ? INK : "#8d8b8d" }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Com backend, quem vê valores é a permissão painel.custos_ver da
                Equipe — o quadro de nomes era do protótipo (8 pessoas fictícias
                num localStorage sem efeito nenhum) e fazia o gestor achar que
                tinha concedido acesso. */}
            {permissoes ? (
              <div style={{ flex: "none", background: INK, borderRadius: 12, padding: "18px 20px" }}>
                <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: AMARELO }}>Quem pode ver valores</span>
                <div style={{ font: "400 14.5px/1.5 Inter,sans-serif", color: "#b3b1b3", marginTop: 10 }}>
                  Controlado pela permissão <b style={{ color: "#f1f1f1" }}>Custos da fábrica (ver)</b> — ajuste em Equipe → Permissões de cada pessoa.
                </div>
              </div>
            ) : (
              <div style={{ flex: "none", background: INK, borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
                  <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: AMARELO }}>Quem pode ver valores</span>
                  <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{perm.length} de {EQUIPE.length} pessoas liberadas</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                  {EQUIPE.map((p) => {
                    const on = perm.includes(p.nome);
                    return (
                      <button key={p.nome} type="button" onClick={() => togglePerm(p.nome)} className="r2chip" style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 999, padding: "11px 15px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", background: on ? AMARELO : "#3a383a", color: on ? INK : "#b3b1b3" }}>
                        <span style={{ lineHeight: "14px" }}>{p.nome}</span>
                        <span style={{ font: `600 12px/1 ${MONO}`, letterSpacing: ".1em", textTransform: "uppercase", opacity: 0.7 }}>{p.cargo}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* modal — adicionar máquina */}
      {addAberto && (
        <div onClick={() => setAddAberto(false)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 620, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14, background: FUNDO, borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Fábrica · painel</div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1.1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>Adicionar máquina</div>
              </div>
              <button type="button" onClick={() => setAddAberto(false)} className="r2ic" style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD }}>
              <label style={{ display: "block", font: "600 15px/1 Inter,sans-serif", color: "#5c5a5c", marginBottom: 8 }}>Nome da máquina <span style={{ color: INK }}>*</span></label>
              <input
                value={novaNome}
                onChange={(e) => { setNovaNome(e.target.value); setAddErro(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") addMaquina(); }}
                placeholder="Ex.: Rotoflex"
                style={{ width: "100%", boxSizing: "border-box", background: FUNDO, border: `2px solid ${FUNDO}`, borderRadius: 7, padding: "13px 15px", font: "600 17px/1.2 Inter,sans-serif", color: INK, outline: "none" }}
              />
              <label style={{ display: "block", font: "600 15px/1 Inter,sans-serif", color: "#5c5a5c", margin: "20px 0 10px" }}>Onde ela entra <span style={{ color: INK }}>*</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  { k: "impressao" as const, label: "Impressora", nota: "entra na linha de cima" },
                  { k: "rebobinagem" as const, label: "Rebobinagem", nota: "entra em Rebobinadeiras" },
                ]).map((t) => {
                  const on = novaSetor === t.k;
                  return (
                    <button key={t.k} type="button" onClick={() => { setNovaSetor(t.k); setAddErro(""); }} className="r2chip"
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 7, textAlign: "left", border: `2px solid ${on ? INK : FUNDO}`, cursor: "pointer", borderRadius: 7, padding: "14px 15px", background: on ? INK : FUNDO, color: on ? AMARELO : "#5c5a5c" }}>
                      <span style={{ font: "700 15px/1.2 Inter,sans-serif" }}>{t.label}</span>
                      <span style={{ font: "400 13.5px/1.3 Inter,sans-serif", color: on ? "#b3b1b3" : "#8d8b8d" }}>{t.nota}</span>
                    </button>
                  );
                })}
              </div>
              <label style={{ display: "block", font: "600 15px/1 Inter,sans-serif", color: "#5c5a5c", margin: "20px 0 8px" }}>Valor por hora <span style={{ color: INK }}>*</span></label>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ font: "600 16px/1 Inter,sans-serif", color: "#b3b1b3" }}>R$</span>
                <input
                  value={novaValor}
                  onChange={(e) => setNovaValor(e.target.value.replace(/[^0-9.,]/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") addMaquina(); }}
                  placeholder="200"
                  style={{ flex: 1, minWidth: 0, background: FUNDO, border: `2px solid ${FUNDO}`, borderRadius: 7, padding: "13px 15px", font: "600 17px/1.2 Inter,sans-serif", color: INK, outline: "none" }}
                />
              </div>
              {addErro && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, background: "#fdeaea", borderRadius: 8, padding: "12px 14px" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2.6" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 4v10" /><path d="M12 18.5h.01" /></svg>
                  <span style={{ font: "600 14.5px/1.35 Inter,sans-serif", color: "#c0392b" }}>{addErro}</span>
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 220px", minWidth: 180, font: "400 14.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>
                {lista.length} máquinas no painel · {lista.filter((m) => !m.fixa).length} adicionadas manualmente
              </span>
              <button type="button" onClick={() => setAddAberto(false)} className="r2chip" style={{ flex: "none", background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>Cancelar</button>
              <button type="button" onClick={addMaquina} className="r2chip"
                style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 14.5px/1 Inter,sans-serif", cursor: novaNome.trim() && novaValor ? "pointer" : "not-allowed", background: novaNome.trim() && novaValor ? AMARELO : FUNDO, color: novaNome.trim() && novaValor ? INK : "#b3b1b3" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                <span style={{ lineHeight: "16px" }}>Adicionar ao painel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </EstagioV1a>
  );
}

/* ————— cartão de máquina (impressoras e rebobinadeiras usam o mesmo) ————— */
function CardMaquina({ def, st, podeCustos, decorrido, custoDe, onPausar, onFinalizar, onCancelar, onRemover }: {
  def: MaqDef;
  st: MaqEstado;
  podeCustos: boolean;
  decorrido: (m: MaqEstado) => number;
  custoDe: (def: MaqDef, st: MaqEstado) => number;
  /* sem a permissão a rota não passa o callback e o botão some */
  onPausar?: (k: string, patch: Partial<MaqEstado>) => void;
  onFinalizar?: (k: string) => void;
  onCancelar?: (k: string) => void;
  onRemover?: (k: string) => void;
}) {
  const ativo = !!st.pedido;
  const rodando = ativo && st.rodando;
  const ms = ativo ? decorrido(st) : 0;
  const custo = ativo ? custoDe(def, st) : 0;
  const claro = !ativo;
  const fg = claro ? INK : "#f1f1f1";
  const sub = claro ? "#8d8b8d" : "#b3b1b3";
  const removivel = !def.fixa && !MAQUINAS_FIXAS.some((x) => x.k === def.k) && !ativo;
  const divisoria = claro ? "#f1f1f1" : "rgba(241,241,241,.14)";

  const campos = [
    { k: "Substrato", v: ativo ? st.pedido!.substrato : "—" },
    { k: "Medida", v: ativo ? st.pedido!.medida : "—" },
    { k: "Cores", v: ativo ? st.pedido!.qtdCores : "—" },
    { k: "Entrega", v: ativo ? st.pedido!.prazo : "—" },
    { k: "Rolos", v: ativo && st.pedido!.rolos ? st.pedido!.rolos : "—" },
    { k: "Metragem", v: ativo && metrosDe(st.pedido) ? fmtM(metrosDe(st.pedido)) : "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRadius: 14, padding: "12px 16px 10px", boxShadow: SOMBRA_CARD, background: ativo ? INK : "#fff", borderLeft: `8px solid ${!ativo ? "#e0e0e0" : rodando ? AMARELO : "#8d8b8d"}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...fr(72, 700), fontSize: 23, lineHeight: 1.04, letterSpacing: "-.02em", whiteSpace: "nowrap", color: fg }}>{def.nome}</div>
          <div style={{ marginTop: 5, font: `500 13.5px/1.2 ${MONO}`, letterSpacing: ".04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: sub }}>
            {ativo ? st.pedido!.cliente : "livre"}
          </div>
        </div>
        <span style={{ flex: "none", marginTop: 3, font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 13px 6px", borderRadius: 999, background: !ativo ? "#f1f1f1" : rodando ? AMARELO : "#3a383a", color: !ativo || rodando ? INK : "#f1f1f1" }}>
          {!ativo ? "livre" : rodando ? "rodando" : "pausada"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 8, borderRadius: 7, padding: "6px 12px", background: ativo ? AMARELO : claro ? "#f6f6f6" : "#333133", border: ativo ? undefined : `2px dashed ${claro ? "#e0e0e0" : "#454345"}` }}>
        <span style={{ flex: "none", font: "800 11px/1 Inter,sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: ativo ? "#5c5a5c" : claro ? "#b3b1b3" : "#8d8b8d" }}>OP</span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "right", font: `800 21px/1 ${MONO}`, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: ativo ? INK : claro ? "#d6d5d6" : "#5c5a5c" }}>
          {ativo ? st.pedido!.num.replace("#", "") : "—"}
        </span>
      </div>

      <div style={{ margin: "7px 0 1px", font: `800 24px/1 ${MONO}`, fontVariantNumeric: "tabular-nums", letterSpacing: "-.03em", color: rodando ? AMARELO : ativo ? "#f1f1f1" : "#d6d5d6" }}>{hms(ms)}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 10px", marginTop: 9, paddingTop: 9, borderTop: `1px solid ${divisoria}` }}>
        {campos.map((c) => (
          <div key={c.k} style={{ minWidth: 0 }}>
            <div style={{ font: `600 9.5px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", whiteSpace: "nowrap", color: claro ? "#b3b1b3" : "#8d8b8d" }}>{c.k}</div>
            <div style={{ marginTop: 4, font: "700 14.5px/1.15 Inter,sans-serif", letterSpacing: "-.01em", overflowWrap: "anywhere", color: fg }}>{c.v}</div>
          </div>
        ))}
      </div>

      {podeCustos ? (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, margin: "9px 0 2px", paddingTop: 9, borderTop: `1px solid ${divisoria}` }}>
          <span style={{ flex: "none", whiteSpace: "nowrap", font: `600 12px/1 ${MONO}`, letterSpacing: ".12em", textTransform: "uppercase", color: sub }}>Custo</span>
          <span style={{ flex: "none", whiteSpace: "nowrap", font: "800 21px/1 Inter,sans-serif", letterSpacing: "-.03em", color: ativo ? AMARELO : "#d6d5d6" }}>{brl(custo)}</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, margin: "14px 0 4px", paddingTop: 12, borderTop: `1px solid ${divisoria}` }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", font: `600 10px/1 ${MONO}`, letterSpacing: ".12em", textTransform: "uppercase", color: sub }}>Custos</span>
          <span style={{ font: `600 13.5px/1 ${MONO}`, letterSpacing: ".1em", textTransform: "uppercase", color: claro ? "#b3b1b3" : "#8d8b8d" }}>restrito</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: "auto" }}>
        <button
          type="button"
          className="r2chip"
          onClick={() => {
            if (!ativo || !onPausar) return;
            if (rodando) onPausar(def.k, { rodando: false, acumulado: decorrido(st), inicio: 0 });
            else onPausar(def.k, { rodando: true, inicio: Date.now() });
          }}
          style={{ display: onPausar ? "block" : "none", width: "100%", border: 0, borderRadius: 7, padding: 12, cursor: ativo ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", background: !ativo ? (claro ? "#f1f1f1" : "#3a383a") : rodando ? "#3a383a" : AMARELO, color: !ativo ? "#b3b1b3" : rodando ? "#f1f1f1" : INK }}
        >
          {!ativo ? "Sem OS carregada" : rodando ? "Pausar" : "Retomar"}
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="r2chip" onClick={() => onFinalizar?.(def.k)}
            style={{ display: onFinalizar ? "block" : "none", flex: 1, border: 0, borderRadius: 7, padding: "10px 8px", cursor: ativo ? "pointer" : "not-allowed", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".03em", textTransform: "uppercase", background: ativo ? AMARELO : claro ? "#f1f1f1" : "#3a383a", color: ativo ? INK : "#b3b1b3" }}>
            Finalizar
          </button>
          <button type="button" className="r2chip" onClick={() => onCancelar?.(def.k)}
            style={{ display: onCancelar ? "block" : "none", flex: 1, border: 0, borderRadius: 7, padding: "10px 8px", cursor: ativo ? "pointer" : "not-allowed", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".03em", textTransform: "uppercase", background: claro ? "#f1f1f1" : "#3a383a", color: ativo ? (claro ? "#5c5a5c" : "#f1f1f1") : "#b3b1b3" }}>
            Cancelar
          </button>
        </div>
        {removivel && onRemover && (
          <button type="button" onClick={() => onRemover(def.k)}
            style={{ width: "100%", border: 0, background: "transparent", padding: "8px 0 0", cursor: "pointer", font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: claro ? "#b3b1b3" : "#8d8b8d" }}>
            Remover máquina
          </button>
        )}
      </div>
    </div>
  );
}
