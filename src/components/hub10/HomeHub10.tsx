// Home do Hub 1.0, no desenho v4 do Augusto (05/10/2026: "a nova versão da
// home", hubv3/v4/Home.svg).
//
// O desenho tira a faixa preta, o título grande, a faixa da agenda e o
// calendário fixo: a página fica com o fundo das telas v4, a ilustração no
// meio e, no pé, o relógio, seis pílulas e o "Contamos com você, sempre!".
// Cada pílula abre a sua camada para cima, presa nela, como os filtros das
// telas v4 (Pedidos): Agenda, Calendário, Chat, Sugestões, Tutoriais e Resumo.
// A pílula ligada fica no amarelo do hub; ESC ou um clique fora fecham.
//
// Medidas do pé tiradas do SVG: pílulas com 41,83 de altura e traço de 2,21
// em y 970,94, nos x e larguras do desenho; o texto delas e o do lema em Inter
// 400 a 20,5 com -0,014em (o que reproduz a largura da tinta do desenho); o
// relógio em Fraunces 40 SemiBold com -0,02em, tinta na c1 e base em 1007,88.
//
// Dados reais, os mesmos da Home anterior:
//   · agenda e calendário → user_notas (a nota guarda o dia em ISO);
//   · entregas do dia → pedidos em aberto pelo prazoDoPedido;
//   · chat → o canal geral da equipe (o mesmo do hub antigo);
//   · sugestões → tabela `sugestoes`; ilustração → preferência ou cargo.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, KeyboardEvent as TeclaReact, ReactNode } from "react";

import { chatGeralNaoLido, ilustDaHome, marcarVista, useHubDados } from "../v1a/HubDadosV1a";
import { AvisoV1a } from "../v1a/HubV1a";
import {
  AMARELO, AREA_TEXTO, BOTAO_CLARO, BOTAO_ESCURO, BarraTopoHub10, FECHAR_X, FR, FUNDO_PAGINA, INTER, NIVEL, PRETO, PalcoFixo, useEscDoTopo, vigiarRolagem,
} from "./ChromeHub10";
import { baseFraunces, baseInter, folgaDireitaInter, folgaFR } from "./grade-hub10";
import { feriadoEm } from "@/lib/feriados";
import { prazoDoPedido } from "@/lib/prazo";
import type { SessionUser } from "@/lib/session";
import { GRUPOS_DE_TELAS, TELA_GERAL } from "@/lib/telas-do-hub";
import { PALETA } from "@/lib/paleta-hub";
import { getMeuResumo } from "@/lib/api/resumo.functions";
import { listTutoriais } from "@/lib/api/tutoriais.functions";
import { useApresentacao } from "./ApresentacaoHub10";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const CINZA = "#6f6d6f";

const iso = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const hojeIso = () => { const h = new Date(); return iso(h.getFullYear(), h.getMonth(), h.getDate()); };

/** Dia (ISO) de uma nota. Nota nova grava ISO; nota antiga tem "dd/mm" e o
    ano é o em que foi criada (sem isso "07/08" de 2026 cairia em todo ano). */
function diaDaNota(quando?: string | null, criadoEm?: string): string | null {
  if (!quando) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(quando)) return quando;
  const m = quando.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const ano = criadoEm && !Number.isNaN(new Date(criadoEm).getTime()) ? new Date(criadoEm).getFullYear() : new Date().getFullYear();
  return iso(ano, Number(m[2]) - 1, Number(m[1]));
}

/* ————— o pé, medido no Home.svg ————— */
type Camada = "agenda" | "calendario" | "chat" | "sugestoes" | "tutoriais" | "resumo";
const PILULAS: { k: Camada; rotulo: string; x: number; w: number }[] = [
  { k: "agenda", rotulo: "Agenda", x: 479.18, w: 141.08 },
  { k: "calendario", rotulo: "Calendário", x: 638.75, w: 159.68 },
  { k: "chat", rotulo: "Chat", x: 816.39, w: 103.65 },
  { k: "sugestoes", rotulo: "Sugestões", x: 938.71, w: 151.43 },
  { k: "tutoriais", rotulo: "Tutoriais", x: 1110.81, w: 135.45 },
  { k: "resumo", rotulo: "Resumo", x: 1265.22, w: 135.45 },
];
const PILULA_Y = 970.94, PILULA_H = 41.83, PILULA_B = 2.21;
const TOPO_PILULA = PILULA_Y - PILULA_B / 2;
const PILULA: CSSProperties = {
  position: "absolute", top: TOPO_PILULA, height: PILULA_H + PILULA_B, boxSizing: "border-box",
  border: `${PILULA_B}px solid ${PRETO}`, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "2px 0 0", fontFamily: INTER, fontSize: 20.5, fontWeight: 400, letterSpacing: "-.014em", color: PRETO,
  whiteSpace: "nowrap", cursor: "pointer", zIndex: 30,
};
/* as camadas sobem 16 acima das pílulas e não passam da barra do topo */
const BASE_CAMADA = 1080 - TOPO_PILULA + 16;
const ALTURA_MAX_CAMADA = TOPO_PILULA - 16 - 132;
const LARGURA: Record<Camada, number> = { agenda: 560, calendario: 880, chat: 560, sugestoes: 480, tutoriais: 720, resumo: 640 };

type Tutorial = { arquivo: string; titulo: string; tamanhoMB: number; versao: number };
/* o tutorial aberto num player: de onde começa e se já sai tocando */
type TutAberto = { tut: Tutorial; inicio: number; tocar: boolean };
/* o tutorial no lugar do papel de parede começa na linha 8 da grade (67 linhas) */
const TOPO_TUTORIAL = 8 * (1080 / 67);
/* O ESC que sai da tela cheia não pode fechar também a camada nem o tutorial
   grande: na tela cheia, ou logo depois de sair dela, o ESC é do navegador. */
let saiuDaTelaCheiaEm = 0;
if (typeof document !== "undefined") {
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) saiuDaTelaCheiaEm = performance.now(); });
}
const acabouDeSairDaTelaCheia = () => !!document.fullscreenElement || performance.now() - saiuDaTelaCheiaEm < 500;
type MeuResumo = { criados: number; artes: number; aprovados: number; alteracoesPedidas: number; alteracoesAtendidas: number; clicheria: number; finalizados: number; respostas: number };
/* o que entra no Resumo, nesta ordem, com singular e plural */
const ITENS_RESUMO: [keyof MeuResumo, string, string][] = [
  ["criados", "pedido criado", "pedidos criados"],
  ["artes", "arte enviada", "artes enviadas"],
  ["aprovados", "pedido aprovado", "pedidos aprovados"],
  ["alteracoesPedidas", "alteração pedida", "alterações pedidas"],
  ["alteracoesAtendidas", "alteração atendida", "alterações atendidas"],
  ["clicheria", "enviado à clicheria", "enviados à clicheria"],
  ["finalizados", "pedido finalizado", "pedidos finalizados"],
  ["respostas", "pergunta respondida", "perguntas respondidas"],
];

