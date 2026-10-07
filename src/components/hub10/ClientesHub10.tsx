// Clientes no molde do hub atual (Augusto, 02/10/2026: "página clientes
// também, para o novo design"; mesma estrutura). O conteúdo e as ações são os
// da tela antiga (ClientesV1a): as pastas da rede lidas ao vivo, a busca do
// hub (sem acento, sem caixa), o que há dentro de cada pasta, os desenhos,
// ver na tela, baixar e copiar o caminho.
//
// SÓ LEITURA: nada nesta tela grava, renomeia ou apaga no share. A miniatura
// de cada arquivo fica em data/miniaturas-clientes, a pasta do hub.
//
// A casca, na grade:
// - as pastas no painel de 440 na c1 (o das pessoas na Equipe), da linha 9 à 51;
// - a pasta aberta no painel da c7 à c23, com a tinta na c8; a lista vai até a
//   c17 e a área do PDF ocupa da c18 (onde começa a pesquisa do topo) à c22;
// - no pé, "Clientes" em Fraunces 104 com a tinta na c1 e a base na linha 63,
//   "Lista" e "Desenhos" em pílula (a escolhida acesa no amarelo do hub) e
//   "Copiar caminho" terminando na c23.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AMARELO, BarraTopoHub10, FR, FUNDO_PAGINA, INTER, LINHA_DA_GRADE_HUB, NIVEL, PRETO, PalcoFixo, useEscDoTopo, vigiarRolagem } from "./ChromeHub10";
import { tituloDoPeV4 } from "./CapaV4Hub10";
import { baseFraunces, baseInter, folgaFR, folgaIN } from "./grade-hub10";
import { AvisoV1a } from "../v1a/HubV1a";
import {
  TETO_LISTA, copiarCaminho, corDaExtensao, daParaMiniatura, daParaVer, dataBR, ehDesenho, ehImagem, ext, miniaturaDe, naFila,
  type Arquivo, type Conteudo,
} from "../v1a/ClientesV1a";
import { criarBusca } from "@/lib/busca";
import { colherBusca } from "@/lib/busca-semente";
import { erroLegivel } from "@/lib/erro-legivel";
import { base64ToBlob, fmtTamanho, salvarBlob } from "@/lib/files";
import { pdfPaginas } from "@/lib/pdf-preview";
import { listPastasClientes } from "@/lib/api/clientes.functions";
import { abrirPastaCliente, baixarArquivoCliente } from "@/lib/api/pasta-cliente.functions";
import type { SessionUser } from "@/lib/session";

const LG = LINHA_DA_GRADE_HUB;
const TOPO = 9 * LG;
const PE_PAINEL = 51 * LG;
/* a pesquisa e a lista das pastas terminam em 480, na mesma coluna do HOME
   da barra do topo (Augusto, 05/10/2026: "assim fica alinhado com rail home") */
const LISTA = { x: 80, w: 440, tinta: 128, fim: 480 };
const MIOLO = { x: 560, w: 1280, tinta: 640, fim: 1760, fimLista: 1360 };
/* a área do PDF ("vamos no final deixar uma área para abrir o pdf"): da c18,
   a coluna onde começa a pesquisa do topo, à borda direita do painel ("use
   toda a área sinalizada") */
