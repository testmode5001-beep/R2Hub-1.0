// Pedido (modal) — v2. Fonte: handoff `Pedido-modal v2.dc.html` + README §Tela 1.
//
// A ficha de três colunas empilhadas virou TRÊS SEÇÕES num palco 1360×780:
// Briefing (especificação, cores, briefing e as alterações pedidas), Arquivos
// e Histórico. O rail preto guarda a identidade do pedido e o andamento; o
// rodapé concentra as ações, e tudo que escreve passa por um diálogo.
//
// Diferenças do protótipo, de propósito:
//   · nada de dado de exemplo — sem cores, anexos ou briefing inventados;
//   · "Desfazer" no toast só onde o hub sabe desfazer de verdade (excluir
//     anexo é gravado na hora e não tem volta automática);
//   · o seletor Designer/Vendedora só oferece o papel que a pessoa tem
//     permissão de exercer — e o servidor continua sendo quem decide;
//   · "alteração resolvida" é gravada no banco (pedido_revisoes_resolvidas):
//     marca que só existisse na tela sumiria ao reabrir o pedido;
//   · o palco escala dentro do EstagioV1a, não da janela.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { AMARELO, INK, MONO, fr } from "../HubV1a";
import { PANTONE_SC } from "../dados/pantone";
import { ClicheChegouModalV1a, type RegistroCliche } from "./ClicheChegouModalV1a";
import { DevolverArteModalV1a } from "./DevolverArteModalV1a";
import { FacasModalV1a } from "./FacasModalV1a";

export type PedidoModal = {
  num?: string; cliente?: string; spec?: string; status?: string; prazo?: string;
  dias?: number | null; atraso?: boolean; origem?: string; responsavel?: string;
  /** quem abriu o pedido — é para essa pessoa que a arte volta */
  solicitante?: string;
  extra?: { titulo: string; linhas: { k: string; v: string }[]; itens?: { descricao: string; valor: string }[] };
};

/** Anexo real do pedido (pedido_anexos). */
export type ArquivoPedido = {
  id: string; nome: string; peso: string;
  /** de onde veio o arquivo — vira a segunda linha da lista */
  origem?: string;
};
/** Evento real do histórico (pedido_historico). */
export type EventoPedido = { id?: string; status: string; observacao?: string | null; user_nome?: string; created_at: string };
/** Comentário interno (pedido_comentarios). */
export type ComentarioPedido = { id: string; user_nome?: string; texto: string; created_at: string };
/** Pergunta do pedido (pedido_perguntas) — tem dono e estado. */
export type PerguntaPedido = {
  id: string; de_nome?: string | null; para_nome?: string | null; texto: string; created_at: string;
  resposta?: string | null; respondida_em?: string | null; respondida_por_nome?: string | null;
};

/** Ação da modal → status do app (changeStatus). */
export const ACAO_PARA_STATUS: Record<string, string> = {
  "Iniciar": "criacao",
  "Aprovar design": "aprovada",
  "Pedir revisão": "revisao",
  "Design criado": "aguardando",
  "Solicitar clichê": "cliche",
  "Clichê chegou": "concluido",
  "Voltar para a fila": "revisao",
};

const PALCO_W = 1360;
const PALCO_H = 780;

const STATUS_CHIP: Record<string, { bg: string; fg: string }> = {
  "Aguardando Design": { bg: "#f1f1f1", fg: INK },
  /* a alteração pedida é a única aqui que cobra ação do design — amarela.
     "Aguardando aprovação" fica cinza: a vez é da vendedora. */
  "Alteração pedida": { bg: AMARELO, fg: INK },
  "Aguardando aprovação": { bg: "#f1f1f1", fg: INK },
  "Design aprovado": { bg: AMARELO, fg: INK },
  "Clichê solicitado": { bg: AMARELO, fg: INK },
  "Aguardando clichê": { bg: AMARELO, fg: INK },
  "Clichê recebido": { bg: AMARELO, fg: INK },
  "Em produção": { bg: AMARELO, fg: INK },
  "Finalizado": { bg: "#3a393a", fg: "#8d8b8d" },
  /* cancelado não é finalizado: o pedido parou, não terminou. Sem chip
     próprio ele vinha rotulado "FINALIZADO" e o rail dizia que estava tudo
     concluído — exatamente o oposto do que aconteceu. */
  "Cancelado": { bg: "#fdf0ef", fg: "#c42b26" },
};

const FLUXO = ["Solicitado", "Em design", "Revisão", "Aprovado", "Clichê", "Produção"];
/** rótulo v1a do status → passo do Andamento (0 = Solicitado). */
const PASSO_DO_STATUS: Record<string, number> = {
  "Aguardando Design": 1, "Alteração pedida": 2, "Aguardando aprovação": 2, "Design aprovado": 3,
  "Clichê solicitado": 4, "Aguardando clichê": 4, "Clichê recebido": 4,
  "Em produção": 5, "Finalizado": 6,
};

const SECOES = [
  { titulo: "Briefing", sub: "Especificação do pedido e o que foi pedido de alteração." },
  { titulo: "Arquivos", sub: "Artes, facas e provas anexadas a este pedido." },
  { titulo: "Histórico", sub: "Tudo que já aconteceu neste pedido." },
];

/** status cru do banco → frase do histórico. */
const TEXTO_STATUS: Record<string, string> = {
  pergunta: "Pergunta",
  resposta: "Resposta",
  transferencia: "Carteira transferida",
  nova: "Pedido criado",
  criacao: "Design assumido",
  aguardando: "Arte enviada para aprovação",
  revisao: "Revisão solicitada",
  aprovada: "Design aprovado",
  cliche: "Clichê solicitado",
  concluido: "Clichê recebido — pedido concluído",
  cancelado: "Pedido cancelado",
};

const TIPO = {
  comentario: { label: "observação", bg: INK, fg: AMARELO },
  solicitacao: { label: "solicitação", bg: AMARELO, fg: INK },
  movimentacao: { label: "movimentação", bg: "#f4f4f4", fg: "#6f6d6f" },
} as const;
type TipoReg = keyof typeof TIPO;

const FILTROS: { k: "tudo" | TipoReg; label: string }[] = [
  { k: "tudo", label: "Tudo" },
  { k: "solicitacao", label: "Solicitações" },
  { k: "comentario", label: "Observações" },
  { k: "movimentacao", label: "Movimentações" },
];

/** Acabamentos do pedido — colunas 0/1 em `pedidos`. */
const ACABAMENTOS: { campo: string; rotulo: string }[] = [
  { campo: "tarja_verso", rotulo: "Tarja no verso" },
  { campo: "verniz", rotulo: "Verniz" },
  { campo: "cold_stamp", rotulo: "Cold stamp" },
  { campo: "picote", rotulo: "Picote" },
];

/** Ações que só um lado do fluxo executa — usado quando a pessoa acumula os
    dois papéis e escolhe qual está exercendo agora. O resto (aprovar, mandar
    para a clicheria, registrar a chegada, repor) é de quem tiver permissão:
    prender essas ações a um papel escondia botões de quem podia usá-los. */
/* "Pedir informação" ficou FORA da divisão por papel: dúvida tem os dois
   lados — a vendedora também precisa perguntar ao design. */
const SO_DESIGNER = ["Iniciar", "Design criado"];
const SO_VENDEDORA = ["Pedir revisão"];

const NAVEGA: Record<string, string> = {
  "Abrir no Painel": "Fábrica",
  "Abrir na Aprovação": "Aprovação",
  "Editar valores do clichê": "Aprovação",
};

type Prompt = {
  titulo: (cliente: string, quemPediu: string) => string;
  placeholder?: string;
  nota: string;
  confirmar: string;
  tema: "escuro" | "amarelo";
  obrigatorio?: boolean;
  /** confirmação pura (sem campo de texto) */
  semTexto?: boolean;
  /** pede também o código do produto (reposição de clichê) */
  comCodigo?: boolean;
  /** o que o toast diz depois — o resultado, não o nome do botão */
  resultado: string;
};

const PROMPTS: Record<string, Prompt> = {
  "Aprovar design": {
    titulo: (c) => `Aprovar o design de ${c}`,
    placeholder: "Observações da aprovação (opcional)…",
    nota: "A aprovação e a observação entram no histórico do pedido. Ctrl+Enter confirma.",
    confirmar: "Arte aprovada",
    tema: "escuro",
    resultado: "Design aprovado",
  },
  "Pedir revisão": {
    titulo: () => "O que precisa mudar na arte?",
    placeholder: "Descreva as alterações…",
    nota: "Obrigatório — o texto vai para o designer, aparece em “Alterações pedidas” e fica no histórico.",
    confirmar: "Enviar revisão",
    tema: "amarelo",
    obrigatorio: true,
    resultado: "Revisão enviada ao design",
  },
  "Voltar para a fila": {
    titulo: (c) => `Devolver ${c} para a fila do design`,
    placeholder: "Por que está voltando? (opcional)",
    nota: "O pedido volta para a fila do design; o motivo fica no histórico.",
    confirmar: "Voltar para a fila",
    tema: "escuro",
    resultado: "Pedido de volta na fila do design",
  },
  "Observação": {
    titulo: () => "Observação interna",
    placeholder: "Escreva para a equipe…",
    nota: "Visível apenas para a equipe interna — entra no histórico do pedido.",
    confirmar: "Publicar observação",
    tema: "escuro",
    obrigatorio: true,
    resultado: "Observação publicada no histórico",
  },
  "Pedir informação": {
    titulo: (_c, quem) => `Pedir informação a ${quem}`,
    placeholder: "O que você precisa saber?",
    nota: "Vira uma pergunta em aberto no pedido: fica em destaque para quem tem de responder, e o aviso diz que a resposta depende dessa pessoa.",
    confirmar: "Enviar pergunta",
    tema: "escuro",
    obrigatorio: true,
    resultado: "Pergunta enviada",
  },
  "Responder": {
    titulo: () => "Responder a pergunta",
    placeholder: "Escreva a resposta…",
    nota: "A resposta fecha a pergunta e avisa quem perguntou. Ctrl+Enter confirma.",
    confirmar: "Enviar resposta",
    tema: "amarelo",
    obrigatorio: true,
    resultado: "Resposta enviada",
  },
  "Reposição de clichê": {
    titulo: (c) => `Repor o clichê de ${c}`,
    placeholder: "Motivo — o que aconteceu com o clichê?",
    nota: "Abre um pedido novo de reposição e avisa o design.",
    confirmar: "Solicitar reposição",
    tema: "amarelo",
    obrigatorio: true,
    comCodigo: true,
    resultado: "Reposição de clichê solicitada",
  },
  "Cancelar pedido": {
    titulo: (c) => `Tirar o pedido de ${c} do fluxo?`,
    nota: "Ele passa a Cancelado: sai das listas de trabalho, mas continua no sistema — aparece em “Artes canceladas” na Central e pode ser reaberto. Histórico, anexos e o gasto de clichê ficam preservados.",
    confirmar: "Cancelar o pedido",
    tema: "escuro",
    semTexto: true,
    resultado: "Pedido cancelado",
  },
};

/** Campos editáveis do pedido (mesmos aceitos por updatePedido). */
export const CAMPOS_PEDIDO: { k: string; label: string; larga?: boolean; opcional?: boolean }[] = [
  { k: "cliente", label: "Cliente", larga: true },
  { k: "largura", label: "Largura" },
  { k: "altura", label: "Altura" },
  { k: "materia", label: "Substrato" },
  { k: "larg_materia", label: "Largura da bobina" },
  { k: "forma", label: "Formato" },
  { k: "cores", label: "Cores" },
  { k: "carreiras", label: "Carreiras", opcional: true },
  { k: "cores_desc", label: "Descrição das cores", larga: true, opcional: true },
  { k: "link_ref", label: "Link de referência", larga: true, opcional: true },
  { k: "descricao", label: "Descrição", larga: true },
];

