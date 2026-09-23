// Casco V3 do Hub — dashboard de tela cheia no grid 1920×1080 (GRID.md):
//   · canvas de referência 1920×1080 que ESCALA proporcionalmente na viewport
//     (nada rola; em telas menores reduz, em maiores amplia)
//   · v5: 16 colunas de 96,25px, gutter 20, MARGEM 40 nos 4 lados; ritmo 14,4
//   · painel BRANCO de conteúdo da linha 9 à margem inferior; topbar na linha
//     3 com 5 linhas; separação por borda cinza 1,6987pt + raio 10 (sem sombra)
//   · papel de parede (config compartilhado do Hub) atrás do canvas, com véu
//     claro para o texto ink continuar legível
//   · rail preto na coluna 1 (da linha 9 até 1040): hambúrguer + ícones; abre
//     no clique e fecha quando o mouse sai; o conteúdo reflui (col 2 ⇄ col 3)
//   · data/hora na col 1 da topbar, bloco escuro do usuário nas col 14–16
//   · card de pedido com "orelha" de estado e tags no rodapé
// Aparência: tokens em styles.css (DESIGN.md) — nunca hex cravado aqui.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { NotificationBell } from "@/components/NotificationBell";
import { itensDoUsuario, type MenuItem, type StatKey } from "@/components/MenuCapa";
import { getHomeConfig } from "@/lib/api/config.functions";
import type { SessionUser } from "@/lib/session";

/* ————— Grade v5 (GRID.md §2) ————— */
export const CANVAS_W = 1920;
export const CANVAS_H = 1080;
export const MARGEM = 40;          // margem externa nos 4 lados — INVIOLÁVEL
export const GUT = 20;             // gutter horizontal
export const COL = 96.25;          // (1920 − 80 − 15×20) ÷ 16
export const LINHA = 14.4;         // módulo vertical (75 linhas, borda a borda)
export const PASSO = COL + GUT;    // 116.25 — passo de coluna

/** Largura de n colunas + (n−1) gutters. */
export const colSpan = (n: number) => n * COL + (n - 1) * GUT;
/** Borda esquerda da coluna física c (1-based). */
export const colLeft = (c: number) => MARGEM + (c - 1) * PASSO;
/** n linhas do ritmo vertical. */
export const linhas = (n: number) => n * LINHA;

/* Rail (GRID.md §6.2): coluna 1 exata; aberto cresce para 2 colunas. */
export const RAIL_FECHADO = COL;          // 96,25 — 1 coluna
export const RAIL_ABERTO = colSpan(2);    // 212,5 — 2 colunas
/** Margem interna lateral do rail (anotada no close do mockup). */
export const MARGEM_RAIL = 13.1538;

/* ————— Eixos verticais compartilhados (GRID.md §6/§8) ————— */
export const TOPO_Y = linhas(3);      // 43,2 — topo da topbar (linha 3)
export const TOPBAR_H = linhas(5);    // 72 — topbar tem 5 linhas (L3–L8)
/** Painel branco de conteúdo: da linha 9 até a margem inferior (1040). */
export const PAINEL_Y = linhas(9);    // 129,6 — topo do painel e do rail
export const PAINEL_H = CANVAS_H - MARGEM - PAINEL_Y; // 910,4
/** Espessura das bordas cinzas em px (1,6987pt) — para compensar offsets. */
export const BORDA = 2.265;
export const Y_SECAO = linhas(15);    // 216 — cabeçalhos de seção (linha CHEIA do ritmo)
export const Y_CARDS = linhas(20);    // 288 — topo dos cards / card do calendário
/** Corpo do título de página — medido do mockup (GRID.md §Tipografia).
    Regra da grade: o font-size é LIVRE; quem trava no ritmo é o line-height. */
export const TAM_TITULO = 95.8876;
/** Line-height do título: 7 linhas do ritmo (100,8). */
export const LH_TITULO = linhas(7);
/** Topo da caixa do título — linha 11; a caixa (7 linhas) termina na linha 18,
    junto com a caixa dos cabeçalhos de seção (Y_SECAO + 3 linhas). */
export const Y_TITULO = linhas(11);
/** Recuo ótico dos títulos Fraunces: alinha a TINTA do glifo à coluna. */
export const TINTA_FRAUNCES = "-0.045em";

/* ————— Tipografia medida (DESIGN.md §2 — font-size livre, lh trava em 14,4) ————— */
export const FS_SECAO = 39.8379;    // títulos de seção — Inter Bold
export const FS_CARDNOME = 27.8358; // nome do cliente no card — Fraunces Bold
export const FS_CAL = 26.13;        // "Julho 2026" do calendário — Fraunces
export const FS_BASE = 19.7272;     // texto/título base — Inter
export const FS_NUM = 15.08;        // #numero do card
export const FS_MENOR = 15.1451;    // texto menor
export const FS_TECH = 9.76;        // linha técnica do card

