// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: true,  // <-- força o Nitro a rodar fora do ambiente Lovable
  vite: {
    server: {
      host: true,          // escuta na rede, não só em localhost
      // O vite recusa com 403 ("This host is not allowed") quem chega pelo NOME
      // da máquina — só IP passa por padrão. Numa rede interna isso só atrapalha:
      // o celular que abre http://desktop-f65eh8s:8081 tomava bloqueio.
      allowedHosts: true,
    },
  },
});
