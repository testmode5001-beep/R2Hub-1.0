// "Transferir carteira" na geração 1.0: a mesma conta da caixa da V1a
// (TransferirCarteiraModalV1a), no desenho das caixas 1.0 ("Design criado",
// "Clichê chegou", "Pasta do cliente"): cartão branco de borda preta, título
// em Fraunces, faixa amarela, rodapé preto com o botão amarelo (Augusto,
// 30/09/2026: "alinhar design com o rework do hub"). A V1a continua com a dela.
//
// Cliente não tem dono no banco: quem "é" da vendedora são os PEDIDOS dela
// (`pedidos.vendedor_id`), e quem não tem `pedidos.ver_todos` só enxerga os
// próprios. Transferir muda quem vê o quê; por isso a caixa mostra o número
// exato do que vai mudar de mão ANTES de confirmar.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AMARELO_MAIS, FR, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { PALETA } from "@/lib/paleta-hub";

export type Dono = { id: string; nome: string; role?: string; ativo?: number; pedidos: number; clientes: number };
export type ItemCarteira = { cliente: string; total: number; abertos: number };

const CINZA = "#8a8a8a";
const BORDA_CAMPO = "#d9d8d6";

const ROTULO: CSSProperties = { font: `800 12.5px/1 ${INTER}`, letterSpacing: ".12em", textTransform: "uppercase", color: CINZA };
const SELETOR: CSSProperties = {
  width: "100%", boxSizing: "border-box", appearance: "none", WebkitAppearance: "none", background: "#fff",
  border: `1.5px solid ${BORDA_CAMPO}`, borderRadius: 11, padding: "12px 44px 12px 14px",
  font: `600 18px/1.2 ${INTER}`, color: PRETO, outline: "none", cursor: "pointer",
};
const TITULO_FAIXA: CSSProperties = {
  fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 40",
  fontWeight: 600, fontSize: 27, letterSpacing: "-.02em", color: PRETO, whiteSpace: "nowrap",
};

/** A caixinha de marcar do 1.0: vazada, preta quando ligada. */
function Marca({ on }: { on: boolean }) {
  return (
    <span aria-hidden style={{ flex: "none", width: 22, height: 22, boxSizing: "border-box", display: "grid", placeItems: "center",
      borderRadius: 6, border: `1.5px solid ${PRETO}`, background: on ? PRETO : "#fff" }}>
      {on && (
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 6.5" /></svg>
      )}
    </span>
  );
}

function Seletor({ rotulo, valor, aoMudar, desligado, children }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; desligado?: boolean; children: ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
      <span style={ROTULO}>{rotulo}</span>
      <span style={{ position: "relative", display: "block" }}>
        <select value={valor} onChange={(e) => aoMudar(e.target.value)} disabled={desligado}
          style={{ ...SELETOR, color: desligado ? CINZA : PRETO, cursor: desligado ? "not-allowed" : "pointer" }}>
          {children}
        </select>
        <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={desligado ? CINZA : PRETO} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </label>
  );
}

