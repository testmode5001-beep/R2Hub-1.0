// Mural — v1a. Fonte: design_handoff_r2_hub/telas/Mural.dc.html.
// Monta o mural do monitor da fábrica a partir das fontes reais do app:
// máquinas (localStorage do Painel), clichês (pedidos "cliche"), faltas de MP
// (dados/estoque), afiação e facas novas (dados da Afiação). Modo monitor via
// ?mural=<fontes>&maq=<máquinas> — frame preto 1920×1080 sem chrome.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import {
  AMARELO, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { listFacas } from "@/lib/api/facas.functions";
import { listPainel } from "@/lib/api/painel.functions";
import { lerFaltas } from "./dados/estoque";
import type { FaltaMP } from "./dados/estoque";

const VERMELHO = "#c0392b";
const MAQUINAS_PADRAO = [
  { k: "classic", nome: "Classic", valor: 180 },
  { k: "force", nome: "Force", valor: 260 },
  { k: "maqflex", nome: "Maqflex", valor: 210 },
  { k: "delrey4", nome: "Del Rey 4", valor: 240 },
  { k: "delrey5", nome: "Del Rey 5", valor: 280 },
  { k: "rebob1", nome: "Rebobinadeira 1", valor: 90 },
  { k: "rebob2", nome: "Rebobinadeira 2", valor: 90 },
];

const FONTES = [
  { k: "maquinas", label: "Painéis por máquina", nota: "OP, cronômetro e custo em curso" },
  { k: "cliches", label: "Clichês na clicheria", nota: "enviados e aguardando retorno" },
  { k: "mp", label: "OP aguardando matéria-prima", nota: "paradas apontadas no estoque" },
  { k: "afiacao", label: "Facas para afiação", nota: "fora da casa, com dias corridos" },
  { k: "facas_novas", label: "Facas novas", nota: "fila de compra de ferramental" },
];

function lerLS<T>(chave: string, padrao: T): T {
  if (typeof window === "undefined") return padrao;
  try {
    const cru = localStorage.getItem(chave);
    if (cru) {
      const v = JSON.parse(cru);
      if (v !== null && v !== undefined) return v as T;
    }
  } catch { /* corrompido */ }
  return padrao;
}

