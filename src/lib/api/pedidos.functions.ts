// Pedidos: listagem, detalhe, criação, edição, status e exclusão.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuth, type AuthContext } from "./auth-middleware";
import { agora, getDb, uuid, type LinhaSQL, type Permission } from "@/server/db.server";
import { requirePerm, temPerm, type AuthUser } from "@/server/auth.server";
import { audit } from "@/server/audit.server";
import { notifyUsers, usersWithRoles } from "@/server/notify.server";
import { clientePastaFullPath, ensureCliente } from "@/server/clientes.server";
import { readClienteFile, saveNotaClicheFile } from "@/server/files.server";

export const STATUS_LABELS: Record<string, string> = {
  nova: "Nova",
  criacao: "Em criação",
  aguardando: "Aguardando aprovação",
  revisao: "Revisão solicitada",
  aprovada: "Arte aprovada",
  cliche: "Clichê solicitado",
  /* O clichê voltou errado e precisa ser refeito. Sem um status próprio o
     pedido voltaria para "cliche" e ninguém saberia que já foi uma vez —
     é a informação que a clicheria precisa para não repetir o erro. */
  refazer_cliche: "Refazer clichê",
  concluido: "Concluído",
  cancelado: "Cancelado",
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

export const listPedidos = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { user } = context as AuthContext;
    const db = getDb();
    /* O registro de chegada do clichê vem JUNTO (o mais recente de cada
       pedido): sem ele a tela de Aprovação não tinha de onde tirar o valor
       recebido e mostrava um número inventado. */
    const base = `SELECT p.id, p.numero, p.cliente, p.materia, p.largura, p.altura, p.cores, p.cores_desc,
                         p.status, p.tipo, p.fila, p.designer_id,
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
                         /* QUANTAS alterações ainda não foram marcadas como
                            resolvidas, e desde quando espera a mais antiga. Na
                            lista um pedido com uma alteração e outro com oito
                            eram a mesma linha. A coluna chave é o id da linha
                            do histórico que pediu a revisão. */
                         (SELECT COUNT(*) FROM pedido_historico h
                           WHERE h.pedido_id = p.id AND h.status = 'revisao'
                             AND h.id NOT IN (SELECT r.chave FROM pedido_revisoes_resolvidas r
                                               WHERE r.pedido_id = p.id)) AS alteracoes_abertas,
                         (SELECT MIN(h.created_at) FROM pedido_historico h
                           WHERE h.pedido_id = p.id AND h.status = 'revisao'
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
    const rows = (podeVerTodos(user)
      ? db.prepare(`${base} ORDER BY p.created_at DESC`).all(user.id)
      : db.prepare(`${base} WHERE p.vendedor_id = ?1 ORDER BY p.created_at DESC`).all(user.id)) as LinhaSQL[];

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
        "SELECT id, status, observacao, user_nome, created_at FROM pedido_historico WHERE pedido_id = ? ORDER BY created_at ASC",
      )
      .all(data.id) as LinhaSQL[];

    const anexos = db
      .prepare(
        "SELECT id, tipo, nome, path, versao, created_at, user_id FROM pedido_anexos WHERE pedido_id = ? ORDER BY created_at DESC",
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
      `${user.nome.split(" ")[0]} precisa de uma resposta: ${texto.slice(0, 110)}`,
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
      `${user.nome.split(" ")[0]}: ${texto.slice(0, 120)}`,
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
    if (Number(para.ativo) === 0) throw new Error(`${String(para.nome)} está inativa — reative antes de transferir.`);

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
      `${clientesTocados.join(", ")} — ${alvos.length === 1 ? "vindo" : "vindos"} de ${String(de.nome)}.`,
      "/hub?tela=pedidos",
    );
    notifyUsers(
      [data.deId],
      user.id,
      `${alvos.length} ${alvos.length === 1 ? "pedido saiu" : "pedidos saíram"} da sua carteira`,
      `${clientesTocados.join(", ")} — agora com ${String(para.nome)}.`,
      "/hub?tela=pedidos",
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
      `${user.nome.split(" ")[0]}: ${data.texto.trim().slice(0, 120)}`,
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
      `Resposta ao cliente — ${pedido.cliente}`,
      `${user.nome.split(" ")[0]}: ${texto.slice(0, 120)}`,
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
      obs ? `Prova de impressão enviada ao cliente — ${obs}` : "Prova de impressão enviada ao cliente", ts);

    const alvos = [
      pedido.vendedor_id as string,
      pedido.designer_id as string | null,
      ...usersWithRoles(["gestor", "admin"]),
    ].filter(Boolean) as string[];
    notifyUsers(
      alvos, user.id,
      `Prova enviada — ${pedido.cliente}`,
      `${user.nome.split(" ")[0]} enviou a prova de impressão do pedido #${String(pedido.numero).padStart(4, "0")}.`,
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
        ? `Valores do clichê corrigidos — de ${fmtBRL(Number(antes))} para ${fmtBRL(total)}`
        : `Clichê chegou em ${data.dataChegada.split("-").reverse().join("/")} às ${data.horaChegada} — total ${fmtBRL(total)}`,
      ts,
    );

    notifyUsers(
      [pedido.vendedor_id as string, ...usersWithRoles(["gestor", "admin"])],
      user.id,
      correcao ? "Valor do clichê corrigido" : "Clichê chegou",
      `${pedido.cliente} — total ${fmtBRL(total)}`,
      `/pedido/${data.pedidoId}`,
    );

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
      `Voltou para a clicheria — registro de chegada desfeito${eraQuando}`,
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
    const cliente = ensureCliente({ id: user.id, nome: user.nome }, data.cliente, data.pasta);

    const id = uuid();
    const ts = agora();
    const { numero } = db
      .prepare("SELECT COALESCE(MAX(numero), 0) + 1 AS numero FROM pedidos")
      .get() as { numero: number };

    db.prepare(
      `INSERT INTO pedidos (id, numero, vendedor_id, cliente_id, cliente, materia, larg_materia,
        largura, altura, forma, cores, cores_desc, carreiras, descricao, link_ref, tarja_verso, verniz, cold_stamp, picote, status, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'nova',?,?)`,
    ).run(
      /* O nome do pedido é o da PASTA quando ela foi escolhida: assim o que
         aparece na tela e o lugar onde os arquivos moram nunca divergem. */
      id, numero, user.id, cliente.id, cliente.nome, data.materia, data.larg_materia,
      data.largura, data.altura, data.forma, data.cores, data.cores_desc ?? null,
      data.carreiras ?? null, data.descricao, data.link_ref ?? null,
      data.tarja_verso === "1" ? 1 : 0, data.verniz === "1" ? 1 : 0,
      data.cold_stamp === "1" ? 1 : 0, data.picote === "1" ? 1 : 0, ts, ts,
    );

    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), id, user.id, user.nome, "nova", "Pedido criado", ts);

    notifyUsers(
      usersWithRoles(["designer", "gestor", "admin"]),
      user.id,
      "Nova solicitação",
      `${data.cliente} — ${data.materia} ${data.largura}×${data.altura}mm`,
      `/pedido/${id}`,
    );
    audit({ id: user.id, nome: user.nome }, "pedido.criar", "pedidos", id, {
      numero,
      cliente: data.cliente,
      pasta: clientePastaFullPath(cliente.pasta),
    });

    return { id, numero, pastaCliente: clientePastaFullPath(cliente.pasta) };
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
    const cliente = ensureCliente({ id: user.id, nome: user.nome }, data.cliente);

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
      id, numero, user.id, cliente.id, data.cliente.trim(), "—", "—", "—", "—", "—", "—",
      null, null, `Reposição de clichê danificado em produção — código ${codigo}. Motivo: ${motivo}.`, null,
      "nova", "cliche", codigo, motivo, ts, ts,
    );

    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), id, user.id, user.nome, "nova", "Solicitação de clichê criada", ts);

    notifyUsers(
      usersWithRoles(["designer", "gestor", "admin"]),
      user.id,
      "Solicitação de clichê",
      `${data.cliente} — código ${codigo}`,
      `/pedido/${id}`,
    );
    audit({ id: user.id, nome: user.nome }, "cliche.solicitar", "pedidos", id, {
      numero,
      cliente: data.cliente,
      codigo,
    });

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

    /* Guardados como 0/1 no banco, mas chegam como "1"/"0" do formulário:
       sem normalizar, a comparação abaixo dava sempre "mudou" e a auditoria
       registrava alteração a cada salvamento. */
    const ACABAMENTOS = ["tarja_verso", "verniz", "cold_stamp", "picote"];
    const bruto = data as Record<string, unknown>;
    const valorDe = (campo: string) => {
      const v = bruto[campo];
      return ACABAMENTOS.includes(campo) && v !== undefined && v !== null ? (String(v) === "1" ? 1 : 0) : v;
    };

    const campos = Object.keys(pedidoFields) as (keyof typeof pedidoFields)[];
    const mudancas: Record<string, { de: unknown; para: unknown }> = {};
    const sets: string[] = [];
    const valores: unknown[] = [];
    for (const campo of campos) {
      const novo = valorDe(campo);
      if (novo === undefined) continue;
      if (novo !== atual[campo]) {
        mudancas[campo] = { de: atual[campo], para: novo };
        sets.push(`${campo} = ?`);
        valores.push(novo);
      }
    }
    if (sets.length === 0) return { ok: true, alterados: 0 };

    /* Só acabamento mudou? O design também mexe nisso durante o processo, e
       ele quase nunca é o dono do pedido — exigir "editar pedido" trancava
       justamente quem descobre o verniz na hora de fechar a arte. */
    const soAcabamento = Object.keys(mudancas).every((c) => ACABAMENTOS.includes(c));
    const editaTodos = user.role === "admin" || user.permissions.includes("pedidos.editar_todos");
    if (!editaTodos) {
      const dono = atual.vendedor_id === user.id;
      if (soAcabamento) {
        if (!dono && !temPerm(user, "pedidos.status_design")) {
          throw new Error("Sem permissão para mudar os acabamentos deste pedido.");
        }
      } else {
        if (!dono) throw new Error("Sem permissão para editar este pedido.");
        requirePerm(user, "pedidos.editar_proprios");
      }
    }
    // medida e faca são decisão técnica: mexer nelas é permissão à parte
    const mexeMedidas = ["largura", "altura", "forma", "carreiras", "larg_materia"].some((c) => c in mudancas);
    if (mexeMedidas) requirePerm(user, "design.medidas");

    sets.push("updated_at = ?");
    valores.push(agora(), data.id);
    db.prepare(`UPDATE pedidos SET ${sets.join(", ")} WHERE id = ?`).run(...(valores as never[]));

    audit({ id: user.id, nome: user.nome }, "pedido.editar", "pedidos", data.id, mudancas);
    return { ok: true, alterados: sets.length - 1 };
  });

