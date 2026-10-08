// Cores Pantone que a tela mostra ALÉM da tabela embutida (dados/pantone.ts).
// A tabela embutida é uma cópia do color book na hora do build; quando a Adobe
// entrega uma leva nova, o botão "Procurar cores novas" lê o livro instalado e
// guarda a diferença aqui — assim a cor nova aparece na hora, sem esperar um
// build. O `scripts/gerar-pantone.mjs` continua sendo a faxina: dobra os
// extras de volta na tabela base.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { getDb, getSetting, setSetting } from "@/server/db.server";
import { requirePerm } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { guardarLivroEnviado, lerLivroEnviado, lerLivroPantone, type CorPantone, type LivroPantone } from "@/server/pantone-acb.server";
import { PANTONE_SC } from "@/components/v1a/dados/pantone";
import { coresEfetivas } from "@/lib/cores";

const CHAVE = "pantone.extras";

/* cores: as que a tabela embutida não tem. alteradas: as que ela tem, mas
   com o Lab que o livro novo trouxe (vale o do livro). */
type Guardado = { livro: string; quando: string; cores: CorPantone[]; alteradas?: CorPantone[] };

function lerGuardado(): Guardado {
  try {
    const cru = getSetting(CHAVE, "");
    if (!cru) return { livro: "", quando: "", cores: [] };
    const g = JSON.parse(cru) as Guardado;
    return { livro: g.livro ?? "", quando: g.quando ?? "", cores: Array.isArray(g.cores) ? g.cores : [], alteradas: Array.isArray(g.alteradas) ? g.alteradas : [] };
  } catch {
    /* A chave vazia já saiu acima; aqui é banco com erro ou texto que não é
       JSON. Devolver "nenhuma extra" fazia as cores novas sumirem sem aviso
       (e os pedidos com elas saíam dos Usados). A tela avisa quando falha. */
    throw new Error("Não deu para ler as cores novas guardadas no hub.");
  }
}

/** As cores das artes aprovadas em todo o hub, para a "Cores de outros
    clientes" da Solicitação (Augusto, 07/10/2026: "mostra todas as cores
    aprovadas no hub"; a vendedora só via as da carteira dela, e a nova não
    via nenhuma). Só o texto das cores de cada pedido, sem cliente nem número:
    nenhuma carteira aparece. As da arte quando a prova foi lida; senão as
    pedidas. Aprovado é a regra da tela Pantones (o pedido em Aprovado,
    Clicheria, Refazer clichê ou Finalizado). */
export const listCoresAprovadas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => {
    const linhas = getDb()
      .prepare(`SELECT cores_desc, cores_arte FROM pedidos
                WHERE status IN ('aprovada', 'cliche', 'refazer_cliche', 'concluido')`)
      .all() as { cores_desc: string | null; cores_arte: string | null }[];
    return linhas.map(coresEfetivas).filter(Boolean);
  });

/** As cores extras já aplicadas: a tela junta com a tabela embutida. */
export const listPantoneExtras = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => lerGuardado());

/* ————— comparar um livro com a tabela do hub ————— */
const mesmoLab = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.5 && Math.abs(a[2] - b[2]) < 0.5;

/** O que o livro traz de diferente da tabela que o hub mostra hoje
    (embutida + extras já aplicadas). */
function compararLivro(livro: LivroPantone, guardado: Guardado) {
  const atual = new Map<string, CorPantone>();
  for (const c of PANTONE_SC) atual.set(c.c.toUpperCase(), c as CorPantone);
  for (const c of guardado.alteradas ?? []) atual.set(c.c.toUpperCase(), c);
  for (const c of guardado.cores) atual.set(c.c.toUpperCase(), c);
  const novas: CorPantone[] = [];
  const alteradas: { antes: CorPantone; depois: CorPantone }[] = [];
  for (const c of livro.cores) {
    const velha = atual.get(c.c.toUpperCase());
    if (!velha) novas.push(c);
    else if (!mesmoLab(velha.l, c.l)) alteradas.push({ antes: velha, depois: c });
  }
  return { novas, alteradas, noHub: atual.size };
}

/* Livro com bem menos cores que a tabela é edição antiga (o "PANTONE+" de
   antes de 2024 tem ~2.100): aplicar trocaria valores novos por velhos. */
