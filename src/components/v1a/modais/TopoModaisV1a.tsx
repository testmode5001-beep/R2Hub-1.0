// Modais do topo — v1a. Fontes: design_handoff_r2_hub/telas/Mensagens-modal,
// Anotacoes-modal, Notificacoes-modal e Config-modal (.dc.html).
// Renderizadas pela TopbarV1a (overlay absolute inset 0 dentro do estágio).
// Conteúdo demo do protótipo; anotações persistem em r2hub.v1a.notas-modal.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { hojeDDMM, ilustDaHome, lerVistas, marcarVista, useHubDados, type IlustHome, type PapelParede } from "../HubDadosV1a";
import { ZoomControleV1a, useZoomPct } from "../ZoomControleV1a";
import {
  definirSom, notificacaoNativaDisponivel, pedirPermissaoNativa, somLigado, tocarBip,
} from "@/lib/aviso-novidade";

/* constantes locais (idênticas às do HubV1a) para evitar import circular —
   a TopbarV1a (HubV1a.tsx) importa estas modais */
const INK = "#252425";
const AMARELO = "#ffe815";
const MONO = "ui-monospace, Menlo, monospace";
const fr = (opsz: number, weight = 700): CSSProperties => ({
  fontFamily: "Fraunces, serif",
  fontVariationSettings: `'SOFT' 100, 'opsz' ${opsz}`,
  fontWeight: weight,
});

const SOMBRA_MODAL = "0 50px 100px -30px rgba(0,0,0,.6)";
const CARD_SOMBRA = "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.25)";

function Overlay({ fechar, children, alinhamento }: { fechar: () => void; children: ReactNode; alinhamento?: "topo-direita" }) {
  const extra: CSSProperties = alinhamento === "topo-direita"
    ? { alignItems: "flex-start", justifyContent: "flex-end", padding: "96px 30px 30px", background: "rgba(37,36,37,.44)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }
    : { alignItems: "center", justifyContent: "center", padding: 36, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" };
  return (
    <div onClick={fechar} className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 61, display: "flex", borderRadius: 14, ...extra }}>
      {children}
    </div>
  );
}

