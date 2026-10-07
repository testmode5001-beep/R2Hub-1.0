// Calculadoras — v1a. Fonte: design_handoff_r2_hub/telas/Calculadoras.dc.html (frame 7a).
// 11 calculadoras em 4 grupos (Clichê, Etiquetas, Facas, Produção): fórmulas
// portadas 1:1 do protótipo (buildRows, nearProd, valorFaca etc.), com destaque
// escuro, resultado detalhado, barra de composição, tabela ordenável e
// histórico local (Salvar/Restaurar/Remover).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

import {
  AMARELO, AvisoV1a, EstagioV1a, INK, MONO, RailV1a, TopbarV1a, fr,
} from "./HubV1a";

/* ── constantes do protótipo ─────────────────────────────────────── */
const ESP_EPS = 1e-9;
const PASSOS = [
  { l: "M1 π", v: Math.PI },
  { l: '1/8"', v: 3.175 },
  { l: '1/4"', v: 6.35 },
  { l: '3/8"', v: 9.525 },
  { l: '1/2"', v: 12.7 },
];
/** o passo da engrenagem em mm, pelo rótulo (a calculadora 1.0 usa) */
export const PASSO_MM = (rotulo: string) => (PASSOS.find((p) => p.l === rotulo) || PASSOS[0]).v;
const MAQUINAS = [{ l: "Classic 160", v: 160 }, { l: "Force 250", v: 250 }, { l: "Personalizada", v: 0 }];
const PARQUE_CLASSIC = [50, 51, 52, 53, 54, 55, 59, 60, 63, 65, 70, 72, 74, 77, 78, 79, 81, 84, 86, 91, 96, 102];
const CL_POLY = 0.127;
const MODULOS = [
  { l: "M1 (π)", v: Math.PI },
  { l: 'CP 1/8"', v: 3.175 },
  { l: 'CP 5/32"', v: 3.96875 },
  { l: 'CP 3/16"', v: 4.7625 },
  { l: 'CP 1/4"', v: 6.35 },
];
const CHAPAS = [1.14, 1.70, 2.84, 3.94, 5.00, 6.35].map((t) => ({ l: t.toFixed(2).replace(".", ",") + " mm", t, k: 2 * Math.PI * (t - CL_POLY) }));
const CHAPAS_VALOR = [
  { l: "1,14 mm", t: 1.14, distorcao: 2 * Math.PI * (1.14 - CL_POLY), taxa: 0.235 },
  { l: "1,70 mm", t: 1.70, distorcao: 2 * Math.PI * (1.70 - CL_POLY), taxa: 0.22 },
];
const SUB_PERDA = 3, SUB_CAMEROM = 1, SUB_FOLGA = 1;
const SUB_ESTOQUE = [50, 70, 80, 100, 110, 120, 140, 160, 180, 200, 220, 250];
const ENGR_POR_DENTE = 1.76;
const LETRAS = "ABCDEFGHIJKL".split("");

const IC: Record<string, string[]> = {
  faca: ["M3.5 6.5h17v11h-17z", "M7 9.5h10v5H7z", "M3.5 12h3.5", "M17 12h3.5"],
  comparar: ["M6 20.5V9", "M12 20.5V4", "M18 20.5v-7.5", "M3.5 20.5h17"],
  diametro: ["M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17", "M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6", "M12 3.5v5.7"],
  distorcao: ["M4 16.5c4-8 12 8 16 0", "M4 8c4-8 12 8 16 0"],
  valorCliche: ["M4.5 4.5h15v15h-15z", "M8 8.5h4.5v3.5H8z", "M8 15.5h8"],
  bobina: ["M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17", "M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4", "M12 12h8.5"],
  substrato: ["M3.5 6.5h17v11h-17z", "M8 6.5v11", "M13 6.5v11", "M18 6.5v11"],
  caixa: ["M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z", "M3.5 8 12 12.5 20.5 8", "M12 12.5v8"],
  metragem: ["M3.5 9.5h17v5h-17z", "M7 9.5v5", "M10.5 9.5v3", "M14 9.5v5", "M17.5 9.5v3"],
  valor: ["M12 3.5v17", "M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.6 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3"],
  tinta: ["M12 3.5s6 6.2 6 10.2a6 6 0 0 1-12 0c0-4 6-10.2 6-10.2z"],
};

const GRUPOS = [
  { titulo: "Clichê", ids: ["distorcao", "valorcliche"] },
  { titulo: "Etiquetas", ids: ["caixa", "valor", "metragem"] },
  { titulo: "Facas", ids: ["facas", "comparativo", "pordiametro"] },
  { titulo: "Produção", ids: ["bobinas", "substrato", "tinta"] },
];

/** Baixar o gabarito 1:1 é permissão à parte: não é uma conta, é o desenho que
    vai para a gravação do ferramental. */
export const PERM_GABARITO = "calc.gabarito";

/** Calculadora → permissão do sistema (as chaves calc.* do back-end). */
export const CALC_PERM: Record<string, string> = {
  distorcao: "calc.distorcao",
  valorcliche: "calc.valor",
  caixa: "calc.caixa",
  valor: "calc.valoretiqueta",
  metragem: "calc.metragem",
  facas: "calc.desenvolvimento",
  comparativo: "calc.comparativo",
  pordiametro: "calc.diametro",
  bobinas: "calc.bobinas",
  substrato: "calc.substrato",
  tinta: "calc.tinta",
};
const SECOES_CAMPO: Record<string, Record<string, string>> = {
  facas: { x: "Medidas da etiqueta", y: "Medidas da etiqueta", tipoFaca: "Medidas da etiqueta", maquina: "Máquina", maqW: "Máquina", passo: "Engrenagem", nMin: "Engrenagem", nMax: "Engrenagem", espMin: "Espaçamento (perda)", espMax: "Espaçamento (perda)", espCarr: "Espaçamento (perda)", modo: "Resultado e filtros", filtro: "Resultado e filtros" },
  comparativo: { slots: "Facas a comparar", passo: "Engrenagem", nMin: "Engrenagem", nMax: "Engrenagem", espMin: "Espaçamento (perda)", espMax: "Espaçamento (perda)", soFiltro: "Exibição" },
  pordiametro: { dia: "Cilindro", diaSel: "Cilindro", passo: "Engrenagem", espMin: "Espaçamento (perda)", espMax: "Espaçamento (perda)", verif: "Verificar faca existente" },
  valorcliche: { dia: "Chapa", chapa: "Chapa", largEtq: "Etiqueta", carreiras: "Etiqueta", jogos: "Cobrança", cores: "Cobrança", prova: "Cobrança" },
  valor: { tiragem: "Pedido", larg: "Pedido", alt: "Pedido", precoM2: "Custos", cores: "Custos", custoCor: "Custos", cliche: "Ferramental", faca: "Ferramental", setup: "Ferramental", margem: "Margem e imposto", imposto: "Margem e imposto" },
};

type Vals = Record<string, string>;
const NSLOTS = (v: Vals) => Math.max(2, Math.min(12, parseInt(v.slots || "4", 10) || 4));

type Campo = {
  id: string; label: string; unidade: string; ph?: string;
  tipo?: "chips" | "botoes"; opcoes?: string[]; largo?: boolean;
  botoes?: { label: string; delta: number }[]; destino?: string; espelha?: string;
  /** chip que não guarda valor próprio: aplica valores em OUTROS campos (tipo de faca → perdas) */
  aplica?: Record<string, Vals>;
  /** opção ativa derivada dos valores atuais (par do `aplica`) */
  ativoDe?: (v: Vals) => string;
};
type Calc = { id: string; nome: string; icone: string[]; sub: string; formula: string; campos: Campo[] | ((v: Vals) => Campo[]) };

const CALCS: Calc[] = [
  {
    id: "facas", nome: "Calculadora de Facas", icone: IC.faca,
    sub: "Cilindros compatíveis com a altura da etiqueta",
    formula: "Perda = (Dev − Rep × X) ÷ Rep · Dev = Z × passo · Ø = Dev ÷ π · Carreiras × (Y + perda) ≤ largura útil",
    campos: (v) => {
      const arr: Campo[] = [
        { id: "y", label: "Largura Y (carreira)", unidade: "mm", ph: "50" },
        { id: "x", label: "Altura X (desenvolvimento)", unidade: "mm", ph: "50" },
        {
          id: "tipoFaca", label: "Tipo de faca", unidade: "gap = etiquetas coladas, sem esqueleto",
          tipo: "chips", largo: true, opcoes: ["Com esqueleto", "De gap (sem perda)"],
          aplica: {
            "Com esqueleto": { espMin: "2,10", espMax: "3,50", espCarr: "3,00" },
            "De gap (sem perda)": { espMin: "0", espMax: "0", espCarr: "0" },
          },
          ativoDe: (vv) => (Math.abs(n(vv.espMin)) < 0.001 && Math.abs(n(vv.espMax)) < 0.001 ? "De gap (sem perda)" : "Com esqueleto"),
        },
      ];
      /* a máquina fica DEPOIS do tipo de faca para os campos da mesma seção
         andarem juntos — ela e a largura útil vivem em "Ajustes técnicos". */
      arr.push({ id: "maquina", label: "Máquina", unidade: "largura útil da faca", tipo: "chips", opcoes: MAQUINAS.map((m) => m.l), largo: true });
      if (v.maquina === "Personalizada") arr.push({ id: "maqW", label: "Largura útil personalizada", unidade: "mm", ph: "140", largo: true });
      return arr.concat([
        { id: "passo", label: "Passo da engrenagem", unidade: "mm/dente", tipo: "chips", opcoes: PASSOS.map((p) => p.l), largo: true },
        { id: "nMin", label: "Dentes mín.", unidade: "Z", ph: "50" },
        { id: "nMax", label: "Dentes máx.", unidade: "Z", ph: "102" },
        { id: "espMin", label: "Perda mín.", unidade: "mm · 0 e 0 = faca de gap, sem perda", ph: "2,10" },
        { id: "espMax", label: "Perda máx.", unidade: "mm", ph: "3,50" },
        { id: "espCarr", label: "Perda entre carreiras", unidade: "mm · padrão da fábrica", ph: "3,00" },
        { id: "modo", label: "Resultado", unidade: "modo", tipo: "chips", opcoes: ["Dentro do filtro", "Mais próximos"], largo: true },
        { id: "filtro", label: "Cilindros", unidade: "os que a fábrica já tem", tipo: "chips", opcoes: ["Todos", "Só do estoque"], largo: true },
      ]);
    },
  },
  {
    id: "comparativo", nome: "Comparativo de Facas", icone: IC.comparar,
    sub: "Diâmetros que atendem mais de uma altura",
    formula: "Para cada altura: Perda = (Dev − Rep × X) ÷ Rep · encaixe = perda dentro do filtro",
    campos: (v) => {
      const n = NSLOTS(v);
      const arr: Campo[] = [];
      for (let i = 0; i < n; i++) arr.push({ id: "x" + i, label: "Faca " + LETRAS[i] + " · altura", unidade: "mm", ph: "50" });
      arr.push({
        id: "slots", label: "Facas na comparação", unidade: n + " de 12", tipo: "botoes", largo: true,
        botoes: [{ label: "− remover", delta: -1 }, { label: "+ adicionar faca", delta: 1 }],
      });
      return arr.concat([
        { id: "passo", label: "Passo da engrenagem", unidade: "mm/dente", tipo: "chips", opcoes: PASSOS.map((p) => p.l), largo: true },
        { id: "nMin", label: "Dentes mín.", unidade: "Z", ph: "40" },
        { id: "nMax", label: "Dentes máx.", unidade: "Z", ph: "400" },
        { id: "espMin", label: "Perda mín.", unidade: "mm", ph: "2,10" },
        { id: "espMax", label: "Perda máx.", unidade: "mm", ph: "3,50" },
        { id: "soFiltro", label: "Exibir", unidade: "linhas", tipo: "chips", opcoes: ["Todos os cilindros", "Só no filtro"], largo: true },
      ]);
    },
  },
  {
    id: "pordiametro", nome: "Facas por Diâmetro", icone: IC.diametro,
    sub: "Alturas possíveis para um cilindro do parque",
    formula: "Dev = Ø × π · altura máx = Dev÷Rep − perda mín · altura mín = Dev÷Rep − perda máx",
    campos: [
      { id: "dia", label: "Diâmetro do cilindro", unidade: "mm", ph: "54" },
      { id: "diaSel", destino: "dia", label: "Diâmetros no estoque (Classic)", unidade: "clique para usar", tipo: "chips", opcoes: PARQUE_CLASSIC.map(String), largo: true, espelha: "dia" },
      { id: "passo", label: "Passo da engrenagem", unidade: "mm/dente", tipo: "chips", opcoes: PASSOS.map((p) => p.l), largo: true },
      { id: "espMin", label: "Perda mín.", unidade: "mm", ph: "2,10" },
      { id: "espMax", label: "Perda máx.", unidade: "mm", ph: "3,50" },
      { id: "verif", label: "Verificar faca existente", unidade: "mm", ph: "50,00" },
    ],
  },
  {
    id: "distorcao", nome: "Distorção do Clichê", icone: IC.distorcao,
    sub: "Fator de distorção para gravação",
    formula: "R = dentes × passo do módulo · K = 2π × (espessura − 0,127) · Tamanho impresso = R − K · Distorção % = K ÷ R × 100",
    campos: [
      { id: "dentes", label: "Nº de dentes da engrenagem", unidade: "Z", ph: "96" },
      { id: "modulo", label: "Módulo da máquina", unidade: "passo", tipo: "chips", opcoes: MODULOS.map((m) => m.l), largo: true },
      { id: "chapa", label: "Tipo de clichê", unidade: "espessura", tipo: "chips", opcoes: CHAPAS.map((c) => c.l), largo: true },
      { id: "arte", label: "Correção de arte (opcional)", unidade: "mm no print", ph: "100" },
    ],
  },
  {
    id: "valorcliche", nome: "Valor Clichê", icone: IC.valorCliche,
    sub: "Área da chapa e valor por cor",
    formula: "Altura = ARRED5(Ø × π + 40 − distorção) · Largura = larg × carreiras + 3 × (carreiras − 1) · Área = altura × largura ÷ 100 · Total = área × taxa × cores + prova",
    campos: [
      { id: "dia", label: "Diâmetro do cilindro", unidade: "mm", ph: "96" },
      { id: "chapa", label: "Chapa", unidade: "espessura", tipo: "chips", opcoes: CHAPAS_VALOR.map((c) => c.l), largo: true },
      { id: "largEtq", label: "Largura da etiqueta", unidade: "mm", ph: "50" },
      { id: "carreiras", label: "Carreiras", unidade: "un", ph: "1" },
      { id: "jogos", label: "Jogos", unidade: "un", ph: "1" },
      { id: "cores", label: "Nº de cores", unidade: "un", ph: "1" },
      { id: "prova", label: "Prova", unidade: "R$", ph: "0" },
    ],
  },
  {
    id: "bobinas", nome: "Bobinas", icone: IC.bobina,
    sub: "Metragem estimada pelo diâmetro do rolo",
    formula: "L = π × (Ø ext² − Ø int²) ÷ (4 × espessura) · voltas = (Ø ext − Ø int) ÷ 2 ÷ espessura",
    campos: [
      { id: "ext", label: "Ø externo", unidade: "mm", ph: "500" },
      { id: "int", label: "Ø interno", unidade: "mm", ph: "76" },
      { id: "esp", label: "Espessura do material", unidade: "mm", ph: "0,080" },
      { id: "larg", label: "Largura da bobina (opcional)", unidade: "mm", ph: "250" },
    ],
  },
  {
    id: "substrato", nome: "Largura do Substrato", icone: IC.substrato,
    sub: "Largura mínima da bobina para o número de carreiras",
    formula: "Entre as carreiras: carreiras × (largura + 3) · Nas bordas: carreiras × largura + (carreiras − 1) × 3 + 4",
    campos: [
      { id: "larg", label: "Largura da etiqueta", unidade: "mm", ph: "38,66" },
      { id: "carr", label: "Carreiras", unidade: "un", ph: "6" },
      { id: "cam", label: "Camerom", unidade: "posição", tipo: "chips", opcoes: ["Entre as carreiras", "Nas bordas"], largo: true },
    ],
  },
  {
    id: "caixa", nome: "Etiquetas por Caixa", icone: IC.caixa,
    sub: "Fechamento de caixa e total do pedido",
    formula: "Etiquetas na caixa = etiquetas por rolo × rolos por caixa · Total = caixa × nº de caixas",
    campos: [
      { id: "etiq", label: "Etiquetas por rolo", unidade: "un", ph: "1000" },
      { id: "rolos", label: "Rolos por caixa", unidade: "un", ph: "12" },
      { id: "caixas", label: "Quantas caixas", unidade: "un", ph: "1" },
    ],
  },
  {
    id: "metragem", nome: "Metragem do rolo", icone: IC.metragem,
    sub: "Etiquetas por rolo e metros necessários",
    formula: "etiquetas = (metros × 1000 ÷ passo) × carreiras · metros = qtd × passo ÷ (carreiras × 1000)",
    campos: [
      { id: "metros", label: "Metros lineares do rolo", unidade: "m", ph: "1000" },
      { id: "passo", label: "Passo da etiqueta (altura + gap)", unidade: "mm", ph: "43" },
      { id: "carreiras", label: "Carreiras", unidade: "un", ph: "2" },
      { id: "qtd", label: "Quantidade desejada", unidade: "etiquetas", ph: "50000" },
    ],
  },
  {
    id: "valor", nome: "Valor da etiqueta", icone: IC.valor,
    sub: "Custo, margem e imposto, com e sem ferramental",
    formula: "unitário = material + tinta + rateio (clichê + faca + acerto) · preço = unitário ÷ (1 − margem) ÷ (1 − imposto)",
    campos: [
      { id: "tiragem", label: "Tiragem", unidade: "etiquetas", ph: "50000" },
      { id: "larg", label: "Largura", unidade: "mm", ph: "80" },
      { id: "alt", label: "Altura", unidade: "mm", ph: "60" },
      { id: "precoM2", label: "Preço do substrato", unidade: "R$/m²", ph: "4,20" },
      { id: "cores", label: "Número de cores", unidade: "un", ph: "4" },
      { id: "custoCor", label: "Custo por cor", unidade: "R$/mil", ph: "1,80" },
      { id: "cliche", label: "Clichê (jogo)", unidade: "R$", ph: "780" },
      { id: "faca", label: "Faca", unidade: "R$", ph: "950" },
      { id: "setup", label: "Acerto de máquina", unidade: "R$", ph: "220" },
      { id: "margem", label: "Margem", unidade: "%", ph: "28" },
      { id: "imposto", label: "Imposto", unidade: "%", ph: "12" },
    ],
  },
  {
    id: "tinta", nome: "Consumo de tinta", icone: IC.tinta,
    sub: "Gramas por cor e total do pedido",
    formula: "m² cobertos = área × tiragem × cobertura · kg = m² cobertos ÷ rendimento",
    campos: [
      { id: "larg", label: "Largura", unidade: "mm", ph: "80" },
      { id: "alt", label: "Altura", unidade: "mm", ph: "60" },
      { id: "tiragem", label: "Tiragem", unidade: "etiquetas", ph: "50000" },
      { id: "cobertura", label: "Cobertura de tinta", unidade: "%", ph: "35" },
      { id: "cores", label: "Número de cores", unidade: "un", ph: "4" },
      { id: "rendimento", label: "Rendimento da tinta", unidade: "m²/kg", ph: "60" },
    ],
  },
];

