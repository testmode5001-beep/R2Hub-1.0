// Calculadoras, Hub 1.0. Fonte: hubv3/calculadoras.svg (24/09/2026).
//
// A capa está no molde do rework v4 (Augusto, 02/10/2026: "página inicial das
// calculadoras também passa pelo rework"; só a capa): os cinco cartões lilás
// (Facas, Distorção, Clichê, Etiqueta, Substrato) soltos no cinza, com raio e
// sombra, da c1 à c23, o quinto entrando pela rolagem; cada um com "Calcular"
// no alto, o título em Fraunces, a ilustração do handoff e uma linha dizendo o
// que a conta responde (as posições do cartão da capa da Solicitação). No pé,
// o título na c1 e o resumo à direita, sem a faixa preta (CapaV4Hub10).
//
// O dentro do card é uma aba, no molde do Novo pedido: o de Facas já é 1.0
// (CalculadoraFacasHub10, 28/09/2026), o de Distorção também, no molde do de
// Facas (30/09/2026), e o de Substrato, com a metragem da bobina (06/10/2026).
// Clichê e Etiqueta estão com as contas em revisão e só avisam "Em breve"
// (Augusto, 06/10/2026: "as calculadoras de clichês e etiqueta precisamos
// rever os cálculos então elas darão o aviso de em breve"); a aba de Clichê
// continua no código, para voltar quando as contas forem revistas.
import { useCallback, useEffect, useState } from "react";

import { BarraTopoHub10, FR, FUNDO_PAGINA, INTER, NIVEL, PRETO, PalcoFixo, useEscDoTopo } from "./ChromeHub10";
import { CAPA_V4, CartaoV4, DENTRO_V4, DescricaoV4, ResumoDoPeV4, RotuloV4, TituloV4, TrilhaV4, tituloDoPeV4 } from "./CapaV4Hub10";
import { CalculadoraFacasHub10 } from "./CalculadoraFacasHub10";
import { CalculadoraDistorcaoHub10 } from "./CalculadoraDistorcaoHub10";
import { CalculadoraSubstratoHub10 } from "./CalculadoraSubstratoHub10";
import { AvisoV1a } from "../v1a/HubV1a";
import type { SessionUser } from "@/lib/session";
import { PALETA } from "@/lib/paleta-hub";

/* ————— as cinco calculadoras ————— */
/* `calcs` são as calculadoras da tela V1a que cada card representa: é por
   elas que a permissão decide se o card aparece. `ilustracao` é a caixa do
   desenho MEDIDA no handoff, em pixels do card (480 de largura, igual aqui),
   então entra sem escala. */
type Calculadora = {
  id: string; nome: string; descricao: string; calcs: string[];
  ilustracao: { left: number; top: number; width: number; height: number };
};
const CALCULADORAS: Calculadora[] = [
  { id: "facas", nome: "Facas", descricao: "Desenvolvimento e valores", calcs: ["facas", "comparativo", "pordiametro"],
    ilustracao: { left: 63, top: 202, width: 358, height: 227 } },
  { id: "distorcao", nome: "Distorção", descricao: "Desenvolvimento", calcs: ["distorcao"],
    ilustracao: { left: 90, top: 243, width: 266, height: 174 } },
  { id: "cliche", nome: "Clichê", descricao: "Valores variam de acordo com a medida e espessura", calcs: ["valorcliche"],
    ilustracao: { left: 71, top: 210, width: 333, height: 235 } },
  { id: "etiqueta", nome: "Etiqueta", descricao: "Desenvolvimento e valores", calcs: ["caixa", "valor", "metragem"],
    ilustracao: { left: 84, top: 262, width: 254, height: 160 } },
  { id: "substrato", nome: "Substrato", descricao: "Qual metragem a matéria-prima tem", calcs: ["substrato", "bobinas", "tinta"],
    ilustracao: { left: 85, top: 218, width: 215, height: 242 } },
];

/* As ilustrações maiores (Augusto, 07/10/2026: "as ilustrações dos cards
   das calculadoras precisam ser maiores", e depois "aumente também a
   ilustração de facas"): 40% sobre a caixa do handoff; as de Facas e do
   Clichê, que já eram largas, até 400 de largura, 20 de folga para a borda
   do cartão (440). */
const AUMENTO_DA_ILUSTRACAO: Record<string, number> = { facas: 400 / 358, cliche: 400 / 333, distorcao: 1.4, etiqueta: 1.4, substrato: 1.4 };

