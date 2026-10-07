// Os roteiros da apresentação do hub (ApresentacaoHub10): um por papel, mais
// as novidades. Mudar texto ou ordem é aqui, sem mexer nas telas.
//
// Combinado com o Augusto (06/10/2026): tour nas telas reais; nos passos
// principais a pessoa faz o gesto de verdade ("faça você"); um roteiro por
// papel; aparece no primeiro acesso e nas novidades. Nada grava: o que
// criaria ou mudaria um pedido só é mostrado.
//
// O alvo de cada passo é achado na tela pelo seletor (e pelo texto, quando o
// seletor sozinho não basta). Se o alvo não aparecer (a pessoa não tem acesso
// àquela página, o quadro dela está vazio), o passo é pulado sem aviso.

/** O que fica aceso. `texto`: o texto exato do elemento; `textos`: vários,
    cada um com o seu furo (os itens do menu, que têm outros no meio);
    `contem`: o elemento que tem esse texto dentro; `todos`: todos os que
    casam, num furo só (os cartões lado a lado). */
export type Alvo = { sel: string; texto?: string; textos?: string[]; contem?: string; todos?: boolean };

/** Quando o "faça você" terminou: a tela mudou para esta, apareceu este
    texto, ou sumiu este texto. */
export type Espera = { tela?: string; texto?: string; semTexto?: string };

export type Passo = {
  id: string;
  /** o nome curto, na lista das boas-vindas */
  curto?: string;
  /** a tela onde o passo acontece: nos passos de "Próximo", o tour leva até lá */
  tela?: string;
  /** o passo só entra no roteiro da pessoa se isto estiver na tela quando a
      apresentação começa (o + some para quem não cria pedido; o menu só tem
      as páginas que ela vê) */
  soSe?: Alvo;
  /** o passo só acontece se isto estiver na tela na hora dele (o pedido
      aberto, que não abre se a pessoa pulou o clique no cartão) */
  precisa?: Alvo;
  alvo?: Alvo;
  titulo: string;
  texto: string;
  /** faça você: segue quando isto valer (pelo clique, pelo Enter ou pelo ESC) */
  faca?: Espera;
  /** faça você: o gesto, na faixa amarela do cartão ("Sua vez: clique no +") */
  acao?: string;
  /** neste passo o ESC é da tela, não do tour (o ESC que fecha o pedido) */
  escPassa?: boolean;
  /** antes de acender o alvo (o cartão da capa que está fora da janela) */
  antes?: "rolar-trilha-fim" | "rolar-trilha-inicio";
  /** a folga do furo em volta do alvo */
  folga?: number;
};

export type Novidade = {
  id: string;
  /** quando entrou no hub (AAAA-MM-DD) */
  data: string;
  /** o último dia em que ela aparece (depois disso, a mudança já não é novidade) */
  ate: string;
  /** a tela onde ela aparece, na primeira visita */
  tela: string;
  passos: Passo[];
};

/** O que a pessoa já viu, guardado no servidor: `principal` vazio = nunca
    viu a apresentação; senão "vista", "pulada" ou "adiada", com a data. */
export type EstadoApresentacao = { principal: string; novidades: string[] };

/* os itens do menu: folga 8, que no menu da administração (10 itens) a de 12
   encostava nos vizinhos */
const MENU = "nav a.h10-navi";
const MAIS: Alvo = { sel: 'button[aria-label="Novo pedido"]' };
const NO_MENU = (texto: string): Alvo => ({ sel: MENU, texto });
/* o pedido aberto: os painéis ao lado do cartão */
const PEDIDO_ABERTO: Alvo = { sel: ".pdv4-painel" };

const HOME: Passo = {
  id: "home", curto: "A Home", tela: "home", alvo: { sel: "button[data-home-pilula]", todos: true }, folga: 14,
  titulo: "Seu dia começa na Home",
  texto: "Aqui embaixo ficam a agenda, o calendário, o chat, as sugestões, os tutoriais e o resumo do que você fez.",
};

