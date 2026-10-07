// Leitura de OP pelo CELULAR — a única página do hub desenhada para telefone:
// coluna única em altura real (sem o palco 1920 escalado), botões de dedo.
// Fluxo: foto da OP (input capture — abre a câmera nativa e funciona até em
// HTTP, ao contrário do getUserMedia) → OCR no aparelho (tesseract.js, assets
// servidos pelo próprio hub em /tesseract — sem depender de internet) →
// extrairOP() → campos conferíveis → entra na fila real do painel da Fábrica.
import { useEffect, useRef, useState } from "react";

import { clienteDaOP, extrairOP } from "@/lib/extrair-op";
import { lerImagemOP } from "@/lib/ocr-op";

const INK = "#252425";
const AMARELO = "#ffe815";
const MONO = "ui-monospace, Menlo, monospace";

export type CamposLeitura = {
  op: string; cliente: string; descricao: string; medida: string; substrato: string;
  metragem: string; carreiras: string; nucleo: string; rolos: string; entrega: string;
};
const VAZIO: CamposLeitura = {
  op: "", cliente: "", descricao: "", medida: "", substrato: "",
  metragem: "", carreiras: "", nucleo: "", rolos: "", entrega: "",
};

/* Redução da foto e OCR moram em @/lib/ocr-op — compartilhados com a tela de
   Leitura do desktop, que lê o quadro da câmera com o mesmo tesseract. */
const lerFoto = lerImagemOP;

type Fase = "foto" | "lendo" | "conferir" | "enviando";

