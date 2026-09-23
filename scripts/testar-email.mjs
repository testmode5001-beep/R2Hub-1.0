// Teste do envio de e-mail — roda fora do hub, para acertar a configuração do
// SMTP sem precisar abrir uma solicitação de clichê de verdade.
//
//   node scripts/testar-email.mjs danilo@r2etiquetas.com.br
//
// Lê o .env do projeto (as mesmas variáveis que o servidor usa) e mostra, em
// ordem: o que está configurado (a senha NUNCA aparece), se o servidor SMTP
// aceita a conexão e o login, e se a mensagem saiu.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import nodemailer from "nodemailer";

const raiz = path.resolve(import.meta.dirname, "..");

/* .env → process.env (o vite faz isso sozinho em desenvolvimento; aqui não) */
const arquivoEnv = path.join(raiz, ".env");
if (existsSync(arquivoEnv)) {
  for (const linha of readFileSync(arquivoEnv, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linha);
    if (!m) continue;
    const valor = m[2].trim().replace(/^["']|["']$/g, "");
    if (valor) process.env[m[1]] = valor;
  }
}

const destino = process.argv[2] || process.env.CLICHE_EMAIL_TO;
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

console.log("\n== Configuração encontrada ==");
console.log("  SMTP_HOST :", SMTP_HOST || "(vazio)");
console.log("  SMTP_PORT :", SMTP_PORT || "(vazio — vai usar 587)");
console.log("  SMTP_USER :", SMTP_USER || "(vazio)");
console.log("  SMTP_PASS :", SMTP_PASS ? `(preenchida, ${SMTP_PASS.length} caracteres)` : "(vazio)");
console.log("  SMTP_FROM :", SMTP_FROM || "(vazio — vai usar o SMTP_USER)");
console.log("  destino   :", destino || "(vazio)");

const faltando = [
  !SMTP_HOST && "SMTP_HOST",
  !SMTP_USER && "SMTP_USER",
  !SMTP_PASS && "SMTP_PASS",
  !destino && "destinatário (CLICHE_EMAIL_TO ou argumento na linha de comando)",
].filter(Boolean);

if (faltando.length) {
  console.log("\n✗ Falta preencher no .env:", faltando.join(", "));
  console.log("  Abra DesignHub-v2\\.env, descomente e preencha as linhas do SMTP.\n");
  process.exit(1);
}

const porta = Number(SMTP_PORT ?? 587);
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: porta,
  secure: porta === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

try {
  console.log("\n== Conexão e login ==");
  await transporter.verify();
  console.log("  ✓ o servidor aceitou a conexão e o login");
} catch (e) {
  console.log("  ✗ falhou:", e?.message ?? e);
  console.log(`
  O que costuma ser:
   · senha errada, ou conta com verificação em duas etapas (Microsoft/Google
     pedem uma "senha de aplicativo", a senha normal não passa);
   · SMTP autenticado desligado na caixa (no Microsoft 365 o administrador
     precisa habilitar "Authenticated SMTP" para esse endereço);
   · porta bloqueada pelo firewall/antivírus da máquina (teste 587 e 465);
   · host errado — confirme com quem hospeda o e-mail da R2.
`);
  process.exit(1);
}

try {
  console.log("== Envio ==");
  const r = await transporter.sendMail({
    from: SMTP_FROM ?? SMTP_USER,
    to: destino,
    subject: "R2 Hub — teste de envio",
    html: `<p>Mensagem de teste do R2 Hub.</p>
           <p>Se ela chegou, as solicitações de clichê já saem por e-mail.</p>`,
  });
  console.log("  ✓ enviado para", destino);
  console.log("  id da mensagem:", r.messageId);
  console.log("  aceito por:", (r.accepted ?? []).join(", ") || "—");
  if (r.rejected?.length) console.log("  RECUSADO para:", r.rejected.join(", "));
  console.log("\n  Confira a caixa de entrada (e o lixo eletrônico) do destinatário.\n");
} catch (e) {
  console.log("  ✗ falhou no envio:", e?.message ?? e, "\n");
  process.exit(1);
}
