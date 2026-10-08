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
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, PointerEvent as PointerEventReact } from "react";

import {
  CampoHub10, FR, FUNDO_PAINEL, INTER, NIVEL, NOME_CARTAO_V4, NomeDoCartaoV4, PE_CARTAO_V4, PRETO, PeDoCartaoV4, corpoDoNome, entrelinhaDoNome,
  numeroPedido, useEscDoTopo,
} from "./ChromeHub10";
import { LINHA_DA_GRADE, baseFraunces, baseInter } from "./grade-hub10";
import { STATUS_LABELS } from "@/lib/api/pedidos.functions";
import { corDoNome } from "../v1a/dados/pantone-busca";
import type { RegistroCliche } from "../v1a/modais/ClicheChegouModalV1a";
import { LOTTIE, LottieHub10, SetaDaTrilha } from "./LottieHub10";
import { CAPA_V4 } from "./CapaV4Hub10";
import { useEncaixeDaTrilha } from "./trilha-encaixe";
import { facasPerto, formaDoSistema, medidaBonita, medidaEmLados, useFacasVivas } from "./facas-vivas";
import { MEDIDAS } from "../v1a/dados/facas-cilindro";
import { criarBusca } from "@/lib/busca";
import { erroLegivel } from "@/lib/erro-legivel";
import { mesmasCores, numeroDeCores, separarCores } from "@/lib/cores";
import { PALETA } from "@/lib/paleta-hub";
import { chaveFaca } from "@/lib/chave-faca";
import { listZDasFacas } from "@/lib/api/facas.functions";
import { listPortaCliches } from "@/lib/api/porta-cliches.functions";
import { avisoDaClicheria, type Espessura, type PortaCliche } from "@/lib/porta-cliches";

const CINZA = "#8a8a8a";
const CLARO = "#b3b1b3";
const VERMELHO = PALETA.perigo;

export type LinhaHistorico = { id: string; status: string; observacao: string | null; user_nome: string | null; created_at: string };
export type LinhaAnexo = { id: string; tipo: string; nome: string; versao?: number | null; created_at: string; user_nome?: string | null };
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
  /** alterações já marcadas como atendidas (chave = id da linha do histórico) */
  revisoesResolvidas?: { chave: string; user_nome: string | null; created_at: string }[];
};

/** O que esta pessoa pode fazer neste pedido. Montado na rota, a partir das
    permissões — o painel só obedece. */
export type PodeNoPedido = {
  iniciar: boolean; enviarArte: boolean; aprovar: boolean; pedirRevisao: boolean;
  clicheria: boolean; finalizar: boolean; refazerCliche: boolean; reativar: boolean;
  cancelar: boolean;
  /** mudar o briefing e a matéria-prima (a regra do servidor) */
  editar: boolean;
  perguntar: boolean; anexar: boolean;
  /** abrir o Editar das Especificações (sem a chave, vale `editar`); lá
      dentro, a matéria-prima segue `editar` e bobina e carreiras, `faca` */
  editarEspec?: boolean;
  /** abrir e baixar arte e anexos (permissão anexo.baixar) */
  baixar: boolean;
  /** marcar e tirar a urgência */
  urgencia: boolean;
  /** trocar a faca (do catálogo ou faca nova) */
  faca: boolean;
  /** pôr o pedido esperando o cliente, e tirar */
  esperarCliente: boolean;
  /** riscar a alteração pedida como atendida */
  resolverAlteracao: boolean;
  /** subir arquivo (anexo.upload): sem ela, as caixas não oferecem anexo,
      que o servidor recusaria depois de a pergunta já ter ido */
  subirArquivo: boolean;
};

export type AcoesPedido = {
  /* `de`: a etapa em que esta tela viu o pedido; se ele mudou, o servidor recusa */
  /* `espessura`: a do clichê, no Enviar/Reenviar p/ clicheria (1.14 ou 1.70) */
  mudarStatus: (status: string, observacao?: string, de?: string, espessura?: string) => Promise<unknown>;
  /* quem chama pode omitir a observação — o painel preenche com OBS_PADRAO */
  perguntar: (texto: string) => Promise<unknown>;
  responder: (perguntaId: string, texto: string) => Promise<unknown>;
  salvarBriefing: (descricao: string, coresDesc: string) => Promise<unknown>;
  salvarEspec: (v: { materia: string; larg_materia: string; carreiras: string; picote: string; verniz: string; cold_stamp: string; tarja_verso: string }) => Promise<unknown>;
  anexar: (arquivos: File[]) => Promise<unknown>;
  /** guarda a arte final sem mudar o status (depois da aprovação) */
  anexarArte: (arquivos: File[]) => Promise<unknown>;
  removerAnexo: (anexoId: string) => Promise<unknown>;
  /** o arquivo num endereço temporário do navegador, para ver aqui mesmo */
  verArquivo: (anexoId: string, nome: string) => Promise<{ url: string; mime: string; nome: string }>;
  baixarArquivo: (anexoId: string, nome: string) => Promise<unknown>;
  /* Abre a caixa de devolver arte. Quem hospeda é o PedidoHub10: a modal
     precisa de estado próprio e não cabe dentro do painel. */
  enviarArte: () => void;
  /* Manda a arte de fato, com versão, cores e observação. */
  enviarArteFinal: (d: { versao: string; cores: string[]; obs: string; arquivos: File[] }) => Promise<unknown>;
  /* Abre a caixa "Clichê chegou". Quem hospeda é o PedidoHub10, pelo mesmo
     motivo do enviarArte: a caixa tem estado próprio e não cabe no painel. */
  finalizar: () => void;
  /* Grava a chegada do clichê e fecha o pedido — um gesto só. */
  registrarCliche: (r: RegistroCliche) => Promise<unknown>;
  /* Abre a caixa "Pasta do cliente" antes de iniciar a criação. Pedido novo
     nasce sem pasta: quem escolhe é o designer. Hospedada no PedidoHub10,
     como as outras caixas com estado próprio. */
  pedirPasta: () => void;
  /* Liga o pedido à pasta escolhida e leva os anexos que esperavam no hub. */
  confirmarPasta: (d: { pasta?: string; novaPasta?: string }) => Promise<unknown>;
  /** o pedido para esperando o cliente (texto legal, prova física, INCI) */
  aguardarCliente: (motivo: string) => Promise<unknown>;
  /** o cliente respondeu: o pedido volta para a etapa em que estava */
  clienteRespondeu: (observacao: string) => Promise<unknown>;
  /** marca (ou desmarca) uma alteração pedida como atendida */
  resolverAlteracao: (chave: string, resolvida: boolean) => Promise<unknown>;
  /** a lista de motivos do clichê, para o "Refazer clichê" */
  motivosDoCliche: () => Promise<{ id: string; nome: string }[]>;
  salvarUrgente: (urgente: boolean) => Promise<unknown>;
  /** a faca do catálogo traz a forma e, se a medida for outra, a medida */
  salvarFaca: (f: { facaCod: string | null; facaNova: boolean; largura?: string; altura?: string; forma?: string }) => Promise<unknown>;
};

const ACABAMENTOS: { nome: string; campo: "picote" | "tarja_verso" | "cold_stamp" | "verniz" }[] = [
  { nome: "Picote", campo: "picote" },
  { nome: "Tarja no verso", campo: "tarja_verso" },
  { nome: "Cold stamp", campo: "cold_stamp" },
  { nome: "Verniz", campo: "verniz" },
];
const MATERIAIS = ["BOPP Removível", "BOPP metalizado", "BOPP transparente", "BOPP fosco", "Pérola", "Couché", "Cartão", "Térmico", "Nylon", "Polietileno"];

/* Rework v4 (Augusto, 02/10/2026: "essa página também passa pelo rework dos
   cards"): o painel é um cartão de 440 × 720, com raio e sombra, encostado no
   vizinho (o da direita por cima, pela ordem), no cinza da página; era uma
   coluna de 480 × 616 com traço, na faixa de 112 a 728. */
/* A pilha dos cartões, como na trilha de Pedidos: o primeiro por cima, e a
   sombra de cada um cai sobre o seguinte, o que diz qual vem antes (Augusto,
   02/10/2026: "a ordem está ao contrário"; sem z-index, cada painel ficava
   por cima do anterior). O cartão do pedido fica acima de todos. */
const Z_CARTAO_DO_PEDIDO = 20;
const zDoPainel = (i: number) => 10 - i;
/* A lista que rola por dentro do painel avisa quando há mais embaixo: a
   barra de rolagem fica escondida nos painéis, e o Histórico com 11 eventos
   não dizia que havia mais (Augusto, 02/10/2026: "sinalize quando tiver mais
   coisas que precisam de scroll"). Liga a classe "tem-mais" direto no DOM; o
   esmaecido na cor do painel (--fundo) e a seta ficam no styles.css (.p10-rola).
   Mede de novo ao rolar, ao mudar de tamanho e quando entra item novo.
   React 19: o ref devolve a limpeza. */
