// Home — Hub 1.0. Fonte: hub-1.0/home-hub-1.0.dc.html (Claude Design).
//
// Primeira tela da geração 1.0. Muda o cromo inteiro: não há rail nem topbar
// do V1a — a navegação é uma barra branca no topo, e o palco é 1920×1080
// escalado para CABER na janela (min de largura/altura), não a largura fluida
// do V1a. Por isso esta tela não usa EstagioV1a/RailV1a/TopbarV1a: ela é o
// cromo dela mesma. As outras telas seguem V1a até serem migradas — o menu
// daqui leva para elas normalmente.
//
// Dados reais no lugar do que o protótipo inventava:
//   · notas/agenda → user_notas (mesma tabela da Home antiga e da Central);
//     a nota ganha `quando` em ISO para cair no dia certo do calendário, e as
//     antigas ("dd/mm") são lidas com o ano em que foram criadas;
//   · "eventos" do dia → entregas dos pedidos em aberto (prazoDoPedido);
//   · notificações → as do hub; sugestões → tabela `sugestoes`;
//   · ilustração escolhida → prefs do usuário (user_config), padrão por cargo.
//
// Cores: o 1.0 usa preto #000 e amarelo #fff079 (o #FFE815 só no "+"), que
// NÃO são os do kit V1a. É decisão do design, seguida à risca.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as MouseEventReact, ReactNode } from "react";

import { ilustDaHome, useHubDados } from "../v1a/HubDadosV1a";
import { AvisoV1a } from "../v1a/HubV1a";
import {
  AMARELO, AREA_TEXTO, BOTAO_CLARO, BOTAO_ESCURO, BarraTopoHub10,
  CABECA, CAIXA, FECHAR_X, FR, INTER, PRETO, PalcoFixo,
} from "./ChromeHub10";
import { feriadoEm } from "@/lib/feriados";
import { prazoDoPedido } from "@/lib/prazo";
import type { SessionUser } from "@/lib/session";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/* cor da faixa da agenda e do cabeçalho do dia — o protótipo oferece quatro;
   o lilás é o padrão dele */
const COR_NOTA = "#aba9fc";

const iso = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const hojeIso = () => { const h = new Date(); return iso(h.getFullYear(), h.getMonth(), h.getDate()); };

/** Dia (ISO) de uma nota. Nota nova grava ISO; nota antiga tem "dd/mm" e o
    ano é o em que foi criada — sem isso "07/08" de 2026 cairia em todo ano. */
function diaDaNota(quando?: string | null, criadoEm?: string): string | null {
  if (!quando) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(quando)) return quando;
  const m = quando.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const ano = criadoEm && !Number.isNaN(new Date(criadoEm).getTime()) ? new Date(criadoEm).getFullYear() : new Date().getFullYear();
  return iso(ano, Number(m[2]) - 1, Number(m[1]));
}

/* ————— o papel é escuro? —————
   A saudação é preta por projeto e some sobre foto escura. Em vez de pôr um
   véu por cima da arte, a cor do texto é que se adapta: preto no claro,
   branco com sombra no escuro. Quem decide é o próprio papel — mede-se a
   luminância DA REGIÃO ONDE O TEXTO CAI, não da imagem inteira, porque o que
   importa é o que fica atrás das letras.

   O corte é 0,22: texto preto precisa de fundo acima de ~0,175 para atingir
   contraste 4,5, e branco precisa de abaixo de ~0,183. Um pouco acima do
   cruzamento porque, no empate, o branco com sombra aguenta fundo manchado
   melhor que o preto. */
const CORTE_ESCURO = 0.22;
/* Recorte do texto dentro da faixa do papel: x é fração de 1920, y é fração
   da FAIXA (112..725), não do palco. Cobre o hero inteiro — a saudação em
   398..481 e o título fixo em 360..511 do palco, ou seja 248..399 da faixa. */
const RECORTE = { x0: 0.04, x1: 0.42, y0: 0.405, y1: 0.651 };

