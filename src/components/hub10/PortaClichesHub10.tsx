// A área dos porta-clichês, dentro de Facas (Augusto, 08/10/2026: "vamos
// criar em um card em facas com os portas"). Faca e porta-clichê são um
// conjunto, e cada máquina tem os seus: aqui ficam as tabelas de cilindros de
// cada máquina (máquina, espessura do clichê, Z, diâmetro e quantidade) e uma
// caixa para conferir, antes de gravar o clichê, em quais máquinas um Z roda
// com tantas cores (e verniz). A conta é a de lib/porta-cliches.ts, a mesma da
// escolha da faca e do Enviar p/ clicheria.
//
// A página inteira abaixo da barra, como a família aberta de Ferramentais: à
// esquerda o título, a explicação e o "Conferir um Z"; à direita, da c8 à c23,
// uma coluna por máquina e espessura, com o Z conferido marcado em amarelo.
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { FR, FUNDO, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { PALETA } from "@/lib/paleta-hub";
import { MAQUINAS, espessuraBR, ondeRoda, resumoOndeRoda, type Espessura, type PortaCliche } from "@/lib/porta-cliches";

const ALTURA = 968;             /* 1080 menos a barra do topo */
const CINZA = "#6f6d6f";        /* texto de apoio com contraste (5,1 no branco) */
const COLUNA = 240;             /* cinco colunas da c8 à c23 */
const X_COLUNAS = 640;
const LINHA = 26;
const TOPO_LINHAS = 200;

type Coluna = { maquina: string; espessura: Espessura; cores: number; verniz: boolean; zMinimo: number | null };
const COLUNAS: Coluna[] = MAQUINAS.flatMap((m) => m.espessuras.map((e) => ({ maquina: m.nome, espessura: e, cores: m.cores, verniz: m.verniz, zMinimo: m.zMinimo })));

const ROTULO: CSSProperties = { font: `800 12px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA };
const numero = (v: string) => v.replace(/\D/g, "").slice(0, 3);

export function PortaClichesHub10({ portas, lendo, falhou, fechar }: { portas: PortaCliche[]; lendo: boolean; falhou: boolean; fechar: () => void }) {
  useEscDoTopo(true, NIVEL.painel, fechar);
  const [zTexto, setZTexto] = useState("");
  const [cores, setCores] = useState(4);
  const [verniz, setVerniz] = useState(false);
  const z = Number(zTexto) || 0;
  const respostas = useMemo(() => (z ? ondeRoda({ z, cores, verniz }, portas) : []), [z, cores, verniz, portas]);
  const resumo = resumoOndeRoda(respostas, { z, cores, verniz });
  /* o mesmo motivo nas duas espessuras da Classic aparece uma vez só */
  const motivos = [...new Set(respostas.filter((r) => !r.cabe).map((r) => r.motivo ?? ""))].filter(Boolean);
  const cabem = respostas.filter((r) => r.cabe);

  return (
    <div role="region" aria-label="Porta-clichês" style={{ position: "absolute", left: 0, top: 112, width: 1920, height: ALTURA, background: FUNDO, zIndex: NIVEL.painel, overflow: "hidden", color: PRETO, fontFamily: INTER }}>
      <button onClick={fechar} className="p10-flat" aria-label="Fechar os porta-clichês"
        style={{ position: "absolute", left: 1840 - 46, top: 40, boxSizing: "border-box", width: 46, height: 46, padding: 0, display: "grid", placeItems: "center",
          background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer", zIndex: 3 }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
      </button>

      {/* à esquerda: o título, a explicação e o conferir */}
      <h1 style={{ position: "absolute", left: 80, top: 36, margin: 0, ...FR, fontSize: 72, lineHeight: "72px", letterSpacing: "-.035em", fontWeight: 400 }}>Porta-clichês</h1>
      <p style={{ position: "absolute", left: 80, top: 132, width: 480, margin: 0, fontSize: 19, lineHeight: 1.45, color: CINZA }}>
        Faca e porta-clichê são um conjunto: o cilindro precisa ter o mesmo Z da faca, uma unidade por cor e mais uma para o verniz.
      </p>

      <div role="group" aria-label="Conferir um Z" style={{ position: "absolute", left: 80, top: 270, width: 480, display: "flex", flexDirection: "column", gap: 18 }}>
        <span style={ROTULO}>Conferir um Z</span>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 28 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 15, color: CINZA }}>Z da faca</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 4, borderBottom: `2px solid ${PRETO}`, width: 112 }}>
              <input value={zTexto} onChange={(e) => setZTexto(numero(e.target.value))} inputMode="numeric" aria-label="Z da faca" placeholder="77" autoFocus
                style={{ width: 80, border: "none", background: "none", outline: "none", padding: "2px 0", ...FR, fontSize: 40, lineHeight: "48px", color: PRETO }} />
              <span style={{ ...FR, fontSize: 28, color: CINZA }}>Z</span>
            </span>
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 15, color: CINZA }}>Cores</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setCores((c) => Math.max(1, c - 1))} className="p10-flat" aria-label="Menos uma cor"
                style={{ width: 40, height: 40, borderRadius: 999, border: `1.5px solid ${PRETO}`, background: "none", cursor: "pointer", font: `600 22px/1 ${INTER}` }}>−</button>
              <span aria-live="polite" style={{ ...FR, fontSize: 40, lineHeight: "48px", minWidth: 28, textAlign: "center" }}>{cores}</span>
              <button onClick={() => setCores((c) => Math.min(8, c + 1))} className="p10-flat" aria-label="Mais uma cor"
                style={{ width: 40, height: 40, borderRadius: 999, border: `1.5px solid ${PRETO}`, background: "none", cursor: "pointer", font: `600 22px/1 ${INTER}` }}>+</button>
            </div>
          </div>
          <button onClick={() => setVerniz((v) => !v)} className="p10-flat" aria-pressed={verniz}
            style={{ height: 44, padding: "0 20px", borderRadius: 999, border: `1.5px solid ${PRETO}`, background: verniz ? PRETO : "none", color: verniz ? "#fff" : PRETO,
              cursor: "pointer", font: `600 17px/1 ${INTER}`, marginBottom: 2 }}>Verniz</button>
        </div>

        {/* a resposta: a frase curta e, embaixo, por que as outras não servem */}
        <div aria-live="polite" style={{ minHeight: 120, display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          {!z ? (
            <span style={{ fontSize: 17, lineHeight: 1.45, color: CINZA }}>Digite o Z da faca para ver em quais máquinas o pedido roda.</span>
          ) : (
            <>
              <span style={{ fontSize: 21, lineHeight: 1.35, fontWeight: 600, boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
                background: `linear-gradient(transparent 12%, ${resumo.cabe ? PALETA.amarelo : PALETA.perigo} 12%, ${resumo.cabe ? PALETA.amarelo : PALETA.perigo} 92%, transparent 92%)` }}>
                {resumo.texto}
              </span>
              {cabem.length > 0 && (
                <span style={{ fontSize: 15, lineHeight: 1.45, color: CINZA }}>
                  {cabem.map((r) => `${r.maquina} ${espessuraBR(r.espessura)}: ${r.tem} ${r.tem === 1 ? "porta-clichê" : "porta-clichês"} de ${z}Z`).join(" · ")}
                </span>
              )}
              {motivos.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.5, color: CINZA }}>
                  {motivos.map((m) => <li key={m}>{m}</li>)}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* à direita: uma coluna por máquina e espessura */}
      {lendo || falhou ? (
        <span role="status" style={{ position: "absolute", left: X_COLUNAS, top: TOPO_LINHAS, fontSize: 18, color: CINZA }}>
          {falhou ? "Não deu para ler os porta-clichês agora. Feche e abra de novo em alguns segundos." : "Lendo os porta-clichês…"}
        </span>
      ) : COLUNAS.map((c, i) => {
        const linhas = portas.filter((p) => p.maquina === c.maquina && p.espessura === c.espessura).sort((a, b) => a.z - b.z || (a.diametro ?? 0) - (b.diametro ?? 0));
        const unidades = linhas.reduce((s, p) => s + p.quantidade, 0);
        const abaixo = c.zMinimo ? linhas.filter((p) => p.z < c.zMinimo!) : [];
        const x = X_COLUNAS + i * COLUNA;
        const resposta = respostas.find((r) => r.maquina === c.maquina && r.espessura === c.espessura);
        return (
          <section key={`${c.maquina}-${c.espessura}`} aria-label={`${c.maquina}, clichê ${espessuraBR(c.espessura)}`}
            style={{ position: "absolute", left: x, top: 0, width: COLUNA, height: ALTURA, borderLeft: i ? "1px solid rgba(0,0,0,.14)" : "none", boxSizing: "border-box", paddingLeft: i ? 20 : 0 }}>
            {/* o cabeçalho tem a mesma altura em todas as colunas (a engrenagem
                mínima em linha própria; o "roda" ao lado da espessura), para
                as tabelas começarem na mesma linha */}
            <div style={{ position: "absolute", left: i ? 20 : 0, top: 44, width: COLUNA - 36 }}>
              <div style={{ ...FR, fontSize: 38, lineHeight: "40px", letterSpacing: "-.03em", whiteSpace: "nowrap" }}>{c.maquina}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, lineHeight: "20px" }}>
                <span style={{ fontSize: 17 }}>clichê {espessuraBR(c.espessura)}</span>
                {resposta && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: resposta.cabe ? PRETO : CINZA }}>{resposta.cabe ? "✓ roda" : "× não roda"}</span>
                )}
              </div>
              <div style={{ fontSize: 14, lineHeight: "18px", marginTop: 4, color: CINZA, whiteSpace: "nowrap" }}>{c.cores} cores{c.verniz ? " e verniz" : ""}</div>
              {c.zMinimo && <div style={{ fontSize: 14, lineHeight: "18px", color: CINZA, whiteSpace: "nowrap" }}>engrenagem a partir de {c.zMinimo}Z</div>}
            </div>
            <div aria-hidden style={{ position: "absolute", left: i ? 20 : 0, top: TOPO_LINHAS - 26, width: COLUNA - 36, display: "flex", justifyContent: "space-between", ...ROTULO }}>
              <span>Z</span><span>Ø</span><span>un.</span>
            </div>
            <ol style={{ position: "absolute", left: i ? 20 : 0, top: TOPO_LINHAS, width: COLUNA - 36, margin: 0, padding: 0, listStyle: "none" }}>
              {linhas.map((p) => {
                const marcada = !!z && p.z === z;
                const fora = !!c.zMinimo && p.z < c.zMinimo;
                return (
                  <li key={p.id ?? `${p.z}-${p.diametro}`} title={fora ? `Abaixo de ${c.zMinimo}Z: a ${c.maquina} não aceita` : undefined}
                    style={{ height: LINHA, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px", margin: "0 -6px",
                      borderRadius: 6, background: marcada ? PALETA.amarelo : "transparent", color: fora ? "#a3a1a3" : PRETO, fontVariantNumeric: "tabular-nums" }}>
                    <span style={{ fontSize: 17, fontWeight: 600, minWidth: 48 }}>{p.z}Z</span>
                    <span style={{ fontSize: 14, color: fora ? "#a3a1a3" : CINZA }}>{p.diametro != null ? p.diametro.toFixed(2).replace(".", ",") : ""}</span>
                    <span style={{ fontSize: 17, minWidth: 18, textAlign: "right" }}>{p.quantidade}</span>
                  </li>
                );
              })}
            </ol>
            <div style={{ position: "absolute", left: i ? 20 : 0, top: TOPO_LINHAS + linhas.length * LINHA + 14, width: COLUNA - 36, fontSize: 13, lineHeight: 1.45, color: CINZA }}>
              {linhas.length} {linhas.length === 1 ? "tamanho" : "tamanhos"} · {unidades} porta-clichês
              {abaixo.length > 0 && <><br />{abaixo.map((p) => `${p.z}Z`).join(" e ")}: abaixo de {c.zMinimo}Z, a {c.maquina} não aceita.</>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
