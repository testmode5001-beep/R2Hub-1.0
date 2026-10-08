// Calculadora de substrato (Hub 1.0, por dentro): a metragem da bobina.
//
// A aba do card "Substrato" das Calculadoras, no molde da de facas: as peças e
// a grade são as de lá (CalculadoraFacasHub10), como nas de clichê e
// distorção. O card juntava três contas da tela antiga (a metragem da bobina,
// a largura do substrato e o consumo de tinta) e o molde é de uma conta só; a
// aba faz a que o card promete, "Qual metragem a matéria-prima tem" (Augusto,
// 06/10/2026: "Metragem da bobina").
//
//   - em cima à esquerda, as duas medidas do rolo que mudam a cada bobina: o
//     Ø externo na c1 e a espessura do material na c6;
//   - a coluna da direita, na c18: "Configurações" (o tubete, com o padrão da
//     conta antiga, e a largura da bobina, que só serve para a área) e
//     "Resultados:" (voltas, parede do rolo e área);
//   - a metragem enorme na c1 e, na 62, o que a calculadora antiga já pedia:
//     conferir na pesagem.
//
// A conta é a da calculadora antiga (`calcular("bobinas")`): nenhuma fórmula
// nova mora aqui.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { PADROES, calcular } from "../v1a/CalculadorasV1a";
import { FUNDO, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { baseFraunces, folgaFraunces } from "./grade-hub10";
import {
  ACERTO_FRASE, ACERTO_PRECO, ALTURA_DA_ABA, BASE_VALOR, C1, C18, C23, C6, CINZA, CampoMedida, FANTASMA,
  FOLGA_FRASE, FOLGA_PRECO, FR400, FRASE, JUSTO_VALOR, L5, LIMITE_VALOR, PEQUENO, PRECO, Par, QUEBRA,
  ROTULO_BAIXO, ValorEscolha, curto, linhaDaAba, naGrade, noFraunces, num, soNumero, valorNaGrade,
} from "./CalculadoraFacasHub10";
import { MenuNumero } from "./CalculadoraClicheHub10";

const PADRAO = PADROES.bobinas;
/* A espessura do material vem em milésimos de mm (0,075 é comum): o campo das
   medidas aceita duas casas e cortaria a terceira (0,07, 7% a menos de
   espessura, 7% a mais de metros). Aqui, três. */
const soEspessura = (v: string) => {
  const limpo = v.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [inteiro, ...resto] = limpo.split(",");
  return resto.length ? inteiro.slice(0, 2) + "," + resto.join("").slice(0, 3) : inteiro.slice(0, 2);
};
/** "599,42 m²" → "599,42" */
const semUnidade = (s: string) => s.replace(/\s*(mm|m²)$/, "");
/** "1.234,50 mm" → 1234,5 */
const numDe = (s: string) => num(s.replace(/[^\d,.-]/g, "").replace(/\./g, ""));

/** A aba da calculadora de substrato: a página inteira abaixo da barra. */
export function CalculadoraSubstratoHub10({ aoFechar }: { aoFechar: () => void }) {
  const [externo, setExterno] = useState("");
  const [espessura, setEspessura] = useState("");
  const [tubete, setTubete] = useState(PADRAO.int);
  /* a largura só entra na área: começa vazia, sem área inventada */
  const [largura, setLargura] = useState("");
  const [menu, setMenu] = useState<null | "tubete" | "largura">(null);
  const campoExterno = useRef<HTMLInputElement | null>(null);
  const campoEspessura = useRef<HTMLInputElement | null>(null);
  /* a folga da primeira letra só se mede com a fonte carregada */
  const [fontes, setFontes] = useState(0);
  useEffect(() => { void document.fonts?.ready.then(() => setFontes((n) => n + 1)); }, []);

  /* ESC: primeiro o menu, depois a aba */
  const fecharMenu = useCallback(() => setMenu(null), []);
  useEscDoTopo(!!menu, NIVEL.verTodos, fecharMenu);
  useEscDoTopo(true, NIVEL.painel, aoFechar);
  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("[data-pop]")) return;
      setMenu(null);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, []);
  const alternar = (m: NonNullable<typeof menu>) => setMenu(menu === m ? null : m);

  /* Que campo está com o foco: o erro de um número só aparece quando a pessoa
     sai do campo. Trocar o Ø de 500 para 600 passa por 6 e 60 (menores que o
     tubete) e a frase de erro piscava a cada rolo medido (revisão de design,
     06/10/2026). Enquanto digita, fica o fantasma, nunca um valor errado. */
  const [emFoco, setEmFoco] = useState<null | "externo" | "espessura">("externo");
  useEffect(() => {
    const pares = [["externo", campoExterno.current], ["espessura", campoEspessura.current]] as const;
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

  const completa = num(externo) > 0 && num(espessura) > 0;
  /* Espessura acima de 1 mm não existe em etiqueta: é quase sempre o número
     em micra (80 em vez de 0,080), e a conta daria mil vezes menos metros,
     calada. */
  const espessuraDemais = num(espessura) > 1;
  /* Tubete apagado: a conta antiga faria o rolo maciço, sem dizer; aqui não
     calcula e diz o que falta. */
  const faltaTubete = !(num(tubete) > 0);
  const res = useMemo(() => (completa && !faltaTubete && !espessuraDemais
    ? calcular("bobinas", { ...PADRAO, ext: externo, int: tubete, esp: espessura, larg: largura })
    : null), [completa, faltaTubete, espessuraDemais, externo, tubete, espessura, largura]);
  const linhaDe = (rotulo: string) => res?.linhas.find((l) => l.label === rotulo)?.valor ?? "";
  /* Ø menor que o tubete: a conta devolve "—" */
  const menorQueTubete = !!res && res.destaque.valor === "—";
  const resultado = !!res && !menorQueTubete;
  const metros = resultado ? `${res!.destaque.valor} m` : "";
  const temArea = resultado && num(largura) > 0;

  /* Zero digitado no Ø ou na espessura: a conta não roda e ficava o
     fantasma, sem dizer por quê (simulação 6, 07/10/2026). Como os outros
     erros de número, só depois de sair do campo. */
  const externoZero = externo !== "" && !(num(externo) > 0) && emFoco !== "externo";
  const espessuraZero = espessura !== "" && !(num(espessura) > 0) && emFoco !== "espessura";
  const mensagem = externoZero && espessuraZero ? "O Ø externo e a espessura precisam ser maiores que zero."
    : externoZero ? "O Ø externo precisa ser maior que zero.\nMeça o diâmetro de fora do rolo, em mm."
    : espessuraZero ? "A espessura precisa ser maior que zero.\nDigite em milímetros, por exemplo 0,080."
    : !completa ? "" : faltaTubete
    ? "Falta o tubete.\nConfira nas configurações."
    : espessuraDemais ? (emFoco === "espessura" ? "" : "A espessura passa de 1 mm.\nDigite em milímetros, por exemplo 0,080.")
    : menorQueTubete ? (emFoco === "externo" ? "" : `O Ø externo precisa ser maior que o tubete.\nO tubete está em ${tubete} mm, nas configurações.`)
    : "";
  /* para o leitor de tela, por extenso: ele leria o Ø e o "m" como letras */
  const porExtenso = (s: string) => s.replace(/Ø/g, "diâmetro");

  /* o valor para meia coluna antes da c18; só aperta as letras se passar */
  const textoValor = resultado ? metros : "0.000,00 m";
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

  const nada = <span style={{ color: FANTASMA }}>—</span>;
  /* três resultados de seis em seis linhas: o 1º na linha da maiúscula do
     valor (45) e o último na base dele (57), como nas outras abas */
  const R = (i: number) => BASE_VALOR - 12 + 6 * i;

  return (
    <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: ALTURA_DA_ABA, background: FUNDO, zIndex: NIVEL.painel, color: PRETO, fontFamily: INTER, overflow: "hidden" }}>

      <h1 className="h10-so-leitor">Calculadora de substrato: metragem da bobina</h1>
      <div role="status" aria-live="polite" aria-atomic="true" className="h10-so-leitor">
        {mensagem ? porExtenso(mensagem.replace(/\n/g, " ")) : resultado ? `Metragem estimada: ${res!.destaque.valor} metros. ${linhaDe("Voltas")} voltas.` : ""}
      </div>

      {/* o que se digita: o Ø externo do rolo e a espessura do material */}
      <CampoMedida x={C1} nome="Ø externo" valor={externo} rotulo="diâmetro externo do rolo em mm" titulo="O diâmetro de fora do rolo, em mm."
        aoMudar={(v) => setExterno(soNumero(v))} auto campoRef={campoExterno} aoEnter={() => campoEspessura.current?.focus()} />
      <CampoMedida x={C6} nome="Espessura" valor={espessura} rotulo="espessura do material em mm"
        titulo="A espessura do material, em mm (por exemplo, 0,080)."
        aoMudar={(v) => setEspessura(soEspessura(v))} campoRef={campoEspessura} />

      {/* o fechar do painel, vazado, terminando em c23 e centrado na linha 13 */}
      <button onClick={aoFechar} className="p10-flat" aria-label="Fechar a calculadora"
        style={{ position: "absolute", left: C23 - 46, top: linhaDaAba(13) - 23, boxSizing: "border-box", width: 46, height: 46, padding: 0, display: "grid", placeItems: "center",
          background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
      </button>

      {/* as configurações, nas duas primeiras linhas das da aba de facas */}
      <span style={{ ...valorNaGrade(C18, 15, "C"), color: CINZA }}>Configurações</span>
      <span aria-hidden style={{ ...naGrade(C18, 18, PEQUENO, 400, "T"), color: CINZA }}>Tubete:</span>
      <div style={valorNaGrade(C18, 20, tubete.charAt(0) || "—")}>
        <ValorEscolha rotulo="Tubete" valor={faltaTubete ? "—" : `${tubete} mm`} aberto={menu === "tubete"} aoAbrir={() => alternar("tubete")}>
          <MenuNumero rotulo="Diâmetro do tubete" valor={tubete} padrao={PADRAO.int} unidade="mm"
            dica="O diâmetro do tubete, no meio do rolo."
            aoMudar={(v) => setTubete(soNumero(v))} aoFechar={fecharMenu} />
        </ValorEscolha>
      </div>
      <span aria-hidden style={{ ...naGrade(C18, 23, PEQUENO, 400, "L"), color: CINZA }}>Largura da bobina:</span>
      <div style={valorNaGrade(C18, 25, largura.charAt(0) || "—")}>
        <ValorEscolha rotulo="Largura da bobina" valor={num(largura) > 0 ? `${largura} mm` : "—"} aberto={menu === "largura"} aoAbrir={() => alternar("largura")}>
          <MenuNumero rotulo="Largura da bobina" valor={largura} unidade="mm"
            dica="Só serve para a área. Os metros não dependem dela."
            aoMudar={(v) => setLargura(soNumero(v))} aoFechar={fecharMenu} />
        </ValorEscolha>
      </div>

      {/* os resultados, sempre à vista (sem conta, "—" fantasma) */}
      <span style={{ ...valorNaGrade(C18, ROTULO_BAIXO, "R"), color: CINZA }}>Resultados:</span>
      <Par x={C18} k={R(0)} nome="Voltas" valor={resultado ? linhaDe("Voltas") : nada} />
      <Par x={C18} k={R(1)} nome="Parede do rolo" valor={resultado ? curto(numDe(linhaDe("Espessura do rolo (parede)"))) : nada} un={resultado ? "mm" : undefined} />
      <Par x={C18} k={R(2)} nome="Área" valor={temArea ? semUnidade(linhaDe("Área total")) : nada} un={temArea ? "m²" : undefined} />

      {/* A metragem, embaixo, na c1: o rótulo na 42, a maiúscula da 45 à 57 e
          a nota na 62. Sem conta possível, o que falta, no mesmo lugar. */}
      {mensagem ? (
        <div style={{ position: "absolute", left: C1, width: LIMITE_VALOR - C1,
          bottom: ALTURA_DA_ABA - (linhaDaAba(BASE_VALOR) + L5 - baseFraunces(FRASE, L5) - ACERTO_FRASE),
          ...FR400, fontSize: FRASE, lineHeight: `${L5}px`, color: PRETO }}>
          {mensagem.split("\n").map((frase, i) => (
            <div key={i} style={{ marginLeft: -(folgaFraunces(400, FRASE, frase.charAt(0)) + FOLGA_FRASE), textWrap: "balance" }}>{frase}</div>
          ))}
        </div>
      ) : (
        <>
          <span aria-hidden style={{ ...naGrade(C1, ROTULO_BAIXO, PEQUENO, 400, "M"), color: CINZA }}>Metragem estimada:</span>
          <div ref={valorRef} aria-hidden style={{ ...noFraunces(C1, BASE_VALOR, PRECO, textoValor.charAt(0), FOLGA_PRECO, ACERTO_PRECO), letterSpacing: `calc(${JUSTO_VALOR} + ${aperto}px)`, color: resultado ? PRETO : FANTASMA }}>
            {textoValor}
          </div>
          {/* na 62, o que a calculadora antiga já pedia */}
          {resultado && (
            <span style={{ ...naGrade(C1, QUEBRA, PEQUENO, 400, "C"), color: CINZA }}>Confirme na pesagem antes de programar a produção.</span>
          )}
        </>
      )}
    </div>
  );
}