/** Calculadora → permissão calc.* — a mesma tabela da tela V1a. */
const PERM_DA_CALC: Record<string, string> = {
  distorcao: "calc.distorcao", valorcliche: "calc.valor", caixa: "calc.caixa", valor: "calc.valoretiqueta",
  metragem: "calc.metragem", facas: "calc.desenvolvimento", comparativo: "calc.comparativo",
  pordiametro: "calc.diametro", bobinas: "calc.bobinas", substrato: "calc.substrato", tinta: "calc.tinta",
};

/* As calculadoras com as contas em revisão: o cartão fica na capa, com a
   pílula "Em breve", e o clique só avisa. */
const EM_BREVE = new Set(["cliche", "etiqueta"]);

/* O lilás do handoff, o mesmo #aba9fc do card "Criação" nos pedidos. Os
   cartões vizinhos da mesma cor clareiam 12% a cada um, o degradê padrão do
   hub, que os cartões novos do v4 também seguem (Augusto, 02/10/2026). */
const LILAS = PALETA.lilas;

/** Clareia uma cor em direção ao branco. t=0 não muda, t=1 vira branco. */
function clarear(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canal = (c: number) => Math.round(c + (255 - c) * t);
  return "#" + [canal((n >> 16) & 255), canal((n >> 8) & 255), canal(n & 255)]
    .map((x) => x.toString(16).padStart(2, "0")).join("");
}

/* A ilustração do handoff no tamanho em que foi desenhada, centrada no
   cartão, no vão entre o título e a linha de baixo. */
const MEIO_DA_ILUSTRACAO = 395;

