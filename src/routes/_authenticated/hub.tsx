// Hub v1a — rota autenticada com TODAS as telas do handoff usando dados reais.
// Navegação por ?tela= (o rail mapeia os labels); as modais são hospedadas
// aqui e passadas às telas via children (padrão validado no /preview-v3).
// Ações reais já ligadas: criar pedido (NovaArte → createPedido) e registro
// de chegada de clichê (Aprovação → registrarCliche). O restante (mensagens,
// anotações, notificações) segue demo até o back-end correspondente.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";

import { AfiacaoV1a } from "@/components/v1a/AfiacaoV1a";
import { BASE_COD, PDF_DE } from "@/components/v1a/dados/facas-cilindro";
import { ApontamentosV1a } from "@/components/v1a/ApontamentosV1a";
import { AprovacaoV1a } from "@/components/v1a/AprovacaoV1a";
import type { TipoCadastro } from "@/components/v1a/dados/cadastros";
import { ArquivosV1a } from "@/components/v1a/ArquivosV1a";
import { CALC_PERM, PERM_GABARITO, CalculadorasV1a } from "@/components/v1a/CalculadorasV1a";
import { CalculadorasHub10 } from "@/components/hub10/CalculadorasHub10";
import { PantonesHub10 } from "@/components/hub10/PantonesHub10";
import { ArquivosHub10 } from "@/components/hub10/ArquivosHub10";
import { CentralV1a } from "@/components/v1a/CentralV1a";
import { ClientesV1a } from "@/components/v1a/ClientesV1a";
import { EquipeV1a, type Cargo as CargoEquipe, type Usuario as UsuarioEquipe } from "@/components/v1a/EquipeV1a";
import { EstoqueV1a } from "@/components/v1a/EstoqueV1a";
import { FacasV1a } from "@/components/v1a/FacasV1a";
import { HubDadosV1aProvider, type HubDadosV1a } from "@/components/v1a/HubDadosV1a";
import { AvisoV1a, NOVO_PEDIDO_V1A } from "@/components/v1a/HubV1a";
import { FerramentaisHub10 } from "@/components/hub10/FerramentaisHub10";
import { EquipeHub10 } from "@/components/hub10/EquipeHub10";
import { RelatoriosHub10 } from "@/components/hub10/RelatoriosHub10";
import { ClientesHub10 } from "@/components/hub10/ClientesHub10";
import { HomeHub10 } from "@/components/hub10/HomeHub10";
import { CarregandoHub10 } from "@/components/hub10/ChromeHub10";
import { ApresentacaoHub10, ProvedorApresentacao } from "@/components/hub10/ApresentacaoHub10";
import { NovoPedidoHub10, type DadosNovoPedido } from "@/components/hub10/NovoPedidoHub10";
import { PedidoHub10, rotuloDoStatus } from "@/components/hub10/PedidoHub10";
import { enviarSugestao } from "@/lib/api/sugestoes.functions";
import { LeituraV1a } from "@/components/v1a/LeituraV1a";
import { MuralV1a } from "@/components/v1a/MuralV1a";
import { PainelV1a } from "@/components/v1a/PainelV1a";
import { PantoneV1a } from "@/components/v1a/PantoneV1a";
import { PedidosV1a } from "@/components/v1a/PedidosV1a";
import { ListaModalV1a } from "@/components/v1a/modais/ListaModalV1a";
import { PedidoModalV1a, type PedidoModal } from "@/components/v1a/modais/PedidoModalV1a";
import type { RegistroCliche } from "@/components/v1a/modais/ClicheChegouModalV1a";
import { deleteAnexo, downloadAnexo, uploadAnexo } from "@/lib/api/anexos.functions";
import { logout } from "@/lib/api/auth.functions";
import { separarCores } from "@/lib/cores";
import { criarSolicitacaoCliche, getApontamentos, listMotivosCliche } from "@/lib/api/cliches.functions";
import {
  getHomeConfig, getMeuPapel, getMeuRascunhoPedido, getMeusAtalhos, getMinhaApresentacao, getMinhasPrefs, listPapeis, setMeuPapel, setMeuRascunhoPedido, setMeusAtalhos,
  setMinhaApresentacao, setMinhasPrefs, uploadPapel,
} from "@/lib/api/config.functions";
import type { RascunhoPedidoDados } from "@/lib/api/config.functions";
import {
  addSubstrato, enviarFacaAfiacao, solicitarFacaNova, getMiniaturaFaca, getPdfFaca, listFacas, listPdfsFacas, listRelacaoFacas, marcarNovaPedida, salvarFacaExtra,
  listSubstratos, receberFaca, salvarMiniaturaFaca,
} from "@/lib/api/facas.functions";
import { pdfPrimeiraPagina } from "@/lib/pdf-preview";
import { erroLegivel } from "@/lib/erro-legivel";
import {
  alternarNota, criarNota, excluirNota, limparNotasConcluidas, listNotas,
} from "@/lib/api/notas.functions";
import { addCadastro, listCadastros } from "@/lib/api/cadastros.functions";
import {
  enviarChatDireto, enviarChatGeral, listChatDireto, listChatGeral, listColegas,
} from "@/lib/api/chat.functions";
import { listLeituras, marcarLeituraUsadaFn, registrarLeituraOp } from "@/lib/api/leituras.functions";
import { listNotifications, markNotificationsRead } from "@/lib/api/notifications.functions";
import {
  aguardarCliente, changeStatus, clienteRespondeu, comentarPedido, confirmarPastaCliente, createPedido, deletePedido, getPedido, listConversas, listPedidos,
  baixarNotaCliche, definirFilaPedido, enfileirarPedido, limparFilaPedidos, listCarteira, listDonosPedidos,
  marcarPedidoVisto,
  perguntarNoPedido, registrarCliche, registrarProvaImpressao, resolverRevisao, responderCliente,
  responderPergunta, solicitarCliche, transferirCarteira, updatePedido, voltarParaClicheria, cadastrarRefazerCliche,
} from "@/lib/api/pedidos.functions";
import { TransferirCarteiraModalV1a, type Dono } from "@/components/v1a/modais/TransferirCarteiraModalV1a";
import { TransferirCarteiraHub10 } from "@/components/hub10/TransferirCarteiraHub10";
import { notificarNativo, piscarTitulo, tocarBip } from "@/lib/aviso-novidade";
import { prazoDoPedido } from "@/lib/prazo";
import { abrirBlob, base64ToBlob, fileToBase64, salvarBlob } from "@/lib/files";
import {
  aplicarTemplateCargo, createRole, createUsuario, excluirUsuario, forcarLogout, listAuditoria,
  listPermissoesEquipe, listRoles, listUsuarios, resetSenha, setUsuarioPermissao, updateRole,
  updateUsuario, deleteRole,
} from "@/lib/api/usuarios.functions";
import { ROLE_LABELS, clearStoredSession, getStoredSession, hasPerm, type SessionUser } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/hub")({
  /* Sem SSR, de propósito. Quem está logado é lido do localStorage, que só
     existe no navegador: o servidor renderizava "Carregando…" e o cliente o
     hub inteiro, então o React descartava o HTML do servidor e remontava tudo
     — com um erro de hidratação no console a cada carregamento. O trabalho do
     servidor aqui nunca serviu para nada; agora ele não é feito. */
  ssr: false,
  head: () => ({ meta: [{ title: "R2 Hub" }] }),
  // `pedido` abre a modal direto — é para onde /pedido/<id> redireciona.
  validateSearch: (s: Record<string, unknown>): { tela: string; pedido?: string } => ({
    tela: typeof s.tela === "string" ? s.tela : "home",
    ...(typeof s.pedido === "string" && s.pedido ? { pedido: s.pedido } : {}),
  }),
  component: HubPage,
});

/**
 * Permissão que abre cada página do rail. Sem entrada aqui = página aberta a
 * quem está logado (catálogos e consultas). O rail some com o que a pessoa não
 * pode abrir, e a rota barra quem tentar pela URL.
 */
