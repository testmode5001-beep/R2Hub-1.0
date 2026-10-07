// Vídeos de fundo da capa (home).
// Os vídeos moram no share da rede (mesmo \\server\Arte de Clientes). O navegador
// não consegue ler o share direto, então o vídeo ESCOLHIDO é copiado uma vez para
// a pasta pública do app (public/home-bg.<ext>), que o servidor entrega por HTTP
// com suporte a Range — ou seja, streaming/seek de verdade, sem carregar o arquivo
// inteiro em memória (o que seria inviável: há vídeos de dezenas/centenas de MB).
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/** Extensões que o <video> do navegador toca. */
const EXTS_VIDEO = new Set([".mp4", ".webm", ".m4v", ".mov", ".ogv"]);
/** Imagens aceitas como fundo. */
const EXTS_IMAGEM = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const EXTS_MIDIA = new Set([...EXTS_VIDEO, ...EXTS_IMAGEM]);

/** Teto de tamanho por tipo — imagem é leve, vídeo pode ser grande. */
const TAMANHO_MAX_MB = 150;       // vídeo
const TAMANHO_MAX_IMG_MB = 25;    // imagem

function tipoMidia(ext: string): "video" | "imagem" | null {
  if (EXTS_VIDEO.has(ext)) return "video";
  if (EXTS_IMAGEM.has(ext)) return "imagem";
  return null;
}

/**
 * Pasta dos vídeos no share. Por padrão usa o caminho UNC (independe da letra Z:
 * estar mapeada, o que a conta de serviço em produção pode não ter).
 * Z:\Clientes = \\server\Arte\Clientes, então:
 */
export function homeVideosDir(): string {
  return (
    process.env.HOME_VIDEOS_DIR ??
    "\\\\server\\Arte\\Clientes\\Modelos\\Design\\R2 Hub\\Videos"
  );
}

/**
 * Pasta pública servida estaticamente pelo app.
 * - dev (vite): <raiz>/public
 * - produção (nitro node-server): <cwd>/.output/public
 * `HOME_BG_DIR` sobrescreve os dois, se preciso.
 */
function publicDir(): string {
  if (process.env.HOME_BG_DIR) return process.env.HOME_BG_DIR;
  const build = path.resolve(process.cwd(), ".output", "public");
  const dev = path.resolve(process.cwd(), "public");
  /* Em produção quem SERVE /papel/... é a pasta do build (.output/public).
     Como `public/` existe no projeto, a ordem antiga mandava o arquivo para
     lá — e o papel escolhido dava 404 até o próximo build (a Home ficava
     cinza e parecia que o envio não tinha subido). */
  if (process.env.NODE_ENV === "production" && existsSync(build)) return build;
  if (existsSync(dev)) return dev;
  return build;
}

const NOME_BASE = "home-bg"; // home-bg.mp4, home-bg.webm, ...

export type VideoInfo = { nome: string; tamanhoMB: number; tipo: "video" | "imagem" };

/** Nome de arquivo seguro (sem path traversal, só básico). */
function nomeSeguro(nome: string): string {
  return path.basename(nome).replace(/[^\w.\-() ]+/g, "_").trim();
}

/** Lista as mídias disponíveis no share (vídeos e imagens dentro do teto de tamanho). */
export function listHomeVideoFiles(): VideoInfo[] {
  const dir = homeVideosDir();
  if (!existsSync(dir)) return [];
  const itens: VideoInfo[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const tipo = tipoMidia(ext);
    if (!tipo) continue;
    const st = statSync(path.join(dir, entry.name));
    const mb = st.size / (1024 * 1024);
    if (mb > (tipo === "imagem" ? TAMANHO_MAX_IMG_MB : TAMANHO_MAX_MB)) continue; // pesado demais
    itens.push({ nome: entry.name, tamanhoMB: Math.round(mb * 10) / 10, tipo });
  }
  // imagens e vídeos juntos, ordenados por nome
  itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return itens;
}

/** Remove qualquer <base>.* já publicado (troca ou remoção de fundo). */
function limparPublicados(base: string) {
  const pub = publicDir();
  if (!existsSync(pub)) return;
  for (const f of readdirSync(pub)) {
    if (f.startsWith(`${base}.`)) {
      try { rmSync(path.join(pub, f)); } catch { /* segue */ }
    }
  }
}

