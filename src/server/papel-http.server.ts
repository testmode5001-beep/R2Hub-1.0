// Serve os papéis de parede DIRETO da pasta da rede, em /papel/<arquivo>.
//
// Por que não usar a pasta pública: em produção o nitro monta a lista de
// arquivos estáticos NO BUILD. Um papel enviado depois disso ficava no disco
// mas dava 404 — daí a impressão de que o envio "não subia". Lendo do share a
// cada pedido, o que a equipe envia aparece na hora, para todo mundo.
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

import { homeVideosDir } from "./videos.server";

const TIPOS: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const PREFIXO = "/papel/";

/** Devolve a resposta do arquivo pedido, ou null se a rota não é de papel. */
export function servirPapel(url: URL, headers: Headers): Response | null {
  if (!url.pathname.startsWith(PREFIXO)) return null;

  let nome: string;
  try {
    nome = decodeURIComponent(url.pathname.slice(PREFIXO.length));
  } catch {
    return new Response("Nome inválido.", { status: 400 });
  }
  // basename mata qualquer "../" — só arquivo, nunca caminho
  nome = path.basename(nome);
  const ext = path.extname(nome).toLowerCase();
  const tipo = TIPOS[ext];
  if (!nome || !tipo) return new Response("Não encontrado.", { status: 404 });

  const arquivo = path.join(homeVideosDir(), nome);
  if (!existsSync(arquivo)) return new Response("Não encontrado.", { status: 404 });

  const info = statSync(arquivo);
  const comuns: Record<string, string> = {
    "content-type": tipo,
    // o endereço já leva ?v=<mtime>, então o navegador pode guardar à vontade
    "cache-control": "public, max-age=86400",
    "accept-ranges": "bytes",
    "last-modified": info.mtime.toUTCString(),
  };

  /* Vídeo precisa de Range: sem isso o navegador não avança a barra e o
     Safari nem começa a tocar. */
  const range = headers.get("range");
  const pedaco = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (pedaco) {
    const inicio = pedaco[1] ? Number(pedaco[1]) : 0;
    const fim = pedaco[2] ? Math.min(Number(pedaco[2]), info.size - 1) : info.size - 1;
    if (Number.isNaN(inicio) || Number.isNaN(fim) || inicio > fim || inicio >= info.size) {
      return new Response("Faixa inválida.", {
        status: 416,
        headers: { "content-range": `bytes */${info.size}` },
      });
    }
    const stream = Readable.toWeb(createReadStream(arquivo, { start: inicio, end: fim })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: {
        ...comuns,
        "content-range": `bytes ${inicio}-${fim}/${info.size}`,
        "content-length": String(fim - inicio + 1),
      },
    });
  }

  const stream = Readable.toWeb(createReadStream(arquivo)) as ReadableStream;
  return new Response(stream, {
    status: 200,
    headers: { ...comuns, "content-length": String(info.size) },
  });
}
