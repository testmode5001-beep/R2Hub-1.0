// Feriados nacionais + os da cidade de São Paulo, calculados (não é lista fixa
// que vence virando o ano). Os móveis saem da Páscoa pelo algoritmo de Meeus:
// Carnaval −48/−47, Sexta-feira Santa −2, Corpus Christi +60.
//
// Serve para o calendário da Central e para qualquer conta de prazo que não
// deva cair em dia sem expediente.

/** Domingo de Páscoa do ano (algoritmo de Meeus/Butcher). */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const somaDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export type Feriado = { nome: string; tipo: "nacional" | "municipal" | "facultativo" };

const cache = new Map<number, Map<string, Feriado>>();

/** Todos os feriados do ano, indexados por AAAA-MM-DD. */
export function feriadosDoAno(ano: number): Map<string, Feriado> {
  const guardado = cache.get(ano);
  if (guardado) return guardado;

  const p = pascoa(ano);
  const mapa = new Map<string, Feriado>();
  const por = (data: string, nome: string, tipo: Feriado["tipo"] = "nacional") => mapa.set(data, { nome, tipo });
  const fixo = (mes: number, dia: number, nome: string, tipo: Feriado["tipo"] = "nacional") =>
    por(`${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`, nome, tipo);

  // nacionais de data fixa
  fixo(1, 1, "Confraternização Universal");
  fixo(4, 21, "Tiradentes");
  fixo(5, 1, "Dia do Trabalho");
  fixo(9, 7, "Independência do Brasil");
  fixo(10, 12, "Nossa Senhora Aparecida");
  fixo(11, 2, "Finados");
  fixo(11, 15, "Proclamação da República");
  fixo(11, 20, "Consciência Negra");          // nacional desde 2024
  fixo(12, 25, "Natal");

  // móveis (Carnaval e Corpus Christi são ponto facultativo, mas a fábrica para)
  por(iso(somaDias(p, -48)), "Carnaval", "facultativo");
  por(iso(somaDias(p, -47)), "Carnaval", "facultativo");
  por(iso(somaDias(p, -46)), "Quarta-feira de Cinzas (até 12h)", "facultativo");
  por(iso(somaDias(p, -2)), "Sexta-feira Santa");
  por(iso(somaDias(p, 60)), "Corpus Christi", "facultativo");

  // cidade de São Paulo
  fixo(1, 25, "Aniversário de São Paulo", "municipal");

  cache.set(ano, mapa);
  return mapa;
}

/** Feriado do dia (AAAA-MM-DD) ou null. */
export function feriadoEm(dataIso: string): Feriado | null {
  const ano = Number(String(dataIso).slice(0, 4));
  if (!ano) return null;
  return feriadosDoAno(ano).get(dataIso) ?? null;
}