export const PADROES: Record<string, Vals> = {
  facas: { x: "50", y: "50", maquina: "Classic 160", maqW: "160", passo: "M1 π", nMin: "50", nMax: "102", repMax: "8", espMin: "2,10", espMax: "3,50", espCarr: "3,00", modo: "Dentro do filtro", filtro: "Só do estoque" },
  comparativo: { slots: "4", x0: "50", x1: "75", x2: "100", x3: "120", x4: "", x5: "", x6: "", x7: "", x8: "", x9: "", x10: "", x11: "", passo: "M1 π", nMin: "40", nMax: "400", repMax: "8", espMin: "2,10", espMax: "3,50", soFiltro: "Todos os cilindros" },
  pordiametro: { dia: "54", passo: "M1 π", repMax: "8", espMin: "2,10", espMax: "3,50", verif: "" },
  distorcao: { dentes: "96", modulo: "M1 (π)", chapa: "1,70 mm", arte: "" },
  valorcliche: { dia: "96", chapa: "1,14 mm", largEtq: "50", carreiras: "1", jogos: "1", cores: "1", prova: "0" },
  bobinas: { ext: "500", int: "76", esp: "0,080", larg: "250" },
  substrato: { larg: "38,66", carr: "6", cam: "Entre as carreiras" },
  caixa: { etiq: "1000", rolos: "12", caixas: "1" },
  metragem: { metros: "1000", passo: "43", carreiras: "2", qtd: "50000" },
  valor: { tiragem: "50000", larg: "80", alt: "60", precoM2: "4,20", cores: "4", custoCor: "1,80", cliche: "780", faca: "950", setup: "220", margem: "28", imposto: "12" },
  tinta: { larg: "80", alt: "60", tiragem: "50000", cobertura: "35", cores: "4", rendimento: "60" },
};

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/* ── helpers numéricos (porta 1:1 do protótipo) ──────────────────── */
const n = (v: unknown) => {
  const x = parseFloat(String(v == null ? "" : v).replace(",", "."));
  return isFinite(x) ? x : 0;
};
const f = (v: number, d = 2) => {
  if (!isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
};
const brl = (v: number) => "R$ " + f(v, 2);
const nearProd = (dia: number) => {
  const rd = Math.round(dia * 10) / 10;
  return PARQUE_CLASSIC.find((d) => Math.abs(rd - d) < 0.5);
};
const valorFaca = (z: number, y: number) => 17.61 * z - 2.98 * (y || 0) - 29.32;

type Row = { n: number; dev: number; dia: number; rep: number; esp: number; xAdj?: number };
function buildRows(X: number, passo: number, nMin: number, nMax: number, repMax: number): Row[] {
  const rows: Row[] = [];
  for (let z = nMin; z <= nMax; z++) {
    const dev = z * passo, dia = dev / Math.PI;
    for (let rep = 1; rep <= repMax; rep++) {
      if (dev < rep * X) continue;
      let esp = (dev - rep * X) / rep;
      if (esp < -ESP_EPS) continue;
      if (esp < 0) esp = 0;
      rows.push({ n: z, dev, dia, rep, esp });
    }
  }
  return rows;
}

/* ── resultado de cada calculadora ───────────────────────────────── */
type Cell = { v: string; mono?: boolean; fraco?: boolean; cor?: string };
type TabLinha = { destaque: boolean; ord?: Record<string, number>; cells: Cell[] };
type Tabela = {
  titulo: string; contagem: string; nota: string;
  ordem: { k: string; asc: boolean };
  colunas: { label: string; w: string; k?: string }[];
  linhas: TabLinha[];
};
type Parte = { label: string; valor: number; cor: string; fg: string; dec: number; moeda?: boolean };
type Visual = { titulo: string; totalLabel: string; total: number; partes: Parte[] } | null;
type Linha = { label: string; valor: string; forte?: boolean; amarelo?: boolean };
/** Dados do desenho técnico 1:1 (só a calculadora de facas produz). */
type Gabarito = {
  maq: string; larguraUtil: number; Z: number; dia: number; dev: number; passo: string;
  X: number; Y: number; rep: number; espV: number; carr: number; espH: number; sobra: number;
  preco: number; gap: boolean; prod?: number | null;
};
type Resultado = {
  destaque: { label: string; valor: string; unidade: string };
  /** selo do card preto ("★ Já está no estoque" / "Cilindro novo…") */
  selo?: string; seloOk?: boolean;
  /** frase explicativa própria do resultado; sem ela vale AJUDA_RESULTADO */
  dica?: string;
  nota: string; linhas: Linha[]; tabela?: Tabela; visual: Visual;
  gabarito?: Gabarito | null; resumo: string;
};

/** Exportada para poder ser conferida fora da tela (scripts/verificar-calculadoras.mjs). */
export function calcular(id: string, v: Vals): Resultado {
  const num = (k: string) => n(v[k]);
  const passoDe = (k: string) => (PASSOS.find((p) => p.l === v[k]) || PASSOS[0]).v;

  if (id === "facas") {
    const X = num("x"), Y = num("y");
    const passo = passoDe("passo");
    const maqSel = MAQUINAS.find((m) => m.l === v.maquina) || MAQUINAS[0];
    const maq = { l: maqSel.l, v: maqSel.v > 0 ? maqSel.v : (num("maqW") || 140) };
    const nMin = Math.max(1, Math.round(num("nMin"))), nMax = Math.max(nMin + 1, Math.round(num("nMax")));
    const repMax = Math.max(1, Math.round(num("repMax")));
    const espMin = num("espMin"), espMax = num("espMax");
    const zeroMode = Math.abs(espMin) <= ESP_EPS && Math.abs(espMax) <= ESP_EPS;
    const modoProx = v.modo === "Mais próximos";
    const meio = (espMin + espMax) / 2;
    let todas: Row[];
    if (zeroMode) {
      todas = [];
      for (let z = nMin; z <= nMax; z++) {
        const dev = z * passo;
        for (let rep = 1; rep <= repMax; rep++) todas.push({ n: z, dev, dia: dev / Math.PI, rep, esp: 0, xAdj: dev / rep });
      }
    } else {
      todas = buildRows(X, passo, nMin, nMax, repMax);
    }
    if (v.filtro !== "Todos") todas = todas.filter((r) => nearProd(r.dia) != null);
    let rows: Row[] = [], aviso = "";
    if (zeroMode) {
      rows = [...todas].sort((a, b) => Math.abs(a.xAdj! - X) - Math.abs(b.xAdj! - X)).slice(0, 40);
      aviso = "Faca de gap: não tem perda, então a altura é ajustada para o valor exato que zera o esqueleto. 40 combinações com altura mais próxima de " + f(X, 2) + " mm.";
    } else if (modoProx) {
      rows = [...todas].sort((a, b) => Math.abs(a.esp - meio) - Math.abs(b.esp - meio)).slice(0, 40);
      aviso = "Modo mais próximos: 40 cilindros cuja perda mais se aproxima de " + f(meio, 2) + " mm.";
    } else {
      rows = todas.filter((r) => r.esp >= espMin - ESP_EPS && r.esp <= espMax + ESP_EPS).sort((a, b) => a.esp - b.esp);
      if (!rows.length && todas.length) {
        const best = [...todas].sort((a, b) => {
          const da = a.esp < espMin ? espMin - a.esp : a.esp > espMax ? a.esp - espMax : 0;
          const db = b.esp < espMin ? espMin - b.esp : b.esp > espMax ? b.esp - espMax : 0;
          return da - db;
        })[0];
        /* a perda mín./máx. é padrão de fábrica — quem mexe nela muda a regra
           da casa. O que dá para ajustar é a ALTURA: para cada combinação, a
           altura que joga a perda no meio da faixa é dev/rep − meio. Sugerimos
           a mais perto da altura pedida, para cima ou para baixo. */
        const alvo = todas
          .map((rr) => ({ rr, x: rr.dev / rr.rep - meio }))
          .filter((c) => c.x > 0)
          .sort((a, b) => Math.abs(a.x - X) - Math.abs(b.x - X))[0];
        aviso = alvo
          ? "Nenhum cilindro fecha com altura de " + f(X, 2) + " mm. A perda de " + f(espMin, 2) + " a " + f(espMax, 2) + " mm é o padrão da fábrica. O ajuste é na altura: com " + f(alvo.x, 2) + " mm (" + (alvo.x > X ? "+" : "") + f(alvo.x - X, 2) + " mm) a etiqueta fecha em Z" + alvo.rr.n + ", " + alvo.rr.rep + "× com perda de " + f(meio, 2) + " mm."
          : "Nenhum cilindro com perda entre " + f(espMin, 2) + " e " + f(espMax, 2) + " mm. O mais próximo tem perda de " + f(best.esp, 3) + " mm (Z" + best.n + ", " + best.rep + "×). Use “Mais próximos”.";
      }
    }
    const lista = rows.slice(0, 120);
    const espMed = rows.length ? rows.reduce((s, r) => s + r.esp, 0) / rows.length : 0;
    const deltaMed = zeroMode && rows.length ? rows.reduce((s, r) => s + Math.abs(r.xAdj! - X), 0) / rows.length : 0;
    const reps = [...new Set(rows.map((r) => r.rep))].sort((a, b) => a - b);
    const prod = rows.filter((r) => nearProd(r.dia) != null).length;
    /* Perda ENTRE CARREIRAS é fixa (3 mm de fábrica, como na conta do
       substrato), não o resto da divisão: antes a folga era espalhada entre as
       carreiras e saía um número torto (3,333 mm) que ninguém usa na prática.
       Uma perda depois de cada carreira — k × (Y + perda) — e o que sobrar da
       largura útil é sobra de bobina. */
    const espCarr = Math.max(0, num("espCarr"));
    let carr: { n: number; esp: number; total: number; sobra: number } | null = null;
    const carrOpts: string[] = [];
    if (Y > 0) {
      const passoH = Y + espCarr;
      const teto = Math.floor(maq.v / passoH);
      for (let k = 1; k <= teto; k++) {
        const total = k * passoH;
        carr = { n: k, esp: espCarr, total, sobra: maq.v - total };
        carrOpts.push(k + "× (sobra " + f(maq.v - total, 2) + ")");
      }
    }
    /* o recomendado é o primeiro (menor perda) que JÁ ESTÁ no parque;
       sem nenhum no parque, o primeiro da lista */
    const melhor = rows.find((r) => nearProd(r.dia) != null) || rows[0] || null;
    const mFaca = melhor ? valorFaca(melhor.n, Y) : 0;
    const mEngr = melhor ? melhor.n * ENGR_POR_DENTE : 0;
    const mProd = melhor ? nearProd(melhor.dia) : null;
    return {
      destaque: zeroMode
        ? { label: "Altura ajustada mais próxima", valor: melhor ? f(melhor.xAdj!, 3) : "—", unidade: "mm" }
        : { label: "Cilindro recomendado", valor: melhor ? "Z" + melhor.n : "—", unidade: melhor ? "Ø " + f(melhor.dia, 2) + " mm" : "" },
      selo: melhor && !zeroMode ? (mProd != null ? "★ Já está no estoque" : "Cilindro novo · não temos no estoque") : "",
      seloOk: mProd != null,
      dica: zeroMode || !melhor ? "" : melhor.rep + " repetições de " + f(X, 2) + " mm com perda de " + f(melhor.esp, 3) + " mm por etiqueta.",
      nota: aviso || (rows.length
        ? rows.length + (rows.length === 1 ? " cilindro serve" : " cilindros servem") + " · " + prod + " no estoque · perda média de " + f(espMed, 3) + " mm · repetições " + reps.join(" · ")
        : "Informe uma altura X válida e um intervalo de dentes."),
      linhas: [
        { label: "Altura X " + (zeroMode ? "(desejada)" : "(entrada)"), valor: f(X, 2) + " mm" },
        zeroMode
          ? { label: "Perda", valor: "0,000 mm exata" }
          : { label: "Perda média", valor: f(espMed, 3) + " mm" },
        zeroMode
          ? { label: "Δ altura média", valor: f(deltaMed, 3) + " mm de ajuste" }
          : { label: "No estoque", valor: String(prod) },
        { label: "Repetições encontradas", valor: reps.length ? reps.join(" · ") : "—" },
        { label: "Carreiras (largura Y)", valor: carr ? (zeroMode ? carr.n + "× · sem perda" : carr.n + "× · perda " + f(carr.esp, 3) + " mm") : "Y + perda mín. não cabe em " + f(maq.v, 0) + " mm", forte: true },
        { label: "Total na largura · " + maq.l, valor: carr ? f(carr.total, 2) + " de " + f(maq.v, 0) + " mm · sobra " + f(carr.sobra, 2) : "—" },
        { label: "Opções de carreiras", valor: carrOpts.length ? carrOpts.slice(0, 5).join(" · ") : "—" },
        { label: "Preço da faca", valor: melhor ? (mFaca > 0 ? brl(mFaca) : "—") : "—", forte: true },
        { label: "Preço da engrenagem", valor: melhor ? brl(mEngr) : "—", forte: true },
        { label: "Total faca + engrenagem", valor: melhor ? brl((mFaca > 0 ? mFaca : 0) + mEngr) : "—", forte: true, amarelo: true },
      ],
      tabela: {
        titulo: zeroMode ? "Cilindros com altura ajustada" : modoProx ? "Cilindros mais próximos" : "Cilindros compatíveis",
        contagem: rows.length + (rows.length === 1 ? " resultado" : " resultados"),
        nota: "★ = temos no estoque · Faca SAE 4140 = 17,61×Z − 2,98×Y − 29,32 · Engrenagem = Z × 1,76",
        ordem: { k: zeroMode ? "xAdj" : "esp", asc: true },
        colunas: ([
          /* diâmetro saiu da tabela: é o desenvolvimento ÷ π e o cilindro já é
             chamado pelos dentes. O ★ de "no estoque" mudou para os dentes. */
          { label: "Dentes", w: "110px", k: "n" },
          { label: "Desenv. (mm)", w: "1fr", k: "dev" },
          { label: "Rep.", w: "70px", k: "rep" },
        ] as Tabela["colunas"]).concat(zeroMode ? [{ label: "Altura ajustada (mm)", w: "1.2fr", k: "xAdj" }, { label: "Δ altura (mm)", w: "1fr", k: "delta" }] : [{ label: "Perda (mm)", w: "1fr", k: "esp" }])
          .concat([
            { label: "Faca (R$)", w: "1fr", k: "faca" },
            { label: "Engrenagem (R$)", w: "1fr", k: "engr" },
            { label: "Preço total (R$)", w: "1.1fr", k: "preco" },
          ]),
        linhas: lista.map((r) => {
          const pd = nearProd(r.dia);
          const faca = valorFaca(r.n, Y), engr = r.n * ENGR_POR_DENTE;
          const total = (faca > 0 ? faca : 0) + engr;
          const cor = zeroMode ? "" : r.esp < espMin - ESP_EPS ? "#c0392b" : r.esp > espMax + ESP_EPS ? "#a76a00" : "#1e7a3c";
          const base: Cell[] = [
            { v: "Z" + r.n + (pd != null ? "  ★" : ""), mono: true },
            { v: f(r.dev, 3) },
            { v: r.rep + "×" },
          ];
          const meio2: Cell[] = zeroMode
            ? [{ v: f(r.xAdj!, 3), mono: true }, { v: (r.xAdj! - X >= 0 ? "+" : "") + f(r.xAdj! - X, 3), fraco: true }]
            : [{ v: f(r.esp, 3), mono: true, cor }];
          return {
            destaque: pd != null,
            ord: { n: r.n, dev: r.dev, dia: r.dia, rep: r.rep, esp: r.esp, xAdj: r.xAdj || 0, delta: Math.abs((r.xAdj || 0) - X), faca: faca > 0 ? faca : 0, engr, preco: total },
            cells: base.concat(meio2).concat([
              { v: faca > 0 ? f(faca, 2) : "—", fraco: !(faca > 0) },
              { v: f(engr, 2) },
              { v: brl(total), cor: "#1e7a3c" },
            ]),
          };
        }),
      },
      visual: carr ? {
        titulo: "Ocupação da largura útil · " + maq.l,
        totalLabel: f(maq.v, 0) + " mm",
        total: maq.v,
        partes: [
          { label: carr.n + "× etiqueta de " + f(Y, 2) + " mm", valor: carr.n * Y, cor: "#ffe815", fg: "#252425", dec: 2 },
          { label: (zeroMode ? "Folga · " : "Esqueleto · ") + f(carr.esp, 2) + " mm por carreira", valor: carr.n * carr.esp, cor: "#252425", fg: "#ffe815", dec: 2 },
          { label: "Sobra na bobina", valor: Math.max(0, carr.sobra), cor: "#e0e0e0", fg: "#5c5a5c", dec: 2 },
        ],
      } : null,
      gabarito: melhor ? {
        maq: maq.l, larguraUtil: maq.v, Z: melhor.n, dia: melhor.dia, dev: melhor.dev, passo: v.passo,
        X: zeroMode ? melhor.xAdj! : X, Y, rep: melhor.rep, espV: melhor.esp,
        carr: carr ? carr.n : 0, espH: carr ? carr.esp : 0, sobra: carr ? carr.sobra : 0,
        preco: mFaca > 0 ? mFaca + mEngr : mEngr, gap: zeroMode, prod: mProd,
      } : null,
      resumo: f(X, 2) + " mm · " + rows.length + " cilindros · " + v.passo + (zeroMode ? " · perda 0" : ""),
    };
  }

  if (id === "comparativo") {
    const passo = passoDe("passo");
    const nMin = Math.max(1, Math.round(num("nMin"))), nMax = Math.max(nMin + 1, Math.round(num("nMax")));
    const repMax = Math.max(1, Math.round(num("repMax")));
    const espMin = num("espMin"), espMax = num("espMax");
    const meio = (espMin + espMax) / 2;
    const facas: [string, number][] = [];
    for (let i = 0; i < NSLOTS(v); i++) if (num("x" + i) > 0) facas.push([LETRAS[i], num("x" + i)]);
    type RowD = Row & { dentro: boolean };
    const mapa = new Map<number, { n: number; dev: number; dia: number; por: Record<string, RowD> }>();
    facas.forEach(([nome, X]) => {
      const melhorPorZ = new Map<number, RowD>();
      buildRows(X, passo, nMin, nMax, repMax).forEach((r) => {
        const dentro = r.esp >= espMin - ESP_EPS && r.esp <= espMax + ESP_EPS;
        const cur = melhorPorZ.get(r.n);
        if (!cur) melhorPorZ.set(r.n, { ...r, dentro });
        else if (!cur.dentro && dentro) melhorPorZ.set(r.n, { ...r, dentro });
        else if (cur.dentro === dentro && Math.abs(r.esp - meio) < Math.abs(cur.esp - meio)) melhorPorZ.set(r.n, { ...r, dentro });
      });
      melhorPorZ.forEach((r, z) => {
        if (!mapa.has(z)) mapa.set(z, { n: z, dev: r.dev, dia: r.dia, por: {} });
        mapa.get(z)!.por[nome] = r;
      });
    });
    const entradas = [...mapa.values()]
      .filter((e) => Object.values(e.por).some((r) => r.dentro))
      .sort((a, b) => {
        const pa = nearProd(a.dia) != null ? 0 : 1, pb = nearProd(b.dia) != null ? 0 : 1;
        return pa !== pb ? pa - pb : a.dia - b.dia;
      });
    const compart = entradas.filter((e) => Object.values(e.por).filter((r) => r.dentro).length >= 2);
    const prod = entradas.filter((e) => nearProd(e.dia) != null).length;
    const prodCompart = compart.filter((e) => nearProd(e.dia) != null).length;
    const semEncaixe = facas.filter(([nome]) => !entradas.some((e) => e.por[nome] && e.por[nome].dentro));
    const exibidas = v.soFiltro === "Só no filtro"
      ? entradas.filter((e) => Object.values(e.por).some((r) => r.dentro))
      : entradas;
    return {
      destaque: { label: "Diâmetros compartilhados", valor: String(compart.length), unidade: "cilindros" },
      nota: facas.length < 2
        ? "Informe ao menos duas alturas para comparar."
        : semEncaixe.length
          ? "Sem encaixe no filtro " + f(espMin, 2) + " a " + f(espMax, 2) + " mm: " + semEncaixe.map((fx) => "Faca " + fx[0] + " (" + f(fx[1], 2) + " mm)").join(", ") + "."
          : entradas.length + " cilindros atendem alguma das facas · " + prod + " no estoque · " + compart.length + " servem 2 ou mais.",
      linhas: [
        { label: "Facas comparadas", valor: facas.map((fx) => fx[0] + " " + f(fx[1], 2)).join(" · ") || "—" },
        { label: "Cilindros com encaixe", valor: String(entradas.length) },
        { label: "No estoque", valor: String(prod) },
        { label: "Servem 2 ou mais facas", valor: String(compart.length), forte: true },
        { label: "Produção + compartilhados", valor: String(prodCompart), forte: true },
        { label: "Filtro de perda", valor: f(espMin, 2) + " a " + f(espMax, 2) + " mm" },
      ],
      tabela: {
        titulo: "Comparativo de diâmetros",
        contagem: exibidas.length + " cilindros",
        nota: "célula = perda (mm) e repetições · valor entre parênteses = fora do filtro · ★ = temos no estoque",
        ordem: { k: "dia", asc: true },
        colunas: ([{ label: "Diâmetro (mm)", w: "1.5fr", k: "dia" }] as Tabela["colunas"])
          .concat(facas.map((fx) => ({ label: "Faca " + fx[0] + " · " + f(fx[1], 2) + " mm", w: "1fr", k: "f" + fx[0] })))
          .concat([{ label: "Preço (R$)", w: "1.1fr", k: "preco" }]),
        linhas: exibidas.slice(0, 120).map((e) => {
          const pd = nearProd(e.dia);
          const dentroN = Object.values(e.por).filter((r) => r.dentro).length;
          const faca = valorFaca(e.n, 0), engr = e.n * ENGR_POR_DENTE;
          const total = (faca > 0 ? faca : 0) + engr;
          const ord: Record<string, number> = { dia: e.dia, preco: total };
          const cells: Cell[] = [{ v: f(e.dia, 2) + (pd != null ? "  ★ Ø" + pd : "") + "  ·  Z" + e.n + (dentroN >= 2 ? "  · " + dentroN + " facas" : "") }];
          facas.forEach(([nome]) => {
            const r = e.por[nome];
            ord["f" + nome] = r ? r.esp : 999;
            cells.push({
              v: r && r.dentro ? f(r.esp, 3) + "  " + r.rep + "×" : r ? "(" + f(r.esp, 3) + ")  " + r.rep + "×" : "—",
              mono: !!(r && r.dentro),
              fraco: !(r && r.dentro),
              cor: r && r.dentro ? "#1e7a3c" : "",
            });
          });
          cells.push({ v: brl(total), fraco: !(faca > 0) });
          return { destaque: pd != null && dentroN >= 2, ord, cells };
        }),
      },
      visual: entradas.length ? {
        titulo: "Cilindros por aproveitamento",
        totalLabel: entradas.length + " cilindros",
        total: entradas.length,
        partes: [
          { label: "Servem 2 ou mais facas", valor: compart.length, cor: "#ffe815", fg: "#252425", dec: 0 },
          { label: "Servem só 1 faca", valor: Math.max(0, entradas.length - compart.length), cor: "#252425", fg: "#ffe815", dec: 0 },
        ],
      } : null,
      resumo: facas.map((fx) => f(fx[1], 2)).join(" · ") + " mm",
    };
  }

  if (id === "pordiametro") {
    const dia = num("dia");
    const passo = passoDe("passo");
    const dev = dia * Math.PI;
    const repMax = Math.max(1, Math.round(num("repMax")));
    const espMin = num("espMin"), espMax = num("espMax");
    const verif = num("verif");
    const rows: { rep: number; base: number; xMin: number; xMax: number; ideal: number; intervalo: number }[] = [];
    for (let rep = 1; rep <= repMax; rep++) {
      const base = dev / rep;
      const xMax = base - espMin, xMin = base - espMax;
      if (xMax <= 0) continue;
      rows.push({ rep, base, xMin: Math.max(0, xMin), xMax, ideal: xMax, intervalo: Math.max(0, xMax - Math.max(0, xMin)) });
    }
    let verifTxt = "Informe uma altura em “verificar faca existente” para conferir o encaixe.";
    if (verif > 0) {
      const meio = (espMin + espMax) / 2;
      let melhor: { rep: number; esp: number } | null = null;
      for (let rep = 1; rep <= repMax; rep++) {
        if (dev < rep * verif) continue;
        const esp = (dev - rep * verif) / rep;
        if (esp < -ESP_EPS) continue;
        if (!melhor || Math.abs(esp - meio) < Math.abs(melhor.esp - meio)) melhor = { rep, esp };
      }
      if (!melhor) verifTxt = "✗ " + f(verif, 2) + " mm é maior que o desenvolvimento deste cilindro (" + f(dev, 3) + " mm).";
      else if (melhor.esp >= espMin - ESP_EPS && melhor.esp <= espMax + ESP_EPS)
        verifTxt = "✓ " + f(verif, 2) + " mm encaixa com " + melhor.rep + "× e perda de " + f(melhor.esp, 3) + " mm.";
      else
        verifTxt = "⚠ " + f(verif, 2) + " mm fora do filtro. Melhor opção: " + melhor.rep + "× com perda de " + f(melhor.esp, 3) + " mm.";
    }
    const pd = nearProd(dia);
    return {
      destaque: { label: "Altura ideal (1 repetição)", valor: rows.length ? f(rows[0].ideal, 3) : "—", unidade: "mm" },
      nota: verifTxt,
      linhas: [
        { label: "Desenvolvimento", valor: f(dev, 3) + " mm" },
        { label: "Cilindro no estoque", valor: pd != null ? "★ Ø" + pd : "não cadastrado" },
        { label: "Dentes equivalentes (" + v.passo + ")", valor: f(dev / passo, 2) + " · inteiro " + Math.round(dev / passo) },
        { label: "Desenvolvimento no Z inteiro", valor: f(Math.round(dev / passo) * passo, 3) + " mm" },
        { label: "Opções de repetição", valor: String(rows.length) },
        { label: "Margem de altura", valor: f(espMax - espMin, 2) + " mm" },
      ],
      tabela: {
        titulo: "Alturas válidas por repetição",
        contagem: rows.length + (rows.length === 1 ? " opção" : " opções"),
        nota: "Ideal = Dev÷Rep − perda mín. · intervalo usa a faixa de perda informada",
        ordem: { k: "rep", asc: true },
        colunas: [
          { label: "Rep.", w: "80px", k: "rep" },
          { label: "Dev ÷ Rep (mm)", w: "1fr", k: "base" },
          { label: "Altura mín. (mm)", w: "1fr", k: "xMin" },
          { label: "Altura máx. (mm)", w: "1fr", k: "xMax" },
          { label: "Altura ideal (mm)", w: "1fr", k: "ideal" },
          { label: "Margem (mm)", w: "1fr", k: "intervalo" },
          { label: "Sugestões 0,5 em 0,5 (perda)", w: "2.2fr" },
        ],
        linhas: rows.map((r) => {
          const picks: string[] = [];
          for (let x = Math.ceil(r.xMin * 2) / 2; x <= r.xMax + 0.001 && picks.length < 5; x += 0.5) {
            const xr = Math.round(x * 100) / 100;
            if (xr >= r.xMin - 0.001) picks.push(f(xr, 1) + " (" + f((dev - r.rep * xr) / r.rep, 2) + ")");
          }
          return {
            destaque: false,
            ord: { rep: r.rep, base: r.base, xMin: r.xMin, xMax: r.xMax, ideal: r.ideal, intervalo: r.intervalo },
            cells: [
              { v: r.rep + "×" },
              { v: f(r.base, 3) },
              { v: f(r.xMin, 3) },
              { v: f(r.xMax, 3) },
              { v: f(r.ideal, 3), mono: true, cor: "#1e7a3c" },
              { v: f(r.intervalo, 3) },
              { v: picks.length ? picks.join("  ·  ") : "—", fraco: !picks.length },
            ],
          };
        }),
      },
      visual: rows.length ? {
        titulo: "Desenvolvimento em " + rows[0].rep + "× repetição",
        totalLabel: f(dev, 2) + " mm",
        total: dev,
        partes: [
          { label: "Alturas de faca", valor: rows[0].rep * rows[0].ideal, cor: "#ffe815", fg: "#252425", dec: 2 },
          { label: "Perdas · " + f(espMin, 2) + " mm × " + rows[0].rep, valor: rows[0].rep * espMin, cor: "#252425", fg: "#ffe815", dec: 2 },
        ],
      } : null,
      resumo: "Ø " + f(dia, 2) + " mm · " + rows.length + " alturas",
    };
  }

  if (id === "distorcao") {
    const dentes = num("dentes");
    const mod = MODULOS.find((m) => m.l === v.modulo) || MODULOS[0];
    const chapa = CHAPAS.find((c) => c.l === v.chapa) || CHAPAS[0];
    const R = dentes * mod.v;
    const K = chapa.k;
    const TI = R - K;
    const pct = R > 0 ? (K / R) * 100 : 0;
    const fator = R > 0 ? TI / R : 0;
    const arte = num("arte");
    return {
      destaque: { label: "Tamanho a aplicar no impresso", valor: f(TI, 3), unidade: "mm" },
      nota: "R = " + dentes + " × " + f(mod.v, 5) + " = " + f(R, 3) + " mm · K = 2π × (" + f(chapa.t, 2) + " − 0,127) = " + f(K, 3),
      linhas: [
        { label: "Distorção do clichê", valor: f(pct, 3) + " %", forte: true },
        { label: "Repetição (R)", valor: f(R, 3) + " mm", forte: true },
        { label: "K da chapa", valor: f(K, 3) },
        { label: "Fator de gravação", valor: f(fator, 5) },
        { label: "Arte flat (correção)", valor: arte > 0 ? f(arte * fator, 4) + " mm" : "—" },
      ],
      visual: null,
      resumo: f(pct, 3) + "% · Z" + dentes + " · " + chapa.l,
    };
  }

  if (id === "valorcliche") {
    const dia = num("dia"), largEtq = num("largEtq");
    const carreiras = Math.max(1, num("carreiras"));
    const jogos = num("jogos") || 1;
    const cores = Math.max(1, num("cores"));
    const prova = num("prova");
    const chapa = CHAPAS_VALOR.find((c) => c.l === v.chapa) || CHAPAS_VALOR[0];
    const alturaBruta = dia * Math.PI + 40 - chapa.distorcao;
    const altura = Math.round(alturaBruta / 5) * 5;
    const largura = largEtq * carreiras + 3 * (carreiras - 1);
    const umJogo = jogos === 1;
    const area = (altura * largura) / 100;
    /* Cada clichê arredondado ao centavo antes de somar, como a clicheria
       cobra: nos orçamentos dela (Desktop/Valor Facas/Clichê, A a H) cada
       linha vem arredondada e o total é a soma das linhas. Sem isso o total
       saía 1 centavo abaixo (2 × 76,375 = 152,75; a clicheria cobra 152,76). */
    const valorCor = Math.round(area * chapa.taxa * 100) / 100;
    const total = valorCor * cores + prova;
    return {
      destaque: { label: "Total", valor: umJogo ? f(total, 2) : "—", unidade: umJogo ? "R$" : "" },
      nota: umJogo
        ? "Altura = ARRED5(" + f(dia, 2) + " × π + 40 − " + f(chapa.distorcao, 2) + ") · taxa " + f(chapa.taxa, 3)
        : "Área e valores só são calculados com Jogos = 1.",
      linhas: [
        { label: "Altura da chapa", valor: f(altura, 0) + " mm", forte: true },
        { label: "Largura da chapa", valor: f(largura, 2) + " mm", forte: true },
        { label: "Área", valor: umJogo ? f(area, 2) + " cm²" : "—" },
        { label: "Valor por cor", valor: umJogo ? brl(valorCor) : "—" },
        { label: "Cores", valor: String(cores) },
        { label: "Prova", valor: brl(prova) },
      ],
      visual: umJogo && total > 0 ? {
        titulo: "Composição do valor",
        totalLabel: brl(total),
        total,
        partes: [
          { label: cores + " cor(es) de clichê", valor: valorCor * cores, cor: "#ffe815", fg: "#252425", dec: 2, moeda: true },
          { label: "Prova", valor: prova, cor: "#252425", fg: "#ffe815", dec: 2, moeda: true },
        ],
      } : null,
      resumo: umJogo ? brl(total) + " · " + cores + " cores · " + chapa.l : "jogos " + jogos,
    };
  }

  if (id === "bobinas") {
    const Dext = num("ext"), Dint = num("int"), t = num("esp"), larg = num("larg");
    const valido = Dext > Dint && t > 0;
    const mm = valido ? Math.PI * (Dext * Dext - Dint * Dint) / (4 * t) : 0;
    const parede = (Dext - Dint) / 2;
    const voltas = t > 0 ? parede / t : 0;
    return {
      destaque: { label: "Comprimento estimado", valor: valido ? f(mm / 1000, 2) : "—", unidade: "m" },
      nota: valido
        ? "L = π × (" + f(Dext, 1) + "² − " + f(Dint, 1) + "²) ÷ (4 × " + f(t, 3) + ")"
        : "O Ø externo precisa ser maior que o interno e a espessura maior que zero.",
      linhas: [
        { label: "Milímetros", valor: valido ? f(mm, 0) + " mm" : "—" },
        { label: "Voltas", valor: valido ? f(voltas, 0) : "—" },
        { label: "Espessura do rolo (parede)", valor: valido ? f(parede, 2) + " mm" : "—" },
        { label: "Área total", valor: valido && larg > 0 ? f((mm / 1000) * (larg / 1000), 2) + " m²" : "informe a largura" },
        { label: "Peso por m² (referência)", valor: "—" },
      ],
      visual: valido ? {
        titulo: "Seção do rolo",
        totalLabel: f(Dext, 0) + " mm de Ø",
        total: Dext,
        partes: [
          { label: "Núcleo", valor: Dint, cor: "#e0e0e0", fg: "#5c5a5c", dec: 0 },
          { label: "Material enrolado · " + f(voltas, 0) + " voltas", valor: Dext - Dint, cor: "#ffe815", fg: "#252425", dec: 0 },
        ],
      } : null,
      resumo: valido ? f(mm / 1000, 2) + " m · Ø " + f(Dext, 0) + "/" + f(Dint, 0) : "dados incompletos",
    };
  }

  if (id === "substrato") {
    const larg = num("larg");
    const carr = Math.max(1, Math.round(num("carr")));
    const entre = v.cam !== "Nas bordas";
    const nEsp = entre ? carr : carr - 1;
    const espTotal = nEsp * SUB_PERDA;
    const arte = carr * larg + espTotal;
    const borda = entre ? 0 : (SUB_CAMEROM + SUB_FOLGA) * 2;
    const total = arte + borda;
    const servem = SUB_ESTOQUE.filter((x) => x >= total);
    return {
      destaque: { label: "Largura mínima do substrato", valor: f(total, 2), unidade: "mm" },
      nota: entre
        ? carr + " × (" + f(larg, 2) + " + 3) = " + f(total, 2) + " mm. Camerom dentro da perda, uma após cada carreira."
        : carr + " × " + f(larg, 2) + " + " + nEsp + " × 3 + 4 = " + f(total, 2) + " mm. Camerom nas bordas (1 + folga 1 de cada lado).",
      linhas: [
        { label: "Etiquetas", valor: carr + " × " + f(larg, 2) + " = " + f(carr * larg, 2) + " mm" },
        { label: "Perda", valor: nEsp + " × 3 = " + f(espTotal, 2) + " mm" },
        { label: "Bordas", valor: entre ? "—" : "+" + f(borda, 0) + " mm" },
        { label: "Largura mínima", valor: f(total, 2) + " mm", forte: true },
        { label: "Bobinas do estoque que servem", valor: servem.length ? servem.slice(0, 4).join(" · ") + " mm" : "nenhuma" },
        { label: "Menor bobina possível", valor: servem.length ? servem[0] + " mm · sobra " + f(servem[0] - total, 2) + " mm" : "—", forte: true },
      ],
      visual: {
        titulo: servem.length ? "Uso da bobina de " + servem[0] + " mm" : "Largura necessária",
        totalLabel: (servem.length ? servem[0] : Math.ceil(total)) + " mm",
        total: servem.length ? servem[0] : total,
        partes: [
          { label: carr + " etiquetas de " + f(larg, 2) + " mm", valor: carr * larg, cor: "#ffe815", fg: "#252425", dec: 2 },
          { label: "Perda e bordas", valor: espTotal + borda, cor: "#252425", fg: "#ffe815", dec: 2 },
          { label: "Sobra", valor: servem.length ? Math.max(0, servem[0] - total) : 0, cor: "#e0e0e0", fg: "#5c5a5c", dec: 2 },
        ],
      },
      resumo: carr + " carreiras · " + f(total, 2) + " mm",
    };
  }

  if (id === "caixa") {
    const etiq = num("etiq"), rolos = num("rolos");
    const caixas = Math.max(1, num("caixas"));
    const total = etiq * rolos;
    return {
      destaque: { label: "Etiquetas na caixa", valor: f(total, 0), unidade: "un" },
      nota: caixas > 1
        ? caixas + " caixas = " + f(total * caixas, 0) + " etiquetas no pedido."
        : "Informe quantas caixas para ver o total do pedido.",
      linhas: [
        { label: "Por rolo", valor: f(etiq, 0) },
        { label: "Rolos por caixa", valor: f(rolos, 0) },
        { label: "Etiquetas na caixa", valor: f(total, 0), forte: true },
        { label: "Caixas", valor: f(caixas, 0) },
        { label: "Total do pedido", valor: f(total * caixas, 0), forte: true },
      ],
      visual: total > 0 ? {
        titulo: "Pedido em caixas",
        totalLabel: f(total * caixas, 0) + " etiquetas",
        total: total * caixas,
        partes: [
          { label: caixas > 1 ? "1ª caixa" : f(rolos, 0) + " rolos × " + f(etiq, 0) + " etiquetas", valor: total, cor: "#ffe815", fg: "#252425", dec: 0 },
          { label: "Demais caixas · " + f(Math.max(0, caixas - 1), 0), valor: total * Math.max(0, caixas - 1), cor: "#252425", fg: "#ffe815", dec: 0 },
        ],
      } : null,
      resumo: f(total, 0) + " et./caixa · " + f(rolos, 0) + " rolos",
    };
  }

  if (id === "metragem") {
    const m = num("metros"), passo = num("passo") || 1, carr = Math.max(1, num("carreiras")), qtd = num("qtd");
    const porCarreira = Math.floor(m * 1000 / passo);
    const total = porCarreira * carr;
    const metrosQtd = qtd * passo / (carr * 1000);
    return {
      destaque: { label: "Etiquetas por rolo", valor: f(total, 0), unidade: "un" },
      nota: "Para " + f(qtd, 0) + " etiquetas são necessários " + f(metrosQtd, 1) + " m, " + f(qtd / (total || 1), 2) + " rolos.",
      linhas: [
        { label: "Etiquetas por carreira", valor: f(porCarreira, 0) },
        { label: "Metros para a quantidade", valor: f(metrosQtd, 1) + " m", forte: true },
        { label: "Rolos necessários", valor: f(qtd / (total || 1), 2) },
        { label: "Metros por mil etiquetas", valor: f(1000 * passo / (carr * 1000), 2) + " m" },
        { label: "Passo utilizado", valor: f(passo, 2) + " mm" },
      ],
      visual: m > 0 ? {
        titulo: "Uso do rolo",
        totalLabel: f(m, 0) + " m",
        total: m,
        partes: [
          { label: "Para a quantidade pedida", valor: Math.min(m, metrosQtd), cor: "#ffe815", fg: "#252425", dec: 1 },
          { label: "Restante do rolo", valor: Math.max(0, m - metrosQtd), cor: "#e0e0e0", fg: "#5c5a5c", dec: 1 },
        ],
      } : null,
      resumo: f(total, 0) + " et./rolo · " + carr + " carreiras",
    };
  }

  if (id === "valor") {
    const tir = Math.max(1, num("tiragem"));
    const area = (num("larg") + 3) * (num("alt") + 3) / 1e6;
    const m2 = area * tir;
    const material = m2 * num("precoM2");
    const tinta = num("cores") * num("custoCor") * tir / 1000;
    const ferram = num("cliche") + num("faca") + num("setup");
    const custo = material + tinta + ferram;
    const unit = custo / tir;
    const margem = Math.min(0.95, num("margem") / 100);
    const imposto = Math.min(0.95, num("imposto") / 100);
    const preco = unit / (1 - margem) / (1 - imposto);
    const semFerram = (material + tinta) / tir / (1 - margem) / (1 - imposto);
    return {
      destaque: { label: "Preço por mil etiquetas", valor: f(preco * 1000, 2), unidade: "R$" },
      nota: "Sem clichê e faca o mil cai para " + brl(semFerram * 1000) + ", margem de desconto de " + f((1 - semFerram / preco) * 100, 1) + "%.",
      linhas: [
        { label: "Área com esqueleto", valor: f(area * 1e4, 2) + " cm²" },
        { label: "Material (" + f(m2, 1) + " m²)", valor: brl(material) },
        { label: "Tinta e acerto", valor: brl(tinta) },
        { label: "Ferramental + acerto", valor: brl(ferram) },
        { label: "Custo unitário", valor: brl(unit) },
        { label: "Preço unitário", valor: brl(preco), forte: true },
        { label: "Total faturado", valor: brl(preco * tir), forte: true },
      ],
      visual: custo > 0 ? {
        titulo: "Composição do preço",
        totalLabel: brl(preco * tir),
        total: preco * tir,
        partes: [
          { label: "Material", valor: material, cor: "#ffe815", fg: "#252425", dec: 2, moeda: true },
          { label: "Tinta e acerto", valor: tinta, cor: "#c9c8c9", fg: "#252425", dec: 2, moeda: true },
          { label: "Ferramental", valor: ferram, cor: "#252425", fg: "#ffe815", dec: 2, moeda: true },
          { label: "Margem e imposto", valor: Math.max(0, preco * tir - custo), cor: "#8d8b8d", fg: "#ffffff", dec: 2, moeda: true },
        ],
      } : null,
      resumo: brl(preco * 1000) + "/mil · " + f(tir, 0) + " et.",
    };
  }

  /* tinta */
  const area = num("larg") * num("alt") / 1e6;
  const tir = num("tiragem");
  const cob = num("cobertura") / 100;
  const cores = Math.max(1, num("cores"));
  const rend = num("rendimento") || 1;
  const m2 = area * tir;
  const cobertos = m2 * cob;
  const kgCor = cobertos / rend;
  return {
    destaque: { label: "Tinta total do pedido", valor: f(kgCor * cores, 3), unidade: "kg" },
    nota: f(kgCor, 3) + " kg por cor em " + f(m2, 1) + " m² impressos, com " + f(cob * 100, 0) + "% de cobertura.",
    linhas: [
      { label: "Área impressa", valor: f(m2, 1) + " m²" },
      { label: "Área coberta por cor", valor: f(cobertos, 1) + " m²" },
      { label: "Tinta por cor", valor: f(kgCor * 1000, 0) + " g", forte: true },
      { label: "Tinta por mil etiquetas", valor: f(kgCor * cores / (tir || 1) * 1e6, 1) + " g" },
      { label: "Rendimento usado", valor: f(rend, 0) + " m²/kg" },
    ],
    visual: m2 > 0 ? {
      titulo: "Cobertura de tinta",
      totalLabel: f(m2, 1) + " m² impressos",
      total: m2,
      partes: [
        { label: "Área coberta", valor: cobertos, cor: "#ffe815", fg: "#252425", dec: 1 },
        { label: "Sem tinta", valor: Math.max(0, m2 - cobertos), cor: "#e0e0e0", fg: "#5c5a5c", dec: 1 },
      ],
    } : null,
    resumo: f(kgCor * cores, 3) + " kg · " + cores + " cores",
  };
}

/* ── componente ──────────────────────────────────────────────────── */
type HistItem = { calc: string; resultado: string; entradas: string; quando: string; id: string; vals: Vals };

const SOMBRA = "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.25)";
/** Campo numérico do desenho novo: a unidade curta entra como sufixo dentro
    da caixa, por isso a folga de 62px à direita. */
const INP: CSSProperties = {
  width: "100%", background: "#f1f1f1", border: "2px solid #f1f1f1", borderRadius: 10,
  padding: "15px 62px 15px 17px", font: "700 20px/1.2 Inter,sans-serif", color: INK, outline: "none",
};

/* ── exportações (porta 1:1 do protótipo) ────────────────────────── */
/** Sanitiza texto para o stream PDF (WinAnsi): escapa parênteses, troca
    −/–/—→-, ×→x e derruba o resto de fora do Latin-1. */
function pdfTxt(t: unknown): string {
  let out = "";
  const str = String(t == null ? "" : t);
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    const ch = str[i];
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
    else if (c === 8722 || c === 8211 || c === 8212) out += "-";
    else if (c === 215) out += "x";
    else if (c === 8730) out += "";
    else if (c < 256) out += ch;
    else out += "?";
  }
  return out;
}

