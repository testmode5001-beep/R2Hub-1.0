// "Clichê chegou" — Hub 1.0. Abre no "Finalizar" de um pedido que está na
// clicheria: o pedido só fecha depois que o valor do clichê entra.
//
// O miolo é o mesmo da ClicheChegouModalV1a, que funciona e a equipe já
// conhece: solta-se o PDF da ordem de serviço e o hub lê as cores e os
// valores dali. O que muda é a casca — sanfonas, faixa preta e tipografia do
// 1.0, irmã da DesignCriadoHub10 — e o gesto: no V1a era um botão "clichê
// chegou" na tela de Aprovação; aqui é o próprio Finalizar.
//
// Nada trava por causa do PDF: as conferências avisam. Quem está com o clichê
// na mão sabe mais que a nota.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { fileToBase64 } from "@/lib/files";
import { lerNotaClichePdf, pareceOutroCliente, type NotaCliche } from "@/lib/nota-cliche";
import { parseValorBR } from "@/lib/valor";
import { corDoNome, sugestoesPantone } from "../v1a/dados/pantone-busca";
import { linhasIniciais, type RegistroCliche } from "../v1a/modais/ClicheChegouModalV1a";
import { FR, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { PantoneHub10 } from "./PantoneHub10";
import { PALETA } from "@/lib/paleta-hub";

const AMARELO = PALETA.amareloForte;
const ROXO = "#a4a2f0";
const CINZA = "#8a8a8a";
const BORDA_CAMPO = "#d9d8d6";
/* Mesmo teto da caixa de arte, que é o do projeto: um clichê por cor. */
const MAX_CLICHES = 7;

const brl = (n: number) => {
  const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split(".");
  return (n < 0 ? "-" : "") + "R$ " + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d;
};

/** Tira a cor do clichê i e puxa as bolinhas dos seguintes uma casa para trás,
    como na DesignCriadoHub10. Com as cores do pedido já pintadas, tirar o
    primeiro clichê deixava cada bolinha na cor do vizinho (simulação 5,
    05/10/2026). */
const semACor = (h: Record<number, string>, i: number): Record<number, string> =>
  Object.fromEntries(Object.entries(h)
    .filter(([k]) => Number(k) !== i)
    .map(([k, v]) => [Number(k) > i ? Number(k) - 1 : Number(k), v]));

const CAMPO: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#fff",
  border: `1.5px solid ${BORDA_CAMPO}`, borderRadius: 11, padding: "11px 12px",
  font: `600 17px/1.2 ${INTER}`, color: PRETO, outline: "none",
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

/** Avisos da nota: amarelam, não impedem. */
function Aviso({ texto }: { texto: string }) {
  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", gap: 9, background: PALETA.amarelo, border: `1px solid ${PRETO}`, borderRadius: 12, padding: "10px 14px", font: `600 15px/1.4 ${INTER}`, color: PRETO }}>
      <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" style={{ flex: "none", marginTop: 2 }}>
        <path d="M12 4 2.5 20h19z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17" x2="12" y2="17" />
      </svg>
      <span>{texto}</span>
    </div>
  );
}

