// Calculadora de facas (Hub 1.0, por dentro).
//
// A aba que abre no card "Facas" das Calculadoras, sem o card lilás (Augusto,
// 28/09/2026) e sem a faixa preta. Desde 29/09/2026 a página é o desenho que
// ele fez em cima da grade (hubv3/CALC FACAS.svg), medido linha a linha:
//
//   - a medida em dois números grandes, Fraunces 80, com o traço embaixo (pé
//     na linha 23) e o rótulo na 25: largura na c1, altura na c6;
//   - uma coluna só à direita, na c18 (no desenho, c19; foi para a linha da
//     caixa de pesquisa da barra): "Configurações" (rótulo na 15; cada
//     ajuste com o nome numa linha e o valor duas abaixo: 18/20, 23/25,
//     28/30 e 34/36) e, embaixo, "Resultados:" (42; um por linha, de três
//     em três, da 45 à 57; o gabarito na 62);
//   - o valor total enorme na c1, Fraunces 276,3 com a maiúscula de linha a
//     linha (45 a 57), o rótulo na 42 e a quebra na 62 (faca na c1,
//     engrenagem na c6, porta-clichê, que é o cilindro, na c12). O bloco do
//     valor está uma linha acima do desenho: veja ROTULO_BAIXO.
//
// Três corpos, os do desenho: Inter 24 (com −0,04em, que é a largura das
// linhas do SVG na Inter do hub), Fraunces 80 e Fraunces 276,3, os dois no
// peso 400 (o "Fraunces 72pt SuperSoft Regular" do Illustrator é o Fraunces
// do hub com SOFT 100, opsz 72 e peso 400).
//
// As contas são as da calculadora antiga (`calcular("facas")`, validadas com
// a fábrica), com os mesmos padrões: nenhuma fórmula nova mora aqui. A única
// diferença é "Cilindros: todos" de saída, para a conta poder dizer quando o
// cilindro não existe na fábrica (ela continua preferindo o que já temos).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode, Ref } from "react";

import { PADROES, PASSO_MM, calcular, gabaritoSVG } from "../v1a/CalculadorasV1a";
import { FR, FUNDO, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { LINHA_DA_GRADE, baseFraunces, baseInter, folgaFraunces, folgaInter } from "./grade-hub10";

/* a tinta do hub (guia, 4.6): preto, tinta 2, cinza dos rótulos */
export const CINZA = "#8f8f8f";
export const TINTA2 = "#5b595b";
/* o número que ainda não existe: um fantasma do tamanho certo */
export const FANTASMA = "#d6d6d6";
export const MENU: CSSProperties = {
  minWidth: 230, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12, padding: 8,
  boxShadow: "0 22px 54px rgba(0,0,0,.22)", display: "flex", flexDirection: "column", gap: 3,
};

const MAQUINAS = ["Classic 160", "Force 250"];
const PASSOS = ["M1 π", '1/8"', '1/4"', '3/8"', '1/2"'];
/* no desenho a engrenagem de módulo 1 é "M1" (o π é o passo dela em mm, e
   continua no valor que vai para a conta) */
const nomePasso = (p: string) => (p === "M1 π" ? "M1" : p);
/* "Faca: Padrão" no desenho; a de gap é a sem perda (a conta antiga liga o
   modo gap com perda 0 e 0) */
const TIPOS = ["Padrão, com esqueleto", "Gap, sem perda"];
const PERDA_MIN = String(PADROES.facas.espMin), PERDA_MAX = String(PADROES.facas.espMax);
const PERDA_CARREIRAS = String(PADROES.facas.espCarr);

/** Só dígitos, com uma vírgula decimal (o ponto do teclado numérico vira
    vírgula, que é como o hub escreve). */
export const soNumero = (v: string) => {
  const limpo = v.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [inteiro, ...resto] = limpo.split(",");
  /* duas casas depois da vírgula, no máximo: a 3ª tecla some à vista, e não
     em silêncio no meio de um número colado */
  return resto.length ? inteiro + "," + resto.join("").slice(0, 2) : inteiro;
};
export const num = (v: string) => {
  const x = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
export const fmt = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
/** 3 → "3", 2,5 → "2,5", 2,36 → "2,36": sem zeros sobrando */
export const curto = (v: number) => (Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v))
  : fmt(v, Math.abs(v * 10 - Math.round(v * 10)) < 0.005 ? 1 : 2));

/* A grade. A aba começa em 112 no palco: a linha k fica em k·1080/67 − 112
   aqui dentro. As colunas: c1 (largura, valor, faca), c6 (altura,
   engrenagem), c12 (porta-clichê) e c18 (configurações e resultados). */
export const linhaDaAba = (k: number) => k * LINHA_DA_GRADE - 112;
/* A coluna da direita (configurações e resultados) mora na c18, a linha da
   borda da caixa de pesquisa da barra de cima (Augusto, 29/09/2026: "o ideal
   seria estar na mesma linha"; no desenho as duas estavam na c19). O valor
   grande para meia coluna antes dela. */
