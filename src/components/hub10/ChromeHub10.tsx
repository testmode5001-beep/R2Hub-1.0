// Cromo compartilhado da geração 1.0 — o palco e a barra do topo.
//
// Nasceu de dentro da HomeHub10 quando a segunda tela 1.0 (Novo pedido) ia
// copiar a mesma barra. Barra duplicada é barra que diverge: um dia alguém
// acrescenta um item de menu num arquivo e esquece o outro, e o hub passa a
// ter duas navegações diferentes dependendo de onde você está.
//
// A barra cuida do próprio estado (pesquisa, notificações, configurações,
// sair) e lê o resto do contexto do hub. Quem a usa só diz qual página está
// ativa e o que fazer ao navegar.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { BuscaGlobalV1a } from "../v1a/BuscaGlobalV1a";
import { useHubDados } from "../v1a/HubDadosV1a";
import { ConfigModalV1a } from "../v1a/modais/TopoModaisV1a";
import type { SessionUser } from "@/lib/session";

/* ————— kit 1.0 —————
   Preto #000 e amarelo #fff079 (o #FFE815 só no "+"), que NÃO são os do kit
   V1a. É decisão do design, seguida à risca. */
export const PRETO = "#000000";
export const AMARELO = "#fff079";
export const AMARELO_MAIS = "#FFE815";
export const FUNDO = "#f1f1f1";
export const INTER = "Inter, system-ui, sans-serif";
export const FR: CSSProperties = { fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 72", fontWeight: 600 };

export const BOTAO_CLARO: CSSProperties = { border: `1px solid ${PRETO}`, borderRadius: 999, background: "#fff", color: PRETO, fontFamily: INTER, fontSize: 15, fontWeight: 600, padding: "9px 18px", cursor: "pointer" };
export const BOTAO_ESCURO: CSSProperties = { ...BOTAO_CLARO, background: PRETO, color: "#fff" };
export const FECHAR_X: CSSProperties = { width: 30, height: 30, borderRadius: 999, border: `1px solid ${PRETO}`, background: "#fff", fontSize: 16, lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
export const CAIXA: CSSProperties = { position: "absolute", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 20, boxShadow: "0 18px 44px rgba(0,0,0,.22)", overflow: "hidden" };
export const CABECA = (bg: string): CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px 15px", background: bg, borderBottom: `1px solid ${PRETO}` });
export const AREA_TEXTO: CSSProperties = { width: "100%", resize: "none", border: `1.5px dashed ${PRETO}`, borderRadius: 14, padding: "12px 14px", fontFamily: INTER, color: PRETO, background: "#f8f8f8", outline: "none", boxSizing: "border-box" };

/** Fundo dos painéis das telas 1.0 — cinza bem claro em vez de branco. Os
    menus e caixas que abrem POR CIMA continuam brancos, e é isso que os
    descola do painel em vez de deixá-los sumir nele. */
export const FUNDO_PAINEL = "#f5f5f5";

/** Número do pedido como o hub inteiro escreve: dois dígitos, com #. */
export const numeroPedido = (n: number) => `#${String(n).padStart(2, "0")}`;

/** Rótulo + valor do rodapé dos cards 1.0 (Entrada, Cores, Medida,
    Substrato). Mora aqui porque o card da trilha e o cartão do painel de
    detalhe desenham o mesmo par — e, separados, o conserto de um não
    chegava no outro.

    O valor vai em no máximo duas linhas, com entrelinha fechada: o
    protótipo deixa a caixa crescer porque os dados dele são curtos, mas
    "BOPP metalizado" quebra em duas e a segunda vazava por baixo da borda
    do card. O nome inteiro continua nas Especificações. */
export function CampoHub10({ rotulo, valor, caixa }: {
  rotulo: string; valor: string; caixa?: CSSProperties;
}) {
  return (
    /* minWidth 0 + quebra em qualquer ponto: "metalizado" é uma palavra só e
       mais larga que a coluna. Sem isso a coluna `auto` da grade crescia até
       caber a palavra inteira e empurrava o bloco para fora do card. */
    <div style={{ minWidth: 0, ...caixa }}>
      <div style={{ fontSize: 24, fontWeight: 400 }}>{rotulo}</div>
      <div style={{ marginTop: 4, fontSize: 24, lineHeight: "30px", fontWeight: 800, fontFamily: "Fraunces", letterSpacing: "-1px", overflowWrap: "anywhere", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden" }}>{valor}</div>
    </div>
  );
}

/* [rótulo na barra, página do hub]. Central, Fábrica, OP, Afiação, Estoque e
   Mural ficaram de fora porque serão descontinuadas — não é lacuna. */
export const MENU: [string, string][] = [
  ["HOME", "Home"], ["PEDIDOS", "Pedidos"], ["APROVAÇÕES", "Aprovação"],
  ["PANTONES", "Pantone"], ["FACAS", "Facas"], ["CLIENTES", "Clientes"],
  ["ARQUIVOS", "Arquivos"], ["CALC'S", "Calculadoras"], ["RELATÓRIOS", "Apontamentos"],
  ["EQUIPE", "Equipe"],
];

/* O palco do 1.0 é 1920×1080 fixo, escalado para CABER na janela (min de
   largura/altura) — diferente da largura fluida do V1a. Toda tela cabe sem
   scroll, que é a regra estrutural do handoff. */
export function PalcoFixo({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w > 0 && h > 0) setEscala(Math.min(w / 1920, h / 1080));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: "100vh", overflow: "hidden", background: "#e4e4e4" }}>
      <div style={{ position: "absolute", left: "50%", top: "50%", width: 1920, height: 1080, transform: `translate(-50%,-50%) scale(${escala})`, transformOrigin: "center center", background: FUNDO, overflow: "hidden", color: PRETO, fontFamily: INTER, WebkitFontSmoothing: "antialiased" }}>
        {children}
      </div>
    </div>
  );
}

export function BarraTopoHub10({ profile, paginaAtiva, aoNavegar, onNova, onLogout, disponiveis }: {
  profile: SessionUser;
  /** página do hub que esta tela representa — fica sublinhada e não navega */
  paginaAtiva: string;
  aoNavegar: (label: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  /** páginas que a pessoa pode abrir; undefined = todas */
  disponiveis?: string[];
}) {
  const dados = useHubDados();
  const [busca, setBusca] = useState("");
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [notifAberto, setNotifAberto] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);
  const [logoutAberto, setLogoutAberto] = useState(false);

  /* ESC fecha o que a barra abriu. Cada tela cuida do que é dela. */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setBuscaAberta(false); setNotifAberto(false); setConfigAberta(false); setLogoutAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const menu = MENU.filter(([, pagina]) => pagina === paginaAtiva || !disponiveis || disponiveis.includes(pagina));
  const podeCriar = !!onNova && (!disponiveis || disponiveis.includes("Novo pedido"));

  const notifs = dados.notificacoes ?? [];
  const naoLidas = notifs.filter((n) => !n.lida).length;
  const abrirNotif = () => {
    const abrir = !notifAberto;
    setNotifAberto(abrir);
    if (abrir && naoLidas > 0 && dados.aoMarcarNotificacoes) void dados.aoMarcarNotificacoes().catch(() => { /* fica como não lida */ });
  };
  const quandoNotif = (isoData: string) => {
    const d = new Date(isoData);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}  ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  return (
    <>
      {configAberta && <ConfigModalV1a nome={profile.nome} fechar={() => setConfigAberta(false)} />}

      {logoutAberto && (
        <div style={{ ...CAIXA, left: 760, top: 392, width: 400, zIndex: 95, boxShadow: "0 24px 60px rgba(0,0,0,.32)" }}>
          <div style={CABECA(AMARELO)}>
            <span style={{ ...FR, fontSize: 26, lineHeight: 1 }}>Sair da conta</span>
            <button onClick={() => setLogoutAberto(false)} aria-label="Fechar" style={FECHAR_X}>✕</button>
          </div>
          <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <span style={{ fontSize: 17, lineHeight: 1.4, color: "#444" }}>Deseja encerrar a sessão no R2hub?</span>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setLogoutAberto(false)} style={{ ...BOTAO_CLARO, padding: "10px 20px" }}>Cancelar</button>
              <button onClick={onLogout} style={{ ...BOTAO_ESCURO, padding: "10px 20px" }}>Sair</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 112, background: "#fff", borderBottom: `1px solid ${PRETO}`, zIndex: 40 }}>
        <img src="/home10/wordmark.svg" alt="R2 Etiquetas" style={{ position: "absolute", left: 80, top: 47, height: 17.56, width: "auto" }} />
        <nav style={{ position: "absolute", left: 480, top: 0, height: 112, display: "flex", alignItems: "center", gap: 15 }}>
          {menu.map(([rotulo, pagina]) => (
            <a key={rotulo} href="#" onClick={(e) => { e.preventDefault(); if (pagina !== paginaAtiva) aoNavegar(pagina); }}
              className={`h10-navi${pagina === paginaAtiva ? " on" : ""}`}
              style={{ fontSize: 16, fontWeight: 500, letterSpacing: ".01em", color: PRETO, whiteSpace: "nowrap", textDecoration: "none" }}>{rotulo}</a>
          ))}
        </nav>
        {podeCriar && (
          <button onClick={onNova} className="h10-navi" title="Novo pedido" aria-label="Novo pedido"
            style={{ position: "absolute", left: 400, top: 36, display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, background: AMARELO_MAIS, border: `1px solid ${PRETO}`, borderRadius: 999, cursor: "pointer", padding: 0 }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>
        )}
        {/* pesquisa: o protótipo desenha só o rótulo; aqui é a busca real do hub */}
        <div style={{ position: "absolute", left: 1440, top: 37, width: 240, height: 38, background: FUNDO, borderRadius: 4, display: "flex", alignItems: "center" }}>
          <input value={busca} onChange={(e) => { setBusca(e.target.value); setBuscaAberta(true); }} onFocus={() => setBuscaAberta(true)}
            placeholder="PESQUISA" aria-label="Pesquisa"
            style={{ flex: 1, minWidth: 0, height: "100%", border: 0, outline: 0, background: "transparent", textAlign: busca ? "left" : "center", padding: "0 12px", fontFamily: INTER, fontSize: 13, letterSpacing: busca ? 0 : ".18em", color: PRETO }} />
          {buscaAberta && (
            <BuscaGlobalV1a consulta={busca} pedidos={dados.buscaPedidos} paginas={dados.paginasDisponiveis}
              aoAbrirPedido={dados.aoAbrirPedido} aoNavegar={dados.aoNavegar ?? aoNavegar} aoFechar={() => setBuscaAberta(false)} />
          )}
        </div>
        <div style={{ position: "absolute", right: 80, top: 0, height: 112, display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <button onClick={abrirNotif} className="h10-dot" title="Notificações" aria-label="Notificações"
              style={{ position: "relative", width: 30, height: 30, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
              <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              {naoLidas > 0 && (
                <span style={{ position: "absolute", top: -6, right: -7, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999, background: "#f96767", color: "#fff", fontFamily: INTER, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
                  {naoLidas > 9 ? "9+" : naoLidas}
                </span>
              )}
            </button>
            {notifAberto && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 14px)", width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 14, padding: 10, zIndex: 60, boxShadow: "0 22px 50px -18px rgba(0,0,0,.5)" }}>
                <div style={{ padding: "6px 10px 10px", ...FR, fontSize: 20 }}>Notificações</div>
                {notifs.length ? notifs.slice(0, 40).map((n) => (
                  <div key={n.id} onClick={() => { if (n.url && dados.aoAbrirNotificacao) { setNotifAberto(false); dados.aoAbrirNotificacao(n.url); } }}
                    style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 12px", borderRadius: 10, background: n.lida ? "#f7f7f5" : "#fff5a8", marginBottom: 6, cursor: n.url ? "pointer" : "default" }}>
                    <div style={{ fontSize: 14, lineHeight: 1.35, color: PRETO }}>{n.titulo}{n.corpo ? ` — ${n.corpo}` : ""}</div>
                    <div style={{ fontSize: 12, color: "#8f8f8f" }}>{quandoNotif(n.created_at)}</div>
                  </div>
                )) : (
                  <div style={{ padding: "12px 10px 14px", fontSize: 14, color: "#b3b1b3", fontStyle: "italic" }}>Sem notificações.</div>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setConfigAberta(true)} className="h10-dot" title="Configurações" aria-label="Configurações"
            style={{ width: 30, height: 30, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button onClick={() => setLogoutAberto(true)} className="h10-dot" title="Sair" aria-label="Sair"
            style={{ width: 30, height: 30, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
            <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          </button>
        </div>
      </div>
    </>
  );
}
