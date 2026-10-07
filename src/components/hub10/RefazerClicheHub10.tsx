// "Refazer clichê" de Aprovações (Augusto, 02/10/2026).
//
// No dia a dia o clichê se danifica no manuseio ou gasta, e o cliente mais
// antigo não está no hub: não há pedido para marcar "Refazer clichê". O
// designer cadastra aqui o cartão desse clichê, direto em Aprovações, com o
// cliente, as cores a refazer, o motivo (a lista que veio do hub antigo) e uma
// observação (o código do clichê saiu: "desnecessário", 02/10/2026). Dali em diante o cartão segue como os outros de
// Aprovações, e a refação conta nos relatórios pelo motivo, junto com as
// marcadas dentro do pedido. Só designers e admin veem o botão.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { FR, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { erroLegivel } from "@/lib/erro-legivel";
import { separarCores } from "@/lib/cores";
import { PALETA } from "@/lib/paleta-hub";

export type DadosRefazerCliche = { cliente: string; cores: string[]; motivo: string; motivoLivre?: boolean; observacao?: string };

const CINZA = "#8f8f8f";
const CLARO = "#cfcfcf";
const ROTULO: CSSProperties = { font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA };
const CAMPO: CSSProperties = { height: 48, boxSizing: "border-box", padding: "0 18px", border: `1.5px solid ${PRETO}`, borderRadius: 999, outline: "none", font: `500 18px/1 ${INTER}`, color: PRETO, background: "#fff", width: "100%" };
const BOTAO: CSSProperties = { height: 50, display: "inline-flex", alignItems: "center", padding: "0 26px", borderRadius: 999, fontFamily: INTER, fontSize: 18, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };

