// Os porta-clichês de cada máquina (Augusto, 08/10/2026): a tabela que a área
// dos porta-clichês em Facas mostra e que a conta de onde o pedido roda usa
// (lib/porta-cliches.ts). Só leitura por enquanto; qualquer pessoa logada vê.
import { createServerFn } from "@tanstack/react-start";

import { requireAuth } from "./auth-middleware";
import { getDb } from "@/server/db.server";
import type { PortaCliche } from "@/lib/porta-cliches";

export const listPortaCliches = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    return getDb()
      .prepare("SELECT id, maquina, z, espessura, diametro, quantidade FROM porta_cliches ORDER BY maquina, espessura, z, diametro")
      .all() as PortaCliche[];
  });
