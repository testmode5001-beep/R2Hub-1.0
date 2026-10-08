// O build do hub sem o pacote do Lovable (Augusto, 08/10/2026: "tirar o
// lovable"). O @lovable.dev/vite-tanstack-config montava estes plugins por
// dentro; aqui eles estão por extenso, na mesma ordem e com as mesmas opções
// (conferido no dist/index.js do pacote, versão 2.7.7). Ficou de fora só o que
// servia ao Lovable: as devtools do TanStack, os registradores de erro do
// preview, a ponte e o proxy de arquivos do sandbox. A saída continua a do
// Nitro em node-server, na .output, que o vigia serve: compilar = publicar.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

/* a pasta do projeto, com barras normais: o vite compara o caminho inteiro */
const RAIZ = fileURLToPath(new URL(".", import.meta.url)).replace(/\\/g, "/");

/* Compilação de TESTE numa pasta separada: SAIDA_DO_BUILD=.output-teste.
   Sem ela, a saída é a .output da produção. O Nitro apaga a pasta de saída
   antes de gravar; por isso a de teste nunca pode cair dentro da .output. */
const PRODUCAO = `${RAIZ}.output`;
const SAIDA = process.env.SAIDA_DO_BUILD?.trim() ?? "";
const PASTA_SAIDA = SAIDA ? path.resolve(RAIZ, SAIDA).replace(/\\/g, "/").replace(/\/$/, "") : "";
const dentroDaProducao = (p: string) => {
  const n = path.resolve(RAIZ, p).replace(/\\/g, "/").replace(/\/$/, "").toLowerCase();
  const prod = PRODUCAO.toLowerCase();
  return n === prod || n.startsWith(`${prod}/`);
};
if (SAIDA && dentroDaProducao(PASTA_SAIDA)) {
  throw new Error(`SAIDA_DO_BUILD (${PASTA_SAIDA}) é a .output da produção. A compilação de teste vai para outra pasta.`);
}

/* a segunda trava: com a configuração resolvida, nenhuma saída de ambiente
   (cliente, SSR, Nitro) pode estar dentro da .output numa compilação de teste */
function travaDaSaidaDeTeste(): Plugin {
  return {
    name: "hub:trava-da-saida-de-teste",
    apply: "build",
    configResolved(config) {
      if (!SAIDA) return;
      const saidas = [config.build.outDir, ...Object.values(config.environments ?? {}).map((e) => e.build?.outDir)]
        .filter((d): d is string => !!d)
        .map((d) => path.resolve(config.root, d));
      const ruins = saidas.filter(dentroDaProducao);
      if (ruins.length) throw new Error(`Compilação de teste parada: ${ruins.join(", ")} fica dentro da .output da produção.`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  /* as VITE_* do .env, escritas no código como o pacote fazia */
  const env = loadEnv(mode, RAIZ, "VITE_");
  const define = Object.fromEntries(Object.entries(env).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]));
  return {
    define,
    /* o CSS passa pelo lightningcss, como antes (o styles.css foi acertado
       com ele: ver a nota do animation inteiro) */
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${RAIZ}src` },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
      ignoreOutdatedRequests: true,
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        /* o navegador não importa nada de src/server (nem "server-only") */
        importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } },
        server: { entry: "server" },
      }),
      /* o Nitro só entra na compilação; no dev, o próprio TanStack serve */
      command === "build" && nitro({
        preset: "node-server",
        ...(PASTA_SAIDA ? { output: { dir: PASTA_SAIDA, serverDir: `${PASTA_SAIDA}/server`, publicDir: `${PASTA_SAIDA}/public` } } : {}),
      }),
      viteReact(),
      travaDaSaidaDeTeste(),
    ],
    server: {
      host: true,          // escuta na rede, não só em localhost
      port: 8080,
      // O vite recusa com 403 ("This host is not allowed") quem chega pelo NOME
      // da máquina; só IP passa por padrão. Numa rede interna isso só atrapalha:
      // o celular que abre http://desktop-f65eh8s:8081 tomava bloqueio.
      allowedHosts: true,
      /* Espera o arquivo terminar de ser gravado antes de recarregar (1 s), e
         não vigia as pastas de compilação: em 08/10/2026 a compilação de
         teste gravando na .output-teste derrubou o hub de teste (o Windows
         respondeu EBUSY ao vigia num arquivo ainda sendo gravado). */
      watch: { awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 100 }, ignored: ["**/.output/**", "**/.output-teste/**"] },
      /* O servidor de teste entrega qualquer arquivo da pasta do projeto a
         quem pedir pela rede, e o bloqueio padrão do vite só cobre .env,
         .crt/.pem e .git: ficavam abertos o banco de produção, a chave da CA
         e as senhas da simulação (revisão de segurança, 08/10/2026). Os
         quatro primeiros são o padrão do vite (a lista substitui, não soma).
         Vale só para os hubs de teste; a produção serve o .output. */
      fs: {
        deny: [
          ".env", ".env.*", "*.{crt,pem}", "**/.git/**",
          `${RAIZ}data/**`, `${RAIZ}certs/**`, `${RAIZ}dev-data/**`, `${RAIZ}logs/**`, `${RAIZ}runtime/**`,
          "*.key", "*.db", "*.db-*",
        ],
      },
    },
  };
});
