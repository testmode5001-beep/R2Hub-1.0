// A caixa padrão do nome de uma pasta de cliente NOVA, numa conta só para o
// servidor (que cria a pasta) e para a tela (que mostra o nome antes de
// confirmar). Antes a conta morava só no servidor, e a caixa "Pasta do
// cliente" não avisava que "Arco-Íris" ia virar "Arco-íris": o nome mudava
// sem ninguém ver (simulação 5, 05/10/2026).

/** caracteres que o Windows não aceita em nome de pasta */
export const CHARS_INVALIDOS_PASTA = /[<>:"/\\|?*]/g;

/** Conectivos que ficam em minúscula no meio do nome ("Casa de Carnes"). */
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o", "as", "os", "com", "para", "por", "ao", "aos", "à", "às"]);

/** sigla de empresa fica em maiúsculas: "LTDA ME" virava "Ltda Me" e "S.A."
    virava "S.a." (simulação de 28/09/2026) */
const SIGLAS_EMPRESA = new Set(["me", "mei", "epp", "sa", "s.a.", "s.a", "s/a", "eireli"]);

/**
 * Caixa padrão da pasta: "CASA DE CARNES ALEXANDRE" vira "Casa de Carnes
 * Alexandre". A vendedora digita como quiser (quase sempre tudo em maiúscula) e
 * o share fica com um padrão só. Vale apenas para pasta NOVA: pasta existente
 * é usada com o nome que já tem, o hub não renomeia nada no share.
 * Palavras com número ou sem vogal ("R2", "JBS", "MEI") ficam como vieram: são
 * siglas, e "Jbs" estaria errado.
 */
export function padronizarCaixa(nome: string): string {
  return nome
    .split(" ")
    .map((palavra, i) => {
      if (!palavra) return palavra;
      if (SIGLAS_EMPRESA.has(palavra.toLocaleLowerCase("pt-BR"))) return palavra.toLocaleUpperCase("pt-BR");
      const so = palavra.replace(/[^A-Za-zÀ-ÿ]/g, "");
      const sigla = /\d/.test(palavra) || (so.length <= 4 && !/[aeiouàáâãéêíóôõúAEIOUÀÁÂÃÉÊÍÓÔÕÚ]/.test(so));
      if (sigla) return palavra;
      const baixa = palavra.toLocaleLowerCase("pt-BR");
      if (i > 0 && MINUSCULAS.has(baixa)) return baixa;
      return baixa.charAt(0).toLocaleUpperCase("pt-BR") + baixa.slice(1);
    })
    .join(" ");
}

/** O nome que a pasta nova ganha: sem os caracteres proibidos, sem espaço ou
    ponto nas bordas e na caixa padrão. Vazio quando não sobra nada. */
export function nomeDaPastaNova(nome: string): string {
  const limpo = nome
    .replace(CHARS_INVALIDOS_PASTA, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return limpo ? padronizarCaixa(limpo) : "";
}