type DadosPDF = {
  titulo: string; arquivo: string; data: string; resumo: string;
  destaqueLabel: string; destaqueValor: string; destaqueUnidade: string;
  selo: string; dica: string;
  chave: { k: string; v: string }[];
  entradas: { k: string; v: string }[];
  detalhe: { k: string; v: string }[];
  tabelaTitulo: string; tabelaCols: string[]; tabelaRows: string[][];
  formula: string;
};

/** Gera um PDF A4 vetorial (Helvetica, retângulos e texto) e baixa direto,
    sem passar pelo diálogo da impressora. */
function baixarPDF(d: DadosPDF) {
  if (typeof document === "undefined") return;
  const W = 595.28, H = 841.89, M = 36, R = W - M;
  const ops: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, col: string) =>
    ops.push(col + " rg " + x.toFixed(2) + " " + y.toFixed(2) + " " + w.toFixed(2) + " " + h.toFixed(2) + " re f");
  const txt = (x: number, y: number, t: string, sz: number, bold?: boolean, col?: string) =>
    ops.push("BT " + (col || "0 0 0") + " rg /" + (bold ? "F2" : "F1") + " " + sz + " Tf 1 0 0 1 " + x.toFixed(2) + " " + y.toFixed(2) + " Tm (" + pdfTxt(t) + ") Tj ET");
  const wid = (t: string, sz: number, bold?: boolean) => pdfTxt(t).length * sz * (bold ? 0.56 : 0.5);
  const txtR = (x: number, y: number, t: string, sz: number, bold?: boolean, col?: string) => txt(x - wid(t, sz, bold), y, t, sz, bold, col);
  const AM = "1 0.91 0.08", PT = "0.145 0.141 0.145", CZ = "0.36 0.35 0.36", LN = "0.93 0.93 0.93";
  let y = H - M - 18;
  txt(M, y + 22, "R2 FLEXO  ·  CALCULADORAS", 8, true, CZ);
  txt(M, y, d.titulo, 22, true);
  txtR(R, y + 22, d.data, 9, false, CZ);
  txtR(R, y + 8, d.resumo, 9, false, CZ);
  y -= 12; rect(M, y, R - M, 1.6, PT);

  y -= 86;
  rect(M, y, R - M, 78, PT);
  txt(M + 16, y + 58, String(d.destaqueLabel).toUpperCase(), 8, true, "0.66 0.65 0.66");
  txt(M + 16, y + 30, d.destaqueValor, 30, true, AM);
  txt(M + 16 + wid(d.destaqueValor, 30, true) + 8, y + 32, d.destaqueUnidade, 11, false, "0.95 0.95 0.95");
  txt(M + 16, y + 14, d.dica, 10, false, "1 1 1");
  if (d.selo) {
    const sw = wid(d.selo, 10, true) + 20;
    rect(R - 16 - sw, y + 50, sw, 22, AM);
    txt(R - 16 - sw + 10, y + 57, d.selo, 10, true);
  }

  y -= 18;
  const cw = (R - M - 16) / 3;
  d.chave.slice(0, 3).forEach((c, i) => {
    const x = M + i * (cw + 8);
    rect(x, y - 44, cw, 44, i === d.chave.length - 1 ? AM : "0.96 0.96 0.96");
    txt(x + 10, y - 17, c.k, 8.5, false, CZ);
    txt(x + 10, y - 36, c.v, 14, true);
  });
  y -= 44;

  const secao = (titulo: string, itens: { k: string; v: string }[], cols: number) => {
    y -= 26;
    txt(M, y, titulo.toUpperCase(), 8.5, true, CZ);
    y -= 6;
    const colW = (R - M - (cols - 1) * 18) / cols;
    const linhas = Math.ceil(itens.length / cols);
    itens.forEach((it, i) => {
      const col = Math.floor(i / linhas), row = i % linhas;
      const x = M + col * (colW + 18), ly = y - 14 - row * 15;
      txt(x, ly, it.k, 9.5, false, CZ);
      txtR(x + colW, ly, it.v, 10, true);
      rect(x, ly - 4.5, colW, 0.5, LN);
    });
    y -= 14 + linhas * 15;
  };
  secao("Dados preenchidos", d.entradas, 3);
  secao("Resultado detalhado", d.detalhe, 2);

  if (d.tabelaRows.length) {
    y -= 26;
    txt(M, y, String(d.tabelaTitulo).toUpperCase(), 8.5, true, CZ);
    y -= 6;
    const nc = d.tabelaCols.length, tw = (R - M) / nc;
    d.tabelaCols.forEach((c, i) => txt(M + i * tw, y - 12, c, 7.5, true, CZ));
    rect(M, y - 18, R - M, 0.8, PT);
    let ry = y - 18;
    d.tabelaRows.forEach((row) => {
      ry -= 14;
      row.forEach((cell, i) => txt(M + i * tw, ry, cell, 9, false));
      rect(M, ry - 4, R - M, 0.4, LN);
    });
    y = ry - 10;
  }
  txt(M, Math.max(M, y - 14), d.formula, 8, false, CZ);

  const stream = ops.join("\n");
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 " + W + " " + H + "]/Resources<</Font<</F1 5 0 R/F2 6 0 R>>>>/Contents 4 0 R>>",
    "<</Length " + stream.length + ">>\nstream\n" + stream + "\nendstream",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>",
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>",
  ];
  let pdf = "%PDF-1.4\n";
  const off: number[] = [];
  objs.forEach((o, i) => { off.push(pdf.length); pdf += (i + 1) + " 0 obj\n" + o + "\nendobj\n"; });
  const xref = pdf.length;
  pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
  off.forEach((o) => { pdf += String(o).padStart(10, "0") + " 00000 n \n"; });
  pdf += "trailer\n<</Size " + (objs.length + 1) + "/Root 1 0 R>>\nstartxref\n" + xref + "\n%%EOF";
  const a = document.createElement("a");
  a.href = "data:application/pdf;base64," + btoa(pdf);
  a.download = (d.arquivo || "calculo") + ".pdf";
  document.body.appendChild(a); a.click(); a.remove();
}

