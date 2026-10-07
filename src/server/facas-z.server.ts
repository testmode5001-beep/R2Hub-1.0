// Z REAL das facas, lido de "Relação de Ferramentais\Facas por Z\facas".
//
// A equipe arquiva o desenho de cada faca numa pasta com o nome do Z do
// cilindro — 38z, 48z, …, 102z. São 313 facas arquivadas assim, mantidas à
// mão, e até agora o hub ignorava isso: `facas-cilindro.ts` tem uma tabela de
// Z escrita no código com ~60 entradas e ESTIMA o resto pelo tamanho da
// etiqueta. A estimativa erra, e ela é a base de outras duas contas que a
// ficha técnica mostra (repetições e diâmetro).
//
// Nada é escrito aqui: a pasta é da equipe, o hub só lê o nome dela.
//
// Duas irregularidades reais da pasta, tratadas de propósito:
//   · a pasta "102" não tem o "z" no nome — o z é opcional no padrão;
//   · "MAQFLEX CLASSIC 160" não é um Z, é uma MÁQUINA, e tem 55z e 86z
//     dentro. Descemos um nível nela: a faca ganha o Z e, de quebra, o nome
//     da máquina em que roda.
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { chaveFaca } from "@/lib/chave-faca";
import { facasPdfDir } from "./facas-pdf.server";

/** …\Relação de Ferramentais\Facas por Z\facas — irmã da pasta dos desenhos. */
function porZDir(): string {
  return path.join(path.dirname(facasPdfDir()), "Facas por Z", "facas");
}

export type ZDaFaca = { z: number; maquina: string | null; morta: boolean };

/** "48z" → 48, "102" → 102, "MAQFLEX CLASSIC 160" → null. */
const zDoNome = (nome: string): number | null => {
  const m = /^(\d{1,3})\s*z?$/i.exec(nome.trim());
  if (!m) return null;
  const z = Number(m[1]);
  /* Cilindro de flexo vai de ~30 a ~200 dentes. Fora disso o número é outra
     coisa — o "160" do nome de uma máquina, por exemplo. */
  return z >= 20 && z <= 220 ? z : null;
};

const PASTA_MORTAS = "mortas";

/** Lê uma pasta de Z e despeja as facas no mapa. */
function lerPastaZ(dir: string, z: number, maquina: string | null, dentro: Map<string, ZDaFaca>) {
  let itens: import("node:fs").Dirent[];
  try { itens = readdirSync(dir, { withFileTypes: true }); } catch { return; }

  for (const it of itens) {
    if (it.isDirectory()) {
      /* subpasta "Mortas": mesma coisa, só que aposentada */
      if (it.name.toLowerCase() === PASTA_MORTAS) {
        let mortas: string[];
        try { mortas = readdirSync(path.join(dir, it.name)); } catch { continue; }
        for (const f of mortas) {
          if (!f.toLowerCase().endsWith(".pdf")) continue;
          const k = chaveFaca(f);
          /* Viva manda: se o mesmo desenho está na raiz do Z e na Mortas, ele
             está em uso — foi tirado da aposentadoria e ninguém apagou a cópia. */
          if (!dentro.has(k)) dentro.set(k, { z, maquina, morta: true });
        }
      }
      continue;
    }
    if (!it.name.toLowerCase().endsWith(".pdf")) continue;
    const k = chaveFaca(it.name);
    const antes = dentro.get(k);
    if (!antes || antes.morta) dentro.set(k, { z, maquina, morta: false });
  }
}

/* A árvore inteira são ~50 pastas numa unidade de rede. Lê uma vez e guarda,
   igual à Relação — sem isto, abrir uma família percorreria o share. */
let cache: { quando: number; mapa: Map<string, ZDaFaca> } | null = null;
const CACHE_MS = 5 * 60_000;

export function lerZDasFacas(forcar = false): Map<string, ZDaFaca> {
  if (!forcar && cache && Date.now() - cache.quando < CACHE_MS) return cache.mapa;

  const raiz = porZDir();
  const mapa = new Map<string, ZDaFaca>();
  let itens: import("node:fs").Dirent[] = [];
  try {
    if (existsSync(raiz)) itens = readdirSync(raiz, { withFileTypes: true });
  } catch {
    /* share fora do ar: devolve o que já havia, ou vazio — a tela volta a
       estimar o Z, que é o comportamento de antes desta leitura existir */
    return cache?.mapa ?? new Map();
  }

  for (const it of itens) {
    if (!it.isDirectory()) continue;
    const z = zDoNome(it.name);
    if (z !== null) { lerPastaZ(path.join(raiz, it.name), z, null, mapa); continue; }

    /* Não é um Z: trata como MÁQUINA e desce um nível atrás dos Z dela. */
    const maquina = it.name.trim();
    let dentro: import("node:fs").Dirent[];
    try { dentro = readdirSync(path.join(raiz, it.name), { withFileTypes: true }); } catch { continue; }
    for (const sub of dentro) {
      if (!sub.isDirectory()) continue;
      const zm = zDoNome(sub.name);
      if (zm !== null) lerPastaZ(path.join(raiz, it.name, sub.name), zm, maquina, mapa);
    }
  }

  cache = { quando: Date.now(), mapa };
  return mapa;
}