/* A ilustração no meio do espaço livre (de 128 a 946, 24 acima das pílulas):
   o deslocamento e a escala de cada desenho, medidos na caixa da tinta. */
const ENQUADRE: Record<string, { dx: number; dy: number; esc: number; cx: number; cy: number }> = {
  "/home10/home-vendas.svg": { dx: -294, dy: 1, esc: 0.917, cx: 1254, cy: 536 },
  /* a de vendas feita pelo Augusto no Claude Design (06/10/2026): a cena larga,
     tinta parada em 112, 91, 1652 × 891 (sem o retângulo de fundo da prancha);
     a mesma altura da antiga, então a mesma escala */
  "/home10/home-vendas-estilo.svg": { dx: 22, dy: 0.5, esc: 0.918, cx: 938, cy: 536.5 },
  "/home10/home-design.svg": { dx: -262, dy: -40, esc: 1, cx: 1222, cy: 576 },
  /* a de design no estilo da de vendas (06-07/10/2026: "faça a mesma coisa com a
     ilustração de design"): tinta parada em 149, 171, 1602 × 808 */
  "/home10/home-design-estilo.svg": { dx: 10, dy: -38, esc: 1.012, cx: 950, cy: 575 },
};

export function HomeHub10({ profile, pedidos, aoNavegar, onNova, onLogout, disponiveis, aoEnviarSugestao, children }: {
  profile: SessionUser;
  pedidos: any[];
  aoNavegar: (label: string) => void;
  onNova: () => void;
  onLogout: () => void;
  /** páginas que a pessoa pode abrir (mesma lista do rail V1a) */
  disponiveis?: string[];
  /** `tela`: de qual tela é a sugestão, um nome de lib/telas-do-hub */
  aoEnviarSugestao?: (texto: string, tela: string) => Promise<unknown>;
  /** modais hospedados pela rota */
  children?: ReactNode;
}) {
  const dados = useHubDados();

  /* ————— qual camada está aberta ————— */
  const [aberta, setAberta] = useState<Camada | null>(null);
  const fechar = useCallback(() => setAberta(null), []);
  /* a apresentação do hub (o tour interativo), para rever pela lista de Tutoriais */
  const apresentacao = useApresentacao();
  const fecharNoEsc = useCallback(() => { if (!acabouDeSairDaTelaCheia()) setAberta(null); }, []);
  useEscDoTopo(aberta !== null, NIVEL.verTodos, fecharNoEsc);
  /* clique fora da camada e das pílulas fecha */
  useEffect(() => {
    if (!aberta) return;
    const aoClicar = (e: MouseEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest?.("[data-home-camada], [data-home-pilula]")) return;
      setAberta(null);
    };
    document.addEventListener("mousedown", aoClicar);
    return () => document.removeEventListener("mousedown", aoClicar);
  }, [aberta]);

  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [, tick] = useState(0);
  /* relógio do pé */
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  /* ilustração: preferência da pessoa; sem escolha, o cargo decide */
  const ilust = ilustDaHome(dados.prefs, profile.role);
  /* As ilustrações são as originais, como estão (Augusto, 05/10/2026: "vamos
     ficar com as ilustrações originais"; as versões no estilo da FormFrom
     foram testadas e saíram). A de vendas ele mesmo refez no Claude Design,
     animada (06/10/2026: "a nova ilustração para o perfil de vendas na home");
     a de design seguiu o mesmo estilo e as mesmas animações ("faça a mesma
     coisa com a ilustração de design", "use a paleta do hub"). As antigas
     continuam em public/home10 (home-vendas.svg e home-design.svg). */
  const arquivoIlust = ilust === "Vendas" ? "/home10/home-vendas-estilo.svg" : "/home10/home-design-estilo.svg";
  const enq = ENQUADRE[arquivoIlust];
  /* papel de parede escolhido: substitui a ilustração, no espaço livre */
  const papel = dados.papelParede || "";

  /* ————— agenda ————— */
  const notas = dados.notas ?? [];
  const porDia = useMemo(() => {
    const m: Record<string, typeof notas> = {};
    for (const n of notas) {
      const d = diaDaNota(n.quando, n.created_at);
      if (!d) continue;
      (m[d] ||= []).push(n);
    }
    return m;
  }, [notas]);
  /* a lista: o que vem primeiro manda (pendente de hoje em diante, depois sem
     data, depois o passado, mais recente primeiro); as feitas no fim */
  const agenda = useMemo(() => {
    const hoje = hojeIso();
    const itens = notas.map((n) => {
      const dia = diaDaNota(n.quando, n.created_at);
      const p = dia ? dia.split("-").map(Number) : null;
      return { id: n.id, texto: n.texto, feito: n.feito, chave: dia, dia: p ? String(p[2]) : "", mes: p ? MABREV[p[1] - 1] : "s/d", criada: n.created_at ?? "" };
    });
    const ordem = (a: typeof itens[number], b: typeof itens[number]) => (a.chave ?? "9999").localeCompare(b.chave ?? "9999") || a.criada.localeCompare(b.criada);
    const pend = itens.filter((a) => !a.feito);
    return [
      ...pend.filter((a) => a.chave && a.chave >= hoje).sort(ordem),
      ...pend.filter((a) => !a.chave).sort(ordem),
      ...pend.filter((a) => a.chave && a.chave < hoje).sort(ordem).reverse(),
      ...itens.filter((a) => a.feito).sort(ordem),
    ];
  }, [notas]);
  const [selNota, setSelNota] = useState<string | null>(null);
  const [rascunhoAgenda, setRascunhoAgenda] = useState("");
  /* apagar anotação pergunta antes (simulação 5: apagava no clique, sem volta) */
  const [confirmarApagar, setConfirmarApagar] = useState<null | "dia" | "agenda">(null);
  const notaSel = agenda.find((a) => a.id === selNota) ?? null;
  const criarNota = (texto: string, dia: string, limpar: () => void) => {
    const t = texto.trim();
    if (!t || !dados.aoCriarNota) return;
    setOcupado(true);
    Promise.resolve(dados.aoCriarNota(t, dia))
      .then(limpar)
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para salvar a anotação."))
      .finally(() => setOcupado(false));
  };
  const apagarNota = (id: string) => {
    if (!dados.aoExcluirNota) return;
    void Promise.resolve(dados.aoExcluirNota(id)).catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para apagar."));
  };

  /* ————— calendário ————— */
  const hoje = new Date();
  const [verOffset, setVerOffset] = useState(0);
  const baseIdx = hoje.getFullYear() * 12 + hoje.getMonth();
  const minOffset = (2026 * 12) - baseIdx;
  const idx = baseIdx + verOffset;
  const vAno = Math.floor(idx / 12), vMes = idx % 12;
  const semAnterior = verOffset <= minOffset, semProximo = verOffset >= 36;
  const entregasPorDia = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const p of pedidos ?? []) {
      if (["concluido", "cancelado"].includes(p.status)) continue;
      const d = prazoDoPedido(p);
      const k = iso(d.getFullYear(), d.getMonth(), d.getDate());
      (m[k] ||= []).push(`${p.cliente}`);
    }
    return m;
  }, [pedidos]);
  const diasCal = useMemo(() => {
    const ehMesAtual = vAno === hoje.getFullYear() && vMes === hoje.getMonth();
    const inicio = new Date(vAno, vMes, 1).getDay();
    const total = new Date(vAno, vMes + 1, 0).getDate();
    const out: { txt: string; key: string | null; hoje: boolean; feriado: string }[] = [];
    for (let i = 0; i < inicio; i++) out.push({ txt: "", key: null, hoje: false, feriado: "" });
    for (let n = 1; n <= total; n++) {
      const key = iso(vAno, vMes, n);
      out.push({ txt: String(n), key, hoje: ehMesAtual && n === hoje.getDate(), feriado: feriadoEm(key)?.nome ?? "" });
    }
    while (out.length % 7 !== 0) out.push({ txt: "", key: null, hoje: false, feriado: "" });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vAno, vMes]);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [rascunhoDia, setRascunhoDia] = useState("");
  const dia = useMemo(() => {
    if (!diaSel) return null;
    const p = diaSel.split("-").map(Number);
    const minhas = porDia[diaSel] ?? [];
    const itens: { tipo: string; texto: string; feito?: boolean }[] = [
      ...(entregasPorDia[diaSel] ?? []).map((c) => ({ tipo: "Entrega", texto: c })),
      ...minhas.map((n) => ({ tipo: "Anotação", texto: n.texto, feito: n.feito })),
    ];
    return { titulo: `${p[2]} de ${MESES[p[1] - 1].toLowerCase()}`, feriado: feriadoEm(diaSel)?.nome ?? "", itens, ultima: minhas[minhas.length - 1] ?? null };
  }, [diaSel, porDia, entregasPorDia]);
  useEffect(() => { setConfirmarApagar(null); }, [diaSel, selNota, aberta]);

  /* ————— chat (canal geral) ————— */
  const chat = dados.chatGeral ?? [];
  const chatNovo = chatGeralNaoLido(dados.chatGeral, dados.meuId) > 0;
  const [rascunhoChat, setRascunhoChat] = useState("");
  const fimDoChat = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (aberta !== "chat") return;
    marcarVista("geral");
    fimDoChat.current?.scrollIntoView({ block: "end" });
  }, [aberta, chat.length]);
  const enviarChat = () => {
    const t = rascunhoChat.trim();
    if (!t || !dados.aoEnviarChat) return;
    setOcupado(true);
    Promise.resolve(dados.aoEnviarChat(t))
      .then(() => setRascunhoChat(""))
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para enviar a mensagem."))
      .finally(() => setOcupado(false));
  };

  /* ————— sugestões ————— */
  const [sugEnviada, setSugEnviada] = useState(false);
  const [sugTexto, setSugTexto] = useState("");
  const [sugTela, setSugTela] = useState(TELA_GERAL);
  useEffect(() => { if (aberta === "sugestoes") setSugEnviada(false); }, [aberta]);
  const enviarSug = () => {
    const t = sugTexto.trim();
    if (!t || !aoEnviarSugestao) return;
    setOcupado(true);
    Promise.resolve(aoEnviarSugestao(t, sugTela))
      .then(() => { setSugEnviada(true); setSugTexto(""); setSugTela(TELA_GERAL); })
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para enviar."))
      .finally(() => setOcupado(false));
  };

  /* ————— resumo: o que a própria pessoa fez no período (o histórico dos
     pedidos guarda quem fez cada coisa) ————— */
  const [resumoDias, setResumoDias] = useState(30);
  const resumoQ = useQuery({
    queryKey: ["meu-resumo", resumoDias],
    queryFn: () => getMeuResumo({ data: { dias: resumoDias } }) as Promise<MeuResumo>,
    enabled: aberta === "resumo",
  });

  /* ————— tutoriais: os vídeos de passo a passo da pasta da rede ————— */
  const tutQ = useQuery({
    queryKey: ["tutoriais"],
    queryFn: () => listTutoriais() as Promise<{ tutoriais: Tutorial[] }>,
    enabled: aberta === "tutoriais",
    staleTime: 60_000,
  });
  const [tutSel, setTutSel] = useState<TutAberto | null>(null);
  useEffect(() => { if (aberta !== "tutoriais") setTutSel(null); }, [aberta]);
  /* O vídeo no lugar do papel de parede (Augusto, 06/10/2026: "a opção de o
     vídeo ficar na área onde o papel de parede fica"; depois, no lugar do texto,
     "o ícone de aumentar tela no player do vídeo, como o YouTube faz"): o ícone
     de aumentar do player leva o vídeo para o meio da Home, continuando de onde
     estava; lá ele vira diminuir e devolve o vídeo à camada. O ✕ ou o ESC
     devolvem a ilustração (ou o papel); com uma camada aberta, o ESC fecha ela
     antes. */
  const [tutGrande, setTutGrande] = useState<TutAberto | null>(null);
  const fecharGrande = useCallback(() => { if (!acabouDeSairDaTelaCheia()) setTutGrande(null); }, []);
  useEscDoTopo(!!tutGrande, NIVEL.painel, fecharGrande);
  const aumentar = (tut: Tutorial, inicio: number, tocar: boolean) => { setTutGrande({ tut, inicio, tocar }); fechar(); };
  const diminuir = (tut: Tutorial, inicio: number, tocar: boolean) => { setTutGrande(null); setTutSel({ tut, inicio, tocar }); setAberta("tutoriais"); };

  const podeCriar = !disponiveis || disponiveis.includes("Novo pedido");
  const agora = new Date();
  const dois = (n: number) => String(n).padStart(2, "0");
  const relogio = `${dois(agora.getHours())}:${dois(agora.getMinutes())} - ${dois(agora.getDate())}/${dois(agora.getMonth() + 1)}/${String(agora.getFullYear()).slice(2)}`;
  const LEMA = "Contamos com você, sempre!";

  /* ————— a camada: presa na pílula, subindo; não passa da c23 ————— */
  const camada = (k: Camada, titulo: string, conteudo: ReactNode, rodape?: ReactNode) => {
    const p = PILULAS.find((x) => x.k === k)!;
    const largura = LARGURA[k];
    const esq = Math.min(p.x - PILULA_B / 2, 1840 - largura);
    return (
      <div data-home-camada="" role="dialog" aria-label={titulo}
        style={{ position: "absolute", left: esq, bottom: BASE_CAMADA, width: largura, maxHeight: ALTURA_MAX_CAMADA, boxSizing: "border-box", display: "flex", flexDirection: "column",
          background: "#fff", borderRadius: 20, boxShadow: "7px 7px 42px rgba(0,0,0,.2)", zIndex: NIVEL.verTodos, overflow: "hidden" }}>
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "26px 28px 14px" }}>
          <span style={{ ...FR, fontSize: 32, lineHeight: "36px", letterSpacing: "-.02em" }}>{titulo}</span>
          <button type="button" onClick={fechar} aria-label="Fechar" style={FECHAR_X}>✕</button>
        </div>
        <div ref={vigiarRolagem} className="p10-rola" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "0 28px 24px", ["--fundo" as string]: "#fff" } as CSSProperties}>
          {conteudo}
        </div>
        {rodape && <div style={{ flex: "none", padding: "14px 28px 24px", borderTop: "1px solid rgba(37,36,37,.12)" }}>{rodape}</div>}
      </div>
    );
  };

  const vazio = (texto: string) => <div style={{ padding: "8px 0 4px", fontFamily: INTER, fontSize: 16, lineHeight: 1.45, color: CINZA }}>{texto}</div>;

  return (
    <PalcoFixo>
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: FUNDO_PAGINA, zIndex: 0 }} />

      {/* a ilustração (ou o papel de parede) no espaço livre do meio; com um
          tutorial passado para cá, o vídeo ocupa o lugar dos dois: 1440x810
          (16:9) da c3 à c21, a partir da linha 8 da grade, e o ✕ ao lado */}
      {tutGrande ? (
        <div data-home-tutorial-grande="" role="region" aria-label={`Tutorial: ${tutGrande.tut.titulo}`}
          style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 946 - 112, zIndex: 2 }}>
          <PlayerTutorial key={tutGrande.tut.arquivo} aberto={tutGrande} grande
            aoTrocarTamanho={(t, tocando) => diminuir(tutGrande.tut, t, tocando)}
            estilo={{ position: "absolute", left: 240, top: TOPO_TUTORIAL - 112, width: 1440, height: 810, boxShadow: "7px 7px 42px rgba(0,0,0,.2)" }} />
          <button type="button" onClick={fecharGrande} aria-label="Fechar o tutorial" title="Fechar o tutorial (ESC)"
            style={{ ...FECHAR_X, position: "absolute", left: 1700, top: TOPO_TUTORIAL - 112 }}>✕</button>
        </div>
      ) : papel ? (
        dados.papelTipo === "video"
          ? <video src={papel} autoPlay muted loop playsInline style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 946 - 112, objectFit: "cover", zIndex: 1, pointerEvents: "none" }} />
          : <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 946 - 112, background: `url("${papel}") center/cover no-repeat`, zIndex: 1, pointerEvents: "none" }} />
      ) : (
        <img src={arquivoIlust} alt="" style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 1080, zIndex: 1, pointerEvents: "none",
          transform: enq ? `translate(${enq.dx}px, ${enq.dy}px) scale(${enq.esc})` : undefined, transformOrigin: enq ? `${enq.cx}px ${enq.cy}px` : undefined }} />
      )}

      {/* ————— o pé ————— */}
      <div style={{ position: "absolute", left: 80 - folgaFR(40, relogio.charAt(0)), top: 1007.88 - baseFraunces(40, 40), ...FR, fontSize: 40, lineHeight: "40px",
        letterSpacing: "-.02em", whiteSpace: "nowrap", color: PRETO, zIndex: 30 }}>{relogio}</div>
      {PILULAS.map((p) => {
        /* com o tutorial no lugar do papel de parede, a pílula dele fica acesa */
        const on = aberta === p.k || (p.k === "tutoriais" && !!tutGrande && aberta === null);
        return (
          <button key={p.k} type="button" data-home-pilula="" aria-expanded={on} aria-haspopup="dialog" className="np4-pilula"
            onClick={() => setAberta((a) => (a === p.k ? null : p.k))}
            style={{ ...PILULA, left: p.x - PILULA_B / 2, width: p.w + PILULA_B, background: on ? AMARELO : undefined }}>
            {p.rotulo}
            {p.k === "chat" && chatNovo && !on && (
              <span aria-label="Mensagem nova" style={{ position: "absolute", top: -5, right: 6, width: 12, height: 12, borderRadius: 999, background: PALETA.sino, border: `2px solid ${FUNDO_PAGINA}` }} />
            )}
          </button>
        );
      })}
      <div style={{ position: "absolute", right: 80 - folgaDireitaInter(400, 20.5, "!"), top: 999.6 - baseInter(20.5, 20.5), fontFamily: INTER, fontSize: 20.5, lineHeight: "20.5px",
        fontWeight: 400, letterSpacing: "-.014em", whiteSpace: "nowrap", color: PRETO, zIndex: 30 }}>{LEMA}</div>

      {/* ————— Agenda ————— */}
      {aberta === "agenda" && camada("agenda", "Agenda", (
        <>
          {agenda.length === 0 && vazio("Nenhuma anotação ainda. Escreva a primeira aqui embaixo.")}
          {agenda.map((a) => (
            <div key={a.id} onClick={() => setSelNota((s) => (s === a.id ? null : a.id))}
              style={{ display: "flex", gap: 14, alignItems: "center", padding: "10px 12px", margin: "0 -12px", borderRadius: 12, background: selNota === a.id ? AMARELO : "transparent", cursor: "pointer" }}>
              <div style={{ flex: "none", width: 48, height: 48, borderRadius: 12, background: FUNDO_PAGINA, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                <span style={{ ...FR, fontSize: 20 }}>{a.dia || "s/d"}</span>
                {a.dia && <span style={{ fontFamily: INTER, fontSize: 10.5, fontWeight: 600, letterSpacing: ".06em" }}>{a.mes}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 17, lineHeight: 1.35, textDecoration: a.feito ? "line-through" : "none", color: a.feito ? "#9a9a9a" : PRETO, overflowWrap: "anywhere" }}>{a.texto}</div>
            </div>
          ))}
        </>
      ), (
        <>
          {notaSel && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 14, color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{notaSel.texto}</span>
              <button type="button" onClick={() => dados.aoAlternarNota && void dados.aoAlternarNota(notaSel.id, !notaSel.feito)} style={{ ...BOTAO_CLARO, padding: "6px 14px" }}>{notaSel.feito ? "Reabrir" : "Concluir"}</button>
              {confirmarApagar === "agenda" ? (
                <>
                  <button type="button" onClick={() => setConfirmarApagar(null)} style={{ ...BOTAO_CLARO, padding: "6px 14px" }}>Não</button>
                  <button type="button" onClick={() => { setConfirmarApagar(null); apagarNota(notaSel.id); setSelNota(null); }} style={{ ...BOTAO_ESCURO, padding: "6px 14px" }}>Sim, apagar</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmarApagar("agenda")} style={{ ...BOTAO_CLARO, padding: "6px 14px" }}>Apagar</button>
              )}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <textarea value={rascunhoAgenda} onChange={(e) => setRascunhoAgenda(e.target.value)} placeholder="Uma anotação para hoje…" aria-label="Nova anotação para hoje"
              style={{ ...AREA_TEXTO, flex: 1, minHeight: 54, height: 54, fontSize: 16, lineHeight: 1.4 }} />
            <button type="button" onClick={() => criarNota(rascunhoAgenda, hojeIso(), () => setRascunhoAgenda(""))} disabled={ocupado || !rascunhoAgenda.trim()}
              style={{ ...BOTAO_ESCURO, flex: "none", opacity: ocupado || !rascunhoAgenda.trim() ? 0.5 : 1 }}>Adicionar</button>
          </div>
          <div style={{ marginTop: 8, fontFamily: INTER, fontSize: 13, color: CINZA }}>Para outro dia, use o Calendário.</div>
        </>
      ))}

      {/* ————— Calendário ————— */}
      {aberta === "calendario" && camada("calendario", "Calendário", (
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
          <div style={{ flex: "none", width: 392 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
              <button type="button" onClick={() => setVerOffset((o) => Math.max(minOffset, o - 1))} disabled={semAnterior} aria-label="Mês anterior" className="np4-pilula"
                style={{ width: 34, height: 34, borderRadius: 999, border: `1.5px solid ${PRETO}`, display: "grid", placeItems: "center", padding: 0, cursor: semAnterior ? "default" : "pointer", opacity: semAnterior ? 0.35 : 1 }}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <span style={{ ...FR, fontSize: 24, lineHeight: "28px", letterSpacing: "-.02em" }}>{MESES[vMes]} {vAno}</span>
              <button type="button" onClick={() => setVerOffset((o) => Math.min(36, o + 1))} disabled={semProximo} aria-label="Próximo mês" className="np4-pilula"
                style={{ width: 34, height: 34, borderRadius: 999, border: `1.5px solid ${PRETO}`, display: "grid", placeItems: "center", padding: 0, cursor: semProximo ? "default" : "pointer", opacity: semProximo ? 0.35 : 1 }}>
                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", fontFamily: INTER, fontSize: 13, fontWeight: 600, color: CINZA, textAlign: "center", paddingBottom: 6, borderBottom: "1px solid rgba(37,36,37,.12)" }}>
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: 52, marginTop: 6 }}>
              {diasCal.map((d, i) => {
                const sel = d.key && d.key === diaSel;
                const entregas = d.key ? (entregasPorDia[d.key]?.length ?? 0) : 0;
                const anot = d.key ? (porDia[d.key]?.length ?? 0) : 0;
                return (
                  <button key={i} type="button" disabled={!d.key} onClick={() => { if (d.key) { setDiaSel(d.key); setRascunhoDia(""); } }} title={d.feriado || undefined}
                    aria-label={d.key ? `${d.txt} de ${MESES[vMes].toLowerCase()}${d.feriado ? `, ${d.feriado}` : ""}${entregas ? `, ${entregas} entrega(s)` : ""}${anot ? `, ${anot} anotação(ões)` : ""}` : undefined}
                    style={{ position: "relative", display: "grid", placeItems: "center", background: "none", border: "none", padding: 0, cursor: d.key ? "pointer" : "default" }}>
                    {d.key && (
                      <span style={{ width: 38, height: 38, borderRadius: 999, display: "grid", placeItems: "center", fontFamily: INTER, fontSize: 16, fontWeight: d.hoje || d.feriado || sel ? 700 : 400,
                        background: sel ? PRETO : d.hoje ? AMARELO : d.feriado ? FUNDO_PAGINA : "transparent", color: sel ? "#fff" : PRETO }}>{d.txt}</span>
                    )}
                    {(entregas > 0 || anot > 0) && (
                      <span aria-hidden style={{ position: "absolute", bottom: 3, display: "flex", gap: 3 }}>
                        {entregas > 0 && <span style={{ width: 6, height: 6, borderRadius: 999, background: PRETO }} />}
                        {anot > 0 && <span style={{ width: 6, height: 6, borderRadius: 999, background: PALETA.lilas }} />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontFamily: INTER, fontSize: 13, color: CINZA }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: PRETO }} />Entrega</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: PALETA.lilas }} />Anotação</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, minHeight: 360, display: "flex", flexDirection: "column", gap: 12 }}>
            {!dia ? vazio("Escolha um dia para ver as entregas e anotar.") : (
              <>
                <span style={{ ...FR, fontSize: 24, lineHeight: "28px", letterSpacing: "-.02em" }}>{dia.titulo}</span>
                {!!dia.feriado && <span style={{ alignSelf: "flex-start", background: AMARELO, borderRadius: 999, padding: "6px 14px", fontFamily: INTER, fontSize: 14, fontWeight: 600 }}>{dia.feriado}</span>}
                {dia.itens.length === 0 && vazio("Nada neste dia.")}
                {dia.itens.map((ev, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ flex: "none", width: 8, height: 8, marginTop: 8, borderRadius: 999, background: ev.tipo === "Entrega" ? PRETO : PALETA.lilas }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: INTER, fontSize: 13, fontWeight: 600, color: CINZA }}>{ev.tipo}</div>
                      <div style={{ fontFamily: INTER, fontSize: 16, lineHeight: 1.35, textDecoration: ev.feito ? "line-through" : "none", color: ev.feito ? "#9a9a9a" : PRETO, overflowWrap: "anywhere" }}>{ev.texto}</div>
                    </div>
                  </div>
                ))}
                {confirmarApagar === "dia" && dia.ultima && (
                  <div role="alert" style={{ display: "flex", alignItems: "center", gap: 10, border: `1.5px dashed ${PRETO}`, borderRadius: 12, padding: "10px 12px" }}>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 15, lineHeight: 1.35, overflowWrap: "anywhere" }}>Apagar “{dia.ultima.texto}”? Não tem como desfazer.</span>
                    <button type="button" onClick={() => setConfirmarApagar(null)} style={{ ...BOTAO_CLARO, padding: "6px 12px" }}>Não</button>
                    <button type="button" onClick={() => { setConfirmarApagar(null); if (dia.ultima) apagarNota(dia.ultima.id); }} style={{ ...BOTAO_ESCURO, padding: "6px 12px" }}>Apagar</button>
                  </div>
                )}
                <textarea value={rascunhoDia} onChange={(e) => setRascunhoDia(e.target.value)} placeholder="Escreva o que precisar…" aria-label={`Anotação para ${dia.titulo}`}
                  style={{ ...AREA_TEXTO, minHeight: 74, fontSize: 16, lineHeight: 1.4 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {!!dia.ultima && confirmarApagar !== "dia" && <button type="button" onClick={() => setConfirmarApagar("dia")} style={BOTAO_CLARO}>Apagar a última</button>}
                  <button type="button" onClick={() => diaSel && criarNota(rascunhoDia, diaSel, () => setRascunhoDia(""))} disabled={ocupado || !rascunhoDia.trim()}
                    style={{ ...BOTAO_ESCURO, marginLeft: "auto", opacity: ocupado || !rascunhoDia.trim() ? 0.5 : 1 }}>Adicionar à agenda</button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}

      {/* ————— Chat (o canal geral da equipe) ————— */}
      {aberta === "chat" && camada("chat", "Chat da equipe", (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 300 }}>
          {chat.length === 0 && vazio("Ninguém escreveu ainda. Mande a primeira mensagem para a equipe.")}
          {chat.map((m) => {
            const minha = !!dados.meuId && m.user_id === dados.meuId;
            const quando = new Date(m.created_at);
            const hora = Number.isNaN(quando.getTime()) ? "" : quando.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
            return (
              <div key={m.id} style={{ alignSelf: minha ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                <div style={{ fontFamily: INTER, fontSize: 12.5, color: CINZA, textAlign: minha ? "right" : "left", marginBottom: 3 }}>{minha ? "Você" : (m.user_nome ?? "Alguém")}{hora ? ` · ${hora}` : ""}</div>
                <div style={{ fontFamily: INTER, fontSize: 16, lineHeight: 1.4, padding: "10px 14px", borderRadius: 16, background: minha ? PALETA.lilas : FUNDO_PAGINA, color: PRETO, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.texto}</div>
              </div>
            );
          })}
          <div ref={fimDoChat} />
        </div>
      ), (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <textarea value={rascunhoChat} onChange={(e) => setRascunhoChat(e.target.value)} placeholder="Escreva para a equipe…" aria-label="Mensagem para a equipe"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarChat(); } }}
            style={{ ...AREA_TEXTO, flex: 1, minHeight: 54, height: 54, fontSize: 16, lineHeight: 1.4 }} />
          <button type="button" onClick={enviarChat} disabled={ocupado || !rascunhoChat.trim() || !dados.aoEnviarChat}
            style={{ ...BOTAO_ESCURO, flex: "none", opacity: ocupado || !rascunhoChat.trim() ? 0.5 : 1 }}>Enviar</button>
        </div>
      ))}

      {/* ————— Sugestões ————— */}
      {aberta === "sugestoes" && camada("sugestoes", "Sugestões", sugEnviada ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0" }}>
          <span style={{ ...FR, fontSize: 24 }}>Obrigado! <span className="h10-estrela" aria-hidden>✦</span></span>
          <span style={{ fontFamily: INTER, fontSize: 16, lineHeight: 1.4, color: "#444" }}>Sua sugestão foi enviada para a equipe do hub.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <span style={{ fontFamily: INTER, fontSize: 16, lineHeight: 1.4, color: "#444" }}>Tem uma ideia para melhorar o R2hub? Conte pra gente.</span>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: INTER, fontSize: 14, fontWeight: 600 }}>Sobre qual tela?</span>
            <span style={{ position: "relative", display: "block" }}>
              <select value={sugTela} onChange={(e) => setSugTela(e.target.value)}
                style={{ ...AREA_TEXTO, height: 46, padding: "0 42px 0 14px", fontSize: 16, appearance: "none", WebkitAppearance: "none", cursor: "pointer" }}>
                <option value={TELA_GERAL}>{TELA_GERAL}</option>
                {GRUPOS_DE_TELAS.map((g) => (
                  <optgroup key={g.grupo} label={g.grupo}>
                    {g.telas.map((t) => <option key={t} value={t}>{t}</option>)}
                  </optgroup>
                ))}
              </select>
              <svg aria-hidden width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
                style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9" /></svg>
            </span>
          </label>
          <textarea value={sugTexto} onChange={(e) => setSugTexto(e.target.value)} placeholder="Ex.: seria ótimo se o calendário mostrasse os prazos de entrega…"
            aria-label="Sua sugestão" style={{ ...AREA_TEXTO, minHeight: 120, fontSize: 16, lineHeight: 1.4 }} />
        </div>
      ), !sugEnviada ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button type="button" onClick={() => { setSugTexto(""); setSugTela(TELA_GERAL); }} style={BOTAO_CLARO}>Apagar tudo</button>
          <button type="button" onClick={enviarSug} disabled={ocupado || !sugTexto.trim()} style={{ ...BOTAO_ESCURO, opacity: ocupado || !sugTexto.trim() ? 0.5 : 1 }}>Enviar sugestão</button>
        </div>
      ) : undefined)}

      {/* ————— Tutoriais: os passo a passo em vídeo ————— */}
      {aberta === "tutoriais" && camada("tutoriais", "Tutoriais", (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tutSel && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <PlayerTutorial key={tutSel.tut.arquivo} aberto={tutSel} grande={false}
                aoTrocarTamanho={(t, tocando) => aumentar(tutSel.tut, t, tocando)} estilo={{ width: "100%", aspectRatio: "16 / 9" }} />
              <span style={{ ...FR, fontSize: 22, lineHeight: "26px", letterSpacing: "-.02em" }}>{tutSel.tut.titulo}</span>
            </div>
          )}
          {/* a apresentação interativa (sem vídeo) vem antes dos vídeos: fecha a
              camada e começa o tour por cima da Home */}
          {apresentacao && (
            <button type="button" onClick={() => { fechar(); apresentacao.verDeNovo(); }} className="p10-linha"
              style={{ display: "flex", alignItems: "center", gap: 14, width: "calc(100% + 24px)", margin: "0 -12px", padding: "10px 12px", border: "none", borderRadius: 12,
                background: "transparent", cursor: "pointer", textAlign: "left", color: PRETO }}>
              <span aria-hidden style={{ flex: "none", width: 40, height: 40, borderRadius: 999, background: AMARELO, display: "grid", placeItems: "center" }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l7 17 2.5-7.5L21 11z" /></svg>
              </span>
              <span style={{ flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 17, lineHeight: 1.35 }}>
                Apresentação do hub<span style={{ display: "block", fontSize: 14, color: "#5b595b" }}>Interativa, nas telas de verdade</span>
              </span>
              <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          )}
          {tutQ.isLoading && vazio("Lendo a pasta dos tutoriais…")}
          {tutQ.isError && vazio("Não deu para ler a pasta dos tutoriais. Tente de novo daqui a pouco.")}
          {tutQ.data && tutQ.data.tutoriais.length === 0 && vazio("Os vídeos de passo a passo aparecem aqui assim que entrarem na pasta Tutoriais do R2 Hub, na rede.")}
          {(tutQ.data?.tutoriais ?? []).map((v, i) => {
            /* com um tutorial aberto no meio da Home, escolher outro troca o de lá
               (dois vídeos tocando ao mesmo tempo atrapalham) */
            const on = (tutSel ?? tutGrande)?.tut.arquivo === v.arquivo;
            const abrir = () => (tutGrande ? aumentar(v, 0, true) : setTutSel({ tut: v, inicio: 0, tocar: true }));
            return (
              <button key={v.arquivo} type="button" onClick={abrir} aria-pressed={on} className={on ? undefined : "p10-linha"}
                style={{ display: "flex", alignItems: "center", gap: 14, width: "calc(100% + 24px)", margin: "0 -12px", padding: "10px 12px", border: "none", borderRadius: 12,
                  background: on ? AMARELO : "transparent", cursor: "pointer", textAlign: "left", color: PRETO }}>
                <span style={{ flex: "none", width: 40, height: 40, borderRadius: 999, background: on ? "#fff" : FUNDO_PAGINA, display: "grid", placeItems: "center", ...FR, fontSize: 18 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: INTER, fontSize: 17, lineHeight: 1.35 }}>{v.titulo}</span>
                <svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill={PRETO}><path d="M8 5v14l11-7z" /></svg>
              </button>
            );
          })}
        </div>
      ))}

      {/* ————— Resumo: o que você fez no período ————— */}
      {aberta === "resumo" && camada("resumo", "Resumo", (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div role="group" aria-label="Período" style={{ display: "flex", gap: 8 }}>
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" aria-pressed={resumoDias === d} onClick={() => setResumoDias(d)} className="np4-pilula"
                style={{ height: 34, padding: "1px 16px 0", border: `1.5px solid ${PRETO}`, borderRadius: 999, fontFamily: INTER, fontSize: 15, cursor: "pointer",
                  background: resumoDias === d ? AMARELO : undefined, color: PRETO }}>{d} dias</button>
            ))}
          </div>
          {resumoQ.isLoading && vazio("Contando…")}
          {resumoQ.isError && vazio("Não deu para montar o resumo. Tente de novo daqui a pouco.")}
          {resumoQ.data && (() => {
            const dados = resumoQ.data;
            const itens = ITENS_RESUMO.filter(([k]) => (dados[k] ?? 0) > 0);
            if (!itens.length) return vazio("Nada neste período ainda. O que você fizer nos pedidos aparece aqui.");
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {itens.map(([k, um, varios]) => (
                  <div key={k} style={{ background: FUNDO_PAGINA, borderRadius: 14, padding: "14px 16px 12px" }}>
                    <div style={{ ...FR, fontSize: 44, lineHeight: "46px", letterSpacing: "-.02em" }}>{dados[k]}</div>
                    <div style={{ fontFamily: INTER, fontSize: 14, color: CINZA, marginTop: 2 }}>{dados[k] === 1 ? um : varios}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ), (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={() => { fechar(); aoNavegar("Pedidos"); }} style={BOTAO_ESCURO}>Ver pedidos</button>
        </div>
      ))}

      {/* barra do topo, configurações e sair: o cromo compartilhado do 1.0 */}
      <BarraTopoHub10 profile={profile} paginaAtiva="Home" aoNavegar={aoNavegar}
        onNova={podeCriar ? onNova : undefined} onLogout={onLogout} disponiveis={disponiveis} fundo="transparent" />

      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </PalcoFixo>
  );
}

/* ————— o player dos tutoriais: os controles no jeito do YouTube ————— */
const relogioVideo = (s: number) => {
  const t = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Os ícones brancos da barra do player (caixa de 24). */
function IconePlayer({ nome }: { nome: "tocar" | "pausar" | "aumentar" | "diminuir" | "cheia" | "sair" }) {
  const traco = { fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="100%" height="100%" style={{ display: "block" }}>
      {nome === "tocar" && <path d="M8 5.2v13.6L18.6 12z" fill="#fff" />}
      {nome === "pausar" && <><rect x="6.4" y="5" width="3.8" height="14" rx="1" fill="#fff" /><rect x="13.8" y="5" width="3.8" height="14" rx="1" fill="#fff" /></>}
      {/* aumentar: o retângulo largo, como o do "modo cinema"; diminuir: o estreito */}
      {nome === "aumentar" && <rect x="2.5" y="6.5" width="19" height="11" rx="1.6" {...traco} />}
      {nome === "diminuir" && <rect x="5.5" y="8" width="13" height="8" rx="1.4" {...traco} />}
      {nome === "cheia" && <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" {...traco} />}
      {nome === "sair" && <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" {...traco} />}
    </svg>
  );
}

/** O player dos tutoriais (Augusto, 06/10/2026: "coloque o ícone de aumentar
    tela no player do vídeo, como o YouTube faz"). A barra nativa do navegador
    não aceita botão a mais, então os controles são do hub, no desenho do
    YouTube: a barra de progresso, tocar/pausar e o tempo à esquerda; aumentar
    (ou diminuir, quando já está no meio da Home) e tela cheia à direita. Com o
    vídeo tocando a barra some sozinha e volta ao mexer o mouse. Clique no vídeo
    pausa e duplo clique é tela cheia; com o player em foco, espaço ou K pausam,
    F é tela cheia, T aumenta ou diminui e as setas andam 5 segundos. */
function PlayerTutorial({ aberto, grande, aoTrocarTamanho, estilo }: {
  aberto: TutAberto;
  /** no meio da Home: o ícone de aumentar vira diminuir */
  grande: boolean;
  /** aumentar ou diminuir, com o ponto do vídeo e se estava tocando */
  aoTrocarTamanho: (tempo: number, tocando: boolean) => void;
  estilo?: CSSProperties;
}) {
  const { tut, inicio, tocar } = aberto;
  const caixaRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [tocando, setTocando] = useState(false);
  const [tempo, setTempo] = useState(inicio);
  const [duracao, setDuracao] = useState(0);
  const [carregado, setCarregado] = useState(0);
  const [barra, setBarra] = useState(true);
  const [cheia, setCheia] = useState(false);
  const sumir = useRef<number | undefined>(undefined);

  /* a barra aparece ao mexer o mouse e some 2,2 s depois, se estiver tocando */
  const acordar = useCallback(() => {
    setBarra(true);
    window.clearTimeout(sumir.current);
    sumir.current = window.setTimeout(() => { if (videoRef.current && !videoRef.current.paused) setBarra(false); }, 2200);
  }, []);
  useEffect(() => () => window.clearTimeout(sumir.current), []);
  /* o progresso anda liso enquanto toca (o timeupdate só vem 4 vezes por segundo) */
  useEffect(() => {
    if (!tocando) return;
    let id = 0;
    const passo = () => { if (videoRef.current) setTempo(videoRef.current.currentTime); id = requestAnimationFrame(passo); };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [tocando]);
  useEffect(() => {
    const aoMudar = () => setCheia(document.fullscreenElement === caixaRef.current);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  const alternar = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
    acordar();
  };
  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void caixaRef.current?.requestFullscreen().catch(() => {});
  };
  const trocarTamanho = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    aoTrocarTamanho(v.currentTime, !v.paused);
  };
  const andar = (seg: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + seg), v.duration || 0);
    setTempo(v.currentTime);
    acordar();
  };
  const irPara = (x: number, trilho: HTMLElement) => {
    const v = videoRef.current;
    if (!v || !duracao) return;
    const r = trilho.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (x - r.left) / r.width)) * duracao;
    setTempo(v.currentTime);
  };
  const teclas = (e: TeclaReact<HTMLDivElement>) => {
    /* espaço e Enter num botão da barra são do botão */
    if ((e.target as HTMLElement).tagName === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") alternar();
    else if (k === "f") telaCheia();
    else if (k === "t") trocarTamanho();
    else if (k === "arrowleft") andar(-5);
    else if (k === "arrowright") andar(5);
    else return;
    e.preventDefault();
  };

  /* o tamanho da barra: o do player da camada e o do meio da Home (e da tela cheia) */
  const m = grande || cheia
    ? { botao: 44, icone: 26, letra: 16, trilho: 5, bolinha: 15, lado: 18 }
    : { botao: 34, icone: 20, letra: 13, trilho: 4, bolinha: 12, lado: 10 };
  const pct = (s: number) => `${duracao ? Math.min(100, (s / duracao) * 100) : 0}%`;
  const mostrar = barra || !tocando;
  const botao: CSSProperties = { flex: "none", width: m.botao, height: m.botao, padding: (m.botao - m.icone) / 2, border: "none", borderRadius: 8, background: "transparent", cursor: "pointer" };
  const faixa = (largura: string, cor: string): CSSProperties => ({ position: "absolute", left: 0, width: largura, top: "50%", height: m.trilho, marginTop: -m.trilho / 2, borderRadius: 999, background: cor });

  return (
    <div ref={caixaRef} data-player-tutorial="" tabIndex={0} onKeyDown={teclas} onMouseMove={acordar} onMouseLeave={() => { if (tocando) setBarra(false); }}
      style={{ position: "relative", overflow: "hidden", background: PRETO, borderRadius: cheia ? 0 : grande ? 20 : 12, outline: "none", cursor: mostrar ? "default" : "none", ...estilo }}>
      <video ref={videoRef} src={`/tutorial/${encodeURIComponent(tut.arquivo)}?v=${tut.versao}`} autoPlay={tocar} playsInline
        onLoadedMetadata={(e) => { const v = e.currentTarget; setDuracao(v.duration); if (inicio > 0 && inicio < v.duration - 0.5) { v.currentTime = inicio; setTempo(inicio); } }}
        onTimeUpdate={(e) => { if (!tocando) setTempo(e.currentTarget.currentTime); }}
        onProgress={(e) => { const b = e.currentTarget.buffered; if (b.length) setCarregado(b.end(b.length - 1)); }}
        onPlay={() => { setTocando(true); acordar(); }} onPause={() => setTocando(false)} onEnded={() => setTocando(false)}
        onClick={alternar} onDoubleClick={telaCheia}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
      {/* a barra de controles, por cima do pé do vídeo */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: `${m.lado * 2}px ${m.lado}px ${m.lado / 2}px`,
        background: "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,.62))", opacity: mostrar ? 1 : 0, transition: "opacity .2s", pointerEvents: mostrar ? "auto" : "none" }}>
        <div role="slider" aria-label="Ponto do vídeo" aria-valuemin={0} aria-valuemax={Math.round(duracao)} aria-valuenow={Math.round(tempo)}
          aria-valuetext={`${relogioVideo(tempo)} de ${relogioVideo(duracao)}`}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); irPara(e.clientX, e.currentTarget); }}
          onPointerMove={(e) => { if (e.buttons & 1) irPara(e.clientX, e.currentTarget); }}
          style={{ position: "relative", height: m.bolinha + 4, cursor: "pointer", touchAction: "none" }}>
          <div style={faixa("100%", "rgba(255,255,255,.28)")} />
          <div style={faixa(pct(carregado), "rgba(255,255,255,.45)")} />
          <div style={faixa(pct(tempo), AMARELO)} />
          <div style={{ position: "absolute", left: pct(tempo), top: "50%", width: m.bolinha, height: m.bolinha, margin: `${-m.bolinha / 2}px 0 0 ${-m.bolinha / 2}px`, borderRadius: 999, background: AMARELO }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button type="button" onClick={alternar} aria-label={tocando ? "Pausar" : "Tocar"} title={tocando ? "Pausar (K)" : "Tocar (K)"} style={botao}>
            <IconePlayer nome={tocando ? "pausar" : "tocar"} />
          </button>
          <span style={{ marginLeft: 6, fontFamily: INTER, fontSize: m.letra, color: "#fff", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {relogioVideo(tempo)} / {relogioVideo(duracao)}
          </span>
          <span style={{ flex: 1 }} />
          <button type="button" onClick={trocarTamanho} aria-label={grande ? "Diminuir" : "Aumentar"} title={grande ? "Diminuir (T)" : "Aumentar (T)"} style={botao}>
            <IconePlayer nome={grande ? "diminuir" : "aumentar"} />
          </button>
          <button type="button" onClick={telaCheia} aria-label={cheia ? "Sair da tela cheia" : "Tela cheia"} title={cheia ? "Sair da tela cheia (F)" : "Tela cheia (F)"} style={botao}>
            <IconePlayer nome={cheia ? "sair" : "cheia"} />
          </button>
        </div>
      </div>
    </div>
  );
}