/* Transição usada nos blocos que refluem quando o rail abre/fecha. */
export const TRANS_GRID = "left 200ms ease, width 200ms ease";

/** Geometria do conteúdo conforme o estado do rail. Regra do hover: quando o
    rail abre, SÓ a área da esquerda comprime — os blocos da direita ficam
    ancorados nas colunas físicas (col 8 em diante) e não se mexem. */
export type GridConteudo = {
  railAberto: boolean;
  /** borda esquerda do conteúdo (logo após o rail) — a única coisa que muda */
  x0: number;
  /** borda esquerda da coluna FÍSICA c (fixa, independe do rail) */
  col: (c: number) => number;
  /** largura de n colunas + (n−1) gutters */
  cw: (n: number) => number;
  /** largura da área esquerda flexível: de x0 até a coluna física `ateCol` */
  wEsq: (ateCol: number) => number;
};

function gridConteudo(railAberto: boolean): GridConteudo {
  const x0 = colLeft(railAberto ? 3 : 2);
  return {
    railAberto,
    x0,
    col: colLeft,
    cw: colSpan,
    wEsq: (ateCol) => colLeft(ateCol + 1) - GUT - x0,
  };
}

/* useLayoutEffect no browser, useEffect no SSR (evita warning do React). */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Fundo é imagem? (senão é vídeo) — decide entre <img> e <video>. */
const ehImagemSrc = (s: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(s);

/* ————— Canvas escalável + papel de parede ————— */
/** Palco 1920×1080 centralizado e escalado para caber na viewport.
    ResizeObserver no contêiner (mais confiável que o evento resize da janela)
    + flex centering; o scale com origem no centro mantém o palco no meio.
    O papel de parede (config global do Hub) fica ATRÁS, cobrindo a viewport
    inteira, com um véu claro para preservar a leitura do texto ink. */
export function CanvasHub({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState<number | null>(null);
  const [midiaPronta, setMidiaPronta] = useState(false);

  // Papel de parede compartilhado de todas as páginas (cache ["home-config"]).
  const { data: cfg } = useQuery({ queryKey: ["home-config"], queryFn: () => getHomeConfig() });
  const video = cfg?.video ?? "";

  useIsoLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setEscala(Math.min(r.width / CANVAS_W, r.height / CANVAS_H));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setMidiaPronta(false); }, [video]);

  return (
    <div
      ref={outerRef}
      className="fixed inset-0 overflow-hidden flex items-center justify-center"
      style={{ background: "var(--page)" }}
    >
      {/* Papel de parede + véu claro — cobrem a viewport toda (sem letterbox) */}
      {video && (ehImagemSrc(video) ? (
        <img
          key={video}
          src={video}
          alt=""
          onLoad={() => setMidiaPronta(true)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{ opacity: midiaPronta ? 1 : 0, transition: "opacity 600ms ease" }}
        />
      ) : (
        <video
          key={video}
          src={video}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => setMidiaPronta(true)}
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
          style={{ opacity: midiaPronta ? 1 : 0, transition: "opacity 600ms ease" }}
        />
      ))}
      {video && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "rgba(239,239,239,0.62)", opacity: midiaPronta ? 1 : 0, transition: "opacity 600ms ease" }}
        />
      )}

      <div
        className="fade-page relative shrink-0"
        style={{
          width: CANVAS_W,
          height: CANVAS_H,
          transform: `scale(${escala ?? 1})`,
          transformOrigin: "center center",
          visibility: escala === null ? "hidden" : "visible",
          color: "var(--text)",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ————— Data/hora da topbar (v5 — voltou para a coluna 1 do topo) ————— */
/** "10 DEZEMBRO, QUINTA FEIRA, 10:20" — Inter caixa alta, atualiza a cada
    meio minuto. Ancorada na coluna 1 da topbar (GRID.md §6.1). */
export function DataTopbar() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  const dia = agora.getDate();
  const mes = agora.toLocaleDateString("pt-BR", { month: "long" });
  const semana = agora.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", " feira");
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      className="absolute flex items-center uppercase select-none whitespace-nowrap"
      style={{ left: MARGEM + 24, top: TOPO_Y, height: TOPBAR_H, fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: "var(--text)" }}
    >
      {dia} {mes}, {semana}, {hora}
    </div>
  );
}

/** Faixa branca da topbar: cobre da coluna 1 ao fim da col 13 (o bloco do
    usuário, col 14–16, é um bloco escuro separado). */
