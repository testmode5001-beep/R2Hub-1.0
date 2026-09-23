// "Design criado" — a caixa com que o designer entrega a arte.
// Fonte: hub-1.0/devolver-arte-modal.dc.html (o componente que o
// `Pedido 1.0.dc.html` importa como "Devolver-arte-modal").
//
// Substitui a DevolverArteModalV1a DENTRO da geração 1.0; as telas V1a
// continuam com a caixa antiga, que tem o "é uma pergunta" que elas usam.
//
// Diferenças conscientes em relação ao protótipo:
//
//  · Anexar abre o seletor de arquivos de verdade e guarda os File; no
//    protótipo era um contador que só subia.
//  · A versão sugerida vem de quem chama (conta as artes já entregues no
//    pedido), em vez de ler um histórico de brinquedo.
//  · As sugestões de cor saem de `sugestoesPantone`, a mesma busca que a
//    tabela Pantone do hub usa, e o botão redondo abre essa tabela.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { sugestoesPantone } from "../v1a/dados/pantone-busca";
import { PantoneModalV1a } from "../v1a/modais/PantoneModalV1a";
import { FR, INTER, PRETO } from "./ChromeHub10";

const MAX_CORES = 7;
const MONO = "ui-monospace, Menlo, monospace";
const AMARELO = "#FFE815";
const ROXO = "#a4a2f0";
const CINZA = "#8a8a8a";
const BORDA_CAMPO = "#d9d8d6";

export type DesignCriado = { versao: string; cores: string[]; obs: string; arquivos: File[] };

const CAMPO: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#fff",
  border: `1.5px solid ${BORDA_CAMPO}`, borderRadius: 12, padding: "15px 16px",
  font: `600 19px/1.2 ${INTER}`, color: PRETO, outline: "none",
};
const FAIXA: CSSProperties = {
  flex: "none", width: "100%", textAlign: "left", display: "flex", alignItems: "center",
  justifyContent: "space-between", gap: 16, padding: "15px 42px", border: 0,
  borderBottom: `1.5px solid ${PRETO}`, cursor: "pointer",
};
const TITULO_FAIXA: CSSProperties = {
  fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 40",
  fontWeight: 600, fontSize: 27, letterSpacing: "-.02em", color: PRETO, whiteSpace: "nowrap",
};