const CARD: CSSProperties = { background: "#fff", borderRadius: 14, padding: "18px 22px", display: "flex", flexDirection: "column", minHeight: 0 };
const TIT_CARD: CSSProperties = { flex: "none", whiteSpace: "nowrap", font: "800 17px/1.15 Inter,sans-serif", letterSpacing: "-.01em", color: INK };
const NOTA_CARD: CSSProperties = { flex: "none", whiteSpace: "nowrap", font: "600 12.5px/1 Inter,sans-serif", color: "#7a787a" };
const ROTULO: CSSProperties = { font: "700 10.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#7a787a" };
const CHIP_TIPO: CSSProperties = { flex: "none", borderRadius: 999, padding: "4px 8px", font: "700 9.5px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap" };
const INP_DIALOGO: CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#f4f4f4", border: "2px solid #f4f4f4", borderRadius: 9,
  padding: "12px 14px", font: "500 14.5px/1.5 Inter,sans-serif", color: INK, outline: "none",
};

const BASICAS: Record<string, string> = {
  ciano: "#00A3E0", cyan: "#00A3E0", magenta: "#E5007E", amarelo: "#FFE815",
  preto: "#252425", black: "#252425", branco: "#FFFFFF", verniz: "#DCDBDC",
};
/** Hex da cor pelo nome. Devolve "" quando não dá para saber — inventar um hex
    aqui seria pior que não mostrar: a pílula é clicável e copia o valor. */
function hexDaCor(nome: string): string {
  const n = String(nome || "").trim();
  if (!n) return "";
  const basica = BASICAS[n.toLowerCase()];
  if (basica) return basica;
  const cod = n.replace(/^pantone\s*/i, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!cod) return "";
  const tentativas = [cod, `${cod} c`, cod.replace(/\s*c$/, "")];
  for (const t of tentativas) {
    const achou = PANTONE_SC.find((x) => x.c.toLowerCase() === t.trim());
    if (achou) return achou.h.toUpperCase();
  }
  return "";
}

const dd = (n: number) => String(n).padStart(2, "0");
/** ISO → { dia: "27/08", hora: "14:35" }; vazio quando a data não presta. */
function dataHora(iso?: string | null) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { dia: "", hora: "" };
  return { dia: `${dd(d.getDate())}/${dd(d.getMonth() + 1)}`, hora: `${dd(d.getHours())}:${dd(d.getMinutes())}` };
}
const primeiroNome = (n?: string) => String(n || "").trim().split(/\s+/)[0] ?? "";

