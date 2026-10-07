// As facas vivas do hub: a Relação de Ferramentais é a fonte da verdade, o
// catálogo antigo entra só com o que ela não tem, e as mortas saem da conta.
// Mora aqui porque a página de Facas e a calculadora de facas precisam da
// MESMA lista: se as duas contassem diferente, ninguém saberia em qual
// acreditar.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { FACAS } from "../v1a/dados/facas";
import { MEDIDAS, MORTAS_INICIAIS } from "../v1a/dados/facas-cilindro";
import { listCatalogoFacas, listRelacaoFacas } from "@/lib/api/facas.functions";

export type FacaViva = { cod: string; medida: string; sistema: string; secao: string; arquivo?: string };

/** "35×22" → { largura: "35", altura: "22" }. Só número, inteiro ou com
    fração: o ponto de "Ser. 160×40" virava largura "." e o pedido saía com a
    medida ".×160" (simulação de 28/09/2026). O sufixo (" SER") cai fora. */
export function medidaEmLados(medida: string): { largura: string; altura: string } {
  const n = (medida.match(/\d+(?:[.,]\d+)?/g) ?? []).slice(0, 2);
  return { largura: n[0] ?? "", altura: n[1] ?? "" };
}

/** A medida como o hub escreve: o "15X42" da Relação vira "15×42". */
export const medidaBonita = (medida: string) => medida.replace(/(\d)\s*[xX×*]\s*(?=\d)/g, "$1×");

/** O 1.0 não pergunta a forma: ela sai do sistema da faca, que é a informação
    que o catálogo já tem. Sem isto o pedido chegaria na produção sem forma. */
export function formaDoSistema(sistema: string, largura: string, altura: string): string {
  if (sistema === "Redonda") return "Redonda";
  if (sistema === "Gap") return "GAP";
  if (sistema === "Figura" || sistema === "Tag") {
    const a = parseFloat(largura.replace(",", ".")), b = parseFloat(altura.replace(",", "."));
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.5 ? "Quadrada" : "Retangular";
  }
  return "Recorte especial";
}

/** "fr2-263.01M" na Relação e "263.01" no catálogo antigo são a MESMA
    ferramenta: a chave tira o "fr2-" e a letra do fim. */
export const chaveFaca = (cod: string) => String(cod).replace(/^fr2-/i, "").replace(/([\d.]+)[PMD]$/i, "$1").toUpperCase();

export function useFacasVivas() {
  const relacao = useQuery<any>({
    queryKey: ["facas-relacao"],
    queryFn: () => listRelacaoFacas() as Promise<any>,
    staleTime: 5 * 60_000,
  });
  const catalogo = useQuery<any>({
    queryKey: ["facas-catalogo"],
    queryFn: () => listCatalogoFacas() as Promise<any>,
    staleTime: 60_000,
  });
  const relacaoRaw = relacao.data, catalogoRaw = catalogo.data;

  const vivas = useMemo<FacaViva[]>(() => {
    const relacao: FacaViva[] = (relacaoRaw?.facas ?? []).map((r: any) => ({
      cod: String(r.cod), medida: String(r.medida ?? ""), sistema: String(r.sistema ?? ""), secao: String(r.secao ?? ""), arquivo: String(r.arquivo ?? ""),
    }));
    /* sem a chave a mesma faca contava duas vezes */
    const chave = chaveFaca;
    const antigas = FACAS as FacaViva[];
    const base = relacao.length
      ? [...relacao, ...antigas.filter((f) => !new Set(relacao.map((r) => chave(r.cod))).has(chave(f.cod)))]
      : antigas;

    const extras: FacaViva[] = ((catalogoRaw?.extras ?? []) as string[])
      .map((j) => { try { return JSON.parse(j) as FacaViva; } catch { return null; } })
      .filter(Boolean) as FacaViva[];
    const mortas = new Set([...MORTAS_INICIAIS.map((f) => f.cod), ...((catalogoRaw?.mortas ?? []) as string[])]);
    return [...extras, ...base].filter((f) => !mortas.has(f.cod));
  }, [relacaoRaw, catalogoRaw]);

  /* Quem mostra "pronta" precisa saber se a lista está inteira: enquanto
     as consultas não voltam (ou se falharam), a Relação pode faltar e as
     mortas do banco não saem da conta (revisão de 29/09/2026).
     A Relação falha de dois jeitos: a chamada ao servidor cai, ou o servidor
     responde sem ter aberto as páginas no share. Esse segundo não é erro para
     o react-query: volta a lista vazia (e a conta cai no catálogo embutido)
     ou a da última leitura, com as páginas que não abriram em `faltaram`
     (06/10/2026). */
  const relacaoFalhou = relacao.isError
    || (!!relacaoRaw && (!relacaoRaw.facas?.length || (relacaoRaw.faltaram?.length ?? 0) > 0));
  return {
    vivas, relacaoRaw, catalogoRaw,
    relacaoLendo: relacao.isPending, relacaoFalhou,
    catalogoLendo: catalogo.isPending, catalogoFalhou: catalogo.isError,
  };
}

/** Uma faca perto da medida pedida: a diferença de cada lado (faca − pedido)
    e se ela serve DEITADA. */
export type FacaPerto = { faca: FacaViva; dl: number; da: number; deitada: boolean; dist: number };

/** As facas até `tolerancia` mm da medida em CADA lado, da mais perto para a
    mais longe. A faca vale nas duas orientações: uma 43×82 corta a etiqueta
    de 82×43 deitada no rolo. Fica a orientação que chega mais perto; empate
    fica com a reta. É a mesma conta da "medida próxima" da página de Facas. */
export function facasPerto(vivas: FacaViva[], largura: number, altura: number, tolerancia = 5, limite = 3): FacaPerto[] {
  if (!(largura > 0 && altura > 0)) return [];
  const achadas: FacaPerto[] = [];
  for (const f of vivas) {
    const n = MEDIDAS(f.medida);
    if (!n.length) continue;
    const w = n[0], h = n[1] ?? n[0];
    const reta = { dl: w - largura, da: h - altura, deitada: false };
    const outra = { dl: h - largura, da: w - altura, deitada: true };
    const d = Math.hypot(outra.dl, outra.da) < Math.hypot(reta.dl, reta.da) - 1e-9 ? outra : reta;
    if (Math.abs(d.dl) <= tolerancia + 1e-9 && Math.abs(d.da) <= tolerancia + 1e-9) {
      achadas.push({ faca: f, ...d, dist: Math.hypot(d.dl, d.da) });
    }
  }
  /* empate de distância (100x50 e 50x100 casam as duas em 0): a da medida
     como foi digitada vem antes da deitada (simulação 4: três pedidos saíram
     com a deitada, a primeira pílula) */
  return achadas.sort((a, b) => a.dist - b.dist || Number(a.deitada) - Number(b.deitada)).slice(0, limite);
}