/** Desenho técnico do gabarito em SVG 1:1 (width/height em mm), monocromático,
    com camadas nomeadas para abrir editável no Illustrator. */
export function gabaritoSVG(g: Gabarito): string {
  const N = (v: number) => Math.round(v * 1000) / 1000;
  const F = (v: number, d?: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d });
  const RAIO = 2; // raio de canto padrão das facas R2, em mm
  const pitchV = g.X + g.espV, pitchH = g.Y + g.espH;
  const larg = g.larguraUtil, alt = g.dev;
  const bloco = g.carr * pitchH - g.espH;
  const x0 = Math.max(0, (larg - bloco) / 2);
  const MG = 26, banda = 40;
  const W = larg + MG * 2, H = alt + MG * 2 + banda;
  const OX = MG, OY = MG;
  const P = 0.2, PF = 0.12;
  const etq: string[] = [];
  for (let r = 0; r < g.rep; r++) for (let c = 0; c < g.carr; c++)
    etq.push('<rect x="' + N(OX + x0 + c * pitchH) + '" y="' + N(OY + r * pitchV) + '" width="' + N(g.Y) + '" height="' + N(g.X) + '" rx="' + RAIO + '" ry="' + RAIO + '" fill="none" stroke="#000" stroke-width="' + P + '"/>');
  const eixos: string[] = [];
  for (let r = 0; r < g.rep; r++) if (g.espV > 0)
    eixos.push('<line x1="' + N(OX) + '" y1="' + N(OY + r * pitchV + g.X + g.espV / 2) + '" x2="' + N(OX + larg) + '" y2="' + N(OY + r * pitchV + g.X + g.espV / 2) + '" stroke="#000" stroke-width="0.08" stroke-dasharray="3 1 0.6 1"/>');
  for (let c = 0; c < g.carr - 1; c++) if (g.espH > 0)
    eixos.push('<line x1="' + N(OX + x0 + c * pitchH + g.Y + g.espH / 2) + '" y1="' + N(OY) + '" x2="' + N(OX + x0 + c * pitchH + g.Y + g.espH / 2) + '" y2="' + N(OY + alt) + '" stroke="#000" stroke-width="0.08" stroke-dasharray="3 1 0.6 1"/>');
  const T = (x: number, y: number, t: string, sz: number, anchor?: string, w?: number) =>
    '<text x="' + N(x) + '" y="' + N(y) + '" font-family="Helvetica, Arial, sans-serif" font-size="' + sz + '" font-weight="' + (w || 400) + '" text-anchor="' + (anchor || "start") + '" fill="#000">' + t + "</text>";
  const cotaH = (xa: number, xb: number, y: number, t: string) =>
    '<g><line x1="' + N(xa) + '" y1="' + N(y) + '" x2="' + N(xb) + '" y2="' + N(y) + '" stroke="#000" stroke-width="' + PF + '"/>' +
    '<line x1="' + N(xa) + '" y1="' + N(y - 1.2) + '" x2="' + N(xa) + '" y2="' + N(y + 1.2) + '" stroke="#000" stroke-width="' + PF + '"/>' +
    '<line x1="' + N(xb) + '" y1="' + N(y - 1.2) + '" x2="' + N(xb) + '" y2="' + N(y + 1.2) + '" stroke="#000" stroke-width="' + PF + '"/>' +
    T((xa + xb) / 2, y - 1.6, t, 3, "middle") + "</g>";
  const cotaV = (ya: number, yb: number, x: number, t: string) =>
    '<g><line x1="' + N(x) + '" y1="' + N(ya) + '" x2="' + N(x) + '" y2="' + N(yb) + '" stroke="#000" stroke-width="' + PF + '"/>' +
    '<line x1="' + N(x - 1.2) + '" y1="' + N(ya) + '" x2="' + N(x + 1.2) + '" y2="' + N(ya) + '" stroke="#000" stroke-width="' + PF + '"/>' +
    '<line x1="' + N(x - 1.2) + '" y1="' + N(yb) + '" x2="' + N(x + 1.2) + '" y2="' + N(yb) + '" stroke="#000" stroke-width="' + PF + '"/>' +
    '<text x="' + N(x - 1.8) + '" y="' + N((ya + yb) / 2) + '" font-family="Helvetica, Arial, sans-serif" font-size="3" text-anchor="middle" fill="#000" transform="rotate(-90 ' + N(x - 1.8) + " " + N((ya + yb) / 2) + ')">' + t + "</text></g>";
  const cotas = [
    cotaH(OX, OX + larg, OY - 9, F(larg, 0) + " mm  largura util"),
    cotaH(OX + x0, OX + x0 + g.Y, OY - 3.5, "Y " + F(g.Y) + " mm"),
    cotaV(OY, OY + alt, OX - 9, F(alt, 3) + " mm  desenvolvimento"),
    cotaV(OY, OY + g.X, OX - 3.5, "X " + F(g.X) + " mm"),
  ];
  if (g.espV > 0) cotas.push(cotaV(OY + g.X, OY + pitchV, OX + larg + 4, "perda " + F(g.espV, 3)));
  if (g.espH > 0 && g.carr > 1) cotas.push(cotaH(OX + x0 + g.Y, OX + x0 + pitchH, OY + alt + 5, "perda " + F(g.espH, 3)));
  const espec = [
    "CILINDRO  Z" + g.Z + "   Ø " + F(g.dia) + " mm   dev " + F(g.dev, 3) + " mm   passo " + g.passo,
    "MÁQUINA  " + g.maq + "   largura útil " + F(larg, 0) + " mm   sobra " + F(g.sobra) + " mm",
    "ETIQUETA  Y " + F(g.Y) + " × X " + F(g.X) + " mm   raio de canto R" + RAIO + " mm",
    "REPETIÇÕES  " + g.rep + "× na volta   CARREIRAS  " + g.carr + "× na largura",
    g.gap ? "GAP  faca de gap, sem esqueleto" : "PERDA  " + F(g.espV, 3) + " mm na volta   " + F(g.espH, 3) + " mm entre carreiras",
  ];
  const ficha = espec.map((t, i) => T(OX, OY + alt + 14 + i * 5, t, 3.2, "start", i === 0 ? 700 : 400)).join("");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + N(W) + 'mm" height="' + N(H) + 'mm" viewBox="0 0 ' + N(W) + " " + N(H) + '">' +
    '<g id="Area-util"><rect x="' + N(OX) + '" y="' + N(OY) + '" width="' + N(larg) + '" height="' + N(alt) + '" fill="none" stroke="#000" stroke-width="0.1" stroke-dasharray="2 1.5"/></g>' +
    '<g id="Eixos">' + eixos.join("") + "</g>" +
    '<g id="Facas">' + etq.join("") + "</g>" +
    '<g id="Cotas">' + cotas.join("") + "</g>" +
    '<g id="Ficha-tecnica">' + T(OX, OY + alt + 8, "GABARITO DE FACA · escala 1:1 · medidas em mm", 3.6, "start", 700) + ficha + "</g>" +
    "</svg>";
}

