// A página própria do pedido virou a modal do /hub. Este arquivo só mantém a
// URL antiga viva — as notificações guardadas no banco apontam para
// /pedido/<id>. A tela original está em legado-v3/routes/pedido.$id.tsx.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pedido/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/hub", search: { tela: "pedidos", pedido: params.id } });
  },
  component: () => null,
});