/** "14:32 · hoje" ou "14:32 · 04/08" — o rótulo que a fila de leituras mostra. */
function quandoLeitura(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const hoje = new Date();
  const mesmoDia = d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();
  return mesmoDia ? `${hm} · hoje` : `${hm} · ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const PERM_DA_PAGINA: Record<string, string> = {
  "Aprovação": "tab.cliches",
  "Fábrica": "tab.painel",
  "OP": "tab.op",
  "Apontamentos": "apontamentos.ver",
  "Afiação": "tab.afiacao",
  "Arquivos": "tab.arquivos",
  "Clientes": "tab.clientes",
  "Equipe": "usuarios.gerenciar",
};

/** Label do rail v1a → valor de ?tela=. */
const LABEL_PARA_TELA: Record<string, string> = {
  /* "Aprovação" abre a tela 1.0, como "Pedidos". A V1a continua acessível em
     ?tela=aprovacao enquanto o ciclo de clichê dela não for portado.
     "Facas" virou Ferramentais (1.0); a tela antiga, com desenhos, comparação
     e marcar morta, segue em ?tela=facas até o 1.0 cobrir isso. */
  "Home": "home", "Central": "central", "Pedidos": "pedidos10", "Aprovação": "aprovacao10",
  "Fábrica": "fabrica", "OP": "op", "Apontamentos": "relatorios10", "Facas": "ferramentais10",
  "Afiação": "afiacao", "Estoque": "estoque", "Mural": "mural", "Pantone": "pantone10",
  /* "Calculadoras" abre os cards 1.0; a tela antiga, com as contas em si,
     segue em ?tela=calculadoras até cada card ganhar o seu dentro. */
  "Calculadoras": "calculadoras10", "Arquivos": "arquivos10", "Clientes": "clientes10", "Equipe": "equipe10",
};

/* ————— Adaptadores app → modais v1a (mesmos do preview) ————— */
const DIA = 86_400_000;
const ST_LABEL: Record<string, string> = {
  nova: "Aguardando Design", criacao: "Aguardando Design",
  /* dois status, dois donos: `aguardando` espera a vendedora, `revisao` espera
     o design. Enquanto os dois se chamavam "Revisão" não dava para saber. */
  aguardando: "Aguardando aprovação", revisao: "Alteração pedida",
  aprovada: "Design aprovado", cliche: "Clichê solicitado", concluido: "Finalizado", cancelado: "Finalizado",
};

const fmt2 = (n: number) => String(n).padStart(2, "0");
/** AAAA-MM-DD local, deslocado em `dias` (negativo = passado). */
const diaISO = (dias: number) => {
  const d = new Date(Date.now() + dias * DIA);
  return `${d.getFullYear()}-${fmt2(d.getMonth() + 1)}-${fmt2(d.getDate())}`;
};
const ddmm = (s?: string) => { const d = s ? new Date(s) : new Date(); return `${fmt2(d.getDate())}/${fmt2(d.getMonth() + 1)}`; };
/* Dois dígitos, como Pedidos e Central já mostram na lista. Aqui era
   `padStart(4)`: o cabeçalho da modal dizia "#0035" e a linha da tabela
   "#35" — o mesmo pedido com dois nomes, e quem lia o número na modal não
   achava na busca. */
const numDe = (p: any) => `#${String(p.numero).padStart(2, "0")}`;

function paraModal(p: any, responsavel?: string): PedidoModal {
  const prazoDate = prazoDoPedido(p);
  const diff = Math.round((prazoDate.getTime() - Date.now()) / DIA);
  const cores = p.cores ? (String(p.cores).match(/^\d+$/) ? `${p.cores} cores` : String(p.cores)) : "—";
  const spec = p.tipo === "cliche"
    ? `CÓD ${p.codigo_produto ?? "—"} · Reposição · ${cores}`
    : `${p.largura}×${p.altura} · ${p.materia ?? "—"} · ${cores}`;
  return {
    num: numDe(p),
    cliente: p.cliente,
    spec,
    status: ST_LABEL[p.status] ?? "Aguardando Design",
    prazo: ddmm(p.prazo ?? prazoDate.toISOString()),
    dias: Math.abs(diff),
    atraso: diff < 0,
    origem: p.origem ?? (p.tipo === "cliche" ? "interno" : "vendas"),
    responsavel,
    // a arte volta para QUEM PEDIU — não se escolhe destinatário
    solicitante: (p.vendedor_nome as string) || undefined,
  };
}

function itensDe(pedidos: any[], tipo: "abertos" | "finalizados") {
  const fim = (p: any) => ["concluido", "cancelado"].includes(p.status);
  return pedidos.filter((p) => (tipo === "abertos" ? !fim(p) : fim(p))).map((p) => ({
    num: numDe(p),
    cliente: p.cliente as string,
    medida: p.tipo === "cliche" ? `CÓD ${p.codigo_produto ?? "—"}` : `${p.largura}×${p.altura}`,
    sub: p.tipo === "cliche" ? "Clichê" : (p.materia ?? "—"),
    prazo: ddmm(p.prazo),
    apro: p.status === "cancelado" ? "—" : ddmm(p.updated_at ?? p.created_at),
    status: ST_LABEL[p.status] ?? "Aguardando Design",
  }));
}

function HubPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tela, pedido: pedidoDaUrl } = Route.useSearch();
  const [profile] = useState<SessionUser | null>(() => getStoredSession()?.user ?? null);

  /* Celular cai direto na página móvel (o palco 1920 escalado é ilegível no
     telefone). Vale para QUALQUER usuário com acesso ao painel — a página
     móvel tem o link "hub completo" que grava a exceção e volta para cá. */
  const ehCelular = typeof window !== "undefined"
    && window.innerWidth < 700
    && window.matchMedia?.("(pointer: coarse)").matches
    && sessionStorage.getItem("r2.hub-completo") !== "1";
  const paraMovel = ehCelular && !!profile && (hasPerm(profile, "tab.op") || hasPerm(profile, "tab.painel"));
  useEffect(() => {
    if (paraMovel) navigate({ to: "/m/leitura", replace: true });
  }, [paraMovel, navigate]);

  /* Entrou com a senha provisória do gestor: nada do hub abre antes de a
     pessoa definir a senha dela. */
  const trocarSenha = !!profile?.precisaTrocarSenha;
  useEffect(() => {
    if (trocarSenha) navigate({ to: "/trocar-senha", replace: true });
  }, [trocarSenha, navigate]);

  // As server fns do TanStack devolvem `unknown` para o cliente — os tipos das
  // linhas do SQLite não sobrevivem à serialização; por isso os `any` aqui.
  /* dataUpdatedAt fica em 0 até a primeira leitura com sucesso e não volta a
     zero se uma releitura falhar: é o "já chegou" que a Pantones precisa para
     não dizer "nenhum aprovado" enquanto a lista carrega. */
  const { data: pedidos = [], dataUpdatedAt: pedidosEm } = useQuery<any[]>({
    queryKey: ["pedidos"],
    queryFn: () => listPedidos() as Promise<any[]>,
    refetchInterval: 5000,
    enabled: !!profile,
  });
  /* Aqui havia um aviso próprio de "pedido novo" e "pedido mudou de etapa",
     feito comparando a lista de 5 em 5 segundos. Saiu (Augusto, 25/09/2026):
     avisava TODO MUNDO de qualquer mudança — inclusive quem acabou de fazê-la
     ("#19 Cafés Serrano → Clichê solicitado" para quem tinha clicado em
     solicitar clichê), e com o nome antigo da etapa. O sino já cobre os dois
     casos, só para quem importa e nunca para o autor: "Pedido atualizado" vai
     à vendedora, ao designer e à gestão do pedido; "Nova solicitação", ao
     design e à gestão — e o recado novo do sino toca o bip e mostra o aviso
     (ver o efeito das notificações, mais abaixo). */

  const { data: cfg } = useQuery<any>({ queryKey: ["home-config"], queryFn: () => getHomeConfig() as Promise<any> });
  /* Papel de parede é de cada usuário — sem escolha, a Home fica lisa. */
  const { data: papel } = useQuery<any>({
    queryKey: ["meu-papel"],
    queryFn: () => getMeuPapel() as Promise<any>,
    enabled: !!profile,
  });
  /* Atalhos do rodapé da Home — também escolha de cada usuário. */
  const { data: meusAtalhos } = useQuery<any>({
    queryKey: ["meus-atalhos"],
    queryFn: () => getMeusAtalhos() as Promise<any>,
    enabled: !!profile,
  });
  /* Preferências do usuário (modal Preferências): avisos, tela inicial, etc. */
  const { data: minhasPrefs } = useQuery<any>({
    queryKey: ["minhas-prefs"],
    queryFn: () => getMinhasPrefs() as Promise<any>,
    enabled: !!profile,
  });
  const prefs: Record<string, boolean | string> | undefined = minhasPrefs?.prefs;
  /* A apresentação do hub: o que a pessoa já viu (o tour do primeiro acesso e
     as novidades). Grava na hora, sem esperar o servidor para seguir: se não
     gravar, a apresentação volta no próximo acesso, que é o lado seguro. */
  const { data: apresentacao } = useQuery<any>({
    queryKey: ["minha-apresentacao"],
    queryFn: () => getMinhaApresentacao() as Promise<any>,
    enabled: !!profile,
    staleTime: Infinity,
  });
  const [pedidoApresentacao, setPedidoApresentacao] = useState(0);
  const verApresentacao = useCallback(() => setPedidoApresentacao((n) => n + 1), []);
  const salvarApresentacao = useCallback((e: { principal: string; novidades: string[] }) => {
    qc.setQueryData(["minha-apresentacao"], e);
    void setMinhaApresentacao({ data: e }).catch(() => { /* volta no próximo acesso */ });
  }, [qc]);

  /* Tela inicial escolhida nas Preferências. As entradas genéricas (o login,
     a raiz "/" e a troca de senha) chegam com ?tela=inicio, que vira a tela
     escolhida (ou a Home, se a pessoa não pode abrir a escolhida); link
     direto, com outra ?tela=, continua mandando. Sem ?tela= nenhuma, vale uma
     vez por sessão, como antes. Até 05/10/2026 as entradas mandavam
     ?tela=home e a escolha nunca valia (simulação 5, os três agentes). */
  const telaInicialAplicada = useRef(false);
  useEffect(() => {
    if (!prefs) return;
    if (tela !== "inicio") {
      if (telaInicialAplicada.current) return;
      const urlTemTela = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tela");
      if (urlTemTela) { telaInicialAplicada.current = true; return; }
    }
    telaInicialAplicada.current = true;
    const escolhida = String(prefs.telaInicial || "");
    const t = escolhida && escolhida !== "Home" ? LABEL_PARA_TELA[escolhida] : undefined;
    const destino = t && paginasLiberadas.some((label) => LABEL_PARA_TELA[label] === t) ? t : "home";
    if (destino !== tela) navigate({ to: "/hub", search: { tela: destino }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, tela]);

  /* Cadastros compartilhados do formulário de solicitação (medidas, matéria-
     prima e cores) — a lista é de todos; criar depende de cadastro.*. */
  const { data: cadastrosRaw } = useQuery<any>({
    queryKey: ["cadastros"],
    queryFn: () => listCadastros() as Promise<any>,
    enabled: !!profile,
  });
  const cadastros = {
    medidas: (cadastrosRaw?.medidas ?? []) as { id: string; nome: string; extra?: string | null }[],
    materiais: (cadastrosRaw?.materiais ?? []) as { id: string; nome: string; extra?: string | null }[],
    cores: (cadastrosRaw?.cores ?? []) as { id: string; nome: string; extra?: string | null }[],
  };
  const permCadastro = {
    medidas: hasPerm(profile, "cadastro.medidas"),
    materiais: hasPerm(profile, "cadastro.materiais"),
    cores: hasPerm(profile, "cadastro.cores"),
  };
  const aoCadastrar = (tipo: TipoCadastro, nome: string, extra?: string | null) =>
    addCadastro({ data: { tipo, nome, extra: extra ?? null } })
      .then(() => qc.invalidateQueries({ queryKey: ["cadastros"] }));

  /* Modais hospedadas pela rota. */
  const [pedidoId, setPedidoId] = useState<string | null>(pedidoDaUrl ?? null);
  const [lista, setLista] = useState<null | "abertos" | "finalizados">(null);
  /* Transferir carteira: a lista de donos só é buscada ao abrir a modal — é
     poder de gestão, não dado de tela, e não vale um pedido a cada visita
     à página de Pedidos. */
  const [transferindo, setTransferindo] = useState(false);
  const [donos, setDonos] = useState<Dono[]>([]);
  const carregarDonos = () =>
    listDonosPedidos()
      .then((r: any[]) => setDonos(r.map((d) => ({
        id: String(d.id), nome: String(d.nome), role: d.role as string,
        ativo: Number(d.ativo), pedidos: Number(d.pedidos), clientes: Number(d.clientes),
      }))))
      .catch((e: unknown) => setAvisoGeral(e instanceof Error ? e.message : "Não deu para ler a equipe."));
  const [avisoGeral, setAvisoGeral] = useState("");
  /* o recado do envio do Novo pedido quando a tela já saiu: fica por cima de
     qualquer tela (o avisoGeral só aparece nas V1a, dentro de `modais`) */
  const [recadoDoEnvio, setRecadoDoEnvio] = useState("");
  /* O carregando entre as telas: aparece quando, logo depois de mudar de
     tela (ou na primeira carga), alguma consulta ainda não tem dado nenhum
     por mais de 300 ms; e fica até o dado chegar. Recarga em segundo plano
     (a lista que já tem dado) e busca digitada não contam. */
  const semDado = useIsFetching({ predicate: (q) => q.state.status === "pending" });
  const [acabouDeMudar, setAcabouDeMudar] = useState(true);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    setAcabouDeMudar(true);
    const t = setTimeout(() => setAcabouDeMudar(false), 6000);
    return () => clearTimeout(t);
  }, [tela]);
  useEffect(() => {
    if (semDado > 0 && (acabouDeMudar || carregando)) {
      if (carregando) return;
      const t = setTimeout(() => setCarregando(true), 300);
      return () => clearTimeout(t);
    }
    if (!carregando) return;
    const t = setTimeout(() => setCarregando(false), 200);
    return () => clearTimeout(t);
  }, [semDado, acabouDeMudar, carregando]);
  /* consulta que trava não prende a tela: some em 15 s de qualquer jeito */
  useEffect(() => {
    if (!carregando) return;
    const t = setTimeout(() => setCarregando(false), 15000);
    return () => clearTimeout(t);
  }, [carregando]);

  /* Detalhe do pedido aberto (histórico + anexos reais). */
  const { data: detalhe } = useQuery<any>({
    queryKey: ["pedido", pedidoId],
    queryFn: () => getPedido({ data: { id: pedidoId! } }) as Promise<any>,
    enabled: !!pedidoId,
  });

  /* Pedido aberto no painel 1.0. É um estado à PARTE do `pedidoId` da ficha
     V1a de propósito: se fossem o mesmo, abrir um card na tela 1.0 abriria
     também a modal antiga, que é hospedada junto dos outros modais. Mesma
     chave de cache, então os dois aproveitam a mesma leitura. */
  const [pedido10Id, setPedido10Id] = useState<string | null>(null);
  const { data: detalhe10 } = useQuery<any>({
    queryKey: ["pedido", pedido10Id],
    queryFn: () => getPedido({ data: { id: pedido10Id! } }) as Promise<any>,
    enabled: !!pedido10Id,
  });
  /* Abrir um pedido no painel 1.0. Abrir também marca as respostas como
     vistas — é isso que apaga o aviso de resposta nova no card. */
  const abrirDetalhe10 = (id: string) => {
    setPedido10Id(id);
    /* "Abrir o último pedido" (Preferências): só a lista antiga guardava o
       pedido aberto, e no 1.0 a opção não fazia nada (revisão de 02/10/2026) */
    try { localStorage.setItem("r2hub.ultimoPedido", id); } catch { /* modo restrito */ }
    void marcarPedidoVisto({ data: { id } }).then(() => qc.invalidateQueries({ queryKey: ["pedidos"] }));
  };
  /* Vir de fora (busca global, notificação, chat) e cair no pedido: leva para
     a tela 1.0, que é o que o menu "Pedidos" abre. */
  const irParaPedido10 = (id: string) => {
    navigate({ to: "/hub", search: { tela: "pedidos10" } });
    abrirDetalhe10(id);
  };
  /* …e quando o pedido vem NA URL. É o caminho de /pedido/<id>, que é para
     onde apontam todas as notificações guardadas no banco. Sem isto a tela
     abria a lista e o pedido do link ficava fechado. Uma vez só: depois de
     abrir, o ?pedido= sai da URL para o voltar do navegador não reabrir. */
  const pedidoDaUrlAplicado = useRef(false);
  useEffect(() => {
    if (pedidoDaUrlAplicado.current || !pedidoDaUrl) return;
    if (tela !== "pedidos10" && tela !== "aprovacao10") return;
    pedidoDaUrlAplicado.current = true;
    abrirDetalhe10(pedidoDaUrl);
    navigate({ to: "/hub", search: { tela }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoDaUrl, tela]);

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  const versao = cfg?.versao ?? "V. 0.01";

  const aoNavegar = (label: string) => {
    const t = LABEL_PARA_TELA[label];
    if (!t) return;
    /* Trocar de aba fecha o pedido aberto. Sem isto ele ficava pendurado no
       estado: quem ia à Home e voltava para Pedidos reencontrava o painel de
       um pedido que não tinha pedido para abrir — e em Aprovações chegava a
       aparecer um pedido que aquela tela nem lista. */
    setPedido10Id(null);
    /* a modal V1a fica hospedada em TODAS as telas, então ela viajava junto */
    setPedidoId(null);
    navigate({ to: "/hub", search: { tela: t } });
  };

  async function doLogout() {
    await qc.cancelQueries();
    qc.clear();
    try { await logout(); } catch { /* sessão pode já ter expirado */ }
    clearStoredSession();
    /* o rascunho do Novo pedido na aba é de quem saiu: quem entrar depois na
       mesma aba não pode vê-lo nem continuá-lo (revisão de 02/10/2026) */
    try { sessionStorage.removeItem("r2-novo-pedido-10"); } catch { /* sem armazenamento */ }
    navigate({ to: "/auth", replace: true });
  }

  const abrirPedido = (id: string) => {
    setPedidoId(id);
    try { localStorage.setItem("r2hub.ultimoPedido", id); } catch { /* modo restrito */ }
  };

  /* Preferência "abrir o último pedido ao entrar": uma vez por sessão, quando
     a lista chega e o pedido ainda existe. */
  const ultimoAplicado = useRef(false);
  useEffect(() => {
    if (ultimoAplicado.current || !prefs || prefs.auto !== true || !pedidos.length) return;
    ultimoAplicado.current = true;
    if (pedidoId || pedido10Id || pedidoDaUrl) return;   // já tem pedido aberto por link
    try {
      const guardado = localStorage.getItem("r2hub.ultimoPedido");
      /* abre no painel do 1.0, em Pedidos (era a ficha antiga, por cima da Home) */
      if (guardado && pedidos.some((x: any) => x.id === guardado)) irParaPedido10(guardado);
    } catch { /* modo restrito */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, pedidos]);
  /* Ao fechar, tira o ?pedido= da URL para o link antigo não reabrir a modal. */
  const fecharPedido = () => {
    setPedidoId(null);
    if (pedidoDaUrl) navigate({ to: "/hub", search: { tela }, replace: true });
  };
  /* O "+" deixou de abrir modal: Novo pedido virou tela na geração 1.0.
     A NovaArteModalV1a continua no repositório porque o tipo do payload vem
     dela, mas não é mais montada em lugar nenhum. */
  const abrirNova = () => navigate({ to: "/hub", search: { tela: "novo-pedido" } });

  /* Dados do pedido aberto: usa o detalhe quando chega (tem designer/vendedor). */
  const pedidoLista = pedidoId ? pedidos.find((x: any) => x.id === pedidoId) : null;
  const pedidoDet: any = detalhe?.pedido ?? pedidoLista;
  const pedidoModal = pedidoDet
    /* SÓ o designer. Caía em `vendedor_nome` quando ninguém tinha assumido, e
       a ficha mostrava a vendedora no campo "Designer" — no #34 a Renata
       aparecia como designer de um pedido que ela mesma abriu. */
    ? paraModal(pedidoDet, (pedidoDet.designer_nome as string) || undefined)
    : null;
  /* `?? []` até o detalhe chegar: sem isso a modal abria mostrando 3 anexos
     FICTÍCIOS batizados com o nome do cliente real, até o getPedido responder
     (para sempre, se falhasse). */
  /* `origem` é a segunda linha da lista de anexos na modal v2 — diz de onde o
     arquivo veio, que é o que a pessoa procura quando há meia dúzia deles. */
  const ORIGEM_ANEXO: Record<string, string> = {
    arte: "arte final do design",
    faca: "desenho da faca",
    referencia: "referência da solicitação",
    logo: "logo do cliente",
    anexo: "anexo da solicitação",
  };
  const arquivosReais = detalhe?.anexos?.map((a: any) => ({
    id: a.id as string,
    nome: a.nome as string,
    peso: a.versao > 1 ? `v${a.versao}` : "",
    origem: ORIGEM_ANEXO[a.tipo as string] ?? (a.tipo as string) ?? "",
  })) ?? [];
  const comentariosReais = detalhe?.comentarios?.map((c: any) => ({
    id: c.id as string,
    user_nome: (c.user_nome as string) ?? "",
    texto: c.texto as string,
    created_at: c.created_at as string,
  })) ?? [];
  const historicoReal = detalhe?.historico?.map((h: any) => ({
    /* o id é a chave da marca "revisão resolvida" — sem ele a marca grudaria
       na posição da lista e mudaria de dono a cada revisão nova */
    id: h.id as string,
    status: h.status as string,
    observacao: (h.observacao as string) ?? null,
    user_nome: (h.user_nome as string) ?? "",
    created_at: h.created_at as string,
  })) ?? [];
  /* quem resolveu e quando vinham do servidor e eram descartados aqui — era o
     que faltava para a vendedora saber que o design já tratou o pedido dela */
  const revisoesResolvidas = detalhe?.revisoesResolvidas?.map((r: any) => ({
    chave: r.chave as string,
    por: (r.user_nome as string) ?? null,
    em: (r.created_at as string) ?? null,
  })) ?? [];
  const perguntasReais = detalhe?.perguntas?.map((q: any) => ({
    id: q.id as string,
    de_nome: (q.de_nome as string) ?? null,
    para_nome: (q.para_nome as string) ?? null,
    texto: q.texto as string,
    created_at: q.created_at as string,
    resposta: (q.resposta as string) ?? null,
    respondida_em: (q.respondida_em as string) ?? null,
    respondida_por_nome: (q.respondida_por_nome as string) ?? null,
  })) ?? [];

  /* ————— Notificações e anotações (topbar de todas as telas) ————— */
  const { data: notifRaw } = useQuery<any>({
    queryKey: ["notificacoes"],
    queryFn: () => listNotifications() as Promise<any>,
    refetchInterval: 20_000,
    enabled: !!profile,
  });

  /* Recado NOVO no sino também avisa fora da aba: bip + título/ícone piscando
     + notificação do Windows. Antes só pedido novo/mudança de etapa avisava —
     anexo, comentário, falta de MP e recados do sistema acendiam a bolinha em
     silêncio, e quem não estava olhando o hub nunca ficava sabendo. */
  const notifAntes = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!notifRaw?.items) return;
    const items: any[] = notifRaw.items;
    const ids = new Set(items.map((n: any) => String(n.id)));
    const antes = notifAntes.current;
    notifAntes.current = ids;
    if (antes === null) return;   // primeira carga da sessão: nada de alarde
    const novas = items.filter((n: any) => !antes.has(String(n.id)) && !n.lida);
    if (!novas.length) return;
    /* um aviso só: o título e o corpo (o cliente, o motivo); só o título
       ("Refazer clichê") não dizia de qual pedido (simulação 4) */
    const aviso = novas.length > 1
      ? `${novas.length} avisos novos no sino`
      : [String(novas[0].titulo || "Aviso novo no sino"), novas[0].corpo ? String(novas[0].corpo) : ""].filter(Boolean).join(": ");
    tocarBip();
    piscarTitulo(aviso);
    notificarNativo(aviso);
    /* o balão por cima da tela (sonner, herdado do hub antigo) saiu em
       05/10/2026 a pedido do Augusto: quem está olhando vê o número no sino */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifRaw]);
  const { data: notasRaw } = useQuery<any[]>({
    queryKey: ["notas"],
    queryFn: () => listNotas() as Promise<any[]>,
    enabled: !!profile,
  });

  const recarregarNotif = () => qc.invalidateQueries({ queryKey: ["notificacoes"] });
  const recarregarNotas = () => qc.invalidateQueries({ queryKey: ["notas"] });

  /* Canal geral do chat — conversa da equipe sem pedido no meio. 15s porque
     é conversa: 20s já parece travado do outro lado. */
  const { data: chatGeralRaw } = useQuery<any[]>({
    queryKey: ["chat-geral"],
    queryFn: () => listChatGeral() as Promise<any[]>,
    refetchInterval: 15_000,
    enabled: !!profile,
  });

  /* Conversas diretas (pessoa ↔ pessoa) e a lista de colegas para começar uma. */
  const { data: chatDiretoRaw } = useQuery<any[]>({
    queryKey: ["chat-direto"],
    queryFn: () => listChatDireto() as Promise<any[]>,
    refetchInterval: 15_000,
    enabled: !!profile,
  });
  const { data: colegasRaw } = useQuery<any[]>({
    queryKey: ["colegas"],
    queryFn: () => listColegas() as Promise<any[]>,
    staleTime: 5 * 60_000,
    enabled: !!profile,
  });

  const { data: conversasRaw } = useQuery<any[]>({
    queryKey: ["conversas"],
    queryFn: () => listConversas() as Promise<any[]>,
    refetchInterval: 20_000,
    enabled: !!profile,
  });

  /* Páginas que esta pessoa pode abrir — o rail apaga o resto e a rota barra
     quem chegar pela URL. Calculadoras só aparece com alguma calc.* liberada.
     (fica aqui em cima porque a busca do topo também usa esta lista) */
  const paginasLiberadas = Object.keys(LABEL_PARA_TELA).filter((label) => {
    if (label === "Calculadoras") return Object.values(CALC_PERM).some((p) => hasPerm(profile, p));
    const perm = PERM_DA_PAGINA[label];
    return !perm || hasPerm(profile, perm);
  });

  const hubDados: HubDadosV1a = {
    meuId: profile.id,
    meuPapel: profile.role,
    paginasDisponiveis: paginasLiberadas,
    aoNavegar,
    /* busca do topo: vale para o hub inteiro, esteja a pessoa em que tela
       estiver (facas e Pantone o próprio painel carrega sob demanda) */
    buscaPedidos: Array.isArray(pedidos)
      ? pedidos.map((p: any) => ({
        id: String(p.id),
        numero: Number(p.numero),
        cliente: String(p.cliente ?? ""),
        /* Os nomes do 1.0, e a medida e o substrato de verdade: a lista não
           tem "medida" nem "substrato" (são largura×altura e matéria), e a
           busca por "41x16" não achava pedido nenhum (simulação de
           28/09/2026). */
        status: rotuloDoStatus(String(p.status ?? "")),
        medida: p.largura && p.altura ? `${p.largura}×${p.altura}` : undefined,
        substrato: p.materia ? String(p.materia) : undefined,
        tipo: p.tipo ? String(p.tipo) : undefined,
      }))
      : undefined,
    chatGeral: chatGeralRaw?.map((m: any) => ({
      id: String(m.id),
      user_id: (m.user_id as string) ?? null,
      user_nome: (m.user_nome as string) ?? null,
      texto: String(m.texto),
      created_at: String(m.created_at),
    })),
    aoEnviarChat: (texto: string) =>
      enviarChatGeral({ data: { texto } }).then(() => qc.invalidateQueries({ queryKey: ["chat-geral"] })),
    colegas: colegasRaw?.map((c: any) => ({ id: String(c.id), nome: String(c.nome), role: c.role ? String(c.role) : undefined })),
    chatDireto: chatDiretoRaw?.map((m: any) => ({
      id: String(m.id),
      user_id: (m.user_id as string) ?? null,
      user_nome: (m.user_nome as string) ?? null,
      para_id: (m.para_id as string) ?? null,
      para_nome: (m.para_nome as string) ?? null,
      texto: String(m.texto),
      created_at: String(m.created_at),
    })),
    aoEnviarDireto: (paraId: string, texto: string) =>
      enviarChatDireto({ data: { paraId, texto } }).then(() => qc.invalidateQueries({ queryKey: ["chat-direto"] })),
    /* `?? []` de propósito, aqui e nos demais: enquanto a consulta não
       responde (ou se falhar), os modais caíam no modo protótipo e mostravam
       conversas/notificações/anotações FICTÍCIAS como se fossem reais.
       Lista vazia é a verdade do momento; o conteúdo chega no refetch. */
    conversas: conversasRaw?.map((c: any) => ({
      id: c.id as string,
      numero: Number(c.numero),
      cliente: c.cliente as string,
      status: c.status as string,
      mensagens: (c.mensagens as any[]).map((m) => ({
        id: m.id as string,
        user_id: (m.user_id as string) ?? null,
        user_nome: (m.user_nome as string) ?? "",
        texto: m.texto as string,
        created_at: m.created_at as string,
      })),
    })) ?? [],
    aoEnviarMensagem: (pid, texto) =>
      comentarPedido({ data: { pedidoId: pid, texto } }).then(() => {
        qc.invalidateQueries({ queryKey: ["conversas"] });
        qc.invalidateQueries({ queryKey: ["pedido", pid] });
      }),
    aoAbrirPedido: (pid) => irParaPedido10(pid),
    notificacoes: notifRaw?.items?.map((n: any) => ({
      id: n.id as string,
      titulo: n.titulo as string,
      corpo: (n.corpo as string) ?? null,
      url: (n.url as string) ?? null,
      lida: !!n.lida,
      created_at: n.created_at as string,
    })) ?? [],
    aoMarcarNotificacoes: (ids) =>
      markNotificationsRead({ data: ids?.length ? { ids } : { todas: true } }).then(recarregarNotif),
    aoAbrirNotificacao: (url) => {
      const pedidoDoLink = url.match(/^\/pedido\/([^/?#]+)/);
      if (pedidoDoLink) {
        const alvo = pedidoDoLink[1];
        if (!pedidos.some((x: any) => x.id === alvo)) { setAvisoGeral("Esse pedido não está mais no sistema."); return; }
        /* Antes isto chamava a modal V1a: quem clicasse numa notificação
           estando na Home 1.0 caía na tela antiga sem ter pedido por ela. */
        irParaPedido10(alvo);
        return;
      }
      if (url.startsWith("/hub")) {
        const alvo = new URLSearchParams(url.split("?")[1] ?? "").get("tela");
        if (alvo) navigate({ to: "/hub", search: { tela: alvo } });
      }
      // notificações antigas apontam para /app, que não existe mais — ficam paradas
    },
    notas: notasRaw?.map((n: any) => ({
      id: n.id as string,
      texto: n.texto as string,
      quando: (n.quando as string) ?? null,
      feito: !!n.feito,
      /* a Home 1.0 põe a nota no calendário: nota antiga só tem "dd/mm", e o
         ano vem daqui */
      created_at: (n.created_at as string) ?? undefined,
    })) ?? [],
    papelParede: papel?.src || "",
    papelNome: papel?.nome || "",
    // pelo NOME do arquivo: o src publicado leva "?v=..." no fim e a extensão não casaria
    papelTipo: /\.(mp4|webm|m4v|mov|ogv)$/i.test(String(papel?.nome ?? "")) ? "video" : "imagem",
    // papel de parede é preferência pessoal: todo mundo escolhe a sua
    podeTrocarPapel: true,
    aoListarPapeis: () => listPapeis().then((r: any) => r.videos as any[]),
    /* cadastro restrito ao próprio setor: quem tem a Equipe completa usa a
       página Equipe, então o card das Preferências fica só para os demais */
    ...(hasPerm(profile, "usuarios.criar_departamento") && !hasPerm(profile, "usuarios.gerenciar")
      ? {
        aoCriarColega: (d: { nome: string; username: string; senha: string }) =>
          createUsuario({ data: { nome: d.nome, username: d.username, senha: d.senha, role: profile.role } }),
        meuCargoLabel: ROLE_LABELS[profile.role] ?? profile.role,
      }
      : {}),
    aoEnviarPapel: (nome: string, dataBase64: string) =>
      uploadPapel({ data: { nome, dataBase64 } }).then((r: any) => ({ nome: r.nome, tamanhoMB: r.tamanhoMB, tipo: r.tipo })),
    aoTrocarPapel: (nome) =>
      setMeuPapel({ data: { nome } }).then(() => qc.invalidateQueries({ queryKey: ["meu-papel"] })),
    atalhos: (meusAtalhos?.atalhos as string[]) ?? [],
    aoSalvarAtalhos: (atalhos) =>
      setMeusAtalhos({ data: { atalhos } }).then(() => qc.invalidateQueries({ queryKey: ["meus-atalhos"] })),
    prefs,
    aoSalvarPrefs: (p) =>
      setMinhasPrefs({ data: { prefs: p } }).then(() => qc.invalidateQueries({ queryKey: ["minhas-prefs"] })),
    aoCriarNota: (texto, quando) => criarNota({ data: { texto, quando: quando ?? null } }).then(recarregarNotas),
    aoAlternarNota: (id, feito) => alternarNota({ data: { id, feito } }).then(recarregarNotas),
    aoExcluirNota: (id) => excluirNota({ data: { id } }).then(recarregarNotas),
    aoLimparNotas: () => limparNotasConcluidas().then(recarregarNotas),
  };

  /* ————— Apontamentos: consolidado do período escolhido na tela ————— */
  const [periodo, setPeriodo] = useState(() => ({ de: diaISO(-30), ate: diaISO(0) }));
  const definirPeriodo = (de: string, ate: string) =>
    setPeriodo((p) => (p.de === de && p.ate === ate ? p : { de, ate }));

  const { data: apontRaw } = useQuery<any>({
    queryKey: ["apontamentos", periodo.de, periodo.ate],
    queryFn: () => getApontamentos({ data: periodo }) as Promise<any>,
    enabled: (tela === "apontamentos" || tela === "relatorios10") && hasPerm(profile, "apontamentos.ver"),
  });

  /* ————— Fila de leituras de OP: Fábrica e Leitura compartilham ————— */
  const { data: leiturasRaw } = useQuery<any[]>({
    queryKey: ["leituras"],
    queryFn: () => listLeituras() as Promise<any[]>,
    refetchInterval: 10_000,
    /* tab.op OU tab.painel — o servidor aceita as duas; exigir só tab.painel
       deixava quem tem apenas tab.op vendo a fila DEMO do localStorage
       enquanto os envios iam para o banco (a tela nunca refletia o envio). */
    enabled: !!profile && (hasPerm(profile, "tab.painel") || hasPerm(profile, "tab.op")) && ["fabrica", "op", "leitura"].includes(tela),
  });
  const leiturasV1a = Array.isArray(leiturasRaw)
    ? leiturasRaw.map((l: any) => ({
        id: String(l.id), op: String(l.op ?? ""), cliente: String(l.cliente ?? ""),
        descricao: String(l.descricao ?? ""), medida: String(l.medida ?? ""),
        substrato: String(l.substrato ?? ""), metragem: String(l.metragem ?? ""),
        carreiras: String(l.carreiras ?? ""), nucleo: String(l.nucleo ?? ""),
        rolos: String(l.rolos ?? ""), entrega: String(l.entrega ?? ""),
        quando: quandoLeitura(String(l.created_at ?? "")),
        usada: !!l.usada,
      }))
    : undefined;

  /* ————— Afiação: facas e substratos reais (só quando a tela está aberta) ————— */
  const podeAfiacao = hasPerm(profile, "tab.afiacao");
  const naAfiacao = tela === "afiacao";

  const { data: facasRaw } = useQuery<any[]>({
    queryKey: ["facas"],
    queryFn: () => listFacas() as Promise<any[]>,
    refetchInterval: 30_000,
    enabled: naAfiacao && podeAfiacao,
  });
  const { data: substratosRaw } = useQuery<any[]>({
    queryKey: ["faca-substratos"],
    queryFn: () => listSubstratos() as Promise<any[]>,
    enabled: naAfiacao && podeAfiacao,
  });

  /* Catálogo de desenhos (share) — a lista é leve, o PDF vem sob demanda.
     `mortas` são os que estão na subpasta Mortas: faca aposentada, não
     desenho novo esperando cadastro. */
  const { data: pdfsFacas } = useQuery<{ todos: string[]; mortas: string[] }>({
    queryKey: ["facas-pdfs"],
    queryFn: () => listPdfsFacas() as Promise<{ todos: string[]; mortas: string[] }>,
    staleTime: 10 * 60_000,
    enabled: tela === "facas",
  });
  /* Catálogo vivo: as páginas da Relação de Ferramentais que a equipe mantém. */
  const { data: relacaoFacas } = useQuery<any>({
    queryKey: ["facas-relacao"],
    queryFn: () => listRelacaoFacas() as Promise<any>,
    staleTime: 10 * 60_000,
    enabled: tela === "facas",
  });

  const carregarPdfFaca = async (arquivo: string) => {
    const r = await getPdfFaca({ data: { arquivo } });
    return URL.createObjectURL(base64ToBlob(r.dataBase64, "application/pdf"));
  };

  /* Miniatura do cartão: usa a que já está guardada no acervo (~20 KB). Só na
     primeira vez baixa o PDF, desenha no navegador e devolve o PNG ao servidor —
     dali em diante ninguém mais paga o download do desenho inteiro. */
  const miniaturaFaca = async (arquivo: string) => {
    const guardada = await getMiniaturaFaca({ data: { arquivo } });
    if (guardada.dataBase64) return `data:image/png;base64,${guardada.dataBase64}`;

    const url = await carregarPdfFaca(arquivo);
    try {
      const png = await pdfPrimeiraPagina(url, 320, arquivo);
      const corpo = png.split(",")[1];
      if (corpo) void salvarMiniaturaFaca({ data: { arquivo, dataBase64: corpo } }).catch(() => { /* acervo só-leitura */ });
      return png;
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const recarregarFacas = () => {
    qc.invalidateQueries({ queryKey: ["facas"] });
    qc.invalidateQueries({ queryKey: ["faca-substratos"] });
  };

  /* ————— Equipe: usuários, cargos, permissões e auditoria reais ————— */
  const podeGerirEquipe = hasPerm(profile, "usuarios.gerenciar");
  const podeGerirPerms = hasPerm(profile, "permissoes.gerenciar");
  const naEquipe = tela === "equipe" || tela === "equipe10";

  const { data: usuariosRaw } = useQuery<any[]>({
    queryKey: ["equipe-usuarios"],
    queryFn: () => listUsuarios() as Promise<any[]>,
    enabled: naEquipe && podeGerirEquipe,
  });
  const { data: rolesRaw } = useQuery<any>({
    queryKey: ["equipe-roles"],
    queryFn: () => listRoles() as Promise<any>,
    enabled: naEquipe && podeGerirEquipe,
  });
  const { data: permsRaw } = useQuery<any>({
    queryKey: ["equipe-permissoes"],
    queryFn: () => listPermissoesEquipe() as Promise<any>,
    enabled: naEquipe && podeGerirPerms,
  });
  const { data: auditoriaRaw } = useQuery<any[]>({
    queryKey: ["equipe-auditoria"],
    queryFn: () => listAuditoria() as Promise<any[]>,
    enabled: naEquipe && hasPerm(profile, "auditoria.ver"),
  });

  const recarregarEquipe = () => {
    qc.invalidateQueries({ queryKey: ["equipe-usuarios"] });
    qc.invalidateQueries({ queryKey: ["equipe-roles"] });
    qc.invalidateQueries({ queryKey: ["equipe-permissoes"] });
    qc.invalidateQueries({ queryKey: ["equipe-auditoria"] });
  };

  /* `?? []` nos três: sem isso, enquanto as consultas da Equipe carregavam
     (ou para SEMPRE, no caso da auditoria sem a permissão auditoria.ver), a
     tela mostrava 7 funcionários, 6 cargos e 12 logs FICTÍCIOS do protótipo
     como se fossem o cadastro real da empresa. */
  const cargosEquipe: CargoEquipe[] = rolesRaw?.roles?.map((r: any) => ({
    nome: r.nome as string,
    label: r.label as string,
    sistema: !!r.sistema,
    perms: (rolesRaw.permissoes as any[]).filter((p) => p.role === r.nome).map((p) => p.permission as string),
  })) ?? [];

  const usuariosEquipe: UsuarioEquipe[] = usuariosRaw?.map((u: any) => {
    const proprias = (permsRaw?.concedidas as any[] | undefined)?.filter((c) => c.user_id === u.id).map((c) => c.permission as string);
    const doCargo = cargosEquipe.find((c) => c.nome === u.role)?.perms ?? [];
    return {
      id: u.id as string,
      nome: u.nome as string,
      username: u.username as string,
      cargo: u.role as string,
      ativo: !!u.ativo,
      sessoes: Number(u.sessoes_ativas ?? 0),
      eu: u.id === profile.id,
      perms: proprias ?? doCargo,
    };
  }) ?? [];

  const logsEquipe = auditoriaRaw?.map((l: any) => {
    const acao = String(l.acao ?? "");
    const [area] = acao.split(".");
    const GRUPO: Record<string, string> = {
      pedido: "Pedidos", usuario: "Administração", role: "Administração", permissao: "Administração",
      anexo: "Arquivos", cliche: "Clichês", faca: "Facas", config: "Administração", auth: "Sessões",
    };
    const d = new Date(l.created_at as string);
    return {
      quem: (l.user_nome as string) || "Sistema",
      grupo: GRUPO[area] ?? "Sistema",
      acao,
      detalhe: typeof l.detalhe === "string" ? l.detalhe.replace(/[{}"]/g, "").slice(0, 90) : "",
      quando: Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }),
    };
  }) ?? [];

  const recarregarPedido = () => {
    qc.invalidateQueries({ queryKey: ["pedidos"] });
    qc.invalidateQueries({ queryKey: ["pedido", pedidoId] });
  };

  /* Ações reais da modal de pedido. */
  const aoStatus = (status: string, observacao: string | null, coresDesc?: string) =>
    changeStatus({ data: { id: pedidoId!, status, observacao, coresDesc: coresDesc ?? null } }).then(recarregarPedido);

  /* Sobe anexos um a um SEM parar no primeiro erro e devolve a lista do que
     ficou de fora. Serve à modal do pedido E ao formulário de pedido novo. */
  const MAX_ANEXO_MB = 35; // o servidor recusa acima disso (limite do base64)
  /* `registrar` false: o arquivo já é contado por outra linha do Histórico
     (o "Pedido criado", ou a "Arte vN enviada"), e não precisa de uma sua. */
  const subirAnexos = async (pid: string, arquivos: File[], tipo: "anexo" | "arte" = "anexo", registrar = true) => {
    const falhas: string[] = [];
    for (const f of arquivos) {
      /* arquivo de 0 byte: o servidor recusava com o JSON do validador na tela */
      if (f.size === 0) {
        falhas.push(`${f.name} está vazio`);
        continue;
      }
      if (f.size > MAX_ANEXO_MB * 1024 * 1024) {
        falhas.push(`${f.name} tem ${(f.size / 1048576).toFixed(1).replace(".", ",")} MB (o limite é ${MAX_ANEXO_MB} MB)`);
        continue;
      }
      try {
        const dataBase64 = await fileToBase64(f);
        await uploadAnexo({ data: { pedidoId: pid, tipo, nome: f.name, dataBase64, registrar } });
      } catch (e) {
        falhas.push(`${f.name} não foi (${erroLegivel(e, "erro ao enviar")})`);
      }
    }
    return falhas;
  };

  /* O que subiu aparece na lista mesmo que outro falhe, e o aviso diz
     exatamente qual ficou de fora (a modal limpa a seleção, então repetir
     não duplica os que já foram). */
  const aoAnexar = async (escolhidos: FileList | File[], tipo?: "anexo" | "arte") => {
    const lista = Array.from(escolhidos);
    const falhas = await subirAnexos(pedidoId!, lista, tipo ?? "anexo");
    recarregarPedido();
    if (falhas.length) {
      const enviados = lista.length - falhas.length;
      throw new Error((enviados > 0 ? `${enviados} de ${lista.length} anexados. ` : "") + falhas.join(" · "));
    }
  };

  const aoExcluirArquivo = (anexoId: string) =>
    deleteAnexo({ data: { anexoId } }).then(recarregarPedido);

  const aoBaixarArquivo = async (anexoId: string, nome: string) => {
    const r = await downloadAnexo({ data: { anexoId } });
    salvarBlob(base64ToBlob(r.dataBase64, r.mime), r.nome || nome);
  };

  /* Ver o anexo sem baixar: o arquivo vira um endereço temporário no próprio
     navegador (blob:) e a modal mostra imagem/PDF ali mesmo. Quem revoga o
     endereço é a modal, ao fechar o visualizador.
     Os últimos abertos ficam guardados (o Blob, não o endereço): um PDF de
     3,4 MB reaberto vinha inteiro de novo pela rede — a demora que a equipe
     sentia era isso. Reabrir agora é instantâneo. */
  const vistosRef = useRef(new Map<string, { blob: Blob; mime: string; nome: string }>());
  const aoVerArquivo = async (anexoId: string, nome: string) => {
    let g = vistosRef.current.get(anexoId);
    if (!g) {
      const r = await downloadAnexo({ data: { anexoId } });
      g = { blob: base64ToBlob(r.dataBase64, r.mime), mime: r.mime || "", nome: r.nome || nome };
      vistosRef.current.set(anexoId, g);
      /* teto de memória: guarda os 8 mais recentes */
      while (vistosRef.current.size > 8) {
        const primeiro = vistosRef.current.keys().next().value as string;
        vistosRef.current.delete(primeiro);
      }
    }
    return { url: URL.createObjectURL(g.blob), mime: g.mime, nome: g.nome };
  };

  const aoComentar = (texto: string) =>
    comentarPedido({ data: { pedidoId: pedidoId!, texto } }).then(recarregarPedido);

  const aoEditar = (mudancas: Record<string, string | null>) =>
    updatePedido({ data: { id: pedidoId!, ...mudancas } as any }).then(recarregarPedido);

  const aoExcluirPedido = () =>
    deletePedido({ data: { id: pedidoId! } }).then(() => {
      const alvo = pedidoDet ? `${numDe(pedidoDet)} · ${pedidoDet.cliente}` : "Pedido";
      setPedidoId(null);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      setAvisoGeral(`${alvo} cancelado. Aparece em “Artes canceladas” na Central.`);
    });

  /* Só o dono do pedido ou quem edita todos consegue salvar — mesma regra do
     servidor, repetida aqui só para não oferecer um botão que vai falhar. */
  const podeEditarPedido = !!pedidoDet
    && (hasPerm(profile, "pedidos.editar_todos") || pedidoDet.vendedor_id === profile.id);

  /* Exportação da Lista: CSV com ; e BOM — abre direto no Excel em pt-BR. */
  function exportarPlanilha(tipo: "abertos" | "finalizados") {
    const linhas = itensDe(pedidos, tipo);
    const cab = ["Nº", "Cliente", "Medida", "Substrato", tipo === "finalizados" ? "Aprovação" : "Entrega", "Status"];
    const campo = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const corpo = linhas.map((l) => [l.num, l.cliente, l.medida, l.sub, tipo === "finalizados" ? l.apro : l.prazo, l.status].map(campo).join(";"));
    const csv = "﻿" + [cab.map(campo).join(";"), ...corpo].join("\r\n");
    const hoje = new Date().toISOString().slice(0, 10);
    salvarBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `r2hub-${tipo}-${hoje}.csv`);
    setAvisoGeral(`${linhas.length} ${linhas.length === 1 ? "registro exportado" : "registros exportados"} para planilha.`);
  }

  /* Criação real do pedido (mesma server fn do formulário V3).
     DEVOLVE a promessa: sem isso a modal dava o pedido por criado antes de o
     servidor responder — apagava o rascunho, fechava e, se o create falhasse,
     a pessoa perdia tudo o que tinha digitado e só via um banner de erro. */
  const aoCriar = hasPerm(profile, "pedidos.criar")
    ? async (d: DadosNovoPedido) => {
        const det = d.detalhes;
        if (!det) throw new Error("Faltam os dados do pedido. Nada foi enviado.");
        const r = await createPedido({
          data: {
            cliente: d.cliente,
            // pasta escolhida na lista da rede; vazio = criar uma nova
            pasta: d.pasta || null,
            materia: det.materia,
            larg_materia: det.largMateria || "—",
            largura: det.largura,
            altura: det.altura,
            forma: det.forma,
            cores: det.cores,
            cores_desc: det.coresDesc || null,
            tarja_verso: det.tarjaVerso ?? "0",
            verniz: det.verniz ?? "0",
            cold_stamp: det.coldStamp ?? "0",
            picote: det.picote ?? "0",
            carreiras: det.carreiras || null,
            descricao: det.descricao || d.obs || "—",
            link_ref: det.linkRef || null,
            /* A faca em coluna própria. Antes ia no fim do briefing ("Faca do
               catálogo: X") e não havia como trocar depois do envio. Faca
               nova: a medida foi digitada e a faca ainda vai ser feita. */
            faca_cod: d.facaNova ? null : (d.facaCod || null),
            faca_nova: d.facaNova ? "1" : "0",
            urgente: d.urgente ? "1" : "0",
          },
        });
        qc.invalidateQueries({ queryKey: ["pedidos"] });

        /* Os arquivos escolhidos no formulário sobem AGORA, para o pedido
           recém-criado. Antes o formulário só guardava o NOME do arquivo e o
           conteúdo evaporava — pedido #3 saiu com briefing citando "o anexo"
           e nada anexado. O que falhar vira aviso NA TELA DE SUCESSO: o
           pedido existe, mas a pessoa precisa saber o que ficou de fora. */
        const arquivos = d.arquivos ?? [];
        const num = `#${String(r.numero).padStart(2, "0")}`;
        if (!arquivos.length) return { num, id: r.id };

        const falhas = await subirAnexos(r.id, arquivos, "anexo", false);
        qc.invalidateQueries({ queryKey: ["pedidos"] });
        return {
          num,
          id: r.id,
          aviso: falhas.length
            ? `Nem tudo foi anexado: ${falhas.join(" · ")}. Abra o pedido e anexe de novo.`
            : undefined,
        };
      }
    : undefined;

  /* A nota da clicheria só sobe quando foi anexada AGORA. Registro que já tem
     a sua guardada manda null, e o servidor mantém a que estava lá — corrigir
     um valor não pode apagar o comprovante. */
  const notaDoRegistro = (r: RegistroCliche) =>
    r.notaBase64 && r.notaNome ? { nome: r.notaNome, dataBase64: r.notaBase64 } : null;

  /* Registro real da chegada do clichê (server fn registrarCliche).
     Fecha o pedido no mesmo gesto, como na modal do pedido: antes o card
     ficava parado na mesma coluna e a pessoa registrava DE NOVO (o que virava
     "correção" e apagava o registro anterior). */
  const aoRegistrarCliche = (pedidoId: string, r: RegistroCliche) => {
    registrarCliche({ data: { pedidoId, dataChegada: r.data, horaChegada: r.hora, itens: r.itens, nota: notaDoRegistro(r) } })
      .then(() => changeStatus({ data: { id: pedidoId, status: "concluido", observacao: null } }))
      .then(() => qc.invalidateQueries({ queryKey: ["pedidos"] }))
      .catch((e: unknown) => setAvisoGeral(e instanceof Error ? e.message : "Erro ao gravar o registro do clichê."));
  };

  const modais = (
    <>
      {transferindo && (
        <TransferirCarteiraModalV1a
          donos={donos}
          fechar={() => setTransferindo(false)}
          aoCarregarCarteira={(vendedorId) =>
            listCarteira({ data: { vendedorId } }).then((r: any[]) =>
              r.map((c) => ({ cliente: String(c.cliente), total: Number(c.total), abertos: Number(c.abertos) })))}
          aoTransferir={(d) =>
            transferirCarteira({ data: d }).then((r: any) => {
              /* a lista de pedidos muda de dono: quem não vê tudo perde ou
                 ganha linhas, então recarrega os dois lados */
              void qc.invalidateQueries({ queryKey: ["pedidos"] });
              void carregarDonos();
              return { movidos: Number(r.movidos), para: String(r.para) };
            })}
        />
      )}
      {lista && (
        <ListaModalV1a
          tipo={lista}
          itens={itensDe(pedidos, lista)}
          fechar={() => setLista(null)}
          onAbrir={(item) => {
            setLista(null);
            const p = pedidos.find((x: any) => numDe(x) === item.num);
            if (p) setPedidoId(p.id);
          }}
          onExportar={() => exportarPlanilha(lista)}
        />
      )}
      {pedidoModal && (
        <PedidoModalV1a
          /* remonta ao trocar de pedido: seção, marcas e diálogo abertos são
             do pedido que estava na tela, não do próximo */
          key={pedidoId ?? "pedido"}
          pedido={pedidoModal}
          fechar={fecharPedido}
          /* "Abrir no Painel"/"Abrir na Aprovação" trocavam a tela POR BAIXO da
             modal, que continuava aberta por cima — parecia que o botão não
             fazia nada. Fecha antes de navegar. */
          aoNavegar={(pagina) => { fecharPedido(); aoNavegar(pagina); }}
          arquivos={arquivosReais}
          historico={historicoReal}
          comentarios={comentariosReais}
          revisoesResolvidas={revisoesResolvidas}
          aoResolverRevisao={(chave, resolvida) =>
            resolverRevisao({ data: { pedidoId: pedidoId!, chave, resolvida } }).then(recarregarPedido)}
          perguntas={perguntasReais}
          aoPerguntar={(texto) =>
            perguntarNoPedido({ data: { pedidoId: pedidoId!, texto } }).then(recarregarPedido)}
          aoResponder={(perguntaId, texto) =>
            responderPergunta({ data: { perguntaId, texto } }).then(recarregarPedido)}
          campos={pedidoDet}
          detalheCarregado={!!detalhe?.pedido}
          /* Cada ação usa a MESMA permissão que o servidor cobra. Antes
             "Pedir revisão" era liberada por `pedidos.aprovar`, "Reposição"
             por `tab.solicitar_cliche` e reabrir um concluído por
             `pedidos.aprovar` — o botão aparecia e o servidor recusava. */
          permissoes={{
            aprovar: hasPerm(profile, "pedidos.aprovar"),
            reprovar: hasPerm(profile, "aprovacao.reprovar"),
            reabrir: hasPerm(profile, "pedidos.reabrir"),
            design: hasPerm(profile, "pedidos.status_design"),
            editar: podeEditarPedido,
            excluir: hasPerm(profile, "pedidos.excluir"),
            repor: hasPerm(profile, "cliche.reposicao"),
            assumir: hasPerm(profile, "design.assumir"),
            solicitarCliche: hasPerm(profile, "cliche.solicitar"),
            arquivoFinal: hasPerm(profile, "design.arquivo_final"),
            anexar: hasPerm(profile, "anexo.upload"),
          }}
          aoStatus={aoStatus}
          aoAnexar={aoAnexar}
          aoExcluirArquivo={aoExcluirArquivo}
          aoBaixarArquivo={aoBaixarArquivo}
          aoVerArquivo={aoVerArquivo}
          aoVerFaca={async (cod) => {
            /* código -> arquivo no acervo: mapa da migração, senão <código>.pdf */
            const mapa = PDF_DE(cod).replace("facas/", "");
            const candidatos = [...new Set([mapa, BASE_COD(cod) + ".pdf", cod + ".pdf"].filter(Boolean))];
            for (const arq of candidatos) {
              try { return { url: await carregarPdfFaca(arq), mime: "application/pdf", nome: arq }; } catch { /* tenta o próximo nome */ }
            }
            throw new Error("O desenho da " + cod + " não está no acervo de PDFs.");
          }}
          aoRegistrarChegada={async (r) => {
            // grava a chegada (com valores) e fecha o pedido no mesmo gesto
            await registrarCliche({ data: { pedidoId: pedidoId!, dataChegada: r.data, horaChegada: r.hora, itens: r.itens, nota: notaDoRegistro(r) } });
            await changeStatus({ data: { id: pedidoId!, status: "concluido", observacao: null } });
            await recarregarPedido();
            qc.invalidateQueries({ queryKey: ["pedidos"] });
          }}
          aoComentar={aoComentar}
          aoEditar={aoEditar}
          aoExcluir={aoExcluirPedido}
          aoSolicitarCliche={(codigo, motivo) =>
            solicitarCliche({ data: { cliente: pedidoDet.cliente, codigo, motivo } })
              .then((r: any) => {
                qc.invalidateQueries({ queryKey: ["pedidos"] });
                setAvisoGeral(`Reposição aberta como pedido #${r.numero}.`);
              })}
        />
      )}
      {avisoGeral && <AvisoV1a texto={avisoGeral} onFechar={() => setAvisoGeral("")} />}
    </>
  );

  /* "novo-pedido" não está em LABEL_PARA_TELA (não é item de menu): quem
     manda nela é a permissão de criar, não a lista de páginas. */
  const telaLiberada = paginasLiberadas.some((label) => LABEL_PARA_TELA[label] === tela)
    /* "inicio": a entrada genérica, que vira a tela inicial escolhida */
    || ["home", "leitura", "inicio"].includes(tela)
    || (tela === "novo-pedido" && hasPerm(profile, "pedidos.criar"))
    /* A lista V1a saiu do menu quando a 1.0 assumiu "Pedidos", mas continua
       alcançável por URL — rede de segurança enquanto a nova roda de verdade.
       Some quando a 1.0 tiver semanas de uso sem reclamação. */
    || (tela === "pedidos-v1a" && paginasLiberadas.includes("Pedidos"))
    /* A Aprovação V1a saiu do menu quando a 1.0 assumiu o item, e continua
       alcançável por URL — é ela que cuida do ciclo do clichê inteiro
       (e-mail à clicheria, chegada, valores, motivos), coisa que a 1.0 ainda
       não faz. Mesma rede de segurança da lista de pedidos. */
    || (tela === "aprovacao" && paginasLiberadas.includes("Aprovação"))
    /* A Facas V1a tinha a mesma rede que as duas de cima — e não tinha. O
       comentário lá em cima prometia "?tela=facas continua alcançável", mas
       "Facas" passou a apontar para ferramentais10 e a URL antiga caía na
       Home. É nela que ainda se marca faca como morta e se compara desenho,
       coisa que a 1.0 não faz. */
    || (tela === "facas" && paginasLiberadas.includes("Facas"))
    /* As contas em si ainda moram na tela V1a; os cards 1.0 mandam para cá. */
    || (tela === "calculadoras" && paginasLiberadas.includes("Calculadoras"))
    /* A Pantone V1a segue por URL enquanto a 1.0 roda nas mãos da equipe. */
    || (tela === "pantone" && paginasLiberadas.includes("Pantone"))
    /* A Arquivos V1a também, enquanto a 1.0 roda nas mãos da equipe. */
    || (tela === "arquivos" && paginasLiberadas.includes("Arquivos"))
    /* A Equipe V1a também, enquanto a do 1.0 roda nas mãos da equipe. */
    || (tela === "equipe" && paginasLiberadas.includes("Equipe"))
    /* E os Relatórios V1a. */
    || (tela === "apontamentos" && paginasLiberadas.includes("Apontamentos"))
    /* E a Clientes V1a. */
    || (tela === "clientes" && paginasLiberadas.includes("Clientes"));

  const comuns = {
    profile, versao, aoNavegar, onNova: abrirNova, onLogout: doLogout,
    // o "+" do rail é um item a mais desta lista: aparece com pedidos.criar
    disponiveis: hasPerm(profile, "pedidos.criar")
      ? [...paginasLiberadas, NOVO_PEDIDO_V1A]
      : paginasLiberadas,
  } as const;

  /* Home 1.0 — primeira tela da geração nova. Cromo próprio (sem rail). */
  const home = (extra?: ReactNode) => (
    <HomeHub10 {...comuns} pedidos={pedidos}
      aoEnviarSugestao={(texto, tela) => enviarSugestao({ data: { texto, tela } })}>
      {extra}
      {modais}
    </HomeHub10>
  );

  if (!telaLiberada) {
    return (
      <HubDadosV1aProvider valor={hubDados}>
        {home(<AvisoV1a texto="Seu acesso não inclui essa página." tipo="alerta" onFechar={() => navigate({ to: "/hub", search: { tela: "home" } })} />)}
      </HubDadosV1aProvider>
    );
  }

  return (
    <HubDadosV1aProvider valor={hubDados}>
      <ProvedorApresentacao verDeNovo={verApresentacao}>
        {telaAtual()}
      </ProvedorApresentacao>
      {recadoDoEnvio && <AvisoV1a texto={recadoDoEnvio} tipo="alerta" onFechar={() => setRecadoDoEnvio("")} />}
      {carregando && <CarregandoHub10 />}
      {/* a apresentação do hub, por cima de todas as telas */}
      {profile && apresentacao && (
        <ApresentacaoHub10 profile={profile} tela={tela} estado={apresentacao} aoSalvar={salvarApresentacao}
          irPara={(t) => navigate({ to: "/hub", search: { tela: t } })} pedido={pedidoApresentacao} />
      )}
    </HubDadosV1aProvider>
  );

  function telaAtual() {
    switch (tela) {
    case "pedidos10":
    case "aprovacao10": {
      const STATUS_APROVACOES = ["aguardando", "aguardando_cliente", "aprovada", "cliche", "refazer_cliche"];
      /* Aprovações 1.0 é a mesma tela com outro recorte: do design pronto ao
         clichê, que é o que a faixa dela conta. Antes o recorte era só
         "aprovada" e a faixa dizia "07 aguardando aprovação" com a lista
         vazia (simulação de 28/09/2026). */
      const aprovacoes = tela === "aprovacao10";
      const dono10 = detalhe10?.pedido?.vendedor_id === profile!.id;
      const recarregar10 = () => {
        void qc.invalidateQueries({ queryKey: ["pedidos"] });
        void qc.invalidateQueries({ queryKey: ["pedido", pedido10Id] });
      };
      /* O que não subiu vira erro, e não silêncio: subirAnexos devolve a
         lista do que ficou de fora e antes ninguém lia (um arquivo acima de
         35 MB sumia sem aviso). O que subiu fica no pedido. */
      const anexar10 = async (arquivos: File[], tipo: "anexo" | "arte" = "anexo") => {
        const falhas = await subirAnexos(pedido10Id!, arquivos, tipo);
        recarregar10();
        if (falhas.length) {
          const foram = arquivos.length - falhas.length;
          throw new Error((foram > 0 ? `${foram} de ${arquivos.length} anexados. ` : "") + `Não subiu: ${falhas.join(" · ")}.`);
        }
      };
      return (
        <PedidoHub10 profile={profile!} pedidos={pedidos} aoNavegar={aoNavegar}
          onNova={hasPerm(profile, "pedidos.criar") ? abrirNova : undefined}
          onLogout={doLogout} disponiveis={comuns.disponiveis}
          titulo={aprovacoes ? "Aprovações" : undefined}
          tituloTodos={aprovacoes ? "Todas as aprovações" : undefined}
          vazioTitulo={aprovacoes ? "Nenhuma aprovação" : undefined}
          vazioTexto={aprovacoes ? "Ajuste os filtros para ver mais aprovações." : undefined}
          somenteStatus={aprovacoes ? STATUS_APROVACOES : undefined}
          paginaAtiva={aprovacoes ? "Aprovação" : undefined}
          faixaResumo={aprovacoes ? "aprovacoes" : undefined}
          /* "Refazer clichê" (Augusto, 02/10/2026): só em Aprovações, só para
             designers e admin; o cartão novo entra na lista na hora */
          aoCadastrarRefacao={aprovacoes && (profile?.role === "admin" || (profile?.role === "designer" && profile.permissions.includes("pedidos.status_design")))
            ? async (d) => { const r = await cadastrarRefazerCliche({ data: d }); await qc.invalidateQueries({ queryKey: ["pedidos"] }); return r; }
            : undefined}
          motivosDoCliche={() => listMotivosCliche() as Promise<{ id: string; nome: string }[]>}
          detalheId={pedido10Id} detalhe={detalhe10 ?? null}
          aoAbrirDetalhe={abrirDetalhe10}
          aoFecharDetalhe={() => setPedido10Id(null)}
          podeNoPedido={{
            iniciar: hasPerm(profile, "design.assumir"),
            enviarArte: hasPerm(profile, "design.enviar_arte"),
            aprovar: hasPerm(profile, "pedidos.aprovar"),
            pedirRevisao: hasPerm(profile, "aprovacao.reprovar"),
            clicheria: hasPerm(profile, "cliche.solicitar"),
            finalizar: hasPerm(profile, "design.arquivo_final"),
            refazerCliche: hasPerm(profile, "cliche.solicitar"),
            reativar: hasPerm(profile, "pedidos.reabrir"),
            cancelar: dono10 || hasPerm(profile, "pedidos.editar_todos"),
            /* briefing e matéria-prima: a regra do servidor (updatePedido).
               Só "dono" deixava o designer abrir o Editar do próprio cartão
               de refação e o servidor recusava (simulação 5, 05/10/2026). */
            editar: (dono10 && hasPerm(profile, "pedidos.editar_proprios")) || hasPerm(profile, "pedidos.editar_todos"),
            /* as Especificações abrem para o dono (acabamento é dele); o que
               ele não pode mudar fica travado lá dentro */
            editarEspec: dono10 || hasPerm(profile, "pedidos.editar_todos"),
            perguntar: true,
            anexar: dono10 || hasPerm(profile, "pedidos.editar_todos"),
            baixar: hasPerm(profile, "anexo.baixar"),
            subirArquivo: hasPerm(profile, "anexo.upload"),
            /* as regras do servidor (updatePedido, aguardarCliente),
               repetidas só para não oferecer botão que vai falhar. Riscar
               alteração o servidor deixa para quem tem acesso ao pedido; a
               tela oferece só a quem conduz o design. */
            urgencia: dono10 || hasPerm(profile, "pedidos.prioridade") || hasPerm(profile, "pedidos.editar_todos"),
            faca: (dono10 && hasPerm(profile, "pedidos.editar_proprios")) || hasPerm(profile, "design.medidas") || hasPerm(profile, "pedidos.editar_todos"),
            esperarCliente: dono10 || hasPerm(profile, "pedidos.status_design") || hasPerm(profile, "pedidos.editar_todos"),
            resolverAlteracao: hasPerm(profile, "pedidos.status_design"),
          }}
          acoesPedido={{
            mudarStatus: (status, observacao, de, espessura) =>
              changeStatus({ data: { id: pedido10Id!, status, observacao: observacao ?? "", de,
                ...(espessura === "1.14" || espessura === "1.70" ? { espessura } : {}) } }).then(recarregar10),
            perguntar: (texto) => perguntarNoPedido({ data: { pedidoId: pedido10Id!, texto } }).then(recarregar10),
            responder: (perguntaId, texto) => responderPergunta({ data: { perguntaId, texto } }).then(recarregar10),
            /* as cores separadas pelos nomes ("Branco roxo" são duas, mesmo
               sem vírgula), e o número de cores acompanha (02/10/2026) */
            salvarBriefing: (descricao, coresDesc) => {
              const lista = separarCores(coresDesc);
              return updatePedido({ data: { id: pedido10Id!, descricao, cores_desc: lista.length ? lista.join(", ") : coresDesc,
                ...(lista.length ? { cores: String(lista.length) } : {}) } }).then(recarregar10);
            },
            salvarEspec: (v) => updatePedido({ data: { id: pedido10Id!, ...v } }).then(recarregar10),
            anexar: (arquivos) => anexar10(arquivos),
            /* a arte final depois da aprovação: guarda o arquivo como arte, sem
               mexer no status (antes o único caminho era "Enviar arte pronta",
               que devolvia o pedido para Design criado) */
            anexarArte: (arquivos) => anexar10(arquivos, "arte"),
            removerAnexo: (anexoId) => deleteAnexo({ data: { anexoId } }).then(recarregar10),
            /* ver e baixar: as mesmas funções da ficha V1a, com o cache dos
               últimos abertos. Só leitura, na pasta do hub ou na do cliente. */
            verArquivo: aoVerArquivo,
            baixarArquivo: aoBaixarArquivo,
            /* espera do cliente: entra com o motivo, sai quando ele responde
               e o pedido volta para a etapa de antes (o servidor guarda) */
            aguardarCliente: (motivo) => aguardarCliente({ data: { id: pedido10Id!, motivo } }).then(recarregar10),
            clienteRespondeu: (observacao) =>
              clienteRespondeu({ data: { id: pedido10Id!, observacao: observacao || null } }).then(recarregar10),
            /* riscar a alteração atendida (a chave é a linha do histórico) */
            resolverAlteracao: (chave, resolvida) =>
              resolverRevisao({ data: { pedidoId: pedido10Id!, chave, resolvida } }).then(recarregar10),
            /* os motivos do "Refazer clichê" (cliche_motivos) */
            motivosDoCliche: () => listMotivosCliche() as Promise<{ id: string; nome: string }[]>,
            salvarUrgente: (urgente) =>
              updatePedido({ data: { id: pedido10Id!, urgente: urgente ? "1" : "0" } }).then(recarregar10),
            /* a faca do catálogo leva a forma e, sendo de outra medida, a medida */
            salvarFaca: (f) =>
              updatePedido({ data: {
                id: pedido10Id!, faca_cod: f.facaNova ? null : f.facaCod, faca_nova: f.facaNova ? "1" : "0",
                ...(f.forma ? { forma: f.forma } : {}), ...(f.largura ? { largura: f.largura } : {}), ...(f.altura ? { altura: f.altura } : {}),
              } }).then(recarregar10),
            /* a pasta do cliente, escolhida pelo designer no "Iniciar criação" —
               leva junto os anexos que esperavam no hub. Quem abre a caixa é o
               PedidoHub10 (pedirPasta), como nas outras caixas com estado. */
            confirmarPasta: (d) =>
              confirmarPastaCliente({ data: { pedidoId: pedido10Id!, pasta: d.pasta ?? null, novaPasta: d.novaPasta ?? null } })
                .then((r) => { recarregar10(); void qc.invalidateQueries({ queryKey: ["pastas-clientes"] }); return r; }),
            pedirPasta: () => {},
            /* quem abre as caixas de devolver arte e de clichê é o próprio
               PedidoHub10 — elas têm estado e vivem na tela, não na rota */
            enviarArte: () => {},
            finalizar: () => {},
            /* A arte sobe ANTES do status: se um arquivo falhar, o pedido não
               vai para "Design criado" prometendo algo que não chegou. */
            enviarArteFinal: async (d) => {
              /* Tudo ou nada no tamanho: conferido antes de subir o primeiro.
                 Antes o PDF subia, o .ai de 80 MB era recusado, a entrega não
                 acontecia e a vendedora já tinha recebido o arquivo. */
              const grandes = d.arquivos.filter((f) => f.size > MAX_ANEXO_MB * 1024 * 1024);
              if (grandes.length) {
                throw new Error(`${grandes.map((f) => `${f.name} tem ${Math.round(f.size / 1048576)} MB`).join(" · ")}. O limite é ${MAX_ANEXO_MB} MB por arquivo. Nada foi enviado.`);
              }
              if (d.arquivos.length) {
                const falhas = await subirAnexos(pedido10Id!, d.arquivos, "arte", false);
                if (falhas.length) throw new Error(`Nem tudo subiu: ${falhas.join(" · ")}.`);
              }
              const cores = d.cores.filter(Boolean).join(", ");
              const obs = [`Arte ${d.versao} enviada`, cores, d.obs].filter(Boolean).join(" · ");
              /* `coresDesc` junto: são as cores que o designer CONFIRMA ao
                 entregar. Sem isso o pedido segue mostrando as que a vendedora
                 pediu, e quem olha depois (clichê, aprovação, relatório) lê a
                 intenção em vez do que foi feito. */
              await changeStatus({ data: { id: pedido10Id!, status: "aguardando", observacao: obs, coresDesc: cores || null } });
              recarregar10();
            },
            /* Finalizar passa por aqui: grava o registro do clichê (com a nota
               em PDF, quando veio) e só então fecha o pedido — o mesmo par que
               a tela de Aprovação V1a já fazia num gesto só. */
            registrarCliche: async (r) => {
              await registrarCliche({ data: { pedidoId: pedido10Id!, dataChegada: r.data, horaChegada: r.hora, itens: r.itens, nota: notaDoRegistro(r) } });
              try {
                await changeStatus({ data: { id: pedido10Id!, status: "concluido", observacao: null } });
              } catch (e) {
                recarregar10();
                throw new Error(`O registro do clichê foi gravado, mas o pedido não foi finalizado: ${e instanceof Error ? e.message : "erro no servidor"}`);
              }
              recarregar10();
              void qc.invalidateQueries({ queryKey: ["pedidos"] });
            },
          }}
          podeFila={hasPerm(profile, "pedidos.status_design")}
          aoDefinirFila={(id, posicao) =>
            definirFilaPedido({ data: { id, posicao } }).then(() => qc.invalidateQueries({ queryKey: ["pedidos"] }))}
          aoEnfileirar={(id) =>
            enfileirarPedido({ data: { id } }).then(() => qc.invalidateQueries({ queryKey: ["pedidos"] }))}
          aoLimparFila={() =>
            limparFilaPedidos().then(() => qc.invalidateQueries({ queryKey: ["pedidos"] }))}
          aoTransferir={hasPerm(profile, "pedidos.transferir") ? () => { setTransferindo(true); void carregarDonos(); } : undefined}>
          {/* só a modal de transferência, na versão 1.0: o resto de `modais`
              traz a ficha V1a junto, que não deve abrir por cima da tela 1.0 */}
          {transferindo && (
            <TransferirCarteiraHub10
              donos={donos}
              fechar={() => setTransferindo(false)}
              aoCarregarCarteira={(vendedorId) =>
                listCarteira({ data: { vendedorId } }).then((r: any[]) =>
                  r.map((c) => ({ cliente: String(c.cliente), total: Number(c.total), abertos: Number(c.abertos) })))}
              aoTransferir={(d) =>
                transferirCarteira({ data: d }).then((r: any) => {
                  void qc.invalidateQueries({ queryKey: ["pedidos"] });
                  void carregarDonos();
                  return { movidos: Number(r.movidos), para: String(r.para) };
                })}
            />
          )}
        </PedidoHub10>
      );
    }
    case "novo-pedido":
      return (
        <NovoPedidoHub10 profile={profile!} aoNavegar={aoNavegar} onLogout={doLogout}
          disponiveis={comuns.disponiveis} cadastros={cadastros} pedidos={pedidos} pedidosProntos={pedidosEm > 0}
          podeCadastrarMateria={permCadastro.materiais}
          aoCadastrarMateria={(nome) => aoCadastrar("material", nome)}
          aoCriar={aoCriar} aoCarregarPdfFaca={carregarPdfFaca} aoAvisoFora={setRecadoDoEnvio}
          aoVerPedido={irParaPedido10}
          aoCarregarSalvo={() => getMeuRascunhoPedido().then((r) => {
            /* texto estragado no banco vale como nada salvo */
            let rascunho: Record<string, unknown> | null = null;
            try { const v = r.json ? JSON.parse(r.json) : null; if (v && typeof v === "object") rascunho = v; } catch { /* idem */ }
            return { rascunho };
          })}
          aoSalvar={(rascunho) => setMeuRascunhoPedido({ data: { rascunho: rascunho as RascunhoPedidoDados | null } })}
          aoCarregarPedido={(id) => getPedido({ data: { id } }) as Promise<{ pedido: Record<string, unknown>; anexos?: unknown[] }>} />
      );
    case "central":
      return (
        <CentralV1a {...comuns} pedidos={pedidos} onOpen={abrirPedido} onVerTodos={() => setLista("abertos")}>
          {modais}
        </CentralV1a>
      );
    case "pedidos-v1a":
      return (
        <PedidosV1a {...comuns} pedidos={pedidos} onOpen={abrirPedido}
          aoVoltarFila={(id) =>
            changeStatus({ data: { id, status: "revisao", observacao: "Voltou para a fila do design" } })
              .then(() => qc.invalidateQueries({ queryKey: ["pedidos"] }))}
          aoAprovarPedido={(id) =>
            changeStatus({ data: { id, status: "aprovada", observacao: "Arte aprovada e saiu da fila" } })
              .then(() => qc.invalidateQueries({ queryKey: ["pedidos"] }))}
          aoTransferir={hasPerm(profile, "pedidos.transferir")
            ? () => { setTransferindo(true); void carregarDonos(); }
            : undefined}
        >
          {modais}
        </PedidosV1a>
      );
    case "aprovacao":
      return (
        <AprovacaoV1a
          {...comuns}
          pedidos={pedidos}
          onOpen={abrirPedido}
          aoRegistrarCliche={aoRegistrarCliche}
          aoAbrirNota={(pedidoId) =>
            baixarNotaCliche({ data: { pedidoId } })
              .then((r: { nome: string; dataBase64: string }) =>
                abrirBlob(base64ToBlob(r.dataBase64, "application/pdf")))
              .catch((e: unknown) => setAvisoGeral(e instanceof Error ? e.message : "Não achei a nota deste registro."))}
          aoVoltarClicheria={(pedidoId) =>
            voltarParaClicheria({ data: { pedidoId } })
              .then(() => { qc.invalidateQueries({ queryKey: ["pedidos"] }); setAvisoGeral("Pedido de volta na clicheria."); })
              .catch((e: unknown) => setAvisoGeral(e instanceof Error ? e.message : "Não deu para desfazer."))}
          podeVerValores={hasPerm(profile, "cliche.valor_ver")}
          podeConcluirSemCliche={hasPerm(profile, "pedidos.status_design") && hasPerm(profile, "design.arquivo_final")}
          aoConcluirSemCliche={(pedidoId) =>
            changeStatus({ data: { id: pedidoId, status: "concluido", observacao: "Concluído sem clichê pela Aprovação" } })
              .then(() => { qc.invalidateQueries({ queryKey: ["pedidos"] }); })}
          podeCancelarCliche={hasPerm(profile, "pedidos.aprovar")}
          aoCancelarCliche={(pedidoId) =>
            changeStatus({ data: { id: pedidoId, status: "aprovada", observacao: "Envio à clicheria cancelado pela Aprovação" } })
              .then(() => { qc.invalidateQueries({ queryKey: ["pedidos"] }); })}
          podeResponderCliente={hasPerm(profile, "aprovacao.responder_cliente")}
          podeEnviarProva={hasPerm(profile, "aprovacao.prova_enviar")}
          aoResponderCliente={(pedidoId, texto) =>
            responderCliente({ data: { pedidoId, texto } }).then(() => {
              qc.invalidateQueries({ queryKey: ["conversas"] });
              qc.invalidateQueries({ queryKey: ["pedido", pedidoId] });
            })}
          aoEnviarProva={(pedidoId, observacao) =>
            registrarProvaImpressao({ data: { pedidoId, observacao: observacao || null } }).then(() => {
              qc.invalidateQueries({ queryKey: ["pedido", pedidoId] });
            })}
          aoSolicitarCliche={async (num, dados) => {
            const r: any = await criarSolicitacaoCliche({ data: dados });
            // veio de um card de pedido aprovado → o pedido anda para "cliche"
            if (num) {
              const alvo = pedidos.find((p: any) => `#${String(p.numero).padStart(4, "0")}` === num || String(p.numero) === num.replace("#", ""));
              if (alvo) {
                /* a espessura da solicitação vai para o pedido (os relatórios separam 1.14 e 1.70) */
                await changeStatus({ data: { id: alvo.id, status: "cliche", observacao: `Solicitação de clichê #${String(r.numero).padStart(4, "0")} enviada.`,
                  ...(dados?.tipo === "1.14" || dados?.tipo === "1.70" ? { espessura: dados.tipo } : {}) } });
              }
            }
            qc.invalidateQueries({ queryKey: ["pedidos"] });
            if (!r.emailEnviado) setAvisoGeral(`Solicitação #${String(r.numero).padStart(4, "0")} gravada, mas o e-mail falhou: ${r.emailErro ?? "verifique o servidor de e-mail"}.`);
          }}
        >
          {modais}
        </AprovacaoV1a>
      );
    case "fabrica":
      return (
        <PainelV1a
          {...comuns}
          pedidos={pedidos}
          permissoes={{
            carregarOs: hasPerm(profile, "painel.carregar_os"),
            rodar: hasPerm(profile, "painel.rodar"),
            finalizar: hasPerm(profile, "painel.finalizar"),
            cancelar: hasPerm(profile, "painel.cancelar"),
            maquinas: hasPerm(profile, "painel.maquinas"),
            custosVer: hasPerm(profile, "painel.custos_ver"),
            custosEditar: hasPerm(profile, "painel.custos"),
          }}
          leiturasReais={leiturasV1a}
          aoUsarLeitura={(id) =>
            marcarLeituraUsadaFn({ data: { id } }).then(() => qc.invalidateQueries({ queryKey: ["leituras"] }))}
        >
          {modais}
        </PainelV1a>
      );
    case "op":
    case "leitura":
      return (
        <LeituraV1a
          {...comuns}
          leiturasReais={leiturasV1a}
          aoRegistrar={(dados) =>
            registrarLeituraOp({
              data: {
                op: dados.op, cliente: dados.cliente || null, descricao: dados.descricao || null,
                medida: dados.medida, substrato: dados.substrato, metragem: dados.metragem,
                carreiras: dados.carreiras || null, nucleo: dados.nucleo || null,
                rolos: dados.rolos || null, entrega: dados.entrega || null,
              },
            }).then(() => qc.invalidateQueries({ queryKey: ["leituras"] }))}
        >
          {modais}
        </LeituraV1a>
      );
    case "relatorios10":
      return (
        <RelatoriosHub10 profile={profile!} pedidos={pedidos} aoNavegar={aoNavegar}
          onNova={hasPerm(profile, "pedidos.criar") ? abrirNova : undefined}
          onLogout={doLogout} disponiveis={comuns.disponiveis}
          dados={apontRaw} aoPeriodo={definirPeriodo}
          podeFinanceiro={hasPerm(profile, "apontamentos.financeiro")}
          podeExportar={hasPerm(profile, "apontamentos.exportar")}
        >
          {modais}
        </RelatoriosHub10>
      );
    case "apontamentos":
      return (
        <ApontamentosV1a
          {...comuns}
          pedidos={pedidos}
          dados={apontRaw}
          comBackend
          aoPeriodo={definirPeriodo}
          podeFinanceiro={hasPerm(profile, "apontamentos.financeiro")}
          podeExportar={hasPerm(profile, "apontamentos.exportar")}
        >
          {modais}
        </ApontamentosV1a>
      );
    case "ferramentais10":
      return (
        <FerramentaisHub10 profile={profile!} aoNavegar={aoNavegar}
          onNova={hasPerm(profile, "pedidos.criar") ? abrirNova : undefined}
          onLogout={doLogout} disponiveis={comuns.disponiveis}
          podeCadastrar={hasPerm(profile, "cadastro.medidas")}
          aoCadastrar={(faca) =>
            salvarFacaExtra({ data: { cod: faca.cod, dados: JSON.stringify(faca) } })
              .then(() => qc.invalidateQueries({ queryKey: ["facas-catalogo"] }))}
        />
      );
    case "facas":
      return (
        <FacasV1a {...comuns} pdfs={pdfsFacas?.todos} pdfsMortas={pdfsFacas?.mortas} relacao={relacaoFacas?.facas} aoCarregarPdf={carregarPdfFaca} aoMiniatura={miniaturaFaca}
          podeMarcarMorta={hasPerm(profile, "faca.marcar_morta")}>
          {modais}
        </FacasV1a>
      );
    case "afiacao":
      return (
        <AfiacaoV1a
          {...comuns}
          facas={facasRaw ?? []}
          substratos={substratosRaw?.map((s: any) => s.nome as string) ?? []}
          podeEditar={podeAfiacao}
          podeVerCusto={hasPerm(profile, "faca.custo_ver")}
          aoEnviarFaca={(medida, substrato) =>
            enviarFacaAfiacao({ data: { medida, substrato } }).then(recarregarFacas)}
          aoReceberFaca={(d) =>
            receberFaca({ data: { ...d, estado: d.estado as "bom" | "regular" | "ruim" } }).then(recarregarFacas)}
          aoAddSubstrato={(nome) => addSubstrato({ data: { nome } }).then(recarregarFacas)}
          aoMarcarPedida={(id, pedida) => marcarNovaPedida({ data: { id, pedida } }).then(recarregarFacas)}
          aoSolicitarNova={(d) => solicitarFacaNova({ data: d }).then(recarregarFacas)}
          aoMiniatura={miniaturaFaca}
        >
          {modais}
        </AfiacaoV1a>
      );
    case "estoque":
      return <EstoqueV1a {...comuns} pedidos={pedidos}>{modais}</EstoqueV1a>;
    case "mural":
      return <MuralV1a {...comuns} pedidos={pedidos}>{modais}</MuralV1a>;
    case "pantone10":
      return (
        <PantonesHub10 profile={profile!} pedidos={pedidos} pedidosProntos={pedidosEm > 0} aoNavegar={aoNavegar}
          onNova={hasPerm(profile, "pedidos.criar") ? abrirNova : undefined}
          onLogout={doLogout} disponiveis={comuns.disponiveis}
          podeAtualizar={hasPerm(profile, "config.sistema")} />
      );
    case "pantone":
      return <PantoneV1a {...comuns} pedidos={pedidos} podeAtualizar={hasPerm(profile, "config.sistema")}>{modais}</PantoneV1a>;
    case "calculadoras10":
      return (
        <CalculadorasHub10 profile={profile!} aoNavegar={aoNavegar}
          onNova={hasPerm(profile, "pedidos.criar") ? abrirNova : undefined}
          onLogout={doLogout} disponiveis={comuns.disponiveis}
          permissoes={Object.values(CALC_PERM).filter((p) => hasPerm(profile, p))}
          podeGabarito={hasPerm(profile, PERM_GABARITO)}
          /* Facas já abre a aba 1.0; os outros cards ainda abrem a tela
             antiga, onde as contas continuam funcionando */
          aoAbrir={() => navigate({ to: "/hub", search: { tela: "calculadoras" } })} />
      );
    case "calculadoras":
      return (
        <CalculadorasV1a {...comuns} permissoes={[...Object.values(CALC_PERM), PERM_GABARITO].filter((p) => hasPerm(profile, p))}>
          {modais}
        </CalculadorasV1a>
      );
    case "arquivos10":
      return (
        <ArquivosHub10 profile={profile!} aoNavegar={aoNavegar}
          onNova={hasPerm(profile, "pedidos.criar") ? abrirNova : undefined}
          onLogout={doLogout} disponiveis={comuns.disponiveis}
          podeEditar={hasPerm(profile, "cliente.editar")} />
      );
    case "arquivos":
      return <ArquivosV1a {...comuns}>{modais}</ArquivosV1a>;
    case "clientes10":
      return (
        <ClientesHub10 profile={profile!} aoNavegar={aoNavegar}
          onNova={hasPerm(profile, "pedidos.criar") ? abrirNova : undefined}
          onLogout={doLogout} disponiveis={comuns.disponiveis}>
          {modais}
        </ClientesHub10>
      );
    case "clientes":
      return <ClientesV1a {...comuns}>{modais}</ClientesV1a>;
    case "equipe10":
      return (
        <EquipeHub10 profile={profile!} aoNavegar={aoNavegar}
          onNova={hasPerm(profile, "pedidos.criar") ? abrirNova : undefined}
          onLogout={doLogout} disponiveis={comuns.disponiveis}
          usuarios={usuariosEquipe}
          cargos={cargosEquipe}
          logs={logsEquipe}
          permissoesTodas={permsRaw?.permissoes as string[] | undefined}
          aoTrocarCargo={(id, cargo) => updateUsuario({ data: { id, role: cargo } }).then(recarregarEquipe)}
          aoTogglePermissao={(id, permissao, ligar) =>
            setUsuarioPermissao({ data: { id, permission: permissao as any, habilitada: ligar } }).then(recarregarEquipe)}
          aoAplicarPadrao={(id) => aplicarTemplateCargo({ data: { id } }).then(recarregarEquipe)}
          aoAtivar={(id, ativo) => updateUsuario({ data: { id, ativo } }).then(recarregarEquipe)}
          aoExcluirUsuario={(id) => excluirUsuario({ data: { id } }).then(recarregarEquipe)}
          aoForcarLogout={(id) => forcarLogout({ data: { id } }).then(recarregarEquipe)}
          aoRenomear={(id, nome) => updateUsuario({ data: { id, nome } }).then(recarregarEquipe)}
          aoResetarSenha={(id, senha) => resetSenha({ data: { id, novaSenha: senha } }).then(recarregarEquipe)}
          aoCriarUsuario={(d) =>
            createUsuario({ data: { nome: d.nome, username: d.username, senha: d.senha, role: d.cargo } }).then(recarregarEquipe)}
          aoSalvarCargo={(d) =>
            (d.novo
              ? createRole({ data: { nome: d.nome, label: d.label, permissoes: d.permissoes as any } })
              : updateRole({ data: { nome: d.nome, label: d.label, permissoes: d.permissoes as any } })
            ).then(recarregarEquipe)}
          aoExcluirCargo={(nome) => deleteRole({ data: { nome } }).then(recarregarEquipe)}
        >
          {modais}
        </EquipeHub10>
      );
    case "equipe":
      return (
        <EquipeV1a
          {...comuns}
          usuarios={usuariosEquipe}
          cargos={cargosEquipe}
          logs={logsEquipe}
          permissoesTodas={permsRaw?.permissoes as string[] | undefined}
          aoTrocarCargo={(id, cargo) => updateUsuario({ data: { id, role: cargo } }).then(recarregarEquipe)}
          aoTogglePermissao={(id, permissao, ligar) =>
            setUsuarioPermissao({ data: { id, permission: permissao as any, habilitada: ligar } }).then(recarregarEquipe)}
          aoAplicarPadrao={(id) => aplicarTemplateCargo({ data: { id } }).then(recarregarEquipe)}
          aoAtivar={(id, ativo) => updateUsuario({ data: { id, ativo } }).then(recarregarEquipe)}
          aoExcluirUsuario={(id) => excluirUsuario({ data: { id } }).then(recarregarEquipe)}
          aoForcarLogout={(id) => forcarLogout({ data: { id } }).then(recarregarEquipe)}
          aoRenomear={(id, nome) => updateUsuario({ data: { id, nome } }).then(recarregarEquipe)}
          aoResetarSenha={(id, senha) => resetSenha({ data: { id, novaSenha: senha } }).then(recarregarEquipe)}
          aoCriarUsuario={(d) =>
            createUsuario({ data: { nome: d.nome, username: d.username, senha: d.senha, role: d.cargo } }).then(recarregarEquipe)}
          aoSalvarCargo={(d) =>
            (d.novo
              ? createRole({ data: { nome: d.nome, label: d.label, permissoes: d.permissoes as any } })
              : updateRole({ data: { nome: d.nome, label: d.label, permissoes: d.permissoes as any } })
            ).then(recarregarEquipe)}
          aoExcluirCargo={(nome) => deleteRole({ data: { nome } }).then(recarregarEquipe)}
        >
          {modais}
        </EquipeV1a>
      );
    default:
      return home();
    }
  }
}
