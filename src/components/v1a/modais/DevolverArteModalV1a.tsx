// Devolver arte (sub-modal do Pedido v2). Fonte: handoff `Devolver-arte-modal`.
// Fecha o design e devolve para QUEM ABRIU o pedido: versão, cores usadas
// (sugestões Pantone inline + modal Pantone por linha), recado e a ARTE FINAL
// anexada de verdade. onEnviar({versao, vendedora, cores, obs, arquivos}).
//
// Mudou do v1a para acompanhar a modal do pedido: as cores viraram uma grade
// de 2 colunas (8 cores cabiam em 8 linhas e o cartão estourava a tela), a
// versão e o destinatário desceram para o rodapé escuro — o cartão inteiro que
// existia só para eles saiu — e Ctrl+Enter envia.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { AMARELO, INK, MONO, fr } from "../HubV1a";
import { sugestoesPantone } from "../dados/pantone-busca";
import { PantoneModalV1a } from "./PantoneModalV1a";

const MAX_CORES = 8;

const INP: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#f4f4f4", border: "2px solid #f4f4f4",
  borderRadius: 9, padding: "10px 12px", font: "600 14px/1.2 Inter,sans-serif", color: INK, outline: "none",
};
const CARD: CSSProperties = {
  flex: "none", boxSizing: "border-box", display: "flex", flexDirection: "column",
  background: "#fff", borderRadius: 12, padding: "20px 22px 18px",
  boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.25)",
};
const ROTULO: CSSProperties = { font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#6f6d6f", whiteSpace: "nowrap" };
const NOTA: CSSProperties = { flex: "none", font: "400 13.5px/1 Inter,sans-serif", color: "#7a787a", whiteSpace: "nowrap" };

const tamanho = (n: number) =>
  n > 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export type DevolucaoArte = {
  versao: string; vendedora: string; cores: string[]; obs: string; arquivos: File[];
  /** o recado é uma PERGUNTA: abre pendência com dono em vez de virar
      só mais uma linha do histórico que ninguém lê */
  pergunta: boolean;
};

export function DevolverArteModalV1a({ pedido, fechar, onEnviar }: {
  pedido: { num?: string; cliente?: string; spec?: string; solicitante?: string };
  fechar: () => void;
  onEnviar: (d: DevolucaoArte) => void;
}) {
  const p = pedido || {};
  const coresIniciais = (() => {
    const nCores = parseInt((String(p.spec || "").match(/(\d+)\s*cores?/i) || [])[1], 10);
    if (Number.isFinite(nCores) && nCores > 0 && nCores <= MAX_CORES) return Array.from({ length: nCores }, () => "");
    return ["", ""];
  })();

  const [versao, setVersao] = useState("v1");
  /* Não se escolhe destinatário: a arte volta para quem abriu o pedido. */
  const vendedora = p.solicitante || "quem abriu o pedido";
  const [cores, setCores] = useState<string[]>(coresIniciais);
  const [hex, setHex] = useState<Record<number, string>>({});
  const [obs, setObs] = useState("");
  const [pergunta, setPergunta] = useState(false);
  /* Arquivos DE VERDADE: o botão antigo era só um contador (setAnexos(n+1)) —
     o designer via "3 arquivos anexados" e nenhum arquivo existia. */
  const [arquivos, setArquivos] = useState<File[]>([]);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [sugIdx, setSugIdx] = useState<number | null>(null);
  const [pantoneIdx, setPantoneIdx] = useState<number | null>(null);

  const palcoRef = useRef<HTMLDivElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);

  const preenchidas = cores.filter((c) => c.trim());
  const valido = preenchidas.length > 0;

  /* o cartão cresce com o número de cores e de anexos: escala para caber no
     que sobrou do estágio em vez de vazar por baixo */
  useEffect(() => {
    const ajustar = () => {
      const pai = palcoRef.current, card = cartaoRef.current;
      if (!pai || !card) return;
      const alvo = card.offsetHeight || 640;
      const s = Math.min(1, (pai.clientWidth - 40) / 720, (pai.clientHeight - 40) / alvo);
      card.style.transform = `scale(${s})`;
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    if (palcoRef.current) ro.observe(palcoRef.current);
    if (cartaoRef.current) ro.observe(cartaoRef.current);
    return () => ro.disconnect();
  }, []);

  const sug = (valor: string) => {
    const v = String(valor || "").trim();
    if (v.length < 1) return [];
    const achados = sugestoesPantone(v, 6);
    if (achados.some((s) => s.nome.toLowerCase() === v.toLowerCase())) return [];
    return achados;
  };

  function enviar() {
    if (!valido) return;
    onEnviar({ versao, vendedora, cores: preenchidas, obs, arquivos, pergunta: pergunta && !!obs.trim() });
  }

  return (
    <div ref={palcoRef} onClick={fechar} className="r2modal"
      style={{ position: "absolute", inset: 0, zIndex: 68, display: "grid", placeItems: "center", padding: 20, background: "rgba(37,36,37,.56)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14, overflow: "hidden" }}>

      {pantoneIdx !== null && (
        <PantoneModalV1a
          valor={cores[pantoneIdx] || ""}
          fechar={() => setPantoneIdx(null)}
          onEscolher={(nome, hexCor) => {
            const i = pantoneIdx;
            setPantoneIdx(null);
            setCores(cores.map((c, j) => (j === i ? nome : c)));
            setHex((st) => {
              if (hexCor) return { ...st, [i]: hexCor };
              const novo = { ...st };
              delete novo[i];
              return novo;
            });
          }}
        />
      )}

      <div ref={cartaoRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ width: 720, flex: "none", boxSizing: "border-box", transformOrigin: "center center", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="truncate" style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#6f6d6f" }}>
              {(p.num ? p.num + " · " : "") + (p.cliente || "arte finalizada")}
            </div>
            <div style={{ ...fr(96, 700), fontSize: 30, lineHeight: 1.1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>Devolver a arte</div>
          </div>
          <button onClick={fechar} data-esc-fechar aria-label="Fechar" className="pm-ic"
            style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={CARD}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <span style={ROTULO}>Cores usadas na arte</span>
            <span style={NOTA}>tabela Pantone ou nome livre</span>
          </div>
          <div style={{ flex: "none", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7, alignContent: "start" }}>
            {cores.map((valor, i) => {
              const sugestoes = sugIdx === i ? sug(valor) : [];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  {hex[i] && <span style={{ flex: "none", width: 26, height: 26, borderRadius: 999, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.16)", background: hex[i] }} />}
                  <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                    <input value={valor}
                      onChange={(e) => { setSugIdx(i); setCores(cores.map((c, j) => (j === i ? e.target.value : c))); }}
                      onFocus={() => setSugIdx(i)}
                      onBlur={() => setTimeout(() => setSugIdx((s) => (s === i ? null : s)), 120)}
                      placeholder={`Cor ${i + 1} — ex.: Pantone 485 C`}
                      style={INP} />
                    {sugestoes.length > 0 && (
                      <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 8, display: "flex", flexDirection: "column", gap: 2, background: "#fff", borderRadius: 9, padding: 6, boxShadow: "0 20px 40px -18px rgba(0,0,0,.45), 0 0 0 1px #ececec" }}>
                        {sugestoes.map((s) => (
                          <button key={s.nome}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSugIdx(null);
                              setCores(cores.map((x, j) => (j === i ? s.nome : x)));
                              setHex((st) => ({ ...st, [i]: s.hex }));
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "transparent", borderRadius: 6, padding: "8px 9px", cursor: "pointer", textAlign: "left" }}>
                            <span style={{ flex: "none", width: 20, height: 20, borderRadius: 5, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.14)", background: s.hex }} />
                            <span style={{ flex: 1, font: "600 14.5px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap" }}>{s.nome}</span>
                            <span style={{ font: `500 12.5px/1 ${MONO}`, color: "#7a787a" }}>{s.hex}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setPantoneIdx(i); }} title="Tabela Pantone Solid Coated" aria-label="Tabela Pantone" className="r2chip"
                    style={{ flex: "none", width: 34, height: 34, display: "grid", placeItems: "center", border: "2px solid #e0e0e0", background: "transparent", borderRadius: 999, cursor: "pointer" }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a4 4 0 1 1 0-8h4.5a4.5 4.5 0 0 0 0-5z" /></svg>
                  </button>
                  {/* tirar uma cor reindexa as amostras: sem isso a amostra da
                      linha removida ficava colada na cor de baixo */}
                  {cores.length > 1 && (
                    <button onClick={() => {
                      setCores(cores.filter((_, j) => j !== i));
                      setHex((st) => {
                        const novo: Record<number, string> = {};
                        for (const chave of Object.keys(st)) {
                          const j = Number(chave);
                          if (j < i) novo[j] = st[j];
                          else if (j > i) novo[j - 1] = st[j];
                        }
                        return novo;
                      });
                    }} title="Remover cor" aria-label="Remover cor" className="pm-ic"
                      style={{ flex: "none", width: 34, height: 34, display: "grid", placeItems: "center", background: "#f4f4f4", border: 0, borderRadius: 999, cursor: "pointer" }}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.8} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {cores.length < MAX_CORES ? (
            <button onClick={() => setCores([...cores, ""])} className="r2chip"
              style={{ flex: "none", alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 7, marginTop: 10, border: "2px dashed #d6d5d6", background: "transparent", borderRadius: 999, padding: "9px 14px", cursor: "pointer", font: "600 13.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={3} strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
              Adicionar cor
            </button>
          ) : (
            <div style={{ marginTop: 12, font: "500 13px/1.4 Inter,sans-serif", color: "#7a787a" }}>Limite de {MAX_CORES} cores por arte.</div>
          )}
        </div>

        <div style={CARD}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <label style={ROTULO}>Recado para quem solicitou</label>
            <span style={NOTA}>entra no histórico · Ctrl+Enter envia</span>
          </div>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} autoFocus
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); enviar(); } }}
            placeholder="Ex.: ajustei a tabela nutricional para 7 pt e converti a logo em curvas."
            style={{ flex: "none", height: 104, width: "100%", resize: "none", boxSizing: "border-box", background: "#f4f4f4", border: "2px solid #f4f4f4", borderRadius: 9, padding: "12px 14px", font: "500 15px/1.45 Inter,sans-serif", color: INK, outline: "none" }} />

          {/* Recado com pergunta dentro era o buraco: virava uma linha do
              histórico, o aviso dizia só "Pedido atualizado" e a resposta
              nunca vinha. Marcando aqui, ele abre uma pendência com dono. */}
          <button onClick={() => setPergunta((v) => !v)} role="checkbox" aria-checked={pergunta} disabled={!obs.trim()}
            style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, width: "100%", textAlign: "left", background: pergunta ? "#fffce6" : "transparent", border: `2px solid ${pergunta ? INK : "#ececec"}`, borderRadius: 9, padding: "10px 12px", cursor: obs.trim() ? "pointer" : "not-allowed", opacity: obs.trim() ? 1 : 0.5, transition: "background .12s ease,border-color .12s ease" }}>
            <span style={{ flex: "none", width: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 6, border: `2px solid ${pergunta ? AMARELO : "#dcdbdc"}`, background: pergunta ? AMARELO : "#fff" }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" style={{ display: pergunta ? "block" : "none" }}><path d="M4 12.5l5 5L20 6.5" /></svg>
            </span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ font: "700 13.5px/1 Inter,sans-serif", color: INK }}>É uma pergunta — preciso de resposta</span>
              <span style={{ font: "500 12px/1.35 Inter,sans-serif", color: "#7a787a" }}>
                Fica em destaque no pedido até {vendedora} responder, e o aviso dela diz que é pergunta.
              </span>
            </span>
          </button>

          <input ref={arquivoRef} type="file" multiple style={{ display: "none" }}
            onChange={(e) => {
              const lista = e.target.files;
              if (lista?.length) {
                const novos = Array.from(lista);
                setArquivos((atual) => [...atual, ...novos.filter((n) => !atual.some((a) => a.name === n.name))]);
              }
              e.target.value = "";
            }} />

          {arquivos.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {arquivos.map((a, i) => (
                <div key={a.name + i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f4f4f4", borderRadius: 9, padding: "8px 10px 8px 12px" }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                  <span className="truncate" style={{ flex: 1, minWidth: 0, font: "500 13.5px/1.1 Inter,sans-serif" }}>{a.name}</span>
                  <span style={{ flex: "none", whiteSpace: "nowrap", font: `500 12px/1 ${MONO}`, color: "#6f6d6f" }}>{tamanho(a.size)}</span>
                  <button onClick={() => setArquivos((s) => s.filter((_, j) => j !== i))} className="r2chip" aria-label="Remover anexo"
                    style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", border: 0, borderRadius: 999, background: "#e6e6e6", cursor: "pointer" }}>
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => arquivoRef.current?.click()}
            style={{ flex: "none", boxSizing: "border-box", width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, background: "#fafafa", border: "2px dashed #d6d5d6", borderRadius: 9, padding: 14, cursor: "pointer" }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5.5" /><path d="m8 9.5 4-4 4 4" /><path d="M4.5 16v3.5h15V16" /></svg>
            <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#6f6d6f", textAlign: "center" }}>
              {arquivos.length ? "Anexar mais arquivos" : "Anexar a arte final (PDF, AI, CDR) — vai para a pasta do cliente"}
            </span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: INK, borderRadius: 12, padding: "18px 22px" }}>
          <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, background: "#3a383a", borderRadius: 999, padding: "9px 15px", font: "600 13.5px/1 Inter,sans-serif", color: "#f1f1f1", whiteSpace: "nowrap" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M5 12h13" /><path d="M13 6l6 6-6 6" /></svg>
              {vendedora}
            </span>
            <span style={{ flex: "none", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ font: "700 10.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>Versão</span>
              <input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="v3" aria-label="Versão da arte"
                style={{ width: 66, textAlign: "center", boxSizing: "border-box", background: "#3a383a", border: "2px solid #3a383a", borderRadius: 999, padding: "9px 10px", font: "700 13.5px/1 Inter,sans-serif", color: "#f1f1f1", outline: "none" }} />
            </span>
            {!valido && (
              <span style={{ flex: "none", font: "500 12.5px/1.3 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>informe ao menos uma cor</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
            <button onClick={fechar} className="r2chip"
              style={{ border: 0, borderRadius: 999, padding: "14px 18px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", background: "#3a383a", color: "#f1f1f1" }}>Cancelar</button>
            <button onClick={enviar} className="r2chip"
              style={{ border: 0, borderRadius: 999, padding: "14px 20px", cursor: valido ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: valido ? AMARELO : "#4a484a", color: valido ? INK : "#8d8b8d" }}>
              Devolver arte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
