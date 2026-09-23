// Fila de leituras de OP (tela Leitura → painel da Fábrica), persistida em
// localStorage até existir backend. Espelha window.R2.leituras() do protótipo.
export type Leitura = {
  id: string;
  op: string;
  num?: string;
  cliente?: string;
  descricao?: string;
  medida: string;
  substrato: string;
  metragem: string;
  carreiras?: string;
  nucleo?: string;
  rolos?: string;
  entrega?: string;
  quando: string;
  usada: boolean;
};

const CHAVE = "r2.leituras.v1";

export function lerLeituras(): Leitura[] {
  if (typeof window === "undefined") return [];
  try {
    const cru = localStorage.getItem(CHAVE);
    if (cru) {
      const l = JSON.parse(cru);
      if (Array.isArray(l)) return l;
    }
  } catch { /* corrompido → vazio */ }
  return [];
}

function gravar(lista: Leitura[]) {
  try { localStorage.setItem(CHAVE, JSON.stringify(lista.slice(0, 100))); } catch { /* indisponível */ }
}

export function registrarLeitura(dados: Omit<Leitura, "id" | "quando" | "usada">): Leitura {
  const agora = new Date();
  const l: Leitura = {
    ...dados,
    id: "l" + Date.now(),
    quando: `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")} · hoje`,
    usada: false,
  };
  gravar([l, ...lerLeituras()]);
  return l;
}

export function marcarLeituraUsada(id: string) {
  gravar(lerLeituras().map((l) => (l.id === id ? { ...l, usada: true } : l)));
}
