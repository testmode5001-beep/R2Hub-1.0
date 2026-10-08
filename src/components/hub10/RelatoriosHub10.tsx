// Relatórios em cartões (Augusto, 07/10/2026: "a área de relatório vamos
// alterar, agora será baseada em cards como a página de pedidos"; as duas
// imagens de referência que ele mandou), na cor viva de um status: uma cor por
// assunto, em tons quando o assunto tem vários cartões, como a trilha de
// Pedidos. Em cima, uma grade de 10 por 10 bolinhas; embaixo, o número (sempre
// o total: "use número total, não porcentagem") e o que ele é. Aberto, o
// cartão vira um painel da mesma cor: o número grande e a frase à esquerda, a
// quebra no meio e a grade grande à direita, com o nome de cada grupo em pé.
// Primeiro foi um cartão por número; depois de ver, ele pediu "um card só para
// os pedidos e um para aprovação, no de pedidos na capa coloque o total de
// pedidos solicitados e dentro do card as demais informações", e nos clichês
// a mesma coisa (07/10/2026). Depois, no mesmo dia: "aprovação vai para dentro
// do card clichês aprovados" e as facas novas para dentro do cartão de Facas.
//
// Os números que ele pediu (07/10/2026):
// - Pedidos: os solicitados na capa; dentro, as alterações (o Pedir revisão),
//   os cancelados e as vendedoras.
// - Clichês aprovados (cada cor que chegou é um clichê) na capa; dentro, os
//   valores e a média por clichê, separados em 1.14 e 1.70 (a espessura
//   escolhida no Enviar p/ clicheria, desde a migração 52; o que veio antes
//   fica "sem espessura"), as artes aprovadas, o tempo da solicitação à
//   primeira aprovação da arte e o da aprovação à chegada do clichê.
// - Clichês refeitos na capa; dentro, os motivos, o valor e as vezes que cada
//   cliente já refez.
// - Pantones: os diferentes que foram pedidos e os mais usados.
// - Facas: as diferentes na capa; dentro, as mais usadas e os pedidos com
//   faca nova. Medidas: as diferentes e as mais pedidas.
// - Arquivo físico: as pastas vagas (é o estado de hoje, não o do período).
//
// As bolinhas mostram a quantidade que o número diz: uma por item (acima de
// 100, cada bolinha vale vários, e o cartão diz quantos); nas vagas, as partes do
// todo. Antes (02/10/2026) a página era a dos Relatórios antigos no molde novo;
// a cópia ficou no scratchpad da sessão efce7741 (relatorios-antigo).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AMARELO, BarraTopoHub10, FR, FUNDO_PAGINA, INTER, LINHA_DA_GRADE_HUB, NIVEL, PRETO, PalcoFixo, numeroPedido, useEscDoTopo, vigiarRolagem } from "./ChromeHub10";
import { CAPA_V4, CartaoV4, RotuloV4, TrilhaV4, tituloDoPeV4 } from "./CapaV4Hub10";
import { baseFraunces, baseInter, folgaFR, folgaIN } from "./grade-hub10";
import { estiloDoStatus } from "./PedidoHub10";
import type { ApontamentosDados } from "../v1a/ApontamentosV1a";
import { prefixoPantone, sugestoesPantone } from "../v1a/dados/pantone-busca";
import { coresEfetivas, separarCores } from "@/lib/cores";
import type { SessionUser } from "@/lib/session";
import { PALETA } from "@/lib/paleta-hub";

