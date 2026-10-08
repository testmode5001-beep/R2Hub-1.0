import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { servirPapel } from "./server/papel-http.server";
import { servirTutorial } from "./server/tutoriais.server";
import { userFromToken } from "./server/auth.server";
import { iniciarBackupDiario } from "./server/backup-banco.server";

/* o backup diário do banco para a pasta de backup da rede (ver
   backup-banco.server.ts; só liga na produção) */
iniciarBackupDiario();

/* Teto do tamanho das requisições (revisão de segurança de 02/10/2026; o
   Augusto mandou fazer). O servidor lia o corpo inteiro e fazia o parse antes
   de saber quem pedia: uma máquina qualquer da rede, sem login, travava o hub
   com um POST de centenas de MB. Agora decide pelo cabeçalho, antes de ler o
   corpo: sem login válido, até 2 MB (entrar e abrir as telas é pequeno);
   logado, até 210 MB (o vídeo do papel de parede da Home, até 150 MB, sobe em
   base64 numa requisição só); envio sem tamanho declarado não entra (o
   navegador sempre declara, e o proxy HTTPS repassa o cabeçalho). */
const TETO_SEM_LOGIN = 2 * 1024 * 1024;
const TETO_LOGADO = 210 * 1024 * 1024;
const COM_CORPO = new Set(["POST", "PUT", "PATCH"]);

function recusaPeloTamanho(request: Request): Response | null {
  if (!COM_CORPO.has(request.method)) return null;
  const texto = { "content-type": "text/plain; charset=utf-8" };
  const declarado = request.headers.get("content-length");
  if (declarado == null) return new Response("Envio sem tamanho declarado.", { status: 411, headers: texto });
  const tamanho = Number(declarado);
  if (!Number.isFinite(tamanho) || tamanho < 0) return new Response("Tamanho de envio inválido.", { status: 400, headers: texto });
  if (tamanho <= TETO_SEM_LOGIN) return null;
  if (tamanho > TETO_LOGADO) return new Response("Envio grande demais para o hub.", { status: 413, headers: texto });
  const cabecalho = request.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token || !userFromToken(token)) return new Response("Entre no hub para enviar arquivos grandes.", { status: 413, headers: texto });
  return null;
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      /* /papel/<arquivo> sai daqui, antes do roteador: o arquivo mora na
         pasta da rede e é lido a cada pedido (o estático do build só conhece
         o que existia na hora de compilar). */
      const papel = servirPapel(new URL(request.url), request.headers);
      if (papel) return papel;
      /* /tutorial/<arquivo>: os vídeos de passo a passo, da pasta da rede, do
         mesmo jeito (só leitura) */
      const tutorial = servirTutorial(new URL(request.url), request.headers);
      if (tutorial) return tutorial;

      const grandeDemais = recusaPeloTamanho(request);
      if (grandeDemais) return grandeDemais;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
