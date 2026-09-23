// Novo pedido — Hub 1.0. Fonte: design_handoff_hub_1.0/Novo pedido 1.0.dc.html
//
// Substitui a NovaArteModalV1a: deixa de ser modal e vira TELA. A diferença
// não é só de moldura — a modal abria por cima de onde a pessoa estava e o
// formulário cabia numa caixa; aqui as quatro etapas são cartões grandes e
// cada uma abre um painel de 1920×614 com espaço para o catálogo de facas, o
// desenho da faca e a tabela Pantone lado a lado.
//
// Campos: os do projeto 1.0, que é mais enxuto que a modal. Saíram pasta da
// rede, altura, forma, descrição das cores, link de referência, observação da
// matéria e o rascunho automático. Decisão do Augusto em 22/09/2026 —
// "seguir como o protótipo".
//
// Medidas: a FACA define a medida da etiqueta. Em vez de digitar largura e
// altura, escolhe-se a faca no catálogo e a medida dela vira a medida do
// pedido; "Largura" e "Carreiras" na etapa 2 são da BOBINA, não da etiqueta.
//
// Ainda sem coluna própria no banco: Laminação fosca e Laminação brilho. Elas
// entram no briefing para o designer ver — é o que importa hoje. Coluna certa
// (como picote/verniz/cold stamp têm) fica para quando o resto do hub souber
// filtrar por elas.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { FACAS } from "../v1a/dados/facas";
import { PDF_DE } from "../v1a/dados/facas-cilindro";
import { PANTONE_SC } from "../v1a/dados/pantone";
import { AvisoV1a } from "../v1a/HubV1a";
import { criarBusca } from "@/lib/busca";
import type { CadastrosV1a } from "../v1a/dados/cadastros";
import type { NovaSolicitacaoDados } from "../v1a/modais/NovaArteModalV1a";
import {
  AMARELO, AMARELO_MAIS, BarraTopoHub10, FR, FUNDO, FUNDO_PAINEL, INTER, PRETO, PalcoFixo,
} from "./ChromeHub10";
import { pdfPrimeiraPagina } from "@/lib/pdf-preview";
import type { SessionUser } from "@/lib/session";

/* tons dos quatro cartões — clareiam da etapa 1 para a 4 */
const TOM_ETAPA = ["#fff079", "#fff5a8", "#fff9cc", "#fffce7"];
const CINZA = "#8a8a8a";
const CLARO = "#b3b1b3";

/* `cartao` só existe onde o handoff escreve algo diferente no cartão da
   tela inicial e no painel aberto — na etapa 3. */
type Passo = { etapa: string; t1: string; t2: string; sub: string; cartao?: string; img: string; top: number; h: number };
const PASSOS: Passo[] = [
  { etapa: "Etapa 1", t1: "Briefing", t2: "e anexos", sub: "O que precisa ser criado, anexos e referências.", img: "/np10/npilu1.png", top: 286, h: 205 },
  { etapa: "Etapa 2", t1: "Medidas", t2: "e substrato", sub: "Medidas e matéria-prima necessária para produção.", img: "/np10/npilu2b.png", top: 256, h: 238 },
  { etapa: "Etapa 3", t1: "Cores e", t2: "acabamento", sub: "Cores, com pícote, serrilha... especifique aqui.", cartao: "Quantas cores, com pícote, serrilha... especifique aqui.", img: "/np10/npilu3.png", top: 286, h: 205 },
  { etapa: "Etapa 4", t1: "Revisão", t2: "e concluir", sub: "Confira antes de mandar para a fila do design.", img: "/np10/npilu4.png", top: 260, h: 240 },
];

/* As duas colunas de substrato são as do handoff, na ordem dele. Não são as
   mesmas da modal V1a ("Papel couché", "BOPP Matte"…): o design renomeou e
   encurtou a lista. O que a equipe cadastrou em `cadastros` entra depois,
   como extra, na coluna mais curta — é o que o protótipo faz com os
   substratos digitados na hora. */
const SUB_COL_A = ["BOPP Removível", "BOPP metalizado", "BOPP transparente", "BOPP fosco", "Pérola"];
const SUB_COL_B = ["Couché", "Cartão", "Térmico", "Nylon", "Polietileno"];
const QTD_CORES = [1, 2, 3, 4, 5, 6];

/* Os quatro primeiros têm coluna no banco; os dois últimos ainda não. */
const ACABAMENTOS: { nome: string; desc: string; campo?: "picote" | "tarjaVerso" | "coldStamp" | "verniz" }[] = [
  { nome: "Picote", desc: "corte pontilhado que facilita o destaque manual", campo: "picote" },
  { nome: "Tarja no verso", desc: "faixa adesiva impressa no verso da etiqueta", campo: "tarjaVerso" },
  { nome: "Cold stamp", desc: "aplicação metalizada a frio para brilho", campo: "coldStamp" },
  { nome: "Verniz", desc: "camada que protege e realça áreas da arte", campo: "verniz" },
  { nome: "Laminação fosca", desc: "película fosca que reduz o reflexo" },
  { nome: "Laminação brilho", desc: "película brilhante que intensifica as cores" },
];

const PANTONE_PADRAO = ["485 C", "185 C", "300 C", "877 C", "355 C", "021 C", "2945 C", "032 C", "1235 C", "476 C", "Black 6 C", "424 C"];

/** hex de um código Pantone, ou cinza quando não está na tabela */
const hexPant = (cod: string) => PANTONE_SC.find((p) => p.c.toLowerCase() === cod.toLowerCase())?.h ?? "#d9d9d9";

/** "35×22" → { largura: "35", altura: "22" }. O sufixo (" SER") é descartado. */
function medidaEmLados(medida: string): { largura: string; altura: string } {
  const n = (medida.match(/[\d.,]+/g) ?? []).slice(0, 2);
  return { largura: n[0] ?? "", altura: n[1] ?? "" };
}

/* O 1.0 não pergunta a forma — ela sai do sistema da faca, que é a informação
   que o catálogo já tem. Sem isto o pedido chegaria na produção sem forma. */
function formaDoSistema(sistema: string, largura: string, altura: string): string {
  if (sistema === "Redonda") return "Redonda";
  if (sistema === "Gap") return "GAP";
  if (sistema === "Figura" || sistema === "Tag") {
    const a = parseFloat(largura.replace(",", ".")), b = parseFloat(altura.replace(",", "."));
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.5 ? "Quadrada" : "Retangular";
  }
  return "Recorte especial";
}