function baixarGabarito(g: Gabarito) {
  if (typeof document === "undefined") return;
  const svg = gabaritoSVG(g);
  const nome = "faca-Z" + g.Z + "-" + f(g.Y, 0) + "x" + f(g.X, 0) + "mm.svg";
  const a = document.createElement("a");
  a.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
}

/** Corpo dos cards-chave: encolhe conforme o texto cresce (e um passo a mais
    quando são 4 colunas). */
const tamValor = (s: string, cols: number) => {
  const len = String(s).length * (cols >= 4 ? 1.25 : 1);
  return len > 34 ? "20px" : len > 24 ? "25px" : len > 15 ? "30px" : "38px";
};

/* ── copy do desenho novo (launcher por pergunta + passos) ───────── */
/** A pergunta que a pessoa está tentando responder — é por ela que se
    escolhe a calculadora, não pelo nome técnico. */
const PERGUNTAS: Record<string, string> = {
  facas: "Calcular faca",
  comparativo: "Qual cilindro atende várias etiquetas de uma vez?",
  pordiametro: "Que etiquetas cabem neste cilindro?",
  distorcao: "Distorção do clichê",
  valorcliche: "Valor do clichê",
  bobinas: "Quantos metros tem esta bobina?",
  substrato: "Que largura de bobina eu preciso pedir?",
  caixa: "Quantas etiquetas fecham a caixa? ( Santa Luzia )",
  metragem: "Quantos metros de rolo para essa quantidade?",
  valor: "Valor da etiqueta",
  tinta: "Quanta tinta esse pedido vai gastar?",
};
/** O que fazer com o número — fica embaixo do resultado. */
const AJUDA_RESULTADO: Record<string, string> = {
  facas: "Escolha um cilindro da tabela abaixo e confira a perda antes de mandar gravar a faca.",
  comparativo: "Prefira o cilindro que atende todas as alturas: é uma faca a menos no estoque.",
  pordiametro: "Use as alturas da tabela ao desenhar a etiqueta e aproveite a faca que já existe.",
  distorcao: "Aplique essa redução no sentido do desenvolvimento antes de gravar o clichê.",
  valorcliche: "Esse é o valor a repassar no orçamento. Confira as carreiras antes de fechar.",
  bobinas: "Metragem estimada: confirme na pesagem antes de programar a produção.",
  substrato: "Peça a bobina nessa largura ou na maior mais próxima que tenha no estoque.",
  caixa: "Use esse total para fechar a expedição e conferir o pedido.",
  metragem: "Programe o rolo com essa metragem e some a sobra de acerto.",
  valor: "Preço sugerido por etiqueta, já com margem e imposto. Negocie a partir daqui.",
  tinta: "Separe essa quantidade por cor e reserve 10% a mais para o acerto de máquina.",
};
const SEC_AJUDA: Record<string, string> = {
  "Medidas da etiqueta": "Medidas da etiqueta acabada e o tipo de faca.",
  "Máquina": "Largura útil da máquina onde a faca vai rodar.",
  "Facas a comparar": "Digite a altura de cada etiqueta que precisa rodar na mesma faca.",
  "Cilindro": "O diâmetro do cilindro que você quer usar, ou clique num do parque.",
  "Chapa": "Diâmetro do cilindro e espessura da chapa que vai ser gravada.",
  "Etiqueta": "Largura da etiqueta e quantas carreiras entram no substrato.",
  "Cobrança": "O que entra na conta do orçamento.",
  "Pedido": "O que o cliente pediu.",
  "Custos": "Quanto custa o material e a impressão.",
  "Ferramental": "Custos cobrados uma vez e rateados na tiragem.",
  "Margem e imposto": "Quanto sobra para a fábrica e quanto vai para o imposto.",
  "Engrenagem": "Passo e faixa de dentes aceita pela máquina.",
  "Espaçamento (perda)": "Quanto espaço entre etiquetas é aceitável.",
  "Resultado e filtros": "Como a lista de cilindros deve ser montada.",
  "Exibição": "Quais linhas aparecem na tabela.",
  "Verificar faca existente": "Compare com uma faca que você já tem.",
};
/** Calculadoras curtas: um passo só, com título e ajuda próprios. */
const PASSO_UNICO: Record<string, { t: string; a: string }> = {
  distorcao: { t: "Engrenagem e clichê", a: "Dentes da engrenagem, módulo da máquina e tipo de chapa." },
  bobinas: { t: "Medidas do rolo", a: "Meça o diâmetro externo, o do tubete e a espessura do material." },
  substrato: { t: "Etiqueta e carreiras", a: "Largura da etiqueta, quantas carreiras e onde fica o Camerom." },
  caixa: { t: "Rolo e caixa", a: "Quantas etiquetas tem o rolo e quantos rolos entram na caixa." },
  metragem: { t: "Rolo e etiqueta", a: "Metragem do rolo, passo da etiqueta e quantas carreiras." },
  tinta: { t: "Etiqueta e tiragem", a: "Tamanho da etiqueta, quantidade e cobertura de tinta." },
};
/** Seções que vão para trás de "Ajustes técnicos". */
const SEC_AVANCADAS = ["Máquina", "Engrenagem", "Espaçamento (perda)", "Resultado e filtros", "Exibição", "Verificar faca existente"];

