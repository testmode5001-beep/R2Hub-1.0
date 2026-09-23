// Nova solicitação — v1a. Fonte: design_handoff_r2_hub/telas/Nova-solicitacao.dc.html (frame 4a).
// Formulário de arte nova em 3 colunas: cliente/matéria-prima/histórico,
// medidas+faca do catálogo/cores com sugestões Pantone/prévia da bobina,
// briefing/anexos/enviar. O modal do catálogo usa o desenho gerado pela
// medida (PDFs do acervo ainda não migrados). Sem backend: enviar limpa o
// formulário e mostra o aviso; a criação real do pedido vem via aoCriar.
import { useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import {
  AMARELO, AvisoV1a, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { criarBusca } from "@/lib/busca";
import type { CadastrosV1a, TipoCadastro } from "./dados/cadastros";
import { COR_SISTEMA, FACAS, SISTEMAS } from "./dados/facas";
import { FG_SOBRE, MEDIDAS } from "./dados/facas-cilindro";
import { sugestoesPantone } from "./dados/pantone-busca";
import { PantoneModalV1a } from "./modais/PantoneModalV1a";

const MATERIAS = ["Papel couché", "Polietileno", "Cartão couché", "Térmico", "BOPP térmico", "BOPP metalizado", "BOPP Matte", "BOPP brilho", "BOPP removível", "Nylon resinado"];
const FORMAS = ["Retangular", "Quadrada", "Oval/Elipse", "Especial", "Redonda", "GAP"];
const CORES_OPTS = ["1", "2", "3", "4", "4+PANTONE", "CMYK"];

type Faca = { cod: string; medida: string; sistema: string; secao: string };
/** `file` presente = arquivo de verdade escolhido agora; ausente = item ilustrativo
    (faca do catálogo, demo do protótipo) que NÃO sobe para o servidor. */
type Anexo = { nome: string; tam: string; file?: File };
type CorHex = { nome: string; hex: string };

export type NovaSolicitacaoDados = {
  cliente: string; medida: string; substrato: string; cores: string[]; obs: string; origem: string;
  /** arquivos escolhidos no formulário — a rota anexa ao pedido recém-criado */
  arquivos?: File[];
  /** faca escolhida no catálogo — a rota registra no briefing (não há coluna própria) */
  facaCod?: string;
  /** pasta da rede escolhida na lista; vazio = criar uma nova com o nome digitado */
  pasta?: string;
  /** campos completos do formulário — o que o createPedido do back-end precisa */
  detalhes?: {
    materia: string; largMateria: string; largura: string; altura: string; forma: string;
    cores: string; coresDesc: string; carreiras: string; descricao: string; linkRef: string;
    /** "1" quando a etiqueta leva tarja no verso */
    tarjaVerso?: string;
    /** "1" quando leva verniz */
    verniz?: string;
    /** "1" quando leva cold stamp */
    coldStamp?: string;
  };
};

const HISTORICO = [
  { num: "#0398", medida: "80x60", spec: "80×60 · BOPP brilho · 4+Pantone", quando: "12/06/26" },
  { num: "#0341", medida: "70x50", spec: "70×50 · BOPP brilho · 4 cores", quando: "28/04/26" },
  { num: "#0287", medida: "45x30", spec: "45×30 · Térmico · 1 cor", quando: "09/02/26" },
];

const ROTULO: CSSProperties = { display: "block", font: "600 14.5px/1 Inter,sans-serif", color: "#5c5a5c", marginBottom: 8 };
const INP: CSSProperties = {
  width: "100%", background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 7,
  padding: "13px 15px", font: "600 17px/1.2 Inter,sans-serif", color: INK, outline: "none",
};
const CARD: CSSProperties = { background: "#fff", borderRadius: 12, padding: "22px 24px 20px", boxShadow: SOMBRA_CARD };

function TituloCard({ paths, titulo, extra }: { paths: string[]; titulo: string; extra?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
        {paths.map((d, i) => <path key={i} d={d} />)}
      </svg>
      <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{titulo}</span>
      {extra !== undefined && <>
        <span style={{ flex: 1 }} />
        <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{extra}</span>
      </>}
    </div>
  );
}

/* desenho técnico gerado pela medida (fallback do protótipo, sem PDF) */
function desenhoFaca(f: Faca, maxW: number, maxH: number): CSSProperties {
  const nums = MEDIDAS(f.medida);
  const l = nums[0] || 50;
  const a = nums[1] || nums[0] || 50;
  const esc = Math.min(maxW / l, maxH / a);
  const w = Math.max(12, Math.round(l * esc));
  const h = Math.max(10, Math.round(a * esc));
  const redondo = f.sistema === "Redonda";
  const tag = f.sistema === "Tag";
  const tracejado = f.sistema === "Picote" || /serrilha/i.test(f.secao || "");
  const raio = redondo ? 999 : tag ? Math.round(Math.min(w, h) * 0.18) : 5;
  return {
    width: w, height: h, border: `1.5px ${tracejado ? "dashed" : "solid"} ${INK}`,
    borderRadius: raio, background: "#fff",
  };
}

function chipSistema(nome: string): CSSProperties {
  const bg = COR_SISTEMA[nome as keyof typeof COR_SISTEMA] || "#d6d5d6";
  return {
    font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase",
    padding: "6px 10px 5px", borderRadius: 999, whiteSpace: "nowrap", background: bg, color: FG_SOBRE(bg),
  };
}

export function NovaSolicitacaoV1a({
  profile, versao, aoNavegar, onNova, onLogout, aoCriar, disponiveis, children,
  cadastros, podeCadastrar, aoCadastrar,
}: {
  profile: { nome: string };
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  aoCriar?: (dados: NovaSolicitacaoDados) => { num?: string } | void;
  disponiveis?: string[];
  /** listas compartilhadas (tabela `cadastros`) que somam às opções fixas */
  cadastros?: CadastrosV1a;
  /** cadastro.materiais / cadastro.medidas / cadastro.cores */
  podeCadastrar?: { materiais?: boolean; medidas?: boolean; cores?: boolean };
  aoCadastrar?: (tipo: TipoCadastro, nome: string, extra?: string | null) => Promise<unknown>;
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
}) {
  const [cliente, setCliente] = useState("Biscoitos Vitória");
  const [materia, setMateria] = useState("BOPP brilho");
  const [largMateria, setLargMateria] = useState("620");
  const [largura, setLargura] = useState("80");
  const [altura, setAltura] = useState("60");
  const [forma, setForma] = useState("GAP");
  const [cores, setCores] = useState("4+PANTONE");
  const [coresDesc, setCoresDesc] = useState("");
  const [coresHex, setCoresHex] = useState<CorHex[]>([]);
  const [sugAberta, setSugAberta] = useState(false);
  const [extras, setExtras] = useState<string[]>([]);
  const [extrasForma, setExtrasForma] = useState<string[]>([]);
  const [carreiras, setCarreiras] = useState("2");
  const [descricao, setDescricao] = useState("");
  const [linkRef, setLinkRef] = useState("");
  /* Com backend (aoCriar) a lista COMEÇA VAZIA. Os dois arquivos de exemplo do
     protótipo faziam a vendedora acreditar que já havia anexos no pedido —
     e foi assim que um pedido real saiu com briefing citando "o anexo" sem
     anexo nenhum. Demo só quando não há criação de verdade. */
  const [anexos, setAnexos] = useState<Anexo[]>(() => aoCriar ? [] : [
    { nome: "faca-80x60-gap.pdf", tam: "412 KB" },
    { nome: "referencia-cliente.jpg", tam: "1,2 MB" },
  ]);
  const [busca, setBusca] = useState("");
  const [facaModal, setFacaModal] = useState(false);
  const [facaBusca, setFacaBusca] = useState("");
  const [facaSistema, setFacaSistema] = useState("Todos");
  const [facaCod, setFacaCod] = useState("");
  const [pantoneAberto, setPantoneAberto] = useState(false);
  const [aviso, setAviso] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);
  /* cadastro de material/formato/cor direto no formulário (cadastro.*) */
  const [cadAberto, setCadAberto] = useState<TipoCadastro | null>(null);
  const [cadNome, setCadNome] = useState("");

  const materiais = MATERIAS.concat((cadastros?.materiais ?? []).map((c) => c.nome)).concat(extras);
  const formatos = FORMAS.concat((cadastros?.medidas ?? []).map((c) => c.nome)).concat(extrasForma);
  const coresSalvas = cadastros?.cores ?? [];

  function salvarCadastro(tipo: TipoCadastro, aplicar: (nome: string) => void) {
    const nome = cadNome.trim();
    if (!nome) return;
    const fim = () => { setCadAberto(null); setCadNome(""); aplicar(nome); };
    if (!aoCadastrar) {
      if (tipo === "material") setExtras([...extras, nome]);
      if (tipo === "medida") setExtrasForma([...extrasForma, nome]);
      fim();
      return;
    }
    aoCadastrar(tipo, nome)
      .then(fim)
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para cadastrar."));
  }

  const obrig = { cliente, materia, largMateria, largura, altura, forma, cores, descricao, carreiras };
  const preenchidos = Object.values(obrig).filter((v) => String(v || "").trim().length > 0).length;
  const pct = Math.round((preenchidos / Object.keys(obrig).length) * 100);
  const valido = preenchidos === Object.keys(obrig).length;

  const chip = (on: boolean, pequeno = true): CSSProperties => ({
    width: "100%", border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 999,
    padding: pequeno ? "8px 9px" : "9px 13px", font: `600 ${pequeno ? "11px" : "12px"}/1 Inter,sans-serif`,
    whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c",
  });

  const sugCores = (() => {
    if (!sugAberta) return [];
    const v = String(coresDesc || "").split(",").pop()!.trim();
    if (v.length < 1) return [];
    const achados = sugestoesPantone(v, 6);
    if (achados.some((s) => s.nome.toLowerCase() === v.toLowerCase())) return [];
    return achados;
  })();

  const facaSel = facaCod ? (FACAS as Faca[]).find((f) => f.cod === facaCod) ?? null : null;

  const casaFaca = criarBusca(facaBusca);
  const facasFiltradas = (FACAS as Faca[]).filter((f) =>
    (facaSistema === "Todos" || f.sistema === facaSistema) &&
    casaFaca(f.cod, f.medida, f.secao));
  const facaLista = facasFiltradas.slice(0, 60);

  function escolherFaca(f: Faca) {
    const nums = String(f.medida).match(/[\d]+(?:,[\d]+)?/g) || [];
    const nome = f.cod + ".pdf";
    setFacaCod(f.cod);
    setFacaModal(false);
    if (nums[0]) setLargura(nums[0]);
    if (nums[1]) setAltura(nums[1]);
    setAnexos((atual) => atual.some((a) => a.nome === nome)
      ? atual
      : [{ nome, tam: "faca do catálogo" }, ...atual.filter((a) => !/^faca-/.test(a.nome))]);
  }

  function anexarArquivos(lista: FileList | null) {
    if (!lista || !lista.length) return;
    // guarda o File inteiro — só o nome não sobe arquivo nenhum
    const novos: Anexo[] = Array.from(lista).map((f) => ({
      nome: f.name,
      tam: f.size >= 1048576 ? (f.size / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(f.size / 1024)) + " KB",
      file: f,
    }));
    setAnexos((atual) => [...atual, ...novos.filter((n) => !atual.some((a) => a.nome === n.nome))]);
  }

  function enviar() {
    if (!valido) return;
    let listaCores = String(coresDesc || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (!listaCores.length) {
      const n = parseInt(cores, 10);
      listaCores = Number.isFinite(n) ? Array.from({ length: n }, (_, i) => "Cor " + (i + 1)) : ["Preto"];
    }
    const criado = aoCriar?.({
      cliente: cliente || "Cliente novo",
      medida: `${largura || "?"}x${altura || "?"}`,
      substrato: materia || "—",
      cores: listaCores,
      obs: descricao || "",
      origem: "vendas",
      arquivos: anexos.map((a) => a.file).filter((f): f is File => !!f),
      facaCod,
      detalhes: { materia, largMateria, largura, altura, forma, cores, coresDesc, carreiras, descricao, linkRef },
    });
    setCliente(""); setMateria(""); setLargMateria(""); setLargura(""); setAltura("");
    setForma(""); setCores(""); setCoresDesc(""); setCarreiras(""); setDescricao("");
    setLinkRef(""); setAnexos([]); setFacaCod(""); setCoresHex([]);
    setAviso(`Solicitação ${criado?.num ?? ""} enviada — entrou na fila do design.`.replace("  ", " "));
  }

  /* prévia da bobina */
  const previa = (() => {
    const l = Math.max(1, Number(largura) || 80);
    const a = Math.max(1, Number(altura) || 60);
    const n = Math.max(1, Math.min(8, Number(carreiras) || 1));
    const redondo = /redonda|oval/i.test(forma || "");
    const esq = 1.5;
    const bobinaMm = Math.max((l + 3) * n, Number(largMateria) || 0);
    const esc = Math.min(260 / bobinaMm, 140 / (a + 2 * esq));
    const w = Math.max(6, Math.round(l * esc)), h = Math.max(6, Math.round(a * esc));
    const gap = Math.max(2, Math.round(esq * esc));
    return {
      w, h, gap, n, redondo,
      bobinaW: Math.round(bobinaMm * esc),
      texto: `${largura || "?"} × ${altura || "?"}`,
    };
  })();
  const previaCarreiras = (() => {
    const l = Number(largura) || 0;
    const n = Math.max(1, Number(carreiras) || 1);
    const usado = (l + 3) * n;
    const bob = Number(largMateria) || 0;
    const sobra = bob - usado;
    return `(${l} + 3) × ${n} = ${usado} mm` + (bob ? ` de ${bob} mm` + (sobra >= 0 ? ` · sobra ${sobra} mm` : ` · excede ${Math.abs(sobra)} mm`) : "");
  })();

  const chipAdd = (titulo: string, onClick: () => void) => (
    <button onClick={onClick} className="r2chip" title={titulo}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", border: "2px dashed #d6d5d6", cursor: "pointer", borderRadius: 999, padding: "8px 9px", font: "600 13.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: "transparent", color: "#8d8b8d" }}>
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={3} strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
      adicionar
    </button>
  );

  /** Campo que aparece no lugar do "adicionar" enquanto se digita o nome. */
  const campoCadastro = (tipo: TipoCadastro, aplicar: (nome: string) => void) => (
    <input autoFocus value={cadNome}
      onChange={(e) => setCadNome(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") salvarCadastro(tipo, aplicar);
        if (e.key === "Escape") { setCadAberto(null); setCadNome(""); }
      }}
      onBlur={() => salvarCadastro(tipo, aplicar)}
      placeholder="nome e Enter"
      style={{ width: "100%", border: `2px solid ${INK}`, borderRadius: 999, padding: "8px 10px", font: "600 11px/1 Inter,sans-serif", color: INK, background: "#fff", outline: "none" }} />
  );

  return (
    <EstagioV1a>
      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}

      <TopbarV1a nome={profile.nome} busca={busca} aoBuscar={setBusca}
        onMensagens={() => {}} onAnotacoes={() => {}} onNotificacoes={() => {}} onConfig={() => {}} onSair={() => onLogout?.()} />

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
        <RailV1a ativo="" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 6px 8px" }}>
            <div>
              <h1 style={{ ...fr(144, 900), fontSize: 56, lineHeight: 1, letterSpacing: "-.02em", textIndent: "-.045em", whiteSpace: "nowrap", color: INK, margin: 0 }}>Nova solicitação</h1>
              <div style={{ font: "400 15px/1 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>Arte nova · a pasta do cliente é criada automaticamente na rede</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ font: "600 14.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#8d8b8d" }}>{pct}% preenchido</span>
              <div style={{ width: 200, height: 6, background: "#e0e0e0", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: AMARELO, borderRadius: 999, transition: "width .2s ease" }} />
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, alignItems: "stretch" }}>

            {/* coluna 1 — cliente / matéria-prima / histórico */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={CARD}>
                <TituloCard paths={["M3.5 20.5h17", "M4.5 20.5V9l7.5-5 7.5 5v11.5", "M10 20.5v-5h4v5"]} titulo="Dados do cliente" />
                <label style={ROTULO}>Nome do cliente <span style={{ color: INK }}>*</span></label>
                <input value={cliente} onChange={(e) => setCliente(e.target.value)} className="inp" style={INP} placeholder="Ex.: Biscoitos Vitória" />
                <p style={{ font: "400 13.5px/1.4 Inter,sans-serif", color: "#b3b1b3", margin: "10px 0 0" }}>Se for cliente novo, a pasta dele será criada automaticamente na rede.</p>
              </div>

              <div style={CARD}>
                <TituloCard paths={["M12 3 3 8l9 5 9-5-9-5z", "M3 12.5l9 5 9-5", "M3 17l9 5 9-5"]} titulo="Matéria-prima" />
                <label style={{ ...ROTULO, marginBottom: 10 }}>Material <span style={{ color: INK }}>*</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {materiais.map((m) => (
                    <button key={m} onClick={() => setMateria(m)} className="r2chip" style={chip(materia === m)}>{m}</button>
                  ))}
                  {/* cadastro.materiais — sem a permissão o botão nem aparece */}
                  {podeCadastrar?.materiais && (cadAberto === "material"
                    ? campoCadastro("material", setMateria)
                    : chipAdd("Cadastrar matéria-prima", () => { setCadAberto("material"); setCadNome(""); }))}
                </div>
                <label style={{ ...ROTULO, margin: "18px 0 8px" }}>Largura da matéria-prima (mm) <span style={{ color: INK }}>*</span></label>
                <input value={largMateria} onChange={(e) => setLargMateria(e.target.value)} className="inp" style={INP} placeholder="Ex.: 620" />
              </div>

              <div style={{ ...CARD, flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", padding: "22px 24px 18px" }}>
                <div style={{ flex: "none" }}>
                  <TituloCard paths={["M12 7.5v5l3.5 2", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"]} titulo="Histórico do cliente" extra="clique para copiar as medidas" />
                </div>
                {HISTORICO.map((h, i) => (
                  <button key={h.num} className="r2row"
                    onClick={() => { const [l, a] = h.medida.split("x"); setLargura(l); setAltura(a); }}
                    style={{ flex: 1, minHeight: 44, display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: 0, borderRadius: 5, padding: "8px 2px", cursor: "pointer", borderBottom: i === HISTORICO.length - 1 ? 0 : "1px solid #f1f1f1" }}>
                    <span style={{ flex: "0 0 4px", height: 22, borderRadius: 1, background: "#d6d5d6" }} />
                    <span style={{ font: `500 14.5px/1 ${MONO}`, color: "#8d8b8d", whiteSpace: "nowrap" }}>{h.num}</span>
                    <span style={{ flex: 1, minWidth: 0, font: "600 15px/1.2 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.spec}</span>
                    <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{h.quando}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* coluna 2 — medidas / cores / prévia */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={CARD}>
                <TituloCard paths={["M3 16.5 16.5 3l4.5 4.5L7.5 21z", "M7.5 8.5 10 11", "M11 5 13.5 7.5", "M4.5 11.5 7 14"]} titulo="Medidas da etiqueta" />
                <label style={ROTULO}>Faca do catálogo</label>
                {!facaSel ? (
                  <button onClick={() => setFacaModal(true)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "#fafafa", border: "2px dashed #d6d5d6", borderRadius: 8, padding: "13px 14px", cursor: "pointer", textAlign: "left" }}>
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M6.5 6.5 20 20" /><path d="M20 4 10.5 13.5" /><path d="M6 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" /><path d="M6 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" /></svg>
                    <span style={{ flex: 1, font: "500 15px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>Buscar no catálogo de facas e anexar ao pedido</span>
                    <span style={{ flex: "none", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: INK, background: AMARELO, borderRadius: 999, padding: "7px 11px" }}>buscar</span>
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#f1f1f1", borderRadius: 8, padding: "10px 12px 10px 10px" }}>
                    <div style={{ flex: "none", width: 54, height: 54, background: "#fff", borderRadius: 6, display: "grid", placeItems: "center", overflow: "hidden" }}>
                      <div style={desenhoFaca(facaSel, 42, 42)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ ...fr(48, 700), fontSize: 19, lineHeight: 1, letterSpacing: "-.02em", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{facaSel.medida}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                        <span style={{ font: `500 12.5px/1 ${MONO}`, color: "#8d8b8d" }}>{facaSel.cod}</span>
                        <span style={chipSistema(facaSel.sistema)}>{facaSel.sistema}</span>
                      </div>
                    </div>
                    <button onClick={() => setFacaModal(true)} className="r2chip" style={{ flex: "none", background: "#fff", border: 0, borderRadius: 999, padding: "9px 13px", cursor: "pointer", font: "600 13.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>Trocar</button>
                    <button onClick={() => setFacaCod("")} title="Remover faca" style={{ flex: "none", width: 28, height: 28, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 5, cursor: "pointer" }}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 18 }}>
                  <div>
                    <label style={ROTULO}>Largura (mm) <span style={{ color: INK }}>*</span></label>
                    <input value={largura} onChange={(e) => setLargura(e.target.value)} className="inp" style={INP} placeholder="80" />
                  </div>
                  <div>
                    <label style={ROTULO}>Altura (mm) <span style={{ color: INK }}>*</span></label>
                    <input value={altura} onChange={(e) => setAltura(e.target.value)} className="inp" style={INP} placeholder="60" />
                  </div>
                </div>
                <label style={{ ...ROTULO, margin: "18px 0 10px" }}>Formato <span style={{ color: INK }}>*</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {formatos.map((m) => (
                    <button key={m} onClick={() => setForma(m)} className="r2chip" style={chip(forma === m)}>{m}</button>
                  ))}
                  {/* cadastro.medidas */}
                  {podeCadastrar?.medidas && (cadAberto === "medida"
                    ? campoCadastro("medida", setForma)
                    : chipAdd("Cadastrar medida/formato", () => { setCadAberto("medida"); setCadNome(""); }))}
                </div>
                <label style={{ ...ROTULO, margin: "18px 0 8px" }}>Quantidade de carreiras <span style={{ color: INK }}>*</span></label>
                <input value={carreiras} onChange={(e) => setCarreiras(e.target.value)} className="inp" style={INP} placeholder="Ex.: 2" />
              </div>

              <div style={CARD}>
                <TituloCard paths={["M12 3.5s6 6.2 6 10.2a6 6 0 0 1-12 0c0-4 6-10.2 6-10.2z"]} titulo="Cores de impressão" />
                <label style={{ ...ROTULO, marginBottom: 10 }}>Número de cores <span style={{ color: INK }}>*</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {CORES_OPTS.map((m) => (
                    <button key={m} onClick={() => setCores(m)} className="r2chip" style={chip(cores === m, false)}>{m}</button>
                  ))}
                </div>
                <label style={{ ...ROTULO, margin: "18px 0 8px" }}>Especificação (opcional)</label>
                <div style={{ position: "relative" }}>
                  <input value={coresDesc}
                    onChange={(e) => { setCoresDesc(e.target.value); setSugAberta(true); }}
                    onFocus={() => setSugAberta(true)}
                    onBlur={() => setTimeout(() => setSugAberta(false), 120)}
                    className="inp" style={INP} placeholder="Ex.: 485, Pantone 185 C, preto" />
                  {sugCores.length > 0 && (
                    <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 6px)", zIndex: 8, display: "flex", flexDirection: "column", gap: 2, background: "#fff", borderRadius: 9, padding: 6, boxShadow: "0 20px 40px -18px rgba(0,0,0,.45), 0 0 0 1px #ececec" }}>
                      {sugCores.map((s) => (
                        <button key={s.nome}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const partes = String(coresDesc || "").split(",");
                            partes[partes.length - 1] = " " + s.nome;
                            setSugAberta(false);
                            setCoresDesc(partes.join(",").replace(/^\s+/, ""));
                            setCoresHex([...coresHex, { nome: s.nome, hex: s.hex }]);
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
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <button onClick={(e) => { e.stopPropagation(); setPantoneAberto(true); }} className="r2chip"
                    style={{ display: "flex", alignItems: "center", gap: 7, border: "2px solid #e0e0e0", background: "transparent", borderRadius: 999, padding: "9px 14px", cursor: "pointer", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", color: "#5c5a5c" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a4 4 0 1 1 0-8h4.5a4.5 4.5 0 0 0 0-5z" /></svg>
                    Tabela Pantone
                  </button>
                  <span style={{ font: "400 13.5px/1.3 Inter,sans-serif", color: "#b3b1b3" }}>ou escreva o nome da cor acima</span>
                </div>

                {/* Cores da casa: as que a equipe cadastrou (cadastro.cores). */}
                {(coresSalvas.length > 0 || podeCadastrar?.cores) && (
                  <>
                    <label style={{ ...ROTULO, margin: "18px 0 8px" }}>Cores da casa</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {coresSalvas.map((c) => (
                        <button key={c.id} className="r2chip"
                          onClick={() => {
                            const atual = String(coresDesc || "").trim();
                            setCoresDesc(atual ? atual + ", " + c.nome : c.nome);
                            setCoresHex([...coresHex, { nome: c.nome, hex: c.extra || "#d6d5d6" }]);
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 7, border: "2px solid #e0e0e0", background: "transparent", borderRadius: 999, padding: "7px 12px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", whiteSpace: "nowrap", color: "#5c5a5c" }}>
                          <span style={{ flex: "none", width: 14, height: 14, borderRadius: 4, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.14)", background: c.extra || "#d6d5d6" }} />
                          {c.nome}
                        </button>
                      ))}
                      {podeCadastrar?.cores && (cadAberto === "cor" ? (
                        <div style={{ width: 180 }}>
                          {campoCadastro("cor", (nome) => {
                            const atual = String(coresDesc || "").trim();
                            setCoresDesc(atual ? atual + ", " + nome : nome);
                          })}
                        </div>
                      ) : (
                        <button onClick={() => { setCadAberto("cor"); setCadNome(String(coresDesc || "").split(",").pop()!.trim()); }}
                          className="r2chip" title="Cadastrar cor para a equipe"
                          style={{ display: "flex", alignItems: "center", gap: 6, border: "2px dashed #d6d5d6", background: "transparent", borderRadius: 999, padding: "7px 12px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", whiteSpace: "nowrap", color: "#8d8b8d" }}>
                          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={3} strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                          cadastrar cor
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {coresHex.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                    {coresHex.map((c, i) => (
                      <button key={c.nome + i} title="Remover cor"
                        onClick={() => {
                          const resto = coresHex.filter((_, j) => j !== i);
                          setCoresHex(resto);
                          setCoresDesc(resto.map((x) => x.nome).join(", "));
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 7, background: "#f1f1f1", border: 0, borderRadius: 999, padding: "7px 11px", cursor: "pointer", font: "600 13.5px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap" }}>
                        <span style={{ flex: "none", width: 16, height: 16, borderRadius: 4, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.14)", background: c.hex }} />
                        {c.nome}
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ ...CARD, flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x={3} y={6} width={18} height={12} rx={2} /><path d="M3 10.5h18" /></svg>
                  <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Prévia da etiqueta</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: "600 13.5px/1 Inter,sans-serif", color: "#8d8b8d", whiteSpace: "nowrap" }}>{(forma || "").toUpperCase()}</span>
                </div>
                <div style={{ flex: 1, display: "grid", placeItems: "center", background: "#fafafa", borderRadius: 8, padding: 18, minHeight: 150 }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "center", width: previa.bobinaW, padding: previa.gap, borderRadius: 5, border: "2px dashed #d6d5d6", background: "#f1f1f1" }}>
                    <div style={{ display: "flex", gap: previa.gap * 2, alignItems: "center" }}>
                      {Array.from({ length: previa.n }, (_, i) => (
                        <div key={i} style={{ display: "grid", placeItems: "center", background: "#fff", border: `2px solid ${INK}`, width: previa.w, height: previa.h, borderRadius: previa.redondo ? 999 : 8 }}>
                          {i === 0 && <span style={{ font: `600 ${previa.w < 70 ? 11 : 12}px/1 Inter,sans-serif`, color: "#8d8b8d", letterSpacing: ".06em", whiteSpace: "nowrap" }}>{previa.texto}</span>}
                        </div>
                      ))}
                    </div>
                    <span style={{ position: "absolute", left: 0, right: 0, bottom: -18, textAlign: "center", font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3" }}>bobina {largMateria} mm</span>
                  </div>
                </div>
                <div style={{ font: "400 13.5px/1.3 Inter,sans-serif", color: "#b3b1b3", marginTop: 12 }}>Esqueleto de 1,5 mm nas laterais e entre carreiras · {previaCarreiras}</div>
              </div>
            </div>

            {/* coluna 3 — briefing / anexos / enviar */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={CARD}>
                <TituloCard paths={["M20.5 12a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3.5 21l1.6-4.3A8.5 8.5 0 1 1 20.5 12z"]} titulo="Briefing da arte" />
                <label style={ROTULO}>Descrição / instruções <span style={{ color: INK }}>*</span></label>
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="inp"
                  style={{ ...INP, minHeight: 104, resize: "vertical" }} placeholder="Descreva a arte: logo, textos, referências..." />
                <label style={{ ...ROTULO, margin: "16px 0 8px" }}>Link de referência (opcional)</label>
                <input value={linkRef} onChange={(e) => setLinkRef(e.target.value)} className="inp" style={INP} placeholder="https://..." />
              </div>

              <div style={{ ...CARD, flex: 1, display: "flex", flexDirection: "column" }}>
                <TituloCard paths={["M20.5 12.5 12 21a4.9 4.9 0 0 1-7-7l8-8a3.3 3.3 0 0 1 4.7 4.7l-8 8a1.7 1.7 0 0 1-2.4-2.4l7.2-7.2"]} titulo="Anexos" />
                <input ref={arquivoRef} type="file" multiple style={{ display: "none" }}
                  onChange={(e) => { anexarArquivos(e.target.files); e.target.value = ""; }} />
                <button onClick={() => arquivoRef.current?.click()}
                  style={{ flex: 1, minHeight: 120, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "#fafafa", border: "2px dashed #d6d5d6", borderRadius: 8, padding: "22px 16px", cursor: "pointer" }}>
                  <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5.5" /><path d="m8 9.5 4-4 4 4" /><path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" /></svg>
                  <span style={{ font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d", textAlign: "center" }}>Clique para anexar arquivos<br />(faca, referências, fotos, PDF, AI, CDR...)</span>
                </button>
                {anexos.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                    {anexos.map((a, i) => (
                      <div key={a.nome} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f1f1f1", borderRadius: 6, padding: "9px 12px" }}>
                        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                        <span style={{ flex: 1, minWidth: 0, font: "500 14.5px/1.2 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</span>
                        <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#8d8b8d", whiteSpace: "nowrap" }}>{a.tam}</span>
                        <button onClick={() => setAnexos(anexos.filter((_, j) => j !== i))}
                          style={{ width: 22, height: 22, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 4, cursor: "pointer" }}>
                          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={enviar}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", border: 0, borderRadius: 8, padding: "17px 20px", cursor: valido ? "pointer" : "not-allowed", font: "700 15px/1 Inter,sans-serif", background: AMARELO, color: INK, opacity: valido ? 1 : 0.55 }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 3 10.5 13.5" /><path d="M21 3l-7 18-3.5-7.5L3 10z" /></svg>
                <span style={{ lineHeight: "18px" }}>{valido ? "Enviar solicitação" : "Preencha os campos obrigatórios"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* modal — tabela Pantone */}
      {pantoneAberto && (
        <PantoneModalV1a
          fechar={() => setPantoneAberto(false)}
          onEscolher={(nome, hexCor) => {
            const atual = String(coresDesc || "").trim();
            setPantoneAberto(false);
            setCoresDesc(atual ? atual + ", " + nome : nome);
            setCoresHex([...coresHex, { nome, hex: hexCor || "#d6d5d6" }]);
          }}
        />
      )}

      {/* modal — catálogo de facas */}
      {facaModal && (
        <div onClick={() => setFacaModal(false)} data-modal-esc
          style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 26, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 1420, maxWidth: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 16, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>
                  Catálogo de facas · {facasFiltradas.length} {facasFiltradas.length === 1 ? "faca" : "facas"}
                </div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10, whiteSpace: "nowrap" }}>Anexar faca ao pedido</div>
              </div>
              <button onClick={() => setFacaModal(false)} className="r2ic" style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: "0 0 320px", display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 7, padding: "0 16px" }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.4} strokeLinecap="round" style={{ flex: "none" }}><circle cx={11} cy={11} r={7} /><path d="m20 20-3.5-3.5" /></svg>
                <input value={facaBusca} onChange={(e) => setFacaBusca(e.target.value)} placeholder="Código ou medida"
                  style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", font: "400 15px/1 Inter,sans-serif", color: INK, padding: "14px 0" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["Todos", ...SISTEMAS].map((nome) => (
                  <button key={nome} onClick={() => setFacaSistema(nome)} className="r2chip"
                    style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "10px 14px", font: "600 14.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: facaSistema === nome ? INK : "#fff", color: facaSistema === nome ? AMARELO : "#5c5a5c" }}>
                    {nome}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 2 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                {facaLista.map((f) => (
                  <button key={f.cod} onClick={() => escolherFaca(f)} className="r2row"
                    style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: `2px solid ${facaCod === f.cod ? INK : "#fff"}`, borderRadius: 10, padding: 10, cursor: "pointer" }}>
                    <div style={{ position: "relative", height: 168, background: "#fafafa", borderRadius: 7, overflow: "hidden", display: "grid", placeItems: "center" }}>
                      <span style={{ position: "absolute", top: 9, left: 9, zIndex: 1, ...chipSistema(f.sistema) }}>{f.sistema}</span>
                      <div style={desenhoFaca(f, 150, 120)} />
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "12px 4px 2px" }}>
                      <span style={{ flex: 1, minWidth: 0, ...fr(48, 700), fontSize: 19, lineHeight: 1, letterSpacing: "-.02em", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{f.medida}</span>
                      <span style={{ flex: "none", font: `500 12.5px/1 ${MONO}`, color: "#8d8b8d" }}>{f.cod}</span>
                    </div>
                  </button>
                ))}
              </div>
              {facasFiltradas.length === 0 && (
                <div style={{ padding: "60px 0", textAlign: "center", font: "400 15px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>Nenhuma faca encontrada com esse filtro.</div>
              )}
            </div>
            <div style={{ font: "400 13.5px/1.4 Inter,sans-serif", color: "#8d8b8d", padding: "0 4px" }}>Ao escolher, o código da faca vai no briefing do pedido e as medidas da etiqueta são preenchidas automaticamente.</div>
          </div>
        </div>
      )}
      {children}
    </EstagioV1a>
  );
}
