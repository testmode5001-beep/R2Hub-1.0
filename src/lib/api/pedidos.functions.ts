// Pedidos: listagem, detalhe, criação, edição, status e exclusão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, effectivePermissions, getDb, uuid, type LinhaSQL, type Permission } from "@/server/db.server";
import { requirePerm, temPerm, type AuthUser } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { separarCores } from "@/lib/cores";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";
import { clientePastaFullPath, ensureCliente } from "@/server/clientes.server";
import { acharPastaExata, normalizeClienteKey, readClienteFile, saveClienteFile, saveNotaClicheFile } from "@/server/files.server";
import { ehPendente, lerArquivoDoAnexo, removerPendente } from "@/server/anexos-pendentes.server";

/* Os nomes são os da tela 1.0 (cards, faixa, pesquisa do topo e avisos
   dizem a mesma coisa; antes o mesmo status tinha três nomes). */
export const STATUS_LABELS: Record<string, string> = {
  nova: "Aguardando design",
  criacao: "Criação",
  aguardando: "Design criado",
  revisao: "Revisão",
  aprovada: "Aprovado",
  cliche: "Clicheria",
  /* O clichê voltou errado e precisa ser refeito. Sem um status próprio o
     pedido voltaria para "cliche" e ninguém saberia que já foi uma vez —
     é a informação que a clicheria precisa para não repetir o erro. */
  refazer_cliche: "Refazer clichê",
  concluido: "Finalizado",
  cancelado: "Cancelado",
  /* O pedido espera algo do cliente (texto legal, prova física, INCI) e sai
     dele de volta para onde estava. Entrada e saída têm funções próprias
     (aguardarCliente e clienteRespondeu), que guardam a etapa de antes. */
  aguardando_cliente: "Aguardando cliente",
};

/* O que o histórico diz quando a mudança chega sem observação. Antes a linha
   ficava só com a chave do banco ("concluido"). */
const OBS_PADRAO_STATUS: Record<string, string> = {
  nova: "Pedido reativado",
  criacao: "Criação iniciada",
  aguardando: "Arte enviada",
  revisao: "Revisão pedida",
  aprovada: "Arte aprovada",
  cliche: "Enviado para a clicheria",
  refazer_cliche: "Clichê marcado para refação",
  concluido: "Pedido finalizado",
  cancelado: "Pedido cancelado",
};

const STATUS_KEYS = Object.keys(STATUS_LABELS) as [string, ...string[]];
/* "refazer_cliche" entra aqui com "cliche": é o design que marca, e é a
   mesma etapa do fluxo — muda só o sentido da volta. */
const STATUS_DESIGN = ["criacao", "aguardando", "cliche", "refazer_cliche", "concluido"];
const STATUS_APROVACAO = ["aprovada", "revisao"];

/** Cada passo do fluxo tem a sua permissão (além da permissão da etapa). */
const PERM_POR_STATUS: Record<string, Permission> = {
  criacao: "design.assumir",
  aguardando: "design.enviar_arte",
  cliche: "cliche.solicitar",
  refazer_cliche: "cliche.solicitar",
  concluido: "design.arquivo_final",
  aprovada: "pedidos.aprovar",
  revisao: "aprovacao.reprovar",
};

function podeVerTodos(user: AuthUser) {
  return user.role === "admin" || user.permissions.includes("pedidos.ver_todos");
}

function assertAcessoPedido(user: AuthUser, pedido: { vendedor_id: string }) {
  if (podeVerTodos(user)) return;
  if (pedido.vendedor_id !== user.id) throw new Error("Sem acesso a este pedido.");
}

/** "#07": o número do pedido como a tela escreve. Os avisos só traziam o
    cliente, e dois pedidos do mesmo cliente não se distinguiam (simulação de
    28/09/2026). */
const nn = (numero: unknown) => `#${String(numero ?? "").padStart(2, "0")}`;

/** O dia de hoje no relógio do servidor (AAAA-MM-DD, na hora local). */
function diaDeHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* Valor de clichê é de quem tem cliche.valor_ver (a vendedora, no cargo
   padrão, não tem). A lista de pedidos já escondia; o total ainda ia no
   histórico, nos registros do clichê e no aviso da chegada (simulação 3,
   30/09/2026). O histórico guarda o valor para quem pode ver: para os outros,
   ele sai na leitura. */
function semValorDoCliche(observacao: string | number | null): string | number | null {
  if (typeof observacao !== "string") return observacao;
  if (/^Valores do clichê corrigidos:/.test(observacao)) return "Valores do clichê corrigidos";
  /* o total vem no fim ("... Total: R$ 123,45"); corta no último, sem regex:
     a de antes (`\s*` sem âncora) custava N² num texto cheio de espaços */
  const i = observacao.lastIndexOf("Total: R$");
  if (i < 0 || !/^\s?[\d.,]+$/.test(observacao.slice(i + 9))) return observacao;
  return observacao.slice(0, i).trimEnd();
}
function usuarioVeValorDoCliche(userId: string): boolean {
  const u = getDb().prepare("SELECT role FROM users WHERE id = ?").get(userId) as { role: string } | undefined;
  return !!u && (u.role === "admin" || effectivePermissions(userId, u.role).includes("cliche.valor_ver"));
}

/* A linha 'revisao' do histórico que é alteração pedida de verdade: a
   reativação ("Pedido reativado. Volta para Revisão.") e as anotações da
   etapa (resposta ao cliente, prova, chegada do clichê) também gravam a etapa
   e não contam (simulação 6, 07/10/2026; a mesma lista do pedido aberto e dos
   Relatórios). */
const SO_ALTERACAO = ["Pedido reativado", "Resposta ao cliente", "Prova de impressão", "Clichê chegou", "Valores do clichê", "Voltou para a clicheria"]
  .map((inicio) => `COALESCE(h.observacao, '') NOT LIKE '${inicio}%'`).join(" AND ");

export const listPedidos = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    /* O registro de chegada do clichê vem JUNTO (o mais recente de cada
       pedido): sem ele a tela de Aprovação não tinha de onde tirar o valor
       recebido e mostrava um número inventado. */
    const base = `SELECT p.id, p.numero, p.cliente, p.materia, p.largura, p.altura, p.cores, p.cores_desc, p.cores_arte,
                         p.status, p.status_anterior, p.tipo, p.fila, p.designer_id, p.urgente, p.faca_cod, p.faca_nova,
                         /* o cartão de Refazer clichê de cliente antigo: quem o cadastrou
                            (design ou admin) não é vendedora, e o filtro Vendedora o deixa
                            de fora (Augusto, 07/10/2026; a mesma regra dos Relatórios) */
                         (p.tipo = 'cliche' AND EXISTS (SELECT 1 FROM pedido_historico hr
                            WHERE hr.pedido_id = p.id AND hr.status = 'refazer_cliche'
                              AND hr.created_at = p.created_at)) AS cartao_refacao,
                         uv.nome AS vendedor_nome, ud.nome AS designer_nome,
                         /* Resposta que EU ainda não li: pergunta que eu fiz, já
                            respondida depois da última vez que abri o pedido. É
                            o que acende o aviso de mensagem no card. */
                         (SELECT COUNT(*) FROM pedido_perguntas q
                           WHERE q.pedido_id = p.id AND q.de_id = ?1
                             AND q.respondida_em IS NOT NULL
                             AND q.respondida_em > COALESCE(
                               (SELECT v.visto_em FROM pedido_vistos v
                                 WHERE v.pedido_id = p.id AND v.user_id = ?1), '')) AS respostas_novas,
                         p.codigo_produto, p.motivo, p.vendedor_id, p.created_at, p.updated_at,
                         p.cliche_solicitado_em, p.cliche_concluido_em, p.cancelado_em, p.picote,
                         cr.data_chegada AS cliche_data, cr.hora_chegada AS cliche_hora,
                         cr.total AS cliche_total, cr.itens AS cliche_itens,
                         cr.nota_nome AS cliche_nota,
                         /* pergunta esperando resposta aparece na LISTA: dentro
                            da ficha ela só é vista por quem já abriu o pedido */
                         (SELECT COUNT(*) FROM pedido_perguntas q
                           WHERE q.pedido_id = p.id AND q.respondida_em IS NULL) AS perguntas_abertas,
                         /* pergunta esperando EU responder: a marca do card.
                            Sem destinatário (pedido sem designer), ela é do time
                            do design — ?2 diz se eu sou do design. */
                         (SELECT COUNT(*) FROM pedido_perguntas q
                           WHERE q.pedido_id = p.id AND q.respondida_em IS NULL
                             AND (q.para_id = ?1 OR (q.para_id IS NULL AND ?2 = 1))) AS perguntas_para_mim,
                         /* QUANTAS alterações ainda não foram marcadas como
                            resolvidas, e desde quando espera a mais antiga. Na
                            lista um pedido com uma alteração e outro com oito
                            eram a mesma linha. A coluna chave é o id da linha
                            do histórico que pediu a revisão. */
                         (SELECT COUNT(*) FROM pedido_historico h
                           WHERE h.pedido_id = p.id AND h.status = 'revisao' AND ${SO_ALTERACAO}
                             AND h.id NOT IN (SELECT r.chave FROM pedido_revisoes_resolvidas r
                                               WHERE r.pedido_id = p.id)) AS alteracoes_abertas,
                         (SELECT MIN(h.created_at) FROM pedido_historico h
                           WHERE h.pedido_id = p.id AND h.status = 'revisao' AND ${SO_ALTERACAO}
                             AND h.id NOT IN (SELECT r.chave FROM pedido_revisoes_resolvidas r
                                               WHERE r.pedido_id = p.id)) AS alteracao_desde
                  FROM pedidos p
                  /* Nomes de quem vende e quem desenha: o card do 1.0 mostra um
                     dos dois no topo, conforme quem está olhando. */
                  LEFT JOIN users uv ON uv.id = p.vendedor_id
                  LEFT JOIN users ud ON ud.id = p.designer_id
                  LEFT JOIN cliche_registros cr ON cr.id = (
                    SELECT id FROM cliche_registros WHERE pedido_id = p.id ORDER BY created_at DESC LIMIT 1
                  )`;
    /* ?1 é sempre "eu": o subselect de respostas novas usa em toda consulta, e
       o filtro de quem não vê tudo reaproveita o mesmo valor. Por isso as duas
       pontas passam user.id — numerado, para não depender da ordem. */
    const souDoDesign = temPerm(user, "design.assumir") ? 1 : 0;
    const rows = (podeVerTodos(user)
      ? db.prepare(`${base} ORDER BY p.created_at DESC`).all(user.id, souDoDesign)
      : db.prepare(`${base} WHERE p.vendedor_id = ?1 ORDER BY p.created_at DESC`).all(user.id, souDoDesign)) as LinhaSQL[];

    // quem não pode ver valor de clichê recebe a data da chegada, não o dinheiro
    // (a nota da clicheria é o documento do valor — some junto)
    if (!temPerm(user, "cliche.valor_ver")) {
      for (const r of rows) { r.cliche_total = null; r.cliche_itens = null; r.cliche_nota = null; }
    }
    return rows;
  });

