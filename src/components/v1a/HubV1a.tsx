// Chrome V1a do Hub — recriação fiel do handoff `design_handoff_r2_hub`
// (README v1a, hifi): palco 1920×1290 centralizado e escalado na viewport,
// topbar branca de 1 linha (data · pesquisa · Mensagens · Anotações · bloco
// do usuário) e rail preto de 76px que expande para 238px no hover
// (translúcido + blur), com o botão amarelo "+" no topo, as 16 páginas na
// ordem do workflow e a marca R2 fazendo cross-fade do símbolo para o
// wordmark. Cores/medidas vêm do protótipo .dc.html — fonte exata (hifi).
// As classes .r2rail/.r2lbl/.r2mark/.r2word/.r2chip/.r2row/.r2ic estão em
// styles.css (bloco V1a).
import {
  useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type ReactNode,
} from "react";

import { BuscaGlobalV1a } from "./BuscaGlobalV1a";
import { chatDiretoNaoLidos, chatGeralNaoLido, conversasNaoLidas, useHubDados } from "./HubDadosV1a";
import { lerZoomPct, medidasDoPalco } from "@/lib/zoom-tela";
import { notificarNativo, piscarTitulo, tocarBip } from "@/lib/aviso-novidade";
import { instalarEscDosModais } from "@/lib/esc-modal";
import { instalarFocoDosModais } from "@/lib/foco-modal";
import { ZoomControleV1a } from "./ZoomControleV1a";

import {
  AnotacoesModalV1a, ConfigModalV1a, MensagensModalV1a, NotificacoesModalV1a,
} from "./modais/TopoModaisV1a";

/* ————— Kit v1a (README §Identidade) ————— */
export const INK = "#252425";
export const AMARELO = "#ffe815";
export const FUNDO = "#f1f1f1";
export const MONO = "ui-monospace, Menlo, monospace";
export const SOMBRA_CARD = "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -30px rgba(0,0,0,.25)";
export const STAGE_W = 1920;
export const STAGE_H = 1290;

/** Fraunces SOFT 100 com o eixo óptico do protótipo — estilo inline pronto. */
export const fr = (opsz: number, weight = 700): CSSProperties => ({
  fontFamily: "Fraunces, serif",
  fontVariationSettings: `'SOFT' 100, 'opsz' ${opsz}`,
  fontWeight: weight,
});

/**
 * Card fechado (nome do cliente em pé): padrão de DUAS linhas.
 * O corpo cai conforme o nome cresce e a largura trava em dois blocos de
 * linha — nome comprido quebra em duas colunas em vez de ser cortado no meio
 * ("CASA DE CARNES ALEXAND…"). Vale para Central, Pedidos e Aprovação.
 */
export const nomeEmPe = (nome: string): CSSProperties => {
  const n = String(nome || "").length;
  const corpo = n > 34 ? 14 : n > 26 ? 16 : n > 20 ? 18 : n > 16 ? 22 : 25;
  return { fontSize: corpo, lineHeight: 1.14, maxWidth: Math.round(corpo * 1.14 * 2) };
};

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/* O tamanho na tela (zoom do palco) mora em @/lib/zoom-tela — módulo à parte
   porque as modais do topo também mexem nele e não podem importar daqui. */

/* Largura de projeto do palco em uso. Em monitor pequeno ela deixa de ser 1920
   (ver zoom-tela), e as telas com blocos posicionados por coordenada — a Home —
   precisam saber disso para não sobrepor um bloco no outro.
   NÃO dá para ser contexto: as telas RENDERIZAM o EstagioV1a, então o corpo
   delas roda fora de qualquer provider dele. Aqui a conta é refeita a partir
   da janela, com o mesmo critério do palco. */
export function usePalcoLargura(altura = STAGE_H): number {
  const [w, setW] = useState(STAGE_W);
  useIsoLayoutEffect(() => {
    const calcular = () => {
      // MESMA conta do palco (medidasDoPalco), senão os dois divergem
      const { larguraPalco } = medidasDoPalco(window.innerWidth, window.innerHeight, lerZoomPct(), altura);
      setW(larguraPalco);
    };
    calcular();
    window.addEventListener("resize", calcular);
    window.addEventListener("r2hub-zoom", calcular);
    return () => { window.removeEventListener("resize", calcular); window.removeEventListener("r2hub-zoom", calcular); };
  }, [altura]);
  return w;
}

/* ————— Palco ————— */
/** Palco 1920×1290 (padding 22) centralizado e escalado para caber na
    viewport — nada rola; as áreas internas de cada tela é que rolam. */