/**
 * Copia o vídeo escolhido para a pasta pública sob o nome-base dado (home-bg ou
 * central-bg) e devolve o caminho servido (com selo de versão para furar o cache
 * do navegador na troca). Valida o nome contra a lista real do share.
 */
export function aplicarVideo(nome: string, base: string): { src: string; nome: string } {
  const escolhido = listHomeVideoFiles().find((v) => v.nome === nome);
  if (!escolhido) throw new Error("Vídeo não encontrado na pasta da rede.");

  // mesma rota do papel de parede: o arquivo é servido do share, sem cópia
  // (o `base` fica só como rastro de quem pediu — Home ou Central)
  void base;
  const origem = path.join(homeVideosDir(), escolhido.nome);
  const versao = statSync(origem).mtimeMs.toString(36);
  return { src: `/papel/${encodeURIComponent(escolhido.nome)}?v=${versao}`, nome: escolhido.nome };
}

/** Volta ao fundo cinza padrão (remove o vídeo publicado do nome-base). */
export function removerVideo(base: string) {
  limparPublicados(base);
}

/**
 * Salva um vídeo novo enviado pelo usuário na pasta do share, passando a ficar
 * disponível na lista para qualquer tela. Valida extensão e tamanho.
 */
export function salvarVideoNovo(nome: string, dados: Buffer): VideoInfo {
  const ext = path.extname(nome).toLowerCase();
  const tipo = tipoMidia(ext);
  if (!tipo) throw new Error("Formato não suportado (vídeo: mp4/webm/mov; imagem: jpg/png/webp/gif).");
  const mb = dados.length / (1024 * 1024);
  const teto = tipo === "imagem" ? TAMANHO_MAX_IMG_MB : TAMANHO_MAX_MB;
  if (mb > teto) throw new Error(`${tipo === "imagem" ? "Imagem" : "Vídeo"} acima do limite de ${teto} MB.`);

  const dir = homeVideosDir();
  mkdirSync(dir, { recursive: true });
  const seguro = nomeSeguro(nome) || `midia${ext}`;
  /* Regra 1 da casa: nada se sobrescreve em \\server\Arte\Clientes. O envio
     com nome que já existe na pasta (ou que vira o mesmo depois do
     nomeSeguro) gravava por cima, e quem usava aquele vídeo ou papel passava
     a ver outro. Agora ganha " (2)", " (3)"...; o "wx" cria só se não
     existir, então dois envios ao mesmo tempo não se atropelam. */
  const { name: base, ext: extSeguro } = path.parse(seguro);
  for (let n = 1; n <= 999; n++) {
    const final = n === 1 ? seguro : `${base} (${n})${extSeguro}`;
    try {
      writeFileSync(path.join(dir, final), dados, { flag: "wx" });
      return { nome: final, tamanhoMB: Math.round(mb * 10) / 10, tipo };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  throw new Error("Já há arquivos demais com esse nome na pasta de vídeos. Renomeie o arquivo e envie de novo.");
}

/* Compat: a home continua chamando estes. */
export function aplicarHomeVideo(nome: string) { return aplicarVideo(nome, NOME_BASE); }
export function removerHomeVideo() { removerVideo(NOME_BASE); }

/**
 * Papel de parede é escolha de CADA usuário, então não dá para publicar num
 * nome-base único. Aqui o arquivo vai para public/papel/<nome> — quem escolher
 * a mesma mídia reaproveita o mesmo arquivo, sem cópia por pessoa.
 */
export function publicarPapel(nome: string): { src: string; nome: string } {
  const escolhido = listHomeVideoFiles().find((v) => v.nome === nome);
  if (!escolhido) throw new Error("Mídia não encontrada na pasta da rede.");

  /* Nada de copiar para a pasta pública: /papel/<arquivo> é servido pelo
     próprio servidor lendo o share (ver papel-http.server.ts). Copiar era o
     que quebrava em produção — o nitro só serve o que existia no build. */
  const origem = path.join(homeVideosDir(), escolhido.nome);
  const versao = statSync(origem).mtimeMs.toString(36);
  return { src: `/papel/${encodeURIComponent(escolhido.nome)}?v=${versao}`, nome: escolhido.nome };
}