/* Hero. A saudação cicla o CMYK da impressão; o título fixo pinta a letra sob
   o mouse com a paleta de destaque e volta ao normal 260ms depois. */
const CMYK = ["#00AEEF", "#EC008C", "#FFD100", "#252425"];
const PALETA_LETRA = ["#00AEEF", "#EC008C", "#7A4DFF", "#C9A800", "#12B5A5"];
const SAUDACAO_MS = 2750;

function letrasDaLinha(texto: string, desloca: number) {
  return texto.split("").map((ch, i) => {
    const id = desloca + i;
    return { id, ch: ch === " " ? " " : ch, atraso: `${(0.045 * id).toFixed(3)}s` };
  });
}

function luzRelativa(d: Uint8ClampedArray): number {
  const f = (u: number) => { const v = u / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  let soma = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { soma += 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]); n++; }
  return n ? soma / n : 1;
}

/** true = papel escuro (texto branco). null enquanto não deu para medir. */
function usePapelEscuro(papel: string, tipo: "video" | "imagem" | undefined, videoRef: { current: HTMLVideoElement | null }) {
  const [escuro, setEscuro] = useState<boolean | null>(null);
  useEffect(() => {
    if (!papel) { setEscuro(null); return; }
    let vivo = true;
    const medir = (fonte: CanvasImageSource) => {
      try {
        const c = document.createElement("canvas");
        c.width = 160; c.height = 90;
        const cx = c.getContext("2d", { willReadFrequently: true });
        if (!cx) return;
        cx.drawImage(fonte, 0, 0, 160, 90);
        const x = Math.floor(RECORTE.x0 * 160), y = Math.floor(RECORTE.y0 * 90);
        const w = Math.ceil((RECORTE.x1 - RECORTE.x0) * 160), h = Math.ceil((RECORTE.y1 - RECORTE.y0) * 90);
        const luz = luzRelativa(cx.getImageData(x, y, w, h).data);
        if (vivo) setEscuro(luz < CORTE_ESCURO);
      } catch {
        /* canvas sujo ou mídia ainda sem frame — fica no preto do projeto */
      }
    };
    if (tipo === "video") {
      const v = videoRef.current;
      if (!v) return;
      /* o primeiro frame costuma ser preto (fade-in): mede de novo mais
         adiante para não classificar o vídeo inteiro pelo pisca inicial */
      const tentar = () => { if (v.readyState >= 2) medir(v); };
      tentar();
      v.addEventListener("loadeddata", tentar);
      const t1 = setTimeout(tentar, 1200);
      const t2 = setTimeout(tentar, 3000);
      return () => { vivo = false; v.removeEventListener("loadeddata", tentar); clearTimeout(t1); clearTimeout(t2); };
    }
    const img = new Image();
    img.onload = () => medir(img);
    img.src = papel;
    return () => { vivo = false; };
  }, [papel, tipo, videoRef]);
  return escuro;
}

