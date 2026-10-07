// Pantone — v1a. Fonte: design_handoff_r2_hub/telas/Pantone.dc.html.
// Biblioteca Solid Coated 2024 (dados/pantone.ts, 3.219 cores + escala de
// processo), famílias por Lab, filtro "Pantones usados" cruzado com os pedidos.
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  AMARELO, EstagioV1a, INK, MONO, RailV1a, SOMBRA_CARD, TopbarV1a, fr,
} from "./HubV1a";
import { criarBusca } from "@/lib/busca";
import { colherBusca, semearBusca } from "@/lib/busca-semente";
import { PANTONE_SC } from "./dados/pantone";
import { prefixoPantone } from "./dados/pantone-busca";

/* A família vem da régua única (dados/familia-cor.ts, em OKLab). A conta que
   morava aqui cortava pelo ângulo do Lab: punha o 286 C e o Reflex Blue em
   "Rosas e roxos" e o Rhodamine Red em "Vermelhos" (conferido em 25/09/2026). */
import { familiaDe } from "./dados/familia-cor";
export { familiaDe };

export const PROCESSO = [
  { codigo: "Ciano", hex: "#009FE3", cmyk: "100/0/0/0", nota: "escala de processo" },
  { codigo: "Magenta", hex: "#E5007E", cmyk: "0/100/0/0", nota: "escala de processo" },
  { codigo: "Amarelo", hex: "#FFED00", cmyk: "0/0/100/0", nota: "escala de processo" },
  { codigo: "Preto", hex: "#1D1D1B", cmyk: "0/0/0/100", nota: "escala de processo" },
  /* Tintas especiais: não se fecham em CMYK — vão na máquina como tinta
     própria, igual a um Pantone. Ficam aqui porque é onde a equipe procura. */
  { codigo: "Dourado", hex: "#C6A15B", cmyk: "—", nota: "tinta especial · metálica" },
  { codigo: "Branco", hex: "#FFFFFF", cmyk: "—", nota: "tinta especial · cobertura" },
];

export const FAMILIAS = [
  { k: "todas", label: "Todas", cor: "#252425" },
  { k: "usados", label: "Pantones usados", cor: "#ffe815" },
  { k: "processo", label: "Processo e especiais", cor: "#009FE3" },
  { k: "amarelo", label: "Amarelos", cor: "#ffd100" },
  { k: "laranja", label: "Laranjas", cor: "#ff671f" },
  { k: "vermelho", label: "Vermelhos", cor: "#c8102e" },
  { k: "rosa", label: "Rosas e roxos", cor: "#ce0058" },
  { k: "azul", label: "Azuis", cor: "#0033a0" },
  { k: "verde", label: "Verdes", cor: "#00843d" },
  { k: "marrom", label: "Marrons", cor: "#7a4405" },
  { k: "neutro", label: "Neutros", cor: "#8d8b8d" },
];

/**
 * Busca por NOME de cor. O catálogo Pantone não tem nome nenhum — é código e
 * medida —, então o nome vira uma faixa: a família (calculada do Lab) mais,
 * quando o termo pede, um recorte de luminosidade (L) e de saturação (croma).
 * "vermelho" traz os 457 vermelhos; "vermelho sangue" traz só os escuros.
 * Termos compridos entram antes dos curtos ("azul bic" antes de "azul").
 */
export type Recorte = { familia?: string; familias?: string[]; L?: [number, number]; croma?: [number, number] };
/* A ORDEM MANDA: vale o PRIMEIRO termo que aparecer dentro da busca. Por isso
   o específico vem sempre antes do genérico ("terracota" antes de "terra",
   "azul bic" antes de "azul") — invertido, "terra" engoliria "terracota". */
