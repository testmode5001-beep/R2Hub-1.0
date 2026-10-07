// Estoque — v1a. Fonte: design_handoff_r2_hub/telas/Estoque.dc.html.
// Duas abas: "Falta de matéria-prima" (apontar/MP chegou/trocar bobina/
// reabrir) e "Etiquetas e medidas" (caixas por medida com −/+ e mínimo).
// Dados locais em dados/estoque.ts até existir backend.
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import {
  AMARELO, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import {
  MOTIVOS_MP, ajustarEtiqueta, lerEstoque, reabrirFaltaMP,
  registrarFaltaMP, removerEtiqueta, resolverFaltaMP, salvarEtiqueta, substituirMP,
} from "./dados/estoque";
import { criarBusca } from "@/lib/busca";
import type { Etiqueta, FaltaMP } from "./dados/estoque";

const VERMELHO = "#c0392b";

const APP_PARA_V1A: Record<string, string> = {
  nova: "Aguardando Design", criacao: "Aguardando Design",
  aguardando: "Aguardando aprovação", revisao: "Alteração pedida",
  aprovada: "Design aprovado", cliche: "Clichê solicitado",
  concluido: "Finalizado", cancelado: "Finalizado",
};

type Ped = { num: string; cliente: string; medida: string; substrato: string; cores: string; status: string; vendedora: string };

function diasDe(dataBR: string): number {
  const p = String(dataBR || "").split("/");
  if (p.length !== 3) return 0;
  const d = new Date(2000 + Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000));
}
const diasTexto = (n: number) => (n <= 0 ? "hoje" : n === 1 ? "1 dia" : `${n} dias`);