export function HomeHub10({ profile, pedidos, aoNavegar, onNova, onLogout, disponiveis, aoEnviarSugestao, children }: {
  profile: SessionUser;
  pedidos: any[];
  aoNavegar: (label: string) => void;
  onNova: () => void;
  onLogout: () => void;
  /** páginas que a pessoa pode abrir (mesma lista do rail V1a) */
  disponiveis?: string[];
  aoEnviarSugestao?: (texto: string) => Promise<unknown>;
  /** modais hospedados pela rota */
  children?: ReactNode;
}) {
  const dados = useHubDados();

  /* ————— estado de tela ————— */
  const [verOffset, setVerOffset] = useState(0);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [agendaAberta, setAgendaAberta] = useState(false);
  const [selNota, setSelNota] = useState<string | null>(null);
  const [sugAberta, setSugAberta] = useState(false);
  const [sugEnviada, setSugEnviada] = useState(false);
  const [sugTexto, setSugTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [, tick] = useState(0);

  /* relógio do rodapé */
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);

  /* ESC fecha tudo — igual ao protótipo */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /* só o que é desta tela — o que a barra do topo abre, ela mesma fecha */
      setDiaSel(null); setRascunho(""); setAgendaAberta(false); setSelNota(null); setSugAberta(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  /* ilustração: preferência da pessoa; sem escolha, o cargo decide. A regra
     mora no contexto porque a modal de Configurações responde a mesma coisa. */
  const ilust = ilustDaHome(dados.prefs, profile.role);

  /* ————— calendário ————— */
  const hoje = new Date();
  const baseIdx = hoje.getFullYear() * 12 + hoje.getMonth();
  const minOffset = (2026 * 12) - baseIdx;
  const idx = baseIdx + verOffset;
  const vAno = Math.floor(idx / 12), vMes = idx % 12;
  const semAnterior = verOffset <= minOffset, semProximo = verOffset >= 36;

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

  /* ————— notas por dia (agenda) ————— */
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
  /* lista da agenda: por dia, depois na ordem de criação; sem data vai ao fim */
  const agendaTodas = useMemo(() => {
    const com = notas
      .map((n) => ({ n, dia: diaDaNota(n.quando, n.created_at) }))
      .sort((a, b) => (a.dia ?? "9999").localeCompare(b.dia ?? "9999") || (a.n.created_at ?? "").localeCompare(b.n.created_at ?? ""));
    return com.map(({ n, dia }) => {
      const p = dia ? dia.split("-").map(Number) : null;
      return { id: n.id, texto: n.texto, feito: n.feito, dia: p ? String(p[2]) : "—", mesAbrev: p ? MABREV[p[1] - 1] : "s/d", chave: dia, mm: p ? String(p[1]).padStart(2, "0") : "" };
    });
  }, [notas]);

  /* A FAIXA mostra o que vem primeiro, não o mais antigo: por ordem de data a
     agenda exibia duas anotações de 7 de agosto — velhas e já sem uso — e
     escondia a de 25 de setembro, que era a próxima. Pendente e de hoje em
     diante manda; depois as sem data; por último o passado, mais recente
     primeiro, que é o que ainda interessa de trás. */
  const agendaFaixa = useMemo(() => {
    const hoje = hojeIso();
    const pendentes = agendaTodas.filter((a) => !a.feito);
    const futuras = pendentes.filter((a) => a.chave && a.chave >= hoje);
    const semData = pendentes.filter((a) => !a.chave);
    const passadas = pendentes.filter((a) => a.chave && a.chave < hoje).reverse();
    return [...futuras, ...semData, ...passadas, ...agendaTodas.filter((a) => a.feito)].slice(0, 2);
  }, [agendaTodas]);

  /* ————— entregas do dia: pedidos em aberto cujo prazo cai naquele dia ————— */
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

  /* popover do dia */
  const pop = useMemo(() => {
    if (!diaSel) return null;
    const p = diaSel.split("-").map(Number);
    const minhas = porDia[diaSel] ?? [];
    /* entrega não tem estado de concluída; anotação tem — o tipo precisa
       cobrir os dois, senão o `feito` some na inferência da primeira metade */
    const itens: { hora: string; texto: string; feito?: boolean }[] = [
      ...(entregasPorDia[diaSel] ?? []).map((c) => ({ hora: "Entrega", texto: c })),
      ...minhas.map((n) => ({ hora: "Anotação", texto: n.texto, feito: n.feito })),
    ];
    return { titulo: `${p[2]} de ${MESES[p[1] - 1].toLowerCase()}`, feriado: feriadoEm(diaSel)?.nome ?? "", itens, ultima: minhas[minhas.length - 1] ?? null };
  }, [diaSel, porDia, entregasPorDia]);

  const salvarNota = () => {
    const t = rascunho.trim();
    if (!t || !diaSel || !dados.aoCriarNota) return;
    setOcupado(true);
    Promise.resolve(dados.aoCriarNota(t, diaSel))
      .then(() => setRascunho(""))
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para salvar a anotação."))
      .finally(() => setOcupado(false));
  };
  const apagarUltima = () => {
    if (!pop?.ultima || !dados.aoExcluirNota) return;
    void dados.aoExcluirNota(pop.ultima.id).catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para apagar."));
  };
  const notaSel = agendaTodas.find((a) => a.id === selNota) ?? null;
  const concluirSel = () => { if (notaSel && dados.aoAlternarNota) void dados.aoAlternarNota(notaSel.id, !notaSel.feito); };
  const apagarSel = () => { if (notaSel && dados.aoExcluirNota) { void dados.aoExcluirNota(notaSel.id); setSelNota(null); } };

  /* ————— sugestão ————— */
  const enviarSug = () => {
    const t = sugTexto.trim();
    if (!t || !aoEnviarSugestao) return;
    setOcupado(true);
    Promise.resolve(aoEnviarSugestao(t))
      .then(() => { setSugEnviada(true); setSugTexto(""); })
      .catch((e: unknown) => setAviso(e instanceof Error ? e.message : "Não deu para enviar."))
      .finally(() => setOcupado(false));
  };

  const podeCriar = !disponiveis || disponiveis.includes("Novo pedido");
  const primeiroNome = (profile.nome || "").trim().split(/\s+/)[0] || profile.nome;
  const agora = new Date();
  const dataAgora = agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const horaAgora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  /* papel de parede escolhido: substitui a ilustração nesta tela */
  const papel = dados.papelParede || "";
  const papelTipo = dados.papelTipo;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const papelEscuro = usePapelEscuro(papel, papelTipo, videoRef);
  const corTexto = papelEscuro ? "#fff" : PRETO;
  const sombraTexto = papelEscuro ? "0 1px 2px rgba(0,0,0,.45), 0 3px 16px rgba(0,0,0,.40)" : undefined;
  /* os brilhos são parte do desenho de Vendas — somem junto com ele */
  const brilhos = !papel && ilust === "Vendas" ? [
    { x: 785, y: 545, tam: 30, atraso: "0s" }, { x: 1008, y: 827, tam: 26, atraso: ".4s" }, { x: 1188, y: 798, tam: 20, atraso: ".9s" },
    { x: 1488, y: 813, tam: 24, atraso: "1.1s" }, { x: 1572, y: 349, tam: 22, atraso: ".7s" },
  ] : [];

  /* ————— hero —————
     Duas fases: "Olá, Fulano!" entra, segura, e dá lugar ao título fixo. O
     título só é montado quando a saudação sai — é a montagem que dispara a
     revelação letra a letra; se ele existisse escondido desde o começo, a
     animação teria acabado antes de alguém ver. */
  const [saudando, setSaudando] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setSaudando(false), SAUDACAO_MS);
    return () => clearTimeout(t);
  }, []);

  const letrasSaud = useMemo(
    () => `Olá, ${primeiroNome}!`.split("").map((ch, i) => ({
      ch: ch === " " ? " " : ch, acc: CMYK[i % CMYK.length], atraso: `${(0.055 * i).toFixed(3)}s`,
    })),
    [primeiroNome],
  );

  /* Pintura por letra no hover. Um só ouvinte no <h1>: são 25 letras e cada
     uma com o seu handler seria ruído. A cor avança na paleta a cada passada,
     então repassar o mouse na mesma letra não devolve sempre a mesma cor. */
  const [pintadas, setPintadas] = useState<Record<number, string>>({});
  const voltaRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const passadaRef = useRef<Record<number, number>>({});
  useEffect(() => {
    const pendentes = voltaRef.current;
    return () => { Object.values(pendentes).forEach(clearTimeout); };
  }, []);
  const pintarLetra = (e: MouseEventReact<HTMLElement>) => {
    const alvo = (e.target as HTMLElement).closest?.("[data-letra]") as HTMLElement | null;
    if (!alvo) return;
    const id = Number(alvo.dataset.letra);
    if (!Number.isFinite(id)) return;
    const passada = (passadaRef.current[id] = (passadaRef.current[id] ?? -1) + 1);
    const cor = PALETA_LETRA[(id + passada) % PALETA_LETRA.length];
    setPintadas((p) => ({ ...p, [id]: cor }));
    clearTimeout(voltaRef.current[id]);
    voltaRef.current[id] = setTimeout(
      () => setPintadas((p) => { const q = { ...p }; delete q[id]; return q; }),
      260,
    );
  };

  return (
    <PalcoFixo>
      {/* faixa preta do rodapé */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 728, height: 352, background: PRETO, zIndex: 2 }} />

      {/* Ilustração OU papel de parede — são a mesma decisão, nunca as duas.
          O papel ocupa só a faixa cinza entre a barra do topo (112) e a tarja
          da Agenda (725): fora dela o desenho do 1.0 é preto e amarelo chapado
          e uma foto por baixo só sujaria. */}
      {papel ? (
        papelTipo === "video"
          ? <video ref={videoRef} src={papel} autoPlay muted loop playsInline style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 613, objectFit: "cover", zIndex: 1, pointerEvents: "none" }} />
          : <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 613, background: `url("${papel}") center/cover no-repeat`, zIndex: 1, pointerEvents: "none" }} />
      ) : ilust === "Vendas"
        ? <img src="/home10/home-vendas.svg" alt="" style={{ position: "absolute", left: -36, top: 14, width: 1920, height: 1080, zIndex: 45, pointerEvents: "none" }} />
        : <img src="/home10/home-design.svg" alt="" style={{ position: "absolute", left: 6, top: 1, width: 1920, height: 1080, zIndex: 37, pointerEvents: "none" }} />}
      {brilhos.map((b, i) => (
        <div key={i} className="h10-spark" style={{ left: b.x, top: b.y, width: b.tam, height: b.tam, animationDelay: b.atraso }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
            <path d="M50 2 C54 34 66 46 98 50 C66 54 54 66 50 98 C46 66 34 54 2 50 C34 46 46 34 50 2 Z" fill={AMARELO} stroke={PRETO} strokeWidth={3} strokeLinejoin="round" />
          </svg>
        </div>
      ))}

      {/* Hero. Preto sobre as ilustrações, como no projeto; branco com uma
          sombra leve quando o papel de parede por baixo é escuro. A sombra só
          acompanha o branco — no preto ela sujaria um desenho que já nasceu
          num fundo claro e de contraste resolvido. */}
      {saudando ? (
        <div className="h10-saud"
          style={{ position: "absolute", left: 76, top: 398, zIndex: 11, ...FR, fontSize: 92, lineHeight: 0.9, letterSpacing: "-.055em", whiteSpace: "nowrap", color: corTexto, textShadow: sombraTexto, pointerEvents: "none", "--fim": corTexto } as CSSProperties}>
          <span className="h10-so-leitor">Olá, {primeiroNome}!</span>
          {letrasSaud.map((c, i) => (
            <span key={i} className="h10-ll" aria-hidden style={{ animationDelay: c.atraso, "--acc": c.acc } as CSSProperties}>{c.ch}</span>
          ))}
        </div>
      ) : (
        <h1 onMouseOver={pintarLetra} aria-label="Contamos com você, sempre!"
          style={{ position: "absolute", left: 76, top: 360, margin: 0, ...FR, fontSize: 84, lineHeight: 0.9, letterSpacing: "-.03em", whiteSpace: "nowrap", zIndex: 10, color: corTexto, textShadow: sombraTexto }}>
          {[letrasDaLinha("Contamos", 0), letrasDaLinha("com você, sempre!", 8)].map((linha, li) => (
            <span key={li} aria-hidden style={{ display: "block" }}>
              {linha.map((c) => (
                <span key={c.id} data-letra={c.id} className="h10-fl" style={{ color: pintadas[c.id] ?? corTexto, animationDelay: c.atraso }}>{c.ch}</span>
              ))}
            </span>
          ))}
        </h1>
      )}

      {/* agenda: rótulo + faixa com as duas primeiras */}
      <div style={{ position: "absolute", left: 0, top: 725, width: 400, height: 97, background: AMARELO, border: `1px solid ${PRETO}`, display: "flex", alignItems: "center", paddingLeft: 78, zIndex: 21 }}>
        <span style={{ ...FR, fontSize: 56, lineHeight: 1 }}>Agenda</span>
      </div>
      <div onClick={() => { setAgendaAberta(true); setSelNota(null); }} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAgendaAberta(true); } }}
        /* Vai até a borda: o protótipo parava em 1636 e deixava 284px de
           sobra à direita, que na tela virava um degrau sem função. O
           calendário continua flutuando por cima (z-index maior), e o
           respiro à direita mantém o texto fora de baixo dele — senão a
           anotação comprida some atrás do cartão em vez de cortar com "…". */
        style={{ position: "absolute", left: 336, top: 725, right: 0, height: 97, background: COR_NOTA, border: `1px solid ${PRETO}`, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, paddingLeft: 92, paddingRight: 345, zIndex: 20, fontSize: 20, lineHeight: 1.3, overflow: "hidden", cursor: "pointer" }}>
        {agendaFaixa.map((a) => (
          <div key={a.id} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: a.feito ? "line-through" : "none", opacity: a.feito ? .55 : 1 }}>
            {/* dd/mm com os dois dígitos — sem o padStart a faixa misturava
                "25/09" com "7/08", que lê como erro de digitação. No cartão
                do dia (mais abaixo) o dia vai solto mesmo, sem zero. */}
            <span style={{ fontWeight: 600 }}>{a.chave ? `${a.dia.padStart(2, "0")}/${a.mm}` : "s/ data"}</span> {a.texto}
          </div>
        ))}
        {agendaTodas.length === 0 && <div style={{ opacity: .6 }}>Nenhuma anotação ainda — clique num dia do calendário para começar.</div>}
      </div>
      {agendaTodas.length > 1 && (
        <div className="h10-badge" style={{ position: "absolute", left: 585, top: 704, display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: "50% 50% 50% 2px", background: AMARELO, color: PRETO, border: `1px solid ${PRETO}`, fontFamily: INTER, fontSize: 16, fontWeight: 700, boxShadow: "0 6px 14px rgba(0,0,0,.25)", zIndex: 30, animation: "h10badge 2.2s ease-in-out infinite" }}>
          {agendaTodas.length}
        </div>
      )}

      {/* calendário */}
      <div style={{ position: "absolute", left: 1599, top: 614, width: 242, height: 245, background: AMARELO, border: `1px solid ${PRETO}`, borderRadius: 20, zIndex: 36, padding: "16px 18px 14px", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <button onClick={() => setVerOffset((o) => Math.max(minOffset, o - 1))} title="Mês anterior" disabled={semAnterior}
            style={{ flex: "none", width: 24, height: 24, borderRadius: 999, border: `1px solid ${PRETO}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: semAnterior ? "default" : "pointer", opacity: semAnterior ? .35 : 1, padding: 0 }}>
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: "center", ...FR, fontSize: 20, lineHeight: 1.05, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{MESES[vMes]} {vAno}</div>
          <button onClick={() => setVerOffset((o) => Math.min(36, o + 1))} title="Próximo mês" disabled={semProximo}
            style={{ flex: "none", width: 24, height: 24, borderRadius: 999, border: `1px solid ${PRETO}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: semProximo ? "default" : "pointer", opacity: semProximo ? .35 : 1, padding: 0 }}>
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginTop: 10, fontWeight: 700, fontSize: 12, textAlign: "center" }}>
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <div style={{ height: 2, background: PRETO, margin: "6px 0 2px" }} />
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7,1fr)", gridAutoRows: "1fr", alignItems: "center" }}>
          {diasCal.map((d, i) => (
            <div key={i} onClick={() => { if (d.key) { setDiaSel(d.key); setRascunho(""); } }} title={d.feriado || undefined}
              style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", height: "100%", paddingRight: 3, fontFamily: INTER, fontSize: 13, fontWeight: d.feriado ? 700 : 400, cursor: d.key ? "pointer" : "default" }}>
              {d.feriado
                ? <span style={{ position: "absolute", top: "50%", right: -2, transform: "translateY(-50%)", display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 999, background: "#fff", fontWeight: 700 }}>{d.txt}</span>
                : <span style={{ fontWeight: d.hoje ? 700 : 400 }}>{d.txt}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* popover do dia */}
      {pop && (
        <div style={{ ...CAIXA, left: 1156, top: 200, width: 340, zIndex: 80 }}>
          <div style={{ ...CABECA(COR_NOTA), padding: "18px 20px 14px" }}>
            <span style={{ ...FR, fontSize: 26, lineHeight: 1 }}>{pop.titulo}</span>
            <button onClick={() => { setDiaSel(null); setRascunho(""); }} aria-label="Fechar" style={FECHAR_X}>✕</button>
          </div>
          <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {!!pop.feriado && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: AMARELO, border: `1px solid ${PRETO}`, borderRadius: 12, padding: "8px 12px", fontSize: 15, fontWeight: 600 }}>🇧🇷 {pop.feriado}</div>
            )}
            {pop.itens.map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: 999, background: PRETO, marginTop: 8, flex: "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: ".02em", color: "#6b6b6b" }}>{ev.hora}</div>
                  <div style={{ fontSize: 18, lineHeight: 1.35, textDecoration: ev.feito ? "line-through" : "none", color: ev.feito ? "#9a9a9a" : PRETO }}>{ev.texto}</div>
                </div>
              </div>
            ))}
            <textarea value={rascunho} onChange={(e) => setRascunho(e.target.value)} placeholder="Escreva o que precisar…"
              style={{ ...AREA_TEXTO, minHeight: 74, fontSize: 17, lineHeight: 1.4 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {!!rascunho.trim() && <button onClick={() => setRascunho("")} style={BOTAO_CLARO}>Limpar</button>}
                {!!pop.ultima && <button onClick={apagarUltima} style={BOTAO_CLARO}>Apagar</button>}
              </div>
              <button onClick={salvarNota} disabled={ocupado || !rascunho.trim()} style={{ ...BOTAO_ESCURO, marginLeft: "auto", opacity: ocupado || !rascunho.trim() ? .5 : 1 }}>Adicionar à agenda</button>
            </div>
          </div>
        </div>
      )}

      {/* agenda inteira */}
      {agendaAberta && (
        <div style={{ ...CAIXA, left: 336, top: 384, width: 466, zIndex: 80 }}>
          <div style={CABECA(AMARELO)}>
            <span style={{ ...FR, fontSize: 30, lineHeight: 1 }}>Agenda</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {!!notaSel && (
                <>
                  <button onClick={concluirSel} style={{ ...BOTAO_CLARO, fontSize: 13, padding: "6px 12px" }}>{notaSel.feito ? "Reabrir" : "Concluir"}</button>
                  <button onClick={apagarSel} style={{ ...BOTAO_CLARO, fontSize: 13, padding: "6px 12px" }}>Apagar</button>
                </>
              )}
              <button onClick={() => { setAgendaAberta(false); setSelNota(null); }} aria-label="Fechar" style={FECHAR_X}>✕</button>
            </div>
          </div>
          <div style={{ maxHeight: 360, overflow: "auto", padding: "8px 0" }}>
            {agendaTodas.map((a) => (
              <div key={a.id} onClick={() => setSelNota((s) => (s === a.id ? null : a.id))}
                style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 22px", borderBottom: "1px solid #ececec", background: selNota === a.id ? AMARELO : "#fff", cursor: "pointer" }}>
                <div style={{ flex: "none", width: 52, height: 52, borderRadius: 14, background: AMARELO, border: `1px solid ${PRETO}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                  <span style={{ ...FR, fontSize: 22 }}>{a.dia}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em" }}>{a.mesAbrev}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 18, lineHeight: 1.35, textDecoration: a.feito ? "line-through" : "none", color: a.feito ? "#9a9a9a" : PRETO }}>{a.texto}</div>
              </div>
            ))}
            {agendaTodas.length === 0 && <div style={{ padding: "26px 22px", fontSize: 17, color: "#8f8f8f" }}>Nenhuma anotação na agenda ainda.</div>}
          </div>
        </div>
      )}

      {/* rodapé */}
      <div style={{ position: "absolute", left: 84, top: 995, color: "#fff", fontFamily: INTER, fontSize: 24, whiteSpace: "nowrap", zIndex: 30, display: "flex", alignItems: "baseline", gap: 12 }}>
        <span>{dataAgora}</span><span style={{ fontWeight: 600 }}>{horaAgora}</span>
      </div>
      {/* "Como usar" saiu: apontava para lugar nenhum e não vai existir.
          Sugestões toma o lugar dela, à esquerda, onde o olho já ia. */}
      <a href="#" onClick={(e) => { e.preventDefault(); setSugAberta(true); setSugEnviada(false); setSugTexto(""); }} className="h10-navi"
        style={{ position: "absolute", left: 484, top: 995, color: "#fff", fontSize: 24, whiteSpace: "nowrap", zIndex: 30, textDecoration: "none", cursor: "pointer" }}>Sugestões</a>
      <div style={{ position: "absolute", right: 80, top: 995, color: "#fff", ...FR, fontSize: 24, whiteSpace: "nowrap", zIndex: 30 }}>R2hub 1.0</div>

      {/* sugestões */}
      {sugAberta && (
        <div style={{ ...CAIXA, left: 764, top: 300, width: 440, zIndex: 90, boxShadow: "0 24px 60px rgba(0,0,0,.32)" }}>
          <div style={CABECA(AMARELO)}>
            <span style={{ ...FR, fontSize: 28, lineHeight: 1 }}>Sugestões</span>
            <button onClick={() => setSugAberta(false)} aria-label="Fechar" style={FECHAR_X}>✕</button>
          </div>
          <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            {sugEnviada ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "22px 0" }}>
                <span style={{ ...FR, fontSize: 24 }}>Obrigado! ✦</span>
                <span style={{ fontSize: 17, lineHeight: 1.4, color: "#444" }}>Sua sugestão foi enviada para a equipe do hub.</span>
              </div>
            ) : (
              <>
                <span style={{ fontSize: 17, lineHeight: 1.4, color: "#444" }}>Tem uma ideia para melhorar o R2hub? Conte pra gente.</span>
                <textarea value={sugTexto} onChange={(e) => setSugTexto(e.target.value)} placeholder="Ex.: seria ótimo se o calendário mostrasse os prazos de entrega…"
                  style={{ ...AREA_TEXTO, minHeight: 120, fontSize: 16, lineHeight: 1.4 }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <button onClick={() => setSugTexto("")} style={{ ...BOTAO_CLARO, padding: "10px 20px" }}>Apagar tudo</button>
                  <button onClick={enviarSug} disabled={ocupado || !sugTexto.trim()} style={{ ...BOTAO_ESCURO, padding: "10px 20px", opacity: ocupado || !sugTexto.trim() ? .5 : 1 }}>Enviar sugestão</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Barra do topo, configurações e sair vivem no cromo compartilhado do
          1.0 — a mesma barra serve esta tela e a de Novo pedido. */}
      <BarraTopoHub10 profile={profile} paginaAtiva="Home" aoNavegar={aoNavegar}
        onNova={podeCriar ? onNova : undefined} onLogout={onLogout} disponiveis={disponiveis} />


      {aviso && <AvisoV1a texto={aviso} onFechar={() => setAviso("")} />}
      {children}
    </PalcoFixo>
  );
}
