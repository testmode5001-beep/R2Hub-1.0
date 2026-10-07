// Calculadora de clichê (Hub 1.0, por dentro).
//
// A aba do card "Clichê" das Calculadoras, no molde da de facas (Augusto,
// 29/09/2026): as peças e a grade são as de lá (CalculadoraFacasHub10).
//
//   - em cima à esquerda, o que a vendedora digita: a largura da etiqueta na
//     c1 e o diâmetro do cilindro porta-clichê na c6. São as duas medidas de
//     que a conta depende: a largura dá a largura da chapa e o porta-clichê, a
//     altura (Augusto, 01/10/2026: "as informações principais para o cálculo
//     correto são o diâmetro do cilindro porta-clichê e a largura da
//     etiqueta"). O cilindro morava nas configurações com Ø 96 de padrão e,
//     sem ninguém trocar, toda chapa saía com 335 mm de altura;
//   - a coluna da direita, na c18: "Configurações" (cores, carreiras, chapa e
//     prova, com os padrões da calculadora antiga; cada cor é um clichê) e
//     "Resultados:" (a chapa, com altura, largura e área, e o valor de cada
//     clichê);
//   - o valor total enorme na c1, com a quebra na 62: os clichês e a prova.
//
// A conta é a da calculadora antiga (`calcular("valorcliche")`, validada com
// a fábrica): nenhuma fórmula nova mora aqui. O campo "Jogos" dela ficou de
// fora: a conta só calcula com 1 jogo (com outro número, apaga os valores).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { PADROES, calcular } from "../v1a/CalculadorasV1a";
import { FUNDO, INTER, NIVEL, PRETO, useEscDoTopo } from "./ChromeHub10";
import { baseFraunces, folgaFraunces } from "./grade-hub10";
import {
  ACERTO_FRASE, ACERTO_PRECO, ALTURA_DA_ABA, BASE_VALOR, C1, C18, C23, C6, CINZA, CampoMedida, FANTASMA,
  FOLGA_FRASE, FOLGA_PRECO, FR400, FRASE, JUSTO_VALOR, L5, LIMITE_VALOR, MENU, Opcoes, PEQUENO, PRECO,
  Par, QUEBRA, ROTULO_BAIXO, TINTA2, ValorEscolha, curto, fmt, linhaDaAba, naGrade, noFraunces, num,
  soNumero, valorNaGrade,
} from "./CalculadoraFacasHub10";

/* as chapas da conta antiga (CHAPAS_VALOR): o rótulo é o que ela procura */
const CHAPAS = ["1,14 mm", "1,70 mm"];
const PADRAO = PADROES.valorcliche;
/** "1.234,56 cm²" → 1234,56 */
const numDe = (s: string) => num(s.replace(/[^\d,.-]/g, "").replace(/\./g, ""));
/* Número inteiro: "4,5" virava 45, os dígitos se juntavam (simulação 3,
   30/09/2026). A vírgula digitada fica à vista e o que vem depois dela não
   entra: quem digita vê que ali não cabe decimal, e a conta usa o inteiro. */
const soInteiro = (v: string, digitos = 3) => {
  const [inteiro = "", ...resto] = v.split(/[,.]/);
  return inteiro.replace(/\D/g, "").slice(0, digitos) + (resto.length ? "," : "");
};

/** O menu de um número das configurações (as cores, as carreiras, a prova;
    na de substrato, o tubete e a largura da bobina): o campo tracejado do hub,
    uma dica curta e o padrão da conta antiga, com o "Voltar ao padrão" quando
    mudou (o que não tem padrão, como a largura da bobina, não mostra). Enter
    fecha. */
export function MenuNumero({ rotulo, valor, padrao, unidade, prefixo, dica, aoMudar, aoFechar }: {
  rotulo: string; valor: string; padrao?: string; unidade?: string; prefixo?: string; dica?: string;
  aoMudar: (v: string) => void; aoFechar: () => void;
}) {
  const comUnidade = (v: string) => `${prefixo ? `${prefixo} ` : ""}${v}${unidade ? ` ${unidade}` : ""}`;
  return (
    /* a coluna das configurações não quebra linha; o menu quebra, para a dica
       caber na caixa */
    <div style={{ ...MENU, width: 320, boxSizing: "border-box", padding: "14px 16px", gap: 12, letterSpacing: "normal", whiteSpace: "normal" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: INTER, fontSize: 13, fontWeight: 600, color: TINTA2 }}>
        {rotulo}
        <span className="calc10-caixa" style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 12px", border: `1.5px dashed ${PRETO}`, borderRadius: 10 }}>
          {prefixo && <span style={{ fontSize: 14, color: TINTA2 }}>{prefixo}</span>}
          <input value={valor} autoFocus inputMode="decimal" aria-label={rotulo}
            onChange={(e) => aoMudar(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aoFechar(); } }}
            style={{ flex: 1, width: 0, minWidth: 0, border: "none", outline: "none", background: "transparent", fontFamily: INTER, fontSize: 18, fontWeight: 600, color: PRETO }} />
          {unidade && <span style={{ fontSize: 14, color: TINTA2 }}>{unidade}</span>}
        </span>
      </label>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, fontFamily: INTER, fontSize: 14, fontWeight: 400, color: TINTA2 }}>
        {dica && <span style={{ lineHeight: 1.35 }}>{dica}</span>}
        {padrao !== undefined && <span style={{ whiteSpace: "nowrap" }}>Padrão da calculadora: {comUnidade(padrao)}</span>}
        {padrao !== undefined && valor !== padrao && (
          <button onClick={() => aoMudar(padrao)} className="p10-flat"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 14, fontWeight: 600, color: PRETO, textDecoration: "underline", textUnderlineOffset: 3 }}>Voltar ao padrão</button>
        )}
      </div>
    </div>
  );
}

