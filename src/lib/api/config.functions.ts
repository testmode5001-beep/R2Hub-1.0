// Configurações da capa (home) do Hub: título, versão, frase e vídeo de fundo — editáveis pelo gestor.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { getDb, getSetting, getUserConfig, setSetting, setUserConfig } from "@/server/db.server";
import { requirePerm } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { aplicarHomeVideo, aplicarVideo, listHomeVideoFiles, publicarPapel, removerHomeVideo, removerVideo, salvarVideoNovo } from "@/server/videos.server";

const PADROES = {
  titulo: "Do design à impressão",
  frase: "CONTAMOS COM VOCÊ, SEMPRE!",
  versao: "R2 HUB V0.01",
};

export const getHomeConfig = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => ({
    titulo: getSetting("home.titulo", PADROES.titulo),
    frase: getSetting("home.frase", PADROES.frase),
    versao: getSetting("home.versao", PADROES.versao),
    // "" = sem vídeo (fundo cinza padrão)
    video: getSetting("home.video_src", ""),
    videoNome: getSetting("home.video_nome", ""),
  }));

export const setHomeConfig = createServerFn({ method: "POST" })
  .validator(
    z.object({
      titulo: z.string().max(80).optional(),
      frase: z.string().max(120).optional(),
      versao: z.string().max(40).optional(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");

    const mudou: Record<string, string> = {};
    if (data.titulo !== undefined) { setSetting("home.titulo", data.titulo, user.id); mudou.titulo = data.titulo; }
    if (data.frase !== undefined) { setSetting("home.frase", data.frase, user.id); mudou.frase = data.frase; }
    if (data.versao !== undefined) { setSetting("home.versao", data.versao, user.id); mudou.versao = data.versao; }

    audit({ id: user.id, nome: user.nome }, "home.editar", "settings", null, mudou);
    return { ok: true };
  });

/**
 * Contadores para os badges do menu da capa — o que precisa de atenção, sem
 * precisar entrar. Respeita o acesso a pedidos (quem não vê tudo, conta só os
 * seus). As facas de afiação são globais (todo mundo com a aba vê todas).
 */
export const getHomeStats = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const veTodos = user.role === "admin" || user.permissions.includes("pedidos.ver_todos");

    const contaPedidos = (status: string) =>
      (veTodos
        ? db.prepare("SELECT COUNT(*) AS n FROM pedidos WHERE status = ?").get(status)
        : db.prepare("SELECT COUNT(*) AS n FROM pedidos WHERE status = ? AND vendedor_id = ?").get(status, user.id)
      ) as { n: number };

    const facas = db
      .prepare("SELECT COUNT(*) AS n FROM faca_afiacoes WHERE status = 'enviada'")
      .get() as { n: number };

    return {
      pedidosNovos: contaPedidos("nova").n,      // pedidos recém-chegados
      clichesAbertos: contaPedidos("cliche").n,  // clichê solicitado, aguardando chegar
      facasAbertas: facas.n,                     // facas enviadas, aguardando voltar
    };
  });

/** Vídeos disponíveis no share para escolher como fundo da capa. */
export const listHomeVideos = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");
    return { videos: listHomeVideoFiles() };
  });

/** Define (ou remove, com nome vazio) o vídeo de fundo da capa. */
export const setHomeVideo = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().max(200) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");

    if (!data.nome) {
      removerHomeVideo();
      setSetting("home.video_src", "", user.id);
      setSetting("home.video_nome", "", user.id);
      audit({ id: user.id, nome: user.nome }, "home.video", "settings", null, { video: "(cinza)" });
      return { ok: true, src: "", nome: "" };
    }

    const { src, nome } = aplicarHomeVideo(data.nome);
    setSetting("home.video_src", src, user.id);
    setSetting("home.video_nome", nome, user.id);
    audit({ id: user.id, nome: user.nome }, "home.video", "settings", null, { video: nome });
    return { ok: true, src, nome };
  });

/** Fundo da Central — independente da capa (usa a mesma lista de vídeos). */
export const getCentralConfig = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => ({
    video: getSetting("central.video_src", ""),
    videoNome: getSetting("central.video_nome", ""),
  }));

/** Define (ou remove, com nome vazio) o vídeo de fundo da Central. */
export const setCentralVideo = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().max(200) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");

    if (!data.nome) {
      removerVideo("central-bg");
      setSetting("central.video_src", "", user.id);
      setSetting("central.video_nome", "", user.id);
      audit({ id: user.id, nome: user.nome }, "central.video", "settings", null, { video: "(cinza)" });
      return { ok: true, src: "", nome: "" };
    }

    const { src, nome } = aplicarVideo(data.nome, "central-bg");
    setSetting("central.video_src", src, user.id);
    setSetting("central.video_nome", nome, user.id);
    audit({ id: user.id, nome: user.nome }, "central.video", "settings", null, { video: nome });
    return { ok: true, src, nome };
  });

/* ————— Fundo genérico por página do Hub ————— */
/* Cada página interna pode ter fundo próprio (independente da capa e da Central),
   como o usuário pediu. O `page` vem de um enum fechado — nunca do usuário livre —
   para não abrir brecha de path traversal no nome-base do arquivo publicado
   (<page>-bg.<ext>). Home e Central seguem com suas fns dedicadas acima. */