export function FaixaTopbar() {
  return (
    <div
      className="absolute"
      style={{ left: MARGEM, top: TOPO_Y, width: colSpan(13), height: TOPBAR_H, background: "var(--surface)", borderRadius: "var(--radius-card)" }}
    />
  );
}

/** Marca R2 do pé do rail: bloco amarelo de 2 linhas (grid 67–69). */
function LogoR2({ largura }: { largura?: number | string }) {
  return (
    <div
      className="flex items-center justify-center select-none shrink-0"
      style={{ width: largura ?? "100%", height: linhas(2), background: "var(--yellow)", borderRadius: 6, gap: 3 }}
    >
      <span className="fd" style={{ fontSize: 17, color: "var(--on-accent)", letterSpacing: "-0.5px" }}>R2</span>
      <span style={{ fontSize: 4.5, fontWeight: 800, letterSpacing: "0.14em", color: "var(--on-accent)", writingMode: "vertical-rl" }}>
        ETIQUETAS
      </span>
    </div>
  );
}

/* ————— Rail lateral ————— */
/** Rótulo "natural" dos itens do menu (os mesmos das abas, sem caixa alta). */
const ROTULO_RAIL: Record<string, string> = {
  "CENTRAL": "Central",
  "+ NOVA": "Solicitar design",
  "APROVAÇÃO": "Aprovação",
  "SOLICITAR CLICHÊ": "Solicitar clichê",
  "AFIAÇÃO": "Afiação",
  "CALCULADORAS": "Calculadoras",
  "APONTAMENTOS": "Apontamentos",
  "USUÁRIOS": "Usuários",
};

/** Ícone de cada item (Tabler) — aparecem no rail fechado e ao lado dos
    rótulos no aberto. */
const ICONE_RAIL: Record<string, string> = {
  "Home": "ti-home",
  "Central": "ti-layout-dashboard",
  "Solicitar design": "ti-brush",
  "Aprovação": "ti-checks",
  "Solicitar clichê": "ti-rubber-stamp", // ti-stamp não existe na webfont
  "Afiação": "ti-scissors",
  "Calculadoras": "ti-calculator",
  "Apontamentos": "ti-notes",
  "Usuários": "ti-users",
};

export function itensRail(user: SessionUser): MenuItem[] {
  return [
    { label: "Home", to: "/home", mostrar: true },
    ...itensDoUsuario(user).map((i) => ({ ...i, label: ROTULO_RAIL[i.label] ?? i.label })),
  ];
}

/** Rail preto. Fechado (padrão): hambúrguer + ícones + relógio/versão.
    Abre no CLIQUE do hambúrguer e fecha quando o mouse sai do rail.
    Itens em alturas do ritmo (fechado 4 linhas, aberto 2 linhas) para os
    ícones caírem nas linhas do grid. Usuário/Sair vivem no topo-direito. */