export function LeituraMovel({ nome, fila, aoRegistrar, aoSair, aoAbrirHub }: {
  nome: string;
  /** quantas leituras não usadas aguardam no painel */
  fila: number;
  aoRegistrar: (dados: CamposLeitura) => Promise<unknown>;
  aoSair: () => void;
  /** abre o hub completo (desktop) mesmo no celular — grava a exceção */
  aoAbrirHub?: () => void;
}) {
  const [fase, setFase] = useState<Fase>("foto");
  const [pct, setPct] = useState(0);
  const [campos, setCampos] = useState<CamposLeitura>({ ...VAZIO });
  const [aviso, setAviso] = useState("");
  /** texto técnico do erro — fica visível para quem estiver com o aparelho na
      mão poder contar o que apareceu (falha de OCR não dá para adivinhar) */
  const [detalhe, setDetalhe] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (avisoTimer.current) clearTimeout(avisoTimer.current); }, []);
  function avisar(texto: string) {
    setAviso(texto);
    if (avisoTimer.current) clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(""), 5000);
  }

  async function chegouFoto(lista: FileList | null) {
    const arquivo = lista?.[0];
    if (!arquivo) return;
    setFase("lendo");
    setPct(0);
    setDetalhe("");
    try {
      const texto = await lerFoto(arquivo, setPct);
      aplicarTexto(texto);
    } catch (e) {
      setFase("foto");
      setDetalhe(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      avisar("Não deu para ler a foto. Dá para digitar os campos à mão logo abaixo.");
    }
  }

  function aplicarTexto(texto: string) {
    const bruta = texto.trim();
    if (!bruta) {
      setFase("foto");
      avisar("A foto não trouxe texto legível. Aproxime da linha da OP e tente de novo.");
      return;
    }
    const lido = extrairOP(bruta);
    setCampos({
      descricao: bruta,
      op: lido.op, cliente: clienteDaOP(bruta),
      medida: lido.medida, substrato: lido.substrato, metragem: lido.metragem,
      carreiras: lido.carreiras, nucleo: lido.nucleo, rolos: lido.rolos, entrega: lido.entrega,
    });
    setFase("conferir");
    const achados = [lido.op, lido.medida, lido.substrato, lido.metragem].filter(Boolean).length;
    avisar(achados >= 3 ? "Leitura boa. Confira os campos e envie." : "Leitura parcial. Complete o que faltou.");
  }

  const pronto = !!(campos.op && campos.medida && campos.substrato && campos.metragem);

  function enviar() {
    if (!pronto) { avisar("OP, medida, substrato e metragem são obrigatórios."); return; }
    setFase("enviando");
    aoRegistrar(campos)
      .then(() => {
        setCampos({ ...VAZIO });
        setFase("foto");
        avisar(`OP ${campos.op} entrou na fila do painel.`);
      })
      .catch((e: unknown) => {
        setFase("conferir");
        avisar(e instanceof Error ? e.message : "Não deu para enviar. Tente de novo.");
      });
  }

  const setCampo = (k: keyof CamposLeitura) => (v: string) => setCampos((c) => ({ ...c, [k]: v }));

  const CAMPOS_TELA: { k: keyof CamposLeitura; label: string; ph: string; obrig?: boolean; largo?: boolean }[] = [
    { k: "op", label: "Nº da OP", ph: "P009186-002", obrig: true, largo: true },
    { k: "cliente", label: "Cliente", ph: "Lourencini", largo: true },
    { k: "medida", label: "Medida", ph: "40x40", obrig: true },
    { k: "substrato", label: "Substrato", ph: "Térmico AA", obrig: true },
    { k: "metragem", label: "Metragem", ph: "30", obrig: true },
    { k: "rolos", label: "Qtde. rolos", ph: "1.200" },
    { k: "carreiras", label: "Carreiras", ph: "1" },
    { k: "entrega", label: "Entrega", ph: "09/08/2026" },
  ];

  const rotulo = { display: "block", font: "700 11px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase" as const, color: "#8d8b8d", marginBottom: 6 };
  const caixa = { width: "100%", background: "#fff", border: "2px solid #e0e0e0", borderRadius: 10, padding: "13px 13px", font: "700 17px/1.2 Inter,sans-serif", color: INK, outline: "none" };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#f1f1f1", color: INK, fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* topo */}
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, background: INK, padding: "14px 16px" }}>
        <span style={{ flex: "none", width: 38, height: 38, display: "grid", placeItems: "center", background: AMARELO, borderRadius: 8, font: "800 15px/1 Inter,sans-serif", color: INK }}>R2</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "800 16px/1.1 Inter,sans-serif", color: "#fff" }}>Leitura de OP</div>
          <div style={{ font: "400 12.5px/1.2 Inter,sans-serif", color: "#b3b1b3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {nome.split(" ")[0]} · {fila} na fila do painel
          </div>
        </div>
        <button onClick={aoSair} style={{ flex: "none", background: "transparent", border: "2px solid #4a484a", borderRadius: 999, padding: "9px 14px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", color: "#f1f1f1" }}>Sair</button>
      </div>

      {aviso && (
        <div style={{ flex: "none", background: AMARELO, color: INK, padding: "12px 16px", font: "600 14.5px/1.4 Inter,sans-serif" }}>{aviso}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

        {fase === "foto" && (
          <>
            <div style={{ background: "#fff", borderRadius: 14, padding: "22px 18px", textAlign: "center" }}>
              <div style={{ font: "800 22px/1.25 Inter,sans-serif", letterSpacing: "-.01em" }}>Fotografe a linha da OP</div>
              <p style={{ font: "400 15px/1.5 Inter,sans-serif", color: "#5c5a5c", margin: "10px 0 0" }}>
                Enquadre a linha destacada da ordem (número, medida, substrato, metragem). Folha reta e boa luz ajudam a leitura.
              </p>
              <button onClick={() => inputRef.current?.click()}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, width: "100%", marginTop: 18, background: AMARELO, border: 0, borderRadius: 12, padding: "18px 16px", cursor: "pointer", font: "800 18px/1 Inter,sans-serif", color: INK }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v11H4z" /><circle cx={12} cy={13.5} r={3.4} /></svg>
                Abrir a câmera
              </button>
              <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={(e) => { void chegouFoto(e.target.files); e.target.value = ""; }} />
            </div>
            {detalhe && (
              <div style={{ background: "#fff", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ font: "700 12px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#c0392b" }}>Falha da leitura</div>
                <div style={{ font: `400 12.5px/1.5 ${MONO}`, color: "#5c5a5c", marginTop: 8, wordBreak: "break-word" }}>{detalhe}</div>
              </div>
            )}
            <button onClick={() => { setCampos({ ...VAZIO }); setFase("conferir"); avisar("Preenchimento manual: digite os campos da OP."); }}
              style={{ background: "transparent", border: 0, cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: "#5c5a5c", padding: 10 }}>
              ou digitar sem foto
            </button>
            {aoAbrirHub && (
              <button onClick={aoAbrirHub}
                style={{ background: "transparent", border: 0, cursor: "pointer", font: "500 13px/1 Inter,sans-serif", color: "#b3b1b3", padding: 8 }}>
                abrir o hub completo (tela de computador)
              </button>
            )}
          </>
        )}

        {fase === "lendo" && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "26px 18px", textAlign: "center" }}>
            <div style={{ font: "800 20px/1.2 Inter,sans-serif" }}>Lendo a foto…</div>
            <div style={{ height: 8, background: "#e0e0e0", borderRadius: 999, overflow: "hidden", margin: "16px 0 8px" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: AMARELO, transition: "width .2s ease" }} />
            </div>
            <div style={{ font: `600 13px/1 ${MONO}`, color: "#8d8b8d" }}>{pct}%</div>
          </div>
        )}

        {(fase === "conferir" || fase === "enviando") && (
          <>
            <div style={{ background: "#fff", borderRadius: 14, padding: "16px 14px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <span style={{ font: "800 17px/1 Inter,sans-serif" }}>Confira os campos</span>
                <span style={{ flex: 1 }} />
                <button onClick={() => { setFase("foto"); }} style={{ background: "transparent", border: 0, cursor: "pointer", font: "600 13.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>nova foto</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 10px" }}>
                {CAMPOS_TELA.map((c) => (
                  <div key={c.k} style={c.largo ? { gridColumn: "1 / -1" } : undefined}>
                    <label style={rotulo}>{c.label}{c.obrig && <span style={{ color: INK }}> *</span>}</label>
                    <input value={campos[c.k]} onChange={(e) => setCampo(c.k)(e.target.value)} placeholder={c.ph}
                      style={{ ...caixa, borderColor: c.obrig && !campos[c.k] ? "#c0392b" : campos[c.k] ? AMARELO : "#e0e0e0" }} />
                  </div>
                ))}
              </div>
            </div>
            {campos.descricao && (
              <details style={{ background: "#fff", borderRadius: 12, padding: "12px 14px" }}>
                <summary style={{ font: "600 13.5px/1 Inter,sans-serif", color: "#5c5a5c", cursor: "pointer" }}>Texto lido da foto</summary>
                <div style={{ font: `400 12.5px/1.6 ${MONO}`, color: "#5c5a5c", marginTop: 10, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{campos.descricao}</div>
              </details>
            )}
          </>
        )}
      </div>

      {/* rodapé fixo */}
      {(fase === "conferir" || fase === "enviando") && (
        <div style={{ flex: "none", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: INK }}>
          <button onClick={enviar} disabled={fase === "enviando"}
            style={{ width: "100%", background: pronto ? AMARELO : "#4a484a", border: 0, borderRadius: 12, padding: "17px 16px", cursor: fase === "enviando" ? "wait" : "pointer", font: "800 17px/1 Inter,sans-serif", color: pronto ? INK : "#8d8b8d", opacity: fase === "enviando" ? 0.7 : 1 }}>
            {fase === "enviando" ? "Enviando…" : "Enviar para o painel"}
          </button>
        </div>
      )}
    </div>
  );
}