function Chevron({ aberto }: { aberto: boolean }) {
  return (
    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: "none", transform: aberto ? undefined : "rotate(-90deg)", transition: "transform .14s ease" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function DesignCriadoHub10({ pedido, versaoSugerida = "v1", fechar, onEnviar }: {
  pedido: { num?: string; cliente?: string; spec?: string; coresNomes?: string[] };
  /** "v2" quando já houve uma entrega, e assim por diante */
  versaoSugerida?: string;
  fechar: () => void;
  onEnviar: (d: DesignCriado) => void;
}) {
  const p = pedido || {};
  const coresIniciais = (() => {
    const nomes = (p.coresNomes ?? []).filter((x) => String(x ?? "").trim());
    if (nomes.length) return nomes.slice(0, MAX_CORES);
    const n = parseInt((String(p.spec ?? "").match(/(\d+)\s*cores?/i) ?? [])[1], 10);
    if (Number.isFinite(n) && n > 0) return Array.from({ length: Math.min(n, MAX_CORES) }, () => "");
    return ["", ""];
  })();

  const [versao, setVersao] = useState(versaoSugerida);
  const [cores, setCores] = useState<string[]>(coresIniciais);
  const [hex, setHex] = useState<Record<number, string>>({});
  const [obs, setObs] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [secao, setSecao] = useState<null | "cores" | "recado">("cores");
  const [sugIdx, setSugIdx] = useState<number | null>(null);
  const [pantoneIdx, setPantoneIdx] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const entrada = useRef<HTMLInputElement | null>(null);
  const cartao = useRef<HTMLDivElement | null>(null);

  const preenchidas = cores.map((c) => c.trim()).filter(Boolean);
  const valido = preenchidas.length > 0 && !enviando;

  /* O cartão cresce quando uma seção abre e a faixa do detalhe tem 616 de
     altura — sem encolher, a caixa vazaria para fora do palco. Mesmo cálculo
     do projeto: nunca aumenta, só reduz para caber. */
  useLayoutEffect(() => {
    const ajustar = () => {
      const n = cartao.current;
      const pai = n?.parentElement;
      if (!n || !pai) return;
      const alvo = n.offsetHeight || 600;
      const s = Math.min(1, (pai.clientWidth - 24) / 720, (pai.clientHeight - 24) / alvo);
      n.style.transform = `translate(-50%,-50%) scale(${s})`;
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    const t = setTimeout(ajustar, 120);
    return () => { window.removeEventListener("resize", ajustar); clearTimeout(t); };
  }, [secao, cores.length, arquivos.length]);

  /* Esc fecha, como em toda caixa do hub. */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [fechar]);

  const enviar = () => {
    if (!valido) return;
    setEnviando(true);
    onEnviar({ versao, cores: preenchidas, obs, arquivos });
  };

  const trocarCor = (i: number, v: string) => setCores(cores.map((c, j) => (j === i ? v : c)));
  const escolherHex = (i: number, nome: string, cor?: string) => {
    setCores(cores.map((c, j) => (j === i ? nome : c)));
    setHex((h) => (cor ? { ...h, [i]: cor } : Object.fromEntries(Object.entries(h).filter(([k]) => Number(k) !== i))));
  };

  const sugestoesDe = (valor: string) => {
    const v = valor.trim();
    if (!v) return [];
    const achados = sugestoesPantone(v, 6);
    return achados.some((s) => s.nome.toLowerCase() === v.toLowerCase()) ? [] : achados;
  };

  const resumo = valido || preenchidas.length
    ? `${preenchidas.length} ${preenchidas.length === 1 ? "cor" : "cores"} · ${preenchidas.join(", ")}`
    : "Cores, design e observações";
  const previaRecado = obs.trim()
    ? (obs.trim().length > 46 ? `${obs.trim().slice(0, 46)}…` : obs.trim())
    : "opcional";

  return (
    <div onClick={fechar}
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 616, zIndex: 68, background: "rgba(37,36,37,.78)" }}>
      {pantoneIdx !== null && (
        <div onClick={(e) => e.stopPropagation()}>
          <PantoneModalV1a valor={cores[pantoneIdx] ?? ""}
            fechar={() => setPantoneIdx(null)}
            onEscolher={(nome, cor) => { escolherHex(pantoneIdx, nome, cor); setPantoneIdx(null); }} />
        </div>
      )}

      <div ref={cartao} onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", transformOrigin: "center center", width: 720, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>

        {/* ————— cabeçalho ————— */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "32px 42px 26px", flex: "none" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `700 14px/1.2 ${MONO}`, letterSpacing: ".16em", textTransform: "uppercase", color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {`${p.num ? `${p.num} · ` : ""}${p.cliente ?? ""}`}
            </div>
            <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 50, lineHeight: 1, letterSpacing: "-.035em", marginTop: 12, whiteSpace: "nowrap" }}>Design criado</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span style={{ font: `800 12.5px/1 ${INTER}`, letterSpacing: ".12em", textTransform: "uppercase", color: CINZA }}>Versão</span>
              <input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="v3" aria-label="Versão da arte"
                style={{ width: 40, textAlign: "left", boxSizing: "border-box", padding: 0, border: "none", background: "none", font: `800 18px/1 ${INTER}`, color: PRETO, outline: "none" }} />
            </div>
            <button onClick={fechar} className="p10-flat" aria-label="Fechar"
              style={{ width: 46, height: 46, display: "grid", placeItems: "center", background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        {/* ————— cores ————— */}
        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <button onClick={() => setSecao(secao === "cores" ? null : "cores")} className="p10-flat"
            style={{ ...FAIXA, background: AMARELO, borderTop: `1.5px solid ${PRETO}` }}>
            <span style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <Chevron aberto={secao === "cores"} />
              <span style={TITULO_FAIXA}>Cores usadas na arte</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
              {preenchidas.length > 0 && (
                <span style={{ display: "flex", gap: 5 }}>
                  {cores.map((v, i) => (v.trim() ? (
                    <span key={i} style={{ flex: "none", width: 20, height: 20, borderRadius: 6, boxShadow: `inset 0 0 0 1.5px ${PRETO}`, background: hex[i] ?? BORDA_CAMPO }} />
                  ) : null))}
                </span>
              )}
              <span style={{ font: `800 15px/1 ${INTER}`, color: PRETO }}>{preenchidas.length} de {MAX_CORES}</span>
            </span>
          </button>

          {secao === "cores" && (
            <div style={{ boxSizing: "border-box", padding: "22px 42px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 12px" }}>
                {cores.map((valor, i) => {
                  const sugs = sugIdx === i ? sugestoesDe(valor) : [];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      {hex[i] && <span style={{ flex: "none", width: 42, height: 42, borderRadius: 12, boxShadow: `inset 0 0 0 1.5px ${PRETO}`, background: hex[i] }} />}
                      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                        <input value={valor} onChange={(e) => trocarCor(i, e.target.value)}
                          onFocus={() => setSugIdx(i)}
                          onBlur={() => setTimeout(() => setSugIdx((atual) => (atual === i ? null : atual)), 120)}
                          placeholder={`Cor ${i + 1} · nome ou Pantone`} aria-label={`Cor ${i + 1}`}
                          style={CAMPO}
                          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setSugIdx(null); } }} />
                        {sugs.length > 0 && (
                          <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 8, display: "flex", flexDirection: "column", gap: 2, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 12, padding: 6, boxShadow: "0 22px 44px -18px rgba(0,0,0,.5)" }}>
                            {sugs.map((s) => (
                              <button key={s.codigo} onMouseDown={(e) => { e.preventDefault(); escolherHex(i, s.nome, s.hex); setSugIdx(null); }}
                                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", border: 0, background: "transparent", borderRadius: 8, padding: "9px 10px", cursor: "pointer", textAlign: "left" }}>
                                <span style={{ flex: "none", width: 22, height: 22, borderRadius: 6, boxShadow: `inset 0 0 0 1.5px ${PRETO}`, background: s.hex }} />
                                <span style={{ flex: 1, font: `600 16px/1 ${INTER}`, color: PRETO, whiteSpace: "nowrap" }}>{s.nome}</span>
                                <span style={{ font: `600 14px/1 ${MONO}`, color: "#b3b1b3" }}>{s.hex}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={() => setPantoneIdx(i)} title="Tabela Pantone Solid Coated" aria-label={`Tabela Pantone para a cor ${i + 1}`} className="p10-flat"
                        style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", border: `1.5px solid ${PRETO}`, background: "#fff", borderRadius: 999, cursor: "pointer" }}>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a4 4 0 1 1 0-8h4.5a4.5 4.5 0 0 0 0-5z" /></svg>
                      </button>
                      {cores.length > 1 && (
                        <button onClick={() => { setCores(cores.filter((_, j) => j !== i)); setHex(Object.fromEntries(Object.entries(hex).filter(([k]) => Number(k) !== i))); }}
                          title="Remover cor" aria-label={`Remover a cor ${i + 1}`} className="p10-flat"
                          style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
                          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {cores.length < MAX_CORES ? (
                <button onClick={() => setCores([...cores, ""])} className="p10-flat"
                  style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, border: `1.5px dashed ${PRETO}`, background: "none", borderRadius: 999, padding: "12px 18px", cursor: "pointer", font: `700 16px/1 ${INTER}`, color: PRETO }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={3} strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                  Adicionar cor
                </button>
              ) : (
                <div style={{ marginTop: 14, font: `600 14px/1.4 ${INTER}`, color: CINZA }}>Máximo de {MAX_CORES} cores por arte.</div>
              )}
            </div>
          )}

          {/* ————— anexos e observações ————— */}
          <button onClick={() => setSecao(secao === "recado" ? null : "recado")} className="p10-flat"
            style={{ ...FAIXA, background: ROXO }}>
            <span style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <Chevron aberto={secao === "recado"} />
              <span style={TITULO_FAIXA}>Anexos e observações</span>
            </span>
            <span style={{ minWidth: 0, font: `600 15.5px/1.3 ${INTER}`, color: PRETO, opacity: .75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{previaRecado}</span>
          </button>

          {secao === "recado" && (
            <div style={{ padding: "22px 42px 24px" }}>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} aria-label="Observações"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); enviar(); } }}
                placeholder="Ex.: ajustei a tabela nutricional para 7 pt e converti a logo em curvas."
                style={{ width: "100%", height: 112, resize: "none", boxSizing: "border-box", background: "#fff", border: `1.5px solid ${BORDA_CAMPO}`, borderRadius: 12, padding: "14px 16px", font: `500 17.5px/1.5 ${INTER}`, color: PRETO, outline: "none" }} />
              <input ref={entrada} type="file" multiple style={{ display: "none" }}
                onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) setArquivos([...arquivos, ...fs]); }} />
              <button onClick={() => entrada.current?.click()} className="p10-flat"
                style={{ width: "100%", marginTop: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "none", border: `1.5px dashed ${PRETO}`, borderRadius: 12, padding: 16, cursor: "pointer" }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5.5" /><path d="m8 9.5 4-4 4 4" /><path d="M4.5 16v3.5h15V16" /></svg>
                <span style={{ font: `600 16.5px/1.4 ${INTER}`, color: PRETO, textAlign: "center" }}>
                  {arquivos.length
                    ? `${arquivos.length} ${arquivos.length === 1 ? "arquivo anexado" : "arquivos anexados"} · clique para anexar mais`
                    : "Anexar a arte final (PDF, AI, CDR) — vai para a pasta do cliente"}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ————— rodapé ————— */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, padding: "22px 25px", background: PRETO, flex: "none" }}>
          <div style={{ minWidth: 0, font: `600 16px/1.45 ${INTER}`, color: "#c9c8c6", marginLeft: 20 }}>{resumo}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "none" }}>
            <button onClick={fechar} className="p10-flat"
              style={{ border: "1.5px solid #555355", borderRadius: 999, padding: "14px 24px", cursor: "pointer", font: `700 17px/1 ${INTER}`, background: "none", color: "#f1f1f1" }}>Cancelar</button>
            <button onClick={enviar} disabled={!valido}
              style={{ border: `1.5px solid ${valido ? PRETO : "#4a484a"}`, borderRadius: 999, padding: "14px 28px", cursor: valido ? "pointer" : "not-allowed", font: `800 17px/1 ${INTER}`, whiteSpace: "nowrap", background: valido ? AMARELO : "#4a484a", color: valido ? PRETO : CINZA }}>
              {enviando ? "Registrando…" : "Registrar design"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
