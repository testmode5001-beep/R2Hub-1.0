// A tabela Pantone do jeito que o hub mostra: a embutida (dados/pantone.ts,
// gerada no build), com os valores que um livro mais novo corrigiu, mais as
// cores que só o livro novo tem. As duas últimas vêm do banco (pantone.extras),
// gravadas quando o administrador atualiza a tabela pela tela Pantones; assim
// a leva nova aparece na hora, sem publicar. A tela Pantones e a caixa
// "Escolher cor" usam esta mesma conta, para nunca mostrarem tabelas diferentes.
import { PANTONE_SC } from "./pantone";

export type CorCrua = { c: string; h: string; l: [number, number, number] };
export type ExtrasPantone = { livro?: string; quando?: string; cores?: CorCrua[]; alteradas?: CorCrua[] };

export function tabelaViva(extras?: ExtrasPantone | null): (CorCrua & { origem: "sc" | "extra" })[] {
  const alteradas = new Map((extras?.alteradas ?? []).map((c) => [String(c.c).toUpperCase(), c]));
  const vistos = new Set<string>();
  const lista: (CorCrua & { origem: "sc" | "extra" })[] = [];
  for (const c of PANTONE_SC) {
    const k = c.c.toUpperCase();
    vistos.add(k);
    const nova = alteradas.get(k);
    lista.push({ ...(nova ?? c), c: c.c, origem: "sc" });
  }
  /* Depois de rodar o gerar-pantone.mjs, as cores novas entram na tabela
     embutida e continuam nos extras do banco: sem tirar as repetidas, cada
     uma aparecia duas vezes. */
  for (const c of extras?.cores ?? []) {
    const k = String(c.c).toUpperCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    lista.push({ ...c, origem: "extra" });
  }
  return lista;
}