function recusarSeAntigo(livro: LivroPantone, noHub: number) {
  if (livro.cores.length < noHub * 0.95) {
    throw new Error(`Esse livro tem ${livro.cores.length.toLocaleString("pt-BR")} cores e a tabela do hub tem ${noHub.toLocaleString("pt-BR")}: parece uma edição mais antiga. Escolha o livro mais novo.`);
  }
}

/** Grava as novidades de um livro nos extras (não apaga nada do que já estava). */
function aplicarNoGuardado(livro: LivroPantone, guardado: Guardado, novas: CorPantone[], alteradas: CorPantone[], userId: string) {
  const embutida = new Set(PANTONE_SC.map((c) => c.c.toUpperCase()));
  const cores = new Map(guardado.cores.map((c) => [c.c.toUpperCase(), c]));
  for (const c of novas) cores.set(c.c.toUpperCase(), c);
  const alt = new Map((guardado.alteradas ?? []).map((c) => [c.c.toUpperCase(), c]));
  for (const c of alteradas) {
    const k = c.c.toUpperCase();
    /* cor que já era extra: o valor novo substitui lá mesmo */
    if (cores.has(k) && !embutida.has(k)) cores.set(k, c); else alt.set(k, c);
  }
  const novo: Guardado = { livro: livro.titulo, quando: new Date().toISOString(), cores: [...cores.values()], alteradas: [...alt.values()] };
  setSetting(CHAVE, JSON.stringify(novo), userId);
}

/* O arquivo chega em base64. Um Solid Coated tem ~150 KB; 8 MB é folga. */
const ARQUIVO = z.object({ nome: z.string().min(1).max(200), base64: z.string().min(40).max(12_000_000) });
const decodificar = (b64: string) => Buffer.from(b64.replace(/^data:[^,]*,/, ""), "base64");

/** Lê o livro que o administrador escolheu e diz o que mudaria. Não grava. */
export const previaLivroPantone = createServerFn({ method: "POST" })
  .validator(ARQUIVO)
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");
    try {
      const livro = lerLivroEnviado(data.nome, decodificar(data.base64));
      const { novas, alteradas, noHub } = compararLivro(livro, lerGuardado());
      recusarSeAntigo(livro, noHub);
      return {
        ok: true as const, motivo: "", titulo: livro.titulo, noLivro: livro.cores.length, noHub,
        novas: novas.map((c) => ({ c: c.c, h: c.h })),
        alteradas: alteradas.map((a) => ({ c: a.depois.c, antes: a.antes.h, depois: a.depois.h })),
      };
    } catch (e) {
      return { ok: false as const, motivo: e instanceof Error ? e.message : String(e), titulo: "", noLivro: 0, noHub: 0, novas: [] as { c: string; h: string }[], alteradas: [] as { c: string; antes: string; depois: string }[] };
    }
  });

/** Aplica o livro escolhido: guarda o arquivo na pasta do hub e grava as novidades. */
export const aplicarLivroPantone = createServerFn({ method: "POST" })
  .validator(ARQUIVO)
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");
    const conteudo = decodificar(data.base64);
    const livro = lerLivroEnviado(data.nome, conteudo);
    const guardado = lerGuardado();
    const { novas, alteradas, noHub } = compararLivro(livro, guardado);
    recusarSeAntigo(livro, noHub);
    const arquivo = guardarLivroEnviado(data.nome, conteudo);
    if (novas.length || alteradas.length) aplicarNoGuardado(livro, guardado, novas, alteradas.map((a) => a.depois), user.id);
    audit({ id: user.id, nome: user.nome }, "pantone.atualizar", "settings", null, {
      origem: "arquivo", livro: livro.titulo, arquivo, novas: novas.length, alteradas: alteradas.length,
      exemplos: novas.slice(0, 20).map((c) => c.c),
    });
    return { titulo: livro.titulo, novas: novas.length, alteradas: alteradas.length };
  });

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
      /* grava pelo mesmo caminho do arquivo enviado: o objeto montado aqui
         deixava as alteradas de fora e apagava as correções vindas de um .acb */
      aplicarNoGuardado(livro, guardado, faltando, [], user.id);
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