export function ClicheChegouHub10({ pedido, fechar, onSalvar }: {
  pedido: { num?: string; cliente?: string; cores?: string };
  fechar: () => void;
  /** a caixa espera a promessa: fecha quem chamou, no sucesso; no erro ela
      fica aberta com os valores e a nota */
  onSalvar: (d: RegistroCliche) => Promise<unknown> | void;
}) {
  const p = pedido || {};
  const agora = new Date();
  const [data, setData] = useState(agora.toISOString().slice(0, 10));
  const [hora, setHora] = useState(
    `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`);
  /* Uma linha por clichê. Quando o pedido já tem os NOMES das cores (o que o
     designer confirmou ao entregar a arte), são eles — um por um. Só quando
     vem o campo curto ("4", "CMYK", "4+PANT") é que entra a adivinhação do
     V1a: ela lê "Pantone 485 C" como CMYK+especial, porque enxerga "pant" e
     um "4" no 485. */
  const [linhas, setLinhas] = useState<{ descricao: string; valor: string }[]>(() => {
    const nomes = String(p.cores ?? "").split(/[,;·\n]/).map((s) => s.trim()).filter(Boolean);
    /* Uma cor só com NOME ("Preto") é essa cor, e não "Cor 1": a adivinhação
       fica para o campo curto ("4", "CMYK", "4+PANT"). */
    const ehCodigoCurto = (s: string) => /^\s*(\d+(\s*\+\s*pant\w*)?|cmyk)\s*$/i.test(s);
    const base = nomes.length > 1 || (nomes.length === 1 && !ehCodigoCurto(nomes[0])) ? nomes : linhasIniciais(p.cores);
    return base.map((d) => ({ descricao: d, valor: "" }));
  });
  /* As cores que vêm do pedido já com a amostra, como no Design criado: as
     bolinhas abriam brancas, com o ícone da paleta, e a cor só aparecia
     escolhendo na tabela (simulação 5, 05/10/2026). */
  const [hex, setHex] = useState<Record<number, string>>(() => {
    const h: Record<number, string> = {};
    linhas.forEach((l, i) => { const c = corDoNome(l.descricao); if (c) h[i] = c; });
    return h;
  });
  const [sugIdx, setSugIdx] = useState<number | null>(null);
  const [pantoneIdx, setPantoneIdx] = useState<number | null>(null);
  /* Sanfona, as duas fechadas ao abrir — é o estado inicial do projeto
     (`secao: null`). O que incomodava não era a sanfona: era a caixa encolher
     para caber e, com isso, mudar de LARGURA a cada clique. Sem o ajuste de
     escala ela cresce e diminui só na altura, ancorada no centro. */
  const [secao, setSecao] = useState<null | "nota" | "valores">(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const [nota, setNota] = useState<NotaCliche | null>(null);
  const [notaNome, setNotaNome] = useState("");
  const [notaBase64, setNotaBase64] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  /* o que estava preenchido antes da nota entrar: importar nunca é caminho sem volta */
  const [antesDaNota, setAntesDaNota] = useState<{ linhas: typeof linhas; hex: Record<number, string> } | null>(null);
  const entrada = useRef<HTMLInputElement | null>(null);

  const total = linhas.reduce((s, l) => { const v = parseValorBR(l.valor); return s + (Number.isFinite(v) ? v : 0); }, 0);
  const valido = !!data && !!hora && linhas.length > 0 && !enviando
    && linhas.every((l) => l.descricao.trim() && Number.isFinite(parseValorBR(l.valor)) && parseValorBR(l.valor) >= 0);

  /* Conferências da nota — todas avisam, nenhuma trava. */
  const notaDiverge = !!nota && nota.total !== null && Math.abs(total - nota.total) > 0.005;
  const notaDeOutro = !!nota && pareceOutroCliente(nota, p.cliente);
  const notaSemValores = !!nota && nota.itens.every((i) => i.valor === 0);

  /* ESC fecha só esta caixa — não o painel do pedido atrás dela. */
  useEscDoTopo(true, NIVEL.caixa, fechar);

  const lerNota = async (arquivo: File) => {
    setErro(""); setLendo(true);
    try {
      const lida = await lerNotaClichePdf(arquivo);
      const novas = lida.itens.map((i) => ({ descricao: i.descricao, valor: i.valor.toFixed(2).replace(".", ",") }));
      /* a amostra pelo nome, a mesma conta das cores do pedido e do Design
         criado (simulação 5, 05/10/2026) */
      const cores: Record<number, string> = {};
      novas.forEach((l, i) => { const c = corDoNome(l.descricao); if (c) cores[i] = c; });
      setAntesDaNota({ linhas, hex });
      setLinhas(novas); setHex(cores); setNota(lida);
      setNotaNome(arquivo.name);
      setNotaBase64(await fileToBase64(arquivo));
      setSecao("valores");
    } catch (e) {
      /* Sem ler a tabela, a nota continua ANEXADA: ela é o documento do
         valor. Antes era descartada, o aviso sumia ao abrir os valores e o
         pedido fechava sem ela (simulação 3, 30/09/2026). Os valores entram
         à mão, e o aviso diz isso. */
      setNota(null);
      let guardou = false;
      try {
        setNotaBase64(await fileToBase64(arquivo));
        setNotaNome(arquivo.name);
        guardou = true;
      } catch {
        setNotaNome(""); setNotaBase64(null);
      }
      const motivo = e instanceof Error ? e.message : "Não consegui ler esse PDF.";
      /* A leitura já termina com "Preencha à mão." e o aviso da nota anexada
         repetia a instrução: fica uma só, a que diz o que acontece com a nota
         (simulação 5, 05/10/2026). */
      setErro(guardou
        ? `${motivo.replace(/\s*Preencha[^.]*\.\s*$/i, "")} A nota fica anexada ao pedido; preencha os valores à mão.`.trim()
        : motivo);
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const descartarNota = () => {
    if (antesDaNota) { setLinhas(antesDaNota.linhas); setHex(antesDaNota.hex); setAntesDaNota(null); }
    setNota(null); setNotaNome(""); setNotaBase64(null); setErro("");
  };

  const mudar = (i: number, campo: "descricao" | "valor", v: string) =>
    setLinhas(linhas.map((l, j) => (j === i ? { ...l, [campo]: v } : l)));

  const escolherCor = (i: number, nome: string, cor?: string) => {
    mudar(i, "descricao", nome);
    setHex((h) => (cor ? { ...h, [i]: cor } : Object.fromEntries(Object.entries(h).filter(([k]) => Number(k) !== i))));
  };
  /* A bolinha acompanha o nome digitado, como no Design criado: com a cor do
     pedido já pintada, trocar "Preto" por "P 485 C" deixava a bolinha preta
     (simulação 5, 05/10/2026). */
  const trocarCor = (i: number, v: string) => {
    mudar(i, "descricao", v);
    const c = corDoNome(v);
    setHex((h) => (c ? { ...h, [i]: c } : Object.fromEntries(Object.entries(h).filter(([k]) => Number(k) !== i))));
  };

  const sugestoesDe = (valor: string) => {
    const v = valor.trim();
    if (!v) return [];
    const achados = sugestoesPantone(v, 6);
    return achados.some((s) => s.nome.toLowerCase() === v.toLowerCase()) ? [] : achados;
  };

  /* Ref, não estado: `setEnviando` só vale no render seguinte, e dois
     cliques colados mandavam duas vezes. */
  const emVoo = useRef(false);
  const [erroSalvar, setErroSalvar] = useState("");
  /* A caixa espera o servidor. Antes ela fechava no erro e a pessoa perdia os
     valores digitados e a nota em PDF. */
  const salvar = () => {
    if (!valido || emVoo.current) return;
    emVoo.current = true;
    setEnviando(true);
    setErroSalvar("");
    void Promise.resolve(onSalvar({
      data, hora,
      itens: linhas.map((l) => ({ descricao: l.descricao.trim(), valor: parseValorBR(l.valor) })),
      total,
      notaNome: notaNome || null,
      notaBase64,
    }))
      .catch((e: unknown) => setErroSalvar(e instanceof Error ? e.message : "Não deu para gravar o registro do clichê."))
      .finally(() => { emVoo.current = false; setEnviando(false); });
  };

  const previaNota = notaNome ? (nota ? notaNome : `${notaNome} · valores à mão`) : (lendo ? "lendo o PDF…" : "solte o PDF da clicheria aqui");

  return (
    <div onClick={fechar}
      /* O véu cobre o PALCO INTEIRO (1920×1080), não só a faixa do
         detalhe: estas caixas são filhas do palco, e com 616 sobrava a barra
         do topo e a faixa preta de baixo acesas — e o cartão, centrado em
         616, subia por cima do menu. */
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 68, background: "rgba(37,36,37,.78)" }}>
      {pantoneIdx !== null && (
        <div onClick={(e) => e.stopPropagation()}>
          <PantoneHub10 valor={linhas[pantoneIdx]?.descricao ?? ""}
            fechar={() => setPantoneIdx(null)}
            onEscolher={(nome, cor) => { escolherCor(pantoneIdx, nome, cor); setPantoneIdx(null); }} />
        </div>
      )}

      <div onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 720, maxHeight: 600, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>

        {/* ————— cabeçalho ————— */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "26px 42px 20px", flex: "none" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `700 14px/1.25 ${INTER}`, letterSpacing: ".04em", textTransform: "uppercase", color: CINZA }}>
              {`${p.num ? `${p.num} · ` : ""}${p.cliente ?? ""}`}
            </div>
            <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 44, lineHeight: 1, letterSpacing: "-.035em", marginTop: 10, whiteSpace: "nowrap" }}>Clichê chegou</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ font: `800 12.5px/1 ${INTER}`, letterSpacing: ".12em", textTransform: "uppercase", color: CINZA }}>Chegou em</span>
              {/* O indicador nativo do <input type="date"> fica à DIREITA do
                  campo, então o calendário caía entre a data e a hora, como se
                  fosse do relógio. A classe esconde os dois indicadores e os
                  ícones vêm aqui, cada um à frente do seu campo. */}
              <div className="h10-datahora" style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                    <rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" />
                  </svg>
                  <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data da chegada"
                    style={{ border: "none", background: "none", padding: 0, font: `800 16px/1 ${INTER}`, color: PRETO, outline: "none" }} />
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                    <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15.5 14" />
                  </svg>
                  <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora da chegada"
                    style={{ border: "none", background: "none", padding: 0, font: `800 16px/1 ${INTER}`, color: PRETO, outline: "none" }} />
                </span>
              </div>
            </div>
            <button onClick={fechar} className="p10-flat" aria-label="Fechar"
              style={{ width: 46, height: 46, display: "grid", placeItems: "center", background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* ————— nota da clicheria ————— */}
          <button onClick={() => setSecao(secao === "nota" ? null : "nota")} className="p10-flat"
            style={{ ...FAIXA, background: AMARELO, borderTop: `1.5px solid ${PRETO}` }}>
            <span style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <Chevron aberto={secao === "nota"} />
              <span style={TITULO_FAIXA}>Nota da clicheria</span>
            </span>
            <span style={{ minWidth: 0, font: `600 15.5px/1.3 ${INTER}`, opacity: .75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{previaNota}</span>
          </button>

          {secao === "nota" && (
            <div style={{ padding: "22px 42px 24px" }}>
              <input ref={entrada} type="file" accept="application/pdf,.pdf" style={{ display: "none" }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void lerNota(f); }} />
              <button onClick={() => entrada.current?.click()} className="p10-flat"
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files?.[0]; if (f) void lerNota(f); }}
                style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, background: arrastando ? PALETA.amarelo : "none", border: `1.5px dashed ${PRETO}`, borderRadius: 14, padding: "26px 16px", cursor: "pointer", transition: "background .15s ease" }}>
                <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5.5" /><path d="m8 9.5 4-4 4 4" /><path d="M4.5 16v3.5h15V16" /></svg>
                <span style={{ font: `600 16.5px/1.4 ${INTER}`, textAlign: "center" }}>
                  {lendo ? "Lendo o PDF…" : notaNome || "Solte aqui a ordem de serviço da clicheria (PDF). O hub lê as cores e os valores"}
                </span>
              </button>
              {notaNome && !lendo && (
                <button onClick={descartarNota} className="p10-flat"
                  style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: "pointer", font: `600 15px/1 ${INTER}`, color: CINZA, textDecoration: "underline" }}>
                  Descartar a nota e voltar ao que estava
                </button>
              )}
              {notaDeOutro && <Aviso texto={`A nota parece ser de outro cliente. Confira antes de finalizar o pedido de ${p.cliente ?? "este cliente"}.`} />}
              {notaSemValores && <Aviso texto="A nota veio sem valores. Preencha os clichês à mão na seção abaixo." />}
              {erro && <Aviso texto={erro} />}
            </div>
          )}

          {/* ————— valores por cor ————— */}
          <button onClick={() => setSecao(secao === "valores" ? null : "valores")} className="p10-flat"
            style={{ ...FAIXA, background: ROXO }}>
            <span style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <Chevron aberto={secao === "valores"} />
              <span style={TITULO_FAIXA}>Valor por clichê</span>
            </span>
            <span style={{ font: `800 15px/1 ${INTER}` }}>{linhas.length} {linhas.length === 1 ? "clichê" : "clichês"} · {brl(total)}</span>
          </button>

          {/* Duas colunas e sem rolagem: oito clichês — o teto de cores de uma
              arte — cabem à vista em quatro fileiras. Rolagem dentro de caixa
              esconde o que importa e é para evitar no hub. */}
          {secao === "valores" && (
            <div style={{ minHeight: 0, overflowY: "auto", padding: "20px 42px 22px" }}>
              {notaDiverge && <Aviso texto={`A soma daqui (${brl(total)}) não bate com o total da nota (${brl(nota!.total!)}).`} />}
              {/* a nota que o hub não leu continua anexada; o aviso aparece
                  também aqui, onde os valores são digitados */}
              {notaNome && !nota && !lendo && <Aviso texto="O hub não leu os valores da nota: preencha à mão. A nota vai anexada ao pedido." />}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px", marginTop: notaDiverge || (notaNome && !nota) ? 12 : 0 }}>
                {linhas.map((l, i) => {
                  const sugs = sugIdx === i ? sugestoesDe(l.descricao) : [];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <button onClick={() => setPantoneIdx(i)} title="Tabela Pantone Solid Coated" aria-label={`Tabela Pantone para o clichê ${i + 1}`} className="p10-flat"
                        style={{ flex: "none", width: 38, height: 38, display: "grid", placeItems: "center", border: `1.5px solid ${PRETO}`, background: hex[i] ?? "#fff", borderRadius: 999, cursor: "pointer" }}>
                        {!hex[i] && <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a4 4 0 1 1 0-8h4.5a4.5 4.5 0 0 0 0-5z" /></svg>}
                      </button>
                      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                        <input value={l.descricao} onChange={(e) => trocarCor(i, e.target.value)}
                          onFocus={() => setSugIdx(i)}
                          onBlur={() => setTimeout(() => setSugIdx((a) => (a === i ? null : a)), 120)}
                          placeholder={`Clichê ${i + 1}`} aria-label={`Cor do clichê ${i + 1}`} style={CAMPO} />
                        {sugs.length > 0 && (
                          <div style={{ position: "absolute", left: 0, minWidth: 250, top: "calc(100% + 6px)", zIndex: 8, display: "flex", flexDirection: "column", gap: 2, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 12, padding: 6, boxShadow: "0 22px 44px -18px rgba(0,0,0,.5)" }}>
                            {sugs.map((s) => (
                              <button key={s.codigo} onMouseDown={(e) => { e.preventDefault(); escolherCor(i, s.nome, s.hex); setSugIdx(null); }}
                                style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", border: 0, background: "transparent", borderRadius: 8, padding: "8px 10px", cursor: "pointer", textAlign: "left" }}>
                                <span style={{ flex: "none", width: 20, height: 20, borderRadius: 6, boxShadow: `inset 0 0 0 1.5px ${PRETO}`, background: s.hex }} />
                                <span style={{ flex: 1, font: `600 15px/1 ${INTER}`, whiteSpace: "nowrap" }}>{s.nome}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ position: "relative", flex: "none", width: 104 }}>
                        <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", font: `600 14px/1 ${INTER}`, color: CINZA, pointerEvents: "none" }}>R$</span>
                        <input value={l.valor} onChange={(e) => mudar(i, "valor", e.target.value.replace(/[^\d.,]/g, ""))}
                          inputMode="decimal" placeholder="0,00" aria-label={`Valor do clichê ${i + 1}`}
                          style={{ ...CAMPO, paddingLeft: 34, paddingRight: 10, textAlign: "right" }} />
                      </div>
                      {linhas.length > 1 && (
                        <button onClick={() => { setLinhas(linhas.filter((_, j) => j !== i)); setHex(semACor(hex, i)); }}
                          title="Tirar este clichê" aria-label={`Tirar o clichê ${i + 1}`} className="p10-flat"
                          style={{ flex: "none", width: 30, height: 30, display: "grid", placeItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {linhas.length < MAX_CLICHES && (
                <button onClick={() => setLinhas([...linhas, { descricao: "", valor: "" }])} className="p10-flat"
                  style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, border: `1.5px dashed ${PRETO}`, background: "none", borderRadius: 999, padding: "10px 16px", cursor: "pointer", font: `700 15px/1 ${INTER}`, color: PRETO }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={3} strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                  Adicionar clichê
                </button>
              )}
            </div>
          )}
        </div>

        {erroSalvar && (
          <div role="alert" style={{ flex: "none", padding: "12px 42px", background: PALETA.perigo, color: PALETA.perigoTinta, font: `600 15px/1.4 ${INTER}` }}>{erroSalvar}</div>
        )}

        {/* ————— rodapé ————— */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, padding: "18px 25px", background: PRETO, flex: "none" }}>
          <div style={{ minWidth: 0, font: `600 16px/1.45 ${INTER}`, color: "#c9c8c6", marginLeft: 20 }}>
            {valido || total > 0
              ? `${linhas.length} ${linhas.length === 1 ? "clichê" : "clichês"} · ${brl(total)}`
              : "O pedido fecha com o valor do clichê"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "none" }}>
            <button onClick={fechar} className="p10-flat"
              style={{ border: "1.5px solid #555355", borderRadius: 999, padding: "14px 24px", cursor: "pointer", font: `700 17px/1 ${INTER}`, background: "none", color: "#f1f1f1" }}>Cancelar</button>
            <button onClick={salvar} disabled={!valido}
              style={{ border: `1.5px solid ${valido ? PRETO : "#4a484a"}`, borderRadius: 999, padding: "14px 28px", cursor: valido ? "pointer" : "not-allowed", font: `800 17px/1 ${INTER}`, whiteSpace: "nowrap", background: valido ? AMARELO : "#4a484a", color: valido ? PRETO : CINZA }}>
              {enviando ? "Finalizando…" : "Finalizar pedido"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
