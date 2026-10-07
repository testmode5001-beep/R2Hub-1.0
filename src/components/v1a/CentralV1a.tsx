// Central V1a — recriação fiel de `Central.dc.html` (handoff v1a, hifi):
//   · coluna esquerda (624px): título Fraunces 80, calendário do mês (dia
//     atual amarelo, entregas sublinhadas, "Anotação para este dia"), cards
//     de contagem Clichês/Substrato/Medidas (barras), Anotações e Pódio
//   · coluna direita: "Em aberto" com card grande (612px) + cards verticais
//     (98px, nome em escrita vertical; clique expande), Resumo de artes
//     (3 KPIs mensais + seletor de mês) e Finalizados recentes (tabela com
//     colunas ordenáveis)
//   · dados reais do app adaptados ao formato do protótipo (paraCentral /
//     paraFinalizados); anotações persistem em localStorage.
import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import { criarBusca } from "@/lib/busca";
import { prazoDoPedido } from "@/lib/prazo";
import { feriadoEm } from "@/lib/feriados";
import type { SessionUser } from "@/lib/session";
import { useHubDados } from "./HubDadosV1a";
import {
  AMARELO, AvisoV1a, EstagioV1a, FUNDO, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr, nomeEmPe,
} from "./HubV1a";

/* ————— Status do app → visual v1a (STATUS/ORELHA do protótipo) ————— */
const ST_V1A: Record<string, { label: string; abrev: string; bg: string; fg: string; orelha: string }> = {
  nova: { label: "Aguardando Design", abrev: "Aguard. design", bg: "#f1f1f1", fg: INK, orelha: "#d6d5d6" },
  criacao: { label: "Aguardando Design", abrev: "Aguard. design", bg: "#f1f1f1", fg: INK, orelha: "#d6d5d6" },
  /* `aguardando` = arte entregue, a vez é da vendedora (cinza, calmo).
     `revisao` = ela pediu alteração, a vez é do design (escuro, chama). */
  aguardando: { label: "Aguardando aprovação", abrev: "Aguard. aprov.", bg: "#f1f1f1", fg: "#6f6d6f", orelha: "#b3b1b3" },
  revisao: { label: "Alteração pedida", abrev: "Alteração", bg: INK, fg: "#f1f1f1", orelha: AMARELO },
  aprovada: { label: "Design aprovado", abrev: "Design aprov.", bg: INK, fg: AMARELO, orelha: INK },
  cliche: { label: "Clichê solicitado", abrev: "Clichê solic.", bg: AMARELO, fg: INK, orelha: "#8d8b8d" },
  concluido: { label: "Finalizado", abrev: "Finalizado", bg: "#f1f1f1", fg: "#8d8b8d", orelha: "#d6d5d6" },
  cancelado: { label: "Finalizado", abrev: "Finalizado", bg: "#f1f1f1", fg: "#8d8b8d", orelha: "#d6d5d6" },
};

/** Corpo do valor no cartão: encolhe conforme o texto cresce, para "CÓD PRD-30045"
    não empurrar o layout como "70×50" não empurra. */
const corpoValor = (v: string) => (v.length <= 8 ? 17 : v.length <= 12 ? 14.5 : 12.5);

const EM_ANDAMENTO = (s: string) => !["concluido", "cancelado"].includes(s);
/** Pedido que já saiu do "aguardando design" e agora está parado esperando
 *  alguém (revisão, aprovação, clichê). Na Central esses cards ficam amarelos:
 *  branco = ninguém pegou ainda, amarelo = começou e está na fila de alguém. */
const COMECOU_E_ESPERA = (s: string) => ["aguardando", "revisao", "aprovada", "cliche"].includes(s);
/** Parado na aprovação: cinza, para não disputar atenção com o que anda. */
const NA_APROVACAO = (s: string) => s === "aprovada";
const CINZA = "#e2e0e2";
const DIA_MS = 86_400_000;
const NOTAS_KEY = "r2hub.v1a.notas";

const fmt2 = (n: number) => String(n).padStart(2, "0");
const fmtData = (d: Date) => `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;

type Nota = { id?: string; texto: string; quando: string; feito?: boolean };

/** Adaptador: pedido do app → card da Central v1a (paraCentral do handoff). */
function paraCentral(p: any) {
  const st = ST_V1A[p.status] ?? ST_V1A.nova;
  const isCliche = p.tipo === "cliche";
  const prazoDate = prazoDoPedido(p);
  const diff = Math.round((prazoDate.getTime() - Date.now()) / DIA_MS);
  const origem: "vendas" | "producao" | "interno" = p.origem ?? (isCliche ? "interno" : "vendas");
  const partes = isCliche
    ? [`CÓD ${p.codigo_produto ?? "—"}`, "Reposição", "—"]
    : [`${p.largura}x${p.altura}`, p.materia ?? "—", p.cores ? `${p.cores} cores` : "—"];
  return {
    raw: p,
    num: `#${String(p.numero).padStart(2, "0")}`,
    cliente: p.cliente as string,
    spec: partes.join(" · "),
    partes,
    status: st.label,
    abrev: st.abrev,
    chipBg: st.bg,
    chipFg: st.fg,
    orelha: p.faltaMP ? "#c0392b" : st.orelha,
    faltaMP: !!p.faltaMP,
    origem,
    prazo: fmtData(prazoDate),
    prazoDia: prazoDate.getDate(),
    prazoMes: prazoDate.getMonth(),
    prazoAno: prazoDate.getFullYear(),
    atraso: diff < 0,
    dias: Math.abs(diff),
  };
}
type CardV1a = ReturnType<typeof paraCentral>;

