// Popula o banco com UM MÊS de operação fictícia para apresentação.
//   node scripts/seed-demo.mjs
// Tudo que entra fica registrado na tabela `demo_seed`; para remover:
//   node scripts/limpar-demo.mjs
// Nada de real é alterado — só inserções.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const db = new DatabaseSync("data/designhub.db");
const uuid = () => randomUUID();

/* ————— sorteio determinístico (mesma semente = mesmo mês) ————— */
let semente = 20260805;
const rnd = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648;
const escolhe = (lista) => lista[Math.floor(rnd() * lista.length)];
const inteiro = (min, max) => Math.floor(min + rnd() * (max - min + 1));

/* ————— datas: últimos 30 dias, em horário comercial ————— */
const HOJE = new Date("2026-08-05T18:00:00");
function diaUtil(diasAtras, hora = 9, minuto = 0) {
  const d = new Date(HOJE);
  d.setDate(d.getDate() - diasAtras);
  d.setHours(hora, minuto, 0, 0);
  // sábado/domingo empurram para a sexta anterior
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() - 2);
  return d;
}
const iso = (d) => d.toISOString();
const maisHoras = (d, h) => new Date(d.getTime() + h * 3600_000);

/* ————— rastro do que foi criado (para o limpar-demo) ————— */
db.exec(`CREATE TABLE IF NOT EXISTS demo_seed (
  tabela TEXT NOT NULL, chave TEXT NOT NULL, criado_em TEXT NOT NULL
)`);
const marcarStmt = db.prepare("INSERT INTO demo_seed (tabela, chave, criado_em) VALUES (?,?,?)");
const AGORA = iso(new Date());
const marcar = (tabela, chave) => marcarStmt.run(tabela, String(chave), AGORA);

/* ————— pessoas reais do banco (a demo usa quem já existe) ————— */
const users = db.prepare("SELECT id, nome, role FROM users").all();
const porUsername = (u) => users.find((x) => x.nome === u) || users[0];
const ADMIN = porUsername("Administrador");
const VENDAS = porUsername("Maria Vendas");
const DESIGNER = porUsername("Leticia Soares");
const PRODUCAO = porUsername("Danilo");
const vendedores = [VENDAS, VENDAS, VENDAS, ADMIN];

/* ————— clientes fictícios ————— */
const CLIENTES = [
  "Frigorífico Vale Verde", "Laticínios Serra Azul", "Cervejaria Ilha Grande",
  "Moinho Três Rios", "Hortifruti Boa Safra", "Panificadora Pão Nosso",
  "Distribuidora Cepa Sul", "Biscoitos Vitória", "Doces da Vovó Ana",
  "Café Serrano", "Supermercado União", "Açaí do Norte", "Temperos Dona Rita",
  "Águas de Santa Clara", "Embutidos Bom Sabor", "Sorvetes Polar",
  "Massas Nonna Rosa", "Conservas Girassol",
];
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

const insCliente = db.prepare(
  "INSERT OR IGNORE INTO clientes (id, nome, nome_norm, pasta, created_by, created_at) VALUES (?,?,?,?,?,?)",
);
const clienteIds = {};
CLIENTES.forEach((nome, i) => {
  const existe = db.prepare("SELECT id FROM clientes WHERE nome_norm = ?").get(norm(nome));
  if (existe) { clienteIds[nome] = existe.id; return; }
  const id = uuid();
  insCliente.run(id, nome, norm(nome), nome, ADMIN.id, iso(diaUtil(30 - i)));
  clienteIds[nome] = id;
  marcar("clientes", id);
});

/* ————— catálogo de produtos plausíveis ————— */
const MATERIAS = ["BOPP brilho", "BOPP fosco", "Térmico", "Térmico AA", "Couché", "Cartão couché", "Polietileno", "BOPP metalizado"];
const FORMAS = ["Retangular", "Quadrada", "Oval/Elipse", "Redonda", "GAP", "Recorte especial"];
const CORES_OPTS = ["1", "2", "3", "4", "CMYK", "4+PANTONE"];
const PANTONES = ["Pantone 485 C", "Pantone 186 C", "Pantone 032 C", "Pantone 300 C", "Pantone 355 C", "Pantone 021 C", "Pantone Black 6 C"];
const PRODUTOS = [
  "rótulo de linguiça toscana", "rótulo de queijo minas", "rótulo de cerveja IPA long neck",
  "etiqueta de farinha de trigo 1kg", "etiqueta de balança para hortifruti", "rótulo de pão de forma",
  "rótulo de vinho tinto seco", "etiqueta de biscoito recheado", "rótulo de doce de leite",
  "rótulo de café torrado e moído 500g", "etiqueta de promoção de gôndola", "rótulo de polpa de açaí 1kg",
  "rótulo de pimenta em conserva", "rótulo de água mineral 500ml", "rótulo de mortadela fatiada",
  "rótulo de sorvete pote 2L", "rótulo de massa fresca", "rótulo de conserva de palmito",
];