function vigiarRolagem(el: HTMLDivElement | null) {
  if (!el) return;
  const medir = () => el.classList.toggle("tem-mais", el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  medir();
  el.addEventListener("scroll", medir, { passive: true });
  const tamanho = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
  tamanho?.observe(el);
  const conteudo = new MutationObserver(medir);
  conteudo.observe(el, { childList: true, subtree: true, characterData: true });
  return () => { el.removeEventListener("scroll", medir); tamanho?.disconnect(); conteudo.disconnect(); };
}
/** a cor do painel para o esmaecido do aviso de "tem mais" */
const fundoDoAviso = (i: number) => ({ "--fundo": fundoPainel(i) }) as CSSProperties;
const PAINEL: CSSProperties = {
  position: "relative", flex: `0 0 ${CAPA_V4.cartao}px`, height: CAPA_V4.altura, scrollSnapAlign: "start",
  borderRadius: CAPA_V4.raio, boxShadow: CAPA_V4.sombra, color: PRETO,
  background: FUNDO_PAINEL, transition: "background .25s ease, opacity .25s ease, transform .32s cubic-bezier(.22,.61,.36,1), box-shadow .32s ease",
};
/* o contêiner vai de 40 a 957, como a trilha de Pedidos: a sombra do cartão
   no hover (que sobe e cresce) não sai cortada, e a barra do topo, numa camada
   acima, continua clicável. Os painéis rolam a partir da c7, depois do cartão
   do pedido, que fica parado na c1 */
const TOPO_DETALHE = 40;
const ALTURA_DETALHE = 917;
const PAINEIS_X = 80 + CAPA_V4.cartao;
/** a margem de dentro do cartão do pedido: a do cartão v4 da trilha de Pedidos */
const MARGEM_V4 = 48;
/* Os painéis clareiam da esquerda para a direita, como os cards de status da
   trilha clareiam quando o status se repete — a fileira deixa de ler como um
   bloco cinza só e a ordem de leitura aparece.
   O passo dos cards (12% da cor, 20% se ela já é clara) não serve aqui: entre
   #f1f1f1 e o branco há catorze pontos no total, e uma porcentagem sobre isso
   deixava os dois últimos painéis idênticos. Rampa linear, então, do cinza da
   página até quase branco: seis degraus, todos diferentes. */
/* A faixa vai de um cinza nitidamente mais escuro que a página até quase
   branco: com os 12 pontos de antes o degradê existia mas quase não se via, e
   ele está aqui para guiar a leitura da esquerda para a direita. */
const PAINEL_MAIS_ESCURO = 0xe6;
const PAINEL_MAIS_CLARO = 0xfd;
const PAINEIS = 6;
function fundoPainel(i: number): string {
  const passo = (PAINEL_MAIS_CLARO - PAINEL_MAIS_ESCURO) / (PAINEIS - 1);
  const v = Math.round(PAINEL_MAIS_ESCURO + passo * Math.min(i, PAINEIS - 1));
  const c = v.toString(16).padStart(2, "0");
  return `#${c}${c}${c}`;
}

/* no painel de 440 do v4, o conteúdo fica centrado: cabeçalho e conteúdo a 60
   de cada lado (320 de largura) e o título em 56, com a serifa pendendo uns
   3 px (era 76 no de 480, e no de 440 sobravam 27 do lado direito) */
const TITULO_PAINEL: CSSProperties = { position: "absolute", left: 56, top: 111, width: 328, ...FR, fontSize: 56, lineHeight: "56px", letterSpacing: "-.04em" };
/* na margem da fileira do cabeçalho (60 dos dois lados), como o conteúdo: o
   título fica em 56, com a serifa pendendo uns 3 px, como no cartão do pedido */
const MARCA: CSSProperties = { position: "absolute", left: 60, top: 58, fontSize: 18, fontWeight: 600, color: "#8f8f8f", whiteSpace: "nowrap" };
const ACAO: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", background: "none", border: "none", padding: 0, fontFamily: INTER, fontSize: 18, fontWeight: 500, color: PRETO, cursor: "pointer" };
const BOTAO_ESCURO: CSSProperties = { height: 52, display: "inline-flex", alignItems: "center", gap: 10, padding: "0 26px", border: "none", borderRadius: 999, background: PRETO, color: "#f1f1f1", fontFamily: INTER, fontSize: 20, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const BOTAO_VAZADO: CSSProperties = { ...BOTAO_ESCURO, background: "none", color: PRETO, border: `2px solid ${PRETO}`, padding: "0 24px" };
const ROTULO_PEQ: CSSProperties = { fontSize: 15, fontWeight: 700 };
const VALOR: CSSProperties = { marginTop: 3, fontSize: 18 };
const TRACEJADO: CSSProperties = { border: `1.5px dashed ${PRETO}`, borderRadius: 14, padding: "12px 14px", outline: "none", fontFamily: INTER, fontSize: 15, lineHeight: 1.45, color: PRETO, background: "transparent", boxSizing: "border-box" };
/* O véu cobre o PALCO INTEIRO (1920×1080). Com 616 de altura ele cobria a
   barra e parte do painel, e deixava acesos o pé do painel e a faixa preta
   de baixo — o mesmo defeito que já tinha sido consertado nas caixas
   "Design criado" e "Clichê chegou". Por isso as caixas deste painel são
   desenhadas FORA do bloco dele (que corta tudo com overflow:hidden), como
   irmãs no palco — ver o fim do PedidoDetalheHub10. */
const VEU: CSSProperties = { position: "absolute", left: 0, top: 0, width: 1920, height: 1080, background: "rgba(37,36,37,.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" };
const CARTAO_MODAL: CSSProperties = { background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 22, padding: "38px 44px", display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)" };

/* Texto padrão do histórico por transição. Sem isto metade das linhas ficava
   em branco — o histórico mostrava "criacao" e "aprovada" sem dizer nada, e
   quem abre o pedido meses depois não tem o que ler. */
const OBS_PADRAO: Record<string, string> = {
  criacao: "Criação iniciada",
  aprovada: "Arte aprovada",
  cliche: "Enviado para a clicheria",
  refazer_cliche: "Clichê marcado para refação",
  concluido: "Pedido finalizado",
  cancelado: "Pedido cancelado",
  nova: "Pedido reativado",
};

/* Etapas de onde o pedido pode ir esperar o cliente (a mesma lista do
   servidor, ESPERA_PERMITIDA_DE). */
const ESPERA_PERMITIDA = ["nova", "criacao", "aguardando", "revisao", "aprovada"];

/* As etapas com a prova pronta, em que ela é o que se vai olhar: do Design
   criado em diante. A revisão fica de fora: ali o design trabalha com o que
   foi pedido e com as referências que vieram junto, na aba Anexos. */
const COM_PROVA = ["aguardando", "revisao", "aprovada", "cliche", "refazer_cliche", "concluido"];
/* As etapas para onde a reativação pode voltar: as do servidor menos o
   cancelado (reativarPedido, em pedidos.functions). */
const ETAPAS_DE_VOLTA = Object.keys(STATUS_LABELS).filter((s) => s !== "cancelado");

/* O que o Histórico escreve quando a linha veio sem texto, e o prefixo das
   linhas que guardam só o que a pessoa digitou. Antes aparecia a chave crua
   do banco ("concluido") e uma pergunta parecia um recado solto. */
const ROTULO_EVENTO: Record<string, string> = {
  nova: "Pedido criado",
  criacao: "Criação iniciada",
  aguardando: "Arte enviada",
  revisao: "Revisão pedida",
  aprovada: "Arte aprovada",
  cliche: "Enviado para a clicheria",
  refazer_cliche: "Clichê marcado para refação",
  concluido: "Pedido finalizado",
  cancelado: "Pedido cancelado",
  aguardando_cliente: "Aguardando o cliente",
  cliente_respondeu: "O cliente respondeu",
  pergunta: "Pergunta",
  resposta: "Resposta",
  edicao: "Pedido alterado",
  anexo: "Anexo novo",
  arte_final: "Arte final anexada",
  pasta: "Pasta do cliente confirmada",
  transferencia: "Carteira transferida",
};
const PREFIXO_EVENTO: Record<string, string> = {
  pergunta: "Pergunta", resposta: "Resposta", revisao: "Revisão pedida", transferencia: "Carteira transferida",
};
function textoDoEvento(h: LinhaHistorico): string {
  const obs = (h.observacao ?? "").trim();
  if (!obs) return ROTULO_EVENTO[h.status] ?? h.status;
  const prefixo = PREFIXO_EVENTO[h.status];
  return prefixo && !obs.toLowerCase().startsWith(prefixo.toLowerCase()) ? `${prefixo}: ${obs}` : obs;
}

/* Linhas que só ANOTAM algo na etapa em que o pedido está (a resposta ao
   cliente, a prova, a chegada do clichê) levam a chave da etapa no
   histórico. Não são entrega de arte nem alteração pedida. */
const ANOTACOES = ["Resposta ao cliente", "Prova de impressão", "Clichê chegou", "Valores do clichê", "Voltou para a clicheria"];
const ehAnotacao = (h: LinhaHistorico) => ANOTACOES.some((a) => String(h.observacao ?? "").startsWith(a));
/* A reativação grava a etapa para onde o pedido volta ("Pedido reativado.
   Volta para Revisão."): não é versão nova nem alteração pedida (simulação 6,
   07/10/2026; os Relatórios contam do mesmo jeito). */
const ehReativacao = (h: LinhaHistorico) => String(h.observacao ?? "").startsWith("Pedido reativado");
/** A linha do histórico que é uma entrega de arte (uma versão). */
export const ehEntregaDeArte = (h: LinhaHistorico) => h.status === "aguardando" && !ehAnotacao(h) && !ehReativacao(h);
const ehAlteracaoPedida = (h: LinhaHistorico) => h.status === "revisao" && !ehAnotacao(h) && !ehReativacao(h);

/** "50×30" e "30×50" são a mesma faca (ela roda deitada). */
function mesmaMedida(a: string, b: string): boolean {
  const n = (s: string) => (String(s).match(/\d+(?:[.,]\d+)?/g) ?? []).slice(0, 2).map((x) => parseFloat(x.replace(",", ".")));
  const [x1, y1] = n(a), [x2, y2] = n(b);
  if (![x1, y1, x2, y2].every(Number.isFinite)) return false;
  const perto = (p: number, q: number) => Math.abs(p - q) < 0.01;
  return (perto(x1, x2) && perto(y1, y2)) || (perto(x1, y2) && perto(y1, x2));
}

/** Só dígitos, com uma vírgula decimal: a Bobina aceitava letra e sinal de
    menos na edição (simulação de 28/09/2026). */
const soNumero = (v: string) => {
  const limpo = v.replace(/[^\d.,]/g, "").replace(/\./g, ",");
  const [inteiro, ...resto] = limpo.split(",");
  return resto.length ? inteiro + "," + resto.join("") : inteiro;
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

/** O nome do arquivo, que abre ele (imagem e PDF no visor, o resto baixa). */
function NomeArquivo({ a, pode, aoAbrir }: { a: LinhaAnexo; pode: boolean; aoAbrir: (a: LinhaAnexo) => void }) {
  const estilo: CSSProperties = { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
  if (!pode) return <span style={estilo}>{a.nome}</span>;
  return (
    <button onClick={() => aoAbrir(a)} className="p10-flat" title={`Abrir ${a.nome}`}
      style={{ ...estilo, padding: 0, border: "none", background: "none", textAlign: "left", fontFamily: INTER, fontSize: 15, fontWeight: 500, color: PRETO, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, textDecorationColor: "rgba(0,0,0,.25)" }}>
      {a.nome}
    </button>
  );
}
function BotaoBaixar({ a, aoBaixar }: { a: LinhaAnexo; aoBaixar: (a: LinhaAnexo) => void }) {
  return (
    <button onClick={() => aoBaixar(a)} aria-label={`Baixar ${a.nome}`} title="Baixar"
      style={{ flex: "none", width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>
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
        <div key={`${a.name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 8px 0 15px", border: `1px solid ${PRETO}`, borderRadius: 999, background: PALETA.amarelo, fontSize: 14, fontWeight: 500 }}>
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
function ModalEscrever({ titulo, sub, marcador, rotuloBotao, ocupado, aoCancelar, aoConfirmar, opcional = false, podeAnexar = true }: {
  titulo: string; sub: string; marcador: string; rotuloBotao: string; ocupado: boolean;
  aoCancelar: () => void; aoConfirmar: (texto: string, arquivos: File[]) => void;
  /** o texto pode ficar em branco ("o cliente respondeu" sem recado) */
  opcional?: boolean;
  /** sem permissão de subir arquivo, a fileira de anexo não aparece */
  podeAnexar?: boolean;
}) {
  const [txt, setTxt] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const pronto = (opcional || !!txt.trim()) && !ocupado;
  return (
    <div style={VEU}>
      <div role="dialog" aria-modal="true" aria-label={titulo} style={{ ...CARTAO_MODAL, width: 720 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ ...FR, fontSize: 38, letterSpacing: "-.02em" }}>{titulo}</div>
          <BotaoX aoClicar={aoCancelar} />
        </div>
        <div style={{ fontSize: 17, color: CINZA, marginTop: -6 }}>{sub}</div>
        <textarea autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={marcador} aria-label={titulo}
          style={{ ...TRACEJADO, width: "100%", height: 148, borderRadius: 16, padding: "16px 18px", resize: "none", fontSize: 18 }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          {podeAnexar ? (
            <LinhaAnexar arquivos={arquivos} aoEscolher={(fs) => setArquivos([...arquivos, ...fs])}
              aoTirar={(i) => setArquivos(arquivos.filter((_, j) => j !== i))} />
          ) : <span />}
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

/** Troca da faca do pedido: uma do catálogo, ou faca nova (a medida do
    pedido não tem faca e ela ainda vai ser feita). Antes a faca ia só no
    fim do briefing e não se trocava depois do envio (Augusto, 28/09/2026:
    "precisamos da opção faca nova e também de poder editar depois").
    A lista é a viva (Relação de Ferramentais + catálogo antigo), a mesma da
    página de Facas e do Novo pedido. Faca de outra medida leva a medida
    junto: a faca é que corta, e o pedido seguia com a medida velha
    (simulação de 28/09/2026). */
function ModalFaca({ atual, novaAtual, medida, ocupado, aoCancelar, aoSalvar }: {
  atual: string; novaAtual: boolean; medida: string; ocupado: boolean;
  aoCancelar: () => void;
  aoSalvar: (f: { facaCod: string | null; facaNova: boolean; largura?: string; altura?: string; forma?: string }) => void;
}) {
  const [nova, setNova] = useState(novaAtual);
  const [cod, setCod] = useState(atual);
  const { vivas } = useFacasVivas();
  const q = cod.trim();
  const [l0, a0] = MEDIDAS(medida);
  const temMedida = l0 > 0 && a0 > 0;
  /* sem nada digitado, as facas até 5 mm da medida do pedido, nas duas
     orientações; digitando uma medida, o mesmo para ela; digitando código ou
     texto, o que casa */
  const sugestoes = useMemo(() => {
    if (!q) return temMedida ? facasPerto(vivas, l0, a0, 5, 6).map((x) => x.faca) : [];
    const n = MEDIDAS(q);
    if (n.length >= 2 && /^[\d\s.,x×*]+$/i.test(q.replace(/mm/gi, "").trim())) return facasPerto(vivas, n[0], n[1], 5, 6).map((x) => x.faca);
    const casa = criarBusca(q);
    return vivas.filter((f) => casa(f.cod, f.medida)).slice(0, 6);
  }, [vivas, q, temMedida, l0, a0]);
  const escolhida = vivas.find((f) => f.cod.toUpperCase() === q.toUpperCase()) ?? null;
  const lados = escolhida ? medidaEmLados(escolhida.medida) : null;
  /* a medida muda quando a faca escolhida não é a do pedido em nenhuma das
     duas orientações */
  const mudaMedida = !!(escolhida && lados?.largura && lados?.altura && !mesmaMedida(escolhida.medida, medida));
  /* faca de uma medida só (as de gap): a medida é a ALTURA, fixa; muda a
     altura e a largura do pedido continua (Augusto, 29/09/2026). O número
     vem em "largura" porque medidaEmLados põe ali o primeiro. */
  const umLado = !!(escolhida && lados?.largura && !lados.altura);
  const mudaAltura = umLado && Math.abs(parseFloat(lados!.largura.replace(",", ".")) - (a0 || 0)) > 0.005;
  const mudou = nova !== novaAtual || (!nova && q !== atual);
  /* só código da lista, como no Novo pedido: o campo também procura por
     medida, e "40x30" não é faca */
  const pronto = !ocupado && mudou && (nova || !!escolhida);
  const salvar = () => {
    if (!pronto) return;
    if (nova || !escolhida || !lados) { aoSalvar({ facaCod: null, facaNova: true }); return; }
    aoSalvar({
      facaCod: escolhida.cod, facaNova: false,
      forma: umLado
        ? formaDoSistema(escolhida.sistema, l0 ? String(l0) : "", lados.largura)
        : formaDoSistema(escolhida.sistema, lados.largura, lados.altura),
      ...(mudaMedida ? { largura: lados.largura, altura: lados.altura } : mudaAltura ? { altura: lados.largura } : {}),
    });
  };
  const bolinha = (on: boolean) => (
    <span aria-hidden style={{ flex: "none", width: 20, height: 20, boxSizing: "border-box", borderRadius: 999, border: `1.5px solid ${PRETO}`, display: "grid", placeItems: "center", background: "#fff" }}>
      {on && <span style={{ width: 10, height: 10, borderRadius: 999, background: PRETO }} />}
    </span>
  );
  const OPCAO: CSSProperties = { display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 18, fontWeight: 600, color: PRETO };
  return (
    <div style={VEU}>
      <div role="dialog" aria-modal="true" aria-label="Faca do pedido" style={{ ...CARTAO_MODAL, width: 720 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ ...FR, fontSize: 38, letterSpacing: "-.02em" }}>Faca do pedido</div>
          <BotaoX aoClicar={aoCancelar} />
        </div>
        <div style={{ fontSize: 17, color: CINZA, marginTop: -6 }}>{medida && medida !== "—" ? `A medida do pedido é ${medida}.` : "O pedido ainda não tem medida."}</div>
        <div style={{ display: "flex", gap: 36, marginTop: 4 }}>
          <button onClick={() => setNova(false)} style={OPCAO} aria-pressed={!nova}>{bolinha(!nova)}Faca do catálogo</button>
          <button onClick={() => setNova(true)} style={OPCAO} aria-pressed={nova}>{bolinha(nova)}Faca nova</button>
        </div>
        {nova ? (
          <div style={{ fontSize: 17, lineHeight: 1.5, color: PRETO }}>A faca ainda vai ser feita, na medida do pedido. O design vê isso nas Especificações.</div>
        ) : (
          <>
            <input autoFocus value={cod} onChange={(ev) => setCod(ev.target.value)} placeholder="Código ou medida da faca" aria-label="Código da faca"
              style={{ ...TRACEJADO, width: "100%", borderRadius: 14, padding: "12px 16px", fontSize: 18 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 40 }}>
              {!q && !sugestoes.length && (
                <div style={{ fontSize: 15, color: CINZA }}>{temMedida
                  ? "Nenhuma faca do catálogo até 5 mm da medida do pedido. Digite o código, ou marque faca nova."
                  : "Digite o código ou a medida da faca."}</div>
              )}
              {!!q && !sugestoes.length && <div style={{ fontSize: 15, color: CINZA }}>Nada no catálogo com esse código ou medida.</div>}
              {sugestoes.map((f) => (
                <button key={f.cod} onClick={() => setCod(f.cod)}
                  style={{ display: "flex", alignItems: "baseline", gap: 12, textAlign: "left", background: f.cod === escolhida?.cod ? PALETA.amarelo : "#fff", border: `1px solid ${PRETO}`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", fontFamily: INTER }}>
                  <span style={{ fontSize: 17, fontWeight: 600, color: PRETO, whiteSpace: "nowrap" }}>{medidaBonita(f.medida)}</span>
                  <span style={{ fontSize: 14, color: CINZA, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.cod}</span>
                </button>
              ))}
            </div>
            {!!q && !escolhida && sugestoes.length > 0 && (
              <div style={{ fontSize: 15, color: CINZA }}>Escolha a faca na lista para salvar.</div>
            )}
            {mudaMedida && lados && (
              <div style={{ fontSize: 15, color: PRETO }}>A medida do pedido passa a ser {lados.largura}×{lados.altura}, a desta faca.</div>
            )}
            {mudaAltura && lados && (
              <div style={{ fontSize: 15, color: PRETO }}>Esta faca tem só a altura: a altura do pedido passa a ser {lados.largura} mm, e a largura continua.</div>
            )}
          </>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
          <button onClick={aoCancelar} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Cancelar</button>
          <button onClick={salvar} className="p10-flat" disabled={!pronto}
            style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 30px", background: pronto ? PRETO : CLARO, cursor: pronto ? "pointer" : "default" }}>
            {ocupado ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Refazer clichê" pede o motivo, da lista de motivos do hub (Augusto,
    30/09/2026: "faça pedir a lista de motivos"; antes o pedido mudava na hora,
    sem confirmar e sem dizer por quê). O motivo fica no histórico. O que não
    está na lista vai escrito em "Outro motivo", como no Refazer clichê de
    Aprovações (RefazerClicheHub10), e entra no histórico com o mesmo texto,
    "Clichê marcado para refação. Motivo: X"; antes este só tinha os da lista
    (simulação 5, 05/10/2026). Sem lista (não carregou), o motivo é escrito. */
function ModalRefazerCliche({ motivos, ocupado, aoCancelar, aoConfirmar }: {
  motivos: { id: string; nome: string }[] | null;
  ocupado: boolean;
  aoCancelar: () => void;
  aoConfirmar: (motivo: string, observacao: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [outro, setOutro] = useState(false);
  const [textoOutro, setTextoOutro] = useState("");
  const [obs, setObs] = useState("");
  const semLista = motivos !== null && motivos.length === 0;
  /* sem parênteses, como em Aprovações: o relatório lê o motivo até o "(" da
     observação */
  const escrito = textoOutro.replace(/[()]/g, "").trim();
  const usaOutro = outro || semLista;
  const pronto = !ocupado && (usaOutro ? escrito.length >= 3 : !!motivo);
  const bolinha = (on: boolean) => (
    <span aria-hidden style={{ flex: "none", width: 20, height: 20, boxSizing: "border-box", borderRadius: 999, border: `1.5px solid ${PRETO}`, display: "grid", placeItems: "center", background: "#fff" }}>
      {on && <span style={{ width: 10, height: 10, borderRadius: 999, background: PRETO }} />}
    </span>
  );
  return (
    <div style={VEU}>
      <div role="dialog" aria-modal="true" aria-label="Refazer clichê" style={{ ...CARTAO_MODAL, width: 640 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ ...FR, fontSize: 38, letterSpacing: "-.02em" }}>Refazer clichê</div>
          <BotaoX aoClicar={aoCancelar} />
        </div>
        <div style={{ fontSize: 17, color: CINZA, marginTop: -6 }}>Qual o motivo? Ele fica no histórico do pedido.</div>
        {motivos === null ? (
          <div style={{ fontSize: 17, color: CINZA }}>Carregando os motivos…</div>
        ) : semLista ? (
          <div style={{ fontSize: 17, color: CINZA }}>Não consegui carregar a lista de motivos. Escreva o motivo abaixo.</div>
        ) : (
          <div role="radiogroup" aria-label="Motivo" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 28px", marginTop: 4 }}>
            {motivos.map((m) => (
              <button key={m.id} role="radio" aria-checked={!outro && motivo === m.nome} onClick={() => { setMotivo(m.nome); setOutro(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 18, fontWeight: 600, color: PRETO, textAlign: "left" }}>
                {bolinha(!outro && motivo === m.nome)}{m.nome}
              </button>
            ))}
            {/* o que não está na lista: escrito à mão */}
            <button role="radio" aria-checked={outro} onClick={() => { setOutro(true); setMotivo(""); }}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: INTER, fontSize: 18, fontWeight: 600, color: PRETO, textAlign: "left" }}>
              {bolinha(outro)}Outro motivo
            </button>
          </div>
        )}
        {usaOutro && motivos !== null && (
          <input value={textoOutro} onChange={(ev) => setTextoOutro(ev.target.value)} autoFocus={outro} maxLength={60}
            placeholder="Qual o motivo?" aria-label="Qual o motivo"
            style={{ ...TRACEJADO, width: "100%", borderRadius: 14, padding: "12px 16px", fontSize: 18, marginTop: 4 }} />
        )}
        <input value={obs} onChange={(ev) => setObs(ev.target.value)} maxLength={200}
          placeholder="Observação (opcional)" aria-label="Observação"
          style={{ ...TRACEJADO, width: "100%", borderRadius: 14, padding: "12px 16px", fontSize: 18, marginTop: 4 }} />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 6 }}>
          <button onClick={aoCancelar} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Voltar</button>
          <button onClick={() => pronto && aoConfirmar(usaOutro ? escrito : motivo, obs.trim())} className="p10-flat" disabled={!pronto}
            style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 30px", background: pronto ? PRETO : CLARO, cursor: pronto ? "pointer" : "default" }}>
            {ocupado ? "Salvando…" : "Refazer clichê"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** As duas caixas que SALTAM ao abrir o pedido: a pergunta que espera por
    você e a resposta que chegou. O projeto as abre sozinhas de propósito —
    parado num painel, o recado era esquecido. */
function ModalConversa({ titulo, texto, marcador, ocupado, aoFechar, aoResponder, podeAnexar = true, rotuloBotao = "Responder" }: {
  titulo: string; texto: string; marcador: string; ocupado: boolean;
  aoFechar: () => void; aoResponder: (texto: string, arquivos: File[]) => void;
  podeAnexar?: boolean;
  /** "Perguntar" quando a caixa mostra uma resposta e pede nova pergunta */
  rotuloBotao?: string;
}) {
  const [txt, setTxt] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const pronto = !!txt.trim() && !ocupado;
  return (
    <div style={{ ...VEU, background: "rgba(37,36,37,.86)", zIndex: 72 }}>
      <div role="dialog" aria-modal="true" aria-label={titulo} style={{ ...CARTAO_MODAL, width: 760, borderRadius: 24, padding: "44px 56px", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: "none", width: 64, height: 64, borderRadius: 999, background: PALETA.amarelo, border: `1px solid ${PRETO}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
          </div>
          <div style={{ ...FR, fontSize: 38, letterSpacing: "-.02em", lineHeight: 1.06 }}>{titulo}</div>
        </div>
        <div style={{ marginTop: 20, fontSize: 20, lineHeight: 1.5, background: PALETA.amarelo, borderRadius: 14, padding: "16px 20px" }}>{texto}</div>
        <textarea autoFocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={marcador} aria-label={marcador}
          style={{ ...TRACEJADO, marginTop: 20, width: "100%", height: 120, borderRadius: 16, padding: "14px 18px", resize: "none", fontSize: 18 }} />
        <div style={{ marginTop: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          {podeAnexar ? (
            <LinhaAnexar arquivos={arquivos} aoEscolher={(fs) => setArquivos([...arquivos, ...fs])}
              aoTirar={(i) => setArquivos(arquivos.filter((_, j) => j !== i))} altura={56} />
          ) : <span />}
          <div style={{ flex: "none", display: "flex", gap: 12, alignItems: "center" }}>
            {/* O projeto não põe saída na caixa da pergunta — quem abre o
                pedido só sai respondendo. Aqui há "Fechar": nem sempre a
                resposta está na mão na hora. A insistência continua, porque
                a caixa volta a saltar toda vez que o pedido for aberto. */}
            <button onClick={aoFechar} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 56, fontSize: 18 }}>Fechar</button>
            <button onClick={() => pronto && aoResponder(txt.trim(), arquivos)} className="p10-flat" disabled={!pronto}
              style={{ ...BOTAO_ESCURO, height: 56, fontSize: 19, padding: "0 40px", background: pronto ? PRETO : CLARO, cursor: pronto ? "pointer" : "default" }}>
              {ocupado ? "Enviando…" : rotuloBotao}
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
  /* ESC fecha a confirmação, e só ela: a "Arte enviada" mora na tela de
     Pedidos, e sem isto o ESC passava por ela e fechava o painel de trás */
  useEscDoTopo(true, NIVEL.caixa, aoFechar);
  return (
    <div style={{ ...VEU, background: "rgba(37,36,37,.86)", zIndex: 70 }}>
      <div style={{ ...CARTAO_MODAL, width: 760, borderRadius: 24, padding: "52px 64px", alignItems: "center", textAlign: "center", gap: 0, boxShadow: "0 50px 110px -30px rgba(0,0,0,.6)" }}>
        <div style={{ width: 96, height: 96, borderRadius: 999, background: PALETA.amarelo, border: `1px solid ${PRETO}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 26 }}>
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

/** a luminância relativa de uma cor #rrggbb (WCAG), para saber se a letra é clara */
function luminancia(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (Number.isNaN(n)) return 0;
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}

/* O texto do alto do cartão (quem cuida, ou "Aguardando cliente") inteiro:
   com cinco ícones ele virava "Ve…", com três "Vendas Simul…" (simulação 6,
   07/10/2026). A ordem do que se tenta:
   1. ao lado dos ícones, numa linha, como no desenho;
   2. ao lado, em duas linhas (Augusto, 07/10/2026: "nesses casos que não
      couber o nome, quebre em duas linhas"), em corpo 24 ou, se preciso, 20;
   3. com a fileira curta: o balão e a urgência descem para uma segunda linha,
      alinhados com o de pausar, e o nome fica ao lado dos que sobraram, em uma
      ou duas linhas (Augusto, 08/10/2026: "coloque os ícones da mensagem e o
      da urgência abaixo e alinhe com o de pausar"; antes o nome descia);
   4. só se nem assim couber, ele desce para baixo da fileira, na largura do
      cartão, com a base na linha 17 da grade (o cartão começa na linha 9).
   As medidas são na letra de verdade, com offsetWidth e offsetHeight: a
   escala do palco não entra. O cartão fica sabendo da fileira curta por
   `aoMudarFileira`, para pôr os dois ícones embaixo. */
const BASE_DO_ALTO_EMBAIXO = 8 * LINHA_DA_GRADE;
const BASE_DO_ALTO_AO_LADO = 58 + baseInter(24, 29);
type ArranjoDoAlto = { curta: boolean; duas: 0 | 20 | 24 };
function TextoDoAlto({ valor, livre, livreCurto, aoMudarFileira }: {
  valor: string; livre: number; livreCurto?: number; aoMudarFileira?: (curta: boolean) => void;
}) {
  const medidor = useRef<HTMLSpanElement | null>(null);
  const medidor24 = useRef<HTMLDivElement | null>(null);
  const medidor20 = useRef<HTMLDivElement | null>(null);
  const medidor24c = useRef<HTMLDivElement | null>(null);
  const medidor20c = useRef<HTMLDivElement | null>(null);
  const [largura, setLargura] = useState(0);
  const [arranjo, setArranjo] = useState<ArranjoDoAlto>({ curta: false, duas: 0 });
  const curto = livreCurto && livreCurto > livre ? livreCurto : 0;
  useLayoutEffect(() => {
    const el = medidor.current;
    if (!el) return;
    /* cabe em duas linhas na largura dada: sem palavra passando da borda */
    const emDuas = (m: HTMLDivElement | null, lh: number, w: number) => !!m && m.offsetHeight <= 2 * lh + 1 && m.scrollWidth <= w + 0.5;
    const duasEm = (m24: HTMLDivElement | null, m20: HTMLDivElement | null, w: number): 0 | 20 | 24 =>
      emDuas(m24, 29, w) ? 24 : emDuas(m20, 24, w) ? 20 : 0;
    const medir = () => {
      const w = el.offsetWidth;
      setLargura(w);
      let a: ArranjoDoAlto = { curta: false, duas: 0 };
      if (w > livre) {
        const d = duasEm(medidor24.current, medidor20.current, livre);
        if (d) a = { curta: false, duas: d };
        else if (curto && w <= curto) a = { curta: true, duas: 0 };
        else if (curto) a = { curta: !!duasEm(medidor24c.current, medidor20c.current, curto), duas: duasEm(medidor24c.current, medidor20c.current, curto) };
      }
      setArranjo(a);
      aoMudarFileira?.(a.curta);
    };
    medir();
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo) medir(); });
    return () => { vivo = false; };
    // aoMudarFileira é o setState do cartão: estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, livre, curto]);
  const larguraToda = CAPA_V4.cartao - 2 * MARGEM_V4;
  const letra: CSSProperties = { fontWeight: 500, letterSpacing: "-.02em", zIndex: 1 };
  const aoLadoLivre = arranjo.curta ? curto : livre;
  const aoLado = largura > 0 && !arranjo.duas && largura <= aoLadoLivre;
  const duas = !aoLado && !arranjo.duas && largura > larguraToda;
  const corpo = duas ? 20 : 24;
  const lh = duas ? 22 : 29;
  const medindo = (w: number): CSSProperties => ({ position: "absolute", left: 0, top: 0, visibility: "hidden", pointerEvents: "none", width: w, ...letra });
  const corpoLado = arranjo.duas || 24, lhLado = arranjo.duas === 20 ? 24 : 29;
  return (
    <>
      <span ref={medidor} aria-hidden style={{ position: "absolute", left: 0, top: 0, visibility: "hidden", pointerEvents: "none", whiteSpace: "nowrap", fontSize: 24, ...letra }}>{valor}</span>
      <div ref={medidor24} aria-hidden style={{ ...medindo(livre), fontSize: 24, lineHeight: "29px" }}>{valor}</div>
      <div ref={medidor20} aria-hidden style={{ ...medindo(livre), fontSize: 20, lineHeight: "24px" }}>{valor}</div>
      {curto > 0 && <div ref={medidor24c} aria-hidden style={{ ...medindo(curto), fontSize: 24, lineHeight: "29px" }}>{valor}</div>}
      {curto > 0 && <div ref={medidor20c} aria-hidden style={{ ...medindo(curto), fontSize: 20, lineHeight: "24px" }}>{valor}</div>}
      {aoLado ? (
        <span data-alto={arranjo.curta ? "lado-curta" : "lado"} style={{ position: "absolute", left: MARGEM_V4, top: 58, maxWidth: aoLadoLivre, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 24, ...letra }}>{valor}</span>
      ) : largura > 0 && arranjo.duas ? (
        <span data-alto={arranjo.curta ? "duas-curta" : "duas"} style={{ position: "absolute", left: MARGEM_V4, top: BASE_DO_ALTO_AO_LADO - baseInter(corpoLado, lhLado), width: aoLadoLivre,
          fontSize: corpoLado, lineHeight: `${lhLado}px`, ...letra, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{valor}</span>
      ) : (
        <span data-alto="embaixo" title={duas ? valor : undefined}
          style={{ position: "absolute", left: MARGEM_V4, top: BASE_DO_ALTO_EMBAIXO - baseInter(corpo, lh), width: larguraToda, fontSize: corpo, lineHeight: `${lh}px`, ...letra,
            ...(duas ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : { whiteSpace: "nowrap" }) }}>{valor}</span>
      )}
    </>
  );
}

/* O nome do cliente cortado em menos de quatro linhas, com "…": a mesma
   letra, posição e conta do NomeDoCartaoV4 (ChromeHub10), que corta sempre em
   quatro. Aqui o corte acompanha a fileira de ações quando ela cresce para
   cima (simulação 6: o nome comprido ficava atrás do Finalizar). */
const NOMES_CORTADOS = new Map<string, string>();
let medidorDoNomeAberto: HTMLDivElement | null = null;
function nomeEmLinhas(nome: string, corpo: number, lh: number, linhas: number): string {
  if (typeof document === "undefined" || !nome) return nome;
  const chave = `${linhas}|${corpo}|${nome}`;
  const guardado = NOMES_CORTADOS.get(chave);
  if (guardado != null) return guardado;
  if (!medidorDoNomeAberto) {
    medidorDoNomeAberto = document.createElement("div");
    medidorDoNomeAberto.setAttribute("aria-hidden", "true");
    Object.assign(medidorDoNomeAberto.style, {
      position: "absolute", left: "-10000px", top: "0", visibility: "hidden", pointerEvents: "none",
      fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 72", fontWeight: "600", letterSpacing: "-.02em", overflowWrap: "anywhere",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(medidorDoNomeAberto);
  }
  const m = medidorDoNomeAberto;
  Object.assign(m.style, { width: `${NOME_CARTAO_V4.largura}px`, fontSize: `${corpo}px`, lineHeight: `${lh}px` });
  const limite = linhas * lh + 1;
  const cabe = (t: string) => { m.textContent = t; return m.offsetHeight <= limite; };
  let saida = nome;
  if (!cabe(nome)) {
    let lo = 0, hi = nome.length;
    while (lo < hi) {
      const meio = Math.ceil((lo + hi) / 2);
      if (cabe(nome.slice(0, meio).trimEnd() + "…")) lo = meio; else hi = meio - 1;
    }
    /* corta numa palavra inteira quando dá (sem voltar mais que um terço) */
    const espaco = nome.lastIndexOf(" ", lo);
    saida = nome.slice(0, espaco > lo * 0.66 ? espaco : lo).trimEnd() + "…";
  }
  if (document.fonts?.check(`600 ${corpo}px Fraunces`)) NOMES_CORTADOS.set(chave, saida);
  return saida;
}
function NomeDoCartaoAberto({ nome, linhas }: { nome: string; linhas: number }) {
  if (linhas >= 4) return <NomeDoCartaoV4 nome={nome} />;
  const n = NOME_CARTAO_V4;
  const corpo = corpoDoNome(nome);
  const lh = entrelinhaDoNome(corpo);
  return (
    <div title={nome || undefined} data-linhas-do-nome={linhas}
      style={{ position: "absolute", left: n.x, top: n.base - baseFraunces(corpo, lh) - 14, width: n.largura,
        ...FR, fontSize: corpo, lineHeight: `${lh}px`, letterSpacing: "-.02em", zIndex: 1, padding: "14px 0",
        display: "-webkit-box", WebkitLineClamp: linhas, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{nomeEmLinhas(nome, corpo, lh, linhas)}</div>
  );
}
/** o respiro entre a perna da última linha do nome e o alto dos botões */
const FOLGA_NOME_ACOES = 8;

/* A fileira de ícones do alto do cartão: o × a 36 da direita; o primeiro
   ícone da fileira a 36 + 44 + 8 e cada um seguinte 52 depois (8 de ar entre
   os círculos, como entre as duas linhas; Augusto, 08/10/2026: "diminua o
   ar entre os cards"; eram 16). */
const PRIMEIRO_ICONE = 36 + 44 + 8;
const PASSO_DOS_ICONES = 44 + 8;

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
  const [escrever, setEscrever] = useState<null | "pergunta" | "alteracao" | "revisao" | "espera" | "respondeu">(null);
  const [trocandoFaca, setTrocandoFaca] = useState(false);
  const [cancelar, setCancelar] = useState(false);
  /* confirmação depois de enviar pergunta ou resposta */
  const [sucesso, setSucesso] = useState<{ titulo: string; resumo: string } | null>(null);
  /* anexo esperando confirmação para sair do pedido */
  const [desvincular, setDesvincular] = useState<{ id: string; nome: string } | null>(null);
  /* aprovar a arte: sempre pergunta antes (a versão sem arquivo tem aviso próprio) */
  const [confirmarAprovar, setConfirmarAprovar] = useState(false);
  /* Reativar um pedido cancelado também pergunta (Augusto, 06/10/2026: "reativar pedido cancelado agora pede confirmação") */
  const [confirmarReativar, setConfirmarReativar] = useState(false);
  /* Enviar (ou reenviar) para a clicheria pergunta a espessura do clichê: os
     relatórios separam quantidade e valor de 1.14 e 1.70 (Augusto, 07/10/2026) */
  const [enviarClicheria, setEnviarClicheria] = useState<null | "enviar" | "reenviar">(null);
  const [espessura, setEspessura] = useState("");
  /* Com a espessura escolhida, onde o pedido roda: o Z da faca (pastas "Facas
     por Z"), as cores e o verniz contra os porta-clichês de cada máquina
     (Augusto, 08/10/2026: "se gravamos o clichê para ela e a máquina não tem
     o porta-clichê, não dá para rodar o pedido"). Lido só com a caixa aberta. */
  const { data: zsFacas } = useQuery<{ zs: Record<string, { z: number }> }>({
    queryKey: ["facas-z"], queryFn: () => listZDasFacas() as Promise<{ zs: Record<string, { z: number }> }>, staleTime: 5 * 60_000, enabled: !!enviarClicheria,
  });
  const { data: portasCliche } = useQuery<PortaCliche[]>({
    queryKey: ["porta-cliches"], queryFn: () => listPortaCliches() as Promise<PortaCliche[]>, staleTime: 60_000, enabled: !!enviarClicheria,
  });
  const zDaFacaDoPedido = Number(p.faca_nova) === 1 || !p.faca_cod ? null : zsFacas?.zs?.[chaveFaca(String(p.faca_cod))]?.z ?? null;
  const avisoClicheria = enviarClicheria && (espessura === "1.14" || espessura === "1.70") && zDaFacaDoPedido
    ? avisoDaClicheria({ z: zDaFacaDoPedido, cores: Number(numeroDeCores(p)) || 0, verniz: ligado(p.verniz), espessura: espessura as Espessura }, portasCliche ?? [])
    : null;
  /* a caixa do "Refazer clichê" e a lista de motivos, lida na primeira vez */
  const [refazendo, setRefazendo] = useState(false);
  /* A etapa que a caixa viu ao abrir (revisão de código de 08/10/2026): o
     painel recarrega ao voltar o foco para a aba, e o `de` lido na hora do
     clique deixava passar a mudança que outra pessoa fez com a caixa aberta
     (o Enviar p/ clicheria mandava para a clicheria um pedido que tinha
     voltado para revisão). Sem caixa de etapa aberta, acompanha o status;
     com uma aberta, fica parada. */
  const caixaDeEtapaAberta = escrever === "revisao" || refazendo || !!enviarClicheria || confirmarAprovar || cancelar || confirmarReativar;
  const etapaVista = useRef(status);
  useEffect(() => { if (!caixaDeEtapaAberta) etapaVista.current = status; });
  const [motivosCliche, setMotivosCliche] = useState<{ id: string; nome: string }[] | null>(null);
  const abrirRefazer = () => {
    setRefazendo(true);
    if (motivosCliche === null || motivosCliche.length === 0) {
      setMotivosCliche(null);
      acoes.motivosDoCliche().then(setMotivosCliche).catch(() => setMotivosCliche([]));
    }
  };
  const [respondendo, setRespondendo] = useState<LinhaPergunta | null>(null);
  /* o arquivo aberto no visor (imagem ou PDF), com o endereço temporário que
     precisa ser devolvido ao fechar */
  type Vendo = { id: string; url: string; mime: string; nome: string };
  const [vendo, setVendo] = useState<Vendo | null>(null);
  const urlVendo = useRef<string | null>(null);
  const trocarVendo = useCallback((v: Vendo | null) => {
    if (urlVendo.current) URL.revokeObjectURL(urlVendo.current);
    urlVendo.current = v?.url ?? null;
    setVendo(v);
  }, []);
  const fecharVisor = useCallback(() => trocarVendo(null), [trocarVendo]);
  useEffect(() => () => { if (urlVendo.current) URL.revokeObjectURL(urlVendo.current); }, []);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [maisDir, setMaisDir] = useState(true);
  /* O cartão fixo (Augusto, 02/10/2026: "clicar no card após o hover fixa ele
     maior"): clicado fora dos controles, fica como no hover, na frente; outro
     clique solta, e clicar noutro passa o fixo para ele. Abre sem nenhum
     fixo: abrindo com o do pedido fixo, o primeiro clique nele soltava, e ele
     voltava ao normal quando o mouse ia para o vizinho (ele: "o fixado volta
     ao normal"). Painel em edição não se mexe. */
  const [fixado, setFixado] = useState<string | null>(null);
  const fixar = (chave: string) => (e: { target: EventTarget | null }) => {
    if (editando === chave) return;
    if ((e.target as HTMLElement | null)?.closest?.("button, a, input, textarea, select, label, [role=button], [role=radio], [data-pop], [contenteditable=true]")) return;
    setFixado((f) => (f === chave ? null : chave));
  };
  const classeDoPainel = (chave: string, editandoAqui = false) =>
    editandoAqui ? "pdv4-painel" : fixado === chave ? "pdv4-painel pd4-cartao pd4-fixo" : "pdv4-painel pd4-cartao";
  const trilha = useRef<HTMLDivElement | null>(null);
  /* a janela dos painéis (v4): o que passa para baixo do cartão do pedido ou
     além da c23 some, como na trilha de Pedidos (sem cortar a sombra dos de
     dentro); direto no DOM, a rolagem dispara dezenas de vezes */
  const janelaPronta = useRef(false);
  const atualizarJanela = useCallback(() => {
    const el = trilha.current;
    if (!el) return;
    const primeira = !janelaPronta.current;
    janelaPronta.current = true;
    el.querySelectorAll<HTMLElement>(".pdv4-painel").forEach((c) => {
      const meio = c.offsetLeft + c.offsetWidth / 2 - el.scrollLeft;
      const dentro = meio >= PAINEIS_X && meio <= 1840;
      /* ao abrir, o painel de fora da janela já nasce apagado: com o
         esmaecer de .25s do CSS ele aparecia na borda direita e sumia,
         enquanto os outros subiam (transição dos cartões, 07/10/2026) */
      const semEsmaecer = primeira && !dentro;
      if (semEsmaecer) c.style.transition = "none";
      c.style.opacity = dentro ? "" : "0";
      c.style.pointerEvents = dentro ? "" : "none";
      if (semEsmaecer) { void c.offsetWidth; c.style.transition = ""; }
    });
  }, []);
  useLayoutEffect(() => { atualizarJanela(); });
  /* Rodinha vertical vira rolagem horizontal nos painéis, um painel por giro
     (o encaixe de trilha-encaixe.ts, mais abaixo). Sem isto, com um mouse
     comum, Anexos, Histórico e Conversa ficavam fora de alcance (simulação 4,
     02/10/2026). O que rola por dentro de um painel (briefing, histórico,
     conversa, campo em edição) rola primeiro. */
  const rolaPorDentro = (alvo: HTMLElement | null, dy: number) => {
    for (let n = alvo; n && n !== trilha.current; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1
        && (dy < 0 ? n.scrollTop > 0 : n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
    }
    return false;
  };
  /* Arrastar a fileira com o mouse rola os painéis, como nas trilhas de
     Pedidos e das capas (simulação 6, 07/10/2026: arrastar não rolava e
     pintava o texto de três painéis). Durante o arrasto a seleção não começa
     e a fileira segue a mão; ao soltar, ela encaixa no painel mais perto. O
     clique que fecha um arrasto
     não fixa o painel. Dois e três cliques continuam selecionando a palavra e
     o parágrafo (copiar o briefing), e nos campos a seleção é a de sempre. */
  const arrasto = useRef({ ativo: false, x0: 0, scroll0: 0, escala: 1, andou: false });
  /* Durante o arrasto a rolagem é instantânea (a suave da fileira atrasaria
     a mão) e volta quando o ponteiro sai da fileira. O encaixe é sempre pela
     conta (trilha-encaixe.ts): o scroll-snap do CSS media o painel em hover,
     que cresce 3,5%, e a fileira parava 8 px fora da coluna (872 em vez de
     880 no arrasto; 432 em vez de 440 com a roda, medido no teste). */
  const rolagemTrocada = useRef(false);
  const voltarRolagemSuave = useCallback(() => {
    const el = trilha.current;
    if (!el || !rolagemTrocada.current || arrasto.current.ativo) return;
    rolagemTrocada.current = false;
    el.style.scrollBehavior = "";
  }, []);
  const aoApontar = (e: PointerEventReact<HTMLDivElement>) => {
    const el = trilha.current;
    if (!el || e.button !== 0) return;
    if ((e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable=true]")) return;
    const escala = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
    arrasto.current = { ativo: true, x0: e.clientX, scroll0: el.scrollLeft, escala, andou: false };
  };
  const encaixarPaineis = useEncaixeDaTrilha(trilha, {
    seletor: ".pdv4-painel",
    arrastando: () => arrasto.current.ativo,
    podeGirar: (e) => !rolaPorDentro(e.target as HTMLElement | null, e.deltaY),
  });
  useEffect(() => {
    /* ao soltar, a fileira anda até o painel mais perto */
    const soltar = () => {
      const a = arrasto.current, el = trilha.current;
      if (!a.ativo) return;
      a.ativo = false;
      if (a.andou && el) { el.style.userSelect = ""; encaixarPaineis(); }
      /* o clique que fecha o arrasto vem logo depois do pointerup e é engolido
         (onClickCapture); soltando fora da fileira ele não vem, e a marca não
         pode sobrar para o próximo clique (o Enter num botão, por exemplo) */
      window.setTimeout(() => { if (!arrasto.current.ativo) arrasto.current.andou = false; }, 0);
    };
    const mover = (e: PointerEvent) => {
      const a = arrasto.current, el = trilha.current;
      if (!a.ativo || !el) return;
      /* sem botão apertado o arrasto acabou, seja qual evento faltou (a caneta
         nem sempre manda o pointerup; ver a trilha de Pedidos) */
      if (e.buttons === 0) { soltar(); return; }
      const d = e.clientX - a.x0;
      if (!a.andou) {
        if (Math.abs(d) <= 4) return;
        a.andou = true;
        rolagemTrocada.current = true;
        el.style.scrollBehavior = "auto";
        el.style.userSelect = "none";
      }
      window.getSelection()?.removeAllRanges();
      el.scrollLeft = a.scroll0 - d / a.escala;
    };
    const semSelecao = (e: Event) => { if (arrasto.current.ativo && arrasto.current.andou) e.preventDefault(); };
    /* apertar em cima de um texto já selecionado e arrastar levaria o texto
       (arrastar e soltar do navegador) em vez de rolar */
    const semLevarTexto = (e: Event) => { if (arrasto.current.ativo) e.preventDefault(); };
    document.addEventListener("pointermove", mover);
    document.addEventListener("pointerup", soltar);
    document.addEventListener("pointercancel", soltar);
    document.addEventListener("selectstart", semSelecao);
    document.addEventListener("dragstart", semLevarTexto);
    window.addEventListener("blur", soltar);
    return () => {
      document.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerup", soltar);
      document.removeEventListener("pointercancel", soltar);
      document.removeEventListener("selectstart", semSelecao);
      document.removeEventListener("dragstart", semLevarTexto);
      window.removeEventListener("blur", soltar);
    };
  }, []);
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
  /* Sem destinatário (pedido sem designer), a pergunta é do time do design:
     é a mesma regra da marca do card (perguntas_para_mim, no servidor). */
  const perguntaParaMim = useMemo(
    () => (euId
      ? dados.perguntas.find((q) => !q.respondida_em
        && (q.para_id === euId || (q.para_id == null && pode.iniciar && q.de_id !== euId))) ?? null
      : null),
    [dados.perguntas, euId, pode.iniciar],
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
  /* ...e espera a confirmação de envio sair da tela: saltava por cima dela
     (simulação de 28/09/2026) */
  const salto = alvoSalto && saltouEm !== alvoSalto.id && !sucesso ? alvoSalto : null;

  /* Para quem vai a pergunta — a mesma conta que o servidor faz: quem
     pergunta sendo a vendedora fala com o designer; o resto fala com a
     vendedora do pedido. */
  const destinoPergunta = souVendedor
    ? (String(p.designer_nome ?? "") || "o time do design")
    : (String(p.vendedor_nome ?? "") || "quem abriu o pedido");

  /* As caixas de escrever do projeto aceitam anexo, mas `perguntar` e
     `mudarStatus` não levam arquivo. Os arquivos sobem antes, como anexo do
     pedido — que é onde eles precisam estar de qualquer forma. */
  /* A ação vai primeiro e os arquivos depois. Se o servidor recusa a ação,
     nada subiu e tentar de novo não duplica anexo; se um anexo falha depois,
     a ação já foi e o aviso vermelho diz qual arquivo ficou de fora. */
  const comAnexos = async (arquivos: File[], acao: () => Promise<unknown>) => {
    await acao();
    if (!arquivos.length) return;
    try {
      await acoes.anexar(arquivos);
    } catch (e) {
      setErro(`Enviado, mas nem todo anexo subiu. ${erroLegivel(e, "")} Anexe de novo na aba Anexos.`.replace(/\s+/g, " "));
    }
  };

  /* Abrir um arquivo: imagem e PDF abrem no visor, aqui mesmo; o resto
     (CorelDRAW, Illustrator, zip) o navegador não mostra, então baixa. */
  const abrirArquivo = (a: LinhaAnexo) => {
    if (!pode.baixar) return;
    const mostra = /\.(png|jpe?g|gif|webp|svg|pdf)$/i.test(a.nome);
    if (!mostra) { rodar(() => acoes.baixarArquivo(a.id, a.nome)); return; }
    rodar(async () => {
      const r = await acoes.verArquivo(a.id, a.nome);
      trocarVendo({ id: a.id, ...r });
    });
  };
  const baixar = (a: LinhaAnexo) => rodar(() => acoes.baixarArquivo(a.id, a.nome));

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

  /* A trava do clique repetido é a REF, não o estado: `setOcupado` só vale no
     render seguinte, e três cliques no mesmo instante passavam os três. Isso
     gravou três vezes "Criação iniciada" no histórico de um pedido e disparou
     seis notificações. A ref muda na hora. */
  const emVoo = useRef(false);
  const rodar = (fn: () => Promise<unknown>, depois?: () => void) => {
    if (emVoo.current) return;
    emVoo.current = true;
    setOcupado(true); setErro("");
    void Promise.resolve(fn())
      .then(() => depois?.())
      .catch((e: unknown) => setErro(erroLegivel(e)))
      .finally(() => { emVoo.current = false; setOcupado(false); });
  };

  /* ESC desfaz uma camada por vez, de cima para baixo: primeiro as caixas
     deste painel, depois o modo de edição, e só então o painel. Quando há uma
     caixa maior por cima (Design criado, Clichê chegou, tabela Pantone), ela
     responde e este ouvinte nem chega a agir — é o que a pilha resolve. */
  const escDoPainel = useCallback(() => {
    if (vendo) { fecharVisor(); return; }
    /* a caixa que saltou e a confirmação de envio também fecham no ESC:
       antes o ESC passava por elas e fechava o painel inteiro */
    if (salto) { setSaltouEm(salto.id); return; }
    if (sucesso) { setSucesso(null); return; }
    if (escrever || cancelar || respondendo || trocandoFaca || desvincular || confirmarAprovar || confirmarReativar || enviarClicheria || refazendo) {
      setEscrever(null); setCancelar(false); setRespondendo(null); setTrocandoFaca(false); setDesvincular(null); setConfirmarAprovar(false); setConfirmarReativar(false); setEnviarClicheria(null); setRefazendo(false);
      return;
    }
    if (editando) { setEditando(null); return; }
    aoFechar();
  }, [vendo, fecharVisor, salto, sucesso, escrever, cancelar, respondendo, trocandoFaca, desvincular, confirmarAprovar, confirmarReativar, enviarClicheria, refazendo, editando, aoFechar]);
  useEscDoTopo(true, NIVEL.painel, escDoPainel);

  /* Alterações = os pedidos de revisão do histórico. É onde o hub já guarda
     "o que a vendedora mandou mudar" — não há lista separada. */
  const alteracoes = useMemo(
    () => dados.historico.filter(ehAlteracaoPedida).slice().reverse(),
    [dados.historico],
  );
  /* A lista de recados que o designer vai riscando: marcar não muda a etapa
     nem apaga nada, e fica gravado quem marcou (resolverRevisao). */
  const resolvidas = useMemo(
    () => new Map((dados.revisoesResolvidas ?? []).map((r) => [r.chave, r])),
    [dados.revisoesResolvidas],
  );
  /* A caixinha responde no clique: o servidor confirma depois (levava uns
     2 s sem sinal nenhum; simulação 3, 30/09/2026). A marca provisória some
     quando o que veio do servidor já diz o mesmo, ou quando ele recusa. */
  const [marcando, setMarcando] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setMarcando((m) => {
      const resto = Object.fromEntries(Object.entries(m).filter(([id, v]) => resolvidas.has(id) !== v));
      return Object.keys(resto).length === Object.keys(m).length ? m : resto;
    });
  }, [resolvidas]);
  const marcar = (id: string, alvo: boolean) => {
    if (emVoo.current) return;
    setMarcando((m) => ({ ...m, [id]: alvo }));
    rodar(() => Promise.resolve(acoes.resolverAlteracao(id, alvo)).catch((e: unknown) => {
      setMarcando((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id)));
      throw e;
    }));
  };
  const atendidas = alteracoes.filter((h) => marcando[h.id] ?? resolvidas.has(h.id)).length;
  const anexosPedido = dados.anexos.filter((a) => a.tipo !== "arte");
  const artes = dados.anexos.filter((a) => a.tipo === "arte");
  /* Com a prova pronta (do Design criado em diante, COM_PROVA), o painel abre
     na aba Design mesmo que a solicitação tenha anexos: é a arte que se vai
     ver e aprovar (simulação 6, 07/10/2026; o conserto da simulação 5 só valia
     para o pedido sem anexo). A Revisão também: a prova é o que o designer
     vai refazer (Augusto, 07/10/2026). Esperando o cliente, vale a etapa de
     antes. Nas outras etapas, abre nela o pedido com prova e sem anexo, como
     antes. Escolhe uma vez por pedido; depois manda o clique. */
  const abaDoPedido = useRef<string | null>(null);
  useEffect(() => {
    const id = String(p.id ?? "");
    if (!id || abaDoPedido.current === id) return;
    abaDoPedido.current = id;
    const etapa = status === "aguardando_cliente" ? String(p.status_anterior ?? "") : status;
    setAba(artes.length > 0 && (COM_PROVA.includes(etapa) || anexosPedido.length === 0) ? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, artes.length, anexosPedido.length]);

  /* A aba Design conta a história da arte: cada entrega é uma versão, com os
     arquivos que subiram para ela, quem mandou, quando e o recado. O arquivo
     que chegou depois da última entrega é a arte final (anexada depois da
     aprovação). */
  const entregas = useMemo(() => dados.historico.filter(ehEntregaDeArte), [dados.historico]);
  const versoes = useMemo(() => {
    const grupos = entregas.map((h, i) => {
      const nota = String(h.observacao ?? "");
      const v = /arte\s+v(\d+)/i.exec(nota)?.[1];
      return {
        chave: h.id, titulo: `Versão ${v ?? i + 1}`, quando: h.created_at, quem: h.user_nome,
        nota: nota.replace(/^arte\s+v?\d*\s*enviada\s*(·\s*)?/i, "").trim(),
        arquivos: [] as LinhaAnexo[],
      };
    });
    const finais: LinhaAnexo[] = [];
    for (const a of artes) {
      const g = grupos.find((x) => x.quando >= a.created_at);
      if (g) g.arquivos.push(a); else finais.push(a);
    }
    const lista = grupos.slice().reverse();
    return finais.length
      ? [{ chave: "final", titulo: grupos.length ? "Arte final" : "Arte", quando: finais[0].created_at, quem: finais[0].user_nome ?? null, nota: "", arquivos: finais }, ...lista]
      : lista;
  }, [entregas, artes]);

  /* A última entrega chegou sem arquivo ("Registrar sem arte")? Aprovar
     assim a vendedora aprova sem ver nada (simulação de 28/09/2026). */
  const ultimaEntrega = versoes.find((v) => v.chave !== "final") ?? null;
  const entregaSemArquivo = !ultimaEntrega || !ultimaEntrega.arquivos.length;
  /* Aprovar sempre pergunta antes (Augusto, 06/10/2026: "o aprovar precisa de
     confirmação sim"): um clique solto aprovava a arte na hora. */
  const aprovar = () => setConfirmarAprovar(true);

  /* O motivo da espera, para a caixa "O cliente respondeu" lembrar o que
     faltava. É a última entrada em espera do histórico. */
  const motivoDaEspera = useMemo(() => {
    const h = dados.historico.filter((x) => x.status === "aguardando_cliente").pop();
    const t = String(h?.observacao ?? "").replace(/^Aguardando o cliente:\s*/, "").trim();
    return t.length > 220 ? `${t.slice(0, 220)}…` : t;
  }, [dados.historico]);
  /* Para onde a reativação volta: a última etapa antes do cancelamento, a
     mesma conta do servidor (reativarPedido; o histórico vem na ordem dele);
     sem etapa no histórico, Aguardando design. A caixa dizia sempre
     "Aguardando design", e o pedido voltava para a etapa em que estava
     (simulação 6, 07/10/2026). */
  const volta = useMemo(() => {
    const cancelouEm = dados.historico.reduce((m, h) => (h.status === "cancelado" && h.created_at > m ? h.created_at : m), "");
    let etapa: string | null = null;
    if (cancelouEm) for (const h of dados.historico) if (h.created_at <= cancelouEm && ETAPAS_DE_VOLTA.includes(h.status)) etapa = h.status;
    return { etapa: etapa ?? "nova", achou: !!etapa };
  }, [dados.historico]);
  const perguntaAberta = dados.perguntas.find((q) => !q.respondida_em) ?? null;
  /* o balão aparece com pergunta aberta, e também com a resposta que chegou
     para você: fechada a caixa, é por ele que ela abre de novo */
  const mostraBalao = !!(perguntaAberta || alvoSalto);
  const abrirConversa = () => {
    if (alvoSalto) { setSaltouEm(null); return; }
    const el = trilha.current;
    if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
  };
  const acabamentos = ACABAMENTOS.filter((a) => ligado(p[a.campo])).map((a) => a.nome);
  /* separadas pelos nomes ("Branco roxo" são duas cores, mesmo sem vírgula) */
  const cores = separarCores(p.cores_desc as string | null);
  /* as da arte, lidas da prova no Design criado (Augusto, 07/10/2026:
     "guarde as duas listas"). As pedidas ficam no Briefing; as da arte valem
     nas Especificações, e a confirmação do Aprovar avisa quando as duas não
     batem. Sem prova lida, as Especificações mostram as pedidas. */
  const coresDaArte = separarCores(p.cores_arte as string | null);
  const coresNaoBatem = cores.length > 0 && coresDaArte.length > 0 && !mesmasCores(p.cores_desc as string | null, p.cores_arte as string | null);
  const coresDasEspecificacoes = coresDaArte.length ? coresDaArte : cores;

  /* "—" é campo sem dado (o cartão de refação de clichê): não vira "—×—" */
  const temValor = (v: unknown) => v != null && v !== "" && v !== "—";
  const medida = temValor(p.largura) && temValor(p.altura) ? `${p.largura}×${p.altura}` : texto(temValor(p.largura) ? p.largura : temValor(p.altura) ? p.altura : null);
  /* Quem saiu do fluxo não se edita. Augusto, 23/09/2026: "pedido finalizado
     só adm pode alterar" e "o cancelado não é editável". Cancelado é fechado
     para todos — para mexer nele, reativa primeiro. */
  const podeEditarAqui = pode.editar
    && status !== "cancelado"
    && (status !== "concluido" || souAdmin);
  const podeEditarEspec = (pode.editarEspec ?? pode.editar)
    && status !== "cancelado"
    && (status !== "concluido" || souAdmin);
  const podeCancelarAqui = pode.cancelar && status !== "cancelado" && status !== "concluido";
  const vivo = status !== "cancelado" && status !== "concluido";
  const urgente = Number(p.urgente) === 1 && vivo;
  const podeUrgenciaAqui = pode.urgencia && vivo;
  const podeEsperarAqui = pode.esperarCliente && ESPERA_PERMITIDA.includes(status);
  const podeTrocarFaca = pode.faca && status !== "cancelado" && (status !== "concluido" || souAdmin);
  const nomeDaFaca = Number(p.faca_nova) === 1 ? "Faca nova" : texto(p.faca_cod);
  /* Os ícones do canto dividem a linha com o nome de quem cuida: o nome
     corta com reticências antes de encostar no primeiro ícone. */
  /* A urgência entra na fileira de ícones: aqui a linha do status vira a dos
     botões de ação e não cabe mais nada nela. Da direita para a esquerda:
     fechar, lixeira, pausa, urgência, balão. */
  const mostraUrgencia = urgente || podeUrgenciaAqui;
  const fileira = [
    ...(podeCancelarAqui ? ["cancelar"] : []), ...(podeEsperarAqui ? ["esperar"] : []),
    ...(mostraUrgencia ? ["urgencia"] : []), ...(mostraBalao ? ["balao"] : []),
  ];
  /* Fileira curta (ver TextoDoAlto): o nome não coube ao lado de todos, e o
     balão e a urgência descem para uma segunda linha, alinhados com o de
     pausar (o primeiro da esquerda que ficou em cima), na mesma ordem: o
     balão embaixo da pausa e a urgência à direita dele. */
  const [fileiraCurta, setFileiraCurta] = useState(false);
  const descem = ["urgencia", "balao"].filter((q) => fileira.includes(q));
  const curta = fileiraCurta && descem.length > 0;
  const fileiraDeCima = curta ? fileira.filter((q) => !descem.includes(q)) : fileira;
  const colunaDaPausa = fileiraDeCima.length ? PRIMEIRO_ICONE + PASSO_DOS_ICONES * (fileiraDeCima.length - 1) : 36;
  const embaixoEmOrdem = ["balao", "urgencia"].filter((q) => descem.includes(q));
  const direitaDe = (qual: string) => (curta && descem.includes(qual)
    ? colunaDaPausa - PASSO_DOS_ICONES * embaixoEmOrdem.indexOf(qual)
    : PRIMEIRO_ICONE + PASSO_DOS_ICONES * fileiraDeCima.indexOf(qual));
  /* 8 de ar entre as duas linhas (Augusto, 08/10/2026: "diminua o ar entre
     as linhas dos ícones"; eram 16, o mesmo vão que fica entre os ícones) */
  const topoDe = (qual: string) => (curta && descem.includes(qual) ? 50 + 44 + 8 : 50);
  const icones = fileira.length;
  const bordaDosIcones = icones ? CAPA_V4.cartao - (PRIMEIRO_ICONE + PASSO_DOS_ICONES * (icones - 1) + 44) : CAPA_V4.cartao - 80;
  const ficam = fileira.length - descem.length;
  const bordaDaCurta = ficam ? CAPA_V4.cartao - (PRIMEIRO_ICONE + PASSO_DOS_ICONES * (ficam - 1) + 44) : CAPA_V4.cartao - 80;
  /* no alto do cartão: esperando o cliente, o cartão diz isso (o "Cliente
     respondeu" sozinho parecia o status; simulação 3); senão, quem cuida: o
     designer para a vendedora, a vendedora para os outros */
  const quemCuida = status === "aguardando_cliente" ? "Aguardando cliente"
    : souVendedor && p.tipo !== "cliche" ? texto(p.designer_nome ?? "A definir") : texto(p.vendedor_nome);

  /* O nome do cliente não fica atrás dos botões: a fileira de ações cresce
     para cima quando dois botões não cabem lado a lado (Finalizar e Refazer
     clichê, na Clicheria), e a quarta linha de um nome comprido ficava atrás
     do Finalizar (simulação 6, 07/10/2026). Mede onde a fileira começa e corta
     o nome, com reticências, nas linhas que cabem acima dela. */
  const acoesRef = useRef<HTMLDivElement | null>(null);
  const [linhasDoNome, setLinhasDoNome] = useState(4);
  const nomeCliente = texto(p.cliente);
  useLayoutEffect(() => {
    const el = acoesRef.current;
    if (!el) return;
    const medir = () => {
      const corpo = corpoDoNome(nomeCliente);
      const lh = entrelinhaDoNome(corpo);
      const perna = Math.round(corpo * 0.259);
      let n = 1;
      while (n < 4 && NOME_CARTAO_V4.base + n * lh + perna + FOLGA_NOME_ACOES <= el.offsetTop) n++;
      setLinhasDoNome(n);
    };
    medir();
    const tamanho = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    tamanho?.observe(el);
    let vivo = true;
    void document.fonts?.ready.then(() => { if (vivo) medir(); });
    return () => { vivo = false; tamanho?.disconnect(); };
  }, [nomeCliente]);

  /* A altura é 616, e não 617: a tarja preta começa em 726 e vai até o fim do
     palco, mas este contêiner está num z-index bem acima dela. Com 617 o fundo
     #f1f1f1 dele sobrava um pixel embaixo dos painéis (que têm 616) e pintava
     por cima do preto — a "falha" clara entre o card e a tarja. Com 616 tudo
     termina em 728, e a tarja recebe os cards encostados. */
  return (
    <>
    <div data-pedido-aberto="" style={{ position: "absolute", left: 0, top: TOPO_DETALHE, width: 1920, height: ALTURA_DETALHE, zIndex: 38, overflow: "hidden" }}>
      <div ref={trilha} className="p10-trilha" onPointerDown={aoApontar} onPointerLeave={voltarRolagemSuave}
        onClickCapture={(e) => { if (arrasto.current.andou) { e.stopPropagation(); e.preventDefault(); arrasto.current.andou = false; } }}
        onScroll={(e) => {
        const el = e.currentTarget;
        setMaisDir(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
        atualizarJanela();
      }} style={{ height: ALTURA_DETALHE, boxSizing: "border-box", padding: `${CAPA_V4.topo - TOPO_DETALHE}px 0 0 ${PAINEIS_X}px`, display: "flex", alignItems: "flex-start",
        overflowX: "auto", overflowY: "hidden", scrollBehavior: "smooth", scrollPaddingLeft: PAINEIS_X }}>

        {/* ————— cartão do pedido ————— */}
        <div className={fixado === "pedido" ? "pd4-cartao pd4-fixo" : "pd4-cartao"} onClick={fixar("pedido")} style={{ position: "absolute", left: 80, top: CAPA_V4.topo - TOPO_DETALHE, width: CAPA_V4.cartao, height: CAPA_V4.altura, zIndex: Z_CARTAO_DO_PEDIDO, background: cor, color: tinta,
          borderRadius: CAPA_V4.raio, boxShadow: CAPA_V4.sombra }}>
          {temOndas && <LottieHub10 src={temOndas} encaixe="slice" style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden", borderRadius: CAPA_V4.raio }} />}
          {/* inteiro: ao lado dos ícones, em uma ou duas linhas; com a fileira
              curta (balão e urgência embaixo) se precisar; embaixo deles só se
              nem assim couber (TextoDoAlto; com três botões ele cortava,
              simulações 5 e 6) */}
          <TextoDoAlto valor={quemCuida} livre={bordaDosIcones - MARGEM_V4 - 14}
            livreCurto={descem.length ? bordaDaCurta - MARGEM_V4 - 14 : undefined} aoMudarFileira={setFileiraCurta} />

          {/* Urgência: o mesmo círculo com "!" do card, na fileira de ícones.
              Preto e pulsando quando o pedido é urgente; contornado para quem
              pode marcar. Um clique liga ou desliga (entra no Histórico). */}
          {mostraUrgencia && (
            <button onClick={podeUrgenciaAqui ? () => rodar(() => acoes.salvarUrgente(!urgente)) : undefined} disabled={!podeUrgenciaAqui}
              className={urgente ? "p10-urgente" : "p10-flat"}
              aria-pressed={urgente} aria-label={urgente ? "Pedido urgente" : "Marcar como urgente"}
              title={urgente ? (podeUrgenciaAqui ? "Pedido urgente. Clique para tirar a urgência" : "Pedido urgente") : "Marcar como urgente"}
              style={{ position: "absolute", right: direitaDe("urgencia"), top: topoDe("urgencia"), width: 44, height: 44, borderRadius: 999, border: `2px solid ${urgente ? PRETO : tinta}`, background: urgente ? PRETO : "none", color: urgente ? "#fff" : tinta,
                display: "flex", alignItems: "center", justifyContent: "center", padding: 0, zIndex: 2, fontFamily: INTER, fontSize: 22, fontWeight: 900, lineHeight: 1, cursor: podeUrgenciaAqui ? "pointer" : "default" }}>
              <span>!</span>
            </button>
          )}

          {/* o ✕ no círculo branco: com a letra clara do cartão (o branco do
              Cancelado, o verde neon do Finalizado) ele ficava ilegível; aí vai
              na cor do cartão (Augusto, 06/10/2026: "o x está ilegível, deixe na
              cor do card") */}
          <button onClick={aoFechar} className="p10-flat" aria-label="Fechar"
            style={{ position: "absolute", left: CAPA_V4.cartao - 80, top: 50, width: 44, height: 44, borderRadius: 999, border: `2px solid ${tinta}`, background: "#FFFFFFEB", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, zIndex: 2 }}>
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={luminancia(tinta) > 0.4 ? cor : tinta} strokeWidth={2.2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>

          {podeCancelarAqui && (
            /* na tinta do cartão, como os ícones vizinhos: o lilás do perigo
               quase sumia nos cartões coloridos (1,21:1 no azul do Design
               criado; simulação 6, 07/10/2026). O perigo fica na caixa que
               confirma o cancelamento. */
            <button onClick={() => setCancelar(true)} className="p10-flat" title="Cancelar pedido" aria-label="Cancelar pedido"
              style={{ position: "absolute", right: PRIMEIRO_ICONE, top: 50, width: 44, height: 44, borderRadius: 999, border: `2px solid ${tinta}`, background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, zIndex: 2 }}>
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={tinta} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
            </button>
          )}

          {/* Pergunta aberta: só o ícone, ao lado da lixeira. Antes era uma
              pílula flutuante no rodapé do painel, que caía por cima de
              Medida e Substrato. O `right` acompanha a lixeira — quando ela
              não aparece, o ícone ocupa o lugar dela. */}
          {/* Pôr o pedido esperando o cliente: o ícone de pausa, ao lado da
              lixeira. Pede o motivo, e o pedido volta para a etapa em que
              estava quando o cliente responder. */}
          {podeEsperarAqui && (
            <button onClick={() => setEscrever("espera")} className="p10-flat" title="Aguardar o cliente" aria-label="Aguardar o cliente"
              style={{ position: "absolute", right: direitaDe("esperar"), top: 50, width: 44, height: 44, borderRadius: 999, border: `2px solid ${tinta}`, background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, zIndex: 2 }}>
              <svg viewBox="0 0 24 24" width={18} height={18} fill={tinta}><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            </button>
          )}

          {/* Clicar no balão abre a mensagem: a caixa da conversa, quando há
              pergunta para você ou resposta que chegou; senão, o painel
              Conversa (Augusto, 29/09/2026). */}
          {mostraBalao && (
            <button onClick={abrirConversa} className="p10-flat" title="Abrir a mensagem" aria-label="Abrir a mensagem"
              /* 155, e não 152: o balão é mais largo que a caixa de 44 (ele
                 transborda 0,2 de cada lado), o que deixava o vão até a
                 lixeira em 14,1 contra os 17 que a lixeira tem até o fechar.
                 Os 3px empatam os dois vãos. */
              style={{ position: "absolute", right: !curta && fileira.indexOf("balao") === 0 ? PRIMEIRO_ICONE + 3 : direitaDe("balao") - 1, top: topoDe("balao"), width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              {/* 53, e não 44: a Lottie reserva margem própria, então numa
                  caixa de 40 o balão saía com 33,5 de largura e parecia menor
                  que os círculos de 44 ao lado. 53 × (33,5/40) = 44,4 — mesmo
                  tamanho aparente dos vizinhos. A sobra passa da caixa de
                  layout de propósito, para o espaçamento não mudar. */}
              <LottieHub10 src={LOTTIE.chat}
                /* o -3.6 alinha o CENTRO do balão com o dos botões ao lado: o
                   desenho não é centrado na tela da Lottie, então centrar a
                   caixa deixava o balão 3,6px mais baixo que os vizinhos */
                style={{ width: 53, height: 53, flex: "none", transform: "translateY(-3.6px)", pointerEvents: "none" }} />
            </button>
          )}

          {/* o nome: o mesmo do cartão da trilha de Pedidos (ChromeHub10),
              com menos linhas quando a fileira de ações sobe até ele */}
          <NomeDoCartaoAberto nome={nomeCliente} linhas={linhasDoNome} />

          {/* a fileira de ações termina onde a pílula de status da trilha
              termina; com dois botões que não cabem lado a lado, cresce para
              cima, sem descer no pé */}
          <div ref={acoesRef} style={{ position: "absolute", left: MARGEM_V4 - 4, bottom: CAPA_V4.altura - (PE_CARTAO_V4.pilulaTopo + PE_CARTAO_V4.pilulaAltura), right: 36, zIndex: 8,
            display: "flex", flexWrap: "wrap", alignContent: "flex-end", gap: 12 }}>
            {pode.iniciar && status === "nova" && (
              /* sem pasta confirmada, antes de iniciar o designer escolhe a pasta */
              <button onClick={() => (dados.pasta ? rodar(() => acoes.mudarStatus("criacao", OBS_PADRAO.criacao, status)) : acoes.pedirPasta())} className="p10-flat" style={{ ...BOTAO_ESCURO, fontSize: 22 }}>
                <svg width={19} height={19} viewBox="0 0 24 24" fill="#f1f1f1"><polygon points="6 4 20 12 6 20 6 4" /></svg>Iniciar criação
              </button>
            )}
            {status === "aguardando" && pode.aprovar && (
              <button onClick={aprovar} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Aprovar
              </button>
            )}
            {status === "aguardando" && pode.pedirRevisao && (
              <button onClick={() => setEscrever("revisao")} className="p10-flat" style={BOTAO_VAZADO}>Pedir revisão</button>
            )}
            {status === "aprovada" && pode.clicheria && (
              <button onClick={() => { setEspessura(String(p.cliche_espessura ?? "")); setEnviarClicheria("enviar"); }} className="p10-flat" style={BOTAO_ESCURO}>Enviar p/ clicheria</button>
            )}
            {/* Finalizar abre a caixa do clichê: o pedido fecha junto com o
                valor, e o valor entra pelo PDF da clicheria. Fechar sem isso
                deixava o gasto do mês incompleto e ninguém voltava para pôr. */}
            {status === "cliche" && pode.finalizar && (
              <button onClick={acoes.finalizar} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Finalizar
              </button>
            )}
            {status === "cliche" && pode.refazerCliche && (
              <button onClick={abrirRefazer} className="p10-flat" style={BOTAO_VAZADO}>Refazer clichê</button>
            )}
            {status === "refazer_cliche" && pode.clicheria && (
              <button onClick={() => { setEspessura(String(p.cliche_espessura ?? "")); setEnviarClicheria("reenviar"); }} className="p10-flat" style={BOTAO_ESCURO}>Reenviar p/ clicheria</button>
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
            {status === "aguardando_cliente" && pode.esperarCliente && (
              <button onClick={() => setEscrever("respondeu")} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="#f1f1f1"><polygon points="6 4 20 12 6 20 6 4" /></svg>Cliente respondeu
              </button>
            )}
            {/* o que falta, numa linha embaixo do botão (o texto inteiro no title) */}
            {status === "aguardando_cliente" && motivoDaEspera && (
              <div title={motivoDaEspera} style={{ flexBasis: "100%", marginTop: -6, fontSize: 15, lineHeight: "18px", color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {/^falta/i.test(motivoDaEspera) ? motivoDaEspera : `Falta: ${motivoDaEspera}`}
              </div>
            )}
            {status === "cancelado" && pode.reativar && (
              <button onClick={() => setConfirmarReativar(true)} className="p10-flat" style={BOTAO_ESCURO}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>Reativar pedido
              </button>
            )}
            {/* Sem ação para este status e esta pessoa: mostra o estado. */}
            {!((pode.iniciar && status === "nova") || (status === "aguardando" && (pode.aprovar || pode.pedirRevisao))
              || (status === "aprovada" && pode.clicheria) || (status === "cliche" && (pode.finalizar || pode.refazerCliche))
              || (status === "refazer_cliche" && pode.clicheria) || ((status === "revisao" || status === "criacao") && pode.enviarArte)
              || (status === "cancelado" && pode.reativar) || (status === "aguardando_cliente" && pode.esperarCliente)) && (
              <div style={{ height: 50, display: "inline-flex", alignItems: "center", padding: "0 24px", border: `2px solid ${tinta}`, borderRadius: 999, fontSize: 24, fontWeight: 600, whiteSpace: "nowrap", color: tinta }}>{statusRotulo}</div>
            )}
          </div>

          {/* o pé: o mesmo do cartão da trilha, nas mesmas posições (Augusto,
              02/10/2026: "o alinhamento nos cards que fizemos em aprovação,
              estenda para pedidos"); antes o substrato de duas linhas acabava
              a 4 px da borda */}
          <PeDoCartaoV4 entrada={quando(String(p.created_at)).split(" ·")[0]} cores={texto(numeroDeCores(p))} medida={medida} substrato={texto(p.materia)} />
        </div>

        {/* ————— 1. Briefing ————— */}
        <div className={classeDoPainel("briefing", editando === "briefing")} onClick={fixar("briefing")} style={{ ...PAINEL, background: editando === "briefing" ? PALETA.amareloForte : fundoPainel(0), zIndex: zDoPainel(0) }}>
          <div style={{ position: "absolute", left: 60, top: 58, right: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
            {editando === "briefing" ? (
              <>
                <button onClick={() => {
                  /* briefing é obrigatório no pedido novo: salvar em branco apagava o que o design tinha para ler */
                  if (!fBrief.descricao.trim()) { setErro("O briefing não pode ficar em branco."); return; }
                  rodar(() => acoes.salvarBriefing(fBrief.descricao.trim(), fBrief.cores), () => setEditando(null));
                }} className="p10-flat" style={{ ...ACAO, fontWeight: 700 }}>
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
            <div style={{ position: "absolute", left: 60, top: 212, width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
              <textarea value={fBrief.descricao} onChange={(e) => setFBrief({ ...fBrief, descricao: e.target.value })} placeholder="Briefing do pedido..." aria-label="Briefing"
                style={{ ...TRACEJADO, width: "100%", height: 236, resize: "none" }} />
              <input value={fBrief.cores} onChange={(e) => setFBrief({ ...fBrief, cores: e.target.value })} placeholder="Cores (ex.: Amarelo, Preto)" aria-label="Cores"
                style={{ ...TRACEJADO, width: "100%", borderRadius: 12, padding: "10px 14px" }} />
            </div>
          ) : (
            <>
              <div ref={vigiarRolagem} className="p10-trilha p10-rola" style={{ position: "absolute", left: 60, top: 212, width: CAPA_V4.cartao - 60 - 60, maxHeight: 228 + (CAPA_V4.altura - 616), overflowY: "auto", fontSize: 17, lineHeight: 1.5, whiteSpace: "pre-wrap", ...fundoDoAviso(0) }}>
                {String(p.descricao ?? "").trim() || "Sem briefing preenchido neste pedido."}
              </div>
              {/* Preso pela BASE, não pelo topo. Com uma linha de cores o
                  bloco cai no mesmo lugar de sempre (o `top: 495` do projeto
                  equivale a este `bottom: 36`); com duas, ele cresce para
                  cima em vez de vazar por baixo do painel. O limite de duas
                  linhas impede que um pedido de muitas cores suba por cima do
                  briefing — a lista inteira está nas Especificações. */}
              <div style={{ position: "absolute", left: 60, bottom: 36, right: 60, display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100" }}>{numeroPedido(Number(p.numero))}</div>
                {!!cores.length && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ font: `800 12px/1 ${INTER}`, letterSpacing: ".14em", textTransform: "uppercase", color: CINZA }}>Cores solicitadas</div>
                    {/* flex com wrap, como no projeto: não há espaço em branco
                        entre os nomes, então só como itens de flex eles têm
                        onde quebrar. O teto de 54 (duas linhas de 27) guarda o
                        painel de um pedido com muitas cores. */}
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", fontSize: 18, lineHeight: "27px", fontWeight: 500, maxHeight: 54, overflow: "hidden" }}>
                      {/* nowrap no nome: sem isso "Pantone 294 C" quebrava no
                          meio, e a cor virava duas coisas na leitura */}
                      {cores.map((c, i) => (
                        <span key={c + i} style={{ whiteSpace: "nowrap" }}>{c}{i < cores.length - 1 && <span style={{ margin: "0 8px", color: CLARO }}>·</span>}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ————— 2. Alterações ————— */}
        <div className={classeDoPainel("alteracoes")} onClick={fixar("alteracoes")} style={{ ...PAINEL, background: fundoPainel(1), zIndex: zDoPainel(1) }}>
          {/* a marca e a ação na mesma fileira: soltas, o "1 pedida · 0
              atendidas" encavalava no "Pedir revisão" (Augusto, 02/10/2026).
              Mais curta ("0 de 1 atendida") para caber com a ação, e corta com
              reticências se ainda não couber. Alteração se pede com a arte
              entregue ou aprovada (é o que o servidor aceita). */}
          <div style={{ position: "absolute", left: 60, top: 58, right: 60, display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ ...MARCA, position: "static", flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{alteracoes.length
              ? `${atendidas} de ${alteracoes.length} ${alteracoes.length === 1 ? "atendida" : "atendidas"}`
              : "—"}</span>
            {pode.pedirRevisao && (status === "aguardando" || status === "aprovada") && (
              <button onClick={() => setEscrever("revisao")} className="p10-flat" style={{ ...ACAO, flex: "none" }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Pedir revisão
              </button>
            )}
          </div>
          <div style={TITULO_PAINEL}>Alterações</div>
          {alteracoes.length ? (
            <div ref={vigiarRolagem} className="p10-trilha p10-rola" style={{ position: "absolute", left: 60, top: 212, right: 60, bottom: 40, overflowY: "auto", display: "flex", flexDirection: "column", gap: 22, ...fundoDoAviso(1) }}>
              {alteracoes.map((h) => {
                const r = resolvidas.get(h.id);
                const feita = marcando[h.id] ?? !!r;
                const caixa: CSSProperties = { flex: "none", marginTop: 2, width: 22, height: 22, boxSizing: "border-box", border: `1.6px solid ${PRETO}`, borderRadius: 5, background: feita ? PRETO : "transparent", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
                const marca = feita && <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>;
                return (
                  <div key={h.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {pode.resolverAlteracao ? (
                      <button onClick={() => marcar(h.id, !feita)} aria-pressed={feita}
                        aria-label={feita ? "Desmarcar: ainda não foi atendida" : "Marcar como atendida"} title={feita ? "Desmarcar: ainda não foi atendida" : "Marcar como atendida"}
                        style={{ ...caixa, cursor: "pointer" }}>{marca}</button>
                    ) : (
                      <span aria-label={feita ? "Atendida" : "Ainda não atendida"} style={{ ...caixa, opacity: feita ? 1 : 0.4 }}>{marca}</span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{quando(h.created_at)}</div>
                      <div style={{ marginTop: 4, fontSize: 17, lineHeight: 1.4, overflowWrap: "anywhere", textDecoration: feita ? "line-through" : undefined, color: feita ? CINZA : undefined }}>{h.observacao || "—"}</div>
                      <div style={{ marginTop: 2, fontSize: 14, color: CINZA }}>
                        {[h.user_nome, feita ? `atendida${r?.user_nome ? ` por ${r.user_nome}` : ""}` : null].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ position: "absolute", left: 60, top: 212, width: 320, fontSize: 17, lineHeight: 1.5, color: CLARO, fontStyle: "italic" }}>Nenhuma alteração registrada ainda.</div>
          )}
        </div>

        {/* ————— 3. Especificações ————— */}
        <div className={classeDoPainel("especificacoes", editando === "especificacoes")} onClick={fixar("especificacoes")} style={{ ...PAINEL, background: editando === "especificacoes" ? PALETA.amareloForte : fundoPainel(2), zIndex: zDoPainel(2) }}>
          <span style={MARCA}>{numeroPedido(Number(p.numero))}</span>
          <div style={{ position: "absolute", left: 60, top: 58, right: 60, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 30 }}>
            {editando === "especificacoes" ? (
              <>
                <button onClick={() => rodar(() => acoes.salvarEspec(fEspec), () => setEditando(null))} className="p10-flat" style={{ ...ACAO, fontWeight: 700 }}>
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Salvar
                </button>
                <button onClick={() => setEditando(null)} className="p10-flat" style={{ ...ACAO, color: CINZA }}>Cancelar</button>
              </>
            ) : podeEditarEspec && <button onClick={() => abrirEdicao("especificacoes")} className="p10-flat" style={ACAO}>Editar</button>}
          </div>
          {/* o título mais comprido: a 56 a tinta terminava a 47 da borda direita; a 54 fica dentro dos 60 */}
          <div style={{ ...TITULO_PAINEL, fontSize: 54 }}>Especificações</div>

          {editando === "especificacoes" ? (
            <div style={{ position: "absolute", left: 60, top: 212, width: 320, display: "flex", flexDirection: "column", gap: 22 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div style={{ position: "relative" }} data-pop>
                  <div style={ROTULO_PEQ}>Matéria-prima:</div>
                  {/* sem licença para a matéria-prima, ela fica como está (travada) */}
                  <button onClick={() => { if (!pode.editar) return; setPopMateria(!popMateria); setPopAcab(false); }} className="p10-flat" disabled={!pode.editar}
                    title={pode.editar ? undefined : "A matéria-prima só muda com a licença de editar o pedido."}
                    style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", background: "none", border: "none", borderBottom: pode.editar ? `1.5px dashed ${PRETO}` : "1.5px solid transparent", padding: "0 0 2px", fontFamily: INTER, fontSize: 17, color: PRETO, cursor: pode.editar ? "pointer" : "default", textAlign: "left" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fEspec.materia || "—"}</span>
                    {pode.editar && <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.6} strokeLinecap="round" style={{ flex: "none" }}><polyline points="6 9 12 15 18 9" /></svg>}
                  </button>
                  {popMateria && pode.editar && (
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
                  <input value={fEspec.larg_materia} onChange={(e) => setFEspec({ ...fEspec, larg_materia: soNumero(e.target.value) })} inputMode="decimal" aria-label="Bobina" disabled={!pode.faca}
                    style={{ marginTop: 3, width: "100%", boxSizing: "border-box", border: "none", borderBottom: pode.faca ? `1.5px dashed ${PRETO}` : "1.5px solid transparent", padding: "0 0 2px", outline: "none", fontFamily: INTER, fontSize: 18, color: PRETO, background: "transparent" }} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <div>
                  <div style={ROTULO_PEQ}>Carreiras:</div>
                  <input value={fEspec.carreiras} onChange={(e) => setFEspec({ ...fEspec, carreiras: e.target.value.replace(/\D/g, "").replace(/^0+/, "") })} inputMode="numeric" aria-label="Carreiras" disabled={!pode.faca}
                    style={{ marginTop: 3, width: "100%", boxSizing: "border-box", border: "none", borderBottom: pode.faca ? `1.5px dashed ${PRETO}` : "1.5px solid transparent", padding: "0 0 2px", outline: "none", fontFamily: INTER, fontSize: 18, color: PRETO, background: "transparent" }} />
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
            /* Sem rolagem aqui: especificação é um conjunto fixo de campos e
               tem de caber. Com 24 de respiro entre os cinco blocos e as cores
               em grade de duas colunas, um pedido de cinco cores escondia 79px
               — justo o que ninguém procura, porque nada indica que há mais
               embaixo. Respiro menor, rodapé mais curto e as cores em pílulas
               que quebram sozinhas. */
            <div ref={vigiarRolagem} className="p10-trilha p10-rola" style={{ position: "absolute", left: 60, top: 212, right: 60, bottom: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, ...fundoDoAviso(2) }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 16px" }}>
                <div><div style={ROTULO_PEQ}>Matéria-prima:</div><div style={VALOR}>{texto(p.materia)}</div></div>
                <div><div style={ROTULO_PEQ}>Bobina:</div><div style={VALOR}>{temValor(p.larg_materia) ? `${p.larg_materia}mm` : "—"}</div></div>
              </div>
              {/* A faca ao lado da medida, que é o que ela define. "Trocar"
                  abre a caixa da faca (do catálogo ou faca nova). */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 16px" }}>
                <div><div style={ROTULO_PEQ}>Medida:</div><div style={VALOR}>{medida}</div></div>
                <div>
                  <div style={{ ...ROTULO_PEQ, display: "flex", alignItems: "baseline", gap: 10 }}>
                    Faca:
                    {podeTrocarFaca && (
                      <button onClick={() => setTrocandoFaca(true)} className="p10-flat"
                        style={{ background: "none", border: "none", padding: 0, fontFamily: INTER, fontSize: 14, fontWeight: 600, color: CINZA, textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer" }}>Trocar</button>
                    )}
                  </div>
                  <div style={{ ...VALOR, overflowWrap: "anywhere" }}>{nomeDaFaca}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 16px" }}>
                <div><div style={ROTULO_PEQ}>Carreiras:</div><div style={VALOR}>{texto(p.carreiras)}</div></div>
                <div><div style={ROTULO_PEQ}>Forma:</div><div style={{ ...VALOR, overflowWrap: "anywhere" }}>{texto(p.forma)}</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 16px" }}>
                <div><div style={ROTULO_PEQ}>Acabamento:</div><div style={{ marginTop: 3, fontSize: 17, lineHeight: 1.4 }}>{acabamentos.join(" + ") || "—"}</div></div>
                {/* nome comprido para em duas linhas (o nome inteiro no
                    title): em várias linhas ele empurrava o resto da coluna
                    para baixo da faixa preta, sem sinal de rolagem (simulação 3) */}
                <div><div style={ROTULO_PEQ}>Nome da pasta:</div><div title={dados.pasta ? String(dados.pasta.nome) : undefined}
                  style={{ ...VALOR, overflowWrap: "anywhere", color: dados.pasta ? undefined : "#8a8a8a", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {/* sem pasta ainda: o designer escolhe ao iniciar — mostrar o
                      nome digitado aqui fingia uma pasta que não existe */}
                  {dados.pasta ? texto(dados.pasta.nome) : "o design escolhe ao iniciar"}
                </div></div>
              </div>
              {/* a espessura pedida à clicheria (1.14 ou 1.70), escolhida no
                  Enviar p/ clicheria: só o Histórico dizia (simulação 6,
                  07/10/2026) */}
              {temValor(p.cliche_espessura) && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0 16px" }}>
                  <div><div style={ROTULO_PEQ}>Clichê:</div><div style={VALOR}>{String(p.cliche_espessura)}</div></div>
                </div>
              )}
              {!!coresDasEspecificacoes.length && (
                <div>
                  <div style={{ ...ROTULO_PEQ, marginBottom: 6 }}>{coresDaArte.length ? "Cores da arte:" : "Cores:"}</div>
                  {/* pílulas que quebram sozinhas em vez de duas colunas
                      fixas: cinco cores ocupavam três fileiras, e nomes
                      curtos deixavam meia coluna vazia */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
                    {coresDasEspecificacoes.map((c, i) => (
                      <div key={c + i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* a bolinha mostra a cor de verdade quando o nome é
                            uma cor conhecida; cinza só quando não dá para
                            saber qual é */}
                        <span style={{ width: 18, height: 18, borderRadius: 999, background: corDoNome(c) ?? "#e6e6e6", flex: "none", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.12)" }} />
                        <span style={{ fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100", fontWeight: 600, fontSize: 17 }}>{c}</span>
                      </div>
                    ))}
                  </div>
                  {coresNaoBatem && <div style={{ marginTop: 8, fontSize: 14, color: CINZA }}>Diferentes das solicitadas no Briefing.</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ————— 4. Anexos / Design ————— */}
        <div className={classeDoPainel("anexos")} onClick={fixar("anexos")} style={{ ...PAINEL, background: fundoPainel(3), zIndex: zDoPainel(3) }}>
          <span style={MARCA}>{entregas.length ? `V${String(entregas.length).padStart(2, "0")}` : "—"}</span>
          <div style={{ position: "absolute", left: 56, top: 111, width: 348, display: "flex", alignItems: "baseline", gap: 20 }}>
            {["Anexos", "Design"].map((r, i) => (
              <button key={r} onClick={() => setAba(i)}
                style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100, 'opsz' 72", fontWeight: aba === i ? 600 : 400, fontSize: 44, lineHeight: "52px", letterSpacing: "-.04em", color: aba === i ? PRETO : CLARO, width: 165 }}>{r}</button>
            ))}
          </div>
          <div ref={vigiarRolagem} className="p10-trilha p10-rola" style={{ position: "absolute", left: 60, top: 200, right: 60, bottom: 36, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, ...fundoDoAviso(3) }}>
            {aba === 0 ? (
              <>
                {pode.anexar && pode.subirArquivo && status !== "cancelado" && (status !== "concluido" || souAdmin) && (
                  <label className="p10-flat" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 84, border: `1.5px dashed ${PRETO}`, borderRadius: 16, fontFamily: INTER, fontSize: 16, fontWeight: 600, color: PRETO, cursor: "pointer", width: 320 }}>
                    <input ref={entradaAnexo} type="file" multiple style={{ display: "none" }}
                      onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; if (fs.length) rodar(() => acoes.anexar(fs)); }} />
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    {ocupado ? "Enviando…" : "Anexar arquivos"}
                  </label>
                )}
                {anexosPedido.length ? anexosPedido.map((a) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 46, padding: "0 16px", border: `1px solid ${PRETO}`, borderRadius: 12, fontSize: 15, fontWeight: 500, width: 320 }}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><path d="M21 12.5 12.5 21a4 4 0 0 1-5.7-5.7l8-8a2.5 2.5 0 0 1 3.6 3.6l-8 8a1 1 0 0 1-1.5-1.5l7.4-7.4" /></svg>
                    <NomeArquivo a={a} pode={pode.baixar} aoAbrir={abrirArquivo} />
                    {pode.baixar && <BotaoBaixar a={a} aoBaixar={baixar} />}
                    {pode.anexar && status !== "cancelado" && (status !== "concluido" || souAdmin) && (
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
                {/* "Enviar arte pronta" manda o pedido para Design criado: só
                    faz sentido na criação e na revisão. Depois da aprovação (e
                    na clicheria) ele devolvia o pedido aprovado para Design
                    criado (simulação de 28/09/2026). Ali o que se quer é
                    guardar a arte final, e o status fica como está. */}
                {/* Em Design criado a entrega ainda se corrige: "Reenviar arte"
                    manda uma versão nova (o servidor aceita). Antes o único
                    caminho ali era "Anexar arte final", que guardava a arte
                    como final sem ela ter sido aprovada. */}
                {pode.enviarArte && (status === "criacao" || status === "revisao" || status === "aguardando") && (
                  <button onClick={acoes.enviarArte} className="p10-flat" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 84, border: `1.5px dashed ${PRETO}`, borderRadius: 16, background: "none", fontFamily: INTER, fontSize: 16, fontWeight: 600, color: PRETO, cursor: "pointer", width: 320 }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>{status === "aguardando" ? "Reenviar arte" : "Enviar arte pronta"}
                  </button>
                )}
                {pode.enviarArte && ["aprovada", "cliche", "refazer_cliche", "concluido"].includes(status)
                  && (status !== "concluido" || souAdmin) && (
                  <label className="p10-flat" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 84, border: `1.5px dashed ${PRETO}`, borderRadius: 16, fontFamily: INTER, fontSize: 16, fontWeight: 600, color: PRETO, cursor: "pointer", width: 320 }}>
                    <input type="file" multiple style={{ display: "none" }}
                      onChange={(ev) => { const fs = Array.from(ev.target.files ?? []); ev.target.value = ""; if (fs.length) rodar(() => acoes.anexarArte(fs)); }} />
                    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    {ocupado ? "Enviando…" : "Anexar arte final"}
                  </label>
                )}
                {/* uma versão por entrega, da mais nova para a mais velha */}
                {versoes.length ? versoes.map((v) => (
                  <div key={v.chave} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6, width: 320 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                      <span style={{ flex: "none", fontFamily: "Fraunces, serif", fontVariationSettings: "'SOFT' 100", fontWeight: 600, fontSize: 20 }}>{v.titulo}</span>
                      <span style={{ minWidth: 0, fontSize: 14, color: CINZA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[quando(v.quando), v.quem].filter(Boolean).join(" · ")}</span>
                    </div>
                    {v.nota && <div style={{ fontSize: 14, lineHeight: 1.4, color: CINZA, overflowWrap: "anywhere" }}>{v.nota}</div>}
                    {v.arquivos.length ? v.arquivos.map((a) => (
                      <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, minHeight: 46, padding: "0 16px", border: `1px solid ${PRETO}`, borderRadius: 12, fontSize: 15, fontWeight: 500, width: 320, boxSizing: "border-box" }}>
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 15 5-5 5 5" /><circle cx="9" cy="9" r="1.4" /></svg>
                        <NomeArquivo a={a} pode={pode.baixar} aoAbrir={abrirArquivo} />
                        {pode.baixar && <BotaoBaixar a={a} aoBaixar={baixar} />}
                      </div>
                    )) : <div style={{ fontSize: 14, color: CLARO, fontStyle: "italic" }}>Sem arquivo nesta versão.</div>}
                  </div>
                )) : <div style={{ fontSize: 16, lineHeight: 1.5, color: CLARO, fontStyle: "italic" }}>Nenhuma arte enviada ainda.</div>}
              </>
            )}
          </div>
        </div>

        {/* ————— 5. Histórico ————— */}
        <div className={classeDoPainel("historico")} onClick={fixar("historico")} style={{ ...PAINEL, background: fundoPainel(4), zIndex: zDoPainel(4) }}>
          <span style={MARCA}>{dados.historico.length} {dados.historico.length === 1 ? "evento" : "eventos"}</span>
          <div style={TITULO_PAINEL}>Histórico</div>
          <div ref={vigiarRolagem} className="p10-trilha p10-rola" style={{ position: "absolute", left: 60, top: 212, right: 60, bottom: 40, overflowY: "auto", display: "flex", flexDirection: "column", gap: 22, ...fundoDoAviso(4) }}>
            {dados.historico.slice().reverse().map((h) => (
              <div key={h.id}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{quando(h.created_at)}</div>
                <div style={{ marginTop: 4, fontSize: 17, lineHeight: 1.4, overflowWrap: "anywhere" }}>{textoDoEvento(h)}</div>
                {h.user_nome && <div style={{ marginTop: 2, fontSize: 14, color: CINZA }}>{h.user_nome}</div>}
              </div>
            ))}
            {!dados.historico.length && <div style={{ fontSize: 17, color: CLARO, fontStyle: "italic" }}>Pedido criado e enviado para a fila do design.</div>}
          </div>
        </div>

        {/* ————— 6. Conversa ————— */}
        <div className={classeDoPainel("conversa")} onClick={fixar("conversa")} style={{ ...PAINEL, background: fundoPainel(5), zIndex: zDoPainel(5) }}>
          <span style={MARCA}>{dados.perguntas.length} {dados.perguntas.length === 1 ? "pergunta" : "perguntas"}</span>
          {pode.perguntar && (
            <div style={{ position: "absolute", left: 60, top: 58, right: 60, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setEscrever("pergunta")} className="p10-flat" style={ACAO}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Perguntar
              </button>
            </div>
          )}
          <div style={TITULO_PAINEL}>Conversa</div>
          <div ref={vigiarRolagem} className="p10-trilha p10-rola" style={{ position: "absolute", left: 60, top: 212, right: 60, bottom: 40, overflowY: "auto", display: "flex", flexDirection: "column", gap: 22, ...fundoDoAviso(5) }}>
            {dados.perguntas.length ? dados.perguntas.map((q) => (
              <div key={q.id}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{quando(q.created_at)}</div>
                <div style={{ marginTop: 4, fontSize: 17, lineHeight: 1.4, background: PALETA.amarelo, borderRadius: 12, padding: "10px 12px", overflowWrap: "anywhere" }}>{q.texto}</div>
                {/* sem destinatário, a pergunta foi para o time do design (pedido ainda sem designer) */}
                <div style={{ marginTop: 3, fontSize: 14, color: CINZA }}>{q.de_nome ?? "—"} → {q.para_nome ?? "time do design"}</div>
                {q.respondida_em ? (
                  <div style={{ marginTop: 8, fontSize: 17, lineHeight: 1.4, paddingLeft: 12, borderLeft: `3px solid ${PRETO}`, overflowWrap: "anywhere" }}>
                    {q.resposta}
                    <div style={{ marginTop: 3, fontSize: 14, color: CINZA }}>{q.respondida_por_nome} · {quando(q.respondida_em)}</div>
                  </div>
                ) : q.de_id && q.de_id === euId ? (
                  <div style={{ marginTop: 8, fontSize: 14, color: CINZA, fontStyle: "italic" }}>Esperando resposta</div>
                ) : (
                  <button onClick={() => setRespondendo(q)} className="p10-flat"
                    style={{ marginTop: 8, height: 36, padding: "0 18px", borderRadius: 999, border: `2px solid ${PRETO}`, background: "none", fontFamily: INTER, fontSize: 15, fontWeight: 600, color: PRETO, cursor: "pointer" }}>Responder</button>
                )}
              </div>
            )) : <div style={{ fontSize: 17, color: CLARO, fontStyle: "italic" }}>Nenhuma pergunta neste pedido.</div>}
          </div>
        </div>
        {/* A folga do fim, como nas trilhas de Pedidos e das capas: com ela o
            último painel encaixa terminando na c23 (1840). Sem ela a rolagem
            parava 80 antes do encaixe, sobrava um vão ao lado do cartão do
            pedido e o último painel passava da c23 (Augusto, 02/10/2026). */}
        <div aria-hidden style={{ flex: "0 0 80px", height: 1 }} />
      </div>

      {maisDir && <SetaDaTrilha centro={[1867.3, CAPA_V4.topo - TOPO_DETALHE + CAPA_V4.altura / 2]} />}

    </div>

      {/* As caixas ficam FORA do painel: ele corta o que passa das bordas
          (overflow:hidden), e o véu delas tem de cobrir o palco inteiro. */}
      {/* ————— modais ————— */}
      {escrever === "pergunta" && (
        <ModalEscrever titulo={`Perguntar para ${destinoPergunta}`}
          sub={`Tire dúvidas sobre o pedido. ${destinoPergunta.charAt(0).toUpperCase()}${destinoPergunta.slice(1)} vai receber um aviso.`}
          marcador="Ex.: O logo pode sair sobre o fundo escuro?" rotuloBotao="Enviar pergunta" ocupado={ocupado} podeAnexar={pode.subirArquivo}
          aoCancelar={() => setEscrever(null)}
          aoConfirmar={(t, fs) => rodar(() => comAnexos(fs, () => acoes.perguntar(t)), () => {
            setEscrever(null);
            setSucesso({ titulo: `Pergunta enviada para\n${destinoPergunta}`, resumo: `“${t}”  ·  ${destinoPergunta} vai receber um aviso` });
          })} />
      )}
      {escrever === "revisao" && (
        <ModalEscrever titulo="Pedir revisão" sub="Descreva o que deve mudar na arte. Anexe referências se precisar."
          marcador="Ex.: Aumentar o logo, trocar o dourado por um tom mais claro..." rotuloBotao="Enviar revisão" ocupado={ocupado} podeAnexar={pode.subirArquivo}
          aoCancelar={() => setEscrever(null)}
          aoConfirmar={(t, fs) => rodar(() => comAnexos(fs, () => acoes.mudarStatus("revisao", t, etapaVista.current)), () => setEscrever(null))} />
      )}
      {escrever === "espera" && (
        <ModalEscrever titulo="Aguardar o cliente"
          sub="O pedido para até o cliente responder e depois volta para a etapa em que está. Diga o que falta."
          marcador="Ex.: o texto legal da embalagem, a prova física aprovada..." rotuloBotao="Aguardar cliente" ocupado={ocupado} podeAnexar={pode.subirArquivo}
          aoCancelar={() => setEscrever(null)}
          aoConfirmar={(t, fs) => rodar(() => comAnexos(fs, () => acoes.aguardarCliente(t)), () => setEscrever(null))} />
      )}
      {escrever === "respondeu" && (
        <ModalEscrever titulo="O cliente respondeu"
          sub={motivoDaEspera
            /* o motivo que já começa com "Falta" não ganha outro "Faltava:" na frente */
            ? (/^falta/i.test(motivoDaEspera) ? motivoDaEspera : `Faltava: ${motivoDaEspera}`)
            : "O pedido volta para a etapa em que estava."}
          marcador="O que o cliente mandou ou disse (opcional)" rotuloBotao="Retomar pedido" opcional ocupado={ocupado} podeAnexar={pode.subirArquivo}
          aoCancelar={() => setEscrever(null)}
          aoConfirmar={(t, fs) => rodar(() => comAnexos(fs, () => acoes.clienteRespondeu(t)), () => setEscrever(null))} />
      )}
      {trocandoFaca && (
        <ModalFaca atual={String(p.faca_cod ?? "")} novaAtual={Number(p.faca_nova) === 1} medida={medida} ocupado={ocupado}
          aoCancelar={() => setTrocandoFaca(false)}
          aoSalvar={(f) => rodar(() => acoes.salvarFaca(f), () => setTrocandoFaca(false))} />
      )}
      {respondendo && (
        <ModalEscrever titulo="Responder" sub={respondendo.texto} marcador="Escreva sua resposta..."
          rotuloBotao="Responder" ocupado={ocupado} podeAnexar={pode.subirArquivo}
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
          rotuloBotao={ehResposta ? "Perguntar" : "Responder"}
          ocupado={ocupado} podeAnexar={pode.subirArquivo}
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

      {/* O visor de arquivo: a vendedora aprovava a arte sem conseguir vê-la
          (simulação de 28/09/2026). Imagem e PDF abrem aqui; baixar fica ao
          lado do nome. */}
      {vendo && (
        <div style={{ ...VEU, background: "rgba(37,36,37,.86)", zIndex: 74 }} onClick={fecharVisor}>
          {/* diálogo com o nome do arquivo, como as outras caixas do pedido
              aberto: sem isso o leitor de tela não sabia que estava numa
              camada por cima (simulação 5, 05/10/2026) */}
          <div role="dialog" aria-modal="true" aria-label={vendo.nome} onClick={(ev) => ev.stopPropagation()}
            style={{ width: 1500, height: 940, background: "#fff", border: `1px solid ${PRETO}`, borderRadius: 22, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 90px -30px rgba(0,0,0,.6)" }}>
            <div style={{ flex: "none", height: 76, padding: "0 20px 0 32px", display: "flex", alignItems: "center", gap: 16, borderBottom: `1px solid ${PRETO}` }}>
              <span style={{ flex: 1, minWidth: 0, ...FR, fontSize: 26, letterSpacing: "-.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vendo.nome}</span>
              <button onClick={() => rodar(() => acoes.baixarArquivo(vendo.id, vendo.nome))} className="p10-flat"
                style={{ ...BOTAO_ESCURO, height: 46, fontSize: 17, padding: "0 22px" }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#f1f1f1" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11" /><path d="M7 10l5 5 5-5" /><path d="M5 20h14" /></svg>Baixar
              </button>
              <BotaoX aoClicar={fecharVisor} tamanho={46} />
            </div>
            <div style={{ flex: 1, minHeight: 0, background: "#f4f4f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/pdf/i.test(vendo.mime) || /\.pdf$/i.test(vendo.nome) ? (
                <iframe title={vendo.nome} src={vendo.url} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
              ) : (
                <img src={vendo.url} alt={vendo.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tirar anexo é um clique ao lado do nome do arquivo — perto demais de
          um acerto sem querer para não ter pergunta. O texto diz o que o hub
          faz de verdade: o arquivo continua na pasta do cliente, some só o
          vínculo com este pedido. */}
      {desvincular && (
        <div style={VEU}>
          <div role="dialog" aria-modal="true" aria-label="Tirar este anexo do pedido?" style={{ ...CARTAO_MODAL, width: 480, padding: "40px 44px", gap: 14 }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>Tirar este anexo do pedido?</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              {/* Sem pasta confirmada, o anexo ainda espera na pasta do HUB e
                  sai junto com o vínculo (anexos.functions, deleteAnexo): o
                  texto da pasta do cliente não valia para ele (simulação 3). */}
              <b style={{ fontWeight: 600, color: PRETO }}>{desvincular.nome}</b> deixa de aparecer aqui. {dados.pasta
                ? "O arquivo continua na pasta do cliente, na rede. O hub não apaga nada de lá."
                : "O pedido ainda não tem pasta: o arquivo estava guardado só no hub e sai junto."}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setDesvincular(null)} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Voltar</button>
              <button onClick={() => rodar(() => acoes.removerAnexo(desvincular.id), () => setDesvincular(null))} className="p10-flat"
                style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 28px" }}>Tirar do pedido</button>
            </div>
          </div>
        </div>
      )}

      {/* O aviso de erro fica FORA do bloco do painel e acima das caixas.
          Dentro dele (z 38) ficava atrás do véu: a ação feita numa caixa
          falhava, a caixa seguia aberta e nada dizia o motivo (caçador de
          falha silenciosa, 28/09/2026). A altura é a mesma de antes: o pé
          da faixa do painel. */}
      {/* Com uma caixa aberta, o aviso desce para o pé do palco: na altura
          de sempre ele cobria o "Voltar ao pedido" e os botões das caixas. */}
      {erro && (
        <div role="alert" style={{ position: "absolute", left: "50%",
          bottom: salto || sucesso || escrever || respondendo || trocandoFaca || desvincular || cancelar || vendo || confirmarAprovar || confirmarReativar || enviarClicheria ? 40 : 376, transform: "translateX(-50%)", zIndex: 80, display: "flex", alignItems: "center", gap: 12, maxWidth: 1400, background: VERMELHO, color: "#fff", borderRadius: 999, padding: "14px 24px", fontFamily: INTER, fontSize: 17, fontWeight: 600, boxShadow: "0 20px 44px -18px rgba(0,0,0,.55)" }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" style={{ flex: "none" }}><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16.5" x2="12" y2="16.5" /></svg>
          <span>{erro}</span>
          <button onClick={() => setErro("")} aria-label="Fechar aviso" style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, padding: 0 }}>✕</button>
        </div>
      )}

      {refazendo && (
        <ModalRefazerCliche motivos={motivosCliche} ocupado={ocupado}
          aoCancelar={() => setRefazendo(false)}
          aoConfirmar={(motivo, observacao) => rodar(
            () => acoes.mudarStatus("refazer_cliche", `Clichê marcado para refação. Motivo: ${motivo}${observacao ? ` (${observacao})` : ""}`, etapaVista.current),
            () => setRefazendo(false),
          )} />
      )}
      {confirmarAprovar && (
        <div style={VEU}>
          <div role="dialog" aria-modal="true" aria-label={entregaSemArquivo ? "Aprovar sem ver a arte?" : "Aprovar a arte?"} style={{ ...CARTAO_MODAL, width: 520, padding: "40px 44px", gap: 14 }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>{entregaSemArquivo ? "Aprovar sem ver a arte?" : "Aprovar a arte?"}</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              {entregaSemArquivo
                ? "A última versão chegou sem arquivo de arte. Confira com o design antes de aprovar."
                : `A ${String(ultimaEntrega?.titulo ?? "versão").toLowerCase()} passa para Aprovado e o design é avisado. Se precisar mudar algo depois, peça em Alterações.`}
            </div>
            {/* as duas listas não batem: avisa, não impede (Augusto,
                07/10/2026: "guarde as duas listas") */}
            {coresNaoBatem && (
              <div role="note" style={{ display: "flex", alignItems: "flex-start", gap: 9, background: PALETA.amarelo, border: `1px solid ${PRETO}`, borderRadius: 12, padding: "12px 16px", font: `500 15px/1.45 ${INTER}`, color: PRETO }}>
                <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={PRETO} strokeWidth={2.4} strokeLinecap="round" style={{ flex: "none", marginTop: 2 }}>
                  <path d="M12 4 2.5 20h19z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17" x2="12" y2="17" />
                </svg>
                <div>
                  <div style={{ fontWeight: 700 }}>As cores da arte não são as pedidas. Confira antes de aprovar.</div>
                  <div style={{ marginTop: 4 }}>Pedidas: {cores.join(", ")}</div>
                  <div>Na arte: {coresDaArte.join(", ")}</div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setConfirmarAprovar(false)} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Voltar</button>
              <button onClick={() => rodar(() => acoes.mudarStatus("aprovada", OBS_PADRAO.aprovada, etapaVista.current), () => setConfirmarAprovar(false))} className="p10-flat"
                style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 28px" }}>{entregaSemArquivo ? "Aprovar assim mesmo" : "Aprovar arte"}</button>
            </div>
          </div>
        </div>
      )}

      {confirmarReativar && (
        <div style={VEU}>
          <div role="dialog" aria-modal="true" aria-label="Reativar este pedido?" style={{ ...CARTAO_MODAL, width: 520, padding: "40px 44px", gap: 14 }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>Reativar este pedido?</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>
              {volta.achou
                ? `O pedido volta para ${STATUS_LABELS[volta.etapa] ?? volta.etapa}, a etapa em que estava quando foi cancelado. O histórico registra a reativação.`
                : "O pedido volta para Aguardando design. O histórico registra a reativação."}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setConfirmarReativar(false)} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Voltar</button>
              <button onClick={() => rodar(() => acoes.mudarStatus("nova", "Pedido reativado", etapaVista.current), () => setConfirmarReativar(false))} className="p10-flat"
                style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 28px" }}>Reativar pedido</button>
            </div>
          </div>
        </div>
      )}

      {enviarClicheria && (
        <div style={VEU}>
          <div role="dialog" aria-modal="true" aria-label={enviarClicheria === "reenviar" ? "Reenviar para a clicheria" : "Enviar para a clicheria"} style={{ ...CARTAO_MODAL, width: 520, padding: "40px 44px", gap: 14 }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>{enviarClicheria === "reenviar" ? "Reenviar para a clicheria" : "Enviar para a clicheria"}</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>Qual a espessura do clichê? Os relatórios separam a quantidade e o valor de cada uma.</div>
            <div role="radiogroup" aria-label="Espessura do clichê" style={{ display: "flex", gap: 12, marginTop: 4 }}>
              {(["1.14", "1.70"] as const).map((e) => (
                <button key={e} type="button" role="radio" aria-checked={espessura === e} onClick={() => setEspessura(e)} className="p10-flat"
                  style={{ ...(espessura === e ? BOTAO_ESCURO : BOTAO_VAZADO), height: 56, minWidth: 140, justifyContent: "center", fontSize: 22, fontWeight: 600 }}>{e}</button>
              ))}
            </div>
            {/* onde roda com a espessura escolhida; nenhuma máquina, no marca-texto */}
            {avisoClicheria && (
              <div role="status" data-aviso-clicheria style={{ fontSize: 16, lineHeight: 1.5, color: avisoClicheria.alerta ? PRETO : "#5b595b", marginTop: 2 }}>
                {avisoClicheria.alerta ? <span className="np10-falta">{avisoClicheria.texto}</span> : avisoClicheria.texto}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setEnviarClicheria(null)} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Voltar</button>
              <button disabled={!espessura} onClick={() => rodar(
                () => acoes.mudarStatus("cliche", `${enviarClicheria === "reenviar" ? "Reenviado para a clicheria" : OBS_PADRAO.cliche}, clichê ${espessura}`, etapaVista.current, espessura),
                () => setEnviarClicheria(null),
              )} className="p10-flat"
                style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 28px", opacity: espessura ? 1 : 0.4, cursor: espessura ? "pointer" : "default" }}>{enviarClicheria === "reenviar" ? "Reenviar" : "Enviar p/ clicheria"}</button>
            </div>
          </div>
        </div>
      )}

      {cancelar && (
        <div style={VEU}>
          {/* diálogo com nome, como as outras confirmações: o leitor de tela
              não anunciava a caixa (simulação 6, 07/10/2026) */}
          <div role="dialog" aria-modal="true" aria-label="Cancelar este pedido?" style={{ ...CARTAO_MODAL, width: 480, padding: "40px 44px", gap: 14 }}>
            <div style={{ ...FR, fontSize: 34, letterSpacing: "-.02em" }}>Cancelar este pedido?</div>
            <div style={{ fontSize: 17, lineHeight: 1.5, color: CINZA }}>Use apenas quando o cliente desistir. O pedido sai do fluxo de produção; um administrador pode reativá-lo depois.</div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
              <button onClick={() => setCancelar(false)} className="p10-flat" style={{ ...BOTAO_VAZADO, height: 50, fontSize: 18 }}>Voltar</button>
              <button onClick={() => rodar(() => acoes.mudarStatus("cancelado", OBS_PADRAO.cancelado, etapaVista.current), () => { setCancelar(false); aoFechar(); })} className="p10-flat"
                style={{ ...BOTAO_ESCURO, height: 50, fontSize: 18, padding: "0 28px", background: VERMELHO, color: PALETA.perigoTinta }}>Sim, cancelar pedido</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
