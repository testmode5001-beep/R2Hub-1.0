// Tutoriais da Home: os vídeos de passo a passo (Augusto, 05/10/2026:
// "passo a passo em vídeo"). Moram numa pasta da rede, ao lado dos papéis de
// parede: \\server\Arte\Clientes\Modelos\Design\R2 Hub\Tutoriais.
//
// SÓ LEITURA: o hub lista e entrega os vídeos; não grava, não renomeia e não
// apaga nada na pasta. Quem põe um vídeo lá faz pelo Explorador.
//
// O título sai do nome do arquivo: "01 - Como abrir uma solicitação.mp4" vira
// "Como abrir uma solicitação", e o número da frente dá a ordem.
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Readable } from "node:stream";

const TIPOS: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

export function tutoriaisDir(): string {
  return process.env.TUTORIAIS_DIR ?? "\\\\server\\Arte\\Clientes\\Modelos\\Design\\R2 Hub\\Tutoriais";
}

export type Tutorial = { arquivo: string; titulo: string; tamanhoMB: number; versao: number };

function tituloDe(arquivo: string): string {
  return path.basename(arquivo, path.extname(arquivo))
    .replace(/^\s*\d+\s*[-._)]*\s*/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim() || arquivo;
}

/** Os vídeos da pasta, na ordem do nome (o número da frente manda). */
export function listarTutoriais(): Tutorial[] {
  const dir = tutoriaisDir();
  if (!existsSync(dir)) return [];
  const itens: Tutorial[] = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (!entrada.isFile()) continue;
    if (!TIPOS[path.extname(entrada.name).toLowerCase()]) continue;
    const st = statSync(path.join(dir, entrada.name));
    itens.push({ arquivo: entrada.name, titulo: tituloDe(entrada.name), tamanhoMB: Math.round(st.size / 104857.6) / 10, versao: Math.floor(st.mtimeMs) });
  }
  return itens.sort((a, b) => a.arquivo.localeCompare(b.arquivo, "pt-BR", { numeric: true }));
}

const PREFIXO = "/tutorial/";

/** Entrega o vídeo pedido em /tutorial/<arquivo> (com Range, para avançar e
    voltar sem baixar tudo), ou null se a rota não é de tutorial. */
export function servirTutorial(url: URL, headers: Headers): Response | null {
  if (!url.pathname.startsWith(PREFIXO)) return null;
  let nome: string;
  try {
    nome = decodeURIComponent(url.pathname.slice(PREFIXO.length));
  } catch {
    return new Response("Nome inválido.", { status: 400 });
  }
  // basename mata qualquer "../": só arquivo da pasta, nunca caminho
  nome = path.basename(nome);
  const tipo = TIPOS[path.extname(nome).toLowerCase()];
  if (!nome || !tipo) return new Response("Não encontrado.", { status: 404 });
  const arquivo = path.join(tutoriaisDir(), nome);
  if (!existsSync(arquivo)) return new Response("Não encontrado.", { status: 404 });
  const info = statSync(arquivo);
  const comuns: Record<string, string> = {
    "content-type": tipo,
    "cache-control": "public, max-age=86400",
    "accept-ranges": "bytes",
    "last-modified": info.mtime.toUTCString(),
  };
  const range = headers.get("range");
  const pedaco = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (pedaco) {
    const inicio = pedaco[1] ? Number(pedaco[1]) : 0;
    const fim = pedaco[2] ? Math.min(Number(pedaco[2]), info.size - 1) : info.size - 1;
    if (Number.isNaN(inicio) || Number.isNaN(fim) || inicio > fim || inicio >= info.size) {
      return new Response(null, { status: 416, headers: { "content-range": `bytes */${info.size}` } });
    }
    const corpo = Readable.toWeb(createReadStream(arquivo, { start: inicio, end: fim })) as unknown as ReadableStream;
    return new Response(corpo, {
      status: 206,
      headers: { ...comuns, "content-range": `bytes ${inicio}-${fim}/${info.size}`, "content-length": String(fim - inicio + 1) },
    });
  }
  const corpo = Readable.toWeb(createReadStream(arquivo)) as unknown as ReadableStream;
  return new Response(corpo, { status: 200, headers: { ...comuns, "content-length": String(info.size) } });
}