export function TransferirCarteiraHub10({ donos, fechar, aoCarregarCarteira, aoTransferir }: {
  donos: Dono[];
  fechar: () => void;
  /** clientes da pessoa escolhida como origem */
  aoCarregarCarteira: (vendedorId: string) => Promise<ItemCarteira[]>;
  aoTransferir: (dados: { deId: string; paraId: string; clientes: string[]; somenteAbertos: boolean }) =>
    Promise<{ movidos: number; para: string }>;
}) {
  const [deId, setDeId] = useState("");
  const [paraId, setParaId] = useState("");
  const [carteira, setCarteira] = useState<ItemCarteira[]>([]);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [somenteAbertos, setSomenteAbertos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");

  /* ESC fecha só esta caixa, não a lista "Todos os pedidos" atrás dela */
  useEscDoTopo(true, NIVEL.caixa, fechar);

  /* quem tem carteira pode entregar; quem está ativo pode receber */
  const origens = useMemo(() => donos.filter((d) => d.pedidos > 0), [donos]);
  const destinos = useMemo(() => donos.filter((d) => d.id !== deId && Number(d.ativo ?? 1) !== 0), [donos, deId]);

  /* A carteira se lê de novo SÓ quando muda quem entrega. O leitor chega
     numa função nova a cada desenho da página, e a lista de pedidos redesenha
     a cada 5 s: com ele na dependência, a caixa apagava o cliente marcado e
     voltava a "Lendo a carteira…" sozinha (simulação 3, 30/09/2026). A
     resposta que chega depois de outra troca é descartada. */
  const carregarCarteira = useRef(aoCarregarCarteira);
  carregarCarteira.current = aoCarregarCarteira;
  useEffect(() => {
    setCarteira([]); setMarcados([]); setErro("");
    if (!deId) return;
    let vivo = true;
    setCarregando(true);
    Promise.resolve(carregarCarteira.current(deId))
      .then((c) => { if (vivo) setCarteira(c); })
      .catch((e: unknown) => { if (vivo) setErro(e instanceof Error ? e.message : "Não deu para ler a carteira."); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [deId]);

  const alterna = (cliente: string) =>
    setMarcados((s) => (s.includes(cliente) ? s.filter((c) => c !== cliente) : [...s, cliente]));

  const todosMarcados = carteira.length > 0 && marcados.length === carteira.length;
  const marcarTudo = () => setMarcados(todosMarcados ? [] : carteira.map((c) => c.cliente));

  /* o número que a pessoa confirma: conta o que REALMENTE vai mudar de mão */
  const vaiMover = useMemo(
    () => carteira
      .filter((c) => marcados.includes(c.cliente))
      .reduce((n, c) => n + (somenteAbertos ? c.abertos : c.total), 0),
    [carteira, marcados, somenteAbertos],
  );

  const nomeDe = (id: string) => donos.find((d) => d.id === id)?.nome ?? "";
  const pronto = !!deId && !!paraId && marcados.length > 0 && vaiMover > 0 && !ocupado;

  function confirmar() {
    if (!pronto) return;
    setOcupado(true); setErro("");
    Promise.resolve(aoTransferir({ deId, paraId, clientes: marcados, somenteAbertos }))
      .then((r) => {
        setFeito(`${r.movidos} ${r.movidos === 1 ? "pedido foi" : "pedidos foram"} para ${r.para}.`);
        setMarcados([]);
        return aoCarregarCarteira(deId).then(setCarteira).catch(() => { /* a lista recarrega ao reabrir */ });
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não deu para transferir."))
      .finally(() => setOcupado(false));
  }

  const resumo = feito && !erro
    ? feito
    : pronto
      ? `Vai passar ${vaiMover} ${vaiMover === 1 ? "pedido" : "pedidos"} de ${nomeDe(deId)} para ${nomeDe(paraId)}.`
      : marcados.length > 0 && vaiMover === 0
        ? "Nenhum pedido em aberto nos clientes marcados."
        : "Escolha de quem sai, para quem vai e ao menos um cliente.";

  return (
    <div onClick={fechar}
      /* o véu cobre o palco inteiro, por cima da lista "Todos os pedidos" */
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa, background: "rgba(37,36,37,.78)" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Transferir carteira"
        style={{ boxSizing: "border-box", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 760, maxHeight: 900,
          display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22,
          boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>

        {/* ————— cabeçalho ————— */}
        <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "26px 42px 20px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `700 14px/1.25 ${INTER}`, letterSpacing: ".04em", textTransform: "uppercase", color: CINZA }}>
              Pedidos · muda quem vê
            </div>
            <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 44, lineHeight: 1, letterSpacing: "-.035em", marginTop: 10, whiteSpace: "nowrap" }}>Transferir carteira</div>
          </div>
          <button onClick={fechar} className="p10-flat" aria-label="Fechar"
            style={{ flex: "none", width: 46, height: 46, display: "grid", placeItems: "center", background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>

        {/* ————— de quem sai, para quem vai ————— */}
        <div style={{ flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, padding: "4px 42px 22px" }}>
          <Seletor rotulo="De quem sai" valor={deId} aoMudar={(v) => { setDeId(v); setFeito(""); }}>
            <option value="">Escolher…</option>
            {/* só o nome e os pedidos: com os clientes junto, o nome escolhido
                não cabia na caixa; quantos clientes, a faixa diz ("1 de 29") */}
            {origens.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome} ({d.pedidos} {d.pedidos === 1 ? "pedido" : "pedidos"})
              </option>
            ))}
          </Seletor>
          <Seletor rotulo="Para quem vai" valor={paraId} aoMudar={(v) => { setParaId(v); setFeito(""); }} desligado={!deId}>
            <option value="">Escolher…</option>
            {destinos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </Seletor>
        </div>

        {/* ————— os clientes ————— */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "15px 42px",
          background: AMARELO_MAIS, borderTop: `1.5px solid ${PRETO}`, borderBottom: `1.5px solid ${PRETO}` }}>
          <span style={TITULO_FAIXA}>Clientes</span>
          <span style={{ display: "flex", alignItems: "center", gap: 18, flex: "none" }}>
            {carteira.length > 0 && (
              <button onClick={marcarTudo} className="p10-flat"
                style={{ padding: 0, border: 0, background: "none", cursor: "pointer", font: `700 15px/1 ${INTER}`, color: PRETO, textDecoration: "underline", textUnderlineOffset: 4 }}>
                {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
              </button>
            )}
            {carteira.length > 0 && <span style={{ font: `800 15px/1 ${INTER}` }}>{marcados.length} de {carteira.length}</span>}
          </span>
        </div>

        <div className="p10-trilha" style={{ flex: 1, minHeight: 180, maxHeight: 340, overflowY: "auto", padding: "12px 30px" }}>
          {!deId ? (
            <div style={{ padding: "48px 12px", textAlign: "center", font: `500 17px/1.5 ${INTER}`, color: CINZA }}>
              Escolha de quem sai a carteira para ver os clientes.
            </div>
          ) : carregando ? (
            <div style={{ padding: "48px 12px", textAlign: "center", font: `500 17px/1.5 ${INTER}`, color: CINZA }}>Lendo a carteira…</div>
          ) : carteira.length === 0 ? (
            <div style={{ padding: "48px 12px", textAlign: "center", font: `500 17px/1.5 ${INTER}`, color: CINZA }}>Esta pessoa não tem pedidos.</div>
          ) : carteira.map((c) => {
            const on = marcados.includes(c.cliente);
            const conta = somenteAbertos ? c.abertos : c.total;
            return (
              <button key={c.cliente} onClick={() => alterna(c.cliente)} role="checkbox" aria-checked={on} className="p10-linha"
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "10px 12px", border: "none", borderRadius: 12,
                  background: on ? "#f1f1f1" : "none", cursor: "pointer", textAlign: "left", fontFamily: INTER, color: PRETO }}>
                <Marca on={on} />
                <span title={c.cliente} style={{ flex: 1, minWidth: 0, ...FR, fontWeight: 600, fontSize: 22, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.cliente}</span>
                <span style={{ flex: "none", font: `600 15px/1 ${INTER}`, color: conta === 0 ? "#b3b1b3" : "#5b595b", fontVariantNumeric: "tabular-nums" }}>
                  {conta} {conta === 1 ? "pedido" : "pedidos"}
                </span>
              </button>
            );
          })}
        </div>

        {/* ————— só os em aberto ————— */}
        <button onClick={() => setSomenteAbertos((v) => !v)} role="checkbox" aria-checked={somenteAbertos} className="p10-flat"
          style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, padding: "16px 42px 18px", border: "none", borderTop: "1px solid rgba(0,0,0,.12)",
            background: "none", cursor: "pointer", textAlign: "left", fontFamily: INTER, color: PRETO }}>
          <Marca on={somenteAbertos} />
          <span style={{ font: `500 16px/1.4 ${INTER}` }}>Levar só os pedidos em aberto: o que já foi entregue fica com quem atendeu</span>
        </button>

        {erro && (
          <div role="alert" style={{ flex: "none", padding: "12px 42px", background: PALETA.perigo, color: PALETA.perigoTinta, font: `600 15px/1.4 ${INTER}` }}>{erro}</div>
        )}

        {/* ————— rodapé ————— */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, padding: "18px 25px", background: PRETO }}>
          <div aria-live="polite" style={{ minWidth: 0, marginLeft: 20, font: `${feito && !erro ? 700 : 600} 16px/1.45 ${INTER}`, color: feito && !erro ? "#fff" : "#c9c8c6" }}>{resumo}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, flex: "none" }}>
            <button onClick={fechar} className="p10-flat"
              style={{ border: "1.5px solid #555355", borderRadius: 999, padding: "14px 24px", cursor: "pointer", font: `700 17px/1 ${INTER}`, background: "none", color: "#f1f1f1" }}>Fechar</button>
            <button onClick={confirmar} disabled={!pronto}
              style={{ border: `1.5px solid ${pronto ? PRETO : "#4a484a"}`, borderRadius: 999, padding: "14px 28px", cursor: pronto ? "pointer" : "not-allowed", font: `800 17px/1 ${INTER}`,
                whiteSpace: "nowrap", background: pronto ? AMARELO_MAIS : "#4a484a", color: pronto ? PRETO : CINZA }}>
              {ocupado ? "Transferindo…" : "Transferir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