export function RailV3({ user, stats, ativo, aberto, onToggle, onMouseSair, aoNavegar, versao, icones, onEditarIcones }: {
  user: SessionUser;
  stats?: Partial<Record<StatKey, number>>;
  /** `to` da página atual (ex.: "/app", "/home") — item ganha destaque */
  ativo?: string;
  aberto: boolean;
  onToggle: () => void;
  onMouseSair: () => void;
  aoNavegar: (to: string) => void;
  versao?: string;
  /** trocas manuais de ícone (rótulo → classe ti-*), por cima do padrão */
  icones?: Record<string, string>;
  onEditarIcones?: () => void;
}) {
  const itens = itensRail(user);
  const iconeDe = (label: string) => icones?.[label] || ICONE_RAIL[label] || "ti-point";
  return (
    <div
      onMouseLeave={onMouseSair}
      className="absolute flex flex-col"
      style={{
        left: MARGEM,
        top: PAINEL_Y,
        bottom: MARGEM,
        width: aberto ? RAIL_ABERTO : RAIL_FECHADO,
        background: "var(--rail-bg)",
        borderRadius: "var(--radius-rail)",
        transition: "width 200ms ease",
        zIndex: 20,
      }}
    >
      {/* Hambúrguer — clique abre/fecha (ocupa 4 linhas do ritmo) */}
      <button
        onClick={onToggle}
        aria-label={aberto ? "Recolher menu" : "Abrir menu"}
        className={`flex items-center shrink-0 hover:opacity-80 ${aberto ? "" : "justify-center self-stretch"}`}
        style={{ height: linhas(4), padding: aberto ? "0 30px" : 0 }}
      >
        <span className="flex flex-col" style={{ gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ display: "block", width: 26, height: 5, background: "var(--yellow)", borderRadius: 2 }} />
          ))}
        </span>
      </button>

      {/* Itens — fechado: ícone centrado numa faixa de 4 linhas (57,6);
          aberto: ícone + rótulo em faixas de 2 linhas (28,8) */}
      <nav
        className="flex flex-col overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: "none", padding: aberto ? "0 14px" : 0 }}
      >
        {itens.map((item) => {
          const ehAtivo = ativo === item.to;
          const badge = item.badge ? (stats?.[item.badge] ?? 0) : 0;
          const cor = ehAtivo ? "var(--yellow)" : "var(--on-rail)";
          return (
            <a
              key={item.label}
              href={item.to}
              title={aberto ? undefined : item.label}
              onClick={(e) => { e.preventDefault(); aoNavegar(item.to); }}
              className={`relative flex items-center whitespace-nowrap hover:opacity-80 ${aberto ? "" : "self-center justify-center"}`}
              style={{ color: cor, gap: 11, height: aberto ? linhas(2) : linhas(4), width: aberto ? "100%" : 34, padding: aberto ? "0 8px" : 0 }}
            >
              <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: aberto ? 24 : 34 }}>
                <i className={`ti ${iconeDe(item.label)}`} style={{ fontSize: aberto ? 22 : 30 }}></i>
                {/* Fechado: pontinho amarelo sinaliza pendências */}
                {!aberto && badge > 0 && (
                  <span
                    className="absolute rounded-full"
                    style={{ top: -1, right: -1, width: 9, height: 9, background: "var(--yellow)", boxShadow: "0 0 0 2px var(--rail-bg)" }}
                  />
                )}
              </span>
              {aberto && (
                <>
                  <span style={{ fontSize: 15, fontWeight: ehAtivo ? 700 : 500, lineHeight: `${LINHA}px` }}>{item.label}</span>
                  {badge > 0 && (
                    <span
                      className="fmono inline-flex items-center justify-center rounded-full"
                      style={{ minWidth: 18, height: 18, padding: "0 5px", background: "var(--yellow)", color: "var(--on-accent)", fontSize: 10, fontWeight: 700 }}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </>
              )}
            </a>
          );
        })}
      </nav>

      {/* Pé do rail (GRID.md §6.2, registrado nas linhas globais): versão na
          banda 65, banda 66 vazia, logo R2 amarelo nas linhas 67–69 (2 linhas),
          padding-baixo 46,4 até a base do rail (1040). Margem interna 13,1538.
          Aberto: lápis discreto para trocar os ícones manualmente. */}
      <div
        className="mt-auto shrink-0 flex flex-col items-stretch"
        style={{ padding: `0 ${MARGEM_RAIL}px ${CANVAS_H - MARGEM - linhas(69)}px` }}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: LINHA }}>
          <span className="select-none whitespace-nowrap" style={{ color: "var(--on-rail)", fontWeight: 600, fontSize: 13.711, lineHeight: `${LINHA}px` }}>
            {versao ?? "V. 0.01"}
          </span>
          {aberto && onEditarIcones && (
            <button
              onClick={onEditarIcones}
              title="Trocar os ícones do menu"
              className="flex items-center justify-center hover:opacity-90"
              style={{ width: LINHA, height: LINHA, color: "var(--on-rail)", opacity: 0.45 }}
            >
              <i className="ti ti-pencil" style={{ fontSize: 13 }}></i>
            </button>
          )}
        </div>
        <LogoR2 largura={aberto ? RAIL_FECHADO - 2 * MARGEM_RAIL : undefined} />
      </div>
    </div>
  );
}

/* ————— Blocos do topo ————— */
/** Bloco escuro do topo-direito (col 14–16, 3 colunas do grid):
    usuário + sino + engrenagem + sair. */
export function BlocoSinoConfig({ user, onLogout, onConfig }: {
  user?: SessionUser;
  onLogout?: () => void;
  onConfig?: () => void;
}) {
  return (
    <div
      className="absolute flex items-center"
      style={{
        right: MARGEM,
        top: TOPO_Y,
        width: colSpan(3),
        height: TOPBAR_H,
        background: "var(--rail-bg)",
        borderRadius: "var(--radius-rail)",
        gap: 16,
        padding: "0 22px",
        zIndex: 30,
      }}
    >
      {user && (
        <span
          className="fd truncate select-none mr-auto"
          style={{ color: "var(--yellow)", fontSize: 18, letterSpacing: "-0.3px", maxWidth: 150 }}
        >
          {user.nome.split(" ")[0]}
        </span>
      )}
      <NotificationBell escuro />
      {onConfig && (
        <button onClick={onConfig} aria-label="Configurações" className="flex items-center justify-center hover:opacity-75" style={{ width: 28, height: 28 }}>
          <i className="ti ti-settings" style={{ color: "var(--on-rail)", fontSize: 21 }}></i>
        </button>
      )}
      {onLogout && (
        <button onClick={onLogout} title="Encerrar a sessão" aria-label="Sair" className="flex items-center justify-center hover:opacity-75" style={{ width: 28, height: 28 }}>
          <i className="ti ti-logout" style={{ color: "var(--on-rail)", fontSize: 21 }}></i>
        </button>
      )}
    </div>
  );
}

