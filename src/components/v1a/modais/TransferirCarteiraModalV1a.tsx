// Transferir carteira — passar os pedidos de um ou mais clientes de uma
// vendedora para outra.
//
// Cliente não tem dono no banco: quem "é" da vendedora são os PEDIDOS dela
// (`pedidos.vendedor_id`). E esse campo não é etiqueta — quem não tem
// `pedidos.ver_todos` só enxerga os próprios pedidos. Transferir, portanto,
// muda quem vê o quê, e é por isso que a tela mostra o número exato do que vai
// mudar de mão ANTES de confirmar.
//
// Antes disto a troca só era possível editando o banco na mão.
import { useEffect, useMemo, useState } from "react";

import { AMARELO, INK, MONO, fr } from "../HubV1a";

export type Dono = { id: string; nome: string; role?: string; ativo?: number; pedidos: number; clientes: number };
export type ItemCarteira = { cliente: string; total: number; abertos: number };

const ROTULO = { font: `600 11px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase" as const, color: "#7a787a" };

export function TransferirCarteiraModalV1a({ donos, fechar, aoCarregarCarteira, aoTransferir }: {
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

  /* quem tem carteira pode entregar; quem está ativo pode receber */
  const origens = useMemo(() => donos.filter((d) => d.pedidos > 0), [donos]);
  const destinos = useMemo(() => donos.filter((d) => d.id !== deId && Number(d.ativo ?? 1) !== 0), [donos, deId]);

  useEffect(() => {
    setCarteira([]); setMarcados([]); setErro("");
    if (!deId) return;
    setCarregando(true);
    Promise.resolve(aoCarregarCarteira(deId))
      .then((c) => setCarteira(c))
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não deu para ler a carteira."))
      .finally(() => setCarregando(false));
  }, [deId, aoCarregarCarteira]);

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

  const seletor = {
    width: "100%", boxSizing: "border-box" as const, border: "1px solid #e0dfe0", borderRadius: 9,
    padding: "11px 12px", font: "500 14.5px/1.2 Inter,sans-serif", color: INK, background: "#fff",
  };

  return (
    <div onClick={(e) => { e.stopPropagation(); fechar(); }}
      className="r2modal"
      style={{ position: "absolute", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 30, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Transferir carteira"
        style={{ width: 760, maxWidth: "100%", maxHeight: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16, background: "#f1f1f1", borderRadius: 16, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>

        <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
          <div style={{ minWidth: 0 }}>
            <div style={ROTULO}>Pedidos · muda quem vê</div>
            <div style={{ ...fr(96, 700), fontSize: 30, lineHeight: 1.1, letterSpacing: "-.03em", color: INK, marginTop: 9 }}>
              Transferir carteira
            </div>
          </div>
          <button onClick={fechar} data-esc-fechar aria-label="Fechar" className="pm-ic"
            style={{ width: 38, height: 38, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={ROTULO}>De quem sai</span>
            <select value={deId} onChange={(e) => { setDeId(e.target.value); setFeito(""); }} style={seletor}>
              <option value="">Escolher…</option>
              {origens.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nome} — {d.clientes} {d.clientes === 1 ? "cliente" : "clientes"}, {d.pedidos} {d.pedidos === 1 ? "pedido" : "pedidos"}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <span style={ROTULO}>Para quem vai</span>
            <select value={paraId} onChange={(e) => { setParaId(e.target.value); setFeito(""); }} style={seletor} disabled={!deId}>
              <option value="">Escolher…</option>
              {destinos.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </label>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ font: "800 15px/1.15 Inter,sans-serif", color: INK }}>Clientes</span>
            <span style={{ flex: 1 }} />
            {carteira.length > 0 && (
              <button onClick={marcarTudo}
                style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "600 12.5px/1 Inter,sans-serif", color: "#6f6d6f", textDecoration: "underline" }}>
                {todosMarcados ? "desmarcar todos" : "marcar todos"}
              </button>
            )}
          </div>

          <div className="pv-sc" style={{ flex: 1, minHeight: 0, maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {!deId ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: "24px 10px" }}>
                <span style={{ font: "500 13.5px/1.5 Inter,sans-serif", color: "#7a787a" }}>
                  Escolha de quem sai a carteira para ver os clientes.
                </span>
              </div>
            ) : carregando ? (
              <div style={{ padding: "24px 0", textAlign: "center", font: "500 13.5px/1 Inter,sans-serif", color: "#7a787a" }}>Lendo a carteira…</div>
            ) : carteira.length === 0 ? (
              <div style={{ padding: "24px 0", textAlign: "center", font: "500 13.5px/1 Inter,sans-serif", color: "#7a787a" }}>Esta pessoa não tem pedidos.</div>
            ) : carteira.map((c) => {
              const on = marcados.includes(c.cliente);
              const conta = somenteAbertos ? c.abertos : c.total;
              return (
                <button key={c.cliente} onClick={() => alterna(c.cliente)} role="checkbox" aria-checked={on}
                  style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, textAlign: "left", width: "100%", border: 0, borderRadius: 10, cursor: "pointer", padding: "11px 13px", background: on ? "#fafafa" : "#f4f4f4" }}>
                  <span style={{ flex: "none", width: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 6, border: `2px solid ${on ? AMARELO : "#dcdbdc"}`, background: on ? AMARELO : "#fff" }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" style={{ display: on ? "block" : "none" }}><path d="M4 12.5l5 5L20 6.5" /></svg>
                  </span>
                  <span className="truncate" style={{ flex: 1, minWidth: 0, font: "600 14.5px/1.2 Inter,sans-serif", color: INK }}>{c.cliente}</span>
                  <span style={{ flex: "none", font: `600 12.5px/1 ${MONO}`, color: conta === 0 ? "#b3b1b3" : "#6f6d6f", fontVariantNumeric: "tabular-nums" }}>
                    {conta} {conta === 1 ? "pedido" : "pedidos"}
                  </span>
                </button>
              );
            })}
          </div>

          <label style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 13, borderTop: "1px solid #ececec", cursor: "pointer" }}>
            <input type="checkbox" checked={somenteAbertos} onChange={(e) => setSomenteAbertos(e.target.checked)}
              style={{ width: 17, height: 17, accentColor: INK, cursor: "pointer" }} />
            <span style={{ font: "500 13.5px/1.4 Inter,sans-serif", color: "#5c5a5c" }}>
              Levar só os pedidos em aberto — o que já foi entregue fica com quem atendeu
            </span>
          </label>
        </div>

        {!!erro && (
          <div style={{ flex: "none", background: "#fdf0ef", border: "1px solid #f3d6d4", borderRadius: 10, padding: "11px 14px", font: "600 13.5px/1.4 Inter,sans-serif", color: "#c42b26" }}>{erro}</div>
        )}
        {!!feito && !erro && (
          <div style={{ flex: "none", background: "#fff", borderLeft: `4px solid ${AMARELO}`, borderRadius: "0 10px 10px 0", padding: "11px 14px", font: "600 13.5px/1.4 Inter,sans-serif", color: INK }}>{feito}</div>
        )}

        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ flex: 1, minWidth: 0, font: "500 13.5px/1.4 Inter,sans-serif", color: "#5c5a5c" }}>
            {pronto
              ? <>Vai passar <b style={{ color: INK }}>{vaiMover} {vaiMover === 1 ? "pedido" : "pedidos"}</b> de {nomeDe(deId)} para {nomeDe(paraId)}.</>
              : marcados.length > 0 && vaiMover === 0
                ? "Nenhum pedido em aberto nos clientes marcados."
                : "Escolha origem, destino e ao menos um cliente."}
          </span>
          <button onClick={fechar}
            style={{ flex: "none", border: "1.5px solid #e0dfe0", background: "#fff", borderRadius: 9, padding: "11px 18px", cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: INK }}>
            Fechar
          </button>
          <button onClick={confirmar} disabled={!pronto}
            style={{ flex: "none", border: 0, borderRadius: 9, padding: "12px 20px", cursor: pronto ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", background: pronto ? INK : "#e0dfe0", color: pronto ? AMARELO : "#8a888a" }}>
            {ocupado ? "Transferindo…" : "Transferir"}
          </button>
        </div>
      </div>
    </div>
  );
}
