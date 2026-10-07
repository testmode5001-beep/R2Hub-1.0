// Anexos que esperam o design começar.
//
// A vendedora anexa arquivos ao criar o pedido, mas a pasta do cliente só
// nasce quando o designer clica em "Iniciar criação" e confirma QUAL pasta é
// (Augusto, 25/09/2026). Antes a pasta era criada com o nome que a vendedora
// digitava, e o share ganhou duplicatas: "Toninho Sorvetes" e "Toninho
// Sorvetes - Renata", "Granel Armazem Natural" e "Granel Armazem Natural-
// Juliana", o "Bronzemax" que virou "Bronzemax Retangular" e "Bronzemax
// Redonda". Quem conhece o share é o designer; a escolha fica com ele.
//
// Até lá os arquivos moram AQUI: numa pasta do próprio hub, ao lado do banco,
// uma subpasta por pedido. Não é o share — por isso este módulo pode apagar,
// e só apaga dentro desta pasta (a regra "o hub nunca apaga em Clientes" vale
// para \\server\Arte\Clientes; o files.server.ts nem importa função de apagar).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

import { dbPath } from "./db.server";
import { readClienteFile, sanitizeFileName } from "./files.server";

/** A pasta dos anexos pendentes, ao lado do banco. O banco do hub de teste
    mora na mesma `data/` da produção e é cópia dela (mesmos ids de pedido),
    então o teste diz a sua pasta em ANEXOS_PENDENTES_DIR (script dev:teste)
    e nunca mexe na pasta da produção. */
export function pastaPendentes(): string {
  const propria = process.env.ANEXOS_PENDENTES_DIR;
  return propria ? path.resolve(propria) : path.join(path.dirname(dbPath()), "anexos-pendentes");
}

/** O caminho está dentro da pasta dos pendentes? */
export function ehPendente(fullPath: string): boolean {
  const base = path.resolve(pastaPendentes()).toLowerCase() + path.sep;
  return path.resolve(fullPath).toLowerCase().startsWith(base);
}

function assertPendente(fullPath: string): string {
  if (!ehPendente(fullPath)) throw new Error("Caminho fora da pasta de anexos pendentes.");
  return path.resolve(fullPath);
}

/** O pedido ainda não tem pasta: o arquivo espera aqui, numa pasta dele. */
export function salvarPendente(pedidoId: string, nomeArquivo: string, conteudo: Buffer): { fullPath: string; nomeSalvo: string } {
  /* o id do pedido é uuid, mas quem chama pode errar: nada de "..\" aqui */
  const sub = pedidoId.replace(/[^A-Za-z0-9-]/g, "");
  if (!sub) throw new Error("Pedido inválido.");
  const dir = path.join(pastaPendentes(), sub);
  mkdirSync(dir, { recursive: true });

  const nome = sanitizeFileName(nomeArquivo);
  const ext = path.extname(nome);
  const stem = path.basename(nome, ext);
  let candidato = nome;
  let i = 2;
  while (existsSync(path.join(dir, candidato))) {
    candidato = `${stem} (${i})${ext}`;
    i++;
  }
  const fullPath = assertPendente(path.join(dir, candidato));
  writeFileSync(fullPath, conteudo);
  return { fullPath, nomeSalvo: candidato };
}

/** Lê o arquivo de um anexo, esteja ele esperando aqui ou já na pasta do cliente. */
export function lerArquivoDoAnexo(fullPath: string): Buffer {
  return ehPendente(fullPath) ? readFileSync(assertPendente(fullPath)) : readClienteFile(fullPath);
}

/** Apaga um arquivo pendente — nunca nada fora desta pasta. Se a pasta do
    pedido ficou vazia, ela sai também. */
export function removerPendente(fullPath: string): void {
  const alvo = assertPendente(fullPath);
  if (existsSync(alvo)) unlinkSync(alvo);
  const dir = path.dirname(alvo);
  try {
    if (ehPendente(dir) && existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir);
  } catch { /* outra gravação no meio: a pasta fica, vazia, e não faz mal */ }
}