export const C1 = 80, C6 = 480, C12 = 960, C18 = 1440, C23 = 1840;
export const LIMITE_VALOR = C18 - 40;
export const L2 = 2 * LINHA_DA_GRADE, L5 = 5 * LINHA_DA_GRADE;
/* O bloco de baixo. No desenho: rótulos na 43, maiúscula do valor da 46 à
   58, resultados de três em três da 46 à 58 e a quebra na 62. Com o valor e
   a quebra exatamente nessas linhas, a vírgula do valor (desce 45 px) encosta
   no texto da 62 (no desenho sobravam 1 a 2 px): medido em 29/09/2026 com
   R$ 809,55 e R$ 1.322,11, as duas vírgulas em cima do "Porta clichê". O
   bloco subiu uma linha e as relações do desenho continuam: o
   rótulo três linhas acima da maiúscula, o 1º e o último resultado nas
   linhas da maiúscula, a quebra na 62 (margem de baixo igual à dos lados). */
export const ROTULO_BAIXO = 42, BASE_VALOR = 57, QUEBRA = 62;
/* os corpos do desenho; as mensagens que tomam o lugar do valor, em 68 */
export const PEQUENO = 24, MEDIDA = 80, PRECO = 276.3, FRASE = 68;
/* o valor com as letras um pouco mais juntas, −0,02em, o dos títulos em
   Fraunces do hub (Augusto, 29/09/2026: "aperte um pouco o kerning do valor
   para não atropelar a área de resultados") */
export const JUSTO_VALOR = "-.02em";
/* Os textos pequenos, na proposta que o Augusto escolheu (C, 29/09/2026):
   o nome em Inter 24 cinza e o valor em Fraunces preto, a mesma família do
   número grande. A Inter com −0,02em, o que ela pede em 24 (o desenho vinha
   com −0,04em e ficava apertado). O valor em 26: a altura de x do Fraunces é
   menor, e no 26 ele fica do tamanho da Inter 24 do lado; no corte de 24 pt
   (opsz), com os finos mais firmes que o de 72 do número grande. */