export function EstagioV1a({ children, altura = STAGE_H, fundo = FUNDO, comPapel = false }: {
  children: ReactNode;
  altura?: number;
  fundo?: string;
  /** só a Home mostra o papel de parede — as telas de trabalho ficam lisas */
  comPapel?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  /* Zoom escolhido nesta máquina, em porcentagem. */
  const [pct, setPct] = useState(100);
  useIsoLayoutEffect(() => {
    const ouvir = () => setPct(lerZoomPct());
    ouvir();
    window.addEventListener("r2hub-zoom", ouvir);
    window.addEventListener("storage", ouvir);
    window.addEventListener("resize", ouvir);
    return () => {
      window.removeEventListener("r2hub-zoom", ouvir);
      window.removeEventListener("storage", ouvir);
      window.removeEventListener("resize", ouvir);
    };
  }, []);
  /* ESC fecha o modal aberto (o de cima, se houver empilhados) */
  useEffect(() => instalarEscDosModais(), []);
  /* Tab circula DENTRO do modal aberto e volta para quem o abriu ao fechar */
  useEffect(() => instalarFocoDosModais(), []);
  /* A escala e a largura de projeto saem de `medidasDoPalco` (zoom-tela):
     abaixo de 100% o palco alarga e tudo encolhe até caber na tela; em 100% o
     texto sai no corpo de projeto; acima, passa da janela e ela rola. */
  const [medida, setMedida] = useState<{ escala: number; larguraPalco: number; alturaPalco: number } | null>(null);
  useIsoLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      // clientWidth (e não o rect) porque a barra de rolagem come largura —
      // usando o rect, o palco sobrava 15px e nascia uma rolagem lateral boba
      const w = el.clientWidth, h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      setMedida(medidasDoPalco(w, h, pct, altura));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [altura, pct]);
  const escala = medida?.escala ?? null;
  const larguraPalco = medida?.larguraPalco ?? STAGE_W;
  /* em monitor curto o palco encolhe a própria altura (ver zoom-tela) —
     é isso que segura a letra legível em 1366×768 sem criar rolagem */
  const alturaPalco = medida?.alturaPalco ?? altura;
  /* passou do que cabe na tela → o palco rola dentro da janela */
  const ampliado = !!medida && (medida.larguraPalco * medida.escala > (outerRef.current?.clientWidth ?? 0) + 1
    || alturaPalco * medida.escala > (outerRef.current?.clientHeight ?? 0) + 1);
  /* Papel de parede (só a Home): fica atrás de tudo, sem véu — a imagem aparece
     como é. Com papel escolhido o palco fica transparente, senão o fundo cinza
     taparia tudo. Telas com fundo próprio (monitor do Mural) seguem opacas. */
  const dados = useHubDados();
  const papel = comPapel ? dados.papelParede || "" : "";
  const palcoTransparente = !!papel && fundo === FUNDO;
  return (
    <div ref={outerRef}
      className="fixed inset-0 flex"
      style={{
        background: fundo,
        overflow: ampliado ? "auto" : "hidden",
        // ampliado o palco começa no canto (senão a rolagem corta o começo);
        // cabendo inteiro, fica centralizado como sempre
        alignItems: ampliado ? "flex-start" : "center",
        justifyContent: ampliado ? "flex-start" : "center",
      }}>
      {/* `fixed` e não `absolute`: dentro de um container que rola, o absoluto
          rola JUNTO e acaba antes do fim da página — era a faixa de fundo que
          aparecia embaixo ao descer a tela. Fixo, o papel fica parado atrás. */}
      {!!papel && (
        <>
          {dados.papelTipo === "video" ? (
            <video src={papel} autoPlay muted loop playsInline
              style={{ position: "fixed", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
          ) : (
            <div style={{ position: "fixed", inset: 0, background: `url("${papel}") center/cover no-repeat`, zIndex: 0 }} />
          )}
        </>
      )}
      {/* Invólucro do TAMANHO VISUAL: `transform` não muda o espaço ocupado no
          layout, então sem ele a área de rolagem sairia errada (e o topo do
          palco ficava cortado). Aqui o que rola é exatamente o que se vê. */}
      <div
        style={{
          flex: "none",
          width: (larguraPalco) * (escala ?? 1),
          height: alturaPalco * (escala ?? 1),
          position: "relative",
          zIndex: 1, // acima do papel de parede fixo
        }}
      >
        <div
          className="fade-page relative shrink-0 flex flex-col overflow-hidden"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: larguraPalco,
            height: alturaPalco,
            padding: 22,
            /* contrapeso dos modais: em palco encolhido (monitor curto) os
               overlays com a classe .r2modal usam `zoom` para chegar perto do
               tamanho real — modal é leitura concentrada, pode ser maior que
               a tela atrás. 1 em telas grandes (nada muda), até 1,2 nas curtas. */
            ["--mzoom" as string]: escala ? String(Math.min(1.2, Math.max(1, 0.95 / escala)).toFixed(3)) : "1",
            transform: `scale(${escala ?? 1})`,
            transformOrigin: "top left",
            visibility: escala === null ? "hidden" : "visible",
            background: palcoTransparente ? "transparent" : fundo,
            color: INK,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ————— Topbar (README §Chrome: branca, 1 linha, raio 10, padding 10) ————— */
function dataLonga(agora: Date) {
  const dia = agora.getDate();
  const mes = agora.toLocaleDateString("pt-BR", { month: "long" });
  const semana = agora.toLocaleDateString("pt-BR", { weekday: "long" });
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} de ${mes}, ${semana}, ${hora}`;
}

export function TopbarV1a({ nome, busca, aoBuscar, badgeMensagens, onMensagens, onAnotacoes, onNotificacoes, onConfig, onSair, inputRef }: {
  nome: string;
  busca: string;
  aoBuscar: (v: string) => void;
  badgeMensagens?: number;
  onMensagens?: () => void;
  onAnotacoes?: () => void;
  onNotificacoes?: () => void;
  onConfig?: () => void;
  onSair?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [agora, setAgora] = useState(() => new Date());
  const [modalTopo, setModalTopo] = useState<null | "mensagens" | "anotacoes" | "notificacoes" | "config">(null);
  /* painel de resultados do hub inteiro — some ao escolher, ao apagar e no Esc */
  const [buscaAberta, setBuscaAberta] = useState(false);
  const dados = useHubDados();
  // Bolinha do sino: não lidas reais quando a rota fornece as notificações.
  const naoLidas = dados.notificacoes?.filter((n) => !n.lida).length ?? 0;
  // Badge de Mensagens: conversas com novidade (real) ou o número da tela (demo).
  const badge = dados.conversas
    ? conversasNaoLidas(dados.conversas, dados.meuId)
      + chatGeralNaoLido(dados.chatGeral, dados.meuId)
      + chatDiretoNaoLidos(dados.chatDireto, dados.meuId)
    : badgeMensagens;
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  /* Preferência "som ao chegar mensagem": quando o contador de novidade do
     Chat AUMENTA, bipa (tocarBip já respeita o som da máquina) e, se a aba
     está em segundo plano, o título/ícone piscam e o Windows avisa. */
  const badgeAnterior = useRef<number | null>(null);
  useEffect(() => {
    const atual = typeof badge === "number" ? badge : 0;
    const antes = badgeAnterior.current;
    badgeAnterior.current = atual;
    if (antes === null || atual <= antes) return;  // primeira leitura ou nada novo
    if (dados.prefs?.som !== false) tocarBip();    // desligável nas Preferências
    piscarTitulo("Mensagem nova no Chat");
    notificarNativo("Mensagem nova no Chat");
  }, [badge, dados.prefs]);
  return (
    <>
    {modalTopo === "mensagens" && <MensagensModalV1a fechar={() => setModalTopo(null)} />}
    {modalTopo === "anotacoes" && <AnotacoesModalV1a fechar={() => setModalTopo(null)} />}
    {modalTopo === "notificacoes" && <NotificacoesModalV1a fechar={() => setModalTopo(null)} />}
    {modalTopo === "config" && <ConfigModalV1a nome={nome} fechar={() => setModalTopo(null)} />}
    <div style={{ flex: "none", background: "#fff", borderRadius: 10, padding: 10, marginBottom: 14, boxShadow: "0 1px 0 rgba(0,0,0,.04), 0 20px 40px -34px rgba(0,0,0,.25)" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0, display: "flex", gap: 10, alignItems: "stretch" }}>
          {/* Data — caixa alta 13,5 */}
          <div className="select-none" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", padding: "0 20px", borderRadius: 7, font: "500 13.5px/1 Inter, sans-serif", letterSpacing: ".04em", color: INK, textTransform: "uppercase", background: "#fff" }}>
            {dataLonga(agora)}
          </div>
          {/* Pesquisa — ocupa todo o espaço livre, borda 3px #F1F1F1.
              `relative` porque o painel de resultados do hub inteiro cai
              ancorado neste campo. */}
          <div style={{ position: "relative", flex: "1 1 auto", display: "flex", alignItems: "center", gap: 12, borderRadius: 7, padding: "0 20px", background: "#fff", border: `3px solid ${FUNDO}` }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="2.4" strokeLinecap="round" style={{ flex: "none" }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input
              ref={inputRef}
              value={busca}
              onChange={(e) => { aoBuscar(e.target.value); setBuscaAberta(true); }}
              onFocus={() => setBuscaAberta(true)}
              placeholder="Pesquisa"
              style={{ flex: 1, border: 0, outline: 0, background: "transparent", font: "400 15px/1 Inter, sans-serif", color: INK, padding: "15px 0" }}
            />
            {busca && (
              <button onClick={() => { aoBuscar(""); setBuscaAberta(false); }} title="Limpar" className="r2ic"
                style={{ flex: "none", width: 24, height: 24, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 999, cursor: "pointer" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8d8b8d" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
              </button>
            )}
            {buscaAberta && (
              <BuscaGlobalV1a
                consulta={busca}
                pedidos={dados.buscaPedidos}
                paginas={dados.paginasDisponiveis}
                aoAbrirPedido={dados.aoAbrirPedido}
                aoNavegar={dados.aoNavegar}
                aoFechar={() => setBuscaAberta(false)}
              />
            )}
          </div>
        </div>
        {/* `stretch`: os botões acompanham a altura da pesquisa (o zoom, com
            altura própria, se centraliza sozinho) — com `center` eles encolhiam
            para a altura do texto */}
        <div style={{ flex: "0 0 auto", display: "grid", gridTemplateColumns: "auto 184px 184px auto", gap: 10, minWidth: 0, alignItems: "stretch" }}>
          {/* zoom — à mão na topbar, sem entrar em Preferências */}
          <ZoomControleV1a compacto />
          {/* Chat — 184px, borda 3, badge preta */}
          <button onClick={() => { setModalTopo("mensagens"); onMensagens?.(); }} className="r2chip" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11, border: `3px solid ${FUNDO}`, borderRadius: 7, padding: "0 20px", cursor: "pointer", font: "500 15px/1 Inter, sans-serif", color: INK, background: "#fff" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="m3.5 7 8.5 5.5L20.5 7" /></svg>
            <span style={{ lineHeight: "18px" }}>Chat</span>
            {!!badge && (
              <span style={{ flex: "none", width: 19, height: 19, display: "flex", alignItems: "center", justifyContent: "center", background: INK, color: AMARELO, font: "800 13.5px/19px Inter, sans-serif", borderRadius: 999, textIndent: ".02em" }}>
                {badge}
              </span>
            )}
          </button>
          {/* Anotações — amarelo */}
          <button onClick={() => { setModalTopo("anotacoes"); onAnotacoes?.(); }} className="r2chip" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11, background: AMARELO, border: 0, borderRadius: 7, padding: "0 20px", cursor: "pointer", font: "600 15px/1 Inter, sans-serif", color: INK }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
            <span style={{ lineHeight: "18px" }}>Anotações</span>
          </button>
          {/* Bloco do usuário — preto, nome Fraunces amarelo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, background: INK, borderRadius: 7, padding: "0 12px 0 22px", minWidth: 0 }}>
            <span className="select-none truncate" style={{ ...fr(24, 700), fontSize: 16, color: AMARELO, lineHeight: 1, transform: "translateY(1px)", maxWidth: 140 }}>
              {nome}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <button onClick={() => { setModalTopo("notificacoes"); onNotificacoes?.(); }} title={naoLidas ? `${naoLidas} notificações não lidas` : "Notificações"} className="r2ic" style={{ position: "relative", width: 38, height: 38, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 5, cursor: "pointer" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8" /><path d="M10.3 19.5a2 2 0 0 0 3.4 0" /></svg>
                {naoLidas > 0 && (
                  <span style={{ position: "absolute", top: 5, right: 5, minWidth: 8, height: 8, borderRadius: 999, background: AMARELO }} />
                )}
              </button>
              <button onClick={() => { setModalTopo("config"); onConfig?.(); }} title="Preferências" className="r2ic" style={{ width: 38, height: 38, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 5, cursor: "pointer" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 12 4.1V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0 1.2 2.9h.07a2 2 0 1 1 0 4H19.4" /></svg>
              </button>
              <button onClick={onSair} title="Sair" className="r2ic" style={{ width: 38, height: 38, display: "grid", placeItems: "center", background: "transparent", border: 0, borderRadius: 5, cursor: "pointer" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5" /><path d="M10 8.5 6 12l4 3.5" /><path d="M6 12h8" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

/* ————— Rail (README §Chrome: 76px preto, hover 238px) ————— */
/** As 16 páginas na ordem do workflow, com os ícones SVG do protótipo. */
export const PAGINAS_V1A: { label: string; paths: string[] }[] = [
  { label: "Home", paths: ["M4 10.5 12 3.5l8 7", "M6 10v10.5h12V10", "M10 20.5v-5.5h4v5.5"] },
  { label: "Central", paths: ["M3.5 3.5h7v7h-7z", "M13.5 3.5h7v4.5h-7z", "M13.5 12h7v8.5h-7z", "M3.5 13.5h7v7h-7z"] },
  { label: "Pedidos", paths: ["M6.5 3.5h11v17h-11z", "M9.5 8h5", "M9.5 12h5", "M9.5 16h3"] },
  { label: "Aprovação", paths: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0", "m8 12.5 2.8 2.8 5.7-5.8"] },
  { label: "Fábrica", paths: ["M20.5 16a8.5 8.5 0 1 0-17 0", "M12 16l4.2-4.6", "M3.5 20h17"] },
  { label: "OP", paths: ["M3.5 6.5v11", "M6.5 6.5v11", "M9.5 6.5v11", "M13 6.5v11", "M16.5 6.5v11", "M20.5 6.5v11"] },
  { label: "Apontamentos", paths: ["M4 20.5h16", "M7 20.5V13", "M11.5 20.5V8", "M16 20.5v-6", "M20 20.5V4.5"] },
  { label: "Facas", paths: ["M4 8.5h16v7H4z", "M4 8.5 20 15.5", "M20 8.5 4 15.5"] },
  { label: "Afiação", paths: ["M6.5 6.5 20 20", "M20 4 10.5 13.5", "M6 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5", "M6 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"] },
  { label: "Estoque", paths: ["M2.5 6.5h11v10h-11z", "M13.5 10.5h4l3 3.5v2.5h-7z", "M7 20.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4", "M18 20.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4"] },
  { label: "Mural", paths: ["M3.5 4.5h17v13h-17z", "M8 20.5h8", "M12 17.5v3"] },
  { label: "Pantone", paths: ["M12 3.5c-3.5 4.2-5.5 7-5.5 9.4a5.5 5.5 0 0 0 11 0c0-2.4-2-5.2-5.5-9.4z", "M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"] },
  { label: "Calculadoras", paths: ["M5.5 2.5h13v19h-13z", "M8.5 6.5h7", "M9 12h2.6", "M10.3 10.7v2.6", "M13.4 12H16", "M9 16.6h2.6", "M13.4 16h2.6", "M13.4 17.9h2.6"] },
  { label: "ANVISA", paths: ["M12 3.5 5 6v6c0 4.2 2.9 7.4 7 8.5 4.1-1.1 7-4.3 7-8.5V6z", "m8.8 12.2 2.3 2.3 4.1-4.4"] },
  { label: "Arquivos", paths: ["M4 6.5h16v4H4z", "M5.5 10.5v9h13v-9", "M9.5 14.5h5"] },
  { label: "Clientes", paths: ["M3.5 19.5v-13h6l2 2.5h9v10.5z", "M3.5 6.5v13", "M8 13h8"] },
  { label: "Equipe", paths: ["M9 11.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4", "M3.5 20.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5", "M16 11a2.6 2.6 0 1 0 0-5.2", "M17 14.6c2 .7 3.5 2.6 3.5 4.9"] },
];

/**
 * Nome que aparece na tela quando ele é diferente da CHAVE da página. A chave
 * ("Apontamentos") continua valendo por dentro — é ela que está guardada nas
 * permissões de cada conta e nos atalhos que o pessoal já escolheu na Home;
 * trocar a chave apagaria essas escolhas.
 */
export const NOME_EXIBIDO_V1A: Record<string, string> = {
  Apontamentos: "Relatórios",
};
export const nomeDaPagina = (label: string) => NOME_EXIBIDO_V1A[label] ?? label;

/* Marca R2 — símbolo (fechado) e wordmark (hover), SVGs do protótipo. */
const MARCA_PATHS = [
  "M361.06,249.82H34.29c-18.91,0-34.29-15.38-34.29-34.29V34.29C0,15.38,15.38,0,34.29,0h361.06v215.52c0,18.91-15.38,34.29-34.29,34.29ZM34.29,16.95c-9.56,0-17.34,7.78-17.34,17.34v181.23c0,9.56,7.78,17.34,17.34,17.34h326.77c9.56,0,17.34-7.78,17.34-17.34V16.95H34.29Z",
  "M134.87,140.93c9.01-4.43,15.88-10.82,20.64-19.14,4.76-8.32,7.14-17.38,7.14-28.96s-2.34-19.69-7.02-28.24c-4.67-8.55-11.47-15.17-20.36-19.86-8.89-4.69-19.61-7.03-32.15-7.03H37.58v174.54h35.12v-64.66h25.39l31.71,64.66h38.77l-35.46-70.52c.59-.26,1.2-.5,1.76-.78ZM72.7,67.87h23.69c6.76,0,12.37,1.04,16.83,3.11,4.46,2.09,7.78,5.1,9.97,9.08,2.19,3.98,3.29,6.98,3.29,12.78s-1.1,9.63-3.29,13.49c-2.19,3.87-5.5,6.76-9.93,8.69-4.43,1.93-10,2.89-16.71,2.89h-23.85v-50.04Z",
  "M255.19,177.79c9.88-11.57,32.82-39.62,45.69-64.89,5.92-10.81,9.98-21.11,10.29-29.38.59-15.37-4.4-27.23-15.05-35.79-10.33-8.32-24.89-12.6-43.74-12.84-.57-.02-1.13-.02-1.7-.02-.22,0-.41.03-.62.03-.22,0-.44-.01-.66-.02-.57-.02-1.13-.02-1.7-.02-19.23,0-34.17,4.83-44.68,14.27-10.53,9.56-15.73,23.07-15.73,40.54v8.98h37.23v-6.8c0-8.35,2.03-14.92,6.33-19.88,3.75-4.43,8.59-6.83,14.7-7.27,6.46.37,11.6,2.32,15.54,5.86,4.3,3.84,6.45,9.22,6.45,16.14,0,4.93-3.05,13.28-5.32,17.13-14.88,25.22-63.51,91.08-77.84,108.39h2.9s.76,0,.76,0h124.22v-34.44h-57.1Z",
];
const MARCA_EXTRA = (
  <>
    <polygon points="351.63 206.21 345.77 206.21 345.77 197.79 339.71 197.79 339.71 206.21 334.76 206.21 334.76 197.2 328.81 197.2 328.81 212.23 357.69 212.23 357.69 196.91 351.63 196.91 351.63 206.21" />
    <polygon points="334.76 176.84 328.81 176.84 328.81 194.54 334.76 194.54 334.76 188.76 357.69 188.76 357.69 182.62 334.76 182.62 334.76 176.84" />
    <rect x="328.81" y="168.04" width="28.87" height="6.14" />
    <polygon points="328.81 112.62 357.69 112.62 357.69 97.29 351.63 97.29 351.63 106.6 345.77 106.6 345.77 98.18 339.71 98.18 339.71 106.6 334.76 106.6 334.76 97.58 328.81 97.58 328.81 112.62" />
    <polygon points="328.81 94.92 334.76 94.92 334.76 89.03 357.69 89.03 357.69 83.01 334.76 83.01 334.76 77.11 328.81 77.11 328.81 94.92" />
    <path d="M357.68,61.87v-6.88l-28.86,9.56v6.57l28.86,9.43v-6.55l-5.93-1.62v-8.55l5.93-1.96ZM346.05,65.3v5.33l-8.95-2.63,8.95-2.7Z" />
    <path d="M359.83,139.7l-5.32,3.88c-2.82-2.78-6.92-4.36-11.31-4.36-8.45,0-15.07,5.84-15.07,13.3s6.48,13.3,15.07,13.3,15.09-5.72,15.09-13.3c0-1.61-.31-3.17-.91-4.66l2.45-1.88v-6.28ZM343.19,145.56c2.33,0,4.48.62,6.11,1.76l-2.1,1.48v6.28l4.89-3.64c.07.37.11.73.11,1.09,0,3.98-3.87,6.99-9.01,6.99s-9.01-3-9.01-6.99,3.87-6.97,9.01-6.97Z" />
    <path d="M351.32,129.61c-.96.84-2.46,1.27-4.45,1.27h-18.07v6.02h18.85c3.48,0,6.26-.97,8.04-2.79,1.78-1.7,2.68-4.42,2.68-8.08s-.87-6.23-2.67-8.07c-1.74-1.78-4.44-2.68-8.05-2.68h-18.85v6.02h18.07c2.1,0,3.43.35,4.45,1.16.96.84,1.42,2.01,1.42,3.58s-.48,2.85-1.42,3.58Z" />
    <path d="M336.5,54.48c1.83,0,3.42-.46,4.57-1.33,1.23-.84,2.39-2.31,3.89-4.93.22-.48.57-1.09,1.04-1.85,1.18-2.3,2.47-3.61,3.54-3.61s1.7.31,2.31,1.07c.55.71.83,1.62.83,2.71s-.22,1.83-.74,2.61c-.53.8-1.32,1.4-2.26,1.74l-1.4.46,4.67,3.9.88-.44c1.53-.82,2.62-1.9,3.33-3.31.83-1.53,1.22-3.23,1.22-5.34,0-2.81-.85-5.21-2.45-6.93-1.68-1.8-3.79-2.64-6.63-2.64-1.82,0-3.44.52-4.95,1.6-1.4,1.12-2.62,2.77-3.76,5.09-.06.2-.18.43-.31.68-.08.16-.16.32-.25.5-1.24,2.54-2.4,3.73-3.65,3.73-.77,0-1.47-.3-1.98-.85-.44-.48-.69-1.29-.69-2.3s.14-1.62.52-2.14c.27-.48.84-.93,1.65-1.3l.63-.29-4.15-3.98-.31.21c-1.34.91-2.33,1.98-2.95,3.17-.64,1.24-.98,2.7-.98,4.21,0,2.89.74,5.09,2.34,6.93,1.64,1.75,3.67,2.64,6.05,2.64Z" />
  </>
);

export function MarcaR2({ width = 46, height = 29, style }: { width?: number; height?: number; style?: CSSProperties }) {
  return (
    <svg className="r2mark" width={width} height={height} viewBox="0 0 395.36 249.82" fill={AMARELO} style={style}>
      {MARCA_PATHS.map((d, i) => <path key={i} d={d} />)}
      {MARCA_EXTRA}
    </svg>
  );
}

function WordmarkR2({ style }: { style?: CSSProperties }) {
  return (
    <svg className="r2word" width="155" height="21" viewBox="0 0 422.5 57.52" fill={AMARELO} style={style}>
      <polygon points="114.41 42.64 114.41 32.02 129.68 32.02 129.68 21.03 114.41 21.03 114.41 12.05 130.76 12.05 130.76 1.27 103.48 1.27 103.48 53.64 131.28 53.64 131.28 42.64 114.41 42.64" />
      <polygon points="167.67 12.05 167.67 1.27 135.58 1.27 135.58 12.05 146.06 12.05 146.06 53.64 157.19 53.64 157.19 12.05 167.67 12.05" />
      <rect x="172.5" y="1.27" width="11.13" height="52.37" />
      <polygon points="284.58 1.27 284.58 53.64 312.38 53.64 312.38 42.64 295.5 42.64 295.5 32.02 310.78 32.02 310.78 21.03 295.5 21.03 295.5 12.05 311.85 12.05 311.85 1.27 284.58 1.27" />
      <polygon points="316.68 1.27 316.68 12.05 327.36 12.05 327.36 53.64 338.29 53.64 338.29 12.05 348.98 12.05 348.98 1.27 316.68 1.27" />
      <path d="M376.62,53.62h12.48L371.76,1.28h-11.92l-17.11,52.34h11.88l2.93-10.75h15.51l3.56,10.75ZM370.41,32.53h-9.67l4.77-16.23,4.9,16.23Z" />
      <path d="M235.03,57.52l-7.03-9.65c5.04-5.12,7.91-12.55,7.91-20.52C235.91,12.02,225.31,0,211.79,0s-24.12,11.75-24.12,27.34,10.37,27.37,24.12,27.37c2.91,0,5.75-.56,8.45-1.65l3.41,4.45h11.39ZM224.4,27.35c0,4.23-1.13,8.12-3.2,11.08l-2.68-3.81h-11.39l6.61,8.88c-.66.13-1.33.2-1.98.2-7.23,0-12.68-7.02-12.68-16.33s5.45-16.33,12.68-16.33,12.64,7.02,12.64,16.33Z" />
      <path d="M253.33,42.1c-1.53-1.75-2.3-4.46-2.3-8.06V1.27h-10.92v34.2c0,6.31,1.76,11.36,5.06,14.58,3.09,3.23,8.02,4.86,14.66,4.86s11.3-1.58,14.64-4.84c3.23-3.15,4.87-8.06,4.87-14.6V1.27h-10.92v32.76c0,3.8-.63,6.23-2.09,8.06-1.52,1.74-3.64,2.58-6.48,2.58s-5.18-.88-6.49-2.58Z" />
      <path d="M390.03,15.21c0,3.32.84,6.2,2.41,8.29,1.53,2.24,4.18,4.34,8.94,7.05.87.4,1.98,1.03,3.36,1.89,4.16,2.14,6.55,4.48,6.55,6.42s-.56,3.09-1.93,4.18c-1.29,1-2.94,1.51-4.91,1.51s-3.33-.4-4.73-1.34c-1.45-.97-2.54-2.39-3.15-4.09l-.84-2.54-7.08,8.47.8,1.6c1.48,2.77,3.45,4.75,6,6.05,2.78,1.51,5.85,2.21,9.68,2.21,5.1,0,9.45-1.54,12.57-4.45,3.27-3.05,4.8-6.87,4.8-12.02,0-3.31-.94-6.23-2.9-8.98-2.04-2.54-5.02-4.75-9.23-6.82-.37-.11-.77-.32-1.24-.56-.28-.14-.58-.3-.9-.45-4.61-2.25-6.76-4.36-6.76-6.62,0-1.4.55-2.67,1.54-3.6.86-.81,2.34-1.25,4.17-1.25s2.93.25,3.88.95c.87.49,1.68,1.52,2.36,2.99l.52,1.14,7.23-7.52-.39-.57c-1.66-2.43-3.59-4.23-5.74-5.34-2.25-1.17-4.89-1.78-7.63-1.78-5.24,0-9.23,1.34-12.57,4.24-3.18,2.97-4.8,6.66-4.8,10.97Z" />
      <path d="M29.45,32.25c2.7-1.33,4.76-3.25,6.19-5.74,1.43-2.5,2.14-5.21,2.14-8.69s-.7-5.91-2.1-8.47c-1.4-2.57-3.44-4.55-6.11-5.96-2.67-1.41-5.88-2.11-9.65-2.11H.26v52.36h10.54v-19.4h7.62l9.51,19.4h11.63l-10.64-21.16c.18-.08.36-.15.53-.23ZM10.8,10.33h7.11c2.03,0,3.71.31,5.05.93,1.34.63,2.33,1.53,2.99,2.72s.99,2.09.99,3.83-.33,2.89-.99,4.05c-.66,1.16-1.65,2.03-2.98,2.61-1.33.58-3,.87-5.01.87h-7.15v-15.01Z" />
      <path d="M65.28,43.31c2.96-3.47,9.85-11.89,13.71-19.47,1.78-3.24,2.99-6.33,3.09-8.81.18-4.61-1.32-8.17-4.52-10.74-3.1-2.49-7.47-3.78-13.12-3.85-.17,0-.34,0-.51,0-.07,0-.12,0-.18.01-.07,0-.13,0-.2,0-.17,0-.34,0-.51,0-5.77,0-10.25,1.45-13.4,4.28-3.16,2.87-4.72,6.92-4.72,12.16v2.69h11.17v-2.04c0-2.5.61-4.48,1.9-5.96,1.13-1.33,2.58-2.05,4.41-2.18,1.94.11,3.48.69,4.66,1.76,1.29,1.15,1.93,2.77,1.93,4.84,0,1.48-.91,3.99-1.59,5.14-4.46,7.57-19.05,27.32-23.35,32.52h.87s.23,0,.23,0h37.27v-10.33h-17.13" />
    </svg>
  );
}

/** Páginas v1a já construídas no app — fallback do rail quando a tela não
    passa a própria lista. */
export const PAGINAS_PRONTAS_V1A = ["Home", "Central", "Pedidos", "Aprovação", "Fábrica", "OP", "Apontamentos", "Facas", "Afiação", "Estoque", "Mural", "Pantone", "Calculadoras", "Arquivos", "Clientes", "Equipe"];

/** Pseudo-item do rail: entra em `permitidas` quando a pessoa pode abrir
    pedido (pedidos.criar) e é o que liga o botão "+" no topo. */
export const NOVO_PEDIDO_V1A = "Novo pedido";

/** Rail preto de 76px: "+" amarelo no topo, 16 páginas do workflow e a
    marca R2 no pé. Expande no hover via CSS (.r2rail em styles.css). */
export function RailV1a({ ativo, disponiveis = PAGINAS_PRONTAS_V1A, permitidas, aoNavegar, onNovo, versao }: {
  /** label da página atual (fundo #3a383a, ícone/texto amarelos) */
  ativo: string;
  /** labels que JÁ TÊM tela no app — as demais aparecem apagadas, "em breve" */
  disponiveis?: string[];
  /** labels que ESTE usuário pode abrir — as demais somem do rail.
      "em breve" é sobre o app; sem permissão a página simplesmente não existe
      para a pessoa, e mostrá-la apagada só geraria dúvida. */
  permitidas?: string[];
  aoNavegar: (label: string) => void;
  onNovo: () => void;
  versao?: string;
}) {
  return (
    <div style={{ position: "relative", flex: "0 0 76px" }}>
      <div className="r2rail" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 76, overflow: "hidden", display: "flex", flexDirection: "column", gap: 5, background: INK, borderRadius: 10, padding: "18px 0", zIndex: 20, boxShadow: "0 20px 50px -20px rgba(0,0,0,.5)" }}>
        {/* Botão + (Nova solicitação) — só para quem pode abrir pedido
            (pedidos.criar). Sem a permissão fica o espaço vazio: os ícones
            continuam na mesma altura para todo mundo. */}
        {(!permitidas || permitidas.includes(NOVO_PEDIDO_V1A)) ? (
          <button onClick={onNovo} title="Novo pedido" style={{ display: "flex", alignItems: "center", gap: 12, width: "calc(100% - 30px)", margin: "0 15px 9px", padding: 0, height: 46, border: 0, borderRadius: 7, cursor: "pointer", textAlign: "left", background: "transparent" }}>
            <span style={{ flex: "0 0 46px", height: 46, display: "grid", placeItems: "center", background: AMARELO, borderRadius: 7 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5.5v13" /><path d="M5.5 12h13" /></svg>
            </span>
            <span className="r2lbl" style={{ alignSelf: "stretch", display: "flex", alignItems: "center", font: "700 15px/1.15 Inter, sans-serif", letterSpacing: "-.005em", whiteSpace: "nowrap", color: AMARELO }}>Novo pedido</span>
          </button>
        ) : (
          <div aria-hidden style={{ flex: "none", height: 46, margin: "0 15px 9px" }} />
        )}

        {/* A lista de páginas rola POR DENTRO quando o palco está baixo
            (monitor 1366×768 comprimido): sem isso os itens estouravam o rail
            e o logo R2 do pé sumia. Scrollbar escondida (classe r2rail-lista). */}
        <div className="r2rail-lista" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
        {PAGINAS_V1A.filter((p) => !permitidas || permitidas.includes(p.label) || !disponiveis.includes(p.label)).map((p) => {
          const on = ativo === p.label;
          const temPag = disponiveis.includes(p.label);
          const nome = nomeDaPagina(p.label);
          return (
            <button
              key={p.label}
              onClick={() => { if (temPag && !on) aoNavegar(p.label); }}
              title={temPag ? nome : `${nome} · em breve`}
              className="r2ic"
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "calc(100% - 30px)", margin: "0 15px", padding: 0, height: 46,
                border: 0, borderRadius: 7, cursor: temPag ? "pointer" : "default", textAlign: "left",
                background: on ? "#3a383a" : "transparent", opacity: temPag ? 1 : 0.42,
              }}
            >
              <span style={{ flex: "0 0 46px", height: 46, display: "grid", placeItems: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={on ? AMARELO : "#f1f1f1"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  {p.paths.map((d, i) => <path key={i} d={d} />)}
                </svg>
              </span>
              <span className="r2lbl" style={{ alignSelf: "stretch", display: "flex", alignItems: "center", font: "600 15px/1.15 Inter, sans-serif", letterSpacing: "-.005em", whiteSpace: "nowrap", color: on ? AMARELO : "#f1f1f1" }}>
                {temPag ? nome : `${nome} · em breve`}
              </span>
            </button>
          );
        })}

        </div>
        {/* Pé: versão + marca (símbolo ⇄ wordmark no hover) — sempre visível */}
        <div style={{ padding: "0 15px" }}>
          <span className="r2lbl select-none" style={{ display: "block", font: "400 12.5px/1 Inter, sans-serif", color: "#8d8b8d", letterSpacing: ".1em", whiteSpace: "nowrap", marginBottom: 8 }}>
            {versao ?? "V. 0.01"}
          </span>
          <div style={{ position: "relative", height: 40 }}>
            <MarcaR2 style={{ top: 6 }} />
            <WordmarkR2 style={{ top: 10 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ————— Aviso (pílula preta no rodapé, dispensável) ————— */
/** `tipo="alerta"` troca o ✓ por "!": o aviso de erro saía com o sinal de
    feito (simulação de 28/09/2026). */
export function AvisoV1a({ texto, onFechar, tipo = "ok" }: { texto: string; onFechar: () => void; tipo?: "ok" | "alerta" }) {
  return (
    <div role={tipo === "alerta" ? "alert" : "status"} style={{ position: "absolute", left: "50%", bottom: 34, transform: "translateX(-50%)", zIndex: 70, display: "flex", alignItems: "center", gap: 12, background: INK, borderRadius: 999, padding: "14px 16px 14px 22px", boxShadow: "0 30px 60px -20px rgba(0,0,0,.6)" }}>
      {tipo === "alerta" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="M12 7.6v5.2" /><path d="M12 16.4h.01" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMARELO} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="8.6" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>
      )}
      <span style={{ font: "500 15px/1 Inter, sans-serif", color: "#f1f1f1" }}>{texto}</span>
      <button onClick={onFechar} className="r2ic" style={{ width: 30, height: 30, display: "grid", placeItems: "center", background: "#3a383a", border: 0, borderRadius: 999, cursor: "pointer" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth="2.8" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
