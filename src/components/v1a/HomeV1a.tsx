// Home — v1a. Fonte: design_handoff_r2_hub/telas/Home.dc.html (frame 3a).
// Saudação à esquerda, painel escuro à direita (papéis, números, tarefas do
// dia, recentes dos pedidos reais) e rodapé com agenda da semana + atalhos.
// O papel de parede central (image-slot) não foi migrado — os painéis usam o
// fundo sólido #252425, o fallback oficial do protótipo sem imagem.
import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { useHubDados } from "./HubDadosV1a";
import {
  AMARELO, AvisoV1a, EstagioV1a, INK, MONO, RailV1a, TopbarV1a, fr, nomeDaPagina, usePalcoLargura,
} from "./HubV1a";

type Pedido = {
  id: string; numero: number; cliente: string; status: string; tipo?: string;
  created_at?: string; updated_at?: string;
};

const STATUS_HOME: Record<string, { bg: string; fg: string; orelha: string }> = {
  "Aguardando Design": { bg: "rgba(255,255,255,.14)", fg: "#f1f1f1", orelha: "#d6d5d6" },
  "Clichê solicitado": { bg: "#ffe815", fg: "#252425", orelha: "#8d8b8d" },
  "Design aprovado": { bg: "rgba(255,232,21,.18)", fg: "#ffe815", orelha: "#f1f1f1" },
  "Alteração pedida": { bg: "rgba(255,232,21,.18)", fg: "#ffe815", orelha: "#ffe815" },
  "Aguardando aprovação": { bg: "rgba(255,255,255,.10)", fg: "#b3b1b3", orelha: "#8d8b8d" },
  "Finalizado": { bg: "rgba(255,255,255,.08)", fg: "#8d8b8d", orelha: "#8d8b8d" },
};
const APP_PARA_V1A: Record<string, string> = {
  nova: "Aguardando Design", criacao: "Aguardando Design",
  aguardando: "Aguardando aprovação", revisao: "Alteração pedida",
  aprovada: "Design aprovado", cliche: "Clichê solicitado", concluido: "Finalizado", cancelado: "Finalizado",
};

const ICONES: Record<string, string[]> = {
  mais: ["M12 5.5v13", "M5.5 12h13"],
  check: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", "m8.5 12 2.8 2.8 5.7-5.8"],
  prancheta: ["M9 3.5h6v3H9z", "M9 5H6.5v16.5h11V5H15", "M9.6 16.4 13.4 12.6l1.9 1.9-3.8 3.8-2.1.3z"],
  caixa: ["M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z", "M3.5 8 12 12.5 20.5 8", "M12 12.5v8"],
  camadas: ["M12 3 3 8l9 5 9-5-9-5z", "M3 12.5l9 5 9-5", "M3 17l9 5 9-5"],
  painel: ["M20.5 15.5a9 9 0 1 0-17 0", "M12 15.5 16.5 11"],
  mensagem: ["M3 5.5h18v13H3z", "m3.5 7 8.5 5.5L20.5 7"],
};

const PAPEIS = [
  { k: "gestor", label: "Gestor" },
  { k: "vendedora", label: "Vendas" },
  { k: "designer", label: "Designer" },
  { k: "producao", label: "Produção" },
  { k: "clicheria", label: "Clicheria" },
];
/** Cada painel exige a permissão da área que ele resume. */
const PERM_DO_PAPEL: Record<string, string> = {
  gestor: "pedidos.ver_todos",
  vendedora: "pedidos.criar",
  designer: "pedidos.status_design",
  producao: "tab.painel",
  clicheria: "tab.cliches",
};
/** Cargo do usuário → painel que abre por padrão. */
const PAPEL_DO_CARGO: Record<string, string> = {
  admin: "gestor", gestor: "gestor", comercial: "vendedora", vendas: "vendedora",
  designer: "designer", producao: "producao", clicheria: "clicheria", estoque: "producao",
};

type Tarefa = { texto: string; tag: string; feito?: boolean };
type Atalho = { label: string; icone: string; tema: "amarelo" | "vidro" };
type Numero = { valor: string; label: string; tema: "amarelo" | "vidro" };

