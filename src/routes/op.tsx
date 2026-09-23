// /op — atalho para a leitura de OP no celular. Digitar "…:8081/op" no
// telefone é bem menos trabalhoso do que "/m/leitura", e é este endereço que
// vai no cartaz ao lado da máquina.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/op")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/m/leitura" });
  },
  component: () => null,
});