export function EstoqueV1a({ profile, pedidos, versao, aoNavegar, onNova, onLogout, disponiveis, children }: {
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
  const primeiroNome = String(profile.nome || "").trim().split(/\s+/)[0] || "—";
  const [buscaTopo, setBuscaTopo] = useState("");
  const [aba, setAba] = useState<"mp" | "etiquetas">("mp");
  const [buscaOS, setBuscaOS] = useState("");
  const [aviso, setAviso] = useState("");
  const [faltas, setFaltas] = useState<FaltaMP[]>([]);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  // modal apontar falta
  const [apNum, setApNum] = useState<string | null>(null);
  const [apMotivo, setApMotivo] = useState("");
  const [apPrevisao, setApPrevisao] = useState("");
  const [apObs, setApObs] = useState("");
  const [apQuem, setApQuem] = useState(primeiroNome);
  // modal trocar bobina
  const [trId, setTrId] = useState<string | null>(null);
  const [trEscolha, setTrEscolha] = useState("");
  const [trOutro, setTrOutro] = useState("");
  const [subExtras, setSubExtras] = useState<string[]>([]);
  // modal MP chegou
  const [chegouId, setChegouId] = useState<string | null>(null);
  const [chQuem, setChQuem] = useState(primeiroNome);
  // aba etiquetas
  const [filtroEtq, setFiltroEtq] = useState("Todas");
  const [novaMedida, setNovaMedida] = useState("");
  const [novaQtd, setNovaQtd] = useState("");
  const [novoSubstrato, setNovoSubstrato] = useState("");
  const [novaPorCaixa, setNovaPorCaixa] = useState("");
  const [novoMinimo, setNovoMinimo] = useState("");
  const [novoCliente, setNovoCliente] = useState("");

  /* Os dados vêm do banco (antes era localStorage, e cada computador via uma
     lista diferente). Toda ação recarrega a lista do servidor: assim o que
     aparece na tela é o que está gravado, não um palpite local. */
  async function recarregar() {
    const { faltas: fs, etiquetas: es } = await lerEstoque();
    setFaltas(fs);
    setEtiquetas(es);
  }
  /** Roda a ação e, se o servidor recusar, diz o motivo em vez de falhar calado. */
  async function comErro(acao: () => Promise<unknown>) {
    try { await acao(); } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível salvar. Tente de novo.");
    }
  }

  useEffect(() => { void comErro(recarregar); }, []);

  /* pedidos do app na forma da tela */
  const peds: Ped[] = pedidos.map((p) => ({
    num: "#" + String(p.numero).padStart(4, "0"),
    cliente: p.cliente,
    medida: `${p.largura}×${p.altura}`,
    substrato: p.materia,
    cores: String(p.cores ?? "—"),
    status: APP_PARA_V1A[p.status] ?? p.status,
    vendedora: p.vendedora ?? "—",
  }));
  const ped = (num: string) => peds.find((p) => p.num === num) ?? null;
  const specDe = (p: Ped | null) => (p ? `${p.medida} · ${p.substrato} · ${p.cores} ${/^\d+$/.test(p.cores) ? (p.cores === "1" ? "cor" : "cores") : ""}`.trim() : "—");

  const abertas = faltas.filter((f) => f.status === "aberta");
  const resolvidas = faltas.filter((f) => f.status !== "aberta");
  const abertoNum: Record<string, boolean> = {};
  abertas.forEach((f) => { abertoNum[f.num] = true; });

  const q = buscaOS.trim().replace(/^#/, "");
  const casaOS = criarBusca(q);
  const candidatos = q
    ? peds.filter((p) => p.status !== "Finalizado" || abertoNum[p.num])
      .filter((p) => casaOS(p.num.replace("#", ""), p.cliente))
      .slice(0, 4)
    : [];

  const diasAbertas = abertas.map((f) => diasDe(f.data));
  const mediaDias = diasAbertas.length ? Math.round(diasAbertas.reduce((a, b) => a + b, 0) / diasAbertas.length) : 0;

  const porSub: Record<string, number> = {};
  abertas.forEach((f) => {
    const p = ped(f.num);
    const k = p ? p.substrato : "—";
    porSub[k] = (porSub[k] || 0) + 1;
  });
  const maxSub = Math.max(1, ...Object.values(porSub));
  const comPrevisao = abertas.filter((f) => f.previsao);

  const apPedido = apNum ? ped(apNum) : null;
  const trFalta = trId ? faltas.find((f) => f.id === trId) ?? null : null;
  const trPedido = trFalta ? ped(trFalta.num) : null;
  const chFalta = chegouId ? faltas.find((f) => f.id === chegouId && f.status === "aberta") ?? null : null;
  const chPedido = chFalta ? ped(chFalta.num) : null;
  const trValor = (trOutro.trim() || trEscolha).trim();

  /* aba etiquetas */
  const nivel = (e: Etiqueta) => {
    const r = Number(e.caixas) || 0;
    const m = Number(e.minimo) || 0;
    if (r === 0) return "zerado";
    if (r <= m) return "baixo";
    return "ok";
  };
  const etqVisiveis = etiquetas.filter((e) => {
    const n = nivel(e);
    if (filtroEtq === "Abaixo do mínimo" && n === "ok") return false;
    if (filtroEtq === "Zeradas" && n !== "zerado") return false;
    return true;
  });
  const etqCriticas = etiquetas.filter((e) => nivel(e) !== "ok").length;
  const totalCaixas = etiquetas.reduce((t, e) => t + (Number(e.caixas) || 0), 0);
  const totalRolos = etiquetas.reduce((t, e) => t + (Number(e.caixas) || 0) * (Number(e.porCaixa) || 0), 0);
  const podeSalvarEtq = !!novaMedida.trim() && !!novoSubstrato;
  const CORN: Record<string, string> = { ok: "#1f8f4e", baixo: "#b8860b", zerado: VERMELHO };
  const BGN: Record<string, string> = { ok: "#d8ecd9", baixo: "#f8ecc9", zerado: "#fdeaea" };
  const ROTN: Record<string, string> = { ok: "Em estoque", baixo: "Repor", zerado: "Zerada" };

  const inp: CSSProperties = { width: "100%", boxSizing: "border-box", background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 7, padding: "12px 14px", font: "600 15px/1.2 Inter,sans-serif", color: INK, outline: "none" };
  const rotulo: CSSProperties = { display: "block", font: "600 15px/1 Inter,sans-serif", color: "#5c5a5c", marginBottom: 8 };
  const rotuloSm: CSSProperties = { display: "block", font: "600 13.5px/1 Inter,sans-serif", color: "#5c5a5c", marginBottom: 7 };
  const gridResolvidas = "88px 1.3fr 1.4fr 1.3fr 148px 1fr 108px";

  const avisoStrip = aviso && (
    <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, background: AMARELO, borderRadius: 8, padding: "14px 18px" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
      <span style={{ flex: 1, font: "600 15px/1.3 Inter,sans-serif", color: INK }}>{aviso}</span>
      <button type="button" onClick={() => setAviso("")} style={{ width: 26, height: 26, flex: "none", display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 6, cursor: "pointer" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );

  return (
    <EstagioV1a>
      <TopbarV1a nome={primeiroNome} busca={buscaTopo} aoBuscar={setBuscaTopo} onSair={onLogout} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="Estoque" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "0 6px 14px" }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ ...fr(144, 900), fontSize: 56, lineHeight: 1.06, letterSpacing: "-.02em", textIndent: "-.045em", whiteSpace: "nowrap", color: INK, margin: 0 }}>Estoque</h1>
              <div style={{ font: "400 17px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>
                {abertas.length
                  ? `${abertas.length} ${abertas.length === 1 ? "pedido parado" : "pedidos parados"} por falta de matéria-prima · média de ${diasTexto(mediaDias)} parado`
                  : "Nenhum pedido parado por falta de matéria-prima"}
              </div>
            </div>
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>busque a OS que está na sua mão</span>
              <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", borderRadius: 7, padding: "0 18px", height: 52, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input value={buscaOS} onChange={(e) => setBuscaOS(e.target.value)} placeholder="Nº da OS ou cliente" style={{ width: 300, border: 0, outline: 0, background: "transparent", font: "600 16px/1 Inter,sans-serif", color: INK }} />
                {buscaOS && (
                  <button type="button" onClick={() => setBuscaOS("")} style={{ width: 26, height: 26, flex: "none", display: "grid", placeItems: "center", background: "#f1f1f1", border: 0, borderRadius: 999, cursor: "pointer" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* abas */}
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, padding: "0 6px 12px" }}>
            {([
              { k: "mp" as const, label: "Falta de matéria-prima", conta: abertas.length },
              { k: "etiquetas" as const, label: "Etiquetas e medidas", conta: etiquetas.length },
            ]).map((a) => {
              const on = aba === a.k;
              return (
                <button key={a.k} type="button" className="r2chip" onClick={() => setAba(a.k)}
                  style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 8, padding: "12px 16px", cursor: "pointer", whiteSpace: "nowrap", font: "700 15px/1 Inter,sans-serif", background: on ? INK : "#fff", color: on ? AMARELO : "#5c5a5c" }}>
                  <span style={{ lineHeight: "15px" }}>{a.label}</span>
                  <span style={{ font: `800 13px/1 ${MONO}`, padding: "5px 8px", borderRadius: 999, background: on ? AMARELO : "#f1f1f1", color: INK }}>{a.conta}</span>
                </button>
              );
            })}
          </div>

          {aba === "mp" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
              {/* coluna esquerda */}
              <div style={{ flex: "0 0 356px", width: 356, minWidth: 0, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, background: AMARELO, borderRadius: 12, padding: "18px 18px 16px" }}>
                    <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: INK }}>{abertas.length}</div>
                    <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", color: "#5c5a5c", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Parados sem MP</div>
                  </div>
                  <div style={{ flex: 1, background: INK, borderRadius: 12, padding: "18px 18px 16px" }}>
                    <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: AMARELO }}>{mediaDias}</div>
                    <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", color: "#8d8b8d", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Dias parados (média)</div>
                  </div>
                </div>

                <div style={{ minWidth: 0, background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <span style={{ flex: "1 1 auto", minWidth: 0, font: "700 12.5px/1.2 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#8d8b8d" }}>Previsões de entrega</span>
                    <span style={{ flex: "none", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: "#f1f1f1", color: "#5c5a5c", borderRadius: 999, padding: "6px 9px" }}>
                      {comPrevisao.length} {comPrevisao.length === 1 ? "prevista" : "previstas"}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {comPrevisao.slice().sort((a, b) => a.previsao.split("/").reverse().join("").localeCompare(b.previsao.split("/").reverse().join(""))).map((f) => {
                      const p = ped(f.num);
                      const hoje = diasDe(f.previsao) === 0;
                      return (
                        <div key={f.id} style={{ background: "#fafafa", borderRadius: 8, borderLeft: `3px solid ${hoje ? AMARELO : "#d6d5d6"}`, padding: "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ font: `600 13.5px/1 ${MONO}`, color: "#8d8b8d" }}>{f.num}</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ font: "700 12px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", borderRadius: 999, padding: "7px 12px 6px", whiteSpace: "nowrap", background: hoje ? AMARELO : "#f1f1f1", color: INK }}>{hoje ? "hoje" : f.previsao}</span>
                          </div>
                          <div style={{ font: "700 15px/1.25 Inter,sans-serif", color: INK, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p ? p.cliente : "—"}</div>
                          <div style={{ font: "400 14px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 4 }}>{(p ? p.substrato : "—")} · {f.motivo.toLowerCase()}</div>
                        </div>
                      );
                    })}
                    {comPrevisao.length === 0 && (
                      <div style={{ font: "400 14.5px/1.45 Inter,sans-serif", color: "#b3b1b3" }}>Nenhuma previsão de entrega cadastrada nas faltas abertas.</div>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0, background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                  <div style={{ font: "700 12.5px/1.2 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 14 }}>Falta por substrato</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                    {Object.keys(porSub).sort((a, b) => porSub[b] - porSub[a]).map((k) => (
                      <div key={k}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                          <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.2 Inter,sans-serif", color: "#5c5a5c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
                          <span style={{ font: `700 14.5px/1 ${MONO}`, color: INK }}>{porSub[k]}</span>
                        </div>
                        <div style={{ height: 9, borderRadius: 999, background: "#f1f1f1", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.round((porSub[k] / maxSub) * 100)}%`, borderRadius: 999, background: AMARELO }} />
                        </div>
                      </div>
                    ))}
                    {Object.keys(porSub).length === 0 && <div style={{ font: "400 14.5px/1.45 Inter,sans-serif", color: "#b3b1b3" }}>Nada em falta agora.</div>}
                  </div>
                  <div style={{ font: "400 14.5px/1.45 Inter,sans-serif", color: "#b3b1b3", marginTop: 18 }}>
                    O saldo de bobinas ainda é controlado fora do sistema. Esta tela já está pronta para receber o estoque quando ele entrar aqui.
                  </div>
                </div>
              </div>

              {/* coluna direita */}
              <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                {avisoStrip}

                {candidatos.length > 0 && (
                  <div style={{ flex: "none", minWidth: 0, background: INK, borderRadius: 12, padding: "18px 20px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <span style={{ font: "800 19px/1 Inter,sans-serif", color: "#f1f1f1", letterSpacing: "-.01em" }}>OS encontradas</span>
                      <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: AMARELO, color: INK, borderRadius: 999, padding: "7px 10px" }}>
                        {candidatos.length} {candidatos.length === 1 ? "pedido" : "pedidos"}
                      </span>
                      <span style={{ flex: 1 }} />
                      <span style={{ font: "400 14px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>clique para apontar a falta</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {candidatos.map((p) => {
                        const parado = !!abertoNum[p.num];
                        return (
                          <div key={p.num} style={{ display: "grid", gridTemplateColumns: "88px 1.5fr 1.6fr 150px auto", gap: 12, alignItems: "center", background: "#2f2d2f", borderRadius: 8, padding: "13px 16px" }}>
                            <span style={{ font: `600 14.5px/1 ${MONO}`, color: "#8d8b8d" }}>{p.num}</span>
                            <span style={{ font: "700 16px/1.2 Inter,sans-serif", color: "#f1f1f1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente}</span>
                            <span style={{ font: "500 15px/1.2 Inter,sans-serif", color: "#b3b1b3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{specDe(p)}</span>
                            <span style={{ justifySelf: "start", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", borderRadius: 999, padding: "8px 13px 7px", whiteSpace: "nowrap", background: "#454345", color: "#f1f1f1" }}>{p.status}</span>
                            <button type="button" className="r2chip"
                              onClick={() => { if (!parado) { setApNum(p.num); setApMotivo(""); setApPrevisao(""); setApObs(""); setAviso(""); } }}
                              style={{ flex: "none", border: 0, borderRadius: 7, padding: "12px 16px", font: "700 14px/1 Inter,sans-serif", whiteSpace: "nowrap", background: parado ? "#454345" : AMARELO, color: parado ? "#8d8b8d" : INK, cursor: parado ? "not-allowed" : "pointer" }}>
                              {parado ? "Já apontado" : "Apontar falta"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* parados */}
                <div style={{ flex: "none", minWidth: 0, background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Parados por falta de MP</span>
                    <span style={{ font: "700 13px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: "#f1f1f1", color: "#5c5a5c", borderRadius: 999, padding: "7px 11px" }}>
                      {abertas.length} {abertas.length === 1 ? "pedido" : "pedidos"}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>seguem em vermelho no Painel até a MP chegar</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {abertas.slice().sort((a, b) => diasDe(b.data) - diasDe(a.data)).map((f) => {
                      const p = ped(f.num);
                      const dias = diasDe(f.data);
                      return (
                        <div key={f.id} style={{ display: "flex", flexDirection: "column", background: "#fafafa", borderRadius: 10, borderLeft: `4px solid ${VERMELHO}`, padding: "16px 18px 18px", minHeight: 250 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ font: `600 14px/1 ${MONO}`, color: "#8d8b8d" }}>{f.num}</span>
                            <span style={{ flex: 1 }} />
                            <span style={{ font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, whiteSpace: "nowrap", background: dias >= 3 ? VERMELHO : AMARELO, color: dias >= 3 ? "#fff" : INK }}>
                              parado {diasTexto(dias)}
                            </span>
                          </div>
                          <div style={{ ...fr(72, 700), fontSize: 26, lineHeight: 1.1, letterSpacing: "-.02em", color: INK, marginTop: 12 }}>{p ? p.cliente : "—"}</div>
                          <div style={{ font: "700 14.5px/1.3 Inter,sans-serif", color: VERMELHO, marginTop: 10 }}>{f.motivo}</div>
                          <div style={{ font: "500 15px/1.35 Inter,sans-serif", color: "#5c5a5c", marginTop: 7 }}>{specDe(p)}</div>
                          <div style={{ flex: 1, minHeight: 0, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 7 }}>{f.obs || "Sem observação do estoque."}</div>
                          <div style={{ font: "400 13.5px/1.3 Inter,sans-serif", color: "#b3b1b3", marginTop: 10 }}>
                            Apontado {f.data} {f.hora} · {f.quem}{f.previsao ? ` · previsão ${f.previsao}` : " · sem previsão"}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                            <button type="button" className="r2chip" onClick={() => { setChegouId(f.id); setAviso(""); }}
                              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: INK, border: 0, borderRadius: 7, padding: 13, cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", color: AMARELO }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 3.5v11" /><path d="m8 10.5 4 4 4-4" /><path d="M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16" /></svg>
                              <span style={{ lineHeight: "16px" }}>MP chegou</span>
                            </button>
                            <button type="button" className="r2chip" title="Resolver com outra bobina" onClick={() => { setTrId(f.id); setTrEscolha(""); setTrOutro(""); setAviso(""); }}
                              style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, background: AMARELO, border: 0, borderRadius: 7, padding: "13px 14px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", color: INK }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 8h13l-3-3" /><path d="M20 16H7l3 3" /></svg>
                              <span style={{ lineHeight: "16px" }}>Trocar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {abertas.length === 0 && (
                      <div style={{ gridColumn: "1/-1", display: "grid", placeItems: "center", background: "#fafafa", border: "2px dashed #d6d5d6", borderRadius: 12, padding: 44, font: "400 15px/1.5 Inter,sans-serif", color: "#8d8b8d", textAlign: "center" }}>
                        Nada parado por falta de matéria-prima.<br />Busque a OS que está na sua mão para apontar uma falta.
                      </div>
                    )}
                  </div>
                </div>

                {/* resolvidas */}
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "20px 22px 16px", boxShadow: SOMBRA_CARD }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Resolvidas</span>
                    <span style={{ font: "700 13px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: "#f1f1f1", color: "#5c5a5c", borderRadius: 999, padding: "7px 11px" }}>
                      {resolvidas.length} {resolvidas.length === 1 ? "falta" : "faltas"}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>tempo parado vai para Apontamentos</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: gridResolvidas, gap: 12, padding: "0 8px 9px", borderBottom: "2px solid #f1f1f1" }}>
                    {["Nº", "Cliente", "Motivo", "Como saiu", "Situação", "Resolvido", ""].map((l, i) => (
                      <span key={i} style={{ font: "700 11.5px/1.2 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span>
                    ))}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {resolvidas.map((f, i) => {
                      const p = ped(f.num);
                      const trocou = f.status === "substituida";
                      return (
                        <div key={f.id} className="r2row" style={{ display: "grid", gridTemplateColumns: gridResolvidas, gap: 12, alignItems: "center", minHeight: 54, padding: "10px 8px", borderRadius: 6, background: i % 2 ? "#fafafa" : "transparent" }}>
                          <span style={{ font: `600 14.5px/1.2 ${MONO}`, color: "#8d8b8d" }}>{f.num}</span>
                          <span style={{ font: "700 15px/1.2 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p ? p.cliente : "—"}</span>
                          <span style={{ font: "500 15px/1.25 Inter,sans-serif", color: "#5c5a5c" }}>{f.motivo}</span>
                          <span style={{ font: "500 15px/1.25 Inter,sans-serif", color: "#5c5a5c" }}>{trocou ? `trocou por ${f.substituto || "—"}` : "MP chegou"}</span>
                          <span style={{ justifySelf: "start", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "8px 13px 7px", borderRadius: 999, whiteSpace: "nowrap", background: trocou ? AMARELO : "#d8ecd9", color: trocou ? INK : "#1e5b2a" }}>
                            {trocou ? "Substituída" : "Resolvida"}
                          </span>
                          <span style={{ font: "400 14.5px/1.3 Inter,sans-serif", color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(f.resolvidoEm || "—")} · {(f.resolvidoPor || "—")}</span>
                          <button type="button" className="r2chip" title="Voltar para aguardando MP"
                            onClick={() => { void comErro(async () => { setFaltas(await reabrirFaltaMP(f.id)); setAviso(`${f.num} voltou para aguardando MP.`); }); }}
                            style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: 7, border: "2px solid #f1f1f1", borderRadius: 999, padding: "8px 12px", cursor: "pointer", font: "700 13px/1 Inter,sans-serif", color: INK, background: "#fff", whiteSpace: "nowrap" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 9.5h11a5 5 0 1 1 0 10H9" /><path d="M8 5 3.5 9.5 8 14" /></svg>
                            <span style={{ lineHeight: "13px" }}>Reabrir</span>
                          </button>
                        </div>
                      );
                    })}
                    {resolvidas.length === 0 && (
                      <div style={{ padding: "34px 0", textAlign: "center", font: "400 15px/1.5 Inter,sans-serif", color: "#8d8b8d" }}>Nenhuma falta resolvida ainda.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {aba === "etiquetas" && (
            <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
              {/* coluna esquerda */}
              <div style={{ flex: "0 0 356px", width: 356, minWidth: 0, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, background: AMARELO, borderRadius: 12, padding: "18px 18px 16px" }}>
                    <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: INK }}>{etiquetas.length}</div>
                    <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", color: "#5c5a5c", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Medidas em estoque</div>
                  </div>
                  <div style={{ flex: 1, background: INK, borderRadius: 12, padding: "18px 18px 16px" }}>
                    <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: AMARELO }}>{etqCriticas}</div>
                    <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", color: "#8d8b8d", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>Abaixo do mínimo</div>
                  </div>
                </div>

                <div style={{ minWidth: 0, background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                  <div style={{ font: "700 12.5px/1.2 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 14 }}>Cadastrar medida</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={rotuloSm}>Medida</label>
                      <input value={novaMedida} onChange={(e) => setNovaMedida(e.target.value)} placeholder="70x50" style={inp} />
                    </div>
                    <div>
                      <label style={rotuloSm}>Caixas</label>
                      <input value={novaQtd} onChange={(e) => setNovaQtd(e.target.value.replace(/[^0-9]/g, ""))} placeholder="4" style={inp} />
                    </div>
                  </div>
                  <label style={{ ...rotuloSm, margin: "14px 0 7px" }}>Substrato</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {["BOPP branco", "BOPP transparente", "BOPP fosco", "Couché", "Térmico", "Polietileno", "BOPP prata"].map((nome) => {
                      const on = novoSubstrato === nome;
                      return (
                        <button key={nome} type="button" className="r2chip" onClick={() => setNovoSubstrato(nome)}
                          style={{ border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "600 14px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                          {nome}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                    <div>
                      <label style={rotuloSm}>Rolos por caixa</label>
                      <input value={novaPorCaixa} onChange={(e) => setNovaPorCaixa(e.target.value.replace(/[^0-9]/g, ""))} placeholder="20" style={inp} />
                    </div>
                    <div>
                      <label style={rotuloSm}>Mínimo</label>
                      <input value={novoMinimo} onChange={(e) => setNovoMinimo(e.target.value.replace(/[^0-9]/g, ""))} placeholder="4" style={inp} />
                    </div>
                  </div>
                  <label style={{ ...rotuloSm, margin: "14px 0 7px" }}>Cliente</label>
                  <input value={novoCliente} onChange={(e) => setNovoCliente(e.target.value)} placeholder="opcional" style={inp} />
                  <button type="button" className="r2chip"
                    onClick={() => { void comErro(async () => {
                      if (!podeSalvarEtq) return;
                      setEtiquetas(await salvarEtiqueta({
                        medida: novaMedida.trim(), substrato: novoSubstrato, cliente: novoCliente.trim(),
                        caixas: Number(novaQtd) || 0, porCaixa: Number(novaPorCaixa) || 20, minimo: Number(novoMinimo) || 3,
                      }));
                      setNovaMedida(""); setNovaQtd(""); setNovoSubstrato(""); setNovaPorCaixa(""); setNovoMinimo(""); setNovoCliente("");
                      setAviso("Medida adicionada ao estoque de etiquetas.");
                    }); }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, width: "100%", marginTop: 16, border: 0, borderRadius: 7, padding: 14, font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: podeSalvarEtq ? "pointer" : "not-allowed", opacity: podeSalvarEtq ? 1 : 0.45 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                    <span style={{ lineHeight: "15px" }}>Adicionar ao estoque</span>
                  </button>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: INK, borderRadius: 12, padding: "20px 22px 18px" }}>
                  <div style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d" }}>Total no estoque</div>
                  <div style={{ ...fr(96, 700), fontSize: 40, lineHeight: 1.1, letterSpacing: "-.03em", color: AMARELO, marginTop: 10 }}>
                    {totalCaixas} {totalCaixas === 1 ? "caixa" : "caixas"}
                  </div>
                  <div style={{ font: "400 15px/1.5 Inter,sans-serif", color: "#b3b1b3", marginTop: 10 }}>
                    {totalRolos ? `cerca de ${totalRolos.toLocaleString("pt-BR")} rolos, somando todas as medidas.` : "Nenhuma caixa em estoque no momento."}
                  </div>
                </div>
              </div>

              {/* coluna direita */}
              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                {avisoStrip}
                <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, background: "#fff", borderRadius: 10, padding: "11px 14px" }}>
                  <span style={{ flex: "none", font: "700 13px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d" }}>Filtrar</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["Todas", "Abaixo do mínimo", "Zeradas"].map((nome) => {
                      const on = filtroEtq === nome;
                      return (
                        <button key={nome} type="button" className="r2chip" onClick={() => setFiltroEtq(nome)}
                          style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                          {nome}
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>
                    {etqVisiveis.length} {etqVisiveis.length === 1 ? "medida" : "medidas"} · use − e + para dar baixa ou entrada de caixas
                  </span>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, alignContent: "start" }}>
                    {etqVisiveis.map((e) => {
                      const n = nivel(e);
                      const alvo = Math.max(1, (Number(e.minimo) || 0) * 2);
                      const pct = Math.min(100, Math.round(((Number(e.caixas) || 0) / alvo) * 100));
                      return (
                        <div key={e.id} style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "18px 20px 16px", borderLeft: `6px solid ${CORN[n]}`, boxShadow: SOMBRA_CARD }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ ...fr(72, 700), fontSize: 28, lineHeight: 1.08, letterSpacing: "-.02em", color: INK }}>{e.medida}</div>
                              <div style={{ font: "500 14.5px/1.35 Inter,sans-serif", color: "#5c5a5c", marginTop: 8 }}>{e.substrato}</div>
                            </div>
                            <span style={{ flex: "none", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, whiteSpace: "nowrap", background: BGN[n], color: CORN[n] }}>{ROTN[n]}</span>
                          </div>
                          <div style={{ font: "400 14px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {[e.cliente || "sem cliente fixo", `${e.porCaixa} rolos/caixa`, `${(Number(e.caixas) || 0) * (Number(e.porCaixa) || 0)} rolos`, `mín. ${e.minimo} cx`].join(" · ")}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14 }}>
                            <button type="button" className="r2chip" title="Baixar uma caixa" onClick={() => { void comErro(async () => setEtiquetas(await ajustarEtiqueta(e.id, -1))); }}
                              style={{ flex: "none", width: 38, height: 38, display: "grid", placeItems: "center", background: "#f1f1f1", border: 0, borderRadius: 7, cursor: "pointer" }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round"><path d="M5.5 12h13" /></svg>
                            </button>
                            <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                              <div style={{ font: "800 26px/1 Inter,sans-serif", letterSpacing: "-.03em", color: INK }}>{e.caixas}</div>
                              <div style={{ font: "600 11.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#b3b1b3", marginTop: 6 }}>caixas</div>
                            </div>
                            <button type="button" className="r2chip" title="Entrar uma caixa" onClick={() => { void comErro(async () => setEtiquetas(await ajustarEtiqueta(e.id, 1))); }}
                              style={{ flex: "none", width: 38, height: 38, display: "grid", placeItems: "center", background: AMARELO, border: 0, borderRadius: 7, cursor: "pointer" }}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                            </button>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                            <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#f1f1f1", overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: n === "ok" ? AMARELO : CORN[n] }} />
                            </div>
                            <button type="button" title="Remover do estoque"
                              onClick={() => { void comErro(async () => { setEtiquetas(await removerEtiqueta(e.id)); setAviso(`${e.medida} removida do estoque de etiquetas.`); }); }}
                              style={{ flex: "none", width: 30, height: 30, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 6, cursor: "pointer" }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 7h15" /><path d="M9 7V4.5h6V7" /><path d="M6.5 7v12.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V7" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {etqVisiveis.length === 0 && (
                      <div style={{ gridColumn: "1/-1", display: "grid", placeItems: "center", background: "#fafafa", border: "2px dashed #d6d5d6", borderRadius: 12, padding: 44, font: "400 15px/1.5 Inter,sans-serif", color: "#8d8b8d", textAlign: "center" }}>
                        Nenhuma medida com esse filtro.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* modal — apontar falta */}
      {apPedido && (
        <div onClick={() => setApNum(null)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 720, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{apPedido.num} · {apPedido.cliente}</div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1.1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>Faltou matéria-prima</div>
              </div>
              <button type="button" className="r2ic" onClick={() => setApNum(null)} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, paddingBottom: 18, borderBottom: "2px solid #f1f1f1" }}>
                {[
                  { k: "Medida", v: apPedido.medida },
                  { k: "Substrato", v: apPedido.substrato },
                  { k: "Cores", v: apPedido.cores },
                  { k: "Vendedora", v: apPedido.vendedora },
                ].map((e) => (
                  <div key={e.k}>
                    <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3" }}>{e.k}</div>
                    <div style={{ font: "700 17px/1.2 Inter,sans-serif", color: INK, marginTop: 8 }}>{e.v}</div>
                  </div>
                ))}
              </div>

              <label style={{ ...rotulo, margin: "20px 0 10px" }}>Motivo da falta <span style={{ color: INK }}>*</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {MOTIVOS_MP.map((m) => {
                  const on = apMotivo === m;
                  return (
                    <button key={m} type="button" className="r2chip" onClick={() => setApMotivo(m)}
                      style={{ textAlign: "left", border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 7, padding: "14px 15px", font: "600 15px/1.25 Inter,sans-serif", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                      {m}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
                <div>
                  <label style={rotulo}>Previsão de entrega</label>
                  <input value={apPrevisao} onChange={(e) => setApPrevisao(e.target.value)} placeholder="dd/mm/aa" style={inp} />
                </div>
                <div>
                  <label style={rotulo}>Apontado por</label>
                  <input value={apQuem} onChange={(e) => setApQuem(e.target.value)} placeholder="Cleber" style={inp} />
                </div>
              </div>

              <label style={{ ...rotulo, margin: "20px 0 8px" }}>O que falta</label>
              <textarea value={apObs} onChange={(e) => setApObs(e.target.value)} placeholder="Ex.: rolo com 380 m, precisa de 900 m" style={{ ...inp, minHeight: 80, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
                {apMotivo ? `A vendedora ${apPedido.vendedora} e o gestor são avisados; o pedido fica em alerta no Painel.` : "Escolha o motivo da falta para apontar."}
              </span>
              <button type="button" className="r2chip" onClick={() => setApNum(null)} style={{ background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer" }}>Cancelar</button>
              <button type="button" className="r2chip"
                onClick={() => { void comErro(async () => {
                  if (!apMotivo) return;
                  setFaltas(await registrarFaltaMP({ num: apPedido.num, motivo: apMotivo, obs: apObs.trim(), previsao: apPrevisao.trim(), quem: apQuem.trim() || primeiroNome }));
                  setApNum(null);
                  setBuscaOS("");
                  setAviso(`Falta apontada em ${apPedido.num}. ${apPedido.vendedora} e gestor avisados.`);
                }); }}
                style={{ display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: apMotivo ? "pointer" : "not-allowed", opacity: apMotivo ? 1 : 0.45 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 4v10" /><path d="M12 18.5h.01" /></svg>
                <span style={{ lineHeight: "18px" }}>Apontar falta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal — substituir bobina */}
      {trFalta && (
        <div onClick={() => setTrId(null)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 660, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{trFalta.num} · {trPedido ? trPedido.cliente : "—"}</div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1.1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>Substituir bobina</div>
              </div>
              <button type="button" className="r2ic" onClick={() => setTrId(null)} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD }}>
              <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3" }}>Pedido pede</div>
              <div style={{ font: "700 19px/1.2 Inter,sans-serif", color: INK, marginTop: 8 }}>{trPedido ? `${trPedido.substrato} · ${trPedido.medida}` : "—"}</div>
              <label style={{ ...rotulo, margin: "20px 0 4px" }}>Vai usar <span style={{ color: INK }}>*</span></label>
              <div style={{ font: "400 13.5px/1.4 Inter,sans-serif", color: "#b3b1b3", marginBottom: 10 }}>substratos já usados em pedidos do R2 Hub, ou cadastre um novo abaixo</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(() => {
                  const usados: string[] = [];
                  peds.forEach((p) => { if (p.substrato && !usados.includes(p.substrato)) usados.push(p.substrato); });
                  const atual = trPedido ? trPedido.substrato : "";
                  return usados.filter((n) => n !== atual).sort((a, b) => a.localeCompare(b, "pt-BR")).concat(subExtras);
                })().map((nome) => {
                  const on = trEscolha === nome && !trOutro.trim();
                  return (
                    <button key={nome} type="button" className="r2chip" onClick={() => { setTrEscolha(nome); setTrOutro(""); }}
                      style={{ border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                      {nome}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input value={trOutro} onChange={(e) => setTrOutro(e.target.value)} placeholder="ou cadastre um substrato novo (ex.: BOPP AA 640)" style={{ ...inp, flex: 1, width: "auto" }} />
                <button type="button" className="r2chip"
                  onClick={() => {
                    const nome = trOutro.trim();
                    if (!nome) return;
                    setSubExtras(subExtras.includes(nome) ? subExtras : [...subExtras, nome]);
                    setTrEscolha(nome);
                    setTrOutro("");
                  }}
                  style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, border: 0, borderRadius: 7, padding: "0 18px", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: trOutro.trim() ? "pointer" : "not-allowed", opacity: trOutro.trim() ? 1 : 0.45 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                  <span style={{ lineHeight: "15px" }}>Cadastrar</span>
                </button>
              </div>
              <div style={{ font: "400 13.5px/1.4 Inter,sans-serif", color: "#b3b1b3", marginTop: 8 }}>Substrato digitado aqui vale para esta troca; para a lista de todos, cadastre em Afiação → substratos.</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, background: AMARELO, borderRadius: 8, padding: "14px 16px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.5 7 8.5 5.5L20.5 7" /></svg>
                <span style={{ font: "600 14.5px/1.35 Inter,sans-serif", color: INK }}>
                  {trValor ? `Vendedora ${trPedido ? trPedido.vendedora : ""} e gestor recebem o aviso da troca por ${trValor}.` : "Escolha a bobina que vai entrar no lugar."}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>A troca fica registrada no quadro do Estoque, com data e quem registrou.</span>
              <button type="button" className="r2chip" onClick={() => setTrId(null)} style={{ background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer" }}>Cancelar</button>
              <button type="button" className="r2chip"
                onClick={() => { void comErro(async () => {
                  if (!trValor) return;
                  setFaltas(await substituirMP(trFalta.id, trValor));
                  setTrId(null);
                  setAviso(`Troca registrada em ${trFalta.num}: ${trValor} · vendedora e gestor avisados.`);
                }); }}
                style={{ display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: trValor ? "pointer" : "not-allowed", opacity: trValor ? 1 : 0.45 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
                <span style={{ lineHeight: "18px" }}>Registrar troca</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal — MP chegou */}
      {chFalta && (
        <div onClick={() => setChegouId(null)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 63, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 600, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{chFalta.num} · {chPedido ? chPedido.cliente : "—"}</div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1.1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>A MP chegou?</div>
              </div>
              <button type="button" className="r2ic" onClick={() => setChegouId(null)} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD }}>
              <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3" }}>Matéria-prima que faltava</div>
              <div style={{ font: "700 19px/1.25 Inter,sans-serif", color: INK, marginTop: 8 }}>{chPedido ? `${chPedido.substrato} · ${chPedido.medida}` : "—"}</div>
              <div style={{ font: "400 15px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 6 }}>{chFalta.motivo}{chFalta.obs ? `: ${chFalta.obs}` : ""}</div>
              <label style={{ ...rotulo, margin: "20px 0 8px" }}>Quem recebeu</label>
              <input value={chQuem} onChange={(e) => setChQuem(e.target.value)} placeholder="Cleber" style={inp} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, background: "#f1f1f1", borderRadius: 8, padding: "14px 16px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
                <span style={{ font: "500 14.5px/1.35 Inter,sans-serif", color: "#5c5a5c" }}>Ao confirmar, {chFalta.num} sai do alerta vermelho e volta para a fila de produção.</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>Parado {diasTexto(diasDe(chFalta.data))} · apontado por {chFalta.quem}</span>
              <button type="button" className="r2chip" onClick={() => setChegouId(null)} style={{ background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer" }}>Cancelar</button>
              <button type="button" className="r2chip"
                onClick={() => { void comErro(async () => {
                  setFaltas(await resolverFaltaMP(chFalta.id, chQuem.trim()));
                  setChegouId(null);
                  setAviso(`MP de ${chFalta.num} recebida. Pedido liberado para produção.`);
                }); }}
                style={{ display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: "pointer" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 12.5 9 17.5 20 6.5" /></svg>
                <span style={{ lineHeight: "18px" }}>Sim, a MP chegou</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </EstagioV1a>
  );
}
