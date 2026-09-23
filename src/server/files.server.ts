// Integração com a rede local (Etapa 1).
// O servidor de aplicação acessa o compartilhamento \\server\Arte\Clientes com a
// conta de serviço; o navegador nunca toca o share diretamente.
// Sempre caminhos UNC — nunca letra de unidade mapeada.
// Sem rmSync na lista de propósito: este arquivo NÃO apaga nada (ver a regra
// da casa mais abaixo). Quem tentar acrescentar vai ter de mexer nesta linha
// e, com sorte, ler o porquê antes.
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/** Subpastas que o hub CONHECE — usadas para ler o que já existe no share.
 *  A lista continua inteira de propósito: pasta antiga com arquivo em "Artes"
 *  ou "Logos" tem de seguir aparecendo. */
export const SUBPASTAS = ["Logos", "Referências", "Artes", "Aprovações", "Impressão"] as const;

/** Subpastas criadas junto com a pasta do cliente. Só "Referências": as outras
 *  nasciam vazias em todo cliente novo e enchiam o share de pasta sem uso —
 *  cada uma passa a ser criada no momento em que um arquivo dela chega. */
const SUBPASTAS_NOVAS: readonly (typeof SUBPASTAS)[number][] = ["Referências"];

const SUBPASTA_POR_TIPO: Record<string, (typeof SUBPASTAS)[number]> = {
  anexo: "Referências",
  referencia: "Referências",
  faca: "Referências",
  arte: "Artes",
  aprovacao: "Aprovações",
  impressao: "Impressão",
  logo: "Logos",
};

