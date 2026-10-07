// Clichê chegou (modal) — v1a. Fonte: design_handoff_r2_hub/telas/Cliche-chegou-modal.dc.html.
// Registra a chegada do clichê com data/hora e o valor por cor (linhas
// derivadas do campo cores; sugestões Pantone inline + modal Pantone).
// onSalvar({data, hora, itens: [{descricao, valor}], total}).
//
// Duas portas para o mesmo registro: digitar à mão, ou soltar aqui o PDF da
// ordem de serviço da clicheria — o hub lê as cores e os valores da nota.
import { useRef, useState } from "react";

import { parseValorBR } from "@/lib/valor";
import { fileToBase64 } from "@/lib/files";
import { lerNotaClichePdf, pareceOutroCliente, type NotaCliche } from "@/lib/nota-cliche";
import { AMARELO, INK, MONO, fr } from "../HubV1a";
import { sugestoesPantone } from "../dados/pantone-busca";
import { PantoneModalV1a } from "./PantoneModalV1a";

/** Quantas cores (= quantos clichês) o pedido pede. O pódio da Aprovação usa a
    mesma conta para o pedido que ainda não voltou da clicheria. */
export function linhasIniciais(cores?: string): string[] {
  const c = String(cores || "").trim();
  if (/cmyk/i.test(c)) return ["Ciano", "Magenta", "Amarelo", "Preto"];
  /* `pant` e não `pantone`: o chip da Nova arte v3 grava "4+PANT" (abreviado
     para caber no botão). Com o termo inteiro, "4+PANT" caía no parseInt e
     virava 4 clichês em vez dos 5 que a escala de processo + uma especial
     realmente pede. */
  if (/pant/i.test(c) && /4/.test(c)) return ["Ciano", "Magenta", "Amarelo", "Preto", "Pantone"];
  const achadas = c.split(/,|·/).map((s) => s.replace(/×\s*\d+/g, "").trim()).filter(Boolean);
  if (achadas.length > 1) return achadas;
  const n = parseInt(c, 10);
  if (Number.isFinite(n) && n >= 1 && n <= 8) return Array.from({ length: n }, (_, i) => "Cor " + (i + 1));
  return ["Cor 1"];
}

/* regra única do hub — "1.500" é mil e quinhentos, "84.37" é oitenta e quatro */
const parseValor = parseValorBR;

const brl = (n: number) => {
  const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split(".");
  return (n < 0 ? "-" : "") + "R$ " + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d;
};

const diaBR = (iso: string) => String(iso || "").split("-").reverse().join("/");

/** Amostra de cor para as linhas que vieram da nota, quando o nome é Pantone
    exato ou uma tinta de processo — a mesma cor que a busca inline mostraria. */
function coresDasLinhas(linhas: { descricao: string }[]): Record<number, string> {
  const achadas: Record<number, string> = {};
  linhas.forEach((l, i) => {
    const nome = l.descricao.trim();
    const s = sugestoesPantone(nome, 1)[0];
    if (s && s.nome.toLowerCase() === nome.toLowerCase()) achadas[i] = s.hex;
  });
  return achadas;
}

const INP = {
  width: "100%", boxSizing: "border-box", background: "#f1f1f1", border: "2px solid #f1f1f1",
  borderRadius: 7, padding: "12px 14px", font: "600 15px/1.2 Inter,sans-serif", color: INK, outline: "none",
} as const;
const CARD = { background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.25)" } as const;
const ROTULO = { display: "block", font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 8 } as const;
const LINHA_AVISO = { display: "flex", alignItems: "flex-start", gap: 9, marginTop: 10, font: "400 13px/1.4 Inter,sans-serif", color: "#5c5a5c" } as const;
const PONTO = (cor: string) => ({ flex: "none", width: 7, height: 7, borderRadius: 999, background: cor, marginTop: 4 }) as const;

