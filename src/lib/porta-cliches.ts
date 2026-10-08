// Porta-clichês por máquina: a conta de onde um pedido roda (Augusto,
// 08/10/2026: "as facas e porta clichê são um conjunto, e cada máquina tem os
// seus; se uma máquina não tem um porta clichê de tamanho x e gravamos o
// clichê para ela, não dá para rodar o pedido, então precisamos nos
// prevenir"). O porta-clichê precisa ter o mesmo Z da faca, a espessura do
// clichê e uma unidade por cor; o verniz usa mais uma, do mesmo Z ("2 - sim").
// Serve à tela (a área dos porta-clichês em Facas, a escolha da faca, o Enviar
// p/ clicheria) e ao servidor: não importa nada de node.

export type Espessura = "1.14" | "1.70";
export type PortaCliche = { id?: string; maquina: string; z: number; espessura: Espessura; diametro: number | null; quantidade: number };
export type Maquina = { nome: string; cores: number; verniz: boolean; zMinimo: number | null; espessuras: Espessura[] };

/* As regras de cada máquina, ditas pelo Augusto em 08/10/2026:
   - Classic: 4 cores (CMYK) e verniz; clichê 1,14 ou 1,70; engrenagem a
     partir de 50Z ("1 - é 50z");
   - Del Rey: 4 cores, só clichê 1,70, a partir de 50Z;
   - GGS e Maqflex: 3 cores, clichê 1,70.
   Só a Classic foi dita com verniz; nas outras o verniz não conta (a
   perguntar). */
export const MAQUINAS: Maquina[] = [
  { nome: "Classic", cores: 4, verniz: true, zMinimo: 50, espessuras: ["1.14", "1.70"] },
  { nome: "Del Rey", cores: 4, verniz: false, zMinimo: 50, espessuras: ["1.70"] },
  { nome: "GGS", cores: 3, verniz: false, zMinimo: null, espessuras: ["1.70"] },
  { nome: "Maqflex", cores: 3, verniz: false, zMinimo: null, espessuras: ["1.70"] },
];

/** "1.14" → "1,14" */
export const espessuraBR = (e: string) => e.replace(".", ",");

export type OndeRoda = { maquina: string; espessura: Espessura; cabe: boolean; precisa: number; tem: number; motivo?: string };

/** Para cada máquina e espessura (ou só a pedida), se o pedido roda e, se não,
    por quê. `cores` é o número de cores do pedido; o verniz soma um porta. */
export function ondeRoda(p: { z: number | null | undefined; cores: number; verniz?: boolean; espessura?: Espessura | null },
  portas: PortaCliche[], maquinas: Maquina[] = MAQUINAS): OndeRoda[] {
  const z = Number(p.z);
  if (!Number.isFinite(z) || z <= 0) return [];
  const cores = Math.max(1, Math.round(p.cores || 1));
  const precisa = cores + (p.verniz ? 1 : 0);
  const saida: OndeRoda[] = [];
  for (const m of maquinas) {
    for (const e of m.espessuras) {
      if (p.espessura && e !== p.espessura) continue;
      const tem = portas.filter((x) => x.maquina === m.nome && x.z === z && x.espessura === e).reduce((s, x) => s + (x.quantidade || 0), 0);
      let motivo: string | undefined;
      if (m.zMinimo && z < m.zMinimo) motivo = `A ${m.nome} só aceita engrenagem a partir de ${m.zMinimo}Z.`;
      else if (cores > m.cores) motivo = `A ${m.nome} faz até ${m.cores} cores.`;
      else if (p.verniz && !m.verniz) motivo = `A ${m.nome} não faz verniz.`;
      else if (!tem) motivo = `A ${m.nome} não tem porta-clichê de ${z}Z para clichê ${espessuraBR(e)}.`;
      else if (tem < precisa) motivo = `A ${m.nome} tem ${tem} ${tem === 1 ? "porta-clichê" : "porta-clichês"} de ${z}Z para clichê ${espessuraBR(e)}; o pedido precisa de ${precisa}.`;
      saida.push({ maquina: m.nome, espessura: e, cabe: !motivo, precisa, tem, motivo });
    }
  }
  return saida;
}

/** "Classic, com clichê 1,14 ou 1,70 e na Del Rey, com clichê 1,70" (a lista
    do que cabe; a máquina que serve nas duas espessuras aparece uma vez). */
