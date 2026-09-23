// Cadastros compartilhados que o formulário de solicitação usa (tabela
// `cadastros` no banco): formatos/medidas, matéria-prima e cores. Cada tipo é
// governado por uma permissão — cadastro.medidas / .materiais / .cores.
export type TipoCadastro = "medida" | "material" | "cor";

export type ItemCadastro = { id: string; nome: string; extra?: string | null };

export type CadastrosV1a = {
  medidas?: ItemCadastro[];
  materiais?: ItemCadastro[];
  cores?: ItemCadastro[];
};
