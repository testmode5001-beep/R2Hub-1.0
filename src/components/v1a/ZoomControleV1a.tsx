// Controle de zoom do Hub: − 100% + com "ajustar à tela" no clique da
// porcentagem. Fica na topbar (sempre à mão) e também nas Preferências.
// Módulo à parte para a topbar e as modais usarem sem se importarem entre si.
import { useEffect, useState } from "react";

import {
  PASSO_PCT, PCT_MAX, PCT_MIN, gravarZoomPct, lerZoomPct, pctQueCabe,
} from "@/lib/zoom-tela";

const INK = "#252425";
const AMARELO = "#ffe815";

export function useZoomPct(): [number, (n: number) => void, () => void, (delta: number) => void] {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    const ouvir = () => setPct(lerZoomPct());
    ouvir();
    window.addEventListener("r2hub-zoom", ouvir);
    window.addEventListener("storage", ouvir);
    window.addEventListener("resize", ouvir);
    return () => {
      window.removeEventListener("r2hub-zoom", ouvir);
      window.removeEventListener("storage", ouvir);
      window.removeEventListener("resize", ouvir);
    };
  }, []);
  const definir = (n: number) => { gravarZoomPct(n); setPct(lerZoomPct()); };
  /* passo a partir do valor GRAVADO: dois cliques rápidos no + contavam como
     um só quando o delta saía do estado (que ainda não tinha atualizado) */
  const passo = (delta: number) => definir(lerZoomPct() + delta);
  const ajustar = () => definir(pctQueCabe(window.innerWidth, window.innerHeight));
  return [pct, definir, ajustar, passo];
}

/** `compacto` = versão da topbar (altura 40); senão a das Preferências. */
export function ZoomControleV1a({ compacto = false }: { compacto?: boolean }) {
  const [pct, , ajustar, passo] = useZoomPct();
  const alt = compacto ? 40 : 46;
  const btn = {
    flex: "none", width: alt, height: alt, display: "grid", placeItems: "center",
    background: "transparent", border: 0, borderRadius: 8, cursor: "pointer", color: INK,
    font: `700 ${compacto ? 19 : 22}px/1 Inter, sans-serif`,
  } as const;

  return (
    <div title="Zoom do Hub — vale para este computador"
      style={{
        flex: "none", alignSelf: "center", display: "flex", alignItems: "center", gap: 2, height: alt,
        background: compacto ? "#f1f1f1" : "#fff", borderRadius: 10, padding: 2,
      }}>
      <button onClick={() => passo(-PASSO_PCT)} disabled={pct <= PCT_MIN}
        title="Diminuir" className="r2ic"
        style={{ ...btn, opacity: pct <= PCT_MIN ? 0.35 : 1, cursor: pct <= PCT_MIN ? "default" : "pointer" }}>−</button>
      <button onClick={ajustar} title="Ajustar à tela (tudo cabe sem rolar)" className="r2chip"
        style={{
          flex: "none", minWidth: compacto ? 62 : 74, height: alt - 4, border: 0, borderRadius: 8,
          background: pct === 100 ? AMARELO : "transparent", cursor: "pointer",
          font: `700 ${compacto ? 14 : 15.5}px/1 Inter, sans-serif`, color: INK,
        }}>
        {pct}%
      </button>
      <button onClick={() => passo(PASSO_PCT)} disabled={pct >= PCT_MAX}
        title="Aumentar" className="r2ic"
        style={{ ...btn, opacity: pct >= PCT_MAX ? 0.35 : 1, cursor: pct >= PCT_MAX ? "default" : "pointer" }}>+</button>
    </div>
  );
}
