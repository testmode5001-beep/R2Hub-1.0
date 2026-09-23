// Pastas dos clientes na rede, vistas de dentro do hub.
//
// Hoje, para achar a arte de um cliente, a vendedora sai do hub, abre o
// Explorador, acha \\server\Arte\Clientes e pesquisa lá — com 5 mil pastas,
// pela grafia exata do nome. Aqui é a mesma pasta, com a busca do hub (sem
// acento, sem caixa) e o arquivo abrindo na tela.
//
// SÓ LEITURA, de propósito: nada aqui grava, renomeia ou apaga no share. A
// regra da casa é que o hub nunca apaga nada em \\server\Arte\Clientes, e uma
// tela de navegar não é lugar de abrir exceção.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { requirePerm } from "@/server/auth.server";
import { clientePastaFullPath } from "@/server/clientes.server";
import { acharPastaExata, caminhoNaPasta, lerArquivoDaPasta, listarConteudoPasta } from "@/server/files.server";
import { gravarMiniaturaCliente, lerMiniaturaCliente } from "@/server/miniaturas.server";

const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  txt: "text/plain",
};

/* Arte de etiqueta em .ai passa fácil dos 5 MB; 80 MB é folga com teto. Acima
   disso não vale trafegar em base64 — o caminho de rede resolve melhor. */
const MAX_MB = 80;

function raizDaPasta(nome: string): string {
  const exata = acharPastaExata(nome);
  if (!exata) throw new Error("Essa pasta não está mais na rede.");
  return clientePastaFullPath(exata);
}

/** Um nível da pasta: subpastas e arquivos, para a tela navegar. */
export const abrirPastaCliente = createServerFn({ method: "POST" })
  .validator(z.object({ pasta: z.string().min(1).max(200), caminho: z.string().max(400).nullish() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "tab.clientes");
    const raiz = raizDaPasta(data.pasta);
    const caminho = data.caminho ?? "";
    return { pasta: data.pasta, caminho, raiz, ...listarConteudoPasta(raiz, caminho) };
  });

const alvoArquivo = z.object({
  pasta: z.string().min(1).max(200),
  caminho: z.string().max(400).nullish(),
  nome: z.string().min(1).max(300),
});

/** Miniatura guardada, ou `null` — aí a tela desenha e devolve pela função abaixo. */
export const miniaturaArquivoCliente = createServerFn({ method: "POST" })
  .validator(alvoArquivo)
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "tab.clientes");
    const alvo = caminhoNaPasta(raizDaPasta(data.pasta), data.caminho ?? "", data.nome);
    const png = lerMiniaturaCliente(alvo);
    return { dataBase64: png ? png.toString("base64") : null };
  });

/** Guarda a miniatura que o navegador acabou de desenhar. */
export const salvarMiniaturaArquivoCliente = createServerFn({ method: "POST" })
  .validator(alvoArquivo.extend({ dataBase64: z.string().min(1).max(3_000_000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "tab.clientes");
    const alvo = caminhoNaPasta(raizDaPasta(data.pasta), data.caminho ?? "", data.nome);
    return { ok: gravarMiniaturaCliente(alvo, Buffer.from(data.dataBase64, "base64")) };
  });

/** O arquivo em si, para ver na tela ou baixar. */
export const baixarArquivoCliente = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pasta: z.string().min(1).max(200),
      caminho: z.string().max(400).nullish(),
      nome: z.string().min(1).max(300),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "tab.clientes");
    const raiz = raizDaPasta(data.pasta);
    const { conteudo, tamanho } = lerArquivoDaPasta(raiz, data.caminho ?? "", data.nome);
    if (tamanho > MAX_MB * 1024 * 1024) {
      throw new Error(`Arquivo grande demais para abrir aqui (${(tamanho / 1024 / 1024).toFixed(0)} MB). Abra pela pasta da rede.`);
    }
    const ext = data.nome.split(".").pop()?.toLowerCase() ?? "";
    return {
      nome: data.nome,
      mime: MIME_POR_EXTENSAO[ext] ?? "application/octet-stream",
      dataBase64: conteudo.toString("base64"),
    };
  });
