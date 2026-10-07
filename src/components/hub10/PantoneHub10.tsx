// Tabela Pantone — Hub 1.0. Abre de dentro do "Design criado" e do "Clichê
// chegou", pelo botão redondo ao lado de cada cor.
//
// A do V1a funcionava, mas punha CMYK e Lab dentro de cada célula: 240 células
// com quatro informações cada é uma parede de texto para uma escolha que se
// faz pelo olho. Aqui a célula tem a cor e o código; o CMYK aparece na barra
// de baixo, da cor escolhida, que é quando ele serve para alguma coisa.
//
// As famílias ficaram — são o caminho de quem procura "um vermelho" sem ter o
// código — numa linha só que rola para o lado, com um traço separando o
// recorte de origem (todas / processo) das oito famílias de cor.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { criarBusca } from "@/lib/busca";
import { LIMITE_DO_NOME, de2000, matizDoLab, noMatiz, nomeDaBusca, tipoDoCodigo, type NomeDeCor } from "@/lib/nomes-de-cor";
import { tabelaViva, type ExtrasPantone } from "../v1a/dados/pantone-vivo";
import { cmykDeHex, prefixoPantone } from "../v1a/dados/pantone-busca";
/* A família vem da régua única (OKLab) — a cópia que morava aqui cortava pelo
   ângulo do Lab e punha o 286 C em "Rosas e roxos". */
