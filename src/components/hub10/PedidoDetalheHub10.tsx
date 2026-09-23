// Painel de detalhe do pedido — Hub 1.0.
// Fonte: design_handoff_hub_1.0/Pedido 1.0.dc.html (detalheAberto).
//
// Cobre a faixa 112..729 por cima da trilha. À esquerda, um cartão fixo com a
// cor do status, quem cuida, o cliente e os botões de ação; à direita, cinco
// painéis de 480px que rolam na horizontal: Briefing, Alterações,
// Especificações, Anexos/Design e Histórico.
//
// Quem pode o quê vem das permissões do hub, não de um papel de três valores
// como no protótipo — ver o cabeçalho de PedidoHub10.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { CampoHub10, FR, FUNDO_PAINEL, INTER, PRETO, numeroPedido } from "./ChromeHub10";
import { LOTTIE, LottieHub10 } from "./LottieHub10";

const CINZA = "#8a8a8a";
const CLARO = "#b3b1b3";
const VERMELHO = "#b3352f";

export type LinhaHistorico = { id: string; status: string; observacao: string | null; user_nome: string | null; created_at: string };
export type LinhaAnexo = { id: string; tipo: string; nome: string; versao?: number | null; created_at: string };
export type LinhaPergunta = {
  id: string; de_id?: string | null; para_id?: string | null;
  de_nome: string | null; para_nome: string | null; texto: string;
  created_at: string; resposta: string | null; respondida_em: string | null; respondida_por_nome: string | null;
};
export type DetalhePedido = {
  pedido: Record<string, unknown>;
  historico: LinhaHistorico[];
  anexos: LinhaAnexo[];
  perguntas: LinhaPergunta[];
  pasta: { nome: string; caminho: string } | null;
};

/** O que esta pessoa pode fazer neste pedido. Montado na rota, a partir das
    permissões — o painel só obedece. */
export type PodeNoPedido = {
  iniciar: boolean; enviarArte: boolean; aprovar: boolean; pedirRevisao: boolean;
  clicheria: boolean; finalizar: boolean; refazerCliche: boolean; reativar: boolean;
  cancelar: boolean; editar: boolean; perguntar: boolean; anexar: boolean;
};

export type AcoesPedido = {
  mudarStatus: (status: string, observacao?: string) => Promise<unknown>;
  /* quem chama pode omitir a observação — o painel preenche com OBS_PADRAO */
  perguntar: (texto: string) => Promise<unknown>;
  responder: (perguntaId: string, texto: string) => Promise<unknown>;
  salvarBriefing: (descricao: string, coresDesc: string) => Promise<unknown>;
  salvarEspec: (v: { materia: string; larg_materia: string; carreiras: string; picote: string; verniz: string; cold_stamp: string; tarja_verso: string }) => Promise<unknown>;
  anexar: (arquivos: File[]) => Promise<unknown>;
  removerAnexo: (anexoId: string) => Promise<unknown>;
  /* Abre a caixa de devolver arte. Quem hospeda é o PedidoHub10: a modal
     precisa de estado próprio e não cabe dentro do painel. */
  enviarArte: () => void;
  /* Manda a arte de fato, com versão, cores e observação. */
  enviarArteFinal: (d: { versao: string; cores: string[]; obs: string; arquivos: File[] }) => Promise<unknown>;
};

const ACABAMENTOS: { nome: string; campo: "picote" | "tarja_verso" | "cold_stamp" | "verniz" }[] = [
  { nome: "Picote", campo: "picote" },
  { nome: "Tarja no verso", campo: "tarja_verso" },
  { nome: "Cold stamp", campo: "cold_stamp" },
  { nome: "Verniz", campo: "verniz" },
];
const MATERIAIS = ["BOPP Removível", "BOPP metalizado", "BOPP transparente", "BOPP fosco", "Pérola", "Couché", "Cartão", "Térmico", "Nylon", "Polietileno"];

const PAINEL: CSSProperties = {
  position: "relative", flex: "0 0 480px", height: 616, scrollSnapAlign: "start",
  border: `1px solid ${PRETO}`, borderTop: "none", borderLeft: "none", color: PRETO,
  background: FUNDO_PAINEL, transition: "background .25s ease",
};
const TITULO_PAINEL: CSSProperties = { position: "absolute", left: 76, top: 111, width: 348, ...FR, fontSize: 56, lineHeight: "56px", letterSpacing: "-.04em" };
const MARCA: CSSProperties = { position: "absolute", left: 76, top: 58, fontSize: 18, fontWeight: 600, color: "#8f8f8f", whiteSpace: "nowrap" };
const ACAO: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", background: "none", border: "none", padding: 0, fontFamily: INTER, fontSize: 18, fontWeight: 500, color: PRETO, cursor: "pointer" };
const BOTAO_ESCURO: CSSProperties = { height: 52, display: "inline-flex", alignItems: "center", gap: 10, padding: "0 26px", border: "none", borderRadius: 999, background: PRETO, color: "#f1f1f1", fontFamily: INTER, fontSize: 20, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const BOTAO_VAZADO: CSSProperties = { ...BOTAO_ESCURO, background: "none", color: PRETO, border: `2px solid ${PRETO}`, padding: "0 24px" };
const ROTULO_PEQ: CSSProperties = { fontSize: 15, fontWeight: 700 };
const VALOR: CSSProperties = { marginTop: 3, fontSize: 18 };
const TRACEJADO: CSSProperties = { border: `1.5px dashed ${PRETO}`, borderRadius: 14, padding: "12px 14px", outline: "none", fontFamily: INTER, fontSize: 15, lineHeight: 1.45, color: PRETO, background: "transparent", boxSizing: "border-box" };
const VEU: CSSProperties = { position: "absolute", left: 0, top: 0, width: 1920, height: 616, background: "rgba(37,36,37,.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" };
const CARTAO_MODAL: CSSProperties = { background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 22, padding: "38px 44px", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)" };

/* Texto padrão do histórico por transição. Sem isto metade das linhas ficava
   em branco — o histórico mostrava "criacao" e "aprovada" sem dizer nada, e
   quem abre o pedido meses depois não tem o que ler. */
const OBS_PADRAO: Record<string, string> = {
  criacao: "Criação iniciada",
  aprovada: "Arte aprovada pela vendedora",
  cliche: "Enviado para a clicheria",
  refazer_cliche: "Clichê marcado para refação",
  concluido: "Pedido finalizado",
  cancelado: "Pedido cancelado",
  nova: "Pedido reativado",
};

const quando = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};
const texto = (v: unknown) => (v == null || v === "" ? "—" : String(v));
const ligado = (v: unknown) => String(v ?? "0") === "1";