const NOMES_DE_COR: [string, Recorte][] = [
  // vermelhos
  ["vermelho sangue", { familia: "vermelho", L: [0, 42] }],
  ["vermelho escuro", { familia: "vermelho", L: [0, 42] }],
  ["vermelho vivo", { familia: "vermelho", croma: [55, 999] }],
  ["vermelho fogo", { familia: "vermelho", croma: [55, 999] }],
  ["vermelho ferrari", { familia: "vermelho", croma: [55, 999] }],
  ["vermelho tomate", { familia: "vermelho", L: [40, 62] }],
  ["vermelho coca", { familia: "vermelho", L: [30, 52], croma: [45, 999] }],
  ["tomate", { familia: "vermelho", L: [40, 62] }],
  ["vinho", { familia: "vermelho", L: [0, 38] }],
  ["bordo", { familia: "vermelho", L: [0, 38] }],
  ["marsala", { familia: "vermelho", L: [20, 45], croma: [0, 45] }],
  ["granada", { familia: "vermelho", L: [0, 40] }],
  ["rubi", { familia: "vermelho", L: [20, 48], croma: [40, 999] }],
  ["carmim", { familia: "vermelho", L: [25, 50] }],
  ["cereja", { familia: "vermelho", L: [25, 55], croma: [45, 999] }],
  ["escarlate", { familia: "vermelho", croma: [50, 999] }],
  ["telha", { familias: ["vermelho", "laranja"], L: [35, 60], croma: [30, 999] }],
  ["tijolo", { familias: ["vermelho", "marrom"], L: [25, 50] }],
  ["ferrugem", { familias: ["vermelho", "laranja", "marrom"], L: [25, 52] }],
  ["terracota", { familias: ["laranja", "marrom", "vermelho"], L: [35, 62], croma: [25, 999] }],
  ["morango", { familia: "vermelho", croma: [45, 999] }],
  ["rubro", { familia: "vermelho" }],
  ["vermelha", { familia: "vermelho" }],
  ["vermelho", { familia: "vermelho" }],
  ["vermelhos", { familia: "vermelho" }],
  // azuis
  ["azul bic", { familia: "azul", L: [25, 55], croma: [40, 999] }],
  ["azul caneta", { familia: "azul", L: [25, 55], croma: [40, 999] }],
  ["azul royal", { familia: "azul", L: [20, 48], croma: [45, 999] }],
  ["azul cobalto", { familia: "azul", L: [25, 50], croma: [45, 999] }],
  ["azul eletrico", { familia: "azul", L: [35, 65], croma: [50, 999] }],
  ["azul marinho", { familia: "azul", L: [0, 32] }],
  ["azul noite", { familia: "azul", L: [0, 30] }],
  ["azul escuro", { familia: "azul", L: [0, 38] }],
  ["azul petroleo", { familia: "azul", L: [20, 45], croma: [0, 45] }],
  ["azul jeans", { familia: "azul", L: [35, 62], croma: [15, 55] }],
  ["azul denim", { familia: "azul", L: [35, 62], croma: [15, 55] }],
  ["azul aco", { familia: "azul", L: [40, 70], croma: [0, 35] }],
  ["azul piscina", { familias: ["azul", "verde"], L: [60, 88], croma: [25, 999] }],
  ["azul serenity", { familia: "azul", L: [65, 88], croma: [10, 40] }],
  ["azul gelo", { familia: "azul", L: [80, 100], croma: [0, 30] }],
  ["azul bebe", { familia: "azul", L: [72, 100] }],
  ["azul claro", { familia: "azul", L: [65, 100] }],
  ["azul ceu", { familia: "azul", L: [60, 100] }],
  ["azul turquesa", { familias: ["azul", "verde"], L: [50, 85], croma: [35, 999] }],
  ["celeste", { familia: "azul", L: [60, 100] }],
  ["safira", { familia: "azul", L: [20, 48], croma: [40, 999] }],
  ["turquesa", { familias: ["azul", "verde"], L: [50, 85], croma: [35, 999] }],
  ["tiffany", { familias: ["azul", "verde"], L: [65, 88], croma: [20, 999] }],
  ["ciano", { familias: ["azul", "verde"], L: [55, 90], croma: [30, 999] }],
  ["marinho", { familia: "azul", L: [0, 32] }],
  ["petroleo", { familias: ["azul", "verde"], L: [20, 45], croma: [0, 45] }],
  ["anil", { familia: "azul", L: [0, 45] }],
  ["navy", { familia: "azul", L: [0, 32] }],
  ["azuis", { familia: "azul" }],
  ["azul", { familia: "azul" }],
  // verdes
  ["verde bandeira", { familia: "verde", L: [35, 60], croma: [45, 999] }],
  ["verde escuro", { familia: "verde", L: [0, 40] }],
  ["verde musgo", { familia: "verde", L: [25, 50], croma: [0, 40] }],
  ["verde militar", { familia: "verde", L: [25, 50], croma: [0, 40] }],
  ["verde oliva", { familias: ["verde", "marrom"], L: [30, 58], croma: [0, 45] }],
  ["verde limao", { familia: "verde", L: [70, 100], croma: [45, 999] }],
  ["verde abacate", { familia: "verde", L: [45, 72], croma: [20, 60] }],
  ["verde pistache", { familia: "verde", L: [65, 90], croma: [15, 55] }],
  ["verde folha", { familia: "verde", L: [35, 62], croma: [35, 999] }],
  ["verde grama", { familia: "verde", L: [40, 68], croma: [35, 999] }],
  ["verde esmeralda", { familia: "verde", L: [30, 60], croma: [35, 999] }],
  ["verde agua", { familia: "verde", L: [65, 100], croma: [0, 45] }],
  ["verde claro", { familia: "verde", L: [65, 100] }],
  ["verde menta", { familia: "verde", L: [70, 100], croma: [0, 45] }],
  ["verde neon", { familia: "verde", L: [60, 100], croma: [60, 999] }],
  ["esmeralda", { familia: "verde", L: [30, 60], croma: [35, 999] }],
  ["jade", { familia: "verde", L: [45, 75], croma: [15, 60] }],
  ["oliva", { familias: ["verde", "marrom"], L: [30, 58], croma: [0, 45] }],
  ["abacate", { familia: "verde", L: [45, 72], croma: [20, 60] }],
  ["pistache", { familia: "verde", L: [65, 90], croma: [15, 55] }],
  ["verdes", { familia: "verde" }],
  ["verde", { familia: "verde" }],
  // amarelos e laranjas
  ["amarelo ouro", { familia: "amarelo", L: [55, 82] }],
  ["amarelo claro", { familia: "amarelo", L: [82, 100] }],
  ["amarelo bebe", { familia: "amarelo", L: [85, 100], croma: [0, 45] }],
  ["amarelo canario", { familia: "amarelo", croma: [55, 999] }],
  ["amarelo neon", { familia: "amarelo", L: [70, 100], croma: [65, 999] }],
  ["amarelo gema", { familia: "amarelo", L: [65, 88], croma: [50, 999] }],
  ["dourado", { familias: ["amarelo", "marrom"], L: [50, 80] }],
  ["ouro velho", { familias: ["amarelo", "marrom"], L: [40, 65], croma: [15, 60] }],
  ["ouro", { familias: ["amarelo", "marrom"], L: [50, 80] }],
  ["mostarda", { familias: ["amarelo", "marrom"], L: [45, 72] }],
  ["champagne", { familias: ["amarelo", "neutro", "marrom"], L: [75, 95], croma: [0, 30] }],
  ["champanhe", { familias: ["amarelo", "neutro", "marrom"], L: [75, 95], croma: [0, 30] }],
  ["milho", { familia: "amarelo", L: [70, 92], croma: [35, 999] }],
  ["palha", { familias: ["amarelo", "marrom", "neutro"], L: [72, 95], croma: [5, 45] }],
  ["trigo", { familias: ["amarelo", "marrom"], L: [65, 90], croma: [10, 50] }],
  ["mel", { familias: ["amarelo", "marrom", "laranja"], L: [55, 80], croma: [30, 999] }],
  ["amarelos", { familia: "amarelo" }],
  ["amarela", { familia: "amarelo" }],
  ["amarelo", { familia: "amarelo" }],
  ["laranja queimado", { familia: "laranja", L: [0, 55] }],
  ["laranja neon", { familia: "laranja", L: [55, 100], croma: [65, 999] }],
  ["tangerina", { familia: "laranja", croma: [50, 999] }],
  ["abobora", { familia: "laranja", L: [45, 72], croma: [40, 999] }],
  ["cenoura", { familia: "laranja", L: [50, 75], croma: [45, 999] }],
  ["damasco", { familias: ["laranja", "amarelo"], L: [65, 88], croma: [20, 60] }],
  ["pessego", { familias: ["laranja", "rosa"], L: [70, 92], croma: [15, 55] }],
  ["ocre", { familias: ["laranja", "marrom", "amarelo"], L: [40, 68], croma: [20, 60] }],
  ["laranjas", { familia: "laranja" }],
  ["laranja", { familia: "laranja" }],
  ["salmao", { familias: ["laranja", "rosa"], L: [60, 88] }],
  ["coral", { familias: ["laranja", "rosa"], L: [50, 78], croma: [40, 999] }],
  // rosas e roxos
  ["rosa choque", { familia: "rosa", croma: [55, 999] }],
  ["rosa antigo", { familia: "rosa", L: [45, 75], croma: [0, 40] }],
  ["rosa seco", { familia: "rosa", L: [45, 75], croma: [0, 40] }],
  ["rosa bebe", { familia: "rosa", L: [78, 100] }],
  ["rosa claro", { familia: "rosa", L: [72, 100] }],
  ["rosa neon", { familia: "rosa", L: [50, 100], croma: [65, 999] }],
  ["pink", { familia: "rosa", croma: [50, 999] }],
  ["fucsia", { familia: "rosa", croma: [50, 999] }],
  ["framboesa", { familias: ["rosa", "vermelho"], L: [25, 55], croma: [40, 999] }],
  ["magenta", { familia: "rosa", croma: [50, 999] }],
  ["roxo escuro", { familia: "rosa", L: [0, 35] }],
  ["roxo", { familia: "rosa", L: [0, 50] }],
  ["purpura", { familia: "rosa", L: [10, 50] }],
  ["berinjela", { familia: "rosa", L: [0, 32] }],
  ["ameixa", { familia: "rosa", L: [15, 45] }],
  ["uva", { familia: "rosa", L: [15, 48] }],
  ["violeta", { familia: "rosa", L: [20, 60] }],
  ["orquidea", { familia: "rosa", L: [50, 80], croma: [25, 999] }],
  ["malva", { familia: "rosa", L: [45, 78], croma: [0, 40] }],
  ["lilas", { familia: "rosa", L: [65, 100] }],
  ["lavanda", { familia: "rosa", L: [65, 100] }],
  ["nude", { familias: ["rosa", "marrom", "neutro"], L: [65, 90], croma: [0, 35] }],
  ["rosas", { familia: "rosa" }],
  ["rosa", { familia: "rosa" }],
  // marrons
  ["marrom claro", { familia: "marrom", L: [50, 100] }],
  ["marrom escuro", { familia: "marrom", L: [0, 35] }],
  ["chocolate", { familia: "marrom", L: [0, 45] }],
  ["cacau", { familia: "marrom", L: [0, 42] }],
  ["cafe", { familia: "marrom", L: [0, 45] }],
  ["tabaco", { familia: "marrom", L: [20, 48] }],
  ["couro", { familia: "marrom", L: [30, 60], croma: [15, 60] }],
  ["madeira", { familia: "marrom", L: [30, 65] }],
  ["castanho", { familia: "marrom", L: [20, 50] }],
  ["caramelo", { familia: "marrom", L: [45, 70] }],
  ["canela", { familias: ["marrom", "laranja"], L: [40, 68], croma: [20, 999] }],
  ["avela", { familia: "marrom", L: [50, 78], croma: [10, 50] }],
  ["caqui", { familias: ["marrom", "verde", "amarelo"], L: [45, 75], croma: [5, 45] }],
  ["khaki", { familias: ["marrom", "verde", "amarelo"], L: [45, 75], croma: [5, 45] }],
  ["areia", { familias: ["marrom", "neutro", "amarelo"], L: [72, 95], croma: [0, 35] }],
  ["bege", { familias: ["marrom", "neutro"], L: [70, 100] }],
  ["terra", { familia: "marrom", L: [25, 55] }],
  ["marrons", { familia: "marrom" }],
  ["marrom", { familia: "marrom" }],
  // metálicos (o Solid Coated não tem tinta metálica; casa pelo tom)
  ["cobre", { familias: ["laranja", "marrom"], L: [35, 62], croma: [25, 999] }],
  ["bronze", { familias: ["marrom", "amarelo"], L: [35, 65], croma: [15, 60] }],
  // neutros
  ["off white", { familia: "neutro", L: [88, 100] }],
  ["offwhite", { familia: "neutro", L: [88, 100] }],
  ["branco gelo", { familia: "neutro", L: [88, 100] }],
  ["marfim", { familias: ["neutro", "amarelo"], L: [85, 100], croma: [0, 25] }],
  ["creme", { familias: ["neutro", "amarelo", "marrom"], L: [82, 100], croma: [0, 30] }],
  ["gelo", { familia: "neutro", L: [85, 100] }],
  ["preto fosco", { familia: "neutro", L: [0, 25] }],
  ["preto", { familia: "neutro", L: [0, 25] }],
  ["preta", { familia: "neutro", L: [0, 25] }],
  ["branco", { familia: "neutro", L: [88, 100] }],
  ["branca", { familia: "neutro", L: [88, 100] }],
  ["cinza claro", { familia: "neutro", L: [65, 90] }],
  ["cinza escuro", { familia: "neutro", L: [15, 45] }],
  ["cinza chumbo", { familia: "neutro", L: [15, 45] }],
  ["chumbo", { familia: "neutro", L: [15, 45] }],
  ["grafite", { familia: "neutro", L: [10, 40] }],
  ["carvao", { familia: "neutro", L: [5, 32] }],
  ["fumaca", { familia: "neutro", L: [45, 75] }],
  ["cinza", { familia: "neutro", L: [15, 90] }],
  ["prata", { familia: "neutro", L: [55, 85] }],
  ["neutro", { familia: "neutro" }],
  ["neutros", { familia: "neutro" }],
];
/** Sem acento e em minúsculas, para "lilás" achar "lilas". */
const semAcento = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/**
 * Nome de cor dentro da busca, em PALAVRAS INTEIRAS.
 *
 * Comparar por pedaço de texto solto trocava as bolas: "caramelo" contém
 * "mel" e "dourado" contém "ouro", então quem digitasse caramelo levava o
 * recorte do mel. Cercando o termo de espaços, "mel" só casa com mel.
 */
