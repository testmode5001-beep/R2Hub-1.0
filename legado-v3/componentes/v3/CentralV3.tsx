// Central V3 — mockups hub_central_menu_aberto / _fechado (GRID.md §Zonas):
//   · topbar: Pesquisa (flexível) + Mensagens + Anotações + sino/engrenagem
//   · título "Central" alinhado pela linha do cabeçalho "Em aberto"
//   · esquerda (até a col 7, comprime quando o rail abre no hover):
//     calendário 2026 real + listas Histórico e Substrato (barra + pílula)
//   · direita (col 8–16, FIXA): "Em aberto" (3 cards) e "Finalizados recentes"
//   · modoTodos ("Ver todos"): grade completa com filtros, ordem e kanban —
//     todas as funcionalidades da Central antiga continuam aqui.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getHomeConfig, getHomeStats } from "@/lib/api/config.functions";
import { hasPerm } from "@/lib/session";
import {
  BORDA, BlocoSinoConfig, BotaoTopbar, BuscaTopbar, CARD_V3, COL, CardPedidoV3, DataTopbar,
  FS_BASE, FS_CAL, FS_MENOR, FaixaTopbar, GUT, HubShell, LINHA, MARGEM, TRANS_GRID, TagV3,
  TituloPagina, TituloSecao, Y_CARDS, Y_SECAO, colLeft, colSpan, linhas, statusV3,
} from "./HubV3";

const EM_ANDAMENTO = (s: string) => !["concluido", "cancelado"].includes(s);
const STATUS_KEYS = ["nova", "criacao", "aguardando", "revisao", "aprovada", "cliche", "concluido", "cancelado"];
const VISTOS_KEY = "r2hub.central.vistos";

/* Eixos verticais da página v5 (ritmo de 14,4 — GRID.md §8). */
const Y_CAL_TITULO = linhas(21);      // 302,4 — "Julho 2026" (caixa de 2 linhas)
const Y_CAL_GRADE = linhas(24);       // 345,6 — grade de dias do calendário
const Y_FIN_TITULO = linhas(34);      // 489,6 — "Finalizados" (caixa 34→37)
const Y_TAB_HEAD = linhas(41);        // 590,4 — cabeçalho da tabela (3 linhas)
const Y_TAB_ROWS = linhas(44);        // 633,6 — linhas da tabela (5 em 5; foco da 2ª = linha 49)
const Y_LISTAS = linhas(45);          // 648 — cards Clichês/Substrato (26 linhas → linha 71)
const Y_FILTROS = linhas(19);         // 273,6 — filtros do "Todos" (abaixo do título)
const Y_GRADE_TODOS = linhas(23);     // 331,2 — grade do "Todos"
const BASE = 1080 - MARGEM;           // 1040 — borda inferior útil (margem intocável)

