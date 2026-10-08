// As telas do hub, para a sugestão dizer de onde ela é (Augusto, 29/09/2026:
// "dar mais opções de qual tela é a sugestão"). A lista mora aqui porque a
// caixa de sugestões da Home e o servidor usam a mesma: o servidor só aceita
// um nome daqui. Os nomes são os que a equipe vê no menu, nos cards das
// Calculadoras e no título de cada janela.
export const TELA_GERAL = "O hub em geral";

export const GRUPOS_DE_TELAS: { grupo: string; telas: string[] }[] = [
  { grupo: "Páginas", telas: ["Home", "Pedidos", "Novo pedido", "Aprovações", "Pantones", "Facas", "Clientes", "Arquivos", "Relatórios", "Equipe"] },
  { grupo: "Calculadoras", telas: ["Calculadora de facas", "Calculadora de distorção", "Calculadora de clichê", "Calculadora de etiqueta", "Calculadora de substrato"] },
  { grupo: "Janelas", telas: ["Detalhe do pedido", "Design criado", "Clichê chegou", "Pasta do cliente", "Escolher cor", "Transferir carteira"] },
  { grupo: "Barra do topo", telas: ["Pesquisa", "Notificações", "Configurações"] },
];

export const TELAS_DO_HUB: string[] = [TELA_GERAL, ...GRUPOS_DE_TELAS.flatMap((g) => g.telas)];

/* O que cada tela pede para a pessoa abri-la: `paginas`, um item do menu
   (o nome do rail, como em `disponiveis`; basta um); `perms`, uma permissão
   (basta uma). Tela sem regra (Home e a barra do topo) é de todo mundo. As
   calculadoras seguem a capa delas (CalculadorasHub10: o cartão aparece com
   qualquer conta dele liberada); as janelas, o botão que as abre. */
const REGRA_DA_TELA: Record<string, { paginas?: string[]; perms?: string[] }> = {
  "Pedidos": { paginas: ["Pedidos"] },
  "Novo pedido": { paginas: ["Novo pedido"] },
  "Aprovações": { paginas: ["Aprovação"] },
  "Pantones": { paginas: ["Pantone"] },
  "Facas": { paginas: ["Facas"] },
  "Clientes": { paginas: ["Clientes"] },
  "Arquivos": { paginas: ["Arquivos"] },
  "Relatórios": { paginas: ["Apontamentos"] },
  "Equipe": { paginas: ["Equipe"] },
  "Calculadora de facas": { paginas: ["Calculadoras"], perms: ["calc.desenvolvimento", "calc.comparativo", "calc.diametro"] },
  "Calculadora de distorção": { paginas: ["Calculadoras"], perms: ["calc.distorcao"] },
  "Calculadora de clichê": { paginas: ["Calculadoras"], perms: ["calc.valor"] },
  "Calculadora de etiqueta": { paginas: ["Calculadoras"], perms: ["calc.caixa", "calc.valoretiqueta", "calc.metragem"] },
  "Calculadora de substrato": { paginas: ["Calculadoras"], perms: ["calc.substrato", "calc.bobinas", "calc.tinta"] },
  "Detalhe do pedido": { paginas: ["Pedidos", "Aprovação"] },
  /* o Enviar arte abre o Design criado; o Finalizar, o Clichê chegou; o
     Iniciar criação, a Pasta do cliente */
  "Design criado": { paginas: ["Pedidos", "Aprovação"], perms: ["design.enviar_arte"] },
  "Clichê chegou": { paginas: ["Pedidos", "Aprovação"], perms: ["design.arquivo_final"] },
  "Pasta do cliente": { paginas: ["Pedidos", "Aprovação"], perms: ["design.assumir"] },
  /* a paleta da Solicitação e das duas janelas acima */
  "Escolher cor": { perms: ["pedidos.criar", "design.enviar_arte", "design.arquivo_final"] },
  "Transferir carteira": { paginas: ["Pedidos"], perms: ["pedidos.transferir"] },
};

/** As telas da sugestão que a pessoa abre (simulação 6, 07/10/2026: a
    vendedora via Equipe, Relatórios e as calculadoras que não tem).
    `disponiveis` é a lista do menu dela; sem a lista, todas. `tem` responde
    se ela tem a permissão (o hasPerm da sessão). */
export function telasQueAPessoaAbre(disponiveis: string[] | undefined, tem: (perm: string) => boolean): { grupo: string; telas: string[] }[] {
  if (!disponiveis) return GRUPOS_DE_TELAS;
  const abre = (tela: string) => {
    const r = REGRA_DA_TELA[tela];
    if (!r) return true;
    return (!r.paginas || r.paginas.some((p) => disponiveis.includes(p))) && (!r.perms || r.perms.some(tem));
  };
  return GRUPOS_DE_TELAS.map((g) => ({ grupo: g.grupo, telas: g.telas.filter(abre) })).filter((g) => g.telas.length > 0);
}