const insPedido = db.prepare(`INSERT INTO pedidos
  (id, numero, vendedor_id, designer_id, cliente_id, cliente, materia, larg_materia, largura, altura,
   forma, cores, cores_desc, carreiras, descricao, link_ref, status, cliche_solicitado_em,
   cliche_concluido_em, created_at, updated_at, tipo, codigo_produto, motivo)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const insHist = db.prepare(
  "INSERT INTO pedido_historico (id, pedido_id, user_id, user_nome, status, observacao, created_at) VALUES (?,?,?,?,?,?,?)",
);
const insComent = db.prepare(
  "INSERT INTO pedido_comentarios (id, pedido_id, user_id, user_nome, texto, created_at, canal) VALUES (?,?,?,?,?,?,?)",
);

/* Caminho de cada status até onde o pedido chegou. */
const CAMINHO = {
  nova: ["nova"],
  criacao: ["nova", "criacao"],
  aguardando: ["nova", "criacao", "aguardando"],
  revisao: ["nova", "criacao", "aguardando", "revisao"],
  aprovada: ["nova", "criacao", "aguardando", "aprovada"],
  cliche: ["nova", "criacao", "aguardando", "aprovada", "cliche"],
  concluido: ["nova", "criacao", "aguardando", "aprovada", "cliche", "concluido"],
  cancelado: ["nova", "criacao", "cancelado"],
};
const QUEM = {
  nova: (v) => v, criacao: () => DESIGNER, aguardando: () => DESIGNER,
  revisao: (v) => v, aprovada: (v) => v, cliche: () => DESIGNER,
  concluido: () => DESIGNER, cancelado: (v) => v,
};
const OBS = {
  nova: ["Pedido aberto pelo comercial.", "Cliente pediu urgência na aprovação.", ""],
  criacao: ["Arte assumida pelo design.", "Layout iniciado a partir da referência enviada.", ""],
  aguardando: ["Arte enviada para aprovação do cliente.", "Prova digital em PDF enviada por e-mail.", ""],
  revisao: ["Cliente pediu para escurecer o verde do rótulo.", "Trocar o telefone do rodapé.", "Aumentar o corpo da tabela nutricional.", "Cliente pediu para reduzir a logo em 10%."],
  aprovada: ["Cliente aprovou por e-mail.", "Aprovado com ressalva: conferir Pantone na impressão.", "Aprovado pelo WhatsApp, print anexado."],
  cliche: ["Clichê solicitado à clicheria.", "Reposição solicitada junto do jogo novo.", ""],
  concluido: ["Arquivo final liberado para produção.", "Fechado e enviado à fábrica.", ""],
  cancelado: ["Cliente desistiu do lançamento.", "Pedido duplicado — cancelado."],
};

/* Distribuição do mês: a maioria fechada, o resto espalhado pelo fluxo. */
const PLANO = [
  ...Array(26).fill("concluido"),
  ...Array(5).fill("cliche"),
  ...Array(4).fill("aprovada"),
  ...Array(4).fill("aguardando"),
  ...Array(3).fill("revisao"),
  ...Array(4).fill("criacao"),
  ...Array(3).fill("nova"),
  ...Array(2).fill("cancelado"),
];

let numero = db.prepare("SELECT MAX(numero) m FROM pedidos").get().m || 0;
const pedidosCriados = [];

PLANO.forEach((statusFinal, i) => {
  // os concluídos ficam mais no começo do mês; os abertos, mais no fim
  const idade = statusFinal === "concluido" ? inteiro(12, 29)
    : statusFinal === "cancelado" ? inteiro(10, 25)
    : statusFinal === "nova" ? inteiro(0, 3)
    : statusFinal === "criacao" ? inteiro(1, 5)
    : inteiro(3, 12);
  const abertura = diaUtil(idade, inteiro(8, 16), escolhe([0, 15, 30, 45]));
  const cliente = escolhe(CLIENTES);
  const produto = escolhe(PRODUTOS);
  const cores = escolhe(CORES_OPTS);
  const temPantone = cores === "4+PANTONE" || rnd() < 0.3;
  const largura = escolhe([40, 50, 60, 70, 80, 90, 100, 110, 120]);
  const altura = escolhe([25, 30, 35, 40, 50, 60, 70, 80]);
  const reposicao = rnd() < 0.12 && statusFinal === "concluido";

  numero += 1;
  const id = uuid();
  const passos = CAMINHO[statusFinal];
  // cada passo leva de 3h a 2 dias depois do anterior
  const datas = [];
  let t = abertura;
  passos.forEach((_, k) => { if (k > 0) t = maisHoras(t, inteiro(3, 34)); datas.push(t); });
  const ultima = datas[datas.length - 1];
  const idxCliche = passos.indexOf("cliche");

  insPedido.run(
    id, numero, escolhe(vendedores).id, passos.length > 1 ? DESIGNER.id : null,
    clienteIds[cliente], cliente,
    escolhe(MATERIAS), String(escolhe([250, 320, 420, 500, 620])),
    String(largura), String(altura), escolhe(FORMAS), cores,
    temPantone ? escolhe(PANTONES) : null, String(escolhe([1, 2, 2, 3, 4, 6])),
    `${produto.charAt(0).toUpperCase() + produto.slice(1)} — ${escolhe(["arte nova", "atualização de layout", "troca de tabela nutricional", "ajuste de medida", "lançamento de linha"])}.`,
    null, statusFinal,
    idxCliche >= 0 ? iso(datas[idxCliche]) : null,
    statusFinal === "concluido" ? iso(ultima) : null,
    iso(abertura), iso(ultima),
    reposicao ? "cliche" : "arte",
    reposicao ? `PRD-${inteiro(30000, 39999)}` : null,
    reposicao ? escolhe(["Danificado em máquina", "Alteração cliente", "Erro de desenvolvimento"]) : null,
  );
  marcar("pedidos", id);
  pedidosCriados.push({ id, numero, cliente, status: statusFinal, cores, datas, passos, abertura, ultima });

  passos.forEach((st, k) => {
    const quem = QUEM[st](escolhe(vendedores));
    insHist.run(uuid(), id, quem.id, quem.nome, st, escolhe(OBS[st]) || null, iso(datas[k]));
  });

  // conversa interna em parte dos pedidos + resposta ao cliente (canal novo)
  if (rnd() < 0.35) {
    insComent.run(uuid(), id, DESIGNER.id, DESIGNER.nome,
      escolhe([
        "Faca 40x30 do acervo serve nessa arte, não precisa mandar fazer.",
        "Cliente mandou a foto do produto na embalagem antiga, usei como referência.",
        "Atenção: o Pantone desse cliente tem histórico de variar no térmico.",
        "Subi a versão 2 com a tabela nutricional corrigida.",
      ]),
      iso(maisHoras(datas[Math.min(1, datas.length - 1)], 2)), "interno");
  }
  if (rnd() < 0.18 && passos.includes("aguardando")) {
    insComent.run(uuid(), id, VENDAS.id, VENDAS.nome,
      escolhe([
        "Respondido ao cliente que a prova sai hoje até as 17h.",
        "Avisamos o cliente que o Pantone pode variar até 5% no material térmico.",
        "Cliente informado do prazo de 3 dias úteis para o clichê.",
      ]),
      iso(maisHoras(datas[2], 5)), "cliente");
  }
});

/* A aba "Facas & afiação" dos Apontamentos lista pedidos cujo motivo fala em
   faca — sem isso a tabela fica vazia mesmo com a afiação cheia. */
const MOTIVO_FACA = ["Faca nova", "Faca danificada em máquina", "Ajuste de faca — sangria", "Faca nova", "Faca reafiada", "Faca nova"];
pedidosCriados
  .filter((p) => ["concluido", "aprovada", "cliche"].includes(p.status))
  .slice(0, MOTIVO_FACA.length)
  .forEach((p, i) => db.prepare("UPDATE pedidos SET motivo = ? WHERE id = ?").run(MOTIVO_FACA[i], p.id));

/* ————— clichês registrados (gasto real dos Apontamentos) ————— */
const insReg = db.prepare(
  "INSERT INTO cliche_registros (id, pedido_id, user_id, user_nome, data_chegada, hora_chegada, itens, total, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
);
const CORES_NOME = ["Ciano", "Magenta", "Amarelo", "Preto", "Pantone 485", "Pantone 186", "Branco", "Verniz"];
pedidosCriados.filter((p) => p.status === "concluido").forEach((p) => {
  if (rnd() > 0.62) return;
  const n = p.cores === "CMYK" ? 4 : Math.max(1, Math.min(5, parseInt(p.cores, 10) || inteiro(1, 4)));
  const itens = Array.from({ length: n }, (_, k) => ({
    descricao: CORES_NOME[k] || `Cor ${k + 1}`,
    valor: Math.round((60 + rnd() * 90) * 100) / 100,
  }));
  const total = Math.round(itens.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  const chegada = maisHoras(p.datas[p.passos.indexOf("cliche")] ?? p.ultima, inteiro(24, 96));
  const id = uuid();
  insReg.run(id, p.id, ADMIN.id, ADMIN.nome,
    chegada.toISOString().slice(0, 10),
    `${String(chegada.getHours()).padStart(2, "0")}:${String(chegada.getMinutes()).padStart(2, "0")}`,
    JSON.stringify(itens), total, iso(chegada));
  marcar("cliche_registros", id);
});

/* ————— solicitações de clichê enviadas à clicheria ————— */
const insSol = db.prepare(
  `INSERT INTO cliche_solicitacoes (id, numero, user_id, user_nome, cliente, tipo, cores, motivo,
    observacao, anexos, email_para, email_enviado, email_erro, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);
let numSol = db.prepare("SELECT MAX(numero) m FROM cliche_solicitacoes").get().m || 0;
const MOTIVOS = db.prepare("SELECT nome FROM cliche_motivos").all().map((m) => m.nome);
for (let i = 0; i < 12; i++) {
  numSol += 1;
  const id = uuid();
  const quando = diaUtil(inteiro(1, 28), inteiro(9, 17), 0);
  const falhou = rnd() < 0.12;
  insSol.run(id, numSol, VENDAS.id, VENDAS.nome, escolhe(CLIENTES),
    escolhe(["1,14 mm", "1,70 mm"]),
    JSON.stringify(Array.from({ length: inteiro(1, 4) }, (_, k) => CORES_NOME[k])),
    escolhe(MOTIVOS),
    escolhe(["", "", "Urgente — máquina parada esperando.", "Conferir distorção antes de gravar."]),
    "[]", "clicheria@fornecedor.com.br", falhou ? 0 : 1,
    falhou ? "SMTP: conexão recusada" : null, iso(quando));
  marcar("cliche_solicitacoes", id);
}

/* ————— facas na afiação ————— */
const insAfi = db.prepare(
  `INSERT INTO faca_afiacoes (id, numero, user_id, user_nome, medida, substrato, status, estado,
    nova_solicitada, recebida_por, recebida_em, created_at, observacao, valor) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);
let numAfi = db.prepare("SELECT MAX(numero) m FROM faca_afiacoes").get().m || 0;
const SUBS = db.prepare("SELECT nome FROM faca_substratos").all().map((s) => s.nome);
for (let i = 0; i < 16; i++) {
  numAfi += 1;
  const id = uuid();
  const envio = diaUtil(inteiro(2, 29), inteiro(8, 16), 0);
  const recebida = i >= 5; // as 5 primeiras ficam em afiação
  const estado = escolhe(["bom", "bom", "bom", "regular", "regular", "ruim"]);
  const retorno = recebida ? maisHoras(envio, inteiro(72, 240)) : null;
  insAfi.run(id, numAfi, PRODUCAO.id, PRODUCAO.nome,
    `${escolhe([40, 50, 59.5, 60, 70, 80, 100, 110])} × ${escolhe([25, 30, 40, 50, 60, 80])}`,
    escolhe(SUBS), recebida ? "recebida" : "enviada",
    recebida ? estado : null, recebida && estado === "ruim" ? 1 : 0,
    recebida ? escolhe([PRODUCAO.nome, ADMIN.nome, "Marcos"]) : null,
    retorno ? iso(retorno) : null, iso(envio),
    recebida ? escolhe(["", "", "Fio irregular no canto direito.", "Reafiar em 3 meses.", "Serrilha gasta."]) : null,
    recebida ? Math.round((150 + rnd() * 130) * 100) / 100 : null);
  marcar("faca_afiacoes", id);
}

/* ————— leituras de OP (fila do painel) ————— */
const insLeitura = db.prepare(
  `INSERT INTO leituras (id, user_id, user_nome, op, cliente, descricao, medida, substrato, metragem,
    carreiras, nucleo, rolos, entrega, usada, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);
for (let i = 0; i < 11; i++) {
  const id = uuid();
  const naFila = i < 3; // três esperando o painel
  const quando = naFila ? diaUtil(0, inteiro(7, 11), inteiro(0, 59)) : diaUtil(inteiro(1, 20), inteiro(7, 18), 0);
  const larg = escolhe([40, 50, 60, 80, 100]), alt = escolhe([25, 30, 40, 60]);
  insLeitura.run(id, PRODUCAO.id, PRODUCAO.nome,
    `P${inteiro(9000, 9999)}${inteiro(10, 99)}-${String(inteiro(1, 9)).padStart(3, "0")}`,
    escolhe(CLIENTES).toUpperCase(), null, `${larg}x${alt}`,
    escolhe(["Térmico AA", "BOPP brilho", "Couché", "Térmico"]),
    String(escolhe([20, 30, 50, 100])), String(escolhe([1, 2, 3])),
    "1 1/4", String(inteiro(200, 2000)),
    `${String(inteiro(6, 28)).padStart(2, "0")}/08/2026`,
    naFila ? 0 : 1, iso(quando));
  marcar("leituras", id);
}

/* ————— avisos e anotações do dia (topo do hub) ————— */
const insNotif = db.prepare(
  "INSERT INTO notifications (id, user_id, titulo, corpo, url, lida, created_at) VALUES (?,?,?,?,?,?,?)",
);
const AVISOS = [
  ["Arte aprovada — Cervejaria Ilha Grande", "Maria: cliente aprovou o rótulo da IPA long neck.", 0, 3],
  ["Clichê chegou — Frigorífico Vale Verde", "Administrador registrou 4 clichês · R$ 512,40.", 0, 6],
  ["Revisão pedida — Moinho Três Rios", "Cliente pediu para escurecer o verde do rótulo.", 0, 9],
  ["Faca recebida da afiação", "Danilo: 80 × 60 Térmico voltou em estado bom.", 0, 26],
  ["Comentário em Laticínios Serra Azul", "Leticia: subi a versão 2 com a tabela corrigida.", 1, 30],
  ["Prova enviada — Café Serrano", "Maria enviou a prova de impressão ao cliente.", 1, 34],
];
AVISOS.forEach(([titulo, corpo, lida, horas]) => {
  const id = uuid();
  insNotif.run(id, ADMIN.id, titulo, corpo, "/hub?tela=pedidos", lida, iso(maisHoras(HOJE, -horas)));
  marcar("notifications", id);
});

const insNota = db.prepare(
  "INSERT INTO user_notas (id, user_id, texto, quando, feito, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
);
const NOTAS = [
  ["Cobrar retorno do clichê da Cervejaria Ilha Grande", "hoje", 0],
  ["Fechar orçamento do Frigorífico Vale Verde", "hoje", 0],
  ["Conferir Pantone 485 com o Supermercado União", null, 0],
  ["Revisar produtividade da semana", null, 1],
];
NOTAS.forEach(([texto, quando, feito], i) => {
  const id = uuid();
  const t = iso(maisHoras(HOJE, -(i + 1) * 5));
  insNota.run(id, ADMIN.id, texto, quando, feito, t, t);
  marcar("user_notas", id);
});

/* ————— cadastros da equipe (medidas, matéria-prima, cores) ————— */
const insCad = db.prepare(
  "INSERT OR IGNORE INTO cadastros (id, tipo, nome, extra, user_id, user_nome, created_at) VALUES (?,?,?,?,?,?,?)",
);
const CADASTROS = [
  ["material", "BOPP branco 40µ", null], ["material", "Térmico ECO", null], ["material", "Cartão duplex 250g", null],
  ["medida", "Bobina dupla", null], ["medida", "Sanfona 3 dobras", null],
  ["cor", "Verde Vale Verde", "#1e7a3c"], ["cor", "Vermelho Cepa Sul", "#c0392b"], ["cor", "Azul Serra Azul", "#1f5f9e"],
];
CADASTROS.forEach(([tipo, nome, extra], i) => {
  const id = uuid();
  insCad.run(id, tipo, nome, extra, ADMIN.id, ADMIN.nome, iso(diaUtil(25 - i)));
  marcar("cadastros", id);
});

db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

const conta = (t) => db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
console.log("Mês fictício criado:");
console.log("  pedidos      ", conta("pedidos"), `(+${PLANO.length})`);
console.log("  clientes     ", conta("clientes"));
console.log("  histórico    ", conta("pedido_historico"));
console.log("  comentários  ", conta("pedido_comentarios"));
console.log("  clichês reg. ", conta("cliche_registros"));
console.log("  solicitações ", conta("cliche_solicitacoes"));
console.log("  afiações     ", conta("faca_afiacoes"));
console.log("  leituras     ", conta("leituras"));
console.log("  notificações ", conta("notifications"));
console.log("  cadastros    ", conta("cadastros"));
