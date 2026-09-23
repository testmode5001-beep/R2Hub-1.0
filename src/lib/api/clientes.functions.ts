// Catálogo das pastas de cliente que já existem na rede.
//
// A tela de pedido novo precisa MOSTRAR as pastas para a vendedora escolher,
// em vez de adivinhar pelo nome digitado. Sem isso, "SANTA LUZIA" caiu na
// pasta do cliente errado (o share tem "Santa Luzia" e "Casa Santa Luzia").
import { createServerFn } from "@tanstack/react-start";

import { requireAuth } from "./auth-middleware";
import { listarPastasClientes } from "@/server/files.server";

/** Só os nomes (~5 mil): a tela guarda e filtra localmente, sem ida e volta a cada tecla. */
export const listPastasClientes = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => ({ pastas: listarPastasClientes() }));