export const changeStatus = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.string().min(1),
      status: z.enum(STATUS_KEYS),
      observacao: z.string().nullish(),
      /* Cores que o designer confirma ao devolver a arte. Iam só para o texto
         do histórico, e o pedido seguia mostrando as que a vendedora PEDIU —
         quem via depois (clichê, aprovação, relatório) lia a intenção, não o
         que foi feito. Vem junto da mudança de etapa porque é o mesmo gesto, e
         o designer não costuma ter permissão de editar pedido. */
      coresDesc: z.string().trim().max(400).nullish(),
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

    const dono = pedido.vendedor_id === user.id;
    // tirar um pedido de "concluído" é reabrir — permissão própria
    if (pedido.status === "concluido" && data.status !== "concluido") requirePerm(user, "pedidos.reabrir");

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
    }
    /* Cancelado sai da fila de design na hora: a fila é o que o designer vai
       fazer a seguir, e um pedido cancelado ocupando a posição 01 segura a
       vaga de quem precisa dela. Reativar devolve o pedido à espera, sem
       posição — quem enfileira de novo é quem decide a ordem. */
    if (data.status === "cancelado") sets.push("fila = NULL");
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
    /* As cores confirmadas passam a valer no pedido. Só quem conduz a etapa de
       design pode reescrever (é ele quem sabe o que usou na arte). */
    const coresNovas = (data.coresDesc ?? "").trim();
    if (coresNovas && temPerm(user, "pedidos.status_design")) {
      sets.push("cores_desc = ?");
      valores.push(coresNovas);
    }
    valores.push(data.id);
    db.prepare(`UPDATE pedidos SET ${sets.join(", ")} WHERE id = ?`).run(...(valores as never[]));

    db.prepare(
      "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
    ).run(uuid(), data.id, user.id, user.nome, data.status, data.observacao ?? null, ts);

    const alvos = [
      pedido.vendedor_id as string,
      pedido.designer_id as string | null,
      ...usersWithRoles(["gestor", "admin"]),
    ].filter(Boolean) as string[];
    notifyUsers(
      alvos,
      user.id,
      "Pedido atualizado",
      `${pedido.cliente} → ${STATUS_LABELS[data.status] ?? data.status}`,
      `/pedido/${data.id}`,
    );

    audit({ id: user.id, nome: user.nome }, "pedido.status", "pedidos", data.id, {
      de: pedido.status,
      para: data.status,
      observacao: data.observacao ?? null,
    });

    return { ok: true };
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
    const pedido = db.prepare("SELECT id, fila FROM pedidos WHERE id = ?").get(data.id) as
      { id: string; fila: number | null } | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    const ts = agora();

    /* Duas posições iguais na fila é o mesmo que fila nenhuma — o designer
       não sabe qual fazer primeiro. Se a vaga já tem dono, os dois trocam
       (é o que o projeto faz); e se quem chega não tinha posição, o dono
       antigo vai para a primeira vaga livre em vez de ficar duplicado. */
    if (data.posicao != null) {
      const dono = db
        .prepare("SELECT id FROM pedidos WHERE fila = ? AND id <> ?")
        .get(data.posicao, data.id) as { id: string } | undefined;
      if (dono) {
        const destino = pedido.fila ?? primeiraVagaLivre(db, [data.posicao]);
        db.prepare("UPDATE pedidos SET fila = ?, updated_at = ? WHERE id = ?").run(destino, ts, dono.id);
      }
    }

    db.prepare("UPDATE pedidos SET fila = ?, updated_at = ? WHERE id = ?").run(data.posicao, ts, data.id);
    return { ok: true };
  });