const CHARS_INVALIDOS = /[<>:"/\\|?*]/g;

export function clientesBaseDir(): string {
  const fromEnv = process.env.CLIENTES_DIR;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return "\\\\server\\Arte\\Clientes";
  // Em desenvolvimento, usa uma pasta local para não mexer nos arquivos reais.
  return path.join(process.cwd(), "dev-data", "Clientes");
}

/** Nome de pasta válido no Windows: remove caracteres proibidos e espaços/pontos nas bordas. */
export function sanitizeFolderName(nome: string): string {
  const limpo = nome
    .replace(CHARS_INVALIDOS, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  if (!limpo) throw new Error("Nome de cliente inválido.");
  return padronizarCaixa(limpo);
}

/** Conectivos que ficam em minúscula no meio do nome ("Casa de Carnes"). */
const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos", "a", "o", "as", "os", "com", "para", "por", "ao", "aos", "à", "às"]);

/**
 * Caixa padrão da pasta: "CASA DE CARNES ALEXANDRE" vira "Casa de Carnes
 * Alexandre". A vendedora digita como quiser (quase sempre tudo em maiúscula) e
 * o share fica com um padrão só. Vale apenas para pasta NOVA — pasta existente
 * é usada com o nome que já tem, o hub não renomeia nada no share.
 * Palavras com número ou sem vogal ("R2", "JBS", "MEI") ficam como vieram: são
 * siglas, e "Jbs" estaria errado.
 */
export function padronizarCaixa(nome: string): string {
  return nome
    .split(" ")
    .map((palavra, i) => {
      if (!palavra) return palavra;
      const so = palavra.replace(/[^A-Za-zÀ-ÿ]/g, "");
      const sigla = /\d/.test(palavra) || (so.length <= 4 && !/[aeiouàáâãéêíóôõúAEIOUÀÁÂÃÉÊÍÓÔÕÚ]/.test(so));
      if (sigla) return palavra;
      const baixa = palavra.toLocaleLowerCase("pt-BR");
      if (i > 0 && MINUSCULAS.has(baixa)) return baixa;
      return baixa.charAt(0).toLocaleUpperCase("pt-BR") + baixa.slice(1);
    })
    .join(" ");
}

/** Chave de deduplicação: minúsculas, sem acentos, espaços colapsados. */
export function normalizeClienteKey(nome: string): string {
  return sanitizeFolderName(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function sanitizeFileName(nome: string): string {
  const base = nome.replace(CHARS_INVALIDOS, "_").replace(/^\.+/, "").trim();
  return base || "arquivo";
}

/**
 * Garante que a pasta do cliente (e subpastas padrão) exista no share.
 * Se já existir, apenas reutiliza — nunca cria duplicada.
 * Retorna o caminho UNC completo da pasta do cliente.
 */
export function ensureClienteFolderOnDisk(nomePasta: string): string {
  const base = clientesBaseDir();
  if (!existsSync(base)) {
    // Em dev cria a base local; em produção o share precisa estar acessível.
    if (process.env.NODE_ENV === "production" && base.startsWith("\\\\")) {
      throw new Error(
        `Compartilhamento de rede inacessível: ${base}. Verifique a conexão do servidor com o share e as permissões da conta de serviço.`,
      );
    }
    mkdirSync(base, { recursive: true });
  }
  const pasta = path.join(base, nomePasta);
  mkdirSync(pasta, { recursive: true });
  for (const sub of SUBPASTAS_NOVAS) mkdirSync(path.join(pasta, sub), { recursive: true });
  return pasta;
}

/** Confere que um caminho está dentro da base de clientes (evita path traversal). */
function assertDentroDaBase(alvo: string) {
  const base = path.resolve(clientesBaseDir());
  const resolvido = path.resolve(alvo);
  if (!resolvido.toLowerCase().startsWith(base.toLowerCase())) {
    throw new Error("Caminho fora da pasta de clientes.");
  }
  return resolvido;
}

/**
 * Grava um arquivo na pasta do cliente, na subpasta adequada ao tipo.
 * Se já existir arquivo com o mesmo nome, acrescenta (2), (3)...
 */
export function saveClienteFile(
  pastaCliente: string,
  tipo: string,
  nomeArquivo: string,
  conteudo: Buffer,
): { fullPath: string; nomeSalvo: string } {
  const sub = SUBPASTA_POR_TIPO[tipo] ?? "Referências";
  const dir = path.join(pastaCliente, sub);
  mkdirSync(dir, { recursive: true });

  const nome = sanitizeFileName(nomeArquivo);
  const ext = path.extname(nome);
  const stem = path.basename(nome, ext);

  /* O designer salva a arte na pasta pelo Illustrator e DEPOIS anexa o mesmo
     arquivo pelo hub: se o que está chegando já existe ali com o mesmo
     conteúdo, o anexo passa a apontar para o arquivo que já está lá — sem
     gravar de novo, sem virar "(2)". O "(2)" fica só para conteúdo DIFERENTE
     com o mesmo nome (versão nova de verdade). */
  let candidato = nome;
  let i = 2;
  while (existsSync(path.join(dir, candidato))) {
    const existente = path.join(dir, candidato);
    try {
      const atual = readFileSync(existente);
      if (atual.equals(conteudo)) {
        return { fullPath: assertDentroDaBase(existente), nomeSalvo: candidato };
      }
    } catch { /* sem leitura não dá para comparar: segue para o (2) */ }
    candidato = `${stem} (${i})${ext}`;
    i++;
  }

  const fullPath = assertDentroDaBase(path.join(dir, candidato));
  writeFileSync(fullPath, conteudo);
  return { fullPath, nomeSalvo: candidato };
}

export function readClienteFile(fullPath: string): Buffer {
  return readFileSync(assertDentroDaBase(reacharCaminho(fullPath)));
}

/**
 * Pasta de cliente renomeada no Windows não pode quebrar os anexos antigos:
 * o banco guarda o caminho completo, e "PANIFICADORA SAO GERALDO" virar
 * "Panificadora São Geraldo" deixava o registro apontando para o nada.
 * Quando o caminho gravado não existe, procura na lista real de pastas uma
 * com a MESMA chave (sem caixa, sem acento) e remonta o caminho.
 * Só leitura — quem conserta o registro no banco é quem chama.
 */
export function reacharCaminho(fullPath: string): string {
  if (existsSync(fullPath)) return fullPath;
  const base = clientesBaseDir();
  const resto = path.relative(base, fullPath);
  // fora da base ou caminho estranho: devolve como veio (o readFileSync acusa)
  if (!resto || resto.startsWith("..") || path.isAbsolute(resto)) return fullPath;
  const [pastaVelha, ...dentro] = resto.split(path.sep);
  if (!pastaVelha || !dentro.length) return fullPath;
  const mesmaChave = (p: string) => {
    try { return normalizeClienteKey(p) === chave; } catch { return false; }
  };
  let chave: string;
  try { chave = normalizeClienteKey(pastaVelha); } catch { return fullPath; }
  // a pasta pode ter sido renomeada AGORA: se a lista em cache não tiver,
  // vale uma releitura do share antes de desistir
  const atual = listarPastasClientes().find(mesmaChave) ?? listarPastasClientes(true).find(mesmaChave);
  if (!atual || atual === pastaVelha) return fullPath;
  const novo = path.join(base, atual, ...dentro);
  return existsSync(novo) ? novo : fullPath;
}

/* ————————————————————————————————————————————————————————————————
   REGRA DA CASA: O HUB NUNCA APAGA NADA DENTRO DE \\server\Arte\Clientes.

   Ali estão as artes originais dos clientes, acumuladas há anos e muitas
   vezes o único exemplar — a decisão de apagar é da pessoa, no Explorador,
   com o Ctrl+Z do Windows por perto. O hub só ESCREVE (saveClienteFile) e LÊ
   (readClienteFile). Não existe função de apagar aqui de propósito: se
   alguém escrever uma chamada dessas, o código não compila.

   "Excluir anexo" no pedido = tirar o vínculo no banco. O arquivo continua
   na pasta do cliente.
   ———————————————————————————————————————————————————————————————— */

/**
 * Guarda os anexos de uma solicitação de clichê em
 * <base>\_Solicitações de Clichê\<numero>\ — assim nada se perde
 * mesmo que o e-mail falhe.
 */
export function saveSolicitacaoClicheFile(
  numero: number,
  nomeArquivo: string,
  conteudo: Buffer,
): { fullPath: string; nomeSalvo: string } {
  const dir = path.join(clientesBaseDir(), "_Solicitações de Clichê", String(numero).padStart(4, "0"));
  mkdirSync(dir, { recursive: true });

  const nome = sanitizeFileName(nomeArquivo);
  const ext = path.extname(nome);
  const stem = path.basename(nome, ext);
  let candidato = nome;
  let i = 2;
  while (existsSync(path.join(dir, candidato))) {
    candidato = `${stem} (${i})${ext}`;
    i++;
  }
  const fullPath = assertDentroDaBase(path.join(dir, candidato));
  writeFileSync(fullPath, conteudo);
  return { fullPath, nomeSalvo: candidato };
}

/**
 * Guarda a nota (ordem de serviço) que a clicheria manda com o clichê, em
 * <base>\_Notas da Clicheria\<pedido>\ — o comprovante dos valores lançados.
 *
 * Fica FORA da pasta do cliente de propósito: é documento de custo nosso, e a
 * pasta do cliente é acervo de arte, visto por gente que não tem nada a ver
 * com quanto pagamos por um clichê.
 */
export function saveNotaClicheFile(
  numeroPedido: number,
  nomeArquivo: string,
  conteudo: Buffer,
): { fullPath: string; nomeSalvo: string } {
  const dir = path.join(clientesBaseDir(), "_Notas da Clicheria", String(numeroPedido).padStart(4, "0"));
  mkdirSync(dir, { recursive: true });

  const nome = sanitizeFileName(nomeArquivo);
  const ext = path.extname(nome);
  const stem = path.basename(nome, ext);
  let candidato = nome;
  let i = 2;
  /* Correção de valores manda a nota de novo: a antiga fica como (2), (3)...
     Nada é sobrescrito — o histórico do que foi lançado antes continua de pé. */
  while (existsSync(path.join(dir, candidato))) {
    candidato = `${stem} (${i})${ext}`;
    i++;
  }
  const fullPath = assertDentroDaBase(path.join(dir, candidato));
  writeFileSync(fullPath, conteudo);
  return { fullPath, nomeSalvo: candidato };
}

/* ————— catálogo de pastas de cliente que JÁ existem no share ————— */
/* São ~5.000 pastas numa unidade de rede: ler o diretório a cada tecla
   digitada seria lento demais. Lê uma vez, guarda por alguns minutos, e a
   tela filtra do lado do navegador. */
let cachePastas: { quando: number; nomes: string[] } | null = null;
const CACHE_MS = 5 * 60_000;

export function listarPastasClientes(forcar = false): string[] {
  if (!forcar && cachePastas && Date.now() - cachePastas.quando < CACHE_MS) return cachePastas.nomes;
  const base = clientesBaseDir();
  if (!existsSync(base)) return cachePastas?.nomes ?? [];
  const nomes = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))  // "_Solicitações de Clichê" não é cliente
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  cachePastas = { quando: Date.now(), nomes };
  return nomes;
}

/** Esquece o cache — usado logo depois de criar uma pasta nova. */
export function esquecerCachePastas() {
  cachePastas = null;
}

/**
 * Confere se a pasta escolhida existe MESMO no share, comparando com a lista
 * real. Devolve o nome como está gravado no disco (o Windows não diferencia
 * maiúsculas, mas nós queremos gravar do jeito certo) ou null.
 */
export function acharPastaExata(nome: string): string | null {
  const alvo = String(nome ?? "").trim().toLowerCase();
  if (!alvo) return null;
  const achada = listarPastasClientes().find((n) => n.toLowerCase() === alvo);
  if (achada) return achada;
  // pode ter sido criada agora por outra pessoa: relê antes de desistir
  return listarPastasClientes(true).find((n) => n.toLowerCase() === alvo) ?? null;
}

export type ArquivoInfo = { nome: string; subpasta: string; tamanho: number; modificado: string };

/**
 * Quebra um caminho relativo em pedaços seguros.
 *
 * Tudo que vem do navegador passa por aqui antes de virar caminho de disco:
 * ".." fora, barra no começo fora, nome de unidade ("C:") fora. Sem isso, um
 * `caminho` malandro sairia da pasta de clientes e leria o resto do servidor.
 */
function segmentosSeguros(caminho: string): string[] {
  return String(caminho ?? "")
    .split(/[\\/]+/)
    .map((s) => s.trim())
    .filter((s) => s && s !== "." && s !== ".." && !/^[A-Za-z]:$/.test(s));
}

export type ConteudoPasta = { pastas: string[]; arquivos: ArquivoInfo[] };

/**
 * Um nível da pasta do cliente: subpastas e arquivos, para navegar.
 *
 * Diferente de `listClienteFiles`, que só olha a raiz e as cinco subpastas
 * padrão: no share de verdade cada cliente organiza como quer ("Sucos",
 * "Aprovação" ao lado de "Aprovações"), e uma tela de navegar tem de mostrar
 * o que ESTÁ lá, não o que deveria estar.
 */
export function listarConteudoPasta(pastaCliente: string, caminho = ""): ConteudoPasta {
  const alvo = assertDentroDaBase(path.join(pastaCliente, ...segmentosSeguros(caminho)));
  if (!existsSync(alvo)) return { pastas: [], arquivos: [] };
  const pastas: string[] = [];
  const arquivos: ArquivoInfo[] = [];
  for (const entry of readdirSync(alvo, { withFileTypes: true })) {
    if (entry.isDirectory()) { pastas.push(entry.name); continue; }
    if (!entry.isFile()) continue;
    try {
      const st = statSync(path.join(alvo, entry.name));
      arquivos.push({ nome: entry.name, subpasta: caminho, tamanho: st.size, modificado: st.mtime.toISOString() });
    } catch { /* arquivo sumiu entre o readdir e o stat: ignora */ }
  }
  const ordem = (a: string, b: string) => a.localeCompare(b, "pt-BR");
  return {
    pastas: pastas.sort(ordem),
    arquivos: arquivos.sort((a, b) => ordem(a.nome, b.nome)),
  };
}

/** Caminho absoluto de um arquivo dentro da pasta do cliente, já conferido. */
export function caminhoNaPasta(pastaCliente: string, caminho: string, nome: string): string {
  return assertDentroDaBase(path.join(pastaCliente, ...segmentosSeguros(caminho), ...segmentosSeguros(nome)));
}

/** Lê um arquivo de dentro da pasta do cliente pelo caminho relativo. */
export function lerArquivoDaPasta(
  pastaCliente: string,
  caminho: string,
  nome: string,
): { conteudo: Buffer; tamanho: number } {
  const alvo = caminhoNaPasta(pastaCliente, caminho, nome);
  const st = statSync(alvo);
  if (!st.isFile()) throw new Error("Isso não é um arquivo.");
  return { conteudo: readFileSync(alvo), tamanho: st.size };
}

/** Lista os arquivos da pasta do cliente (raiz + subpastas padrão, 1 nível). */
export function listClienteFiles(pastaCliente: string): ArquivoInfo[] {
  const pasta = assertDentroDaBase(pastaCliente);
  if (!existsSync(pasta)) return [];
  const resultado: ArquivoInfo[] = [];
  const dirs: [string, string][] = [[pasta, ""]];
  for (const sub of SUBPASTAS) dirs.push([path.join(pasta, sub), sub]);
  for (const [dir, rotulo] of dirs) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const st = statSync(path.join(dir, entry.name));
      resultado.push({
        nome: entry.name,
        subpasta: rotulo,
        tamanho: st.size,
        modificado: st.mtime.toISOString(),
      });
    }
  }
  return resultado;
}
