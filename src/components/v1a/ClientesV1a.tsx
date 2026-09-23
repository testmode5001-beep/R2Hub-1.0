// Clientes — as pastas da rede (\\server\Arte\Clientes) dentro do hub.
//
// O problema: para achar a arte de um cliente, a vendedora saía do hub, abria
// o Explorador e procurava entre 5 mil pastas — pela grafia exata, porque a
// busca do Windows não perdoa acento nem caixa. "Sao Geraldo" não achava
// "São Geraldo".
//
// Aqui é a MESMA pasta, sem cópia e sem banco: a tela lê o share ao vivo. A
// busca é a do hub (sem acento, sem caixa, por palavra), e PDF, PNG e JPG
// abrem na própria tela. Arquivo de desenho (.ai, .cdr) o navegador não sabe
// mostrar — esse baixa, ou abre pelo caminho de rede.
//
// SÓ LEITURA: nada nesta tela grava, renomeia ou apaga no share.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  AMARELO, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { criarBusca } from "@/lib/busca";
import { colherBusca } from "@/lib/busca-semente";
import { base64ToBlob, fmtTamanho, salvarBlob } from "@/lib/files";
import { pdfPaginas } from "@/lib/pdf-preview";
import { listPastasClientes } from "@/lib/api/clientes.functions";
import {
  abrirPastaCliente, baixarArquivoCliente, miniaturaArquivoCliente, salvarMiniaturaArquivoCliente,
} from "@/lib/api/pasta-cliente.functions";

type Arquivo = { nome: string; subpasta: string; tamanho: number; modificado: string };
type Conteudo = { pasta: string; caminho: string; raiz: string; pastas: string[]; arquivos: Arquivo[] };

/* A lista da esquerda tem 5 mil nomes. Desenhar todos trava a rolagem sem
   ajudar ninguém: quem procura digita. Mostra os primeiros e diz quantos
   ficaram de fora. */
const TETO_LISTA = 300;

const dataBR = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
};

const ext = (nome: string) => (nome.split(".").pop() ?? "").toLowerCase();
const ehImagem = (nome: string) => /^(png|jpe?g|gif|webp|bmp|svg)$/.test(ext(nome));
/** Desenhado por pdf.js. O .ai entra porque o Illustrator salva com página PDF
    dentro — é a mesma leitura, e é a arte-mestra que o pessoal quer conferir. */
const ehDesenho = (nome: string) => /^(pdf|ai|eps)$/.test(ext(nome));
/** O que abre na tela sem precisar baixar. */
const daParaVer = (nome: string) => ehImagem(nome) || ehDesenho(nome);

/** Cor da etiquetinha de tipo — o olho acha o PDF no meio dos .ai. */
function corDaExtensao(e: string): { fundo: string; texto: string } {
  if (e === "pdf") return { fundo: "#fdecea", texto: "#b53225" };
  if (/^(png|jpe?g|gif|webp|bmp|svg)$/.test(e)) return { fundo: "#eaf4ec", texto: "#2f7a44" };
  if (/^(ai|eps|cdr|psd|indd)$/.test(e)) return { fundo: "#f0edfb", texto: "#5b4bb5" };
  return { fundo: "#f1f1f1", texto: "#8d8b8d" };
}

/** O que dá para desenhar. O .ai entra porque o Illustrator salva com página
    PDF dentro: pdf.js abre e desenha a arte-mestra igual a um PDF comum. */
const daParaMiniatura = (nome: string) => ehImagem(nome) || ehDesenho(nome);

/* Uma pasta pode ter 50 arquivos de 3 MB. Desenhar todos de uma vez derruba a
   aba e entope a rede; a fila deixa dois em curso e o resto espera a vez. */
let emCurso = 0;
const esperando: (() => void)[] = [];
async function naFila<T>(tarefa: () => Promise<T>): Promise<T> {
  if (emCurso >= 2) await new Promise<void>((libera) => esperando.push(libera));
  emCurso++;
  try {
    return await tarefa();
  } finally {
    emCurso--;
    esperando.shift()?.();
  }
}