/** Menor posição de 1 a 10 que ninguém ocupa; null se a fila estiver cheia. */
function primeiraVagaLivre(db: ReturnType<typeof getDb>, ocupadasAlem: number[] = []): number | null {
  const usadas = new Set<number>(ocupadasAlem);
  for (const l of db.prepare("SELECT fila FROM pedidos WHERE fila IS NOT NULL").all() as { fila: number }[]) {
    usadas.add(l.fila);
  }
  for (let n = 1; n <= 10; n++) if (!usadas.has(n)) return n;
  return null;
}

/** O "+" do card: põe na primeira vaga livre, não na 1 — senão quem já
    estava na 1 ganha um sósia. */
export const enfileirarPedido = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().min(1) }))
  .middleware([requireAuth])
  .handler(async ({ data, context }) => {
    const { user } = context as AuthContext;
    requirePerm(user, "pedidos.status_design");
    const db = getDb();
    const pedido = db.prepare("SELECT id, fila FROM pedidos WHERE id = ?").get(data.id) as
      { id: string; fila: number | null } | undefined;
    if (!pedido) throw new Error("Pedido não encontrado.");
    if (pedido.fila != null) return { posicao: pedido.fila };
    const vaga = primeiraVagaLivre(db);
    if (vaga == null) throw new Error("A fila já tem dez pedidos. Tire um antes de pôr outro.");
    db.prepare("UPDATE pedidos SET fila = ?, updated_at = ? WHERE id = ?").run(vaga, agora(), data.id);
    return { posicao: vaga };
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
    getDb()
      .prepare(`INSERT INTO pedido_vistos (user_id, pedido_id, visto_em) VALUES (?, ?, ?)
                ON CONFLICT(user_id, pedido_id) DO UPDATE SET visto_em = excluded.visto_em`)
      .run(user.id, data.id, agora());
    return { ok: true };
  });
