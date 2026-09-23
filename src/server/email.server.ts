// Envio de e-mail via SMTP da empresa (nodemailer).
// Configuração pelas variáveis de ambiente do serviço:
//   SMTP_HOST, SMTP_PORT (587 ou 465), SMTP_USER, SMTP_PASS,
//   SMTP_FROM (remetente, ex.: "R2 Hub <hub@r2etiquetas.com.br>"),
//   CLICHE_EMAIL_TO (destinatário das solicitações de clichê).
import nodemailer from "nodemailer";
import process from "node:process";

export type EmailAnexo = { nome: string; conteudo: Buffer };

export function clicheEmailDestino(): string | null {
  return process.env.CLICHE_EMAIL_TO ?? null;
}

function smtpConfigurado(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function enviarEmail(opts: {
  para: string;
  assunto: string;
  html: string;
  anexos?: EmailAnexo[];
}): Promise<{ enviado: boolean; erro: string | null }> {
  if (!smtpConfigurado()) {
    return { enviado: false, erro: "SMTP não configurado (defina SMTP_HOST, SMTP_USER e SMTP_PASS)" };
  }
  if (!opts.para) {
    return { enviado: false, erro: "Destinatário não configurado (defina CLICHE_EMAIL_TO)" };
  }
  try {
    const porta = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: porta,
      secure: porta === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: opts.para,
      subject: opts.assunto,
      html: opts.html,
      attachments: (opts.anexos ?? []).map((a) => ({ filename: a.nome, content: a.conteudo })),
    });
    return { enviado: true, erro: null };
  } catch (err) {
    return { enviado: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