export function PedidoModalV1a({
  pedido, fechar, onAcao, aoNavegar,
  arquivos: arquivosReais, historico, comentarios, revisoesResolvidas, perguntas, permissoes, campos,
  detalheCarregado,
  aoStatus, aoAnexar, aoExcluirArquivo, aoBaixarArquivo, aoVerArquivo, aoVerFaca,
  aoComentar, aoEditar, aoExcluir, aoSolicitarCliche, aoRegistrarChegada, aoResolverRevisao,
  aoPerguntar, aoResponder,
}: {
  pedido: PedidoModal;
  fechar: () => void;
  onAcao?: (label: string) => void;
  aoNavegar?: (pagina: string) => void;
  /** anexos reais do pedido */
  arquivos?: ArquivoPedido[];
  /** eventos reais do histórico */
  historico?: EventoPedido[];
  /** comentários internos já publicados (mais recentes primeiro) */
  comentarios?: ComentarioPedido[];
  /** revisões já marcadas como resolvidas — `chave` é o id da linha do
      histórico; `por`/`em` são o retorno para quem PEDIU a alteração, que
      antes só via um risco no texto sem saber quem tinha resolvido */
  revisoesResolvidas?: { chave: string; por?: string | null; em?: string | null }[];
  /** perguntas do pedido, mais recentes primeiro */
  perguntas?: PerguntaPedido[];
  /** o que o usuário pode fazer (esconde as ações sem permissão) */
  permissoes?: {
    aprovar?: boolean; design?: boolean; editar?: boolean; excluir?: boolean; repor?: boolean;
    /** aprovacao.reprovar — é o que o servidor cobra em "Pedir revisão" */
    reprovar?: boolean;
    /** pedidos.reabrir — sair de "concluído" é permissão própria */
    reabrir?: boolean;
    /** design.assumir · cliche.solicitar · design.arquivo_final */
    assumir?: boolean; solicitarCliche?: boolean; arquivoFinal?: boolean;
    /** anexo.upload — false esconde a área de anexar (o servidor recusaria) */
    anexar?: boolean;
  };
  /** valores crus do pedido, para a especificação e o formulário de edição */
  campos?: Record<string, string | number | null | undefined>;
  /** o DETALHE do pedido chegou. Enquanto é false, `campos` é a linha da
      lista, que não traz forma, largura da bobina, carreiras, descrição nem
      link — abrir a edição aí montava o formulário com esses campos vazios e
      salvar apagava carreiras e link de referência sem avisar. */
  detalheCarregado?: boolean;
  /** grava o novo status (changeStatus).
      `coresDesc` = cores confirmadas na devolução da arte (viram as do pedido) */
  aoStatus?: (status: string, observacao: string | null, coresDesc?: string) => Promise<unknown>;
  /** tipo "arte" = arte final (notifica quem abriu o pedido); padrão "anexo" */
  aoAnexar?: (arquivos: FileList | File[], tipo?: "anexo" | "arte") => Promise<unknown>;
  aoExcluirArquivo?: (id: string, nome: string) => Promise<unknown>;
  aoBaixarArquivo?: (id: string, nome: string) => Promise<unknown>;
  /** abre o anexo para VER (sem baixar) — devolve um endereço temporário */
  aoVerArquivo?: (id: string, nome: string) => Promise<{ url: string; mime: string; nome: string }>;
  /** abre o DESENHO da faca do catálogo (acervo de PDFs) pelo código */
  aoVerFaca?: (cod: string) => Promise<{ url: string; mime: string; nome: string }>;
  /** publica o comentário interno (comentarPedido) */
  aoComentar?: (texto: string) => Promise<unknown>;
  /** grava a edição (updatePedido) */
  aoEditar?: (mudancas: Record<string, string | null>) => Promise<unknown>;
  /** cancela o pedido (deletePedido) — a rota fecha a modal depois */
  aoExcluir?: () => Promise<unknown>;
  /** abre um pedido novo de reposição de clichê (solicitarCliche) */
  aoSolicitarCliche?: (codigo: string, motivo: string) => Promise<unknown>;
  /** grava a chegada do clichê (registrarCliche + status concluído) */
  aoRegistrarChegada?: (registro: RegistroCliche) => Promise<unknown>;
  /** marca/desmarca uma alteração pedida como resolvida (resolverRevisao) */
  aoResolverRevisao?: (chave: string, resolvida: boolean) => Promise<unknown>;
  /** abre uma pergunta no pedido (perguntarNoPedido) */
  aoPerguntar?: (texto: string) => Promise<unknown>;
  /** responde e fecha uma pergunta (responderPergunta) */
  aoResponder?: (perguntaId: string, texto: string) => Promise<unknown>;
}) {
  const p = pedido || {};
  const statusApp = String(campos?.status ?? "");
  const cancelado = statusApp === "cancelado";
  const status = cancelado ? "Cancelado" : (p.status || "Aguardando Design");
  const st = STATUS_CHIP[status] ?? STATUS_CHIP["Finalizado"];
  const partes = String(p.spec || "").split(" · ");
  const origem = p.origem === "producao" ? "Produção" : p.origem === "interno" ? "Interno" : "Vendas";
  const tudoFeito = !cancelado && status === "Finalizado";
  const passo = Math.min(PASSO_DO_STATUS[status] ?? 1, FLUXO.length - 1);
  const canceladoEm = dataHora(campos?.cancelado_em as string).dia;

  const [secao, setSecao] = useState(0);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [promptTexto, setPromptTexto] = useState("");
  const [promptCodigo, setPromptCodigo] = useState("");
  const [promptAnexos, setPromptAnexos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [toast, setToast] = useState<{ texto: string; acao?: string; fn?: () => void } | null>(null);
  const [filtro, setFiltro] = useState<"tudo" | TipoReg>("tudo");
  const [dragAtivo, setDragAtivo] = useState(false);
  const [devolver, setDevolver] = useState(false);
  const [chegouAberto, setChegouAberto] = useState(false);
  const [vendo, setVendo] = useState<null | { id: string; url: string; mime: string; nome: string }>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [marcaLocal, setMarcaLocal] = useState<Record<string, boolean>>({});
  const [acabLocal, setAcabLocal] = useState<Record<string, boolean>>({});
  /** id da pergunta que o diálogo "Responder" está fechando */
  const [respondendo, setRespondendo] = useState<string | null>(null);
  /** catálogo de facas aberto: "edicao" preenche as medidas, "prompt" cita o
      código dentro do texto do diálogo */
  const [facasAberto, setFacasAberto] = useState<null | "edicao" | "prompt">(null);
  /** faca escolhida no formulário de edição (mora dentro do briefing) */
  const [facaForm, setFacaForm] = useState("");
  const [briefingAberto, setBriefingAberto] = useState(false);
  const [briefingCortado, setBriefingCortado] = useState(false);
  /* Lido DEPOIS de montar, não no estado inicial: com `?pedido=` na URL esta
     modal também é renderizada no servidor, onde não existe localStorage — e
     um primeiro render diferente do cliente quebra a hidratação. */
  const [papel, setPapel] = useState<"Designer" | "Vendedora">("Designer");
  useEffect(() => {
    try {
      const g = localStorage.getItem("r2hub.pedido.papel");
      if (g === "Designer" || g === "Vendedora") setPapel(g);
    } catch { /* modo restrito */ }
  }, []);

  const palcoRef = useRef<HTMLDivElement>(null);
  const cartaoRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const promptFileRef = useRef<HTMLInputElement>(null);
  const briefRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const avisar = (texto: string, acao?: string, fn?: () => void) => {
    setToast({ texto, acao, fn });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), acao ? 6500 : 2600);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  /* O endereço temporário do anexo é revogado ao fechar o visualizador — mas
     se a modal desmontar com ele aberto (troca de pedido, troca de tela) esse
     caminho não roda e o blob fica preso na memória do navegador. */
  const vendoRef = useRef<string | null>(null);
  vendoRef.current = vendo?.url ?? null;
  useEffect(() => () => { if (vendoRef.current) URL.revokeObjectURL(vendoRef.current); }, []);

  /* ————— palco 1360×780 escalado para caber no que sobrou do estágio ————— */
  useEffect(() => {
    const ajustar = () => {
      const pai = palcoRef.current, card = cartaoRef.current;
      if (!pai || !card) return;
      const s = Math.min(1, (pai.clientWidth - 24) / PALCO_W, (pai.clientHeight - 24) / PALCO_H);
      card.style.transform = `scale(${s})`;
    };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    if (palcoRef.current) ro.observe(palcoRef.current);
    if (document.fonts?.ready) void document.fonts.ready.then(ajustar);
    return () => ro.disconnect();
  }, []);

  /* ————— briefing ————— */
  const briefingCru = String(campos?.descricao ?? "").trim();
  /* "Faca do catálogo: FAC0085.02" mora dentro do briefing (não há coluna
     própria): sai do texto e vira o campo Faca da especificação. */
  const facaCod = (briefingCru.match(/Faca do catálogo:\s*(\S+)/i)?.[1] ?? "").trim();
  const briefing = briefingCru.replace(/\n?Faca do catálogo:\s*\S+/i, "").trim();
  const linkRef = String(campos?.link_ref ?? "").trim();

  useEffect(() => {
    const el = briefRef.current;
    if (!el || briefingAberto) { setBriefingCortado(false); return; }
    setBriefingCortado(el.scrollHeight > el.clientHeight + 2);
  }, [briefing, briefingAberto, secao]);

  /* ————— especificação ————— */
  const vazio = "—";
  const texto = (v: unknown, aoFaltar = vazio) => { const s = String(v ?? "").trim(); return s || aoFaltar; };
  const bobina = (() => {
    const v = String(campos?.larg_materia ?? "").trim();
    if (!v) return vazio;
    return /mm/i.test(v) ? v : `${v} mm`;
  })();
  const medida = campos?.largura && campos?.altura ? `${campos.largura}×${campos.altura}` : (partes[0] ?? "");
  const specs: { k: string; v: string; faca?: boolean }[] = [
    { k: "Medida", v: texto(medida) },
    { k: "Formato", v: texto(campos?.forma) },
    { k: "Substrato", v: texto(campos?.materia ?? partes[1]) },
    { k: "Bobina", v: bobina },
    { k: "Carreiras", v: texto(campos?.carreiras) },
    { k: "Cores", v: texto(campos?.cores ?? partes[2]) },
    ...(facaCod ? [{ k: "Faca", v: facaCod, faca: true }] : []),
    { k: p.dias === null || p.dias === undefined ? "Solicitado" : "Entrega", v: texto(p.prazo) },
    { k: "Vendedora", v: texto(campos?.vendedor_nome ?? p.solicitante) },
    /* sem designer o campo diz que ninguém pegou — antes vinha o nome da
       vendedora por um fallback, e a ficha afirmava algo falso */
    { k: "Designer", v: texto(campos?.designer_nome ?? p.responsavel, "a assumir") },
  ];

  /* Acabamentos mudam DURANTE o processo — o cliente pede verniz com a arte
     já em pé, a vendedora tira o picote. São botões de marcar aqui mesmo, sem
     entrar no modo de edição, para o design e para quem abriu o pedido. */
  const acabLigado = (campo: string) => acabLocal[campo] ?? String(campos?.[campo] ?? "") === "1";
  const acabamentos = ACABAMENTOS.filter((a) => acabLigado(a.campo));
  const podeAcabamento = !!aoEditar
    && (!permissoes || permissoes.editar !== false || !!permissoes.design);

  function alternarAcabamento(a: { campo: string; rotulo: string }) {
    if (!aoEditar || !podeAcabamento || ocupado) return;
    const alvo = !acabLigado(a.campo);
    setAcabLocal((s) => ({ ...s, [a.campo]: alvo }));
    Promise.resolve(aoEditar({ [a.campo]: alvo ? "1" : "0" }))
      .then(() => avisar(alvo ? `${a.rotulo} marcado` : `${a.rotulo} desmarcado`))
      .catch((e: unknown) => {
        /* o servidor recusou: a marca volta ao que era, senão a tela mentiria */
        setAcabLocal((s) => ({ ...s, [a.campo]: !alvo }));
        avisar(e instanceof Error ? e.message : "Não deu para mudar o acabamento.");
      });
  }

  /* ————— cores do pedido ————— */
  const coresDesc = String(campos?.cores_desc ?? "").trim();
  const cores = useMemo(() => {
    if (!coresDesc) return [];
    return coresDesc
      .split(/[,;+]|\s\/\s/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((nome) => ({ nome, hex: hexDaCor(nome) }));
  }, [coresDesc]);

  function copiarCor(c: { nome: string; hex: string }) {
    const valor = c.hex || c.nome;
    navigator.clipboard?.writeText(valor).catch(() => { /* sem permissão de área de transferência */ });
    avisar(c.hex ? `${c.nome} · ${c.hex} copiado` : `${c.nome} copiado`);
  }

  /* ————— alterações pedidas ————— */
  const revisoes = useMemo(() => (historico ?? [])
    .filter((h) => h.status === "revisao")
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((h, i) => {
      const { dia, hora } = dataHora(h.created_at);
      return {
        chave: h.id || `${h.created_at}|${h.observacao ?? ""}`,
        texto: (h.observacao || "").trim() || "Revisão solicitada sem detalhes.",
        quando: [dia && `${dia} às ${hora}`, primeiroNome(h.user_nome)].filter(Boolean).join(" · "),
        recente: i === 0,
      };
    }), [historico]);

  /* ————— perguntas em aberto ————— */
  const abertas = (perguntas ?? []).filter((q) => !q.respondida_em);
  function abrirResposta(q: PerguntaPedido) {
    setRespondendo(q.id);
    abrirPrompt("Responder");
  }

  const marcaDe = (chave: string) => (revisoesResolvidas ?? []).find((r) => r.chave === chave);
  const marcada = (chave: string) => marcaLocal[chave] ?? !!marcaDe(chave);
  const nResolvidas = revisoes.filter((r) => marcada(r.chave)).length;
  /** o que ainda falta fazer — alimenta a tarja e o ponto do rail */
  const emAberto = revisoes.filter((r) => !marcada(r.chave));

  function alternarResolvida(chave: string) {
    const alvo = !marcada(chave);
    setMarcaLocal((s) => ({ ...s, [chave]: alvo }));
    if (!aoResolverRevisao) return;
    Promise.resolve(aoResolverRevisao(chave, alvo)).catch((e: unknown) => {
      /* o servidor recusou: a marca volta ao que era, senão a tela mentiria */
      setMarcaLocal((s) => ({ ...s, [chave]: !alvo }));
      avisar(e instanceof Error ? e.message : "Não deu para gravar a marca.");
    });
  }

  /* ————— arquivos ————— */
  const arquivos = (arquivosReais ?? []).filter((a) => !removidos.includes(a.id));

  function enviarArquivos(lista: FileList | File[] | null | undefined) {
    const arr = lista ? Array.from(lista) : [];
    if (!arr.length) return;
    if (!aoAnexar) { avisar(`${arr.length} ${arr.length === 1 ? "arquivo" : "arquivos"} — a modal está sem ligação com o servidor.`); return; }
    setOcupado(true);
    Promise.resolve(aoAnexar(arr))
      .then(() => avisar(arr.length === 1 ? `${arr[0].name} anexado` : `${arr.length} arquivos anexados`))
      .catch((e: unknown) => avisar(e instanceof Error ? e.message : "Erro ao anexar."))
      .finally(() => {
        setOcupado(false);
        setDragAtivo(false);
        /* zerar o value destrava anexar o MESMO arquivo de novo — com o value
           antigo o navegador não dispara o onChange e o clique parece morto */
        if (fileRef.current) fileRef.current.value = "";
      });
  }

  /* Visualizador: o anexo abre AQUI (imagem e PDF), em vez de cair na pasta de
     downloads. O que o navegador não sabe mostrar segue pelo botão de baixar. */
  function ver(a: ArquivoPedido) {
    if (!aoVerArquivo) { baixar(a); return; }
    setOcupado(true);
    aoVerArquivo(a.id, a.nome)
      .then((r) => setVendo({ ...r, id: a.id }))
      .catch((e: unknown) => avisar(e instanceof Error ? e.message : "Não deu para abrir o anexo."))
      .finally(() => setOcupado(false));
  }

  function fecharVisualizador() {
    if (vendo) URL.revokeObjectURL(vendo.url);
    setVendo(null);
  }

  function baixar(a: ArquivoPedido) {
    if (!aoBaixarArquivo) return;
    setOcupado(true);
    Promise.resolve(aoBaixarArquivo(a.id, a.nome))
      .then(() => avisar(`${a.nome} baixado`))
      .catch((e: unknown) => avisar(e instanceof Error ? e.message : "Erro ao baixar."))
      .finally(() => setOcupado(false));
  }

  /* Tirar do pedido ≠ apagar: o hub nunca apaga na pasta do cliente. Sem
     "Desfazer" no toast de propósito — o desvínculo é gravado na hora e não
     existe server fn para religar; oferecer o botão seria mentir. */
  function excluirArquivo(a: ArquivoPedido) {
    if (!aoExcluirArquivo) return;
    setOcupado(true);
    setRemovidos((s) => [...s, a.id]);
    Promise.resolve(aoExcluirArquivo(a.id, a.nome))
      .then(() => avisar(`${a.nome} saiu do pedido — o arquivo continua na pasta do cliente`))
      .catch((e: unknown) => {
        setRemovidos((s) => s.filter((id) => id !== a.id));
        avisar(e instanceof Error ? e.message : "Erro ao tirar do pedido.");
      })
      .finally(() => setOcupado(false));
  }

  function verFaca() {
    if (!aoVerFaca || !facaCod || ocupado) return;
    setOcupado(true);
    aoVerFaca(facaCod)
      .then((r) => setVendo({ ...r, id: "faca:" + facaCod }))
      .catch((e: unknown) => avisar(e instanceof Error ? e.message : "Não achei o desenho dessa faca no acervo."))
      .finally(() => setOcupado(false));
  }

  /* ————— histórico ————— */
  const registros = useMemo(() => {
    const out: { id: string; titulo: string; iso: string; autor: string; tipo: TipoReg }[] = [];
    for (const c of comentarios ?? []) {
      out.push({
        id: "c" + c.id,
        titulo: c.texto,
        iso: c.created_at,
        autor: c.user_nome ?? "",
        tipo: /^informação solicitada/i.test(c.texto) ? "solicitacao" : "comentario",
      });
    }
    for (const h of historico ?? []) {
      const base = TEXTO_STATUS[h.status] ?? h.status;
      /* muita observação repete o nome da etapa ("Pedido criado" no evento
         `nova`) — sem tirar o prefixo a linha vira "Pedido criado — Pedido
         criado", que foi o que apareceu no primeiro teste. */
      const obs = (h.observacao || "").trim()
        .replace(/^(pedido criado|design assumido|arte enviada para aprova[çc][ãa]o|revis[ãa]o solicitada|design aprovado|clich[êe] solicitado|observa[çc][ãa]o interna|recado do design)\s*[—:-]?\s*/i, "")
        .trim();
      out.push({
        id: "h" + (h.id ?? `${h.status}${h.created_at}`),
        titulo: obs ? `${base} — ${obs}` : base,
        iso: h.created_at,
        autor: h.user_nome ?? "",
        tipo: h.status === "revisao" || h.status === "pergunta" || h.status === "resposta"
          ? "solicitacao"
          : "movimentacao",
      });
    }
    return out.sort((a, b) => String(b.iso).localeCompare(String(a.iso)));
  }, [comentarios, historico]);

  const contaTipo = (k: TipoReg) => registros.filter((r) => r.tipo === k).length;
  const filtrosVisiveis = FILTROS
    .map((f) => ({ ...f, n: f.k === "tudo" ? registros.length : contaTipo(f.k as TipoReg) }))
    .filter((f) => f.k === "tudo" || f.n > 0);
  const visiveis = registros.filter((r) => filtro === "tudo" || r.tipo === filtro);
  const ultimo = registros[0];

  /* ————— papel e ações ————— */
  const podeDesign = permissoes ? !!permissoes.design : true;
  const podeAprovar = permissoes ? !!permissoes.aprovar : true;
  const papeis = ([podeDesign && "Designer", podeAprovar && "Vendedora"] as const)
    .filter(Boolean) as ("Designer" | "Vendedora")[];
  const papelAtivo = papeis.includes(papel) ? papel : (papeis[0] ?? papel);
  const escolhePapel = papeis.length > 1;

  function trocarPapel(novo: "Designer" | "Vendedora") {
    setPapel(novo);
    try { localStorage.setItem("r2hub.pedido.papel", novo); } catch { /* modo restrito */ }
  }

  function acoesBase(): { label: string; tema: "escuro" | "claro" }[] {
    if (p.extra) return [{ label: "Editar valores do clichê", tema: "claro" }, { label: "Abrir na Aprovação", tema: "escuro" }];
    switch (statusApp) {
      /* "Aprovar design" aparece desde o começo: tem cliente que já tinha a
         arte pronta e só aprova meses depois — o pedido pula direto para
         aprovado, sem forçar a passagem pelo envio de design. */
      case "nova":
        return [{ label: "Iniciar", tema: "claro" }, { label: "Design criado", tema: "claro" }, { label: "Aprovar design", tema: "escuro" }];
      /* etapa de design: a lista é a mesma e o papel escolhe o recorte —
         Designer vê pedir informação / design criado / aprovar, Vendedora vê
         pedir revisão / aprovar (tabela "Ações por papel e status" do handoff) */
      case "criacao":
      case "aguardando":
      case "revisao":
        return [
          { label: "Pedir informação", tema: "claro" },
          { label: "Pedir revisão", tema: "claro" },
          { label: "Design criado", tema: "claro" },
          { label: "Aprovar design", tema: "escuro" },
        ];
      case "aprovada":
        return [{ label: "Voltar para a fila", tema: "claro" }, { label: "Clichê chegou", tema: "claro" }, { label: "Solicitar clichê", tema: "escuro" }];
      case "cliche":
        return [{ label: "Voltar para a fila", tema: "claro" }, { label: "Abrir na Aprovação", tema: "claro" }, { label: "Clichê chegou", tema: "escuro" }];
      case "concluido":
        return [{ label: "Voltar para a fila", tema: "claro" }, { label: "Reposição de clichê", tema: "escuro" }];
      case "cancelado":
        return [{ label: "Voltar para a fila", tema: "escuro" }];
      default:
        return [{ label: "Pedir revisão", tema: "claro" }, { label: "Design criado", tema: "claro" }, { label: "Aprovar design", tema: "escuro" }];
    }
  }

  const acoes = (() => {
    const lista = acoesBase()
      .filter((a) => {
        /* o filtro por papel só existe para quem acumula os dois — com um
           papel só, esconder ação seria esconder o que a pessoa pode fazer */
        if (!escolhePapel) return true;
        /* reabrir um pedido cancelado não é ato de papel — quem cancelou ou
           quem aprova pode desfazer, e escondê-lo deixava a modal sem ação */
        if (cancelado) return true;
        if (SO_DESIGNER.includes(a.label)) return papelAtivo === "Designer";
        if (SO_VENDEDORA.includes(a.label)) return papelAtivo === "Vendedora";
        return true;
      })
      .filter((a) => {
        if (a.label === "Pedir informação") return !!aoComentar;
        if (!permissoes) return true;
        if (a.label === "Aprovar design") return !!permissoes.aprovar;
        /* "Pedir revisão" grava o status `revisao`, que o servidor cobra com
           `aprovacao.reprovar` — não com `pedidos.aprovar` */
        if (a.label === "Pedir revisão") return permissoes.reprovar !== false && !!permissoes.aprovar;
        if (a.label === "Iniciar") return permissoes.assumir !== false && !!permissoes.design;
        if (a.label === "Design criado") return !!permissoes.design;
        if (a.label === "Solicitar clichê") return permissoes.solicitarCliche !== false;
        if (a.label === "Clichê chegou") return permissoes.arquivoFinal !== false;
        if (a.label === "Voltar para a fila") {
          /* sair de "concluído" é reabrir (permissão própria); voltar de um
             cancelado serve também a quem cancelou */
          if (statusApp === "concluido") return permissoes.reabrir !== false;
          if (cancelado) return !!permissoes.aprovar || !!permissoes.excluir;
          return permissoes.reprovar !== false && !!permissoes.aprovar;
        }
        if (a.label === "Reposição de clichê") return permissoes.repor !== false;
        return true;
      })
      .slice(0, 3);
    /* uma escura só, e sempre a última: se a primária caiu no filtro, a que
       sobrou por último assume o lugar — senão o rodapé fica todo contornado */
    if (lista.length && !lista.some((a) => a.tema === "escuro")) {
      lista[lista.length - 1] = { ...lista[lista.length - 1], tema: "escuro" };
    }
    return lista;
  })();

  const podeCancelar = !!aoExcluir && (!permissoes || !!permissoes.excluir) && statusApp !== "cancelado";
  /* só depois que o detalhe chegou: com a linha da lista o formulário nasce
     com metade dos campos vazios e salvar apaga o que não veio */
  const podeEditar = !!aoEditar && (!permissoes || permissoes.editar !== false) && detalheCarregado !== false;

  /* ————— diálogos e execução ————— */
  const promptAtual = prompt ? PROMPTS[prompt] : null;
  const promptOk = !promptAtual
    ? false
    : promptAtual.semTexto
      ? true
      : (!promptAtual.obrigatorio || !!promptTexto.trim()) && (!promptAtual.comCodigo || !!promptCodigo.trim());

  function abrirPrompt(label: string) {
    setPrompt(label);
    setPromptTexto("");
    setPromptAnexos([]);
  }
  function fecharPrompt() {
    setPrompt(null);
    setPromptTexto("");
    setPromptAnexos([]);
    setRespondendo(null);
  }

  function acionar(label: string) {
    if (carregando) return;
    if (NAVEGA[label]) { aoNavegar?.(NAVEGA[label]); return; }
    if (label === "Design criado") { setDevolver(true); return; }
    if (label === "Clichê chegou" && aoRegistrarChegada) { setChegouAberto(true); return; }
    if (label === "Reposição de clichê") { setPromptCodigo(String(campos?.codigo_produto ?? "")); abrirPrompt(label); return; }
    if (PROMPTS[label]) { abrirPrompt(label); return; }
    executar(label, "");
  }

  function executar(label: string, obs: string) {
    if (carregando) return;
    const res = PROMPTS[label]?.resultado ?? `${label} registrado`;
    const pronto = () => { fecharPrompt(); setCarregando(null); avisar(res); onAcao?.(`${label} · ${p.cliente || ""}`); };
    const falhou = (e: unknown) => { setCarregando(null); avisar(e instanceof Error ? e.message : "Não foi possível registrar."); };
    setCarregando(label);

    if (label === "Observação") {
      if (!aoComentar) { pronto(); return; }
      Promise.resolve(aoComentar(obs)).then(pronto).catch(falhou);
      return;
    }
    if (label === "Pedir informação") {
      if (!aoPerguntar) { pronto(); return; }
      Promise.resolve(aoPerguntar(obs)).then(pronto).catch(falhou);
      return;
    }
    if (label === "Responder") {
      if (!aoResponder || !respondendo) { pronto(); return; }
      Promise.resolve(aoResponder(respondendo, obs))
        .then(() => { setRespondendo(null); pronto(); })
        .catch(falhou);
      return;
    }
    if (label === "Reposição de clichê") {
      if (!aoSolicitarCliche) { pronto(); return; }
      Promise.resolve(aoSolicitarCliche(promptCodigo.trim(), obs)).then(pronto).catch(falhou);
      return;
    }
    if (label === "Cancelar pedido") {
      if (!aoExcluir) { pronto(); return; }
      /* a rota fecha a modal ao terminar — não há `pronto()` aqui */
      Promise.resolve(aoExcluir()).catch(falhou);
      return;
    }
    const novo = ACAO_PARA_STATUS[label];
    if (!aoStatus || !novo) { pronto(); return; }
    /* os anexos do diálogo sobem ANTES do status. Se um falhar, o status muda
       mesmo assim, mas o aviso diz o que faltou em vez de fingir que subiu. */
    const subir = promptAnexos.length && aoAnexar
      ? Promise.resolve(aoAnexar(promptAnexos)).then(() => "").catch((e: unknown) => (e instanceof Error ? e.message : "os anexos falharam"))
      : Promise.resolve("");
    subir
      .then((falha) => Promise.resolve(aoStatus(novo, obs.trim() || null)).then(() => {
        fecharPrompt();
        setCarregando(null);
        avisar(falha ? `${res} — mas atenção: ${falha}` : res);
        onAcao?.(`${label} · ${p.cliente || ""}`);
      }))
      .catch(falhou);
  }

  /* ————— edição ————— */
  function abrirEdicao() {
    const inicial: Record<string, string> = {};
    CAMPOS_PEDIDO.forEach((c) => { inicial[c.k] = String(campos?.[c.k] ?? ""); });
    /* a descrição no formulário vem SEM a linha da faca: ela é editada pelo
       catálogo ali do lado e volta ao texto na hora de salvar */
    inicial.descricao = briefing;
    setForm(inicial);
    setFacaForm(facaCod);
    setEditando(true);
  }

  /** faca escolhida no catálogo durante a edição: preenche as medidas. */
  function usarFacaNaEdicao(cod: string, medida: string) {
    const nums = String(medida).match(/[\d]+(?:,[\d]+)?/g) ?? [];
    setFacaForm(cod);
    setForm((s) => ({ ...s, largura: nums[0] ?? s.largura, altura: nums[1] ?? s.altura }));
    setFacasAberto(null);
    avisar(`Faca ${cod} · ${medida}`);
  }

  function salvarEdicao() {
    if (!aoEditar || ocupado) return;
    const d: Record<string, string | null> = {};
    const faltando: string[] = [];
    for (const c of CAMPOS_PEDIDO) {
      const v = (form[c.k] ?? "").trim();
      if (c.opcional) d[c.k] = v || null;
      else if (v) d[c.k] = v;
      else faltando.push(c.label);
    }
    /* a faca volta para dentro da descrição — é onde ela mora (não há coluna
       própria) e é de lá que o cartão da Especificação a lê */
    if (typeof d.descricao === "string") {
      d.descricao = facaForm ? `${d.descricao}\nFaca do catálogo: ${facaForm}` : d.descricao;
    }
    /* campo obrigatório esvaziado era descartado em silêncio: a pessoa apagava
       "Cliente", lia "Pedido atualizado." e nada tinha mudado */
    if (faltando.length) {
      avisar(`${faltando.join(", ")} não ${faltando.length === 1 ? "pode" : "podem"} ficar em branco.`);
      return;
    }
    setOcupado(true);
    Promise.resolve(aoEditar(d))
      .then(() => { avisar("Pedido atualizado"); setEditando(false); })
      .catch((e: unknown) => avisar(e instanceof Error ? e.message : "Não deu para salvar a edição."))
      .finally(() => setOcupado(false));
  }

  /* o badge conta observações, não todo comentário: os pedidos de informação
     também moram em pedido_comentarios e apareciam somados aqui */
  const nObs = contaTipo("comentario");
  const subSecao = [
    `${specs.length} informações`,
    `${arquivos.length} ${arquivos.length === 1 ? "anexo" : "anexos"}`,
    `${registros.length} ${registros.length === 1 ? "registro" : "registros"}`,
  ];
  const rodapeTexto = p.extra
    ? "Valores do clichê pendentes de conferência."
    : cancelado
      ? "Pedido cancelado — pode voltar para a fila do design."
      : tudoFeito
        ? "Pedido concluído — só reposição de clichê a partir daqui."
        : `Etapa atual: ${FLUXO[passo] ?? "Solicitado"}.`;

  const quemPediu = primeiroNome(campos?.vendedor_nome as string) || p.solicitante || "quem abriu o pedido";

  return (
    <div ref={palcoRef} onClick={() => { if (!prompt && !devolver && !chegouAberto && !vendo) fechar(); }}
      className="r2modal"
      style={{ position: "absolute", inset: 0, zIndex: 60, display: "grid", placeItems: "center", background: "rgba(37,36,37,.52)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", borderRadius: 14, overflow: "hidden", fontFamily: "Inter,sans-serif", color: INK }}>

      {/* Visualizador do anexo — por cima de tudo, sem baixar. */}
      {vendo && (() => {
        const ehImagem = vendo.mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(vendo.nome);
        const ehPdf = vendo.mime === "application/pdf" || /\.pdf$/i.test(vendo.nome);
        return (
          <div onClick={(e) => { e.stopPropagation(); fecharVisualizador(); }} data-modal-esc
            style={{ position: "absolute", inset: 0, zIndex: 95, display: "flex", flexDirection: "column", gap: 12, padding: 30, background: "rgba(20,19,20,.82)", backdropFilter: "blur(5px)", WebkitBackdropFilter: "blur(5px)", borderRadius: 14 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ flex: "none", display: "flex", alignItems: "center", gap: 14 }}>
              <span className="truncate" style={{ flex: 1, minWidth: 0, font: "700 17px/1.2 Inter,sans-serif", color: "#f1f1f1" }}>{vendo.nome}</span>
              <a href={vendo.url} download={vendo.nome} className="r2chip"
                style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", border: 0, borderRadius: 999, padding: "11px 16px", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: AMARELO, color: INK }}>
                Baixar
              </a>
              <button onClick={fecharVisualizador} data-esc-fechar className="pm-ic" aria-label="Fechar"
                style={{ flex: "none", width: 36, height: 36, display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <div onClick={(e) => e.stopPropagation()}
              style={{ flex: 1, minHeight: 0, display: "grid", placeItems: "center", background: "#fff", borderRadius: 12, overflow: "hidden" }}>
              {ehImagem ? (
                <img src={vendo.url} alt={vendo.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : ehPdf ? (
                <iframe src={vendo.url} title={vendo.nome} style={{ width: "100%", height: "100%", border: 0 }} />
              ) : (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ font: "800 20px/1.3 Inter,sans-serif", color: INK }}>Este tipo de arquivo o navegador não abre.</div>
                  <p style={{ font: "400 15px/1.5 Inter,sans-serif", color: "#5c5a5c", margin: "10px 0 0" }}>
                    Arquivos de desenho (AI, CDR, EPS) e compactados precisam ser baixados e abertos no programa certo.
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {chegouAberto && aoRegistrarChegada && (
        <ClicheChegouModalV1a
          num={p.num}
          cliente={p.cliente}
          cores={String(campos?.cores ?? "")}
          fechar={() => setChegouAberto(false)}
          onSalvar={(r) => {
            setChegouAberto(false);
            setOcupado(true);
            Promise.resolve(aoRegistrarChegada(r))
              .then(() => { avisar("Chegada do clichê registrada"); onAcao?.(`Clichê chegou · ${p.cliente || ""}`); })
              .catch((err: unknown) => avisar(err instanceof Error ? err.message : "Não foi possível registrar."))
              .finally(() => setOcupado(false));
          }}
        />
      )}

      {devolver && (
        <DevolverArteModalV1a
          pedido={p}
          fechar={() => setDevolver(false)}
          onEnviar={(d) => {
            const msg = `Arte ${d.versao} devolvida a ${d.vendedora}`;
            const obs = `${msg} · ${d.cores.join(", ")}${d.obs ? " · " + d.obs : ""}`;
            setDevolver(false);
            if (!aoStatus) { avisar(msg); onAcao?.(`${msg} · ${p.cliente || ""}`); return; }
            setCarregando("Design criado");
            /* a arte final sobe ANTES do status, como tipo "arte" (avisa quem
               abriu o pedido). Se um arquivo falhar, o status muda mesmo assim
               — o design está pronto — mas o aviso diz o que faltou. */
            const subir = d.arquivos.length && aoAnexar
              ? Promise.resolve(aoAnexar(d.arquivos, "arte")).then(() => "").catch((e: unknown) => (e instanceof Error ? e.message : "os anexos falharam"))
              : Promise.resolve("");
            subir
              .then((falha) => Promise.resolve(aoStatus(ACAO_PARA_STATUS["Design criado"], obs, d.cores.join(", "))).then(async () => {
                /* recado marcado como pergunta vira pendência com dono — sem
                   isso ele fica só na observação do histórico, que foi como a
                   dúvida do #34 sumiu */
                if (d.pergunta && d.obs.trim() && aoPerguntar) {
                  try { await aoPerguntar(d.obs.trim()); } catch { /* a arte já foi; o aviso abaixo não pode sumir */ }
                }
                setCarregando(null);
                avisar(falha ? `${msg} — mas atenção: ${falha}` : d.pergunta ? `${msg} · pergunta em aberto` : msg);
                onAcao?.(`${msg} · ${p.cliente || ""}`);
              }))
              .catch((e: unknown) => { setCarregando(null); avisar(e instanceof Error ? e.message : "Não foi possível registrar."); });
          }}
        />
      )}

      <div ref={cartaoRef} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pv-cliente"
        style={{ width: PALCO_W, height: PALCO_H, flex: "none", transformOrigin: "center center", display: "grid", gridTemplateColumns: "288px 1fr", background: "#f1f1f1", borderRadius: 16, boxShadow: "0 50px 100px -30px rgba(0,0,0,.6)", overflow: "hidden", position: "relative" }}>

        {/* ————— Rail ————— */}
        <aside style={{ background: INK, padding: "26px 22px", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ flex: "none", font: "600 12px/1.25 Inter,sans-serif", color: "#8d8b8d" }}>Pedido {p.num || "—"} · {origem}</div>
          <div id="pv-cliente" style={{ flex: "none", ...fr(72, 700), fontSize: 36, lineHeight: 1, letterSpacing: "-.03em", marginTop: 14, overflowWrap: "anywhere", color: "#f1f1f1" }}>
            {p.cliente || "Pedido"}
          </div>

          <div style={{ flex: "none", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
            <span style={{ font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 999, background: st.bg, color: st.fg }}>{status}</span>
            {cancelado && !!canceladoEm && (
              <span style={{ font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 999, background: "#302f30", color: "#c9c7c9" }}>
                em {canceladoEm}
              </span>
            )}
            {/* prazo some quando o pedido fechou: "entrega em até 1 dia" num
                pedido já finalizado é ruído — a data virou histórico */}
            {!tudoFeito && !cancelado && p.dias !== null && p.dias !== undefined && (
              <span style={{ font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "8px 12px", borderRadius: 999, background: p.atraso ? "#c42b26" : "#302f30", color: p.atraso ? "#fff" : "#c9c7c9" }}>
                {/* "até": o prazo é teto, não data marcada — a arte pode sair antes */}
                {(p.atraso ? "Atrasado há " : "Entrega em até ") + p.dias + (p.dias === 1 ? " dia" : " dias") + (p.prazo ? ` · ${p.prazo}` : "")}
              </span>
            )}
          </div>

          <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 2, marginTop: 24 }}>
            {SECOES.map((e, i) => {
              const ativa = i === secao;
              /* o ponto do Briefing acendia só para pergunta — alteração por
                 resolver é a mesma classe de pendência e ficava muda */
              const pendente = (i === 0 && (abertas.length > 0 || emAberto.length > 0)) || (i === 1 && arquivos.length === 0);
              return (
                <button key={e.titulo} onClick={() => setSecao(i)} aria-current={ativa ? "true" : undefined}
                  style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", border: 0, borderRadius: 10, padding: "11px 12px", cursor: "pointer", background: ativa ? "#302f30" : "transparent", transition: "background .12s ease" }}>
                  <span style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", borderRadius: 999, font: "700 12px/1 Inter,sans-serif", background: ativa ? AMARELO : "#3a393a", color: ativa ? INK : "#8d8b8d" }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3, textAlign: "left" }}>
                    <span style={{ font: "700 14.5px/1.1 Inter,sans-serif", letterSpacing: "-.01em", color: ativa ? "#f1f1f1" : "#c9c7c9" }}>{e.titulo}</span>
                    <span style={{ font: "500 12px/1.1 Inter,sans-serif", color: "#8d8b8d" }}>{subSecao[i]}</span>
                  </span>
                  {pendente && (
                    <span title={i !== 0 ? "Nenhum anexo neste pedido" : abertas.length ? "Pergunta esperando resposta" : "Alteração pedida por resolver"}
                      style={{ flex: "none", width: 8, height: 8, borderRadius: 999, background: AMARELO }} />
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1, minHeight: 12 }} />

          <div style={{ flex: "none", display: "flex", flexDirection: "column", marginTop: 26 }}>
            <div style={{ flex: "none", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 12 }}>Andamento</div>
            <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 7 }}>
              {FLUXO.map((titulo, i) => {
                /* pedido cancelado não tem etapa "agora": o fluxo parou onde
                   parou, e pintar tudo de concluído seria mentira */
                const feito = !cancelado && (tudoFeito || i < passo);
                const agora = !cancelado && !tudoFeito && i === passo;
                return (
                  <div key={titulo} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: "none", width: agora ? 12 : 9, height: agora ? 12 : 9, borderRadius: 999, background: agora ? AMARELO : feito ? "#f1f1f1" : "#4a494a" }} />
                    <span style={{ flex: 1, minWidth: 0, font: `${agora ? 700 : 500} 13.5px/1.2 Inter,sans-serif`, color: agora ? "#f1f1f1" : feito ? "#c9c7c9" : "#6c6a6c" }}>{titulo}</span>
                    {agora && <span style={{ flex: "none", font: "700 10px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: AMARELO }}>agora</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, marginTop: 20 }}>
            <span style={{ flex: 1, minWidth: 0, font: "500 12.5px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>
              {ultimo
                ? `Última movimentação: ${dataHora(ultimo.iso).dia}${ultimo.autor ? " · " + primeiroNome(ultimo.autor) : ""}`
                : "Pedido sem movimentações registradas."}
            </span>
            {podeCancelar && (
              <button onClick={() => abrirPrompt("Cancelar pedido")}
                style={{ flex: "none", border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "600 12.5px/1.4 Inter,sans-serif", color: "#8d8b8d", textDecoration: "underline" }}>
                cancelar pedido
              </button>
            )}
          </div>
        </aside>

        {/* ————— Conteúdo ————— */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>

          <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "24px 28px 16px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Seção {secao + 1} de {SECOES.length}</div>
              <div style={{ ...fr(96, 700), fontSize: 32, lineHeight: 1, letterSpacing: "-.03em", marginTop: 9 }}>{SECOES[secao].titulo}</div>
              <div style={{ font: "400 14px/1.4 Inter,sans-serif", color: "#7a787a", marginTop: 8 }}>{SECOES[secao].sub}</div>
            </div>
            <button onClick={fechar} data-esc-fechar aria-label="Fechar" className="pm-ic"
              style={{ width: 38, height: 38, flex: "none", display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 999, cursor: "pointer" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>

          {/* ————— Pergunta esperando resposta —————
              Atravessa as duas colunas e aparece em QUALQUER seção: é o que
              faltava no #34, onde a dúvida da designer virou uma linha do
              histórico que a vendedora nunca abriu. */}
          {abertas.length > 0 && (
            <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 6, margin: "0 28px 12px" }}>
              {abertas.slice(0, 2).map((q) => {
                const { dia, hora } = dataHora(q.created_at);
                return (
                  <div key={q.id} style={{ display: "flex", alignItems: "center", gap: 14, background: AMARELO, borderRadius: 12, padding: "12px 14px 12px 16px" }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M20 12a8 8 0 1 1-3.3-6.5" /><path d="M9.2 9.3a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.5-2.8 2.5" /><path d="M12 16.8h.01" /></svg>
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ font: "700 10.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#6b6300" }}>
                        Pergunta esperando resposta{q.para_nome ? ` · ${primeiroNome(q.para_nome)}` : ""}
                      </span>
                      <span style={{ font: "600 14px/1.4 Inter,sans-serif", color: INK }}>{q.texto}</span>
                      <span style={{ font: "500 11.5px/1 Inter,sans-serif", color: "#6b6300" }}>
                        {[primeiroNome(q.de_nome ?? ""), dia && `${dia} às ${hora}`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {!!aoResponder && (
                      <button onClick={() => abrirResposta(q)} className="pv-chip"
                        style={{ flex: "none", border: 0, borderRadius: 8, padding: "12px 18px", cursor: "pointer", whiteSpace: "nowrap", font: "700 14px/1 Inter,sans-serif", background: INK, color: AMARELO }}>
                        Responder
                      </button>
                    )}
                  </div>
                );
              })}
              {abertas.length > 2 && (
                <button onClick={() => setSecao(2)}
                  style={{ alignSelf: "flex-start", border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "600 12.5px/1 Inter,sans-serif", color: "#6f6d6f", textDecoration: "underline" }}>
                  mais {abertas.length - 2} {abertas.length - 2 === 1 ? "pergunta" : "perguntas"} em aberto
                </button>
              )}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, padding: "0 28px" }}>

            {/* ————— Seção 1 · Briefing ————— */}
            {secao === 0 && (
              <div style={{ height: "100%", display: "grid", gridTemplateColumns: "minmax(0,1fr) 352px", gap: 14, minHeight: 0 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>

                  {p.extra && (
                    <div style={{ flex: "none", background: AMARELO, borderRadius: 14, padding: "18px 22px" }}>
                      <div style={{ font: "800 16px/1.15 Inter,sans-serif", letterSpacing: "-.01em", marginBottom: 14 }}>{p.extra.titulo}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "14px 20px" }}>
                        {p.extra.linhas.map((l) => (
                          <div key={l.k}>
                            <div style={{ ...ROTULO, color: "#6b6300" }}>{l.k}</div>
                            <div style={{ font: "700 15px/1.3 Inter,sans-serif", marginTop: 7 }}>{l.v}</div>
                          </div>
                        ))}
                      </div>
                      {!!p.extra.itens?.length && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 14 }}>
                          {p.extra.itens.map((it) => (
                            <span key={it.descricao} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 999, padding: "7px 11px", font: "500 12.5px/1 Inter,sans-serif", color: "#5c5a5c", whiteSpace: "nowrap" }}>
                              {it.descricao}
                              <span style={{ font: `600 12.5px/1 ${MONO}`, color: "#7a787a" }}>{it.valor}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Especificação — em edição ela toma a coluna inteira: os
                      cartões de cores e briefing repetem campos que já estão
                      no formulário e, espremidos, viravam duas tiras inúteis */}
                  <div style={{ ...CARD, flex: editando ? 1 : "none" }}>
                    <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
                      <span style={TIT_CARD}>{editando ? "Editar pedido" : "Especificação"}</span>
                      <span style={{ flex: 1 }} />
                      {editando ? (
                        <span style={NOTA_CARD}>a alteração fica registrada na auditoria</span>
                      ) : (
                        <>
                          <span style={NOTA_CARD}>veio da solicitação</span>
                          {podeEditar && (
                            <button onClick={abrirEdicao}
                              style={{ flex: "none", border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "600 12.5px/1 Inter,sans-serif", color: INK, textDecoration: "underline" }}>
                              editar
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {editando ? (
                      <>
                        <div className="pv-sc" style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gridAutoRows: "min-content", alignContent: "start", gap: "10px 14px", overflowY: "auto", paddingRight: 4 }}>
                          {CAMPOS_PEDIDO.map((c) => (
                            <Fragment key={c.k}>
                              <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: c.larga ? "1 / -1" : undefined }}>
                                <span style={ROTULO}>{c.label}</span>
                                <input value={form[c.k] ?? ""} onChange={(e) => setForm((s) => ({ ...s, [c.k]: e.target.value }))}
                                  style={{ width: "100%", boxSizing: "border-box", background: "#f4f4f4", border: "2px solid #f4f4f4", borderRadius: 8, padding: "9px 12px", font: "500 14.5px/1.2 Inter,sans-serif", color: INK, outline: "none" }} />
                              </label>

                              {/* Logo DEPOIS de largura e altura, que é o que ela
                                  preenche. No rodapé do formulário virava nota de
                                  rodapé e ninguém achava. */}
                              {c.k === "altura" && (facaForm ? (
                                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, background: INK, borderRadius: 10, padding: "10px 10px 10px 14px" }}>
                                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x={4} y={3.5} width={16} height={17} rx={2.5} /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></svg>
                                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                    <span style={{ font: "700 9.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Faca do catálogo</span>
                                    <span className="truncate" style={{ font: `700 14px/1 ${MONO}`, color: "#f1f1f1" }}>{facaForm}</span>
                                  </span>
                                  <button onClick={() => setFacasAberto("edicao")} className="pv-chip"
                                    style={{ flex: "none", border: 0, borderRadius: 999, padding: "8px 14px", cursor: "pointer", whiteSpace: "nowrap", font: "700 12.5px/1 Inter,sans-serif", background: AMARELO, color: INK }}>
                                    Trocar
                                  </button>
                                  <button onClick={() => setFacaForm("")} className="pv-chip" aria-label="Tirar a faca" title="Tirar a faca do pedido"
                                    style={{ flex: "none", width: 28, height: 28, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 999, cursor: "pointer" }}>
                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setFacasAberto("edicao")}
                                  style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "#fffce6", border: `2px dashed ${AMARELO}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}>
                                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x={4} y={3.5} width={16} height={17} rx={2.5} /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></svg>
                                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                                    <span style={{ font: "700 14px/1.2 Inter,sans-serif", color: INK }}>Escolher no catálogo de facas</span>
                                    <span style={{ font: "500 12.5px/1.3 Inter,sans-serif", color: "#7a787a" }}>Preenche a largura e a altura pelo desenho certo.</span>
                                  </span>
                                  <span style={{ flex: "none", font: "700 15px/1 Inter,sans-serif", color: INK }}>→</span>
                                </button>
                              ))}
                            </Fragment>
                          ))}
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button onClick={salvarEdicao} className="pv-chip" disabled={ocupado}
                            style={{ flex: 1, border: 0, borderRadius: 8, padding: 12, cursor: ocupado ? "progress" : "pointer", opacity: ocupado ? 0.6 : 1, font: "700 14.5px/1 Inter,sans-serif", background: INK, color: AMARELO }}>
                            {ocupado ? "Salvando…" : "Salvar alterações"}
                          </button>
                          <button onClick={() => setEditando(false)} className="pv-chip"
                            style={{ flex: "none", border: "2px solid #e6e6e6", background: "transparent", borderRadius: 8, padding: "12px 16px", cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "14px 18px", alignContent: "start" }}>
                          {specs.map((s) => (
                            <div key={s.k} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                              <span className="truncate" style={{ ...ROTULO, whiteSpace: "nowrap" }}>{s.k}</span>
                              {s.faca && aoVerFaca ? (
                                <button onClick={verFaca} disabled={ocupado} title="Ver o desenho da faca no acervo"
                                  style={{ textAlign: "left", border: 0, background: "transparent", padding: 0, cursor: ocupado ? "progress" : "pointer", ...fr(48, 700), fontSize: 18, lineHeight: 1.15, letterSpacing: "-.01em", color: INK, textDecoration: "underline", textUnderlineOffset: 3, overflowWrap: "anywhere" }}>
                                  {s.v}
                                </button>
                              ) : (
                                <span style={{ ...fr(48, 700), fontSize: 18, lineHeight: 1.15, letterSpacing: "-.01em", overflowWrap: "anywhere", color: s.v === vazio || s.v === "a assumir" ? "#8a888a" : INK }}>{s.v}</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14, marginTop: 16, paddingTop: 14, borderTop: "1px solid #ececec" }}>
                          <span style={{ ...ROTULO, flex: "none" }}>Acabamentos</span>
                          <span style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {podeAcabamento ? (
                              /* os quatro sempre à vista: para marcar um que
                                 falta é preciso enxergá-lo desligado */
                              ACABAMENTOS.map((a) => {
                                const on = acabLigado(a.campo);
                                return (
                                  <button key={a.campo} onClick={() => alternarAcabamento(a)} className="pv-chip"
                                    role="checkbox" aria-checked={on} title={on ? `Tirar ${a.rotulo.toLowerCase()}` : `Marcar ${a.rotulo.toLowerCase()}`}
                                    style={{ display: "flex", alignItems: "center", gap: 6, border: on ? 0 : "2px solid #e0dfe0", borderRadius: 999, padding: on ? "7px 12px" : "5px 10px", cursor: "pointer", font: `${on ? 700 : 600} 12.5px/1 Inter,sans-serif`, whiteSpace: "nowrap", background: on ? AMARELO : "transparent", color: on ? INK : "#7a787a" }}>
                                    {on && (
                                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 12.5l5 5L20 6.5" /></svg>
                                    )}
                                    {a.rotulo}
                                  </button>
                                );
                              })
                            ) : acabamentos.length ? acabamentos.map((a) => (
                              <span key={a.campo} style={{ display: "flex", alignItems: "center", borderRadius: 999, padding: "7px 12px", font: "700 12.5px/1 Inter,sans-serif", whiteSpace: "nowrap", background: AMARELO, color: INK }}>{a.rotulo}</span>
                            )) : (
                              <span style={{ font: "500 13px/1.2 Inter,sans-serif", color: "#7a787a" }}>Nenhum — impressão simples</span>
                            )}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Cores do pedido */}
                  {!editando && <div style={{ ...CARD, flex: "none", padding: "16px 22px" }}>
                    <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, marginBottom: 11 }}>
                      <span style={TIT_CARD}>Cores do pedido</span>
                      <span style={{ flex: 1 }} />
                      {!!cores.length && <span style={NOTA_CARD}>{cores.length} {cores.length === 1 ? "cor" : "cores"}</span>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {cores.length ? cores.map((c, i) => (
                        <button key={c.nome + i} onClick={() => copiarCor(c)} className="pv-chip pv-cor"
                          title={c.hex ? `Clique para copiar ${c.hex}` : `Clique para copiar “${c.nome}”`}
                          style={{ display: "flex", alignItems: "center", gap: 8, background: "#f4f4f4", border: 0, borderRadius: 999, padding: "6px 13px 6px 7px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", whiteSpace: "nowrap", color: INK }}>
                          <span style={{ flex: "none", width: 16, height: 16, borderRadius: 999, boxShadow: "inset 0 0 0 1px rgba(37,36,37,.16)", background: c.hex || "#d6d5d6" }} />
                          {c.nome}
                          {!!c.hex && <span className="pv-hex" style={{ marginLeft: -8, whiteSpace: "nowrap", font: `600 11.5px/1 ${MONO}`, color: "#6f6d6f" }}>{c.hex}</span>}
                        </button>
                      )) : (
                        <span style={{ font: "500 13.5px/1.4 Inter,sans-serif", color: "#7a787a" }}>Nenhuma cor informada na solicitação</span>
                      )}
                    </div>
                  </div>}

                  {/* Briefing */}
                  {!editando && <div style={{ ...CARD, flex: 1, minHeight: 0 }}>
                    <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                      <span style={TIT_CARD}>Briefing da solicitação</span>
                      <span style={{ flex: 1 }} />
                      {(briefingCortado || briefingAberto) && (
                        <button onClick={() => setBriefingAberto((v) => !v)}
                          style={{ flex: "none", border: 0, background: "transparent", padding: 0, cursor: "pointer", font: "600 12.5px/1 Inter,sans-serif", color: INK, textDecoration: "underline" }}>
                          {briefingAberto ? "resumir" : "ver tudo"}
                        </button>
                      )}
                      <span style={NOTA_CARD}>escrito por {quemPediu}</span>
                    </div>
                    <div ref={briefRef} className={briefingAberto ? "pv-sc" : undefined}
                      style={{
                        flex: 1, minHeight: 0, font: "500 14.5px/1.6 Inter,sans-serif", whiteSpace: "pre-wrap",
                        color: briefing ? INK : "#8a888a",
                        ...(briefingAberto
                          ? { overflowY: "auto", paddingRight: 4 }
                          : { overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical" as const }),
                      }}>
                      {briefing || "A solicitação foi aberta sem briefing escrito."}
                    </div>
                    {!!linkRef && (
                      <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid #ececec" }}>
                        <span style={{ ...ROTULO, flex: "none" }}>Referência</span>
                        <a href={linkRef} target="_blank" rel="noreferrer" className="truncate"
                          style={{ flex: 1, minWidth: 0, font: "500 13px/1.4 Inter,sans-serif", color: "#5c5a5c" }}>{linkRef}</a>
                      </div>
                    )}
                  </div>}
                </div>

                {/* Alterações pedidas */}
                <div style={{ ...CARD, minHeight: 0 }}>
                  <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
                    <span style={TIT_CARD}>Alterações pedidas</span>
                    <span style={{ flex: 1 }} />
                    {!!revisoes.length && (
                      <span style={NOTA_CARD}>
                        {nResolvidas ? `${nResolvidas} de ${revisoes.length} resolvidas` : `${revisoes.length} ${revisoes.length === 1 ? "pedido" : "pedidos"}`}
                      </span>
                    )}
                  </div>
                  <div className="pv-sc" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: revisoes.length ? 4 : 0 }}>
                    {revisoes.length ? revisoes.map((r) => {
                      const ok = marcada(r.chave);
                      /* quem resolveu, para quem pediu. Sem isto a vendedora via
                         o texto riscado e não sabia se o design tinha tratado ou
                         se ela mesma tinha marcado sem querer. */
                      const m = ok ? marcaDe(r.chave) : undefined;
                      const feitoEm = m?.em ? dataHora(m.em) : null;
                      const feitoPor = [
                        m?.por ? `por ${primeiroNome(m.por)}` : "",
                        feitoEm?.dia ? `${feitoEm.dia} às ${feitoEm.hora}` : "",
                      ].filter(Boolean).join(" · ");
                      return (
                        <div key={r.chave} style={{ flex: "none", background: ok ? "#fafafa" : "#f4f4f4", borderRadius: 11, padding: "12px 14px", transition: "background .12s ease" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ ...CHIP_TIPO, background: ok ? INK : r.recente ? AMARELO : "#e6e6e6", color: ok ? AMARELO : r.recente ? INK : "#6f6d6f" }}>
                              {ok ? "resolvida" : r.recente ? "mais recente" : "revisão"}
                            </span>
                            <span className="truncate" style={{ flex: 1, minWidth: 0, font: "500 11.5px/1 Inter,sans-serif", color: "#6f6d6f" }}>{r.quando}</span>
                            {!!feitoPor && (
                              <span style={{ flex: "none", font: "600 11.5px/1 Inter,sans-serif", color: "#4a7a3f" }} title={`Alteração resolvida ${feitoPor}`}>
                                ✓ {feitoPor}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
                            <button onClick={() => alternarResolvida(r.chave)} role="checkbox" aria-checked={ok}
                              title={ok ? "Reabrir alteração" : "Marcar como resolvida"} aria-label={ok ? "Reabrir alteração" : "Marcar como resolvida"}
                              style={{ flex: "none", width: 20, height: 20, marginTop: 1, display: "grid", placeItems: "center", borderRadius: 6, cursor: "pointer", border: `2px solid ${ok ? AMARELO : "#dcdbdc"}`, background: ok ? AMARELO : "#fff", transition: "border-color .12s ease,background .12s ease" }}>
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" style={{ display: ok ? "block" : "none" }}><path d="M4 12.5l5 5L20 6.5" /></svg>
                            </button>
                            <span style={{ flex: 1, minWidth: 0, font: "500 13.5px/1.5 Inter,sans-serif", color: ok ? "#8a888a" : INK, textDecoration: ok ? "line-through" : "none" }}>{r.texto}</span>
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ flex: 1, display: "grid", placeItems: "center", textAlign: "center", padding: "0 10px" }}>
                        <span style={{ font: "500 13.5px/1.5 Inter,sans-serif", color: "#7a787a" }}>
                          Nenhuma alteração pedida até agora. O que for escrito em “Pedir revisão” aparece aqui.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ————— Seção 2 · Arquivos ————— */}
            {secao === 1 && (
              <div style={{ height: "100%", display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 14, minHeight: 0 }}>
                <div style={{ minHeight: 0, background: INK, borderRadius: 14, padding: "20px 22px", display: "flex", flexDirection: "column" }}>
                  <div style={{ flex: "none", display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                    <span style={{ ...TIT_CARD, color: "#f1f1f1" }}>Anexos do pedido</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ flex: "none", whiteSpace: "nowrap", font: "600 13px/1 Inter,sans-serif", color: "#8d8b8d" }}>{arquivos.length} {arquivos.length === 1 ? "anexo" : "anexos"}</span>
                  </div>
                  <div className="pv-sc" style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, paddingRight: arquivos.length ? 4 : 0 }}>
                    {arquivos.length ? arquivos.map((a) => (
                      <div key={a.id} className="pv-dark" style={{ flex: "none", display: "flex", alignItems: "center", gap: 4, background: "#302f30", borderRadius: 9, padding: "0 8px 0 14px", transition: "background .12s ease" }}>
                        <button onClick={() => ver(a)} disabled={ocupado} title="Abrir o anexo aqui"
                          style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: 0, padding: "11px 0", cursor: ocupado ? "progress" : "pointer" }}>
                          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                            <span className="truncate" style={{ font: "500 14.5px/1.1 Inter,sans-serif", color: "#f1f1f1" }}>{a.nome}</span>
                            {!!a.origem && <span style={{ font: "500 11.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{a.origem}</span>}
                          </span>
                          {!!a.peso && <span style={{ flex: "none", font: `500 13px/1 ${MONO}`, color: "#8d8b8d" }}>{a.peso}</span>}
                        </button>
                        {!!aoBaixarArquivo && (
                          <button onClick={() => baixar(a)} disabled={ocupado} aria-label="Baixar para o computador" title="Baixar para o computador"
                            style={{ flex: "none", width: 28, height: 28, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 999, cursor: "pointer" }}>
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="m8 11.5 4 4 4-4" /><path d="M5 19.5h14" /></svg>
                          </button>
                        )}
                        {!!aoExcluirArquivo && (
                          <button onClick={() => excluirArquivo(a)} disabled={ocupado} aria-label="Tirar do pedido" title="Tirar do pedido (o arquivo continua na pasta do cliente)"
                            style={{ flex: "none", width: 28, height: 28, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 999, cursor: "pointer" }}>
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                          </button>
                        )}
                      </div>
                    )) : (
                      <div style={{ height: "100%", display: "grid", placeItems: "center", font: "500 14px/1.4 Inter,sans-serif", color: "#8d8b8d" }}>Nenhum anexo neste pedido.</div>
                    )}
                  </div>
                </div>

                <div style={{ ...CARD, minHeight: 0, padding: "20px 22px" }}>
                  <div style={{ flex: "none", ...TIT_CARD, marginBottom: 6 }}>Anexar arquivo</div>
                  <div style={{ flex: "none", font: "400 12.5px/1.45 Inter,sans-serif", color: "#7a787a", marginBottom: 14 }}>Arte, faca, prova impressa ou foto do produto.</div>

                  {permissoes?.anexar === false ? (
                    <div style={{ flex: "none", background: "#fafafa", borderRadius: 12, padding: "24px 18px", textAlign: "center", font: "500 13px/1.5 Inter,sans-serif", color: "#7a787a" }}>
                      Seu acesso não inclui anexar arquivos a pedidos.
                    </div>
                  ) : (
                    <>
                      <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => enviarArquivos(e.target.files)} />
                      <div
                        onDragOver={(e) => { e.preventDefault(); if (!dragAtivo) setDragAtivo(true); }}
                        onDragLeave={(e) => { e.preventDefault(); if (dragAtivo) setDragAtivo(false); }}
                        onDrop={(e) => { e.preventDefault(); enviarArquivos(e.dataTransfer?.files); }}
                        onClick={() => fileRef.current?.click()}
                        style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, padding: "26px 18px", borderRadius: 12, cursor: ocupado ? "progress" : "pointer", border: `2px dashed ${dragAtivo ? INK : "#e0dfe0"}`, background: dragAtivo ? "#fffce6" : "#fafafa", transition: "border-color .12s ease,background .12s ease" }}>
                        <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16.5V5" /><path d="M7.5 9.5L12 5l4.5 4.5" /><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></svg>
                        <span style={{ font: "700 14.5px/1.3 Inter,sans-serif", color: INK, textAlign: "center" }}>
                          {ocupado ? "Enviando…" : dragAtivo ? "Solte para anexar" : "Arraste arquivos aqui"}
                        </span>
                        <span style={{ font: "500 12.5px/1.4 Inter,sans-serif", color: "#7a787a", textAlign: "center" }}>PDF, CDR, AI, JPG ou PNG</span>
                      </div>
                      <button onClick={() => fileRef.current?.click()} disabled={ocupado} className="pv-chip"
                        style={{ flex: "none", width: "100%", marginTop: 10, border: 0, borderRadius: 9, padding: 13, cursor: ocupado ? "progress" : "pointer", opacity: ocupado ? 0.6 : 1, font: "700 14px/1 Inter,sans-serif", background: AMARELO, color: INK }}>
                        Escolher arquivos
                      </button>
                    </>
                  )}
                  <div style={{ flex: 1, minHeight: 12 }} />
                  <div style={{ flex: "none", font: "400 12.5px/1.5 Inter,sans-serif", color: "#7a787a" }}>
                    Todo arquivo anexado aqui vai para a pasta do cliente na rede e fica visível para o design e para a produção. Tirar do pedido não apaga o arquivo da pasta.
                  </div>
                </div>
              </div>
            )}

            {/* ————— Seção 3 · Histórico ————— */}
            {secao === 2 && (
              <div style={{ ...CARD, height: "100%", padding: "20px 22px" }}>
                <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={TIT_CARD}>Movimentações</span>
                  <span style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 8 }}>
                    {filtrosVisiveis.map((f) => {
                      const ativo = filtro === f.k;
                      return (
                        <button key={f.k} onClick={() => setFiltro(f.k)} className="pv-chip"
                          style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, border: `2px solid ${ativo ? INK : "#ececec"}`, background: ativo ? INK : "transparent", color: ativo ? "#f1f1f1" : "#5c5a5c", borderRadius: 999, padding: "7px 13px", cursor: "pointer", whiteSpace: "nowrap", font: "600 12.5px/1 Inter,sans-serif", transition: "background .12s ease,border-color .12s ease" }}>
                          {f.label}
                          <span style={{ font: `700 11px/1 ${MONO}`, color: ativo ? AMARELO : "#7a787a" }}>{f.n}</span>
                        </button>
                      );
                    })}
                  </span>
                  <span style={{ ...NOTA_CARD, color: "#6f6d6f", font: "600 13px/1 Inter,sans-serif" }}>{registros.length} {registros.length === 1 ? "registro" : "registros"}</span>
                </div>
                <div className="pv-sc" style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
                  {visiveis.length ? visiveis.map((r, i) => {
                    const t = TIPO[r.tipo];
                    const { dia, hora } = dataHora(r.iso);
                    const diaAnterior = i ? dataHora(visiveis[i - 1].iso).dia : null;
                    const destaque = i === 0;
                    return (
                      <div key={r.id}>
                        {!!dia && dia !== diaAnterior && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 8px" }}>
                            <span style={{ ...ROTULO, flex: "none" }}>{dia}</span>
                            <span style={{ flex: 1, height: 1, background: "#f1f1f1" }} />
                          </div>
                        )}
                        <div className="pv-row" style={{ display: "flex", alignItems: "stretch", gap: 13, borderRadius: 10, padding: "6px 8px 6px 4px", transition: "background .12s ease" }}>
                          <div style={{ flex: "none", width: 14, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ flex: "none", width: destaque ? 13 : 9, height: destaque ? 13 : 9, marginTop: destaque ? 4 : 6, borderRadius: 999, background: destaque ? AMARELO : INK, boxShadow: destaque ? "0 0 0 4px rgba(255,232,21,.28)" : undefined }} />
                            {i < visiveis.length - 1 && <span style={{ flex: 1, width: 2, minHeight: 10, marginTop: 5, background: "#ececec", borderRadius: 999 }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0, paddingBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                              <span style={{ display: "block", font: `${destaque ? 700 : 500} 14px/1.45 Inter,sans-serif`, color: INK }}>{r.titulo}</span>
                              <span style={{ flex: 1, minWidth: 8 }} />
                              <span style={{ flex: "none", whiteSpace: "nowrap", font: `500 12px/1.2 ${MONO}`, color: "#7a787a" }}>{hora}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                              <span style={{ ...CHIP_TIPO, background: t.bg, color: t.fg }}>{t.label}</span>
                              {!!r.autor && (
                                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                  <span style={{ flex: "none", width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 999, background: "#f1f1f1", font: "700 10.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>{r.autor.trim().charAt(0).toUpperCase()}</span>
                                  <span style={{ font: "500 12.5px/1 Inter,sans-serif", color: "#6f6d6f" }}>{r.autor}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div style={{ padding: "34px 0", textAlign: "center", font: "500 13.5px/1.5 Inter,sans-serif", color: "#7a787a" }}>
                      {registros.length ? "Nenhum registro deste tipo neste pedido." : "Nenhuma movimentação registrada ainda."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ————— Rodapé ————— */}
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "18px 28px 22px", minWidth: 0 }}>
            {papeis.length > 0 && (
              <span style={{ flex: "none", display: "flex", alignItems: "center", gap: 3, background: "#e6e5e6", borderRadius: 999, padding: 4 }}>
                {papeis.map((l) => {
                  const at = papelAtivo === l;
                  return escolhePapel ? (
                    <button key={l} onClick={() => trocarPapel(l)} className="pv-chip"
                      title={`Ver as ações de ${l.toLowerCase()}`}
                      style={{ flex: "none", border: 0, borderRadius: 999, padding: "7px 11px", cursor: "pointer", whiteSpace: "nowrap", font: "600 12px/1 Inter,sans-serif", background: at ? INK : "transparent", color: at ? "#f1f1f1" : "#6f6d6f", transition: "background .12s ease" }}>
                      {l}
                    </button>
                  ) : (
                    <span key={l} style={{ flex: "none", borderRadius: 999, padding: "7px 11px", whiteSpace: "nowrap", font: "600 12px/1 Inter,sans-serif", background: INK, color: "#f1f1f1" }}>{l}</span>
                  );
                })}
              </span>
            )}
            <span className="truncate" style={{ flex: 1, minWidth: 0, font: "500 13.5px/1.4 Inter,sans-serif", color: "#6f6d6f" }}>{rodapeTexto}</span>
            <button onClick={fechar} className="pv-chip"
              style={{ flex: "none", background: "transparent", border: 0, borderRadius: 8, padding: "14px 16px", font: "600 14.5px/1 Inter,sans-serif", color: "#6f6d6f", cursor: "pointer" }}>Fechar</button>
            {!!aoComentar && (
              <button onClick={() => abrirPrompt("Observação")} className="pv-chip"
                style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, border: "2px solid #e0dfe0", background: "transparent", borderRadius: 999, padding: "11px 15px", cursor: "pointer", whiteSpace: "nowrap", font: "600 14px/1 Inter,sans-serif", color: INK }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 1 1-3.3-6.5" /><path d="M8 11h8" /><path d="M8 15h5" /></svg>
                Observação
                {nObs > 0 && <span style={{ flex: "none", minWidth: 20, height: 20, display: "grid", placeItems: "center", borderRadius: 999, padding: "0 6px", font: "700 11px/1 Inter,sans-serif", background: INK, color: AMARELO }}>{nObs}</span>}
              </button>
            )}
            {acoes.map((a) => {
              const escuro = a.tema === "escuro";
              const nesta = carregando === a.label;
              const bloq = !!carregando;
              return (
                <button key={a.label} onClick={() => acionar(a.label)} className="pv-chip"
                  style={{ flex: "none", border: escuro ? 0 : "2px solid #e0dfe0", borderRadius: 8, padding: escuro ? "15px 20px" : "13px 15px", whiteSpace: "nowrap", cursor: bloq ? "progress" : "pointer", pointerEvents: bloq ? "none" : "auto", opacity: bloq && !nesta ? 0.4 : 1, font: `${escuro ? 700 : 600} 14.5px/1 Inter,sans-serif`, background: escuro ? INK : "transparent", color: escuro ? AMARELO : INK, transition: "opacity .12s ease" }}>
                  {nesta ? "Enviando…" : a.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ————— Diálogo ————— */}
        {promptAtual && (
          <div data-modal-esc onClick={fecharPrompt}
            style={{ position: "absolute", inset: 0, zIndex: 80, display: "grid", placeItems: "center", background: "rgba(37,36,37,.55)" }}>
            <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pv-dlg"
              style={{ width: 460, maxHeight: "92%", overflowY: "auto", background: "#fff", borderRadius: 16, padding: 28 }}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && promptOk && !carregando) {
                  e.preventDefault();
                  executar(prompt!, promptTexto.trim());
                }
              }}>
              <div id="pv-dlg" style={{ ...fr(72, 700), fontSize: 24, lineHeight: 1.1, letterSpacing: "-.02em" }}>
                {promptAtual.titulo(p.cliente || "pedido", quemPediu)}
              </div>

              {promptAtual.comCodigo && (
                <input value={promptCodigo} onChange={(e) => setPromptCodigo(e.target.value)} placeholder="Código do produto"
                  style={{ ...INP_DIALOGO, marginTop: 16, font: "600 14.5px/1.2 Inter,sans-serif" }} />
              )}

              {!promptAtual.semTexto && (
                <textarea value={promptTexto} onChange={(e) => setPromptTexto(e.target.value)} autoFocus placeholder={promptAtual.placeholder}
                  style={{ ...INP_DIALOGO, height: 120, marginTop: promptAtual.comCodigo ? 10 : 16, resize: "none" }} />
              )}

              {/* Anexo no diálogo só onde ele vira anexo do pedido de verdade:
                  as ações de status. Observação e Pedir informação viram
                  comentário (que não carrega arquivo) e Reposição abre OUTRO
                  pedido — oferecer o botão ali era prometer um envio que
                  nunca acontecia. */}
              {!!prompt && !!ACAO_PARA_STATUS[prompt] && !!aoAnexar && permissoes?.anexar !== false && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
                  <input ref={promptFileRef} type="file" multiple style={{ display: "none" }}
                    onChange={(e) => {
                      const l = e.target.files;
                      if (l?.length) setPromptAnexos((s) => [...s, ...Array.from(l).filter((f) => !s.some((x) => x.name === f.name))]);
                      e.target.value = "";
                    }} />
                  {promptAnexos.map((a, i) => (
                    <div key={a.name + i} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f4f4f4", borderRadius: 9, padding: "8px 10px 8px 12px" }}>
                      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3.5V8h4.5" /></svg>
                      <span className="truncate" style={{ flex: 1, minWidth: 0, font: "500 13.5px/1.1 Inter,sans-serif" }}>{a.name}</span>
                      <span style={{ flex: "none", whiteSpace: "nowrap", font: `500 12px/1 ${MONO}`, color: "#6f6d6f" }}>
                        {a.size > 1048576 ? `${(a.size / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(a.size / 1024))} KB`}
                      </span>
                      <button onClick={() => setPromptAnexos((s) => s.filter((_, j) => j !== i))} className="pv-chip" aria-label="Remover anexo"
                        style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", border: 0, borderRadius: 999, background: "#e6e6e6", cursor: "pointer" }}>
                        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                      </button>
                    </div>
                  ))}
                  <button onClick={() => promptFileRef.current?.click()} className="pv-chip"
                    style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, border: "2px dashed #e0e0e0", background: "transparent", borderRadius: 9, padding: "9px 14px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                    Anexar arquivo
                  </button>
                </div>
              )}

              {/* Citar uma faca sem sair da conversa: escreve código e medida
                  no texto, que é o que o outro lado precisa para achá-la. */}
              {!promptAtual.semTexto && (
                <button onClick={() => setFacasAberto("prompt")} className="pv-chip"
                  style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, border: "2px dashed #e0e0e0", background: "transparent", borderRadius: 9, padding: "9px 14px", cursor: "pointer", font: "600 13px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x={4} y={3.5} width={16} height={17} rx={2.5} /><path d="M8 8h8" /><path d="M8 12h8" /><path d="M8 16h5" /></svg>
                  Catálogo de facas
                </button>
              )}

              <div style={{ font: "400 12.5px/1.45 Inter,sans-serif", color: "#7a787a", marginTop: 12 }}>{promptAtual.nota}</div>

              <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                <button onClick={fecharPrompt} data-esc-fechar className="pv-chip"
                  style={{ flex: "none", border: "2px solid #e6e6e6", background: "transparent", borderRadius: 8, padding: "13px 18px", cursor: "pointer", font: "600 14.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                  Cancelar
                </button>
                <button onClick={() => { if (promptOk && !carregando) executar(prompt!, promptTexto.trim()); }} className="pv-chip"
                  style={{ flex: 1, border: 0, borderRadius: 8, padding: 13, cursor: promptOk && !carregando ? "pointer" : "not-allowed", font: "700 14.5px/1 Inter,sans-serif", opacity: promptOk ? 1 : 0.45, background: promptAtual.tema === "amarelo" ? AMARELO : INK, color: promptAtual.tema === "amarelo" ? INK : AMARELO }}>
                  {carregando ? "Enviando…" : promptAtual.confirmar}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ————— Catálogo de facas ————— */}
        {facasAberto && (
          <FacasModalV1a
            valor={facasAberto === "edicao" ? facaForm : facaCod}
            aoVer={aoVerFaca ? (cod) => aoVerFaca(cod).then((r) => setVendo({ ...r, id: "faca:" + cod })) : undefined}
            fechar={() => setFacasAberto(null)}
            onEscolher={(cod, medida) => {
              if (facasAberto === "edicao") { usarFacaNaEdicao(cod, medida); return; }
              /* no diálogo a faca vira texto: quem lê precisa do código E da
                 medida para achar o desenho sem perguntar de volta */
              setPromptTexto((t) => `${t.trim()}${t.trim() ? " " : ""}Faca ${cod} (${medida})`.trim());
              setFacasAberto(null);
            }}
          />
        )}

        {/* ————— Toast ————— */}
        {toast && (
          <div role="status"
            style={{ position: "absolute", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 90, display: "flex", alignItems: "center", gap: 14, background: INK, color: "#f1f1f1", borderRadius: 999, padding: "11px 22px", font: "600 14px/1 Inter,sans-serif", maxWidth: "80%" }}>
            <span className="truncate">{toast.texto}</span>
            {!!toast.acao && (
              <button onClick={() => { const fn = toast.fn; clearTimeout(toastTimer.current); setToast(null); fn?.(); }} className="pv-chip"
                style={{ flex: "none", margin: "-3px -12px -3px 0", border: 0, borderRadius: 999, padding: "9px 15px", cursor: "pointer", font: "700 13px/1 Inter,sans-serif", background: AMARELO, color: INK }}>
                {toast.acao}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
