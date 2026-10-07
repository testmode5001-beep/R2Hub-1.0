// A página própria do pedido virou o painel do /hub. Este arquivo só mantém a
// URL antiga viva — as notificações guardadas no banco apontam para
// /pedido/<id>. A tela original está em legado-v3/routes/pedido.$id.tsx.
//
// O destino é "pedidos10", e não "pedidos": esse nome não existe em tela
// nenhuma desde que a 1.0 assumiu o item do menu, e o hub mandava para a Home
// quem clicasse numa notificação — todas as do banco passam por aqui.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/pedido/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/hub", search: { tela: "pedidos10", pedido: params.id } });
  },
  component: () => null,
});
