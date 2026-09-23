// Dados reais do Hub (notificações e anotações) distribuídos por contexto.
// Módulo à parte de propósito: a topbar (HubV1a) e as modais do topo
// (TopoModaisV1a) precisam dos mesmos dados, e HubV1a já importa as modais —
// um contexto dentro do HubV1a fecharia um ciclo de import.
// A rota embrulha a tela no provider; sem provider tudo fica indefinido e os
// componentes seguem no modo demonstração do protótipo.
import { createContext, useContext, type ReactNode } from "react";

export type NotificacaoHub = {
  id: string; titulo: string; corpo?: string | null; url?: string | null; lida: boolean; created_at: string;
};
export type NotaHub = { id: string; texto: string; quando?: string | null; feito: boolean; created_at?: string };

/** Ilustração da Home 1.0. Regra única: a escolha da pessoa manda; sem
    escolha, o cargo decide. Mora aqui porque a Home e a modal de
    Configurações precisam responder a mesma coisa — duplicar a regra seria
    a tela mostrar um desenho e a configuração marcar o outro. */
export type IlustHome = "Vendas" | "Design";
export function ilustDaHome(prefs: Record<string, boolean | string> | undefined, role: string | undefined): IlustHome {
  const p = prefs?.homeIlustracao;
  if (p === "Vendas" || p === "Design") return p;
  return ["vendas", "comercial"].includes(String(role)) ? "Vendas" : "Design";
}

export type MensagemHub = { id: string; user_id?: string | null; user_nome?: string; texto: string; created_at: string };
export type ConversaHub = {
  id: string; numero: number; cliente: string; status: string; mensagens: MensagemHub[];
};

/** Item do acervo de mídia do share (mesma lista da capa antiga). */
export type PapelParede = { nome: string; tipo: "video" | "imagem"; tamanhoMB: number };

export type HubDadosV1a = {
  /** id do usuário logado — separa "minhas" mensagens das dos colegas */
  meuId?: string;
  /** cargo do usuário logado (role) — padrões que dependem da função */
  meuPapel?: string;
  conversas?: ConversaHub[];
  aoEnviarMensagem?: (pedidoId: string, texto: string) => Promise<unknown>;
  aoAbrirPedido?: (pedidoId: string) => void;
  notificacoes?: NotificacaoHub[];
  aoMarcarNotificacoes?: (ids?: string[]) => Promise<unknown>;
  /** leva para onde a notificação aponta (o `url` guardado no banco) */
  aoAbrirNotificacao?: (url: string) => void;
  /* ————— papel de parede (moldura em volta do palco) ————— */
  /** caminho do arquivo publicado; "" ou ausente = fundo liso */
  papelParede?: string;
  /** nome do arquivo no acervo (o que a modal marca como escolhido) */
  papelNome?: string;
  papelTipo?: "video" | "imagem";
  /** só quem administra troca o papel de parede de todo mundo */
  podeTrocarPapel?: boolean;
  /** acervo de mídia do share — carregado só quando a modal abre */
  aoListarPapeis?: () => Promise<PapelParede[]>;
  /** envia um arquivo do computador para o acervo de papéis (todos veem) */
  aoEnviarPapel?: (nome: string, dataBase64: string) => Promise<PapelParede>;
  /** aplica (nome vazio = tirar o papel de parede) */
  aoTrocarPapel?: (nome: string) => Promise<unknown>;
  /* ————— atalhos do rodapé da Home (escolha de cada usuário) ————— */
  /** rótulos escolhidos; vazio = os sugeridos pelo papel selecionado */
  atalhos?: string[];
  aoSalvarAtalhos?: (atalhos: string[]) => Promise<unknown>;

  /* ————— preferências do usuário (modal Preferências, user_config) ————— */
  /** { atraso, som, compacto, auto: boolean; telaInicial: string } — ausente = carregando */
  prefs?: Record<string, boolean | string>;
  aoSalvarPrefs?: (prefs: Record<string, boolean | string>) => Promise<unknown>;
  notas?: NotaHub[];
  aoCriarNota?: (texto: string, quando?: string | null) => Promise<unknown>;
  aoAlternarNota?: (id: string, feito: boolean) => Promise<unknown>;
  aoExcluirNota?: (id: string) => Promise<unknown>;
  aoLimparNotas?: () => Promise<unknown>;

  /* ————— cadastro de colega do próprio setor (usuarios.criar_departamento) ————— */
  /** presente = a pessoa pode cadastrar contas do próprio cargo nas Preferências */
  aoCriarColega?: (d: { nome: string; username: string; senha: string }) => Promise<unknown>;
  /** rótulo do cargo que a conta nova vai receber (o mesmo de quem cadastra) */
  meuCargoLabel?: string;

  /* ————— chat: canal geral da equipe (o que não é de nenhum pedido) ————— */
  chatGeral?: { id: string; user_id: string | null; user_nome: string | null; texto: string; created_at: string }[];
  aoEnviarChat?: (texto: string) => Promise<unknown>;

  /* ————— chat: conversas diretas entre duas pessoas ————— */
  colegas?: { id: string; nome: string; role?: string }[];
  /** todas as minhas mensagens diretas; a modal agrupa por pessoa */
  chatDireto?: {
    id: string; user_id: string | null; user_nome: string | null;
    para_id: string | null; para_nome: string | null; texto: string; created_at: string;
  }[];
  aoEnviarDireto?: (paraId: string, texto: string) => Promise<unknown>;

  /* ————— busca do topo, que vale para o hub inteiro ————— */
  /** pedidos em versão leve, para a busca achar de qualquer tela */
  buscaPedidos?: { id: string; numero: number; cliente: string; status: string; medida?: string; substrato?: string; tipo?: string }[];
  /** páginas que esta pessoa pode abrir (o resultado navega para elas) */
  paginasDisponiveis?: string[];
  aoNavegar?: (pagina: string) => void;
};