export const getPedido = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();

    const pedido = db
      .prepare(
        `SELECT p.*, v.nome AS vendedor_nome, d.nome AS designer_nome
         FROM pedidos p
         LEFT JOIN users v ON v.id = p.vendedor_id
         LEFT JOIN users d ON d.id = p.designer_id
         WHERE p.id = ?`,
      )
      .get(data.id) as LinhaSQL | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido as unknown as { vendedor_id: string });

    const historico = db
      .prepare(
        /* o rowid desempata o mesmo instante, como o reativarPedido lê: a tela
           conta daqui a etapa para onde a reativação volta e tem de chegar na
           mesma (simulação 6, 07/10/2026) */
        "SELECT id, status, observacao, user_nome, created_at FROM pedido_historico WHERE pedido_id = ? ORDER BY created_at ASC, rowid ASC",
      )
      .all(data.id) as LinhaSQL[];

    const anexos = db
      .prepare(
        /* o nome de quem mandou vai junto: a aba Design agrupa as artes por
           versão, com data e autor */
        `SELECT a.id, a.tipo, a.nome, a.path, a.versao, a.created_at, a.user_id, u.nome AS user_nome
         FROM pedido_anexos a LEFT JOIN users u ON u.id = a.user_id
         WHERE a.pedido_id = ? ORDER BY a.created_at DESC`,
      )
      .all(data.id) as LinhaSQL[];

    const comentarios = db
      .prepare(
        "SELECT id, user_nome, texto, canal, created_at FROM pedido_comentarios WHERE pedido_id = ? ORDER BY created_at DESC",
      )
      .all(data.id) as LinhaSQL[];

    const cliches = (
      db
        .prepare(
          "SELECT id, user_nome, data_chegada, hora_chegada, itens, total, nota_nome, created_at FROM cliche_registros WHERE pedido_id = ? ORDER BY created_at DESC",
        )
        .all(data.id) as LinhaSQL[]
    ).map((c) => ({ ...c, itens: JSON.parse(String(c.itens)) as { descricao: string; valor: number }[] }));

    /* Marcas de "revisão resolvida" (modal do pedido v2 → Alterações pedidas).
       `chave` é o id da linha de pedido_historico que pediu a revisão. */
    const revisoesResolvidas = db
      .prepare(
        "SELECT chave, user_nome, created_at FROM pedido_revisoes_resolvidas WHERE pedido_id = ?",
      )
      .all(data.id) as LinhaSQL[];

    let pasta: { nome: string; caminho: string } | null = null;
    if (pedido.cliente_id) {
      const cli = db
        .prepare("SELECT nome, pasta FROM clientes WHERE id = ?")
        .get(pedido.cliente_id as string) as { nome: string; pasta: string } | undefined;
      if (cli) pasta = { nome: cli.nome, caminho: clientePastaFullPath(cli.pasta) };
    }

    const perguntas = db
      .prepare(
        /* de_id/para_id vão junto: a tela 1.0 abre sozinha a pergunta que
           espera por VOCÊ, e nome se repete — id, não. */
        `SELECT id, de_id, para_id, de_nome, para_nome, texto, created_at, resposta, respondida_em, respondida_por_nome
         FROM pedido_perguntas WHERE pedido_id = ? ORDER BY created_at DESC`,
      )
      .all(data.id) as LinhaSQL[];

    /* sem cliche.valor_ver: a chegada fica, o dinheiro sai (ver semValorDoCliche) */
    if (!temPerm(user, "cliche.valor_ver")) {
      return {
        pedido, anexos, comentarios, pasta, revisoesResolvidas, perguntas,
        historico: historico.map((h) => ({ ...h, observacao: semValorDoCliche(h.observacao) })),
        cliches: cliches.map((c) => ({ ...c, itens: [] as { descricao: string; valor: number }[], total: null, nota_nome: null })),
      };
    }
    return { pedido, historico, anexos, comentarios, cliches, pasta, revisoesResolvidas, perguntas };
  });

/* ————— Perguntas do pedido —————
   Uma dúvida do design para quem abriu o pedido (e vice-versa) precisa ter
   dono e estado. Antes ela ia dentro do recado da devolução: virava texto de
   uma linha do histórico, a notificação era a genérica "Pedido atualizado" e
   a pergunta morria ali. */

/** Abre uma pergunta no pedido. Vai para quem abriu o pedido; se quem
    pergunta É quem abriu, vai para o designer (ou para a fila do design). */