/** A aba da calculadora de clichê: a página inteira abaixo da barra. */
export function CalculadoraClicheHub10({ aoFechar }: { aoFechar: () => void }) {
  const [largura, setLargura] = useState("");
  /* o porta-clichê começa vazio, como a largura: sem padrão escondido */
  const [cilindro, setCilindro] = useState("");
  const [cores, setCores] = useState(PADRAO.cores);
  const [carreiras, setCarreiras] = useState(PADRAO.carreiras);
  const [chapa, setChapa] = useState(PADRAO.chapa);
  const [prova, setProva] = useState(PADRAO.prova);
  const [menu, setMenu] = useState<null | "cores" | "carreiras" | "chapa" | "prova">(null);
  const campoLargura = useRef<HTMLInputElement | null>(null);
  const campoCilindro = useRef<HTMLInputElement | null>(null);
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

  const nCores = Math.round(num(cores));
  const completa = num(largura) > 0 && num(cilindro) > 0;
  /* Cores ou carreiras apagadas: a conta antiga trocaria por 1 sem dizer;
     aqui não calcula e diz o que falta. */
  const faltaCores = !(nCores >= 1);
  const faltaCarreiras = !(Math.round(num(carreiras)) >= 1);
  const res = useMemo(() => (completa && !faltaCores && !faltaCarreiras
    ? calcular("valorcliche", { ...PADRAO, dia: cilindro, chapa, largEtq: largura, carreiras, jogos: "1", cores: String(nCores), prova: prova || "0" })
    : null), [completa, faltaCores, faltaCarreiras, cilindro, chapa, largura, carreiras, nCores, prova]);
  const linhaDe = (rotulo: string) => res?.linhas.find((l) => l.label === rotulo)?.valor ?? "";
  const resultado = !!res && res.destaque.valor !== "—";
  const total = resultado ? `R$ ${res!.destaque.valor}` : "";
  const valorCor = linhaDe("Valor por cor");
  /* os clichês e a prova, como a "Composição do valor" da conta antiga */
  const partes = res?.visual?.partes ?? [];
  const valorDosCliches = partes[0] ? `R$ ${fmt(partes[0].valor)}` : "";
  const valorProva = `R$ ${fmt(num(prova))}`;

  const mensagem = !completa ? "" : faltaCores
    ? "Faltam as cores.\nConfira nas configurações."
    : faltaCarreiras
    ? "Faltam as carreiras.\nConfira nas configurações."
    : !resultado ? String(res?.nota ?? "")
    : "";

  /* o valor para meia coluna antes da c18; só aperta as letras se passar */
  const textoValor = resultado ? total : "R$ 000,00";
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
  const quantosCliches = nCores === 1 ? "1 clichê" : `${nCores} clichês`;
  /* os resultados de quatro em quatro linhas: o 1º na linha da maiúscula do
     valor (45) e o último na base dele (57), como na aba de facas */
  const R = (i: number) => BASE_VALOR - 12 + 4 * i;

  return (
    <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: ALTURA_DA_ABA, background: FUNDO, zIndex: NIVEL.painel, color: PRETO, fontFamily: INTER, overflow: "hidden" }}>

      <h1 className="h10-so-leitor">Calculadora de clichê</h1>
      <div role="status" aria-live="polite" aria-atomic="true" className="h10-so-leitor">
        {mensagem ? mensagem.replace(/\n/g, " ") : resultado ? `Valor total: ${total}. ${quantosCliches}, ${valorCor} cada.` : ""}
      </div>

      {/* o que se digita: a largura da etiqueta e o porta-clichê */}
      <CampoMedida x={C1} nome="Largura" valor={largura} rotulo="largura da etiqueta em mm" titulo="A largura da etiqueta, em mm."
        aoMudar={(v) => setLargura(soNumero(v))} auto campoRef={campoLargura} aoEnter={() => campoCilindro.current?.focus()} />
      <CampoMedida x={C6} nome="Porta-clichê" valor={cilindro} rotulo="diâmetro do cilindro porta-clichê em mm"
        titulo="O diâmetro do cilindro porta-clichê, em mm. Na engrenagem M1, é o número de dentes: Z96 tem 96 mm."
        aoMudar={(v) => setCilindro(soNumero(v))} campoRef={campoCilindro} />

      {/* o fechar do painel, vazado, terminando em c23 e centrado na linha 13 */}
      <button onClick={aoFechar} className="p10-flat" aria-label="Fechar a calculadora"
        style={{ position: "absolute", left: C23 - 46, top: linhaDaAba(13) - 23, boxSizing: "border-box", width: 46, height: 46, padding: 0, display: "grid", placeItems: "center",
          background: "none", border: `1.5px solid ${PRETO}`, borderRadius: 999, cursor: "pointer" }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
      </button>

      {/* as configurações, nas linhas das da aba de facas */}
      <span style={{ ...valorNaGrade(C18, 15, "C"), color: CINZA }}>Configurações</span>
      <span aria-hidden style={{ ...naGrade(C18, 18, PEQUENO, 400, "C"), color: CINZA }}>Cores:</span>
      <div style={valorNaGrade(C18, 20, cores.charAt(0) || "—")}>
        <ValorEscolha rotulo="Cores" valor={faltaCores ? "—" : nCores === 1 ? "1 cor" : `${nCores} cores`} aberto={menu === "cores"} aoAbrir={() => alternar("cores")}>
          <MenuNumero rotulo="Número de cores" valor={cores} padrao={PADRAO.cores}
            dica="Cada cor é um clichê."
            aoMudar={(v) => setCores(soInteiro(v, 2))} aoFechar={fecharMenu} />
        </ValorEscolha>
      </div>
      <span aria-hidden style={{ ...naGrade(C18, 23, PEQUENO, 400, "C"), color: CINZA }}>Carreiras:</span>
      <div style={valorNaGrade(C18, 25, carreiras.charAt(0) || "1")}>
        <ValorEscolha rotulo="Carreiras" valor={carreiras || "—"} aberto={menu === "carreiras"} aoAbrir={() => alternar("carreiras")}>
          <MenuNumero rotulo="Carreiras" valor={carreiras} padrao={PADRAO.carreiras}
            dica="Quantas etiquetas lado a lado na bobina. A calculadora de facas mostra nos resultados."
            aoMudar={(v) => setCarreiras(soInteiro(v))} aoFechar={fecharMenu} />
        </ValorEscolha>
      </div>
      <span aria-hidden style={{ ...naGrade(C18, 28, PEQUENO, 400, "C"), color: CINZA }}>Chapa:</span>
      <div style={valorNaGrade(C18, 30, "1")}>
        <ValorEscolha rotulo="Chapa" valor={chapa} aberto={menu === "chapa"} aoAbrir={() => alternar("chapa")}>
          <Opcoes lista={CHAPAS} atual={chapa} aoEscolher={(v) => { setChapa(v); setMenu(null); }} />
        </ValorEscolha>
      </div>
      <span aria-hidden style={{ ...naGrade(C18, 34, PEQUENO, 400, "P"), color: CINZA }}>Prova:</span>
      <div style={valorNaGrade(C18, 36, "R")}>
        <ValorEscolha rotulo="Prova" valor={valorProva} aberto={menu === "prova"} aoAbrir={() => alternar("prova")}>
          <MenuNumero rotulo="Valor da prova" valor={prova} padrao={PADRAO.prova} prefixo="R$"
            dica="Se houver prova, o valor dela entra no total."
            aoMudar={(v) => setProva(soNumero(v))} aoFechar={fecharMenu} />
        </ValorEscolha>
      </div>

      {/* os resultados, sempre à vista (sem conta, "—" fantasma) */}
      <span style={{ ...valorNaGrade(C18, ROTULO_BAIXO, "R"), color: CINZA }}>Resultados:</span>
      <Par x={C18} k={R(0)} nome="Altura da chapa" valor={resultado ? curto(numDe(linhaDe("Altura da chapa"))) : nada} un={resultado ? "mm" : undefined} />
      <Par x={C18} k={R(1)} nome="Largura da chapa" valor={resultado ? curto(numDe(linhaDe("Largura da chapa"))) : nada} un={resultado ? "mm" : undefined} />
      <Par x={C18} k={R(2)} nome="Área" valor={resultado ? fmt(numDe(linhaDe("Área"))) : nada} un={resultado ? "cm²" : undefined} />
      <Par x={C18} k={R(3)} nome="Valor por cor" valor={resultado ? valorCor : nada} />

      {/* O valor, embaixo, na c1: o rótulo na 42, a maiúscula da 45 à 57 e a
          quebra na 62. Sem valor, o que falta, no mesmo lugar. */}
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
          <span aria-hidden style={{ ...naGrade(C1, ROTULO_BAIXO, PEQUENO, 400, "V"), color: CINZA }}>Valor total:</span>
          <div ref={valorRef} aria-hidden style={{ ...noFraunces(C1, BASE_VALOR, PRECO, "R", FOLGA_PRECO, ACERTO_PRECO), letterSpacing: `calc(${JUSTO_VALOR} + ${aperto}px)`, color: resultado ? PRETO : FANTASMA }}>
            {textoValor}
          </div>
          {resultado && (
            <>
              <Par x={C1} k={QUEBRA} nome={quantosCliches} valor={valorDosCliches} />
              {/* sem prova, a casa dela repetiria o R$ 0,00 das configurações */}
              {num(prova) > 0 && <Par x={C6} k={QUEBRA} nome="Prova" valor={valorProva} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
