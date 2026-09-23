// Cores Pantone que a tela mostra ALÉM da tabela embutida (dados/pantone.ts).
// A tabela embutida é uma cópia do color book na hora do build; quando a Adobe
// entrega uma leva nova, o botão "Procurar cores novas" lê o livro instalado e
// guarda a diferença aqui — assim a cor nova aparece na hora, sem esperar um
// build. O `scripts/gerar-pantone.mjs` continua sendo a faxina: dobra os
// extras de volta na tabela base.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { getSetting, setSetting } from "@/server/db.server";
import { requirePerm } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { lerLivroPantone, type CorPantone } from "@/server/pantone-acb.server";
import { PANTONE_SC } from "@/components/v1a/dados/pantone";

const CHAVE = "pantone.extras";

type Guardado = { livro: string; quando: string; cores: CorPantone[] };

function lerGuardado(): Guardado {
  try {
    const cru = getSetting(CHAVE, "");
    if (!cru) return { livro: "", quando: "", cores: [] };
    const g = JSON.parse(cru) as Guardado;
    return { livro: g.livro ?? "", quando: g.quando ?? "", cores: Array.isArray(g.cores) ? g.cores : [] };
  } catch {
    return { livro: "", quando: "", cores: [] };
  }
}

/** As cores extras já aplicadas — a tela junta com a tabela embutida. */
export const listPantoneExtras = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => lerGuardado());

/**
 * Confere a tabela do hub contra o color book instalado.
 * `aplicar: false` só olha; `true` grava as cores que faltam.
 */
export const conferirPantone = createServerFn({ method: "POST" })
  .validator(z.object({ aplicar: z.boolean().optional().default(false) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");

    const livro = lerLivroPantone();
    if (!livro) {
      return {
        ok: false as const,
        motivo: "Não achei nenhum color book Pantone instalado nesta máquina. O livro vem com o Illustrator/Photoshop.",
        livro: "", titulo: "", noLivro: 0, noHub: 0, novas: [] as string[], aplicadas: 0,
      };
    }

    const guardado = lerGuardado();
    const conhecidas = new Set<string>();
    for (const c of PANTONE_SC) conhecidas.add(c.c.toUpperCase());
    for (const c of guardado.cores) conhecidas.add(c.c.toUpperCase());

    const faltando = livro.cores.filter((c) => !conhecidas.has(c.c.toUpperCase()));
    const noHub = conhecidas.size;

    let aplicadas = 0;
    if (data.aplicar && faltando.length) {
      const novo: Guardado = {
        livro: livro.titulo,
        quando: new Date().toISOString(),
        cores: guardado.cores.concat(faltando),
      };
      setSetting(CHAVE, JSON.stringify(novo), user.id);
      aplicadas = faltando.length;
      audit({ id: user.id, nome: user.nome }, "pantone.atualizar", "settings", null, {
        livro: livro.titulo, arquivo: livro.arquivo, novas: aplicadas,
        exemplos: faltando.slice(0, 20).map((c) => c.c),
      });
    }

    return {
      ok: true as const,
      motivo: "",
      livro: livro.arquivo,
      titulo: livro.titulo,
      noLivro: livro.cores.length,
      noHub,
      novas: faltando.map((c) => c.c),
      aplicadas,
    };
  });
