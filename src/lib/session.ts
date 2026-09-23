// Sessão no navegador: token + dados do usuário em localStorage.
// O token é anexado a toda chamada de server function pelo attachAuth (start.ts).

export type SessionUser = {
  id: string;
  username: string;
  nome: string;
  role: string;
  permissions: string[];
  /** entrou com a senha provisória do gestor: tem de definir a dele antes de usar */
  precisaTrocarSenha?: boolean;
};

export type StoredSession = { token: string; user: SessionUser };

const KEY = "dh_session";

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return getStoredSession()?.token ?? null;
}

export function setStoredSession(token: string, user: SessionUser) {
  localStorage.setItem(KEY, JSON.stringify({ token, user }));
}

export function clearStoredSession() {
  localStorage.removeItem(KEY);
}

export function hasPerm(user: SessionUser | null | undefined, perm: string): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return user.permissions.includes(perm);
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  designer: "Designer",
  comercial: "Comercial",
  vendas: "Vendas",
  producao: "Produção",
  estoque: "Estoque",
};

export const PERMISSION_LABELS: Record<string, string> = {
  "pedidos.criar": "Criar solicitações",
  "pedidos.ver_todos": "Ver todas as solicitações",
  "pedidos.editar_todos": "Editar qualquer solicitação",
  "pedidos.status_design": "Executar etapas de design",
  "pedidos.aprovar": "Aprovar / pedir revisão",
  "pedidos.excluir": "Excluir solicitações",
  "tab.cliches": "Aba Aprovação",
  "tab.solicitar_cliche": "Aba Solicitar Clichê",
  "tab.afiacao": "Aba Afiação",
  "calc.desenvolvimento": "Calculadora de Facas",
  "calc.comparativo": "Comparativo de Facas",
  "calc.diametro": "Facas por Diâmetro",
  "calc.distorcao": "Distorção do Clichê",
  "calc.valor": "Valor Clichê",
  "calc.bobinas": "Bobinas",
  "calc.substrato": "Largura do Substrato",
  "calc.caixa": "Etiquetas por Caixa",
  "calc.gabarito": "Baixar gabarito da faca",
  "usuarios.gerenciar": "Gerenciar usuários",
  "permissoes.gerenciar": "Gerenciar permissões",
  "auditoria.ver": "Ver auditoria",
  "apontamentos.ver": "Ver apontamentos",
};

// Agrupamento das permissões para o modal de edição por usuário.
export const PERMISSION_GROUPS: { titulo: string; permissoes: string[] }[] = [
  {
    titulo: "Pedidos",
    permissoes: [
      "pedidos.criar",
      "pedidos.ver_todos",
      "pedidos.editar_todos",
      "pedidos.status_design",
      "pedidos.aprovar",
      "pedidos.excluir",
    ],
  },
  { titulo: "Abas", permissoes: ["tab.cliches", "tab.solicitar_cliche", "tab.afiacao"] },
  {
    titulo: "Calculadoras",
    permissoes: [
      "calc.desenvolvimento",
      "calc.comparativo",
      "calc.diametro",
      "calc.distorcao",
      "calc.valor",
      "calc.bobinas",
      "calc.substrato",
      "calc.caixa",
      "calc.gabarito",
    ],
  },
  {
    titulo: "Administração",
    permissoes: ["usuarios.gerenciar", "permissoes.gerenciar", "auditoria.ver", "apontamentos.ver"],
  },
];

// Mapeia cada permissão de calculadora para a aba correspondente no FlexoFaca.
export const CALC_TAB_MAP: Record<string, string> = {
  "calc.desenvolvimento": "calc",
  "calc.comparativo": "compare",
  "calc.diametro": "bydia",
  "calc.distorcao": "cliche",
  "calc.valor": "valor",
  "calc.bobinas": "bobina",
  "calc.substrato": "substrato",
  "calc.caixa": "caixa",
};