/* ————— Tela ————— */
export function CentralV1a({ profile, pedidos, versao, onOpen, onVerTodos, aoNavegar, onNova, onLogout, disponiveis, children }: {
  profile: SessionUser;
  pedidos: any[];
  versao?: string;
  onOpen: (id: string) => void;
  onVerTodos: () => void;
  /** navegação do rail por label v1a ("Home", "Central", …) */
  aoNavegar: (label: string) => void;
  onNova: () => void;
  onLogout: () => void;
  /** labels do rail com tela no app */
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
}) {
  const hoje = new Date();
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  const [abertoIdx, setAbertoIdx] = useState(0);
  const [cal, setCal] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });
  const [dia, setDia] = useState(hoje.getDate());
  const [novaNota, setNovaNota] = useState("");
  const dados = useHubDados();
  const notasReais = Array.isArray(dados.notas);
  const [notasLocais, setNotasLocais] = useState<Nota[]>(() => {
    try { return JSON.parse(localStorage.getItem(NOTAS_KEY) ?? "[]"); } catch { return []; }
  });
  // Com o provider da rota, as anotações são as mesmas do modal do topo.
  const notas: Nota[] = notasReais
    ? dados.notas!.map((n) => ({ id: n.id, texto: n.texto, quando: n.quando ?? "", feito: n.feito }))
    : notasLocais;
  // Pódio só de Designer (finalizadas/dia) — perfil Vendas removido a pedido.
  const [mesResumo, setMesResumo] = useState(3); // índice no janelão de 4 meses (3 = atual)
  const [ordem, setOrdem] = useState<{ campo: string | null; dir: 1 | -1 }>({ campo: null, dir: 1 });
  const [linha, setLinha] = useState<number>(-1);
  const [filtroFin, setFiltroFin] = useState<"aprovadas" | "canceladas" | null>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  function salvarNotas(prox: Nota[]) {
    if (notasReais) return; // no modo real quem grava são os callbacks
    setNotasLocais(prox);
    try { localStorage.setItem(NOTAS_KEY, JSON.stringify(prox)); } catch { /* storage bloqueado */ }
  }

  function alternarNota(i: number) {
    const n = notas[i];
    if (notasReais) { dados.aoAlternarNota?.(n.id!, !n.feito); return; }
    salvarNotas(notas.map((x, j) => (j === i ? { ...x, feito: !x.feito } : x)));
  }

  const cards = useMemo(() => pedidos.map(paraCentral), [pedidos]);
  const emAberto = useMemo(() => {
    const casa = criarBusca(busca);
    return cards
      .filter((c) => EM_ANDAMENTO(c.raw.status))
      .filter((c) => casa(c.cliente, c.num, c.spec));
  }, [cards, busca]);
  const atrasados = emAberto.filter((c) => c.atraso);
  const vis = emAberto.slice(0, 6);

  /* Contagens dos 3 cards de barras (dados reais). */
  const contagens = useMemo(() => {
    const abertos = cards.filter((c) => EM_ANDAMENTO(c.raw.status));
    const por = (chave: (c: CardV1a) => string | null) => {
      const m: Record<string, number> = {};
      for (const c of abertos) { const k = chave(c); if (k) m[k] = (m[k] ?? 0) + 1; }
      return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nome, n]) => ({ nome, n }));
    };
    return {
      cliches: por((c) => c.abrev),
      substratos: por((c) => (c.raw.tipo === "cliche" ? null : (c.raw.materia ?? "").trim() || null)),
      medidas: por((c) => (c.raw.tipo === "cliche" ? null : `${c.raw.largura}x${c.raw.altura}`)),
    };
  }, [cards]);

  /* Calendário: entregas do mês visível. */
  const entregasMes = useMemo(
    () => emAberto.filter((c) => c.prazoMes === cal.mes && c.prazoAno === cal.ano),
    [emAberto, cal],
  );
  const diasEntrega = entregasMes.map((c) => c.prazoDia);
  const primeiro = new Date(cal.ano, cal.mes, 1).getDay();
  const totalDias = new Date(cal.ano, cal.mes + 1, 0).getDate();

  /* Pódio: top 5 dias do Designer (finalizadas/dia). */
  const podio = useMemo(() => {
    const por: Record<string, number> = {};
    for (const p of pedidos) {
      if (p.status !== "concluido") continue;
      /* mesma correção do resumo: o dia do fechamento é o `cliche_concluido_em`,
         não o `updated_at`, que anda a cada edição do pedido */
      const d = new Date(p.cliche_concluido_em ?? p.updated_at ?? p.created_at);
      const k = `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}`;
      por[k] = (por[k] ?? 0) + 1;
    }
    return Object.entries(por).sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).slice(0, 5);
  }, [pedidos]);
  const MEDALHA = [AMARELO, INK, "#e4e4e4", "#f1f1f1", "#f1f1f1"];
  const TINTA = [INK, AMARELO, "#5c5a5c", "#8d8b8d", "#8d8b8d"];

  /* Resumo de artes: janela dos últimos 4 meses (dados reais). */
  const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const janela = useMemo(() => Array.from({ length: 4 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (3 - i), 1);
    const doMes = (s?: string) => s && new Date(s).getMonth() === d.getMonth() && new Date(s).getFullYear() === d.getFullYear();
    return {
      chip: MESES_PT[d.getMonth()].slice(0, 3),
      nome: `${MESES_PT[d.getMonth()]} ${d.getFullYear()}`,
      solicitadas: pedidos.filter((p) => doMes(p.created_at)).length,
      /* `cliche_concluido_em` é gravado no instante em que o pedido fecha.
         Datar pelo `updated_at` fazia o pedido MUDAR DE MÊS a cada edição —
         um trabalho fechado em julho, corrigido em agosto, migrava sozinho
         para agosto e o total do mês passado encolhia sem ninguém mexer nele.
         O updated_at fica só como reserva, para registro antigo sem o campo. */
      finalizadas: pedidos.filter((p) => p.status === "concluido" && doMes(p.cliche_concluido_em ?? p.updated_at ?? p.created_at)).length,
      /* mesma regra do fechamento: o dia do cancelamento é o `cancelado_em`.
         O updated_at fica de reserva para pedido cancelado antes da coluna
         existir — e esses foram carimbados na migração, então não andam mais. */
      canceladas: pedidos.filter((p) => p.status === "cancelado" && doMes(p.cancelado_em ?? p.updated_at ?? p.created_at)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pedidos]);
  const resumoAtual = janela[mesResumo];
  const resumoAnt = mesResumo > 0 ? janela[mesResumo - 1] : null;

  /* Finalizados. */
  const finalizados = useMemo(() => {
    let lista = cards
      .filter((c) => !EM_ANDAMENTO(c.raw.status))
      .map((c) => ({
        ...c,
        medida: c.raw.tipo === "cliche" ? `CÓD ${c.raw.codigo_produto ?? "—"}` : `${c.raw.largura}x${c.raw.altura}`,
        sub: c.raw.tipo === "cliche" ? "Clichê" : (c.raw.materia ?? "—"),
        solic: fmtData(new Date(c.raw.created_at)),
        /* data do desfecho: finalizado usa o carimbo do fechamento e cancelado
           mostra "—" na coluna, mas ambos vêm do campo próprio, não do
           updated_at, que anda a cada edição do pedido */
        apro: c.raw.status === "cancelado" ? "—" : fmtData(new Date(c.raw.cliche_concluido_em ?? c.raw.updated_at ?? c.raw.created_at)),
        tipo: c.raw.status === "cancelado" ? "x" : "ok",
      }));
    /* Filtra pelo STATUS, não pela coluna "Apro." estar vazia. O atalho antigo
       (`apro === "—"`) dava certo por tabela: o "—" só aparecia em cancelado.
       Mas é o desenho da coluna decidindo o filtro — qualquer finalizado que
       viesse sem data cairia na lista de cancelados. */
    if (filtroFin === "aprovadas") lista = lista.filter((r) => r.raw.status !== "cancelado");
    if (filtroFin === "canceladas") lista = lista.filter((r) => r.raw.status === "cancelado");
    const { campo, dir } = ordem;
    if (campo) {
      const num = (m: string) => { const p = m.toLowerCase().split("x"); return [parseFloat(p[0]) || 0, parseFloat(p[1]) || 0]; };
      const data = (d: string) => { const p = d.split("/"); return p.length === 3 ? new Date(2000 + +p[2], +p[1] - 1, +p[0]).getTime() : Infinity; };
      const cmp: Record<string, (a: any, b: any) => number> = {
        cliente: (a, b) => a.cliente.localeCompare(b.cliente, "pt"),
        medida: (a, b) => { const x = num(a.medida), y = num(b.medida); return x[0] - y[0] || x[1] - y[1]; },
        sub: (a, b) => a.sub.localeCompare(b.sub, "pt"),
        solic: (a, b) => data(a.solic) - data(b.solic),
        apro: (a, b) => data(a.apro) - data(b.apro),
      };
      lista = lista.slice().sort((a, b) => cmp[campo](a, b) * dir);
    }
    return lista.slice(0, 8);
  }, [cards, filtroFin, ordem]);

  const notasAbertas = notas.filter((n) => !n.feito).length;

  function addNota() {
    const texto = novaNota.trim();
    if (!texto) return;
    const quando = `${fmt2(dia)}/${fmt2(cal.mes + 1)}`;
    if (notasReais && dados.aoCriarNota) {
      /* sucesso só DEPOIS do servidor confirmar — antes o aviso "adicionada"
         aparecia mesmo com o servidor recusando, e a nota não existia */
      setNovaNota("");
      Promise.resolve(dados.aoCriarNota(texto, quando))
        .then(() => setAviso(`Anotação de ${quando} adicionada.`))
        .catch((e: unknown) => { setNovaNota(texto); setAviso(e instanceof Error ? e.message : "Não deu para salvar a anotação."); });
      return;
    }
    salvarNotas([{ texto, quando }, ...notas]);
    setNovaNota("");
    setAviso(`Anotação de ${quando} adicionada.`);
  }

  const CARD_BRANCO = { background: "#fff", borderRadius: 12, boxShadow: SOMBRA_CARD } as const;

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
          ativo="Central"
          permitidas={disponiveis}
          aoNavegar={aoNavegar}
          onNovo={onNova}
          versao={versao}
        />

        {/* ————— Coluna esquerda (624px) ————— */}
        <div style={{ flex: "0 0 624px", width: 624, maxWidth: 624, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
          {/* Sem aviso de atraso aqui: a tela já conta isso em três lugares —
              "N atrasados" no cabeçalho de Em aberto, a pílula "há Xd" em cada
              card e o ponto amarelo nos cards fechados. Um quarto lugar só
              disputava espaço com o título. */}
          <h1 className="select-none" style={{ ...fr(144, 900), fontSize: 80, lineHeight: 0.86, letterSpacing: 0, color: INK, margin: "2px 0 2px 6px" }}>Central</h1>

          {/* Calendário */}
          <div style={{ ...CARD_BRANCO, padding: "22px 26px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
              <div className="select-none" style={{ flex: "none", whiteSpace: "nowrap", ...fr(72, 700), fontSize: 20, lineHeight: 1, color: INK, letterSpacing: "-.02em" }}>
                {MESES_PT[cal.mes]} <span style={{ color: AMARELO }}>{cal.ano}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ font: "600 13.5px/1 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3", whiteSpace: "nowrap" }}>
                  {entregasMes.length} {entregasMes.length === 1 ? "entrega" : "entregas"}
                </span>
                <div style={{ display: "flex", gap: 5 }}>
                  {([["‹", -1], ["›", 1]] as const).map(([s, d]) => (
                    <button key={s} onClick={() => setCal((c) => { const n = new Date(c.ano, c.mes + d, 1); return { ano: n.getFullYear(), mes: n.getMonth() }; })}
                      style={{ width: 28, height: 28, display: "grid", placeItems: "center", background: FUNDO, border: 0, borderRadius: 5, cursor: "pointer", font: "600 15px/1 Inter, sans-serif", color: INK }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${FUNDO}`, marginBottom: 6 }}>
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((l, i) => (
                <div key={l} className="select-none" style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".12em", textTransform: "uppercase", textAlign: "center", padding: "0 0 10px", color: i === 0 || i === 6 ? "#d6d5d6" : "#8d8b8d" }}>{l}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {Array.from({ length: primeiro }, (_, i) => <div key={`v${i}`} style={{ height: 38 }} />)}
              {Array.from({ length: totalDias }, (_, i) => {
                const d = i + 1;
                const on = dia === d;
                const col = (primeiro + d - 1) % 7;
                const fds = col === 0 || col === 6;
                const marca = diasEntrega.includes(d);
                const pedidoDoDia = entregasMes.find((c) => c.prazoDia === d);
                /* feriado nacional/municipal: o dia fica marcado e o nome vai
                   no title — prazo caindo em feriado é problema na fábrica */
                const feriado = feriadoEm(`${cal.ano}-${fmt2(cal.mes + 1)}-${fmt2(d)}`);
                return (
                  <button
                    key={d}
                    title={feriado ? `${feriado.nome}${feriado.tipo === "municipal" ? " · São Paulo" : feriado.tipo === "facultativo" ? " · ponto facultativo" : ""}` : undefined}
                    onClick={() => { setDia(d); if (pedidoDoDia) onOpen(pedidoDoDia.raw.id); }}
                    style={{ position: "relative", height: 38, border: 0, cursor: "pointer", borderRadius: 6, font: `${on || marca ? 700 : 400} 15px/1 Inter, sans-serif`, background: on ? AMARELO : feriado && !fds ? "#ececec" : "transparent", color: on || marca ? INK : fds || feriado ? "#b3b1b3" : "#8d8b8d" }}
                  >
                    {d}
                    {marca && !on && <span style={{ position: "absolute", left: "50%", bottom: 4, transform: "translateX(-50%)", width: 16, height: 3, borderRadius: 1, background: AMARELO }} />}
                    {feriado && !marca && !on && <span style={{ position: "absolute", left: "50%", bottom: 5, transform: "translateX(-50%)", width: 4, height: 4, borderRadius: 999, background: "#c0392b" }} />}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${FUNDO}` }}>
              <span className="select-none" style={{ flex: "none", font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>
                {fmt2(dia)}/{fmt2(cal.mes + 1)}
              </span>
              <input
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNota(); }}
                placeholder="Anotação para este dia"
                style={{ flex: 1, minWidth: 0, background: FUNDO, border: `2px solid ${FUNDO}`, borderRadius: 7, padding: "10px 12px", font: "500 15px/1 Inter, sans-serif", color: INK, outline: "none" }}
              />
              <button onClick={addNota} className="r2chip" style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, border: 0, borderRadius: 7, padding: "11px 14px", cursor: novaNota.trim() ? "pointer" : "not-allowed", font: "700 13.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", background: novaNota.trim() ? AMARELO : FUNDO, color: novaNota.trim() ? INK : "#b3b1b3" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={novaNota.trim() ? INK : "#b3b1b3"} strokeWidth="3" strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                Anotar
              </button>
            </div>
          </div>

          {/* Clichês / Substrato / Medidas — mesma grade de 3 colunas da faixa
              de baixo (Anotações + Pódio), senão as bordas verticais das duas
              fileiras não batem: eram flex com gap 10 aqui e 12 lá embaixo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, alignItems: "stretch" }}>
            {([["Clichês", contagens.cliches], ["Substrato", contagens.substratos], ["Medidas", contagens.medidas]] as const).map(([titulo, lista]) => {
              const max = Math.max(1, ...lista.map((c) => c.n));
              return (
                <div key={titulo} style={{ flex: 1, minWidth: 0, ...CARD_BRANCO, padding: "18px 18px 16px" }}>
                  <div className="select-none" style={{ font: "800 19px/1 Inter, sans-serif", color: INK, marginBottom: 14, letterSpacing: "-.01em" }}>{titulo}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {lista.length === 0 && <div style={{ font: "400 14px/1.4 Inter, sans-serif", color: "#b3b1b3" }}>Sem dados ainda.</div>}
                    {lista.map((c) => (
                      <div key={c.nome} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 30 }}>
                        <span className="truncate" style={{ flex: "0 0 auto", maxWidth: "55%", font: "400 15px/1.2 Inter, sans-serif", color: INK, whiteSpace: "nowrap" }}>{c.nome}</span>
                        <span style={{ position: "relative", flex: "1 1 auto", height: 19, background: "#e8e8e8", borderRadius: 3, overflow: "hidden" }}>
                          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 7, width: `${Math.round(38 + 62 * (c.n / max))}%`, background: INK, borderRadius: 3 }}>
                            <span style={{ font: "800 12.5px/1 Inter, sans-serif", color: AMARELO }}>{c.n}</span>
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anotações + Pódio */}
          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10, alignItems: "stretch", minWidth: 0 }}>
            <div style={{ gridColumn: "span 2", minWidth: 0, display: "flex", flexDirection: "column", ...CARD_BRANCO, padding: "16px 22px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span className="select-none" style={{ font: "800 19px/1 Inter, sans-serif", color: INK, letterSpacing: "-.01em" }}>Anotações</span>
                  {notasAbertas > 0 && <span style={{ font: "800 12.5px/1 Inter, sans-serif", color: INK, background: AMARELO, padding: "4px 7px", borderRadius: 999 }}>{notasAbertas}</span>}
                </div>
                <span style={{ font: "400 13.5px/1 Inter, sans-serif", color: "#b3b1b3" }}>clique para concluir</span>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
                {notas.length === 0 && <div style={{ font: "400 14.5px/1.4 Inter, sans-serif", color: "#b3b1b3", paddingTop: 6 }}>Sem anotações. Use o campo do calendário para criar a primeira.</div>}
                {notas.map((a, i) => (
                  <button
                    key={a.id ?? `${a.texto}-${i}`}
                    onClick={() => alternarNota(i)}
                    className="r2row"
                    style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 44, textAlign: "left", background: "transparent", border: 0, padding: "6px 2px", cursor: "pointer", borderBottom: i === notas.length - 1 ? 0 : `1px solid ${FUNDO}` }}
                  >
                    <span style={{ flex: "0 0 22px", height: 22, display: "grid", placeItems: "center", borderRadius: 4, background: a.feito ? INK : FUNDO }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={a.feito ? AMARELO : "#d6d5d6"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.35 Inter, sans-serif", color: a.feito ? "#b3b1b3" : INK, textDecoration: a.feito ? "line-through" : "none" }}>{a.texto}</span>
                    <span style={{ font: "500 13.5px/1 Inter, sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{a.quando}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pódio */}
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", ...CARD_BRANCO, padding: "16px 16px 14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0, marginBottom: 12 }}>
                <span className="select-none truncate" style={{ font: "700 12.5px/1.2 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#8d8b8d" }}>Pódio</span>
                <div style={{ display: "flex", gap: 5, minWidth: 0 }}>
                  <span style={{ borderRadius: 999, padding: "7px 12px 6px", font: "700 11.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: INK, color: AMARELO }}>
                    Designer
                  </span>
                </div>
              </div>
              {podio.length === 0 && (
                <div style={{ font: "400 14.5px/1.4 Inter, sans-serif", color: "#b3b1b3", textWrap: "pretty" as any }}>Sem registros neste perfil ainda. Os melhores dias aparecem aqui.</div>
              )}
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {podio.map(([diaK, qtd], i) => (
                  <div key={diaK} className="r2row" style={{ flex: "1 1 0", minHeight: 44, display: "flex", alignItems: "center", gap: 9, width: "100%", minWidth: 0, background: i === 0 ? "#fffbe0" : "#fafafa", borderRadius: 9, padding: "10px 11px" }}>
                    <span style={{ flex: "0 0 26px", height: 26, display: "grid", placeItems: "center", borderRadius: 999, font: "800 12.5px/1 Inter, sans-serif", background: MEDALHA[i], color: TINTA[i] }}>{i + 1}º</span>
                    <span className="truncate" style={{ flex: 1, minWidth: 0, textAlign: "left", font: `700 14px/1.15 ${MONO}`, letterSpacing: "-.01em", color: INK }}>{diaK}</span>
                    <span style={{ flex: "none", font: "800 19px/1 Inter, sans-serif", letterSpacing: "-.02em", color: INK }}>{qtd}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ————— Coluna direita ————— */}
        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 12, minWidth: 0, minHeight: 0, overflow: "hidden" }}>

          {/* Em aberto */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 73, padding: "0 4px 10px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
              <h2 className="select-none" style={{ font: "800 38px/1 Inter, sans-serif", letterSpacing: "-.03em", color: INK, margin: 0, whiteSpace: "nowrap" }}>Em aberto</h2>
              <span style={{ font: "400 15px/1 Inter, sans-serif", color: "#8d8b8d" }}>
                {emAberto.length} pedidos · {atrasados.length} atrasados · clique num card para abrir
              </span>
            </div>
            <button onClick={onVerTodos} className="r2chip" style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "400 15px/1 Inter, sans-serif", color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}>Ver todos</button>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-start", gap: 10, height: 206 }}>
            {vis.length === 0 && (
              <div style={{ flex: 1, display: "grid", placeItems: "center", background: "#fff", border: "2px dashed #d6d5d6", borderRadius: 15, font: "400 15px/1.4 Inter, sans-serif", color: "#8d8b8d" }}>
                Nenhum pedido em aberto com esse filtro.
              </div>
            )}
            {vis.map((c, i) => {
              const aberto = Math.min(abertoIdx, vis.length - 1) === i;
              const prod = c.origem === "producao";
              const escuro = c.origem === "interno";
              /* amarelo = cartão da produção OU pedido que já começou e está
                 esperando alguém. Branco fica só para o que ninguém pegou. */
              const cinza = !escuro && !prod && NA_APROVACAO(c.raw.status);
              const amarelo = !escuro && !cinza && (prod || COMECOU_E_ESPERA(c.raw.status));
              /* a orelha colorida saiu: com o cartão inteiro trocando de cor
                 por status, ela virou barulho. Falta de MP continua marcada —
                 no aberto pelo chip "sem MP", no fechado pelo ponto vermelho. */
              const neutro = amarelo ? "rgba(37,36,37,.12)" : escuro ? "#3a383a" : cinza ? "#fff" : FUNDO;
              const neutroFg = amarelo ? "#5c5a5c" : escuro ? "#b3b1b3" : cinza ? "#5c5a5c" : "#8d8b8d";
              const bg = amarelo ? AMARELO : escuro ? INK : cinza ? CINZA : "#fff";
              return (
                <div
                  key={c.raw.id}
                  className="r2card"
                  onClick={() => { if (aberto) onOpen(c.raw.id); else setAbertoIdx(i); }}
                  style={{ flex: aberto ? "0 0 612px" : "0 0 98px", position: "relative", textAlign: "left", overflow: "hidden", borderRadius: 15, boxShadow: SOMBRA_CARD, cursor: "pointer", background: bg }}
                >
                  {aberto ? (
                    <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "stretch", gap: 22, height: "100%", padding: "18px 20px 16px" }}>
                      <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", whiteSpace: "nowrap", color: escuro ? "#b3b1b3" : amarelo ? "rgba(37,36,37,.62)" : "#8d8b8d" }}>
                          {c.num} / {prod ? "PRODUÇÃO" : escuro ? "INTERNO" : "VENDAS"}
                        </span>
                        <h3 style={{ margin: "auto 0 0", ...fr(96, 700), fontSize: 34, lineHeight: 1.14, letterSpacing: "-.03em", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", color: escuro ? "#f1f1f1" : INK }}>
                          {c.cliente}
                        </h3>
                        <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 6, margin: "14px 0 0 -1px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, padding: "9px 13px", font: `600 12.5px/1 ${MONO}`, letterSpacing: ".12em", textTransform: "uppercase", whiteSpace: "nowrap", border: `1.5px solid ${escuro ? "rgba(241,241,241,.5)" : amarelo ? "rgba(37,36,37,.4)" : "#d6d5d6"}`, color: escuro ? "#f1f1f1" : INK }}>
                            Abrir pedido
                          </span>
                          <span style={{ font: "700 12px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 10px", borderRadius: 999, background: amarelo ? "#fff" : escuro ? "#3a383a" : c.chipBg, color: amarelo ? INK : escuro ? "#f1f1f1" : c.chipFg }}>
                            {c.abrev}
                          </span>
                          <span style={{ font: "700 12.5px/1 Inter, sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "7px 11px 6px", borderRadius: 999, ...(c.faltaMP ? { background: "#c0392b", color: "#fff" } : { background: c.atraso ? (escuro ? AMARELO : INK) : neutro, color: c.atraso ? (escuro ? INK : AMARELO) : neutroFg }) }}>
                            {c.faltaMP ? "sem MP" : c.atraso ? `há ${c.dias}d` : `em ${c.dias}d`}
                          </span>
                        </div>
                      </div>
                      <div style={{ width: 1, alignSelf: "stretch", background: escuro ? "rgba(241,241,241,.16)" : amarelo ? "rgba(37,36,37,.16)" : "#ececec" }} />
                      <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
                        <span style={{ display: "grid", placeItems: "center", flex: "none", width: 26, height: 26, borderRadius: 999, border: `1.5px solid ${escuro ? "rgba(241,241,241,.45)" : amarelo ? "rgba(37,36,37,.35)" : "#d6d5d6"}` }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={escuro ? "#f1f1f1" : INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 17.5 17.5 6.5" /><path d="M9.5 6.5h8v8" /></svg>
                        </span>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "16px 26px", justifyItems: "end", maxWidth: 300 }}>
                          {[["Medida", c.partes[0]], ["Substrato", c.partes[1]], ["Cores", c.partes[2]], ["Entrega", c.prazo]].map(([k, v]) => (
                            <div key={k} style={{ minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                              <span style={{ font: `600 12.5px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", whiteSpace: "nowrap", color: escuro ? "#8d8b8d" : amarelo ? "rgba(37,36,37,.5)" : "#b3b1b3" }}>{k}</span>
                              {/* valor longo encolhe em vez de empurrar o cartão */}
                              <span title={String(v)}
                                style={{ ...fr(48, 700), fontSize: corpoValor(String(v ?? "")), lineHeight: 1.05, letterSpacing: "-.01em", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right", color: escuro ? "#f1f1f1" : INK }}>
                                {v}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", gap: 12, height: "100%", padding: "16px 6px 14px" }}>
                      <span style={{ font: `600 14.5px/1 ${MONO}`, letterSpacing: ".06em", color: escuro ? "#8d8b8d" : "#b3b1b3" }}>{String(i + 1).padStart(2, "0")}</span>
                      {/* nome comprido quebra em DUAS linhas (no vertical, duas
                          colunas) em vez de ser cortado no meio: o corpo cai
                          conforme o nome cresce e a largura trava em 2 linhas. */}
                      {(() => {
                        const n = c.cliente.length;
                        const corpo = n > 34 ? 14 : n > 26 ? 16 : n > 20 ? 18 : n > 16 ? 22 : 25;
                        return (
                          <span title={c.cliente}
                            style={{ flex: 1, minHeight: 0, writingMode: "vertical-rl", transform: "rotate(180deg)", ...fr(72, 700), fontSize: corpo, lineHeight: 1.14, letterSpacing: "-.02em", textAlign: "left", maxWidth: Math.round(corpo * 1.14 * 2), overflow: "hidden", color: escuro ? "#f1f1f1" : INK }}>
                            {c.cliente}
                          </span>
                        );
                      })()}
                      <span title={c.faltaMP ? "sem matéria-prima" : c.atraso ? `atrasado há ${c.dias}d` : `entrega em ${c.dias}d`}
                        style={{ width: 7, height: 7, borderRadius: 999, background: c.faltaMP ? "#c0392b" : c.atraso ? AMARELO : escuro ? "#3a383a" : amarelo ? "rgba(37,36,37,.25)" : cinza ? "#b3b1b3" : "#e0e0e0" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Resumo de artes */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 4px 0" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span className="select-none" style={{ font: "800 15px/1 Inter, sans-serif", color: INK, letterSpacing: "-.01em" }}>Resumo de artes</span>
              <span style={{ font: "400 15px/1 Inter, sans-serif", color: "#8d8b8d" }}>{resumoAtual.nome}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {janela.map((m, i) => {
                const on = mesResumo === i;
                return (
                  <button key={m.chip} onClick={() => setMesResumo(i)} className="r2chip" style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "7px 12px", font: "700 13.5px/1 Inter, sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: on ? INK : "#fff", color: on ? AMARELO : "#8d8b8d", boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                    {m.chip}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {([
              { k: "solicitadas" as const, label: "Artes solicitadas", tema: "claro", filtro: null },
              /* Chamava-se "Artes aprovadas" e contava status `concluido` —
                 mas "aprovada" é um status PRÓPRIO no hub, e a tela de
                 Aprovação mostra outro número. Dois sentidos para a mesma
                 palavra na mesma tela; o que este card conta é finalizado.
                 O clique continua indo para a Aprovação, que é onde se
                 trabalha o que saiu daqui. */
              { k: "finalizadas" as const, label: "Artes finalizadas", tema: "amarelo", filtro: "aprovadas" as const, vaiPara: "Aprovação" },
              { k: "canceladas" as const, label: "Artes canceladas", tema: "escuro", filtro: "canceladas" as const },
            ]).map((d) => {
              const v = resumoAtual[d.k];
              const dif = resumoAnt ? v - resumoAnt[d.k] : 0;
              const escuro = d.tema === "escuro";
              const amarelo = d.tema === "amarelo";
              const ativo = filtroFin !== null && filtroFin === d.filtro;
              return (
                <button
                  key={d.k}
                  onClick={() => {
                    const destino = (d as { vaiPara?: string }).vaiPara;
                    if (destino) { aoNavegar(destino); return; }
                    if (d.filtro) setFiltroFin(ativo ? null : d.filtro);
                  }}
                  className="r2chip"
                  title={(d as { vaiPara?: string }).vaiPara
                    ? "Abrir a tela de Aprovação"
                    : d.filtro ? (ativo ? "Mostrar todos os finalizados" : `Filtrar finalizados: ${d.label.toLowerCase()}`) : undefined}
                  style={{ textAlign: "left", width: "100%", border: 0, cursor: d.filtro || (d as { vaiPara?: string }).vaiPara ? "pointer" : "default", borderRadius: 12, padding: "18px 20px 17px", background: escuro ? INK : amarelo ? AMARELO : "#fff", boxShadow: `${ativo ? "0 0 0 3px #252425," : ""}${SOMBRA_CARD}` }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ font: "800 40px/1 Inter, sans-serif", letterSpacing: "-.04em", color: escuro ? "#f1f1f1" : INK }}>{v}</span>
                    <span style={{ font: "600 13.5px/1 Inter, sans-serif", whiteSpace: "nowrap", color: "#8d8b8d" }}>{resumoAnt ? `${dif > 0 ? "+" : ""}${dif} vs mês ant.` : "—"}</span>
                  </div>
                  <div style={{ font: "600 13.5px/1 Inter, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10, color: escuro ? "#b3b1b3" : "#5c5a5c" }}>{d.label}</div>
                </button>
              );
            })}
          </div>

          {/* Finalizados recentes */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "8px 4px 0" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
              <h2 className="select-none" style={{ font: "800 38px/1 Inter, sans-serif", letterSpacing: "-.03em", color: INK, margin: 0, whiteSpace: "nowrap" }}>Finalizados recentes</h2>
              {filtroFin && (
                <button onClick={() => setFiltroFin(null)} className="r2chip" style={{ display: "flex", alignItems: "center", gap: 8, flex: "none", border: 0, borderRadius: 999, padding: "8px 12px", cursor: "pointer", font: "600 13.5px/1 Inter, sans-serif", background: INK, color: AMARELO }}>
                  <span>{filtroFin === "aprovadas" ? "só artes aprovadas" : "só artes canceladas"}</span>
                  <span style={{ font: "700 14px/1 Inter, sans-serif" }}>×</span>
                </button>
              )}
            </div>
            <button onClick={onVerTodos} className="r2chip" style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "400 15px/1 Inter, sans-serif", color: INK, textDecoration: "underline", textUnderlineOffset: 3 }}>Ver todos</button>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", ...CARD_BRANCO, padding: "4px 26px 10px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 96px 108px 96px 96px 40px", alignItems: "center", gap: 12, padding: "18px 0 16px", borderBottom: "1px solid #e8e8e8" }}>
              <span />
              {([["cliente", "Cliente"], ["medida", "Medida"], ["sub", "Sub."], ["solic", "Solic."], ["apro", "Apro."]] as const).map(([campo, label]) => {
                const on = ordem.campo === campo;
                return (
                  <button key={campo} onClick={() => setOrdem((s) => ({ campo, dir: s.campo === campo ? (s.dir === 1 ? -1 : 1) : 1 }))}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: 0, padding: 0, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap", font: `${on ? 600 : 400} 15px/1 Inter, sans-serif`, color: INK }}>
                    {label}
                    <span style={{ font: "700 13.5px/1 Inter, sans-serif", color: on ? INK : "#d6d5d6" }}>{on ? (ordem.dir === 1 ? "↑" : "↓") : "↕"}</span>
                  </button>
                );
              })}
              <span />
            </div>
            {finalizados.length === 0 && (
              <div style={{ padding: "40px 0", font: "400 15px/1.4 Inter, sans-serif", color: "#b3b1b3" }}>Nenhuma arte finalizada com esse filtro.</div>
            )}
            {finalizados.map((r, i) => {
              const on = linha === i;
              const reprovado = r.tipo === "x";
              return (
                <div
                  key={r.raw.id}
                  className="r2row"
                  onClick={() => { setLinha(i); onOpen(r.raw.id); }}
                  style={{ display: "grid", gridTemplateColumns: "52px 1fr 96px 108px 96px 96px 40px", alignItems: "center", gap: 12, padding: "14px 0", cursor: "pointer", borderBottom: i === finalizados.length - 1 ? 0 : `1px solid ${FUNDO}`, background: on ? "#fafafa" : "transparent" }}
                >
                  <span style={{ width: 44, height: 34, display: "grid", placeItems: "center", borderRadius: 5, background: reprovado ? INK : FUNDO }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={reprovado ? AMARELO : INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={reprovado ? "M6.5 6.5l11 11M17.5 6.5l-11 11" : "m5 12.5 4.5 4.5L19 7"} />
                    </svg>
                  </span>
                  <span className="truncate" style={{ font: "600 16px/1.2 Inter, sans-serif", color: INK }}>{r.cliente}</span>
                  <span style={{ font: "400 15px/1.2 Inter, sans-serif", color: on ? INK : "#b3b1b3" }}>{r.medida}</span>
                  <span className="truncate" style={{ font: "400 15px/1.2 Inter, sans-serif", color: on ? INK : "#b3b1b3" }}>{r.sub}</span>
                  <span style={{ font: "400 15px/1.2 Inter, sans-serif", color: on ? INK : "#b3b1b3" }}>{r.solic}</span>
                  <span style={{ font: "400 15px/1.2 Inter, sans-serif", color: on ? INK : "#b3b1b3" }}>{r.apro}</span>
                  <span style={{ display: "grid", placeItems: "center" }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12s-3.6 6.5-9.5 6.5S2.5 12 2.5 12" /><circle cx="12" cy="12" r="2.6" /></svg>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </EstagioV1a>
  );
}