/* ————— a tela ————— */
export function CalculadorasHub10({ profile, aoNavegar, onNova, onLogout, disponiveis, permissoes, aoAbrir, podeGabarito = false }: {
  profile: SessionUser;
  aoNavegar: (label: string) => void;
  onNova?: () => void;
  onLogout: () => void;
  disponiveis?: string[];
  /** chaves calc.* que a pessoa tem; ausente = todas */
  permissoes?: string[];
  /** abre a calculadora do card — hoje é a tela V1a, até o dentro do card
      ganhar a diagramação 1.0 */
  aoAbrir: (id: string) => void;
  /** permissão calc.gabarito: baixar o desenho 1:1 na calculadora de facas */
  podeGabarito?: boolean;
}) {
  /* a aba aberta; Facas, Distorção e Substrato já existem no 1.0 */
  const [aberta, setAberta] = useState<null | "facas" | "distorcao" | "substrato">(null);
  /* O aviso do cartão "Em breve" clicado, no aviso padrão do hub (AvisoV1a,
     guia 5.21), com o nome da calculadora: some sozinho em 6 s, no ✕ dele ou
     com o ESC (na pilha, depois do que a barra tiver aberto). */
  const [emBreve, setEmBreve] = useState<string | null>(null);
  const fecharAviso = useCallback(() => setEmBreve(null), []);
  useEscDoTopo(!!emBreve, NIVEL.painel, fecharAviso);
  useEffect(() => {
    if (!emBreve) return;
    const tempo = window.setTimeout(fecharAviso, 6000);
    return () => window.clearTimeout(tempo);
  }, [emBreve, fecharAviso]);
  /* estável: vai para o ESC da aba (useEscDoTopo), que reinscrevia a aba a
     cada render com uma função nova */
  const fecharAba = useCallback(() => setAberta(null), []);

  const liberada = (calc: string) => !permissoes || !PERM_DA_CALC[calc] || permissoes.includes(PERM_DA_CALC[calc]);
  const visiveis = CALCULADORAS.filter((c) => c.calcs.some(liberada));

  /* Facas abre a aba 1.0 para quem tem a conta de facas; quem só tem o
     comparativo ou o por diâmetro segue para a tela antiga. Substrato abre a
     metragem da bobina para quem tem essa conta; quem só tem a largura do
     substrato ou a tinta segue para a tela antiga. */
  const abrir = (c: Calculadora) => {
    /* abrir outra coisa tira o aviso: ele não volta quando a aba fecha */
    if (EM_BREVE.has(c.id)) { setEmBreve(c.nome); return; }
    setEmBreve(null);
    if (c.id === "facas" && liberada("facas")) setAberta("facas");
    else if (c.id === "distorcao" && liberada("distorcao")) setAberta("distorcao");
    else if (c.id === "substrato" && liberada("bobinas")) setAberta("substrato");
    else aoAbrir(c.id);
  };

  return (
    <PalcoFixo>
      {/* a capa no cinza do rework, da barra ao pé (sem a faixa preta); com uma
          aba aberta, a página inteira é dela */}
      {!aberta && <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />}

      {/* ————— os cartões ————— */}
      <TrilhaV4 quantos={visiveis.length} oculta={!!aberta}>
        {visiveis.map((c, i) => (
          <CartaoV4 key={c.id} indice={i} cor={clarear(LILAS, i * 0.12)} aoAbrir={() => abrir(c)} rotulo={EM_BREVE.has(c.id) ? `Calcular ${c.nome}, em breve` : `Calcular ${c.nome}`}>
            <RotuloV4 texto="Calcular" />
            {/* a pílula preta, a marca de estado do hub, no alto à direita,
                centrada na altura do "Calcular" */}
            {EM_BREVE.has(c.id) && (
              <span aria-hidden style={{ position: "absolute", right: DENTRO_V4.rotuloX, top: DENTRO_V4.rotuloBase - 25, height: 34, padding: "0 16px",
                display: "inline-flex", alignItems: "center", borderRadius: 999, background: PRETO, color: "#fff",
                fontFamily: INTER, fontSize: 17, fontWeight: 600, letterSpacing: "-.01em", whiteSpace: "nowrap" }}>Em breve</span>
            )}
            <TituloV4 linhas={[c.nome]} />
            {/* a ilustração do handoff, aumentada (AUMENTO_DA_ILUSTRACAO) e centrada no cartão */}
            {(() => {
              const k = AUMENTO_DA_ILUSTRACAO[c.id] ?? 1;
              const largura = c.ilustracao.width * k, altura = c.ilustracao.height * k;
              return (
                <img src={`/calc10/${c.id}.svg`} alt="" aria-hidden draggable={false}
                  style={{ position: "absolute", left: (CAPA_V4.cartao - largura) / 2, top: MEIO_DA_ILUSTRACAO - altura / 2,
                    width: largura, height: altura, display: "block", pointerEvents: "none" }} />
              );
            })()}
            <DescricaoV4 texto={c.descricao} />
          </CartaoV4>
        ))}
      </TrilhaV4>

      {!visiveis.length && !aberta && (
        <div style={{ position: "absolute", left: 0, top: CAPA_V4.topo, width: 1920, height: CAPA_V4.altura, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, zIndex: 2, color: PRETO }}>
          <div style={{ ...FR, fontSize: 44, letterSpacing: "-.02em" }}>Nenhuma calculadora liberada</div>
          <div style={{ fontSize: 20, color: "#8f8f8f" }}>Peça ao gestor para liberar as calculadoras no seu usuário.</div>
        </div>
      )}

      {emBreve && !aberta && (
        <AvisoV1a tipo="alerta" texto={`${emBreve}: em breve. Estamos revendo as contas desta calculadora.`} onFechar={fecharAviso} />
      )}

      {/* com a aba aberta, a página inteira é dela */}
      {aberta === "facas" ? (
        <CalculadoraFacasHub10 aoFechar={fecharAba} aoNavegar={aoNavegar} podeGabarito={podeGabarito} />
      ) : aberta === "distorcao" ? (
        <CalculadoraDistorcaoHub10 aoFechar={fecharAba} />
      ) : aberta === "substrato" ? (
        <CalculadoraSubstratoHub10 aoFechar={fecharAba} />
      ) : (
        <>
          {/* ————— o pé (v4): o título na c1 e o resumo à direita ————— */}
          <div style={tituloDoPeV4("Calculadoras")}>Calculadoras</div>
          <ResumoDoPeV4 linhas={[
            `${String(visiveis.length).padStart(2, "0")} ${visiveis.length === 1 ? "calculadora" : "calculadoras"}`,
            visiveis.map((c) => c.nome).join(" · ") || undefined,
          ]} />
        </>
      )}

      {/* na capa a barra fica transparente: a sombra do cartão no hover passa
          por baixo dela sem corte (como em Pedidos) */}
      <BarraTopoHub10 profile={profile} paginaAtiva="Calculadoras" aoNavegar={aoNavegar} onNova={onNova} onLogout={onLogout} disponiveis={disponiveis}
        fundo={aberta ? undefined : "transparent"} />
    </PalcoFixo>
  );
}