/**
 * Miniatura de um arquivo: a guardada no servidor, ou desenhada agora.
 *
 * Só a PRIMEIRA visita paga o download do arquivo inteiro. O PNG de 320px
 * volta para o servidor e, dali em diante, a grade custa ~20 KB por cartão.
 */
async function miniaturaDe(pasta: string, caminho: string, nome: string): Promise<string> {
  const guardada = await miniaturaArquivoCliente({ data: { pasta, caminho, nome } });
  if (guardada.dataBase64) return `data:image/png;base64,${guardada.dataBase64}`;

  const r = await baixarArquivoCliente({ data: { pasta, caminho, nome } });
  const url = URL.createObjectURL(base64ToBlob(r.dataBase64, r.mime));
  try {
    const png = ehImagem(nome) ? await imagemReduzida(url, 320) : (await pdfPaginas(url, 320, 1)).imagens[0];
    if (!png) throw new Error("sem página");
    const corpo = png.split(",")[1];
    if (corpo) void salvarMiniaturaArquivoCliente({ data: { pasta, caminho, nome, dataBase64: corpo } }).catch(() => { /* cache é opcional */ });
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Foto de 5 MB não vira miniatura sozinha: reduz no canvas antes de guardar. */
function imagemReduzida(url: string, largura: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, largura / (img.naturalWidth || largura));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((img.naturalWidth || largura) * escala));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || largura) * escala));
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Sem canvas.")); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Não deu para ler a imagem."));
    img.src = url;
  });
}

/**
 * Copia o caminho de rede e diz o que fazer com ele.
 *
 * É o caminho para o Explorador, não uma URL: `\\server\Arte\...` cru, do
 * jeito que a barra de endereço do Windows entende. Quem precisa abrir o .ai
 * no Illustrator passa por aqui.
 */
async function copiarCaminho(caminho: string) {
  try {
    await navigator.clipboard.writeText(caminho);
    toast.success("Caminho copiado", { description: "No Explorador: Ctrl+L, Ctrl+V, Enter." });
    return;
  } catch { /* sem permissão de área de transferência: tenta pelo jeito antigo */ }

  /* O caminho da rede é a única saída para abrir o .ai no Illustrator — se a
     cópia falhar, a pessoa fica sem nada. O modo antigo (textarea + execCommand)
     não pede permissão e funciona onde o outro não funciona. */
  try {
    const campo = document.createElement("textarea");
    campo.value = caminho;
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    const deu = document.execCommand("copy");
    document.body.removeChild(campo);
    if (deu) {
      toast.success("Caminho copiado", { description: "No Explorador: Ctrl+L, Ctrl+V, Enter." });
      return;
    }
  } catch { /* nem esse: mostra o caminho para copiar à mão */ }

  toast.error("Não consegui copiar sozinho", { description: caminho, duration: 15000 });
}

const INP = {
  width: "100%", boxSizing: "border-box" as const, background: "#fff", border: "2px solid #ececec",
  borderRadius: 9, padding: "12px 14px", font: "600 14.5px/1.2 Inter,sans-serif", color: INK, outline: "none",
};
const CHIP = {
  display: "flex", alignItems: "center", gap: 7, flex: "none", border: "2px solid #e0e0e0",
  background: "transparent", borderRadius: 999, padding: "9px 14px", cursor: "pointer",
  font: "600 13px/1 Inter,sans-serif", color: "#5c5a5c", textDecoration: "none", whiteSpace: "nowrap" as const,
};

/**
 * Cartão da grade. O desenho só começa a ser buscado quando o cartão chega
 * perto da tela — abrir uma pasta grande não pode disparar 50 downloads de
 * arquivos que ninguém vai rolar até ver.
 */
