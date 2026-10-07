// A mensagem de erro do servidor como gente lê.
//
// Dois tipos de erro chegavam crus na tela (simulação de 28/09/2026): o de
// validação vinha como o JSON do zod ("[{"code":"too_small"...") e o de
// arquivo vinha com o caminho do servidor ("ENOENT: no such file or
// directory, open 'C:\...'"). Nenhum dos dois diz nada a quem está na tela, e
// o segundo ainda mostra por onde o hub guarda as coisas.

/** O texto do erro, traduzido quando é de validação ou de arquivo. */
export function erroLegivel(e: unknown, padrao = "Não deu certo. Tente de novo."): string {
  const m = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!m.trim()) return padrao;

  if (/^\s*[[{]/.test(m)) {
    try {
      const j = JSON.parse(m) as unknown;
      const lista = (Array.isArray(j) ? j : (j as { issues?: unknown[] })?.issues ?? []) as { code?: string; path?: unknown[] }[];
      const primeiro = lista[0];
      if (primeiro) {
        const campo = Array.isArray(primeiro.path) ? primeiro.path.join(".") : "";
        if (campo === "dataBase64") return primeiro.code === "too_big" ? "O arquivo passa do tamanho que o hub aceita." : "O arquivo está vazio.";
        if (primeiro.code === "too_small") return "Falta preencher um campo.";
        if (primeiro.code === "too_big") return "Um texto passou do tamanho que o hub aceita.";
        return "Um dos campos foi recusado. Confira e tente de novo.";
      }
    } catch { /* não era JSON: segue */ }
  }

  /* a conexão caiu no meio (rede, hub reiniciando, o proxy fechou um envio
     grande demais): o navegador diz em inglês, e a tela mostrava "Failed to
     fetch" (revisão de 02/10/2026) */
  if (/Failed to fetch|NetworkError|Load failed|ERR_(CONNECTION|NETWORK|EMPTY_RESPONSE)/i.test(m)) return "A conexão com o hub caiu. Confira a rede e tente de novo.";
  if (/\bENOENT\b/.test(m)) return "O arquivo não está mais na pasta da rede.";
  if (/\b(EPERM|EACCES|EBUSY)\b/.test(m)) return "A rede recusou o arquivo: ele pode estar aberto em outro computador. Tente de novo.";
  if (/\b(ENAMETOOLONG|EINVAL)\b/.test(m)) return "O nome do arquivo é comprido demais. Renomeie e tente de novo.";
  return m;
}