const PAGINAS_FUNDO = ["nova", "cliches", "solcliche", "facas", "calculadoras", "apontamentos"] as const;

/** Lê o fundo (vídeo/imagem) de uma página interna. "" = fundo cinza padrão. */
export const getPageConfig = createServerFn({ method: "POST" })
  .validator(z.object({ page: z.enum(PAGINAS_FUNDO) }))
  .middleware([requireAuth])
  .handler(async ({ data }) => ({
    video: getSetting(`${data.page}.video_src`, ""),
    videoNome: getSetting(`${data.page}.video_nome`, ""),
  }));

/** Define (ou remove, com nome vazio) o fundo de uma página interna. */
export const setPageVideo = createServerFn({ method: "POST" })
  .validator(z.object({ page: z.enum(PAGINAS_FUNDO), nome: z.string().max(200) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");
    const base = `${data.page}-bg`;

    if (!data.nome) {
      removerVideo(base);
      setSetting(`${data.page}.video_src`, "", user.id);
      setSetting(`${data.page}.video_nome`, "", user.id);
      audit({ id: user.id, nome: user.nome }, "pagina.video", "settings", null, { page: data.page, video: "(cinza)" });
      return { ok: true, src: "", nome: "" };
    }

    const { src, nome } = aplicarVideo(data.nome, base);
    setSetting(`${data.page}.video_src`, src, user.id);
    setSetting(`${data.page}.video_nome`, nome, user.id);
    audit({ id: user.id, nome: user.nome }, "pagina.video", "settings", null, { page: data.page, video: nome });
    return { ok: true, src, nome };
  });

/** Envia um vídeo novo para o acervo (aparece na lista de todas as telas). */
export const uploadVideo = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().min(1).max(200), dataBase64: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "config.sistema");

    const buf = Buffer.from(data.dataBase64, "base64");
    const info = salvarVideoNovo(data.nome, buf);
    audit({ id: user.id, nome: user.nome }, "video.upload", "videos", null, { nome: info.nome, mb: info.tamanhoMB });
    return { ok: true, ...info };
  });

/**
 * Envia um papel de parede novo para o acervo, direto das Preferências.
 * Diferente do uploadVideo (config.sistema): aqui qualquer pessoa logada pode
 * contribuir — o arquivo cai no MESMO acervo compartilhado e aparece na lista
 * de todo mundo, e o tamanho/formato passa pela mesma validação.
 */
export const uploadPapel = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().min(1).max(200), dataBase64: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const buf = Buffer.from(data.dataBase64, "base64");
    const info = salvarVideoNovo(data.nome, buf);
    audit({ id: user.id, nome: user.nome }, "papel.upload", "videos", null, { nome: info.nome, mb: info.tamanhoMB });
    return { ok: true, ...info };
  });

/* ————— Papel de parede da Home: escolha de cada usuário ————— */
/* Não é configuração do sistema: cada pessoa escolhe a sua, e por padrão
   ninguém tem nenhuma. Por isso não passa por config.sistema. */

export const getMeuPapel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    return {
      src: getUserConfig(user.id, "papel.src"),
      nome: getUserConfig(user.id, "papel.nome"),
    };
  });

/** Define (ou tira, com nome vazio) o papel de parede de quem está logado. */
export const setMeuPapel = createServerFn({ method: "POST" })
  .validator(z.object({ nome: z.string().max(200) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;

    if (!data.nome) {
      setUserConfig(user.id, "papel.src", "");
      setUserConfig(user.id, "papel.nome", "");
      return { ok: true, src: "", nome: "" };
    }

    const { src, nome } = publicarPapel(data.nome);
    setUserConfig(user.id, "papel.src", src);
    setUserConfig(user.id, "papel.nome", nome);
    return { ok: true, src, nome };
  });

/** Acervo de mídia disponível para escolher — leitura, sem permissão especial. */
export const listPapeis = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async () => ({ videos: listHomeVideoFiles() }));

/* ————— Atalhos do rodapé da Home: escolha de cada usuário ————— */
/* Guardados como uma lista de rótulos separados por "|". Lista vazia = usa os
   atalhos que o painel sugere para o papel selecionado. */

export const getMeusAtalhos = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const cru = getUserConfig(user.id, "home.atalhos");
    return { atalhos: cru ? cru.split("|").filter(Boolean) : [] };
  });

export const setMeusAtalhos = createServerFn({ method: "POST" })
  .validator(z.object({ atalhos: z.array(z.string().max(40)).max(6) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const lista = data.atalhos.map((a) => a.trim()).filter(Boolean).slice(0, 6);
    setUserConfig(user.id, "home.atalhos", lista.join("|"));
    return { ok: true, atalhos: lista };
  });

/* ————— Preferências do usuário (modal Preferências) ————— */
/* O card de avisos era decorativo: "Salvar preferências" não gravava nada.
   Agora tudo mora em user_config (chave "prefs", JSON) e cada opção tem
   efeito de verdade na interface. */

export const getMinhasPrefs = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const cru = getUserConfig(user.id, "prefs");
    let prefs: Record<string, boolean | string> = {};
    try { prefs = cru ? JSON.parse(cru) : {}; } catch { prefs = {}; }
    return { prefs };
  });