export const JUSTO = "-.02em";
export const VALOR = 26;
export const FR_VALOR: CSSProperties = { fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 24", fontWeight: 400 };
/* o traço de cada número: três colunas (c1 a c4, c6 a c9), 1,5 px, a
   espessura dos campos tracejados do hub (no desenho, 2,5; ele pediu mais
   fino em 29/09/2026); cresce se o número passar dele */
export const TRACO = 240, ESPESSURA = 1.5;
export const ALTURA_DA_ABA = 968;
export const FR400: CSSProperties = { ...FR, fontWeight: 400 };
/* O canvas que mede a folga da 1ª letra não aplica SOFT nem opsz, e o
   Fraunces desenhado com eles começa um pouco depois (medido no print em
   29/09/2026: o "R" do valor, 12 px na tela contra 8,6 no canvas). */
export const FOLGA_PRECO = 3.4, FOLGA_MEDIDA = 1, FOLGA_FRASE = 1, FOLGA_VALOR = 0;
/* e senta abaixo do que `baseFraunces` diz, medido no pé das letras retas */
export const ACERTO_PRECO = 1, ACERTO_MEDIDA = 1, ACERTO_FRASE = 1, ACERTO_VALOR = 0;

/** Texto em Inter com a tinta em x e a linha de base na linha k da grade. */
export function naGrade(x: number, k: number, corpo: number, peso: number, primeira: string): CSSProperties {
  return {
    position: "absolute", left: x - folgaInter(peso, corpo, primeira), top: linhaDaAba(k) - baseInter(corpo, corpo),
    fontFamily: INTER, fontSize: corpo, fontWeight: peso, lineHeight: `${corpo}px`, letterSpacing: JUSTO, whiteSpace: "nowrap",
  };
}
/** O mesmo em Fraunces 400, com os acertos medidos daquele corpo. */
export function noFraunces(x: number, k: number, corpo: number, primeira: string, folgaExtra: number, acerto: number): CSSProperties {
  return {
    ...FR400, position: "absolute", left: x - folgaFraunces(400, corpo, primeira) - folgaExtra,
    top: linhaDaAba(k) - baseFraunces(corpo, corpo) - acerto,
    fontSize: corpo, lineHeight: `${corpo}px`, whiteSpace: "nowrap",
  };
}
/** Um valor sozinho na linha (o das configurações): Fraunces 26 com a
    tinta em x e a base na linha k. */
export function valorNaGrade(x: number, k: number, primeira: string): CSSProperties {
  return {
    ...FR_VALOR, position: "absolute", left: x - folgaFraunces(400, VALOR, primeira) - FOLGA_VALOR,
    top: linhaDaAba(k) - baseFraunces(VALOR, VALOR) - ACERTO_VALOR,
    fontSize: VALOR, lineHeight: `${VALOR}px`, letterSpacing: JUSTO, color: PRETO, whiteSpace: "nowrap",
  };
}
/* o valor no meio de uma linha de Inter ("Cilindro: Z82"): senta na mesma
   base, e a altura de linha zero não deixa o corpo maior empurrar a linha */
export const VALOR_NA_LINHA: CSSProperties = { ...FR_VALOR, fontSize: VALOR, lineHeight: 0, color: PRETO };

/** "Nome: valor" numa linha só, como nos resultados e na quebra do valor:
    o nome em Inter cinza, o valor em Fraunces preto e, se houver, a unidade
    ("un.") de volta ao cinza. */
export function Par({ x, k, nome, valor, un }: { x: number; k: number; nome: string; valor: ReactNode; un?: string }) {
  return (
    <span style={{ ...naGrade(x, k, PEQUENO, 400, nome.charAt(0)), color: CINZA }}>
      {nome}: <span style={VALOR_NA_LINHA}>{valor}</span>{un ? ` ${un}` : ""}
    </span>
  );
}

/** Quando o menu fecha com o foco lá dentro (escolheu uma opção, ou ESC),
    o foco volta ao botão que o abriu, em vez de cair no body. */
export function useFocoDeVolta(aberto: boolean) {
  const botao = useRef<HTMLButtonElement | null>(null);
  const estava = useRef(false);
  useEffect(() => {
    if (estava.current && !aberto) {
      const ativo = typeof document !== "undefined" ? document.activeElement : null;
      if (!ativo || ativo === document.body) botao.current?.focus();
    }
    estava.current = aberto;
  }, [aberto]);
  return botao;
}

export function Opcoes({ lista, atual, aoEscolher }: { lista: string[]; atual: string; aoEscolher: (v: string) => void }) {
  return (
    <div style={MENU}>
      {lista.map((v) => (
        <button key={v} aria-pressed={v === atual} onClick={() => aoEscolher(v)}
          style={{ textAlign: "left", height: 38, padding: "0 14px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: INTER, fontSize: 16, fontWeight: 500, whiteSpace: "nowrap", background: v === atual ? PRETO : "transparent", color: v === atual ? "#fff" : PRETO }}>{v}</button>
      ))}
    </div>
  );
}

/** O valor de uma configuração ("Classic 160 ▾"); o nome mora duas linhas
    acima. A seta diz que se escolhe; sem menu, é só o valor. O menu abre
    para baixo. */
export function ValorEscolha({ valor, rotulo, aberto, aoAbrir, children }: {
  valor: string; rotulo: string; aberto?: boolean; aoAbrir?: () => void; children?: ReactNode;
}) {
  const botao = useFocoDeVolta(!!aberto);
  if (!aoAbrir) return <span>{valor}</span>;
  return (
    <span data-pop style={{ position: "relative", display: "inline-flex" }}>
      <button ref={botao} onClick={aoAbrir} className="p10-flat" aria-expanded={aberto} aria-label={`${rotulo}: ${valor}`}
        style={{ ...FR_VALOR, display: "inline-flex", alignItems: "center", gap: 8, height: VALOR, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: VALOR, lineHeight: `${VALOR}px`, letterSpacing: JUSTO, color: PRETO, whiteSpace: "nowrap" }}>
        {valor}
        <svg aria-hidden width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" style={{ opacity: .65 }}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {aberto && <div className="calc10-menu" style={{ position: "absolute", left: 0, top: baseFraunces(VALOR, VALOR) + 16, zIndex: 40 }}>{children}</div>}
    </span>
  );
}

/** Um número da medida, como no desenho: Fraunces 80 com a tinta na coluna e
    a base na linha 21, o traço de 2,5 px com o pé na linha 23 e o nome em
    cinza na 25. O traço é cheio com número (como no desenho) e tracejado
    enquanto vazio, o campo do hub que pede para ser preenchido; com o foco,
    engrossa. Vazio, um "0" fantasma, como o valor. */
export function CampoMedida({ x, nome, valor, rotulo, aoMudar, aoEnter, auto, campoRef, titulo }: {
  x: number; nome: string; valor: string; rotulo: string;
  aoMudar: (v: string) => void; aoEnter?: () => void; auto?: boolean; campoRef?: Ref<HTMLInputElement>; titulo?: string;
}) {
  const texto = valor || "0";
  /* a tinta do 1º algarismo na coluna: o campo recua a folga dele */
  const folga = folgaFraunces(400, MEDIDA, texto.charAt(0)) + FOLGA_MEDIDA;
  const topo = linhaDaAba(21) - baseFraunces(MEDIDA, MEDIDA) - ACERTO_MEDIDA;
  const letra: CSSProperties = { ...FR400, fontSize: MEDIDA, lineHeight: `${MEDIDA}px`, height: MEDIDA, whiteSpace: "pre" };
  return (
    <>
      <label title={titulo} className="calc10-campo" style={{ position: "absolute", left: x, top: topo, minWidth: TRACO, display: "grid", cursor: "text" }}>
        {/* o espelho dá a largura (o traço cresce com o número); o campo fica
            por cima dele, fora do fluxo, para a largura própria do input (20
            letras de 80) não esticar o traço */}
        <span aria-hidden style={{ ...letra, visibility: "hidden", marginLeft: -folga }}>{texto}</span>
        <input ref={campoRef} value={valor} placeholder="0" aria-label={rotulo} autoFocus={auto} maxLength={7} inputMode="decimal"
          onChange={(e) => aoMudar(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && aoEnter) { e.preventDefault(); aoEnter(); } }}
          className="calc10-numero"
          style={{ ...letra, position: "absolute", left: -folga, top: 0, width: `calc(100% + ${folga}px)`, margin: 0, border: "none", outline: "none", background: "transparent", padding: 0, color: PRETO }} />
        {/* uma faixa, não uma borda: o Chrome arredonda borda de 2,5 px para
            2, e o pé saía meio pixel acima da linha 23 */}
        <span aria-hidden className="calc10-traco" style={{ position: "absolute", left: 0, right: 0, top: linhaDaAba(23) - ESPESSURA - topo, height: ESPESSURA,
          background: valor ? PRETO : `repeating-linear-gradient(90deg, ${PRETO} 0 6px, transparent 6px 11px)` }} />
      </label>
      {/* o nome em preto (Augusto, 29/09/2026; no desenho era cinza) */}
      <span aria-hidden style={{ ...naGrade(x, 25, PEQUENO, 400, nome.charAt(0)), color: PRETO }}>{nome}</span>
    </>
  );
}

/** A aba da calculadora de facas: a página inteira abaixo da barra. */
export function CalculadoraFacasHub10({ aoFechar, podeGabarito = false }: {
  aoFechar: () => void;
  /* a aba já levou às facas prontas do catálogo; no desenho de 29/09/2026
     elas saíram, e a navegação fica para quando voltarem */
  aoNavegar: (label: string) => void;
  /** permissão calc.gabarito: baixar o desenho 1:1 que vai para o ferramental */
  podeGabarito?: boolean;
}) {
  const [largura, setLargura] = useState("");
  const [altura, setAltura] = useState("");
  const [gap, setGap] = useState(false);
  const [maquina, setMaquina] = useState(String(PADROES.facas.maquina));
  const [passo, setPasso] = useState(String(PADROES.facas.passo));
  const [perdaMin, setPerdaMin] = useState(PERDA_MIN);
  const [perdaMax, setPerdaMax] = useState(PERDA_MAX);
  const [menu, setMenu] = useState<null | "tipo" | "maquina" | "passo" | "perda">(null);
  const campoLargura = useRef<HTMLInputElement | null>(null);
  const campoAltura = useRef<HTMLInputElement | null>(null);
  /* a folga da primeira letra só se mede com a fonte carregada: quando ela
     chega, redesenha para a tinta cair na coluna */
  const [fontes, setFontes] = useState(0);
  useEffect(() => { void document.fonts?.ready.then(() => setFontes((n) => n + 1)); }, []);

  /* ESC: primeiro o menu, depois a aba */
  const fecharMenu = useCallback(() => setMenu(null), []);
  useEscDoTopo(!!menu, NIVEL.verTodos, fecharMenu);
  useEscDoTopo(true, NIVEL.painel, aoFechar);

  /* clicar fora fecha o menu */
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-pop]")) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, []);
  const alternar = (m: NonNullable<typeof menu>) => setMenu(menu === m ? null : m);

  const Y = num(largura), X = num(altura);
  const completa = Y > 0 && X > 0;
  /* Que campo está com o foco: a frase do zero só aparece quando a pessoa
     sai do campo (quem digita "0,5" passa pelo "0"), como na aba de
     substrato. Começa na largura, que abre com o foco. */
  const [emFoco, setEmFoco] = useState<null | "largura" | "altura">("largura");
  useEffect(() => {
    const pares = [["largura", campoLargura.current], ["altura", campoAltura.current]] as const;
    const tirar: (() => void)[] = [];
    for (const [nome, el] of pares) {
      if (!el) continue;
      const entra = () => setEmFoco(nome);
      const sai = () => setEmFoco((atual) => (atual === nome ? null : atual));
      el.addEventListener("focus", entra);
      el.addEventListener("blur", sai);
      tirar.push(() => { el.removeEventListener("focus", entra); el.removeEventListener("blur", sai); });
    }
    return () => tirar.forEach((f) => f());
  }, []);
  /* Largura ou altura digitada como zero: a conta não roda e o valor ficava
     no "R$ 000,00" fantasma, sem dizer por quê (simulação 6, 07/10/2026).
     Com o campo vazio, o fantasma continua sozinho. */
  const larguraZero = largura !== "" && !(Y > 0) && emFoco !== "largura";
  const alturaZero = altura !== "" && !(X > 0) && emFoco !== "altura";
  /* Perda apagada, mínima acima da máxima ou 0 a 0 com a faca padrão (0 a 0
     é como a conta antiga liga o modo gap, e a tela mostraria o gap como se
     fosse esqueleto): não calcula, diz o que é. */
  const perdaInvalida = !gap && (!perdaMin || !perdaMax || num(perdaMin) > num(perdaMax) || !(num(perdaMax) > 0));
  /* os valores da conta antiga; a faca de gap é perda 0 e 0 na volta e 0
     entre as carreiras, como o "De gap (sem perda)" dela aplica */
  const valoresDaConta = useCallback((maq: string) => ({
    ...PADROES.facas,
    y: largura, x: altura, maquina: maq, passo,
    espMin: gap ? "0" : perdaMin, espMax: gap ? "0" : perdaMax, espCarr: gap ? "0" : PERDA_CARREIRAS,
    filtro: "Todos",
  }), [largura, altura, passo, gap, perdaMin, perdaMax]);
  const res = useMemo(() => (completa && !perdaInvalida ? calcular("facas", valoresDaConta(maquina)) : null),
    [completa, perdaInvalida, valoresDaConta, maquina]);
  const g = res?.gabarito ?? null;
  const linhaDe = (rotulo: string) => res?.linhas.find((l) => l.label === rotulo)?.valor ?? "";
  const preco = linhaDe("Total faca + engrenagem");
  const precoFaca = linhaDe("Preço da faca");
  const precoEngr = linhaDe("Preço da engrenagem");
  /* A maior altura que um cilindro fecha nesta engrenagem: Z máximo, uma
     repetição, menos a perda mínima. Acima dela a conta antiga sugeria
     "ajustar a altura" em centenas de milímetros (simulação de 28/09/2026,
     900×900). */
  const alturaMax = Number(PADROES.facas.nMax) * PASSO_MM(passo) - (gap ? 0 : num(perdaMin));
  const altaDemais = completa && !perdaInvalida && X > alturaMax + 1e-9;
  /* Nenhuma carreira: a etiqueta passa da largura útil da máquina. A conta
     antiga ainda devolvia o preço; vira mensagem, e a outra máquina é
     conferida com a mesma conta. */
  const naoCabe = !!g && !altaDemais && !g.carr;
  const outraMaquina = MAQUINAS.find((m) => m !== maquina) ?? "";
  const cabeNaOutra = useMemo(() => (naoCabe && !!outraMaquina && !!calcular("facas", valoresDaConta(outraMaquina))?.gabarito?.carr),
    [naoCabe, outraMaquina, valoresDaConta]);
  const resultado = !!g && !altaDemais && !naoCabe;
  /* O cilindro é o porta-clichê (Augusto, 29/09/2026). O hub sabe QUAIS Z a
     fábrica tem (a lista da calculadora antiga, que a conta devolve em
     `g.prod`), não quantos de cada. Sem o porta-clichê na fábrica, o valor não aparece (Augusto, 29/09/2026:
     "não dê o valor, em vez disso deixe um aviso e, se possível, mostre uma
     medida que encaixe no que tem na fábrica"). A medida vem da própria conta
     antiga, só com os cilindros da fábrica ("Só do estoque"): a altura mais
     perto que fecha num deles com a perda no meio da faixa (na de gap, a
     altura que ela ajusta). Antes de aparecer, é conferida com a conta
     normal: com essa altura, o cilindro escolhido tem de ser da fábrica. */
  const semPortaCliche = resultado && g!.prod == null;
  const sugestao = useMemo(() => {
    if (!semPortaCliche) return null;
    const soDaFabrica = calcular("facas", { ...valoresDaConta(maquina), filtro: "Só do estoque" });
    let x: number | null = null;
    if (gap) x = soDaFabrica?.gabarito?.X ?? null;
    else {
      const m = /com ([\d.]+,\d+) mm \([^)]*\) a etiqueta fecha em Z\d+/.exec(String(soDaFabrica?.nota ?? ""));
      if (m) x = num(m[1].replace(/\./g, ""));
    }
    if (x == null || !(x > 0)) return null;
    const altura = fmt(x);
    const conferida = calcular("facas", { ...valoresDaConta(maquina), x: altura })?.gabarito;
    if (!conferida || conferida.prod == null || !conferida.carr) return null;
    return { altura, z: conferida.Z };
  }, [semPortaCliche, valoresDaConta, maquina, gap]);
  /* no lugar do valor, quando não há valor: o que a conta diz */
  const mensagem = larguraZero && alturaZero ? "A largura e a altura precisam ser maiores que zero."
    : larguraZero ? "A largura precisa ser maior que zero.\nDigite a largura da etiqueta, em mm."
    : alturaZero ? "A altura precisa ser maior que zero.\nDigite a altura da etiqueta, em mm."
    : !completa ? "" : perdaInvalida
    ? (!perdaMin || !perdaMax ? "Falta a perda mínima ou a máxima.\nConfira a perda nas configurações."
      : !(num(perdaMax) > 0) ? "Com perda zero, a faca é de gap.\nEscolha Gap em Faca, nas configurações."
      : "A perda mínima passa da máxima.\nConfira a perda nas configurações.")
    : altaDemais
    ? `A altura passa do maior cilindro da fábrica.\nCom a engrenagem ${nomePasso(passo)}, vai até ${fmt(alturaMax)} mm.`
    : naoCabe
    ? `Não cabe na largura da ${maquina}.\n${cabeNaOutra ? `Na ${outraMaquina}, cabe.` : "Reduza a largura."}`
    : !g ? String(res?.nota ?? "")
    : semPortaCliche
    ? `A fábrica não tem o porta-clichê Z${g.Z}.\n${sugestao ? `Com ${sugestao.altura} mm de altura, fecha no Z${sugestao.z}.` : "Nenhum cilindro da fábrica fecha perto."}`
    : "";
  /* Mensagem curta vai inteira no corpo da frase, uma frase por linha. A
     nota da conta quando nenhum cilindro fecha chega a quatro linhas: aí só
     a 1ª frase fica grande, e o resto (o ajuste, para o designer) desce para
     24, em tinta 2. */
  const [titulo, detalhe] = mensagem.length <= 120 ? [mensagem, ""]
    : (() => { const i = mensagem.indexOf(". "); return i > 0 ? [mensagem.slice(0, i + 1), mensagem.slice(i + 2)] : [mensagem, ""]; })();

  /* O valor para meia coluna antes da c18 (LIMITE_VALOR). Na maioria dos
     preços sobra ar (R$ 1.313,17 termina na 1.353), mas os de algarismos
     largos chegam aos resultados: aí, e só aí, as letras se apertam até
     caber, sem mudar o corpo nem a linha. */
  /* sem conta, o fantasma tem a largura de um preço de verdade: "R$ 000,00"
     (Augusto, 29/09/2026: "mais 2 zeros quando estiver sem valor") */
  const textoValor = resultado ? preco : "R$ 000,00";
  const valorRef = useRef<HTMLDivElement | null>(null);
  const [aperto, setAperto] = useState(0);
  useLayoutEffect(() => {
    const el = valorRef.current;
    if (!el) return;
    const n = textoValor.length;
    const natural = el.offsetWidth - n * aperto;
    const cabe = LIMITE_VALOR - el.offsetLeft;
    const novo = natural > cabe ? -(natural - cabe) / n : 0;
    if (Math.abs(novo - aperto) > 0.05) setAperto(novo);
  }, [textoValor, aperto, fontes]);

  const baixarGabarito = () => {
    if (!g || typeof document === "undefined") return;
    const a = document.createElement("a");
    a.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(gabaritoSVG(g));
    a.download = `faca-Z${g.Z}-${fmt(g.Y, 0)}x${fmt(g.X, 0)}mm.svg`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const dica = "Largura é de lado a lado na bobina; altura, no sentido em que o rolo corre.";
  /* o valor de um resultado que ainda não existe */
  const nada = <span style={{ color: FANTASMA }}>—</span>;

  return (
    <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: ALTURA_DA_ABA, background: FUNDO, zIndex: NIVEL.painel, color: PRETO, fontFamily: INTER, overflow: "hidden" }}>

      {/* o título da aba para o leitor de tela (o visual é a medida) */}
      <h1 className="h10-so-leitor">Calculadora de facas</h1>
      {/* o que a conta diz agora, anunciado quando muda */}
      <div role="status" aria-live="polite" aria-atomic="true" className="h10-so-leitor">
        {mensagem ? mensagem.replace(/\n/g, " ") : resultado
          ? `Valor total: ${preco}. Porta clichê: já tem na fábrica.`
          : ""}
      </div>

      {/* A medida, em cima à esquerda: largura na c1, altura na c6. A frase
          de qual lado é qual saiu da página (Augusto, 29/09/2026: "não há
          necessidade desse texto"); fica só no title dos campos. */}
      <CampoMedida x={C1} nome="Largura" valor={largura} rotulo="largura da etiqueta em mm" titulo={dica}
        aoMudar={(v) => setLargura(soNumero(v))} auto campoRef={campoLargura} aoEnter={() => campoAltura.current?.focus()} />
      <CampoMedida x={C6} nome="Altura" valor={altura} rotulo="altura da etiqueta em mm" titulo={dica}
        aoMudar={(v) => setAltura(soNumero(v))} campoRef={campoAltura} />

      {/* o fechar do painel, vazado, terminando em c23 e centrado na linha 13 */}
      <button onClick={aoFechar} className="p10-flat" aria-label="Fechar a calculadora"
        style={{ position: "absolute", left: C23 - 46, top: linhaDaAba(13) - 23, boxSizing: "border-box", width: 46, height: 46, padding: 0, display: "grid", placeItems: "center",
          background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
      </button>

      {/* A coluna da direita, em cima: as configurações, cada uma com o nome
          (cinza) numa linha e o valor (Fraunces, que se escolhe) duas linhas
          abaixo. A faca fica uma linha mais abaixo que o ritmo das outras,
          como no desenho. */}
      {/* os títulos da coluna e o gabarito em Fraunces, no corpo dos
          valores, em cinza (Augusto, 29/09/2026) */}
      <span style={{ ...valorNaGrade(C18, 15, "C"), color: CINZA }}>Configurações</span>
      <span aria-hidden style={{ ...naGrade(C18, 18, PEQUENO, 400, "M"), color: CINZA }}>Máquina:</span>
      <div style={valorNaGrade(C18, 20, maquina.charAt(0))}>
        <ValorEscolha rotulo="Máquina" valor={maquina} aberto={menu === "maquina"} aoAbrir={() => alternar("maquina")}>
          <Opcoes lista={MAQUINAS} atual={maquina} aoEscolher={(v) => { setMaquina(v); setMenu(null); }} />
        </ValorEscolha>
      </div>
      <span aria-hidden style={{ ...naGrade(C18, 23, PEQUENO, 400, "E"), color: CINZA }}>Engrenagem:</span>
      <div style={valorNaGrade(C18, 25, nomePasso(passo).charAt(0))}>
        <ValorEscolha rotulo="Engrenagem" valor={nomePasso(passo)} aberto={menu === "passo"} aoAbrir={() => alternar("passo")}>
          <Opcoes lista={PASSOS.map(nomePasso)} atual={nomePasso(passo)}
            aoEscolher={(v) => { setPasso(PASSOS.find((p) => nomePasso(p) === v) ?? v); setMenu(null); }} />
        </ValorEscolha>
      </div>
      <span aria-hidden={!gap} style={{ ...naGrade(C18, 28, PEQUENO, 400, "P"), color: CINZA }}>Perda:</span>
      <div style={valorNaGrade(C18, 30, gap ? "N" : perdaMin.charAt(0) || "2")}>
        {gap ? <ValorEscolha rotulo="Perda" valor="Nenhuma" /> : (
          <ValorEscolha rotulo="Perda" valor={`${perdaMin} a ${perdaMax} mm`} aberto={menu === "perda"} aoAbrir={() => alternar("perda")}>
            <div style={{ ...MENU, width: 300, boxSizing: "border-box", padding: "14px 16px", gap: 12, letterSpacing: "normal" }}>
              {([["Mínima", perdaMin, setPerdaMin], ["Máxima", perdaMax, setPerdaMax]] as const).map(([rot, v, mudar]) => (
                <label key={rot} style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: INTER, fontSize: 13, fontWeight: 600, color: TINTA2 }}>
                  {rot}
                  <span className="calc10-caixa" style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", border: `1.5px dashed ${PRETO}`, borderRadius: 10 }}>
                    <input value={v} onChange={(e) => mudar(soNumero(e.target.value))} inputMode="decimal" aria-label={`Perda ${rot.toLowerCase()} em mm`}
                      style={{ flex: 1, width: 0, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: INTER, fontSize: 18, fontWeight: 600, color: PRETO }} />
                    <span style={{ fontSize: 14, color: TINTA2 }}>mm</span>
                  </span>
                </label>
              ))}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, fontFamily: INTER, fontSize: 14, fontWeight: 400, color: TINTA2, whiteSpace: "nowrap" }}>
                <span>Padrão da fábrica: {PERDA_MIN} a {PERDA_MAX} mm</span>
                {(perdaMin !== PERDA_MIN || perdaMax !== PERDA_MAX) && (
                  <button onClick={() => { setPerdaMin(PERDA_MIN); setPerdaMax(PERDA_MAX); }} className="p10-flat"
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 14, fontWeight: 600, color: PRETO, textDecoration: "underline", textUnderlineOffset: 3 }}>Voltar ao padrão</button>
                )}
              </div>
            </div>
          </ValorEscolha>
        )}
      </div>
      <span aria-hidden style={{ ...naGrade(C18, 34, PEQUENO, 400, "F"), color: CINZA }}>Faca:</span>
      <div style={valorNaGrade(C18, 36, gap ? "G" : "P")}>
        <ValorEscolha rotulo="Faca" valor={gap ? "Gap" : "Padrão"} aberto={menu === "tipo"} aoAbrir={() => alternar("tipo")}>
          <Opcoes lista={TIPOS} atual={gap ? TIPOS[1] : TIPOS[0]} aoEscolher={(v) => { setGap(v === TIPOS[1]); setMenu(null); }} />
        </ValorEscolha>
      </div>

      {/* A mesma coluna, embaixo: os resultados, um por linha, de três em
          três linhas da grade (a última na linha de base do valor), em mm
          sem a unidade, como no desenho ("Espaçamento vertical: 2,73 mm"
          passava da c23). Na faca de gap não há perda na volta: no lugar
          dela, a altura que a conta ajustou para fechar o cilindro. Ficam
          sempre à vista (Augusto, 29/09/2026: "deixe as especificações
          visíveis sempre"): sem conta, o valor é um "—" fantasma. */}
      <span style={{ ...valorNaGrade(C18, ROTULO_BAIXO, "R"), color: CINZA }}>Resultados:</span>
      <Par x={C18} k={BASE_VALOR - 12} nome="Cilindro" valor={resultado ? `Z${g!.Z}` : nada} />
      <Par x={C18} k={BASE_VALOR - 9} nome="Repetições" valor={resultado ? g!.rep : nada} />
      <Par x={C18} k={BASE_VALOR - 6} nome="Carreiras" valor={resultado ? g!.carr : nada} />
      {gap
        ? <Par x={C18} k={BASE_VALOR - 3} nome="Altura ajustada" valor={resultado ? fmt(g!.X) : nada} />
        : <Par x={C18} k={BASE_VALOR - 3} nome="Espaçamento vertical" valor={resultado ? curto(g!.espV) : nada} />}
      {/* na faca de gap, "0" (o "nenhum" passava da c23) */}
      <Par x={C18} k={BASE_VALOR} nome="Espaçamento horizontal" valor={resultado ? curto(g!.espH) : nada} />
      {/* o gabarito no cinza dos rótulos (Augusto, 29/09/2026); sem conta, fantasma e sem clique */}
      {podeGabarito && (
        <button onClick={baixarGabarito} disabled={!resultado} className="p10-flat" aria-label="Baixar o gabarito" title="Desenho 1:1 em mm, para o ferramental"
          style={{ ...valorNaGrade(C18, QUEBRA, "G"), background: "none", border: "none", padding: 0, cursor: resultado ? "pointer" : "default", color: resultado ? CINZA : FANTASMA }}>Gabarito</button>
      )}

      {/* O valor, embaixo, na c1: o rótulo na 42, a maiúscula da 45 à 57 e a
          quebra na 62. */}
      {mensagem ? (
        /* No lugar do valor, o que a conta diz, com a última linha de base
           na do valor. Com detalhe, ele fica embaixo, com a última base na
           62, e o título senta quatro linhas acima da 1ª linha dele. Vai até
           a c18: a coluna dos resultados fica sempre à vista. */
        <div style={{ position: "absolute", left: C1, width: LIMITE_VALOR - C1,
          bottom: ALTURA_DA_ABA - (detalhe ? linhaDaAba(QUEBRA) + L2 - baseInter(PEQUENO, L2) : linhaDaAba(BASE_VALOR) + L5 - baseFraunces(FRASE, L5) - ACERTO_FRASE),
          display: "flex", flexDirection: "column", gap: detalhe ? 4 * LINHA_DA_GRADE - (L5 - baseFraunces(FRASE, L5) - ACERTO_FRASE) - baseInter(PEQUENO, L2) : 0 }}>
          {/* uma linha por frase, cada uma com a folga da sua 1ª letra (o "N"
              de "Na Force 250" começava 2 px depois do "A" de cima). Frase que
              não cabe até a c18 quebra equilibrada: a nota da conta antiga
              ("Nenhum cilindro fecha com altura de 300,00 mm.") deixava o
              "mm." sozinho na linha de baixo. */}
          <div style={{ ...FR400, fontSize: FRASE, lineHeight: `${L5}px`, color: PRETO }}>
            {titulo.split("\n").map((frase, i) => (
              <div key={i} style={{ marginLeft: -(folgaFraunces(400, FRASE, frase.charAt(0)) + FOLGA_FRASE), textWrap: "balance" }}>{frase}</div>
            ))}
          </div>
          {detalhe && (
            <div style={{ marginLeft: -folgaInter(400, PEQUENO, detalhe.charAt(0)), fontFamily: INTER, fontSize: PEQUENO, lineHeight: `${L2}px`, letterSpacing: JUSTO, color: TINTA2, textWrap: "balance" }}>{detalhe}</div>
          )}
        </div>
      ) : null}
      {/* sem o porta-clichê na fábrica, a altura que encaixa vira um clique:
          na linha da quebra (vazia enquanto não há valor), na c1 */}
      {mensagem && semPortaCliche && sugestao && (
        <button onClick={() => setAltura(sugestao.altura)} className="p10-flat"
          style={{ ...naGrade(C1, QUEBRA, PEQUENO, 400, "U"), background: "none", border: "none", padding: 0, cursor: "pointer", color: PRETO, textDecoration: "underline", textUnderlineOffset: 4 }}>
          Usar {sugestao.altura} mm de altura
        </button>
      )}
      {mensagem ? null : (
        <>
          <span aria-hidden style={{ ...naGrade(C1, ROTULO_BAIXO, PEQUENO, 400, "V"), color: CINZA }}>Valor total:</span>
          <div ref={valorRef} aria-hidden style={{ ...noFraunces(C1, BASE_VALOR, PRECO, "R", FOLGA_PRECO, ACERTO_PRECO), letterSpacing: `calc(${JUSTO_VALOR} + ${aperto}px)`, color: resultado ? PRETO : FANTASMA }}>
            {textoValor}
          </div>
          {resultado && (
            <>
              {precoFaca && precoFaca !== "—"
                ? <Par x={C1} k={QUEBRA} nome="Faca" valor={precoFaca} un="un." />
                : <Par x={C1} k={QUEBRA} nome="Faca" valor="—" />}
              {precoEngr
                ? <Par x={C6} k={QUEBRA} nome="Engrenagem" valor={precoEngr} un="un." />
                : <Par x={C6} k={QUEBRA} nome="Engrenagem" valor="—" />}
              {/* a casa do cilindro (o porta-clichê), na c12 como no desenho */}
              {/* sem o porta-clichê na fábrica não há valor (o aviso toma o
                  lugar dele), então aqui ele sempre já tem */}
              <Par x={C12} k={QUEBRA} nome="Porta clichê" valor="já tem na fábrica" />
            </>
          )}
        </>
      )}
    </div>
  );
}