const ROTULO: CSSProperties = { fontFamily: INTER, fontSize: 13, fontWeight: 600, letterSpacing: ".16em", color: CLARO };
const CAMPO: CSSProperties = { border: `1.5px dashed ${PRETO}`, borderRadius: 14, display: "flex", alignItems: "center", padding: "0 18px", gap: 8, cursor: "text", background: "transparent" };
const ENTRADA: CSSProperties = { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: INTER, fontSize: 20, fontWeight: 600, color: PRETO };
const PLANO: CSSProperties = { background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 22, fontWeight: 500, color: PRETO };
/* Os painéis das etapas são cinza bem claro, como os do detalhe do pedido —
   Augusto, 23/09/2026: "fundo cinza em todos os cards brancos". Caixas que
   abrem por cima (menus, pré-visualização do PDF, sucesso) seguem brancas. */
const PAINEL_BRANCO: CSSProperties = { position: "absolute", top: 0, height: 614, background: FUNDO_PAINEL, overflow: "hidden" };

/** Só dígitos, com uma vírgula decimal. Campo de medida não recebe letra:
    "BOPP" digitado na Largura vira largura inválida e chega assim no pedido.
    Ponto do teclado numérico vira vírgula, que é como o hub escreve. */
const soNumero = (v: string) => {
  const limpo = v.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [inteiro, ...resto] = limpo.split(",");
  return resto.length ? inteiro + "," + resto.join("") : inteiro;
};

