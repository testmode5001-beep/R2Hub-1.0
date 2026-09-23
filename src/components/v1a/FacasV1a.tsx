// Facas — v1a. Fonte: design_handoff_r2_hub/telas/Facas.dc.html (frame 6a).
// Catálogo de 294 facas com filtros por sistema/seção/cilindro, vista
// ativas/mortas/todas, comparação (até 3), preview e adicionar faca.
// Os desenhos (PDF) vêm do share quando a rota passa `pdfs`/`aoCarregarPdf`;
// sem eles a tela cai no desenho gerado pela medida (fallback do protótipo).
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode, RefObject } from "react";

import {
  AMARELO, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { criarBusca } from "@/lib/busca";
import { listCatalogoFacas, marcarFacaMorta, salvarFacaExtra, salvarSecaoFaca } from "@/lib/api/facas.functions";
import { colherBusca } from "@/lib/busca-semente";
import { pdfPrimeiraPagina } from "@/lib/pdf-preview";
import { COR_SISTEMA, FACAS, SECOES, SISTEMAS } from "./dados/facas";
import { CILINDRO, FG_SOBRE, MEDIDAS, MORTAS_INICIAIS, NUM, PASSO_MM, PDF_DE } from "./dados/facas-cilindro";

type Faca = { cod: string; medida: string; sistema: string; secao: string; valor?: string; fabricante?: string; entrega?: string };


const ICONE_EXCLUIR = ["M4.5 7h15", "M9.5 7V4.5h5V7", "M6.5 7l1 13h9l1-13"];
const ICONE_RESTAURAR = ["M4 12a8 8 0 1 0 8-8 8 8 0 0 0-7 4", "M4 4.5V9h4.5"];

/* desenho técnico gerado pela medida (fallback do protótipo) */
function desenhoStyle(f: Faca, maxW: number, maxH: number, grande: boolean): CSSProperties {
  const nums = MEDIDAS(f.medida);
  const l = nums[0] || 50;
  const a = nums[1] || nums[0] || 50;
  const esc = Math.min(maxW / l, maxH / a);
  const w = Math.max(grande ? 26 : 10, Math.round(l * esc));
  const h = Math.max(grande ? 20 : 9, Math.round(a * esc));
  const redondo = f.sistema === "Redonda";
  const tag = f.sistema === "Tag";
  const tracejado = f.sistema === "Picote" || /serrilha/i.test(f.secao || "");
  const raio = redondo ? 999 : tag ? Math.round(Math.min(w, h) * 0.18) : grande ? 6 : 4;
  return {
    position: "relative", display: "grid", placeItems: "center", width: w, height: h,
    border: `${grande ? 2 : 1.5}px ${tracejado ? "dashed" : "solid"} ${INK}`, borderRadius: raio, background: "#fff",
  };
}

/** PNGs já desenhados, por arquivo — evita baixar o mesmo PDF a cada rolagem. */
const MINIATURAS = new Map<string, string>();

/**
 * Miniatura do cartão: só pede a imagem quando o cartão chega perto da tela, e
 * enquanto isso (ou se não houver desenho) mostra o retângulo gerado pela medida.
 * Quem resolve de onde vem o PNG (acervo ou desenhado na hora) é a rota.
 */
function MiniaturaFaca({ arquivo, miniaturaRef, children }: {
  arquivo: string;
  miniaturaRef: RefObject<((a: string) => Promise<string>) | undefined>;
  children: ReactNode;
}) {
  const [png, setPng] = useState(() => (arquivo ? MINIATURAS.get(arquivo) ?? "" : ""));
  const caixaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!arquivo || png) return;
    const el = caixaRef.current;
    const pedir = miniaturaRef.current;
    if (!el || !pedir || typeof IntersectionObserver === "undefined") return;
    let vivo = true;
    const obs = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      obs.disconnect();
      pedir(arquivo)
        .then((img) => { MINIATURAS.set(arquivo, img); if (vivo) setPng(img); })
        .catch(() => { /* sem desenho: fica o gerado pela medida */ });
    }, { rootMargin: "300px" });
    obs.observe(el);
    return () => { vivo = false; obs.disconnect(); };
  }, [arquivo, png, miniaturaRef]);

  return (
    <div ref={caixaRef} style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", minHeight: 0 }}>
      {png
        ? <img src={png} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        : children}
    </div>
  );
}

