// HTTPS do R2 Hub — https://hub.r2etiquetas.com.br
//
// O app continua em HTTP na 8081 (nitro). Este processo fica na frente:
//   · porta 443: TLS com o certificado de certs/, repassando tudo para a 8081;
//   · porta 80: só redireciona para o endereço https.
// Sem dependência externa: é o https/http do próprio Node, e o repasse é
// stream puro (upload, download e Range de vídeo passam inteiros).
import { createServer as criarHttps } from "node:https";
import { createServer as criarHttp, request as pedirHttp } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const raiz = path.resolve(import.meta.dirname, "..");
const NOME = "hub.r2etiquetas.com.br";
const ALVO = { host: "127.0.0.1", port: 8081 };

let tls;
try {
  tls = {
    cert: readFileSync(path.join(raiz, "certs", "hub.crt")),
    key: readFileSync(path.join(raiz, "certs", "hub.key")),
  };
} catch {
  console.error("[https] certs/hub.crt|hub.key não encontrados — rode a geração de certificado.");
  process.exit(1);
}

/* O teto do servidor (src/server.ts) também aqui, antes de repassar: acima de
   210 MB, ou sem tamanho declarado, nem chega à 8081 (revisão de segurança,
   02/10/2026). Quem decide o limite de quem não entrou é o servidor. */
const TETO = 210 * 1024 * 1024;
const COM_CORPO = new Set(["POST", "PUT", "PATCH"]);

const seguro = criarHttps(tls, (req, res) => {
  if (COM_CORPO.has(req.method ?? "")) {
    const declarado = req.headers["content-length"];
    const tamanho = declarado == null ? NaN : Number(declarado);
    if (declarado == null || !Number.isFinite(tamanho) || tamanho > TETO) {
      res.writeHead(declarado == null ? 411 : 413, { "content-type": "text/plain; charset=utf-8", connection: "close" });
      /* fecha só depois que a resposta saiu: sem ler o corpo que vinha */
      res.end(declarado == null ? "Envio sem tamanho declarado." : "Envio grande demais para o hub.", () => req.destroy());
      return;
    }
  }
  const repasse = pedirHttp(
    { ...ALVO, path: req.url, method: req.method, headers: { ...req.headers } },
    (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  repasse.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("O hub está reiniciando. Tente de novo em alguns segundos.");
  });
  req.pipe(repasse);
});

seguro.on("error", (e) => {
  // outra cópia já está com a porta (o servidor.ps1 reiniciou): sai quieto
  console.error("[https] porta 443:", e.code ?? e.message);
  process.exit(0);
});
seguro.listen(443, () => console.log(`[https] no ar: https://${NOME}/`));

// HTTP 80 → HTTPS (quem digita o nome sem https cai no lugar certo)
const redirecionador = criarHttp((req, res) => {
  const host = String(req.headers.host ?? NOME).split(":")[0];
  res.writeHead(301, { location: `https://${host}${req.url}` });
  res.end();
});
redirecionador.on("error", (e) => console.error("[http80]", e.code ?? e.message));
redirecionador.listen(80, () => console.log("[http80] redirecionando para https"));

// 8082 → 8081: a porta foi do servidor de DESENVOLVIMENTO durante os testes
// de agosto/26 e ficou salva em favoritos da equipe. O dev foi desligado
// (banco compartilhado + arquivos numa pasta local = anexo que sumia);
// quem ainda aponta para cá cai no hub de verdade.
const antigo = criarHttp((req, res) => {
  const host = String(req.headers.host ?? NOME).split(":")[0];
  res.writeHead(301, { location: `http://${host}:8081${req.url}` });
  res.end();
});
antigo.on("error", (e) => console.error("[http8082]", e.code ?? e.message));
antigo.listen(8082, () => console.log("[http8082] favoritos antigos redirecionando para :8081"));