function BotaoX({ aoClicar, rotulo = "Fechar", cor = PRETO, tamanho = 40 }: { aoClicar: () => void; rotulo?: string; cor?: string; tamanho?: number }) {
  return (
    <button onClick={aoClicar} className="p10-flat" aria-label={rotulo}
      style={{ width: tamanho, height: tamanho, borderRadius: 999, border: `2px solid ${cor}`, background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
      <svg viewBox="0 0 24 24" width={tamanho * 0.45} height={tamanho * 0.45} fill="none" stroke={cor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
    </button>
  );
}

/** Fileira "Anexar arquivo" + as pílulas amarelas do que já foi escolhido.
    É o mesmo bloco em todas as caixas de escrever do projeto. */
function LinhaAnexar({ arquivos, aoEscolher, aoTirar, rotulo = "Anexar arquivo", altura = 50 }: {
  arquivos: File[]; aoEscolher: (fs: File[]) => void; aoTirar: (i: number) => void;
  rotulo?: string;
  /** a mesma altura dos botões que ficam ao lado — a pílula destoava por ser
      mais baixa que o "Fechar" e o "Responder" da caixa de conversa */
  altura?: number;
}) {
  /* texto acompanha a altura, como nos botões vizinhos */
  const corpo = altura >= 56 ? 18 : 15;
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      <label className="p10-flat" style={{ display: "inline-flex", alignItems: "center", gap: 8, height: altura, padding: "0 22px", border: `1.5px dashed ${PRETO}`, borderRadius: 999, fontFamily: INTER, fontSize: corpo, fontWeight: 600, color: PRETO, cursor: "pointer" }}>
        <input type="file" multiple style={{ display: "none" }}
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) aoEscolher(fs); }} />
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        {rotulo}
      </label>
      {arquivos.map((a, i) => (
        <div key={`${a.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 8px 0 15px", border: `1px solid ${PRETO}`, borderRadius: 999, background: "#fff079", fontSize: 14, fontWeight: 500 }}>
          <span style={{ maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
          <button onClick={() => aoTirar(i)} aria-label={`Remover ${a.name}`}
            style={{ flex: "none", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/** Caixa de escrever com anexos — serve para pergunta, alteração e revisão. */
function ModalEscrever({ titulo, sub, marcador, rotuloBotao, ocupado, aoCancelar, aoConfirmar }: {
  titulo: string; sub: string; marcador: string; rotuloBotao: string; ocupado: boolean;
  aoCancelar: () => void; aoConfirmar: (texto: string, arquivos: File[]) => void;
}) {
  const [txt, setTxt] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const pronto = !!txt.trim() && !ocupado;
  return (
    <div style={VEU}>
      <div style={{ ...CARTAO_MODAL, width: 720 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ ...FR, fontSize: 38, letterSpacing: "-.02em" }}>{titulo}</div>
          <BotaoX aoClicar={aoCancelar} />
        </div>
        <div style={{ fontSize: 17, color: CINZA, marginTop: -6 }}>{sub}</div>
        <textarea autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={marcador} aria-label={titulo}
          style={{ ...TRACEJADO, width: "100%", height: 148, borderRadius: 16, padding: "16px 18px", resize: "none", fontSize: 18 }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <LinhaAnexar arquivos={arquivos} aoEscolher={(fs) => setArquivos([...arquivos, ...fs])}
            aoTirar={(i) => setArquivos(arquivos.filter((_, j) => j !== i))} />
          <div style={{ flex: "none", display: "flex", gap: 12, alignItems: "center" }}>
            <button onClick={aoCancelar} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Cancelar</button>
            <button onClick={() => pronto && aoConfirmar(txt.trim(), arquivos)} className="p10-flat" disabled={!pronto}
              style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 30px", background: pronto ? PRETO : CLARO, cursor: pronto ? "pointer" : "default" }}>
              {ocupado ? "Enviando…" : rotuloBotao}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** As duas caixas que SALTAM ao abrir o pedido: a pergunta que espera por
    você e a resposta que chegou. O projeto as abre sozinhas de propósito —
    parado num painel, o recado era esquecido. */
function ModalConversa({ titulo, texto, marcador, ocupado, aoFechar, aoResponder }: {
  titulo: string; texto: string; marcador: string; ocupado: boolean;
  aoFechar: () => void; aoResponder: (texto: string, arquivos: File[]) => void;
}) {
  const [txt, setTxt] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const pronto = !!txt.trim() && !ocupado;
  return (
    <div style={{ ...VEU, background: "rgba(37,36,37,.86)", zIndex: 72 }}>
      <div style={{ ...CARTAO_MODAL, width: 760, borderRadius: 24, padding: "44px 56px", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: "none", width: 64, height: 64, borderRadius: 999, background: "#fff079", border: `1px solid ${PRETO}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
          </div>
          <div style={{ ...FR, fontSize: 38, letterSpacing: "-.02em", lineHeight: 1.06 }}>{titulo}</div>
        </div>
        <div style={{ marginTop: 20, fontSize: 20, lineHeight: 1.5, background: "#fff079", borderRadius: 14, padding: "16px 20px" }}>{texto}</div>
        <textarea autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={marcador} aria-label={marcador}
          style={{ ...TRACEJADO, marginTop: 20, width: "100%", height: 120, borderRadius: 16, padding: "14px 18px", resize: "none", fontSize: 18 }} />
        <div style={{ marginTop: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <LinhaAnexar arquivos={arquivos} aoEscolher={(fs) => setArquivos([...arquivos, ...fs])}
            aoTirar={(i) => setArquivos(arquivos.filter((_, j) => j !== i))} altura={56} />
          <div style={{ flex: "none", display: "flex", gap: 12, alignItems: "center" }}>
            {/* O projeto não põe saída na caixa da pergunta — quem abre o
                pedido só sai respondendo. Aqui há "Fechar": nem sempre a
                resposta está na mão na hora. A insistência continua, porque
                a caixa volta a saltar toda vez que o pedido for aberto. */}
            <button onClick={aoFechar} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 56, fontSize: 18 }}>Fechar</button>
            <button onClick={() => pronto && aoResponder(txt.trim(), arquivos)} className="p10-flat" disabled={!pronto}
              style={{ ...BOTAO_ESCURO, height: 56, fontSize: 19, padding: "0 40px", background: pronto ? PRETO : CLARO, cursor: pronto ? "pointer" : "default" }}>
              {ocupado ? "Enviando…" : "Responder"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Confirmação de que algo saiu daqui — o `okModal`/`designOk` do handoff.
    Sem ela o painel fica mudo depois de enviar: a modal fecha e nada diz se
    a pergunta partiu, nem para quem. */
export function ModalSucesso({ titulo, resumo, numero, aoFechar }: {
  /** pode vir com \n para quebrar em duas linhas, como no projeto */
  titulo: string; resumo: string; numero?: string; aoFechar: () => void;
}) {
  return (
    <div style={{ ...VEU, background: "rgba(37,36,37,.86)", zIndex: 70 }}>
      <div style={{ ...CARTAO_MODAL, width: 760, borderRadius: 24, padding: "52px 64px", alignItems: "center", textAlign: "center", gap: 0, boxShadow: "0 50px 110px -30px rgba(0,0,0,.6)" }}>
        <div style={{ width: 96, height: 96, borderRadius: 999, background: "#fff079", border: `1px solid ${PRETO}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 26 }}>
          {/* em laço, como no projeto: sem laço a animação termina num quadro
              vazio e o círculo amarelo fica pelado na tela */}
          <LottieHub10 src={LOTTIE.sucesso} style={{ width: 56, height: 56 }} />
        </div>
        <div style={{ ...FR, fontSize: 42, letterSpacing: "-.02em", lineHeight: 1.06, whiteSpace: "pre-line" }}>{titulo}</div>
        <div style={{ marginTop: 20, fontSize: 20, lineHeight: 1.5, color: CINZA }}>{resumo}</div>
        {numero && (
          <div style={{ marginTop: 30, display: "flex", alignItems: "center", height: 44, padding: "0 22px", borderRadius: 999, background: "#f4f4f2", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, fontWeight: 600 }}>Nº do pedido {numero}</div>
        )}
        <button onClick={aoFechar} className="p10-flat" autoFocus
          style={{ ...BOTAO_ESCURO, marginTop: 34, height: 56, padding: "0 40px", fontSize: 19 }}>Voltar ao pedido</button>
      </div>
    </div>
  );
}

export function PedidoDetalheHub10({ dados, cor, tinta, statusRotulo, temOndas, pode, acoes, aoFechar, souVendedor = false, souAdmin = false, euId, respostaNova = false }: {
  dados: DetalhePedido;
  cor: string; tinta: string; statusRotulo: string; temOndas?: string;
  pode: PodeNoPedido;
  acoes: AcoesPedido;
  aoFechar: () => void;
  /** quem está olhando é a vendedora do pedido — decide para quem vai a
      pergunta, do mesmo jeito que o servidor decide */
  souVendedor?: boolean;
  /** administrador: único que mexe em pedido já finalizado */
  souAdmin?: boolean;
  /** id de quem está olhando: decide qual pergunta é para você */
  euId?: string;
  /** o card trazia aviso de resposta nova quando foi aberto */
  respostaNova?: boolean;
}) {
  const p = dados.pedido;
  const status = String(p.status ?? "");
  const [editando, setEditando] = useState<null | "briefing" | "especificacoes">(null);
  const [aba, setAba] = useState(0);
  const [escrever, setEscrever] = useState<null | "pergunta" | "alteracao" | "revisao">(null);
  const [cancelar, setCancelar] = useState(false);
  /* confirmação depois de enviar pergunta ou resposta */
  const [sucesso, setSucesso] = useState<{ titulo: string; resumo: string } | null>(null);
  /* anexo esperando confirmação para sair do pedido */
  const [desvincular, setDesvincular] = useState<{ id: string; nome: string } | null>(null);
  const [respondendo, setRespondendo] = useState<LinhaPergunta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [maisDir, setMaisDir] = useState(true);
  const trilha = useRef<HTMLDivElement | null>(null);
  const entradaAnexo = useRef<HTMLInputElement | null>(null);

  /* formulários de edição */
  const [fBrief, setFBrief] = useState({ descricao: "", cores: "" });
  const [fEspec, setFEspec] = useState({ materia: "", larg_materia: "", carreiras: "", picote: "0", verniz: "0", cold_stamp: "0", tarja_verso: "0" });
  const [popMateria, setPopMateria] = useState(false);
  const [popAcab, setPopAcab] = useState(false);

  /* ————— o que salta ao abrir o pedido —————
     Duas situações valem interromper: existe pergunta esperando por VOCÊ, e
     chegou resposta a uma pergunta SUA. Parada num painel, a conversa era
     esquecida; o projeto abre a caixa por cima, e é isso que se quer. */
  const perguntaParaMim = useMemo(
    () => (euId ? dados.perguntas.find((q) => q.para_id === euId && !q.respondida_em) ?? null : null),
    [dados.perguntas, euId],
  );
  const respostaParaMim = useMemo(
    () => (euId && respostaNova ? dados.perguntas.find((q) => q.de_id === euId && q.respondida_em) ?? null : null),
    [dados.perguntas, euId, respostaNova],
  );
  const [saltouEm, setSaltouEm] = useState<string | null>(null);
  const alvoSalto = perguntaParaMim ?? respostaParaMim;
  const ehResposta = !perguntaParaMim && !!respostaParaMim;
  /* `saltouEm` guarda o id já mostrado: depois de fechar (ou responder) a
     caixa não volta enquanto o painel estiver aberto. Ao abrir o pedido de
     novo ela salta outra vez, se ainda houver o que responder. */
  const salto = alvoSalto && saltouEm !== alvoSalto.id ? alvoSalto : null;

  /* Para quem vai a pergunta — a mesma conta que o servidor faz: quem
     pergunta sendo a vendedora fala com o designer; o resto fala com a
     vendedora do pedido. */
  const destinoPergunta = souVendedor
    ? (String(p.designer_nome ?? "") || "o time de design")
    : (String(p.vendedor_nome ?? "") || "quem abriu o pedido");

  /* As caixas de escrever do projeto aceitam anexo, mas `perguntar` e
     `mudarStatus` não levam arquivo. Os arquivos sobem antes, como anexo do
     pedido — que é onde eles precisam estar de qualquer forma. */
  const comAnexos = async (arquivos: File[], acao: () => Promise<unknown>) => {
    if (arquivos.length) await acoes.anexar(arquivos);
    return acao();
  };

  const abrirEdicao = (qual: "briefing" | "especificacoes") => {
    setErro("");
    if (qual === "briefing") setFBrief({ descricao: String(p.descricao ?? ""), cores: String(p.cores_desc ?? "") });
    else setFEspec({
      materia: String(p.materia ?? ""), larg_materia: String(p.larg_materia ?? ""), carreiras: String(p.carreiras ?? ""),
      picote: ligado(p.picote) ? "1" : "0", verniz: ligado(p.verniz) ? "1" : "0",
      cold_stamp: ligado(p.cold_stamp) ? "1" : "0", tarja_verso: ligado(p.tarja_verso) ? "1" : "0",
    });
    setEditando(qual);
  };

  const rodar = (fn: () => Promise<unknown>, depois?: () => void) => {
    if (ocupado) return;
    setOcupado(true); setErro("");
    void Promise.resolve(fn())
      .then(() => depois?.())
      .catch((e: unknown) => setErro(e instanceof Error ? e.message : "Não deu certo."))
      .finally(() => setOcupado(false));
  };

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (escrever || cancelar || respondendo) { setEscrever(null); setCancelar(false); setRespondendo(null); return; }
      if (editando) { setEditando(null); return; }
      aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [escrever, cancelar, respondendo, editando, aoFechar]);

  /* Alterações = os pedidos de revisão do histórico. É onde o hub já guarda
     "o que a vendedora mandou mudar" — não há lista separada. */
  const alteracoes = useMemo(
    () => dados.historico.filter((h) => h.status === "revisao").slice().reverse(),
    [dados.historico],
  );
  const anexosPedido = dados.anexos.filter((a) => a.tipo !== "arte");
  const artes = dados.anexos.filter((a) => a.tipo === "arte");
  const perguntaAberta = dados.perguntas.find((q) => !q.respondida_em) ?? null;
  const acabamentos = ACABAMENTOS.filter((a) => ligado(p[a.campo])).map((a) => a.nome);
  const cores = String(p.cores_desc ?? "").split(/[,;]/).map((s) => s.trim()).filter(Boolean);

  const medida = p.largura && p.altura ? `${p.largura}×${p.altura}` : texto(p.largura ?? p.altura);
  /* Quem saiu do fluxo não se edita. Augusto, 23/09/2026: "pedido finalizado
     só adm pode alterar" e "o cancelado não é editável". Cancelado é fechado
     para todos — para mexer nele, reativa primeiro. */
  const podeEditarAqui = pode.editar
    && status !== "cancelado"
    && (status !== "concluido" || souAdmin);
  const podeCancelarAqui = pode.cancelar && status !== "cancelado" && status !== "concluido";

  return (
    <div style={{ position: "absolute", left: 0, top: 112, width: 1920, height: 617, background: "#f1f1f1", zIndex: 38, overflow: "hidden" }}>
      <div ref={trilha} className="p10-trilha" onScroll={(e) => {
        const el = e.currentTarget;
        setMaisDir(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
      }} style={{ height: 616, display: "flex", overflowX: "auto", overflowY: "hidden", scrollBehavior: "smooth" }}>

        {/* espaço do cartão fixo, que flutua por cima */}
        <div style={{ flex: "0 0 480px", height: 616, scrollSnapAlign: "start" }} />

        {/* ————— cartão do pedido ————— */}
        <div style={{ position: "absolute", left: 0, top: 0, width: 480, height: 617, zIndex: 5, background: cor, color: tinta, borderRight: `1px solid ${PRETO}` }}>
          {temOndas && <LottieHub10 src={temOndas} encaixe="slice" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }} />}
          <span style={{ position: "absolute", left: 80, top: 58, fontSize: 24, fontWeight: 500, letterSpacing: "-.02em", zIndex: 1 }}>{texto(p.designer_nome ?? p.vendedor_nome)}</span>

          <button onClick={aoFechar} className="p10-flat" aria-label="Fechar"
            style={{ position: "absolute", left: 400, top: 50, width: 44, height: 44, borderRadius: 999, border: `2px solid ${tinta}`, background: "#FFFFFFEB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, zIndex: 2 }}>
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={tinta} strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>

          {podeCancelarAqui && (
            <button onClick={() => setCancelar(true)} className="p10-flat" title="Cancelar pedido" aria-label="Cancelar pedido"
              style={{ position: "absolute", right: 96, top: 50, width: 44, height: 44, borderRadius: 999, border: `2px solid ${VERMELHO}`, background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, zIndex: 2 }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={VERMELHO} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
            </button>
          )}

          {/* Pergunta aberta: só o ícone, ao lado da lixeira. Antes era uma
              pílula flutuante no rodapé do painel, que caía por cima de
              Medida e Substrato. O `right` acompanha a lixeira — quando ela
              não aparece, o ícone ocupa o lugar dela. */}
          {perguntaAberta && (
            <div title="Há uma pergunta aberta neste pedido, esperando resposta"
              /* 155, e não 152: o balão é mais largo que a caixa de 44 (ele
                 transborda 0,2 de cada lado), o que deixava o vão até a
                 lixeira em 14,1 contra os 17 que a lixeira tem até o fechar.
                 Os 3px empatam os dois vãos. */
              style={{ position: "absolute", right: podeCancelarAqui ? 155 : 99, top: 50, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, pointerEvents: "none" }}>
              {/* 53, e não 44: a Lottie reserva margem própria, então numa
                  caixa de 40 o balão saía com 33,5 de largura e parecia menor
                  que os círculos de 44 ao lado. 53 × (33,5/40) = 44,4 — mesmo
                  tamanho aparente dos vizinhos. A sobra passa da caixa de
                  layout de propósito, para o espaçamento não mudar. */}
              <LottieHub10 src={LOTTIE.chat}
                /* o -3.6 alinha o CENTRO do balão com o dos botões ao lado: o
                   desenho não é centrado na tela da Lottie, então centrar a
                   caixa deixava o balão 3,6px mais baixo que os vizinhos */
                style={{ width: 53, height: 53, flex: "none", transform: "translateY(-3.6px)" }} />
            </div>
          )}

          <div style={{ position: "absolute", left: 76, top: 111, width: 335, ...FR, fontSize: 56, lineHeight: "58px", letterSpacing: "-.04em", zIndex: 1 }}>{texto(p.cliente)}</div>

          <div style={{ position: "absolute", left: 76, top: 347, right: 36, zIndex: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
            {pode.iniciar && status === "nova" && (
              <button onClick={() => rodar(() => acoes.mudarStatus("criacao", OBS_PADRAO.criacao))} className="p10-flat" style={{ ...BOTAO_ESCURO, fontSize: 22 }}>
                <svg width={19} height={19} viewBox="0 0 24 24" fill="#f1f1f1"><polygon points="6 4 20 12 6 20 6 4" /></svg>Iniciar criação
              </button>
            )}
            {status === "aguardando" && pode.aprovar && (
              <button onClick={() => rodar(() => acoes.mudarStatus("aprovada", OBS_PADRAO.aprovada))} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Aprovar
              </button>
            )}
            {status === "aguardando" && pode.pedirRevisao && (
              <button onClick={() => setEscrever("revisao")} className="p10-flat" style={BOTAO_VAZADO}>Pedir revisão</button>
            )}
            {status === "aprovada" && pode.clicheria && (
              <button onClick={() => rodar(() => acoes.mudarStatus("cliche", OBS_PADRAO.cliche))} className="p10-flat" style={BOTAO_ESCURO}>Enviar p/ clicheria</button>
            )}
            {status === "cliche" && pode.finalizar && (
              <button onClick={() => rodar(() => acoes.mudarStatus("concluido", OBS_PADRAO.concluido))} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Finalizar
              </button>
            )}
            {status === "cliche" && pode.refazerCliche && (
              <button onClick={() => rodar(() => acoes.mudarStatus("refazer_cliche", "Clichê marcado para refação"))} className="p10-flat" style={BOTAO_VAZADO}>Refazer clichê</button>
            )}
            {status === "refazer_cliche" && pode.clicheria && (
              <button onClick={() => rodar(() => acoes.mudarStatus("cliche", "Reenviado para a clicheria"))} className="p10-flat" style={BOTAO_ESCURO}>Reenviar p/ clicheria</button>
            )}
            {status === "revisao" && pode.enviarArte && (
              <button onClick={acoes.enviarArte} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>Reenviar arte
              </button>
            )}
            {status === "criacao" && pode.enviarArte && (
              <button onClick={acoes.enviarArte} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>Enviar arte
              </button>
            )}
            {status === "cancelado" && pode.reativar && (
              <button onClick={() => rodar(() => acoes.mudarStatus("nova", "Pedido reativado"))} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>Reativar pedido
              </button>
            )}
            {/* Sem ação para este status e esta pessoa: mostra o estado. */}
            {!((pode.iniciar && status === "nova") || (status === "aguardando" && (pode.aprovar || pode.pedirRevisao))
              || (status === "aprovada" && pode.clicheria) || (status === "cliche" && (pode.finalizar || pode.refazerCliche))
              || (status === "refazer_cliche" && pode.clicheria) || ((status === "revisao" || status === "criacao") && pode.enviarArte)
              || (status === "cancelado" && pode.reativar)) && (
              <div style={{ height: 50, display: "inline-flex", alignItems: "center", padding: "0 24px", border: `2px solid ${tinta}`, borderRadius: 999, fontSize: 24, fontWeight: 600, whiteSpace: "nowrap", color: tinta }}>{statusRotulo}</div>
            )}
          </div>

          {/* minmax(0,1fr) em vez de `auto`: ver o comentário gêmeo no card da
              trilha — a coluna crescia e o substrato vazava do cartão. */}
          <div style={{ position: "absolute", left: 82, right: 40, top: 413, display: "grid", gridTemplateColumns: "206px minmax(0, 1fr)", rowGap: 30, zIndex: 1 }}>
            {[["Entrada:", quando(String(p.created_at)).split(" ·")[0]], ["Cores:", texto(p.cores)], ["Medida:", medida], ["Substrato:", texto(p.materia)]].map(([r, v], i) => (
              <CampoHub10 key={r} rotulo={r} valor={v}
                caixa={i < 2 ? { position: "relative", top: 12 } : undefined} />
            ))}
          </div>
        </div>

        {/* ————— 1. Briefing ————— */}
        <div style={{ ...PAINEL, background: editando === "briefing" ? "#FFE815" : FUNDO_PAINEL }}>
          <div style={{ position: "absolute", left: 80, top: 58, right: 80, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
            {editando === "briefing" ? (
              <>
                <button onClick={() => rodar(() => acoes.salvarBriefing(fBrief.descricao, fBrief.cores), () => setEditando(null))} className="p10-flat" style={{ ...ACAO, fontWeight: 700 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Salvar
                </button>
                <button onClick={() => setEditando(null)} className="p10-flat" style={{ ...ACAO, color: CINZA }}>Cancelar</button>
              </>
            ) : (
              <>
                {podeEditarAqui ? <button onClick={() => abrirEdicao("briefing")} className="p10-flat" style={ACAO}>Editar</button> : <span />}
                {pode.perguntar && <button onClick={() => setEscrever("pergunta")} className="p10-flat" style={ACAO}>Perguntas</button>}
              </>
            )}
          </div>
          <div style={TITULO_PAINEL}>Briefing</div>
          {editando === "briefing" ? (
            <div style={{ position: "absolute", left: 76, top: 212, width: 348, display: "flex", flexDirection: "column", gap: 12 }}>
              <textarea value={fBrief.descricao} onChange={(e) => setFBrief({ ...fBrief, descricao: e.target.value })} placeholder="Briefing do pedido..." aria-label="Briefing"
                style={{ ...TRACEJADO, width: "100%", height: 236, resize: "none" }} />
              <input value={fBrief.cores} onChange={(e) => setFBrief({ ...fBrief, cores: e.target.value })} placeholder="Cores (ex.: Amarelo, Preto)" aria-label="Cores"
                style={{ ...TRACEJADO, width: "100%", borderRadius: 12, padding: "10px 14px" }} />
            </div>
          ) : (
            <>
              <div className="p10-trilha" style={{ position: "absolute", left: 76, top: 212, width: 348, maxHeight: 228, overflowY: "auto", fontSize: 17, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {String(p.descricao ?? "").trim() || "Sem briefing preenchido neste pedido."}
              </div>
              <div style={{ position: "absolute", left: 80, top: 495, right: 40, display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100" }}>{numeroPedido(Number(p.numero))}</div>
                {!!cores.length && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ font: `800 12px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA }}>Cores solicitadas</div>
                    <div style={{ display: "flex", alignItems: "center", fontSize: 18, fontWeight: 500, flexWrap: "wrap" }}>
                      {cores.map((c, i) => (
                        <span key={c + i}>{c}{i < cores.length - 1 && <span style={{ margin: "0 8px", color: CLARO }}>·</span>}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ————— 2. Alterações ————— */}
        <div style={PAINEL}>
          <span style={MARCA}>{alteracoes.length ? `${alteracoes.length} pedida(s)` : "—"}</span>
          {pode.pedirRevisao && (
            <div style={{ position: "absolute", left: 80, top: 58, right: 80, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setEscrever("revisao")} className="p10-flat" style={ACAO}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Nova alteração
              </button>
            </div>
          )}
          <div style={TITULO_PAINEL}>Alterações</div>
          {alteracoes.length ? (
            <div className="p10-trilha" style={{ position: "absolute", left: 80, top: 212, right: 80, bottom: 40, overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
              {alteracoes.map((h) => (
                <div key={h.id}>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{quando(h.created_at)}</div>
                  <div style={{ marginTop: 4, fontSize: 17, lineHeight: 1.4, overflowWrap: "anywhere" }}>{h.observacao || "—"}</div>
                  {h.user_nome && <div style={{ marginTop: 2, fontSize: 14, color: CINZA }}>{h.user_nome}</div>}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ position: "absolute", left: 76, top: 212, width: 348, fontSize: 17, lineHeight: 1.5, color: CLARO, fontStyle: "italic" }}>Nenhuma alteração registrada ainda.</div>
          )}
        </div>

        {/* ————— 3. Especificações ————— */}
        <div style={{ ...PAINEL, background: editando === "especificacoes" ? "#FFE815" : FUNDO_PAINEL }}>
          <span style={MARCA}>{numeroPedido(Number(p.numero))}</span>
          <div style={{ position: "absolute", left: 80, top: 58, right: 80, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 30 }}>
            {editando === "especificacoes" ? (
              <>
                <button onClick={() => rodar(() => acoes.salvarEspec(fEspec), () => setEditando(null))} className="p10-flat" style={{ ...ACAO, fontWeight: 700 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Salvar
                </button>
                <button onClick={() => setEditando(null)} className="p10-flat" style={{ ...ACAO, color: CINZA }}>Cancelar</button>
              </>
            ) : podeEditarAqui && <button onClick={() => abrirEdicao("especificacoes")} className="p10-flat" style={ACAO}>Editar</button>}
          </div>
          <div style={TITULO_PAINEL}>Especificações</div>

          {editando === "especificacoes" ? (
            <div style={{ position: "absolute", left: 76, top: 212, width: 352, display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div style={{ position: "relative" }} data-pop>
                  <div style={ROTULO_PEQ}>Matéria-prima:</div>
                  <button onClick={() => { setPopMateria(!popMateria); setPopAcab(false); }} className="p10-flat"
                    style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", background: "none", border: "none", borderBottom: `1.5px dashed ${PRETO}`, padding: "0 0 2px", fontFamily: INTER, fontSize: 17, color: PRETO, cursor: "pointer", textAlign: "left" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fEspec.materia || "—"}</span>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" style={{ flex: "none" }}><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {popMateria && (
                    <div style={{ position: "absolute", left: 0, top: 56, width: 230, maxHeight: 236, overflowY: "auto", background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12, padding: 6, zIndex: 20, boxShadow: "0 18px 40px -16px rgba(0,0,0,.5)" }}>
                      {MATERIAIS.map((m) => (
                        <button key={m} onClick={() => { setFEspec({ ...fEspec, materia: m }); setPopMateria(false); }}
                          style={{ display: "block", width: "100%", textAlign: "left", height: 36, padding: "0 12px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: INTER, fontSize: 14, fontWeight: 500, color: PRETO, background: m === fEspec.materia ? "#f1f1f1" : "transparent" }}>{m}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div style={ROTULO_PEQ}>Bobina:</div>
                  <input value={fEspec.larg_materia} onChange={(e) => setFEspec({ ...fEspec, larg_materia: e.target.value })} aria-label="Bobina"
                    style={{ marginTop: 3, width: "100%", boxSizing: "border-box", border: "none", borderBottom: `1.5px dashed ${PRETO}`, padding: "0 0 2px", outline: "none", fontFamily: INTER, fontSize: 18, color: PRETO, background: "transparent" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <div style={ROTULO_PEQ}>Carreiras:</div>
                  <input value={fEspec.carreiras} onChange={(e) => setFEspec({ ...fEspec, carreiras: e.target.value })} inputMode="numeric" aria-label="Carreiras"
                    style={{ marginTop: 3, width: "100%", boxSizing: "border-box", border: "none", borderBottom: `1.5px dashed ${PRETO}`, padding: "0 0 2px", outline: "none", fontFamily: INTER, fontSize: 18, color: PRETO, background: "transparent" }} />
                </div>
              </div>
              <div style={{ position: "relative" }} data-pop>
                <div style={ROTULO_PEQ}>Acabamento:</div>
                <button onClick={() => { setPopAcab(!popAcab); setPopMateria(false); }} className="p10-flat"
                  style={{ marginTop: 3, display: "inline-flex", alignItems: "flex-start", gap: 6, maxWidth: "100%", background: "none", border: "none", borderBottom: `1.5px dashed ${PRETO}`, padding: "0 0 2px", fontFamily: INTER, fontSize: 16, lineHeight: 1.35, color: PRETO, cursor: "pointer", textAlign: "left" }}>
                  {ACABAMENTOS.filter((a) => fEspec[a.campo] === "1").map((a) => a.nome).join(" + ") || "Selecionar acabamentos"}
                </button>
                {popAcab && (
                  <div style={{ position: "absolute", left: 0, top: 56, width: 250, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 12, padding: "11px 13px", zIndex: 20, boxShadow: "0 18px 40px -16px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", gap: 10 }}>
                    {ACABAMENTOS.map((a) => {
                      const on = fEspec[a.campo] === "1";
                      return (
                        <button key={a.nome} onClick={() => setFEspec({ ...fEspec, [a.campo]: on ? "0" : "1" })}
                          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                          <span style={{ flex: "none", width: 18, height: 18, border: `1.6px solid ${PRETO}`, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {on && <span style={{ width: 10, height: 10, borderRadius: 2, background: PRETO }} />}
                          </span>
                          <span style={{ fontSize: 15, color: PRETO }}>{a.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p10-trilha" style={{ position: "absolute", left: 76, top: 212, right: 40, bottom: 40, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 16px" }}>
                <div><div style={ROTULO_PEQ}>Matéria-prima:</div><div style={VALOR}>{texto(p.materia)}</div></div>
                <div><div style={ROTULO_PEQ}>Bobina:</div><div style={VALOR}>{p.larg_materia ? `${p.larg_materia}mm` : "—"}</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 16px" }}>
                <div><div style={ROTULO_PEQ}>Carreiras:</div><div style={VALOR}>{texto(p.carreiras)}</div></div>
                <div><div style={ROTULO_PEQ}>Medida:</div><div style={VALOR}>{medida}</div></div>
              </div>
              <div><div style={ROTULO_PEQ}>Acabamento:</div><div style={{ marginTop: 3, fontSize: 17, lineHeight: 1.4 }}>{acabamentos.join(" + ") || "—"}</div></div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 16px" }}>
                <div><div style={ROTULO_PEQ}>Forma:</div><div style={{ ...VALOR, overflowWrap: "anywhere" }}>{texto(p.forma)}</div></div>
                <div><div style={ROTULO_PEQ}>Nome da pasta:</div><div style={{ ...VALOR, overflowWrap: "anywhere" }}>{texto(dados.pasta?.nome ?? p.cliente)}</div></div>
              </div>
              {!!cores.length && (
                <div>
                  <div style={{ ...ROTULO_PEQ, marginBottom: 12 }}>Cores:</div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "14px 12px" }}>
                    {cores.map((c, i) => (
                      <div key={c + i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 18, height: 18, borderRadius: 999, background: "#e6e6e6", flex: "none", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} />
                        <span style={{ fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100", fontWeight: 600, fontSize: 17 }}>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ————— 4. Anexos / Design ————— */}
        <div style={PAINEL}>
          <span style={MARCA}>{artes.length ? `V${String(artes.length).padStart(2, "0")}` : "—"}</span>
          <div style={{ position: "absolute", left: 76, top: 111, width: 404, display: "flex", alignItems: "baseline", gap: 20 }}>
            {["Anexos", "Design"].map((r, i) => (
              <button key={r} onClick={() => setAba(i)}
                style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 72", fontWeight: aba === i ? 600 : 400, fontSize: 44, lineHeight: "52px", letterSpacing: "-.04em", color: aba === i ? PRETO : CLARO, width: 165 }}>{r}</button>
            ))}
          </div>
          <div className="p10-trilha" style={{ position: "absolute", left: 76, top: 200, right: 40, bottom: 36, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {aba === 0 ? (
              <>
                {pode.anexar && (
                  <label className="p10-flat" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 84, border: `1.5px dashed ${PRETO}`, borderRadius: 16, fontFamily: INTER, fontSize: 16, fontWeight: 600, color: PRETO, cursor: "pointer", width: 330 }}>
                    <input ref={entradaAnexo} type="file" multiple style={{ display: "none" }}
                      onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) rodar(() => acoes.anexar(fs)); }} />
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    {ocupado ? "Enviando…" : "Anexar arquivos"}
                  </label>
                )}
                {anexosPedido.length ? anexosPedido.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 46, padding: "0 16px", border: `1px solid ${PRETO}`, borderRadius: 12, fontSize: 15, fontWeight: 500, width: 329 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 12.5 12.5 21a4 4 0 0 1-5.7-5.7l8-8a2.5 2.5 0 0 1 3.6 3.6l-8 8a1 1 0 0 1-1.5-1.5l7.4-7.4" /></svg>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</span>
                    {pode.anexar && (
                      <button onClick={() => setDesvincular({ id: a.id, nome: a.nome })} aria-label={`Remover ${a.nome}`}
                        style={{ flex: "none", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    )}
                  </div>
                )) : <div style={{ fontSize: 17, lineHeight: 1.5, color: CLARO, fontStyle: "italic" }}>Nenhum anexo enviado com o pedido.</div>}
              </>
            ) : (
              <>
                {pode.enviarArte && (
                  <button onClick={acoes.enviarArte} className="p10-flat" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 84, border: `1.5px dashed ${PRETO}`, borderRadius: 16, background: "none", fontFamily: INTER, fontSize: 16, fontWeight: 600, color: PRETO, cursor: "pointer", width: 330 }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Enviar arte pronta
                  </button>
                )}
                {artes.length ? artes.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 46, padding: "0 16px", border: `1px solid ${PRETO}`, borderRadius: 12, fontSize: 15, fontWeight: 500, width: 330 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 15 5-5 5 5" /><circle cx="9" cy="9" r="1.4" /></svg>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nome}</span>
                  </div>
                )) : <div style={{ fontSize: 16, lineHeight: 1.5, color: CLARO, fontStyle: "italic" }}>Nenhuma arte finalizada anexada ainda.</div>}
              </>
            )}
          </div>
        </div>

        {/* ————— 5. Histórico ————— */}
        <div style={PAINEL}>
          <span style={MARCA}>{dados.historico.length} evento(s)</span>
          <div style={TITULO_PAINEL}>Histórico</div>
          <div className="p10-trilha" style={{ position: "absolute", left: 80, top: 212, right: 80, bottom: 40, overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
            {dados.historico.slice().reverse().map((h) => (
              <div key={h.id}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{quando(h.created_at)}</div>
                <div style={{ marginTop: 4, fontSize: 17, lineHeight: 1.4, overflowWrap: "anywhere" }}>{h.observacao || h.status}</div>
                {h.user_nome && <div style={{ marginTop: 2, fontSize: 14, color: CINZA }}>{h.user_nome}</div>}
              </div>
            ))}
            {!dados.historico.length && <div style={{ fontSize: 17, color: CLARO, fontStyle: "italic" }}>Pedido criado e enviado para a fila do design.</div>}
          </div>
        </div>

        {/* ————— 6. Conversa ————— */}
        <div style={PAINEL}>
          <span style={MARCA}>{dados.perguntas.length} pergunta(s)</span>
          {pode.perguntar && (
            <div style={{ position: "absolute", left: 80, top: 58, right: 80, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setEscrever("pergunta")} className="p10-flat" style={ACAO}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Perguntar
              </button>
            </div>
          )}
          <div style={TITULO_PAINEL}>Conversa</div>
          <div className="p10-trilha" style={{ position: "absolute", left: 80, top: 212, right: 80, bottom: 40, overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
            {dados.perguntas.length ? dados.perguntas.map((q) => (
              <div key={q.id}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{quando(q.created_at)}</div>
                <div style={{ marginTop: 4, fontSize: 17, lineHeight: 1.4, background: "#fff079", borderRadius: 12, padding: "10px 12px", overflowWrap: "anywhere" }}>{q.texto}</div>
                <div style={{ marginTop: 3, fontSize: 14, color: CINZA }}>{q.de_nome} → {q.para_nome}</div>
                {q.respondida_em ? (
                  <div style={{ marginTop: 8, fontSize: 17, lineHeight: 1.4, paddingLeft: 12, borderLeft: `3px solid ${PRETO}`, overflowWrap: "anywhere" }}>
                    {q.resposta}
                    <div style={{ marginTop: 3, fontSize: 14, color: CINZA }}>{q.respondida_por_nome} · {quando(q.respondida_em)}</div>
                  </div>
                ) : (
                  <button onClick={() => setRespondendo(q)} className="p10-flat"
                    style={{ marginTop: 8, height: 36, padding: "0 18px", borderRadius: 999, border: `2px solid ${PRETO}`, background: "none", fontFamily: INTER, fontSize: 15, fontWeight: 600, color: PRETO, cursor: "pointer" }}>Responder</button>
                )}
              </div>
            )) : <div style={{ fontSize: 17, color: CLARO, fontStyle: "italic" }}>Nenhuma pergunta neste pedido.</div>}
          </div>
        </div>
      </div>

      {maisDir && (
        <div className="p10-dica" style={{ position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)", zIndex: 37, pointerEvents: "none" }}>
          <LottieHub10 src={LOTTIE.seta} style={{ width: 44, height: 44, transform: "rotate(-90deg)" }} />
        </div>
      )}

      {/* ————— modais ————— */}
      {escrever === "pergunta" && (
        <ModalEscrever titulo={souVendedor ? "Perguntar ao designer" : "Perguntar ao vendedor"}
          sub={`Tire dúvidas sobre o pedido. ${destinoPergunta} vai receber um aviso.`}
          marcador="Ex.: O logo pode sair sobre o fundo escuro?" rotuloBotao="Enviar pergunta" ocupado={ocupado}
          aoCancelar={() => setEscrever(null)}
          aoConfirmar={(t, fs) => rodar(() => comAnexos(fs, () => acoes.perguntar(t)), () => {
            setEscrever(null);
            setSucesso({ titulo: `Pergunta enviada para\n${destinoPergunta}`, resumo: `“${t}”  ·  ${destinoPergunta} vai receber um aviso` });
          })} />
      )}
      {escrever === "revisao" && (
        <ModalEscrever titulo="Pedir revisão" sub="Descreva o que deve mudar na arte. Anexe referências se precisar."
          marcador="Ex.: Aumentar o logo, trocar o dourado por um tom mais claro..." rotuloBotao="Enviar revisão" ocupado={ocupado}
          aoCancelar={() => setEscrever(null)}
          aoConfirmar={(t, fs) => rodar(() => comAnexos(fs, () => acoes.mudarStatus("revisao", t)), () => setEscrever(null))} />
      )}
      {respondendo && (
        <ModalEscrever titulo="Responder" sub={respondendo.texto} marcador="Escreva sua resposta..."
          rotuloBotao="Responder" ocupado={ocupado}
          aoCancelar={() => setRespondendo(null)}
          aoConfirmar={(t, fs) => rodar(() => comAnexos(fs, () => acoes.responder(respondendo.id, t)), () => {
            const quem = respondendo.de_nome ?? "quem perguntou";
            setRespondendo(null);
            setSucesso({ titulo: `Resposta enviada para\n${quem}`, resumo: `“${t}”  ·  ${quem} vai receber um aviso` });
          })} />
      )}

      {/* A caixa que salta ao abrir: pergunta esperando por você, ou resposta
          que chegou. Fica por cima de tudo (z 72). */}
      {salto && (
        <ModalConversa
          titulo={ehResposta
            ? `Resposta de ${salto.respondida_por_nome ?? salto.para_nome ?? "quem respondeu"}`
            : `Pergunta de ${salto.de_nome ?? "quem perguntou"}`}
          texto={ehResposta ? (salto.resposta ?? "") : salto.texto}
          marcador={ehResposta ? "Escreva uma nova pergunta..." : "Escreva sua resposta..."}
          ocupado={ocupado}
          aoFechar={() => setSaltouEm(salto.id)}
          aoResponder={(t, fs) => rodar(
            () => comAnexos(fs, () => (ehResposta ? acoes.perguntar(t) : acoes.responder(salto.id, t))),
            () => {
              const quem = ehResposta
                ? destinoPergunta
                : (salto.de_nome ?? "quem perguntou");
              setSaltouEm(salto.id);
              setSucesso({
                titulo: `${ehResposta ? "Pergunta" : "Resposta"} enviada para\n${quem}`,
                resumo: `“${t}”  ·  ${quem} vai receber um aviso`,
              });
            },
          )} />
      )}

      {sucesso && <ModalSucesso titulo={sucesso.titulo} resumo={sucesso.resumo} aoFechar={() => setSucesso(null)} />}

      {/* Tirar anexo é um clique ao lado do nome do arquivo — perto demais de
          um acerto sem querer para não ter pergunta. O texto diz o que o hub
          faz de verdade: o arquivo continua na pasta do cliente, some só o
          vínculo com este pedido. */}
      {desvincular && (
        <div style={VEU}>
          <div style={{ ...CARTAO_MODAL, width: 480, padding: "40px 44px", gap: 14 }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>Tirar este anexo do pedido?</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              <b style={{ fontWeight: 600, color: PRETO }}>{desvincular.nome}</b> deixa de aparecer aqui. O arquivo continua na pasta do cliente, na rede — o hub não apaga nada de lá.
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setDesvincular(null)} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Voltar</button>
              <button onClick={() => rodar(() => acoes.removerAnexo(desvincular.id), () => setDesvincular(null))} className="p10-flat"
                style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 28px" }}>Tirar do pedido</button>
            </div>
          </div>
        </div>
      )}

      {cancelar && (
        <div style={VEU}>
          <div style={{ ...CARTAO_MODAL, width: 480, padding: "40px 44px", gap: 14 }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>Cancelar este pedido?</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>Use apenas quando o cliente desistir. O pedido sai do fluxo de produção; um administrador pode reativá-lo depois.</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setCancelar(false)} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Voltar</button>
              <button onClick={() => rodar(() => acoes.mudarStatus("cancelado", OBS_PADRAO.cancelado), () => { setCancelar(false); aoFechar(); })} className="p10-flat"
                style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 28px", background: VERMELHO, color: "#fff" }}>Sim, cancelar pedido</button>
            </div>
          </div>
        </div>
      )}

      {erro && (
        <div style={{ position: "absolute", left: "50%", bottom: 24, transform: "translateX(-50%)", zIndex: 80, display: "flex", alignItems: "center", gap: 12, background: VERMELHO, color: "#fff", borderRadius: 999, padding: "14px 24px", fontFamily: INTER, fontSize: 17, fontWeight: 600, boxShadow: "0 20px 44px -18px rgba(0,0,0,.55)" }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" /></svg>
          <span>{erro}</span>
          <button onClick={() => setErro("")} aria-label="Fechar aviso" style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, padding: 0 }}>✕</button>
        </div>
      )}

    </div>
  );
}