export function FacasV1a({
  profile, versao, aoNavegar, onNova, onLogout, disponiveis, children,
  pdfs, pdfsMortas, relacao, aoCarregarPdf, aoMiniatura, podeMarcarMorta = true,
}: {
  profile: { nome: string; role?: string };
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
  /** nomes dos PDFs que existem no acervo (share) */
  pdfs?: string[];
  /** subconjunto de `pdfs` que está na subpasta Mortas (faca aposentada) */
  pdfsMortas?: string[];
  /** catálogo vivo, lido das páginas da Relação de Ferramentais */
  relacao?: { cod: string; medida: string; sistema: string; secao: string; arquivo: string }[];
  /** baixa o desenho e devolve uma URL local (blob:) para exibir/abrir */
  aoCarregarPdf?: (arquivo: string) => Promise<string>;
  /** miniatura PNG do desenho (a rota busca a guardada ou manda desenhar) */
  aoMiniatura?: (arquivo: string) => Promise<string>;
  /** faca.marcar_morta — sem ela o catálogo é só consulta (nada de tirar faca
      do ar). Padrão `true` para o protótipo /preview-v3 seguir completo. */
  podeMarcarMorta?: boolean;
}) {
  const [buscaTopo, setBuscaTopo] = useState("");
  /* zoom do desenho técnico: 1 = cabendo na tela; acima disso a área rola.
     A roda do mouse ROLA o desenho (pedido do usuário — é o natural); o zoom
     fica nos botões, no duplo clique e no Ctrl+roda (padrão de visualizador).
     Ouvinte de wheel nativo: o do React nasce passivo e o preventDefault do
     Ctrl+roda não seguraria o zoom da página. */
  const [zoom, setZoom] = useState(1);
  const areaDesenhoRef = useRef<HTMLDivElement | null>(null);
  const arrastoDesenho = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  useEffect(() => {
    const el = areaDesenhoRef.current;
    if (!el) return;
    const aoRodar = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // roda livre = rolagem nativa do desenho
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(1, Math.round((z + (e.deltaY < 0 ? 0.25 : -0.25)) * 100) / 100)));
    };
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  });
  const [sistema, setSistema] = useState("Todos");
  const [secao, setSecao] = useState("Todas");
  /* veio de um resultado da busca do topo? já entra filtrado por ele */
  const [busca, setBusca] = useState(() => colherBusca());
  const [vista, setVista] = useState<"ativas" | "mortas" | "todas">("ativas");
  const [pagina, setPagina] = useState(1);
  const [zf, setZf] = useState("Todos");
  /* filtro por MEDIDA: faixa de largura/altura em mm + ordenação numérica
     (a busca por texto acha "40x", mas não responde "o que existe entre
     40 e 60 mm de largura, da menor para a maior") */
  const [medidaDe, setMedidaDe] = useState("");
  const [medidaAte, setMedidaAte] = useState("");
  const [ordemFacas, setOrdemFacas] = useState<"padrao" | "larg-asc" | "larg-desc">("padrao");
  /* Catálogo compartilhado: mortas, facas acrescentadas e seções vêm do
     banco. Antes valia só no navegador de quem clicou — e faca marcada como
     morta continuava aparecendo viva para o resto da equipe. */
  const [mortas, setMortas] = useState<string[]>(() => MORTAS_INICIAIS.map((f) => f.cod));
  const [extras, setExtras] = useState<Faca[]>([]);
  const [secoesExtra, setSecoesExtra] = useState<string[]>([]);
  const [ultimaMorta, setUltimaMorta] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [comparar, setComparar] = useState<string[]>([]);
  const [modalComparar, setModalComparar] = useState(false);
  const [previewCod, setPreviewCod] = useState("");
  const [confirmCod, setConfirmCod] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [secaoNovaAberta, setSecaoNovaAberta] = useState(false);
  const [secaoNovaNome, setSecaoNovaNome] = useState("");
  const [secaoErro, setSecaoErro] = useState("");
  // modal adicionar faca
  const [novoCod, setNovoCod] = useState("");
  const [novaLarg, setNovaLarg] = useState("");
  const [novaAlt, setNovaAlt] = useState("");
  const [novoSistema, setNovoSistema] = useState("");
  const [novaSecao, setNovaSecao] = useState("");
  const [pdf, setPdf] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novoFabricante, setNovoFabricante] = useState("");
  const [novaEntrega, setNovaEntrega] = useState("");

  async function puxarCatalogo() {
    const r = (await listCatalogoFacas()) as any;
    const mortasBanco: string[] = r?.mortas ?? [];
    // as mortas de fábrica continuam mortas mesmo sem linha no banco
    setMortas([...new Set([...MORTAS_INICIAIS.map((f) => f.cod), ...mortasBanco])]);
    setExtras(((r?.extras ?? []) as string[]).map((j) => { try { return JSON.parse(j) as Faca; } catch { return null; } }).filter(Boolean) as Faca[]);
    setSecoesExtra(r?.secoes ?? []);
  }
  useEffect(() => { void puxarCatalogo().catch(() => { /* servidor fora: catálogo de fábrica */ }); }, []);

  const falhou = (e: unknown, padrao: string) => setAviso(e instanceof Error ? e.message : padrao);
  const gravarMortas = (m: string[]) => {
    const antes = mortas;
    setMortas(m);
    const virouMorta = m.filter((c) => !antes.includes(c));
    const voltou = antes.filter((c) => !m.includes(c));
    for (const cod of virouMorta) void marcarFacaMorta({ data: { cod, morta: true } }).catch((e) => { falhou(e, "Não deu para tirar a faca do catálogo."); void puxarCatalogo(); });
    for (const cod of voltou) void marcarFacaMorta({ data: { cod, morta: false } }).catch((e) => { falhou(e, "Não deu para restaurar a faca."); void puxarCatalogo(); });
  };
  const gravarExtras = (e: Faca[]) => {
    setExtras(e);
    const nova = e[0];
    if (nova) void salvarFacaExtra({ data: { cod: nova.cod, dados: JSON.stringify(nova) } }).catch((err) => { falhou(err, "Não deu para gravar a faca no catálogo."); void puxarCatalogo(); });
  };
  const gravarSecoes = (s: string[]) => {
    setSecoesExtra(s);
    const nome = s[s.length - 1];
    if (nome) void salvarSecaoFaca({ data: { nome } }).catch((err) => { falhou(err, "Não deu para criar a seção."); void puxarCatalogo(); });
  };

  /* Desenhos que estão na pasta da rede e NÃO estão no catálogo.
     O catálogo veio de uma migração única (294 facas fixas no código): quem
     desenhava uma faca nova e salvava o PDF na pasta ficava invisível no hub
     — eram 65 desenhos assim, mais a FAC0274.01 de hoje. Agora eles entram na
     lista marcados como "a classificar", para alguém completar sistema e
     seção uma vez. A medida sai do nome do arquivo quando ele traz (há
     "Faca 105x150.pdf" no acervo); senão fica em branco até classificarem. */
  /* Nome do desenho de uma faca. Precisa ficar ANTES de `orfas()`: a lista de
     filtros roda logo abaixo e já chama todas() — com a definição lá no meio
     do arquivo, o JavaScript estourava "antes da inicialização". */
  /* Chave para casar a mesma faca escrita de jeitos diferentes: a Relação diz
     "fr2-263.01M" e o catálogo antigo diz "263.01" — é a mesma ferramenta. */
  const chaveCod = (cod: string) =>
    String(cod).replace(/^fr2-/i, "").replace(/([\d.]+)[PMD]$/i, "$1").toUpperCase();

  /** Desenho que a Relação aponta para cada faca (preenche buracos do mapa antigo). */
  const arqDaRelacao = new Map((relacao ?? []).map((r) => [chaveCod(r.cod), r.arquivo]));

  const arquivoDe = (cod: string) => {
    const doMapa = PDF_DE(cod).replace(/^facas\//, "");
    if (doMapa) return doMapa;
    const daRelacao = arqDaRelacao.get(chaveCod(cod));
    if (daRelacao && pdfs?.some((p) => p.toLowerCase() === daRelacao.toLowerCase())) return daRelacao;
    /* Fora do mapa da migração: o desenho novo é salvo com o nome do código
       (FAC0274.01.pdf), então basta procurar assim na pasta. Sem isto a faca
       nova apareceria na lista mas sem desenho. */
    const direto = `${cod}.pdf`;
    return pdfs?.some((p) => p.toLowerCase() === direto.toLowerCase()) ? direto : "";
  };

  /* Catálogo: a Relação de Ferramentais MANDA (é o que a equipe mantém), e o
     catálogo antigo do código entra só com o que ela não tem — há 9 facas
     assim, com desenho no acervo, que sumiriam se eu simplesmente trocasse.
     Sem a Relação (share fora do ar) fica valendo o catálogo antigo inteiro. */
  const catalogo = (): Faca[] => {
    const antigas = FACAS as Faca[];
    if (!relacao?.length) return antigas;
    const daRelacao = relacao.map((r) => ({ cod: r.cod, medida: r.medida, sistema: r.sistema, secao: r.secao }));
    const vistas = new Set(daRelacao.map((f) => chaveCod(f.cod)));
    return [...daRelacao, ...antigas.filter((f) => !vistas.has(chaveCod(f.cod)))];
  };

  const A_CLASSIFICAR = "A classificar";
  const orfas = (): Faca[] => {
    if (!pdfs?.length) return [];
    /* Conhecido = tem faca no catálogo (Relação incluída). Sem contar a
       Relação aqui, as facas dela apareceriam como pendência de cadastro. */
    const conhecidos = new Set(
      [...extras, ...catalogo(), ...MORTAS_INICIAIS]
        .map((f) => arquivoDe(f.cod).toLowerCase())
        .filter(Boolean),
    );
    for (const r of relacao ?? []) conhecidos.add(r.arquivo.toLowerCase());
    /* Desenho que está na subpasta Mortas é faca APOSENTADA, não pendência:
       sem esta linha a lista mostrava 132 "a classificar" — 66 de verdade
       mais 66 facas mortas que ninguém precisa cadastrar de novo. */
    const naMortas = new Set((pdfsMortas ?? []).map((n) => n.toLowerCase()));
    return pdfs
      .filter((arq) => !conhecidos.has(arq.toLowerCase()) && !naMortas.has(arq.toLowerCase()))
      .map((arq) => {
        const cod = arq.replace(/\.pdf$/i, "");
        const m = cod.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
        return {
          cod,
          medida: m ? `${m[1]}×${m[2]}` : "",
          sistema: A_CLASSIFICAR,
          secao: A_CLASSIFICAR,
        };
      });
  };

  const todas = (): Faca[] => [...orfas(), ...extras, ...catalogo(), ...MORTAS_INICIAIS];
  const base = (): Faca[] => {
    const viva = (f: Faca) => !mortas.includes(f.cod);
    if (vista === "mortas") return todas().filter((f) => !viva(f));
    if (vista === "todas") return todas();
    return todas().filter(viva);
  };
  const filtradas = (): Faca[] => {
    const casa = criarBusca(busca);
    const de = parseFloat(medidaDe.replace(",", "."));
    const ate = parseFloat(medidaAte.replace(",", "."));
    const l = base().filter((f) => {
      if (sistema !== "Todos" && f.sistema !== sistema) return false;
      if (secao !== "Todas" && f.secao !== secao) return false;
      if (zf !== "Todos" && String(CILINDRO(f.medida, f.cod).z) !== zf) return false;
      const larg = MEDIDAS(f.medida)[0] || 0;
      if (Number.isFinite(de) && larg < de) return false;
      if (Number.isFinite(ate) && larg > ate) return false;
      return casa(f.cod, f.medida);
    });
    if (ordemFacas === "padrao") return l;
    const chave = (f: Faca) => { const n = MEDIDAS(f.medida); return [(n[0] || 0), (n[1] || 0)] as const; };
    return l.slice().sort((x, y) => {
      const a2 = chave(x), b2 = chave(y);
      const dif = (a2[0] - b2[0]) || (a2[1] - b2[1]);
      return ordemFacas === "larg-asc" ? dif : -dif;
    });
  };
  const facaPorCod = (cod: string) => todas().find((f) => f.cod === cod);
  /* "A classificar" só entra nas listas quando existe desenho esperando — não
     faz sentido oferecer um filtro que sempre devolve zero. */
  const temOrfas = orfas().length > 0;
  const secoes = () => SECOES.concat(temOrfas ? [A_CLASSIFICAR] : []).concat(secoesExtra);
  const sistemas = () => (temOrfas ? [A_CLASSIFICAR, ...SISTEMAS] : [...SISTEMAS]);

  const morta = vista === "mortas";
  const lista = filtradas();
  const COLS = 4;
  const pp = COLS * 3;
  const totalPaginas = Math.max(1, Math.ceil(lista.length / pp));
  const pag = Math.min(pagina, totalPaginas);
  const fatia = lista.slice((pag - 1) * pp, pag * pp);

  function alternarComparar(cod: string) {
    const dentro = comparar.includes(cod);
    const novo = dentro ? comparar.filter((c) => c !== cod) : [...comparar, cod].slice(-3);
    setComparar(novo);
    if (!dentro && comparar.length >= 3) setAviso("A comparação mostra até 3 facas.");
  }

  function criarSecao() {
    const nome = secaoNovaNome.trim();
    if (!nome) { setSecaoErro("Dê um nome à seção."); return; }
    if (secoes().some((s) => s.toLowerCase() === nome.toLowerCase())) { setSecaoErro("Já existe uma seção com esse nome."); return; }
    gravarSecoes([...secoesExtra, nome]);
    setSecao(nome);
    setSecaoNovaAberta(false);
    setSecaoNovaNome("");
    setSecaoErro("");
  }

  const compraCompleta = novoValor.trim() !== "" && novoFabricante.trim() !== "" && novaEntrega.trim() !== "";
  const compraParcial = [novoValor, novoFabricante, novaEntrega].some((v) => v.trim() !== "") && !compraCompleta;
  /* O "PDF da faca" saiu da validação: o botão antigo não anexava nada — só
     inventava um nome de arquivo — e ainda era obrigatório. O desenho de
     verdade entra pelo acervo da rede, não por aqui. */
  const novaValida = novoCod.trim().length > 1 && novaLarg.trim() !== "" && novaAlt.trim() !== "" && !!novoSistema && !!novaSecao;

  function salvarFaca() {
    if (!novaValida) return;
    const nova: Faca = {
      cod: novoCod.trim(), medida: `${novaLarg.trim()}×${novaAlt.trim()}`,
      sistema: novoSistema, secao: novaSecao,
      valor: novoValor.trim(), fabricante: novoFabricante.trim(), entrega: novaEntrega.trim(),
    };
    gravarExtras([nova, ...extras]);
    setModalAberto(false); setVista("ativas"); setPagina(1); setSistema(nova.sistema); setSecao("Todas"); setBusca("");
    setNovoCod(""); setNovaLarg(""); setNovaAlt(""); setNovoSistema(""); setNovaSecao(""); setPdf("");
    setNovoValor(""); setNovoFabricante(""); setNovaEntrega("");
    setUltimaMorta(null);
    setAviso(`${nova.cod} adicionada ao catálogo.${compraCompleta ? " Dados da compra guardados no cadastro da faca." : ""}`);
  }

  /* estilos reutilizados */
  const inp: CSSProperties = { width: "100%", boxSizing: "border-box", background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 7, padding: "12px 14px", font: "600 15px/1.2 Inter,sans-serif", color: INK, outline: "none" };
  const kpiStyle = (ativo: boolean): CSSProperties => ({ flex: 1, textAlign: "left", border: 0, cursor: "pointer", borderRadius: 12, padding: "18px 20px 16px", background: ativo ? AMARELO : INK, color: ativo ? INK : "#f1f1f1" });
  const chipStyle = (ativo: boolean): CSSProperties => ({ width: "100%", border: `2px solid ${ativo ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 999, padding: "8px 9px", font: "600 13.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: ativo ? INK : "#f1f1f1", color: ativo ? AMARELO : "#5c5a5c" });
  const rotulo: CSSProperties = { display: "block", font: "600 14.5px/1 Inter,sans-serif", color: "#5c5a5c", marginBottom: 8 };

  const filtrosDiam = (() => {
    const conta: Record<string, number> = {};
    base().forEach((f) => { const c = CILINDRO(f.medida, f.cod); conta[c.z] = (conta[c.z] || 0) + 1; });
    const chaves = Object.keys(conta).sort((a, b) => Number(a) - Number(b));
    return [{ v: "Todos", label: "Todos", titulo: "Todos os cilindros" }].concat(chaves.map((k) => ({
      v: k, label: k + "z", titulo: `${k} Z · Ø ${NUM(Math.round((Number(k) * PASSO_MM) / Math.PI * 10) / 10)} mm · ${conta[k]} facas`,
    })));
  })();

  const previewFaca = previewCod ? facaPorCod(previewCod) : null;
  const confirmFaca = confirmCod ? facaPorCod(confirmCod) : null;

  const temPdf = (cod: string) => {
    const a = arquivoDe(cod);
    return !!a && (!pdfs || pdfs.includes(a));
  };
  const arquivoPreview = previewFaca && temPdf(previewFaca.cod) ? arquivoDe(previewFaca.cod) : "";
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfImagem, setPdfImagem] = useState("");
  const [pdfErro, setPdfErro] = useState("");

  /* A rota recria `aoCarregarPdf` a cada render (a lista de pedidos atualiza
     sozinha), então ela NÃO pode entrar nas dependências: o efeito reiniciaria
     a toda hora e o desenho sumiria. Fica numa ref. */
  const carregaRef = useRef(aoCarregarPdf);
  carregaRef.current = aoCarregarPdf;
  const miniaturaRef = useRef(aoMiniatura);
  miniaturaRef.current = aoMiniatura;

  useEffect(() => {
    const aoCarregarPdf = carregaRef.current;
    if (!arquivoPreview || !aoCarregarPdf) { setPdfUrl(""); setPdfImagem(""); setPdfErro(""); return; }
    let vivo = true;
    let url = "";
    setPdfErro("");
    setPdfImagem("");
    aoCarregarPdf(arquivoPreview)
      .then(async (u) => {
        if (!vivo) { URL.revokeObjectURL(u); return; }
        url = u;
        setPdfUrl(u);
        // desenha a 1ª página como imagem: não depende do visualizador do navegador
        const png = await pdfPrimeiraPagina(u, 1600, arquivoPreview);
        if (vivo) setPdfImagem(png);
      })
      .catch((e: unknown) => { if (vivo) setPdfErro(e instanceof Error ? e.message : "Não deu para abrir o desenho."); });
    return () => { vivo = false; setPdfUrl(""); setPdfImagem(""); if (url) URL.revokeObjectURL(url); };
  }, [arquivoPreview]);
  const novoCilindro = (() => {
    const alt = parseFloat(novaAlt.replace(",", "."));
    if (!isFinite(alt) || alt <= 0) return "informe a altura";
    const c = CILINDRO(String(alt));
    return `Ø ${c.diamFicha} mm · ${c.z} Z · ${c.rep} rep.`;
  })();

  return (
    <EstagioV1a>
      <TopbarV1a
        nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""}
        busca={buscaTopo}
        aoBuscar={setBuscaTopo}
        onSair={onLogout}
      />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="Facas" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        {/* coluna esquerda 400px */}
        <div style={{ flex: "0 0 400px", minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ ...fr(144, 900), fontSize: 82, lineHeight: 0.8, color: INK, margin: "2px 0 2px 6px" }}>Facas</h1>

          <div style={{ display: "flex", gap: 10 }}>
            {([
              { n: todas().filter((f) => !mortas.includes(f.cod)).length, label: "Facas no catálogo", v: "ativas" as const },
              { n: mortas.length, label: "Facas mortas", v: "mortas" as const },
              { n: todas().length, label: "Ver todas", v: "todas" as const },
            ]).map((k) => (
              <button key={k.v} type="button" onClick={() => { setVista(k.v); setPagina(1); }} style={kpiStyle(vista === k.v)}>
                <div style={{ font: "800 34px/1 Inter,sans-serif", letterSpacing: "-.03em" }}>{k.n}</div>
                <div style={{ font: "600 12.5px/1.3 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 10 }}>{k.label}</div>
              </button>
            ))}
          </div>

          {/* Sistemas */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 16px", boxShadow: SOMBRA_CARD }}>
            <div style={{ font: "800 19px/1 Inter,sans-serif", color: INK, marginBottom: 16, letterSpacing: "-.01em" }}>Sistemas</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {["Todos", ...sistemas()].map((nome) => {
                const on = sistema === nome;
                const n = nome === "Todos" ? base().length : base().filter((f) => f.sistema === nome).length;
                return (
                  <button key={nome} type="button" onClick={() => { setSistema(nome); setPagina(1); }}
                    title={nome === A_CLASSIFICAR ? "Desenhos que estão na pasta da rede mas ainda não foram cadastrados" : undefined}
                    style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", border: 0, cursor: "pointer", borderRadius: 6, padding: "11px 12px", font: `${on ? 600 : 500} 14px/1 Inter,sans-serif`, background: on ? INK : "transparent", color: on ? AMARELO : INK }}>
                    <span style={{ flex: "0 0 4px", height: 18, borderRadius: 1, background: nome === "Todos" ? (on ? AMARELO : "#d6d5d6") : nome === A_CLASSIFICAR ? AMARELO : (COR_SISTEMA as Record<string, string>)[nome] }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1 }}>{nome}</span>
                    <span style={{ font: "800 13.5px/1 Inter,sans-serif", padding: "4px 7px", borderRadius: 999, background: on ? "#3a383a" : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seções */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
            <div style={{ font: "800 19px/1 Inter,sans-serif", color: INK, marginBottom: 16, letterSpacing: "-.01em" }}>Seções</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {secoes().map((s) => (
                <button key={s} type="button" className="r2chip" onClick={() => { setSecao(s); setPagina(1); }} style={chipStyle(secao === s)}>{s}</button>
              ))}
              {!secaoNovaAberta && (
                <button type="button" className="r2chip" title="Criar nova seção" onClick={() => { setSecaoNovaAberta(true); setSecaoNovaNome(""); setSecaoErro(""); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, background: "#f1f1f1", border: "1px dashed #c9c8c9", borderRadius: 999, padding: "9px 6px", cursor: "pointer", font: "600 13.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth="2.8" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                  <span>Nova</span>
                </button>
              )}
            </div>
            {secaoNovaAberta && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <input
                    value={secaoNovaNome}
                    onChange={(e) => { setSecaoNovaNome(e.target.value); setSecaoErro(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter") criarSecao(); if (e.key === "Escape") { setSecaoNovaAberta(false); setSecaoNovaNome(""); setSecaoErro(""); } }}
                    placeholder="Nome da seção"
                    autoFocus
                    style={{ flex: 1, minWidth: 0, background: "#f1f1f1", border: "1px solid #e4e3e4", borderRadius: 7, padding: "10px 12px", font: "600 14.5px/1 Inter,sans-serif", color: INK, outline: "none" }}
                  />
                  <button type="button" className="r2chip" onClick={criarSecao} style={{ flex: "none", background: AMARELO, border: 0, borderRadius: 7, padding: "11px 14px", cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", color: INK }}>Criar</button>
                  <button type="button" className="r2ic" title="Cancelar" onClick={() => { setSecaoNovaAberta(false); setSecaoNovaNome(""); setSecaoErro(""); }} style={{ flex: "none", width: 32, height: 32, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 5, cursor: "pointer" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                  </button>
                </div>
                {secaoErro && <div style={{ marginTop: 7, font: "500 12.5px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>{secaoErro}</div>}
              </>
            )}
          </div>

          {/* Diâmetro */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
              <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Diâmetro</span>
              <span style={{ font: "400 12.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3", whiteSpace: "nowrap" }}>cilindro em Z</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, maxHeight: 132, overflow: "auto" }}>
              {filtrosDiam.map((it) => (
                <button key={it.v} type="button" className="r2chip" title={it.titulo} onClick={() => { setZf(it.v); setPagina(1); }}
                  style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "8px 3px", font: "600 12.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: zf === it.v ? AMARELO : "#f1f1f1", color: INK }}>
                  {it.label}
                </button>
              ))}
            </div>
          </div>

          {/* Medidas — faixa de largura + ordenação numérica */}
          <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
              <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Medidas</span>
              <span style={{ font: "400 12.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#b3b1b3", whiteSpace: "nowrap" }}>largura em mm</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input value={medidaDe} onChange={(e) => { setMedidaDe(e.target.value); setPagina(1); }} placeholder="de"
                inputMode="decimal"
                style={{ width: "50%", minWidth: 0, background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 7, padding: "10px 12px", font: "600 15px/1 Inter,sans-serif", color: INK, outline: "none" }} />
              <span style={{ flex: "none", font: "500 14px/1 Inter,sans-serif", color: "#8d8b8d" }}>até</span>
              <input value={medidaAte} onChange={(e) => { setMedidaAte(e.target.value); setPagina(1); }} placeholder="tudo"
                inputMode="decimal"
                style={{ width: "50%", minWidth: 0, background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 7, padding: "10px 12px", font: "600 15px/1 Inter,sans-serif", color: INK, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {([["padrao", "Catálogo"], ["larg-asc", "Largura ↑"], ["larg-desc", "Largura ↓"]] as const).map(([v, rotulo]) => (
                <button key={v} type="button" className="r2chip" onClick={() => { setOrdemFacas(v); setPagina(1); }}
                  style={{ flex: 1, border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 4px", font: "700 12.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: ordemFacas === v ? INK : "#f1f1f1", color: ordemFacas === v ? AMARELO : "#5c5a5c" }}>
                  {rotulo}
                </button>
              ))}
            </div>
            {(medidaDe || medidaAte) && (
              <button type="button" onClick={() => { setMedidaDe(""); setMedidaAte(""); setPagina(1); }}
                style={{ marginTop: 10, background: "transparent", border: 0, cursor: "pointer", font: "500 13px/1 Inter,sans-serif", color: "#8d8b8d", padding: 0 }}>
                limpar faixa de medidas
              </button>
            )}
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: INK, borderRadius: 12, padding: "20px 22px 18px" }}>
            <div style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d" }}>Como funciona</div>
            <div style={{ font: "400 15px/1.5 Inter,sans-serif", color: "#b3b1b3", marginTop: 10 }}>
              Cada faca tem um PDF com o desenho técnico. Ao excluir, a faca não é apagada — ela vai para <strong style={{ color: AMARELO }}>facas mortas</strong> e pode ser restaurada.
            </div>
          </div>
        </div>

        {/* coluna direita — catálogo */}
        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, height: 73, padding: "0 4px 10px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, minWidth: 0 }}>
              <h2 style={{ font: "800 38px/1 Inter,sans-serif", letterSpacing: "-.03em", color: INK, margin: 0, whiteSpace: "nowrap" }}>
                {morta ? "Facas mortas" : vista === "todas" ? "Catálogo completo" : "Catálogo"}
              </h2>
              <span style={{ font: "400 15px/1 Inter,sans-serif", color: "#8d8b8d", whiteSpace: "nowrap" }}>
                {lista.length} {lista.length === 1 ? "faca" : "facas"}{sistema === "Todos" ? "" : ` · ${sistema}`}{morta ? " · fora de uso" : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 999, padding: "0 16px", height: 40, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Código ou medida" style={{ width: 190, border: 0, outline: 0, background: "transparent", font: "400 15px/1 Inter,sans-serif", color: INK }} />
              </div>
              {comparar.length > 0 && (
                <>
                  <button type="button" className="r2chip" onClick={() => { setComparar([]); setModalComparar(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: 0, borderRadius: 999, padding: "12px 16px", cursor: "pointer", font: "600 15px/1 Inter,sans-serif", color: "#5c5a5c", whiteSpace: "nowrap" }}>
                    <span style={{ lineHeight: "16px" }}>{comparar.length} selecionada{comparar.length === 1 ? "" : "s"}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.6" strokeLinecap="round" style={{ flex: "none" }}><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                  </button>
                  <button type="button" className="r2chip" onClick={() => setModalComparar(true)}
                    style={{ display: "flex", alignItems: "center", gap: 9, background: INK, border: 0, borderRadius: 999, padding: "12px 18px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", color: AMARELO, whiteSpace: "nowrap" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M7 4v16" /><path d="M17 4v16" /><path d="M4 8h6" /><path d="M14 16h6" /></svg>
                    <span style={{ lineHeight: "16px" }}>Comparar</span>
                  </button>
                </>
              )}
              <button type="button" className="r2chip" onClick={() => { setModalAberto(true); setAviso(""); }}
                style={{ display: "flex", alignItems: "center", gap: 9, background: AMARELO, border: 0, borderRadius: 999, padding: "12px 18px", cursor: "pointer", font: "700 15px/1 Inter,sans-serif", color: INK, whiteSpace: "nowrap" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                <span style={{ lineHeight: "16px" }}>Adicionar faca</span>
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "20px 22px 16px", boxShadow: SOMBRA_CARD, minHeight: 0 }}>
            <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS},1fr)`, gap: 10 }}>
                {fatia.map((f) => {
                  const cor = (COR_SISTEMA as Record<string, string>)[f.sistema] || "#d6d5d6";
                  const claro = FG_SOBRE(cor) === INK;
                  const fMorta = mortas.includes(f.cod);
                  const selecionada = comparar.includes(f.cod);
                  const cil = CILINDRO(f.medida, f.cod);
                  return (
                    <div key={f.cod} onClick={() => { setPreviewCod(f.cod); setZoom(1); setAviso(""); }}
                      style={{ display: "flex", flexDirection: "column", overflow: "hidden", cursor: "pointer", borderRadius: 10, background: fMorta ? "#fafafa" : "#f1f1f1", border: `2px solid ${fMorta ? "#e9e8e9" : "#f1f1f1"}`, outline: selecionada ? `2px solid ${INK}` : undefined, outlineOffset: selecionada ? -2 : undefined }}>
                      <div style={{ position: "relative", flex: 1, display: "grid", placeItems: "center", minHeight: 196, padding: 12, background: "#fff" }}>
                        <span style={{ position: "absolute", top: 10, right: 10, zIndex: 1, font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, whiteSpace: "nowrap", background: cor, color: claro ? INK : AMARELO }}>{f.sistema}</span>
                        {fMorta && <span style={{ position: "absolute", bottom: 10, left: 10, zIndex: 1, font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, background: INK, color: AMARELO }}>Morta</span>}
                        {/* diâmetro: é o que se procura de relance no catálogo,
                            então vem em corpo grande e em preto/amarelo, não
                            mais como etiqueta cinza de 12,5px */}
                        <span style={{ position: "absolute", top: 9, left: 9, zIndex: 1, display: "inline-flex", alignItems: "baseline", gap: 2, font: `800 20px/1 ${MONO}`, letterSpacing: "-.02em", padding: "8px 12px 7px", borderRadius: 999, whiteSpace: "nowrap", background: INK, color: AMARELO }}>
                          <span style={{ font: `700 13px/1 ${MONO}`, opacity: .7 }}>Ø</span>{cil.diamFicha}
                        </span>
                        <MiniaturaFaca arquivo={temPdf(f.cod) ? arquivoDe(f.cod) : ""} miniaturaRef={miniaturaRef}>
                          <div style={{ display: "grid", placeItems: "center", padding: 7, border: "1px dashed #d6d5d6", borderRadius: f.sistema === "Redonda" ? 999 : 8 }}>
                            <div style={desenhoStyle(f, 132, 200, false)}>
                              <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 9, height: 1, background: "#d6d5d6" }} />
                              <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 1, height: 9, background: "#d6d5d6" }} />
                            </div>
                          </div>
                        </MiniaturaFaca>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 11, padding: "14px 16px 15px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            <div style={{ ...fr(72, 700), minWidth: 0, fontSize: 28, lineHeight: 1, letterSpacing: "-.025em", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.medida}</div>
                            <span style={{ flex: 1 }} />
                            <button type="button" className="r2chip" title={selecionada ? "Remover da comparação" : "Comparar esta faca"}
                              onClick={(e: MouseEvent) => { e.stopPropagation(); alternarComparar(f.cod); }}
                              style={{ flex: "none", width: 38, height: 38, display: "grid", placeItems: "center", border: 0, borderRadius: 5, cursor: "pointer", background: selecionada ? AMARELO : "transparent" }}>
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={selecionada ? INK : "#8d8b8d"} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M7 4v16" /><path d="M17 4v16" /><path d="M4 8h6" /><path d="M14 16h6" /></svg>
                            </button>
                            {podeMarcarMorta && (
                              <button type="button" className="r2ic" title={fMorta ? "Restaurar para o catálogo" : "Marcar faca como morta"}
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                  if (fMorta) { gravarMortas(mortas.filter((c) => c !== f.cod)); setAviso(`${f.cod} voltou para o catálogo.`); setUltimaMorta(null); }
                                  else setConfirmCod(f.cod);
                                }}
                                style={{ flex: "none", width: 38, height: 38, display: "grid", placeItems: "center", background: fMorta ? AMARELO : "transparent", border: 0, borderRadius: 5, cursor: "pointer" }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={fMorta ? INK : "#8d8b8d"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                                  {(fMorta ? ICONE_RESTAURAR : ICONE_EXCLUIR).map((d) => <path key={d} d={d} />)}
                                </svg>
                              </button>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                            <span style={{ flex: "none", maxWidth: "74%", font: `600 14.5px/1 ${MONO}`, letterSpacing: "-.01em", color: "#5c5a5c", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.cod}</span>
                            <span style={{ flex: "none", width: 3, height: 3, borderRadius: 999, background: "#d6d5d6" }} />
                            <span style={{ flex: 1, minWidth: 0, font: "400 14.5px/1.2 Inter,sans-serif", color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.secao}</span>
                          </div>
                        </div>
                        <button type="button" className="r2chip" onClick={(e: MouseEvent) => { e.stopPropagation(); setPreviewCod(f.cod); setZoom(1); setAviso(""); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", border: 0, borderRadius: 999, padding: "11px 14px", cursor: "pointer", whiteSpace: "nowrap", font: "700 14.5px/1 Inter,sans-serif", letterSpacing: ".05em", color: INK }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                          <span style={{ lineHeight: "13px", whiteSpace: "nowrap" }}>Abrir PDF</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {lista.length === 0 && (
                <div style={{ display: "grid", placeItems: "center", height: 180, font: "400 15px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
                  {vista === "mortas" && sistema === "Todos" && secao === "Todas" && zf === "Todos" && !busca
                    ? "Nenhuma faca morta — as facas excluídas do catálogo aparecem aqui."
                    : "Nenhuma faca encontrada com esse filtro."}
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid #f1f1f1" }}>
              <span style={{ font: "400 15px/1 Inter,sans-serif", color: "#8d8b8d" }}>
                Mostrando {lista.length === 0 ? 0 : (pag - 1) * pp + 1}–{Math.min(pag * pp, lista.length)} de {lista.length}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {(() => {
                  const botoes: { label: string; alvo?: number; ativo?: boolean }[] = [{ label: "‹", alvo: pag - 1 }];
                  const janela: number[] = [];
                  for (let i = 1; i <= totalPaginas; i++) if (i === 1 || i === totalPaginas || Math.abs(i - pag) <= 2) janela.push(i);
                  let anterior = 0;
                  janela.forEach((i) => {
                    if (i - anterior > 1) botoes.push({ label: "…" });
                    botoes.push({ label: String(i), alvo: i, ativo: i === pag });
                    anterior = i;
                  });
                  botoes.push({ label: "›", alvo: pag + 1 });
                  return botoes.map((b, i) => b.alvo === undefined
                    ? <span key={i} style={{ minWidth: 22, height: 30, display: "grid", placeItems: "center", font: "600 15px/1 Inter,sans-serif", color: "#b3b1b3" }}>…</span>
                    : (
                      <button key={i} type="button" onClick={() => setPagina(Math.min(Math.max(1, b.alvo!), totalPaginas))}
                        style={{ minWidth: 30, height: 30, padding: "0 8px", display: "grid", placeItems: "center", background: b.ativo ? INK : "#f1f1f1", border: 0, borderRadius: 5, cursor: "pointer", font: `${b.ativo ? 700 : 600} 13px/1 Inter,sans-serif`, color: b.ativo ? AMARELO : INK }}>
                        {b.label}
                      </button>
                    ));
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* modal — adicionar faca */}
      {modalAberto && (
        <div className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div style={{ width: 820, display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)", maxHeight: "100%", overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>R2 Hub · catálogo de facas</div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", whiteSpace: "nowrap", color: INK, marginTop: 10 }}>Adicionar faca</div>
              </div>
              <button type="button" className="r2ic" data-esc-fechar onClick={() => setModalAberto(false)} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "stretch" }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M6.5 6.5 20 20" /><path d="M20 4 10.5 13.5" /><path d="M6 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" /><path d="M6 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5" /></svg>
                  <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Identificação</span>
                </div>
                <label style={rotulo}>Código da faca <span style={{ color: INK }}>*</span></label>
                <input value={novoCod} onChange={(e) => setNovoCod(e.target.value)} placeholder="Ex.: FAC0266.01" style={inp} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, marginBottom: 14 }}>
                  <div>
                    <label style={rotulo}>Largura (mm) <span style={{ color: INK }}>*</span></label>
                    <input value={novaLarg} onChange={(e) => setNovaLarg(e.target.value)} placeholder="59,5" style={inp} />
                  </div>
                  <div>
                    <label style={rotulo}>Altura (mm) <span style={{ color: INK }}>*</span></label>
                    <input value={novaAlt} onChange={(e) => setNovaAlt(e.target.value)} placeholder="40" style={inp} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f1f1f1", borderRadius: 7, padding: "12px 14px" }}>
                  <span style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>Cilindro sugerido</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ font: `700 15px/1 ${MONO}`, color: INK, whiteSpace: "nowrap" }}>{novoCilindro}</span>
                </div>
                <label style={{ ...rotulo, margin: "16px 0 10px" }}>Seção <span style={{ color: INK }}>*</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                  {secoes().slice(1).map((s) => (
                    <button key={s} type="button" className="r2chip" onClick={() => setNovaSecao(s)} style={chipStyle(novaSecao === s)}>{s}</button>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                  <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Sistema e PDF</span>
                </div>
                <label style={{ ...rotulo, marginBottom: 10 }}>Sistema <span style={{ color: INK }}>*</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
                  {SISTEMAS.map((s) => (
                    <button key={s} type="button" className="r2chip" onClick={() => setNovoSistema(s)} style={chipStyle(novoSistema === s)}>{s}</button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f1f1f1", borderRadius: 8, padding: "12px 14px", marginTop: 16 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                  <span style={{ font: "400 13.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>
                    O desenho técnico (PDF) entra pelo acervo de facas na rede, com o mesmo código — o cadastro aqui não envia arquivo.
                  </span>
                </div>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M9 3.5h6v3H9z" /><path d="M9 5H6.5v16.5h11V5H15" /><path d="m9.3 13.2 2.1 2.1 3.6-3.7" /></svg>
                <span style={{ font: "800 17px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Compra da faca</span>
                <span style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: "#f1f1f1", color: "#5c5a5c", borderRadius: 999, padding: "7px 12px 6px", whiteSpace: "nowrap" }}>opcional</span>
                <span style={{ flex: 1 }} />
                <span style={{ font: "400 13.5px/1.3 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>vai para Apontamentos</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 10 }}>
                <div>
                  <label style={rotulo}>Valor (R$)</label>
                  <input value={novoValor} onChange={(e) => setNovoValor(e.target.value)} placeholder="1.450,00" style={inp} />
                </div>
                <div>
                  <label style={rotulo}>Fabricante</label>
                  <input value={novoFabricante} onChange={(e) => setNovoFabricante(e.target.value)} placeholder="Ex.: Fermatec" style={inp} />
                </div>
                <div>
                  <label style={rotulo}>Data de entrega</label>
                  <input value={novaEntrega} onChange={(e) => setNovaEntrega(e.target.value)} placeholder="dd/mm/aa" style={inp} />
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                {["Fermatec", "Rotoflex", "Cortag", "Vinco Sul"].map((nome) => {
                  const on = novoFabricante.trim() === nome;
                  return (
                    <button key={nome} type="button" className="r2chip" onClick={() => setNovoFabricante(nome)}
                      style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "9px 13px", font: "600 13.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                      {nome}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 14, borderRadius: 7, padding: "12px 13px", background: compraCompleta ? AMARELO : "#fafafa", color: compraCompleta ? INK : compraParcial ? "#a76a00" : "#8d8b8d" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={compraCompleta ? INK : compraParcial ? "#a76a00" : "#8d8b8d"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>
                <span style={{ flex: 1, font: "500 14.5px/1.45 Inter,sans-serif" }}>
                  {compraCompleta
                    ? "Valor, fabricante e data preenchidos — esta faca entra no gasto com ferramental em Apontamentos."
                    : compraParcial
                      ? "Faltam dados: Apontamentos só recebe facas com valor, fabricante e data de entrega preenchidos."
                      : "Sem esses dados a faca entra apenas no catálogo, sem lançamento em Apontamentos."}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
                {novaValida ? "Pronto — a faca entra no catálogo com o PDF anexado." : "Código, medidas, sistema, seção e PDF são obrigatórios."}
              </span>
              <button type="button" className="r2chip" onClick={() => setModalAberto(false)} style={{ background: "#fff", border: 0, borderRadius: 7, padding: "15px 22px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer" }}>Cancelar</button>
              <button type="button" className="r2chip" onClick={salvarFaca}
                style={{ display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, cursor: novaValida ? "pointer" : "not-allowed", opacity: novaValida ? 1 : 0.45 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                <span style={{ lineHeight: "17px" }}>Adicionar ao catálogo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal — comparar facas */}
      {modalComparar && comparar.length > 0 && (
        <div onClick={() => setModalComparar(false)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 64, display: "flex", alignItems: "center", justifyContent: "center", padding: 26, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 1416, maxWidth: "100%", maxHeight: "100%", display: "flex", flexDirection: "column", gap: 14, background: "#f1f1f1", borderRadius: 14, padding: 26, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>
                  Catálogo de facas · {comparar.length} selecionada{comparar.length === 1 ? "" : "s"}
                </div>
                <div style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", color: INK, marginTop: 10 }}>Comparar facas</div>
              </div>
              <button type="button" className="r2ic" onClick={() => setModalComparar(false)} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${Math.max(1, comparar.length)},1fr)`, gap: 14 }}>
              {(() => {
                const itens = comparar.map((cod) => facaPorCod(cod)).filter(Boolean) as Faca[];
                const spec = (f: Faca): Record<string, string> => {
                  const c = CILINDRO(f.medida, f.cod);
                  const n = MEDIDAS(f.medida);
                  return {
                    Medida: f.medida, Sistema: f.sistema,
                    Cilindro: `${c.z} Z${c.real ? "" : " (est.)"}`,
                    "Diâmetro": `Ø ${CILINDRO(f.medida, f.cod).diamFicha} mm`,
                    "Repetições": String(c.rep),
                    Largura: `${NUM(n[0] || 0)} mm`,
                    "Seção": f.secao || "—",
                  };
                };
                const specs = itens.map(spec);
                const chaves = ["Medida", "Sistema", "Cilindro", "Diâmetro", "Repetições", "Largura", "Seção"];
                const difere: Record<string, boolean> = {};
                chaves.forEach((k) => { difere[k] = new Set(specs.map((sp) => sp[k])).size > 1; });
                return itens.map((f, i) => {
                  const cor = (COR_SISTEMA as Record<string, string>)[f.sistema] || "#d6d5d6";
                  return (
                    <div key={f.cod} style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: SOMBRA_CARD }}>
                      <div style={{ position: "relative", flex: 1, minHeight: 440, background: "#fafafa", display: "grid", placeItems: "center" }}>
                        <span style={{ position: "absolute", top: 10, left: 10, zIndex: 1, font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "6px 10px 5px", borderRadius: 999, whiteSpace: "nowrap", background: cor, color: FG_SOBRE(cor) }}>{f.sistema}</span>
                        <button type="button" className="r2ic" title="Remover da comparação" onClick={() => alternarComparar(f.cod)}
                          style={{ position: "absolute", top: 10, right: 10, zIndex: 1, width: 26, height: 26, display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                        </button>
                        {/* faltava a MiniaturaFaca: a comparação só desenhava o
                            retângulo gerado pela medida e nunca pedia o PNG do
                            PDF — o mesmo desenho que o cartão do catálogo mostra */}
                        <div style={{ width: "100%", height: "100%", minHeight: 0, display: "grid", placeItems: "center", padding: 16 }}>
                          <MiniaturaFaca arquivo={temPdf(f.cod) ? arquivoDe(f.cod) : ""} miniaturaRef={miniaturaRef}>
                            <div style={{ display: "grid", placeItems: "center", padding: 12, border: "1.5px dashed #d6d5d6", borderRadius: f.sistema === "Redonda" ? 999 : 10 }}>
                              <div style={desenhoStyle(f, 380, 380, true)}>
                                <span style={{ font: `500 13.5px/1 ${MONO}`, color: "#b3b1b3" }}>{f.medida}</span>
                              </div>
                            </div>
                          </MiniaturaFaca>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 18px 18px" }}>
                        {/* hierarquia: medida grande, depois o diâmetro (o dado
                            que decide a comparação) e só então a lista */}
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ ...fr(72, 700), fontSize: 34, lineHeight: 1, letterSpacing: "-.025em", color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.medida}</div>
                            <div style={{ font: `500 14px/1 ${MONO}`, color: "#8d8b8d", marginTop: 9 }}>{f.cod}</div>
                          </div>
                          <span style={{ flex: 1 }} />
                          <span style={{ flex: "none", display: "inline-flex", alignItems: "baseline", gap: 3, font: `800 24px/1 ${MONO}`, letterSpacing: "-.02em", padding: "10px 14px 9px", borderRadius: 999, whiteSpace: "nowrap", background: INK, color: AMARELO }}>
                            <span style={{ font: `700 14px/1 ${MONO}`, opacity: .7 }}>Ø</span>{CILINDRO(f.medida, f.cod).diamFicha}
                            <span style={{ font: `600 12px/1 ${MONO}`, opacity: .7 }}>mm</span>
                          </span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#f1f1f1", borderRadius: 7, overflow: "hidden" }}>
                          {chaves.map((k) => (
                            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", background: difere[k] ? AMARELO : "#fff" }}>
                              <span style={{ font: "700 13px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: difere[k] ? "rgba(37,36,37,.62)" : "#8d8b8d", whiteSpace: "nowrap" }}>{k}</span>
                              <span style={{ flex: 1 }} />
                              <span style={{ font: `700 18px/1 ${MONO}`, letterSpacing: "-.01em", color: INK, whiteSpace: "nowrap" }}>{specs[i][k]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 4px" }}>
              <span style={{ font: "400 13.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>Valores em destaque são os que diferem entre as facas comparadas.</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="r2chip" onClick={() => { setComparar([]); setModalComparar(false); }} style={{ background: "#fff", border: 0, borderRadius: 999, padding: "11px 16px", cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>Limpar seleção</button>
            </div>
          </div>
        </div>
      )}

      {/* modal — preview da faca */}
      {previewFaca && (
        <div onClick={() => setPreviewCod("")} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 62, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          {/* Desenho técnico é para LER: a modal ocupa quase tudo e as bordas
              encolheram — a folha vertical deixava metade da largura vazia. */}
          <div onClick={(e) => e.stopPropagation()} style={{ width: "94%", height: "94%", display: "flex", flexDirection: "column", gap: 10, background: "#f1f1f1", borderRadius: 14, padding: "16px 18px 14px", boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
              {/* A ficha técnica anda JUNTO da medida: em cima, em letrinha
                  cinza, ela se perdia — é o dado que se procura ao abrir. */}
              <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "6px 14px" }}>
                <span style={{ ...fr(96, 700), fontSize: 38, lineHeight: 1, letterSpacing: "-.03em", whiteSpace: "nowrap", color: INK }}>{previewFaca.medida}</span>
                <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  {[
                    `Ø ${CILINDRO(previewFaca.medida, previewFaca.cod).diamFicha} mm`,
                    `${CILINDRO(previewFaca.medida, previewFaca.cod).z} Z`,
                    `${CILINDRO(previewFaca.medida, previewFaca.cod).rep} rep.`,
                    previewFaca.secao,
                  ].filter(Boolean).map((t, i) => (
                    <span key={String(t) + i}
                      style={{ background: i === 0 ? INK : "#fff", color: i === 0 ? AMARELO : INK, borderRadius: 999, padding: "7px 12px", font: `700 14px/1 ${MONO}`, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>
                      {t}
                    </span>
                  ))}
                </span>
                <span style={{ font: `500 12.5px/1.2 ${MONO}`, letterSpacing: ".08em", textTransform: "uppercase", color: "#b3b1b3", whiteSpace: "nowrap" }}>{previewFaca.cod}.pdf</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", padding: "9px 13px", borderRadius: 999, whiteSpace: "nowrap", background: (COR_SISTEMA as Record<string, string>)[previewFaca.sistema] || "#d6d5d6", color: FG_SOBRE((COR_SISTEMA as Record<string, string>)[previewFaca.sistema] || "#d6d5d6") }}>{previewFaca.sistema}</span>
                <button type="button" className="r2ic" onClick={() => setPreviewCod("")} style={{ width: 36, height: 36, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                </button>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "12px 14px 12px", boxShadow: SOMBRA_CARD }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                <span style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Desenho técnico</span>
                <span style={{ flex: 1 }} />
                <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#b3b1b3" }}>
                  {pdfErro || (pdfImagem ? "desenho do acervo" : arquivoPreview ? "abrindo o desenho…" : "sem PDF no acervo · desenho gerado pela medida")}
                </span>
                {pdfImagem && (
                  <span style={{ flex: "none", display: "flex", alignItems: "center", gap: 2, background: "#f1f1f1", borderRadius: 999, padding: 2, marginLeft: 10 }}>
                    <button type="button" className="r2ic" title="Diminuir" disabled={zoom <= 1}
                      onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.5) * 10) / 10))}
                      style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 999, cursor: zoom <= 1 ? "default" : "pointer", opacity: zoom <= 1 ? .35 : 1, font: "700 17px/1 Inter,sans-serif", color: INK }}>−</button>
                    {/* em 1 o desenho cabe inteiro, e "100%" daria a entender
                        tamanho real — o rótulo diz o que a vista é */}
                    <button type="button" className="r2chip" title="Mostrar o desenho inteiro" onClick={() => setZoom(1)}
                      style={{ minWidth: 52, height: 26, border: 0, borderRadius: 999, padding: "0 10px", background: zoom === 1 ? AMARELO : "transparent", cursor: "pointer", font: `700 12.5px/1 ${MONO}`, color: INK }}>
                      {zoom === 1 ? "inteiro" : `${Math.round(zoom * 100)}%`}
                    </button>
                    <button type="button" className="r2ic" title="Aproximar" disabled={zoom >= 4}
                      onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.5) * 10) / 10))}
                      style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 999, cursor: zoom >= 4 ? "default" : "pointer", opacity: zoom >= 4 ? .35 : 1, font: "700 17px/1 Inter,sans-serif", color: INK }}>+</button>
                  </span>
                )}
              </div>
              {pdfImagem ? (
                // Padrão = desenho INTEIRO na tela. Era ajustado à largura, e
                // desenho técnico é mais alto que largo: abria cortado no pé,
                // escondendo justamente as cotas de baixo. Ampliar (+ ou duplo
                // clique) volta a encher a largura e aí sim rola e arrasta.
                <div ref={areaDesenhoRef}
                  /* flex, não grid: em grid a linha é `auto` e cresce com a
                     imagem, então `max-height:100%` no desenho não tinha
                     contra o que resolver e ele continuava saindo pelo pé */
                  style={{ flex: 1, minHeight: 0, overflow: zoom > 1 ? "auto" : "hidden", background: "#fafafa", borderRadius: 8, padding: 8, display: "flex", alignItems: zoom > 1 ? "flex-start" : "center", justifyContent: zoom > 1 ? "flex-start" : "center", cursor: zoom > 1 ? "grab" : "zoom-in", touchAction: "none" }}
                  onDoubleClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
                  onPointerDown={(e) => {
                    if (!areaDesenhoRef.current) return;
                    arrastoDesenho.current = { x: e.clientX, y: e.clientY, sl: areaDesenhoRef.current.scrollLeft, st: areaDesenhoRef.current.scrollTop };
                    areaDesenhoRef.current.setPointerCapture?.(e.pointerId);
                    areaDesenhoRef.current.style.cursor = "grabbing";
                  }}
                  onPointerMove={(e) => {
                    const a = arrastoDesenho.current, el = areaDesenhoRef.current;
                    if (!a || !el) return;
                    el.scrollLeft = a.sl - (e.clientX - a.x);
                    el.scrollTop = a.st - (e.clientY - a.y);
                  }}
                  onPointerUp={() => {
                    arrastoDesenho.current = null;
                    if (areaDesenhoRef.current) areaDesenhoRef.current.style.cursor = "grab";
                  }}
                  title={zoom > 1
                    ? "Role ou arraste para percorrer o desenho · duplo clique volta ao inteiro"
                    : "Duplo clique aproxima · Ctrl+roda aproxima e afasta"}>
                  <img src={pdfImagem} alt={`Desenho da faca ${previewFaca.cod}`}
                    style={zoom > 1
                      ? { flex: "none", width: `${zoom * 100}%`, height: "auto", objectFit: "contain" }
                      /* inteiro: ocupa a área e o `contain` encaixa o desenho
                         nela sem deformar — é o que garante ver o pé da peça */
                      : { flex: 1, minWidth: 0, minHeight: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
              ) : (
                <div style={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", background: "#fafafa", borderRadius: 8, padding: 26 }}>
                  <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
                    <div style={{ display: "grid", placeItems: "center", padding: 12, border: "1.5px dashed #d6d5d6", borderRadius: previewFaca.sistema === "Redonda" ? 999 : 10 }}>
                      <div style={desenhoStyle(previewFaca, 470, 222, true)}>
                        <span style={{ font: `500 13.5px/1 ${MONO}`, color: "#b3b1b3" }}>{previewFaca.medida}</span>
                      </div>
                    </div>
                    <span style={{ position: "absolute", left: 0, right: 0, bottom: -24, textAlign: "center", font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#b3b1b3" }}>
                      {previewFaca.cod} · {arquivoPreview ? "carregando" : "sem PDF no acervo"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ flex: 1, font: "400 14.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
                {arquivoPreview ? `Acervo · ${arquivoPreview}` : "Sem desenho no acervo para este código."}
              </span>
              {podeMarcarMorta && (
                <button type="button" className="r2chip"
                  onClick={() => {
                    const cod = previewFaca.cod;
                    if (mortas.includes(cod)) { gravarMortas(mortas.filter((c) => c !== cod)); setPreviewCod(""); setAviso(`${cod} voltou para o catálogo.`); setUltimaMorta(null); }
                    else { setConfirmCod(cod); setPreviewCod(""); }
                  }}
                  style={{ background: "#fff", border: 0, borderRadius: 7, padding: "15px 20px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {mortas.includes(previewFaca.cod) ? "Restaurar para o catálogo" : "Marcar como morta"}
                </button>
              )}
              <button type="button" className="r2chip"
                onClick={() => {
                  if (pdfUrl) {
                    // nova aba quando o navegador deixa; senão baixa o arquivo
                    const aba = window.open(pdfUrl, "_blank", "noopener");
                    if (!aba) {
                      const a = document.createElement("a");
                      a.href = pdfUrl;
                      a.download = arquivoPreview;
                      a.click();
                    }
                    return;
                  }
                  setAviso(arquivoPreview ? "O desenho ainda está carregando." : `Não há desenho no acervo para ${previewFaca.cod}.`);
                  setPreviewCod("");
                  setUltimaMorta(null);
                }}
                style={{ display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap", background: AMARELO, border: 0, borderRadius: 7, padding: "15px 22px", font: "700 15px/1 Inter,sans-serif", color: INK, cursor: "pointer", opacity: arquivoPreview ? 1 : 0.5 }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                <span style={{ lineHeight: "17px" }}>Abrir PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* modal — confirmar morta */}
      {confirmFaca && (
        <div className="r2modal" style={{ position: "absolute", inset: 0, zIndex: 64, display: "flex", alignItems: "center", justifyContent: "center", padding: 26, background: "rgba(37,36,37,.6)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
          <div style={{ width: 520, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 13, padding: "26px 28px 24px", boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 38, height: 38, flex: "none", display: "grid", placeItems: "center", background: AMARELO, borderRadius: 999 }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8v5" /><path d="M12 16.4h.01" /><path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
              </span>
              <div style={{ ...fr(72, 700), fontSize: 26, lineHeight: 1.05, letterSpacing: "-.02em", color: INK }}>Marcar como morta — {confirmFaca.cod}?</div>
            </div>
            <div style={{ font: "400 15px/1.5 Inter,sans-serif", color: "#5c5a5c", margin: "14px 0 0" }}>
              A faca <strong style={{ color: INK }}>{confirmFaca.medida}</strong> sai do catálogo e vai para <strong style={{ color: INK }}>facas mortas</strong>. O PDF continua guardado e ela pode ser restaurada a qualquer momento.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 22 }}>
              <span style={{ flex: 1 }} />
              <button type="button" className="r2chip" data-esc-fechar onClick={() => setConfirmCod("")} style={{ background: "#f1f1f1", border: 0, borderRadius: 7, padding: "14px 20px", font: "600 15px/1 Inter,sans-serif", color: INK, cursor: "pointer" }}>Cancelar</button>
              <button type="button" className="r2chip"
                onClick={() => { gravarMortas([...mortas, confirmCod]); setAviso(`${confirmCod} movida para facas mortas.`); setUltimaMorta(confirmCod); setConfirmCod(""); }}
                style={{ display: "flex", alignItems: "center", gap: 9, background: INK, border: 0, borderRadius: 7, padding: "14px 20px", font: "700 15px/1 Inter,sans-serif", color: AMARELO, cursor: "pointer", whiteSpace: "nowrap" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4.5 7h15" /><path d="M9.5 7V4.5h5V7" /><path d="M6.5 7l1 13h9l1-13" /></svg>
                <span style={{ lineHeight: "16px" }}>Mover para mortas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* aviso com desfazer */}
      {aviso && (
        <div style={{ position: "absolute", left: "50%", bottom: 34, transform: "translateX(-50%)", zIndex: 70, display: "flex", alignItems: "center", gap: 12, background: INK, borderRadius: 999, padding: "14px 16px 14px 22px", boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
          <span style={{ font: "500 15px/1 Inter,sans-serif", color: "#f1f1f1" }}>{aviso}</span>
          {ultimaMorta && (
            <button type="button" className="r2chip"
              onClick={() => { gravarMortas(mortas.filter((c) => c !== ultimaMorta)); setAviso(`${ultimaMorta} restaurada.`); setUltimaMorta(null); }}
              style={{ background: AMARELO, border: 0, borderRadius: 999, padding: "7px 13px", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: INK, cursor: "pointer" }}>
              Desfazer
            </button>
          )}
          <button type="button" className="r2ic" onClick={() => { setAviso(""); setUltimaMorta(null); }} style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: "#3a383a", border: 0, borderRadius: 999, cursor: "pointer" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
          </button>
        </div>
      )}
      {children}
    </EstagioV1a>
  );
}