const HubDadosCtx = createContext<HubDadosV1a>({});

export const useHubDados = () => useContext(HubDadosCtx);

export function HubDadosV1aProvider({ valor, children }: { valor: HubDadosV1a; children: ReactNode }) {
  return <HubDadosCtx.Provider value={valor}>{children}</HubDadosCtx.Provider>;
}

/* Leitura das conversas: o banco não guarda "lida" por mensagem, então o
   marcador fica no navegador (por pedido, o horário da última visita). */
const CH_VISTAS = "r2hub.v1a.msg-vistas";

export function lerVistas(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CH_VISTAS) ?? "{}"); } catch { return {}; }
}
export function marcarVista(pedidoId: string) {
  try {
    const v = lerVistas();
    v[pedidoId] = new Date().toISOString();
    localStorage.setItem(CH_VISTAS, JSON.stringify(v));
  } catch { /* storage bloqueado */ }
}
/** Conversas com mensagem de outra pessoa mais nova que a última visita. */
export function conversasNaoLidas(conversas: ConversaHub[] | undefined, meuId?: string) {
  if (!conversas?.length) return 0;
  const vistas = lerVistas();
  return conversas.filter((c) => {
    const ultima = c.mensagens[c.mensagens.length - 1];
    if (!ultima || (meuId && ultima.user_id === meuId)) return false;
    const visto = vistas[c.id];
    return !visto || visto < ultima.created_at;
  }).length;
}

/** 1 quando o canal geral tem recado novo de outra pessoa; 0 quando não. */
export function chatGeralNaoLido(
  chat: { user_id: string | null; created_at: string }[] | undefined,
  meuId?: string,
) {
  const ultima = chat?.[chat.length - 1];
  if (!ultima || (meuId && ultima.user_id === meuId)) return 0;
  const visto = lerVistas()["geral"];
  return !visto || visto < ultima.created_at ? 1 : 0;
}

/** Quantas conversas diretas têm recado novo de outra pessoa. */
export function chatDiretoNaoLidos(
  chat: { user_id: string | null; para_id: string | null; created_at: string }[] | undefined,
  meuId?: string,
) {
  if (!chat?.length || !meuId) return 0;
  const vistas = lerVistas();
  // última mensagem de cada pessoa (a lista vem em ordem crescente)
  const ultimaDe = new Map<string, { minha: boolean; em: string }>();
  chat.forEach((m) => {
    const minha = m.user_id === meuId;
    const outro = minha ? m.para_id : m.user_id;
    if (outro) ultimaDe.set(outro, { minha, em: m.created_at });
  });
  let n = 0;
  ultimaDe.forEach((u, outro) => {
    if (u.minha) return;
    const visto = vistas["dm:" + outro];
    if (!visto || visto < u.em) n++;
  });
  return n;
}

/** dd/mm de hoje — carimbo das anotações criadas pelo modal do topo. */
export function hojeDDMM() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