/** Botão claro/amarelo da topbar (Mensagens / Anotações): controle de 3
    linhas (43,2) centrado na faixa de 5 (sobra exatamente 1 linha em cima e
    embaixo). Claro = borda cinza 1,6987pt; ativo = amarelo sem borda. */
export function BotaoTopbar({ icone, rotulo, amarelo, onClick, x, w }: {
  icone: string; rotulo: string; amarelo?: boolean; onClick: () => void; x: number; w: number;
}) {
  return (
    <button
      onClick={onClick}
      className="absolute flex items-center justify-center hover:opacity-85"
      style={{
        left: x,
        top: TOPO_Y + linhas(1),
        width: w,
        height: linhas(3),
        background: amarelo ? "var(--yellow)" : "var(--surface)",
        color: amarelo ? "var(--on-accent)" : "var(--text)",
        border: amarelo ? "none" : "var(--border-w) solid var(--stroke)",
        borderRadius: "var(--radius-card)",
        gap: 10,
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      <i className={`ti ${icone}`} style={{ fontSize: 20 }}></i>
      {rotulo}
    </button>
  );
}

/** Campo de pesquisa da topbar — mesma faixa de 3 linhas dos botões. */
export function BuscaTopbar({ valor, aoMudar, x, w, inputRef }: {
  valor: string; aoMudar: (v: string) => void; x: number; w: number;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="absolute" style={{ left: x, top: TOPO_Y + linhas(1), width: w, height: linhas(3) }}>
      <input
        ref={inputRef}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        placeholder="Pesquisa"
        title="Atalho: / foca a pesquisa · Esc limpa"
        className="w-full h-full outline-none"
        style={{
          background: "var(--surface)",
          color: "var(--text)",
          border: "var(--border-w) solid var(--stroke)",
          borderRadius: "var(--radius-card)",
          padding: "0 40px 0 20px",
          fontSize: 15,
          fontWeight: 500,
        }}
      />
      {valor ? (
        <button
          onClick={() => aoMudar("")}
          className="absolute hover:opacity-60"
          style={{ right: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text)" }}
        >
          <i className="ti ti-x" style={{ fontSize: 15 }}></i>
        </button>
      ) : (
        <i
          className="ti ti-search absolute pointer-events-none"
          style={{ right: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)", fontSize: 17 }}
        ></i>
      )}
    </div>
  );
}

/* ————— Shell: rail + geometria do conteúdo ————— */
const ICONES_KEY = "r2hub.v3.icones";

export function HubShell({ user, stats, ativo, aoNavegar, onLogout, versao, children }: {
  user: SessionUser;
  stats?: Partial<Record<StatKey, number>>;
  ativo?: string;
  aoNavegar: (to: string) => void;
  onLogout: () => void;
  versao?: string;
  children: (g: GridConteudo) => ReactNode;
}) {
  // Sempre fechado por padrão; abre no hover do rail e fecha quando sai.
  const [railAberto, setRailAberto] = useState(false);

  // Trocas manuais de ícone (rótulo → ti-*), guardadas neste navegador.
  const [icones, setIcones] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(ICONES_KEY) ?? "{}"); } catch { return {}; }
  });
  const [editandoIcones, setEditandoIcones] = useState(false);
  function salvarIcones(novos: Record<string, string>) {
    setIcones(novos);
    try { localStorage.setItem(ICONES_KEY, JSON.stringify(novos)); } catch { /* storage bloqueado */ }
    setEditandoIcones(false);
  }

  const g = gridConteudo(railAberto);
  return (
    <CanvasHub>
      {/* Painel branco de conteúdo (GRID.md §Fundo): unifica rail + miolo,
          da linha 9 até a margem inferior, cantos de raio 10. */}
      <div
        className="absolute"
        style={{ left: MARGEM, top: PAINEL_Y, width: CANVAS_W - 2 * MARGEM, height: PAINEL_H, background: "var(--surface)", borderRadius: "var(--radius-card)" }}
      />
      <RailV3
        user={user}
        stats={stats}
        ativo={ativo}
        aberto={railAberto}
        onToggle={() => setRailAberto((v) => !v)}
        onMouseSair={() => setRailAberto(false)}
        aoNavegar={aoNavegar}
        versao={versao}
        icones={icones}
        onEditarIcones={() => setEditandoIcones(true)}
      />
      {children(g)}
      {editandoIcones && (
        <ModalIcones
          itens={itensRail(user)}
          valores={icones}
          onSalvar={salvarIcones}
          onClose={() => setEditandoIcones(false)}
        />
      )}
    </CanvasHub>
  );
}

