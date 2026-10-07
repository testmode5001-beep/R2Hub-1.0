// OP / Leitura por câmera — v1a. Fonte: design_handoff_r2_hub/telas/Leitura.dc.html
// (frame 13a desktop 1920×1290; o frame 13b mobile é outro artboard, fora do app).
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  AMARELO, AvisoV1a, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { clienteDaOP, extrairOP } from "@/lib/extrair-op";
import { lerImagemOP } from "@/lib/ocr-op";
import { lerLeituras, registrarLeitura } from "./dados/leituras";
import type { Leitura } from "./dados/leituras";

const FUNDO_CINZA = "#f1f1f1";

/* a extração mora em @/lib/extrair-op — compartilhada com a página do celular */
const extrair = extrairOP;

type CamEstado = "off" | "abrindo" | "on" | "erro";

const CAMPOS_VAZIOS = { op: "", num: "", cliente: "", descricao: "", medida: "", substrato: "", metragem: "", carreiras: "", nucleo: "", rolos: "", entrega: "" };

export function LeituraV1a({ profile, versao, aoNavegar, onNova, onLogout, disponiveis, children, leiturasReais, aoRegistrar }: {
  profile: { nome: string; role?: string };
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
  /** fila real (tabela `leituras`) — presente = desliga o localStorage */
  leiturasReais?: Leitura[];
  /** grava no banco (registrarLeituraOp) */
  aoRegistrar?: (dados: Omit<Leitura, "id" | "quando" | "usada">) => Promise<unknown>;
}) {
  const real = Array.isArray(leiturasReais);
  const [busca, setBusca] = useState("");
  const [cam, setCam] = useState<CamEstado>("off");
  const [aviso, setAviso] = useState("");
  const [lendo, setLendo] = useState(false);
  const [campos, setCampos] = useState({ ...CAMPOS_VAZIOS });
  const [leiturasDemo, setLeiturasDemo] = useState<Leitura[]>([]);
  const leituras = real ? leiturasReais! : leiturasDemo;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!real) setLeiturasDemo(lerLeituras());
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [real]);

  const ligada = cam === "on";
  const pronto = !!(campos.op && campos.medida && campos.substrato && campos.metragem);
  const podeCapturar = ligada || !!campos.descricao.trim();
  const setCampo = (k: keyof typeof CAMPOS_VAZIOS) => (v: string) => setCampos((c) => ({ ...c, [k]: v }));

  async function abrirCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("erro");
      setAviso("Este navegador não expõe a câmera.");
      return;
    }
    setCam("abrindo");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play?.().catch(() => { /* autoplay bloqueado */ });
      }
      setCam("on");
      setAviso("Câmera ligada: aponte para a etiqueta do rolo.");
    } catch {
      setCam("erro");
      setAviso("Permissão de câmera negada.");
    }
  }

  function pararCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function aplicarTexto(bruta: string) {
    const lido = extrair(bruta);
    const cliente = clienteDaOP(bruta);
    setCampos((c) => ({
      ...c,
      descricao: bruta,
      op: lido.op || c.op,
      cliente: cliente || c.cliente,
      medida: lido.medida || c.medida,
      substrato: lido.substrato || c.substrato,
      metragem: lido.metragem || c.metragem,
      carreiras: lido.carreiras || c.carreiras,
      nucleo: lido.nucleo || c.nucleo,
      rolos: lido.rolos || c.rolos,
      entrega: lido.entrega || c.entrega,
    }));
    setAviso(`OP ${lido.op || "sem número"} lida. Confira os campos destacados.`);
  }

  /* Antes havia aqui um OP_EXEMPLO: câmera ligada + descrição vazia preenchia
     o formulário com uma OP FICTÍCIA da LOURENCINI, que ia parar na fila real
     da Fábrica. Agora a captura lê o quadro da câmera com o MESMO OCR da
     página do celular — e quando não há texto legível, diz isso. */
  async function capturar() {
    const texto = campos.descricao.trim();
    if (texto) { aplicarTexto(texto); return; }
    const v = videoRef.current;
    if (!ligada || !v || !v.videoWidth) {
      setAviso("Ligue a câmera ou cole a descrição da OP para extrair.");
      return;
    }
    setLendo(true);
    setAviso("Lendo o quadro da câmera…");
    try {
      const tela = document.createElement("canvas");
      tela.width = v.videoWidth;
      tela.height = v.videoHeight;
      tela.getContext("2d")?.drawImage(v, 0, 0);
      const quadro = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", 0.92));
      if (!quadro) throw new Error("não deu para capturar o quadro da câmera");
      const bruto = (await lerImagemOP(quadro, (pct) => setAviso(`Lendo o quadro da câmera… ${pct}%`))).trim();
      if (!bruto) {
        setAviso("A câmera não trouxe texto legível. Aproxime da linha da OP ou cole a descrição no campo.");
        return;
      }
      aplicarTexto(bruto);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não deu para ler a câmera. Cole a descrição da OP no campo.");
    } finally {
      setLendo(false);
    }
  }

  function enviar() {
    if (!pronto) {
      setAviso("Nº da OP, medida, substrato e metragem são obrigatórios.");
      return;
    }
    const dados = {
      op: campos.op, num: campos.num, cliente: campos.cliente, descricao: campos.descricao,
      medida: campos.medida, substrato: campos.substrato, metragem: campos.metragem,
      carreiras: campos.carreiras, nucleo: campos.nucleo, rolos: campos.rolos, entrega: campos.entrega,
    };
    const ok = () => {
      setAviso(`OP ${campos.op} enviada ao painel · ${campos.rolos || "?"} rolos de ${campos.metragem} m (${campos.substrato}).`);
      setCampos({ ...CAMPOS_VAZIOS });
    };
    if (aoRegistrar) {
      aoRegistrar(dados)
        .then(ok)
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para enviar a leitura."));
      return;
    }
    registrarLeitura(dados);
    setLeiturasDemo(lerLeituras());
    ok();
  }

  const naFila = leituras.filter((l) => !l.usada).length;
  const microLabel = { display: "block", font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase" as const, color: "#8d8b8d" };

  const listaCampos: { k: keyof typeof CAMPOS_VAZIOS; label: string; placeholder: string; dica: string }[] = [
    { k: "op", label: "Nº da OP", placeholder: "P009186-002", dica: "número da ordem" },
    { k: "cliente", label: "Cliente", placeholder: "Lourencini Comércio", dica: "" },
    { k: "medida", label: "Medida", placeholder: "40x40", dica: "largura x altura (mm)" },
    { k: "substrato", label: "Substrato", placeholder: "Térmico AA", dica: "" },
    { k: "metragem", label: "Metragem do rolo", placeholder: "30", dica: "metros por rolo" },
    { k: "rolos", label: "Qtde. a produzir", placeholder: "1.200", dica: "rolos da OP" },
    { k: "entrega", label: "Entrega", placeholder: "09/08/2026", dica: "data da OP" },
    { k: "carreiras", label: "Carreiras", placeholder: "1", dica: "" },
    { k: "nucleo", label: "Núcleo (pol)", placeholder: "1 1/4", dica: "" },
  ];

  return (
    <EstagioV1a>
      <TopbarV1a
        nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""}
        busca={busca}
        aoBuscar={setBusca}
        onSair={onLogout}
      />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="OP" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          {/* header */}
          <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, padding: "0 4px" }}>
            <div>
              <h1 style={{ ...fr(144, 900), fontSize: 80, lineHeight: 0.86, color: INK, margin: "2px 0 0 2px" }}>Leitura</h1>
              <div style={{ font: "400 15px/1 Inter,sans-serif", color: "#8d8b8d", marginTop: 14 }}>
                Captura pela câmera do celular · {leituras.length} {leituras.length === 1 ? "leitura registrada" : "leituras registradas"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d", maxWidth: 280 }}>
                O operador aponta a câmera para a etiqueta do rolo; a leitura cai na fila do Painel.
              </span>
              <button type="button" onClick={() => aoNavegar?.("Fábrica")} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "15px 20px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: INK, color: AMARELO }}>
                Abrir o Painel
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "440px 1fr", gap: 12 }}>
            {/* coluna esquerda — câmera + como usar */}
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ flex: "none", display: "flex", flexDirection: "column", background: INK, borderRadius: 14, padding: "18px 18px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
                  <span style={{ font: "800 17px/1 Inter,sans-serif", color: "#f1f1f1", letterSpacing: "-.01em" }}>Câmera do operador</span>
                  <span style={{ font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "6px 9px 4px", borderRadius: 999, background: ligada ? AMARELO : "#3a383a", color: ligada ? INK : "#b3b1b3" }}>
                    {ligada ? "ao vivo" : cam === "erro" ? "sem câmera" : "desligada"}
                  </span>
                </div>
                <div style={{ position: "relative", height: 250, borderRadius: 10, overflow: "hidden", background: "#1a191a" }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: ligada ? "block" : "none" }} />
                  {!ligada && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v11H4z" /><circle cx="12" cy="13.5" r="3.4" /></svg>
                      <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d", textAlign: "center", maxWidth: 250 }}>
                        {cam === "erro" ? "Sem acesso à câmera. Use os campos ao lado para digitar." : cam === "abrindo" ? "Pedindo permissão…" : "Toque em ligar a câmera para ler a etiqueta do rolo."}
                      </span>
                    </div>
                  )}
                  <div style={{ position: "absolute", left: "12%", right: "12%", top: "28%", bottom: "28%", border: `2px solid ${ligada ? AMARELO : "rgba(241,241,241,.18)"}`, borderRadius: 10, pointerEvents: "none" }} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    type="button"
                    className="r2chip"
                    onClick={() => { if (ligada) { pararCamera(); setCam("off"); setAviso("Câmera desligada."); } else abrirCamera(); }}
                    style={{ flex: 1, border: 0, borderRadius: 8, padding: 13, cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", background: ligada ? "#3a383a" : AMARELO, color: ligada ? "#f1f1f1" : INK }}
                  >
                    {ligada ? "Desligar câmera" : "Ligar câmera"}
                  </button>
                  <button type="button" className="r2chip" onClick={capturar} disabled={lendo}
                    style={{ flex: 1, border: 0, borderRadius: 8, padding: 13, cursor: lendo ? "wait" : podeCapturar ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", background: podeCapturar && !lendo ? "#f1f1f1" : "#3a383a", color: podeCapturar && !lendo ? INK : "#8d8b8d" }}>
                    {lendo ? "Lendo…" : "Capturar"}
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#fff", borderRadius: 14, padding: "18px 20px 16px", boxShadow: SOMBRA_CARD }}>
                <div style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", marginBottom: 6 }}>Como usar</div>
                {[
                  "Ligue a câmera e aponte para a etiqueta do rolo, dentro da moldura amarela.",
                  "Toque em capturar: número, medida, substrato e metragem são preenchidos.",
                  "Corrija o que estiver diferente do rolo físico. A leitura é assistida.",
                  "Envie: a leitura entra na fila do Painel e atualiza o pedido no cadastro.",
                ].map((texto, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "1px solid #f1f1f1" }}>
                    <span style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: 999, background: AMARELO, font: "800 13.5px/1 Inter,sans-serif", color: INK }}>{i + 1}</span>
                    <span style={{ flex: 1, font: "500 15px/1.4 Inter,sans-serif", color: "#5c5a5c" }}>{texto}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* coluna direita — formulário + leituras enviadas */}
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ flex: "none", background: "#fff", borderRadius: 14, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Ordem de produção lida</span>
                  <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#b3b1b3" }}>confira antes de enviar</span>
                </div>
                <label style={{ ...microLabel, margin: "4px 0 8px" }}>Descrição do produto (linha destacada da OP)</label>
                <textarea
                  value={campos.descricao}
                  onChange={(e) => setCampo("descricao")(e.target.value)}
                  placeholder="ETQ BALANCA C/ PIC 40X40 TERMICO AA PERSONALIZADA 1 CAR 1 1/4 POL 30MTS"
                  style={{ width: "100%", height: 62, resize: "none", boxSizing: "border-box", background: FUNDO_CINZA, border: `2px solid ${FUNDO_CINZA}`, borderRadius: 7, padding: "11px 13px", font: "600 15px/1.35 Inter,sans-serif", color: INK, outline: "none", marginBottom: 16 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px 12px" }}>
                  {listaCampos.map((c) => (
                    <div key={c.k}>
                      <label style={{ ...microLabel, marginBottom: 8 }}>{c.label}</label>
                      <input
                        value={campos[c.k]}
                        onChange={(e) => setCampo(c.k)(e.target.value)}
                        placeholder={c.placeholder}
                        style={{ width: "100%", boxSizing: "border-box", background: FUNDO_CINZA, border: `2px solid ${FUNDO_CINZA}`, borderRadius: 7, padding: "12px 14px", font: "600 16px/1.2 Inter,sans-serif", color: INK, outline: "none" }}
                      />
                      {c.dica && <div style={{ marginTop: 7, font: "500 13.5px/1.3 Inter,sans-serif", color: "#b3b1b3" }}>{c.dica}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 18, paddingTop: 16, borderTop: "1px solid #f1f1f1" }}>
                  <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
                    {pronto
                      ? `OP ${campos.op} · ${campos.cliente || "cliente não lido"} · ${campos.rolos || "?"} rolos × ${campos.metragem} m${campos.entrega ? ` · entrega ${campos.entrega}` : ""}`
                      : "Capture a OP ou digite nº da ordem, medida, substrato e metragem."}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => { setCampos({ ...CAMPOS_VAZIOS }); setAviso(""); }} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "14px 18px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", background: FUNDO_CINZA, color: "#5c5a5c" }}>Limpar</button>
                    <button type="button" onClick={enviar} className="r2chip"
                      style={{ border: 0, borderRadius: 999, padding: "14px 20px", cursor: pronto ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: pronto ? AMARELO : FUNDO_CINZA, color: pronto ? INK : "#b3b1b3" }}>
                      Enviar para o painel
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, padding: "18px 22px 14px", boxShadow: SOMBRA_CARD }}>
                <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                  <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Leituras enviadas</span>
                  <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#b3b1b3" }}>{naFila} na fila do painel</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
                  {leituras.length === 0 && (
                    <div style={{ flex: 1, display: "grid", placeItems: "center", alignContent: "center", gap: 10, padding: "24px 0", textAlign: "center" }}>
                      <span style={{ font: "400 15px/1.4 Inter,sans-serif", color: "#b3b1b3", maxWidth: 420 }}>
                        Nenhuma leitura enviada ainda. Capture a etiqueta do rolo e envie: a leitura entra na fila do Painel.
                      </span>
                      <button type="button" onClick={capturar} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "13px 20px", cursor: "pointer", font: "700 14px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: AMARELO, color: INK }}>
                        Capturar leitura
                      </button>
                    </div>
                  )}
                  {leituras.map((l, i) => (
                    <div key={l.id} className="r2row" style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, padding: "13px 2px", borderBottom: i === leituras.length - 1 ? 0 : "1px solid #f1f1f1" }}>
                      <span style={{ flex: "0 0 78px", font: `600 15px/1 ${MONO}`, color: INK }}>{l.op || l.num || "—"}</span>
                      <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.3 Inter,sans-serif", color: "#5c5a5c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {[l.cliente, l.medida, l.substrato, l.nucleo ? `${l.nucleo} pol` : ""].filter(Boolean).join(" · ")}
                      </span>
                      <span style={{ flex: "0 0 110px", font: "700 15px/1 Inter,sans-serif", color: INK }}>
                        {(l.rolos ? l.rolos + " RL × " : "") + (l.metragem ? l.metragem + " m" : "—")}
                      </span>
                      <span style={{ flex: "0 0 128px", font: "500 13.5px/1 Inter,sans-serif", color: "#b3b1b3" }}>{l.quando}</span>
                      <span style={{ flex: "0 0 96px", textAlign: "center", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "6px 8px 4px", borderRadius: 999, background: l.usada ? "#f1f1f1" : AMARELO, color: l.usada ? "#8d8b8d" : INK }}>
                        {l.usada ? "na máquina" : "na fila"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </EstagioV1a>
  );
}