const menuPedidos = (texto: string): Passo => ({
  id: "menu-pedidos", curto: "Pedidos", soSe: NO_MENU("PEDIDOS"), alvo: NO_MENU("PEDIDOS"), folga: 8,
  /* "as solicitações ficam em pedidos" (Augusto, 06/10/2026) */
  titulo: "As solicitações ficam em PEDIDOS", texto, faca: { tela: "pedidos10" }, acao: "clique em PEDIDOS",
});

const FECHAR_PEDIDO: Passo = {
  id: "fechar", tela: "pedidos10", soSe: NO_MENU("PEDIDOS"), precisa: PEDIDO_ABERTO, alvo: { sel: 'button[aria-label="Fechar"]' }, folga: 8,
  titulo: "O ✕ fecha o pedido",
  texto: "O ESC também fecha. Clique no ✕ para voltar à área de Pedidos.",
  faca: { semTexto: "Especificações" }, escPassa: true, acao: "clique no ✕ ou aperte ESC",
};

const SINO: Passo = {
  id: "sino", curto: "Os avisos", alvo: { sel: 'button[aria-label="Notificações"]' }, folga: 10,
  titulo: "O sino avisa",
  texto: "Arte enviada, pedido que mudou de etapa, pergunta respondida: o aviso aparece aqui e leva direto ao pedido.",
};

const VENDAS: Passo[] = [
  HOME,
  {
    id: "mais", curto: "Novo pedido", tela: "home", soSe: MAIS, alvo: MAIS, folga: 10,
    titulo: "Tudo começa no +",
    texto: "Ele abre uma solicitação nova, de qualquer tela do hub. Clique nele para ver.",
    faca: { tela: "novo-pedido" }, acao: "clique no +",
  },
  {
    id: "etapas", tela: "novo-pedido", soSe: MAIS, alvo: { sel: "button.np4-cartao", todos: true }, folga: 12,
    titulo: "A solicitação tem quatro etapas",
    texto: "Briefing, medidas, cores e revisão, nessa ordem. O Salvar guarda o que já foi preenchido, para terminar depois.",
  },
  menuPedidos("Para sair da solicitação, é pelo menu do topo. Clique em PEDIDOS para abrir a área de Pedidos."),
  {
    id: "cartao", curto: "O pedido aberto", tela: "pedidos10", soSe: NO_MENU("PEDIDOS"), alvo: { sel: ".p10-trilha .pd4-cartao" }, folga: 10,
    titulo: "Cada cartão é um pedido",
    texto: "A cor mostra a etapa e, no alto, quem faz a arte. Clique no cartão para abrir o pedido.",
    faca: { texto: "Especificações" }, acao: "clique no cartão",
  },
  {
    /* o cartão do pedido e os painéis que estão na janela (os de fora ficam
       com opacidade 0; o quadro, por baixo, fica hidden) */
    id: "paineis", tela: "pedidos10", soSe: NO_MENU("PEDIDOS"), precisa: PEDIDO_ABERTO, alvo: { sel: ".pd4-cartao, .pdv4-painel", todos: true }, folga: 8,
    titulo: "Tudo do pedido, lado a lado",
    texto: "Briefing, especificações, a arte, o histórico e a conversa. Quando o design manda a arte, aparecem aqui o Aprovar e o Pedir revisão.",
  },
  FECHAR_PEDIDO,
  SINO,
  {
    id: "consultas", curto: "Consultas", soSe: { sel: MENU, textos: ["FACAS", "PANTONES", "CALC'S"] }, alvo: { sel: MENU, textos: ["FACAS", "PANTONES", "CALC'S"] }, folga: 8,
    titulo: "Para consultar",
    texto: "As facas da fábrica, as cores Pantone e as calculadoras ficam no menu.",
  },
];