const LG = LINHA_DA_GRADE_HUB;
const VERMELHO = PALETA.perigo;
const PILULA_ALT = 44.04;
const PILULA_BORDA = 2.21;
const PILULA_PE: CSSProperties = {
  height: PILULA_ALT, boxSizing: "border-box", border: `${PILULA_BORDA}px solid ${PRETO}`, borderRadius: 999,
  display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "2px 22px 0", fontFamily: INTER, fontSize: 20.5, fontWeight: 500,
  letterSpacing: "-.014em", color: PRETO, whiteSpace: "nowrap", cursor: "pointer",
};
const TOPO_PILULA = 63 * LG - 0.85 - PILULA_ALT;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const menos = (n: number) => new Date(Date.now() - n * 86_400_000);
const diaBR = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
const f = (v: number, dec = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
const brlNum = (v: number) => "R$ " + f(v, 2);
/* `d` é quantos dias o período tem, contando o primeiro e o último: "7 dias"
   é de seis dias atrás até hoje */
const PRESETS = [{ l: "Hoje", d: 1 }, { l: "7 dias", d: 7 }, { l: "30 dias", d: 30 }, { l: "90 dias", d: 90 }];
const plural = (n: number, um: string, varios: string) => `${f(n)} ${n === 1 ? um : varios}`;
/* a data de entrada (ISO em UTC) no dia do relógio de quem usa */
const diaDe = (quando: unknown) => {
  const d = new Date(String(quando ?? ""));
  return Number.isNaN(d.getTime()) ? "" : iso(d);
};
const horas = (de: unknown, ate: unknown) => {
  const a = new Date(String(de ?? "")).getTime(), b = new Date(String(ate ?? "")).getTime();
  return Number.isNaN(a) || Number.isNaN(b) || b < a ? null : (b - a) / 3_600_000;
};
/** o tempo como a fábrica fala: "5 h" abaixo de um dia, "2,8 dias" acima */
const tempo = (h: number) => (h < 24 ? `${f(Math.max(1, Math.round(h)))} h` : `${f(h / 24, 1)} ${h / 24 < 1.95 ? "dia" : "dias"}`);
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const numeroDoPedido = (n: unknown) => numeroPedido(Number(n));
/* o tom do assunto: o mesmo matiz indo para o branco (a regra de Pedidos) */
function tom(hex: string, t: number): string {
  if (!t) return hex;
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  const c = (x: number) => Math.round(x + (255 - x) * t).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/* O Pantone de uma cor do pedido, no jeito do hub.
   A cor é Pantone quando a tabela do hub (a da busca de cores) tem o código:
   "485C" e "485" viram "P 485 C"; "Orange 021 C" e "Cool Gray 11 C", com o P
   na frente ou sem, viram "P Orange 021 C" e "P Cool Gray 11 C". Com o P (ou
   "Pantone") na frente, um código que a tabela não tem (o U, por exemplo)
   conta do mesmo jeito. A conta de antes só aceitava número puro ou nome só
   de letras entre o P e o C (simulação 6, 07/10/2026). */
const PREFIXO_PANTONE = /^(?:pantone|pms|p)\.?(?:\s+|(?=\d))/i;
const NUMERO_PANTONE = /^(\d{2,5})\s*(cp|up|c|u)?$/i;
const pantonesJaVistos = new Map<string, string | null>();
function pantoneDoHub(cor: string): string | null {
  const texto = cor.replace(/\s+/g, " ").trim();
  const visto = pantonesJaVistos.get(texto);
  if (visto !== undefined) return visto;
  const comP = PREFIXO_PANTONE.test(texto);
  let codigo = texto.replace(PREFIXO_PANTONE, "").trim();
  const numero = NUMERO_PANTONE.exec(codigo);
  if (numero) codigo = `${numero[1]} ${(numero[2] ?? "C").toUpperCase()}`;
  const k = codigo.toLowerCase();
  /* a busca também devolve as cores de nome ("Preto"), que não são Pantone */
  const daTabela = codigo ? sugestoesPantone(codigo, 8).find((s) => String(s.codigo).toLowerCase() === k && s.nome === prefixoPantone(s.codigo)) : undefined;
  const nome = daTabela ? daTabela.nome : comP && /\d/.test(codigo) ? prefixoPantone(codigo.replace(/\s(cp|up|c|u)$/i, (s) => s.toUpperCase())) : null;
  pantonesJaVistos.set(texto, nome);
  return nome;
}
/** Os Pantones das cores de um pedido, sem repetir. O separador de cores parte
    "Orange 021 C" em "Orange" e "021 C": quando a tabela conhece o nome
    inteiro, os dois pedaços voltam a ser um Pantone só. */
function pantonesDoPedido(cores: string): string[] {
  const pecas = separarCores(cores);
  const achados = new Set<string>();
  for (let i = 0; i < pecas.length; i++) {
    const prox = pecas[i + 1];
    if (prox && !/\d/.test(pecas[i]) && NUMERO_PANTONE.test(prox.replace(PREFIXO_PANTONE, "").trim())) {
      const junto = pantoneDoHub(`${pecas[i]} ${prox}`);
      if (junto) { achados.add(junto); i++; continue; }
    }
    const p = pantoneDoHub(pecas[i]);
    if (p) achados.add(p);
  }
  return [...achados];
}

/* o que o servidor manda além do tipo da tela antiga */
type Cartoes = {
  alteracoes: { quando: string; numero: number; cliente: string }[];
  cancelados: { numero: number; cliente: string; quando: string }[];
  aprovacoes: { numero: number; cliente: string; entrada: string; aprovado: string }[];
  chegadas: {
    total: number | null; itens: number; data_chegada: string | null; hora_chegada: string | null; lancado: string;
    numero: number | null; cliente: string | null; espessura: string | null; aprovado: string | null; refacoes_antes: number;
  }[];
  refacoesPorCliente: { cliente: string; qtde: number }[];
  refacoesDesdeSempre: { cliente: string; qtde: number }[];
  /* desde a simulação 6 (07/10/2026): os números dos cartões de Refazer clichê
     que entraram no período (não são pedidos solicitados), as vendedoras sem
     eles e cada refação com os clichês dela (cada cor é um clichê) */
  cartoesDeRefacao?: number[];
  vendedoras?: { nome: string; qtde: number }[];
  refacoes?: { quando: string; numero: number; cliente: string; motivo: string; cliches: number; semCores: boolean; doPedido: boolean }[];
};
type DadosRelatorio = ApontamentosDados & {
  cliches: ApontamentosDados["cliches"] & { itens?: number };
  /* os pedidos do período por vendedora (o servidor já mandava) */
  vendedoras?: { nome: string; qtde: number }[];
  cartoes?: Cartoes;
};
type Pasta = { nome: string; gaveta: string; pasta: string; vaga: boolean };

/* ————— os cartões ————— */
type Grupo = { nome: string; n: number };
type Linha = { rotulo: string; valor: string };
type Lista = { titulo: string; linhas: Linha[]; vazia: string };
type Assunto = {
  id: string;
  nome: string;
  /** o status de onde vem a cor, e o tom (0 = a cor do status) */
  status: string;
  tom: number;
  /** o número do cartão, já escrito (o total; o tempo; o valor) */
  numero: string;
  /** o que o número é, em duas linhas no cartão */
  frase: string;
  /** a base da conta por extenso, dentro */
  contexto: string;
  /** sem nada no período */
  vazio: string;
  temDado: boolean;
  /** as bolinhas: "unidades" acende uma por item, grupo depois de grupo;
      "partes" divide as cem entre os grupos */
  modo: "unidades" | "partes";
  grupos: Grupo[];
  listas: Lista[];
  /** a página de onde vem o número */
  destino?: string;
  carregando?: boolean;
};

/** Quantas das 100 bolinhas cada grupo acende: o maior resto leva a sobra e
    grupo que existe nunca some. */
function partes(ns: number[]): number[] {
  const total = ns.reduce((a, b) => a + b, 0);
  if (!total) return ns.map(() => 0);
  const exato = ns.map((n) => (n * 100) / total);
  const base = exato.map((x, i) => (ns[i] > 0 ? Math.max(1, Math.floor(x)) : 0));
  let sobra = 100 - base.reduce((a, b) => a + b, 0);
  const ordem = exato.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i);
  for (let k = 0; sobra > 0 && k < ordem.length * 3; k++) {
    const i = ordem[k % ordem.length];
    if (ns[i] > 0) { base[i]++; sobra--; }
  }
  while (sobra < 0) {
    const i = base.indexOf(Math.max(...base));
    base[i]--;
    sobra++;
  }
  return base;
}
/** quanto vale cada bolinha no modo "unidades": até 100 itens, uma cada */
const valorDaBolinha = (n: number) => Math.max(1, Math.ceil(n / 100));
const totalDe = (a: Assunto) => a.grupos.reduce((t, g) => t + g.n, 0);
/** de que grupo é cada uma das 100 bolinhas, na ordem (undefined = apagada) */
function grupoDeCadaBolinha(a: Assunto): (number | undefined)[] {
  const out: (number | undefined)[] = [];
  if (!a.temDado || a.carregando) return out;
  if (a.modo === "unidades") {
    /* uma bolinha por item, grupo depois de grupo (acima de 100, cada uma vale vários) */
    const v = valorDaBolinha(totalDe(a));
    a.grupos.forEach((g, gi) => {
      const k = g.n > 0 ? Math.max(1, Math.round(g.n / v)) : 0;
      for (let j = 0; j < k && out.length < 100; j++) out.push(gi);
    });
    return out;
  }
  partes(a.grupos.map((g) => g.n)).forEach((qtd, gi) => { for (let k = 0; k < qtd; k++) out.push(gi); });
  return out;
}
/* os grupos se separam pela força da tinta (a cor do assunto é o fundo); o
   primeiro grupo que tem dado leva a tinta cheia (com todo clichê "sem
   espessura", o único grupo saía na tinta mais fraca e o cartão parecia vazio) */
const OPACIDADE = [1, 0.42, 0.18];
function forcaDosGrupos(a: Assunto): number[] {
  let r = 0;
  return a.grupos.map((g) => (g.n > 0 ? OPACIDADE[Math.min(r++, OPACIDADE.length - 1)] : 0));
}
const APAGADA = 0.14;
const numeroDe = (a: Assunto) => (a.carregando || !a.temDado ? "—" : a.numero);
function fraseDe(a: Assunto): string {
  if (a.carregando) return "Carregando os números do período…";
  if (!a.temDado) return a.vazio;
  const n = totalDe(a);
  return a.modo === "unidades" && n > 100 ? `${a.frase} (cada bolinha, ${f(valorDaBolinha(n))})` : a.frase;
}
/** O corpo que faz o número caber na largura (os valores em reais são compridos). */
function corpoQueCabe(texto: string, largura: number, maximo: number): number {
  try {
    const cv = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
    if (cv && document.fonts?.check("600 100px Fraunces")) {
      cv.font = "600 100px Fraunces";
      const w = cv.measureText(texto).width;
      if (w > 0) return Math.min(maximo, Math.floor((largura * 0.96 * 100) / w));
    }
  } catch { /* sem canvas: a conta pelo número de letras */ }
  return Math.min(maximo, Math.floor(largura / (texto.length * 0.6)));
}

/* ————— o cartão da trilha ————— */
/* a coluna de dentro do cartão: o rótulo, a grade, o número e a frase começam nela */
const X = 51.69;
const GRADE_CARTAO = { passo: 34.6, d: 25, topo: 118 };

function CartaoAssunto({ a, i, aoAbrir }: { a: Assunto; i: number; aoAbrir: () => void }) {
  const e = estiloDoStatus(a.status);
  const cor = tom(e.cor, a.tom);
  const numero = numeroDe(a), frase = fraseDe(a);
  const corpo = corpoQueCabe(numero, 336, 120);
  const grupos = grupoDeCadaBolinha(a);
  const forca = forcaDosGrupos(a);
  const { passo, d, topo } = GRADE_CARTAO;
  return (
    <CartaoV4 indice={i} cor={cor} aoAbrir={aoAbrir} rotulo={`${a.nome}: ${numero === "—" ? "" : numero + " "}${frase}`}>
      <RotuloV4 texto={a.nome} style={{ color: e.tinta }} />
      <svg aria-hidden width={440} height={topo + 10 * passo} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {Array.from({ length: 100 }, (_, k) => {
          /* enche de cima para baixo e da esquerda para a direita, como na primeira imagem */
          const col = Math.floor(k / 10), lin = k % 10, gi = grupos[k];
          return <circle key={k} cx={X + col * passo + d / 2} cy={topo + lin * passo + d / 2} r={d / 2} fill={e.tinta} fillOpacity={gi === undefined ? 0.2 : forca[gi]} />;
        })}
      </svg>
      <span aria-hidden style={{ position: "absolute", left: X - folgaFR(corpo, numero.charAt(0)), top: 594 - baseFraunces(corpo, corpo), ...FR, fontSize: corpo, lineHeight: `${corpo}px`,
        letterSpacing: "-.03em", color: e.tinta, whiteSpace: "nowrap" }}>{numero}</span>
      <span aria-hidden style={{ position: "absolute", left: X - folgaIN(400, 24, frase.charAt(0)), top: 640 - baseInter(24, 29), width: 336, fontFamily: INTER, fontSize: 24,
        lineHeight: "29px", letterSpacing: "-.02em", color: e.tinta, textWrap: "pretty" }}>{frase}</span>
    </CartaoV4>
  );
}

/* ————— o cartão aberto ————— */
/* o painel ocupa a fileira inteira (c1 a c23, a altura dos cartões); dentro,
   três colunas: o número e a frase, a quebra, e a grade com os nomes em pé */
const PAINEL = { x: 80, largura: 1760 };
/* a grade termina a 56 do ✕ (antes a bolinha do canto encostava nele e tomava o clique) */
const COL_QUEBRA = { x: 600, fim: 940 };
const GRADE_DENTRO = { passo: 60, d: 46, x: 1030, topo: (CAPA_V4.altura - (9 * 60 + 46)) / 2 };
const rotuloDaPagina = (p: string) => (p === "Aprovação" ? "Aprovações" : p === "Pantone" ? "Pantones" : p === "Facas" ? "Facas" : p);

function PainelAssunto({ a, aoFechar, aoNavegar, podeIr }: { a: Assunto; aoFechar: () => void; aoNavegar: (pagina: string) => void; podeIr: boolean }) {
  const e = estiloDoStatus(a.status);
  const cor = tom(e.cor, a.tom);
  const numero = numeroDe(a), frase = fraseDe(a);
  const corpo = corpoQueCabe(numero, 500, 200);
  const grupoDa = grupoDeCadaBolinha(a);
  const forca = forcaDosGrupos(a);
  const { passo, d, x: gx, topo: gy } = GRADE_DENTRO;
  /* o nome em pé de cada grupo, no meio das linhas dele, quando ele ocupa duas linhas ou mais */
  const nomes: { gi: number; r0: number; r1: number }[] = [];
  a.grupos.forEach((_, gi) => {
    const ks = grupoDa.map((g, k) => (g === gi ? k : -1)).filter((k) => k >= 0);
    if (!ks.length) return;
    const r0 = Math.floor(ks[0] / 10), r1 = Math.floor(ks[ks.length - 1] / 10);
    if (r1 - r0 >= 1) nomes.push({ gi, r0, r1 });
  });
  /* o ✕ no círculo branco: com tinta clara, ele vai na cor do fundo (como no pedido aberto) */
  const tintaDoX = /^#(?:fff|ffffff|5ffc3f)$/i.test(e.tinta) ? cor : e.tinta;
  /* as listas na coluna do meio: com duas, cada uma mostra até cinco linhas;
     o "e mais N" abre a lista inteira, que rola dentro da coluna (simulação 6,
     07/10/2026: não havia como ver o resto) */
  const porLista = a.listas.length > 1 ? 5 : 12;
  const [abertas, setAbertas] = useState<string[]>([]);
  const alternarLista = (titulo: string) => setAbertas((v) => (v.includes(titulo) ? v.filter((t) => t !== titulo) : [...v, titulo]));
  const topoDaColuna = 92 - baseInter(22, 30);
  return (
    <div role="region" aria-label={`${a.nome}: ${numero === "—" ? "" : numero + " "}${frase}`}
      style={{ position: "absolute", left: PAINEL.x, top: CAPA_V4.topo, width: PAINEL.largura, height: CAPA_V4.altura, borderRadius: CAPA_V4.raio, background: cor, color: e.tinta,
        boxShadow: CAPA_V4.sombra, zIndex: NIVEL.painel, overflow: "hidden" }}>
      <RotuloV4 texto={a.nome} style={{ color: e.tinta }} />
      <button type="button" onClick={aoFechar} aria-label={`Fechar ${a.nome}`} title="Fechar (ESC)" className="p10-flat"
        style={{ position: "absolute", left: PAINEL.largura - 88, top: 50, width: 44, height: 44, borderRadius: 999, border: `2px solid ${e.tinta}`, background: "#FFFFFFEB",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={tintaDoX} strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>

      {/* o número grande, a frase e a base da conta */}
      <div style={{ position: "absolute", left: X - folgaFR(corpo, numero.charAt(0)), top: 336 - baseFraunces(corpo, corpo), ...FR, fontSize: corpo, lineHeight: `${corpo}px`, letterSpacing: "-.035em", whiteSpace: "nowrap" }}>{numero}</div>
      <div style={{ position: "absolute", left: X - folgaIN(400, 34, frase.charAt(0)), top: 404 - baseInter(34, 42), width: 500, fontFamily: INTER, fontSize: 34, lineHeight: "42px", letterSpacing: "-.025em", textWrap: "pretty" }}>{frase}</div>
      {a.temDado && !a.carregando && (
        <div style={{ position: "absolute", left: X - folgaIN(400, 22, a.contexto.charAt(0)), top: 532 - baseInter(22, 30), width: 500, fontFamily: INTER, fontSize: 22, lineHeight: "30px", letterSpacing: "-.015em", opacity: 0.8, textWrap: "pretty" }}>{a.contexto}</div>
      )}
      {a.destino && podeIr && (
        <button type="button" onClick={() => aoNavegar(a.destino!)} className="p10-flat"
          style={{ position: "absolute", left: X - folgaIN(600, 22, "A"), top: 664 - baseInter(22, 30), padding: "7px 0", margin: "-7px 0", border: "none", background: "none", cursor: "pointer",
            fontFamily: INTER, fontSize: 22, lineHeight: "30px", fontWeight: 600, color: e.tinta, textDecoration: "underline", textUnderlineOffset: 5 }}>Abrir {rotuloDaPagina(a.destino)} <span aria-hidden>→</span></button>
      )}

      {/* a quebra: uma lista, ou duas empilhadas; aberta pelo "e mais N", a
          lista rola dentro da coluna (a barra fica escondida, como nos painéis
          do pedido aberto, e o esmaecido com a seta avisa que há mais) */}
      <div ref={vigiarRolagem} className="p10-rola"
        style={{ position: "absolute", left: COL_QUEBRA.x, top: topoDaColuna, width: COL_QUEBRA.fim - COL_QUEBRA.x, maxHeight: CAPA_V4.altura - topoDaColuna - 40, overflowY: "auto", overscrollBehavior: "contain",
          scrollbarWidth: "none", ["--fundo" as string]: cor } as CSSProperties}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {a.listas.map((l) => {
            const inteira = abertas.includes(l.titulo);
            const mostra = inteira ? l.linhas : l.linhas.slice(0, porLista);
            return (
              <div key={l.titulo}>
                <div style={{ fontFamily: INTER, fontSize: 22, lineHeight: "30px", fontWeight: 600, whiteSpace: "nowrap", marginLeft: -folgaIN(600, 22, l.titulo.charAt(0)) }}>{l.titulo}</div>
                <ul style={{ margin: "4px 0 0", padding: 0, listStyle: "none" }}>
                  {mostra.map((ln, k) => (
                    <li key={`${ln.rotulo}-${k}`} style={{ display: "flex", alignItems: "baseline", gap: 14, height: 44, borderBottom: `1px solid ${e.tinta}26`, fontFamily: INTER, fontSize: 21, lineHeight: "44px", letterSpacing: "-.015em" }}>
                      <span title={ln.rotulo} style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ln.rotulo}</span>
                      <span style={{ flex: "none", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{ln.valor}</span>
                    </li>
                  ))}
                  {l.linhas.length > porLista && (
                    <li>
                      <button type="button" onClick={() => alternarLista(l.titulo)} aria-expanded={inteira} className="p10-flat"
                        style={{ padding: 0, border: "none", background: "none", cursor: "pointer", fontFamily: INTER, fontSize: 18, lineHeight: "36px", color: e.tinta, opacity: 0.8,
                          textDecoration: "underline", textUnderlineOffset: 4 }}>{inteira ? "mostrar menos" : `e mais ${l.linhas.length - porLista}`}</button>
                    </li>
                  )}
                  {!l.linhas.length && <li style={{ fontFamily: INTER, fontSize: 20, lineHeight: "30px", opacity: 0.8, paddingTop: 8 }}>{a.carregando ? "Carregando…" : l.vazia}</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* a grade grande: linha a linha, de cima para baixo, cada grupo na sua força de tinta */}
      <svg aria-hidden width={10 * passo} height={10 * passo} style={{ position: "absolute", left: gx, top: gy, overflow: "visible", pointerEvents: "none" }}>
        {Array.from({ length: 100 }, (_, k) => {
          const lin = Math.floor(k / 10), col = k % 10, gi = grupoDa[k];
          return <circle key={k} cx={col * passo + d / 2} cy={lin * passo + d / 2} r={d / 2} fill={e.tinta} fillOpacity={gi === undefined ? APAGADA : forca[gi]} />;
        })}
      </svg>
      {nomes.map(({ gi, r0, r1 }) => {
        const g = a.grupos[gi];
        const meio = gy + ((r0 + r1) * passo + d) / 2;
        return (
          <div key={g.nome} aria-hidden style={{ position: "absolute", left: gx - 26, top: meio, transform: "translate(-50%, -50%) rotate(-90deg)", fontFamily: INTER, fontSize: 20, fontWeight: 600,
            lineHeight: "24px", letterSpacing: "-.01em", whiteSpace: "nowrap", opacity: forca[gi] === 1 ? 1 : 0.75, pointerEvents: "none" }}>{g.nome}</div>
        );
      })}
    </div>
  );
}

export function RelatoriosHub10({ profile, pedidos, aoNavegar, onNova, onLogout, disponiveis, children, dados, aoPeriodo, podeFinanceiro = true, podeExportar = true }: {
  profile: SessionUser;
  pedidos: any[];
  aoNavegar: (pagina: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  children?: ReactNode;
  /** os números do período (getApontamentos); ausente = carregando */
  dados?: DadosRelatorio;
  aoPeriodo?: (de: string, ate: string) => void;
  podeFinanceiro?: boolean;
  podeExportar?: boolean;
}) {
  const [dias, setDias] = useState(30);
  const [de, setDe] = useState(() => iso(menos(29)));
  const [ate, setAte] = useState(() => iso(new Date()));
  const [erroData, setErroData] = useState("");
  const [datasAbertas, setDatasAbertas] = useState(false);
  const fecharDatas = useCallback(() => setDatasAbertas(false), []);
  useEscDoTopo(datasAbertas, NIVEL.painel + 3, fecharDatas);
  const [pastas, setPastas] = useState<Pasta[] | null>(null);
  /* o cartão aberto */
  const [aberto, setAberto] = useState<string | null>(null);
  const fechar = useCallback(() => setAberto(null), []);
  useEscDoTopo(!!aberto, NIVEL.painel, fechar);

  useEffect(() => {
    let vivo = true;
    void import("@/lib/api/arquivo.functions")
      .then((m) => m.listArquivo())
      .then((r) => { if (vivo) setPastas((((r as { linhas?: any[] }).linhas) ?? []).map((l) => ({ nome: String(l.nome ?? ""), gaveta: String(l.gaveta ?? ""), pasta: String(l.pasta ?? ""), vaga: !!l.vaga }))); })
      .catch(() => { if (vivo) setPastas([]); });
    return () => { vivo = false; };
  }, []);

  /* a rota consulta o servidor com o período escolhido aqui */
  const cbPeriodo = useRef(aoPeriodo);
  cbPeriodo.current = aoPeriodo;
  useEffect(() => { cbPeriodo.current?.(de, ate); }, [de, ate]);
  /* A data que passa da outra leva a outra junto (era recusada e voltava
     sozinha: para andar o período para a frente, só mudando o Até primeiro). */
  function aplicarDatas(deN: string, ateN: string, mudou: "de" | "ate") {
    const a = new Date(deN + "T00:00:00"), b = new Date(ateN + "T00:00:00");
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) { setErroData("Escolha as duas datas."); return; }
    if (b < a) { if (mudou === "de") ateN = deN; else deN = ateN; }
    const a2 = new Date(deN + "T00:00:00"), b2 = new Date(ateN + "T00:00:00");
    setDe(deN); setAte(ateN); setDias(Math.round((b2.getTime() - a2.getTime()) / 86_400_000) + 1); setErroData("");
  }

  const deBR = diaBR(new Date(de + "T00:00:00")), ateBR = diaBR(new Date(ate + "T00:00:00"));
  const periodoTexto = de === ate ? `em ${ateBR}` : `de ${deBR} a ${ateBR}`;

  const assuntos = useMemo((): Assunto[] => {
    const carregando = !dados;
    const c = dados?.cartoes;
    const brl = (v: number) => (podeFinanceiro ? brlNum(v) : "—");
    const ordenar = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);
    const contar = (chaves: string[]) => { const o: Record<string, number> = {}; chaves.forEach((k) => { o[k] = (o[k] ?? 0) + 1; }); return ordenar(o); };

    /* ————— os pedidos que entraram no período ————— */
    const doPeriodo = pedidos.filter((p) => { const dia = diaDe(p.created_at); return !!dia && dia >= de && dia <= ate; });
    /* o cartão de Refazer clichê de cliente antigo não é pedido solicitado: já
       conta em Clichês refeitos, e quem cadastra (design, administração) não
       é vendedora (simulação 6, 07/10/2026) */
    const deRefacao = new Set(c?.cartoesDeRefacao ?? []);
    const solicitados = doPeriodo.filter((p) => !deRefacao.has(Number(p.numero)));
    const vendedoras = ((c?.vendedoras ?? dados?.vendedoras ?? []) as { nome: string; qtde: number }[]).map((v) => ({ rotulo: v.nome, valor: f(Number(v.qtde) || 0) }));
    const alteracoes = c?.alteracoes ?? [];
    const pedidosComAlteracao = new Set(alteracoes.map((x) => x.numero)).size;
    const cancelados = c?.cancelados ?? [];
    const aprovs = (c?.aprovacoes ?? []).map((x) => ({ ...x, h: horas(x.entrada, x.aprovado) })).filter((x) => x.h !== null) as { numero: number; cliente: string; h: number }[];
    const tAprov = media(aprovs.map((x) => x.h));

    /* ————— os clichês que chegaram no período ————— */
    const chegadas = c?.chegadas ?? [];
    /* a hora da chegada: a data e a hora que quem lançou escreveu; sem a hora, a do lançamento */
    const chegouEm = (x: Cartoes["chegadas"][number]) => (x.data_chegada && x.hora_chegada ? `${x.data_chegada}T${x.hora_chegada.slice(0, 5)}:00` : x.lancado);
    const esp = (x: Cartoes["chegadas"][number]) => (x.espessura === "1.14" || x.espessura === "1.70" ? x.espessura : "Sem espessura");
    const ESPESSURAS = ["1.14", "1.70", "Sem espessura"];
    const porEsp = ESPESSURAS.map((k) => {
      const xs = chegadas.filter((x) => esp(x) === k);
      return { k, itens: xs.reduce((t, x) => t + (x.itens || 0), 0), total: xs.reduce((t, x) => t + (Number(x.total) || 0), 0) };
    });
    const itens = porEsp.reduce((t, e) => t + e.itens, 0);
    const gasto = porEsp.reduce((t, e) => t + e.total, 0);
    const esperas = chegadas.map((x) => ({ x, h: horas(x.aprovado, new Date(chegouEm(x)).toISOString()) })).filter((y) => y.h !== null) as { x: Cartoes["chegadas"][number]; h: number }[];
    const tEspera = media(esperas.map((y) => y.h));
    /* as refações do período, cada uma com os clichês dela (cada cor é um
       clichê, como nos aprovados); os motivos também em clichês */
    const refacoes = c?.refacoes ?? [];
    const refeitos = refacoes.reduce((t, r) => t + (Number(r.cliches) || 0), 0);
    const porMotivo: Record<string, number> = {};
    refacoes.forEach((r) => { porMotivo[r.motivo] = (porMotivo[r.motivo] ?? 0) + (Number(r.cliches) || 0); });
    const motivos = ordenar(porMotivo);
    const refacaoNoPedido = refacoes.some((r) => r.doPedido);
    const refacoesSemCores = refacoes.filter((r) => r.semCores).length;
    const valorRefeitos = chegadas.filter((x) => x.refacoes_antes > 0).reduce((t, x) => t + (Number(x.total) || 0), 0);
    const desdeSempre = new Map((c?.refacoesDesdeSempre ?? []).map((r) => [r.cliente, r.qtde]));

    /* ————— Pantones, facas e medidas dos pedidos do período ————— */
    /* cada Pantone conta uma vez por pedido; "em N pedidos" são os pedidos com
       algum Pantone (contava as vezes que um Pantone aparecia) */
    const pantones: string[] = [];
    let pedidosComPantone = 0;
    const facas: string[] = [];
    const medidas: string[] = [];
    const facasNovas: any[] = [];
    doPeriodo.forEach((p) => {
      /* as da arte quando a prova foi lida (o que virou clichê); senão as pedidas */
      const doPedido = pantonesDoPedido(coresEfetivas(p));
      if (doPedido.length) pedidosComPantone++;
      pantones.push(...doPedido);
      const cod = String(p.faca_cod ?? "").trim();
      if (cod) facas.push(cod);
      if (Number(p.faca_nova) === 1) facasNovas.push(p);
      const l = String(p.largura ?? "").trim(), a = String(p.altura ?? "").trim();
      if (l && a && l !== "—" && a !== "—") medidas.push(`${l}×${a} mm`);
    });
    const pantonesUnicos = contar(pantones), facasUnicas = contar(facas), medidasUnicas = contar(medidas);

    /* ————— o arquivo físico: as pastas de hoje ————— */
    const lista = pastas ?? [];
    const vagas = lista.filter((p) => p.vaga).length;
    const porGaveta: Record<string, { n: number; vagas: number }> = {};
    lista.forEach((p) => { const k = p.gaveta || "—"; const g = porGaveta[k] ?? (porGaveta[k] = { n: 0, vagas: 0 }); g.n++; if (p.vaga) g.vagas++; });

    const unidades = (nome: string, n: number): Grupo[] => [{ nome, n }];
    const aprovMaisLenta = aprovs.length ? [...aprovs].sort((a, b) => b.h - a.h)[0] : null;
    const chegadaMaisLenta = esperas.length ? [...esperas].sort((a, b) => b.h - a.h)[0] : null;
    return [
      /* Pedidos: o ciano do Aguardando design. Na capa, o total solicitado; dentro,
         o que aconteceu no período (alterações e cancelados) e as vendedoras */
      {
        /* espera o servidor: é ele que diz quais cartões são de Refazer clichê */
        id: "pedidos", nome: "Pedidos", status: "nova", tom: 0, numero: f(solicitados.length), temDado: solicitados.length > 0, carregando,
        frase: solicitados.length === 1 ? "pedido solicitado no período" : "pedidos solicitados no período",
        contexto: `${plural(solicitados.length, "pedido solicitado", "pedidos solicitados")} ${periodoTexto}. As alterações e os cancelados contam o que aconteceu no período.`,
        vazio: "Nenhum pedido solicitado no período.", modo: "unidades", grupos: unidades("Pedidos", solicitados.length),
        listas: [
          { titulo: "No período", linhas: carregando ? [] : [
            { rotulo: "Alterações pedidas", valor: f(alteracoes.length) },
            { rotulo: "Pedidos com alteração", valor: f(pedidosComAlteracao) },
            { rotulo: "Cancelados", valor: f(cancelados.length) },
          ], vazia: "Carregando…" },
          { titulo: "Por vendedora", linhas: vendedoras, vazia: carregando ? "Carregando…" : "Nenhum pedido no período." },
        ],
        destino: "Pedidos",
      },
      /* Clichês: o rosa da Clicheria. Os aprovados (cada cor que chegou é um clichê,
         cada bolinha na força da sua espessura); dentro, os valores por espessura,
         a média por clichê e a aprovação: as artes aprovadas, o tempo da
         solicitação à aprovação e da aprovação à chegada (Augusto, 07/10/2026:
         "aprovação vai para dentro do card clichês aprovados") */
      {
        id: "cliches-aprovados", nome: "Clichês aprovados", status: "cliche", tom: 0, numero: f(itens), temDado: itens > 0 || aprovs.length > 0, carregando,
        frase: itens === 1 ? "clichê aprovado no período" : "clichês aprovados no período",
        contexto: `${plural(itens, "clichê chegou", "clichês chegaram")} (cada cor é um) em ${plural(chegadas.length, "chegada", "chegadas")} ${periodoTexto}.`,
        vazio: "Nenhum clichê chegou no período.", modo: "unidades", grupos: porEsp.map((e) => ({ nome: e.k, n: e.itens })),
        listas: [
          podeFinanceiro
            ? { titulo: "Valores", linhas: itens ? [
                ...porEsp.filter((e) => e.itens).map((e) => ({ rotulo: `${e.k} (${f(e.itens)})`, valor: brlNum(e.total) })),
                { rotulo: "Média por clichê", valor: brlNum(gasto / itens) },
                { rotulo: "Total", valor: brlNum(gasto) },
              ] : [], vazia: "Nenhum clichê no período." }
            : { titulo: "Por espessura", linhas: porEsp.filter((e) => e.itens).map((e) => ({ rotulo: e.k, valor: plural(e.itens, "clichê", "clichês") })), vazia: "Nenhum clichê no período." },
          /* os tempos são médias; a mais demorada de cada um diz qual pedido puxou a média */
          { titulo: "Aprovação e chegada", linhas: carregando ? [] : [
            { rotulo: "Artes aprovadas", valor: f(aprovs.length) },
            { rotulo: "Da solicitação à aprovação", valor: aprovs.length ? tempo(tAprov) : "nenhuma" },
            { rotulo: "Da aprovação à chegada", valor: esperas.length ? tempo(tEspera) : "nenhuma" },
            /* o pedido vai no valor: no rótulo, o número era cortado */
            ...(aprovMaisLenta ? [{ rotulo: "Aprovação mais lenta", valor: `${numeroDoPedido(aprovMaisLenta.numero)}, ${tempo(aprovMaisLenta.h)}` }] : []),
            ...(chegadaMaisLenta ? [{ rotulo: "Chegada mais lenta", valor: `${numeroDoPedido(chegadaMaisLenta.x.numero)}, ${tempo(chegadaMaisLenta.h)}` }] : []),
          ], vazia: "Carregando…" },
        ],
        destino: "Aprovação",
      },
      {
        id: "cliches-refeitos", nome: "Clichês refeitos", status: "cliche", tom: 0.2, numero: f(refeitos), temDado: refacoes.length > 0, carregando,
        frase: refeitos === 1 ? "clichê refeito no período" : "clichês refeitos no período",
        /* a refação feita no pedido não guarda as cores marcadas: contam as do pedido, e o painel diz */
        contexto: [
          `${plural(refeitos, "clichê", "clichês")} em ${plural(refacoes.length, "refação", "refações")} ${periodoTexto}.`,
          refacaoNoPedido ? "Na refação pelo pedido, contam as cores dele." : "",
          refacoesSemCores ? `${plural(refacoesSemCores, "refação sem cores no pedido conta", "refações sem cores no pedido contam")} 1 clichê.` : "",
          podeFinanceiro ? `Os que já chegaram custaram ${brl(valorRefeitos)}.` : "",
        ].filter(Boolean).join(" "),
        vazio: "Nenhum clichê refeito no período.", modo: "unidades", grupos: unidades("Refeitos", refeitos),
        listas: [
          { titulo: "Motivos", linhas: motivos.map(([m, n]) => ({ rotulo: m, valor: plural(n, "clichê", "clichês") })), vazia: "Nenhuma refação no período." },
          /* os clientes que refizeram no período, com as vezes que cada um já refez desde sempre */
          { titulo: "Vezes que o cliente já refez", linhas: (c?.refacoesPorCliente ?? []).map((r) => ({ rotulo: r.cliente || "—", valor: plural(desdeSempre.get(r.cliente) ?? r.qtde, "vez", "vezes") })), vazia: "Nenhuma refação no período." },
        ],
        destino: "Aprovação",
      },
      /* Pantones: o roxo da Criação */
      {
        id: "pantones", nome: "Pantones", status: "criacao", tom: 0, numero: f(pantonesUnicos.length), temDado: pantonesUnicos.length > 0,
        frase: pantonesUnicos.length === 1 ? "Pantone pedido no período" : "Pantones diferentes pedidos no período",
        contexto: `${plural(pantonesUnicos.length, "Pantone diferente", "Pantones diferentes")} em ${plural(pedidosComPantone, "pedido", "pedidos")} ${periodoTexto}.`,
        vazio: "Nenhum Pantone pedido no período.", modo: "unidades", grupos: unidades("Pantones", pantonesUnicos.length),
        listas: [{ titulo: "Os mais usados", linhas: pantonesUnicos.map(([nome, n]) => ({ rotulo: nome, valor: plural(n, "pedido", "pedidos") })), vazia: "Nenhum Pantone no período." }],
        destino: "Pantone",
      },
      /* Facas e medidas: o verde-limão do Aprovado, em tons. As facas novas
         ficam dentro do cartão de Facas (Augusto, 07/10/2026) */
      {
        id: "facas", nome: "Facas", status: "aprovada", tom: 0, numero: f(facasUnicas.length), temDado: facasUnicas.length > 0 || facasNovas.length > 0,
        frase: facasUnicas.length === 1 ? "faca usada no período" : "facas diferentes usadas no período",
        contexto: `${plural(facasUnicas.length, "faca diferente", "facas diferentes")} em ${plural(facas.length, "pedido", "pedidos")} ${periodoTexto}. ${facasNovas.length ? `${plural(facasNovas.length, "pedido pediu", "pedidos pediram")} faca nova.` : "Nenhum pedido pediu faca nova."}`,
        vazio: "Nenhuma faca nos pedidos do período.", modo: "unidades", grupos: unidades("Facas", facasUnicas.length),
        listas: [
          { titulo: "As mais usadas", linhas: facasUnicas.map(([cod, n]) => ({ rotulo: cod, valor: plural(n, "pedido", "pedidos") })), vazia: "Nenhuma faca do catálogo no período." },
          { titulo: `Facas novas (${plural(facasNovas.length, "pedido", "pedidos")})`, linhas: facasNovas.map((p) => ({ rotulo: `${numeroDoPedido(p.numero)} ${p.cliente ?? ""}`, valor: p.largura && p.altura ? `${p.largura}×${p.altura}` : "sem medida" })), vazia: "Nenhum pedido com faca nova." },
        ],
        destino: "Facas",
      },
      {
        id: "medidas", nome: "Medidas", status: "aprovada", tom: 0.2, numero: f(medidasUnicas.length), temDado: medidasUnicas.length > 0,
        frase: medidasUnicas.length === 1 ? "medida pedida no período" : "medidas diferentes no período",
        contexto: `${plural(medidasUnicas.length, "medida diferente", "medidas diferentes")} em ${plural(medidas.length, "pedido", "pedidos")} ${periodoTexto}.`,
        vazio: "Nenhuma medida nos pedidos do período.", modo: "unidades", grupos: unidades("Medidas", medidasUnicas.length),
        listas: [{ titulo: "As mais pedidas", linhas: medidasUnicas.map(([m, n]) => ({ rotulo: m, valor: plural(n, "pedido", "pedidos") })), vazia: "Nenhuma medida no período." }],
        destino: "Facas",
      },
      /* Arquivo físico: o amarelo da Revisão. As bolinhas contam as vagas, como
         nos outros cartões (Augusto, 07/10/2026: "represente melhor a quantidade
         com os círculos, veja esse tem 362 itens e apenas duas colunas
         preenchidas, use a maior parte dos círculos"): acima de 100, cada
         bolinha vale várias pastas, e a frase diz quantas. Antes eram as partes
         do todo, vagas contra ocupadas, e 362 vagas em 1.915 acendiam 19. */
      {
        id: "arquivo", nome: "Arquivo físico", status: "revisao", tom: 0, numero: f(vagas), temDado: lista.length > 0, carregando: pastas === null,
        frase: `pastas vagas no arquivo, de ${f(lista.length)}`,
        contexto: `${plural(lista.length, "pasta cadastrada", "pastas cadastradas")} hoje, ${plural(vagas, "vaga", "vagas")}. O arquivo não depende do período.`,
        vazio: "Nenhuma pasta cadastrada no arquivo.", modo: "unidades", grupos: unidades("Vagas", vagas),
        listas: [{ titulo: "Por gaveta", linhas: Object.entries(porGaveta).sort((a, b) => b[1].n - a[1].n).map(([g, v]) => ({ rotulo: g, valor: v.vagas ? `${f(v.n)} (${plural(v.vagas, "vaga", "vagas")})` : f(v.n) })), vazia: "Nenhuma pasta cadastrada." }],
        destino: "Arquivos",
      },
    ];
  }, [pedidos, de, ate, dados, pastas, podeFinanceiro, periodoTexto]);

  const presetLigado = (p: { d: number }) => dias === p.d && ate === iso(new Date());
  const datasLigadas = !PRESETS.some(presetLigado);
  const assuntoAberto = assuntos.find((a) => a.id === aberto) ?? null;
  const podeIr = (pagina?: string) => !!pagina && (!disponiveis || disponiveis.includes(pagina));

  /* pé: as pílulas depois do título (44 de ar, nunca antes da c6) */
  const tituloRef = useRef<HTMLDivElement | null>(null);
  const [fimTitulo, setFimTitulo] = useState(80 + 520);
  useEffect(() => {
    const el = tituloRef.current;
    if (!el) return;
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo && el.isConnected) setFimTitulo(el.offsetLeft + el.offsetWidth); });
    return () => { vivo = false; };
  }, []);
  const xPilulas = Math.max(480 - PILULA_BORDA / 2, Math.ceil(fimTitulo + 44));

  return (
    <PalcoFixo>
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />

      <TrilhaV4 quantos={assuntos.length} oculta={!!assuntoAberto} rotulo="Relatórios">
        {assuntos.map((a, i) => <CartaoAssunto key={a.id} a={a} i={i} aoAbrir={() => setAberto(a.id)} />)}
      </TrilhaV4>
      {assuntoAberto && <PainelAssunto key={assuntoAberto.id} a={assuntoAberto} aoFechar={fechar} aoNavegar={aoNavegar} podeIr={podeIr(assuntoAberto.destino)} />}

      {/* o pé */}
      <div ref={tituloRef} style={tituloDoPeV4("Relatórios")}>Relatórios</div>
      <div style={{ position: "absolute", left: xPilulas, top: TOPO_PILULA, display: "flex", gap: 29, zIndex: NIVEL.painel + 2 }}>
        {PRESETS.map((p) => (
          <button key={p.l} type="button" aria-pressed={presetLigado(p)} onClick={() => { setDias(p.d); setDe(iso(menos(p.d - 1))); setAte(iso(new Date())); setErroData(""); setDatasAbertas(false); }}
            className="np4-pilula" style={{ ...PILULA_PE, minWidth: 120, background: presetLigado(p) ? AMARELO : undefined }}>{p.l}</button>
        ))}
        <div data-pop style={{ position: "relative" }}>
          <button type="button" aria-haspopup="dialog" aria-expanded={datasAbertas} onClick={() => setDatasAbertas((v) => !v)} className="np4-pilula"
            style={{ ...PILULA_PE, minWidth: 120, background: datasLigadas ? AMARELO : undefined }}>Datas</button>
          {datasAbertas && (
            /* a caixa tem a largura do conteúdo (Augusto, 05/10/2026: "remover espaço em branco desnecessário") */
            <div role="dialog" aria-label="Escolher as datas"
              style={{ position: "absolute", left: 0, bottom: "calc(100% + 16px)", width: "max-content", boxSizing: "border-box", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12, padding: "14px 14px 14px 16px",
                boxShadow: "0 -14px 40px -16px rgba(0,0,0,.6)", display: "grid", gridTemplateColumns: "auto auto", alignItems: "center", columnGap: 12, rowGap: 10, fontFamily: INTER }}>
              {([["De", de, (v: string) => aplicarDatas(v, ate, "de")], ["Até", ate, (v: string) => aplicarDatas(de, v, "ate")]] as const).map(([rot, val, mudar]) => (
                <label key={rot} style={{ display: "contents" }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{rot}</span>
                  <input type="date" value={val} onChange={(e) => mudar(e.target.value)}
                    style={{ height: 38, border: `1px solid ${PRETO}`, borderRadius: 8, padding: "0 10px", fontFamily: INTER, fontSize: 15, color: PRETO, background: "#fff", outline: "none" }} />
                </label>
              ))}
              {erroData && <span role="alert" style={{ gridColumn: "1 / -1", maxWidth: 260, fontSize: 14, fontWeight: 600, color: VERMELHO }}>{erroData}</span>}
            </div>
          )}
        </div>
      </div>
      {podeExportar && (
        <button type="button" onClick={() => window.print?.()} className="np4-pilula"
          style={{ ...PILULA_PE, position: "absolute", right: 1920 - (1840 + PILULA_BORDA / 2), top: TOPO_PILULA, minWidth: 143.29, zIndex: 3 }}>Imprimir</button>
      )}

      {children}
      <BarraTopoHub10 profile={profile} paginaAtiva="Apontamentos" aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis} fundo="transparent" />
    </PalcoFixo>
  );
}
