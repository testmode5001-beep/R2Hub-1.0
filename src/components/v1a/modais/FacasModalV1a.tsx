// Catálogo de facas (modal). Mesmo papel do PantoneModalV1a: um seletor que
// abre por cima de outra modal e devolve a escolha.
//
// Nasceu do formulário de edição do pedido — quando a medida veio errada da
// solicitação, quem corrige precisa achar a faca certa, não digitar números
// de cabeça. Também entra nos diálogos (pedir revisão, observação) para citar
// uma faca pelo código sem sair da conversa.
import { useMemo, useState } from "react";

import { AMARELO, INK, MONO, fr } from "../HubV1a";
import { COR_SISTEMA, FACAS } from "../dados/facas";

type Faca = { cod: string; medida: string; sistema: string; secao: string };

const LIMITE = 120;

export function FacasModalV1a({ valor, fechar, onEscolher, aoVer }: {
  /** código já escolhido, para marcar na lista */
  valor?: string;
  fechar: () => void;
  onEscolher: (cod: string, medida: string) => void;
  /** abre o desenho do acervo — sem isso o botão "ver" não aparece */
  aoVer?: (cod: string) => Promise<unknown>;
}) {
  const [busca, setBusca] = useState("");
  const [sistema, setSistema] = useState("Todos");
  const [ocupado, setOcupado] = useState("");

  const todas = FACAS as Faca[];
  const sistemas = useMemo(
    () => ["Todos", ...Array.from(new Set(todas.map((f) => f.sistema)))],
    [todas],
  );

  const achadas = useMemo(() => {
    /* busca sem espaço e sem "×": quem digita "100x140" tem de achar
       "100×140", e quem digita "100 140" também */
    const q = busca.trim().toLowerCase().replace(/[\s×x]/g, "");
    return todas
      .filter((f) => sistema === "Todos" || f.sistema === sistema)
      .filter((f) => !q || `${f.cod} ${f.medida}`.toLowerCase().replace(/[\s×x]/g, "").includes(q))
      .slice(0, LIMITE);
  }, [busca, sistema, todas]);

  function ver(cod: string) {
    if (!aoVer || ocupado) return;
    setOcupado(cod);
    Promise.resolve(aoVer(cod)).finally(() => setOcupado(""));
  }

  /* z-index 88: este catálogo abre por cima do modal do pedido (60) E por cima
     dos diálogos (80), de onde também é chamado — com um número menor ele
     renderizava atrás do próprio diálogo que o abriu. Fica abaixo só do
     visualizador de desenho (95). O clique no fundo PARA aqui: sem isso ele
     subia e fechava o modal de baixo junto (mesma regra do Pantone). */
  return (
    <div onClick={(e) => { e.stopPropagation(); fechar(); }}
      className="r2modal"
      style={{ position: "absolute", inset: 0, zIndex: 88, display: "grid", placeItems: "center", padding: 30, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ width: 880, maxWidth: "100%", height: 600, maxHeight: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 16, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>

        <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `600 12.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#7a787a" }}>
              Catálogo de facas · {todas.length} desenhos
            </div>
            <div style={{ ...fr(96, 700), fontSize: 30, lineHeight: 1.1, letterSpacing: "-.03em", color: INK, marginTop: 9 }}>Escolher faca</div>
          </div>
          <button onClick={fechar} data-esc-fechar aria-label="Fechar" className="pm-ic"
            style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>

        <input value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
          placeholder="Buscar por código ou medida — ex.: FAC0270, 100x140"
          style={{ flex: "none", width: "100%", boxSizing: "border-box", background: "#fff", border: "2px solid #fff", borderRadius: 9, padding: "12px 14px", font: "600 15px/1.2 Inter,sans-serif", color: INK, outline: "none" }} />

        <div className="r2scroll-x" style={{ flex: "none", display: "flex", gap: 6 }}>
          {sistemas.map((s) => {
            const on = sistema === s;
            return (
              <button key={s} onClick={() => setSistema(s)} className="pv-chip"
                style={{ flex: "none", border: on ? 0 : "2px solid #e0dfe0", background: on ? INK : "transparent", color: on ? "#f1f1f1" : "#5c5a5c", borderRadius: 999, padding: on ? "8px 14px" : "6px 12px", cursor: "pointer", whiteSpace: "nowrap", font: "600 12.5px/1 Inter,sans-serif" }}>
                {s}
              </button>
            );
          })}
        </div>

        <div className="pv-sc" style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "#fff", borderRadius: 12, padding: 8 }}>
          {achadas.length ? achadas.map((f) => {
            const escolhida = valor === f.cod;
            const cor = (COR_SISTEMA as Record<string, string>)[f.sistema] ?? "#d6d5d6";
            return (
              <div key={f.cod} className="pv-row"
                style={{ display: "flex", alignItems: "center", gap: 12, borderRadius: 9, padding: "4px 6px 4px 10px", background: escolhida ? "#f4f4f4" : "transparent", transition: "background .12s ease" }}>
                <button onClick={() => onEscolher(f.cod, f.medida)}
                  style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 12, background: "transparent", border: 0, padding: "9px 0", cursor: "pointer", textAlign: "left" }}>
                  <span title={f.sistema} style={{ flex: "none", width: 10, height: 10, borderRadius: 999, background: cor, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.16)" }} />
                  <span style={{ flex: "none", width: 132, font: "700 15px/1 Inter,sans-serif", color: INK }}>{f.medida}</span>
                  <span className="truncate" style={{ flex: 1, minWidth: 0, font: `500 13.5px/1 ${MONO}`, color: "#6f6d6f" }}>{f.cod}</span>
                  <span style={{ flex: "none", font: "500 12px/1 Inter,sans-serif", color: "#8a888a", whiteSpace: "nowrap" }}>{f.sistema}</span>
                </button>
                {!!aoVer && (
                  <button onClick={() => ver(f.cod)} disabled={!!ocupado} title="Ver o desenho no acervo" aria-label="Ver o desenho"
                    className="pv-chip"
                    style={{ flex: "none", border: "2px solid #e0dfe0", background: "transparent", borderRadius: 999, padding: "6px 12px", cursor: ocupado ? "progress" : "pointer", font: "600 12px/1 Inter,sans-serif", color: "#5c5a5c", whiteSpace: "nowrap" }}>
                    {ocupado === f.cod ? "abrindo…" : "ver"}
                  </button>
                )}
                {escolhida && (
                  <span style={{ flex: "none", borderRadius: 999, padding: "5px 10px", font: "700 10px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", background: AMARELO, color: INK }}>atual</span>
                )}
              </div>
            );
          }) : (
            <div style={{ height: "100%", display: "grid", placeItems: "center", padding: 30, textAlign: "center", font: "500 14px/1.5 Inter,sans-serif", color: "#7a787a" }}>
              Nenhuma faca com esse código ou medida.
            </div>
          )}
        </div>

        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1, minWidth: 0, font: "500 12.5px/1.4 Inter,sans-serif", color: "#7a787a" }}>
            {achadas.length >= LIMITE
              ? `Mostrando as ${LIMITE} primeiras — refine a busca para ver o resto.`
              : "Escolher a faca preenche a largura e a altura do pedido."}
          </span>
          <button onClick={fechar} className="pv-chip"
            style={{ flex: "none", border: "2px solid #e0dfe0", background: "transparent", borderRadius: 9, padding: "12px 18px", cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