export function recorteDaBusca(consulta: string): { termo: string; recorte: Recorte } | null {
  const q = ` ${semAcento(consulta).replace(/[^a-z0-9]+/g, " ").trim()} `;
  if (q.trim() === "") return null;
  for (const [termo, recorte] of NOMES_DE_COR) if (q.includes(` ${termo} `)) return { termo, recorte };
  return null;
}

const LIMITE = 320;

export function cmykDe(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const k = 1 - Math.max(r, g, b);
  if (k >= 1) return "0/0/0/100";
  const c = (1 - r - k) / (1 - k), m = (1 - g - k) / (1 - k), y = (1 - b - k) / (1 - k);
  const p = (v: number) => Math.round(v * 100);
  return `${p(c)}/${p(m)}/${p(y)}/${p(k)}`;
}

type Cor = { codigo: string; nome: string; hex: string; cmyk: string; lab: string; familia: string; L: number; croma: number };

/** Nome de cliente comparável: sem acento, sem pontuação, caixa alta.
 *  O pedido escreve "O PONTO DA CARNE A FAVORITA" e o Arquivos guarda o mesmo
 *  nome, mas acento e espaço dobrado não podem estragar o encontro. */
export function chaveNome(s: string): string {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function PantoneV1a({ profile, pedidos, versao, aoNavegar, onNova, onLogout, disponiveis, podeAtualizar, children }: {
  profile: { nome: string; role?: string };
  pedidos: any[];
  versao: string;
  /** config.sistema — só quem administra o hub procura cores novas */
  podeAtualizar?: boolean;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
}) {
  /* veio de um resultado da busca do topo? já entra filtrado por ele */
  const [busca, setBusca] = useState(() => colherBusca());
  const [familia, setFamilia] = useState("todas");
  const [sel, setSel] = useState<Cor | null>(null);
  const [copiado, setCopiado] = useState(false);
  /* clicar num chip da grade abre a cor em card grande */
  const [ampliada, setAmpliada] = useState(false);
  const tCopia = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Cores que entraram DEPOIS deste build: a tabela embutida é uma cópia do
     color book, e o botão "Procurar cores novas" guarda a diferença no banco.
     Sem isso, cor nova da Pantone só apareceria no próximo build. */
  type CorCrua = { c: string; h: string; l: [number, number, number] };
  const [extras, setExtras] = useState<CorCrua[]>([]);
  const [conferindo, setConferindo] = useState(false);
  const [recado, setRecado] = useState("");
  useEffect(() => {
    let vivo = true;
    void import("@/lib/api/pantone.functions")
      .then((m) => m.listPantoneExtras())
      .then((r) => { if (vivo) setExtras(((r as { cores?: CorCrua[] }).cores ?? [])); })
      .catch(() => { /* sem extras a tela mostra a tabela embutida */ });
    return () => { vivo = false; };
  }, []);

  async function procurarCoresNovas() {
    if (conferindo) return;
    setConferindo(true);
    setRecado("Lendo o color book instalado…");
    try {
      const m = await import("@/lib/api/pantone.functions");
      /* 1ª passada só olha; achando cor nova, a 2ª grava */
      const olhada = await m.conferirPantone({ data: { aplicar: false } });
      if (!olhada.ok) { setRecado(olhada.motivo); return; }
      if (!olhada.novas.length) {
        setRecado(`Já está em dia: ${olhada.titulo} tem ${olhada.noLivro} cores e o hub conhece ${olhada.noHub}.`);
        return;
      }
      const feito = await m.conferirPantone({ data: { aplicar: true } });
      const r = await m.listPantoneExtras();
      setExtras(((r as { cores?: CorCrua[] }).cores ?? []));
      const amostra = feito.novas.slice(0, 6).join(", ");
      setRecado(`${feito.aplicadas} ${feito.aplicadas === 1 ? "cor nova" : "cores novas"} de ${feito.titulo}: ${amostra}${feito.novas.length > 6 ? "…" : ""}`);
    } catch (e) {
      setRecado(e instanceof Error ? e.message : "Não deu para ler o color book.");
    } finally {
      setConferindo(false);
    }
  }

  /* A pasta física do cliente (a mesma do Arquivos): a vendedora vê a cor, vê
     quem usou e já sai com o número da gaveta — sem passar pelo Arquivos para
     procurar o nome. Carrega uma vez, em segundo plano; se falhar, a tela
     segue funcionando sem a pasta. */
  const [pastas, setPastas] = useState<Record<string, { pasta: string; gaveta: string }>>({});
  useEffect(() => {
    let vivo = true;
    void import("@/lib/api/arquivo.functions")
      .then((m) => m.listArquivo())
      .then((r) => {
        if (!vivo) return;
        const mapa: Record<string, { pasta: string; gaveta: string }> = {};
        for (const l of ((r as { linhas?: { nome?: string; pasta?: string; gaveta?: string }[] }).linhas ?? [])) {
          const chave = chaveNome(l.nome ?? "");
          if (chave && !mapa[chave]) mapa[chave] = { pasta: String(l.pasta ?? ""), gaveta: String(l.gaveta ?? "") };
        }
        setPastas(mapa);
      })
      .catch(() => { /* sem acervo carregado a tela continua igual */ });
    return () => { vivo = false; };
  }, []);
  const pastaDe = (cliente: string) => pastas[chaveNome(cliente)] ?? null;

  const todas = useMemo<Cor[]>(() => {
    const proc: Cor[] = PROCESSO.map((c) => ({ codigo: c.codigo, nome: c.codigo, hex: c.hex, cmyk: c.cmyk, lab: c.nota, familia: "processo", L: 50, croma: 99 }));
    /* tabela embutida no build + as cores que o botão "Procurar cores novas"
       encontrou no color book depois dele */
    return proc.concat(PANTONE_SC.concat(extras).map((c) => ({
      codigo: c.c,
      nome: prefixoPantone(c.c),
      hex: c.h.toUpperCase(),
      cmyk: cmykDe(c.h),
      lab: `L ${c.l[0]}  a ${c.l[1]}  b ${c.l[2]}`,
      familia: familiaDe(c.l),
      L: c.l[0],
      croma: Math.round(Math.sqrt(c.l[1] * c.l[1] + c.l[2] * c.l[2])),
    })));
  }, [extras]);

  const usados = useMemo(() => {
    const mapa: Record<string, { clientes: string[]; n: number; onde: { numero: string; cliente: string }[] }> = {};
    pedidos.forEach((p) => {
      /* A cor só conta como USADA depois que o cliente APROVOU a arte: em
         desenho ou revisão ela ainda muda, e quem pergunta "qual cor esse
         cliente usa?" quer a que foi impressa, não a que foi cogitada.
         Aprovada, clichê e concluído são as três fases pós-aprovação. */
      const st = String((p as { status?: string }).status ?? "");
      if (st !== "aprovada" && st !== "cliche" && st !== "concluido") return;
      /* `cores` guarda a QUANTIDADE ("1", "3", "4+PANTONE", "CMYK"); os nomes
         das cores estão em `cores_desc`. Lendo o campo errado, "4+PANTONE"
         virava o código vazio e a lista de usados ficava sempre em zero. */
      const texto = String((p as { cores_desc?: string | null }).cores_desc ?? "");
      texto.split(/[+,;/]/).forEach((cor) => {
        const limpo = cor.trim();
        if (!limpo) return;
        /* "Pantone 158 C" é como a equipe escreve; "158 C" solto também vale,
           num padrão apertado para não confundir com medida ou quantidade. */
        const temPalavra = /pantone/i.test(limpo);
        const cod = (temPalavra ? limpo.replace(/pantone/i, "") : limpo).trim().toUpperCase();
        if (!cod) return;
        if (!temPalavra && !/^\d{3,4}\s*C$/i.test(cod)) return;
        const chave = cod.replace(/\s+/g, " ");
        const it = mapa[chave] || (mapa[chave] = { clientes: [], n: 0, onde: [] });
        it.n += 1;
        if (!it.clientes.includes(p.cliente)) it.clientes.push(p.cliente);
        /* nome do cliente inteiro + número do pedido: no card não cabe, mas
           é o que permite achar o serviço depois. Vai no painel da esquerda. */
        const num = String((p as { numero?: string | number }).numero ?? "");
        if (!it.onde.some((o) => o.numero === num && o.cliente === p.cliente)) it.onde.push({ numero: num, cliente: p.cliente });
      });
    });
    return mapa;
  }, [pedidos]);

  const usoDe = (c: Cor) => usados[c.codigo.toUpperCase()] ?? null;
  const casa = criarBusca(busca);
  /* "vermelho", "azul bic", "verde bandeira": quando a busca é NOME de cor, o
     texto não bate com código nem hex — o filtro passa a ser a faixa de cor. */
  const achadoNome = recorteDaBusca(busca);
  const recorte = achadoNome?.recorte ?? null;
  const achados = todas.filter((c) => {
    const okF = familia === "todas" ? true : familia === "usados" ? !!usoDe(c) : c.familia === familia;
    if (!okF) return false;
    if (recorte) {
      const fams = recorte.familias ?? (recorte.familia ? [recorte.familia] : []);
      if (fams.length && !fams.includes(c.familia)) return false;
      if (recorte.L && (c.L < recorte.L[0] || c.L > recorte.L[1])) return false;
      if (recorte.croma && (c.croma < recorte.croma[0] || c.croma > recorte.croma[1])) return false;
      return true;
    }
    return casa(c.codigo, c.hex, c.cmyk);
  });
  const vis = achados.slice(0, LIMITE);
  const selecionada = sel ?? achados[0] ?? null;
  const famAtual = FAMILIAS.find((f) => f.k === familia) ?? FAMILIAS[0];

  function copiar() {
    if (!selecionada) return;
    const marcar = () => {
      setCopiado(true);
      if (tCopia.current) clearTimeout(tCopia.current);
      tCopia.current = setTimeout(() => setCopiado(false), 2000);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(selecionada.nome).then(marcar, marcar);
    else marcar();
  }

  return (
    <EstagioV1a>
      {/* A busca do topo também filtra as cores: era um campo morto aqui (só
          o campo interno funcionava) e, como nas outras telas o topo busca de
          verdade, parecia que a pesquisa do Pantone estava quebrada. */}
      <TopbarV1a nome={String(profile.nome || "").trim().split(/\s+/)[0] || ""} busca={busca} aoBuscar={(v) => { setBusca(v); setSel(null); }} onSair={onLogout} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch", marginTop: 14 }}>
        <RailV1a ativo="Pantone" permitidas={disponiveis} aoNavegar={(l) => aoNavegar?.(l)} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, padding: "0 4px" }}>
            <div>
              <h1 style={{ ...fr(144, 900), fontSize: 80, lineHeight: 0.86, color: INK, margin: "2px 0 0 2px" }}>Pantone</h1>
              <div style={{ font: "400 15px/1 Inter,sans-serif", color: "#8d8b8d", marginTop: 14 }}>
                Solid Coated 2024 · color book oficial · {todas.length} cores
                {extras.length > 0 && <span style={{ color: INK, fontWeight: 600 }}> · {extras.length} do livro novo</span>}
              </div>
              {recado && (
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10, background: "#fff", borderRadius: 999, padding: "9px 15px", boxShadow: "0 1px 0 rgba(0,0,0,.04)", font: "500 14px/1.3 Inter,sans-serif", color: INK, maxWidth: 720 }}>
                  <span style={{ flex: "none", width: 8, height: 8, borderRadius: 999, background: AMARELO }} />
                  <span style={{ minWidth: 0 }}>{recado}</span>
                  <button type="button" className="r2ic" onClick={() => setRecado("")} title="Fechar"
                    style={{ flex: "none", border: 0, background: "transparent", cursor: "pointer", color: "#8d8b8d", font: "700 14px/1 Inter,sans-serif" }}>×</button>
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {podeAtualizar && (
                <button type="button" className="r2chip" onClick={procurarCoresNovas} disabled={conferindo}
                  title="Lê o color book instalado no servidor e traz as cores que a Pantone lançou depois desta versão"
                  style={{ display: "flex", alignItems: "center", gap: 9, border: 0, borderRadius: 999, padding: "0 20px", height: 48, cursor: conferindo ? "progress" : "pointer", font: "600 15px/1 Inter,sans-serif", background: "#fff", color: INK, boxShadow: "0 1px 0 rgba(0,0,0,.04)", whiteSpace: "nowrap", opacity: conferindo ? 0.6 : 1 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M19.5 3.5V6H17" /></svg>
                  <span style={{ lineHeight: "17px" }}>{conferindo ? "Conferindo…" : "Procurar cores novas"}</span>
                </button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 11, background: "#fff", borderRadius: 999, padding: "0 20px", height: 48, boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
                <input value={busca} onChange={(e) => { setBusca(e.target.value); setSel(null); }} placeholder="Buscar código, hex ou cor (ex.: azul bic)" style={{ width: 260, border: 0, outline: 0, background: "transparent", font: "500 15px/1 Inter,sans-serif", color: INK }} />
              </div>
              <button type="button" className="r2chip" onClick={() => { setBusca(""); setFamilia("todas"); setSel(null); }}
                style={{ border: 0, borderRadius: 999, padding: "15px 18px", cursor: "pointer", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".04em", textTransform: "uppercase", background: INK, color: AMARELO }}>
                Limpar filtros
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
            {/* famílias + cor selecionada */}
            <div style={{ flex: "0 0 300px", minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 22px 18px", boxShadow: SOMBRA_CARD }}>
                <div style={{ font: "800 19px/1 Inter,sans-serif", color: INK, letterSpacing: "-.01em", marginBottom: 14 }}>Famílias</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {FAMILIAS.map((f) => {
                    const on = familia === f.k;
                    const conta = f.k === "todas" ? todas.length : f.k === "usados" ? todas.filter((c) => !!usoDe(c)).length : todas.filter((c) => c.familia === f.k).length;
                    return (
                      <button key={f.k} type="button" className="r2row" onClick={() => { setFamilia(f.k); setSel(null); }}
                        style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", minHeight: 42, border: 0, cursor: "pointer", borderRadius: 8, padding: "10px 12px", font: "600 15px/1 Inter,sans-serif", background: on ? "#f1f1f1" : "transparent", color: INK }}>
                        <span style={{ flex: "none", width: 12, height: 12, borderRadius: 999, background: f.cor }} />
                        <span style={{ flex: 1, textAlign: "left" }}>{f.label}</span>
                        <span style={{ font: "700 12.5px/1 Inter,sans-serif", padding: "5px 8px", borderRadius: 999, background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#8d8b8d" }}>{conta}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ flex: "none", background: INK, borderRadius: 12, padding: "20px 22px 18px" }}>
                <div style={{ font: "800 19px/1 Inter,sans-serif", color: "#f1f1f1", letterSpacing: "-.01em", marginBottom: 6 }}>{selecionada ? selecionada.nome : "Nenhuma cor"}</div>
                <div style={{ height: 96, borderRadius: 10, marginTop: 14, background: selecionada ? selecionada.hex : "#3a383a", boxShadow: "inset 0 0 0 1px rgba(37,36,37,.16)" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                  {(selecionada
                    ? [{ k: "Lab oficial", v: selecionada.lab }, { k: "Hex (tela)", v: selecionada.hex }, { k: "CMYK (conv.)", v: selecionada.cmyk }]
                    : [{ k: "Selecione", v: "clique num card" }]
                  ).map((d) => (
                    <div key={d.k}>
                      <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{d.k}</div>
                      <div style={{ font: `600 15px/1 ${MONO}`, color: "#f1f1f1", marginTop: 6 }}>{d.v}</div>
                    </div>
                  ))}
                </div>
                {selecionada && usoDe(selecionada) && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #3a383a" }}>
                    <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>
                      Aprovado em {usoDe(selecionada)!.onde.length === 1 ? "1 pedido" : `${usoDe(selecionada)!.onde.length} pedidos`}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, maxHeight: 168, overflow: "auto" }}>
                      {usoDe(selecionada)!.onde.map((o) => {
                        const pa = pastaDe(o.cliente);
                        return (
                          <div key={`${o.numero}-${o.cliente}`} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                              <span style={{ flex: "none", font: `600 12.5px/1.3 ${MONO}`, color: AMARELO }}>#{o.numero}</span>
                              <span style={{ font: "500 13.5px/1.3 Inter,sans-serif", color: "#f1f1f1", overflowWrap: "anywhere" }}>{o.cliente}</span>
                            </div>
                            {/* a pasta do acervo: leva direto à gaveta, e o clique
                                abre o Arquivos já filtrado por esse cliente */}
                            {pa ? (
                              <button type="button" className="r2chip"
                                title={`Abrir ${o.cliente} no Arquivos`}
                                onClick={() => { semearBusca(o.cliente); aoNavegar?.("Arquivos"); }}
                                style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 7, border: 0, cursor: "pointer", borderRadius: 999, padding: "6px 11px", background: "#3a383a", font: `700 12px/1 ${MONO}`, color: AMARELO }}>
                                <span>Pasta {pa.pasta || "—"}</span>
                                {pa.gaveta && <span style={{ font: "500 11.5px/1 Inter,sans-serif", color: "#c9c8c9" }}>{pa.gaveta}</span>}
                              </button>
                            ) : (
                              <span style={{ font: "400 12px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>sem pasta no Arquivos</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button type="button" className="r2chip" onClick={copiar}
                  style={{ width: "100%", marginTop: 18, border: 0, borderRadius: 999, padding: 14, cursor: "pointer", font: "700 14.5px/1 Inter,sans-serif", background: AMARELO, color: INK }}>
                  {copiado ? "Código copiado" : selecionada ? `Copiar ${selecionada.nome}` : "Copiar código"}
                </button>
                <div style={{ font: "400 13.5px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>
                  Lab é o valor oficial do color book; hex e CMYK são conversões para tela. Confira no leque físico.
                </div>
              </div>
            </div>

            {/* grade */}
            <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 2px" }}>
                <span style={{ font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{famAtual.label}</span>
                {/* deixa claro que a busca virou "faixa de cor" e não texto —
                    senão parece que o hub ignorou o que foi digitado */}
                {achadoNome && (
                  <span title="o hub entendeu isto como nome de cor e mostrou a faixa inteira"
                    style={{ flex: "none", background: AMARELO, color: INK, borderRadius: 999, padding: "5px 11px", font: "700 12px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    nome de cor · {achadoNome.termo}
                  </span>
                )}
                <span style={{ flex: 1, height: 2, background: "#e4e4e4", borderRadius: 999 }} />
                <span style={{ font: "400 14.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>
                  {achados.length > LIMITE ? `mostrando ${LIMITE} de ${achados.length}` : `${achados.length} ${achados.length === 1 ? "cor" : "cores"}`}
                </span>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#fff", borderRadius: 12, padding: 18, boxShadow: SOMBRA_CARD }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: 10 }}>
                  {vis.map((c) => {
                    const on = selecionada?.codigo === c.codigo;
                    const uso = usoDe(c);
                    return (
                      /* Um clique só ESCOLHE a cor — a ficha da esquerda troca e
                         o grid continua à vista para comparar um tom com o
                         vizinho. A ampliação, que cobre a tela, ficou no duplo
                         clique: antes ela pulava a cada toque, mesmo quando a
                         pessoa só estava passando os olhos pelas cores. */
                      <button key={c.codigo} type="button" className="r2card"
                        onClick={() => { setSel(c); setCopiado(false); }}
                        onDoubleClick={() => { setSel(c); setCopiado(false); setAmpliada(true); }}
                        title={`${uso ? `${c.nome} · usado em: ${uso.onde.map((o) => { const pa = pastaDe(o.cliente); return `#${o.numero} ${o.cliente}${pa ? ` (pasta ${pa.pasta})` : ""}`; }).join(", ")}` : c.nome} · dois cliques amplia`}
                        style={{ display: "flex", flexDirection: "column", overflow: "hidden", border: 0, padding: 0, cursor: "pointer", textAlign: "left", borderRadius: 10, background: "#fff", boxShadow: on ? `0 0 0 3px ${INK}` : "0 0 0 1px #ececec" }}>
                        {/* contorno de dentro: sem ele o Branco some no cartão branco */}
                        <span style={{ display: "block", height: 58, background: c.hex, width: "100%", boxShadow: "inset 0 0 0 1px rgba(37,36,37,.16)" }} />
                        <span style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 11px 11px" }}>
                          <span style={{ font: "700 14.5px/1.1 Inter,sans-serif", color: INK, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.codigo}</span>
                          <span style={{ font: `500 12px/1 ${MONO}`, color: "#b3b1b3", textAlign: "left" }}>{c.hex}</span>
                          <span style={{ font: `500 12px/1 ${MONO}`, color: "#c9c8c9", textAlign: "left" }}>CMYK {c.cmyk}</span>
                          {uso && (
                            /* o nome inteiro não cabe em 1 linha no card; cortado em
                               "O PONTO ..." não serve para reconhecer o cliente. Quebra
                               em até 2 linhas aqui e aparece completo no painel/tooltip. */
                            <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", marginTop: 2, background: AMARELO, borderRadius: 5, padding: "5px 7px", font: "700 11px/1.25 Inter,sans-serif", letterSpacing: 0, color: INK, textAlign: "left", overflow: "hidden", overflowWrap: "anywhere" }}>
                              {uso.clientes[0]}{uso.clientes.length > 1 ? ` +${uso.clientes.length - 1}` : ""}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {achados.length === 0 && (
                  <div style={{ padding: "70px 0", textAlign: "center", font: "400 15px/1.5 Inter,sans-serif", color: "#b3b1b3" }}>
                    Nenhuma cor com esse filtro.
                    {/* quem digitou um texto que não é código nem nome conhecido
                        fica sem saber que dá para procurar pelo nome da cor */}
                    {busca.trim() !== "" && !achadoNome && (
                      <span style={{ display: "block", marginTop: 10 }}>
                        Também dá para procurar pelo <strong style={{ color: "#5c5a5c" }}>nome da cor</strong>: azul bic, verde bandeira,
                        vinho, terracota, off white, cinza chumbo, mostarda…
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* card grande da cor: clicar num chip da grade abre a cor em tamanho
          de conferência — a amostra pequena do painel não dá para comparar
          com o material impresso na mão */}
      {ampliada && selecionada && (() => {
        const uso = usoDe(selecionada);
        return (
          <div onClick={() => setAmpliada(false)} data-modal-esc
            style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "rgba(37,36,37,.55)", backdropFilter: "blur(4px)", borderRadius: 14 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width: 1180, maxWidth: "100%", height: "100%", overflow: "auto", display: "flex", flexDirection: "column", background: INK, borderRadius: 16, padding: 30, boxShadow: "0 50px 100px -30px rgba(0,0,0,.7)" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: `600 13.5px/1.2 ${MONO}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{selecionada.lab}</div>
                  <div style={{ ...fr(96, 700), fontSize: 44, lineHeight: 1, letterSpacing: "-.03em", color: "#f1f1f1", marginTop: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selecionada.nome}</div>
                </div>
                <button type="button" className="r2ic" onClick={() => setAmpliada(false)}
                  style={{ width: 38, height: 38, flex: "none", display: "grid", placeItems: "center", background: "#3a383a", border: 0, borderRadius: 999, cursor: "pointer" }}>
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
                </button>
              </div>

              {/* a amostra ocupa toda a sobra do card: é ela que se compara com o
                  material impresso, então ganha o espaço, não os rótulos */}
              <div style={{ flex: "1 1 auto", minHeight: 280, borderRadius: 12, marginTop: 22, background: selecionada.hex, boxShadow: "inset 0 0 0 1px rgba(241,241,241,.18)" }} />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 18 }}>
                {[["Hex (tela)", selecionada.hex], ["CMYK (conv.)", selecionada.cmyk], ["Família", FAMILIAS.find((f) => f.k === selecionada.familia)?.label ?? selecionada.familia]].map(([k, v]) => (
                  <div key={k} style={{ background: "#2f2d2f", borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>{k}</div>
                    <div style={{ font: `700 19px/1.2 ${MONO}`, color: "#f1f1f1", marginTop: 9 }}>{v}</div>
                  </div>
                ))}
              </div>

              {uso && (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #3a383a" }}>
                  <div style={{ font: "600 12px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>
                    Aprovado em {uso.onde.length === 1 ? "1 pedido" : `${uso.onde.length} pedidos`}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {uso.onde.map((o) => {
                      const pa = pastaDe(o.cliente);
                      return (
                        <span key={`${o.numero}-${o.cliente}`} style={{ display: "inline-flex", alignItems: "baseline", gap: 8, background: "#2f2d2f", borderRadius: 999, padding: "9px 14px" }}>
                          <span style={{ font: `600 12.5px/1 ${MONO}`, color: AMARELO }}>#{o.numero}</span>
                          <span style={{ font: "500 13.5px/1.3 Inter,sans-serif", color: "#f1f1f1" }}>{o.cliente}</span>
                          {pa && <span style={{ font: `600 12px/1 ${MONO}`, color: "#8d8b8d" }}>· pasta {pa.pasta}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <button type="button" className="r2chip" onClick={copiar}
                style={{ marginTop: 20, border: 0, borderRadius: 999, padding: 15, cursor: "pointer", font: "700 15px/1 Inter,sans-serif", background: AMARELO, color: INK }}>
                {copiado ? "Código copiado" : `Copiar ${selecionada.nome}`}
              </button>
            </div>
          </div>
        );
      })()}
      {children}
    </EstagioV1a>
  );
}
