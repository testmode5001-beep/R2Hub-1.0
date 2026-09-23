// Banco de dados local da V3 — SQLite embutido via node:sqlite (nativo do Node 22+).
// Zero serviços externos: o banco é um arquivo em disco, backup = copiar o arquivo.
// Toda a camada SQL do sistema está concentrada nos módulos src/server/*.server.ts;
// uma eventual troca de motor (ex.: PostgreSQL) não toca o frontend.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { hashPassword } from "./password.server";

// Permissões das calculadoras (mapeadas para as abas do FlexoFaca no frontend).
export const CALC_PERMISSIONS = [
  "calc.desenvolvimento",
  "calc.comparativo",
  "calc.diametro",
  "calc.distorcao",
  "calc.valor",
  "calc.bobinas",
  "calc.substrato",
  "calc.caixa",
  // nascidas no v1a (não existiam no FlexoFaca)
  "calc.metragem",
  "calc.valoretiqueta",
  "calc.tinta",
] as const;

// As 69 permissões do projeto v1a, nos mesmos 11 grupos da tela Equipe.
// Uma permissão só entra aqui quando alguma coisa no sistema realmente olha
// para ela — interruptor que não faz nada é pior que interruptor nenhum.
export const PERMISSIONS = [
  // Pedidos
  "pedidos.criar",
  "pedidos.ver_proprios",
  "pedidos.ver_todos",
  "pedidos.editar_proprios",
  "pedidos.editar_todos",
  "pedidos.prioridade",
  "pedidos.reabrir",
  "pedidos.excluir",
  /* Passar os pedidos de um cliente de uma vendedora para outra. É poder
     separado de "editar": muda QUEM VÊ o pedido (a lista de quem não tem
     ver_todos é filtrada por vendedor_id), não só o conteúdo dele. */
  "pedidos.transferir",
  // Arte e design
  "pedidos.status_design",
  "design.assumir",
  "design.enviar_arte",
  "design.revisar",
  "design.arquivo_final",
  "design.medidas",
  // Aprovação do cliente
  "tab.cliches",
  "pedidos.aprovar",
  "aprovacao.responder_cliente",
  "aprovacao.prova_enviar",
  "aprovacao.reprovar",
  // Clichês
  "tab.solicitar_cliche",
  "cliche.solicitar",
  "cliche.registrar",
  "cliche.reposicao",
  "cliche.motivo_criar",
  "cliche.valor_ver",
  "cliche.valor_editar",
  // Facas e afiação
  "tab.afiacao",
  "faca.enviar_afiacao",
  "faca.receber",
  "faca.comprar",
  "faca.substrato_criar",
  "faca.custo_ver",
  // tirar uma faca do catálogo (marcar morta) é decisão de quem cuida do
  // ferramental — não de quem só consulta o desenho
  "faca.marcar_morta",
  // Clientes e cadastros
  "cliente.criar_pasta",
  "cliente.editar",
  "cadastro.medidas",
  "cadastro.materiais",
  "cadastro.cores",
  // Arquivos
  "anexo.upload",
  "anexo.baixar",
  "anexo.excluir",
  // acervo físico (gavetas e pastas de cliente). O número da pasta continua
  // aparecendo no Pantone para quem não tem esta permissão — o que ela fecha é
  // a TELA de gestão do acervo, não a consulta pontual.
  "tab.arquivos",
  // pastas dos clientes na REDE (\\server\Arte\Clientes) — a tela que evita
  // abrir o Explorador para achar a arte. Só leitura; nada grava no share.
  // Não confundir com tab.arquivos, que é o acervo FÍSICO de clichês.
  "tab.clientes",
  // Calculadoras
  ...CALC_PERMISSIONS,
  // baixar o gabarito 1:1 da faca (SVG de produção do ferramental). Não é uma
  // calculadora: é o desenho que vai para a gravação — fica fora de
  // CALC_PERMISSIONS de propósito, para não entrar em "liberou as contas,
  // liberou o desenho".
  "calc.gabarito",
  // Painel de produção
  "tab.painel",
  // página OP (leitura de ordem) separada do Painel: dá para liberar só ela
  "tab.op",
  "painel.carregar_os",
  "painel.rodar",
  "painel.finalizar",
  "painel.cancelar",
  "painel.maquinas",
  "painel.custos_ver",
  "painel.custos",
  // Apontamentos
  "apontamentos.ver",
  "apontamentos.financeiro",
  "apontamentos.exportar",
  // Administração
  "usuarios.gerenciar",
  // versão restrita do gerenciar: cria contas SÓ com o próprio cargo (um login
  // de vendas com ela cadastra outro de vendas, e mais nada)
  "usuarios.criar_departamento",
  // o protótipo desenhava "ver a senha de qualquer usuário"; senha é hash, não
  // existe como texto — a permissão equivalente é poder REDEFINIR a de qualquer um
  "senha.resetar",
  "permissoes.gerenciar",
  "cargos.gerenciar",
  "sessoes.forcar_logout",
  "auditoria.ver",
  "config.sistema",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Permissão nova → permissão antiga que já dava esse poder. É o mapa da
 * migração 16: quem podia continua podendo, ninguém fica trancado do lado de
 * fora por causa do detalhamento. `null` = liberada para todo mundo.
 */
export const HERANCA_PERMISSOES: Record<string, string | null> = {
  "pedidos.ver_proprios": null,
  "pedidos.editar_proprios": "pedidos.criar",
  "pedidos.prioridade": "pedidos.editar_todos",
  "pedidos.reabrir": "pedidos.editar_todos",
  "pedidos.transferir": "pedidos.editar_todos",
  "design.assumir": "pedidos.status_design",
  "design.enviar_arte": "pedidos.status_design",
  "design.revisar": "pedidos.status_design",
  "design.arquivo_final": "pedidos.status_design",
  "design.medidas": "pedidos.editar_todos",
  "aprovacao.responder_cliente": "pedidos.aprovar",
  "aprovacao.prova_enviar": "pedidos.aprovar",
  "aprovacao.reprovar": "pedidos.aprovar",
  "cliche.solicitar": "tab.solicitar_cliche",
  "cliche.reposicao": "tab.solicitar_cliche",
  "cliche.registrar": "tab.cliches",
  "cliche.motivo_criar": "tab.cliches",
  "cliche.valor_ver": "tab.cliches",
  "cliche.valor_editar": "tab.cliches",
  "faca.enviar_afiacao": "tab.afiacao",
  "faca.receber": "tab.afiacao",
  "faca.comprar": "tab.afiacao",
  "faca.substrato_criar": "tab.afiacao",
  "faca.custo_ver": "tab.afiacao",
  "faca.marcar_morta": "tab.afiacao",
  "cliente.criar_pasta": "pedidos.criar",
  "cliente.editar": "pedidos.editar_todos",
  "cadastro.medidas": "pedidos.editar_todos",
  "cadastro.materiais": "pedidos.editar_todos",
  "cadastro.cores": "pedidos.editar_todos",
  "anexo.upload": "pedidos.criar",
  "anexo.baixar": null,
  "anexo.excluir": "pedidos.editar_todos",
  "tab.painel": "pedidos.ver_todos",
  "tab.op": "tab.painel",
  "painel.carregar_os": "pedidos.ver_todos",
  "painel.rodar": "pedidos.ver_todos",
  "painel.finalizar": "pedidos.ver_todos",
  "painel.cancelar": "pedidos.ver_todos",
  "painel.maquinas": "pedidos.editar_todos",
  "painel.custos_ver": "apontamentos.ver",
  "painel.custos": "usuarios.gerenciar",
  "apontamentos.financeiro": "apontamentos.ver",
  "apontamentos.exportar": "apontamentos.ver",
  "senha.resetar": "usuarios.gerenciar",
  "cargos.gerenciar": "permissoes.gerenciar",
  "sessoes.forcar_logout": "usuarios.gerenciar",
  "config.sistema": "usuarios.gerenciar",
};

/**
 * Linha genérica vinda do SQLite. Os tipos que o node:sqlite devolve nas nossas
 * tabelas são só estes três — e, ao contrário de `Record<string, unknown>`, este
 * tipo atravessa a serialização das server fns sem virar erro de compilação.
 */
export type LinhaSQL = Record<string, string | number | null>;

// Cargos são TEMPLATES de permissões, guardados no banco (tabelas `roles` e
// `role_permissions`) para que o gestor possa criar/editar cargos pelo painel.
// A lista abaixo é apenas a semente da primeira execução.
// `admin` é cargo de sistema (bypass total, não editável nem removível).
export const SEED_ROLES: {
  nome: string;
  label: string;
  sistema: number;
  permissoes: Permission[];
}[] = [
  { nome: "admin", label: "Administrador", sistema: 1, permissoes: [...PERMISSIONS] },
  { nome: "gestor", label: "Gestor", sistema: 0, permissoes: [...PERMISSIONS] },
  {
    nome: "designer",
    label: "Designer",
    sistema: 0,
    permissoes: [
      "pedidos.ver_todos",
      "pedidos.status_design",
      // o designer também registra a aprovação: cliente que aprovou por fora
      // (meses depois, direto com quem fez a arte) não precisa da vendedora
      "pedidos.aprovar",
      "tab.cliches",
      "tab.afiacao",
      "tab.arquivos",
      "tab.clientes",
      ...CALC_PERMISSIONS,
      "calc.gabarito",
    ],
  },
  { nome: "comercial", label: "Comercial", sistema: 0, permissoes: ["pedidos.criar", "pedidos.aprovar", "tab.clientes"] },
  { nome: "vendas", label: "Vendas", sistema: 0, permissoes: ["pedidos.criar", "pedidos.aprovar", "tab.clientes"] },
  {
    nome: "producao",
    label: "Produção",
    sistema: 0,
    permissoes: ["pedidos.ver_todos", "tab.afiacao", "tab.solicitar_cliche", "tab.arquivos", "tab.clientes", ...CALC_PERMISSIONS, "calc.gabarito"],
  },
  {
    nome: "estoque",
    label: "Estoque",
    sistema: 0,
    permissoes: ["pedidos.ver_todos", "tab.afiacao", "tab.solicitar_cliche", "tab.arquivos", "tab.clientes", "calc.bobinas", "calc.substrato", "calc.caixa"],
  },
];

function dbPath() {
  return process.env.DESIGNHUB_DB ?? path.join(process.cwd(), "data", "designhub.db");
}

function migrate(db: DatabaseSync) {
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };

  if (user_version < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        nome TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'comercial',
        ativo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT NOT NULL,
        permission TEXT NOT NULL,
        PRIMARY KEY (role, permission)
      );

      CREATE TABLE IF NOT EXISTS clientes (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        nome_norm TEXT NOT NULL UNIQUE,
        pasta TEXT NOT NULL,
        created_by TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pedidos (
        id TEXT PRIMARY KEY,
        numero INTEGER NOT NULL UNIQUE,
        vendedor_id TEXT NOT NULL REFERENCES users(id),
        designer_id TEXT REFERENCES users(id),
        cliente_id TEXT REFERENCES clientes(id),
        cliente TEXT NOT NULL,
        materia TEXT NOT NULL,
        larg_materia TEXT NOT NULL,
        largura TEXT NOT NULL,
        altura TEXT NOT NULL,
        forma TEXT NOT NULL,
        cores TEXT NOT NULL,
        cores_desc TEXT,
        carreiras TEXT,
        descricao TEXT NOT NULL,
        link_ref TEXT,
        status TEXT NOT NULL DEFAULT 'nova',
        cliche_solicitado_em TEXT,
        cliche_concluido_em TEXT,
        cancelado_em TEXT,
        picote INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pedido_historico (
        id TEXT PRIMARY KEY,
        pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        user_id TEXT,
        user_nome TEXT,
        status TEXT NOT NULL,
        observacao TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pedido_anexos (
        id TEXT PRIMARY KEY,
        pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        user_id TEXT,
        tipo TEXT NOT NULL,
        nome TEXT NOT NULL,
        path TEXT NOT NULL,
        versao INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        titulo TEXT NOT NULL,
        corpo TEXT,
        url TEXT,
        lida INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_nome TEXT,
        acao TEXT NOT NULL,
        entidade TEXT NOT NULL,
        entidade_id TEXT,
        detalhe TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor_id);
      CREATE INDEX IF NOT EXISTS idx_historico_pedido ON pedido_historico(pedido_id);
      CREATE INDEX IF NOT EXISTS idx_anexos_pedido ON pedido_anexos(pedido_id);
      CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, lida);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
    `);

    // (os templates de cargo são semeados na migração 8, junto com a tabela `roles`)

    const hasUsers = db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number };
    if (hasUsers.c === 0) {
      const agora = new Date().toISOString();
      db.prepare(
        "INSERT INTO users (id, username, nome, password_hash, role, ativo, created_at, updated_at) VALUES (?,?,?,?,?,1,?,?)",
      ).run(randomUUID(), "admin", "Administrador", hashPassword("r2hub2026"), "admin", agora, agora);
      console.log('[DesignHub] Usuário inicial criado: admin / r2hub2026 — TROQUE A SENHA no painel.');
    }

    db.exec("PRAGMA user_version = 1");
  }

  if (user_version < 2) {
    // Registro de chegada de clichê: data, hora e valor por cor (apontamentos futuros).
    db.exec(`
      CREATE TABLE IF NOT EXISTS cliche_registros (
        id TEXT PRIMARY KEY,
        pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        user_id TEXT,
        user_nome TEXT,
        data_chegada TEXT NOT NULL,
        hora_chegada TEXT NOT NULL,
        itens TEXT NOT NULL,
        total REAL NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cliche_pedido ON cliche_registros(pedido_id);
    `);
    db.exec("PRAGMA user_version = 2");
  }

  if (user_version < 3) {
    // Solicitações de clichê (enviadas por e-mail à clicheria) + motivos configuráveis.
    db.exec(`
      CREATE TABLE IF NOT EXISTS cliche_motivos (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS cliche_solicitacoes (
        id TEXT PRIMARY KEY,
        numero INTEGER NOT NULL UNIQUE,
        user_id TEXT,
        user_nome TEXT,
        cliente TEXT,
        tipo TEXT NOT NULL,
        cores TEXT NOT NULL,
        motivo TEXT NOT NULL,
        observacao TEXT,
        anexos TEXT NOT NULL,
        email_para TEXT,
        email_enviado INTEGER NOT NULL DEFAULT 0,
        email_erro TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cliche_sol_created ON cliche_solicitacoes(created_at);
    `);

    const seedMotivo = db.prepare(
      "INSERT OR IGNORE INTO cliche_motivos (id, nome, created_at) VALUES (?, ?, ?)",
    );
    const MOTIVOS_INICIAIS = [
      "Clichê novo",
      "Erro de desenvolvimento",
      "Danificado em máquina",
      "Atualização 1.14",
      "Danificado na colagem",
      "Erro de ortografia",
      "Alteração cliente",
    ];
    for (const m of MOTIVOS_INICIAIS) seedMotivo.run(randomUUID(), m, new Date().toISOString());

    // Gestor passa a ver a aba de apontamentos (admin já tem bypass).
    db.prepare(
      "INSERT OR IGNORE INTO role_permissions (role, permission) VALUES ('gestor', 'apontamentos.ver')",
    ).run();

    db.exec("PRAGMA user_version = 3");
  }

  if (user_version < 4) {
    // Facas enviadas para afiação: medida + substrato; ao voltar, estado (bom/regular/ruim)
    // e possível solicitação de faca nova. Alimenta os apontamentos.
    db.exec(`
      CREATE TABLE IF NOT EXISTS faca_substratos (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS faca_afiacoes (
        id TEXT PRIMARY KEY,
        numero INTEGER NOT NULL UNIQUE,
        user_id TEXT,
        user_nome TEXT,
        medida TEXT NOT NULL,
        substrato TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'enviada',
        estado TEXT,
        nova_solicitada INTEGER NOT NULL DEFAULT 0,
        recebida_por TEXT,
        recebida_em TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_faca_afiacoes_created ON faca_afiacoes(created_at);
    `);

    const seedSub = db.prepare(
      "INSERT OR IGNORE INTO faca_substratos (id, nome, created_at) VALUES (?, ?, ?)",
    );
    const SUBSTRATOS_INICIAIS = [
      "Couchê",
      "Couchê AA",
      "Nylon resinado",
      "Cartão",
      "Cartão AA",
      "BOPP",
      "BOPP metalizado",
      "Térmico",
      "Térmico Eco",
    ];
    for (const s of SUBSTRATOS_INICIAIS) seedSub.run(randomUUID(), s, new Date().toISOString());

    db.exec("PRAGMA user_version = 4");
  }

  if (user_version < 5) {
    // Observação registrada na chegada da faca de afiação.
    db.exec("ALTER TABLE faca_afiacoes ADD COLUMN observacao TEXT");
    db.exec("PRAGMA user_version = 5");
  }

  if (user_version < 6) {
    // Valor (R$) pago pela afiação, registrado na chegada da faca.
    db.exec("ALTER TABLE faca_afiacoes ADD COLUMN valor REAL");
    db.exec("PRAGMA user_version = 6");
  }

  if (user_version < 7) {
    // Permissões POR USUÁRIO (o cargo passa a ser só template). Migra os usuários
    // atuais preservando o que já tinham, expandindo status_design → abas + calculadoras.
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission TEXT NOT NULL,
        PRIMARY KEY (user_id, permission)
      );
    `);

    const usuarios = db.prepare("SELECT id, role FROM users").all() as { id: string; role: string }[];
    const insUP = db.prepare(
      "INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)",
    );
    for (const u of usuarios) {
      if (u.role === "admin") continue; // admin tem bypass, não precisa de linhas
      const atuais = (
        db.prepare("SELECT permission FROM role_permissions WHERE role = ?").all(u.role) as {
          permission: string;
        }[]
      ).map((r) => r.permission);
      const set = new Set(atuais);
      // Antes, status_design destravava Clichês, Afiação e as calculadoras.
      if (set.has("pedidos.status_design")) {
        set.add("tab.cliches");
        set.add("tab.afiacao");
        for (const c of CALC_PERMISSIONS) set.add(c);
      }
      for (const p of set) insUP.run(u.id, p);
    }

    db.exec("PRAGMA user_version = 7");
  }

  if (user_version < 8) {
    // Cargos viram dados (o gestor pode criar/editar/excluir pelo painel).
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        nome TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        sistema INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    const ts = new Date().toISOString();
    const insRole = db.prepare(
      "INSERT OR IGNORE INTO roles (nome, label, sistema, created_at) VALUES (?,?,?,?)",
    );
    const insPerm = db.prepare(
      "INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)",
    );
    for (const r of SEED_ROLES) {
      insRole.run(r.nome, r.label, r.sistema, ts);
      for (const p of r.permissoes) insPerm.run(r.nome, p);
    }

    // Cargo "auditor" foi descontinuado.
    db.prepare("DELETE FROM roles WHERE nome = 'auditor'").run();
    db.prepare("DELETE FROM role_permissions WHERE role = 'auditor'").run();

    // Não deixa nenhum usuário com cargo órfão: registra o que ainda estiver em uso.
    const orfaos = db
      .prepare("SELECT DISTINCT role FROM users WHERE role NOT IN (SELECT nome FROM roles)")
      .all() as { role: string }[];
    for (const o of orfaos) insRole.run(o.role, o.role, 0, ts);

    db.exec("PRAGMA user_version = 8");
  }

  if (user_version < 9) {
    // Configurações gerais (chave/valor) — usadas pela capa/home do Hub.
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        chave TEXT PRIMARY KEY,
        valor TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT
      );
    `);
    const ins = db.prepare(
      "INSERT OR IGNORE INTO settings (chave, valor, updated_at) VALUES (?,?,?)",
    );
    const ts = new Date().toISOString();
    ins.run("home.titulo", "Do design\nà impressão", ts);
    ins.run("home.frase", "CONTAMOS COM\nVOCÊ, SEMPRE!", ts);
    ins.run("home.versao", "R2 HUB V0.01", ts);
    db.exec("PRAGMA user_version = 9");
  }

  if (user_version < 10) {
    // Duas calculadoras novas (Largura do Substrato e Etiquetas por Caixa).
    // Quem já tem QUALQUER calculadora ganha as novas — mantém a paridade sem
    // destravar calculadora para quem não usava nenhuma.
    const novas = ["calc.substrato", "calc.caixa"];
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const rolesComCalc = db
      .prepare("SELECT DISTINCT role FROM role_permissions WHERE permission LIKE 'calc.%'")
      .all() as { role: string }[];
    for (const r of rolesComCalc) for (const p of novas) insRP.run(r.role, p);

    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    const usersComCalc = db
      .prepare("SELECT DISTINCT user_id FROM user_permissions WHERE permission LIKE 'calc.%'")
      .all() as { user_id: string }[];
    for (const u of usersComCalc) for (const p of novas) insUP.run(u.user_id, p);

    db.exec("PRAGMA user_version = 10");
  }

  if (user_version < 11) {
    // Solicitação de clichê danificado: um pedido "tipo=cliche" que chega ao
    // designer como uma arte nova, porém com chip amarelo na Central. Carrega
    // só o código do produto (sem specs de etiqueta).
    db.exec("ALTER TABLE pedidos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'arte'");
    db.exec("ALTER TABLE pedidos ADD COLUMN codigo_produto TEXT");

    // Libera a nova aba para quem faz esse pedido na produção.
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    for (const role of ["gestor", "producao", "estoque"]) insRP.run(role, "tab.solicitar_cliche");

    db.exec("PRAGMA user_version = 11");
  }

  if (user_version < 12) {
    // Motivo da solicitação de clichê como coluna própria — para exibir no chip
    // da Central (no lugar do rótulo "Reposição de clichê").
    db.exec("ALTER TABLE pedidos ADD COLUMN motivo TEXT");
    db.exec("PRAGMA user_version = 12");
  }

  if (user_version < 13) {
    // Comentário interno do pedido (modal Pedido do design v1a): recado para a
    // equipe sem mudar o status — por isso não entra em pedido_historico.
    db.exec(`
      CREATE TABLE IF NOT EXISTS pedido_comentarios (
        id TEXT PRIMARY KEY,
        pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        user_id TEXT,
        user_nome TEXT,
        texto TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_comentarios_pedido ON pedido_comentarios(pedido_id);
    `);
    db.exec("PRAGMA user_version = 13");
  }

  if (user_version < 14) {
    // Anotações pessoais (card da Central, lembretes da Home e modal do topo).
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_notas (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        texto TEXT NOT NULL,
        quando TEXT,
        feito INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_notas_user ON user_notas(user_id, feito);
    `);
    db.exec("PRAGMA user_version = 14");
  }

  if (user_version < 15) {
    // Três calculadoras que nasceram no v1a (Metragem do rolo, Valor da etiqueta
    // e Consumo de tinta). Mesma regra da migração 10: quem já usa QUALQUER
    // calculadora ganha as novas; quem não usava nenhuma continua sem.
    const novas = ["calc.metragem", "calc.valoretiqueta", "calc.tinta"];

    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const rolesComCalc = db
      .prepare("SELECT DISTINCT role FROM role_permissions WHERE permission LIKE 'calc.%'")
      .all() as { role: string }[];
    for (const r of rolesComCalc) for (const p of novas) insRP.run(r.role, p);

    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    const usersComCalc = db
      .prepare("SELECT DISTINCT user_id FROM user_permissions WHERE permission LIKE 'calc.%'")
      .all() as { user_id: string }[];
    for (const u of usersComCalc) for (const p of novas) insUP.run(u.user_id, p);

    db.exec("PRAGMA user_version = 15");
  }

  if (user_version < 16) {
    // As 69 permissões do projeto v1a. O detalhamento NÃO pode tirar acesso de
    // ninguém: cada permissão nova é concedida a quem já tinha a permissão
    // "grossa" equivalente (HERANCA_PERMISSOES); as marcadas com null valem
    // para todos os cargos e usuários que já existem.
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");

    const roles = db.prepare("SELECT nome FROM roles").all() as { nome: string }[];
    const usuarios = db.prepare("SELECT id FROM users").all() as { id: string }[];
    const temRole = db.prepare("SELECT 1 FROM role_permissions WHERE role = ? AND permission = ?");
    const temUser = db.prepare("SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = ?");

    for (const [nova, base] of Object.entries(HERANCA_PERMISSOES)) {
      for (const r of roles) {
        if (r.nome === "admin" || base === null || temRole.get(r.nome, base)) insRP.run(r.nome, nova);
      }
      for (const u of usuarios) {
        // só mexe em quem tem permissões próprias — quem segue o cargo continua seguindo
        const proprias = db.prepare("SELECT COUNT(*) AS n FROM user_permissions WHERE user_id = ?").get(u.id) as { n: number };
        if (proprias.n === 0) continue;
        if (base === null || temUser.get(u.id, base)) insUP.run(u.id, nova);
      }
    }

    db.exec("PRAGMA user_version = 16");
  }

  if (user_version < 17) {
    // Preferências de cada pessoa (a primeira é o papel de parede da Home).
    // Fica separado de `settings`, que é configuração do sistema inteiro.
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_config (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        chave TEXT NOT NULL,
        valor TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, chave)
      );
    `);
    db.exec("PRAGMA user_version = 17");
  }

  if (user_version < 18) {
    // Cadastros compartilhados da solicitação de arte: medidas (formatos),
    // matéria-prima e cores. Antes as opções eram uma lista fixa no código e o
    // botão "adicionar" só inventava um nome na tela de quem clicou — agora
    // valem para todo mundo e cada tipo tem a sua permissão (cadastro.*).
    db.exec(`
      CREATE TABLE IF NOT EXISTS cadastros (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        nome TEXT NOT NULL COLLATE NOCASE,
        extra TEXT,
        user_id TEXT,
        user_nome TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (tipo, nome)
      );
      CREATE INDEX IF NOT EXISTS idx_cadastros_tipo ON cadastros(tipo);

      /* Resposta ao cliente x recado interno: mesma conversa, canais diferentes. */
      ALTER TABLE pedido_comentarios ADD COLUMN canal TEXT NOT NULL DEFAULT 'interno';
    `);
    db.exec("PRAGMA user_version = 18");
  }

  if (user_version < 19) {
    // Fila de leituras de OP (tela Leitura / celular → painel da Fábrica).
    // Antes vivia no localStorage de cada navegador — a leitura feita num
    // aparelho nunca chegava ao painel de outro. Campos espelham o tipo
    // Leitura do front (tudo texto: valores vêm de OCR/colagem, não de conta).
    db.exec(`
      CREATE TABLE IF NOT EXISTS leituras (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        user_nome TEXT,
        op TEXT NOT NULL,
        cliente TEXT,
        descricao TEXT,
        medida TEXT NOT NULL,
        substrato TEXT NOT NULL,
        metragem TEXT NOT NULL,
        carreiras TEXT,
        nucleo TEXT,
        rolos TEXT,
        entrega TEXT,
        usada INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_leituras_created ON leituras(created_at);
    `);
    db.exec("PRAGMA user_version = 19");
  }

  if (user_version < 20) {
    // Senha criada pelo gestor é PROVISÓRIA: o dono da conta troca no primeiro
    // acesso. A marca fica na própria linha do usuário; o login devolve a marca
    // e o hub não abre enquanto ela estiver de pé.
    db.exec("ALTER TABLE users ADD COLUMN precisa_trocar_senha INTEGER NOT NULL DEFAULT 0");
    db.exec("PRAGMA user_version = 20");
  }

  if (user_version < 21) {
    // Chat da equipe: o canal que não é de nenhum pedido. As conversas POR
    // pedido continuam em pedido_comentarios — aqui é o "corredor", onde se
    // fala sem precisar de uma ordem aberta.
    db.exec(`
      CREATE TABLE IF NOT EXISTS chat_mensagens (
        id TEXT PRIMARY KEY,
        canal TEXT NOT NULL DEFAULT 'geral',
        user_id TEXT,
        user_nome TEXT,
        texto TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_canal ON chat_mensagens(canal, created_at);
    `);
    db.exec("PRAGMA user_version = 21");
  }

  if (user_version < 22) {
    // Conversa direta entre duas pessoas: mesma tabela, canal 'dm' e o
    // destinatário gravado na linha. Quem participa = user_id ou para_id.
    db.exec("ALTER TABLE chat_mensagens ADD COLUMN para_id TEXT");
    db.exec("ALTER TABLE chat_mensagens ADD COLUMN para_nome TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_chat_dm ON chat_mensagens(para_id, created_at)");
    db.exec("PRAGMA user_version = 22");
  }

  if (user_version < 23) {
    // Tarja no verso: pergunta de sim/não que a produção precisa saber ANTES
    // de fechar a arte (muda a montagem do clichê).
    db.exec("ALTER TABLE pedidos ADD COLUMN tarja_verso INTEGER NOT NULL DEFAULT 0");
    db.exec("PRAGMA user_version = 23");
  }

  if (user_version < 24) {
    // Verniz: mesma natureza da tarja — sim/não que muda o que a produção faz.
    db.exec("ALTER TABLE pedidos ADD COLUMN verniz INTEGER NOT NULL DEFAULT 0");
    db.exec("PRAGMA user_version = 24");
  }

  if (user_version < 25) {
    // Cold stamp: terceiro acabamento de sim/não do formulário de arte.
    db.exec("ALTER TABLE pedidos ADD COLUMN cold_stamp INTEGER NOT NULL DEFAULT 0");
    db.exec("PRAGMA user_version = 25");
  }

  if (user_version < 26) {
    // Permissões que nasceram DEPOIS da migração 16 e por isso ficaram fora
    // da herança: tab.op (a página OP deixa de andar colada no Painel) e
    // faca.marcar_morta. Mesma regra de lá: ninguém perde acesso — quem tinha
    // a permissão-base ganha a nova.
    const tardias: [string, string][] = [
      ["tab.op", "tab.painel"],
      ["faca.marcar_morta", "tab.afiacao"],
    ];
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    const roles = db.prepare("SELECT nome FROM roles").all() as { nome: string }[];
    const usuarios = db.prepare("SELECT id FROM users").all() as { id: string }[];
    const temRole = db.prepare("SELECT 1 FROM role_permissions WHERE role = ? AND permission = ?");
    const temUser = db.prepare("SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = ?");
    for (const [nova, base] of tardias) {
      for (const r of roles) if (r.nome === "admin" || temRole.get(r.nome, base)) insRP.run(r.nome, nova);
      for (const u of usuarios) if (temUser.get(u.id, base)) insUP.run(u.id, nova);
    }
    db.exec("PRAGMA user_version = 26");
  }

  if (user_version < 27) {
    // Gabarito da faca (SVG 1:1 para gravar o ferramental). Quem já usava a
    // Calculadora de Facas ganha — o botão nasce dentro dela e tirar seria
    // perda de acesso; os outros cargos entram por decisão de quem administra.
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    const roles = db.prepare("SELECT nome FROM roles").all() as { nome: string }[];
    const usuarios = db.prepare("SELECT id FROM users").all() as { id: string }[];
    const temRole = db.prepare("SELECT 1 FROM role_permissions WHERE role = ? AND permission = ?");
    const temUser = db.prepare("SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = ?");
    for (const r of roles) if (r.nome === "admin" || temRole.get(r.nome, "calc.desenvolvimento")) insRP.run(r.nome, "calc.gabarito");
    for (const u of usuarios) if (temUser.get(u.id, "calc.desenvolvimento")) insUP.run(u.id, "calc.gabarito");
    db.exec("PRAGMA user_version = 27");
  }

  if (user_version < 28) {
    /* Estoque sai do navegador e vem para o banco. Falta de matéria-prima é
       recado para a fábrica inteira: no localStorage, quem apontava era o
       único a ver — e limpar o cache apagava tudo. Etiquetas por caixa idem. */
    db.exec(`
      CREATE TABLE IF NOT EXISTS estoque_faltas (
        id TEXT PRIMARY KEY,
        pedido_num TEXT NOT NULL,
        motivo TEXT NOT NULL,
        obs TEXT,
        previsao TEXT,
        status TEXT NOT NULL DEFAULT 'aberta',
        substituto TEXT,
        -- SET NULL, não CASCADE: excluir uma pessoa não pode apagar (nem travar)
        -- o histórico de paradas da fábrica. O nome fica gravado na linha.
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        user_nome TEXT NOT NULL,
        resolvido_em TEXT,
        resolvido_por TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_faltas_status ON estoque_faltas(status, created_at);

      CREATE TABLE IF NOT EXISTS estoque_etiquetas (
        id TEXT PRIMARY KEY,
        medida TEXT NOT NULL,
        substrato TEXT,
        cliente TEXT,
        caixas INTEGER NOT NULL DEFAULT 0,
        por_caixa INTEGER NOT NULL DEFAULT 0,
        minimo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    db.exec("PRAGMA user_version = 28");
  }

  if (user_version < 29) {
    /* Conserta a FK de estoque_faltas nos bancos que já passaram pela 28: sem
       ON DELETE SET NULL, excluir um usuário que apontou falta ficaria travado
       pela constraint. SQLite não altera FK — recria a tabela e copia. */
    db.exec(`
      CREATE TABLE IF NOT EXISTS estoque_faltas_nova (
        id TEXT PRIMARY KEY,
        pedido_num TEXT NOT NULL,
        motivo TEXT NOT NULL,
        obs TEXT,
        previsao TEXT,
        status TEXT NOT NULL DEFAULT 'aberta',
        substituto TEXT,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        user_nome TEXT NOT NULL,
        resolvido_em TEXT,
        resolvido_por TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO estoque_faltas_nova SELECT * FROM estoque_faltas;
      DROP TABLE estoque_faltas;
      ALTER TABLE estoque_faltas_nova RENAME TO estoque_faltas;
      CREATE INDEX IF NOT EXISTS idx_faltas_status ON estoque_faltas(status, created_at);
    `);
    db.exec("PRAGMA user_version = 29");
  }

  if (user_version < 30) {
    /* Painel de produção sai do navegador. O que uma máquina está rodando é a
       informação mais compartilhada da fábrica — e vivia no localStorage de
       quem carregou a OP: o Mural noutro monitor mostrava tudo livre, e quem
       apontou a produção era o único a ver o histórico. */
    db.exec(`
      CREATE TABLE IF NOT EXISTS painel_maquinas (
        k TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        valor REAL NOT NULL DEFAULT 0,
        setor TEXT,
        fixa INTEGER NOT NULL DEFAULT 0,
        ordem INTEGER NOT NULL DEFAULT 0
      );

      -- uma linha por máquina: dois PCs mexendo em máquinas diferentes não se atropelam
      CREATE TABLE IF NOT EXISTS painel_estado (
        maquina TEXT PRIMARY KEY,
        estado_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS producao_apontamentos (
        id TEXT PRIMARY KEY,
        maquina TEXT NOT NULL,
        os TEXT,
        cliente TEXT,
        substrato TEXT,
        medida TEXT,
        ms INTEGER NOT NULL DEFAULT 0,
        custo REAL NOT NULL DEFAULT 0,
        metros REAL NOT NULL DEFAULT 0,
        tag TEXT NOT NULL,
        user_nome TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_producao_data ON producao_apontamentos(created_at DESC);
    `);

    // as 7 máquinas do parque entram já cadastradas, na ordem do painel
    const insM = db.prepare(
      "INSERT OR IGNORE INTO painel_maquinas (k, nome, valor, setor, fixa, ordem) VALUES (?,?,?,?,1,?)",
    );
    const PARQUE: [string, string, number, string | null][] = [
      ["classic", "Classic", 180, null],
      ["force", "Force", 260, null],
      ["maqflex", "Maqflex", 210, null],
      ["delrey4", "Del Rey 4", 240, null],
      ["delrey5", "Del Rey 5", 280, null],
      ["rebob1", "Rebobinadeira 1", 90, "rebobinagem"],
      ["rebob2", "Rebobinadeira 2", 90, "rebobinagem"],
    ];
    PARQUE.forEach(([k, nome, valor, setor], i) => insM.run(k, nome, valor, setor, i));

    db.exec("PRAGMA user_version = 30");
  }

  if (user_version < 31) {
    /* "Faca nova já foi pedida ao fornecedor" era a última coisa da Afiação
       ainda presa ao navegador (uma lista de números no localStorage): quem
       marcava era o único a ver, e a fila voltava cheia para os outros. */
    db.exec("ALTER TABLE faca_afiacoes ADD COLUMN nova_pedida INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE faca_afiacoes ADD COLUMN nova_pedida_em TEXT");
    db.exec("PRAGMA user_version = 31");
  }

  if (user_version < 32) {
    /* Catálogo de facas: marcar morta é decisão de ferramental (tem permissão
       própria) e valia só no navegador de quem clicou — o colega continuava
       vendo a faca no catálogo e podia mandar gravar. Facas acrescentadas à
       mão e seções novas idem. */
    db.exec(`
      CREATE TABLE IF NOT EXISTS facas_mortas (
        cod TEXT PRIMARY KEY,
        user_nome TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS facas_extras (
        cod TEXT PRIMARY KEY,
        dados_json TEXT NOT NULL,
        user_nome TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS facas_secoes (
        nome TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      );
    `);
    db.exec("PRAGMA user_version = 32");
  }

  if (user_version < 33) {
    /* Arquivo físico: o cadastro das pastas é da empresa, não de um navegador.
       Uma linha por pasta (a tela guardava as ~1.900 de uma vez no
       localStorage, então duas pessoas editando se sobrescreviam além de nem
       enxergarem o cadastro uma da outra). */
    db.exec(`
      CREATE TABLE IF NOT EXISTS arquivo_pastas (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        codigo INTEGER NOT NULL DEFAULT 0,
        gaveta TEXT,
        pasta TEXT,
        obs TEXT,
        vaga INTEGER NOT NULL DEFAULT 0,
        consultas_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_arquivo_gaveta ON arquivo_pastas(gaveta, codigo);
    `);
    db.exec("PRAGMA user_version = 33");
  }

  if (user_version < 34) {
    /* A tela Arquivos (acervo físico) era aberta a todo mundo. Decisão do
       Augusto em 14/08/2026: vendas não enxerga mais o acervo. Todos os outros
       cargos e pessoas mantêm o acesso que já tinham na prática — quem perde
       são só as contas de vendas/comercial.
       Caso a caso volta pelo botão Permissões da tela Equipe. */
    const FORA = new Set(["vendas", "comercial"]);
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    const roles = db.prepare("SELECT nome FROM roles").all() as { nome: string }[];
    const usuarios = db.prepare("SELECT id, role FROM users").all() as { id: string; role: string }[];
    for (const r of roles) if (!FORA.has(r.nome)) insRP.run(r.nome, "tab.arquivos");
    for (const u of usuarios) if (!FORA.has(u.role)) insUP.run(u.id, "tab.arquivos");
    db.exec("PRAGMA user_version = 34");
  }

  if (user_version < 35) {
    /* A nota (ordem de serviço) que a clicheria manda junto com o clichê passa
       a ficar guardada: é o documento de onde saíram os valores lançados, e
       "de onde veio esse número?" merece resposta em um clique, não uma
       garimpagem na pasta de downloads de quem registrou. */
    db.exec("ALTER TABLE cliche_registros ADD COLUMN nota_nome TEXT");
    db.exec("ALTER TABLE cliche_registros ADD COLUMN nota_path TEXT");
    db.exec("PRAGMA user_version = 35");
  }

  if (user_version < 36) {
    /* Tela "Clientes": as pastas da rede dentro do hub. Vai para TODO MUNDO,
       inclusive vendas — a tela nasceu justamente para a vendedora parar de
       sair do hub e caçar a pasta no Explorador. Só leitura.
       Quem quiser tirar de alguém, tira caso a caso pela tela Equipe. */
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    for (const r of db.prepare("SELECT nome FROM roles").all() as { nome: string }[]) {
      insRP.run(r.nome, "tab.clientes");
    }
    for (const u of db.prepare("SELECT id FROM users").all() as { id: string }[]) {
      insUP.run(u.id, "tab.clientes");
    }
    db.exec("PRAGMA user_version = 36");
  }

  if (user_version < 37) {
    /* Carimbo do cancelamento. O hub já guardava o instante da solicitação e o
       do fechamento do clichê, mas o cancelamento não tinha campo: a Central
       datava "artes canceladas" pelo `updated_at`, que anda a cada edição —
       um pedido cancelado em julho e mexido em agosto mudava de mês sozinho.
       Registro antigo fica NULL e continua caindo no updated_at. */
    db.exec("ALTER TABLE pedidos ADD COLUMN cancelado_em TEXT");
    /* Semente para o que já está cancelado: o updated_at é a melhor
       aproximação que existe hoje, e congelá-la aqui impede que esses pedidos
       continuem migrando de mês a cada edição futura. */
    db.exec("UPDATE pedidos SET cancelado_em = updated_at WHERE status = 'cancelado' AND cancelado_em IS NULL");
    db.exec("PRAGMA user_version = 37");
  }

  if (user_version < 38) {
    /* Picote — 4º acabamento, que entrou com a Nova arte v3. Fica ao lado de
       tarja_verso/verniz/cold_stamp: muda a montagem do clichê, então a
       produção precisa saber antes de fechar a arte. */
    db.exec("ALTER TABLE pedidos ADD COLUMN picote INTEGER NOT NULL DEFAULT 0");
    db.exec("PRAGMA user_version = 38");
  }

  if (user_version < 39) {
    /* "Alterações pedidas" da modal do pedido v2: cada revisão pedida vira um
       item com caixa de marcar. Sem esta tabela a marca só existiria na tela e
       sumiria ao reabrir o pedido — o designer marcaria "resolvida" e ninguém
       mais veria. `chave` é o id da linha de pedido_historico que gerou a
       revisão, então a marca acompanha o registro certo mesmo que outras
       revisões entrem depois. */
    db.exec(`
      CREATE TABLE IF NOT EXISTS pedido_revisoes_resolvidas (
        pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        chave TEXT NOT NULL,
        user_id TEXT,
        user_nome TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (pedido_id, chave)
      );
    `);
    db.exec("PRAGMA user_version = 39");
  }

  if (user_version < 40) {
    /* Pergunta com dono e estado. Sem isto, a dúvida do design ia junto no
       texto do recado da devolução: virava `observacao` de uma linha do
       histórico, a vendedora recebia "Pedido atualizado → Aguardando
       aprovação" (igual a qualquer movimentação) e a pergunta ficava
       esperando resposta que ninguém sabia que era para dar — foi o que
       aconteceu no #34 Mabi Carnes em 27/08.
       `para_id` é gravado na hora: o designer costuma devolver a arte sem
       assumir o pedido, então `designer_id` pode estar NULL e não serve de
       endereço para a resposta. */
    db.exec(`
      CREATE TABLE IF NOT EXISTS pedido_perguntas (
        id TEXT PRIMARY KEY,
        pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        de_id TEXT,
        de_nome TEXT,
        para_id TEXT,
        para_nome TEXT,
        texto TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resposta TEXT,
        respondida_em TEXT,
        respondida_por_id TEXT,
        respondida_por_nome TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_perguntas_pedido ON pedido_perguntas(pedido_id);
      CREATE INDEX IF NOT EXISTS idx_perguntas_abertas ON pedido_perguntas(pedido_id, respondida_em);
    `);
    db.exec("PRAGMA user_version = 40");
  }

  if (user_version < 41) {
    /* `pedidos.transferir` — passar a carteira de uma vendedora para outra.
       Mesma regra das outras permissões novas (migração 16): ninguém perde
       acesso e ninguém ganha poder que já não tivesse. Quem já podia editar
       QUALQUER pedido recebe; os demais, não. Usuário com permissões próprias
       (que não segue mais o cargo) é tratado à parte, senão a transferência
       apareceria para ele sem nunca ter sido concedida. */
    const insRP = db.prepare("INSERT OR IGNORE INTO role_permissions (role, permission) VALUES (?, ?)");
    const insUP = db.prepare("INSERT OR IGNORE INTO user_permissions (user_id, permission) VALUES (?, ?)");
    const temRole = db.prepare("SELECT 1 FROM role_permissions WHERE role = ? AND permission = ?");
    const temUser = db.prepare("SELECT 1 FROM user_permissions WHERE user_id = ? AND permission = ?");

    for (const r of db.prepare("SELECT nome FROM roles").all() as { nome: string }[]) {
      if (r.nome === "admin" || temRole.get(r.nome, "pedidos.editar_todos")) {
        insRP.run(r.nome, "pedidos.transferir");
      }
    }
    for (const u of db.prepare("SELECT id FROM users").all() as { id: string }[]) {
      const proprias = db.prepare("SELECT COUNT(*) AS n FROM user_permissions WHERE user_id = ?").get(u.id) as { n: number };
      if (proprias.n === 0) continue;
      if (temUser.get(u.id, "pedidos.editar_todos")) insUP.run(u.id, "pedidos.transferir");
    }

    db.exec("PRAGMA user_version = 41");
  }

  if (user_version < 42) {
    /* Sugestões do rodapé da Home 1.0. A tela promete "enviada para a equipe
       do hub" — então precisa existir um lugar onde ela fica, e não só um
       aviso que some depois de lido. Quem administra recebe o aviso; o texto
       fica aqui para ser lido depois. */
    db.exec(`
      CREATE TABLE IF NOT EXISTS sugestoes (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        user_nome TEXT,
        texto TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    db.exec("PRAGMA user_version = 42");
  }

  if (user_version < 43) {
    /* Tela Pedido 1.0 — duas coisas que o projeto pede e não havia onde pôr.

       `fila`: a posição que o designer marca no card (0 a 10), que vira o selo
       preto no canto. Fica no pedido, e não nas preferências, porque a fila é
       do time: quem abre a tela tem de ver a MESMA ordem. NULL = fora da fila.

       `pedido_vistos`: até onde cada pessoa já leu a conversa de um pedido. É
       o que acende o aviso de mensagem nova no card. Sem isso o aviso ficaria
       aceso para sempre, ou apagaria para todos quando um só lesse. */
    db.exec("ALTER TABLE pedidos ADD COLUMN fila INTEGER");
    db.exec(`
      CREATE TABLE IF NOT EXISTS pedido_vistos (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        visto_em TEXT NOT NULL,
        PRIMARY KEY (user_id, pedido_id)
      );
    `);
    db.exec("PRAGMA user_version = 43");
  }

  if (user_version < 44) {
    /* Pedido cancelado não espera vez: agora ele sai da fila no ato do
       cancelamento, e esta linha limpa os que já estavam cancelados segurando
       uma posição de antes da regra existir. */
    db.exec("UPDATE pedidos SET fila = NULL WHERE status = 'cancelado' AND fila IS NOT NULL");
    db.exec("PRAGMA user_version = 44");
  }
}

/** Preferência pessoal (papel de parede etc.). Vazio = nunca escolheu. */
export function getUserConfig(userId: string, chave: string, padrao = ""): string {
  const row = getDb()
    .prepare("SELECT valor FROM user_config WHERE user_id = ? AND chave = ?")
    .get(userId, chave) as { valor: string } | undefined;
  return row?.valor ?? padrao;
}

export function setUserConfig(userId: string, chave: string, valor: string) {
  getDb()
    .prepare(
      `INSERT INTO user_config (user_id, chave, valor, updated_at) VALUES (?,?,?,?)
       ON CONFLICT(user_id, chave) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at`,
    )
    .run(userId, chave, valor, agora());
}

/** Lê uma configuração (com valor padrão de fallback). */
export function getSetting(chave: string, padrao = ""): string {
  const row = getDb().prepare("SELECT valor FROM settings WHERE chave = ?").get(chave) as
    | { valor: string }
    | undefined;
  return row?.valor ?? padrao;
}

export function setSetting(chave: string, valor: string, userId?: string) {
  getDb()
    .prepare(
      `INSERT INTO settings (chave, valor, updated_at, updated_by) VALUES (?,?,?,?)
       ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .run(chave, valor, new Date().toISOString(), userId ?? null);
}

function openDb(): DatabaseSync {
  const p = dbPath();
  mkdirSync(path.dirname(p), { recursive: true });
  const db = new DatabaseSync(p);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

// Cache em globalThis para sobreviver a hot-reloads do dev server sem reabrir o arquivo.
const g = globalThis as unknown as { __designhubDb?: DatabaseSync };

// Após um hot-reload, a conexão em cache pode ser de antes de uma migração nova —
// garante que migrate() rode uma vez por carga do módulo.
let migrouNesteModulo = false;

export function getDb(): DatabaseSync {
  if (!g.__designhubDb) {
    g.__designhubDb = openDb();
    migrouNesteModulo = true;
  } else if (!migrouNesteModulo) {
    migrate(g.__designhubDb);
    migrouNesteModulo = true;
  }
  return g.__designhubDb;
}

export function uuid() {
  return randomUUID();
}

export function agora() {
  return new Date().toISOString();
}

/** Template de permissões de um cargo (usado ao criar usuário / aplicar padrão). */
export function roleTemplate(role: string): Permission[] {
  const rows = getDb()
    .prepare("SELECT permission FROM role_permissions WHERE role = ?")
    .all(role) as { permission: Permission }[];
  return rows.map((r) => r.permission);
}

/** Rótulo do cargo cadastrado (ou o próprio nome, se não existir). */
export function roleLabel(nome: string): string {
  const row = getDb().prepare("SELECT label FROM roles WHERE nome = ?").get(nome) as
    | { label: string }
    | undefined;
  return row?.label ?? nome;
}

export function roleExists(nome: string): boolean {
  return !!getDb().prepare("SELECT nome FROM roles WHERE nome = ?").get(nome);
}

/** Permissões individuais gravadas para o usuário. */
export function userPermissions(userId: string): Permission[] {
  const rows = getDb()
    .prepare("SELECT permission FROM user_permissions WHERE user_id = ?")
    .all(userId) as { permission: Permission }[];
  return rows.map((r) => r.permission);
}

/** Permissões efetivas: admin tem tudo; os demais usam as permissões por usuário. */
export function effectivePermissions(userId: string, role: string): Permission[] {
  if (role === "admin") return [...PERMISSIONS];
  return userPermissions(userId);
}
