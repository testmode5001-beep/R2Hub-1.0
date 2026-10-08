// Calculadora de distorção (Hub 1.0, por dentro).
//
// A aba do card "Distorção" das Calculadoras, no molde da de facas: as peças e
// a grade são as de lá (CalculadoraFacasHub10), como na de clichê.
//
//   - em cima à esquerda, o que o designer digita: os dentes da engrenagem na
//     c1 (a medida da arte, para a arte corrigida, saiu em 08/10/2026:
//     "a medida da arte é desnecessária na calculadora de distorção");
//   - a coluna da direita, na c18: "Configurações" (módulo e chapa, com os
//     padrões da calculadora antiga) e "Resultados:" (repetição, distorção do
//     clichê, porcentagem de redução e fator de gravação);
//   - o tamanho do clichê enorme na c1 e, na 62, a frase sobre onde aplicar a
//     redução. Augusto, 08/10/2026: primeiro "colocar o K da chapa no lugar
//     da distorção" (o K, em mm, virou "Distorção do clichê" e a porcentagem
//     foi para os resultados como "Porcentagem de redução"); depois "substitua
//     a posição da distorção do clichê pelo tamanho do impresso, que agora
//     fica tamanho do clichê".
//
// A conta é a da calculadora antiga (`calcular("distorcao")`): nenhuma fórmula
// nova mora aqui.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { PADROES, calcular } from "../v1a/CalculadorasV1a";
import { FUNDO, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { baseFraunces, folgaFraunces } from "./grade-hub10";
import {
  ACERTO_FRASE, ACERTO_PRECO, ALTURA_DA_ABA, BASE_VALOR, C1, C18, C23, CINZA, CampoMedida, FANTASMA, FOLGA_FRASE, FOLGA_PRECO,
  FR400, FRASE, JUSTO_VALOR, L5, LIMITE_VALOR, Opcoes, PEQUENO, PRECO, Par, QUEBRA, ROTULO_BAIXO, ValorEscolha, linhaDaAba,
  naGrade, noFraunces, num, valorNaGrade,
} from "./CalculadoraFacasHub10";

/* os módulos e as chapas da conta antiga (MODULOS e CHAPAS): o rótulo é o
   que ela procura */
const MODULOS = ["M1 (π)", 'CP 1/8"', 'CP 5/32"', 'CP 3/16"', 'CP 1/4"'];
const CHAPAS = ["1,14 mm", "1,70 mm", "2,84 mm", "3,94 mm", "5,00 mm", "6,35 mm"];
/* como na aba de facas, o módulo 1 aparece "M1" (o π é o passo dele em mm) */
const nomeModulo = (m: string) => (m === "M1 (π)" ? "M1" : m);
const PADRAO = PADROES.distorcao;
/* Dentes são inteiros: "45,5" virava 455, os dígitos se juntavam (simulação
   3, 30/09/2026). A vírgula digitada fica à vista e o que vem depois dela
   não entra: quem digita vê que ali não cabe decimal, e a conta usa 45. */
const soInteiro = (v: string) => {
  const [inteiro = "", ...resto] = v.split(/[,.]/);
  return inteiro.replace(/\D/g, "").slice(0, 3) + (resto.length ? "," : "");
};
/** "301,593 mm" → ["301,593", "mm"] */
const partir = (s: string): [string, string | undefined] => {
  const m = /^(.*?)\s+(mm|%)$/.exec(s.trim());
  return m ? [m[1], m[2]] : [s, undefined];
};

/** A aba da calculadora de distorção: a página inteira abaixo da barra. */
export function CalculadoraDistorcaoHub10({ aoFechar }: { aoFechar: () => void }) {
  const [dentes, setDentes] = useState("");
  const [modulo, setModulo] = useState(PADRAO.modulo);
  const [chapa, setChapa] = useState(PADRAO.chapa);
  const [menu, setMenu] = useState<null | "modulo" | "chapa">(null);
  const campoDentes = useRef<HTMLInputElement | null>(null);
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

  const completa = num(dentes) > 0;
  /* Zero dente: a conta não roda e nada dizia por quê (simulação 6,
     07/10/2026). Como nas outras abas, a frase só aparece depois de sair do
     campo; o campo abre com o foco. */
  const [dentesEmFoco, setDentesEmFoco] = useState(true);
  useEffect(() => {
    const el = campoDentes.current;
    if (!el) return;
    const entra = () => setDentesEmFoco(true);
    const sai = () => setDentesEmFoco(false);
    el.addEventListener("focus", entra);
    el.addEventListener("blur", sai);
    return () => { el.removeEventListener("focus", entra); el.removeEventListener("blur", sai); };
  }, []);
  const mensagem = dentes !== "" && !completa && !dentesEmFoco
    ? "Os dentes precisam ser mais que zero.\nDigite o Z do cilindro."
    : "";
  /* a conta recebe o inteiro, sem a vírgula que pode ter ficado à vista */
  const res = useMemo(() => (completa ? calcular("distorcao", { ...PADRAO, dentes: String(Math.trunc(num(dentes))), modulo, chapa }) : null),
    [completa, dentes, modulo, chapa]);
  const linhaDe = (rotulo: string) => res?.linhas.find((l) => l.label === rotulo)?.valor ?? "";
  const resultado = !!res;
  /* a conta antiga chama a porcentagem de "Distorção do clichê"; aqui ela é a
     porcentagem de redução, e a distorção do clichê é o K da chapa, em mm */
  const [pct] = partir(linhaDe("Distorção do clichê"));
  const distorcaoMm = linhaDe("K da chapa");
  /* o número grande é o tamanho do clichê (na conta antiga, "Tamanho a
     aplicar no impresso": a repetição menos o K) */
  const textoValor = resultado ? `${res!.destaque.valor} mm` : "000,000 mm";
  const [repeticao] = partir(linhaDe("Repetição (R)"));

  /* o número para meia coluna antes da c18; só aperta as letras se passar */
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

  return (
    <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: ALTURA_DA_ABA, background: FUNDO, zIndex: NIVEL.painel, color: PRETO, fontFamily: INTER, overflow: "hidden" }}>

      <h1 className="h10-so-leitor">Calculadora de distorção</h1>
      <div role="status" aria-live="polite" aria-atomic="true" className="h10-so-leitor">
        {mensagem ? mensagem.replace(/\n/g, " ") : resultado ? `Tamanho do clichê: ${textoValor}. Distorção do clichê: ${distorcaoMm} mm. Porcentagem de redução: ${pct} %.` : ""}
      </div>

      {/* o que se digita: os dentes da engrenagem */}
      <CampoMedida x={C1} nome="Dentes" valor={dentes} rotulo="dentes da engrenagem" titulo="O número de dentes da engrenagem: o Z do cilindro."
        aoMudar={(v) => setDentes(soInteiro(v))} auto campoRef={campoDentes} />

      {/* o fechar do painel, vazado, terminando em c23 e centrado na linha 13 */}
      <button onClick={aoFechar} className="p10-flat" aria-label="Fechar a calculadora"
        style={{ position: "absolute", left: C23 - 46, top: linhaDaAba(13) - 23, boxSizing: "border-box", width: 46, height: 46, padding: 0, display: "grid", placeItems: "center",
          background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
      </button>

      {/* as configurações, nas duas primeiras linhas das da aba de facas */}
      <span style={{ ...valorNaGrade(C18, 15, "C"), color: CINZA }}>Configurações</span>
      <span aria-hidden style={{ ...naGrade(C18, 18, PEQUENO, 400, "M"), color: CINZA }}>Módulo:</span>
      <div style={valorNaGrade(C18, 20, nomeModulo(modulo).charAt(0))}>
        <ValorEscolha rotulo="Módulo" valor={nomeModulo(modulo)} aberto={menu === "modulo"} aoAbrir={() => alternar("modulo")}>
          <Opcoes lista={MODULOS.map(nomeModulo)} atual={nomeModulo(modulo)}
            aoEscolher={(v) => { setModulo(MODULOS.find((m) => nomeModulo(m) === v) ?? v); setMenu(null); }} />
        </ValorEscolha>
      </div>
      <span aria-hidden style={{ ...naGrade(C18, 23, PEQUENO, 400, "C"), color: CINZA }}>Chapa:</span>
      <div style={valorNaGrade(C18, 25, chapa.charAt(0))}>
        <ValorEscolha rotulo="Chapa" valor={chapa} aberto={menu === "chapa"} aoAbrir={() => alternar("chapa")}>
          <Opcoes lista={CHAPAS} atual={chapa} aoEscolher={(v) => { setChapa(v); setMenu(null); }} />
        </ValorEscolha>
      </div>

      {/* os quatro resultados de quatro em quatro linhas, da 45 à 57, sempre à
          vista: como no substrato, o primeiro três linhas abaixo do rótulo e o
          último na linha de base do número grande */}
      <span style={{ ...valorNaGrade(C18, ROTULO_BAIXO, "R"), color: CINZA }}>Resultados:</span>
      <Par x={C18} k={BASE_VALOR - 12} nome="Repetição (R)" valor={resultado ? repeticao : nada} un={resultado ? "mm" : undefined} />
      <Par x={C18} k={BASE_VALOR - 8} nome="Distorção do clichê" valor={resultado ? distorcaoMm : nada} un={resultado ? "mm" : undefined} />
      <Par x={C18} k={BASE_VALOR - 4} nome="Porcentagem de redução" valor={resultado ? pct : nada} un={resultado ? "%" : undefined} />
      <Par x={C18} k={BASE_VALOR} nome="Fator de gravação" valor={resultado ? linhaDe("Fator de gravação") : nada} />

      {/* a distorção, embaixo, na c1: o rótulo na 42, a maiúscula da 45 à 57.
          Sem conta possível, o que falta, no mesmo lugar (como no substrato). */}
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
          <span aria-hidden style={{ ...naGrade(C1, ROTULO_BAIXO, PEQUENO, 400, "T"), color: CINZA }}>Tamanho do clichê:</span>
          <div ref={valorRef} aria-hidden style={{ ...noFraunces(C1, BASE_VALOR, PRECO, textoValor.charAt(0), FOLGA_PRECO, ACERTO_PRECO), letterSpacing: `calc(${JUSTO_VALOR} + ${aperto}px)`, color: resultado ? PRETO : FANTASMA }}>
            {textoValor}
          </div>
        </>
      )}
      {/* na 62, onde aplicar a redução (a frase da calculadora antiga dizia
          "essa redução": com o número grande em mm, ela passa a nomear a
          porcentagem, para ninguém tirar os mm da medida da arte) */}
      {resultado && (
        <span style={{ ...naGrade(C1, QUEBRA, PEQUENO, 400, "A"), color: CINZA }}>Aplique a porcentagem de redução no sentido do desenvolvimento antes de gravar o clichê.</span>
      )}
    </div>
  );
}