const DADOS: Record<string, { tarefas: Tarefa[]; atalhos: Atalho[]; numeros: Numero[] }> = {
  gestor: {
    tarefas: [
      { texto: "Aprovar orçamento do Frigorífico Vale Verde", tag: "hoje" },
      { texto: "Validar dois clichês reprovados na clicheria", tag: "urgente" },
      { texto: "Revisar produtividade da semana", tag: "14:00" },
      { texto: "Fechar apontamentos de sexta", tag: "feito", feito: true },
    ],
    atalhos: [
      { label: "Novo pedido", icone: "mais", tema: "amarelo" },
      { label: "Aprovar arte", icone: "check", tema: "vidro" },
      { label: "Painel", icone: "painel", tema: "vidro" },
    ],
    numeros: [
      { valor: "38", label: "Artes aprovadas", tema: "amarelo" },
      { valor: "3", label: "Na clicheria", tema: "vidro" },
      { valor: "92%", label: "No prazo", tema: "vidro" },
    ],
  },
  vendedora: {
    tarefas: [
      { texto: "Confirmar Pantone 485 com o Bom Preço", tag: "hoje" },
      { texto: "Enviar prova impressa para o Rossi", tag: "urgente" },
      { texto: "Cobrar aprovação do Hortifruti Boa Safra", tag: "há 2 dias" },
      { texto: "Abrir pedido da Distribuidora Cepa Sul", tag: "feito", feito: true },
    ],
    atalhos: [
      { label: "Novo pedido", icone: "mais", tema: "amarelo" },
      { label: "Meus pedidos", icone: "caixa", tema: "vidro" },
      { label: "Mensagens", icone: "mensagem", tema: "vidro" },
    ],
    numeros: [
      { valor: "8", label: "Em aberto", tema: "amarelo" },
      { valor: "12", label: "Aprovados", tema: "vidro" },
      { valor: "3", label: "Com cliente", tema: "vidro" },
    ],
  },
  designer: {
    tarefas: [
      { texto: "Fechar arte da Panificadora Pão Nosso", tag: "urgente" },
      { texto: "Ajustar sangria do Rossi (+2 mm)", tag: "hoje" },
      { texto: "Solicitar clichê da Cervejaria Ilha Grande", tag: "hoje" },
      { texto: "Revisar faca nova do Vale Verde", tag: "feito", feito: true },
    ],
    atalhos: [
      { label: "Aprovar arte", icone: "check", tema: "amarelo" },
      { label: "Apontar produção", icone: "prancheta", tema: "vidro" },
      { label: "Clichês", icone: "camadas", tema: "vidro" },
    ],
    numeros: [
      { valor: "47", label: "Solicitadas", tema: "amarelo" },
      { valor: "2", label: "Em revisão", tema: "vidro" },
      { valor: "38", label: "Finalizadas", tema: "vidro" },
    ],
  },
  producao: {
    tarefas: [
      { texto: "Iniciar OS #0416 na Del Rey 5", tag: "agora" },
      { texto: "Conferir metragem do rolo da Classic", tag: "hoje" },
      { texto: "Registrar leitura da OP P009186-002", tag: "hoje" },
      { texto: "Apontar produção da madrugada", tag: "feito", feito: true },
    ],
    atalhos: [
      { label: "Painel", icone: "painel", tema: "amarelo" },
      { label: "Leitura", icone: "prancheta", tema: "vidro" },
      { label: "Apontamentos", icone: "caixa", tema: "vidro" },
    ],
    numeros: [
      { valor: "1", label: "Rodando", tema: "amarelo" },
      { valor: "4", label: "Livres", tema: "vidro" },
      { valor: "48 mil", label: "Metros hoje", tema: "vidro" },
    ],
  },
  clicheria: {
    tarefas: [
      { texto: "Receber clichê do Frigorífico Vale Verde", tag: "hoje" },
      { texto: "Lançar valores do clichê do Moinho Três Rios", tag: "hoje" },
      { texto: "Cobrar retorno da Cervejaria Ilha Grande", tag: "há 2 dias" },
      { texto: "Enviar faca do Rossi para afiação", tag: "feito", feito: true },
    ],
    atalhos: [
      { label: "Aprovação", icone: "check", tema: "amarelo" },
      { label: "Facas", icone: "camadas", tema: "vidro" },
      { label: "Afiação", icone: "prancheta", tema: "vidro" },
    ],
    numeros: [
      { valor: "3", label: "Na clicheria", tema: "amarelo" },
      { valor: "2", label: "Recebidos", tema: "vidro" },
      { valor: "12", label: "Facas em afiação", tema: "vidro" },
    ],
  },
};

/* destino de cada atalho no app (labels do rail) */
const ATALHO_PAGS: Record<string, string> = {
  "Aprovar arte": "Aprovação", "Aprovação": "Aprovação", "Painel": "Fábrica",
  "Meus pedidos": "Pedidos", "Apontar produção": "Apontamentos", "Apontamentos": "Apontamentos",
  "Leitura": "OP", "Facas": "Facas", "Afiação": "Afiação", "Clichês": "Aprovação",
  "Central": "Central", "Estoque": "Estoque", "Mural": "Mural", "Pantone": "Pantone",
  "Calculadoras": "Calculadoras", "Arquivos": "Arquivos", "Equipe": "Equipe",
};

/** Atalhos que cada um pode pôr no rodapé da Home. `pagina` vazia = ação
    (Novo pedido); os demais só aparecem para quem tem acesso à página. */
const CATALOGO_ATALHOS: { label: string; icone: string; pagina?: string }[] = [
  { label: "Novo pedido", icone: "mais" },
  { label: "Aprovar arte", icone: "check", pagina: "Aprovação" },
  { label: "Meus pedidos", icone: "caixa", pagina: "Pedidos" },
  { label: "Central", icone: "painel", pagina: "Central" },
  { label: "Painel", icone: "painel", pagina: "Fábrica" },
  { label: "Leitura", icone: "prancheta", pagina: "OP" },
  { label: "Apontamentos", icone: "caixa", pagina: "Apontamentos" },
  { label: "Apontar produção", icone: "prancheta", pagina: "Apontamentos" },
  { label: "Clichês", icone: "camadas", pagina: "Aprovação" },
  { label: "Facas", icone: "camadas", pagina: "Facas" },
  { label: "Afiação", icone: "prancheta", pagina: "Afiação" },
  { label: "Estoque", icone: "caixa", pagina: "Estoque" },
  { label: "Mural", icone: "prancheta", pagina: "Mural" },
  { label: "Pantone", icone: "camadas", pagina: "Pantone" },
  { label: "Calculadoras", icone: "painel", pagina: "Calculadoras" },
  { label: "Arquivos", icone: "caixa", pagina: "Arquivos" },
  { label: "Equipe", icone: "check", pagina: "Equipe" },
];
const MAX_ATALHOS = 6;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DIAS_SEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ENTREGAS_DEMO = [2, 0, 3, 1, 4];

const PAINEL_ESCURO: CSSProperties = { background: INK, boxShadow: "0 30px 70px -30px rgba(0,0,0,.6)" };

const ddmmDeHoje = () => `${String(new Date().getDate()).padStart(2, "0")}/${String(new Date().getMonth() + 1).padStart(2, "0")}`;
/* dia em que o card de lembretes foi dispensado — guardado na máquina, como as
   demais preferências de tela (zoom, som) */
const LEMBRETES_KEY = "r2hub.v1a.lembretes-fechados";

