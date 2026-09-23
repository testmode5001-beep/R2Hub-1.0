// Pantone (modal) — v1a. Fonte: design_handoff_r2_hub/telas/Pantone-modal.dc.html.
// Seletor de cor: busca por código/hex/CMYK, famílias derivadas do Lab,
// grade 6 col (limite 240), rodapé dark com selecionada + entrada manual.
// onEscolher(nome, hex) — hex vazio quando o nome é manual.
import { useMemo, useState } from "react";

import { criarBusca } from "@/lib/busca";
import { AMARELO, INK, MONO, fr } from "../HubV1a";
import { PANTONE_SC } from "../dados/pantone";
import { cmykDeHex } from "../dados/pantone-busca";

function familiaDe(l: [number, number, number]): string {
  const a = l[1], b = l[2], L = l[0];
  const croma = Math.sqrt(a * a + b * b);
  if (croma < 12) return "neutro";
  let h = Math.atan2(b, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  if (h < 20) return "rosa";
  if (h < 45) return "vermelho";
  if (h < 70) return "laranja";
  if (h < 105) return L > 55 ? "amarelo" : "marrom";
  if (h < 175) return "verde";
  if (h < 260) return "azul";
  if (h < 330) return "rosa";
  return "vermelho";
}

const PROCESSO = [
  { codigo: "Ciano", hex: "#009FE3", cmyk: "100/0/0/0" },
  { codigo: "Magenta", hex: "#E5007E", cmyk: "0/100/0/0" },
  { codigo: "Amarelo", hex: "#FFED00", cmyk: "0/0/100/0" },
  { codigo: "Preto", hex: "#1D1D1B", cmyk: "0/0/0/100" },
  /* tintas especiais: vão na máquina como tinta própria, igual a um Pantone */
  { codigo: "Dourado", hex: "#C6A15B", cmyk: "—" },
  { codigo: "Branco", hex: "#FFFFFF", cmyk: "—" },
];

const FAMILIAS = [
  { k: "todas", label: "Todas" },
  { k: "processo", label: "Processo e especiais" },
  { k: "amarelo", label: "Amarelos" },
  { k: "laranja", label: "Laranjas" },
  { k: "vermelho", label: "Vermelhos" },
  { k: "rosa", label: "Rosas e roxos" },
  { k: "azul", label: "Azuis" },
  { k: "verde", label: "Verdes" },
  { k: "marrom", label: "Marrons" },
  { k: "neutro", label: "Neutros" },
];

const LIMITE = 240;

type Cor = { nome: string; codigo: string; hex: string; cmyk: string; lab: string; familia: string };

export function PantoneModalV1a({ valor, fechar, onEscolher, multiplo = false }: {
  valor?: string;
  fechar: () => void;
  onEscolher: (nome: string, hex: string) => void;
  /** deixa a tabela ABERTA a cada escolha: arte de 4 cores se monta numa
      visita só, em vez de reabrir a tabela quatro vezes */
  multiplo?: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [familia, setFamilia] = useState("todas");
  const [selCod, setSelCod] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const todas: Cor[] = useMemo(() => {
    const proc: Cor[] = PROCESSO.map((c) => ({
      nome: c.codigo, codigo: c.codigo, hex: c.hex, cmyk: c.cmyk, lab: "escala de processo", familia: "processo",
    }));
    return proc.concat(PANTONE_SC.map((c) => ({
      nome: "Pantone " + c.c,
      codigo: c.c,
      hex: c.h.toUpperCase(),
      cmyk: cmykDeHex(c.h),
      lab: `L ${c.l[0]} a ${c.l[1]} b ${c.l[2]}`,
      familia: familiaDe(c.l),
    })));
  }, []);

  const casa = criarBusca(busca);
  const achados = todas.filter((c) => {
    const okF = familia === "todas" || c.familia === familia;
    const okQ = casa(c.codigo, c.hex, c.cmyk);
    return okF && okQ;
  });
  const vis = achados.slice(0, LIMITE);

  const sel = (selCod ? todas.find((c) => c.codigo === selCod) : null)
    ?? (valor ? todas.find((c) => c.nome === valor || c.codigo === valor) : null)
    ?? null;
  const manualTrim = manual.trim();
  const pode = !!manualTrim || !!sel;

  const [escolhidas, setEscolhidas] = useState<{ nome: string; hex: string }[]>([]);

  function usar() {
    const nova = manualTrim ? { nome: manualTrim, hex: "" } : sel ? { nome: sel.nome, hex: sel.hex } : null;
    if (!nova) return;
    onEscolher(nova.nome, nova.hex);
    if (!multiplo) return;
    // segue aberta: limpa a seleção e guarda o que já foi escolhido
    setEscolhidas((l) => (l.some((x) => x.nome === nova.nome) ? l : [...l, nova]));
    setManual("");
    setSelCod(null);
  }

  /* Esta tabela abre DENTRO de outras modais (Nova arte, Clichê chegou,
     Devolver arte), e todas fecham ao clique no fundo. Dois cuidados:
     · z-index 76 fica acima de todos os pais (60 / 64 / 68) — o ESC global
       fecha o overlay de maior z, e com 66 ele mirava no pai;
     · o clique no fundo PARA aqui (stopPropagation) — sem isso ele subia até
       o fundo do pai e fechava os dois de uma vez. Quem abria a tabela dentro
       do "Devolver arte" e apertava ESC perdia cores, recado e anexos. */
  return (
    <div onClick={(e) => { e.stopPropagation(); fechar(); }}
      className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 76, display: "flex", alignItems: "center", justifyContent: "center", padding: 36, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 1000, height: 660, display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Pantone Solid Coated 2024 · color book oficial</div>
            <div style={{ ...fr(96, 700), fontSize: 34, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Escolher cor</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", borderRadius: 999, padding: "0 18px", height: 46 }}>
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.4} strokeLinecap="round" style={{ flex: "none" }}><circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" /></svg>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código — ex.: 485"
                style={{ width: 210, border: 0, outline: 0, background: "transparent", font: "500 15px/1 Inter,sans-serif", color: INK }} />
            </div>
            <button onClick={fechar} className="pm-ic" style={{ width: 38, height: 38, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {FAMILIAS.map((fx) => {
            const on = familia === fx.k;
            return (
              <button key={fx.k} onClick={() => setFamilia(fx.k)} className="r2chip"
                style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 15px", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: on ? INK : "#fff", color: on ? AMARELO : "#8d8b8d" }}>
                {fx.label}
              </button>
            );
          })}
          <span style={{ flex: 1 }} />
          <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#8d8b8d", whiteSpace: "nowrap" }}>
            {achados.length > LIMITE
              ? `mostrando ${LIMITE} de ${achados.length} cores — refine a busca`
              : `${achados.length} de ${todas.length} cores · hex e CMYK convertidos do Lab oficial`}
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.25)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
            {vis.map((c) => {
              const on = !!sel && sel.codigo === c.codigo;
              return (
                <button key={c.codigo} onClick={() => { setSelCod(c.codigo); setManual(""); }} className="r2card"
                  style={{ display: "flex", flexDirection: "column", overflow: "hidden", border: 0, padding: 0, cursor: "pointer", textAlign: "left", borderRadius: 10, background: "#fff", boxShadow: on ? `0 0 0 3px ${INK}` : "0 0 0 1px #ececec" }}>
                  <span style={{ position: "relative", display: "block", height: 58, background: c.hex, width: "100%", boxShadow: "inset 0 0 0 1px rgba(37,36,37,.16)" }}>
                    {on && (
                      <span style={{ position: "absolute", right: 8, top: 8, width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 999, background: AMARELO }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                      </span>
                    )}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 11px 11px" }}>
                    <span style={{ font: "700 14.5px/1.1 Inter,sans-serif", color: INK, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome.replace("Pantone ", "")}</span>
                    <span style={{ font: `500 12.5px/1 ${MONO}`, color: "#b3b1b3", textAlign: "left" }}>{c.hex}</span>
                    <span style={{ font: `500 12px/1 ${MONO}`, color: "#c9c8c9", textAlign: "left" }}>CMYK {c.cmyk}</span>
                    <span style={{ font: `500 12px/1 ${MONO}`, color: "#d6d5d6", textAlign: "left" }}>{c.lab}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {vis.length === 0 && (
            <div style={{ padding: "60px 0", textAlign: "center", font: "400 15px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>Nenhuma cor com esse código.</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: INK, borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <span style={{ flex: "none", width: 44, height: 44, borderRadius: 8, background: manualTrim ? "#4a484a" : sel ? sel.hex : "#3a383a" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d" }}>Selecionada</div>
              <div style={{ ...fr(72, 700), fontSize: 22, lineHeight: 1, color: "#f1f1f1", marginTop: 7, whiteSpace: "nowrap" }}>
                {manualTrim ? manualTrim + " · sem código" : sel ? `${sel.nome} · ${sel.hex} · CMYK ${sel.cmyk} · ${sel.lab}` : "nenhuma cor escolhida"}
              </div>
            </div>
          </div>
          {multiplo && escolhidas.length > 0 && (
            <div style={{ flex: "0 1 auto", display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 360, justifyContent: "flex-end" }}>
              {escolhidas.map((c2) => (
                <span key={c2.nome} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#3a383a", borderRadius: 999, padding: "6px 12px 6px 6px", font: "600 13px/1 Inter,sans-serif", color: "#f1f1f1", whiteSpace: "nowrap" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, background: c2.hex || "#8d8b8d", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)" }} />
                  {c2.nome}
                </span>
              ))}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              <span style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>ou escreva manualmente</span>
              <input value={manual}
                onChange={(e) => { setManual(e.target.value); if (e.target.value.trim()) setSelCod(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") usar(); }}
                placeholder="Ex.: Ciano, verniz, branco de cobertura"
                style={{ width: 266, background: "#3a383a", border: "2px solid #3a383a", borderRadius: 999, padding: "11px 16px", font: "500 14.5px/1 Inter,sans-serif", color: "#f1f1f1", outline: "none" }} />
            </div>
            <button onClick={usar} className="r2chip"
              style={{ border: 0, borderRadius: 999, padding: "14px 20px", cursor: pode ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: pode ? AMARELO : "#4a484a", color: pode ? INK : "#8d8b8d" }}>
              {multiplo ? (manualTrim ? "Adicionar este nome" : "Adicionar cor") : (manualTrim ? "Usar este nome" : "Usar esta cor")}
            </button>
            {multiplo && (
              <button onClick={fechar} className="r2chip"
                style={{ border: 0, borderRadius: 999, padding: "14px 18px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: "#3a383a", color: "#f1f1f1" }}>
                {escolhidas.length ? `Pronto · ${escolhidas.length}` : "Fechar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
