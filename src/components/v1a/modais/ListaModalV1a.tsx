// Lista (modal) — v1a. Fonte: design_handoff_r2_hub/telas/Lista-modal.dc.html.
// Tabela de pedidos "em aberto" ou "finalizados" com filtro e Exportar.
// Recebe itens já no formato v1a (num/cliente/spec ou medida·sub/prazo/apro/status).
import { useState } from "react";

import { criarBusca } from "@/lib/busca";
import { AMARELO, INK, MONO, fr } from "../HubV1a";

const STATUS: Record<string, { bg: string; fg: string }> = {
  "Aguardando Design": { bg: "#f1f1f1", fg: "#252425" },
  "Clichê solicitado": { bg: "#ffe815", fg: "#252425" },
  "Aguardando clichê": { bg: "#ffe815", fg: "#252425" },
  "Design aprovado": { bg: "#252425", fg: "#ffe815" },
  "Alteração pedida": { bg: "#252425", fg: "#f1f1f1" },
  "Aguardando aprovação": { bg: "#f1f1f1", fg: "#6f6d6f" },
  "Clichê recebido": { bg: "#fffbe0", fg: "#252425" },
  "Em produção": { bg: "#252425", fg: "#ffe815" },
  "Finalizado": { bg: "#f1f1f1", fg: "#8d8b8d" },
  "Cancelado": { bg: "#252425", fg: "#f1f1f1" },
};

export type ItemLista = {
  num?: string; cliente: string; spec?: string; medida?: string; sub?: string;
  prazo?: string; apro?: string; status?: string;
};

const GRID = "88px 1fr 132px 156px 132px 150px";

export function ListaModalV1a({ tipo, itens, fechar, onAbrir, onExportar }: {
  tipo: "abertos" | "finalizados";
  itens: ItemLista[];
  fechar: () => void;
  onAbrir?: (item: ItemLista) => void;
  onExportar?: () => void;
}) {
  const [busca, setBusca] = useState("");
  const finalizados = tipo === "finalizados";
  const casa = criarBusca(busca);

  const linhas = itens
    .map((p, i) => {
      const partes = String(p.spec || "").split(" · ");
      return {
        num: p.num || "#" + String(400 + i),
        cliente: p.cliente,
        medida: p.medida || partes[0] || "—",
        sub: p.sub || partes[1] || "—",
        data: finalizados ? (p.apro && p.apro !== "—" ? "aprov. " + p.apro : "sem aprovação") : "entrega " + (p.prazo || "—"),
        status: finalizados ? (p.apro && p.apro !== "—" ? "Finalizado" : "Cancelado") : (p.status || "Aguardando Design"),
        fonte: p,
      };
    })
    .filter((r) => casa(r.cliente, r.num, r.medida, r.sub));

  const colunas = ["Nº", "Cliente", "Medida", "Substrato", finalizados ? "Aprovação" : "Entrega", "Status"];

  return (
    <div onClick={fechar}
      className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 36, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 1120, maxHeight: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{finalizados ? "R2 Hub · histórico" : "R2 Hub · carteira ativa"}</div>
            <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>{finalizados ? "Finalizados recentes" : "Pedidos em aberto"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", borderRadius: 999, padding: "0 18px", height: 44 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.4} strokeLinecap="round" style={{ flex: "none" }}><circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" /></svg>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar"
                style={{ width: 180, border: 0, outline: 0, background: "transparent", font: "500 15px/1 Inter,sans-serif", color: INK }} />
            </div>
            <button onClick={fechar} className="pm-ic" style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: "4px 26px 12px", maxHeight: 520, overflow: "auto", boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.25)" }}>
          <div style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 14, padding: "16px 0 14px", borderBottom: "1px solid #e8e8e8" }}>
            {colunas.map((c) => (
              <span key={c} style={{ font: `600 12.5px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3" }}>{c}</span>
            ))}
          </div>
          {linhas.map((r, i) => {
            const s = STATUS[r.status] || STATUS["Finalizado"];
            return (
              <div key={r.num + i} onClick={() => onAbrir?.(r.fonte)} className="pm-row"
                style={{ display: "grid", gridTemplateColumns: GRID, alignItems: "center", gap: 14, padding: "15px 0", cursor: "pointer", borderBottom: i === linhas.length - 1 ? 0 : "1px solid #f1f1f1" }}>
                <span style={{ font: `600 14.5px/1 ${MONO}`, color: "#8d8b8d" }}>{r.num}</span>
                <span style={{ ...fr(48, 700), fontSize: 19, lineHeight: 1.1, letterSpacing: "-.01em", color: INK }}>{r.cliente}</span>
                <span style={{ font: "400 15px/1.2 Inter,sans-serif", color: "#5c5a5c" }}>{r.medida}</span>
                <span style={{ font: "400 15px/1.2 Inter,sans-serif", color: "#5c5a5c" }}>{r.sub}</span>
                <span style={{ font: "400 15px/1.2 Inter,sans-serif", color: "#5c5a5c" }}>{r.data}</span>
                <span style={{ justifySelf: "start", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "8px 13px 7px", borderRadius: 999, background: s.bg, color: s.fg }}>{r.status}</span>
              </div>
            );
          })}
          {linhas.length === 0 && (
            <div style={{ padding: "46px 0", textAlign: "center", font: "400 15px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>Nada encontrado.</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{linhas.length} de {itens.length} registros · clique para abrir</span>
          <button onClick={() => onExportar?.()} className="r2chip"
            style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 999, padding: "13px 20px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", background: INK, color: AMARELO }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4.5 19.5h15" /></svg>
            Exportar planilha
          </button>
        </div>
      </div>
    </div>
  );
}
