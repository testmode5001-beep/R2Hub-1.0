// Remove TUDO que o seed-demo.mjs criou, pelo rastro da tabela `demo_seed`.
// Os dados reais ficam intactos.
//   node scripts/limpar-demo.mjs
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("data/designhub.db");

const existe = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='demo_seed'").get();
if (!existe) {
  console.log("Nada a limpar: a tabela demo_seed não existe.");
  process.exit(0);
}

const linhas = db.prepare("SELECT tabela, chave FROM demo_seed").all();
if (!linhas.length) {
  console.log("Nada a limpar: nenhum registro de demonstração.");
  process.exit(0);
}

// pedidos primeiro (histórico, comentários, anexos e clichês saem em cascata)
const ordem = ["pedidos", "cliche_registros", "cliche_solicitacoes", "faca_afiacoes",
  "leituras", "notifications", "user_notas", "cadastros", "clientes"];
const contas = {};
for (const tabela of ordem) {
  const ids = linhas.filter((l) => l.tabela === tabela).map((l) => l.chave);
  if (!ids.length) continue;
  const del = db.prepare(`DELETE FROM ${tabela} WHERE id = ?`);
  let n = 0;
  for (const id of ids) n += del.run(id).changes;
  contas[tabela] = n;
}
db.exec("DELETE FROM demo_seed");
db.exec("PRAGMA wal_checkpoint(TRUNCATE)");

console.log("Demonstração removida:");
for (const [t, n] of Object.entries(contas)) console.log(`  ${t.padEnd(20)} -${n}`);
console.log("Se algo ficou estranho, o backup completo está em data/designhub.db.backup-antes-demo");