import { familiaDe } from "../v1a/dados/familia-cor";
import { FR, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { PALETA } from "@/lib/paleta-hub";

const MONO = "ui-monospace, Menlo, monospace";
const AMARELO = PALETA.amareloForte;
const CINZA = "#8a8a8a";
const BORDA_CAMPO = "#d9d8d6";

const PROCESSO = [
  { codigo: "Ciano", hex: "#009FE3", cmyk: "100/0/0/0" },
  { codigo: "Magenta", hex: "#E5007E", cmyk: "0/100/0/0" },
  { codigo: "Amarelo", hex: "#FFED00", cmyk: "0/0/100/0" },
  { codigo: "Preto", hex: "#1D1D1B", cmyk: "0/0/0/100" },
  /* tintas especiais: vão na máquina como tinta própria, igual a um Pantone */
  { codigo: "Dourado", hex: "#C6A15B", cmyk: "—" },
  { codigo: "Branco", hex: "#FFFFFF", cmyk: "—" },
];

/* A amostra de cada família é uma cor de verdade daquele grupo — serve de
   legenda sem precisar de mais uma linha de texto. */
const FAMILIAS_COR = [
  { k: "amarelo", label: "Amarelos", cor: "#FFD400" },
  { k: "laranja", label: "Laranjas", cor: "#F07800" },
  { k: "vermelho", label: "Vermelhos", cor: "#D7271B" },
  { k: "rosa", label: "Rosas e roxos", cor: "#C6168D" },
  { k: "azul", label: "Azuis", cor: "#00306D" },
  { k: "verde", label: "Verdes", cor: "#00874E" },
  { k: "marrom", label: "Marrons", cor: "#7B5228" },
  { k: "neutro", label: "Neutros", cor: "#A6A6A6" },
];

const LIMITE = 240;

type Lab = readonly [number, number, number];
type Cor = { nome: string; codigo: string; hex: string; cmyk: string; familia: string; lab3: Lab | null };

/* Busca por nome de cor, a mesma da tela Pantones.
   A caixa só procurava código, hex e CMYK, e respondia "nenhuma" para
   "rosa choque" ou "azul bic", que a tela Pantones acha (simulação 5,
   05/10/2026). A conta dos nomes mora aqui e as duas usam a mesma: nome
   de referência traz as mais parecidas, nome de faixa traz a família. */
type NomeDeReferencia = Extract<NomeDeCor, { tipo: "ancora" }>;
type NomeDeFaixa = Extract<NomeDeCor, { tipo: "faixa" }>;

/** Os Pantones mais parecidos com as referências de um nome de cor ("rosa
    choque", "azul bic"), do mais perto ao mais longe: ΔE2000 no Lab do
    livro, até o raio do nome e no máximo LIMITE_DO_NOME. Metálico só nos
    nomes de metal (o Lab dele cai perto das chapadas e enchia as listas);
    nome de metal ou de neon mostra só os dele. `codigo` e `lab` dizem onde
    cada tabela guarda o código e o Lab; empate fica na ordem da tabela. */
export function parecidasComNome<T>(nome: NomeDeReferencia, tabela: readonly T[], codigo: (c: T) => string, lab: (c: T) => Lab | null): { cor: T; d: number; ref: string }[] {
  const porCodigo = new Map(tabela.map((c) => [codigo(c).toUpperCase(), c] as const));
  const refs = nome.refs.map((r) => porCodigo.get(r.toUpperCase())).filter((c): c is T => c !== undefined && lab(c) !== null);
  const perto: { cor: T; d: number; ref: string; i: number }[] = [];
  tabela.forEach((c, i) => {
    const l = lab(c);
    if (!l) return;
    const t = tipoDoCodigo(codigo(c));
    if (nome.somente === "metalicos" ? t !== "metalico" : nome.somente === "neons" ? t !== "neon" : t === "metalico") return;
    let d = Infinity, ref = "";
    for (const r of refs) { const x = de2000(lab(r)!, l); if (x < d) { d = x; ref = codigo(r); } }
    if (d <= nome.raio) perto.push({ cor: c, d, ref, i });
  });
  perto.sort((a, b) => a.d - b.d || a.i - b.i);
  return perto.slice(0, LIMITE_DO_NOME).map(({ cor, d, ref }) => ({ cor, d, ref }));
}

/** A cor cabe na faixa de um nome de cor ("azul claro", "verde")? A família
    do nome e, quando o termo pede, claridade, saturação e matiz (roxo e
    rosa moram na mesma família, o matiz separa). */
export function naFaixaDoNome(nome: NomeDeFaixa, familia: string, lab: Lab | null): boolean {
  if (nome.familias.length && !nome.familias.includes(familia)) return false;
  if (nome.L && (!lab || lab[0] < nome.L[0] || lab[0] > nome.L[1])) return false;
  if (nome.croma) {
    const croma = lab ? Math.round(Math.hypot(lab[1], lab[2])) : 0;
    if (croma < nome.croma[0] || croma > nome.croma[1]) return false;
  }
  if (nome.matiz && (!lab || !noMatiz(matizDoLab(lab[1], lab[2]), nome.matiz))) return false;
  return true;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/** "P 185", "Pantone 485" → o código como a tabela escreve (o mesmo da tela Pantones). */
const limparCodigo = (q: string) => q.replace(/^\s*p(antone)?\s*(?=\d)/i, "").replace(/^\s*p(antone)?\s+/i, "").trim();

/** A busca por nome de cor pronta para a lista da Solicitação (etapa 3, "Ver
    paleta de cores"), que respondia "Nenhum Pantone encontrado" para "rosa
    choque" (simulação 5, 05/10/2026). A mesma conta da tela Pantones e desta
    caixa, na tabela embutida (a da lista da Solicitação). Devolve null quando
    a consulta não é nome de cor, ou é um código exato (código vence nome);
    nome de referência traz as mais parecidas, nome de faixa traz a família
    das mais claras às mais escuras. */
export function pantonesPeloNome(consulta: string): { c: string; h: string }[] | null {
  const q = consulta.trim();
  if (!q) return null;
  const tabela = tabelaViva(null);
  const k = limparCodigo(q).toUpperCase();
  if (tabela.some((c) => c.c.toUpperCase() === k || c.c.toUpperCase() === `${k} C`)) return null;
  const nome = nomeDaBusca(q);
  if (!nome) return null;
  if (nome.tipo === "ancora") return parecidasComNome(nome, tabela, (c) => c.c, (c) => c.l as Lab).map(({ cor }) => ({ c: cor.c, h: cor.h }));
  const faixa = nome;
  const croma = (l: Lab) => Math.round(Math.hypot(l[1], l[2]));
  return tabela.filter((c) => naFaixaDoNome(faixa, familiaDe(c.l), c.l as Lab))
    .sort((a, b) => (b.l as Lab)[0] - (a.l as Lab)[0] || croma(b.l as Lab) - croma(a.l as Lab))
    .map((c) => ({ c: c.c, h: c.h }));
}

const PILULA = (ligada: boolean): CSSProperties => ({
  flex: "none",
  display: "inline-flex", alignItems: "center", gap: 8, height: 38, padding: "0 16px",
  border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer",
  background: ligada ? PRETO : "#fff", color: ligada ? "#fff" : PRETO,
  font: `700 14px/1 ${INTER}`, whiteSpace: "nowrap",
});

export function PantoneHub10({ valor, fechar, onEscolher }: {
  valor?: string;
  fechar: () => void;
  onEscolher: (nome: string, hex: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [familia, setFamilia] = useState("todas");
  const [selCod, setSelCod] = useState<string | null>(null);

  /* A mesma tabela da tela Pantones: a embutida com as cores e os valores que
     o administrador atualizou pelo livro novo. Se a leitura falhar, fica a
     embutida, que é a tabela certa até a última publicação. */
  const [extras, setExtras] = useState<ExtrasPantone | null>(null);
  useEffect(() => {
    let vivo = true;
    void import("@/lib/api/pantone.functions")
      .then((m) => m.listPantoneExtras())
      .then((r) => { if (vivo) setExtras(r as ExtrasPantone); })
      .catch(() => { /* sem extras: a tabela embutida */ });
    return () => { vivo = false; };
  }, []);
  const todas: Cor[] = useMemo(() => {
    const proc: Cor[] = PROCESSO.map((c) => ({
      nome: c.codigo, codigo: c.codigo, hex: c.hex, cmyk: c.cmyk, familia: "processo", lab3: null,
    }));
    return proc.concat(tabelaViva(extras).map((c) => ({
      nome: prefixoPantone(c.c),
      codigo: c.c,
      hex: c.h.toUpperCase(),
      cmyk: cmykDeHex(c.h),
      familia: familiaDe(c.l),
      /* o Lab do livro, para a busca por nome de cor */
      lab3: c.l as Lab,
    })));
  }, [extras]);
  const porCodigo = useMemo(() => new Map(todas.map((c) => [c.codigo.toUpperCase(), c])), [todas]);

  /* A busca: código, hex e CMYK, ou nome de cor (simulação 5, 05/10/2026). */
  const q = busca.trim();
  /* Código exato vence nome de cor: "Pink C" e "Warm Red" são códigos, como na tela Pantones */
  const exato = useMemo(() => {
    if (!q) return null;
    const k = limparCodigo(q).toUpperCase();
    const c = porCodigo.get(k) ?? porCodigo.get(`${k} C`);
    return c && c.familia !== "processo" ? c : null;
  }, [q, porCodigo]);
  const nomeBusca = useMemo(() => (q && !exato ? nomeDaBusca(q) : null), [q, exato]);
  /* o nome como a pessoa escreveu, quando é o mesmo termo; senão o termo que a busca entendeu */
  const termo = !nomeBusca ? "" : semAcento(q).replace(/[^a-z0-9]+/g, " ").trim() === nomeBusca.termo ? q : nomeBusca.termo;
  const { achados, parecidas } = useMemo((): { achados: Cor[]; parecidas: number | null } => {
    const naFamilia = (c: Cor) => familia === "todas" || c.familia === familia;
    if (!nomeBusca) {
      const casa = criarBusca(q);
      return { achados: todas.filter((c) => naFamilia(c) && casa(c.codigo, c.hex, c.cmyk)), parecidas: null };
    }
    /* "dourado", "preto": a tinta de processo ou especial com esse nome vem primeiro, junto com as do livro */
    const proc = todas.find((c) => c.familia === "processo" && semAcento(c.codigo) === semAcento(q));
    if (nomeBusca.tipo === "ancora") {
      /* as mais parecidas com as referências, da mais perto à mais longe */
      const lista = parecidasComNome(nomeBusca, todas, (c) => c.codigo, (c) => c.lab3).map((x) => x.cor).filter(naFamilia);
      return { achados: proc && naFamilia(proc) ? [proc, ...lista] : lista, parecidas: lista.length };
    }
    /* nome de faixa: a família do nome, das mais claras às mais escuras (a ordem de abertura da tela Pantones) */
    const faixa = nomeBusca;
    const croma = (c: Cor) => (c.lab3 ? Math.round(Math.hypot(c.lab3[1], c.lab3[2])) : 0);
    const lista = todas.filter((c) => c.familia !== "processo" && naFamilia(c) && naFaixaDoNome(faixa, c.familia, c.lab3))
      .sort((a, b) => (b.lab3?.[0] ?? 0) - (a.lab3?.[0] ?? 0) || croma(b) - croma(a));
    return { achados: proc && naFamilia(proc) ? [proc, ...lista] : lista, parecidas: null };
  }, [todas, q, nomeBusca, familia]);
  const vis = achados.slice(0, LIMITE);
  const procNaFrente = achados[0]?.familia === "processo" && !!nomeBusca ? achados[0] : null;

  const sel = (selCod ? todas.find((c) => c.codigo === selCod) : null)
    ?? (valor ? todas.find((c) => c.nome === valor || c.codigo === valor) : null)
    ?? null;
  const pode = !!sel;

  /* A tabela é a camada mais alta: ESC fecha ela e só ela. */
  useEscDoTopo(true, NIVEL.pantone, fechar);

  const usar = () => { if (sel) onEscolher(sel.nome, sel.hex); };

  /* A fila de filtros é uma linha só e rola para o lado: dez pílulas não cabem
     nos 988px úteis, e quebrar em duas alturas empurrava a tabela para baixo.
     A rodinha do mouse anda nela igual à trilha de cards — sem isso, quem não
     tem trackpad não chega nos "Neutros". As setinhas de sombra nas pontas são
     o que avisa que ainda há filtro fora da vista. */
  const fila = useRef<HTMLDivElement | null>(null);
  const [pontas, setPontas] = useState({ esq: false, dir: false });
  const medirPontas = useCallback(() => {
    const el = fila.current;
    if (!el) return;
    const sobra = el.scrollWidth - el.clientWidth;
    setPontas({ esq: el.scrollLeft > 2, dir: sobra > 2 && el.scrollLeft < sobra - 2 });
  }, []);
  useEffect(() => {
    const el = fila.current;
    if (!el) return;
    medirPontas();
    const aoRodar = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: "auto" });
    };
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  }, [medirPontas]);

  /* Esta tabela abre DENTRO de outras caixas, e todas fecham no clique do
     fundo. Dois cuidados herdados da versão V1a, que custaram caro:
     · z-index 76 fica acima de todos os pais (60 / 64 / 68) — o ESC global
       fecha o overlay de maior z, e com 66 ele mirava no pai;
     · o clique no fundo PARA aqui (stopPropagation) — sem isso subia até o
       fundo do pai e fechava os dois, perdendo cores, recado e anexos. */
  return (
    <div onClick={(e) => { e.stopPropagation(); fechar(); }}
      style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 76, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(37,36,37,.78)" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ boxSizing: "border-box", width: 1060, height: 700, display: "flex", flexDirection: "column", background: "#fff", border: `1.5px solid ${PRETO}`, borderRadius: 22, overflow: "hidden", boxShadow: "0 50px 110px -28px rgba(0,0,0,.62)", fontFamily: INTER, color: PRETO }}>

        {/* ————— cabeçalho ————— */}
        <div style={{ flex: "none", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, padding: "26px 36px 20px" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: `700 13px/1.2 ${MONO}`, letterSpacing: ".16em", textTransform: "uppercase", color: CINZA }}>Pantone Solid Coated 2024 · color book oficial</div>
            <div style={{ ...FR, fontVariationSettings: "'SOFT' 100, 'opsz' 96", fontSize: 44, lineHeight: 1, letterSpacing: "-.035em", marginTop: 10 }}>Escolher cor</div>
          </div>
          {/* Busca e contagem são um bloco só. A contagem é o RESULTADO do que
              se digitou ali em cima; ela vivia na fila de filtros, longe do
              campo que a provoca. O recuo de 58px (botão 46 + vão 12) faz ela
              terminar na mesma vertical que o campo, e não no × ao lado. */}
          <div style={{ flex: "none", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, width: 300, height: 46, boxSizing: "border-box", padding: "0 16px", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "text" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={CINZA} strokeWidth={2.2} strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código ou nome, ex.: 485" aria-label="Buscar cor"
                  style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "none", font: `600 16px/1 ${INTER}`, color: PRETO }} />
              </label>
              <button onClick={fechar} className="p10-flat" aria-label="Fechar"
                style={{ width: 46, height: 46, display: "grid", placeItems: "center", background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            </div>
            <span style={{ paddingRight: 58, font: `600 13px/1 ${INTER}`, color: CINZA, whiteSpace: "nowrap" }}>
              {achados.length > LIMITE
                ? `${LIMITE} de ${achados.length} cores. Refine a busca`
                : parecidas
                  /* nome de referência: a ordem é a da semelhança, como na tela Pantones */
                  ? `${procNaFrente ? `${procNaFrente.codigo} + ` : ""}${parecidas === 1 ? "1 cor parecida" : `as ${parecidas} mais parecidas`} com “${termo}”`
                  : `${achados.length} ${achados.length === 1 ? "cor" : "cores"}`}
            </span>
          </div>
        </div>

        {/* ————— filtros: uma linha só, que rola ————— */}
        <div style={{ position: "relative", flex: "none", padding: "0 36px 16px" }}>
          <div ref={fila} className="h10-rolo-x" onScroll={medirPontas}
            style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", overflowY: "hidden" }}>
            <button onClick={() => setFamilia("todas")} className="p10-flat" style={PILULA(familia === "todas")}>Todas as cores</button>
            <button onClick={() => setFamilia("processo")} className="p10-flat" style={PILULA(familia === "processo")}>Processo e especiais</button>
            {/* O traço separa o recorte de ORIGEM (todas / processo) das oito
                famílias de cor — a hierarquia que as duas alturas davam, agora
                dentro da mesma linha. */}
            <span aria-hidden style={{ flex: "none", width: 1, height: 22, margin: "0 6px", background: "rgba(37,36,37,.22)" }} />
            {FAMILIAS_COR.map((f) => (
              <button key={f.k} onClick={() => setFamilia(f.k)} className="p10-flat" style={PILULA(familia === f.k)}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: f.cor, boxShadow: `inset 0 0 0 1px rgba(0,0,0,.25)`, flex: "none" }} />
                {f.label}
              </button>
            ))}
          </div>
          {pontas.esq && <div aria-hidden style={{ position: "absolute", left: 36, top: 0, bottom: 16, width: 34, pointerEvents: "none", background: "linear-gradient(to right, #fff, rgba(255,255,255,0))" }} />}
          {pontas.dir && <div aria-hidden style={{ position: "absolute", right: 36, top: 0, bottom: 16, width: 34, pointerEvents: "none", background: "linear-gradient(to left, #fff, rgba(255,255,255,0))" }} />}
        </div>

        {/* ————— a tabela ————— */}
        <div className="p10-trilha" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 36px 20px", borderTop: `1px solid rgba(37,36,37,.12)` }}>
          {vis.length === 0 ? (
            <div style={{ padding: "40px 0", font: `600 17px/1.5 ${INTER}`, color: CINZA }}>
              {nomeBusca?.tipo === "ancora" ? `Nenhuma cor perto de “${termo}”. Procure pelo código ou tente outro nome.`
                : nomeBusca ? `Nenhuma cor nessa faixa de “${termo}”. Procure pelo código ou tente outro nome.`
                  : "Nenhuma cor com esse código. Se ela não está no color book, feche esta tabela e escreva o nome na linha da cor."}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 10, paddingTop: 16 }}>
              {vis.map((c) => {
                const escolhida = sel?.codigo === c.codigo;
                return (
                  <button key={c.codigo} onClick={() => setSelCod(c.codigo)} className="p10-flat"
                    title={`${c.nome} · CMYK ${c.cmyk}`}
                    style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0, border: `1.5px solid ${escolhida ? PRETO : "transparent"}`, borderRadius: 12, background: "none", cursor: "pointer", overflow: "hidden", textAlign: "left" }}>
                    <span style={{ height: 58, background: c.hex, borderRadius: escolhida ? "9px 9px 0 0" : 9, boxShadow: `inset 0 0 0 1px rgba(37,36,37,.16)` }} />
                    <span style={{ padding: "6px 4px 7px", font: `700 13px/1 ${INTER}`, color: PRETO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.codigo}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ————— rodapé: a escolhida e a saída manual ————— */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 18, padding: "16px 24px", background: PRETO }}>
          <span style={{ flex: "none", width: 42, height: 42, borderRadius: 11, background: sel?.hex ?? "#4a484a", boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.35)" }} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: `800 11.5px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: "#8f8d8f" }}>Selecionada</div>
            <div style={{ marginTop: 6, font: `600 18px/1.2 ${INTER}`, color: "#f1f1f1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {sel ? `${sel.nome} · CMYK ${sel.cmyk}` : "Escolha uma cor acima"}
            </div>
          </div>
          {/* Sem campo de texto aqui: quem precisa de "verniz" ou "branco de
              cobertura" escreve direto na linha da cor, que é de onde este
              botão redondo abriu. Dois campos de digitar, um em cima buscando
              e outro embaixo criando, era pedir para errar de campo. */}
          <button onClick={usar} disabled={!pode}
            style={{ flex: "none", border: `1.5px solid ${pode ? PRETO : "#4a484a"}`, borderRadius: 999, padding: "13px 26px", cursor: pode ? "pointer" : "not-allowed", font: `800 16px/1 ${INTER}`, whiteSpace: "nowrap", background: pode ? AMARELO : "#4a484a", color: pode ? PRETO : CINZA }}>
            Usar esta cor
          </button>
        </div>
      </div>
    </div>
  );
}