export function RefazerClicheHub10({ motivosDoCliche, clientes, aoCadastrar, aoFechar }: {
  motivosDoCliche: () => Promise<{ id: string; nome: string }[]>;
  /** sugestões para o nome: os clientes que já aparecem nos pedidos */
  clientes: string[];
  aoCadastrar: (d: DadosRefazerCliche) => Promise<unknown>;
  aoFechar: () => void;
}) {
  const idLista = useId();
  const [motivos, setMotivos] = useState<{ id: string; nome: string }[] | null>(null);
  const [motivosFalharam, setMotivosFalharam] = useState(false);
  useEffect(() => {
    let vivo = true;
    motivosDoCliche()
      .then((l) => { if (vivo) setMotivos(l); })
      .catch(() => { if (vivo) { setMotivos([]); setMotivosFalharam(true); } });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [cliente, setCliente] = useState("");
  const [cores, setCores] = useState("");
  const [motivo, setMotivo] = useState("");
  /* motivo que não está na lista (Augusto, 02/10/2026): escrito à mão, conta
     nos relatórios com o nome que tiver */
  const [outro, setOutro] = useState(false);
  const [textoOutro, setTextoOutro] = useState("");
  const [obs, setObs] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  /* a trava do clique duplo por ref, como nas outras caixas que mandam ao
     servidor: o estado só vale no próximo render, e dois cliques seguidos
     criavam dois cartões */
  const emVoo = useRef(false);

  const listaCores = separarCores(cores);
  const semLista = motivos !== null && (motivosFalharam || motivos.length === 0);
  const escrito = textoOutro.replace(/[()]/g, "").trim();
  const usaOutro = outro || semLista;
  const motivoFinal = usaOutro ? escrito : motivo;
  /* os limites do servidor, ditos aqui: com 13 cores a caixa só dizia que
     "um texto passou do tamanho que o hub aceita" */
  const coresDemais = listaCores.length > 12 ? "No máximo 12 cores por refação." : listaCores.some((c) => c.length > 60) ? "Cada cor com até 60 letras." : "";
  const pronto = !ocupado && !coresDemais && !!cliente.trim() && listaCores.length > 0 && (usaOutro ? escrito.length >= 3 : !!motivo);

  const fechar = useCallback(() => { if (!ocupado) aoFechar(); }, [ocupado, aoFechar]);
  useEscDoTopo(true, NIVEL.caixa, fechar);

  const cadastrar = async () => {
    if (!pronto || emVoo.current) return;
    emVoo.current = true;
    setOcupado(true);
    setErro("");
    try {
      await aoCadastrar({ cliente: cliente.trim(), cores: listaCores, motivo: motivoFinal, motivoLivre: usaOutro || undefined, observacao: obs.trim() || undefined });
    } catch (e: unknown) {
      setErro(erroLegivel(e, "Não deu para cadastrar a refação. Tente de novo."));
      emVoo.current = false;
      setOcupado(false);
    }
  };

  const bolinha = (on: boolean) => (
    <span aria-hidden style={{ flex: "none", width: 20, height: 20, boxSizing: "border-box", borderRadius: 999, border: `1.5px solid ${PRETO}`, display: "grid", placeItems: "center", background: "#fff" }}>
      {on && <span style={{ width: 10, height: 10, borderRadius: 999, background: PRETO }} />}
    </span>
  );

  return (
    <div onClick={fechar}
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa + 20, background: "rgba(37,36,37,.78)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div role="dialog" aria-modal="true" aria-label="Refazer clichê" onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", width: 720, background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, padding: "40px 44px", display: "flex", flexDirection: "column", gap: 16,
          boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>
        <div style={{ ...FR, fontSize: 38, lineHeight: 1, letterSpacing: "-.02em" }}>Refazer clichê</div>
        <div style={{ fontSize: 17, lineHeight: 1.45, color: CINZA, marginTop: -4 }}>
          Para clichê de cliente que ainda não está no hub. O cartão entra em Aprovações e a refação conta nos relatórios pelo motivo.
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={ROTULO}>Cliente</span>
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} autoFocus list={idLista} maxLength={200} placeholder="Nome do cliente" style={CAMPO} />
          <datalist id={idLista}>{clientes.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={ROTULO}>Cores a refazer</span>
          <input value={cores} onChange={(e) => setCores(e.target.value)} maxLength={400} placeholder="Ex.: Preto, P 485 C" style={CAMPO} />
        </label>

        <div role="radiogroup" aria-label="Motivo" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={ROTULO}>Motivo</span>
          {motivos === null ? (
            <span style={{ fontSize: 17, color: CINZA }}>Carregando os motivos…</span>
          ) : semLista ? (
            <span style={{ fontSize: 17, color: PALETA.perigo }}>
              {motivosFalharam ? "Não deu para carregar a lista de motivos. Escreva o motivo abaixo." : "A lista de motivos está vazia. Escreva o motivo abaixo."}
            </span>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 28px" }}>
              {motivos.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={!outro && motivo === m.nome} onClick={() => { setMotivo(m.nome); setOutro(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 18, fontWeight: 600, color: PRETO, textAlign: "left" }}>
                  {bolinha(!outro && motivo === m.nome)}{m.nome}
                </button>
              ))}
              {/* o que não está na lista: escrito à mão */}
              <button type="button" role="radio" aria-checked={outro} onClick={() => { setOutro(true); setMotivo(""); }}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 18, fontWeight: 600, color: PRETO, textAlign: "left" }}>
                {bolinha(outro)}Outro motivo
              </button>
            </div>
          )}
          {usaOutro && motivos !== null && (
            <input value={textoOutro} onChange={(e) => setTextoOutro(e.target.value)} autoFocus={outro} maxLength={60} placeholder="Qual o motivo?" aria-label="Qual o motivo" style={CAMPO} />
          )}
        </div>

        <label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <span style={ROTULO}>Observação (opcional)</span>
          <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="O que mais o designer precisa saber" style={CAMPO} />
        </label>

        {(erro || coresDemais) && <div role="alert" style={{ fontSize: 16, lineHeight: 1.4, color: PALETA.perigo }}>{erro || coresDemais}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
          <button type="button" onClick={fechar} disabled={ocupado} className="p10-flat" style={{ ...BOTAO, border: `2px solid ${PRETO}`, background: "none", color: PRETO }}>Voltar</button>
          <button type="button" onClick={() => void cadastrar()} disabled={!pronto} className="p10-flat"
            style={{ ...BOTAO, border: "none", background: pronto ? PRETO : CLARO, color: "#fff", cursor: pronto ? "pointer" : "default" }}>
            {ocupado ? "Cadastrando…" : "Cadastrar refação"}
          </button>
        </div>
      </div>
    </div>
  );
}
