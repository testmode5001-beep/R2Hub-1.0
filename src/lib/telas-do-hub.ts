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