export const setMinhasPrefs = createServerFn({ method: "POST" })
  /* 240 e não 60: além dos interruptores, cabe aqui a ordem das colunas de
     Pedidos ("num|cliente|medida|..."), que já nasce com 56 caracteres — no
     limite antigo, a primeira coluna nova estouraria e o salvamento passaria
     a falhar sem ninguém entender por quê. */
  .validator(z.object({ prefs: z.record(z.string().max(40), z.union([z.boolean(), z.string().max(240)])) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    setUserConfig(user.id, "prefs", JSON.stringify(data.prefs));
    return { ok: true };
  });

/* ————— Apresentação do hub (o tour do primeiro acesso e as novidades) —————
   O que cada pessoa já viu, no servidor (user_config, chave "apresentacao"),
   para não repetir noutro computador (Augusto, 06/10/2026). `principal`
   vazio = nunca viu; senão "vista", "pulada" ou "adiada" com a data.
   `novidades`: os tours curtos de mudança já vistos. */
const CHAVE_APRESENTACAO = "apresentacao";

export const getMinhaApresentacao = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const cru = getUserConfig(user.id, CHAVE_APRESENTACAO);
    let principal = "";
    let novidades: string[] = [];
    try {
      const j = cru ? JSON.parse(cru) : null;
      if (j && typeof j.principal === "string") principal = j.principal.slice(0, 40);
      if (j && Array.isArray(j.novidades)) novidades = j.novidades.filter((x: unknown) => typeof x === "string").slice(0, 200);
    } catch { /* o guardado estragou: a apresentação volta, que é o lado seguro */ }
    return { principal, novidades };
  });

export const setMinhaApresentacao = createServerFn({ method: "POST" })
  .validator(z.object({ principal: z.string().max(40), novidades: z.array(z.string().max(60)).max(200) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    setUserConfig(user.id, CHAVE_APRESENTACAO, JSON.stringify({ principal: data.principal, novidades: data.novidades }));
    return { ok: true };
  });

/* ————— Rascunho da Solicitação (o "Salvar" do pé do Novo pedido) —————
   "O salvar salva o que já foi preenchido" (Augusto, 01/10/2026): fica aqui,
   e não no navegador, para valer depois de fechar a aba ou trocar de
   computador. Um por pessoa. Arquivo não entra (só quantos eram). */
const CHAVE_RASCUNHO_PEDIDO = "novo-pedido.rascunho";
/** o formulário inteiro cabe com folga; o limite só barra lixo */
const RASCUNHO_MAX = 60_000;

/** O salvo como texto JSON ("" = nada salvo): objeto livre não passa pela
    serialização das server functions; quem chama converte. */
export const getMeuRascunhoPedido = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    return { json: getUserConfig(user.id, CHAVE_RASCUNHO_PEDIDO) };
  });

/* O formato do rascunho, campo a campo e com teto em cada um (o do
   formulario() da tela). Com objeto livre, um corpo pequeno com referências
   repetidas virava milhões de itens no JSON.stringify antes do teto de
   tamanho (revisão de segurança, 02/10/2026). */
const RascunhoPedido = z.object({
  nome: z.string().max(300),
  briefing: z.string().max(20_000),
  facaCod: z.string().max(80),
  facaNova: z.boolean(),
  largFaca: z.string().max(20),
  altFaca: z.string().max(20),
  formaFaca: z.string().max(60),
  materia: z.string().max(120),
  largura: z.string().max(20),
  carreiras: z.string().max(10),
  qtdCores: z.string().max(4),
  coresTexto: z.string().max(1_000),
  pantSel: z.array(z.string().max(40)).max(40),
  acab: z.record(z.string().max(40), z.boolean()).refine((o) => Object.keys(o).length <= 20, "Acabamentos demais."),
  urgente: z.boolean(),
  larguraExtra: z.string().max(20),
  anexos: z.number().int().min(0).max(1_000),
}).strict();
export type RascunhoPedidoDados = z.infer<typeof RascunhoPedido>;

/** null apaga o rascunho (pedido enviado, ou "começar do zero"). Só quem
    cria pedido salva rascunho de pedido. */
export const setMeuRascunhoPedido = createServerFn({ method: "POST" })
  .validator(z.object({ rascunho: RascunhoPedido.nullable() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.criar");
    if (!data.rascunho) {
      setUserConfig(user.id, CHAVE_RASCUNHO_PEDIDO, "");
      return { ok: true, salvoEm: null as string | null };
    }
    const salvoEm = new Date().toISOString();
    const valor = JSON.stringify({ ...data.rascunho, salvoEm });
    if (valor.length > RASCUNHO_MAX) throw new Error("O pedido ficou grande demais para salvar. Encurte o briefing e tente de novo.");
    setUserConfig(user.id, CHAVE_RASCUNHO_PEDIDO, valor);
    return { ok: true, salvoEm };
  });