function hms(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 3600)).padStart(2, "0")}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
const brl = (v: number) => "R$ " + (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numFaca = (n: number) => "#" + String(n).padStart(4, "0");

type Item = { num: string; titulo: string; tag: string; sub: string };
type Painel = { chave: string; titulo: string; conta: string; nota: string; tema: string; itens: Item[]; vazioTexto: string };

export function MuralV1a({ profile, pedidos, versao, aoNavegar, onNova, onLogout, disponiveis, children }: {
  profile: { nome: string; role?: string };
  pedidos: any[];
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({ maquinas: true, cliches: true });
  const [maqSel, setMaqSel] = useState<string[]>([]);
  const [modo, setModo] = useState(false);
  const [, setTick] = useState(0);
  /* As faltas de MP vêm do banco. O mural fica horas sozinho num monitor da
     fábrica, então relê a cada 30s — ninguém está lá para apertar F5. */
  const [faltasMP, setFaltasMP] = useState<FaltaMP[]>([]);
  /* Máquinas e o que cada uma roda vêm do banco: o mural costuma ficar num
     monitor que NÃO é o computador onde a OP foi carregada. */
  const [maquinasBanco, setMaquinasBanco] = useState<any[]>([]);
  const [estadoBanco, setEstadoBanco] = useState<Record<string, any>>({});
  /* Facas na afiação e a fila de facas novas: também do banco (era o
     localStorage da tela de Afiação, que o monitor da fábrica nunca teve). */
  const [facasAfiacao, setFacasAfiacao] = useState<any[]>([]);

  const maquinasDisponiveis = () => (maquinasBanco.length ? maquinasBanco : MAQUINAS_PADRAO);

  useEffect(() => {
    const par = new URLSearchParams(window.location.search);
    const mural = par.get("mural");
    const maq = par.get("maq");
    if (mural) {
      const s: Record<string, boolean> = {};
      String(mural).split(",").filter(Boolean).forEach((k) => { s[k] = true; });
      setSel(s);
      setModo(true);
    }
    setMaqSel(maq ? String(maq).split(",").filter(Boolean) : maquinasDisponiveis().map((m) => m.k));
    const t = setInterval(() => setTick(Date.now()), 1000);
    const puxarFaltas = () => { void lerFaltas().then(setFaltasMP).catch(() => { /* servidor fora: mantém a última lista */ }); };
    const puxarPainel = () => { void (listPainel() as Promise<any>).then((r) => {
      setMaquinasBanco(r?.maquinas ?? []);
      const mapa: Record<string, any> = {};
      for (const e of (r?.estados ?? [])) { try { mapa[String(e.maquina)] = JSON.parse(e.estado_json); } catch { /* linha corrompida */ } }
      setEstadoBanco(mapa);
    }).catch(() => { /* servidor fora: mantém o que está na tela */ }); };
    puxarPainel();
    const puxarFacas = () => { void (listFacas() as Promise<any[]>).then((r) => setFacasAfiacao(r ?? [])).catch(() => { /* sem permissão ou servidor fora */ }); };
    puxarFacas();
    const tfa = setInterval(puxarFacas, 30_000);
    const tp = setInterval(puxarPainel, 5_000);
    puxarFaltas();
    const tf = setInterval(puxarFaltas, 30_000);
    return () => { clearInterval(t); clearInterval(tf); clearInterval(tp); clearInterval(tfa); };
  }, []);

  const estadoMaquinas = () => estadoBanco;
  const decorrido = (st: any) => {
    if (!st) return 0;
    const base = Number(st.acumulado) || 0;
    return st.rodando && st.inicio ? base + (Date.now() - st.inicio) : base;
  };

  const painelDe = (k: string): Painel => {
    const def = maquinasDisponiveis().find((m) => m.k === k) ?? { k, nome: k, valor: 0 };
    const st = estadoMaquinas()[k] ?? {};
    const ativo = !!st.pedido;
    const ms = ativo ? decorrido(st) : 0;
    const valorHora = Number(st.valor ?? def.valor) || 0;
    const custo = ativo ? (ms / 3_600_000) * valorHora : 0;
    return {
      chave: "maq-" + k,
      titulo: def.nome,
      conta: ativo ? (st.rodando ? "rodando" : "pausada") : "livre",
      nota: ativo ? `${brl(custo)} em curso` : "sem OP carregada",
      tema: ativo ? (st.rodando ? "amarelo" : "escuro") : "claro",
      itens: ativo ? [{
        num: "OP " + String(st.pedido.op || st.pedido.num || "").replace("#", ""),
        titulo: st.pedido.cliente || "—",
        tag: hms(ms),
        sub: [st.pedido.medida, st.pedido.substrato, st.pedido.qtdCores ? `${st.pedido.qtdCores} cores` : "", st.pedido.prazo ? `entrega ${st.pedido.prazo}` : ""].filter(Boolean).join(" · "),
      }] : [],
      vazioTexto: "Máquina livre. Carregue uma OP na Fábrica.",
    };
  };

  const paineisSelecionados = (): Painel[] => {
    const lista: Painel[] = [];

    if (sel.maquinas) maqSel.forEach((k) => lista.push(painelDe(k)));

    if (sel.cliches) {
      const cl = pedidos.filter((p) => p.status === "cliche");
      lista.push({
        chave: "cliches",
        titulo: "Clichês na clicheria",
        conta: `${cl.length} ${cl.length === 1 ? "clichê" : "clichês"}`,
        nota: "aguardando retorno",
        tema: "escuro",
        itens: cl.slice(0, 8).map((p) => ({
          num: "#" + String(p.numero).padStart(4, "0"),
          titulo: p.cliente,
          tag: p.emailEnviado === false ? "e-mail pendente" : "enviado",
          sub: [p.motivo ?? (p.tipo === "cliche" ? "Reposição" : "Arte nova"), `${p.tipo_cliche ?? "1,14"} mm`, `${p.largura}×${p.altura}`].filter(Boolean).join(" · "),
        })),
        vazioTexto: "Nenhum clichê na clicheria.",
      });
    }

    if (sel.mp) {
      const faltas = faltasMP.filter((f) => f.status === "aberta");
      lista.push({
        chave: "mp",
        titulo: "Aguardando matéria-prima",
        conta: `${faltas.length} ${faltas.length === 1 ? "OP" : "OPs"}`,
        nota: "apontadas no estoque",
        tema: "vermelho",
        itens: faltas.slice(0, 8).map((f) => {
          const p = pedidos.find((x) => "#" + String(x.numero).padStart(4, "0") === f.num);
          return {
            num: f.num,
            titulo: p ? p.cliente : "—",
            tag: f.previsao ? `prev. ${f.previsao}` : "sem previsão",
            sub: [f.motivo, p ? p.materia : "", f.obs].filter(Boolean).join(" · "),
          };
        }),
        vazioTexto: "Nada parado por falta de matéria-prima.",
      });
    }

    if (sel.afiacao) {
      const regs = facasAfiacao.filter((f: any) => f.status === "enviada");
      lista.push({
        chave: "afiacao",
        titulo: "Facas para afiação",
        conta: `${regs.length} ${regs.length === 1 ? "faca" : "facas"}`,
        nota: "fora da casa",
        tema: "claro",
        itens: regs.map((f) => ({
          num: numFaca(f.n),
          titulo: f.medida,
          tag: `há ${f.envio} ${f.envio === 1 ? "dia" : "dias"}`,
          sub: `${f.substrato} · enviada por ${f.quem}`,
        })),
        vazioTexto: "Nenhuma faca em afiação.",
      });
    }

    if (sel.facas_novas) {
      const regs = facasAfiacao.filter((f: any) => f.nova_solicitada);
      const pedidas = facasAfiacao.filter((f: any) => f.nova_pedida).map((f: any) => Number(f.numero));
      lista.push({
        chave: "facas_novas",
        titulo: "Facas novas",
        conta: `${regs.length} ${regs.length === 1 ? "faca" : "facas"}`,
        nota: "fila de compra",
        tema: "amarelo",
        itens: regs.map((f) => ({
          num: numFaca(f.n),
          titulo: f.medida,
          tag: pedidas.includes(f.n) ? "Pedida" : "Aguardando pedido",
          sub: `${f.substrato} · ${f.obs || "Retorno ruim na afiação"}`,
        })),
        vazioTexto: "Nenhuma faca nova na fila.",
      });
    }

    return lista;
  };

  const disponiveisM = maquinasDisponiveis();
  const paineis = paineisSelecionados();
  const colunas = paineis.length <= 2 ? paineis.length || 1 : paineis.length <= 6 ? 3 : 4;

  const contaDe = (k: string) => {
    if (k === "maquinas") return String(maqSel.length);
    if (k === "cliches") return String(pedidos.filter((p) => p.status === "cliche").length);
    if (k === "mp") return String(faltasMP.filter((f) => f.status === "aberta").length);
    if (k === "afiacao") return String(facasAfiacao.filter((f: any) => f.status === "enviada").length);
    return String(facasAfiacao.filter((f: any) => f.nova_solicitada).length);
  };

  const url = (() => {
    if (typeof window === "undefined") return "";
    const ks = FONTES.filter((f) => sel[f.k]).map((f) => f.k);
    const par = new URLSearchParams(window.location.search);
    par.set("mural", ks.join(","));
    if (sel.maquinas && maqSel.length) par.set("maq", maqSel.join(","));
    else par.delete("maq");
    return `${window.location.pathname}?${par.toString()}`;
  })();

  const fundoDe = (t: string) => (t === "amarelo" ? AMARELO : t === "escuro" ? INK : t === "vermelho" ? "#2f2d2f" : "#fff");
  const fgDe = (t: string) => (t === "amarelo" || t === "claro" ? INK : "#f1f1f1");
  const subDe = (t: string) => (t === "amarelo" ? "#5c5a5c" : t === "claro" ? "#8d8b8d" : "#b3b1b3");

  const grade = (
    <div style={{ flex: "1 1 auto", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 12, overflow: modo ? undefined : "hidden" }}>
      {paineis.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${colunas},minmax(0,1fr))`, gap: modo ? 14 : 12, alignContent: "stretch" }}>
          {paineis.map((p) => {
            const t = p.tema;
            return (
              <div key={p.chave} style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden", borderRadius: 14, padding: modo ? "22px 24px 20px" : "18px 20px 16px", background: fundoDe(t), borderLeft: t === "vermelho" ? `8px solid ${VERMELHO}` : undefined, boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                  <span style={{ ...fr(72, 700), fontSize: modo ? 30 : 23, lineHeight: 1.08, letterSpacing: "-.02em", color: fgDe(t) }}>{p.titulo}</span>
                  <span style={{ flex: "none", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, whiteSpace: "nowrap", background: t === "amarelo" ? INK : t === "claro" ? "#f1f1f1" : "#3a383a", color: t === "amarelo" ? AMARELO : t === "claro" ? "#5c5a5c" : "#f1f1f1" }}>{p.conta}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: `500 ${modo ? 15 : 14}px/1.3 Inter,sans-serif`, whiteSpace: "nowrap", color: subDe(t) }}>{p.nota}</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
                  {p.itens.map((i, idx) => (
                    <div key={idx} style={{ flex: "none", borderRadius: 10, padding: modo ? "14px 16px" : "11px 13px", background: t === "claro" ? (idx % 2 ? "#fafafa" : "#f6f6f6") : t === "amarelo" ? "rgba(37,36,37,.08)" : "#2f2d2f" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                        <span style={{ flex: "none", font: `600 ${modo ? 15 : 13.5}px/1 ${MONO}`, color: subDe(t) }}>{i.num}</span>
                        <span style={{ minWidth: 0, font: `700 ${modo ? 20 : 16}px/1.2 Inter,sans-serif`, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: fgDe(t) }}>{i.titulo}</span>
                        <span style={{ flex: 1 }} />
                        <span style={{ flex: "none", font: `700 ${modo ? 14 : 12.5}px/1 ${MONO}`, letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", color: t === "amarelo" || t === "claro" ? INK : AMARELO }}>{i.tag}</span>
                      </div>
                      <div style={{ font: `400 ${modo ? 15 : 13.5}px/1.35 Inter,sans-serif`, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: subDe(t) }}>{i.sub}</div>
                    </div>
                  ))}
                  {p.itens.length === 0 && (
                    <div style={{ flex: 1, display: "grid", placeItems: "center", border: `2px dashed ${t === "claro" || t === "amarelo" ? "#d6d5d6" : "#454345"}`, borderRadius: 10, padding: 22, textAlign: "center", font: "400 15px/1.45 Inter,sans-serif", color: subDe(t) }}>
                      {p.vazioTexto}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex: 1, display: "grid", placeItems: "center", background: "#fff", border: "2px dashed #d6d5d6", borderRadius: 12, padding: 48, font: "400 16px/1.5 Inter,sans-serif", color: "#8d8b8d", textAlign: "center" }}>
          Escolha ao lado o que deve aparecer no mural.<br />Nada marcado ainda.
        </div>
      )}
    </div>
  );

  if (modo) {
    return (
      <EstagioV1a altura={1080} fundo={INK}>
        {grade}
        {children}
      </EstagioV1a>
    );
  }

  return (
    <EstagioV1a>
      <TopbarV1a nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""} busca={busca} aoBuscar={setBusca} onSair={onLogout} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="Mural" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "0 6px 14px" }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ ...fr(144, 900), fontSize: 56, lineHeight: 1.06, letterSpacing: "-.02em", textIndent: "-.045em", whiteSpace: "nowrap", color: INK, margin: 0 }}>Mural</h1>
              <div style={{ font: "400 17px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>
                {paineis.length
                  ? `${paineis.length} ${paineis.length === 1 ? "painel escolhido" : "painéis escolhidos"} · a aba do mural mostra só eles`
                  : "Escolha os painéis que vão aparecer no monitor da fábrica"}
              </div>
            </div>
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" className="r2chip" onClick={() => { setSel({}); setMaqSel([]); }}
                style={{ display: "flex", alignItems: "center", gap: 9, background: "#fff", border: 0, borderRadius: 7, padding: "16px 20px", cursor: "pointer", font: "600 15px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap", boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4.5 12a7.5 7.5 0 1 0 3-6" /><path d="M4 4.5V10h5.5" /></svg>
                <span style={{ lineHeight: "16px" }}>Limpar seleção</span>
              </button>
              <button type="button" className="r2chip"
                onClick={() => { if (paineis.length) { try { window.open(url, "_blank"); } catch { /* pop-up bloqueado */ } } }}
                style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 7, padding: "16px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap", background: AMARELO, cursor: paineis.length ? "pointer" : "not-allowed", opacity: paineis.length ? 1 : 0.45 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M13.5 4.5h6v6" /><path d="M19.5 4.5 11 13" /><path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6h4" /></svg>
                <span style={{ lineHeight: "17px" }}>Abrir mural em nova aba</span>
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
            {/* coluna esquerda */}
            <div style={{ flex: "0 0 356px", width: 356, minWidth: 0, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ minWidth: 0, background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                <div style={{ font: "700 12.5px/1.2 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 14 }}>O que vai no mural</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {FONTES.map((f) => {
                    const on = !!sel[f.k];
                    return (
                      <button key={f.k} type="button" className="r2chip" onClick={() => setSel((s) => ({ ...s, [f.k]: !s[f.k] }))}
                        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 8, padding: "13px 14px", background: on ? "#fffbe0" : "#fafafa" }}>
                        <span style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: 6, background: on ? AMARELO : "#e4e4e4" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={on ? INK : "#e4e4e4"} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 12.5 4 4 8-9" /></svg>
                        </span>
                        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <span style={{ display: "block", font: "700 15.5px/1.2 Inter,sans-serif", color: INK }}>{f.label}</span>
                          <span style={{ display: "block", font: "400 13.5px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 4 }}>{f.nota}</span>
                        </span>
                        <span style={{ flex: "none", font: `800 14.5px/1 ${MONO}`, color: on ? INK : "#b3b1b3" }}>{contaDe(f.k)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ minWidth: 0, background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ flex: "1 1 auto", minWidth: 0, font: "700 12.5px/1.2 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#8d8b8d" }}>Máquinas da fábrica</span>
                  <button type="button" className="r2chip" onClick={() => setMaqSel(maqSel.length === disponiveisM.length ? [] : disponiveisM.map((m) => m.k))}
                    style={{ flex: "none", background: "#f1f1f1", border: 0, borderRadius: 999, padding: "7px 12px 6px", cursor: "pointer", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", color: "#5c5a5c" }}>
                    {maqSel.length === disponiveisM.length ? "Desmarcar todas" : "Marcar todas"}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {disponiveisM.map((m) => {
                    const on = maqSel.includes(m.k);
                    return (
                      <button key={m.k} type="button" className="r2chip"
                        onClick={() => setMaqSel(on ? maqSel.filter((x) => x !== m.k) : [...maqSel, m.k])}
                        style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                        {m.nome}
                      </button>
                    );
                  })}
                </div>
                <div style={{ font: "400 14px/1.45 Inter,sans-serif", color: "#b3b1b3", marginTop: 14 }}>
                  Cada máquina marcada entra como um painel com a OP, o cronômetro e o custo em curso.
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: INK, borderRadius: 12, padding: "20px 22px 18px" }}>
                <div style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d" }}>Como usar</div>
                <div style={{ font: "400 15px/1.5 Inter,sans-serif", color: "#b3b1b3", marginTop: 10 }}>
                  Marque os painéis, confira a prévia ao lado e clique em <strong style={{ color: AMARELO }}>abrir mural em nova aba</strong>. A aba mostra só os painéis escolhidos, para deixar num monitor da fábrica.
                </div>
                <div style={{ font: `500 13.5px/1.4 ${MONO}`, color: "#8d8b8d", marginTop: 14, overflowWrap: "anywhere" }}>{url}</div>
              </div>
            </div>

            {grade}
          </div>
        </div>
      </div>
      {children}
    </EstagioV1a>
  );
}