const PREVIA = { x: 1440, fim: 1840 };
const CINZA = "#6f6d6f";
const CINZA_FORTE = "#5b595b";
const LINHA_SUAVE = "rgba(37,36,37,.12)";
const PILULA_ALT = 44.04;
const PILULA_BORDA = 2.21;
const TOPO_PILULA = 63 * LG - 0.85 - PILULA_ALT;
const PAINEL: CSSProperties = { position: "absolute", top: TOPO, height: PE_PAINEL - TOPO, background: "#fff", borderRadius: 20, boxShadow: "7px 7px 42px rgba(0,0,0,.2)" };
const LIMPO: CSSProperties = { background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer", color: PRETO, textAlign: "left" };
const PILULA_PE: CSSProperties = {
  height: PILULA_ALT, boxSizing: "border-box", border: `${PILULA_BORDA}px solid ${PRETO}`, borderRadius: 999,
  display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "2px 22px 0", fontFamily: INTER, fontSize: 20.5, fontWeight: 500,
  letterSpacing: "-.014em", color: PRETO, whiteSpace: "nowrap", cursor: "pointer",
};
/* as setas de página no pé da área do PDF */
const SETA_PAGINA: CSSProperties = {
  flex: "none", width: 28, height: 28, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center",
  background: "transparent", border: `1.5px solid ${PRETO}`, borderRadius: 999,
};
const PILULA_PEQ: CSSProperties = {
  display: "inline-flex", alignItems: "center", height: 32, boxSizing: "border-box", padding: "1px 14px 0", border: `1.5px solid ${PRETO}`, borderRadius: 999,
  fontFamily: INTER, fontSize: 15, fontWeight: 500, color: PRETO, whiteSpace: "nowrap", cursor: "pointer", flex: "none",
};

function frEm(texto: string, corpo: number, x: number, base: number): CSSProperties {
  return {
    position: "absolute", left: x - folgaFR(corpo, texto.charAt(0)), top: base - baseFraunces(corpo, corpo),
    ...FR, fontSize: corpo, lineHeight: `${corpo}px`, letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO,
  };
}
function interEm(texto: string, corpo: number, x: number, base: number, lh: number, peso = 400): CSSProperties {
  return {
    position: "absolute", left: x - folgaIN(peso, corpo, texto.charAt(0)), top: base - baseInter(corpo, lh),
    fontFamily: INTER, fontSize: corpo, fontWeight: peso, lineHeight: `${lh}px`, color: PRETO,
  };
}

/** A etiqueta do tipo do arquivo (o olho acha o PDF no meio dos .ai), em minúsculas. */
function TipoArquivo({ nome }: { nome: string }) {
  const e = ext(nome);
  const cor = corDaExtensao(e);
  return (
    <span style={{ flex: "none", display: "grid", placeItems: "center", minWidth: 42, height: 24, padding: "0 6px", boxSizing: "border-box", borderRadius: 6, background: cor.fundo, color: cor.texto,
      fontFamily: INTER, fontSize: 12.5, fontWeight: 700 }}>{e || "?"}</span>
  );
}

/** Cartão dos desenhos: a miniatura só é buscada quando o cartão chega perto da tela. */
function CartaoArquivo({ arquivo, pasta, caminho, ocupado, aoVer, aoBaixar }: {
  arquivo: Arquivo; pasta: string; caminho: string; ocupado: boolean;
  /** um clique mostra na área do PDF; o duplo (`grande`) abre o visualizador */
  aoVer: (a: Arquivo, grande?: boolean) => void; aoBaixar: (a: Arquivo) => void;
}) {
  const [png, setPng] = useState<string | null>(null);
  const [estado, setEstado] = useState<"espera" | "desenhando" | "sem">("espera");
  const caixa = useRef<HTMLDivElement>(null);
  const podeVer = daParaVer(arquivo.nome);
  useEffect(() => {
    setPng(null);
    if (!daParaMiniatura(arquivo.nome)) { setEstado("sem"); return; }
    setEstado("espera");
    const el = caixa.current;
    if (!el) return;
    let vivo = true;
    const olho = new IntersectionObserver((entradas) => {
      if (!entradas[0]?.isIntersecting) return;
      olho.disconnect();
      setEstado("desenhando");
      naFila(() => miniaturaDe(pasta, caminho, arquivo.nome))
        .then((d) => { if (vivo) { setPng(d); setEstado("espera"); } })
        .catch(() => { if (vivo) setEstado("sem"); });
    }, { rootMargin: "300px" });
    olho.observe(el);
    return () => { vivo = false; olho.disconnect(); };
  }, [pasta, caminho, arquivo.nome]);
  return (
    <div ref={caixa} role="button" tabIndex={0} title={arquivo.nome}
      onClick={() => aoVer(arquivo)}
      onDoubleClick={() => (podeVer ? aoVer(arquivo, true) : aoBaixar(arquivo))}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); aoVer(arquivo); } }}
      className="p10-flat" style={{ display: "flex", flexDirection: "column", gap: 8, borderRadius: 12, padding: 10, cursor: "pointer", background: ocupado ? AMARELO : FUNDO_PAGINA }}>
      <div style={{ position: "relative", aspectRatio: "4 / 3", display: "grid", placeItems: "center", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        {png ? <img src={png} alt={arquivo.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          : <span style={{ fontFamily: INTER, fontSize: 13, fontWeight: 600, color: CINZA }}>{estado === "desenhando" ? "Desenhando…" : ext(arquivo.nome) || "arquivo"}</span>}
        <span style={{ position: "absolute", left: 6, top: 6 }}><TipoArquivo nome={arquivo.nome} /></span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: INTER, fontSize: 14, fontWeight: 600, lineHeight: "18px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{arquivo.nome}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ flex: 1, fontFamily: INTER, fontSize: 12.5, color: CINZA, whiteSpace: "nowrap" }}>{fmtTamanho(arquivo.tamanho)}, {dataBR(arquivo.modificado)}</span>
          <button type="button" onClick={(ev) => { ev.stopPropagation(); aoBaixar(arquivo); }}
            style={{ ...LIMPO, fontFamily: INTER, fontSize: 13, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>Baixar</button>
        </div>
      </div>
    </div>
  );
}

export function ClientesHub10({ profile, aoNavegar, onNova, onLogout, disponiveis, children }: {
  profile: SessionUser;
  aoNavegar: (pagina: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  children?: ReactNode;
}) {
  const [pastas, setPastas] = useState<string[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState<string>("");
  const [pasta, setPasta] = useState<string | null>(null);
  const [caminho, setCaminho] = useState("");
  const [conteudo, setConteudo] = useState<Conteudo | null>(null);
  const [carregandoPasta, setCarregandoPasta] = useState(false);
  const [buscaArquivo, setBuscaArquivo] = useState("");
  /* lista ou desenhos: a escolha fica gravada no computador (é jeito de trabalhar) */
  const [modo, setModo] = useState<"lista" | "grade">(() => {
    if (typeof window === "undefined") return "lista";
    try { return localStorage.getItem("r2_clientes_modo") === "grade" ? "grade" : "lista"; } catch { return "lista"; }
  });
  useEffect(() => { try { localStorage.setItem("r2_clientes_modo", modo); } catch { /* modo anônimo */ } }, [modo]);
  const [vendo, setVendo] = useState<{ url: string; nome: string; mime: string } | null>(null);
  const [paginas, setPaginas] = useState<{ imagens: string[]; total: number } | "falhou" | null>(null);
  const [ocupado, setOcupado] = useState("");
  /* a cópia do caminho responde na própria pílula (era um balão do sonner,
     herdado do hub antigo, que saiu em 05/10/2026) */
  const [copiado, setCopiado] = useState(false);
  const tCopiado = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tCopiado.current) clearTimeout(tCopiado.current); }, []);
  const copiarDaPasta = async (c: string) => {
    const ok = await copiarCaminho(c);
    if (!ok) { setAviso(`Não deu para copiar. Selecione e copie: ${c}`); return; }
    setCopiado(true);
    if (tCopiado.current) clearTimeout(tCopiado.current);
    tCopiado.current = setTimeout(() => setCopiado(false), 2000);
  };
  const pedido = useRef(0);
  /* a área do PDF: o arquivo escolhido e as páginas desenhadas. Cada pedido
     tem número, como a pasta: o desenho de um arquivo já trocado é descartado. */
  const [previaArq, setPreviaArq] = useState<Arquivo | null>(null);
  const [previa, setPrevia] = useState<{ imagens: string[]; total: number } | "lendo" | "sem" | "falhou" | null>(null);
  const [pagPrevia, setPagPrevia] = useState(0);
  const previaPedido = useRef(0);
  const previaUrl = useRef<string | null>(null);
  const limparPrevia = useCallback(() => {
    previaPedido.current++;
    if (previaUrl.current) { URL.revokeObjectURL(previaUrl.current); previaUrl.current = null; }
    setPreviaArq(null); setPrevia(null); setPagPrevia(0);
  }, []);

  useEffect(() => {
    /* o nome plantado pela busca do topo abre a pasta aqui */
    const semente = colherBusca();
    if (semente) setBusca(semente);
    listPastasClientes()
      .then((r: { pastas: string[] }) => {
        const lista = r.pastas ?? [];
        setPastas(lista);
        if (!semente) return;
        const exata = lista.find((p) => p.toLowerCase() === semente.toLowerCase());
        if (exata) setPasta(exata);
      })
      .catch((e: unknown) => setAviso(erroLegivel(e, "Não deu para ler as pastas da rede.")))
      .finally(() => setCarregandoLista(false));
  }, []);

  /* cada ida ao share tem número: a resposta de uma pasta já abandonada é descartada */
  useEffect(() => {
    if (!pasta) { setConteudo(null); return; }
    const meu = ++pedido.current;
    setCarregandoPasta(true);
    abrirPastaCliente({ data: { pasta, caminho } })
      .then((r) => { if (meu === pedido.current) setConteudo(r as Conteudo); })
      .catch((e: unknown) => { if (meu !== pedido.current) return; setConteudo(null); setAviso(erroLegivel(e, "Não deu para abrir a pasta.")); })
      .finally(() => { if (meu === pedido.current) setCarregandoPasta(false); });
  }, [pasta, caminho]);
  useEffect(() => () => { if (vendo) URL.revokeObjectURL(vendo.url); }, [vendo]);
  /* trocou de pasta (ou saiu da tela): a área do PDF esvazia */
  useEffect(() => limparPrevia, [pasta, caminho, limparPrevia]);

  const achadas = useMemo(() => { const casa = criarBusca(busca); return pastas.filter((p) => casa(p)); }, [pastas, busca]);
  const arquivosVisiveis = useMemo(() => { if (!conteudo) return []; const casa = criarBusca(buscaArquivo); return conteudo.arquivos.filter((a) => casa(a.nome)); }, [conteudo, buscaArquivo]);
  const pastasVisiveis = useMemo(() => { if (!conteudo) return []; const casa = criarBusca(buscaArquivo); return conteudo.pastas.filter((p) => casa(p)); }, [conteudo, buscaArquivo]);
  const trilha = caminho ? caminho.split(/[\\/]+/).filter(Boolean) : [];
  const caminhoRede = conteudo ? [conteudo.raiz, ...trilha].join("\\") : "";

  const escolher = (nome: string) => { setPasta(nome); setCaminho(""); setBuscaArquivo(""); };
  const entrar = (sub: string) => { setCaminho(caminho ? `${caminho}\\${sub}` : sub); setBuscaArquivo(""); };
  const irPara = (i: number) => { setCaminho(trilha.slice(0, i + 1).join("\\")); setBuscaArquivo(""); };
  const buscarArquivo = async (a: Arquivo) => {
    if (!pasta) return null;
    return (await baixarArquivoCliente({ data: { pasta, caminho, nome: a.nome } })) as { nome: string; mime: string; dataBase64: string };
  };
  const ver = (a: Arquivo) => {
    setOcupado(a.nome);
    setPaginas(null);
    buscarArquivo(a)
      .then(async (r) => {
        if (!r) return;
        if (vendo) URL.revokeObjectURL(vendo.url);
        const url = URL.createObjectURL(base64ToBlob(r.dataBase64, r.mime));
        setVendo({ url, nome: r.nome, mime: r.mime });
        /* .ai salvo sem compatibilidade PDF não tem página: a tela diz isso */
        if (ehDesenho(r.nome)) setPaginas(await pdfPaginas(url, 1400).catch(() => "falhou" as const));
      })
      .catch((e: unknown) => setAviso(erroLegivel(e, "Não deu para abrir o arquivo.")))
      .finally(() => setOcupado(""));
  };
  /* um clique no arquivo: mostra na área do PDF (PDF e .ai com página, e
     imagem); o resto diz que não tem prévia. `grande` vai direto para o
     visualizador de tela cheia. */
  const previsualizar = (a: Arquivo, grande?: boolean) => {
    if (grande) { ver(a); return; }
    const meu = ++previaPedido.current;
    if (previaUrl.current) { URL.revokeObjectURL(previaUrl.current); previaUrl.current = null; }
    setPreviaArq(a);
    setPagPrevia(0);
    if (!daParaVer(a.nome)) { setPrevia("sem"); return; }
    setPrevia("lendo");
    buscarArquivo(a)
      .then(async (r) => {
        if (!r || meu !== previaPedido.current) return;
        const url = URL.createObjectURL(base64ToBlob(r.dataBase64, r.mime));
        previaUrl.current = url;
        if (ehImagem(r.nome)) { setPrevia({ imagens: [url], total: 1 }); return; }
        const pg = await pdfPaginas(url, 640, 4).catch(() => null);
        if (meu !== previaPedido.current) return;
        setPrevia(pg ?? "falhou");
      })
      .catch((e: unknown) => {
        if (meu !== previaPedido.current) return;
        setPreviaArq(null); setPrevia(null);
        setAviso(erroLegivel(e, "Não deu para abrir o arquivo."));
      });
  };
  const fecharVisualizador = useCallback(() => {
    setVendo((v) => { if (v) URL.revokeObjectURL(v.url); return null; });
    setPaginas(null);
  }, []);
  useEscDoTopo(!!vendo, NIVEL.caixa, fecharVisualizador);
  const baixar = (a: Arquivo) => {
    setOcupado(a.nome);
    buscarArquivo(a)
      .then((r) => { if (r) salvarBlob(base64ToBlob(r.dataBase64, r.mime), r.nome); })
      .catch((e: unknown) => setAviso(erroLegivel(e, "Não deu para baixar o arquivo.")))
      .finally(() => setOcupado(""));
  };
  const paginasPrevia = previa && typeof previa === "object" ? previa : null;
  const paginaAtual = paginasPrevia ? paginasPrevia.imagens[Math.min(pagPrevia, paginasPrevia.imagens.length - 1)] : null;
  const vazio = previa === "lendo" ? { titulo: "", texto: "Desenhando…" }
    : previa === "sem" ? { titulo: "Sem prévia", texto: "Este tipo de arquivo não abre aqui. Baixe para abrir no programa dele." }
      : previa === "falhou" ? { titulo: "Sem página para desenhar", texto: "Acontece com .ai salvo sem compatibilidade PDF. Baixe e abra no Illustrator." }
        : { titulo: "Nenhum arquivo aberto", texto: "Clique num arquivo para ver aqui." };
  const totalArquivos = conteudo?.arquivos.length ?? 0;

  /* pé: as pílulas depois do título (44 de ar, nunca antes da c6) */
  const tituloRef = useRef<HTMLDivElement | null>(null);
  const [fimTitulo, setFimTitulo] = useState(80 + 420);
  useEffect(() => {
    const el = tituloRef.current;
    if (!el) return;
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo && el.isConnected) setFimTitulo(el.offsetLeft + el.offsetWidth); });
    return () => { vivo = false; };
  }, []);
  const xPilulas = Math.max(480 - PILULA_BORDA / 2, Math.ceil(fimTitulo + 44));

  return (
    <PalcoFixo>
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />
      <div style={{ position: "absolute", inset: 0 }} inert={!!vendo}>
        {/* as pastas da rede */}
        <div aria-hidden style={{ ...PAINEL, left: LISTA.x, width: LISTA.w, zIndex: 2 }} />
        <div style={{ ...frEm("Pastas", 40, LISTA.tinta, 14 * LG), zIndex: 3 }}>Pastas</div>
        <div style={{ ...interEm(carregandoLista ? "L" : "0", 18, LISTA.tinta, 16 * LG, 24), color: CINZA, whiteSpace: "nowrap", zIndex: 3 }}>
          {carregandoLista ? "Lendo a rede…" : `${pastas.length.toLocaleString("pt-BR")} pastas, ${achadas.length.toLocaleString("pt-BR")} na busca`}
        </div>
        <label style={{ position: "absolute", left: LISTA.tinta, top: 18 * LG, width: LISTA.fim - LISTA.tinta, height: 37, boxSizing: "border-box", display: "flex", alignItems: "center", background: FUNDO_PAGINA, borderRadius: 6, cursor: "text", zIndex: 3 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="PESQUISA" aria-label="Pesquisar cliente" spellCheck={false} autoComplete="off" autoFocus
            style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "none", textAlign: busca ? "left" : "center", padding: busca ? "0 14px" : 0,
              font: `600 14px/1 ${INTER}`, letterSpacing: busca ? 0 : ".08em", color: PRETO }} />
        </label>
        <div ref={vigiarRolagem} className="p10-rola" role="listbox" aria-label="Pastas de clientes"
          style={{ position: "absolute", left: LISTA.tinta - 12, top: 21.5 * LG, width: LISTA.fim - LISTA.tinta + 24, height: PE_PAINEL - 21.5 * LG - 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1, zIndex: 3, ["--fundo" as string]: "#fff" } as CSSProperties}>
          {achadas.slice(0, TETO_LISTA).map((p) => {
            const on = p === pasta;
            return (
              <button key={p} type="button" role="option" aria-selected={on} onClick={() => escolher(p)} className={on ? undefined : "p10-linha"}
                style={{ ...LIMPO, flex: "none", minHeight: 2 * LG, padding: "6px 12px", borderRadius: 8, background: on ? AMARELO : "transparent", fontFamily: INTER, fontSize: 16, lineHeight: "20px", fontWeight: on ? 700 : 400 }}>
                {p}
              </button>
            );
          })}
          {!carregandoLista && achadas.length === 0 && (
            <div style={{ padding: "8px 12px", fontFamily: INTER, fontSize: 15, lineHeight: 1.45, color: CINZA }}>Nenhuma pasta com esse nome. A busca ignora acento e maiúscula: tente só um pedaço do nome.</div>
          )}
          {achadas.length > TETO_LISTA && (
            <div style={{ padding: "8px 12px", fontFamily: INTER, fontSize: 14, lineHeight: 1.45, color: CINZA }}>Mostrando {TETO_LISTA} de {achadas.length.toLocaleString("pt-BR")}. Escreva mais um pedaço do nome.</div>
          )}
        </div>

        {/* dentro da pasta */}
        <div aria-hidden style={{ ...PAINEL, left: MIOLO.x, width: MIOLO.w, zIndex: 1 }} />
        {!pasta ? (
          <>
            <div style={{ ...frEm("Escolha um cliente", 40, MIOLO.tinta, 14 * LG), zIndex: 3 }}>Escolha um cliente</div>
            <div style={{ ...interEm("A", 18, MIOLO.tinta, 16 * LG, 24), width: 900, color: CINZA, zIndex: 3 }}>
              A pasta abre aqui do jeito que está na rede. PDF e imagem você vê na tela; o resto baixa.
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => { setCaminho(""); setBuscaArquivo(""); }} title="Voltar ao começo da pasta" className="p10-flat"
              style={{ ...LIMPO, ...frEm(pasta, 48, MIOLO.tinta, 14 * LG), maxWidth: MIOLO.fimLista - MIOLO.tinta, overflow: "hidden", textOverflow: "ellipsis", zIndex: 3 }}>{pasta}</button>
            {/* quantos arquivos: miúdo, na linha da pesquisa, terminando com a
                lista; o tamanho saiu ("o tamanho do arquivo é irrelevante") */}
            <div style={{ position: "absolute", right: 1920 - MIOLO.fimLista, top: 18.5 * LG, height: 37, display: "flex", alignItems: "center", fontFamily: INTER, fontSize: 15, color: CINZA, whiteSpace: "nowrap", zIndex: 3 }}>
              {carregandoPasta ? "Lendo…" : `${totalArquivos} ${totalArquivos === 1 ? "arquivo" : "arquivos"}`}
            </div>
            {/* onde estou dentro da pasta */}
            <div style={{ ...interEm(trilha.length ? "I" : "N", 18, MIOLO.tinta, 16.5 * LG, 24), width: MIOLO.fimLista - MIOLO.tinta, display: "flex", alignItems: "baseline", gap: 8, whiteSpace: "nowrap", overflow: "hidden", zIndex: 3 }}>
              {trilha.length > 0 && (
                <button type="button" onClick={() => { setCaminho(""); setBuscaArquivo(""); }} className="p10-flat"
                  style={{ ...LIMPO, fontFamily: INTER, fontSize: 18, color: CINZA_FORTE, textDecoration: "underline", textUnderlineOffset: 4 }}>Início</button>
              )}
              {trilha.length ? trilha.map((t, i) => (
                <span key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span aria-hidden style={{ color: "#b3b1b3" }}>/</span>
                  <button type="button" onClick={() => irPara(i)} className="p10-flat"
                    style={{ ...LIMPO, fontFamily: INTER, fontSize: 18, fontWeight: i === trilha.length - 1 ? 700 : 400, color: i === trilha.length - 1 ? PRETO : CINZA_FORTE, textDecoration: i === trilha.length - 1 ? "none" : "underline", textUnderlineOffset: 4 }}>{t}</button>
                </span>
              )) : <span style={{ color: CINZA }} title={caminhoRede}>No começo da pasta. {caminhoRede}</span>}
            </div>
            <label style={{ position: "absolute", left: MIOLO.tinta, top: 18.5 * LG, width: 480, height: 37, boxSizing: "border-box", display: "flex", alignItems: "center", background: FUNDO_PAGINA, borderRadius: 6, cursor: "text", zIndex: 3 }}>
              <input value={buscaArquivo} onChange={(e) => setBuscaArquivo(e.target.value)} placeholder="PESQUISA NESTA PASTA" aria-label="Procurar nesta pasta (medida, nome do arquivo)" spellCheck={false} autoComplete="off"
                style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "none", textAlign: buscaArquivo ? "left" : "center", padding: buscaArquivo ? "0 14px" : 0,
                  font: `600 14px/1 ${INTER}`, letterSpacing: buscaArquivo ? 0 : ".08em", color: PRETO }} />
            </label>

            <div ref={vigiarRolagem} className="p10-rola"
              style={{ position: "absolute", left: MIOLO.tinta - 12, top: 22 * LG, width: MIOLO.fimLista - MIOLO.tinta + 24, height: PE_PAINEL - 22 * LG - 24, overflowY: "auto", zIndex: 3, ["--fundo" as string]: "#fff" } as CSSProperties}>
              {pastasVisiveis.map((p) => (
                <button key={"d" + p} type="button" onClick={() => entrar(p)} className="p10-linha"
                  style={{ ...LIMPO, display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 2.5 * LG, padding: "0 12px", borderRadius: 8, boxSizing: "border-box" }}>
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={CINZA_FORTE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "none" }}><path d="M3.5 19.5v-13h6l2 2.5h9v10.5z" /></svg>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</span>
                  <span aria-hidden style={{ fontFamily: INTER, fontSize: 18, color: "#b3b1b3" }}>›</span>
                </button>
              ))}
              {modo === "grade" && arquivosVisiveis.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, padding: "8px 12px 4px" }}>
                  {arquivosVisiveis.map((a) => (
                    <CartaoArquivo key={"c" + a.nome} arquivo={a} pasta={pasta} caminho={caminho} ocupado={ocupado === a.nome || previaArq?.nome === a.nome} aoVer={previsualizar} aoBaixar={baixar} />
                  ))}
                </div>
              )}
              {modo === "lista" && arquivosVisiveis.map((a) => {
                const podeVer = daParaVer(a.nome);
                return (
                  <div key={"f" + a.nome} onClick={() => previsualizar(a)} onDoubleClick={() => (podeVer ? ver(a) : baixar(a))}
                    style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 2.5 * LG, padding: "0 12px", borderTop: `1px solid ${LINHA_SUAVE}`, cursor: "pointer",
                      background: ocupado === a.nome || previaArq?.nome === a.nome ? AMARELO : "transparent", borderRadius: ocupado === a.nome || previaArq?.nome === a.nome ? 8 : 0 }}>
                    <TipoArquivo nome={a.nome} />
                    {/* o nome é botão: pelo teclado, Enter mostra na área do PDF */}
                    <button type="button" title={a.nome} onClick={(ev) => { ev.stopPropagation(); previsualizar(a); }}
                      style={{ ...LIMPO, flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</button>
                    <span style={{ flex: "none", width: 90, textAlign: "right", fontFamily: INTER, fontSize: 14, color: CINZA, whiteSpace: "nowrap" }}>{fmtTamanho(a.tamanho)}</span>
                    <span style={{ flex: "none", width: 80, textAlign: "right", fontFamily: INTER, fontSize: 14, color: CINZA, whiteSpace: "nowrap" }}>{dataBR(a.modificado)}</span>
                    <span style={{ flex: "none", width: 150, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      {podeVer && <button type="button" onClick={(ev) => { ev.stopPropagation(); ver(a); }} disabled={!!ocupado} className="np4-pilula" style={{ ...PILULA_PEQ, cursor: ocupado ? "progress" : "pointer" }}>Ver</button>}
                      <button type="button" onClick={(ev) => { ev.stopPropagation(); baixar(a); }} disabled={!!ocupado} className="np4-pilula" style={{ ...PILULA_PEQ, cursor: ocupado ? "progress" : "pointer" }}>Baixar</button>
                    </span>
                  </div>
                );
              })}
              {!carregandoPasta && !pastasVisiveis.length && !arquivosVisiveis.length && (
                <div style={{ padding: "12px", fontFamily: INTER, fontSize: 16, color: CINZA }}>{buscaArquivo ? "Nada com esse nome nesta pasta." : "Esta pasta está vazia."}</div>
              )}
            </div>

            {/* A área do PDF ocupa a coluna inteira do painel: de 1440 (a coluna
                onde começa a pesquisa do topo) à borda direita, do topo ao pé,
                com os cantos do painel. A imagem cresce até caber; no pé, o nome
                miúdo, as páginas (‹ 1 de 3 ›) e as ações. O arquivo aberto fica
                aceso na lista. Um clique no arquivo mostra aqui; "Ampliar" abre o
                visualizador de tela cheia (Augusto, 05/10/2026: "use toda a área
                sinalizada", "foque na imagem ficar visível"). */}
            <div role="region" aria-label={previaArq ? `Prévia de ${previaArq.nome}` : "Prévia do arquivo"}
              style={{ position: "absolute", left: PREVIA.x, top: TOPO, width: PREVIA.fim - PREVIA.x, height: PE_PAINEL - TOPO, boxSizing: "border-box", display: "flex", flexDirection: "column",
                background: FUNDO_PAGINA, borderTopRightRadius: 20, borderBottomRightRadius: 20, overflow: "hidden", zIndex: 2 }}>
              <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 24px 12px", boxSizing: "border-box" }}>
                {paginaAtual ? (
                  <img src={paginaAtual} alt={`${previaArq?.nome ?? "arquivo"}, página ${pagPrevia + 1}`}
                    style={{ display: "block", width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 12px 18px rgba(0,0,0,.18))" }} />
                ) : (
                  <div style={{ maxWidth: 300, textAlign: "center" }}>
                    {vazio.titulo && <div style={{ ...FR, fontSize: 23, lineHeight: "27px", letterSpacing: "-.02em" }}>{vazio.titulo}</div>}
                    <div style={{ marginTop: vazio.titulo ? 8 : 0, fontFamily: INTER, fontSize: 15, lineHeight: 1.45, color: CINZA }}>{vazio.texto}</div>
                  </div>
                )}
              </div>
              {previaArq && previa !== "lendo" && (
                <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "0 24px 24px" }}>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    {paginasPrevia && paginasPrevia.total > 1 ? (
                      <>
                        <button type="button" aria-label="Página anterior" onClick={() => setPagPrevia((n) => Math.max(0, n - 1))} disabled={pagPrevia === 0}
                          className="p10-flat" style={{ ...SETA_PAGINA, opacity: pagPrevia === 0 ? 0.35 : 1, cursor: pagPrevia === 0 ? "default" : "pointer" }}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
                        </button>
                        <span aria-live="polite" style={{ minWidth: 44, textAlign: "center", fontFamily: INTER, fontSize: 14, color: CINZA_FORTE, whiteSpace: "nowrap" }}>{pagPrevia + 1} de {paginasPrevia.total}</span>
                        <button type="button" aria-label="Próxima página" onClick={() => setPagPrevia((n) => Math.min(paginasPrevia.imagens.length - 1, n + 1))}
                          disabled={pagPrevia >= paginasPrevia.imagens.length - 1}
                          title={pagPrevia >= paginasPrevia.imagens.length - 1 && paginasPrevia.total > paginasPrevia.imagens.length ? "Use Ampliar para ver as outras páginas" : undefined}
                          className="p10-flat" style={{ ...SETA_PAGINA, opacity: pagPrevia >= paginasPrevia.imagens.length - 1 ? 0.35 : 1, cursor: pagPrevia >= paginasPrevia.imagens.length - 1 ? "default" : "pointer" }}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
                        </button>
                      </>
                    ) : (
                      <span title={previaArq.nome} style={{ minWidth: 0, fontFamily: INTER, fontSize: 13, color: CINZA, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{previaArq.nome}</span>
                    )}
                  </div>
                  {paginasPrevia && (
                    <button type="button" onClick={() => ver(previaArq)} disabled={!!ocupado} className="np4-pilula" style={{ ...PILULA_PEQ, cursor: ocupado ? "progress" : "pointer" }}>Ampliar</button>
                  )}
                  <button type="button" onClick={() => baixar(previaArq)} disabled={!!ocupado} className="np4-pilula" style={{ ...PILULA_PEQ, cursor: ocupado ? "progress" : "pointer" }}>Baixar</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* o pé */}
        <div ref={tituloRef} style={tituloDoPeV4("Clientes")}>Clientes</div>
        <div role="group" aria-label="Como mostrar os arquivos" style={{ position: "absolute", left: xPilulas, top: TOPO_PILULA, display: "flex", gap: 29, zIndex: 3 }}>
          {([["lista", "Lista"], ["grade", "Desenhos"]] as const).map(([k, rot]) => (
            <button key={k} type="button" aria-pressed={modo === k} onClick={() => setModo(k)} className="np4-pilula"
              style={{ ...PILULA_PE, minWidth: 143.29, background: modo === k ? AMARELO : undefined }}>{rot}</button>
          ))}
        </div>
        {pasta && conteudo && (
          <button type="button" onClick={() => void copiarDaPasta(caminhoRede)} title={caminhoRede} className="np4-pilula" aria-live="polite"
            style={{ ...PILULA_PE, position: "absolute", right: 1920 - (1840 + PILULA_BORDA / 2), top: TOPO_PILULA, zIndex: 3 }}>
            {/* as duas frases no mesmo lugar: a pílula fica com a largura da maior e não pula */}
            <span style={{ display: "inline-grid" }}>
              <span style={{ gridArea: "1 / 1", visibility: copiado ? "hidden" : "visible" }}>Copiar caminho da pasta</span>
              <span style={{ gridArea: "1 / 1", visibility: copiado ? "visible" : "hidden" }}>Caminho copiado</span>
            </span>
          </button>
        )}
      </div>

      {/* o visualizador: por cima, sem baixar */}
      {vendo && (
        <div onClick={fecharVisualizador} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: NIVEL.caixa, background: "rgba(37,36,37,.78)" }}>
          <div onClick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label={vendo.nome}
            style={{ position: "absolute", left: 80, top: 40, width: 1760, height: 1000, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16, padding: "24px 30px 30px",
              background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)" }}>
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ ...FR, flex: 1, minWidth: 0, fontSize: 32, lineHeight: "36px", letterSpacing: "-.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vendo.nome}</span>
              <a href={vendo.url} download={vendo.nome} className="np4-pilula" style={{ ...PILULA_PE, height: 40, padding: "1px 20px 0", fontSize: 17, textDecoration: "none" }}>Baixar</a>
              <button type="button" onClick={fecharVisualizador} aria-label="Fechar" className="p10-flat"
                style={{ flex: "none", width: 46, height: 46, boxSizing: "border-box", padding: 0, display: "grid", placeItems: "center", background: "transparent", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" aria-hidden><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: ehDesenho(vendo.nome) ? "block" : "grid", placeItems: "center", background: FUNDO_PAGINA, borderRadius: 14, overflow: "auto", padding: ehDesenho(vendo.nome) ? 16 : 0 }}>
              {ehImagem(vendo.nome) ? (
                <img src={vendo.url} alt={vendo.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : !paginas ? (
                <div style={{ display: "grid", placeItems: "center", height: "100%", fontFamily: INTER, fontSize: 16, color: CINZA }}>Desenhando as páginas…</div>
              ) : paginas === "falhou" ? (
                <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center", padding: 40 }}>
                  <div>
                    <div style={{ ...FR, fontSize: 28 }}>Este arquivo não tem página para desenhar.</div>
                    <p style={{ fontFamily: INTER, fontSize: 16, lineHeight: 1.5, color: CINZA_FORTE, margin: "10px 0 0" }}>Acontece com .ai salvo sem compatibilidade PDF. Baixe e abra no Illustrator.</p>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                  {paginas.imagens.map((img, i) => <img key={i} src={img} alt={`${vendo.nome} (página ${i + 1})`} style={{ maxWidth: "100%", boxShadow: "0 10px 30px -20px rgba(0,0,0,.5)" }} />)}
                  {paginas.total > paginas.imagens.length && (
                    <div style={{ fontFamily: INTER, fontSize: 14, color: CINZA }}>Mostrando {paginas.imagens.length} de {paginas.total} páginas. Baixe o arquivo para ver o resto.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {aviso && <AvisoV1a texto={aviso} tipo="alerta" onFechar={() => setAviso("")} />}
      {children}
      <BarraTopoHub10 profile={profile} paginaAtiva="Clientes" aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis} fundo="transparent" />
    </PalcoFixo>
  );
}
