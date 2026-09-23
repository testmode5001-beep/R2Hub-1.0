// Arquivos — v1a. Fonte: design_handoff_r2_hub/telas/Arquivos.dc.html.
// Arquivo físico de clichês: 1.915 pastas migradas (dados/arquivo.ts), busca
// por nome/código/etiqueta, gavetas A–W (+ antigas), consultas registradas ao
// abrir, inativas (vagas ou 2+ anos sem consulta), cadastro/edição de cliente.
import { useEffect, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

import {
  AMARELO, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { criarBusca } from "@/lib/busca";
import { colherBusca } from "@/lib/busca-semente";
import { salvarBlob } from "@/lib/files";
import { excluirPasta, listArquivo, registrarConsulta, salvarPasta, semearArquivo } from "@/lib/api/arquivo.functions";
import { REGISTROS } from "./dados/arquivo";

const DOIS_ANOS = 1000 * 60 * 60 * 24 * 365 * 2;

type Pasta = {
  id: string;
  nome: string;
  codigo: number;
  gaveta: string;
  pasta: string;
  obs: string;
  vaga: boolean;
  consultas: string[];
};

const dataBR = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
};
const dataHora = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dataBR(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** linha de arquivo_pastas → Pasta da tela */
function daLinha(r: any): Pasta {
  let consultas: string[] = [];
  try { consultas = JSON.parse(r.consultas_json) || []; } catch { consultas = []; }
  return {
    id: String(r.id), nome: String(r.nome ?? ""), codigo: Number(r.codigo) || 0,
    gaveta: String(r.gaveta ?? ""), pasta: String(r.pasta ?? ""), obs: String(r.obs ?? ""),
    vaga: !!r.vaga, consultas,
  };
}

function daBase(r: any): Pasta {
  const g = String(r.gaveta || "").replace(/^GAVETA\s*/i, "");
  return {
    id: r.id,
    nome: r.nome,
    codigo: r.num || 0,
    gaveta: r.gaveta,
    pasta: `${g}-${String(r.num || 0).padStart(2, "0")}`,
    obs: r.vaga ? "Pasta vaga — baixada no sistema antigo" : (r.cadastro ? `Cadastro de ${dataBR(r.cadastro)}${r.user ? " · " + String(r.user).toLowerCase() : ""}` : ""),
    vaga: !!r.vaga,
    consultas: r.cadastro ? [r.cadastro + "T09:00"] : [],
  };
}

export function ArquivosV1a({ profile, versao, aoNavegar, onNova, onLogout, disponiveis, children }: {
  profile: { nome: string; role?: string };
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
}) {
  const [buscaTopo, setBuscaTopo] = useState("");
  const [lista, setLista] = useState<Pasta[]>([]);
  /* quem chega da tela Pantone (chip da pasta do cliente) ou da busca do topo
     já entra filtrado */
  const [semente] = useState(() => colherBusca());
  const [busca, setBusca] = useState(semente);
  /* E entra no MODO certo: o termo plantado pode ser um nome ("SANTA MONICA
     PADARIA"), um número (2265) ou uma etiqueta ("O-2265"). Chegar com a
     etiqueta e o filtro em "nome" não acharia nada — e a pessoa concluiria que
     a pasta não existe. */
  const [modo, setModo] = useState<"nome" | "pasta" | "codigo">(() => {
    if (/^\d+$/.test(semente.trim())) return "pasta";
    if (/^[A-Za-z]{1,3}\d*-\d+$/.test(semente.trim())) return "codigo";
    return "nome";
  });
  const [gaveta, setGaveta] = useState("");
  const [soInativas, setSoInativas] = useState(false);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [limite, setLimite] = useState(60);
  const [antigasAberto, setAntigasAberto] = useState(false);
  const [aviso, setAviso] = useState("");
  // form novo/editar cliente
  const [formAberto, setFormAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fNome, setFNome] = useState("");
  const [fCodigo, setFCodigo] = useState("");
  const [fGaveta, setFGaveta] = useState("");
  const [fPasta, setFPasta] = useState("");
  const [fObs, setFObs] = useState("");

  /* O cadastro do arquivo físico vem do banco. Na primeira vez o servidor está
     vazio: mandamos o acervo conhecido para semear e a partir daí a empresa
     inteira vê (e edita) a mesma coisa. Antes tudo isso vivia no localStorage
     de cada computador. */
  async function puxarArquivo() {
    const r = (await listArquivo()) as any;
    const linhas: any[] = r?.linhas ?? [];
    if (!linhas.length) {
      const base = (REGISTROS as any[]).map(daBase);
      setLista(base);
      await semearArquivo({ data: { pastas: base } });
      const novo = (await listArquivo()) as any;
      setLista((novo?.linhas ?? []).map(daLinha));
      return;
    }
    setLista(linhas.map(daLinha));
  }
  useEffect(() => {
    void puxarArquivo().catch(() => setLista((REGISTROS as any[]).map(daBase)));
  }, []);

  const falhou = (e: unknown, padrao: string) => setAviso(e instanceof Error ? e.message : padrao);
  /** Atualiza a tela na hora; quem grava no servidor é cada ação. */
  const atualizar = (l: Pasta[], extra?: () => void) => {
    setLista(l);
    extra?.();
  };

  const inativo = (c: Pasta) => {
    if (c.vaga) return true;
    const u = c.consultas[0];
    if (!u) return false;
    return Date.now() - new Date(u).getTime() > DOIS_ANOS;
  };

  const q = busca.trim().toLowerCase();
  const casa = criarBusca(busca);
  const vis = lista.filter((c) => {
    if (gaveta && c.gaveta !== gaveta) return false;
    if (soInativas && !inativo(c)) return false;
    if (!q) return true;
    if (modo === "pasta") return String(c.codigo).includes(q.replace(/\D/g, ""));
    if (modo === "codigo") return casa(c.pasta || "");
    return casa(c.nome);
  });
  const inativas = lista.filter(inativo).length;

  const todasG = Array.from(new Set(lista.map((c) => c.gaveta))).sort();
  const ehAntiga = (g: string) => /^GAVETA (A[1-9]|CB|HP|KP|DS|LS|P7)$/.test(g);
  const gavetasNomes = todasG.filter((g) => !ehAntiga(g));
  const antigasNomes = todasG.filter(ehAntiga);

  function abrir(c: Pasta) {
    if (abertoId === c.id) { setAbertoId(null); return; }
    const iso = new Date().toISOString().slice(0, 16);
    atualizar(lista.map((x) => (x.id === c.id ? { ...x, consultas: [iso, ...x.consultas].slice(0, 12) } : x)), () => {
      void registrarConsulta({ data: { id: c.id, quando: iso } }).catch(() => { /* consulta é registro leve: não atrapalha abrir a pasta */ });
      setAbertoId(c.id);
      setAviso(`Consulta registrada em ${c.nome}.`);
    });
  }

  function salvar() {
    const nome = fNome.trim();
    const codigo = Number(fCodigo.replace(/\D/g, ""));
    if (!nome || !codigo) { setAviso("Nome e código da pasta são obrigatórios."); return; }
    const dados = { nome, codigo, gaveta: fGaveta.trim() || "GAVETA A", pasta: fPasta.trim(), obs: fObs.trim() };
    if (editId) {
      const alvo = lista.find((c) => c.id === editId);
      atualizar(lista.map((c) => (c.id === editId ? { ...c, ...dados } : c)), () => {
        setFormAberto(false); setEditId(null); setAviso(`${nome} atualizado.`);
      });
      if (alvo) void salvarPasta({ data: { ...alvo, ...dados } }).catch((e) => { falhou(e, "Não deu para salvar o cadastro."); void puxarArquivo(); });
    } else {
      const novo: Pasta = { id: "c" + Date.now(), ...dados, vaga: false, consultas: [new Date().toISOString().slice(0, 16)] };
      atualizar([novo, ...lista], () => { setFormAberto(false); setAviso(`${nome} cadastrado na ${dados.gaveta}.`); });
      void salvarPasta({ data: novo }).catch((e) => { falhou(e, "Não deu para cadastrar a pasta."); void puxarArquivo(); });
    }
  }

  const abrirForm = (c?: Pasta) => {
    setFormAberto(true);
    setEditId(c?.id ?? null);
    setFNome(c?.nome ?? (modo === "nome" ? busca : ""));
    setFCodigo(c ? String(c.codigo) : "");
    setFGaveta(c?.gaveta ?? gaveta ?? "");
    setFPasta(c?.pasta ?? "");
    setFObs(c?.obs ?? "");
  };

  const chip = (nome: string, label: string) => {
    const on = gaveta === nome;
    const conta = nome ? lista.filter((c) => c.gaveta === nome).length : lista.length;
    return (
      <button key={label} type="button" className="r2chip"
        onClick={() => { setGaveta(gaveta === nome ? "" : nome); setLimite(60); setAbertoId(null); }}
        style={{ display: "flex", alignItems: "center", gap: 7, border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 13px", font: "700 13.5px/1 Inter,sans-serif", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
        {label}
        <span style={{ font: `700 12px/1 ${MONO}`, padding: "4px 6px", borderRadius: 999, background: on ? "#3a383a" : "#fff", color: on ? AMARELO : "#8d8b8d" }}>{conta}</span>
      </button>
    );
  };

  const inp: CSSProperties = { width: "100%", boxSizing: "border-box", background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 7, padding: "12px 14px", font: "600 15px/1.2 Inter,sans-serif", color: INK, outline: "none" };
  const podeSalvar = fNome.trim() && fCodigo;

  return (
    <EstagioV1a>
      <TopbarV1a nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""} busca={buscaTopo} aoBuscar={setBuscaTopo} onSair={onLogout} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="Arquivos" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, padding: "0 4px" }}>
            <div>
              <h1 style={{ ...fr(144, 900), fontSize: 80, lineHeight: 0.86, color: INK, margin: "2px 0 0 2px" }}>Arquivos</h1>
              <div style={{ font: "400 15px/1 Inter,sans-serif", color: "#8d8b8d", marginTop: 14 }}>
                Arquivo físico de clichês · {lista.length} pastas · {lista.filter((c) => !c.vaga).length} clientes · {lista.filter((c) => c.vaga).length} vagas
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" className="r2chip" onClick={() => {
                /* antes o botão SÓ mostrava o aviso — ninguém recebia CSV nenhum */
                const linhas = lista.filter(inativo).map((c) => [
                  c.nome, String(c.codigo || ""), c.gaveta, c.pasta,
                  c.vaga ? "vaga" : "sem consulta ha 2+ anos",
                  c.consultas[0] ? dataBR(c.consultas[0]) : "",
                ]);
                const esc = (v: string) => `"${String(v).replace(/"/g, "\"\"")}"`;
                const csv = ["nome;codigo;gaveta;pasta;situacao;ultima_consulta"]
                  .concat(linhas.map((l) => l.map(esc).join(";")))
                  .join("\r\n");
                salvarBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), "pastas-inativas.csv");
                setAviso(`${linhas.length} pastas inativas exportadas em pastas-inativas.csv.`);
              }}
                style={{ display: "flex", alignItems: "center", gap: 8, border: "2px solid #e0e0e0", background: "transparent", borderRadius: 999, padding: "13px 17px", cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", color: "#5c5a5c" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="m7.5 10.5 4.5 4.5 4.5-4.5" /><path d="M4.5 19.5h15" /></svg>
                Inativos (CSV)
              </button>
              <button type="button" className="r2chip" onClick={() => abrirForm()}
                style={{ display: "flex", alignItems: "center", gap: 8, border: 0, borderRadius: 999, padding: "15px 20px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: INK, color: AMARELO }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="3" strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                Novo cliente
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "400px 1fr", gap: 12 }}>
            {/* coluna esquerda */}
            <div style={{ minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ flex: "none", background: "#fff", borderRadius: 14, padding: "18px 20px 16px", boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#f1f1f1", borderRadius: 999, padding: "0 18px", height: 50 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                  <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(60); }}
                    placeholder={modo === "pasta" ? "Digite o código da pasta (ex.: 2265)…" : modo === "codigo" ? "Digite a etiqueta (ex.: O-2265)…" : "Buscar por nome do cliente…"}
                    style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "500 15px/1 Inter,sans-serif", color: INK }} />
                  {busca && (
                    <button type="button" onClick={() => { setBusca(""); setLimite(60); }} style={{ flex: "none", width: 26, height: 26, display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  {([["nome", "Nome"], ["pasta", "Código"], ["codigo", "Etiqueta"]] as const).map(([k, label]) => {
                    const on = modo === k;
                    return (
                      <button key={k} type="button" className="r2chip" onClick={() => { setModo(k); setBusca(""); setLimite(60); }}
                        style={{ flex: 1, border: 0, cursor: "pointer", borderRadius: 999, padding: "11px 10px", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".03em", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ flex: "none", background: "#fff", borderRadius: 14, padding: "18px 20px 16px", boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                  <span style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em" }}>Gavetas</span>
                  <button type="button" className="r2chip" onClick={() => { setSoInativas(!soInativas); setAbertoId(null); setLimite(60); }}
                    style={{ display: "flex", alignItems: "center", gap: 7, border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 12px", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", background: soInativas ? INK : "#f1f1f1", color: soInativas ? AMARELO : "#5c5a5c" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 8v5" /><path d="M12 16.5h.01" /><path d="M10.3 4.3 2.8 18a1.9 1.9 0 0 0 1.7 2.8h15a1.9 1.9 0 0 0 1.7-2.8L13.7 4.3a1.9 1.9 0 0 0-3.4 0z" /></svg>
                    {soInativas ? "Só inativas" : "Ver inativas"}
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {chip("", "Todas")}
                  {gavetasNomes.map((g) => chip(g, g.replace(/^GAVETA\s*/i, "")))}
                </div>
                <button type="button" className="r2chip" onClick={() => setAntigasAberto(!antigasAberto)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "transparent", padding: 0, margin: "16px 0 0", cursor: "pointer" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", transition: "transform .15s", transform: `rotate(${antigasAberto ? 90 : 0}deg)` }}><path d="m9 5 7 7-7 7" /></svg>
                  <span style={{ font: `600 12px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3", whiteSpace: "nowrap" }}>Registros antigos</span>
                  <span style={{ flex: 1, height: 1, background: "#ececec" }} />
                  <span style={{ font: "500 12.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{lista.filter((c) => ehAntiga(c.gaveta)).length} pastas · 2003–2008</span>
                </button>
                {antigasAberto && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {antigasNomes.map((g) => chip(g, g.replace(/^GAVETA\s*/i, "")))}
                  </div>
                )}
              </div>

              <div style={{ flex: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ background: AMARELO, borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: INK }}>{lista.length}</div>
                  <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: INK, marginTop: 9 }}>Pastas no arquivo</div>
                </div>
                <button type="button" className="r2chip" onClick={() => { setSoInativas(!soInativas); setAbertoId(null); setLimite(60); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", border: 0, cursor: "pointer", borderRadius: 12, padding: "16px 18px", background: soInativas ? AMARELO : INK }}>
                  <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em", color: soInativas ? INK : "#f1f1f1" }}>{inativas}</div>
                  <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 9, color: soInativas ? INK : "#b3b1b3" }}>
                    {soInativas ? "Filtrando inativas" : "Inativas e vagas"}
                  </div>
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0, background: INK, borderRadius: 14, padding: "18px 20px 16px" }}>
                <div style={{ font: "800 17px/1 Inter,sans-serif", color: "#f1f1f1", letterSpacing: "-.01em", marginBottom: 6 }}>Como o arquivo funciona</div>
                {[
                  "Base migrada do sistema antigo (Bd AssTecnica): gavetas A a W, incluindo as subgavetas A1 a A9.",
                  "Abrir um cliente registra a consulta com data e hora; as cinco últimas ficam no cartão.",
                  "Pastas vagas (baixadas no sistema antigo) e sem consulta há 2+ anos entram na lista de inativas.",
                ].map((texto) => (
                  <div key={texto} style={{ display: "flex", gap: 11, padding: "11px 0", borderBottom: "1px solid rgba(241,241,241,.1)" }}>
                    <span style={{ flex: "none", width: 6, height: 6, borderRadius: 999, background: AMARELO, marginTop: 6 }} />
                    <span style={{ flex: 1, font: "500 14.5px/1.45 Inter,sans-serif", color: "#b3b1b3" }}>{texto}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* lista de clientes */}
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, padding: "0 2px" }}>
                <span style={{ font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>
                  {soInativas
                    ? `${vis.length} ${vis.length === 1 ? "pasta inativa" : "pastas inativas"}`
                    : busca || gaveta ? `${vis.length} ${vis.length === 1 ? "resultado" : "resultados"}` : "Todas as pastas"}
                </span>
                <span style={{ flex: 1, height: 2, background: "#e4e4e4", borderRadius: 999 }} />
                <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>clique para registrar a consulta</span>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {vis.length === 0 && (
                  <div style={{ display: "grid", placeItems: "center", gap: 12, background: "#fff", border: "2px dashed #d6d5d6", borderRadius: 14, padding: "50px 20px" }}>
                    <span style={{ ...fr(72, 700), fontSize: 24, color: INK }}>Nada encontrado</span>
                    <span style={{ font: "400 15px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
                      {soInativas ? "Nenhuma pasta vaga ou sem consulta há 2+ anos." : modo === "pasta" ? "Confira o número da pasta." : "Que tal cadastrar como novo cliente?"}
                    </span>
                    <button type="button" className="r2chip" onClick={() => abrirForm()} style={{ border: 0, borderRadius: 999, padding: "13px 18px", cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: AMARELO, color: INK }}>
                      Cadastrar cliente
                    </button>
                  </div>
                )}

                {vis.slice(0, limite).map((c) => {
                  const aberto = abertoId === c.id;
                  const ina = inativo(c);
                  const ultima = c.consultas[0];
                  return (
                    <div key={c.id} style={{ flex: "none", overflow: "hidden", background: "#fff", borderRadius: 14, boxShadow: SOMBRA_CARD, borderLeft: `8px solid ${ina ? AMARELO : aberto ? INK : "#e0e0e0"}` }}>
                      <button type="button" className="r2row" onClick={() => abrir(c)}
                        style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", textAlign: "left", background: "transparent", border: 0, padding: "16px 20px", cursor: "pointer" }}>
                        <span style={{ ...fr(48, 700), flex: "none", width: 52, height: 52, display: "grid", placeItems: "center", borderRadius: 12, background: aberto ? AMARELO : INK, fontSize: 20, color: aberto ? INK : AMARELO }}>
                          {(c.gaveta || "?").replace(/^GAVETA\s*/i, "")}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <span style={{ ...fr(72, 700), fontSize: 21, lineHeight: 1.1, letterSpacing: "-.02em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</span>
                            {ina && (
                              <span style={{ flex: "none", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "5px 8px 3px", borderRadius: 999, background: AMARELO, color: INK }}>
                                {c.vaga ? "Pasta vaga" : "Inativo"}
                              </span>
                            )}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 7 }}>
                            <span style={{ font: `600 13.5px/1 ${MONO}`, letterSpacing: ".06em", color: "#8d8b8d" }}>CÓD. {c.codigo}</span>
                            <span style={{ font: "500 13.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{c.gaveta}</span>
                            <span style={{ font: "500 13.5px/1 Inter,sans-serif", color: "#b3b1b3" }}>{c.pasta ? `cód. ${c.pasta}` : "sem código"}</span>
                          </span>
                        </span>
                        {ultima && (
                          <span style={{ flex: "none", font: `600 13.5px/1 ${MONO}`, padding: "8px 11px", borderRadius: 999, background: "#f1f1f1", color: "#5c5a5c", whiteSpace: "nowrap" }}>{dataBR(ultima)}</span>
                        )}
                      </button>

                      {aberto && (
                        <div style={{ borderTop: "1px solid #f1f1f1", background: "#fafafa", padding: "16px 20px 18px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
                            {[
                              { k: "Gaveta", v: c.gaveta || "—" },
                              { k: "Código", v: String(c.codigo) },
                              { k: "Etiqueta", v: c.pasta || "—" },
                              { k: "Observação", v: c.obs || "—" },
                            ].map((i) => (
                              <div key={i.k}>
                                <div style={{ font: `600 12px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3" }}>{i.k}</div>
                                <div style={{ font: "600 15px/1.35 Inter,sans-serif", color: INK, marginTop: 7 }}>{i.v}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ font: `600 12px/1 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#b3b1b3", margin: "16px 0 9px" }}>Últimas 5 consultas</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {c.consultas.length === 0 && <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#b3b1b3" }}>Sem registros anteriores.</span>}
                            {c.consultas.slice(0, 5).map((qc, i) => (
                              <span key={i} style={{ background: "#fff", borderRadius: 999, padding: "7px 11px", font: `600 13.5px/1 ${MONO}`, color: "#5c5a5c", boxShadow: "inset 0 0 0 1px #ececec" }}>{dataHora(qc)}</span>
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 7, marginTop: 16 }}>
                            <button type="button" className="r2chip" onClick={(e: MouseEvent) => { e.stopPropagation(); abrirForm(c); }}
                              style={{ display: "flex", alignItems: "center", gap: 7, border: "2px solid #e0e0e0", background: "transparent", borderRadius: 999, padding: "10px 14px", cursor: "pointer", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", color: "#5c5a5c" }}>
                              Editar
                            </button>
                            <button type="button" className="r2chip"
                              onClick={(e: MouseEvent) => { e.stopPropagation(); atualizar(lista.filter((x) => x.id !== c.id), () => { setAbertoId(null); setAviso(`${c.nome} removido do arquivo.`); }); void excluirPasta({ data: { id: c.id } }).catch((err) => { falhou(err, "Não deu para remover a pasta."); void puxarArquivo(); }); }}
                              style={{ display: "flex", alignItems: "center", gap: 7, border: 0, background: "#f1f1f1", borderRadius: 999, padding: "10px 14px", cursor: "pointer", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", color: "#5c5a5c" }}>
                              Excluir
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {vis.length > limite && (
                  <button type="button" className="r2chip" onClick={() => setLimite(limite + 60)}
                    style={{ flex: "none", border: "2px dashed #d6d5d6", background: "#fff", borderRadius: 14, padding: 18, cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: "#5c5a5c" }}>
                    Mostrar mais {Math.min(60, Math.max(0, vis.length - limite))} de {vis.length - limite} restantes
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* modal — novo/editar cliente */}
      {formAberto && (
        <div onClick={() => { setFormAberto(false); setEditId(null); }} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 64, display: "flex", alignItems: "center", justifyContent: "center", padding: 36, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 640, display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Arquivo de clichês</div>
                <div style={{ ...fr(96, 700), fontSize: 32, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>{editId ? "Editar cliente" : "Novo cliente no arquivo"}</div>
              </div>
              <button type="button" className="r2ic" onClick={() => { setFormAberto(false); setEditId(null); }} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {([
                  { v: fNome, set: setFNome, label: "Nome do cliente", placeholder: "Ex.: Padaria São João", largo: true },
                  { v: fCodigo, set: setFCodigo, label: "Código da pasta", placeholder: "2265" },
                  { v: fGaveta, set: setFGaveta, label: "Gaveta", placeholder: "GAVETA C" },
                  { v: fPasta, set: setFPasta, label: "Etiqueta", placeholder: "O-2265" },
                  { v: fObs, set: setFObs, label: "Observação", placeholder: "Ex.: etiqueta balança 40x40" },
                ]).map((f) => (
                  <div key={f.label} style={f.largo ? { gridColumn: "1 / -1" } : undefined}>
                    <label style={{ display: "block", font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 8 }}>{f.label}</label>
                    <input value={f.v} onChange={(e) => f.set(e.target.value)} placeholder={f.placeholder} style={inp} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: INK, borderRadius: 12, padding: "16px 20px" }}>
              <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d", maxWidth: 300 }}>
                {editId ? "As alterações valem para as próximas buscas do arquivo." : "O cadastro já entra com a consulta de hoje registrada."}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="r2chip" onClick={() => { setFormAberto(false); setEditId(null); }} style={{ border: 0, borderRadius: 999, padding: "13px 18px", cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", background: "#3a383a", color: "#f1f1f1" }}>Cancelar</button>
                <button type="button" className="r2chip" onClick={salvar}
                  style={{ border: 0, borderRadius: 999, padding: "13px 20px", cursor: podeSalvar ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", background: podeSalvar ? AMARELO : "#4a484a", color: podeSalvar ? INK : "#8d8b8d" }}>
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* aviso */}
      {aviso && (
        <div style={{ position: "absolute", left: "50%", bottom: 30, transform: "translateX(-50%)", zIndex: 70, display: "flex", alignItems: "center", gap: 12, background: INK, borderRadius: 999, padding: "14px 16px 14px 22px", boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
          <span style={{ font: "500 15px/1 Inter,sans-serif", color: "#f1f1f1" }}>{aviso}</span>
          <button type="button" className="r2ic" onClick={() => setAviso("")} style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: "#3a383a", border: 0, borderRadius: 999, cursor: "pointer" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>
      )}
      {children}
    </EstagioV1a>
  );
}