function BotaoFechar({ fechar, tam = 36 }: { fechar: () => void; tam?: number }) {
  return (
    <button onClick={fechar} className="pm-ic" style={{ width: tam, height: tam, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
    </button>
  );
}

/* ── Mensagens ───────────────────────────────────────────────────── */
type Msg = { de: "cliente" | "eu"; texto: string; hora: string };
const CONVERSAS: { nome: string; sub: string; quando: string; nova: boolean; msgs: Msg[] }[] = [
  {
    nome: "Mercado Bom Preço", sub: "Pedido #0412 · Aguardando design", quando: "10:02", nova: true, msgs: [
      { de: "cliente", texto: "Bom dia! Conseguem antecipar a arte para quinta?", hora: "09:41" },
      { de: "eu", texto: "Bom dia! Consigo sim, desde que o Pantone esteja confirmado hoje.", hora: "09:52" },
      { de: "cliente", texto: "Confirmado: 485 C. Envio a logo em curva agora.", hora: "10:02" },
    ],
  },
  {
    nome: "Frigorífico Vale Verde", sub: "Pedido #0413 · Clichê solicitado", quando: "09:20", nova: true, msgs: [
      { de: "cliente", texto: "A faca nova já foi enviada pela fornecedora.", hora: "09:12" },
      { de: "eu", texto: "Recebido. Separo a prova assim que chegar.", hora: "09:20" },
    ],
  },
  {
    nome: "Panificadora Pão Nosso", sub: "Pedido #0415 · Revisão", quando: "ontem", nova: true, msgs: [
      { de: "cliente", texto: "Podem aumentar o corpo da tabela nutricional?", hora: "16:30" },
      { de: "eu", texto: "Aumento para 7 pt e reenvio a prova.", hora: "16:48" },
    ],
  },
  {
    nome: "Supermercado Rossi", sub: "Pedido #0402 · Finalizado", quando: "ontem", nova: true, msgs: [
      { de: "cliente", texto: "Lote aprovado, obrigado pela agilidade!", hora: "14:05" },
    ],
  },
];

const ST_CURTO: Record<string, string> = {
  nova: "Aguardando design", criacao: "Em design", aguardando: "Aguardando aprovação",
  revisao: "Alteração pedida", aprovada: "Arte aprovada", cliche: "Clichê solicitado",
  concluido: "Finalizado", cancelado: "Cancelado",
};
const horaDe = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const hm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return dias === 0 ? hm : dias === 1 ? `ontem ${hm}` : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export function MensagensModalV1a({ fechar }: { fechar: () => void }) {
  const dados = useHubDados();
  const real = Array.isArray(dados.conversas);
  const [ativo, setAtivo] = useState(0);
  const [rascunho, setRascunho] = useState("");
  const [extras, setExtras] = useState<Record<number, Msg[]>>({});
  const [lidas, setLidas] = useState<Record<number, boolean>>({});
  const [vistas, setVistas] = useState<Record<string, string>>(() => (typeof window === "undefined" ? {} : lerVistas()));

  /* Canal geral da equipe: a conversa que não depende de pedido nenhum.
     Fica sempre no topo da lista, como o "corredor" do escritório. */
  const geral = {
    id: "geral",
    nome: "Equipe",
    sub: "canal geral · todo mundo vê",
    quando: horaDe(dados.chatGeral?.[dados.chatGeral.length - 1]?.created_at ?? ""),
    ultimaEm: dados.chatGeral?.[dados.chatGeral.length - 1]?.created_at ?? "",
    deOutro: !!dados.meuId && !!dados.chatGeral?.length
      && dados.chatGeral[dados.chatGeral.length - 1]?.user_id !== dados.meuId,
    msgs: (dados.chatGeral ?? []).map((m) => ({
      de: (dados.meuId && m.user_id === dados.meuId ? "eu" : "cliente") as "eu" | "cliente",
      texto: m.user_nome && m.user_id !== dados.meuId ? `${m.user_nome.split(" ")[0]}: ${m.texto}` : m.texto,
      hora: horaDe(m.created_at),
    })),
  };

  /* Conversas DIRETAS: as mensagens vêm todas juntas e aqui viram uma conversa
     por pessoa. Colega sem histórico também entra (é como se começa). */
  const eu = dados.meuId ?? "";
  const diretas = (() => {
    const porPessoa = new Map<string, { nome: string; msgs: typeof geral.msgs; ultimaEm: string; deOutro: boolean }>();
    (dados.colegas ?? []).forEach((c) => {
      porPessoa.set(c.id, { nome: c.nome, msgs: [], ultimaEm: "", deOutro: false });
    });
    (dados.chatDireto ?? []).forEach((m) => {
      const souAutor = m.user_id === eu;
      const outroId = souAutor ? m.para_id : m.user_id;
      const outroNome = (souAutor ? m.para_nome : m.user_nome) || "Colega";
      if (!outroId) return;
      const atual = porPessoa.get(outroId) ?? { nome: outroNome, msgs: [], ultimaEm: "", deOutro: false };
      atual.nome = atual.nome || outroNome;
      atual.msgs.push({ de: souAutor ? "eu" : "cliente", texto: m.texto, hora: horaDe(m.created_at) });
      atual.ultimaEm = m.created_at;
      atual.deOutro = !souAutor;
      porPessoa.set(outroId, atual);
    });
    return [...porPessoa.entries()]
      .map(([id, v]) => ({
        id: "dm:" + id,
        nome: v.nome,
        sub: v.msgs.length ? "conversa direta" : "conversa direta · sem mensagens ainda",
        quando: horaDe(v.ultimaEm),
        ultimaEm: v.ultimaEm,
        deOutro: v.deOutro,
        msgs: v.msgs,
      }))
      // quem tem conversa aparece primeiro, do mais recente para o mais antigo
      .sort((a, b) => (b.ultimaEm || "").localeCompare(a.ultimaEm || "") || a.nome.localeCompare(b.nome, "pt"));
  })();

  /* Chat é conversa entre PESSOAS: canal da equipe + conversas diretas. Os
     recados de cada pedido moram na modal do pedido (comentário interno) —
     misturar os dois enchia a lista de clientes e escondia a gente. */
  const conversas = real
    ? [geral, ...diretas]
    : CONVERSAS.map((c, j) => ({ ...c, id: String(j), ultimaEm: "", deOutro: c.nova }));

  const idx = Math.min(ativo, Math.max(0, conversas.length - 1));
  const conv = conversas[idx];
  const msgs = conv ? [...conv.msgs, ...(real ? [] : extras[idx] || [])] : [];
  const naoLidas = real
    ? conversas.filter((c) => c.deOutro && (!vistas[c.id] || vistas[c.id] < c.ultimaEm)).length
    : CONVERSAS.filter((c, j) => c.nova && !lidas[j] && j !== idx).length;

  function abrirConversa(j: number) {
    setAtivo(j);
    setLidas((s) => ({ ...s, [j]: true }));
    const c = conversas[j];
    if (real && c) { marcarVista(c.id); setVistas(lerVistas()); }
  }

  function enviar() {
    const t = rascunho.trim();
    if (!t) return;
    setRascunho("");
    if (real) {
      if (!conv) return;
      const envio =
        conv.id === "geral" ? dados.aoEnviarChat?.(t)
        : conv.id.startsWith("dm:") ? dados.aoEnviarDireto?.(conv.id.slice(3), t)
        : dados.aoEnviarMensagem?.(conv.id, t);
      /* se o servidor recusar, a mensagem VOLTA para a caixa — antes ela
         sumia sem aviso nenhum */
      Promise.resolve(envio).catch(() => setRascunho(t));
      return;
    }
    setExtras((s) => ({ ...s, [idx]: [...(s[idx] || []), { de: "eu", texto: t, hora: "agora" }] }));
  }

  return (
    <Overlay fechar={fechar}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 1020, height: 660, display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: SOMBRA_MODAL }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>R2 Hub · conversas</div>
            <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Chat</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".03em", textTransform: "uppercase", padding: "9px 12px", borderRadius: 999, background: AMARELO, color: INK }}>{naoLidas ? `${naoLidas} não lidas` : "tudo lido"}</span>
            <BotaoFechar fechar={fechar} />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: 10, overflow: "auto", boxShadow: CARD_SOMBRA }}>
            {conversas.length === 0 && (
              <div style={{ padding: "40px 12px", textAlign: "center", font: "400 15px/1.45 Inter,sans-serif", color: "#b3b1b3" }}>
                Sem conversa por aqui ainda. O canal da equipe e cada pedido aberto entram nesta lista.
              </div>
            )}
            {conversas.map((c, j) => {
              const on = j === idx;
              const nova = real
                ? c.deOutro && (!vistas[c.id] || vistas[c.id] < c.ultimaEm) && !on
                : (c as any).nova && !lidas[j] && !on;
              return (
                <button key={c.id} onClick={() => abrirConversa(j)} className="pm-row"
                  style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: 0, cursor: "pointer", textAlign: "left", borderRadius: 9, padding: 12, background: on ? "#f1f1f1" : "transparent" }}>
                  <span style={{ flex: "0 0 38px", height: 38, display: "grid", placeItems: "center", borderRadius: 999, font: "800 15px/1 Inter,sans-serif", background: on ? INK : "#f1f1f1", color: on ? AMARELO : INK }}>{c.nome.charAt(0)}</span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ font: "700 15px/1.2 Inter,sans-serif", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</span>
                      <span style={{ font: "500 12.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{c.quando}</span>
                    </span>
                    <span style={{ display: "block", marginTop: 5, font: "400 14.5px/1.3 Inter,sans-serif", color: nova ? INK : "#8d8b8d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.msgs[c.msgs.length - 1]?.texto ?? ""}</span>
                  </span>
                  {nova && <span style={{ flex: "none", width: 8, height: 8, borderRadius: 999, background: AMARELO }} />}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: CARD_SOMBRA }}>
            <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 22px", borderBottom: "1px solid #f1f1f1" }}>
              <div>
                <div style={{ ...fr(48, 700), fontSize: 21, lineHeight: 1, color: INK }}>{conv?.nome ?? "—"}</div>
                <div style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#8d8b8d", marginTop: 6 }}>{conv?.sub ?? "Sem conversa selecionada"}</div>
              </div>
              {conv?.id !== "geral" && !conv?.id.startsWith("dm:") && (
                <button onClick={() => { if (real && conv) dados.aoAbrirPedido?.(conv.id); fechar(); }} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "10px 14px", cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: "#f1f1f1", color: INK }}>Abrir pedido</button>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "20px 22px" }}>
              {msgs.map((m, k) => {
                const meu = m.de === "eu";
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: meu ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "74%", borderRadius: 12, padding: "13px 16px", font: "500 15px/1.45 Inter,sans-serif", background: meu ? INK : "#f1f1f1", color: meu ? "#f1f1f1" : INK }}>{m.texto}</div>
                    <div style={{ marginTop: 5, font: "500 12.5px/1 Inter,sans-serif", color: "#b3b1b3" }}>{m.hora}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ flex: "none", display: "flex", gap: 10, padding: "14px 16px", borderTop: "1px solid #f1f1f1" }}>
              <input value={rascunho} onChange={(e) => setRascunho(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") enviar(); }}
                placeholder="Escreva uma mensagem…"
                style={{ flex: 1, background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 7, padding: "13px 15px", font: "500 15px/1 Inter,sans-serif", color: INK, outline: "none" }} />
              <button onClick={enviar} className="r2chip"
                style={{ flex: "none", display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 7, padding: "0 20px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", background: INK, color: AMARELO }}>
                Enviar
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

/* ── Anotações ───────────────────────────────────────────────────── */
type Nota = { id?: string; texto: string; quando: string; feito: boolean };
const NOTAS_BASE: Nota[] = [
  { texto: "Confirmar cor Pantone 485 com o cliente Bom Preço", quando: "hoje 09:12", feito: false },
  { texto: "Faca nova do Vale Verde chega quinta — separar prova", quando: "hoje 08:40", feito: false },
  { texto: "Rossi pediu 2 mm a mais de sangria no próximo lote", quando: "ontem", feito: false },
  { texto: "Cobrar clichê do Pão Nosso na fornecedora", quando: "ontem", feito: true },
  { texto: "Revisar tabela nutricional das Conservas Dona Ivone", quando: "24/07", feito: false },
  { texto: "Arquivar provas aprovadas de junho", quando: "22/07", feito: true },
];
const CH_NOTAS = "r2hub.v1a.notas-modal";

function lerNotas(): Nota[] {
  if (typeof window === "undefined") return NOTAS_BASE.map((n) => ({ ...n }));
  try {
    const cru = localStorage.getItem(CH_NOTAS);
    if (cru) {
      const v = JSON.parse(cru);
      if (Array.isArray(v)) return v;
    }
  } catch { /* corrompido → base */ }
  return NOTAS_BASE.map((n) => ({ ...n }));
}
const gravarNotas = (v: Nota[]) => { try { localStorage.setItem(CH_NOTAS, JSON.stringify(v)); } catch { /* indisponível */ } };

export function AnotacoesModalV1a({ fechar }: { fechar: () => void }) {
  const dados = useHubDados();
  const real = Array.isArray(dados.notas);
  const [locais, setLocais] = useState<Nota[]>(lerNotas);
  const [nova, setNova] = useState("");
  const [filtro, setFiltro] = useState<"abertas" | "concluidas" | "todas">("abertas");

  // No modo real a lista vem do servidor (ids reais); no demo, do localStorage.
  const itens: Nota[] = real
    ? dados.notas!.map((n) => ({ id: n.id, texto: n.texto, quando: n.quando ?? "", feito: n.feito }))
    : locais;

  const mudar = (novos: Nota[]) => { if (!real) { setLocais(novos); gravarNotas(novos); } };
  const abertas = itens.filter((a) => !a.feito).length;
  const visiveis = itens
    .map((a, i) => ({ ...a, i }))
    .filter((a) => filtro === "todas" || (filtro === "abertas" ? !a.feito : a.feito));

  function add() {
    const t = nova.trim();
    if (!t) return;
    if (real) { dados.aoCriarNota?.(t, hojeDDMM()); setNova(""); return; }
    mudar([{ texto: t, quando: "agora", feito: false }, ...itens]);
    setNova("");
  }

  const alternar = (a: Nota & { i: number }) => {
    if (real) { dados.aoAlternarNota?.(a.id!, !a.feito); return; }
    mudar(itens.map((x, k) => (k === a.i ? { ...x, feito: !x.feito } : x)));
  };
  const remover = (a: Nota & { i: number }) => {
    if (real) { dados.aoExcluirNota?.(a.id!); return; }
    mudar(itens.filter((_, k) => k !== a.i));
  };
  const limpar = () => {
    if (real) { dados.aoLimparNotas?.(); return; }
    mudar(itens.filter((a) => !a.feito));
  };

  return (
    <Overlay fechar={fechar}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 820, maxHeight: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: SOMBRA_MODAL }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>R2 Hub · lembretes da equipe</div>
            <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Anotações</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".03em", textTransform: "uppercase", padding: "9px 12px", borderRadius: 999, background: AMARELO, color: INK }}>{abertas} abertas</span>
            <BotaoFechar fechar={fechar} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <input value={nova} onChange={(e) => setNova(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="Nova anotação — ex.: cobrar clichê do Pão Nosso"
            style={{ flex: 1, background: "#fff", border: "2px solid #fff", borderRadius: 9, padding: "15px 17px", font: "500 15px/1 Inter,sans-serif", color: INK, outline: "none" }} />
          <button onClick={add} className="r2chip"
            style={{ flex: "none", display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 9, padding: "0 22px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", background: AMARELO, color: INK }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.75} strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
            Adicionar
          </button>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {([["abertas", "Abertas"], ["concluidas", "Concluídas"], ["todas", "Todas"]] as const).map(([k, label]) => {
            const on = filtro === k;
            return (
              <button key={k} onClick={() => setFiltro(k)} className="r2chip"
                style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 15px", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: on ? INK : "#fff", color: on ? AMARELO : "#8d8b8d" }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: "8px 20px", maxHeight: 380, overflow: "auto", boxShadow: CARD_SOMBRA }}>
          {visiveis.map((a, j) => (
            <div key={a.id ?? a.i} className="pm-row" style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 56, padding: "8px 4px", borderBottom: j === visiveis.length - 1 ? 0 : "1px solid #f1f1f1" }}>
              <button onClick={() => alternar(a)}
                style={{ flex: "0 0 24px", height: 24, display: "grid", placeItems: "center", border: 0, cursor: "pointer", borderRadius: 5, background: a.feito ? INK : "#f1f1f1" }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={a.feito ? AMARELO : "#d6d5d6"} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
              </button>
              <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.35 Inter,sans-serif", color: a.feito ? "#b3b1b3" : INK, textDecoration: a.feito ? "line-through" : undefined }}>{a.texto}</span>
              <span style={{ font: "500 13.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{a.quando}</span>
              <button onClick={() => remover(a)} title="Remover" className="pm-ic"
                style={{ flex: "none", width: 30, height: 30, display: "grid", placeItems: "center", background: "#f1f1f1", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.8} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
          ))}
          {visiveis.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", font: "400 15px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>Nada por aqui com esse filtro.</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{itens.length} anotações · {abertas} em aberto</span>
          <button onClick={limpar} className="r2chip"
            style={{ border: 0, borderRadius: 999, padding: "11px 16px", cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: INK, color: AMARELO }}>
            Limpar concluídas
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ── Notificações ────────────────────────────────────────────────── */
const NOTIF_TIPOS: Record<string, { path: string; box: string; color: string }> = {
  arte: { path: "M12 3 3 8l9 5 9-5-9-5z", box: "#ffe815", color: "#252425" },
  prazo: { path: "M12 7v5.5l3.5 2", box: "#252425", color: "#ffe815" },
  msg: { path: "M4 6.5h16v11H8l-4 3z", box: "#f1f1f1", color: "#252425" },
  ok: { path: "m5 12.5 4.5 4.5L19 7", box: "#f1f1f1", color: "#252425" },
};
const NOTIFICACOES = [
  { tipo: "prazo", titulo: "Pedido #0415 atrasado", detalhe: "Panificadora Pão Nosso está há 8 dias sem movimento.", quando: "10:14", nova: true },
  { tipo: "arte", titulo: "Clichê recebido", detalhe: "Vale Verde · clichê 100x70 conferido na entrada.", quando: "09:37", nova: true },
  { tipo: "msg", titulo: "Nova mensagem do Bom Preço", detalhe: "Pantone 485 C confirmado pelo cliente.", quando: "09:20", nova: true },
  { tipo: "ok", titulo: "Arte aprovada", detalhe: "Distribuidora Cepa Sul aprovou a prova v2.", quando: "ontem", nova: false },
  { tipo: "arte", titulo: "Faca nova cadastrada", detalhe: "Faca 90x60 do Moinho Três Rios entrou no acervo.", quando: "ontem", nova: false },
  { tipo: "ok", titulo: "Lote finalizado", detalhe: "Temperos Vila Rica · 60x40 BOPP prata concluído.", quando: "2 dias", nova: false },
];

/** Título → ícone do protótipo (o backend não guarda tipo). */
function tipoPorTitulo(t: string) {
  const s = t.toLowerCase();
  if (/mensagem|comentário/.test(s)) return "msg";
  if (/atras|prazo/.test(s)) return "prazo";
  if (/aprovad|conclu|finaliz/.test(s)) return "ok";
  return "arte";
}
const relativo = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (dias === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dias === 1) return "ontem";
  return `${dias} dias`;
};

export function NotificacoesModalV1a({ fechar }: { fechar: () => void }) {
  const dados = useHubDados();
  const real = Array.isArray(dados.notificacoes);
  const itens = real
    ? dados.notificacoes!.map((n) => ({
      id: n.id,
      tipo: tipoPorTitulo(n.titulo),
      titulo: n.titulo,
      detalhe: n.corpo ?? "",
      quando: relativo(n.created_at),
      nova: !n.lida,
      url: n.url ?? null,
    }))
    : NOTIFICACOES.map((n) => ({ ...n, id: n.titulo, url: null as string | null }));

  const [lidasDemo, setLidasDemo] = useState(NOTIFICACOES.map((n) => !n.nova));
  const lidas = real ? itens.map((n) => !n.nova) : lidasDemo;
  const naoLidas = lidas.filter((l) => !l).length;
  const marcar = (i: number) => {
    if (real) { const it = itens[i]; if (!lidas[i]) dados.aoMarcarNotificacoes?.([it.id]); return; }
    setLidasDemo(lidasDemo.map((l, j) => (j === i ? true : l)));
  };
  /* Clicar marca como lida e, se a notificação apontar para algum lugar do
     hub, leva até lá (as antigas apontam para rotas que já saíram do ar). */
  const abrir = (i: number) => {
    marcar(i);
    const destino = itens[i].url;
    if (real && destino && dados.aoAbrirNotificacao) { dados.aoAbrirNotificacao(destino); fechar(); }
  };
  const marcarTudo = () => {
    if (real) { dados.aoMarcarNotificacoes?.(); return; }
    setLidasDemo(NOTIFICACOES.map(() => true));
  };

  return (
    <Overlay fechar={fechar} alinhamento="topo-direita">
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 480, maxHeight: "100%", display: "flex", flexDirection: "column", background: "#f1f1f1", borderRadius: 14, padding: 22, boxShadow: SOMBRA_MODAL }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Últimas 24 h</div>
            <div style={{ ...fr(72, 700), fontSize: 28, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 8 }}>Notificações</div>
          </div>
          <BotaoFechar fechar={fechar} tam={34} />
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: "6px 18px", maxHeight: 420, overflow: "auto", boxShadow: CARD_SOMBRA }}>
          {itens.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", font: "400 15px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>Nenhuma notificação por enquanto.</div>
          )}
          {itens.map((nt, i) => {
            const t = NOTIF_TIPOS[nt.tipo] ?? NOTIF_TIPOS.arte;
            const lida = lidas[i];
            return (
              <button key={nt.id ?? nt.titulo} onClick={() => abrir(i)} className="pm-row"
                style={{ display: "flex", alignItems: "flex-start", gap: 13, width: "100%", border: 0, cursor: "pointer", background: "transparent", padding: "15px 2px", borderBottom: i === itens.length - 1 ? 0 : "1px solid #f1f1f1" }}>
                <span style={{ flex: "0 0 36px", height: 36, display: "grid", placeItems: "center", borderRadius: 8, background: t.box }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d={t.path} /></svg>
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span style={{ display: "block", font: `${lida ? 600 : 800} 14px/1.2 Inter,sans-serif`, color: lida ? "#8d8b8d" : INK }}>{nt.titulo}</span>
                  <span style={{ display: "block", marginTop: 4, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>{nt.detalhe}</span>
                </span>
                <span style={{ font: "500 12.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{nt.quando}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14 }}>
          <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{naoLidas ? `${naoLidas} não lidas` : "Tudo em dia"}</span>
          <button onClick={marcarTudo} className="r2chip"
            style={{ border: 0, borderRadius: 999, padding: "11px 16px", cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: INK, color: AMARELO }}>
            Marcar tudo como lido
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ── Preferências (Config) ───────────────────────────────────────── */
/* Cada opção aqui tem efeito REAL — a de "avisos por e-mail" do protótipo
   saiu porque os usuários não têm e-mail cadastrado (não tinha como valer). */
const OPCOES = [
  /* "Alerta de atraso no topo" saiu junto com a faixa/pílula da Central: o
     atraso já aparece no cabeçalho de Em aberto e em cada card. Interruptor
     que não muda nada na tela é pior que interruptor nenhum. */
  { k: "som", titulo: "Som ao chegar mensagem", detalhe: "Toque curto quando chegar mensagem nova no Chat.", on: true },
  { k: "compacto", titulo: "Modo compacto das listas", detalhe: "Linhas mais baixas para caber mais pedidos na tela.", on: false },
  { k: "auto", titulo: "Abrir o último pedido ao entrar", detalhe: "Reabre o pedido que você estava vendo na sessão anterior.", on: false },
];
export const TELAS_INICIO = ["Home", "Central", "Pedidos", "Facas", "Aprovação", "Apontamentos"];
export const PREFS_PADRAO: Record<string, boolean | string> = {
  ...OPCOES.reduce((a, o) => ({ ...a, [o.k]: o.on }), {}),
  telaInicial: "Home",
};

export function ConfigModalV1a({ nome, fechar }: { nome: string; fechar: () => void }) {
  const dadosPrefs = useHubDados();
  /* ilustração da Home 1.0 — grava direto, sem passar pelo "Salvar": é
     escolha visual, o efeito aparece na hora e não tem nada a confirmar.
     O cargo vem do contexto: passá-lo como prop obrigaria a mexer nas 17
     telas que montam a Topbar, para um dado que o provider já tem. */
  const ilustAtual = ilustDaHome(dadosPrefs.prefs, dadosPrefs.meuPapel);
  const [ilustErro, setIlustErro] = useState("");
  const lerVals = (p?: Record<string, boolean | string>) =>
    OPCOES.reduce((a, o) => ({ ...a, [o.k]: typeof p?.[o.k] === "boolean" ? (p[o.k] as boolean) : o.on }), {} as Record<string, boolean>);
  const [vals, setVals] = useState<Record<string, boolean>>(() => lerVals(dadosPrefs.prefs));
  const [telaInicial, setTelaInicial] = useState(() => String(dadosPrefs.prefs?.telaInicial || "Home"));
  const [salvo, setSalvo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [mexi, setMexi] = useState(false);
  /* a modal pode abrir antes de as preferências chegarem do servidor */
  useEffect(() => {
    if (mexi || !dadosPrefs.prefs) return;
    setVals(lerVals(dadosPrefs.prefs));
    setTelaInicial(String(dadosPrefs.prefs.telaInicial || "Home"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dadosPrefs.prefs, mexi]);

  function salvarPrefs() {
    if (!dadosPrefs.aoSalvarPrefs) { setSalvo(true); return; }
    setSalvando(true);
    setErroSalvar("");
    /* espalha o que já está gravado: o objeto salvo SUBSTITUI o anterior, e
       mandar só o que esta modal conhece apagaria preferência de outra tela
       (a ordem das colunas de Pedidos, por exemplo) */
    Promise.resolve(dadosPrefs.aoSalvarPrefs({ ...dadosPrefs.prefs, ...vals, telaInicial }))
      .then(() => setSalvo(true))
      .catch((e: unknown) => setErroSalvar(e instanceof Error ? e.message : "Não deu para salvar."))
      .finally(() => setSalvando(false));
  }
  const ligados = Object.values(vals).filter(Boolean).length;
  /* tamanho na tela — preferência da MÁQUINA, não da conta */
  const [zoomPct] = useZoomPct();
  /* bip de pedido novo/alterado — também da máquina (a da produção quer ouvir) */
  const [som, setSom] = useState(true);
  useEffect(() => { setSom(somLigado()); }, []);
  /* aviso na bandeja do Windows — só existe com o hub aberto pelo endereço
     https (hub.r2etiquetas.com.br) */
  const [permNativa, setPermNativa] = useState<NotificationPermission | "indisponivel">("indisponivel");
  useEffect(() => {
    if (notificacaoNativaDisponivel()) setPermNativa(Notification.permission);
  }, []);

  /* Papel de parede: o acervo mora no share, então só busca quando abre a modal. */
  const dados = useHubDados();
  const [papeis, setPapeis] = useState<PapelParede[] | null>(null);
  const [papelAtual, setPapelAtual] = useState(dados.papelNome || "");
  const [papelErro, setPapelErro] = useState("");
  const [trocando, setTrocando] = useState("");
  const [enviandoPapel, setEnviandoPapel] = useState(false);
  const arquivoPapelRef = useRef<HTMLInputElement | null>(null);

  /* cadastrar colega do próprio setor (usuarios.criar_departamento) */
  const [colegaNome, setColegaNome] = useState("");
  const [colegaLogin, setColegaLogin] = useState("");
  const [colegaSenha, setColegaSenha] = useState("");
  const [colegaAviso, setColegaAviso] = useState("");
  const [colegaOcupado, setColegaOcupado] = useState(false);
  const colegaValido = colegaNome.trim().length >= 2
    && /^[a-z0-9._-]{3,40}$/.test(colegaLogin.trim()) && colegaSenha.length >= 6;

  /** Lê o arquivo escolhido, sobe para o acervo e já aplica para quem enviou. */
  async function enviarPapel(lista: FileList | null) {
    const arquivo = lista?.[0];
    if (!arquivo || !dados.aoEnviarPapel) return;
    setEnviandoPapel(true);
    setPapelErro("");
    try {
      const base64 = await new Promise<string>((ok, erro) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(",")[1] ?? "");
        r.onerror = () => erro(new Error("Não deu para ler o arquivo."));
        r.readAsDataURL(arquivo);
      });
      const novo = await dados.aoEnviarPapel(arquivo.name, base64);
      setPapeis((l) => {
        const sem = (l ?? []).filter((p) => p.nome !== novo.nome);
        return [...sem, novo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      });
      trocarPapel(novo.nome);   // quem enviou já fica com ele
    } catch (e: unknown) {
      setPapelErro(e instanceof Error ? e.message : "Não deu para enviar o arquivo.");
    } finally {
      setEnviandoPapel(false);
    }
  }
  const podePapel = !!dados.podeTrocarPapel && !!dados.aoListarPapeis && !!dados.aoTrocarPapel;

  // a modal pode abrir antes de a configuração chegar — segue o valor real
  useEffect(() => { setPapelAtual(dados.papelNome || ""); }, [dados.papelNome]);

  useEffect(() => {
    if (!podePapel) return;
    let vivo = true;
    dados.aoListarPapeis!()
      .then((l) => { if (vivo) setPapeis(l); })
      .catch((e: unknown) => { if (vivo) { setPapeis([]); setPapelErro(e instanceof Error ? e.message : "Não deu para ler o acervo."); } });
    return () => { vivo = false; };
  }, [podePapel]);

  const trocarPapel = (nomeArquivo: string) => {
    if (!dados.aoTrocarPapel || trocando) return;
    setTrocando(nomeArquivo || "(nenhum)");
    setPapelErro("");
    Promise.resolve(dados.aoTrocarPapel(nomeArquivo))
      .then(() => setPapelAtual(nomeArquivo))
      .catch((e: unknown) => setPapelErro(e instanceof Error ? e.message : "Não deu para aplicar."))
      .finally(() => setTrocando(""));
  };

  /* Escolher a ilustração TIRA o papel de parede. As duas ocupam o mesmo lugar
     na Home, então são uma escolha só: sem isto, clicar em Vendas ou Design
     com papel aplicado não mudava nada na tela, e a única saída era passar por
     "Sem papel de parede" antes — um beco sem saída que só quem descobria o
     truque escapava. */
  const escolherIlust = (v: IlustHome) => {
    setIlustErro("");
    if (papelAtual) trocarPapel("");
    if (!dadosPrefs.aoSalvarPrefs) return;
    void Promise.resolve(dadosPrefs.aoSalvarPrefs({ ...dadosPrefs.prefs, homeIlustracao: v }))
      .catch((e: unknown) => setIlustErro(e instanceof Error ? e.message : "Não deu para guardar a escolha."));
  };

  return (
    <Overlay fechar={fechar}>
      {/* Mais larga e com o corpo em 2 colunas que ROLA por dentro: com os
          cards novos (cadastro de colega, avisos, papel de parede) a coluna
          única de 760px estourava a altura em tela pequena e quebrava. */}
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1500px, 96%)", maxHeight: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: SOMBRA_MODAL }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div>
            <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{nome} · administrador</div>
            <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Preferências</div>
          </div>
          <BotaoFechar fechar={fechar} />
        </div>

        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14, alignItems: "start", paddingRight: 2 }}>

        <div style={{ background: "#fff", borderRadius: 12, padding: "8px 22px", boxShadow: CARD_SOMBRA }}>
          {OPCOES.map((o, i) => {
            const on = vals[o.k];
            return (
              <button key={o.k} onClick={() => { setVals({ ...vals, [o.k]: !on }); setSalvo(false); setMexi(true); }} className="pm-row"
                style={{ display: "flex", alignItems: "center", gap: 20, width: "100%", border: 0, cursor: "pointer", background: "transparent", padding: "17px 4px", borderBottom: i === OPCOES.length - 1 ? 0 : "1px solid #f1f1f1" }}>
                <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <span style={{ display: "block", font: "700 15px/1.2 Inter,sans-serif", color: INK }}>{o.titulo}</span>
                  <span style={{ display: "block", marginTop: 5, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>{o.detalhe}</span>
                </span>
                <span style={{ flex: "none", position: "relative", width: 52, height: 30, borderRadius: 999, transition: "background .16s ease", background: on ? INK : "#e0e0e0" }}>
                  <span style={{ position: "absolute", top: 4, left: on ? 26 : 4, width: 22, height: 22, borderRadius: 999, transition: "left .16s ease", background: on ? AMARELO : "#fff" }} />
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: CARD_SOMBRA }}>
          <div style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", marginBottom: 14 }}>Tela inicial ao entrar</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {TELAS_INICIO.map((t) => {
              const on = telaInicial === t;
              return (
                <button key={t} onClick={() => { setTelaInicial(t); setSalvo(false); setMexi(true); }} className="r2chip"
                  style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "11px 17px", font: "700 14.5px/1 Inter,sans-serif", background: on ? INK : "#f1f1f1", color: on ? AMARELO : INK }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tamanho na tela: vale para ESTE computador (monitor pequeno pede
            fonte maior; o palco cresce e a página passa a rolar). */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: CARD_SOMBRA }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Tamanho na tela</span>
            <span style={{ flex: 1, font: "400 13.5px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>
              vale para este computador · em monitor menor, aumente para ler melhor
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, background: "#f1f1f1", borderRadius: 10, padding: 8 }}>
            <ZoomControleV1a />
            <span style={{ flex: 1, font: "400 13.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>
              {zoomPct === 100
                ? "100% é o texto no tamanho de projeto."
                : zoomPct < 100
                  ? "Abaixo de 100% cabe mais coisa na tela, com o texto menor."
                  : "Acima de 100% o texto cresce e a tela rola."}
              {" "}O mesmo controle fica na barra do topo.
            </span>
          </div>
          <p style={{ font: "400 13.5px/1.45 Inter,sans-serif", color: "#8d8b8d", margin: "10px 0 0" }}>
            Clicar na porcentagem ajusta para o tamanho em que tudo cabe sem rolar.
          </p>
        </div>

        {/* Aviso sonoro: para quem está com o hub minimizado ou de costas. */}
        <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: CARD_SOMBRA }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Aviso de pedido novo</span>
            <span style={{ flex: 1, font: "400 13.5px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>
              vale para este computador
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
            <button onClick={() => { const novo = !som; setSom(novo); definirSom(novo); if (novo) tocarBip(); }}
              className="r2chip"
              style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, border: 0, borderRadius: 999, padding: "11px 16px", cursor: "pointer", font: "700 14px/1 Inter,sans-serif", background: som ? AMARELO : "#f1f1f1", color: som ? INK : "#8d8b8d" }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: som ? INK : "#d6d5d6" }} />
              {som ? "Som ligado" : "Som desligado"}
            </button>
            <span style={{ flex: 1, font: "400 13.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>
              Pedido novo ou que mudou de etapa dá um bip e faz o título e o ícone
              da aba piscarem, mesmo com o hub minimizado.
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            {permNativa === "indisponivel" ? (
              <span style={{ font: "400 13.5px/1.45 Inter,sans-serif", color: "#b3b1b3" }}>
                Aviso na bandeja do Windows: abra o hub por <strong style={{ color: "#5c5a5c" }}>https://192.168.0.145</strong> (com o certificado instalado) para ativar.
              </span>
            ) : permNativa === "granted" ? (
              <span style={{ font: "600 13.5px/1.45 Inter,sans-serif", color: "#5c5a5c" }}>
                ✓ Avisos na bandeja do Windows ativados neste navegador.
              </span>
            ) : (
              <>
                <button onClick={() => { void pedirPermissaoNativa().then(setPermNativa); }}
                  className="r2chip"
                  style={{ flex: "none", border: 0, borderRadius: 999, padding: "11px 16px", cursor: "pointer", font: "700 14px/1 Inter,sans-serif", background: INK, color: AMARELO }}>
                  Ativar avisos do Windows
                </button>
                <span style={{ flex: 1, font: "400 13.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>
                  {permNativa === "denied"
                    ? "O navegador bloqueou — libere as notificações deste site no cadeado da barra de endereço."
                    : "Mostra o aviso na bandeja do Windows mesmo com o navegador minimizado."}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Cadastrar colega do próprio setor — só para quem tem a permissão
            restrita (quem tem a Equipe completa faz por lá). */}
        {!!dados.aoCriarColega && (
          <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: CARD_SOMBRA }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
              <span style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Cadastrar colega</span>
              <span style={{ flex: 1, font: "400 13.5px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>
                a conta nasce com o acesso de {dados.meuCargoLabel || "seu departamento"} · a senha é provisória (a pessoa cria a dela no primeiro acesso)
              </span>
            </div>
            <p style={{ font: "400 13px/1.45 Inter,sans-serif", color: "#8d8b8d", margin: "0 0 4px" }}>
              Quem você cadastrar <strong style={{ color: INK }}>não recebe este poder de cadastrar</strong> — só o gestor multiplica acessos.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: 8, marginTop: 12 }}>
              <input value={colegaNome} onChange={(e) => setColegaNome(e.target.value)} placeholder="Nome completo"
                style={{ background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 8, padding: "11px 13px", font: "600 14.5px/1 Inter,sans-serif", color: INK, outline: "none" }} />
              <input value={colegaLogin} onChange={(e) => setColegaLogin(e.target.value.toLowerCase())} placeholder="login (ex.: ana.paula)"
                autoCapitalize="none" autoCorrect="off"
                style={{ background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 8, padding: "11px 13px", font: "600 14.5px/1 Inter,sans-serif", color: INK, outline: "none" }} />
              <input value={colegaSenha} onChange={(e) => setColegaSenha(e.target.value)} placeholder="senha provisória (6+)"
                style={{ background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 8, padding: "11px 13px", font: "600 14.5px/1 Inter,sans-serif", color: INK, outline: "none" }} />
              <button
                onClick={() => {
                  if (!colegaValido || colegaOcupado) return;
                  setColegaOcupado(true);
                  setColegaAviso("");
                  dados.aoCriarColega!({ nome: colegaNome.trim(), username: colegaLogin.trim(), senha: colegaSenha })
                    .then(() => { setColegaAviso(`Conta de ${colegaNome.trim().split(" ")[0]} criada — repasse o login e a senha provisória.`); setColegaNome(""); setColegaLogin(""); setColegaSenha(""); })
                    .catch((e: unknown) => setColegaAviso(e instanceof Error ? e.message : "Não deu para criar a conta."))
                    .finally(() => setColegaOcupado(false));
                }}
                disabled={!colegaValido || colegaOcupado}
                className="r2chip"
                style={{ border: 0, borderRadius: 8, padding: "0 18px", cursor: colegaValido && !colegaOcupado ? "pointer" : "not-allowed", font: "700 14px/1 Inter,sans-serif", background: colegaValido ? AMARELO : "#f1f1f1", color: colegaValido ? INK : "#b3b1b3", whiteSpace: "nowrap" }}>
                {colegaOcupado ? "Criando…" : "Criar conta"}
              </button>
            </div>
            {colegaAviso && (
              <p style={{ font: "600 13.5px/1.4 Inter,sans-serif", color: colegaAviso.startsWith("Conta de") ? "#2e7d32" : "#c0392b", margin: "10px 0 0" }}>{colegaAviso}</p>
            )}
          </div>
        )}

        {/* Ilustração da Home 1.0 — mora aqui junto do papel de parede porque
            as duas são a mesma pergunta: como a sua Home se parece. Não tem
            permissão: é escolha de cada um, guardada nas prefs. */}
        <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: CARD_SOMBRA }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
            <span style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Ilustração da Home</span>
            <span style={{ flex: 1, font: "400 13.5px/1.4 Inter,sans-serif", color: ilustErro ? "#c0392b" : "#b3b1b3" }}>
              {ilustErro || (papelAtual
                ? "escolher uma tira o papel de parede"
                : "o desenho grande da tela inicial — vale só para você")}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {(["Vendas", "Design"] as const).map((v) => {
              /* com papel aplicado nenhuma das duas está no ar — marcar uma
                 delas diria que aquele desenho aparece, e não aparece */
              const on = !papelAtual && ilustAtual === v;
              return (
                <button key={v} onClick={() => escolherIlust(v)} disabled={!!trocando}
                  style={{ flex: "0 0 190px", border: `2px solid ${on ? INK : "#e3e3e3"}`, borderRadius: 14, background: "#fff", cursor: trocando ? "wait" : "pointer", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", textAlign: "left" }}>
                  <div style={{ height: 96, background: "#f1f1f1", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={v === "Vendas" ? "/home10/home-vendas.svg" : "/home10/home-design.svg"} alt="" style={{ width: "150%", maxWidth: "none" }} />
                  </div>
                  <span style={{ padding: "10px 12px", font: `${on ? 800 : 600} 14.5px/1 Inter,sans-serif`, color: INK }}>{v}</span>
                </button>
              );
            })}
          </div>
        </div>

        {podePapel && (
          <div style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: CARD_SOMBRA }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
              <span style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Papel de parede</span>
              <span style={{ flex: 1, font: "400 13.5px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>
                {papelErro || "escolha sua: entra no lugar da ilustração da Home, e não muda a de ninguém"}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12, maxHeight: 148, overflow: "auto" }}>
              <button onClick={() => trocarPapel("")} className="r2chip" disabled={!!trocando}
                style={{ border: 0, cursor: trocando ? "wait" : "pointer", borderRadius: 999, padding: "11px 17px", font: "700 14.5px/1 Inter,sans-serif", background: papelAtual ? "#f1f1f1" : INK, color: papelAtual ? INK : AMARELO }}>
                Sem papel de parede
              </button>
              {(papeis ?? []).map((p) => {
                const on = papelAtual === p.nome;
                return (
                  <button key={p.nome} onClick={() => trocarPapel(p.nome)} className="r2chip" disabled={!!trocando}
                    title={`${p.tipo === "video" ? "Vídeo" : "Imagem"} · ${p.tamanhoMB} MB`}
                    style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 300, border: 0, cursor: trocando ? "wait" : "pointer", borderRadius: 999, padding: "11px 17px", font: "700 14.5px/1 Inter,sans-serif", background: on ? INK : "#f1f1f1", color: on ? AMARELO : INK }}>
                    <span style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: p.tipo === "video" ? AMARELO : "#8d8b8d" }} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</span>
                  </button>
                );
              })}
              {papeis === null && <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#b3b1b3", padding: "11px 4px" }}>lendo o acervo…</span>}
              {papeis?.length === 0 && !papelErro && (
                <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#b3b1b3", padding: "11px 4px" }}>
                  Nenhuma mídia no acervo ainda — envie a primeira aqui embaixo.
                </span>
              )}
            </div>
            {/* enviar um papel novo: cai no acervo compartilhado e aparece
                para todo mundo; quem envia já fica com ele aplicado */}
            {!!dados.aoEnviarPapel && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid #f1f1f1" }}>
                <input ref={arquivoPapelRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" style={{ display: "none" }}
                  onChange={(e) => { void enviarPapel(e.target.files); e.target.value = ""; }} />
                <button onClick={() => arquivoPapelRef.current?.click()} disabled={enviandoPapel} className="r2chip"
                  style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, border: "2px dashed #d6d5d6", background: "transparent", borderRadius: 999, padding: "10px 16px", cursor: enviandoPapel ? "wait" : "pointer", font: "700 14px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5.5" /><path d="m8 9.5 4-4 4 4" /><path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" /></svg>
                  {enviandoPapel ? "Enviando…" : "Adicionar papel de parede"}
                </button>
                <span style={{ flex: 1, font: "400 13px/1.4 Inter,sans-serif", color: "#b3b1b3" }}>
                  Imagem (JPG/PNG/WebP, até 25 MB) ou vídeo (MP4/WebM, até 150 MB). Vai para o acervo e todos podem usar.
                </span>
              </div>
            )}
          </div>
        )}

        </div>

        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: erroSalvar ? "#c0392b" : "#8d8b8d" }}>
            {erroSalvar || (salvo ? "Preferências salvas." : `${ligados} de ${OPCOES.length} opções ligadas · inicia em ${telaInicial}`)}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={fechar} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "13px 20px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", background: "#fff", color: INK }}>Cancelar</button>
            <button onClick={salvarPrefs} disabled={salvando} className="r2chip" style={{ border: 0, borderRadius: 999, padding: "13px 22px", cursor: salvando ? "wait" : "pointer", opacity: salvando ? 0.6 : 1, font: "700 14.5px/1 Inter,sans-serif", background: AMARELO, color: INK }}>
              {salvando ? "Salvando…" : "Salvar preferências"}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