/** Linha "pede …" do cartão: os três primeiros campos essenciais. */
function pedeDe(id: string): string {
  const c = CALCS.find((x) => x.id === id);
  if (!c) return "";
  const lista = typeof c.campos === "function" ? c.campos(PADROES[id] || {}) : c.campos;
  const mapa = SECOES_CAMPO[id] || {};
  const ess = lista.filter((f) => f.tipo !== "botoes" && SEC_AVANCADAS.indexOf(mapa[f.id] || "") < 0 && !/opcional/i.test(f.label));
  const nomes = ess.slice(0, 3).map((f) => f.label.replace(/\s*\(.*?\)/g, "").trim().toLowerCase());
  const resto = ess.length - nomes.length;
  return "pede " + nomes.join(", ") + (resto > 0 ? " e +" + resto : "");
}

type CampoPronto = {
  campo: Campo; label: string; sufixo: string; dica: string;
  isNum: boolean; isChips: boolean; isBotoes: boolean; valor: string;
};

export function CalculadorasV1a({ profile, versao, aoNavegar, onNova, onLogout, disponiveis, children, permissoes }: {
  profile: { nome: string };
  versao: string;
  aoNavegar?: (pagina: string) => void;
  onNova?: () => void;
  onLogout?: () => void;
  disponiveis?: string[];
  /** modais/overlays hospedados pela rota — renderizados dentro do palco */
  children?: ReactNode;
  /** chaves calc.* que a pessoa tem; ausente = todas (protótipo) */
  permissoes?: string[];
}) {
  const liberada = (id: string) => !permissoes || !CALC_PERM[id] || permissoes.includes(CALC_PERM[id]);
  /* sem lista de permissões = modo protótipo (o /preview-v3 mostra tudo) */
  const podeGabarito = !permissoes || permissoes.includes(PERM_GABARITO);
  const grupos = GRUPOS.map((g) => ({ ...g, ids: g.ids.filter(liberada) })).filter((g) => g.ids.length);
  const primeira = liberada("facas") ? "facas" : (grupos[0]?.ids[0] ?? "");

  const [tela, setTela] = useState<"inicio" | "calc">("inicio");
  const [calcId, setCalcId] = useState(primeira || "facas");
  const [vals, setVals] = useState<Record<string, Vals>>(() => clone(PADROES));
  const [historico, setHistorico] = useState<HistItem[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [ordem, setOrdem] = useState<Record<string, { k: string; asc: boolean }>>({});
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  const [formulaAberta, setFormulaAberta] = useState(false);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);
  /* a lista completa de cilindros nasce fechada: quem não faz a conta só
     precisa do cilindro recomendado — a tabela é conferência de quem entende */
  const [tabelaAberta, setTabelaAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const [aviso, setAviso] = useState("");
  /* a folha de impressão sai por portal no <body> — só existe no cliente */
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const calc = CALCS.find((c) => c.id === calcId && liberada(c.id)) || CALCS.find((c) => c.id === primeira) || CALCS[0];
  const v = vals[calc.id] || {};
  const r = calcular(calc.id, v);
  const set = (id: string, val: string) =>
    setVals((s) => ({ ...s, [calc.id]: { ...s[calc.id], [id]: val } }));

  function abrirCalc(id: string) {
    setCalcId(id); setTela("calc"); setAvancadoAberto(false); setFormulaAberta(false); setDetalhesAbertos(false);
  }

  const listaCampos = typeof calc.campos === "function" ? calc.campos(v) : calc.campos;
  /* unidade curta vira sufixo dentro do campo; o resto vira dica ao lado do rótulo */
  const campos: CampoPronto[] = listaCampos.map((c) => {
    const chips = c.tipo === "chips", botoes = c.tipo === "botoes";
    const un = c.unidade || "";
    const temSufixo = !chips && !botoes && un.length > 0 && un.length <= 9 && un.indexOf("·") < 0;
    return {
      campo: c, label: c.label,
      sufixo: temSufixo ? un : "", dica: temSufixo ? "" : un,
      isNum: !chips && !botoes, isChips: chips, isBotoes: botoes,
      valor: v[c.id] ?? "",
    };
  });

  /* passos numerados: cada seção de campos vira um passo; o que é técnico
     sai da frente e vai para "Ajustes técnicos" */
  const blocos = (() => {
    const mapa = SECOES_CAMPO[calc.id] || {};
    const unico = PASSO_UNICO[calc.id];
    const out: { titulo: string; avancado: boolean; campos: CampoPronto[] }[] = [];
    listaCampos.forEach((c, i) => {
      const titulo = mapa[c.id] || (unico ? unico.t : "Dados");
      const avancado = SEC_AVANCADAS.indexOf(titulo) > -1 || (!mapa[c.id] && /opcional/i.test(c.label));
      const ult = out[out.length - 1];
      if (ult && ult.titulo === titulo && ult.avancado === avancado) ult.campos.push(campos[i]);
      else out.push({ titulo, avancado, campos: [campos[i]] });
    });
    return out;
  })();
  const unicoCalc = PASSO_UNICO[calc.id];
  const passos = blocos.filter((b) => !b.avancado).map((b, i) => ({
    num: String(i + 1),
    titulo: b.titulo,
    ajuda: SEC_AJUDA[b.titulo] || (unicoCalc ? unicoCalc.a : calc.sub),
    campos: b.campos,
  }));
  const camposAvancados = blocos.filter((b) => b.avancado).reduce<CampoPronto[]>((a, b) => a.concat(b.campos), []);
  const resumoAv = (() => {
    const cheios = camposAvancados.filter((c) => String(c.valor) !== "");
    const txt = cheios.slice(0, 3)
      .map((c) => c.label.replace(/\.$/, "").toLowerCase() + " " + c.valor + (c.sufixo ? " " + c.sufixo : ""))
      .join(" · ");
    const resto = cheios.length - 3;
    return (txt || "padrões da fábrica") + (resto > 0 ? " · +" + resto : "");
  })();

  /* tabela ordenável */
  const tab = r.tabela;
  const ordAtual = tab ? (ordem[calc.id] || tab.ordem || { k: "", asc: true }) : { k: "", asc: true };
  let tabLinhas = tab ? tab.linhas : [];
  if (tab && ordAtual.k && ordem[calc.id]) {
    tabLinhas = [...tabLinhas].sort((a, b) => {
      const va = a.ord ? a.ord[ordAtual.k] : 0, vb = b.ord ? b.ord[ordAtual.k] : 0;
      return ordAtual.asc ? va - vb : vb - va;
    });
  }
  tabLinhas = tabLinhas.slice(0, 50);
  const gridCols = tab ? tab.colunas.map((c) => c.w).join(" ") : "";
  const ordenarPor = (k: string) =>
    setOrdem((s) => ({ ...s, [calc.id]: { k, asc: s[calc.id] && s[calc.id].k === k ? !s[calc.id].asc : true } }));

  /* clicar em "Calculadoras" no menu já estando aqui não fazia nada (a rota é
     a mesma): agora volta para a lista de calculadoras, como o botão de voltar */
  const voltarOuNavegar = (l: string) => {
    if (l === "Calculadoras") { setTela("inicio"); setAvancadoAberto(false); setFormulaAberta(false); setDetalhesAbertos(false); setTabelaAberta(false); return; }
    aoNavegar?.(l);
  };

  /* faixa de alerta — na ordem de prioridade do desenho */
  const avisoCalc = (() => {
    /* na faca a saída NÃO é mexer na perda (é padrão da fábrica) e sim mudar
       um pouco a altura da etiqueta — a medida sugerida vai no cartão escuro */
    if (tab && tabLinhas.length === 0 && calc.id === "facas")
      return "Nenhum cilindro fecha com essa altura. Aumente ou diminua um pouco a altura X da etiqueta. A medida que fecha está no cartão do resultado.";
    if (tab && tabLinhas.length === 0) return "Nenhuma combinação atende esses limites. Abra os ajustes técnicos e aumente a perda máxima ou a faixa de dentes.";
    if (calc.id === "substrato" && n(v.larg) * n(v.carr) > 250) return "A largura passa de 250 mm. Confirme se existe bobina desse tamanho no estoque.";
    if (calc.id === "valor" && n(v.margem) >= 100) return "Margem de 100% ou mais não fecha a conta: use um valor abaixo de 100.";
    if (calc.id === "tinta" && n(v.cobertura) > 100) return "Cobertura acima de 100% não existe: use um valor entre 5 e 100.";
    return "";
  })();

  /* visual (barra de composição) */
  const vis = r.visual && r.visual.total > 0 ? r.visual : null;
  const partesVis = vis ? vis.partes.filter((p) => p.valor > 0) : [];

  /* hierarquia do resultado: até 4 linhas fortes viram os cards-chave
     ("O que você precisa saber"); o resto vai para o disclosure de detalhes */
  const chaveRaw = r.linhas.filter((l) => l.forte).slice(0, 4);
  const chave = chaveRaw.length ? chaveRaw : r.linhas.slice(0, 2);
  const detalheRaw = r.linhas.filter((l) => chave.indexOf(l) < 0);
  const temFlagAmarela = chave.some((l) => l.amarelo === true);
  const notaPartes = String(r.nota || "").split(" · ").map((t) => t.trim()).filter(Boolean);
  const temExtras = detalheRaw.length > 0 || partesVis.length > 0;
  const dicaResultado = r.dica || AJUDA_RESULTADO[calc.id] || "";

  const hojeStr = () => {
    const d = new Date();
    return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
      + ", " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };
  /* entradas preenchidas, para a folha impressa (unidade curta vira sufixo) */
  const impEntradas = listaCampos
    .filter((c) => v[c.id] != null && String(v[c.id]).trim() !== "")
    .map((c) => {
      const un = c.unidade || "";
      const sufixo = c.tipo ? "" : (un && un.indexOf("·") < 0 && un.length <= 9 ? " " + un : "");
      return { k: c.label, v: String(v[c.id]) + sufixo };
    });
  const baixarPdfClick = () => baixarPDF({
    titulo: calc.nome,
    arquivo: calc.id + "-" + (r.resumo || "").replace(/[^0-9a-zA-Z]+/g, "-").slice(0, 40),
    data: hojeStr(),
    resumo: r.resumo || "",
    destaqueLabel: r.destaque.label,
    destaqueValor: r.destaque.valor,
    destaqueUnidade: r.destaque.unidade || "",
    selo: r.selo || "",
    dica: dicaResultado,
    chave: chave.map((l) => ({ k: l.label, v: String(l.valor) })),
    entradas: listaCampos.filter((c) => v[c.id] != null && String(v[c.id]).trim() !== "").map((c) => ({ k: c.label, v: String(v[c.id]) })),
    detalhe: detalheRaw.map((l) => ({ k: l.label, v: String(l.valor) })),
    tabelaTitulo: tab ? tab.titulo : "",
    tabelaCols: tab ? tab.colunas.map((c) => c.label) : [],
    tabelaRows: tab ? tabLinhas.slice(0, 12).map((row) => row.cells.map((c) => String(c.v))) : [],
    formula: calc.formula || "",
  });

  /* histórico */
  function salvar() {
    const agora = new Date();
    const quando = `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
    setHistorico((s) => [{
      calc: calc.nome,
      resultado: r.destaque.valor + " " + r.destaque.unidade,
      entradas: r.resumo,
      quando, id: calc.id, vals: clone(v),
    }, ...s].slice(0, 8));
    setHistoricoAberto(true);
  }
  function restaurar(h: HistItem) {
    setVals((s) => ({ ...s, [h.id]: clone(h.vals) }));
    abrirCalc(h.id);
    setHistoricoAberto(false);
  }
  const recentes = (() => {
    const vistos: string[] = [];
    historico.forEach((h) => { if (vistos.indexOf(h.id) < 0) vistos.push(h.id); });
    return vistos.slice(0, 4).map((id) => CALCS.find((c) => c.id === id)).filter(Boolean).filter((c) => liberada(c!.id)) as Calc[];
  })();

  const badgeHist: CSSProperties = {
    flex: "none", minWidth: 26, height: 26, padding: "0 8px", display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 999, font: "800 14px/1 Inter,sans-serif",
    background: historico.length ? AMARELO : "#f1f1f1", color: historico.length ? INK : "#b3b1b3",
  };
  const botaoTopo: CSSProperties = {
    display: "flex", alignItems: "center", gap: 11, height: 54, background: "#fff", border: 0,
    borderRadius: 12, padding: "0 20px", cursor: "pointer", font: "600 16.5px/1 Inter,sans-serif", color: INK,
  };

  const botaoHistorico = (
    <button onClick={() => setHistoricoAberto(true)} className="r2chip" style={{ ...botaoTopo, flex: "none" }}>
      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 7.5V12l3 2" /><path d="M20.5 12a8.5 8.5 0 1 1-8.5-8.5" /><path d="M20.5 4v4h-4" /></svg>
      <span style={{ lineHeight: "19px" }}>Histórico</span>
      <span style={badgeHist}>{historico.length}</span>
    </button>
  );

  /* um campo (rótulo + entrada), do jeito do desenho novo */
  const renderCampo = (c: CampoPronto) => (
    <div key={c.campo.id} style={c.campo.largo ? { gridColumn: "1 / -1" } : undefined}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "2px 10px", marginBottom: 10, minWidth: 0, minHeight: 44 }}>
        <label style={{ flex: "0 1 auto", minWidth: 0, font: "600 16.5px/1.3 Inter,sans-serif", color: INK }}>{c.label}</label>
        {c.dica && <span style={{ flex: "0 1 auto", minWidth: 0, font: "400 14px/1.3 Inter,sans-serif", color: "#8d8b8d" }}>{c.dica}</span>}
      </div>
      {c.isNum && (
        <div style={{ position: "relative", maxWidth: 248 }}>
          <input value={c.valor} onChange={(e) => set(c.campo.id, e.target.value)} className="inp" style={INP} placeholder={c.campo.ph || ""} />
          {c.sufixo && (
            <span style={{ position: "absolute", right: 17, top: 0, bottom: 0, display: "flex", alignItems: "center", font: "600 15px/1 Inter,sans-serif", color: "#8d8b8d", pointerEvents: "none", whiteSpace: "nowrap" }}>{c.sufixo}</span>
          )}
        </div>
      )}
      {c.isChips && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(c.campo.opcoes || []).map((o) => {
            const on = c.campo.ativoDe ? c.campo.ativoDe(v) === o
              : c.campo.espelha ? String(n(v[c.campo.espelha])) === o : c.valor === o;
            return (
              <button key={o}
                onClick={c.campo.aplica
                  ? () => setVals((s) => ({ ...s, [calc.id]: { ...s[calc.id], ...c.campo.aplica![o] } }))
                  : () => set(c.campo.destino || c.campo.id, o)}
                className="r2chip"
                style={{ border: `2px solid ${on ? INK : "#f1f1f1"}`, cursor: "pointer", borderRadius: 999, padding: "12px 18px", font: `${on ? 700 : 600} 16px/1 Inter,sans-serif`, whiteSpace: "nowrap", background: on ? INK : "#f1f1f1", color: on ? AMARELO : "#5c5a5c" }}>
                {o}
              </button>
            );
          })}
        </div>
      )}
      {c.isBotoes && (
        <div style={{ display: "flex", gap: 6 }}>
          {(c.campo.botoes || []).map((b) => (
            <button key={b.label} onClick={() => set(c.campo.id, String(Math.max(2, Math.min(12, NSLOTS(v) + b.delta))))} className="r2chip"
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", border: "2px dashed #d6d5d6", cursor: "pointer", borderRadius: 999, padding: "13px 17px", font: "600 16px/1 Inter,sans-serif", whiteSpace: "nowrap", background: "transparent", color: "#5c5a5c" }}>
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /* Ninguém deveria chegar aqui sem permissão nenhuma, mas a URL é aberta. */
  if (grupos.length === 0) {
    return (
      <EstagioV1a>
        <TopbarV1a nome={profile.nome} busca={busca} aoBuscar={setBusca} onSair={() => onLogout?.()} />
        <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
          <RailV1a ativo="Calculadoras" permitidas={disponiveis} aoNavegar={voltarOuNavegar} onNovo={() => onNova?.()} versao={versao} />
          <div style={{ flex: 1, display: "grid", placeItems: "center", background: "#fff", borderRadius: 12 }}>
            <div style={{ textAlign: "center", maxWidth: 460 }}>
              <div style={{ ...fr(96, 700), fontSize: 34, lineHeight: 1.1, color: INK }}>Nenhuma calculadora liberada</div>
              <div style={{ font: "400 16px/1.5 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>
                Seu acesso não inclui nenhuma das calculadoras. Peça na Equipe para liberarem as que você precisa.
              </div>
            </div>
          </div>
        </div>
        {children}
      </EstagioV1a>
    );
  }

  return (
    <EstagioV1a>
      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}

      <TopbarV1a nome={profile.nome} busca={busca} aoBuscar={setBusca}
        onMensagens={() => {}} onAnotacoes={() => {}} onNotificacoes={() => {}} onConfig={() => {}} onSair={() => onLogout?.()} />

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 12, alignItems: "stretch" }}>
        <RailV1a ativo="Calculadoras" permitidas={disponiveis} aoNavegar={voltarOuNavegar} onNovo={() => onNova?.()} versao={versao} />

        <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>

          {tela === "inicio" ? (
            <>
              {/* ————— tela inicial: escolha pela pergunta ————— */}
              <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "0 6px 8px" }}>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ ...fr(144, 900), fontSize: 54, lineHeight: 1.02, letterSpacing: "-.02em", textIndent: "-.045em", color: INK, margin: 0 }}>O que você precisa calcular?</h1>
                  <div style={{ font: "400 18px/1.45 Inter,sans-serif", color: "#5c5a5c", marginTop: 12, maxWidth: 760 }}>
                    Escolha a pergunta que você quer responder.
                  </div>
                </div>
                {botaoHistorico}
              </div>

              {recentes.length > 0 && (
                <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 12, padding: "14px 18px" }}>
                  <span style={{ flex: "none", font: "700 13px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d" }}>Voltar para</span>
                  {recentes.map((c) => (
                    <button key={c.id} onClick={() => abrirCalc(c.id)} className="r2chip"
                      style={{ border: 0, cursor: "pointer", borderRadius: 999, padding: "11px 16px", font: "600 15px/1 Inter,sans-serif", whiteSpace: "nowrap", background: "#f1f1f1", color: "#5c5a5c" }}>
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "22px 18px", alignContent: "start", padding: "2px 2px 10px" }}>
                {grupos.map((g) => (
                  <div key={g.titulo} style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 4px 4px" }}>
                      <span style={{ font: "800 15px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: INK, whiteSpace: "nowrap" }}>{g.titulo}</span>
                      <span style={{ flex: "none", font: "700 13px/1 Inter,sans-serif", color: "#8d8b8d" }}>{g.ids.length} {g.ids.length === 1 ? "conta" : "contas"}</span>
                      <span style={{ flex: 1, height: 2, background: "#e2e1e2", borderRadius: 999 }} />
                    </div>
                    {g.ids.map((id) => {
                      const c = CALCS.find((x) => x.id === id)!;
                      return (
                        <button key={id} onClick={() => abrirCalc(id)} className="r2np"
                          style={{ display: "flex", alignItems: "center", gap: 20, width: "100%", textAlign: "left", background: "#fff", border: 0, borderRadius: 16, padding: "24px 22px", cursor: "pointer", boxShadow: "0 1px 0 rgba(0,0,0,.04),0 18px 36px -32px rgba(0,0,0,.35)" }}>
                          <span style={{ flex: "none", width: 60, height: 60, display: "grid", placeItems: "center", background: AMARELO, borderRadius: 15 }}>
                            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
                              {c.icone.map((d, i) => <path key={i} d={d} />)}
                            </svg>
                          </span>
                          <span style={{ flex: 1, minWidth: 0, display: "block" }}>
                            <span style={{ display: "block", ...fr(48, 700), fontSize: 26, lineHeight: 1.2, letterSpacing: "-.015em", color: INK }}>{PERGUNTAS[c.id] || c.nome}</span>
                            <span style={{ display: "block", font: "500 15px/1.35 Inter,sans-serif", color: "#8d8b8d", marginTop: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pedeDe(c.id)}</span>
                          </span>
                          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M10 6l6 6-6 6" /></svg>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 12, padding: "6px 2px 2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 4px" }}>
                  <span style={{ font: "800 15px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: INK, whiteSpace: "nowrap" }}>Últimos cálculos</span>
                  <span style={{ flex: 1, height: 2, background: "#e2e1e2", borderRadius: 999 }} />
                  <button onClick={() => setHistoricoAberto(true)} className="r2chip"
                    style={{ flex: "none", background: "transparent", border: 0, padding: 0, cursor: "pointer", font: "600 15px/1 Inter,sans-serif", color: "#5c5a5c", whiteSpace: "nowrap" }}>Ver o histórico</button>
                </div>
                {historico.length === 0 ? (
                  <div style={{ background: "#fff", borderRadius: 14, padding: "24px 26px", font: "400 16.5px/1.55 Inter,sans-serif", color: "#8d8b8d" }}>
                    Os cálculos que você salvar aparecem aqui. Dá para reabrir com as mesmas entradas quando o cliente pedir de novo.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
                    {historico.slice(0, 4).map((h, i) => (
                      <button key={h.id + i} onClick={() => restaurar(h)} className="r2np"
                        style={{ display: "block", textAlign: "left", background: "#fff", border: 0, borderRadius: 14, padding: "18px 20px", cursor: "pointer", minWidth: 0, boxShadow: "0 1px 0 rgba(0,0,0,.04),0 18px 36px -32px rgba(0,0,0,.35)" }}>
                        <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span style={{ flex: 1, minWidth: 0, font: "700 13px/1.2 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", color: "#8d8b8d", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.calc}</span>
                          <span style={{ flex: "none", font: "400 13px/1 Inter,sans-serif", color: "#b3b1b3" }}>{h.quando}</span>
                        </span>
                        <span style={{ display: "block", ...fr(48, 700), fontSize: 25, lineHeight: 1.15, letterSpacing: "-.02em", color: INK, marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.resultado}</span>
                        <span style={{ display: "block", font: "400 14px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.entradas}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* ————— tela da calculadora ————— */}
              <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "0 6px 6px" }}>
                <div style={{ minWidth: 0 }}>
                  <button onClick={() => { setTela("inicio"); setAvancadoAberto(false); setFormulaAberta(false); setDetalhesAbertos(false); }} className="r2chip"
                    style={{ display: "flex", alignItems: "center", gap: 9, background: "transparent", border: 0, padding: 0, marginBottom: 14, cursor: "pointer", font: "600 15.5px/1 Inter,sans-serif", color: "#5c5a5c" }}>
                    <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M14 6l-6 6 6 6" /></svg>
                    <span style={{ lineHeight: "17px" }}>Todas as calculadoras</span>
                  </button>
                  <h1 style={{ ...fr(96, 900), fontSize: 44, lineHeight: 1.05, letterSpacing: "-.02em", textIndent: "-.04em", color: INK, margin: 0, maxWidth: 940 }}>{PERGUNTAS[calc.id] || calc.nome}</h1>
                  <div style={{ font: "400 17px/1.45 Inter,sans-serif", color: "#8d8b8d", marginTop: 11 }}>{calc.nome} · {calc.sub}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button onClick={() => setVals((s) => ({ ...s, [calc.id]: clone(PADROES[calc.id]) }))} title="Restaurar padrões" className="r2chip"
                    style={{ flex: "none", width: 54, height: 54, display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 12, cursor: "pointer" }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M19.5 3.5V6H17" /></svg>
                  </button>
                  <button onClick={() => { if (typeof window !== "undefined" && window.print) window.print(); }} title="Imprimir / PDF" className="r2chip"
                    style={{ flex: "none", width: 54, height: 54, display: "grid", placeItems: "center", background: "#fff", border: 0, borderRadius: 12, cursor: "pointer" }}>
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M7 8.5V3.5h10v5" /><rect x={4} y={8.5} width={16} height={7.5} rx={1.6} /><path d="M7 16h10v4.5H7z" /></svg>
                  </button>
                  <button onClick={baixarPdfClick} title="Baixar o relatório em PDF" className="r2chip"
                    style={{ display: "flex", alignItems: "center", gap: 9, height: 54, background: "#fff", border: 0, borderRadius: 12, padding: "0 18px", cursor: "pointer", font: "600 16.5px/1 Inter,sans-serif", color: INK }}>
                    <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#5c5a5c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M6 3.5h8l4 4v13H6z" /><path d="M12 10v6.5" /><path d="M9 13.5l3 3 3-3" /></svg>
                    <span style={{ lineHeight: "19px", whiteSpace: "nowrap" }}>Baixar PDF</span>
                  </button>
                  {r.gabarito && podeGabarito && (
                    <button onClick={() => baixarGabarito(r.gabarito!)} title="Gabarito em SVG para Illustrator" className="r2chip"
                      style={{ display: "flex", alignItems: "center", gap: 9, height: 54, background: INK, border: 0, borderRadius: 12, padding: "0 18px", cursor: "pointer", font: "600 16.5px/1 Inter,sans-serif", color: AMARELO }}>
                      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x={3.5} y={3.5} width={17} height={17} rx={2} /><path d="M8 8h8v8H8z" /></svg>
                      <span style={{ lineHeight: "19px", whiteSpace: "nowrap" }}>Gabarito</span>
                    </button>
                  )}
                  {botaoHistorico}
                  <button onClick={salvar} className="r2chip"
                    style={{ display: "flex", alignItems: "center", gap: 11, height: 54, background: AMARELO, border: 0, borderRadius: 12, padding: "0 22px", cursor: "pointer", font: "700 16.5px/1 Inter,sans-serif", color: INK }}>
                    <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M5 4.5h11L19.5 8v11.5H5z" /><path d="M8.5 4.5v5h7v-5" /></svg>
                    <span style={{ lineHeight: "19px" }}>Salvar resultado</span>
                  </button>
                </div>
              </div>

              {/* `start` em vez de `stretch`: em monitor grande sobrava meia
                  tela de cartão vazio embaixo. Com `maxHeight: 100%` o cartão
                  comprido continua rolando por dentro, como antes.
                  `0 1 auto` (em vez de `flex: 1`): com pouco conteúdo a faixa
                  para de esticar e a lista de cilindros sobe junto — a sobra
                  vai para o rodapé em vez de virar um buraco entre os cartões.
                  Com muito conteúdo o flex encolhe a faixa até a altura da
                  tela, o que dá altura definida aos cartões e o rolamento por
                  dentro volta a valer. */}
              <div style={{ flex: "0 1 auto", minHeight: 0, overflow: "hidden", display: "grid", gridTemplateColumns: "720px 1fr", gap: 14, alignItems: "start" }}>

                {/* PREENCHA — passos numerados */}
                <div style={{ position: "relative", minHeight: 0, maxHeight: "100%", overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, padding: "26px 28px 18px", boxShadow: SOMBRA }}>
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 34, pointerEvents: "none", borderRadius: "0 0 14px 14px", background: "linear-gradient(to top,#fff,rgba(255,255,255,0))" }} />
                  <div style={{ flex: "none", font: "700 13.5px/1 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 22 }}>Preencha</div>
                  <div style={{ minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 28, paddingBottom: 18 }}>
                    {passos.map((p) => (
                      <div key={p.num + p.titulo} style={{ display: "flex", gap: 16, minWidth: 0 }}>
                        <span style={{ flex: "none", width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 999, background: INK, color: AMARELO, font: "800 18px/1 Inter,sans-serif" }}>{p.num}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ font: "700 20px/1.25 Inter,sans-serif", letterSpacing: "-.01em", color: INK }}>{p.titulo}</div>
                          <div style={{ font: "400 16px/1.45 Inter,sans-serif", color: "#8d8b8d", marginTop: 6 }}>{p.ajuda}</div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "18px 14px", marginTop: 18 }}>
                            {p.campos.map(renderCampo)}
                          </div>
                        </div>
                      </div>
                    ))}

                    {camposAvancados.length > 0 && (
                      <div style={{ display: "flex", gap: 16, minWidth: 0 }}>
                        <span style={{ flex: "none", width: 40, height: 40, display: "grid", placeItems: "center", borderRadius: 999, background: "#f1f1f1" }}>
                          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14" /><path d="M5 17h14" /><circle cx={10} cy={7} r={2.4} /><circle cx={15} cy={17} r={2.4} /></svg>
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <button onClick={() => setAvancadoAberto((s) => !s)} className="r2row"
                            style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", background: "#f7f7f7", border: 0, borderRadius: 12, padding: "16px 16px 16px 20px", cursor: "pointer", textAlign: "left" }}>
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "block", font: "700 17.5px/1.25 Inter,sans-serif", color: INK }}>Ajustes técnicos</span>
                              <span style={{ display: "block", font: "400 15px/1.4 Inter,sans-serif", color: "#8d8b8d", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resumoAv}</span>
                            </span>
                            <span style={{ flex: "none", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, borderRadius: 999, padding: "11px 17px" }}>{avancadoAberto ? "Fechar" : "Ajustar"}</span>
                          </button>
                          {avancadoAberto && (
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "18px 14px", marginTop: 20 }}>
                              {camposAvancados.map(renderCampo)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* resultado */}
                <div style={{ position: "relative", minHeight: 0, maxHeight: "100%", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 14 }}>
                  {avisoCalc && (
                    <div style={{ flex: "none", display: "flex", alignItems: "flex-start", gap: 14, background: "#fff8cc", borderRadius: 12, padding: "18px 20px" }}>
                      <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M12 3.5 21.5 20.5h-19z" /><path d="M12 10v4.2" /><path d="M12 17.3h.01" /></svg>
                      <span style={{ font: "500 16.5px/1.5 Inter,sans-serif", color: INK }}>{avisoCalc}</span>
                    </div>
                  )}

                  <div style={{ flex: "none", background: INK, borderRadius: 14, padding: "28px 30px 26px" }}>
                    <div style={{ font: "700 14px/1.3 Inter,sans-serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#a8a6a8" }}>{r.destaque.label}</div>
                    {/* `wrap`: em tela de 1440 o selo passava da borda do cartão
                        e ficava cortado ("Já está em pr…"). Sem espaço, ele cai
                        para a linha de baixo em vez de vazar. */}
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 14, marginTop: 14 }}>
                      <span style={{ font: "800 92px/1 Inter,sans-serif", letterSpacing: "-.045em", color: AMARELO }}>{r.destaque.valor}</span>
                      <span style={{ flex: "none", whiteSpace: "nowrap", font: "600 22px/1 Inter,sans-serif", color: "#f1f1f1", paddingBottom: 12 }}>{r.destaque.unidade}</span>
                      <span style={{ flex: 1 }} />
                      {r.selo && (
                        <span style={{ alignSelf: "center", maxWidth: "100%", borderRadius: 999, padding: "14px 24px", font: "800 20px/1.2 Inter,sans-serif", letterSpacing: "-.01em", background: r.seloOk ? AMARELO : "#3a383a", color: r.seloOk ? INK : "#e2e0e2" }}>{r.selo}</span>
                      )}
                    </div>
                    <div style={{ font: "500 18px/1.5 Inter,sans-serif", color: "#fff", marginTop: 20 }}>{dicaResultado}</div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 22, marginTop: 20, paddingTop: 18, borderTop: "1px solid #3a383a" }}>
                      <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {notaPartes.length > 1
                          ? notaPartes.map((t, i) => (
                            <span key={t + i} style={{ background: "#333133", borderRadius: 999, padding: "8px 14px", font: "500 15px/1.2 Inter,sans-serif", color: "#e2e0e2", whiteSpace: "nowrap" }}>{t}</span>
                          ))
                          : <span style={{ font: "400 16px/1.55 Inter,sans-serif", color: "#c9c7c9" }}>{r.nota}</span>}
                      </div>
                      <button onClick={() => setFormulaAberta((s) => !s)} className="r2chip"
                        style={{ flex: "none", background: "transparent", border: "2px solid #4a484a", borderRadius: 999, padding: "11px 17px", cursor: "pointer", font: "600 15px/1 Inter,sans-serif", color: "#f1f1f1", whiteSpace: "nowrap" }}>
                        {formulaAberta ? "Esconder a conta" : "Ver a conta"}
                      </button>
                    </div>
                    {formulaAberta && (
                      <div style={{ font: `500 15px/1.85 ${MONO}`, color: "#f1f1f1", marginTop: 16, padding: "18px 20px", background: "#1b1a1b", borderRadius: 10 }}>{calc.formula}</div>
                    )}
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: "24px 26px 20px", boxShadow: SOMBRA }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
                      <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M4 19.5V4.5" /><path d="M4 19.5h16" /><path d="M8 16.5v-6" /><path d="M13 16.5V7" /><path d="M18 16.5v-3.5" /></svg>
                      <span style={{ font: "800 22px/1 Inter,sans-serif", color: INK, letterSpacing: "-.015em", whiteSpace: "nowrap" }}>O que você precisa saber</span>
                    </div>
                    {/* 2 a 4 cards-chave; só o marcado como total fica amarelo */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginTop: 8 }}>
                      {chave.map((l, i) => {
                        const preco = temFlagAmarela ? l.amarelo === true : /preço|valor|custo/i.test(String(l.label));
                        return (
                          <div key={l.label + i} style={{ background: preco ? AMARELO : "#f7f7f7", borderRadius: 12, padding: "18px 20px 19px" }}>
                            <div style={{ font: "600 17px/1.3 Inter,sans-serif", color: preco ? "#5a5410" : "#5c5a5c" }}>{l.label}</div>
                            <div style={{ marginTop: 10, font: `800 ${tamValor(l.valor, chave.length)}/1.2 Inter,sans-serif`, letterSpacing: "-.02em", color: INK }}>{l.valor}</div>
                          </div>
                        );
                      })}
                    </div>

                    {temExtras && (
                      <div style={{ flex: "none", marginTop: 16, paddingTop: 14, borderTop: "2px solid #f1f1f1" }}>
                        <button onClick={() => setDetalhesAbertos((s) => !s)} className="r2chip"
                          style={{ background: "#f1f1f1", border: 0, borderRadius: 999, padding: "13px 20px", cursor: "pointer", font: "600 17px/1 Inter,sans-serif", color: "#5c5a5c", whiteSpace: "nowrap" }}>
                          {detalhesAbertos ? "Esconder" : "Ver"} detalhes técnicos
                        </button>
                        {detalhesAbertos && (
                          <>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 40, marginTop: 10 }}>
                              {detalheRaw.map((l, i) => (
                                <div key={l.label + i} style={{ display: "flex", alignItems: "baseline", gap: 16, minHeight: 40, padding: "8px 0", borderBottom: "1px solid #f1f1f1" }}>
                                  <span style={{ flex: "1 1 auto", minWidth: 56, font: "500 16px/1.4 Inter,sans-serif", color: "#5c5a5c" }}>{l.label}</span>
                                  <span style={{ flex: "none", textAlign: "right", whiteSpace: "nowrap", color: INK, font: `600 ${String(l.valor).length > 26 ? 14.5 : 16.5}px/1.35 ${MONO}` }}>{l.valor}</span>
                                </div>
                              ))}
                            </div>
                            {vis && partesVis.length > 0 && (
                              <div style={{ display: "flex", flexDirection: "column", marginTop: 20, paddingTop: 16, borderTop: "2px solid #f1f1f1" }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 11 }}>
                                  <span style={{ font: "700 14px/1.25 Inter,sans-serif", letterSpacing: ".12em", textTransform: "uppercase", color: "#8d8b8d" }}>{vis.titulo}</span>
                                  <span style={{ flex: 1 }} />
                                  <span style={{ font: `700 17px/1 ${MONO}`, color: INK, whiteSpace: "nowrap" }}>{vis.totalLabel}</span>
                                </div>
                                <div style={{ flex: "1 1 auto", display: "flex", minHeight: 34, maxHeight: 80, borderRadius: 8, overflow: "hidden", background: "#f1f1f1" }}>
                                  {partesVis.map((p, i) => {
                                    const pct = Math.max(0, Math.min(100, (p.valor / vis.total) * 100));
                                    return (
                                      <div key={p.label + i} style={{ flex: `0 0 ${pct}%`, display: "grid", placeItems: "center", overflow: "hidden", background: p.cor, color: p.fg, font: "700 13.5px/1 Inter,sans-serif" }}>
                                        {pct >= 12 ? f(pct, 0) + "%" : ""}
                                      </div>
                                    );
                                  })}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14, marginTop: 14 }}>
                                  {partesVis.map((p, i) => (
                                    <div key={p.label + i} style={{ minWidth: 0 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                                        <span style={{ flex: "none", width: 11, height: 11, borderRadius: 3, background: p.cor }} />
                                        <span style={{ flex: "1 1 auto", minWidth: 0, font: "500 15px/1.35 Inter,sans-serif", color: "#5c5a5c" }}>{p.label}</span>
                                      </div>
                                      <div style={{ font: `700 19px/1 ${MONO}`, color: INK, whiteSpace: "nowrap", marginTop: 7 }}>{p.moeda ? brl(p.valor) : f(p.valor, p.dec == null ? 2 : p.dec)}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {tab && (
                <div style={{ flex: tabelaAberta ? "1 1 auto" : "none", minHeight: tabelaAberta ? 208 : 0, overflow: "hidden", display: "flex", flexDirection: "column", background: "#fff", borderRadius: 12, padding: tabelaAberta ? "20px 22px 14px" : "16px 22px", boxShadow: SOMBRA }}>
                  <button type="button" onClick={() => setTabelaAberta((s) => !s)} className="r2row"
                    style={{ flex: "none", display: "flex", alignItems: "center", gap: 12, width: "100%", background: "transparent", border: 0, padding: 0, cursor: "pointer", textAlign: "left", marginBottom: tabelaAberta ? 14 : 0 }}>
                    <span style={{ font: "800 22px/1 Inter,sans-serif", color: INK, letterSpacing: "-.015em", whiteSpace: "nowrap" }}>{tab.titulo}</span>
                    <span style={{ font: "700 13px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", background: "#f1f1f1", color: "#5c5a5c", borderRadius: 999, padding: "9px 15px 8px", whiteSpace: "nowrap" }}>{tab.contagem}</span>
                    <span style={{ flex: 1 }} />
                    {tabelaAberta && <span style={{ font: "400 15.5px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>{tab.nota}</span>}
                    <span style={{ flex: "none", font: "700 15px/1 Inter,sans-serif", color: INK, background: AMARELO, borderRadius: 999, padding: "11px 17px", whiteSpace: "nowrap" }}>{tabelaAberta ? "Fechar" : "Ver lista"}</span>
                  </button>
                  {tabelaAberta && (<>
                  <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, padding: "0 8px 8px", borderBottom: "2px solid #f1f1f1" }}>
                    {tab.colunas.map((c) => {
                      const on = ordAtual.k === c.k;
                      return (
                        <button key={c.label} onClick={() => c.k && ordenarPor(c.k)}
                          style={{ display: "flex", alignItems: "baseline", gap: 5, minWidth: 0, background: "transparent", border: 0, padding: 0, textAlign: "left", cursor: c.k ? "pointer" : "default", font: `${on ? 800 : 600} 12.5px/1.2 Inter,sans-serif`, letterSpacing: ".06em", textTransform: "uppercase", color: on ? INK : "#8d8b8d" }}>
                          <span style={{ minWidth: 0, lineHeight: 1.2 }}>{c.label}</span>
                          <span style={{ flex: "none", font: "700 12.5px/1 Inter,sans-serif" }}>{!c.k ? "" : on ? (ordAtual.asc ? "↑" : "↓") : "↕"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                    {tabLinhas.map((row, ri) => (
                      <div key={ri} className="r2row"
                        style={{ display: "grid", gridTemplateColumns: gridCols, gap: 10, alignItems: "center", minHeight: 48, padding: "12px 8px", borderRadius: 8, background: row.destaque ? "#fffbdb" : ri % 2 ? "#fafafa" : "transparent" }}>
                        {row.cells.map((c, ci) => (
                          <span key={ci} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", font: c.mono ? `700 16.5px/1.2 ${MONO}` : "600 16.5px/1.2 Inter,sans-serif", color: c.cor ? c.cor : c.fraco ? "#b3b1b3" : INK }}>{c.v}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                  </>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ————— painel de histórico ————— */}
      {historicoAberto && (
        <>
          <div onClick={() => setHistoricoAberto(false)} data-modal-esc style={{ position: "absolute", inset: 0, zIndex: 55, background: "rgba(37,36,37,.32)" }} />
          <div style={{ position: "absolute", zIndex: 56, top: 22, right: 22, bottom: 22, width: 472, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 14, padding: "28px 28px 22px", boxShadow: "0 50px 100px -30px rgba(0,0,0,.55)" }}>
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ ...fr(72, 900), fontSize: 38, lineHeight: 1, letterSpacing: "-.02em", color: INK }}>Histórico</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => setHistoricoAberto(false)} title="Fechar" className="r2ic"
                style={{ flex: "none", width: 44, height: 44, display: "grid", placeItems: "center", background: INK, border: 0, borderRadius: 10, cursor: "pointer" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div style={{ flex: "none", font: "400 16px/1.5 Inter,sans-serif", color: "#8d8b8d", marginTop: 12 }}>
              {historico.length} {historico.length === 1 ? "cálculo salvo" : "cálculos salvos"}. Clique num cartão para recarregar as entradas.
            </div>
            {historico.length === 0 && (
              <div style={{ marginTop: 26, padding: 26, borderRadius: 12, background: "#f1f1f1", font: "400 16.5px/1.55 Inter,sans-serif", color: "#5c5a5c" }}>
                Nada salvo ainda. Use <strong style={{ color: INK }}>Salvar resultado</strong> para guardar um resultado junto com as entradas usadas.
              </div>
            )}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 9, marginTop: 18 }}>
              {historico.map((h, i) => (
                <div key={h.id + i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#f7f7f7", borderRadius: 12, padding: "16px 14px 16px 18px" }}>
                  <button onClick={() => restaurar(h)} title="Restaurar este cálculo" className="r2row"
                    style={{ flex: 1, minWidth: 0, display: "block", textAlign: "left", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{ font: "700 13px/1 Inter,sans-serif", letterSpacing: ".06em", textTransform: "uppercase", padding: "7px 12px 6px", borderRadius: 999, whiteSpace: "nowrap", background: h.id === calc.id ? AMARELO : "#f1f1f1", color: INK }}>{h.calc}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ font: "400 13.5px/1 Inter,sans-serif", color: "#b3b1b3", whiteSpace: "nowrap" }}>{h.quando}</span>
                    </div>
                    <div style={{ ...fr(48, 700), fontSize: 27, lineHeight: 1.1, letterSpacing: "-.02em", color: INK, marginTop: 11 }}>{h.resultado}</div>
                    <div style={{ font: "400 15px/1.45 Inter,sans-serif", color: "#8d8b8d", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.entradas}</div>
                  </button>
                  <button onClick={() => setHistorico((s) => s.filter((_, j) => j !== i))} title="Remover"
                    style={{ flex: "none", width: 30, height: 30, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 8, cursor: "pointer" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#b3b1b3" strokeWidth={2.6} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {children}

      {/* ————— folha A4 (só na impressão) ————— */}
      {montado && tela === "calc" && createPortal(
        <div id="r2-print" style={{ background: "#fff", color: INK, fontFamily: "Inter,sans-serif", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, borderBottom: `3px solid ${INK}`, paddingBottom: 8 }}>
            <div>
              <div style={{ font: "800 12px/1 Inter,sans-serif", letterSpacing: ".18em", textTransform: "uppercase", color: "#8d8b8d" }}>R2 Flexo · Calculadoras</div>
              <div style={{ ...fr(72, 700), fontSize: 32, lineHeight: 1.1, marginTop: 4 }}>{calc.nome}</div>
            </div>
            <div style={{ textAlign: "right", font: "500 13px/1.5 Inter,sans-serif", color: "#5c5a5c" }}>{hojeStr()}<br />{r.resumo}</div>
          </div>

          <div className="r2-nobreak" style={{ display: "flex", alignItems: "center", gap: 14, background: INK, borderRadius: 8, padding: "12px 16px", marginTop: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 12px/1 Inter,sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "#a8a6a8" }}>{r.destaque.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 5 }}>
                <span style={{ font: "800 42px/1 Inter,sans-serif", letterSpacing: "-.03em", color: AMARELO }}>{r.destaque.valor}</span>
                <span style={{ font: "600 16px/1 Inter,sans-serif", color: "#f1f1f1" }}>{r.destaque.unidade}</span>
              </div>
              <div style={{ font: "500 15px/1.45 Inter,sans-serif", color: "#fff", marginTop: 9 }}>{dicaResultado}</div>
            </div>
            {r.selo && (
              <span style={{ flex: "none", background: AMARELO, color: INK, borderRadius: 999, padding: "10px 16px", font: "800 14px/1.2 Inter,sans-serif", whiteSpace: "nowrap" }}>{r.selo}</span>
            )}
          </div>

          <div className="r2-nobreak" style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "1fr", gap: 8, marginTop: 12 }}>
            {chave.map((l, i) => (
              <div key={l.label + i} style={{ border: `2px solid ${INK}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ font: "600 13px/1.3 Inter,sans-serif", color: "#5c5a5c" }}>{l.label}</div>
                <div style={{ font: "800 21px/1.2 Inter,sans-serif", marginTop: 6 }}>{l.valor}</div>
              </div>
            ))}
          </div>

          <div className="r2-nobreak" style={{ marginTop: 14 }}>
            <div style={{ font: "700 12px/1 Inter,sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 6 }}>Dados preenchidos</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", columnGap: 18 }}>
              {impEntradas.map((e, i) => (
                <div key={e.k + i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "4px 0", borderBottom: "1px solid #ececec" }}>
                  <span style={{ font: "500 14px/1.35 Inter,sans-serif", color: "#5c5a5c" }}>{e.k}</span>
                  <span style={{ font: `700 14.5px/1.2 ${MONO}`, whiteSpace: "nowrap" }}>{e.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="r2-nobreak" style={{ marginTop: 14 }}>
            <div style={{ font: "700 12px/1 Inter,sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "#8d8b8d", marginBottom: 6 }}>Resultado detalhado</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 24 }}>
              {detalheRaw.map((l, i) => (
                <div key={l.label + i} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "4px 0", borderBottom: "1px solid #ececec" }}>
                  <span style={{ font: "500 14px/1.35 Inter,sans-serif", color: "#5c5a5c" }}>{l.label}</span>
                  <span style={{ font: `700 14.5px/1.2 ${MONO}`, textAlign: "right" }}>{l.valor}</span>
                </div>
              ))}
            </div>
          </div>

          {tab && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                <span style={{ font: "700 12px/1 Inter,sans-serif", letterSpacing: ".16em", textTransform: "uppercase", color: "#8d8b8d" }}>{tab.titulo}</span>
                <span style={{ font: "600 12px/1 Inter,sans-serif", color: "#b3b1b3" }}>{tab.contagem}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "baseline", columnGap: 10 }}>
                {tab.colunas.map((c) => (
                  <span key={c.label} style={{ font: "700 11px/1.2 Inter,sans-serif", letterSpacing: ".1em", textTransform: "uppercase", color: "#8d8b8d", padding: "0 0 4px" }}>{c.label}</span>
                ))}
              </div>
              {tabLinhas.slice(0, 14).map((row, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "baseline", columnGap: 10, borderBottom: "1px solid #f1f1f1", background: row.destaque ? "#fffbdb" : "transparent" }}>
                  {row.cells.map((c, ci) => (
                    <span key={ci} style={{ font: `600 13.5px/1.3 ${MONO}`, padding: "5px 0" }}>{c.v}</span>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14, paddingTop: 6, borderTop: "1px solid #ececec", font: "500 12px/1.45 Inter,sans-serif", color: "#8d8b8d" }}>{calc.formula}</div>
        </div>,
        document.body,
      )}
    </EstagioV1a>
  );
}