/** Modal "Ícones do menu": um campo por item com pré-visualização ao vivo.
    Aceita qualquer nome da webfont Tabler (tabler.io/icons — ex.: ti-home).
    Vazio = volta ao padrão. Guardado em localStorage (este navegador). */
function ModalIcones({ itens, valores, onSalvar, onClose }: {
  itens: MenuItem[];
  valores: Record<string, string>;
  onSalvar: (v: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState<Record<string, string>>({ ...valores });
  const preview = (label: string) => (v[label]?.trim() || ICONE_RAIL[label] || "ti-point");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-y-auto">
      <div className="my-auto w-full" style={{ ...CARD_V3, maxWidth: 460, padding: 22 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <h2 className="fd" style={{ fontSize: 20, color: "var(--text)" }}>Ícones do menu</h2>
          <button onClick={onClose} className="hover:opacity-60" style={{ color: "var(--text-muted)" }}>
            <i className="ti ti-x" style={{ fontSize: 18 }}></i>
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Use qualquer nome da biblioteca Tabler (tabler.io/icons), ex.: <span className="fmono">ti-home</span>.
          Deixe vazio para voltar ao padrão.
        </p>

        <div className="flex flex-col" style={{ gap: 8, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
          {itens.map((item) => (
            <div key={item.label} className="flex items-center" style={{ gap: 10 }}>
              <span
                className="flex items-center justify-center shrink-0"
                style={{ width: 38, height: 38, borderRadius: "var(--radius-field)", background: "var(--rail-bg)", color: "var(--on-rail)" }}
              >
                <i className={`ti ${preview(item.label)}`} style={{ fontSize: 20 }}></i>
              </span>
              <span className="shrink-0 truncate" style={{ width: 130, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{item.label}</span>
              <input
                value={v[item.label] ?? ""}
                onChange={(e) => setV((s) => ({ ...s, [item.label]: e.target.value }))}
                placeholder={ICONE_RAIL[item.label] ?? "ti-..."}
                className="fmono flex-1 min-w-0 outline-none"
                style={{
                  background: "var(--surface-sunken)",
                  color: "var(--text)",
                  borderRadius: "var(--radius-field)",
                  padding: "8px 10px",
                  fontSize: 12,
                }}
              />
              {v[item.label] && (
                <button
                  onClick={() => setV((s) => { const { [item.label]: _, ...resto } = s; return resto; })}
                  title="Voltar ao padrão"
                  className="shrink-0 hover:opacity-60"
                  style={{ color: "var(--text-muted)" }}
                >
                  <i className="ti ti-restore" style={{ fontSize: 16 }}></i>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex" style={{ gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setV({})}
            className="hover:opacity-75"
            style={{ flex: 1, padding: "10px 0", borderRadius: "var(--radius-field)", background: "var(--surface-sunken)", color: "var(--text)", fontSize: 13, fontWeight: 700 }}
          >
            Restaurar padrão
          </button>
          <button
            onClick={() => onSalvar(Object.fromEntries(Object.entries(v).filter(([, val]) => val.trim())))}
            className="hover:opacity-85"
            style={{ flex: 1, padding: "10px 0", borderRadius: "var(--radius-field)", background: "var(--ink)", color: "var(--yellow)", fontSize: 13, fontWeight: 700 }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ————— Títulos ————— */
/** Título de página ("Central", "Todos", …): Fraunces 95,8876 numa caixa de
    7 linhas (line-height 100,8 — GRID.md), TINTA alinhada à coluna. */
export function TituloPagina({ children, x, extra }: { children: ReactNode; x: number; extra?: ReactNode }) {
  return (
    <div className="absolute flex items-baseline" style={{ left: x, top: Y_TITULO, gap: 14, transition: TRANS_GRID }}>
      <h1 className="fd select-none" style={{ fontSize: TAM_TITULO, lineHeight: `${LH_TITULO}px`, letterSpacing: "-2px", color: "var(--text)", marginLeft: TINTA_FRAUNCES }}>
        {children}
      </h1>
      {extra}
    </div>
  );
}

/** Título de seção ("Em aberto", "Finalizados recentes") + ação "Ver todos". */
export function TituloSecao({ children, acao, onAcao, extra }: {
  children: ReactNode; acao?: string; onAcao?: () => void; extra?: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between">
      {/* Inter BOLD 39,8379 (DESIGN.md §2) numa caixa de 3 linhas (43,2):
          posicionado numa linha cheia (Y_SECAO = linha 15), a caixa termina
          na linha 18 — mesma linha em que termina o título da página. */}
      <div className="flex items-baseline gap-3" style={{ fontSize: FS_SECAO, lineHeight: `${linhas(3)}px`, fontWeight: 700, letterSpacing: "-0.5px", color: "var(--text)" }}>
        {children}
        {extra}
      </div>
      {acao && (
        <button onClick={onAcao} className="hover:opacity-70" style={{ fontSize: FS_MENOR, fontWeight: 500, color: "var(--text)" }}>
          {acao}
        </button>
      )}
    </div>
  );
}

/* ————— Tags e cards ————— */
/** Pílula/tag de status: amarela (quente) ou surface-sunken (fria). */
export function TagV3({ children, fria, mono }: { children: ReactNode; fria?: boolean; mono?: boolean }) {
  return (
    <span
      className={`inline-flex items-center uppercase whitespace-nowrap ${mono ? "fmono" : ""}`}
      style={{
        // fria = branca (legível também sobre o card cinza --gray-200)
        background: fria ? "var(--surface)" : "var(--yellow)",
        color: fria ? "var(--text-muted)" : "var(--on-accent)",
        borderRadius: "var(--radius-pill)",
        padding: "3px 9px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.03em",
        lineHeight: 1.4,
      }}
    >
      {children}
    </span>
  );
}

/* Status → rótulo + temperatura da orelha (DESIGN.md §Card de pedido). */
const STATUS_V3: Record<string, { label: string; orelha: "wait" | "doing" | "idle" }> = {
  nova: { label: "Nova", orelha: "wait" },
  criacao: { label: "Em criação", orelha: "doing" },
  aguardando: { label: "Aguardando", orelha: "wait" },
  revisao: { label: "Revisão", orelha: "wait" },
  aprovada: { label: "Aprovada", orelha: "doing" },
  cliche: { label: "Clichê solicitado", orelha: "doing" },
  concluido: { label: "Concluído", orelha: "idle" },
  cancelado: { label: "Cancelado", orelha: "idle" },
};
export const statusV3 = (s: string) => STATUS_V3[s] ?? STATUS_V3.nova;

function fmtData(s: string) {
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
export function diasDesdeV3(s: string): string {
  const dias = Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  return `há ${dias} dias`;
}

/** Card de pedido "Em aberto" (3 col × 12 linhas = 172,8): branco com borda
    cinza de 1,6987pt (sem sombra, sem orelha — DESIGN.md v5), nome do cliente
    em Fraunces BOLD 27,8358 (2 linhas de 28,8), #nº no canto, linha técnica
    minúscula em caixa alta e 3 tags amarelas no rodapé. */
export function CardPedidoV3({ p, naoVisto, onOpen, altura }: {
  p: any;
  naoVisto?: boolean;
  onOpen: () => void;
  /** default 12 linhas (172,8) */
  altura?: number;
}) {
  const isCliche = p.tipo === "cliche";
  const st = statusV3(p.status);
  const h = altura ?? linhas(12);
  return (
    /* A célula ocupa as 3 colunas cheias; a orelha CINZA (neutra, mockup v5)
       fica atrás da borda direita e o corpo do card reserva 16px para ela —
       nada sangra para fora do bloco. */
    <div className="relative" style={{ height: h }}>
      <div
        aria-hidden
        className="absolute"
        style={{ top: 0, bottom: 0, right: 0, width: 40, background: "var(--stroke)", borderRadius: "var(--radius-card)" }}
      />
      <div
        onClick={onOpen}
        className="group absolute cursor-pointer flex flex-col hover:-translate-y-[2px] transition-transform"
        style={{ ...CARD_V3, left: 0, top: 0, bottom: 0, right: 16, padding: `${linhas(1) - BORDA}px 20px 14px` }}
      >
      <div className="flex items-start justify-between gap-2">
        <div
          className="fd-b"
          style={{
            fontSize: FS_CARDNOME,
            // 2 linhas do ritmo por linha de texto (regra: lh múltiplo de 14,4)
            lineHeight: `${linhas(2)}px`,
            letterSpacing: "-0.5px",
            color: "var(--text)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {p.cliente}
        </div>
        <span className="shrink-0 flex items-center gap-[6px]" style={{ fontSize: FS_NUM, lineHeight: `${linhas(2)}px`, fontWeight: 500, color: "var(--text-muted)" }}>
          {naoVisto && (
            <span
              title="Atualizado desde sua última visita"
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: "var(--yellow)", boxShadow: "0 0 0 1.5px var(--ink)" }}
            />
          )}
          #{String(p.numero).padStart(2, "0")}
        </span>
      </div>

      <div className="uppercase truncate" style={{ marginTop: "auto", fontSize: FS_TECH, lineHeight: `${LINHA}px`, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text)" }}>
        {isCliche
          ? <>REPOSIÇÃO • CÓD. {p.codigo_produto}</>
          : <>{p.largura}X{p.altura} • {p.materia}{p.cores ? `, ${p.cores} CORES` : ""}</>}
      </div>

      <div className="flex items-center gap-[8px]" style={{ marginTop: 10 }}>
        <TagV3 fria={st.orelha === "idle"}>{st.label}</TagV3>
        <TagV3 mono>{fmtData(p.created_at)}</TagV3>
        <TagV3>{diasDesdeV3(p.created_at)}</TagV3>
      </div>

      {/* Ações rápidas no hover — copiar nº / resumo (não abre o pedido) */}
      <div
        className="absolute opacity-0 group-hover:opacity-100 transition flex gap-1"
        style={{ bottom: 12, right: 14, zIndex: 2 }}
        onClick={(e) => e.stopPropagation()}
      >
        <BotaoCopiar titulo="Copiar nº do pedido" icone="ti-hash" texto={`#${p.numero}`} />
        <BotaoCopiar
          titulo="Copiar resumo do pedido"
          icone="ti-copy"
          texto={
            isCliche
              ? `#${p.numero} ${p.cliente} — reposição de clichê, cód. ${p.codigo_produto} (${st.label})`
              : `#${p.numero} ${p.cliente} — ${p.materia} ${p.largura}×${p.altura}mm (${st.label})`
          }
        />
        </div>
      </div>
    </div>
  );
}

/** Card de faca em afiação — mesma anatomia do card de pedido. */
export function CardFacaV3({ f, onOpen, altura }: { f: any; onOpen: () => void; altura?: number }) {
  const h = altura ?? linhas(12);
  return (
    <div className="relative" style={{ height: h }}>
      <div
        aria-hidden
        className="absolute"
        style={{ top: 0, bottom: 0, right: 0, width: 40, background: "var(--stroke)", borderRadius: "var(--radius-card)" }}
      />
      <div
        onClick={onOpen}
        className="absolute cursor-pointer flex flex-col hover:-translate-y-[2px] transition-transform"
        style={{ ...CARD_V3, left: 0, top: 0, bottom: 0, right: 16, padding: `${linhas(1) - BORDA}px 20px 14px` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="fd-b" style={{ fontSize: FS_CARDNOME, lineHeight: `${linhas(2)}px`, letterSpacing: "-0.5px", color: "var(--text)" }}>{f.medida}</div>
          <span className="shrink-0" style={{ fontSize: FS_NUM, lineHeight: `${linhas(2)}px`, fontWeight: 500, color: "var(--text-muted)" }}>#{String(f.numero).padStart(4, "0")}</span>
        </div>
        <div className="uppercase truncate" style={{ marginTop: "auto", fontSize: FS_TECH, lineHeight: `${LINHA}px`, fontWeight: 700, letterSpacing: "0.05em", color: "var(--text)" }}>{f.substrato}</div>
        <div className="flex items-center gap-[8px]" style={{ marginTop: 10 }}>
          <TagV3>Em afiação</TagV3>
          <TagV3 mono>{fmtData(f.created_at)}</TagV3>
          <TagV3>{diasDesdeV3(f.created_at)}</TagV3>
        </div>
      </div>
    </div>
  );
}

function BotaoCopiar({ titulo, icone, texto }: { titulo: string; icone: string; texto: string }) {
  return (
    <button
      title={titulo}
      onClick={async () => {
        const { copiarTexto } = await import("@/lib/files");
        const { toast } = await import("sonner");
        copiarTexto(texto);
        toast.success("Copiado.");
      }}
      className="flex items-center justify-center rounded-full hover:opacity-80"
      style={{ width: 26, height: 26, background: "var(--surface)", color: "var(--text)", boxShadow: "var(--sh-pill)" }}
    >
      <i className={`ti ${icone}`} style={{ fontSize: 13 }}></i>
    </button>
  );
}

/** Estilo utilitário de card v5: branco, borda cinza de 1,6987pt, raio 10.
    Separação por BORDA + radius — nunca por sombra (DESIGN.md §3). */
export const CARD_V3: CSSProperties = {
  background: "var(--surface)",
  border: "var(--border-w) solid var(--stroke)",
  borderRadius: "var(--radius-card)",
};