function listaDoQueCabe(r: OndeRoda[]): string {
  const porMaquina = new Map<string, string[]>();
  for (const x of r.filter((y) => y.cabe)) porMaquina.set(x.maquina, [...(porMaquina.get(x.maquina) ?? []), espessuraBR(x.espessura)]);
  const partes = [...porMaquina].map(([m, es]) => `${m}, com clichê ${es.join(" ou ")}`);
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join("; na ")} e na ${partes[partes.length - 1]}`;
}

/** "Classic e na Del Rey" (só os nomes, para depois de "na") */
function listaDeMaquinas(ms: string[]): string {
  if (ms.length <= 1) return ms.join("");
  return `${ms.slice(0, -1).join(", na ")} e na ${ms[ms.length - 1]}`;
}

/** A frase curta para a tela: onde roda, ou o aviso de que nenhuma máquina tem. */
export function resumoOndeRoda(r: OndeRoda[], p: { z: number | null | undefined; cores: number; verniz?: boolean }): { cabe: boolean; texto: string } {
  if (!r.length) return { cabe: true, texto: "" };
  const cabe = r.filter((x) => x.cabe);
  const cores = Math.max(1, Math.round(p.cores || 1));
  const para = `${cores} ${cores === 1 ? "cor" : "cores"}${p.verniz ? " e verniz" : ""}`;
  if (cabe.length) return { cabe: true, texto: `Roda na ${listaDoQueCabe(r)} (${para}).` };
  return { cabe: false, texto: `Nenhuma máquina tem porta-clichê de ${p.z}Z para ${para}. Confira antes de gravar o clichê.` };
}

/** Na escolha da faca, antes das cores: as máquinas que têm porta-clichê do Z
    (respeitando a engrenagem mínima de cada uma). */
export function maquinasComZ(z: number, portas: PortaCliche[], maquinas: Maquina[] = MAQUINAS): string[] {
  return maquinas.filter((m) => !(m.zMinimo && z < m.zMinimo)
    && portas.some((x) => x.maquina === m.nome && x.z === z && m.espessuras.includes(x.espessura) && x.quantidade > 0)).map((m) => m.nome);
}

/** A linha da faca escolhida no Novo pedido: sem as cores, onde há porta-clichê
    do Z; com as cores, onde roda. `alerta` quando nenhuma máquina serve. */
export function avisoDaFaca(p: { z: number | null | undefined; cores?: number; verniz?: boolean }, portas: PortaCliche[]): { alerta: boolean; texto: string } | null {
  const z = Number(p.z);
  if (!Number.isFinite(z) || z <= 0 || !portas.length) return null;
  if (!p.cores) {
    const ms = maquinasComZ(z, portas);
    return ms.length ? { alerta: false, texto: `Faca de ${z}Z: tem porta-clichê na ${listaDeMaquinas(ms)}.` }
      : { alerta: true, texto: `Nenhuma máquina tem porta-clichê de ${z}Z. Confira antes de gravar o clichê.` };
  }
  const r = resumoOndeRoda(ondeRoda({ z, cores: p.cores, verniz: p.verniz }, portas), { z, cores: p.cores, verniz: p.verniz });
  return { alerta: !r.cabe, texto: r.cabe ? `Faca de ${z}Z. ${r.texto}` : r.texto };
}

/** No Enviar p/ clicheria, com a espessura escolhida: onde roda com ela; se
    nenhuma máquina serve, o aviso e, se a outra espessura servir, onde. */
export function avisoDaClicheria(p: { z: number | null | undefined; cores: number; verniz?: boolean; espessura: Espessura },
  portas: PortaCliche[]): { alerta: boolean; texto: string } | null {
  const z = Number(p.z);
  if (!Number.isFinite(z) || z <= 0 || !portas.length || !p.cores) return null;
  const cores = Math.max(1, Math.round(p.cores));
  const para = `${cores} ${cores === 1 ? "cor" : "cores"}${p.verniz ? " e verniz" : ""}`;
  const servem = (e: Espessura) => ondeRoda({ z, cores, verniz: p.verniz, espessura: e }, portas).filter((x) => x.cabe).map((x) => x.maquina);
  const com = servem(p.espessura);
  if (com.length) return { alerta: false, texto: `Com clichê ${espessuraBR(p.espessura)}, roda na ${listaDeMaquinas(com)} (${z}Z, ${para}).` };
  const outra: Espessura = p.espessura === "1.14" ? "1.70" : "1.14";
  const naOutra = servem(outra);
  return {
    alerta: true,
    texto: `Com clichê ${espessuraBR(p.espessura)}, nenhuma máquina tem porta-clichê de ${z}Z para ${para}.`
      + (naOutra.length ? ` Com ${espessuraBR(outra)}, roda na ${listaDeMaquinas(naOutra)}.` : " Confira antes de enviar."),
  };
}