export const perguntarNoPedido = createServerFn({ method: "POST" })
  .validator(z.object({ pedidoId: z.string().min(1), texto: z.string().trim().min(1).max(2000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();

    const pedido = db
      .prepare("SELECT id, numero, cliente, vendedor_id, designer_id FROM pedidos WHERE id = ?")
      .get(data.pedidoId) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido as { vendedor_id: string });

    const souDono = pedido.vendedor_id === user.id;
    const paraId = (souDono ? (pedido.designer_id as string | null) : (pedido.vendedor_id as string)) ?? null;
    const nomeDe = (id: string | null) =>
      id
        ? ((db.prepare("SELECT nome FROM users WHERE id = ?").get(id) as { nome: string } | undefined)?.nome ?? null)
        : null;
    const paraNome = nomeDe(paraId);

    const id = uuid();
    const ts = agora();
    const texto = data.texto.trim();
    db.prepare(
      `INSERT INTO pedido_perguntas (id, pedido_id, de_id, de_nome, para_id, para_nome, texto, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).run(id, data.pedidoId, user.id, user.nome, paraId, paraNome, texto, ts);

    /* Entra no histórico também: quem abre o pedido meses depois precisa ver
       que houve uma dúvida e o que foi respondido. */
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.pedidoId, user.id, user.nome, "pergunta", texto, ts);

    /* Título PRÓPRIO: "Pedido atualizado" é o que chega em toda movimentação
       e não faz ninguém entender que a resposta depende dele. */
    const alvos = (paraId ? [paraId] : usersWithRoles(["designer", "gestor", "admin"])).filter(Boolean);
    notifyUsers(
      alvos,
      user.id,
      `Pergunta em ${pedido.cliente}`,
      /* o nome inteiro: com duas vendedoras, o primeiro nome ("Vendas") não
         dizia quem perguntou (simulação 6, 07/10/2026) */
      `${nn(pedido.numero)} · ${user.nome} precisa de uma resposta: ${texto.slice(0, 110)}`,
      `/pedido/${data.pedidoId}`,
    );

    audit({ id: user.id, nome: user.nome }, "pedido.perguntar", "pedido_perguntas", id, {
      pedido: pedido.numero,
      para: paraNome,
    });

    return { id, created_at: ts };
  });

/** Responde uma pergunta aberta e avisa quem perguntou. */
export const responderPergunta = createServerFn({ method: "POST" })
  .validator(z.object({ perguntaId: z.string().min(1), texto: z.string().trim().min(1).max(2000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();

    const pergunta = db
      .prepare("SELECT * FROM pedido_perguntas WHERE id = ?")
      .get(data.perguntaId) as Record<string, unknown> | undefined;
    if (!pergunta) throw new Error("Pergunta não encontrada.");
    if (pergunta.respondida_em) throw new Error("Essa pergunta já foi respondida.");
    /* quem perguntou não responde a própria pergunta: a resposta é de quem
       foi perguntado (a tela oferecia "Responder" aos dois lados) */
    if (pergunta.de_id === user.id) throw new Error("A resposta é de quem recebeu a pergunta.");

    const pedido = db
      .prepare("SELECT id, numero, cliente, vendedor_id FROM pedidos WHERE id = ?")
      .get(pergunta.pedido_id as string) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido as { vendedor_id: string });

    const ts = agora();
    const texto = data.texto.trim();
    db.prepare(
      "UPDATE pedido_perguntas SET resposta = ?, respondida_em = ?, respondida_por_id = ?, respondida_por_nome = ? WHERE id = ?",
    ).run(texto, ts, user.id, user.nome, data.perguntaId);

    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), pedido.id as string, user.id, user.nome, "resposta", texto, ts);

    notifyUsers(
      [pergunta.de_id as string].filter(Boolean) as string[],
      user.id,
      `Resposta em ${pedido.cliente}`,
      /* o nome inteiro, como na pergunta */
      `${nn(pedido.numero)} · ${user.nome}: ${texto.slice(0, 120)}`,
      `/pedido/${pedido.id as string}`,
    );

    audit({ id: user.id, nome: user.nome }, "pedido.responder", "pedido_perguntas", data.perguntaId, {
      pedido: pedido.numero,
    });

    return { ok: true };
  });

// Marca (ou desmarca) uma revisão pedida como resolvida. Não muda o status do
// pedido nem apaga nada: é a lista de recados que o designer vai riscando
// conforme atende. Fica gravado com o nome de quem marcou.
export const resolverRevisao = createServerFn({ method: "POST" })
  .validator(z.object({
    pedidoId: z.string().min(1),
    chave: z.string().min(1),
    resolvida: z.boolean(),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    /* quem risca é quem atende a revisão: a mesma permissão com que a tela
       1.0 mostra o botão (a antiga mostra a todos e desfaz a marca se o
       servidor recusar) */
    requirePerm(user, "pedidos.status_design");
    const db = getDb();

    const pedido = db
      .prepare("SELECT id, numero, vendedor_id FROM pedidos WHERE id = ?")
      .get(data.pedidoId) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido as { vendedor_id: string });

    if (data.resolvida) {
      db.prepare(
        `INSERT INTO pedido_revisoes_resolvidas (pedido_id, chave, user_id, user_nome, created_at)
         VALUES (?,?,?,?,?)
         ON CONFLICT(pedido_id, chave) DO UPDATE SET user_id = excluded.user_id, user_nome = excluded.user_nome, created_at = excluded.created_at`,
      ).run(data.pedidoId, data.chave, user.id, user.nome, agora());
    } else {
      db.prepare("DELETE FROM pedido_revisoes_resolvidas WHERE pedido_id = ? AND chave = ?")
        .run(data.pedidoId, data.chave);
    }

    return { ok: true };
  });

/* ————— Transferir carteira —————
   Cliente não tem dono no banco: quem "é" da vendedora são os PEDIDOS dela
   (`pedidos.vendedor_id`). E esse campo não é só etiqueta — quem não tem
   `pedidos.ver_todos` só enxerga os próprios pedidos, então transferir muda
   quem vê o quê. Por isso a operação tem permissão própria, deixa rastro no
   histórico de cada pedido e avisa as duas pontas. */

/** Quem pode ter carteira, com o tamanho dela. Lista própria porque
    `listUsuarios` exige `usuarios.gerenciar` — poder bem maior do que o
    necessário só para escolher origem e destino numa transferência. */
export const listDonosPedidos = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.transferir");
    return getDb()
      .prepare(
        `SELECT u.id, u.nome, u.role, u.ativo,
                (SELECT COUNT(*) FROM pedidos p WHERE p.vendedor_id = u.id) AS pedidos,
                (SELECT COUNT(DISTINCT p.cliente) FROM pedidos p WHERE p.vendedor_id = u.id) AS clientes
           FROM users u
          ORDER BY u.ativo DESC, u.nome COLLATE NOCASE`,
      )
      .all() as LinhaSQL[];
  });

/** Os clientes de uma vendedora, com quanto vem junto em cada um. */
export const listCarteira = createServerFn({ method: "POST" })
  .validator(z.object({ vendedorId: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.transferir");
    return getDb()
      .prepare(
        `SELECT p.cliente,
                COUNT(*) AS total,
                SUM(CASE WHEN p.status IN ('concluido','cancelado') THEN 0 ELSE 1 END) AS abertos
           FROM pedidos p
          WHERE p.vendedor_id = ?
          GROUP BY p.cliente
          ORDER BY p.cliente COLLATE NOCASE`,
      )
      .all(data.vendedorId) as LinhaSQL[];
  });

export const transferirCarteira = createServerFn({ method: "POST" })
  .validator(z.object({
    deId: z.string().min(1),
    paraId: z.string().min(1),
    clientes: z.array(z.string().min(1)).min(1),
    /** true = deixa o que já foi entregue com quem atendeu na época */
    somenteAbertos: z.boolean().optional(),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.transferir");
    if (data.deId === data.paraId) throw new Error("A origem e o destino são a mesma pessoa.");

    const db = getDb();
    const de = db.prepare("SELECT id, nome FROM users WHERE id = ?").get(data.deId) as LinhaSQL | undefined;
    const para = db.prepare("SELECT id, nome, ativo FROM users WHERE id = ?").get(data.paraId) as LinhaSQL | undefined;
    if (!de) throw new Error("Não achei quem está entregando a carteira.");
    if (!para) throw new Error("Não achei quem vai receber a carteira.");
    /* transferir para alguém desligado esconderia os pedidos de todo mundo:
       ninguém entraria na conta para vê-los */
    if (Number(para.ativo) === 0) throw new Error(`${String(para.nome)} está inativa. Reative antes de transferir.`);

    const marcas = data.clientes.map(() => "?").join(",");
    const filtroAberto = data.somenteAbertos ? " AND status NOT IN ('concluido','cancelado')" : "";
    const alvos = db
      .prepare(`SELECT id, numero, cliente, status FROM pedidos
                 WHERE vendedor_id = ? AND cliente IN (${marcas})${filtroAberto}
                 ORDER BY numero`)
      .all(data.deId, ...data.clientes) as LinhaSQL[];

    if (!alvos.length) throw new Error("Nenhum pedido para transferir com esses filtros.");

    const ts = agora();
    const mover = db.prepare("UPDATE pedidos SET vendedor_id = ?, updated_at = ? WHERE id = ?");
    /* `status` do histórico é lido por outras consultas (a contagem de
       alterações em aberto filtra por 'revisao'). Um valor PRÓPRIO mantém o
       rastro sem entrar no fluxo do pedido. */
    const registrar = db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    );
    /* só as duas pontas: a linha do histórico já é rotulada "Carteira
       transferida", e repetir a frase inteira ficava "Carteira transferida —
       Carteira transferida de X para Y" */
    const recado = `De ${String(de.nome)} para ${String(para.nome)}`;

    const transacao = db.prepare("BEGIN");
    transacao.run();
    try {
      for (const p of alvos) {
        mover.run(data.paraId, ts, p.id as string);
        registrar.run(uuid(), p.id as string, user.id, user.nome, "transferencia", recado, ts);
      }
      db.prepare("COMMIT").run();
    } catch (e) {
      db.prepare("ROLLBACK").run();
      throw e;
    }

    const clientesTocados = [...new Set(alvos.map((p) => String(p.cliente)))];
    notifyUsers(
      [data.paraId],
      user.id,
      `Você recebeu ${alvos.length} ${alvos.length === 1 ? "pedido" : "pedidos"}`,
      `${clientesTocados.join(", ")}. ${alvos.length === 1 ? "Vindo" : "Vindos"} de ${String(de.nome)}.`,
      "/hub?tela=pedidos10",
    );
    notifyUsers(
      [data.deId],
      user.id,
      `${alvos.length} ${alvos.length === 1 ? "pedido saiu" : "pedidos saíram"} da sua carteira`,
      `${clientesTocados.join(", ")}. Agora com ${String(para.nome)}.`,
      "/hub?tela=pedidos10",
    );

    audit({ id: user.id, nome: user.nome }, "pedido.transferir", "pedidos", data.deId, {
      de: de.nome,
      para: para.nome,
      clientes: clientesTocados,
      pedidos: alvos.map((p) => p.numero),
      somenteAbertos: !!data.somenteAbertos,
    });

    return { movidos: alvos.length, clientes: clientesTocados, para: String(para.nome) };
  });

// Caixa de entrada do topo (modal Mensagens do v1a): uma conversa por pedido,
// formada pelos comentários internos. O protótipo desenha "conversas com o
// cliente"; aqui elas são as conversas DA EQUIPE sobre cada pedido — é o que
// existe de fato no sistema (não há canal externo de e-mail/WhatsApp).
export const listConversas = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    // LEFT JOIN de propósito: pedido ainda sem recado também entra na lista —
    // é assim que se COMEÇA uma conversa. Com INNER JOIN o chat nascia vazio.
    const base = `SELECT p.id, p.numero, p.cliente, p.status, MAX(c.created_at) AS ultima
                  FROM pedidos p LEFT JOIN pedido_comentarios c ON c.pedido_id = p.id`;
    const fim = `GROUP BY p.id
                 ORDER BY (ultima IS NULL), COALESCE(ultima, p.updated_at) DESC
                 LIMIT 20`;
    // sem placeholder quando o usuário vê todos — o SQLite recusa parâmetro extra
    const pedidos = (podeVerTodos(user)
      ? db.prepare(`${base} ${fim}`).all()
      : db.prepare(`${base} WHERE p.vendedor_id = ? ${fim}`).all(user.id)) as {
        id: string; numero: number; cliente: string; status: string;
      }[];

    const porPedido = db.prepare(
      "SELECT id, user_id, user_nome, texto, canal, created_at FROM pedido_comentarios WHERE pedido_id = ? ORDER BY created_at ASC LIMIT 50",
    );
    return pedidos.map((p) => ({
      id: p.id,
      numero: p.numero,
      cliente: p.cliente,
      status: p.status,
      mensagens: porPedido.all(p.id) as {
        id: string; user_id: string | null; user_nome: string | null; texto: string; created_at: string;
      }[],
    }));
  });

// Comentário interno do pedido: recado para a equipe SEM mudar o status
// (a modal Pedido do v1a publica aqui). Notifica vendedor, designer e gestão.
export const comentarPedido = createServerFn({ method: "POST" })
  .validator(z.object({ pedidoId: z.string().min(1), texto: z.string().trim().min(1).max(2000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();

    const pedido = db
      .prepare("SELECT id, numero, cliente, vendedor_id, designer_id FROM pedidos WHERE id = ?")
      .get(data.pedidoId) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido as { vendedor_id: string });

    const id = uuid();
    const ts = agora();
    db.prepare(
      "INSERT INTO pedido_comentarios (id, pedido_id, user_id, user_nome, texto, created_at) VALUES (?,?,?,?,?,?)",
    ).run(id, data.pedidoId, user.id, user.nome, data.texto.trim(), ts);

    const alvos = [
      pedido.vendedor_id as string,
      pedido.designer_id as string | null,
      ...usersWithRoles(["gestor", "admin"]),
    ].filter(Boolean) as string[];
    notifyUsers(
      alvos,
      user.id,
      `Comentário em ${pedido.cliente}`,
      `${user.nome}: ${data.texto.trim().slice(0, 120)}`,
      `/pedido/${data.pedidoId}`,
    );

    audit({ id: user.id, nome: user.nome }, "pedido.comentar", "pedido_comentarios", id, {
      pedido: pedido.numero,
    });

    return { id, created_at: ts };
  });

// Resposta ao cliente: mesma conversa do pedido, marcada como canal "cliente"
// (o que foi dito PARA o cliente, não recado interno). É o que dá efeito à
// permissão "Responder o cliente" da tela Equipe.
export const responderCliente = createServerFn({ method: "POST" })
  .validator(z.object({ pedidoId: z.string().min(1), texto: z.string().trim().min(1).max(2000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "aprovacao.responder_cliente");
    const db = getDb();

    const pedido = db
      .prepare("SELECT id, numero, cliente, status, vendedor_id, designer_id FROM pedidos WHERE id = ?")
      .get(data.pedidoId) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");

    const texto = data.texto.trim();
    const ts = agora();
    const id = uuid();
    db.prepare(
      "INSERT INTO pedido_comentarios (id, pedido_id, user_id, user_nome, texto, created_at, canal) VALUES (?,?,?,?,?,?,'cliente')",
    ).run(id, data.pedidoId, user.id, user.nome, texto, ts);
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.pedidoId, user.id, user.nome, String(pedido.status ?? ""), `Resposta ao cliente: ${texto.slice(0, 300)}`, ts);

    const alvos = [
      pedido.vendedor_id as string,
      pedido.designer_id as string | null,
      ...usersWithRoles(["gestor", "admin"]),
    ].filter(Boolean) as string[];
    notifyUsers(
      alvos, user.id,
      `Resposta ao cliente · ${pedido.cliente}`,
      `${user.nome}: ${texto.slice(0, 120)}`,
      `/pedido/${data.pedidoId}`,
    );

    audit({ id: user.id, nome: user.nome }, "pedido.responder_cliente", "pedido_comentarios", id, {
      pedido: pedido.numero,
    });
    return { id, created_at: ts };
  });

// Prova de impressão enviada ao cliente: fica no histórico do pedido (quem
// mandou e quando), que é o registro que a produção cobra depois. Dá efeito à
// permissão "Enviar prova de impressão".
export const registrarProvaImpressao = createServerFn({ method: "POST" })
  .validator(z.object({ pedidoId: z.string().min(1), observacao: z.string().trim().max(500).nullish() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "aprovacao.prova_enviar");
    const db = getDb();

    const pedido = db
      .prepare("SELECT id, numero, cliente, status, vendedor_id, designer_id FROM pedidos WHERE id = ?")
      .get(data.pedidoId) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");

    const obs = (data.observacao ?? "").trim();
    const ts = agora();
    const id = uuid();
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(id, data.pedidoId, user.id, user.nome, String(pedido.status ?? ""),
      obs ? `Prova de impressão enviada ao cliente: ${obs}` : "Prova de impressão enviada ao cliente", ts);

    const alvos = [
      pedido.vendedor_id as string,
      pedido.designer_id as string | null,
      ...usersWithRoles(["gestor", "admin"]),
    ].filter(Boolean) as string[];
    notifyUsers(
      alvos, user.id,
      `Prova enviada · ${pedido.cliente}`,
      `${user.nome} enviou a prova de impressão do pedido #${String(pedido.numero).padStart(4, "0")}.`,
      `/pedido/${data.pedidoId}`,
    );

    audit({ id: user.id, nome: user.nome }, "pedido.prova_enviar", "pedido_historico", id, {
      pedido: pedido.numero,
    });
    return { id, created_at: ts };
  });

export const registrarCliche = createServerFn({ method: "POST" })
  .validator(
    z.object({
      pedidoId: z.string().min(1),
      dataChegada: z.string().min(1),
      horaChegada: z.string().min(1),
      itens: z
        .array(
          z.object({
            descricao: z.string().min(1),
            valor: z.number().nonnegative(),
          }),
        )
        .min(1),
      /* A ordem de serviço da clicheria, quando o registro veio dela.
         ~35 MB de PDF → ~47 MB em base64; notas têm dezenas de KB. */
      nota: z
        .object({ nome: z.string().min(1), dataBase64: z.string().min(1).max(50_000_000) })
        .nullish(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    // registrar a chegada é uma coisa; lançar os valores é outra
    requirePerm(user, "cliche.registrar");
    if (data.itens.some((i) => Number(i.valor) > 0)) requirePerm(user, "cliche.valor_editar");

    const db = getDb();
    const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(data.pedidoId) as
      | Record<string, unknown>
      | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    /* Chegada depois de hoje não existe: um ano digitado errado (31/12/2030)
       tirava o gasto do clichê dos relatórios do mês (simulação 6,
       07/10/2026). Hoje é o dia no relógio do servidor, que fica na fábrica. */
    if (/^\d{4}-\d{2}-\d{2}$/.test(data.dataChegada) && data.dataChegada > diaDeHoje()) {
      throw new Error("A data da chegada não pode ser depois de hoje.");
    }

    const total = data.itens.reduce((s, i) => s + i.valor, 0);
    const ts = agora();
    const id = uuid();
    /* Um clichê chega UMA vez: "Editar valores" é correção, não uma segunda
       chegada. Sem apagar o anterior, o mesmo clichê era somado duas vezes nos
       relatórios de gasto. O que foi corrigido continua rastreável na auditoria
       e no histórico do pedido. */
    const anteriores = db
      .prepare("SELECT id, total, nota_nome, nota_path FROM cliche_registros WHERE pedido_id = ?")
      .all(data.pedidoId) as { id: string; total: number; nota_nome: string | null; nota_path: string | null }[];

    /* A nota vai para a rede ANTES do banco: se a gravação falhar, o registro
       não entra dizendo que existe um comprovante que não existe. Corrigir
       valores sem mandar a nota de novo mantém a que já estava guardada. */
    let notaNome = anteriores.length ? anteriores[anteriores.length - 1].nota_nome : null;
    let notaPath = anteriores.length ? anteriores[anteriores.length - 1].nota_path : null;
    if (data.nota) {
      const salva = saveNotaClicheFile(
        Number(pedido.numero),
        data.nota.nome,
        Buffer.from(data.nota.dataBase64, "base64"),
      );
      notaNome = salva.nomeSalvo;
      notaPath = salva.fullPath;
    }

    if (anteriores.length) db.prepare("DELETE FROM cliche_registros WHERE pedido_id = ?").run(data.pedidoId);
    db.prepare(
      "INSERT INTO cliche_registros (id, pedido_id, user_id, user_nome, data_chegada, hora_chegada, itens, total, nota_nome, nota_path, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id, data.pedidoId, user.id, user.nome, data.dataChegada, data.horaChegada,
      JSON.stringify(data.itens), total, notaNome, notaPath, ts,
    );

    const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
    const correcao = anteriores.length > 0;
    const antes = correcao ? anteriores[anteriores.length - 1].total : null;
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      uuid(), data.pedidoId, user.id, user.nome, pedido.status as string,
      correcao
        ? `Valores do clichê corrigidos: de ${fmtBRL(Number(antes))} para ${fmtBRL(total)}`
        : `Clichê chegou em ${data.dataChegada.split("-").reverse().join("/")} às ${data.horaChegada}. Total: ${fmtBRL(total)}`,
      ts,
    );

    /* O total só para quem vê valor de clichê. Quem não vê fica sabendo da
       chegada, sem o dinheiro, e não recebe a correção de valor (para ela
       não muda nada). */
    const avisar = [...new Set([pedido.vendedor_id as string, ...usersWithRoles(["gestor", "admin"])])];
    const veValor = avisar.filter(usuarioVeValorDoCliche);
    const titulo = correcao ? "Valor do clichê corrigido" : "Clichê chegou";
    notifyUsers(veValor, user.id, titulo, `${nn(pedido.numero)} · ${pedido.cliente}: total ${fmtBRL(total)}`, `/pedido/${data.pedidoId}`);
    if (!correcao) {
      notifyUsers(
        avisar.filter((id) => !veValor.includes(id)),
        user.id,
        titulo,
        `${nn(pedido.numero)} · ${pedido.cliente}: chegou em ${data.dataChegada.split("-").reverse().join("/")} às ${data.horaChegada}`,
        `/pedido/${data.pedidoId}`,
      );
    }

    audit({ id: user.id, nome: user.nome }, correcao ? "cliche.corrigir" : "cliche.registrar", "cliche_registros", id, {
      pedido: pedido.numero,
      data: data.dataChegada,
      hora: data.horaChegada,
      itens: data.itens,
      total,
      ...(notaNome ? { nota: notaNome, notaCaminho: notaPath, notaNova: !!data.nota } : {}),
      ...(correcao ? { totalAnterior: antes, registrosSubstituidos: anteriores.map((a) => a.id) } : {}),
    });

    return { id, total, nota: notaNome };
  });

/**
 * Abre a nota da clicheria guardada no registro de chegada.
 *
 * Mesma régua da listagem: quem não pode ver valor de clichê não vê a nota,
 * que é justamente o papel com os valores.
 */
export const baixarNotaCliche = createServerFn({ method: "POST" })
  .validator(z.object({ pedidoId: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cliche.valor_ver");

    const db = getDb();
    const pedido = db.prepare("SELECT id, vendedor_id FROM pedidos WHERE id = ?").get(data.pedidoId) as
      | { id: string; vendedor_id: string }
      | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido);

    const registro = db
      .prepare(
        "SELECT nota_nome, nota_path FROM cliche_registros WHERE pedido_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(data.pedidoId) as { nota_nome: string | null; nota_path: string | null } | undefined;
    if (!registro?.nota_path) throw new Error("Este registro não tem nota guardada.");

    return {
      nome: registro.nota_nome ?? "nota.pdf",
      dataBase64: readClienteFile(registro.nota_path).toString("base64"),
    };
  });

/**
 * Devolve o pedido para "enviados à clicheria": apaga o registro de chegada e
 * volta o status. Existe porque clique errado acontece — sem isso a única
 * saída seria mexer no banco. O que aconteceu não some: fica no histórico do
 * pedido, com quem desfez e quando.
 */
export const voltarParaClicheria = createServerFn({ method: "POST" })
  .validator(z.object({ pedidoId: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    // quem registra a chegada é quem pode desfazê-la; e tirar de "concluído"
    // é reabrir pedido, que tem permissão própria
    requirePerm(user, "cliche.registrar");
    requirePerm(user, "pedidos.reabrir");

    const db = getDb();
    const pedido = db.prepare("SELECT id, numero, cliente, status FROM pedidos WHERE id = ?").get(data.pedidoId) as
      | { id: string; numero: number; cliente: string; status: string }
      | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");

    const registro = db
      .prepare(
        "SELECT id, data_chegada, hora_chegada, total FROM cliche_registros WHERE pedido_id = ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(data.pedidoId) as
      | { id: string; data_chegada: string; hora_chegada: string; total: number }
      | undefined;

    const ts = agora();
    /* Some o registro, não a nota: o PDF continua em _Notas da Clicheria e a
       auditoria guarda o caminho. Registrar a chegada de novo grava a nota
       nova ao lado da antiga. */
    if (registro) db.prepare("DELETE FROM cliche_registros WHERE id = ?").run(registro.id);
    db.prepare("UPDATE pedidos SET status = 'cliche', updated_at = ? WHERE id = ?").run(ts, data.pedidoId);

    const eraQuando = registro
      ? ` (chegada era ${registro.data_chegada.split("-").reverse().join("/")} às ${registro.hora_chegada})`
      : "";
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(
      uuid(), data.pedidoId, user.id, user.nome, "cliche",
      `Voltou para a clicheria. Registro de chegada desfeito${eraQuando}`,
      ts,
    );

    audit({ id: user.id, nome: user.nome }, "cliche.voltar_clicheria", "pedidos", data.pedidoId, {
      pedido: pedido.numero,
      cliente: pedido.cliente,
      statusAnterior: pedido.status,
      registroApagado: registro?.id ?? null,
      total: registro?.total ?? null,
    });

    return { ok: true };
  });

const pedidoFields = {
  cliente: z.string().min(1),
  materia: z.string().min(1),
  larg_materia: z.string().min(1),
  largura: z.string().min(1),
  altura: z.string().min(1),
  forma: z.string().min(1),
  cores: z.string().min(1),
  cores_desc: z.string().nullish(),
  carreiras: z.string().nullish(),
  descricao: z.string().min(1),
  link_ref: z.string().nullish(),
  /** "1" quando a etiqueta leva tarja no verso */
  tarja_verso: z.string().nullish(),
  /** "1" quando leva verniz */
  verniz: z.string().nullish(),
  /** "1" quando leva cold stamp */
  cold_stamp: z.string().nullish(),
  picote: z.string().nullish(),
  /** "1" quando o pedido é urgente */
  urgente: z.string().nullish(),
  /** código da faca do catálogo (vazio = faca nova ou sem faca) */
  faca_cod: z.string().trim().max(60).nullish(),
  /** "1" quando a faca ainda vai ser feita (a medida foi digitada) */
  faca_nova: z.string().nullish(),
};

export const createPedido = createServerFn({ method: "POST" })
  .validator(z.object({
    ...pedidoFields,
    /* Pasta de cliente escolhida na lista da rede. Vazio = criar uma pasta
       nova com o nome digitado (a tela avisa quando existe alguma parecida). */
    pasta: z.string().trim().max(200).nullish(),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.criar");

    const db = getDb();
    /* O pedido nasce SEM pasta (cliente_id vazio): quem cria e escolhe a
       pasta é o designer, no "Iniciar criação" (confirmarPastaCliente).
       Criar aqui, com o nome que a vendedora digita, encheu o share de
       duplicatas — "Toninho Sorvetes - Renata" ao lado de "Toninho
       Sorvetes", "Bronzemax Retangular" e "Bronzemax Redonda" para um
       Bronzemax só (Augusto, 25/09/2026). Nada é gravado no share aqui.
       Se a tela mandou uma pasta que existe, o nome dela vira o texto do
       cliente — e o designer a encontra já marcada na hora de confirmar. */
    const pastaIndicada = data.pasta ? acharPastaExata(data.pasta) : null;
    const nomeCliente = (pastaIndicada ?? data.cliente).trim();

    const id = uuid();
    const ts = agora();
    const { numero } = db
      .prepare("SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM pedidos")
      .get() as { numero: number };

    db.prepare(
      `INSERT INTO pedidos (id, numero, vendedor_id, cliente_id, cliente, materia, larg_materia,
        largura, altura, forma, cores, cores_desc, carreiras, descricao, link_ref, tarja_verso, verniz, cold_stamp, picote,
        urgente, faca_cod, faca_nova, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'nova',?,?)`,
    ).run(
      id, numero, user.id, null, nomeCliente, data.materia, data.larg_materia,
      data.largura, data.altura, data.forma, data.cores, data.cores_desc ?? null,
      data.carreiras ?? null, data.descricao, data.link_ref ?? null,
      data.tarja_verso === "1" ? 1 : 0, data.verniz === "1" ? 1 : 0,
      data.cold_stamp === "1" ? 1 : 0, data.picote === "1" ? 1 : 0,
      data.urgente === "1" ? 1 : 0, (data.faca_cod ?? "").trim() || null, data.faca_nova === "1" ? 1 : 0, ts, ts,
    );

    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), id, user.id, user.nome, "nova", data.urgente === "1" ? "Pedido criado (urgente)" : "Pedido criado", ts);

    notifyUsers(
      usersWithRoles(["designer", "gestor", "admin"]),
      user.id,
      data.urgente === "1" ? "Nova solicitação urgente" : "Nova solicitação",
      `${nn(numero)} · ${data.cliente}: ${data.materia} ${data.largura}×${data.altura}mm`,
      `/pedido/${id}`,
    );
    audit({ id: user.id, nome: user.nome }, "pedido.criar", "pedidos", id, {
      numero,
      cliente: nomeCliente,
      digitado: data.cliente,
      pasta: "a confirmar pelo design",
    });

    return { id, numero, pastaCliente: null };
  });

/* ————— A pasta do cliente, escolhida pelo designer —————
   Chamado no "Iniciar criação". O designer aponta uma pasta que já existe no
   share, ou manda criar uma nova; o hub:
     1. registra o cliente (e garante a subpasta Referências);
     2. liga o pedido a ele, e o nome do pedido passa a ser o da pasta — o que
        aparece na tela e o lugar dos arquivos nunca divergem;
     3. leva os anexos que esperavam na pasta do hub para Referências.
   A mudança de status é outro passo (changeStatus → criacao), que exige
   esta confirmação. Pedido que já tem pasta passa direto. */
export const confirmarPastaCliente = createServerFn({ method: "POST" })
  .validator(z.object({
    pedidoId: z.string().min(1),
    /** pasta que já existe no share */
    pasta: z.string().trim().max(200).nullish(),
    /** ou o nome de uma pasta nova */
    novaPasta: z.string().trim().max(200).nullish(),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "design.assumir");
    const db = getDb();
    const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(data.pedidoId) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    if (!data.pasta && !data.novaPasta) throw new Error("Escolha a pasta do cliente ou dê o nome da nova.");
    /* aba velha: o pedido foi cancelado depois que a tela abriu */
    if (pedido.status === "cancelado") throw new Error("Pedido cancelado. Reative o pedido antes.");
    /* Pasta já confirmada (outra aba, outro designer): não troca por cima.
       Trocar mudaria o nome do pedido e deixaria os arquivos na primeira. */
    if (pedido.cliente_id) {
      const ja = db.prepare("SELECT nome FROM clientes WHERE id = ?").get(pedido.cliente_id as string) as { nome: string } | undefined;
      throw new Error(`A pasta deste pedido já foi confirmada${ja ? ` (${ja.nome})` : ""}. Atualize a página.`);
    }

    const ator = { id: user.id, nome: user.nome };
    let cliente;
    if (data.pasta) {
      cliente = ensureCliente(ator, data.pasta, data.pasta);
    } else {
      /* Nome novo que por acaso já é uma pasta (mesmo nome, outra caixa):
         usa a que existe. É exatamente o caso que gerava a duplicata. */
      const jaExiste = acharPastaExata(data.novaPasta!);
      cliente = jaExiste ? ensureCliente(ator, jaExiste, jaExiste) : ensureCliente(ator, data.novaPasta!);
    }
    const nomeAntes = String(pedido.cliente ?? "");
    const tsPasta = agora();
    db.prepare("UPDATE pedidos SET cliente_id = ?, cliente = ?, updated_at = ? WHERE id = ?")
      .run(cliente.id, cliente.nome, tsPasta, data.pedidoId);
    /* O nome do cliente passa a ser o da pasta. Quem abre o pedido precisa
       ver isso no Histórico: "Farmácia de Manipulação Vida & Saúde" virava
       "Farmácia Vida & Saúde" sem rastro nenhum (simulação de 28/09/2026). */
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.pedidoId, user.id, user.nome, "pasta",
      nomeAntes && nomeAntes !== cliente.nome
        ? `Pasta do cliente: ${cliente.nome}. O nome do cliente era "${nomeAntes}".`
        : `Pasta do cliente: ${cliente.nome}.`,
      tsPasta);
    /* A vendedora escreveu um nome e o pedido passou a ter outro: ela precisa
       saber, senão procura pelo nome antigo e não acha (simulação de
       28/09/2026). */
    if (nomeAntes && nomeAntes !== cliente.nome) {
      notifyUsers(
        [pedido.vendedor_id as string].filter(Boolean),
        user.id,
        "Nome do cliente ajustado",
        `${nn(pedido.numero)} · "${nomeAntes}" agora é "${cliente.nome}", o nome da pasta do cliente.`,
        `/pedido/${data.pedidoId}`,
      );
    }

    /* Os anexos que esperavam no hub vão para Referências (a arte, se houver,
       vai para a pasta de arte). Um por vez: o que falhar continua esperando
       no hub e é contado — nenhum se perde no caminho. */
    const pastaCliente = clientePastaFullPath(cliente.pasta);
    const pendentes = (db.prepare("SELECT id, tipo, nome, path FROM pedido_anexos WHERE pedido_id = ?")
      .all(data.pedidoId) as { id: string; tipo: string; nome: string; path: string }[])
      .filter((a) => ehPendente(a.path));
    let movidos = 0;
    const falhas: string[] = [];
    for (const a of pendentes) {
      try {
        const conteudo = lerArquivoDoAnexo(a.path);
        const salvo = saveClienteFile(pastaCliente, a.tipo === "arte" ? "arte" : "referencia", a.nome, conteudo);
        db.prepare("UPDATE pedido_anexos SET path = ?, nome = ? WHERE id = ?").run(salvo.fullPath, salvo.nomeSalvo, a.id);
        removerPendente(a.path);
        movidos++;
      } catch (e) {
        falhas.push(`${a.nome} (${e instanceof Error ? e.message : "erro"})`);
      }
    }

    audit(ator, "pedido.confirmar_pasta", "pedidos", data.pedidoId, {
      numero: pedido.numero,
      pasta: pastaCliente,
      nomeAntes,
      nomeAgora: cliente.nome,
      anexosMovidos: movidos,
      falhas,
    });
    return { pasta: cliente.nome, caminho: pastaCliente, movidos, falhas };
  });

// Solicitação de clichê danificado em produção. Vira um pedido "tipo=cliche"
// que chega ao designer como uma arte nova (mesmas notificações), mas carrega
// apenas cliente/arte + código do produto — sem specs de etiqueta.
export const solicitarCliche = createServerFn({ method: "POST" })
  .validator(z.object({ cliente: z.string().min(1), codigo: z.string().min(1), motivo: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "cliche.reposicao");

    const db = getDb();
    /* A pasta do cliente só nasce no "Iniciar criação", confirmada pelo
       designer (regra da casa). A reposição usa o cliente que já existe com
       esse nome; sem ele, o pedido nasce sem pasta, como qualquer outro.
       Antes o ensureCliente criava a pasta no share com o nome digitado. */
    const cliente = db.prepare("SELECT id FROM clientes WHERE nome_norm = ?")
      .get(normalizeClienteKey(data.cliente)) as { id: string } | undefined;

    const id = uuid();
    const ts = agora();
    const codigo = data.codigo.trim();
    const motivo = data.motivo.trim();
    const { numero } = db
      .prepare("SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM pedidos")
      .get() as { numero: number };

    // Campos NOT NULL de etiqueta não se aplicam aqui — vão como "—".
    db.prepare(
      `INSERT INTO pedidos (id, numero, vendedor_id, cliente_id, cliente, materia, larg_materia,
        largura, altura, forma, cores, cores_desc, carreiras, descricao, link_ref, status, tipo,
        codigo_produto, motivo, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      id, numero, user.id, cliente?.id ?? null, data.cliente.trim(), "—", "—", "—", "—", "—", "—",
      null, null, `Reposição de clichê danificado em produção. Código: ${codigo}. Motivo: ${motivo}.`, null,
      "nova", "cliche", codigo, motivo, ts, ts,
    );

    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), id, user.id, user.nome, "nova", "Solicitação de clichê criada", ts);

    notifyUsers(
      usersWithRoles(["designer", "gestor", "admin"]),
      user.id,
      "Solicitação de clichê",
      `${data.cliente}: código ${codigo}`,
      `/pedido/${id}`,
    );
    audit({ id: user.id, nome: user.nome }, "cliche.solicitar", "pedidos", id, {
      numero,
      cliente: data.cliente,
      codigo,
    });

    return { id, numero };
  });

/* Refazer clichê de cliente antigo (Augusto, 02/10/2026): o clichê se danifica
   no manuseio ou gasta, e o cliente mais antigo não está no hub, então não há
   pedido para marcar "Refazer clichê". O designer cadastra o cartão direto em
   Aprovações, no status "refazer_cliche", com cliente, as cores a refazer e o
   motivo da lista do hub antigo (o código do clichê saiu: "desnecessário"); dali em diante o cartão segue
   como os outros de Aprovações. O motivo vai no histórico com o mesmo texto do
   "Refazer clichê" de dentro do pedido, e os relatórios contam as duas origens
   juntas. Só designers e admin (decisão dele). */
export const cadastrarRefazerCliche = createServerFn({ method: "POST" })
  .validator(z.object({
    cliente: z.string().trim().min(1).max(200),
    cores: z.array(z.string().trim().min(1).max(60)).min(1).max(12),
    motivo: z.string().trim().min(1).max(60),
    /* motivo que não está na lista, escrito à mão (Augusto, 02/10/2026) */
    motivoLivre: z.boolean().optional(),
    observacao: z.string().trim().max(200).nullish(),
  }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    if (user.role !== "designer" && user.role !== "admin") throw new Error("Só o design cadastra refação de clichê.");
    /* e com a permissão de design (o gestor pode tirá-la na Equipe), a mesma
       que a refação de dentro do pedido pede */
    requirePerm(user, "pedidos.status_design");

    const db = getDb();
    /* da lista, tem que existir nela; escrito à mão, sem parênteses (o
       relatório lê o motivo até o "(" da observação) */
    const motivo = data.motivoLivre ? data.motivo.replace(/[()]/g, "").trim() : data.motivo;
    if (data.motivoLivre ? motivo.length < 3 : !db.prepare("SELECT nome FROM cliche_motivos WHERE nome = ?").get(motivo)) {
      throw new Error(data.motivoLivre ? "Escreva o motivo da refação." : "Escolha um motivo da lista.");
    }
    /* a pasta do cliente só nasce no "Iniciar criação" (regra da casa): usa o
       cliente que já existe com esse nome; sem ele, nasce sem pasta */
    const cliente = db.prepare("SELECT id FROM clientes WHERE nome_norm = ?")
      .get(normalizeClienteKey(data.cliente)) as { id: string } | undefined;

    const id = uuid();
    const ts = agora();
    const cores = data.cores.join(", ");
    const obs = (data.observacao ?? "").trim();
    const { numero } = db
      .prepare("SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM pedidos")
      .get() as { numero: number };

    /* pedido, histórico e auditoria juntos: uma falha no meio deixava o cartão
       gravado com a caixa dizendo erro, e o "tente de novo" criava outro (a
       refação contava duas vezes no relatório). O aviso vai depois. */
    db.prepare("BEGIN").run();
    try {
      // Os campos NOT NULL de etiqueta não se aplicam aqui: vão como "—" (o de solicitarCliche).
      db.prepare(
        `INSERT INTO pedidos (id, numero, vendedor_id, cliente_id, cliente, materia, larg_materia,
          largura, altura, forma, cores, cores_desc, carreiras, descricao, link_ref, status, tipo,
          codigo_produto, motivo, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id, numero, user.id, cliente?.id ?? null, data.cliente, "—", "—", "—", "—", "—", String(data.cores.length),
        cores, null, `Refazer clichê de cliente antigo. Cores: ${cores}. Motivo: ${motivo}.${obs ? ` ${obs}` : ""}`, null,
        "refazer_cliche", "cliche", null, motivo, ts, ts,
      );
      db.prepare(
        "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
      ).run(uuid(), id, user.id, user.nome, "refazer_cliche", `Clichê marcado para refação. Motivo: ${motivo}${obs ? ` (${obs})` : ""}`, ts);
      audit({ id: user.id, nome: user.nome }, "cliche.refazer_antigo", "pedidos", id, {
        numero, cliente: data.cliente, cores, motivo, motivoLivre: !!data.motivoLivre,
      });
      db.prepare("COMMIT").run();
    } catch (e) {
      db.prepare("ROLLBACK").run();
      throw e;
    }

    notifyUsers(
      usersWithRoles(["designer", "gestor", "admin"]),
      user.id,
      "Refazer clichê",
      `${data.cliente}: ${cores}, ${motivo}`,
      `/pedido/${id}`,
    );
    return { id, numero };
  });

export const updatePedido = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      cliente: z.string().min(1).optional(),
      materia: z.string().min(1).optional(),
      larg_materia: z.string().min(1).optional(),
      largura: z.string().min(1).optional(),
      altura: z.string().min(1).optional(),
      forma: z.string().min(1).optional(),
      cores: z.string().min(1).optional(),
      cores_desc: z.string().nullish(),
      carreiras: z.string().nullish(),
      descricao: z.string().min(1).optional(),
      link_ref: z.string().nullish(),
      /* Acabamentos: mudam durante o processo — o cliente pede verniz depois
         de a arte estar em pé, a vendedora tira o picote. Ficavam de fora do
         validador e não havia como corrigir depois de criado o pedido. */
      tarja_verso: z.string().nullish(),
      verniz: z.string().nullish(),
      cold_stamp: z.string().nullish(),
      picote: z.string().nullish(),
      /* urgência e faca: mudam depois do envio (Augusto, 28/09/2026: "a faca
         precisamos poder editar depois") */
      urgente: z.string().nullish(),
      faca_cod: z.string().trim().max(60).nullish(),
      faca_nova: z.string().nullish(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const atual = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(data.id) as
      | Record<string, unknown>
      | undefined;
    if (!atual) throw new Error("Pedido não encontrado.");
    /* Cancelado não se edita (a tela já não oferece): uma aba aberta antes do
       cancelamento ainda gravava por aqui (simulação de 28/09/2026). */
    if (atual.status === "cancelado") throw new Error("Pedido cancelado não se altera. Reative o pedido antes.");
    /* Finalizado só o administrador altera (Augusto, 23/09/2026). A trava era
       só da tela: uma aba aberta antes da finalização ainda gravava
       (simulação 3, 30/09/2026). */
    if (atual.status === "concluido" && user.role !== "admin") throw new Error("Pedido finalizado só o administrador altera.");

    /* Guardados como 0/1 no banco, mas chegam como "1"/"0" do formulário:
       sem normalizar, a comparação abaixo dava sempre "mudou" e a auditoria
       registrava alteração a cada salvamento. */
    const ACABAMENTOS = ["tarja_verso", "verniz", "cold_stamp", "picote"];
    const LIGA_DESLIGA = [...ACABAMENTOS, "urgente", "faca_nova"];
    /* Texto que aceita vazio: "" e NULL são a mesma coisa. Sem isso, abrir a
       edição de um pedido com carreiras NULL e salvar só um acabamento virava
       "mudança de medida" e gravava "" no lugar de NULL. */
    const TEXTO_OPCIONAL = ["cores_desc", "carreiras", "link_ref", "faca_cod"];
    const bruto = data as Record<string, unknown>;
    const valorDe = (campo: string) => {
      const v = bruto[campo];
      if (v === undefined) return v;
      if (LIGA_DESLIGA.includes(campo)) return v === null ? 0 : (String(v) === "1" ? 1 : 0);
      if (TEXTO_OPCIONAL.includes(campo)) return v === null || String(v).trim() === "" ? null : v;
      return v;
    };
    const igual = (campo: string, novo: unknown, antigo: unknown) =>
      TEXTO_OPCIONAL.includes(campo)
        ? (novo ?? null) === (antigo === "" ? null : (antigo ?? null))
        : novo === antigo;

    const campos = Object.keys(pedidoFields) as (keyof typeof pedidoFields)[];
    const mudancas: Record<string, { de: unknown; para: unknown }> = {};
    const sets: string[] = [];
    const valores: unknown[] = [];
    for (const campo of campos) {
      const novo = valorDe(campo);
      if (novo === undefined) continue;
      if (!igual(campo, novo, atual[campo])) {
        mudancas[campo] = { de: atual[campo], para: novo };
        sets.push(`${campo} = ?`);
        valores.push(novo);
      }
    }
    if (sets.length === 0) return { ok: true, alterados: 0 };

    /* Quem pode mexer em quê.
       · Acabamento: o design também mexe durante o processo, e ele quase
         nunca é o dono do pedido — exigir "editar pedido" trancava justamente
         quem descobre o verniz na hora de fechar a arte.
       · Urgência: a vendedora dona do pedido, ou quem tem pedidos.prioridade.
       · Faca e medidas: a vendedora dona do pedido (a faca errada é dela de
         corrigir) ou o design (design.medidas). Antes o design.medidas sozinho
         era barrado antes de chegar a valer. */
    const alterados = Object.keys(mudancas);
    const CAMPOS_MEDIDA = ["largura", "altura", "forma", "carreiras", "larg_materia", "faca_cod", "faca_nova"];
    const editaTodos = user.role === "admin" || user.permissions.includes("pedidos.editar_todos");
    const dono = atual.vendedor_id === user.id;
    /* Campo a campo: salvar acabamento e faca no mesmo gesto não pode barrar
       quem tem licença para os dois. Antes a regra olhava o grupo inteiro, e
       a mistura caía na regra mais dura ("editar pedido"). */
    const podeMudar = (campo: string) => {
      if (ACABAMENTOS.includes(campo)) return dono || temPerm(user, "pedidos.status_design");
      if (campo === "urgente") return dono || temPerm(user, "pedidos.prioridade");
      if (CAMPOS_MEDIDA.includes(campo)) return (dono && temPerm(user, "pedidos.editar_proprios")) || temPerm(user, "design.medidas");
      return dono && temPerm(user, "pedidos.editar_proprios");
    };
    const barrado = editaTodos ? undefined : alterados.find((c) => !podeMudar(c));
    if (barrado) {
      throw new Error(barrado === "urgente"
        ? "Sem permissão para mudar a urgência deste pedido."
        : `Sem permissão para mudar ${(ROTULO_CAMPO[barrado] ?? barrado).toLowerCase()} neste pedido.`);
    }

    const ts = agora();
    sets.push("updated_at = ?");
    valores.push(ts, data.id);
    db.prepare(`UPDATE pedidos SET ${sets.join(", ")} WHERE id = ?`).run(...(valores as never[]));

    /* A edição entra no Histórico e avisa o design. Antes ficava só na
       auditoria: trocar a quantidade, o substrato ou anexar depois do envio
       não aparecia para ninguém (simulação de 28/09/2026). */
    const resumo = resumoDaEdicao(mudancas, atual) || "o pedido";
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.id, user.id, user.nome, "edicao", `Alterou ${resumo}`, ts);
    /* Sem designer ainda, o aviso vai para o time do design. A lista reserva
       antiga nunca valia (a vendedora sempre estava na lista, e o autor sai
       dela): a vendedora ligava a urgência e ninguém do design sabia. */
    const avisar = [
      ...(atual.designer_id ? [atual.designer_id as string] : usersWithRoles(["designer", "gestor", "admin"])),
      atual.vendedor_id as string,
    ].filter(Boolean) as string[];
    notifyUsers(
      [...new Set(avisar)],
      user.id,
      "Pedido alterado",
      /* quem alterou e o quê: "... : Vendas Simulação alterou o briefing" (o
         aviso terminava em ": o briefing" e lia pela metade; simulação 5,
         05/10/2026) */
      `${nn(atual.numero)} · ${atual.cliente}: ${user.nome} alterou ${resumo}`.slice(0, 180),
      `/pedido/${data.id}`,
    );

    audit({ id: user.id, nome: user.nome }, "pedido.editar", "pedidos", data.id, mudancas);
    return { ok: true, alterados: sets.length - 1 };
  });

/* "Matéria-prima: BOPP → BOPP fosco · Urgência: urgente" — o que a linha do
   Histórico e o aviso dizem de uma edição. */
const ROTULO_CAMPO: Record<string, string> = {
  cliente: "Cliente", materia: "Matéria-prima", larg_materia: "Bobina", largura: "Largura", altura: "Altura",
  forma: "Forma", cores: "Número de cores", cores_desc: "Cores", carreiras: "Carreiras", descricao: "Briefing",
  link_ref: "Link de referência", tarja_verso: "Tarja no verso", verniz: "Verniz", cold_stamp: "Cold stamp",
  picote: "Picote", urgente: "Urgência", faca_cod: "Faca", faca_nova: "Faca nova",
};
function resumoDaEdicao(mudancas: Record<string, { de: unknown; para: unknown }>, atual: Record<string, unknown>): string {
  const legivel = (campo: string, v: unknown) => {
    if (campo === "urgente") return Number(v) === 1 ? "urgente" : "normal";
    if (["tarja_verso", "verniz", "cold_stamp", "picote"].includes(campo)) return Number(v) === 1 ? "sim" : "não";
    if (v == null || v === "") return "vazio";
    return String(v).replace(/\s+/g, " ").slice(0, 50);
  };
  /* o briefing vem primeiro: é o que mais muda o trabalho, e o aviso corta
     o texto no fim */
  const partes = Object.entries(mudancas)
    .filter(([c]) => c !== "faca_cod" && c !== "faca_nova")
    .sort(([a], [b]) => Number(b === "descricao") - Number(a === "descricao"))
    .map(([c, m]) => (c === "descricao" ? "o briefing" : `${ROTULO_CAMPO[c] ?? c}: ${legivel(c, m.de)} → ${legivel(c, m.para)}`));
  /* A faca é uma coisa só para quem lê: "Faca: FAC0262.01 → faca nova", e
     não duas linhas (o código apagado e a faca nova ligada). */
  if (mudancas.faca_cod || mudancas.faca_nova) {
    const nomeDaFaca = (nova: unknown, cod: unknown) => (Number(nova) === 1 ? "faca nova" : cod ? String(cod) : "sem faca");
    const antes = nomeDaFaca(atual.faca_nova, atual.faca_cod);
    const depois = nomeDaFaca(
      mudancas.faca_nova ? mudancas.faca_nova.para : atual.faca_nova,
      mudancas.faca_cod ? mudancas.faca_cod.para : atual.faca_cod,
    );
    if (antes !== depois) partes.push(`Faca: ${antes} → ${depois}`);
  }
  return partes.join(" · ");
}

/* Reativar volta para a etapa em que o pedido estava quando foi cancelado
   (Augusto, 02/10/2026: "volta para a etapa que estava"), lida no histórico:
   a última etapa antes do cancelamento. Antes voltava sempre para "Aguardando
   design": o cartão de Refazer clichê virava arte nova, e o pedido aprovado
   recomeçava do zero. Pedido antigo, sem etapa no histórico, volta para
   "Aguardando design". As duas telas (1.0 e a antiga) chegam aqui pelo
   changeStatus("nova"). */
function reativarPedido(db: ReturnType<typeof getDb>, user: AuthUser, pedido: Record<string, unknown>) {
  const id = String(pedido.id);
  const cancelouEm = (db.prepare("SELECT MAX(created_at) AS em FROM pedido_historico WHERE pedido_id = ? AND status = 'cancelado'")
    .get(id) as { em: string | null } | undefined)?.em ?? null;
  const etapas = STATUS_KEYS.filter((s) => s !== "cancelado");
  const antes = cancelouEm
    ? (db.prepare(`SELECT status FROM pedido_historico WHERE pedido_id = ? AND created_at <= ? AND status IN (${etapas.map(() => "?").join(",")})
         ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(id, cancelouEm, ...etapas) as { status: string } | undefined)?.status
    : undefined;
  const alvo = antes ?? "nova";
  const ts = agora();
  const sets = ["status = ?", "updated_at = ?", "cancelado_em = NULL"];
  const valores: unknown[] = [alvo, ts];
  /* de volta à clicheria: o cancelamento apagou a data do envio, e o envio
     vale de novo a partir de hoje */
  if (alvo === "cliche") {
    sets.push("cliche_solicitado_em = ?");
    valores.push(ts);
  }
  valores.push(id);
  db.prepare(`UPDATE pedidos SET ${sets.join(", ")} WHERE id = ?`).run(...(valores as never[]));
  /* "Pedido reativado" começa o texto: o relatório de refações não conta esta linha */
  const observacao = alvo === "nova" ? OBS_PADRAO_STATUS.nova : `Pedido reativado. Volta para ${STATUS_LABELS[alvo] ?? alvo}.`;
  db.prepare(
    "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
  ).run(uuid(), id, user.id, user.nome, alvo, observacao, ts);
  notifyUsers(
    [pedido.vendedor_id as string, pedido.designer_id as string | null, ...usersWithRoles(["gestor", "admin"])].filter(Boolean) as string[],
    user.id,
    "Pedido reativado",
    `${nn(pedido.numero)} · ${pedido.cliente} → ${STATUS_LABELS[alvo] ?? alvo}`,
    `/pedido/${id}`,
  );
  audit({ id: user.id, nome: user.nome }, "pedido.status", "pedidos", id, { de: "cancelado", para: alvo, reativado: true });
  return { ok: true, status: alvo };
}

export const changeStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      status: z.enum(STATUS_KEYS),
      /* com teto: o texto vai para o histórico e é lido pelos relatórios */
      observacao: z.string().trim().max(5000).nullish(),
      /* Cores que o designer confirma ao devolver a arte. Iam só para o texto
         do histórico, e o pedido seguia mostrando as que a vendedora PEDIU —
         quem via depois (clichê, aprovação, relatório) lia a intenção, não o
         que foi feito. Vem junto da mudança de etapa porque é o mesmo gesto, e
         o designer não costuma ter permissão de editar pedido. */
      coresDesc: z.string().trim().max(400).nullish(),
      /* A etapa em que a tela viu o pedido. Se ele já mudou (outra pessoa
         pediu revisão com o pedido aberto aqui, por exemplo), a mudança é
         recusada. O Aprovar da tela 1.0 manda; as telas antigas não mandam e
         seguem como eram (Augusto, 06/10/2026). */
      de: z.enum(STATUS_KEYS).nullish(),
      /* A espessura do clichê (1.14 ou 1.70), escolhida no Enviar p/
         clicheria; os relatórios separam quantidade e valor de cada uma
         (Augusto, 07/10/2026). Só vale para a etapa "cliche". */
      espessura: z.enum(["1.14", "1.70"]).nullish(),
    }),
  )
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(data.id) as
      | Record<string, unknown>
      | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");

    /* A etapa que a tela viu vem antes do "nada a mudar" (revisão de
       08/10/2026): com o painel parado, "Pedir revisão" num pedido que outra
       pessoa já tinha mandado para revisão respondia "ok" sem gravar o texto,
       e o mesmo valia para o motivo do Refazer clichê e a espessura do
       Enviar p/ clicheria. Agora os botões da tela 1.0 mandam o `de`. */
    if (data.de && pedido.status !== data.de) throw new Error("Este pedido mudou de etapa. Atualize a página.");
    /* Mesma etapa de novo (duas abas, clique repetido): nada muda e nada se
       grava. O Histórico ganhava "Criação iniciada" duas vezes e todo mundo
       recebia dois avisos (simulação de 28/09/2026). Entregar arte de novo
       em Design criado continua valendo: é uma versão nova. */
    if (data.status === pedido.status && data.status !== "aguardando") return { ok: true, semMudanca: true };
    /* Reativar: volta para a etapa em que estava (permissão própria) */
    if (pedido.status === "cancelado" && data.status === "nova") {
      requirePerm(user, "pedidos.reabrir");
      return reativarPedido(db, user, pedido);
    }
    /* cancelado só sai pela reativação: uma aba aberta antes do
       cancelamento ainda iniciava a criação por aqui */
    if (pedido.status === "cancelado" && data.status !== "nova") {
      throw new Error("Pedido cancelado. Reative o pedido antes de mudar a etapa.");
    }
    /* "Iniciar criação" só vale para o pedido aguardando design: numa aba
       velha, o pedido que já estava em Design criado voltava para Criação */
    if (data.status === "criacao" && pedido.status !== "nova") {
      throw new Error("A criação deste pedido já começou. Atualize a página.");
    }

    const dono = pedido.vendedor_id === user.id;
    // tirar um pedido de "concluído" é reabrir — permissão própria
    if (pedido.status === "concluido" && data.status !== "concluido") requirePerm(user, "pedidos.reabrir");
    /* "Aguardando cliente" tem entrada e saída próprias (aguardarCliente e
       clienteRespondeu): elas guardam e devolvem a etapa de antes. */
    if (data.status === "aguardando_cliente") throw new Error("Use \"Aguardando cliente\" no pedido.");
    if (pedido.status === "aguardando_cliente" && data.status !== "cancelado") {
      throw new Error("Este pedido está aguardando o cliente. Marque que o cliente respondeu antes de mudar a etapa.");
    }
    /* Reativar (voltar para "nova") é permissão própria: antes qualquer pessoa
       logada mandava um pedido para "nova" por aqui. */
    if (data.status === "nova" && pedido.status !== "nova") requirePerm(user, "pedidos.reabrir");
    /* Revisão se pede com a arte entregue (Design criado) ou aprovada. Em
       pedido cancelado ela reabria sem permissão; na clicheria, apagava a
       data do pedido de clichê. */
    if (data.status === "revisao" && !["aguardando", "aprovada"].includes(String(pedido.status))) {
      throw new Error("Revisão só se pede com a arte entregue ou aprovada.");
    }
    /* Entregar arte (Design criado) vale na criação e na revisão. Depois da
       aprovação a arte final se anexa sem mudar a etapa: antes o pedido na
       clicheria voltava para Design criado e pedia aprovação de novo. */
    if (data.status === "aguardando" && !["criacao", "revisao", "aguardando"].includes(String(pedido.status))) {
      throw new Error("Nesta etapa a arte final se anexa sem mudar a etapa do pedido.");
    }
    /* Iniciar a criação exige a pasta do cliente confirmada: é onde a arte e
       os anexos vão morar (regra da casa: a pasta nasce no "Iniciar criação").
       A tela 1.0 pergunta a pasta antes de chamar isto; a trava é para as
       telas antigas, que ainda iniciam direto. Entregar ou reenviar a arte não
       pede a pasta (Augusto, 02/10/2026): no pedido antigo, de antes da regra,
       a arte espera na pasta do hub, como os anexos. */
    if (data.status === "criacao" && !pedido.cliente_id) {
      throw new Error("Confirme a pasta do cliente antes de iniciar a criação.");
    }

    if (STATUS_DESIGN.includes(data.status)) {
      requirePerm(user, "pedidos.status_design");
      requirePerm(user, PERM_POR_STATUS[data.status] ?? "pedidos.status_design");
    } else if (STATUS_APROVACAO.includes(data.status)) {
      requirePerm(user, PERM_POR_STATUS[data.status] ?? "pedidos.aprovar");
      if (!dono && !podeVerTodos(user)) throw new Error("Sem acesso a este pedido.");
    } else if (data.status === "cancelado") {
      if (!dono && user.role !== "admin" && !user.permissions.includes("pedidos.editar_todos")) {
        throw new Error("Sem permissão para cancelar este pedido.");
      }
    }

    const ts = agora();
    const sets: string[] = ["status = ?", "updated_at = ?"];
    const valores: unknown[] = [data.status, ts];
    /* Quem devolve a arte também vira o designer do pedido quando ninguém
       assumiu. No #34 a Letícia devolveu sem passar por "Iniciar": o pedido
       ficou com designer_id NULL e uma pergunta dela sem endereço de volta. */
    if ((data.status === "criacao" || data.status === "aguardando") && !pedido.designer_id) {
      sets.push("designer_id = ?");
      valores.push(user.id);
    }
    if (data.status === "cliche") {
      sets.push("cliche_solicitado_em = ?");
      valores.push(ts);
      if (data.espessura) {
        sets.push("cliche_espessura = ?");
        valores.push(data.espessura);
      }
    }
    /* Cancelado sai da fila de design na hora: a fila é o que o designer vai
       fazer a seguir, e um pedido cancelado ocupando a posição 01 segura a
       vaga de quem precisa dela. Reativar devolve o pedido à espera, sem
       posição — quem enfileira de novo é quem decide a ordem. */
    /* ...e a fila é do "Aguardando design": o pedido que começou (ou foi
       para qualquer outra etapa) sai dela, e a vaga passa para o próximo. */
    if (data.status === "cancelado" || (pedido.status === "nova" && data.status !== "nova")) sets.push("fila = NULL");
    /* Cancelar o envio à clicheria APAGA a data da solicitação. Sem isto o
       pedido continuaria contando no pódio da Aprovação como "enviado naquele
       dia" — um envio que foi desfeito. Sair de "cliche" para concluído não
       entra aqui: nesse caso o clichê foi mesmo pedido. */
    if (pedido.status === "cliche" && STATUS_APROVACAO.includes(data.status)) {
      sets.push("cliche_solicitado_em = NULL");
    }
    if (data.status === "concluido") {
      sets.push("cliche_concluido_em = ?");
      valores.push(ts);
    }
    /* Carimbo do cancelamento — e a limpeza dele ao reabrir. Sem apagar na
       volta, um pedido cancelado e depois retomado continuaria contando como
       cancelado no mês em que foi cancelado. */
    if (data.status === "cancelado") {
      sets.push("cancelado_em = ?");
      valores.push(ts);
    } else if (pedido.status === "cancelado") {
      sets.push("cancelado_em = NULL");
    }
    /* As cores confirmadas na entrega são as da ARTE e ficam ao lado das que
       a vendedora pediu (Augusto, 07/10/2026: "guarde as duas listas"). Antes
       gravavam por cima de cores_desc e de cores: se o designer errasse uma
       cor, ninguém via a diferença. Quem precisa das cores reais (clichê,
       Pantones, relatórios, o número do cartão) lê coresEfetivas e
       numeroDeCores (lib/cores). Só quem conduz a etapa de design grava (é
       ele quem sabe o que usou na arte). */
    const coresNovas = (data.coresDesc ?? "").trim();
    if (coresNovas && temPerm(user, "pedidos.status_design")) {
      sets.push("cores_arte = ?");
      valores.push(coresNovas);
    }
    valores.push(data.id);
    db.prepare(`UPDATE pedidos SET ${sets.join(", ")} WHERE id = ?`).run(...(valores as never[]));
    if (pedido.fila != null && sets.includes("fila = NULL")) compactarFila(db);

    const observacao = (data.observacao ?? "").trim() || OBS_PADRAO_STATUS[data.status] || null;
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.id, user.id, user.nome, data.status, observacao, ts);

    const alvos = [
      pedido.vendedor_id as string,
      pedido.designer_id as string | null,
      ...usersWithRoles(["gestor", "admin"]),
      /* Cancelado antes de alguém do design assumir: o pedido estava na fila
         (ou esperando) do time do design, que recebeu a "Nova solicitação" e
         precisa saber que ele saiu (simulação 6, 07/10/2026). */
      ...(data.status === "cancelado" && !pedido.designer_id ? usersWithRoles(["designer"]) : []),
    ].filter(Boolean) as string[];
    notifyUsers(
      alvos,
      user.id,
      /* o título diz o que aconteceu ("Arte enviada", "Revisão pedida"), e
         não "Pedido atualizado" em tudo */
      OBS_PADRAO_STATUS[data.status] ?? "Pedido atualizado",
      `${nn(pedido.numero)} · ${pedido.cliente} → ${STATUS_LABELS[data.status] ?? data.status}`,
      `/pedido/${data.id}`,
    );

    audit({ id: user.id, nome: user.nome }, "pedido.status", "pedidos", data.id, {
      de: pedido.status,
      para: data.status,
      observacao: data.observacao ?? null,
    });

    return { ok: true };
  });

/* ————— Aguardando o cliente —————
   O pedido para porque falta algo do cliente (texto legal, prova física,
   INCI). Antes ele ficava em "Criação" ou "Design criado" como se fosse
   trabalho da designer. Entra com o motivo e sai quando o cliente responde,
   de volta para a etapa de antes (guardada em status_anterior). */
const ESPERA_PERMITIDA_DE = ["nova", "criacao", "aguardando", "revisao", "aprovada"];

function podeMexerNaEspera(user: AuthUser, pedido: Record<string, unknown>) {
  if (user.role === "admin" || user.permissions.includes("pedidos.editar_todos")) return;
  if (pedido.vendedor_id === user.id) return;
  if (temPerm(user, "pedidos.status_design")) return;
  throw new Error("Sem permissão para mudar a espera deste pedido.");
}

export const aguardarCliente = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), motivo: z.string().trim().min(1).max(1000) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(data.id) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido as { vendedor_id: string });
    podeMexerNaEspera(user, pedido);
    const de = String(pedido.status);
    if (!ESPERA_PERMITIDA_DE.includes(de)) {
      throw new Error(`Com o pedido em "${STATUS_LABELS[de] ?? de}" não dá para pôr em espera do cliente.`);
    }

    const ts = agora();
    const motivo = data.motivo.trim();
    /* sai da fila: esperando o cliente, não é o próximo trabalho da designer */
    db.prepare("UPDATE pedidos SET status = 'aguardando_cliente', status_anterior = ?, fila = NULL, updated_at = ? WHERE id = ?")
      .run(de, ts, data.id);
    if (pedido.fila != null) compactarFila(db);
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.id, user.id, user.nome, "aguardando_cliente", `Aguardando o cliente: ${motivo}`, ts);

    notifyUsers(
      [pedido.vendedor_id as string, pedido.designer_id as string | null].filter(Boolean) as string[],
      user.id,
      "Pedido aguardando o cliente",
      `${nn(pedido.numero)} · ${pedido.cliente}: ${motivo.slice(0, 120)}`,
      `/pedido/${data.id}`,
    );
    audit({ id: user.id, nome: user.nome }, "pedido.aguardar_cliente", "pedidos", data.id, { de, motivo });
    return { ok: true };
  });

export const clienteRespondeu = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1), observacao: z.string().trim().max(1000).nullish() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    const pedido = db.prepare("SELECT * FROM pedidos WHERE id = ?").get(data.id) as Record<string, unknown> | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido as { vendedor_id: string });
    podeMexerNaEspera(user, pedido);
    if (pedido.status !== "aguardando_cliente") throw new Error("Este pedido não está aguardando o cliente.");

    const guardado = String(pedido.status_anterior ?? "");
    /* sem a etapa guardada (não deveria acontecer), volta para o começo do
       trabalho: criação se já tem pasta, aguardando design se não tem */
    const volta = ESPERA_PERMITIDA_DE.includes(guardado) ? guardado : (pedido.cliente_id ? "criacao" : "nova");
    const ts = agora();
    db.prepare("UPDATE pedidos SET status = ?, status_anterior = NULL, updated_at = ? WHERE id = ?").run(volta, ts, data.id);
    /* sem o ponto final de quem digitou: a frase continua com ". Voltou para" */
    const obs = (data.observacao ?? "").trim().replace(/[.\s]+$/, "");
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.id, user.id, user.nome, "cliente_respondeu",
      `O cliente respondeu${obs ? `: ${obs}` : ""}. Voltou para ${STATUS_LABELS[volta] ?? volta}.`, ts);

    notifyUsers(
      [pedido.vendedor_id as string, pedido.designer_id as string | null].filter(Boolean) as string[],
      user.id,
      "O cliente respondeu",
      `${nn(pedido.numero)} · ${pedido.cliente}${obs ? `: ${obs.slice(0, 120)}` : ""}`,
      `/pedido/${data.id}`,
    );
    audit({ id: user.id, nome: user.nome }, "pedido.cliente_respondeu", "pedidos", data.id, { volta, observacao: obs || null });
    return { ok: true, status: volta };
  });

export const deletePedido = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.excluir");

    const db = getDb();
    const pedido = db
      .prepare("SELECT numero, cliente, status FROM pedidos WHERE id = ?")
      .get(data.id) as { numero: number; cliente: string; status: string } | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    if (pedido.status === "cancelado") return { ok: true, numero: pedido.numero };

    /* Excluir aqui CANCELA — não apaga.
       Era um `DELETE FROM pedidos`, e o ON DELETE CASCADE levava junto o
       histórico e os anexos: o pedido evaporava, sem aparecer em "artes
       canceladas" nem em lugar nenhum, e o único rastro era a linha do
       audit_log (que guarda apenas número e cliente). Três pedidos sumiram
       assim — #12, #16 e #17.
       Cancelando, o pedido sai do fluxo do mesmo jeito, mas continua contável,
       aberto pelo card de canceladas e com o gasto de clichê preservado no
       relatório do mês. Por isso caiu também a trava que impedia excluir
       pedido com clichê lançado: não há mais o que se perder. */
    const ts = agora();
    /* fila = NULL pelo mesmo motivo do changeStatus: cancelado não espera vez. */
    db.prepare("UPDATE pedidos SET status = 'cancelado', cancelado_em = ?, fila = NULL, updated_at = ? WHERE id = ?")
      .run(ts, ts, data.id);
    compactarFila(db);
    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.id, user.id, user.nome, "cancelado", "Cancelado pelo botão Excluir pedido", ts);

    audit({ id: user.id, nome: user.nome }, "pedido.excluir", "pedidos", data.id, {
      numero: pedido.numero,
      cliente: pedido.cliente,
      statusAnterior: pedido.status,
      virouCancelado: true,
    });
    return { ok: true, numero: pedido.numero };
  });

/* ————— Fila do design (tela Pedido 1.0) —————
   A posição que o designer marca no card. É do TIME, não de quem marcou: fica
   na coluna `fila` do pedido para que todos vejam a mesma ordem. 0 a 10 porque
   é o que o seletor do projeto oferece; null tira da fila. */
export const definirFilaPedido = createServerFn({ method: "POST" })
  /* a fila começa em 1: posição zero não existe */
  .validator(z.object({ id: z.string().min(1), posicao: z.number().int().min(1).max(10).nullable() }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.status_design");
    const db = getDb();
    const pedido = db.prepare("SELECT id, fila, status FROM pedidos WHERE id = ?").get(data.id) as
      { id: string; fila: number | null; status: string } | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    if (data.posicao != null && pedido.status !== "nova") throw new Error("Só pedido aguardando design entra na fila.");

    /* A fila é uma LISTA: pôr um pedido na posição 4 empurra o 4 e os de
       baixo uma casa, em vez de trocar os dois de lugar (simulação de
       28/09/2026: pôr o #48 em 04 mandou o #43, também urgente, para 07).
       As posições ficam sempre 1, 2, 3... sem buraco. */
    const outros = filaAtual(db).filter((id) => id !== data.id);
    if (data.posicao != null) outros.splice(Math.min(data.posicao - 1, outros.length), 0, data.id);
    const ts = agora();
    if (data.posicao == null) db.prepare("UPDATE pedidos SET fila = NULL, updated_at = ? WHERE id = ?").run(ts, data.id);
    renumerarFila(db, outros, data.id, ts);
    return { ok: true };
  });

/** Os pedidos da fila, na ordem dela. */
/* Quem sai da fila libera a vaga e os de trás sobem. Sem isto a fila ficava
   "02, 03" sem o 01 (teste de 28/09/2026). Ninguém ganha updated_at: não
   foram eles que mudaram. */
function compactarFila(db: ReturnType<typeof getDb>) {
  renumerarFila(db, filaAtual(db), "", agora());
}

function filaAtual(db: ReturnType<typeof getDb>): string[] {
  return (db.prepare("SELECT id FROM pedidos WHERE fila IS NOT NULL ORDER BY fila ASC, updated_at ASC").all() as { id: string }[])
    .map((r) => r.id);
}

/** Grava 1, 2, 3... na ordem dada; o que passar de 10 sai da fila. Só o
    pedido que a pessoa moveu ganha updated_at novo — o prazo da clicheria
    conta a partir dele, e empurrar os outros não é mexer neles. */
function renumerarFila(db: ReturnType<typeof getDb>, ordem: string[], movido: string, ts: string) {
  const comData = db.prepare("UPDATE pedidos SET fila = ?, updated_at = ? WHERE id = ?");
  const semData = db.prepare("UPDATE pedidos SET fila = ? WHERE id = ? AND fila IS NOT ?");
  ordem.forEach((id, i) => {
    const pos = i < 10 ? i + 1 : null;
    if (id === movido) comData.run(pos, ts, id);
    else semData.run(pos, id, pos);
  });
}

/** O "+" do card: o pedido entra no FIM da fila. */
export const enfileirarPedido = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.status_design");
    const db = getDb();
    const pedido = db.prepare("SELECT id, fila, status FROM pedidos WHERE id = ?").get(data.id) as
      { id: string; fila: number | null; status: string } | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    if (pedido.fila != null) return { posicao: pedido.fila };
    if (pedido.status !== "nova") throw new Error("Só pedido aguardando design entra na fila.");
    const ordem = filaAtual(db);
    if (ordem.length >= 10) throw new Error("A fila já tem dez pedidos. Tire um antes de pôr outro.");
    ordem.push(data.id);
    renumerarFila(db, ordem, data.id, agora());
    return { posicao: ordem.length };
  });

/** Tira TODOS da fila de uma vez — o "Limpar fila" do seletor. */
export const limparFilaPedidos = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.status_design");
    const db = getDb();
    const r = db.prepare("UPDATE pedidos SET fila = NULL WHERE fila IS NOT NULL").run();
    return { limpos: Number(r.changes ?? 0) };
  });

/* Marca que eu já vi a conversa deste pedido até agora. Apaga o aviso de
   resposta nova no card — só para mim: quem não abriu continua vendo. */
export const marcarPedidoVisto = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    /* Só grava no pedido que existe e que a pessoa vê, a regra do getPedido.
       O link com um id que não existe soltava "FOREIGN KEY constraint failed"
       na tela, e o de outra vendedora gravava o visto num pedido que ela não
       vê (simulação 6, 07/10/2026). */
    const pedido = db.prepare("SELECT id, vendedor_id FROM pedidos WHERE id = ?").get(data.id) as
      | { id: string; vendedor_id: string }
      | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    assertAcessoPedido(user, pedido);
    db.prepare(`INSERT INTO pedido_vistos (user_id, pedido_id, visto_em) VALUES (?, ?, ?)
                ON CONFLICT(user_id, pedido_id) DO UPDATE SET visto_em = excluded.visto_em`)
      .run(user.id, data.id, agora());
    return { ok: true };
  });