export function HomeV1a({ profile, pedidos = [], versao, aoNavegar, onNova, onLogout, onAbrirPedido, disponiveis, permissoes, comBackend = false, children }: {
  profile: { nome: string; role?: string };
  pedidos?: Pedido[];
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** clique nos "recentes" — sem isso, navega para Pedidos */
  onAbrirPedido?: (id: string) => void;
  /** permissões desta pessoa; ausente = protótipo (mostra todos os painéis) */
  permissoes?: string[];
  /** true no app real: lista vazia é resposta VÁLIDA (quem não tem pedido vê
      zero), nunca motivo para exibir os números de demonstração */
  comBackend?: boolean;
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
}) {
  /* Papéis que ESTA pessoa pode ver no painel — o protótipo deixava qualquer
     um "virar gestor"; aqui cada papel exige a permissão da área. Sem a lista
     de permissões (preview) continuam todos, como no protótipo. */
  const papeisLiberados = PAPEIS.filter((p) => {
    if (!permissoes) return true;
    const exige = PERM_DO_PAPEL[p.k];
    return !exige || permissoes.includes(exige);
  });
  const papelDoCargo = PAPEL_DO_CARGO[profile.role ?? ""] ?? "designer";
  const papelInicial = papeisLiberados.some((p) => p.k === papelDoCargo)
    ? papelDoCargo
    : (papeisLiberados[0]?.k ?? "designer");
  const [papel, setPapel] = useState(papelInicial);
  const [feitos, setFeitos] = useState<Record<string, boolean[]>>({});
  const [busca, setBusca] = useState("");
  const [dia, setDia] = useState(() => new Date().getDate());
  const [agenda, setAgenda] = useState<Record<number, string[]>>({});
  const [agendaNovo, setAgendaNovo] = useState("");
  const dadosHub = useHubDados();
  /** com papel de parede a saudação precisa de contraste próprio */
  const comPapel = !!dadosHub.papelParede;
  /* Largura de projeto em uso (1920 no monitor grande; ~1440 no pequeno, onde
     o palco estreita para o texto sair legível). Os blocos da Home são
     posicionados por coordenada, então precisam se acomodar. */
  const palcoW = usePalcoLargura();
  const areaW = palcoW - 44 - 76 - 12; // padding do palco + rail + gap
  const estreito = areaW < 1500;
  /* a saudação vai até onde o painel escuro (436) e o respiro permitem */
  const larguraSaudacao = Math.max(360, Math.min(900, areaW - 436 - 60));
  const corpoSaudacao = estreito ? 76 : 106;
  const notasReais = Array.isArray(dadosHub.notas);
  const [notasDemo, setNotasDemo] = useState<{ id?: string; texto: string; feito: boolean }[]>([
    { texto: "Ligar para o Bom Preço confirmando a tiragem do lote novo", feito: false },
    { texto: "Cobrar retorno do clichê da Cervejaria Ilha Grande", feito: false },
  ]);
  // Mesma lista de anotações da Central e do modal do topo.
  const notas = notasReais
    ? dadosHub.notas!.map((n) => ({ id: n.id, texto: n.texto, feito: n.feito }))
    : notasDemo;
  /* O card de lembretes cobre a saudação e voltava a cada visita à Home: era
     `useState(false)`, então fechar valia só até sair da tela. Agora o fechar
     dura o DIA — guarda a data de hoje e só reaparece amanhã, que é quando um
     lembrete diário volta a ter o que dizer. */
  const [lembretesFechados, setLembretesFechados] = useState(() => {
    try { return localStorage.getItem(LEMBRETES_KEY) === ddmmDeHoje(); } catch { return false; }
  });
  function fecharLembretes() {
    setLembretesFechados(true);
    try { localStorage.setItem(LEMBRETES_KEY, ddmmDeHoje()); } catch { /* storage bloqueado */ }
  }
  const [aviso, setAviso] = useState("");
  const [editandoAtalhos, setEditandoAtalhos] = useState(false);
  const [atalhosDemo, setAtalhosDemo] = useState<string[] | null>(null);
  const [rascunho, setRascunho] = useState<string[]>([]);
  const papeisRef = useRef<HTMLDivElement>(null);
  const rolarPapeis = (dir: number) => papeisRef.current?.scrollBy({ left: dir * 150, behavior: "smooth" });

  const d = DADOS[papel] ?? DADOS.designer;

  const primeiroNome = (profile.nome || "").split(" ")[0] || "—";
  const hora = new Date().getHours();
  const turno = hora < 12 ? "Tenha um bom dia, contamos com você, sempre!"
    : hora < 18 ? "Tenha uma boa tarde, contamos com você, sempre!"
    : "Tenha uma boa noite, contamos com você, sempre!";

  /* semana útil corrente (seg–sex) */
  const semana = useMemo(() => {
    const agora = new Date();
    const seg = new Date(agora);
    seg.setDate(agora.getDate() - ((agora.getDay() + 6) % 7));
    // Entregas do dia = prazo dos pedidos em aberto (ou 7 dias após a abertura,
    // regra usada na Central). Sem pedidos, cai nos números do protótipo.
    const abertos = (pedidos ?? []).filter((p: any) => !["concluido", "cancelado"].includes(p.status));
    const prazoDe = (p: any) => new Date(p.prazo ? p.prazo : new Date(p.created_at).getTime() + 7 * 86_400_000);
    return Array.from({ length: 5 }, (_, i) => {
      const data = new Date(seg);
      data.setDate(seg.getDate() + i);
      const entregas = abertos.filter((p: any) => {
        const d = prazoDe(p);
        return d.getDate() === data.getDate() && d.getMonth() === data.getMonth() && d.getFullYear() === data.getFullYear();
      }).length;
      return {
        diaSem: DIAS_SEM[data.getDay()],
        num: data.getDate(),
        mes: data.getMonth(),
        entregas: comBackend || pedidos?.length ? entregas : ENTREGAS_DEMO[i],
      };
    });
  }, [pedidos]);
  const faixaSemana = `${semana[0].num} a ${semana[4].num} de ${MESES[semana[4].mes]}`;
  const hojeDDMM = ddmmDeHoje();

  const recentes = useMemo(() => {
    const DIA_MS = 86_400_000;
    return [...pedidos]
      .sort((a, b) => (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || ""))
      .slice(0, 2)
      .map((p) => {
        const dias = Math.round((Date.now() - new Date(p.updated_at || p.created_at || Date.now()).getTime()) / DIA_MS);
        return {
          id: p.id as string,
          num: "#" + String(p.numero).padStart(4, "0"),
          cliente: p.cliente,
          status: APP_PARA_V1A[p.status] || "Aguardando Design",
          quando: dias <= 0 ? "hoje" : `há ${dias}d`,
        };
      });
  }, [pedidos]);

  /* ————— painel do papel: números e tarefas REAIS ————— */
  /* Sem `pedidos` do back-end (preview do protótipo) tudo isto fica indefinido
     e o painel cai nos dados de demonstração de sempre. */
  const real = comBackend || pedidos.length > 0 || Array.isArray(dadosHub.notas);
  const meuId = dadosHub.meuId;
  const contas = useMemo(() => {
    const mes = new Date(); mes.setDate(1); mes.setHours(0, 0, 0, 0);
    const noMes = (p: Pedido) => new Date(p.updated_at || p.created_at || 0) >= mes;
    const st = (s: string) => pedidos.filter((p) => p.status === s);
    const meus = pedidos.filter((p) => !meuId || (p as any).vendedor_id === meuId);
    return {
      aprovadasMes: pedidos.filter((p) => ["aprovada", "cliche", "concluido"].includes(p.status) && noMes(p)).length,
      naClicheria: st("cliche").length,
      concluidosMes: pedidos.filter((p) => p.status === "concluido" && noMes(p)).length,
      emAberto: pedidos.filter((p) => !["concluido", "cancelado"].includes(p.status)).length,
      meusAbertos: meus.filter((p) => !["concluido", "cancelado"].includes(p.status)).length,
      comCliente: st("aguardando").length,
      aguardandoDesign: st("nova").length,
      emCriacao: st("criacao").length,
      emRevisao: st("revisao").length,
      aprovadas: st("aprovada").length,
    };
  }, [pedidos, meuId]);

  /** Números do painel por papel — só contas que o sistema sabe responder. */
  const numerosReais: Record<string, Numero[]> = {
    gestor: [
      { valor: String(contas.emAberto), label: "Em aberto", tema: "amarelo" },
      { valor: String(contas.naClicheria), label: "Na clicheria", tema: "vidro" },
      { valor: String(contas.concluidosMes), label: "Fechados no mês", tema: "vidro" },
    ],
    vendedora: [
      { valor: String(contas.meusAbertos), label: "Meus em aberto", tema: "amarelo" },
      { valor: String(contas.comCliente), label: "Com o cliente", tema: "vidro" },
      { valor: String(contas.aprovadasMes), label: "Aprovadas no mês", tema: "vidro" },
    ],
    designer: [
      { valor: String(contas.aguardandoDesign), label: "Na fila", tema: "amarelo" },
      { valor: String(contas.emCriacao + contas.emRevisao), label: "Em design", tema: "vidro" },
      { valor: String(contas.concluidosMes), label: "Fechadas no mês", tema: "vidro" },
    ],
    producao: [
      { valor: String(contas.aprovadas + contas.naClicheria), label: "Prontos p/ rodar", tema: "amarelo" },
      { valor: String(contas.emAberto), label: "Em aberto", tema: "vidro" },
      { valor: String(contas.concluidosMes), label: "Fechados no mês", tema: "vidro" },
    ],
    clicheria: [
      { valor: String(contas.naClicheria), label: "Na clicheria", tema: "amarelo" },
      { valor: String(contas.aprovadas), label: "Aguardando envio", tema: "vidro" },
      { valor: String(contas.concluidosMes), label: "Fechados no mês", tema: "vidro" },
    ],
  };

  /** Tarefas do dia = o que está esperando ESTA pessoa, mais as anotações. */
  const tarefasReais: Tarefa[] = useMemo(() => {
    const t: Tarefa[] = [];
    const push = (texto: string, tag: string) => { if (t.length < 4) t.push({ texto, tag }); };
    if (papel === "designer") {
      if (contas.aguardandoDesign) push(`${contas.aguardandoDesign} ${contas.aguardandoDesign === 1 ? "pedido novo esperando" : "pedidos novos esperando"} para assumir`, "fila");
      if (contas.emRevisao) push(`${contas.emRevisao} ${contas.emRevisao === 1 ? "arte voltou" : "artes voltaram"} para revisão`, "urgente");
      if (contas.emCriacao) push(`${contas.emCriacao} em criação para fechar`, "hoje");
    } else if (papel === "vendedora") {
      if (contas.comCliente) push(`${contas.comCliente} ${contas.comCliente === 1 ? "arte aguarda" : "artes aguardam"} resposta do cliente`, "cobrar");
      if (contas.aprovadas) push(`${contas.aprovadas} ${contas.aprovadas === 1 ? "aprovada" : "aprovadas"} para seguir com o clichê`, "hoje");
      if (contas.aguardandoDesign) push(`${contas.aguardandoDesign} na fila do design`, "acompanhar");
    } else if (papel === "clicheria") {
      if (contas.naClicheria) push(`${contas.naClicheria} ${contas.naClicheria === 1 ? "clichê" : "clichês"} na clicheria para registrar a chegada`, "hoje");
      if (contas.aprovadas) push(`${contas.aprovadas} ${contas.aprovadas === 1 ? "arte aprovada" : "artes aprovadas"} para solicitar clichê`, "fila");
    } else if (papel === "producao") {
      if (contas.aprovadas + contas.naClicheria) push(`${contas.aprovadas + contas.naClicheria} prontos para entrar na máquina`, "fila");
      if (contas.emAberto) push(`${contas.emAberto} pedidos em aberto no sistema`, "acompanhar");
    } else {
      if (contas.emRevisao) push(`${contas.emRevisao} em revisão`, "atenção");
      if (contas.naClicheria) push(`${contas.naClicheria} na clicheria`, "acompanhar");
      if (contas.aguardandoDesign) push(`${contas.aguardandoDesign} esperando o design`, "fila");
    }
    // as anotações da pessoa entram como tarefa, com o mesmo toque de concluir
    notas.filter((n) => !n.feito).forEach((n) => push(n.texto, "anotação"));
    if (!t.length) push("Nada esperando por você agora.", "livre");
    return t;
  }, [papel, contas, notas]);

  const lembretesPend = notas.filter((n) => !n.feito);

  /* o que o painel mostra de fato */
  const numeros = real ? (numerosReais[papel] ?? numerosReais.designer) : d.numeros;
  const tarefas = real ? tarefasReais : d.tarefas;
  const marcados = feitos[papel] || tarefas.map((t) => !!t.feito);
  const abertas = marcados.filter((f) => !f).length;

  function alternarTarefa(i: number) {
    const t = tarefas[i];
    // tarefa vinda de anotação: concluir de verdade, na lista compartilhada
    const nota = notas.find((n) => !n.feito && n.texto === t.texto);
    if (real && nota?.id) {
      dadosHub.aoAlternarNota?.(nota.id, true);
      setAviso("Anotação concluída.");
      return;
    }
    const atual = feitos[papel] || tarefas.map((x) => !!x.feito);
    setFeitos({ ...feitos, [papel]: atual.map((f, j) => (j === i ? !f : f)) });
  }

  /* A agenda agora é a MESMA anotação-com-dia da Central e do modal do topo
     (user_notas, coluna `quando` "dd/mm"): antes vivia num estado local que
     evaporava ao trocar de tela — com aviso de "adicionado" e tudo. */
  const qDia = (s: { num: number; mes: number }) => `${String(s.num).padStart(2, "0")}/${String(s.mes + 1).padStart(2, "0")}`;

  function addAgenda() {
    const texto = agendaNovo.trim();
    if (!texto) return;
    const quando = qDia(diaSel);
    if (notasReais && dadosHub.aoCriarNota) {
      setAgendaNovo("");
      Promise.resolve(dadosHub.aoCriarNota(texto, quando))
        .then(() => setAviso(`Adicionado à agenda de ${quando}.`))
        .catch((e: unknown) => { setAgendaNovo(texto); setAviso(e instanceof Error ? e.message : "Não deu para salvar na agenda."); });
      return;
    }
    setAgenda({ ...agenda, [dia]: [...(agenda[dia] || []), texto] });
    setAgendaNovo("");
    setAviso(`Adicionado à agenda de ${quando}.`);
  }

  function removerAgenda(item: { id?: string; idx: number }) {
    if (notasReais && dadosHub.aoExcluirNota && item.id) {
      Promise.resolve(dadosHub.aoExcluirNota(item.id))
        .then(() => setAviso("Item removido da agenda."))
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para remover."));
      return;
    }
    setAgenda({ ...agenda, [dia]: (agenda[dia] || []).filter((_, j) => j !== item.idx) });
    setAviso("Item removido da agenda.");
  }

  function irAtalho(label: string) {
    if (label === "Novo pedido") { onNova?.(); return; }
    if (label === "Mensagens") return;
    const destino = ATALHO_PAGS[label];
    if (destino) aoNavegar?.(destino);
  }

  const diaSel = semana.find((s) => s.num === dia) || semana[0];
  const itensDia: { id?: string; texto: string }[] = notasReais
    ? dadosHub.notas!.filter((n) => !n.feito && n.quando === qDia(diaSel)).map((n) => ({ id: n.id, texto: n.texto }))
    : (agenda[dia] || []).map((texto) => ({ texto }));

  /* ————— atalhos do rodapé: cada um monta os seus ————— */
  /** só entra no catálogo o que a pessoa pode abrir de fato — inclusive o
      "Novo pedido", que depende de pedidos.criar como o "+" do rail */
  const catalogo = CATALOGO_ATALHOS.filter((a) => !disponiveis || disponiveis.includes(a.pagina ?? a.label));
  const escolhidos = (atalhosDemo ?? dadosHub.atalhos ?? []).filter((l) => catalogo.some((c) => c.label === l));
  const atalhos = (escolhidos.length
    ? escolhidos.map((l) => ({ label: l, icone: catalogo.find((c) => c.label === l)!.icone }))
    : d.atalhos.filter((a) => catalogo.some((c) => c.label === a.label) || !CATALOGO_ATALHOS.some((c) => c.label === a.label))
      .map((a) => ({ label: a.label, icone: a.icone })))
    // o primeiro é o amarelo, como no protótipo
    .map((a, i) => ({ ...a, tema: i === 0 ? "amarelo" : "vidro" }));

  /* Espaço da faixa de atalhos: os 6 cartões quando cabe (a agenda fica com
     pelo menos 700), senão só o que está em uso. */
  const larguraCartoes = (n: number) => n * 176 + (n - 1) * 10;
  const larguraAtalhos = areaW - larguraCartoes(MAX_ATALHOS) - 12 >= 700
    ? larguraCartoes(MAX_ATALHOS)
    : larguraCartoes(Math.max(1, atalhos.length));

  function abrirEdicaoAtalhos() {
    setRascunho(atalhos.map((a) => a.label).filter((l) => catalogo.some((c) => c.label === l)));
    setEditandoAtalhos(true);
  }
  function alternarRascunho(label: string) {
    if (rascunho.includes(label)) { setRascunho(rascunho.filter((l) => l !== label)); return; }
    if (rascunho.length >= MAX_ATALHOS) { setAviso(`São até ${MAX_ATALHOS} atalhos.`); return; }
    setRascunho([...rascunho, label]);
  }
  function salvarAtalhos() {
    if (!rascunho.length) { setAviso("Escolha pelo menos um atalho."); return; }
    setEditandoAtalhos(false);
    if (dadosHub.aoSalvarAtalhos) {
      dadosHub.aoSalvarAtalhos(rascunho)
        .then(() => setAviso("Atalhos atualizados."))
        .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para salvar os atalhos."));
    } else {
      setAtalhosDemo(rascunho);
      setAviso("Atalhos atualizados.");
    }
  }

  return (
    <EstagioV1a comPapel>
      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}

      {/* lembretes — anotações de hoje. Em palco estreito ele desce para o
          vazio abaixo da saudação: ao lado do painel escuro cobriria o "Olá". */}
      {!lembretesFechados && lembretesPend.length > 0 && (
        <div style={{ position: "absolute", zIndex: 75, width: 360, background: INK, borderRadius: 14, padding: "18px 20px 16px", boxShadow: "0 34px 70px -26px rgba(0,0,0,.6)", ...(estreito ? { left: 24, top: 300 } : { right: 474, top: 96 }) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: AMARELO }} />
            <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: AMARELO }}>Anotações de hoje</span>
            <span style={{ flex: 1 }} />
            <span style={{ font: "500 13px/1 Inter,sans-serif", color: "#8d8b8d" }}>{hojeDDMM} · {lembretesPend.length} {lembretesPend.length === 1 ? "lembrete" : "lembretes"}</span>
            <button onClick={() => setLembretesFechados(true)} className="r2ic" style={{ width: 26, height: 26, display: "grid", placeItems: "center", background: "#3a383a", border: 0, borderRadius: 999, cursor: "pointer" }}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.8} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lembretesPend.map((n) => (
              <button key={n.texto}
                onClick={() => {
                  if (notasReais) dadosHub.aoAlternarNota?.(n.id!, true);
                  else setNotasDemo(notasDemo.map((x) => x.texto === n.texto ? { ...x, feito: true } : x));
                  setAviso("Anotação concluída.");
                }}
                style={{ display: "flex", alignItems: "flex-start", gap: 11, width: "100%", textAlign: "left", background: "#2f2d2f", border: 0, borderLeft: `3px solid ${AMARELO}`, borderRadius: 7, padding: "12px 13px", cursor: "pointer" }}>
                <span style={{ flex: "none", width: 18, height: 18, marginTop: 1, display: "grid", placeItems: "center", borderRadius: 4, background: "#454345" }}>
                  <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                </span>
                <span style={{ flex: 1, minWidth: 0, font: "500 14.5px/1.35 Inter,sans-serif", color: "#f1f1f1" }}>{n.texto}</span>
                <span style={{ flex: "none", font: `600 12.5px/1 ${MONO}`, color: "#8d8b8d", marginTop: 2 }}>{hojeDDMM}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <button onClick={() => setAviso("Anotações: modal em breve.")} className="r2chip" style={{ flex: 1, border: 0, borderRadius: 7, padding: "11px 14px", cursor: "pointer", font: "700 13px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: AMARELO, color: INK }}>Ver todas</button>
            <span style={{ font: "400 13px/1 Inter,sans-serif", color: "#8d8b8d" }}>clique para concluir</span>
          </div>
        </div>
      )}

      <TopbarV1a nome={profile.nome} busca={busca} aoBuscar={setBusca}
        onMensagens={() => {}} onAnotacoes={() => {}} onNotificacoes={() => {}} onConfig={() => {}} onSair={() => onLogout?.()} />

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
        <RailV1a ativo="Home" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", position: "relative", minHeight: 0, borderRadius: 12, background: "transparent" }}>

          {/* saudação — com papel de parede o texto vira branco com sombra,
              senão ficaria escuro sobre imagem escura */}
          {/* a saudação encolhe junto com o palco — em 1440 o corpo de 106 e a
              caixa de 900 entravam embaixo do painel escuro */}
          <div style={{ position: "absolute", left: 24, top: 0, width: larguraSaudacao }}>
            <h1 style={{ ...fr(120, 900), fontSize: corpoSaudacao, lineHeight: .96, letterSpacing: "-.025em", textIndent: "-.045em", color: comPapel ? "#fff" : INK, textShadow: comPapel ? "0 2px 24px rgba(0,0,0,.55)" : undefined, margin: "0 0 12px" }}>Olá, {primeiroNome}</h1>
            <div style={{ font: `400 ${estreito ? 19 : 22}px/1.4 Inter,sans-serif`, color: comPapel ? "rgba(255,255,255,.92)" : "#5c5a5c", textShadow: comPapel ? "0 1px 16px rgba(0,0,0,.6)" : undefined }}>{turno}</div>
          </div>

          {/* painel direito */}
          {/* encostado à direita: em telas mais largas que 1920 o palco estica,
              e o card preso a uma coluna fixa deixava um vazio na lateral */}
          <div style={{ position: "absolute", right: 0, top: -2, width: 436, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden", padding: "26px 24px 24px", borderRadius: 11, ...PAINEL_ESCURO }}>
            {/* os cinco papéis não cabem na largura do card: em vez de quebrar
                a linha (ou sumir no corte), a faixa rola com as setinhas */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => rolarPapeis(-1)} title="Ver anteriores" className="r2ic"
                style={{ flex: "none", width: 22, height: 22, display: "grid", placeItems: "center", background: "rgba(255,255,255,.1)", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>
              </button>
              <div ref={papeisRef} className="r2scroll-x" style={{ flex: 1, minWidth: 0, display: "flex", gap: 6 }}>
                {papeisLiberados.map((p) => (
                  <button key={p.k} onClick={() => setPapel(p.k)}
                    style={{ flex: "none", border: 0, cursor: "pointer", borderRadius: 999, padding: "8px 12px", font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", whiteSpace: "nowrap", background: papel === p.k ? AMARELO : "rgba(255,255,255,.1)", color: papel === p.k ? INK : "#b3b1b3" }}>
                    {p.label}
                  </button>
                ))}
              </div>
              <button onClick={() => rolarPapeis(1)} title="Ver próximos" className="r2ic"
                style={{ flex: "none", width: 22, height: 22, display: "grid", placeItems: "center", background: "rgba(255,255,255,.1)", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {numeros.map((n) => {
                const amarelo = n.tema === "amarelo";
                return (
                  <div key={n.label} style={{ flex: 1, minWidth: 0, borderRadius: 8, padding: "12px 14px 10px", background: amarelo ? AMARELO : "rgba(255,255,255,.08)" }}>
                    <div style={{ font: "800 26px/1 Inter,sans-serif", letterSpacing: "-.03em", color: amarelo ? INK : "#f1f1f1" }}>{n.valor}</div>
                    <div style={{ font: "600 12.5px/1.2 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", marginTop: 8, color: amarelo ? "#5c5a5c" : "#8d8b8d" }}>{n.label}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, paddingTop: 12 }}>
                <span style={{ font: "800 15px/1 Inter,sans-serif", color: "#f1f1f1", letterSpacing: "-.01em" }}>Minhas tarefas de hoje</span>
                <span style={{ font: "800 12.5px/1 Inter,sans-serif", color: INK, background: AMARELO, padding: "5px 7px", borderRadius: 999 }}>{abertas}</span>
              </div>
              <span style={{ font: "400 12.5px/1 Inter,sans-serif", color: "#8d8b8d", paddingTop: 12 }}>clique para concluir</span>
            </div>

            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {tarefas.map((t, i) => {
                const feito = marcados[i];
                const urgente = t.tag === "urgente" && !feito;
                return (
                  <button key={t.texto} onClick={() => alternarTarefa(i)} className="r2rowd"
                    style={{ flex: 1, display: "flex", alignItems: "center", gap: 11, width: "100%", minHeight: 44, textAlign: "left", background: "transparent", border: 0, borderRadius: 5, padding: "6px 6px 6px 2px", cursor: "pointer", borderBottom: i === tarefas.length - 1 ? 0 : "1px solid rgba(255,255,255,.08)" }}>
                    <span style={{ flex: "0 0 21px", height: 21, display: "grid", placeItems: "center", borderRadius: 4, background: feito ? AMARELO : "rgba(255,255,255,.12)" }}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={feito ? INK : "rgba(255,255,255,.35)"} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, font: "500 15px/1.35 Inter,sans-serif", color: feito ? "#8d8b8d" : "#f1f1f1", textDecoration: feito ? "line-through" : undefined }}>{t.texto}</span>
                    <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "6px 8px 4px", borderRadius: 999, background: urgente ? AMARELO : "rgba(255,255,255,.1)", color: urgente ? INK : "#8d8b8d" }}>{feito ? "concluída" : t.tag}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.1)" }}>
              <span style={{ font: "600 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d" }}>recentes</span>
              <button onClick={() => aoNavegar?.("Pedidos")} style={{ border: 0, background: "transparent", cursor: "pointer", font: "400 13.5px/1 Inter,sans-serif", color: AMARELO, padding: 0 }}>ver todos</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: -8 }}>
              {recentes.map((p) => {
                const s = STATUS_HOME[p.status] || STATUS_HOME["Aguardando Design"];
                return (
                  <div key={p.num} className="r2rowd" onClick={() => (onAbrirPedido ? onAbrirPedido(p.id) : aoNavegar?.("Pedidos"))}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px 8px 0", cursor: "pointer", borderRadius: 5 }}>
                    <span style={{ flex: "0 0 3px", height: 20, borderRadius: 1, background: s.orelha }} />
                    <span style={{ flex: 1, minWidth: 0, font: "500 14.5px/1.2 Inter,sans-serif", color: "#f1f1f1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente}</span>
                    <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".03em", textTransform: "uppercase", whiteSpace: "nowrap", padding: "6px 7px 4px", borderRadius: 999, background: s.bg, color: s.fg }}>{p.status}</span>
                    <span style={{ font: "400 12.5px/1 Inter,sans-serif", color: "#8d8b8d", whiteSpace: "nowrap" }}>{p.quando}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* rodapé — agenda + atalhos */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "stretch" }}>
            {/* o painel acompanha a largura da janela, mas os cartões de dia
                param de crescer em 280px e se espalham — esticados até o fim
                davam impressão de desleixo */}
            <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 12, padding: "18px 20px 16px", borderRadius: 11, ...PAINEL_ESCURO }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ font: "800 15px/1 Inter,sans-serif", color: "#f1f1f1", letterSpacing: "-.01em" }}>Agenda da semana</span>
                <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{faixaSemana}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,280px))", justifyContent: "space-between", gap: 8 }}>
                {semana.map((s) => {
                  const on = dia === s.num;
                  return (
                    <button key={s.num} onClick={() => setDia(s.num)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 7, textAlign: "left", border: 0, cursor: "pointer", borderRadius: 7, padding: "12px 12px 10px", background: on ? AMARELO : "rgba(255,255,255,.08)" }}>
                      <span style={{ font: "700 12.5px/1 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: on ? "#5c5a5c" : "#8d8b8d" }}>{s.diaSem}</span>
                      <span style={{ font: "800 22px/1 Inter,sans-serif", letterSpacing: "-.03em", color: on ? INK : "#f1f1f1" }}>{s.num}</span>
                      <span style={{ font: "500 12.5px/1 Inter,sans-serif", color: on ? "#5c5a5c" : s.entregas ? "#b3b1b3" : "#5c5a5c" }}>
                        {s.entregas ? `${s.entregas} ${s.entregas === 1 ? "entrega" : "entregas"}` : "livre"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: "none", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#8d8b8d", whiteSpace: "nowrap" }}>
                  {diaSel.diaSem} {String(diaSel.num).padStart(2, "0")}/{String(diaSel.mes + 1).padStart(2, "0")}
                </span>
                <input value={agendaNovo} onChange={(e) => setAgendaNovo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addAgenda(); }}
                  placeholder="Adicionar à agenda deste dia"
                  style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,.08)", border: "2px solid rgba(255,255,255,.12)", borderRadius: 7, padding: "10px 12px", font: "500 14.5px/1 Inter,sans-serif", color: "#f1f1f1", outline: "none" }} />
                <button onClick={addAgenda} className="r2chip"
                  style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, border: 0, borderRadius: 7, padding: "10px 13px", cursor: agendaNovo.trim() ? "pointer" : "not-allowed", font: "700 13px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: AMARELO, color: INK, opacity: agendaNovo.trim() ? 1 : 0.45 }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
                  Anotar
                </button>
              </div>
              {itensDia.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {itensDia.map((item, i) => (
                    <button key={(item.id ?? item.texto) + i} title="Remover" className="r2chip"
                      onClick={() => removerAgenda({ id: item.id, idx: i })}
                      style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "100%", border: 0, borderRadius: 999, padding: "7px 11px", cursor: "pointer", background: AMARELO, color: INK, font: "600 13px/1 Inter,sans-serif" }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.texto}</span>
                      <span style={{ flex: "none", font: "700 13px/1 Inter,sans-serif" }}>×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* A faixa dos atalhos reserva o espaço dos 6 cartões para a agenda
                ao lado não mudar de tamanho quando alguém troca os próprios
                atalhos — MAS só enquanto sobrar largura para a agenda (em palco
                estreito a reserva espremia a agenda em ~190px). */}
            <div style={{ flex: "none", position: "relative", width: larguraAtalhos, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={abrirEdicaoAtalhos} title="Escolher meus atalhos" className="r2ic"
                style={{ position: "absolute", right: 0, top: -34, display: "flex", alignItems: "center", gap: 6, background: "rgba(37,36,37,.9)", border: 0, borderRadius: 999, padding: "7px 11px", cursor: "pointer", font: "700 11.5px/1 Inter,sans-serif", letterSpacing: ".08em", textTransform: "uppercase", color: "#b3b1b3" }}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 16.5 16.5 3l4.5 4.5L7.5 21z" /><path d="M7.5 8.5 10 11" /></svg>
                Meus atalhos
              </button>

              {editandoAtalhos && (
                <div style={{ position: "absolute", right: 0, bottom: "100%", marginBottom: 12, zIndex: 80, width: 470, background: INK, borderRadius: 12, padding: "18px 20px 16px", boxShadow: "0 34px 70px -26px rgba(0,0,0,.6)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ font: "800 15px/1 Inter,sans-serif", color: "#f1f1f1" }}>Meus atalhos</span>
                    <span style={{ flex: 1 }} />
                    <span style={{ font: "500 12.5px/1 Inter,sans-serif", color: "#8d8b8d" }}>{rascunho.length} de {MAX_ATALHOS}</span>
                    <button onClick={() => setEditandoAtalhos(false)} className="r2ic" style={{ width: 24, height: 24, display: "grid", placeItems: "center", background: "#3a383a", border: 0, borderRadius: 999, cursor: "pointer" }}>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={3} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {catalogo.map((c) => {
                      const on = rascunho.includes(c.label);
                      const pos = rascunho.indexOf(c.label) + 1;
                      return (
                        <button key={c.label} onClick={() => alternarRascunho(c.label)} className="r2chip"
                          style={{ display: "flex", alignItems: "center", gap: 7, border: 0, borderRadius: 999, padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap", font: "600 13px/1 Inter,sans-serif", background: on ? AMARELO : "rgba(255,255,255,.1)", color: on ? INK : "#b3b1b3" }}>
                          {on && <span style={{ font: `700 11px/1 ${MONO}`, opacity: .65 }}>{pos}</span>}
                          {nomeDaPagina(c.label)}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
                    <button onClick={salvarAtalhos} className="r2chip" style={{ flex: 1, border: 0, borderRadius: 7, padding: "11px 14px", cursor: "pointer", font: "700 13px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: AMARELO, color: INK }}>Salvar</button>
                    <button onClick={() => { setRascunho([]); if (dadosHub.aoSalvarAtalhos) { dadosHub.aoSalvarAtalhos([]).then(() => { setEditandoAtalhos(false); setAviso("Voltou para os atalhos sugeridos."); }); } else { setAtalhosDemo(null); setEditandoAtalhos(false); setAviso("Voltou para os atalhos sugeridos."); } }}
                      style={{ flex: "none", background: "transparent", border: 0, cursor: "pointer", font: "500 13px/1 Inter,sans-serif", color: "#8d8b8d" }}>usar os sugeridos</button>
                  </div>
                </div>
              )}

              {atalhos.map((a) => {
                const amarelo = a.tema === "amarelo";
                return (
                  <button key={a.label} onClick={() => irAtalho(a.label)} className="r2tile"
                    style={{ flex: "none", width: 176, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "space-between", gap: 12, textAlign: "left", border: 0, cursor: "pointer", borderRadius: 11, padding: "18px 18px 16px", background: amarelo ? AMARELO : INK, boxShadow: "0 30px 70px -30px rgba(0,0,0,.6)" }}>
                    <span style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 6, background: amarelo ? "rgba(37,36,37,.12)" : "rgba(255,255,255,.1)" }}>
                      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={amarelo ? INK : AMARELO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                        {(ICONES[a.icone] || []).map((p, i) => <path key={i} d={p} />)}
                      </svg>
                    </span>
                    <span style={{ font: "700 15px/1.2 Inter,sans-serif", letterSpacing: "-.01em", color: amarelo ? INK : "#f1f1f1" }}>{nomeDaPagina(a.label)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {children}
    </EstagioV1a>
  );
}
