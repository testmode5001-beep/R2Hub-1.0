// Cliente = pasta única na rede (Etapa 1).
// A tabela clientes guarda o NOME da pasta (não o caminho completo), assim a base
// (\\server\Arte\Clientes) pode mudar via CLIENTES_DIR sem quebrar os registros.
import path from "node:path";

import { agora, getDb, uuid } from "./db.server";
import {
  acharPastaExata,
  clientesBaseDir,
  ensureClienteFolderOnDisk,
  esquecerCachePastas,
  normalizeClienteKey,
  sanitizeFolderName,
} from "./files.server";
import { audit, type AuditActor } from "./audit.server";

export type ClienteRow = {
  id: string;
  nome: string;
  nome_norm: string;
  pasta: string;
  created_by: string | null;
  created_at: string;
};

export function clientePastaFullPath(nomePasta: string): string {
  return path.join(clientesBaseDir(), nomePasta);
}

/**
 * Localiza o cliente pelo nome (deduplicado por chave normalizada) ou cria a
 * pasta oficial no share + registro no banco. Nunca cria pasta duplicada.
 *
 * `pastaEscolhida` = a pessoa apontou no formulário QUAL das pastas já
 * existentes usar. Existe porque adivinhar pelo nome deu errado de verdade: o
 * share tem "Santa Luzia" e "Casa Santa Luzia" (clientes diferentes), a
 * vendedora escreveu "SANTA LUZIA" e os arquivos foram para o cliente errado
 * sem ninguém perceber. Quando ela escolhe, não há o que adivinhar.
 */
export function ensureCliente(
  actor: AuditActor,
  nomeCliente: string,
  pastaEscolhida?: string | null,
): ClienteRow {
  const db = getDb();

  if (pastaEscolhida) {
    const pasta = acharPastaExata(pastaEscolhida);
    if (!pasta) throw new Error(`A pasta "${pastaEscolhida}" não existe mais em ${clientesBaseDir()}.`);

    // já registrada? (compara pelo nome da pasta, não pelo que foi digitado)
    const jaTem = db
      .prepare("SELECT * FROM clientes WHERE pasta = ? COLLATE NOCASE")
      .get(pasta) as ClienteRow | undefined;
    if (jaTem) {
      ensureClienteFolderOnDisk(jaTem.pasta);
      return jaTem;
    }

    /* O nome da pasta VIRA o nome do cliente: se a tela deixasse o texto
       digitado divergir da pasta, voltaríamos ao problema de dois nomes para
       o mesmo lugar. */
    ensureClienteFolderOnDisk(pasta);
    const linha: ClienteRow = {
      id: uuid(),
      nome: pasta,
      nome_norm: normalizeClienteKey(pasta),
      pasta,
      created_by: actor?.id ?? null,
      created_at: agora(),
    };
    db.prepare(
      "INSERT OR IGNORE INTO clientes (id, nome, nome_norm, pasta, created_by, created_at) VALUES (?,?,?,?,?,?)",
    ).run(linha.id, linha.nome, linha.nome_norm, linha.pasta, linha.created_by, linha.created_at);
    audit(actor, "cliente.usar_pasta", "clientes", linha.id, {
      nome: linha.nome, pasta: clientePastaFullPath(pasta), escolhida: true,
    });
    return (db.prepare("SELECT * FROM clientes WHERE pasta = ? COLLATE NOCASE").get(pasta) as ClienteRow) ?? linha;
  }

  const key = normalizeClienteKey(nomeCliente);

  const existente = db
    .prepare("SELECT * FROM clientes WHERE nome_norm = ?")
    .get(key) as ClienteRow | undefined;

  if (existente) {
    // Garante que a estrutura de subpastas ainda existe (pode ter sido movida/apagada).
    ensureClienteFolderOnDisk(existente.pasta);
    return existente;
  }

  const nomePasta = sanitizeFolderName(nomeCliente);
  ensureClienteFolderOnDisk(nomePasta);
  esquecerCachePastas();   // a lista da tela precisa enxergar a pasta nova

  const row: ClienteRow = {
    id: uuid(),
    /* o nome do cliente é o nome da PASTA (já padronizado): deixar o texto
       digitado divergir da pasta traz de volta os dois nomes para o mesmo lugar */
    nome: nomePasta,
    nome_norm: key,
    pasta: nomePasta,
    created_by: actor?.id ?? null,
    created_at: agora(),
  };
  db.prepare(
    "INSERT INTO clientes (id, nome, nome_norm, pasta, created_by, created_at) VALUES (?,?,?,?,?,?)",
  ).run(row.id, row.nome, row.nome_norm, row.pasta, row.created_by, row.created_at);

  audit(actor, "cliente.criar_pasta", "clientes", row.id, {
    nome: row.nome,
    pasta: clientePastaFullPath(nomePasta),
  });

  return row;
}
