// Extração dos campos da linha destacada da OP (regex do protótipo da tela
// Leitura). Módulo próprio porque duas telas usam: a Leitura do desktop
// (texto colado) e a página do celular (texto vindo do OCR da foto).

export type CamposOP = {
  op: string; medida: string; substrato: string; metragem: string;
  carreiras: string; nucleo: string; rolos: string; entrega: string;
};

/** Letras que o OCR troca por dígito dentro de um número. */
const LETRA_DIGITO: Record<string, string> = {
  O: "0", Q: "0", D: "0", I: "1", L: "1", "|": "1", S: "5", Z: "2", B: "8", G: "6",
};
const soDigitos = (t: string) => t.replace(/[OQDILS|ZBG]/g, (c) => LETRA_DIGITO[c] ?? c);

export function extrairOP(txt: string): CamposOP {
  const s = String(txt || "").toUpperCase();
  // a foto vira "40X40", "40 x 40", "40*40" ou "40×40" conforme a leitura
  const m = s.match(/(\d{2,3})\s*[X×*]\s*(\d{2,3})/);
  const sub = /T[EÉ]RMICO\s*AA/.test(s) ? "Térmico AA"
    : /T[EÉ]RMICO/.test(s) ? "Térmico"
    : /BOPP\s*FOSCO/.test(s) ? "BOPP fosco"
    : /BOPP\s*BRILHO/.test(s) ? "BOPP brilho"
    : /BOPP\s*PRATA|METALIZAD/.test(s) ? "BOPP prata"
    : /COUCH/.test(s) ? "Couché"
    : /POLIETILENO|PE\b/.test(s) ? "Polietileno"
    : /CARTAO|CARTÃO/.test(s) ? "Cartão couché" : "";
  // O OCR troca dígito por letra dentro do número da OP ("PO09186-002",
  // "POB9186-002") — o padrão aceita as letras e devolve tudo em dígito.
  const opBruto = (s.match(/P[0-9OQDILS|ZBG]{5,7}\s*-\s*[0-9OQDILS|ZBG]{2,3}/) || [])[0] || "";
  const op = opBruto ? "P" + soDigitos(opBruto.slice(1)).replace(/\s+/g, "") : "";
  // "30 MTS" costuma sair como "30 MIS", "30 MT5", "30 M75"
  const mtr = s.match(/(\d+(?:[.,]\d+)?)\s*M[TI1][S5]?\b/);
  return {
    op,
    medida: m ? `${m[1]}x${m[2]}` : "",
    substrato: sub,
    metragem: mtr ? mtr[1] : "",
    carreiras: (s.match(/(\d+)\s*CAR\b/) || [])[1] || "",
    nucleo: (s.match(/(\d+(?:\s+\d\/\d)?)\s*POL\b/) || [])[1] || "",
    rolos: (s.match(/([\d.]+),\d+\s*[/I|]\s*RL/) || [])[1] || "",
    entrega: (s.match(/\d{2}\/\d{2}\/\d{4}/) || [])[0] || "",
  };
}

/** Nome do cliente na linha "000356 - LOURENCINI ..." da OP. */
export function clienteDaOP(txt: string): string {
  const s = String(txt || "").toUpperCase();
  return ((s.match(/\d{6}\s*-\s*([A-ZÀ-Ú][A-ZÀ-Ú .&]{4,60})/) || [])[1] || "").trim();
}