const DESIGN: Passo[] = [
  HOME,
  menuPedidos("Clique em PEDIDOS, no menu, para abrir a área de Pedidos."),
  {
    id: "fila", curto: "A fila", tela: "pedidos10", soSe: NO_MENU("PEDIDOS"), alvo: { sel: ".p10-trilha .pd4-cartao" }, folga: 10,
    titulo: "A fila do design",
    texto: "Os pedidos em Aguardando design vêm na frente, na ordem da fila, e o selo 01 DA FILA marca o próximo. Clique no cartão para abrir.",
    faca: { texto: "Especificações" }, acao: "clique no cartão",
  },
  {
    id: "acoes", curto: "Criar e enviar", tela: "pedidos10", soSe: NO_MENU("PEDIDOS"), precisa: PEDIDO_ABERTO, alvo: { sel: ".pd4-cartao" }, folga: 8,
    titulo: "Os botões da etapa ficam no cartão",
    texto: "Iniciar criação: você confirma a pasta do cliente, e ela nasce ali. Enviar arte: a vendedora recebe o aviso para aprovar.",
  },
  {
    id: "perguntas", tela: "pedidos10", soSe: NO_MENU("PEDIDOS"), precisa: PEDIDO_ABERTO, alvo: { sel: "button", texto: "Perguntas" }, folga: 10,
    titulo: "Dúvida? Pergunte no pedido",
    texto: "A pergunta fica na conversa do pedido, e quem recebe ganha um aviso no sino.",
  },
  FECHAR_PEDIDO,
  SINO,
  {
    id: "consultas", curto: "Consultas", soSe: { sel: MENU, textos: ["FACAS", "PANTONES", "ARQUIVOS", "CALC'S"] }, alvo: { sel: MENU, textos: ["FACAS", "PANTONES", "ARQUIVOS", "CALC'S"] }, folga: 8,
    titulo: "Para consultar",
    texto: "As facas, as cores Pantone, as pastas do arquivo e as calculadoras ficam no menu.",
  },
];

const GESTAO = ["APROVAÇÕES", "CLIENTES", "RELATÓRIOS", "EQUIPE"];
const ADMIN: Passo[] = [
  ...VENDAS.slice(0, -1),
  {
    id: "gestao", curto: "Gestão", soSe: { sel: MENU, textos: GESTAO }, alvo: { sel: MENU, textos: GESTAO }, folga: 8,
    titulo: "A gestão também fica no menu",
    texto: "Aprovações, clientes, relatórios e a equipe. Quem vê cada página depende do acesso de cada um.",
  },
  VENDAS[VENDAS.length - 1],
];

/** O roteiro do papel da pessoa; quem não é design nem administração segue o
    de vendas (os passos do que ela não tem, como o + para quem não cria
    pedido, saem do roteiro dela). */
export function roteiroDe(papel: string): Passo[] {
  if (papel === "designer") return DESIGN;
  if (papel === "admin") return ADMIN;
  return VENDAS;
}

/** O que cada roteiro diz nas boas-vindas. */
export function promessaDe(papel: string): string {
  if (papel === "designer") return "Em dois minutos você conhece o que usa no dia a dia: a fila do design, o pedido aberto e as consultas.";
  if (papel === "admin") return "Em dois minutos você conhece o que usa no dia a dia: as solicitações, os pedidos e a gestão.";
  return "Em dois minutos você conhece o que usa no dia a dia: abrir uma solicitação, acompanhar os pedidos e aprovar a arte.";
}

/** As novidades: cada mudança grande ganha um tour curto, na tela dela. Cada
    pessoa vê uma vez, na primeira visita à tela depois de passar pela
    apresentação, até o dia `ate`. A apresentação não as marca como vistas:
    ela não as mostra, e a equipe que já usava o hub é quem mais precisa. */
export const NOVIDADES: Novidade[] = [
  {
    id: "calculadoras-2026-10", data: "2026-10-06", ate: "2026-11-20", tela: "calculadoras10",
    passos: [
      {
        id: "substrato", antes: "rolar-trilha-fim", alvo: { sel: 'button[aria-label="Calcular Substrato"]' }, folga: 8,
        titulo: "A metragem da bobina",
        texto: "A calculadora de Substrato agora diz quantos metros a bobina tem: você informa o diâmetro externo e a espessura, e ela faz a conta.",
      },
      {
        id: "em-breve", antes: "rolar-trilha-inicio", alvo: { sel: 'button[aria-label$="em breve"]', todos: true }, folga: 8,
        titulo: "Clichê e Etiqueta: em breve",
        texto: "As contas dessas duas estão sendo revistas. Por enquanto, os cartões só avisam.",
      },
    ],
  },
];
