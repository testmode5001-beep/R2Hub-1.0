// Estoque (faltas de MP + etiquetas por caixa). Os dados moram no BANCO —
// antes era localStorage, o que fazia cada computador ver uma lista diferente
// e sumir tudo ao limpar o cache. Aqui só ficam os tipos, o formato de exibição
// e a ponte com as server functions.
import {
  ajustarEtiquetaEstoque, listEstoque, mudarFalta, registrarFalta,
  removerEtiquetaEstoque, salvarEtiquetaEstoque,
} from "@/lib/api/estoque.functions";

export const MOTIVOS_MP = ["Substrato acabou", "Metragem insuficiente no rolo", "Largura indisponível", "Aguardando entrega do fornecedor"];

export type FaltaMP = {
  id: string;
  num: string;
  motivo: string;
  obs: string;
  quem: string;
  data: string;   // dd/mm/aa
  hora: string;   // hh:mm
  previsao: string;
  status: "aberta" | "resolvida" | "substituida";
  substituto?: string;
  resolvidoEm?: string;
  resolvidoPor?: string;
};

export type Etiqueta = {
  id: string;
  medida: string;
  substrato: string;
  cliente: string;
  caixas: number;
  porCaixa: number;
  minimo: number;
};

export const hojeBR = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
};
export const agoraHora = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const dataBR = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
};
const horaBR = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const paraFalta = (r: any): FaltaMP => ({
  id: String(r.id),
  num: String(r.pedido_num ?? ""),
  motivo: String(r.motivo ?? ""),
  obs: String(r.obs ?? ""),
  quem: String(r.user_nome ?? "—"),
  data: dataBR(r.created_at),
  hora: horaBR(r.created_at),
  previsao: String(r.previsao ?? ""),
  status: (r.status ?? "aberta") as FaltaMP["status"],
  substituto: r.substituto ?? "",
  resolvidoEm: r.resolvido_em ? `${dataBR(r.resolvido_em)} ${horaBR(r.resolvido_em)}` : "",
  resolvidoPor: r.resolvido_por ?? "",
});

const paraEtiqueta = (r: any): Etiqueta => ({
  id: String(r.id),
  medida: String(r.medida ?? "—"),
  substrato: String(r.substrato ?? ""),
  cliente: String(r.cliente ?? ""),
  caixas: Number(r.caixas) || 0,
  porCaixa: Number(r.por_caixa) || 0,
  minimo: Number(r.minimo) || 0,
});

/** Lista as duas coisas de uma vez (a tela tem as duas abas). */
export async function lerEstoque(): Promise<{ faltas: FaltaMP[]; etiquetas: Etiqueta[] }> {
  const r = (await listEstoque()) as any;
  return {
    faltas: (r?.faltas ?? []).map(paraFalta),
    etiquetas: (r?.etiquetas ?? []).map(paraEtiqueta),
  };
}

export const lerFaltas = async (): Promise<FaltaMP[]> => (await lerEstoque()).faltas;
export const lerEtiquetas = async (): Promise<Etiqueta[]> => (await lerEstoque()).etiquetas;

export async function registrarFaltaMP(d: { num: string; motivo: string; obs: string; previsao: string; quem: string }): Promise<FaltaMP[]> {
  await registrarFalta({ data: { pedidoNum: d.num, motivo: d.motivo || MOTIVOS_MP[0], obs: d.obs || "", previsao: d.previsao || "", quem: d.quem || "" } });
  return lerFaltas();
}

export async function resolverFaltaMP(id: string, quem = ""): Promise<FaltaMP[]> {
  await mudarFalta({ data: { id, status: "resolvida", quem } });
  return lerFaltas();
}

export async function substituirMP(id: string, substrato: string, quem = ""): Promise<FaltaMP[]> {
  await mudarFalta({ data: { id, status: "substituida", substituto: substrato, quem } });
  return lerFaltas();
}

export async function reabrirFaltaMP(id: string): Promise<FaltaMP[]> {
  await mudarFalta({ data: { id, status: "aberta" } });
  return lerFaltas();
}

export async function ajustarEtiqueta(id: string, delta: number): Promise<Etiqueta[]> {
  await ajustarEtiquetaEstoque({ data: { id, delta } });
  return lerEtiquetas();
}

export async function salvarEtiqueta(d: { medida: string; substrato: string; cliente: string; caixas: number; porCaixa: number; minimo: number }): Promise<Etiqueta[]> {
  await salvarEtiquetaEstoque({
    data: {
      medida: d.medida || "—", substrato: d.substrato || "", cliente: d.cliente || "",
      caixas: Math.max(0, Math.round(Number(d.caixas) || 0)),
      porCaixa: Math.max(0, Math.round(Number(d.porCaixa) || 0)),
      minimo: Math.max(0, Math.round(Number(d.minimo) || 0)),
    },
  });
  return lerEtiquetas();
}

export async function removerEtiqueta(id: string): Promise<Etiqueta[]> {
  await removerEtiquetaEstoque({ data: { id } });
  return lerEtiquetas();
}