function Radio({ ligado }: { ligado: boolean }) {
  return (
    <span style={{ width: 18, height: 18, border: `1.6px solid ${PRETO}`, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      {ligado && <span style={{ width: 9, height: 9, borderRadius: 999, background: PRETO }} />}
    </span>
  );
}

function XisPequeno({ tamanho = 13, cor = PRETO }: { tamanho?: number; cor?: string }) {
  return <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} style={{ flex: "none" }} fill="none" stroke={cor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}

export function NovoPedidoHub10({ profile, aoNavegar, onLogout, disponiveis, cadastros, podeCadastrarMateria, aoCadastrarMateria, pedidos = [], aoCriar, aoCarregarPdfFaca, aoSair }: {
  profile: SessionUser;
  aoNavegar: (label: string) => void;
  onLogout: () => void;
  disponiveis?: string[];
  cadastros?: CadastrosV1a;
  /** quem pode cadastrar matéria-prima para todo mundo (cadastro.materiais) */
  podeCadastrarMateria?: boolean;
  aoCadastrarMateria?: (nome: string) => Promise<unknown>;
  /** pedidos já carregados — alimentam os Pantones "usados por clientes" */
  pedidos?: { cores_desc?: string | null }[];
  aoCriar?: (dados: NovaSolicitacaoDados) => Promise<{ num?: string; aviso?: string } | void> | void;
  /** devolve uma object URL do PDF da faca (a rota já tem o carregador) */
  aoCarregarPdfFaca?: (arquivo: string) => Promise<string>;
  /** volta para de onde veio (a Home, normalmente) */
  aoSair: () => void;
}) {
  /* ————— etapa aberta ————— */
  const [etapa, setEtapa] = useState<number | null>(null);

  /* ————— campos ————— */
  const [nome, setNome] = useState("");
  const [briefing, setBriefing] = useState("");
  const [anexos, setAnexos] = useState<File[]>([]);
  const [arrastando, setArrastando] = useState(false);

  const [facaCod, setFacaCod] = useState("");
  const [buscaFaca, setBuscaFaca] = useState("");
  const [materia, setMateria] = useState("");
  const [novoSubAberto, setNovoSubAberto] = useState(false);
  const [novoSubTexto, setNovoSubTexto] = useState("");
  const [largura, setLargura] = useState("");
  const [carreiras, setCarreiras] = useState("");

  const [qtdCores, setQtdCores] = useState("");
  const [coresTexto, setCoresTexto] = useState("");
  const [buscaPant, setBuscaPant] = useState("");
  const [listaPantAberta, setListaPantAberta] = useState(false);
  const [verUsados, setVerUsados] = useState(false);
  const [pantSel, setPantSel] = useState<string[]>([]);
  const [acab, setAcab] = useState<Record<string, boolean>>({});

  /* ————— envio ————— */
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ num: string; aviso?: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [pdfAmpliado, setPdfAmpliado] = useState(false);

  /* Precisa marcar vivo NA MONTAGEM, não só na declaração: em StrictMode o
     efeito monta, desmonta e monta de novo, e a limpeza do primeiro ciclo
     deixaria a ref em false para sempre — o envio ficava preso em
     "Enviando…" com o pedido já criado no servidor. */
  const vivoRef = useRef(true);
  useEffect(() => {
    vivoRef.current = true;
    return () => { vivoRef.current = false; };
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pdfAmpliado) { setPdfAmpliado(false); return; }
      if (novoSubAberto) { setNovoSubAberto(false); return; }
      if (listaPantAberta) { setListaPantAberta(false); return; }
      if (etapa !== null) setEtapa(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [pdfAmpliado, novoSubAberto, listaPantAberta, etapa]);

  /* ————— faca escolhida e seu desenho ————— */
  const faca = useMemo(() => FACAS.find((f) => f.cod === facaCod) ?? null, [facaCod]);
  const arquivoFaca = facaCod ? PDF_DE(facaCod).replace(/^facas\//, "") : "";
  const [desenho, setDesenho] = useState("");
  /* O carregador vem da rota, que o recria a cada render. Se ele entrasse nas
     dependências, o efeito reexecutaria sem parar: revogaria a URL do blob
     com o pdf.js ainda lendo e recomeçaria o download. Guardado em ref, só o
     arquivo dispara o carregamento — é o que o FacasV1a já fazia. */
  const carregaRef = useRef(aoCarregarPdfFaca);
  carregaRef.current = aoCarregarPdfFaca;
  useEffect(() => {
    const carregar = carregaRef.current;
    if (!arquivoFaca || !carregar) { setDesenho(""); return; }
    let vivo = true;
    let url = "";
    setDesenho("");
    carregar(arquivoFaca)
      .then(async (u) => {
        if (!vivo) { URL.revokeObjectURL(u); return; }
        url = u;
        const png = await pdfPrimeiraPagina(u, 1400, arquivoFaca);
        if (vivo) setDesenho(png);
      })
      .catch(() => { /* sem desenho no acervo — a tela mostra o vazio do projeto */ });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [arquivoFaca]);

  /* `criarBusca` em vez de `includes` cru: a medida é gravada com "×" e
     quem digita escreve "x" — "38,66×40" não casava com "38,66x40" e o
     catálogo dizia que a faca não existe. A regra é a mesma do resto do
     hub (sem acento, ×/* viram x, vírgula vira ponto, com e sem espaço). */
  const facasFiltradas = useMemo(() => {
    const casa = criarBusca(buscaFaca);
    return FACAS.filter((f) => casa(f.cod, f.medida)).slice(0, 120);
  }, [buscaFaca]);

  /* ————— substratos —————
     As colunas são só as dez fixas do handoff. O espaço vertical é justo para
     cinco por coluna: qualquer item a mais desce por cima do "Largura".
     Substrato fora da lista não entra nas colunas — vira a pastilha amarela
     acima, que é como o handoff resolve. */
  const substratoDigitado = !!materia && !SUB_COL_A.includes(materia) && !SUB_COL_B.includes(materia);

  /* Digitar já escolhe o substrato, como no handoff — não é preciso confirmar
     para que ele valha. O ✓ e o Enter só fecham a caixinha.
     O cadastro na tabela `cadastros` é acréscimo nosso: as colunas continuam
     sendo as dez do handoff, mas o nome fica guardado para as outras telas do
     hub, que é o que a modal antiga já fazia. Falhar nisso não desfaz a
     escolha — o pedido segue com o substrato digitado. */
  const digitarSubstrato = (v: string) => { setNovoSubTexto(v); setMateria(v.trim()); };
  const confirmarSubstrato = () => {
    const v = novoSubTexto.trim();
    setNovoSubAberto(false);
    setNovoSubTexto("");
    if (!v) return;
    setMateria(v);
    if (podeCadastrarMateria && aoCadastrarMateria && !(cadastros?.materiais ?? []).some((m) => m.nome.toLowerCase() === v.toLowerCase())) {
      void Promise.resolve(aoCadastrarMateria(v))
        .catch(() => setAviso(`"${v}" vale para este pedido, mas não deu para guardar na lista de matérias-primas.`));
    }
  };
  const cancelarSubstrato = () => { setNovoSubAberto(false); setNovoSubTexto(""); };

  /* ————— Pantone ————— */
  const usadosPorClientes = useMemo(() => {
    const conta: Record<string, number> = {};
    for (const p of pedidos) {
      for (const c of String(p.cores_desc ?? "").split(/[,;]/)) {
        const nome = c.trim().replace(/^pantone\s+/i, "");
        if (nome) conta[nome] = (conta[nome] ?? 0) + 1;
      }
    }
    const ordenados = Object.keys(conta).sort((a, b) => conta[b] - conta[a]);
    return (ordenados.length ? ordenados : PANTONE_PADRAO).slice(0, 12);
  }, [pedidos]);

  const pantResultados = useMemo(() => {
    if (verUsados) return usadosPorClientes.map((c) => ({ c, h: hexPant(c) }));
    const t = buscaPant.trim().toLowerCase();
    if (!t) return PANTONE_SC.slice(0, 12).map((p) => ({ c: p.c, h: p.h }));
    return PANTONE_SC.filter((p) => p.c.toLowerCase().includes(t)).slice(0, 12).map((p) => ({ c: p.c, h: p.h }));
  }, [verUsados, buscaPant, usadosPorClientes]);

  const alternarPant = (cod: string) =>
    setPantSel((s) => (s.includes(cod) ? s.filter((x) => x !== cod) : [...s, cod]));

  /* ————— anexos ————— */
  const somarAnexos = (lista: FileList | null | undefined) => {
    if (!lista || !lista.length) return;
    setAnexos((a) => [...a, ...Array.from(lista)]);
  };

  /* ————— o que falta, por etapa ————— */
  const faltas = useMemo(() => {
    const f: { etapa: number; campo: string }[] = [];
    if (!nome.trim()) f.push({ etapa: 0, campo: "Nome do cliente" });
    if (!briefing.trim()) f.push({ etapa: 0, campo: "Briefing" });
    if (!facaCod) f.push({ etapa: 1, campo: "Faca" });
    if (!materia.trim()) f.push({ etapa: 1, campo: "Matéria-prima" });
    if (!largura.trim()) f.push({ etapa: 1, campo: "Largura" });
    if (!carreiras.trim()) f.push({ etapa: 1, campo: "Carreiras" });
    if (!qtdCores && !coresTexto.trim()) f.push({ etapa: 2, campo: "Cores" });
    return f;
  }, [nome, briefing, facaCod, materia, largura, carreiras, qtdCores, coresTexto]);

  const lados = faca ? medidaEmLados(faca.medida) : { largura: "", altura: "" };
  const acabEscolhidos = ACABAMENTOS.filter((a) => acab[a.nome]);

  /* Resumo da etapa 4: rótulos, ordem e formato são os do handoff. A medida
     não é linha própria — ela vem colada no código da faca. */
  const nomesCores = coresTexto.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const coresBase = nomesCores.length
    ? nomesCores.join(" · ")
    : (qtdCores ? `${qtdCores} ${qtdCores === "1" ? "cor" : "cores"}` : "—");
  const resumo: [string, string][] = [
    ["SUBSTRATO", materia || "—"],
    ["LARGURA", `${largura || "—"} mm`],
    ["CARREIRAS", carreiras || "—"],
    ["FACA", facaCod ? `${facaCod}${faca ? ` · ${faca.medida}` : ""}` : "—"],
    ["CORES", pantSel.length ? `${coresBase}  ·  ${pantSel.map((c) => `Pantone ${c}`).join(" · ")}` : coresBase],
    ["ACABAMENTO", acabEscolhidos.map((a) => a.nome).join(" · ") || "—"],
  ];

  const enviar = () => {
    if (enviando) return;
    if (faltas.length) {
      setEtapa(faltas[0].etapa);
      setErro(`Faltam campos obrigatórios: ${faltas.map((x) => x.campo).join(", ")}.`);
      return;
    }
    if (!aoCriar) { setAviso("Você não tem permissão para criar pedidos."); return; }
    setErro("");
    setEnviando(true);

    /* Laminação não tem coluna: vai no briefing para o designer ver. */
    const semColuna = acabEscolhidos.filter((a) => !a.campo).map((a) => a.nome);
    const descricao = [briefing.trim(), semColuna.length ? `Acabamento: ${semColuna.join(", ")}.` : ""]
      .filter(Boolean).join("\n");
    const ligado = (campo: string) => (acabEscolhidos.some((a) => a.campo === campo) ? "1" : "0");
    const coresLista = [coresTexto.trim(), ...pantSel].filter(Boolean);

    Promise.resolve(aoCriar({
      cliente: nome.trim(),
      medida: faca ? faca.medida : "",
      substrato: materia,
      cores: coresLista,
      obs: descricao,
      origem: "Vendas",
      arquivos: anexos,
      facaCod,
      detalhes: {
        materia,
        /* "Largura" da etapa 2 é a da BOBINA; a da etiqueta sai da faca */
        largMateria: largura,
        largura: lados.largura,
        altura: lados.altura,
        forma: faca ? formaDoSistema(faca.sistema, lados.largura, lados.altura) : "",
        cores: qtdCores || String(coresLista.length || 1),
        coresDesc: coresLista.join(", "),
        carreiras,
        descricao,
        linkRef: "",
        picote: ligado("picote"),
        tarjaVerso: ligado("tarjaVerso"),
        coldStamp: ligado("coldStamp"),
        verniz: ligado("verniz"),
      },
    }))
      .then((r) => {
        if (!vivoRef.current) return;
        setEnviado({ num: r?.num ?? "", aviso: r?.aviso });
        setEtapa(null);
      })
      .catch((e: unknown) => { if (vivoRef.current) setErro(e instanceof Error ? e.message : "Não deu para enviar o pedido."); })
      .finally(() => { if (vivoRef.current) setEnviando(false); });
  };

  const recomeçar = () => {
    setNome(""); setBriefing(""); setAnexos([]);
    setFacaCod(""); setBuscaFaca(""); setMateria(""); setLargura(""); setCarreiras("");
    setQtdCores(""); setCoresTexto(""); setPantSel([]); setAcab({}); setBuscaPant("");
    setErro(""); setEnviado(null); setEtapa(null);
  };

  /* Apagar limpa só os campos DA ETAPA ABERTA — o botão fica ao lado de
     "Editar" e apagar o formulário inteiro dali seria uma armadilha. */
  const apagarEtapa = () => {
    if (etapa === 0) { setNome(""); setBriefing(""); setAnexos([]); }
    if (etapa === 1) { setFacaCod(""); setMateria(""); setLargura(""); setCarreiras(""); setBuscaFaca(""); }
    if (etapa === 2) { setQtdCores(""); setCoresTexto(""); setPantSel([]); setAcab({}); }
    if (etapa === 3) recomeçar();
  };

  const agora = new Date();
  const dataAgora = agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const horaAgora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  /* Só as três primeiras etapas têm campo para preencher — a 4ª é a
     conferência. Contando as quatro, o formulário em branco anunciava "1 de 4
     etapas prontas", como se já houvesse algo feito. */
  const ETAPAS_COM_CAMPO = 3;
  const prontas = ETAPAS_COM_CAMPO - new Set(faltas.map((f) => f.etapa)).size;

  return (
    <PalcoFixo>
      {/* faixa preta do rodapé */}
      <div style={{ position: "absolute", left: 0, top: 726, width: 1920, height: 354, background: PRETO, zIndex: 1 }} />

      {/* os quatro cartões */}
      <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 616, display: "flex", alignItems: "stretch", zIndex: 2 }}>
        {PASSOS.map((p, i) => (
          <button key={p.etapa} onClick={() => { setEtapa(i); setErro(""); }} className="np10-card"
            style={{ position: "relative", flex: "0 0 25%", background: TOM_ETAPA[i], border: `1px solid ${PRETO}`, borderLeft: "none", borderTop: "none", cursor: "pointer", color: PRETO, height: 616, padding: 0, textAlign: "left", font: "inherit" }}>
            <img src={p.img} alt="" style={{ position: "absolute", left: 0, top: p.top, width: 480, height: p.h, pointerEvents: "none" }} />
            <span style={{ position: "absolute", left: 80, top: 60, fontSize: 22, fontWeight: 600, letterSpacing: "-.01em" }}>{p.etapa}</span>
            <svg className="np10-seta" width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", right: 70, top: 58 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            <div style={{ position: "absolute", left: 80, top: 126, width: 400, ...FR, fontSize: 64, lineHeight: "60px", letterSpacing: "-.03em" }}>{p.t1}<br />{p.t2}</div>
            <div style={{ position: "absolute", left: 80, top: 504, width: 340, fontSize: 24, lineHeight: 1.34, fontWeight: 400, letterSpacing: "-.01em" }}>{p.cartao ?? p.sub}</div>
          </button>
        ))}
      </div>

      <div style={{ position: "absolute", left: 72, top: 813, margin: 0, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 144", fontWeight: 600, fontSize: 112, lineHeight: 1, letterSpacing: "-.01em", color: FUNDO, zIndex: 3 }}>Novo pedido</div>

      {/* o protótipo põe duas linhas de status aqui; são o estado real do
          formulário, não texto fixo */}
      <div style={{ position: "absolute", left: 960, top: 849, width: 850, color: FUNDO, fontSize: 24, lineHeight: 1.5, zIndex: 3, display: "flex", flexDirection: "column", gap: 6 }}>
        <div>{nome.trim() ? `Pedido de ${nome.trim()}` : "Comece pelo nome do cliente e o briefing."}</div>
        <div style={{ color: "#bdbdbd" }}>
          {faltas.length === 0 ? "Tudo preenchido — abra a etapa 4 para conferir e enviar." : `${prontas} de ${ETAPAS_COM_CAMPO} etapas prontas · falta ${faltas.map((f) => f.campo).join(", ")}.`}
        </div>
      </div>

      <div style={{ position: "absolute", left: 72, top: 998, right: 72, display: "flex", alignItems: "center", fontSize: 19, color: FUNDO, zIndex: 30 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, fontFamily: INTER, fontSize: 24, fontWeight: 400, color: "#fff" }}>
          <span>{dataAgora}</span><span style={{ fontWeight: 600 }}>{horaAgora}</span>
        </div>
        <button onClick={aoSair} style={{ marginLeft: 150, background: "none", border: "none", cursor: "pointer", fontFamily: INTER, fontSize: 19, color: FUNDO, padding: 0, opacity: .75 }}>Sair sem enviar</button>
        <div style={{ marginLeft: "auto", ...FR, fontSize: 24, color: FUNDO, whiteSpace: "nowrap" }}>R2hub 1.0</div>
      </div>

      {/* ————— painel da etapa ————— */}
      {etapa !== null && (
        <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 614, background: FUNDO, zIndex: 6, color: PRETO, fontFamily: INTER, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 480, top: 0, width: 1440, height: 614, zIndex: 1 }}>

            {/* ——— etapa 1: briefing e anexos ——— */}
            {etapa === 0 && (
              <>
                <div style={{ ...PAINEL_BRANCO, left: 0, width: 960 }}>
                  <button onClick={() => setEtapa(null)} className="np10-flat" style={{ ...PLANO, position: "absolute", left: 76, top: 60 }}>Editar</button>
                  <button onClick={apagarEtapa} className="np10-flat" style={{ ...PLANO, position: "absolute", right: 80, top: 60 }}>Apagar</button>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="*Nome do cliente" aria-label="Nome do cliente"
                    style={{ position: "absolute", left: 76, top: 118, width: 824, border: "none", outline: "none", background: "transparent", ...FR, fontSize: 38, letterSpacing: "-.02em", color: PRETO }} />
                  <div style={{ position: "absolute", left: 76, top: 176, fontStyle: "italic", fontSize: 16, color: CINZA }}>A pasta na rede vem do nome do cliente, anexos e artes vão para lá.</div>
                  <textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} placeholder="Detalhe o que o cliente pediu pra fazer." aria-label="Briefing"
                    style={{ position: "absolute", left: 76, top: 228, width: 824, height: 150, boxSizing: "border-box", border: `1.5px dashed ${PRETO}`, borderRadius: 18, padding: "16px 20px", outline: "none", resize: "none", background: "transparent", fontFamily: INTER, fontSize: 20, lineHeight: 1.45, color: PRETO }} />

                  <div style={{ position: "absolute", left: 76, top: 410, width: 824, display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ flex: "none", ...FR, fontSize: 38, letterSpacing: "-.02em" }}>Anexos</span>
                    <div className="np10-chips" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, overflowX: "auto", padding: "2px 0" }}>
                      {anexos.map((a, i) => (
                        <div key={`${a.name}-${i}`} style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 8px 0 15px", border: `1px solid ${PRETO}`, borderRadius: 999, background: AMARELO, fontSize: 14, fontWeight: 500 }}>
                          <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                          <button onClick={() => setAnexos((x) => x.filter((_, k) => k !== i))} aria-label={`Remover ${a.name}`}
                            style={{ flex: "none", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}><XisPequeno /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div onDrop={(e) => { e.preventDefault(); setArrastando(false); somarAnexos(e.dataTransfer?.files); }}
                    onDragOver={(e) => { e.preventDefault(); if (!arrastando) setArrastando(true); }}
                    onDragLeave={(e) => { e.preventDefault(); if (arrastando) setArrastando(false); }}
                    style={{ position: "absolute", left: 76, top: 474, width: 824 }}>
                    <label className="np10-flat" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", height: 84, padding: "0 16px", border: `1.5px dashed ${PRETO}`, borderRadius: 18, background: arrastando ? "#fff5a8" : "transparent", fontFamily: INTER, fontSize: 18, fontWeight: 600, color: PRETO, cursor: "pointer" }}>
                      <input type="file" multiple onChange={(e) => { somarAnexos(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
                      <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Adicionar ou arrastar
                    </label>
                  </div>
                </div>

                <div style={{ ...PAINEL_BRANCO, left: 960, width: 480, borderLeft: `1px solid ${PRETO}`, padding: "14px 80px 46px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, height: 148, marginBottom: -18 }}>
                    <img src="/np10/bp-joinha2.png" alt="" style={{ flex: "none", display: "block", width: 57.43, height: 81.61, objectFit: "contain" }} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 40", fontWeight: 600, fontSize: 24, lineHeight: 1.12, letterSpacing: "-.05em", whiteSpace: "nowrap" }}>Boas práticas<br />na solicitação</span>
                  </div>
                  <div style={{ position: "absolute", top: 140, width: 320, fontSize: 16, lineHeight: 1.3, color: PRETO }}>Detalhe o que o cliente pediu de forma clara e organizada. Textos que devem aparecer na arte (nomes, ingredientes, validade, peso, CNPJ, etc.), referências visuais do que o cliente gostou e o que ele NÃO quer. Evite frases vagas como “arte bonita” ou “algo diferente”. Quanto mais completo o pedido, mais rápido e fiel será o resultado, evitando retrabalhos.</div>
                  <div style={{ position: "absolute", top: 328, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 40", fontWeight: 600, fontSize: 24, letterSpacing: "-.01em" }}>Exemplo</div>
                  <div style={{ position: "absolute", top: 380, width: 320, fontSize: 16, lineHeight: 1.3, color: PRETO }}>Rótulo para pote de geleia artesanal. Textos: “Geleia Artesanal de Morango”, Ingredientes, Validade: 12 meses, Peso: 250g e logo da marca. Referência: o cliente gostou do rótulo da Cacau Show, fundo claro, letra elegante e simples, e um desenho pequeno de fruta no cantinho. O cliente NÃO quer: cores escuras ou letra difícil de ler.</div>
                </div>
              </>
            )}

            {/* ——— etapa 2: medidas e substrato ——— */}
            {etapa === 1 && (
              <>
                <div style={{ ...PAINEL_BRANCO, left: 0, width: 480, borderRight: `1px solid ${PRETO}` }} />
                <div style={{ ...PAINEL_BRANCO, left: 960, width: 480, borderLeft: `1px solid ${PRETO}` }} />

                <button onClick={() => aoNavegar("Facas")} className="np10-flat" style={{ ...PLANO, position: "absolute", left: 80, top: 58, zIndex: 3, display: "flex", alignItems: "center", gap: 7 }}>
                  Ver catálogo<svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </button>
                <div style={{ position: "absolute", left: 80, top: 118, ...FR, fontSize: 38, letterSpacing: "-.02em", zIndex: 2 }}>Catálogo de facas</div>
                <label style={{ ...CAMPO, position: "absolute", left: 80, top: 176, width: 320, height: 63, zIndex: 2, gap: 12 }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input value={buscaFaca} onChange={(e) => setBuscaFaca(e.target.value)} placeholder="Buscar por código ou medida" aria-label="Buscar faca"
                    style={{ ...ENTRADA, fontSize: 17, fontWeight: 400 }} />
                </label>
                <div style={{ position: "absolute", left: 80, top: 258, width: 340, height: 310, overflowY: "auto", display: "grid", gridTemplateColumns: "1fr", gap: 16, alignContent: "start", zIndex: 2 }}>
                  {facasFiltradas.map((f) => (
                    <button key={f.cod} onClick={() => setFacaCod(f.cod)} title={f.cod}
                      style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, border: `1px solid ${PRETO}`, borderRadius: 10, background: f.cod === facaCod ? AMARELO : "#fff", padding: "12px 22px", cursor: "pointer", overflow: "hidden", textAlign: "left" }}>
                      <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: ".01em", color: PRETO, whiteSpace: "nowrap" }}>{f.medida}</span>
                      <span style={{ fontSize: 12, color: CINZA, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.cod}</span>
                    </button>
                  ))}
                  {!facasFiltradas.length && <div style={{ fontSize: 14, color: CLARO, padding: "10px 4px" }}>Nenhuma faca encontrada.</div>}
                </div>

                <div style={{ position: "absolute", left: 480, top: 0, width: 480, height: 614, background: FUNDO_PAINEL, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {desenho ? (
                    <img onClick={() => setPdfAmpliado(true)} src={desenho} alt={`Desenho ${facaCod}`} style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in" }} />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: CLARO, textAlign: "center" }}>
                      <svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M7 9h10M7 13h6" /></svg>
                      <span style={{ fontFamily: INTER, fontSize: 17 }}>{facaCod ? (arquivoFaca ? "abrindo o desenho…" : "sem desenho no acervo") : "Escolha uma faca ao lado"}</span>
                    </div>
                  )}
                </div>

                {novoSubAberto ? (
                  <div style={{ position: "absolute", left: 1010, top: 52, zIndex: 20, width: 288, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 16, padding: 16, boxShadow: "0 22px 50px -18px rgba(0,0,0,.55)" }}>
                    <div style={{ fontFamily: INTER, fontSize: 13, fontWeight: 700, letterSpacing: ".06em", color: CINZA, marginBottom: 8 }}>NOVO SUBSTRATO</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 8px 0 14px", border: `1.5px dashed ${PRETO}`, borderRadius: 12 }}>
                      <input autoFocus value={novoSubTexto} onChange={(e) => digitarSubstrato(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") confirmarSubstrato(); else if (e.key === "Escape") { e.stopPropagation(); cancelarSubstrato(); } }}
                        placeholder="Digite o substrato" aria-label="Novo substrato" style={{ ...ENTRADA, fontSize: 16, fontWeight: 500 }} />
                      <button onClick={confirmarSubstrato} aria-label="Confirmar substrato"
                        style={{ flex: "none", width: 30, height: 30, borderRadius: 999, border: "none", background: PRETO, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setNovoSubAberto(true); setNovoSubTexto(""); }} className="np10-flat"
                    style={{ position: "absolute", left: 1010, top: 52, zIndex: 3, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, fontFamily: INTER, fontSize: 22, fontWeight: 600, color: PRETO, cursor: "pointer", whiteSpace: "nowrap" }}>
                    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Novo substrato
                  </button>
                )}

                <div style={{ position: "absolute", left: 1010, top: 118, ...FR, fontSize: 34, letterSpacing: "-.02em", zIndex: 2 }}>Matéria-prima</div>
                {/* A coluna A tem container de 190 mas botões de 250: o texto
                    transborda de propósito, como no handoff. Sem isso "BOPP
                    transparente" quebra em duas linhas e a coluna desce por
                    cima do "Largura". */}
                {[SUB_COL_A, SUB_COL_B].map((coluna, ci) => (
                  <div key={ci} style={{ position: "absolute", left: ci === 0 ? 1008 : 1260, top: 205, width: ci === 0 ? 190 : 180, display: "flex", flexDirection: "column", gap: 16, zIndex: 2 }}>
                    {coluna.map((m) => (
                      <button key={m} onClick={() => setMateria(m)}
                        style={{ display: "flex", alignItems: "center", gap: 11, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 24, color: PRETO, textAlign: "left", letterSpacing: "-.5px", whiteSpace: "nowrap", width: ci === 0 ? 250 : undefined }}>
                        <Radio ligado={materia === m} />{m}
                      </button>
                    ))}
                  </div>
                ))}

                {/* substrato fora da lista: pastilha, não rádio */}
                {substratoDigitado && !novoSubAberto && (
                  <div style={{ position: "absolute", left: 1230, top: 46, zIndex: 3, maxWidth: 200, display: "inline-flex", alignItems: "center", gap: 9, height: 38, padding: "0 8px 0 16px", border: `1.5px solid ${PRETO}`, borderRadius: 999, background: AMARELO, fontFamily: INTER, fontSize: 16, fontWeight: 600, color: PRETO }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{materia}</span>
                    <button onClick={() => setMateria("")} className="np10-flat" aria-label="Remover substrato"
                      style={{ flex: "none", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}><XisPequeno tamanho={14} /></button>
                  </div>
                )}

                <div style={{ position: "absolute", left: 1010, top: 452, ...FR, fontSize: 34, letterSpacing: "-.02em", zIndex: 2 }}>Largura</div>
                <label style={{ ...CAMPO, position: "absolute", left: 1012, top: 512, width: 150, height: 56, zIndex: 2 }}>
                  {/* Largura é medida em mm: só número, com vírgula ou ponto
                      para a fração. Letra aqui vira matéria-prima escrita no
                      campo errado e chega assim no pedido. */}
                  <input value={largura} onChange={(e) => setLargura(soNumero(e.target.value))} inputMode="decimal" aria-label="Largura da bobina em mm" style={ENTRADA} />
                  <span style={{ flex: "none", fontSize: 15, color: CINZA }}>mm</span>
                </label>
                <div style={{ position: "absolute", left: 1250, top: 452, ...FR, fontSize: 34, letterSpacing: "-.02em", zIndex: 2 }}>Carreiras</div>
                <label style={{ ...CAMPO, position: "absolute", left: 1252, top: 512, width: 150, height: 56, zIndex: 2 }}>
                  {/* Carreiras é contagem: inteiro, sem letra e sem fração. */}
                  <input value={carreiras} onChange={(e) => setCarreiras(e.target.value.replace(/\D/g, ""))} inputMode="numeric" aria-label="Carreiras" style={ENTRADA} />
                </label>
              </>
            )}

            {/* ——— etapa 3: cores e acabamento ——— */}
            {etapa === 2 && (
              <>
                <div style={{ ...PAINEL_BRANCO, left: 0, width: 480, borderRight: `1px solid ${PRETO}` }} />

                <button onClick={() => setEtapa(null)} className="np10-flat" style={{ ...PLANO, position: "absolute", left: 80, top: 58, zIndex: 3 }}>Editar</button>
                <button onClick={apagarEtapa} className="np10-flat" style={{ ...PLANO, position: "absolute", left: 325, top: 58, zIndex: 3 }}>Apagar</button>

                <span style={{ position: "absolute", left: 80, top: 118, ...FR, fontSize: 38, letterSpacing: "-.02em", zIndex: 2 }}>Cores</span>
                <div style={{ position: "absolute", left: 80, top: 170, width: 320, height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, zIndex: 2 }}>
                  {QTD_CORES.map((q) => {
                    const on = qtdCores === String(q);
                    return (
                      <button key={q} onClick={() => setQtdCores(on ? "" : String(q))} className="np10-flat"
                        style={{ width: 40, height: 40, flex: "none", borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: INTER, fontSize: 18, fontWeight: 700, cursor: "pointer",
                          background: on ? AMARELO_MAIS : "#fff", border: `1.5px solid ${on ? PRETO : "#dcdcdc"}`, color: on ? PRETO : CINZA }}>{q}</button>
                    );
                  })}
                </div>
                <textarea value={coresTexto} onChange={(e) => setCoresTexto(e.target.value)} placeholder="Cores (ex.: Laranja)" aria-label="Cores"
                  style={{ position: "absolute", left: 80, top: 222, width: 320, height: 64, boxSizing: "border-box", border: `1.5px dashed ${PRETO}`, borderRadius: 14, padding: "12px 16px", outline: "none", resize: "none", background: "transparent", fontFamily: INTER, fontSize: 20, lineHeight: 1.25, color: PRETO, zIndex: 2 }} />

                <div style={{ position: "absolute", left: 80, top: 320, width: 320, display: "flex", alignItems: "baseline", justifyContent: "space-between", zIndex: 2 }}>
                  <span style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>PANTONE</span>
                  <button onClick={() => aoNavegar("Pantone")} className="np10-flat" style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 15, fontWeight: 600, color: CINZA }}>
                    Ver tudo<svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </button>
                </div>

                <div style={{ position: "absolute", left: 80, top: 368, width: 320, zIndex: 20 }}>
                  <label style={{ width: 320, height: 44, boxSizing: "border-box", border: `1px solid ${PRETO}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 10, padding: "0 6px 0 16px", cursor: "text", background: "#fff" }}>
                    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                    <input value={buscaPant} onChange={(e) => { setBuscaPant(e.target.value); setListaPantAberta(true); setVerUsados(false); }} onFocus={() => setListaPantAberta(true)}
                      placeholder="Buscar Pantone (ex.: 021)" aria-label="Buscar Pantone" style={{ ...ENTRADA, fontSize: 15, fontWeight: 400 }} />
                    <button onClick={() => { setVerUsados((v) => !v); setListaPantAberta(true); }} className="np10-flat" title="Cores usadas por clientes"
                      style={{ flex: "none", width: 30, height: 30, borderRadius: 999, border: "none", background: verUsados ? PRETO : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={verUsados ? AMARELO : CINZA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.8 1-5.8L3.5 9.2l5.9-.9z" /></svg>
                    </button>
                  </label>
                  {listaPantAberta && (
                    <div style={{ marginTop: 6, width: 320, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 14, boxShadow: "0 18px 40px -16px rgba(0,0,0,.5)", padding: 6, display: "flex", flexDirection: "column", gap: 4, maxHeight: 250, overflowY: "auto" }}>
                      {pantResultados.map((p) => (
                        <button key={p.c} onClick={() => alternarPant(p.c)} title={p.c}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", border: "none", borderRadius: 10, background: pantSel.includes(p.c) ? "#f4f4f2" : "transparent", cursor: "pointer", textAlign: "left" }}>
                          <span style={{ flex: "none", width: 24, height: 24, borderRadius: 7, background: p.h, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.14)" }} />
                          <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                            <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 700, color: PRETO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.c}</span>
                            <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: CLARO }}>{p.h}</span>
                          </span>
                          {pantSel.includes(p.c) && <svg width={16} height={16} style={{ flex: "none" }} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </button>
                      ))}
                      {!pantResultados.length && <div style={{ padding: "10px 12px", fontFamily: INTER, fontSize: 14, color: CLARO }}>Nenhum Pantone encontrado</div>}
                    </div>
                  )}
                </div>

                <div style={{ position: "absolute", left: 80, top: 428, fontFamily: INTER, fontSize: 12, fontWeight: 700, letterSpacing: ".14em", color: CLARO, zIndex: 2 }}>SELECIONADAS {pantSel.length ? `(${pantSel.length})` : ""}</div>
                {pantSel.length ? (
                  <div style={{ position: "absolute", left: 80, top: 452, width: 320, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, zIndex: 2 }}>
                    {pantSel.map((c) => (
                      <button key={c} onClick={() => alternarPant(c)} className="np10-flat" title={`Remover ${c}`}
                        style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", boxSizing: "border-box", height: 34, padding: "0 8px 0 5px", border: `1px solid ${PRETO}`, borderRadius: 12, background: "#fff", cursor: "pointer", fontFamily: INTER, fontSize: 13, fontWeight: 600, color: PRETO }}>
                        <span style={{ flex: "none", width: 22, height: 22, borderRadius: 6, background: hexPant(c), boxShadow: "inset 0 0 0 1px rgba(0,0,0,.14)" }} />
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
                        <XisPequeno tamanho={12} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ position: "absolute", left: 80, top: 452, width: 320, height: 48, border: "1.5px dashed #d0d0d0", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: INTER, fontSize: 14, color: CLARO, zIndex: 2 }}>Busque acima e toque para adicionar</div>
                )}

                <div style={{ position: "absolute", left: 530, bottom: 86, width: 410, display: "flex", flexDirection: "column", gap: 14, zIndex: 2 }}>
                  {ACABAMENTOS.map((a) => (
                    <button key={a.nome} onClick={() => setAcab((s) => ({ ...s, [a.nome]: !s[a.nome] }))}
                      style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                      <span style={{ gridRow: 1 }}><Radio ligado={!!acab[a.nome]} /></span>
                      <span style={{ gridRow: 1, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 40", fontWeight: 600, fontSize: 38, lineHeight: 1, letterSpacing: "-.05em", color: PRETO, whiteSpace: "nowrap" }}>{a.nome}</span>
                      <span style={{ gridColumn: 2, gridRow: 2, fontFamily: INTER, fontSize: 16, color: CINZA }}>{a.desc}</span>
                    </button>
                  ))}
                </div>

                <div style={{ ...PAINEL_BRANCO, left: 960, width: 480, borderLeft: `1px solid ${PRETO}`, padding: "14px 80px 46px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, height: 148, marginBottom: -18 }}>
                    <img src="/np10/bp-joinha2.png" alt="" style={{ flex: "none", display: "block", width: 57.43, height: 81.61, objectFit: "contain" }} />
                    <span style={{ flex: 1, minWidth: 0, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 40", fontWeight: 600, fontSize: 24, lineHeight: 1.12, letterSpacing: "-.05em" }}>Boas práticas<br />para bons resultados</span>
                  </div>
                  <div style={{ position: "absolute", top: 160, left: 78, width: 320, fontSize: 16, lineHeight: 1.3, color: PRETO, display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>• A cor na tela pode enganar. Monitores mostram cores com luz (RGB), enquanto a impressão usa tinta sobre papel, plástico ou filme (CMYK/Pantone). Por isso, o tom final pode ficar mais claro, escuro ou vibrante do que você vê no computador.</div>
                    <div>• Prefira Pantones que já foram usados por outros clientes; assim, a produção já tem uma amostra para seguir.</div>
                    <div>• Sempre peça uma amostra de cor ao cliente; assim, conseguimos aproximar ao máximo a cor.</div>
                    <div>• Cor é algo relativo: o que é laranja para você pode ser amarelo para outra pessoa.</div>
                    <div>• Amostra em mãos é garantia de sucesso na maioria dos casos.</div>
                  </div>
                </div>
              </>
            )}

            {/* ——— etapa 4: revisão ——— */}
            {etapa === 3 && (
              <>
                <div style={{ ...PAINEL_BRANCO, left: 0, width: 960, borderRight: `1px solid ${PRETO}` }}>
                  <button onClick={() => setEtapa(0)} className="np10-flat" style={{ ...PLANO, position: "absolute", left: 80, top: 58 }}>Editar</button>
                  <button onClick={apagarEtapa} className="np10-flat" style={{ ...PLANO, position: "absolute", right: 80, top: 58 }}>Apagar tudo</button>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="*Nome do cliente" aria-label="Nome do cliente"
                    style={{ position: "absolute", left: 80, top: 118, width: 800, border: "none", outline: "none", background: "transparent", ...FR, fontSize: 38, letterSpacing: "-.02em", color: PRETO }} />
                  <div style={{ position: "absolute", left: 80, top: 196, width: 800 }}>
                    <div style={{ ...ROTULO, letterSpacing: ".16em", marginBottom: 8 }}>BRIEFING</div>
                    <div style={{ width: "100%", height: 96, boxSizing: "border-box", fontSize: 17, lineHeight: 1.4, color: briefing.trim() ? PRETO : CLARO, overflow: "hidden", textOverflow: "ellipsis" }}>{briefing.trim() || "Sem briefing preenchido nesta etapa."}</div>
                  </div>
                  <div style={{ position: "absolute", left: 80, top: 350, width: 800, height: 236, display: "flex", flexDirection: "column" }}>
                    {resumo.map(([rotulo, valor]) => (
                      <div key={rotulo} style={{ flex: "1 1 0", minHeight: 0, display: "flex", alignItems: "baseline" }}>
                        <span style={{ width: 160, flex: "none", paddingRight: 20, boxSizing: "border-box", ...ROTULO }}>{rotulo}</span>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 40", fontWeight: 600, fontSize: 23, letterSpacing: "-.02em", color: PRETO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{valor}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ ...PAINEL_BRANCO, left: 960, width: 480, borderLeft: `1px solid ${PRETO}`, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
                  {desenho ? (
                    <img onClick={() => setPdfAmpliado(true)} src={desenho} alt={`Desenho ${facaCod}`} style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", cursor: "zoom-in" }} />
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, color: CLARO, textAlign: "center" }}>
                      <svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke="#d4d4d4" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      <span style={{ fontFamily: INTER, fontSize: 17 }}>Nenhuma faca anexada</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* cartão amarelo da etapa aberta */}
          <div style={{ position: "absolute", left: 0, top: 0, width: 480, height: 614, background: AMARELO, borderRight: `1px solid ${PRETO}`, overflow: "hidden", zIndex: 2 }}>
            <button onClick={() => setEtapa(null)} className="np10-flat" aria-label="Voltar"
              style={{ position: "absolute", left: 42, top: 61, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            </button>
            <span style={{ position: "absolute", left: 80, top: 60, fontSize: 22, fontWeight: 600, letterSpacing: "-.01em" }}>{PASSOS[etapa].etapa}</span>
            <button onClick={() => (etapa >= 3 ? enviar() : setEtapa(etapa + 1))} className="np10-flat" disabled={enviando}
              style={{ position: "absolute", left: 320, top: 58, background: "none", border: "none", fontFamily: INTER, fontSize: 22, fontWeight: 600, color: PRETO, cursor: enviando ? "wait" : "pointer", padding: 0, opacity: enviando ? .5 : 1 }}>
              {etapa >= 3 ? (enviando ? "Enviando…" : "Concluir") : "Próximo"}
            </button>
            <div style={{ position: "absolute", left: 80, top: 126, width: 400, ...FR, fontSize: 70, lineHeight: "60px", letterSpacing: "-.03em" }}>{PASSOS[etapa].t1}<br />{PASSOS[etapa].t2}</div>
            <img src={PASSOS[etapa].img} alt="" style={{ position: "absolute", left: 0, top: PASSOS[etapa].top, width: 480, height: PASSOS[etapa].h, pointerEvents: "none" }} />
            <div style={{ position: "absolute", left: 80, top: 504, width: 330, fontSize: 24, lineHeight: 1.34, fontWeight: 400, letterSpacing: "-.03em" }}>{PASSOS[etapa].sub}</div>
          </div>

          {erro && (
            <div style={{ position: "absolute", left: "50%", bottom: 30, transform: "translateX(-50%)", zIndex: 60, display: "flex", alignItems: "center", gap: 12, maxWidth: 1400, background: "#b3352f", color: "#fff", borderRadius: 999, padding: "16px 26px", boxShadow: "0 20px 44px -18px rgba(0,0,0,.55)", fontFamily: INTER, fontSize: 18, fontWeight: 600 }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" /></svg>
              <span>{erro}</span>
            </div>
          )}
        </div>
      )}

      {/* ————— pedido enviado ————— */}
      {enviado && (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: "rgba(37,36,37,.86)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 760, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 24, padding: "60px 64px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", boxShadow: "0 50px 110px -30px rgba(0,0,0,.6)" }}>
            <div style={{ width: 96, height: 96, borderRadius: 999, background: AMARELO, border: `1px solid ${PRETO}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ ...FR, fontSize: 42, letterSpacing: "-.02em", lineHeight: 1.06, color: PRETO }}>Pedido enviado<br />para a fila do design</div>
            <div style={{ marginTop: 20, fontFamily: INTER, fontSize: 20, lineHeight: 1.5, color: CINZA }}>
              {`${nome.trim() || "Pedido"}  ·  ${facaCod || "sem faca"}  ·  ${materia || "—"}`}
            </div>
            {enviado.num && (
              <div style={{ marginTop: 34, display: "flex", alignItems: "center", gap: 12, height: 44, padding: "0 22px", borderRadius: 999, background: "#f4f4f2", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, fontWeight: 600, color: PRETO }}>Nº do pedido {enviado.num}</div>
            )}
            {enviado.aviso && (
              <div style={{ marginTop: 18, maxWidth: 560, fontFamily: INTER, fontSize: 15, lineHeight: 1.45, color: "#b3352f" }}>{enviado.aviso}</div>
            )}
            {/* Um botão só, como no handoff. "Início" aqui é o começo do
                formulário, não a Home: os campos já foram limpos no envio,
                então fechar devolve a tela pronta para o próximo pedido.
                Para sair do Novo pedido existe o menu e o "Sair sem enviar". */}
            <button onClick={recomeçar} className="np10-flat"
              style={{ marginTop: 36, height: 56, padding: "0 40px", borderRadius: 999, border: "none", background: PRETO, color: FUNDO, fontFamily: INTER, fontSize: 19, fontWeight: 600, cursor: "pointer" }}>Voltar ao início</button>
          </div>
        </div>
      )}

      {/* ————— desenho ampliado ————— */}
      {pdfAmpliado && desenho && (
        <div onClick={() => setPdfAmpliado(false)} style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: "rgba(37,36,37,.72)", zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}>
          <div style={{ position: "relative", width: 760, height: 940, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)" }}>
            <img src={desenho} alt={`Desenho ${facaCod}`} style={{ display: "block", maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
            <button onClick={() => setPdfAmpliado(false)} aria-label="Fechar"
              style={{ position: "absolute", right: -18, top: -18, width: 40, height: 40, borderRadius: 999, border: `1px solid ${PRETO}`, background: AMARELO, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
              <XisPequeno tamanho={20} />
            </button>
          </div>
        </div>
      )}

      <BarraTopoHub10 profile={profile} paginaAtiva="Novo pedido" aoNavegar={aoNavegar} onLogout={onLogout} disponiveis={disponiveis} />

      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
    </PalcoFixo>
  );
}
