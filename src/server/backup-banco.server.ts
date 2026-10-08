// Backup diário do banco (Augusto, 08/10/2026: "2 - Z:\"). A revisão geral do
// mesmo dia achou que não havia backup automático: o último era de 02/09, no
// mesmo disco desta máquina.
//
// Uma vez por dia, depois das 12h, o hub tira uma cópia consistente com
// VACUUM INTO (copiar só o .db perde o -wal) direto na pasta de backup da
// rede, \\server\Arte\Backup do R2 Hub (o Z:\ das estações), FORA de Clientes.
// A cópia roda numa linha de execução à parte (worker): a escrita na rede não
// prende o hub. Um arquivo por tentativa, com dia e hora no nome
// (designhub-AAAA-MM-DD-HHMM.db): nunca apaga e nunca sobrescreve nada. A
// cópia é conferida (integrity_check) antes de contar como o backup do dia, e
// o resultado fica em data/backup-diario-<banco>.json. Se a rede falhar, tenta de novo
// na volta seguinte, com outro nome; o que ficou pela metade continua lá.
//
// Só liga na produção, ou com BACKUP_DIR (para testar noutra pasta).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { Worker } from "node:worker_threads";
import { dbPath } from "./db.server";

const DESTINO_PADRAO = "\\\\server\\Arte\\Backup do R2 Hub";
const A_PARTIR_DAS = 12;            // horas: a cópia do dia sai no almoço ou depois
const VOLTA_MS = 15 * 60_000;       // de quanto em quanto tempo confere
const PRAZO_MS = 10 * 60_000;       // a cópia presa na rede é encerrada depois disso
const PRIMEIRA_MS = 2 * 60_000;     // depois de o hub ligar

type Situacao = { ultimoDia?: string; arquivo?: string; quando?: string; erro?: string; tentativa?: string };

function destino(): string | null {
  if (process.env.BACKUP_DIR) return process.env.BACKUP_DIR;
  return process.env.NODE_ENV === "production" ? DESTINO_PADRAO : null;
}
/* a nota leva o nome do banco: a produção (designhub.db) e o teste (teste-modais.db)
   moram no mesmo data/, e um não pode fazer o outro pular o backup do dia */
const arquivoDaSituacao = () =>
  path.join(path.dirname(dbPath()), `backup-diario-${path.basename(dbPath()).replace(/\.db$/i, "")}.json`);
function lerSituacao(): Situacao {
  try { return JSON.parse(readFileSync(arquivoDaSituacao(), "utf8")) as Situacao; } catch { return {}; }
}
function gravarSituacao(s: Situacao) {
  try { writeFileSync(arquivoDaSituacao(), JSON.stringify(s, null, 1)); } catch { /* sem a nota, tenta de novo na próxima volta */ }
}
const dois = (n: number) => String(n).padStart(2, "0");
const diaLocal = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

/* o que o worker faz, em CommonJS (eval): abre o banco só para leitura, faz o
   VACUUM INTO no arquivo novo e confere a cópia */
const CODIGO_DO_WORKER = `
const { workerData, parentPort } = require("node:worker_threads");
const { DatabaseSync } = require("node:sqlite");
const { existsSync, mkdirSync } = require("node:fs");
try {
  const { origem, pasta, arquivo } = workerData;
  mkdirSync(pasta, { recursive: true });
  if (existsSync(arquivo)) throw new Error("o arquivo já existe: " + arquivo);
  const d = new DatabaseSync(origem, { readOnly: true });
  d.exec("VACUUM INTO '" + arquivo.replace(/'/g, "''") + "'");
  d.close();
  const c = new DatabaseSync(arquivo, { readOnly: true });
  const conferencia = c.prepare("PRAGMA integrity_check").get().integrity_check;
  c.close();
  parentPort.postMessage({ ok: conferencia === "ok", conferencia });
} catch (e) {
  parentPort.postMessage({ ok: false, conferencia: String((e && e.message) || e) });
}`;

function copiarNoWorker(origem: string, pasta: string, arquivo: string): Promise<{ ok: boolean; conferencia: string }> {
  return new Promise((resolve) => {
    const w = new Worker(CODIGO_DO_WORKER, { eval: true, workerData: { origem, pasta, arquivo } });
    /* preso no SMB, o worker seguraria a leitura do banco aberta: encerra */
    const prazo = setTimeout(() => {
      void w.terminate();
      resolve({ ok: false, conferencia: "a cópia passou de 10 minutos e foi interrompida" });
    }, PRAZO_MS);
    w.once("message", (m) => { clearTimeout(prazo); resolve(m as { ok: boolean; conferencia: string }); });
    w.once("error", (e) => { clearTimeout(prazo); resolve({ ok: false, conferencia: String(e?.message ?? e) }); });
    /* depois da resposta, o resolve daqui não muda nada; sem resposta, não prende o "rodando" */
    w.once("exit", (codigo) => { clearTimeout(prazo); resolve({ ok: false, conferencia: codigo === 0 ? "a cópia terminou sem resposta" : `o worker saiu com ${codigo}` }); });
  });
}

let rodando = false;

/** Faz o backup do dia, se ainda não foi feito e já passou da hora. */
export async function backupDoDia(agora = new Date(), forcar = false): Promise<Situacao & { feito: boolean }> {
  const pasta = destino();
  const situacao = lerSituacao();
  const dia = diaLocal(agora);
  if (!pasta) return { ...situacao, feito: false };
  if (!forcar && (situacao.ultimoDia === dia || agora.getHours() < A_PARTIR_DAS)) return { ...situacao, feito: false };
  if (rodando) return { ...situacao, feito: false };
  rodando = true;
  try {
    /* sem existsSync aqui: na rede ele prende a linha principal; o worker confere */
    const arquivo = path.join(pasta, `designhub-${dia}-${dois(agora.getHours())}${dois(agora.getMinutes())}.db`);
    const r = await copiarNoWorker(dbPath(), pasta, arquivo);
    const nova: Situacao = r.ok
      ? { ultimoDia: dia, arquivo, quando: new Date().toISOString() }
      : { ...situacao, erro: r.conferencia, tentativa: new Date().toISOString() };
    gravarSituacao(nova);
    if (r.ok) console.log(`[backup] banco copiado para ${arquivo}`);
    else console.error(`[backup] não deu para copiar o banco: ${r.conferencia}`);
    return { ...nova, feito: r.ok };
  } finally {
    rodando = false;
  }
}

/** Liga a conferência periódica (uma vez por processo; o dev recarrega módulos). */
export function iniciarBackupDiario() {
  if (!destino()) return;
  const g = globalThis as unknown as { __r2BackupDiario?: boolean };
  if (g.__r2BackupDiario) return;
  g.__r2BackupDiario = true;
  const volta = () => { void backupDoDia().catch((e) => console.error("[backup]", e)); };
  /* unref: o relógio do backup não segura o processo vivo sozinho */
  const soltar = (t: unknown) => (t as { unref?: () => void }).unref?.();
  soltar(setTimeout(volta, PRIMEIRA_MS));
  soltar(setInterval(volta, VOLTA_MS));
}