export type RegistroCliche = {
  data: string;
  hora: string;
  itens: { descricao: string; valor: number }[];
  total: number;
  /** Nome da nota da clicheria já guardada neste registro (vem do banco). */
  notaNome?: string | null;
  /** Nota nova anexada agora — só existe no caminho de ida, para o servidor gravar. */
  notaBase64?: string | null;
};

export function ClicheChegouModalV1a({ num, cliente, cores, registro, fechar, onSalvar }: {
  num?: string;
  cliente?: string;
  cores?: string;
  registro?: RegistroCliche | null;
  fechar: () => void;
  onSalvar: (d: RegistroCliche) => void;
}) {
  const reg = registro && Array.isArray(registro.itens) && registro.itens.length ? registro : null;
  const agora = new Date();
  const [data, setData] = useState(reg ? reg.data : agora.toISOString().slice(0, 10));
  const [hora, setHora] = useState(reg ? reg.hora
    : `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`);
  const [linhas, setLinhas] = useState<{ descricao: string; valor: string }[]>(() =>
    reg
      ? reg.itens.map((it) => ({ descricao: it.descricao, valor: it.valor.toFixed(2).replace(".", ",") }))
      : linhasIniciais(cores).map((d) => ({ descricao: d, valor: "" })));
  const [hex, setHex] = useState<Record<number, string>>({});
  const [sugIdx, setSugIdx] = useState<number | null>(null);
  const [pantoneIdx, setPantoneIdx] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");

  /* —— nota da clicheria —— */
  const [nota, setNota] = useState<NotaCliche | null>(null);
  /* Nome do arquivo em mãos: o da nota recém-lida, ou o da que já está
     guardada no registro (correção de valores não obriga a reenviar). */
  const [notaNome, setNotaNome] = useState(reg?.notaNome ?? "");
  const [notaBase64, setNotaBase64] = useState<string | null>(null);
  const [lendoNota, setLendoNota] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  /* o que estava preenchido antes da nota entrar: importar nunca é caminho sem volta */
  const [antesDaNota, setAntesDaNota] = useState<
    null | { linhas: { descricao: string; valor: string }[]; hex: Record<number, string> }
  >(null);
  const inputNota = useRef<HTMLInputElement>(null);

  const importarNota = async (arquivo?: File | null) => {
    if (!arquivo) return;
    if (!/\.pdf$/i.test(arquivo.name)) {
      setAviso("A nota precisa ser o PDF da ordem de serviço da clicheria.");
      return;
    }
    setLendoNota(true);
    setAviso("");
    try {
      const lida = await lerNotaClichePdf(arquivo);
      const novas = lida.itens.map((i) => ({
        descricao: i.descricao,
        valor: i.valor.toFixed(2).replace(".", ","),
      }));
      setAntesDaNota({ linhas, hex });
      setLinhas(novas);
      setHex(coresDasLinhas(novas));
      setNota(lida);
      setNotaNome(arquivo.name);
      setNotaBase64(await fileToBase64(arquivo)); // vai junto no salvar e fica guardada
    } catch (e) {
      setNota(null);
      setNotaNome(reg?.notaNome ?? "");
      setNotaBase64(null);
      setAviso(e instanceof Error ? e.message : "Não consegui ler esse PDF.");
    } finally {
      setLendoNota(false);
      if (inputNota.current) inputNota.current.value = ""; // permite reenviar o mesmo arquivo
    }
  };

  const descartarNota = () => {
    if (antesDaNota) {
      setLinhas(antesDaNota.linhas);
      setHex(antesDaNota.hex);
    }
    setAntesDaNota(null);
    setNota(null);
    setNotaNome(reg?.notaNome ?? "");
    setNotaBase64(null);
    setAviso("");
  };

  const total = linhas.reduce((s, l) => { const v = parseValor(l.valor); return s + (Number.isFinite(v) ? v : 0); }, 0);
  const valido = !!data && !!hora && linhas.length > 0 &&
    linhas.every((l) => l.descricao.trim() && Number.isFinite(parseValor(l.valor)) && parseValor(l.valor) >= 0);

  /* Conferências da nota — todas avisam, nenhuma trava: quem está com o clichê
     na mão sabe mais que o PDF. */
  const notaDiverge = !!nota && nota.total !== null && Math.abs(total - nota.total) > 0.005;
  const notaDeOutro = !!nota && pareceOutroCliente(nota, cliente);
  const notaSemValores = !!nota && nota.itens.every((i) => i.valor === 0);

  const sug = (valor: string) => {
    const v = String(valor || "").trim();
    if (v.length < 1) return [];
    const achados = sugestoesPantone(v, 6);
    if (achados.some((s) => s.nome.toLowerCase() === v.toLowerCase())) return [];
    return achados;
  };

  const mudar = (i: number, campo: "descricao" | "valor", v: string) => {
    setLinhas(linhas.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));
    setAviso("");
    if (campo === "descricao") setSugIdx(i);
  };

  return (
    <div onClick={fechar}
      className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 64, display: "flex", alignItems: "center", justifyContent: "center", padding: 36, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14 }}>

      {pantoneIdx !== null && (
        <PantoneModalV1a
          valor={linhas[pantoneIdx]?.descricao || ""}
          fechar={() => setPantoneIdx(null)}
          onEscolher={(nome, hexCor) => {
            const i = pantoneIdx;
            setPantoneIdx(null);
            setLinhas(linhas.map((l, j) => (j === i ? { ...l, descricao: nome } : l)));
            setHex((st) => {
              if (hexCor) return { ...st, [i]: hexCor };
              const novo = { ...st };
              delete novo[i];
              return novo;
            });
          }}
        />
      )}

      <div onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); if (!arrastando) setArrastando(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setArrastando(false); }}
        onDrop={(e) => { e.preventDefault(); setArrastando(false); void importarNota(e.dataTransfer.files?.[0]); }}
        style={{ width: 620, maxHeight: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)", outline: arrastando ? `2px dashed ${INK}` : "none", outlineOffset: -6 }}>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{(num ? num + " · " : "") + (cliente || "Registrar recebimento")}</div>
            <div style={{ ...fr(96, 700), fontSize: 34, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Clichê chegou</div>
          </div>
          <button onClick={fechar} className="pm-ic" style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Caminho curto: o PDF da ordem de serviço preenche as linhas de baixo.
            Fica acima de tudo porque é por onde a chegada costuma começar — a
            nota chega junto com o clichê. Digitar à mão continua valendo. */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
            <label style={{ ...ROTULO, marginBottom: 0 }}>Nota da clicheria</label>
            {nota && (
              <button onClick={descartarNota} className="r2chip"
                style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "600 13px/1 Inter,sans-serif", color: "#8d8b8d" }}>
                {antesDaNota ? "Desfazer" : "Descartar"}
              </button>
            )}
          </div>

          <input ref={inputNota} type="file" accept="application/pdf,.pdf" style={{ display: "none" }}
            onChange={(e) => void importarNota(e.target.files?.[0])} />

          {!nota && notaNome ? (
            /* Registro que já veio com nota guardada (correção de valores):
               não relê o PDF, só mostra qual está no arquivo. */
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#f7f7f7", borderRadius: 9, padding: "12px 14px" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `600 14px/1.2 ${MONO}`, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notaNome}</div>
                <div style={{ font: "400 13px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 3 }}>guardada com este registro</div>
              </div>
              <button onClick={() => inputNota.current?.click()} className="r2chip"
                style={{ flex: "none", border: "2px solid #e0e0e0", background: "transparent", borderRadius: 999, padding: "9px 14px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                Trocar
              </button>
            </div>
          ) : !nota ? (
            <button onClick={() => inputNota.current?.click()} disabled={lendoNota} className="r2chip"
              style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: "2px dashed #d6d5d6", background: "transparent", borderRadius: 9, padding: "14px 16px", cursor: lendoNota ? "progress" : "pointer" }}>
              <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
              </svg>
              <span style={{ font: "600 14px/1.3 Inter,sans-serif", color: lendoNota ? INK : "#5c5a5c" }}>
                {lendoNota ? "Lendo a nota…" : "Solte aqui o PDF da ordem de serviço, ou clique para escolher"}
              </span>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#f7f7f7", borderRadius: 9, padding: "12px 14px" }}>
              <span style={{ flex: "none", display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: 999, background: AMARELO }}>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5.5 5.5L20 7" /></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: `600 14px/1.2 ${MONO}`, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nota.os || notaNome}
                </div>
                <div style={{ font: "400 13px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[
                    nota.titulo,
                    `${nota.itens.length} ${nota.itens.length === 1 ? "clichê" : "clichês"}`,
                    nota.total !== null ? brl(nota.total) : null,
                  ].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button onClick={() => inputNota.current?.click()} className="r2chip"
                style={{ flex: "none", border: "2px solid #e0e0e0", background: "transparent", borderRadius: 999, padding: "9px 14px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                Trocar
              </button>
            </div>
          )}

          {/* A nota diz quando o clichê SAIU da clicheria; o dia da chegada é
              outro fato, e quem registra é quem sabe. Ofereço, não imponho. */}
          {nota?.despacho && nota.despacho !== data && (
            <button onClick={() => { setData(nota.despacho); setAviso(""); }} className="r2chip"
              style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, border: "2px dashed #d6d5d6", background: "transparent", borderRadius: 999, padding: "8px 13px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", color: "#5c5a5c" }}>
              Despachada em {diaBR(nota.despacho)}: usar como dia
            </button>
          )}

          {notaDeOutro && (
            <div style={LINHA_AVISO}>
              <span style={PONTO(AMARELO)} />
              <span>Esta nota é do trabalho <b style={{ color: INK }}>{nota?.titulo || nota?.cliente}</b>{cliente ? `, e o pedido é de ${cliente}` : ""}. Confira se é a ordem de serviço certa.</span>
            </div>
          )}
          {notaSemValores && (
            <div style={LINHA_AVISO}>
              <span style={PONTO("#d6d5d6")} />
              <span>A nota não trazia tabela de cobrança: vieram só os nomes das cores. Os valores ficam por sua conta.</span>
            </div>
          )}
          {notaDiverge && (
            <div style={LINHA_AVISO}>
              <span style={PONTO(AMARELO)} />
              <span>A soma das linhas ({brl(total)}) está diferente do total da nota ({brl(nota!.total!)}).</span>
            </div>
          )}
        </div>

        <div style={CARD}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={ROTULO}>Dia</label>
              <input type="date" value={data} onChange={(e) => { setData(e.target.value); setAviso(""); }} className="inp" style={INP} />
            </div>
            <div>
              <label style={ROTULO}>Horário</label>
              <input type="time" value={hora} onChange={(e) => { setHora(e.target.value); setAviso(""); }} className="inp" style={INP} />
            </div>
          </div>
        </div>

        <div style={{ ...CARD, maxHeight: 300, overflow: "auto" }}>
          <div style={{ ...ROTULO, marginBottom: 12 }}>Valor de cada clichê{cores ? ` (${cores})` : ""}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {linhas.map((l, i) => {
              const sugestoes = sugIdx === i ? sug(l.descricao) : [];
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {hex[i] && <span style={{ flex: "none", width: 34, height: 34, borderRadius: 7, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.14)", background: hex[i] }} />}
                  <div style={{ position: "relative", flex: 1 }}>
                    <input value={l.descricao}
                      onChange={(e) => mudar(i, "descricao", e.target.value)}
                      onFocus={() => setSugIdx(i)}
                      onBlur={() => setTimeout(() => setSugIdx((s) => (s === i ? null : s)), 120)}
                      placeholder={"Cor " + (i + 1)} className="inp" style={INP} />
                    {sugestoes.length > 0 && (
                      <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 8, display: "flex", flexDirection: "column", gap: 2, background: "#fff", borderRadius: 9, padding: 6, boxShadow: "0 20px 40px -18px rgba(0,0,0,.45), 0 0 0 1px #ececec" }}>
                        {sugestoes.map((s) => (
                          <button key={s.nome}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSugIdx(null);
                              setLinhas(linhas.map((x, j) => (j === i ? { ...x, descricao: s.nome } : x)));
                              setHex((st) => ({ ...st, [i]: s.hex }));
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "transparent", borderRadius: 6, padding: "8px 9px", cursor: "pointer", textAlign: "left" }}>
                            <span style={{ flex: "none", width: 20, height: 20, borderRadius: 5, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.14)", background: s.hex }} />
                            <span style={{ flex: 1, font: "600 14.5px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap" }}>{s.nome}</span>
                            <span style={{ font: `500 12.5px/1 ${MONO}`, color: "#b3b1b3" }}>{s.hex}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setPantoneIdx(i); }} title="Tabela Pantone Solid Coated" className="r2chip"
                    style={{ flex: "none", display: "grid", placeItems: "center", width: 38, height: 44, border: "2px solid #e0e0e0", background: "transparent", borderRadius: 7, cursor: "pointer" }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a4 4 0 1 1 0-8h4.5a4.5 4.5 0 0 0 0-5z" /></svg>
                  </button>
                  <div style={{ position: "relative", flex: "0 0 118px" }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", font: "600 14.5px/1 Inter,sans-serif", color: "#b3b1b3", pointerEvents: "none" }}>R$</span>
                    <input value={l.valor} onChange={(e) => mudar(i, "valor", e.target.value)} placeholder="0,00" inputMode="decimal"
                      className="inp" style={{ ...INP, paddingLeft: 42, textAlign: "right" }} />
                  </div>
                  {linhas.length > 1 && (
                    <button onClick={() => { setLinhas(linhas.filter((_, j) => j !== i)); setAviso(""); }} title="Remover linha" className="pm-ic"
                      style={{ flex: "none", width: 34, height: 34, display: "grid", placeItems: "center", background: "#f1f1f1", border: 0, borderRadius: 999, cursor: "pointer" }}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.8} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => { setLinhas([...linhas, { descricao: "", valor: "" }]); setAviso(""); }} className="r2chip"
            style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, border: "2px dashed #d6d5d6", background: "transparent", borderRadius: 999, padding: "9px 14px", cursor: "pointer", font: "600 13.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={3} strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
            Adicionar linha
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: INK, borderRadius: 12, padding: "18px 22px" }}>
          <div>
            <div style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d" }}>Total do clichê</div>
            <div style={{ font: "800 32px/1 Inter,sans-serif", letterSpacing: "-.03em", color: "#f1f1f1", marginTop: 8 }}>{brl(total)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={fechar} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "14px 18px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", background: "#3a383a", color: "#f1f1f1" }}>Cancelar</button>
            <button className="r2chip"
              onClick={() => {
                if (!valido) { setAviso("Preencha data, hora e o valor de cada linha."); return; }
                onSalvar({
                  data, hora,
                  itens: linhas.map((l) => ({ descricao: l.descricao.trim(), valor: parseValor(l.valor) })),
                  total,
                  notaNome: notaNome || null,
                  notaBase64, // só quando a nota foi anexada agora
                });
              }}
              style={{ border: 0, borderRadius: 999, padding: "14px 20px", cursor: valido ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", background: valido ? AMARELO : "#4a484a", color: valido ? INK : "#8d8b8d" }}>
              Registrar chegada
            </button>
          </div>
        </div>

        <div style={{ font: "400 13.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>{aviso || "O registro entra no histórico do pedido e alimenta o gasto do mês."}</div>
      </div>
    </div>
  );
}
