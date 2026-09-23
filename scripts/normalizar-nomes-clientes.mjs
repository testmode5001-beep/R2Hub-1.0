// Tira a CAIXA ALTA dos nomes de cliente cadastrados.
//
// Três clientes entraram no hub gritando — "O PONTO DA CARNE A FAVORITA" —
// e apareciam assim no card do pedido, destoando de "Padaria Aurora" e de
// todo o resto do cadastro. Isto reescreve só o nome de exibição.
//
// O que NÃO é tocado, de propósito:
//  · `clientes.pasta`, que é o nome da pasta em \\server\Arte\Clientes. O hub
//    não renomeia nada na rede — a pasta continua com o nome que tem.
//  · `clientes.nome_norm`, a chave de busca, que já nasce em minúscula.
//
// Uso:
//   node scripts/normalizar-nomes-clientes.mjs                 (só mostra)
//   node scripts/normalizar-nomes-clientes.mjs --aplicar       (grava)
//   DESIGNHUB_DB=./data/teste-modais.db node scripts/... --aplicar
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const bancoPath = process.env.DESIGNHUB_DB ?? "./data/designhub.db";
const aplicar = process.argv.includes("--aplicar");

/* Palavras que ficam em minúscula no meio do nome. Nunca na primeira
   posição: "O Ponto da Carne" começa com "O" maiúsculo mesmo. */
const MIUDAS = new Set(["da", "de", "do", "das", "dos", "e", "a", "o", "as", "os", "em", "no", "na", "nos", "nas", "com", "para", "por"]);

function emCaixaDeNome(nome) {
  return nome.toLocaleLowerCase("pt-BR").split(/(\s+)/).map((pedaco, i) => {
    if (!pedaco.trim()) return pedaco;
    const original = nome.split(/(\s+)/)[i] ?? "";
    /* Sigla curta continua como está: "R2", "MG", "III". */
    if (/^[A-ZÀ-Ý0-9]{1,3}$/.test(original) && !MIUDAS.has(pedaco)) return original;
    if (i > 0 && MIUDAS.has(pedaco)) return pedaco;
    return pedaco.charAt(0).toLocaleUpperCase("pt-BR") + pedaco.slice(1);
  }).join("");
}

const db = new DatabaseSync(resolve(bancoPath));

/* Caixa alta de verdade: o nome inteiro é igual à sua versão maiúscula e tem
   mais de três letras — assim "R2" e "MG" não entram na conta. */
const alvos = db.prepare(
  "SELECT id, nome, pasta FROM clientes WHERE nome = UPPER(nome) AND LENGTH(nome) > 3 ORDER BY nome",
).all();

if (!alvos.length) {
  console.log("Nenhum cliente em caixa alta. Nada a fazer.");
  process.exit(0);
}

console.log(`Banco: ${resolve(bancoPath)}`);
console.log(`${alvos.length} cliente(s) em caixa alta:\n`);
const planos = alvos.map((c) => {
  const novo = emCaixaDeNome(c.nome);
  const pedidos = db.prepare("SELECT COUNT(*) c FROM pedidos WHERE cliente = ?").get(c.nome).c;
  console.log(`  ${c.nome}\n    → ${novo}   (${pedidos} pedido(s); pasta "${c.pasta}" intacta)`);
  return { ...c, novo };
});

if (!aplicar) {
  console.log("\nEnsaio. Rode de novo com --aplicar para gravar.");
  process.exit(0);
}

/* Cópia antes de mexer. VACUUM INTO em vez de copiar o arquivo: o banco roda
   em WAL e copiar só o .db deixa para trás o que ainda está no -wal. */
const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backup = resolve(dirname(bancoPath), "backups", `antes-nomes-clientes-${carimbo}.db`);
mkdirSync(dirname(backup), { recursive: true });
db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
console.log(`\nBackup: ${backup}`);

db.exec("BEGIN");
try {
  const porId = db.prepare("UPDATE clientes SET nome = ? WHERE id = ?");
  const porPedido = db.prepare("UPDATE pedidos SET cliente = ? WHERE cliente = ?");
  let pedidosMexidos = 0;
  for (const p of planos) {
    porId.run(p.novo, p.id);
    pedidosMexidos += porPedido.run(p.novo, p.nome).changes;
  }
  db.exec("COMMIT");
  console.log(`Pronto: ${planos.length} cliente(s) e ${pedidosMexidos} pedido(s) atualizados.`);
} catch (e) {
  db.exec("ROLLBACK");
  console.error("Nada foi gravado:", e);
  process.exit(1);
}