function CartaoArquivo({ arquivo, pasta, caminho, ocupado, aoVer, aoBaixar }: {
  arquivo: Arquivo;
  pasta: string;
  caminho: string;
  ocupado: boolean;
  aoVer: (a: Arquivo) => void;
  aoBaixar: (a: Arquivo) => void;
}) {
  const [png, setPng] = useState<string | null>(null);
  const [estado, setEstado] = useState<"espera" | "desenhando" | "sem">("espera");
  const caixa = useRef<HTMLDivElement>(null);
  const e = ext(arquivo.nome);
  const cor = corDaExtensao(e);
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
    <div ref={caixa} onClick={() => (podeVer ? aoVer(arquivo) : aoBaixar(arquivo))}
      title={arquivo.nome}
      style={{ display: "flex", flexDirection: "column", gap: 9, borderRadius: 11, padding: 10, cursor: "pointer", background: ocupado ? "#faf7e6" : "#fafafa", boxShadow: "inset 0 0 0 1px #ececec" }}>
      <div style={{ position: "relative", aspectRatio: "4 / 3", display: "grid", placeItems: "center", borderRadius: 8, overflow: "hidden", background: "#fff", boxShadow: "inset 0 0 0 1px #f1f1f1" }}>
        {png ? (
          <img src={png} alt={arquivo.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : (
          <span style={{ font: `700 12px/1 ${MONO}`, letterSpacing: ".08em", textTransform: "uppercase", color: estado === "desenhando" ? "#b3b1b3" : cor.texto }}>
            {estado === "desenhando" ? "desenhando…" : e || "arquivo"}
          </span>
        )}
        <span style={{ position: "absolute", left: 6, top: 6, display: "grid", placeItems: "center", minWidth: 34, height: 19, borderRadius: 5, background: cor.fundo, color: cor.texto, font: `700 10px/1 ${MONO}`, letterSpacing: ".06em", textTransform: "uppercase" }}>
          {e || "—"}
        </span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: "600 13px/1.3 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{arquivo.nome}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
          <span style={{ flex: 1, font: `500 11.5px/1 ${MONO}`, color: "#b3b1b3", whiteSpace: "nowrap" }}>
            {fmtTamanho(arquivo.tamanho)} · {dataBR(arquivo.modificado)}
          </span>
          <button onClick={(ev) => { ev.stopPropagation(); aoBaixar(arquivo); }} className="r2chip"
            style={{ flex: "none", border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", color: "#8d8b8d" }}>
            Baixar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClientesV1a({ profile, versao, aoNavegar, onNova, onLogout, disponiveis, children }: {
  profile: { nome: string; role?: string };
  versao?: string;
  aoNavegar?: (label: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  children?: ReactNode;
}) {
  const [buscaTopo, setBuscaTopo] = useState("");
  const [pastas, setPastas] = useState<string[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");

  const [pasta, setPasta] = useState<string | null>(null);
  const [caminho, setCaminho] = useState("");
  const [conteudo, setConteudo] = useState<Conteudo | null>(null);
  const [carregandoPasta, setCarregandoPasta] = useState(false);
  const [buscaArquivo, setBuscaArquivo] = useState("");
  /* Lista ou desenhos: a escolha fica gravada, porque é jeito de trabalhar, não
     opção de uma visita. Quem procura pelo nome do arquivo fica na lista; quem
     procura "aquela etiqueta amarela" quer ver. */
  const [modo, setModo] = useState<"lista" | "grade">(() => {
    if (typeof window === "undefined") return "lista";
    return localStorage.getItem("r2_clientes_modo") === "grade" ? "grade" : "lista";
  });
  useEffect(() => { try { localStorage.setItem("r2_clientes_modo", modo); } catch { /* modo anônimo */ } }, [modo]);

  const [vendo, setVendo] = useState<{ url: string; nome: string; mime: string } | null>(null);
  /* Páginas do PDF já desenhadas por nós. O visualizador embutido do navegador
     depende de extensão e política do host — na intranet ele abre preto de vez
     em quando, e um PDF preto é indistinguível de arquivo corrompido. */
  const [paginas, setPaginas] = useState<{ imagens: string[]; total: number } | "falhou" | null>(null);
  const [ocupado, setOcupado] = useState("");
  const pedido = useRef(0);

  useEffect(() => {
    /* Nome plantado pela busca do topo: quem clicou em "Santa Luzia" lá quer a
       pasta ABERTA aqui, não o nome digitado num campo para clicar de novo. */
    const semente = colherBusca();
    if (semente) setBusca(semente);
    listPastasClientes()
      .then((r: { pastas: string[] }) => {
        const lista = r.pastas ?? [];
        setPastas(lista);
        if (!semente) return;
        const alvo = semente.toLowerCase();
        const exata = lista.find((p) => p.toLowerCase() === alvo);
        if (exata) setPasta(exata);
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não deu para ler as pastas da rede."))
      .finally(() => setCarregandoLista(false));
  }, []);

  /* Cada ida ao share ganha um número: resposta de uma pasta que a pessoa já
     abandonou (clicou em outra no meio do caminho) é descartada em vez de
     sobrescrever a tela. */
  useEffect(() => {
    if (!pasta) { setConteudo(null); return; }
    const meu = ++pedido.current;
    setCarregandoPasta(true);
    setErro("");
    abrirPastaCliente({ data: { pasta, caminho } })
      .then((r) => { if (meu === pedido.current) setConteudo(r as Conteudo); })
      .catch((e: unknown) => {
        if (meu !== pedido.current) return;
        setConteudo(null);
        setErro(e instanceof Error ? e.message : "Não deu para abrir a pasta.");
      })
      .finally(() => { if (meu === pedido.current) setCarregandoPasta(false); });
  }, [pasta, caminho]);

  useEffect(() => () => { if (vendo) URL.revokeObjectURL(vendo.url); }, [vendo]);

  const achadas = useMemo(() => {
    const casa = criarBusca(busca);
    return pastas.filter((p) => casa(p));
  }, [pastas, busca]);

  const arquivosVisiveis = useMemo(() => {
    if (!conteudo) return [];
    const casa = criarBusca(buscaArquivo);
    return conteudo.arquivos.filter((a) => casa(a.nome));
  }, [conteudo, buscaArquivo]);

  const pastasVisiveis = useMemo(() => {
    if (!conteudo) return [];
    const casa = criarBusca(buscaArquivo);
    return conteudo.pastas.filter((p) => casa(p));
  }, [conteudo, buscaArquivo]);

  const trilha = caminho ? caminho.split(/[\\/]+/).filter(Boolean) : [];
  const caminhoRede = conteudo ? [conteudo.raiz, ...trilha].join("\\") : "";

  const escolher = (nome: string) => {
    setPasta(nome);
    setCaminho("");
    setBuscaArquivo("");
  };

  const entrar = (sub: string) => {
    setCaminho(caminho ? `${caminho}\\${sub}` : sub);
    setBuscaArquivo("");
  };

  const irPara = (i: number) => {
    setCaminho(trilha.slice(0, i + 1).join("\\"));
    setBuscaArquivo("");
  };

  const buscarArquivo = async (a: Arquivo) => {
    if (!pasta) return null;
    const r = await baixarArquivoCliente({ data: { pasta, caminho, nome: a.nome } });
    return r as { nome: string; mime: string; dataBase64: string };
  };

  const ver = (a: Arquivo) => {
    setOcupado(a.nome);
    setErro("");
    setPaginas(null);
    buscarArquivo(a)
      .then(async (r) => {
        if (!r) return;
        if (vendo) URL.revokeObjectURL(vendo.url);
        const url = URL.createObjectURL(base64ToBlob(r.dataBase64, r.mime));
        setVendo({ url, nome: r.nome, mime: r.mime });
        /* .ai sem compatibilidade PDF existe (salvo com a opção desligada):
           aí não há página para desenhar, e a tela diz isso em vez de ficar
           eternamente em "desenhando…". */
        if (ehDesenho(r.nome)) {
          setPaginas(await pdfPaginas(url, 1400).catch(() => "falhou" as const));
        }
      })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não deu para abrir o arquivo."))
      .finally(() => setOcupado(""));
  };

  const fecharVisualizador = () => {
    if (vendo) URL.revokeObjectURL(vendo.url);
    setVendo(null);
    setPaginas(null);
  };

  const baixar = (a: Arquivo) => {
    setOcupado(a.nome);
    setErro("");
    buscarArquivo(a)
      .then((r) => { if (r) salvarBlob(base64ToBlob(r.dataBase64, r.mime), r.nome); })
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não deu para baixar o arquivo."))
      .finally(() => setOcupado(""));
  };

  const totalArquivos = conteudo?.arquivos.length ?? 0;
  const pesoTotal = conteudo?.arquivos.reduce((s, a) => s + a.tamanho, 0) ?? 0;

  return (
    <EstagioV1a>
      <TopbarV1a nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""} busca={buscaTopo} aoBuscar={setBuscaTopo} onSair={onLogout} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="Clientes" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ flex: "none", padding: "0 4px" }}>
            <h1 style={{ ...fr(144, 900), fontSize: 80, lineHeight: 0.86, color: INK, margin: "2px 0 0 2px" }}>Clientes</h1>
            <div style={{ font: "400 15px/1 Inter,sans-serif", color: "#8d8b8d", marginTop: 14 }}>
              {carregandoLista
                ? "lendo a rede…"
                : `${pastas.length.toLocaleString("pt-BR")} pastas em \\\\server\\Arte\\Clientes · a mesma pasta que abre no Explorador`}
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "340px 1fr", gap: 12 }}>

            {/* ————— coluna 1: achar o cliente ————— */}
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 10, background: "#fff", borderRadius: 12, padding: 16, boxShadow: SOMBRA_CARD }}>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do cliente"
                className="inp" style={INP} autoFocus />
              <div style={{ flex: "none", font: "600 12px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3" }}>
                {carregandoLista ? "—" : `${achadas.length.toLocaleString("pt-BR")} ${achadas.length === 1 ? "pasta" : "pastas"}`}
              </div>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, margin: "0 -6px" }}>
                {achadas.slice(0, TETO_LISTA).map((p) => (
                  <button key={p} onClick={() => escolher(p)} className="r2chip"
                    style={{
                      flex: "none", textAlign: "left", border: 0, borderRadius: 8, padding: "10px 10px", cursor: "pointer",
                      font: `${p === pasta ? 700 : 500} 14px/1.3 Inter,sans-serif`,
                      background: p === pasta ? AMARELO : "transparent", color: INK,
                    }}>
                    {p}
                  </button>
                ))}
                {!carregandoLista && achadas.length === 0 && (
                  <div style={{ font: "400 14px/1.5 Inter,sans-serif", color: "#b3b1b3", padding: "10px 10px" }}>
                    Nenhuma pasta com esse nome. A busca ignora acento e maiúscula — tente só um pedaço do nome.
                  </div>
                )}
                {achadas.length > TETO_LISTA && (
                  <div style={{ font: "400 13px/1.5 Inter,sans-serif", color: "#b3b1b3", padding: "10px 10px" }}>
                    mostrando {TETO_LISTA} de {achadas.length.toLocaleString("pt-BR")} — escreva mais um pedaço do nome
                  </div>
                )}
              </div>
            </div>

            {/* ————— coluna 2: dentro da pasta ————— */}
            <div style={{ minHeight: 0, display: "flex", flexDirection: "column", gap: 12, background: "#fff", borderRadius: 12, padding: 18, boxShadow: SOMBRA_CARD, minWidth: 0 }}>
              {!pasta ? (
                <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}>
                  <div>
                    <div style={{ ...fr(96, 700), fontSize: 26, lineHeight: 1.1, color: INK }}>Escolha um cliente</div>
                    <p style={{ font: "400 15px/1.5 Inter,sans-serif", color: "#8d8b8d", margin: "10px auto 0", maxWidth: 380 }}>
                      A pasta abre aqui do jeito que está na rede. PDF e imagem você vê na tela; o resto baixa.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                    <button onClick={() => { setCaminho(""); setBuscaArquivo(""); }} className="r2chip"
                      style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", font: `700 17px/1.2 Inter,sans-serif`, color: INK, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pasta}
                    </button>
                    {trilha.map((t, i) => (
                      <span key={i} style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ font: "400 15px/1 Inter,sans-serif", color: "#d6d5d6" }}>/</span>
                        <button onClick={() => irPara(i)} className="r2chip"
                          style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer", font: `${i === trilha.length - 1 ? 700 : 500} 15px/1.2 Inter,sans-serif`, color: i === trilha.length - 1 ? INK : "#8d8b8d", whiteSpace: "nowrap" }}>
                          {t}
                        </button>
                      </span>
                    ))}
                    <span style={{ flex: 1 }} />
                    {/* Existia aqui um "Abrir no Windows" apontando para file://.
                        Não funcionava e não tinha como funcionar: o navegador
                        recusa abrir caminho local a partir de uma página web
                        ("Not allowed to load local resource"), com ou sem
                        política de intranet. Botão que não faz nada é pior que
                        botão nenhum — ficou só o caminho, que resolve de fato. */}
                    <button onClick={() => void copiarCaminho(caminhoRede)} className="r2chip" style={CHIP} title={caminhoRede}>
                      Copiar caminho da pasta
                    </button>
                  </div>

                  <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10 }}>
                    <input value={buscaArquivo} onChange={(e) => setBuscaArquivo(e.target.value)} placeholder="Procurar nesta pasta (medida, nome do arquivo…)"
                      className="inp" style={{ ...INP, flex: 1 }} />
                    <div style={{ flex: "none", display: "flex", gap: 3, background: "#f1f1f1", borderRadius: 999, padding: 3 }}>
                      {([["lista", "Lista"], ["grade", "Desenhos"]] as const).map(([k, rotulo]) => (
                        <button key={k} onClick={() => setModo(k)} className="r2chip"
                          style={{ border: 0, borderRadius: 999, padding: "8px 14px", cursor: "pointer", font: "700 12.5px/1 Inter,sans-serif", background: modo === k ? INK : "transparent", color: modo === k ? AMARELO : "#8d8b8d" }}>
                          {rotulo}
                        </button>
                      ))}
                    </div>
                    <span style={{ flex: "none", font: "500 13px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>
                      {carregandoPasta ? "lendo…" : `${totalArquivos} ${totalArquivos === 1 ? "arquivo" : "arquivos"} · ${fmtTamanho(pesoTotal)}`}
                    </span>
                  </div>

                  <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3, margin: "0 -8px" }}>
                    {pastasVisiveis.map((p) => (
                      <button key={"d" + p} onClick={() => entrar(p)} className="r2chip"
                        style={{ flex: "none", display: "flex", alignItems: "center", gap: 11, textAlign: "left", border: 0, borderRadius: 9, padding: "11px 12px", cursor: "pointer", background: "transparent" }}>
                        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                          <path d="M3.5 19.5v-13h6l2 2.5h9v10.5z" />
                        </svg>
                        <span style={{ flex: 1, minWidth: 0, font: "600 14.5px/1.3 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</span>
                        <span style={{ flex: "none", font: "700 15px/1 Inter,sans-serif", color: "#d6d5d6" }}>›</span>
                      </button>
                    ))}

                    {modo === "grade" && arquivosVisiveis.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(186px, 1fr))", gap: 10, padding: "6px 8px 2px" }}>
                        {arquivosVisiveis.map((a) => (
                          <CartaoArquivo key={"c" + a.nome} arquivo={a} pasta={pasta} caminho={caminho}
                            ocupado={ocupado === a.nome} aoVer={ver} aoBaixar={baixar} />
                        ))}
                      </div>
                    )}

                    {modo === "lista" && arquivosVisiveis.map((a) => {
                      const e = ext(a.nome);
                      const cor = corDaExtensao(e);
                      const podeVer = daParaVer(a.nome);
                      return (
                        <div key={"f" + a.nome}
                          onDoubleClick={() => (podeVer ? ver(a) : baixar(a))}
                          style={{ flex: "none", display: "flex", alignItems: "center", gap: 11, borderRadius: 9, padding: "9px 12px", background: ocupado === a.nome ? "#faf7e6" : "transparent" }}>
                          <span style={{ flex: "none", display: "grid", placeItems: "center", minWidth: 40, height: 24, borderRadius: 6, background: cor.fundo, color: cor.texto, font: `700 11px/1 ${MONO}`, letterSpacing: ".06em", textTransform: "uppercase" }}>
                            {e || "—"}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, font: "500 14.5px/1.3 Inter,sans-serif", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</span>
                          <span style={{ flex: "none", font: `500 12.5px/1 ${MONO}`, color: "#b3b1b3", whiteSpace: "nowrap" }}>{fmtTamanho(a.tamanho)}</span>
                          <span style={{ flex: "none", width: 58, textAlign: "right", font: `500 12.5px/1 ${MONO}`, color: "#b3b1b3", whiteSpace: "nowrap" }}>{dataBR(a.modificado)}</span>
                          {podeVer && (
                            <button onClick={() => ver(a)} disabled={!!ocupado} className="r2chip"
                              style={{ ...CHIP, padding: "7px 12px", cursor: ocupado ? "progress" : "pointer" }}>
                              Ver
                            </button>
                          )}
                          <button onClick={() => baixar(a)} disabled={!!ocupado} className="r2chip"
                            style={{ ...CHIP, padding: "7px 12px", cursor: ocupado ? "progress" : "pointer" }}>
                            Baixar
                          </button>
                        </div>
                      );
                    })}

                    {!carregandoPasta && !pastasVisiveis.length && !arquivosVisiveis.length && (
                      <div style={{ font: "400 14px/1.5 Inter,sans-serif", color: "#b3b1b3", padding: "12px" }}>
                        {buscaArquivo ? "Nada com esse nome nesta pasta." : "Esta pasta está vazia."}
                      </div>
                    )}
                  </div>
                </>
              )}

              {erro && (
                <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 9, font: "500 13.5px/1.4 Inter,sans-serif", color: "#b53225" }}>
                  <span style={{ flex: "none", width: 7, height: 7, borderRadius: 999, background: "#b53225" }} />
                  {erro}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Visualizador: abre por cima, sem baixar. */}
      {vendo && (
        <div onClick={fecharVisualizador} data-modal-esc
          style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", gap: 12, padding: 30, background: "rgba(20,19,20,.82)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", borderRadius: 14 }}>
          <div onClick={(ev) => ev.stopPropagation()} style={{ flex: "none", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ flex: 1, minWidth: 0, font: "700 17px/1.2 Inter,sans-serif", color: "#f1f1f1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vendo.nome}</span>
            <a href={vendo.url} download={vendo.nome} className="r2chip"
              style={{ flex: "none", textDecoration: "none", border: 0, borderRadius: 999, padding: "11px 16px", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: AMARELO, color: INK }}>
              Baixar
            </a>
            <button onClick={fecharVisualizador} className="pm-ic"
              style={{ flex: "none", width: 36, height: 36, display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
          <div onClick={(ev) => ev.stopPropagation()}
            style={{ flex: 1, minHeight: 0, display: ehDesenho(vendo.nome) ? "block" : "grid", placeItems: "center", background: "#fff", borderRadius: 12, overflow: "auto", padding: ehDesenho(vendo.nome) ? 16 : 0 }}>
            {ehImagem(vendo.nome) ? (
              <img src={vendo.url} alt={vendo.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            ) : !paginas ? (
              <div style={{ display: "grid", placeItems: "center", height: "100%", font: "600 15px/1 Inter,sans-serif", color: "#8d8b8d" }}>
                desenhando as páginas…
              </div>
            ) : paginas === "falhou" ? (
              <div style={{ display: "grid", placeItems: "center", height: "100%", textAlign: "center", padding: 40 }}>
                <div>
                  <div style={{ font: "800 20px/1.3 Inter,sans-serif", color: INK }}>Este arquivo não tem página para desenhar.</div>
                  <p style={{ font: "400 15px/1.5 Inter,sans-serif", color: "#5c5a5c", margin: "10px 0 0" }}>
                    Acontece com .ai salvo sem compatibilidade PDF. Baixe e abra no Illustrator.
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                {paginas.imagens.map((img, i) => (
                  <img key={i} src={img} alt={`${vendo.nome} — página ${i + 1}`}
                    style={{ maxWidth: "100%", boxShadow: "0 1px 0 rgba(0,0,0,.06), 0 10px 30px -20px rgba(0,0,0,.5)" }} />
                ))}
                {paginas.total > paginas.imagens.length && (
                  <div style={{ font: "500 13.5px/1.4 Inter,sans-serif", color: "#8d8b8d", padding: "6px 0 2px" }}>
                    mostrando {paginas.imagens.length} de {paginas.total} páginas — baixe o arquivo para ver o resto
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {children}
    </EstagioV1a>
  );
}