function fmtDataCurta(s: string) {
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function CentralV3({
  profile, isLoading, pedidos, filtered, filtro, setFiltro, busca, setBusca,
  onOpen, onVerTodos, aoAbrirMenu, canCreate, onNova, onLogout,
  modoTodos = false, onVoltar, modalFundo,
}: any & {
  modalFundo?: (videoNome: string, fechar: () => void) => ReactNode;
}) {
  const podeConfig = hasPerm(profile, "usuarios.gerenciar");
  const [editandoFundo, setEditandoFundo] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);

  const { data: cfg } = useQuery({ queryKey: ["home-config"], queryFn: () => getHomeConfig() });
  const { data: stats } = useQuery({ queryKey: ["home-stats"], queryFn: () => getHomeStats(), refetchInterval: 30_000 });

  const [ordem, setOrdem] = useState<"recentes" | "antigos">("recentes");
  const [vista, setVista] = useState<"grade" | "colunas">(() =>
    (typeof window !== "undefined" && sessionStorage.getItem("r2hub.central.vista") === "colunas") ? "colunas" : "grade",
  );
  function trocarVista(v: "grade" | "colunas") {
    setVista(v);
    try { sessionStorage.setItem("r2hub.central.vista", v); } catch { /* storage bloqueado */ }
    if (v === "colunas") setFiltro("todos"); // no kanban os status já são colunas
  }

  // "Não visto": pontinho quando o status mudou desde a última abertura.
  const [vistos, setVistos] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(VISTOS_KEY) ?? "{}"); } catch { return {}; }
  });
  function abrirPedido(p: any) {
    const prox = { ...vistos, [p.id]: p.status };
    setVistos(prox);
    try { localStorage.setItem(VISTOS_KEY, JSON.stringify(prox)); } catch { /* storage bloqueado */ }
    onOpen(p.id);
  }

  // Atalhos: "/" foca a pesquisa; Esc limpa e sai dela.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName);
      if (e.key === "/" && !digitando) {
        e.preventDefault();
        buscaRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === buscaRef.current) {
        setBusca("");
        buscaRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscando = !!busca.trim();

  // Em andamento (respeita a busca), mais recentes primeiro.
  const emAndamento = useMemo(() =>
    filtered
      .filter((p: any) => EM_ANDAMENTO(p.status))
      .slice()
      .sort((a: any, b: any) =>
        ordem === "antigos"
          ? String(a.created_at).localeCompare(String(b.created_at))
          : String(b.created_at).localeCompare(String(a.created_at)),
      ),
  [filtered, ordem]);

  // Grade do modoTodos: TODOS os pedidos (filtro/busca aplicados), sem limite.
  const gradeTodos = useMemo(() =>
    filtered
      .slice()
      .sort((a: any, b: any) =>
        ordem === "antigos"
          ? String(a.created_at).localeCompare(String(b.created_at))
          : String(b.created_at).localeCompare(String(a.created_at)),
      ),
  [filtered, ordem]);

  const finalizados = (buscando ? filtered : pedidos)
    .filter((p: any) => !EM_ANDAMENTO(p.status))
    .slice()
    .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)));

  // Contagem por status (pills de filtro do modoTodos).
  const porStatus = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pedidos) m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, [pedidos]);

  // Histórico (por status em andamento) e Substrato (por matéria) — dados reais.
  const historico = useMemo(() =>
    STATUS_KEYS.filter(EM_ANDAMENTO).map((k) => ({ rotulo: statusV3(k).label, n: porStatus[k] ?? 0 })),
  [porStatus]);
  const substratos = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pedidos) {
      const mat = (p.materia ?? "").trim();
      if (!mat || mat === "-" || mat === "—") continue; // reposição de clichê não tem matéria
      m[mat] = (m[mat] ?? 0) + 1;
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([rotulo, n]) => ({ rotulo, n }));
  }, [pedidos]);

  // Kanban: em andamento agrupado por status (na ordem do fluxo).
  const grupos = useMemo(() => {
    const g: Record<string, any[]> = {};
    for (const st of STATUS_KEYS.filter(EM_ANDAMENTO)) g[st] = [];
    for (const p of gradeTodos) if (EM_ANDAMENTO(p.status) && g[p.status]) g[p.status].push(p);
    return g;
  }, [gradeTodos]);

  return (
    <>
      <HubShell
        user={profile}
        stats={stats}
        ativo="/app"
        aoNavegar={aoAbrirMenu}
        onLogout={onLogout}
        versao={cfg?.versao ?? "V. 0.01"}
      >
        {(g) => {
          /* Direita ANCORADA nas colunas físicas 8–16 (não mexe com o rail);
             esquerda flexível: de x0 (após o rail) até o fim da col 7. */
          const xDir = g.col(8);
          const wDir = g.cw(9);
          const xEsq = g.x0;
          const wEsq = g.wEsq(7);
          return (
            <>
              {/* ——— Topbar (GRID.md §6.1): faixa branca col 1–13; data col 1,
                  busca col 4–7, Mensagens col 8–10, Anotações col 11–13
                  (amarela = ativa), bloco escuro do usuário col 14–16.
                  A topbar vive ACIMA do rail e não reflui com ele. ——— */}
              <FaixaTopbar />
              <DataTopbar />
              <BuscaTopbar valor={busca} aoMudar={setBusca} x={colLeft(4)} w={colSpan(4)} inputRef={buscaRef} />
              <BotaoTopbar icone="ti-mail" rotulo="Mensagens" x={colLeft(8)} w={colSpan(3)}
                onClick={() => toast("Mensagens — em breve.", { icon: "✉️" })} />
              <BotaoTopbar icone="ti-circle-check" rotulo="Anotações" amarelo x={colLeft(11)} w={colSpan(3)}
                onClick={() => toast("Anotações — em breve.", { icon: "🗒️" })} />
              <BlocoSinoConfig
                user={profile}
                onLogout={onLogout}
                onConfig={podeConfig ? () => setEditandoFundo(true) : undefined}
              />

              {/* ——— Título (sem sufixo; baseline casada com "Em aberto") ——— */}
              <TituloPagina
                x={xEsq}
                extra={modoTodos ? (
                  <button onClick={onVoltar} className="hover:opacity-70" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-muted)" }}>
                    <i className="ti ti-arrow-left mr-1"></i>Central
                  </button>
                ) : undefined}
              >
                {modoTodos ? "Todos" : "Central"}
              </TituloPagina>

              {modoTodos ? (
                /* ═══════════ VER TODOS — grade completa com filtros ═══════════ */
                <>
                  {/* Filtros de status + ordem + vista — uma linha ABAIXO do
                      título (linha 19,5 do ritmo), nunca por cima dele */}
                  <div className="absolute flex items-center flex-wrap" style={{ left: xEsq, top: Y_FILTROS, width: CANVAS_W - MARGEM - xEsq, gap: 8, transition: TRANS_GRID }}>
                    {["todos", ...STATUS_KEYS].map((k) => {
                      const n = k === "todos" ? pedidos.length : (porStatus[k] ?? 0);
                      const ativo = filtro === k;
                      return (
                        <button
                          key={k}
                          onClick={() => setFiltro(ativo && k !== "todos" ? "todos" : k)}
                          className="whitespace-nowrap"
                          style={{
                            background: ativo ? "var(--ink)" : "var(--surface)",
                            color: ativo ? "var(--yellow)" : "var(--text)",
                            opacity: !ativo && n === 0 ? 0.45 : 1,
                            borderRadius: "var(--radius-pill)",
                            // pílula numa faixa de 2 linhas do ritmo (28,8)
                            height: linhas(2),
                            padding: "0 13px",
                            fontSize: 12,
                            fontWeight: 700,
                            boxShadow: ativo ? "none" : "var(--sh-pill)",
                          }}
                        >
                          {k === "todos" ? "Todos" : statusV3(k).label} ({n})
                          {ativo && k !== "todos" && <i className="ti ti-x ml-1" style={{ fontSize: 10 }}></i>}
                        </button>
                      );
                    })}
                    <div className="ml-auto flex items-center" style={{ gap: 14 }}>
                      {buscando && (
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {filtered.length} resultado{filtered.length === 1 ? "" : "s"} para “{busca.trim()}”
                        </span>
                      )}
                      <button
                        onClick={() => setOrdem((o) => (o === "recentes" ? "antigos" : "recentes"))}
                        title="Inverter a ordem"
                        className="uppercase hover:opacity-70 whitespace-nowrap"
                        style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em", color: "var(--text-muted)" }}
                      >
                        <i className={`ti ${ordem === "recentes" ? "ti-sort-descending" : "ti-sort-ascending"} mr-1`}></i>
                        {ordem === "recentes" ? "Mais recentes" : "Mais antigos"}
                      </button>
                      <div className="flex items-center rounded-full" style={{ background: "var(--surface)", padding: 2, boxShadow: "var(--sh-pill)" }}>
                        {([["grade", "ti-layout-grid", "Grade"], ["colunas", "ti-layout-columns", "Colunas por status"]] as const).map(([v, ic, t]) => (
                          <button
                            key={v}
                            onClick={() => trocarVista(v)}
                            title={t}
                            className="rounded-full flex items-center justify-center transition"
                            /* 24 + 2×2 de padding = 28 → o toggle cabe na faixa de 2 linhas (28,8) */
                            style={{ width: 24, height: 24, ...(vista === v ? { background: "var(--ink)", color: "var(--yellow)" } : { color: "var(--text)", opacity: 0.55 }) }}
                          >
                            <i className={`ti ${ic}`} style={{ fontSize: 14 }}></i>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Grade / kanban — rola por dentro (o canvas não rola) */}
                  <div className="absolute overflow-y-auto" style={{ left: xEsq, top: Y_GRADE_TODOS, width: CANVAS_W - MARGEM - xEsq, height: BASE - Y_GRADE_TODOS, scrollbarWidth: "thin", transition: TRANS_GRID }}>
                    {isLoading ? (
                      <div style={{ color: "var(--text-muted)", padding: "40px 0", textAlign: "center" }}>Carregando...</div>
                    ) : gradeTodos.length === 0 ? (
                      <div className="flex flex-col items-start" style={{ gap: 12, color: "var(--text-muted)" }}>
                        {buscando ? `Nada encontrado para “${busca.trim()}”.` : "Nenhum pedido por aqui."}
                        {canCreate && !buscando && <BotaoNova onClick={onNova} />}
                      </div>
                    ) : vista === "colunas" ? (
                      <div className="flex" style={{ gap: GUT, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin" }}>
                        {STATUS_KEYS.filter(EM_ANDAMENTO).filter((st) => (grupos[st] ?? []).length > 0).map((st) => (
                          <div key={st} className="shrink-0 flex flex-col" style={{ width: 330 }}>
                            <div className="flex items-center" style={{ gap: 8, marginBottom: 10, paddingLeft: 2 }}>
                              <TagV3>{statusV3(st).label}</TagV3>
                              <span className="fmono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{grupos[st].length}</span>
                            </div>
                            <div className="flex flex-col" style={{ gap: 18, maxHeight: BASE - Y_GRADE_TODOS - 50, overflowY: "auto" }}>
                              {grupos[st].map((p: any) => (
                                <CardPedidoV3 key={p.id} p={p} naoVisto={vistos[p.id] !== p.status} onOpen={() => abrirPedido(p)} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* a célula do card já reserva 16px p/ orelha → gap menor */
                      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "18px 12px", paddingRight: 6 }}>
                        {gradeTodos.map((p: any) => (
                          <CardPedidoV3 key={p.id} p={p} naoVisto={vistos[p.id] !== p.status} onOpen={() => abrirPedido(p)} />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ═══════════ CENTRAL — layout v5 (mockup "Design da interface") ═══════════ */
                <>
                  {/* Esquerda: calendário direto no painel (sem card), col 2–7 —
                      mesma largura das listas (varredura do mockup com guias) */}
                  <CalendarioCard x={xEsq} w={wEsq} />

                  {/* Esquerda: Clichês/Histórico (col 2–4) + Substrato (col 5–7),
                      cards de 3 col × 26 linhas (terminam na linha 71) */}
                  <div className="absolute flex" style={{ left: xEsq, top: Y_LISTAS, width: wEsq, height: linhas(26), gap: GUT, transition: TRANS_GRID }}>
                    <ListaBarras titulo="Histórico" linhasLista={historico} />
                    <ListaBarras titulo="Substrato" linhasLista={substratos} />
                  </div>

                  {/* Divisória vertical central — gutter H (entre col 7 e 8) */}
                  <div
                    aria-hidden
                    className="absolute"
                    style={{ left: g.col(8) - GUT / 2, top: Y_SECAO, height: linhas(69) - Y_SECAO, width: 1, background: "var(--divider)" }}
                  />

                  {/* Direita (fixa): Em aberto — 3 cards nas col 8-10/11-13/14-16 */}
                  <div className="absolute" style={{ left: xDir, top: Y_SECAO, width: wDir }}>
                    <TituloSecao
                      acao="Ver todos"
                      onAcao={onVerTodos}
                      extra={canCreate ? <BotaoNova onClick={onNova} compacto /> : undefined}
                    >
                      Em aberto
                    </TituloSecao>
                  </div>
                  <div className="absolute" style={{ left: xDir, top: Y_CARDS, width: wDir }}>
                    {isLoading ? (
                      <div style={{ color: "var(--text-muted)", padding: "30px 0" }}>Carregando...</div>
                    ) : emAndamento.length === 0 ? (
                      <div className="flex flex-col items-start" style={{ gap: 12, color: "var(--text-muted)", padding: "10px 0" }}>
                        {buscando ? `Nada encontrado para “${busca.trim()}”.` : "Nenhum pedido em andamento."}
                        {canCreate && !buscando && <BotaoNova onClick={onNova} />}
                      </div>
                    ) : (
                      /* gap = gutter do grid → cada card cai exatamente em 3 colunas */
                      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", columnGap: GUT }}>
                        {emAndamento.slice(0, 3).map((p: any) => (
                          <CardPedidoV3 key={p.id} p={p} naoVisto={vistos[p.id] !== p.status} onOpen={() => abrirPedido(p)} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Direita (fixa): Finalizados recentes — título termina na linha 37 */}
                  <div className="absolute" style={{ left: xDir, top: Y_FIN_TITULO, width: wDir }}>
                    <TituloSecao acao="Ver todos" onAcao={onVerTodos}>Finalizados recentes</TituloSecao>
                  </div>
                  <TabelaFinalizados x={xDir} linhasTab={finalizados.slice(0, 5)} onOpen={abrirPedido} />
                </>
              )}
            </>
          );
        }}
      </HubShell>

      {editandoFundo && modalFundo?.(cfg?.videoNome ?? "", () => setEditandoFundo(false))}
    </>
  );
}

function BotaoNova({ onClick, compacto }: { onClick: () => void; compacto?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="uppercase whitespace-nowrap hover:opacity-85"
      style={{
        background: "var(--yellow)",
        color: "var(--on-accent)",
        borderRadius: "var(--radius-pill)",
        padding: compacto ? "5px 14px" : "8px 18px",
        fontSize: compacto ? 11 : 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        fontFamily: "'Inter', sans-serif",
        transform: compacto ? "translateY(-4px)" : undefined,
      }}
    >
      + Nova
    </button>
  );
}

/* ————— Calendário 2026 ————— */
const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher) — base dos feriados móveis. */
function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/** Feriados nacionais do ano ("mes-dia" → nome): fixos + móveis (Carnaval,
    Sexta-feira Santa, Corpus Christi). */
function feriadosDoAno(ano: number): Record<string, string> {
  const m: Record<string, string> = {
    "0-1": "Confraternização Universal",
    "3-21": "Tiradentes",
    "4-1": "Dia do Trabalho",
    "8-7": "Independência do Brasil",
    "9-12": "Nossa Senhora Aparecida",
    "10-2": "Finados",
    "10-15": "Proclamação da República",
    "10-20": "Dia da Consciência Negra",
    "11-25": "Natal",
  };
  const p = pascoa(ano);
  const add = (offset: number, nome: string) => {
    const d = new Date(ano, p.getMonth(), p.getDate() + offset);
    m[`${d.getMonth()}-${d.getDate()}`] = nome;
  };
  add(-47, "Carnaval");
  add(-2, "Sexta-feira Santa");
  add(60, "Corpus Christi");
  return m;
}

/** Calendário v5 — direto sobre o painel branco (sem card, como no mockup):
    "Julho 2026" em Fraunces 26,13 com o ano em amarelo; grade de dias em
    faixas do ritmo (cabeçalho 2 linhas + 6 semanas de 3 linhas → termina na
    linha 44, uma linha antes das listas). Abre no mês atual, navega com as
    setas; o dia de hoje ganha a pílula amarela, feriados a pílula ink. */
function CalendarioCard({ x, w }: { x: number; w: number }) {
  const hoje = new Date();
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() });

  function navegar(delta: number) {
    setRef((r) => {
      const d = new Date(r.ano, r.mes + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() };
    });
  }

  const primeiroDia = new Date(ref.ano, ref.mes, 1).getDay(); // 0 = domingo
  const diasNoMes = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const diasMesAnterior = new Date(ref.ano, ref.mes, 0).getDate();

  // As pontas mostram os dias dos meses vizinhos, esmaecidos; SEMPRE 6
  // semanas (42 células) para a grade ter altura estável no ritmo.
  type Cel = { d: number; rel: -1 | 0 | 1 };
  const celulas: Cel[] = [
    ...Array.from({ length: primeiroDia }, (_, i) => ({ d: diasMesAnterior - primeiroDia + 1 + i, rel: -1 as const })),
    ...Array.from({ length: diasNoMes }, (_, i) => ({ d: i + 1, rel: 0 as const })),
  ];
  for (let i = 1; celulas.length < 42; i++) celulas.push({ d: i, rel: 1 });

  const ehHoje = (c: Cel) =>
    c.rel === 0 && c.d === hoje.getDate() && ref.mes === hoje.getMonth() && ref.ano === hoje.getFullYear();

  const feriados = useMemo(() => feriadosDoAno(ref.ano), [ref.ano]);
  const feriadoDe = (c: Cel) => (c.rel === 0 ? feriados[`${ref.mes}-${c.d}`] : undefined);

  return (
    <>
      {/* Título: caixa de 2 linhas (302,4→331,2); ano em amarelo (DESIGN.md) */}
      <div className="absolute flex items-baseline justify-between" style={{ left: x, top: Y_CAL_TITULO, width: w, transition: TRANS_GRID }}>
        <div className="fd select-none" style={{ fontSize: FS_CAL, lineHeight: `${linhas(2)}px`, letterSpacing: "-0.5px", color: "var(--text)" }}>
          {MESES_PT[ref.mes]} <span style={{ color: "var(--yellow)" }}>{ref.ano}</span>
        </div>
        <div className="flex items-center" style={{ gap: 4 }}>
          {ref.ano !== hoje.getFullYear() || ref.mes !== hoje.getMonth() ? (
            <button
              onClick={() => setRef({ ano: hoje.getFullYear(), mes: hoje.getMonth() })}
              className="uppercase hover:opacity-70"
              style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text-muted)", marginRight: 6 }}
            >
              Hoje
            </button>
          ) : null}
          {[["ti-chevron-left", -1], ["ti-chevron-right", 1]].map(([ic, d]) => (
            <button
              key={ic as string}
              onClick={() => navegar(d as number)}
              className="flex items-center justify-center hover:opacity-60"
              style={{ width: 22, height: 22, color: "var(--text-muted)" }}
            >
              <i className={`ti ${ic}`} style={{ fontSize: 15 }}></i>
            </button>
          ))}
        </div>
      </div>

      {/* Semana + dias no MESMO grid de 7 colunas → verticais cravadas.
          Cabeçalho em faixa de 2 linhas, semanas em faixas de 3. */}
      <div className="absolute grid" style={{ left: x, top: Y_CAL_GRADE, width: w, gridTemplateColumns: "repeat(7, 1fr)", transition: TRANS_GRID }}>
        {DIAS_SEMANA.map((d, i) => (
          <span
            key={`s${i}`}
            className="flex items-center justify-center uppercase select-none"
            style={{ height: linhas(2), fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-faint)" }}
          >
            {d}
          </span>
        ))}
        {celulas.map((c, i) => {
          const feriado = feriadoDe(c);
          const hojeSim = ehHoje(c);
          return (
            <span key={i} className="flex items-center justify-center" style={{ height: linhas(3) }}>
              <span
                title={feriado}
                className="flex items-center justify-center select-none"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  fontFamily: "var(--font-display)",
                  fontVariationSettings: '"SOFT" 100, "opsz" 40, "wght" 500',
                  fontSize: FS_MENOR,
                  fontWeight: hojeSim || feriado ? 700 : 500,
                  background: hojeSim ? "var(--yellow)" : feriado ? "var(--ink)" : "transparent",
                  color: c.rel !== 0 ? "var(--text-faint)" : hojeSim ? "var(--on-accent)" : feriado ? "var(--yellow)" : "var(--text)",
                  cursor: feriado ? "help" : undefined,
                }}
              >
                {c.d}
              </span>
            </span>
          );
        })}
      </div>
    </>
  );
}

/** Tabela "Finalizados recentes" v5 — SEM card em volta: as linhas vivem
    direto no painel branco, com cada campo ancorado numa coluna do grid
    (GRID.md §7): status col 8 · Cliente col 9 · Medida col 12 · Sub. col 13 ·
    Solic. col 14 · Apro. col 15 · olho col 16 (centro). Cabeçalho numa faixa
    de 3 linhas (41→44) com traço embaixo; linhas de 5 em 5 (44→69) — a faixa
    de foco (hover) ganha fundo sunken e texto cheio, as demais ficam
    esmaecidas. */
function TabelaFinalizados({ x, linhasTab, onOpen }: { x: number; linhasTab: any[]; onOpen: (p: any) => void }) {
  const [foco, setFoco] = useState<string | null>(null);
  const w = colSpan(9);
  if (linhasTab.length === 0) {
    return (
      <div className="absolute" style={{ left: x, top: Y_TAB_ROWS, width: w, color: "var(--text-muted)", fontSize: FS_MENOR }}>
        Nenhum pedido finalizado ainda.
      </div>
    );
  }
  /* Trilhas = colunas físicas do grid: 96,25 | 3 col (Cliente) | 96,25 ×5. */
  const GRADE = `${COL}px ${colSpan(3)}px ${COL}px ${COL}px ${COL}px ${COL}px ${COL}px`;
  return (
    <div className="absolute" style={{ left: x, top: Y_TAB_HEAD, width: w }}>
      {/* Cabeçalho — faixa de 3 linhas, traço da col 8 à 16 */}
      <div className="grid items-center" style={{ gridTemplateColumns: GRADE, columnGap: GUT, height: linhas(3), borderBottom: "1px solid var(--divider)" }}>
        <span />
        <span style={{ fontSize: FS_MENOR, fontWeight: 500, color: "var(--text)" }}>Cliente</span>
        <span style={{ fontSize: FS_MENOR, fontWeight: 500, color: "var(--text)" }}>Medida</span>
        <span style={{ fontSize: FS_MENOR, fontWeight: 500, color: "var(--text)" }}>Sub.</span>
        <span style={{ fontSize: FS_MENOR, fontWeight: 500, color: "var(--text)" }}>Solic.</span>
        <span style={{ fontSize: FS_MENOR, fontWeight: 500, color: "var(--text)" }}>Apro.</span>
        <span />
      </div>
      {linhasTab.map((p) => {
        const emFoco = foco === p.id;
        const reprovado = p.status === "cancelado";
        const apagado = emFoco ? "var(--text)" : "var(--text-faint)";
        return (
          <div
            key={p.id}
            onMouseEnter={() => setFoco(p.id)}
            onMouseLeave={() => setFoco((f) => (f === p.id ? null : f))}
            onClick={() => onOpen(p)}
            className="grid items-center cursor-pointer"
            style={{
              gridTemplateColumns: GRADE,
              columnGap: GUT,
              height: linhas(5),
              borderRadius: "var(--radius-card)",
              background: emFoco ? "var(--surface-sunken)" : "transparent",
              transition: "background 120ms ease",
            }}
          >
            {/* ícone de estado: ✓ ok · ✕ reprovado — quadrado de 3 linhas,
                raio 10; no foco do reprovado vira ink com ✕ branco */}
            <span
              className="flex items-center justify-center"
              style={{
                width: linhas(3), height: linhas(3), borderRadius: "var(--radius-card)",
                background: reprovado && emFoco ? "var(--ink)" : "var(--gray-100)",
                color: reprovado && emFoco ? "var(--on-rail)" : "var(--ink)",
              }}
            >
              <i className={`ti ${reprovado ? "ti-x" : "ti-check"}`} style={{ fontSize: 18, fontWeight: 700 }}></i>
            </span>
            <span className="truncate" style={{ fontSize: FS_MENOR, fontWeight: 600, color: "var(--text)" }}>{p.cliente}</span>
            <span className="fmono" style={{ fontSize: 14, color: apagado }}>
              {p.tipo === "cliche" ? `CÓD ${p.codigo_produto ?? "—"}` : `${p.largura}X${p.altura}`}
            </span>
            <span className="truncate uppercase" style={{ fontSize: 14, color: apagado }}>
              {p.tipo === "cliche" ? "CLICHÊ" : p.materia}
            </span>
            <span className="fmono" style={{ fontSize: 14, color: apagado }}>{fmtDataCurta(p.created_at)}</span>
            <span className="fmono" style={{ fontSize: 14, color: apagado }}>{fmtDataCurta(p.updated_at ?? p.created_at)}</span>
            <span className="flex items-center justify-center" style={{ color: "var(--text)" }}>
              <i className="ti ti-eye" style={{ fontSize: 18 }}></i>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Card de lista v5 (Clichês/Histórico, Substrato): 3 colunas × 26 linhas,
    borda cinza. Registro interno no ritmo GLOBAL (GRID.md §7 + close da 9ª
    rodada): título numa caixa de 2 linhas a partir da linha 2 do card
    (global 47→49); itens em faixas de 3 linhas a partir da linha 5 do card,
    de modo que o EIXO de cada barra caia nas linhas globais 51, 54, 57, 60,
    63 e 66. A barra tem 1 linha de altura (14,4) e começa na fronteira da
    2ª coluna do card (linha de coluna do grid); o número vive numa pílula
    amarela dentro do preenchimento ink. Offsets compensam a borda (−BORDA). */
function ListaBarras({ titulo, linhasLista }: { titulo: string; linhasLista: { rotulo: string; n: number }[] }) {
  const max = Math.max(1, ...linhasLista.map((l) => l.n));
  return (
    <div className="relative flex-1 min-w-0" style={{ ...CARD_V3, height: linhas(26) }}>
      <div
        className="absolute truncate select-none"
        style={{ left: 20 - BORDA, right: 20, top: linhas(2) - BORDA, fontSize: FS_BASE, lineHeight: `${linhas(2)}px`, fontWeight: 800, color: "var(--text)" }}
      >
        {titulo}
      </div>
      {linhasLista.length === 0 && (
        <div className="absolute" style={{ left: 20 - BORDA, top: linhas(5) - BORDA, color: "var(--text-muted)", fontSize: 13 }}>
          Sem dados ainda.
        </div>
      )}
      {linhasLista.slice(0, 6).map((l, i) => (
        <div
          key={l.rotulo}
          className="absolute"
          style={{ left: 20 - BORDA, right: 20 - BORDA, top: linhas(5 + 3 * i) - BORDA, height: linhas(3) }}
        >
          <span
            className="absolute truncate"
            title={l.rotulo}
            style={{ left: 0, top: 0, width: X_BARRA_LISTA - 12, fontSize: FS_MENOR, lineHeight: `${linhas(2)}px`, fontWeight: 400, color: "var(--text)" }}
          >
            {l.rotulo}
          </span>
          {/* trilho sunken de 1 linha, eixo na linha do grid */}
          <span
            className="absolute"
            style={{ left: X_BARRA_LISTA, right: 0, top: LINHA / 2, height: LINHA, background: "var(--surface-sunken)", borderRadius: 5 }}
          >
            <span
              className="absolute left-0 top-0 bottom-0 flex items-center justify-end"
              style={{ width: `${Math.max(30, (l.n / max) * 100)}%`, background: "var(--ink)", borderRadius: 5, minWidth: 32, paddingRight: 2 }}
            >
              <span
                className="fmono flex items-center justify-center"
                style={{ minWidth: 19, height: 10.5, background: "var(--yellow)", color: "var(--on-accent)", borderRadius: 3, fontSize: 8, fontWeight: 700, padding: "0 2px" }}
              >
                {l.n}
              </span>
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

/* Início da barra, medido da faixa útil do item (que começa 20px após a
   borda do card): o card ocupa 3 colunas; a barra começa na fronteira da 2ª
   coluna → 2 col + 1 gutter (212,5) − 20 = 192,5. A barra fica com exatamente
   1 coluna (96,25) de comprimento no card fechado. */
const X_BARRA_LISTA = colSpan(2) - 20; // 192.5
