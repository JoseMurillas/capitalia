import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { ServiceError } from "./errors";

export type MailMessage = { to: string; subject: string; text: string };

/** Said in two places — when a run refuses to start, and when a send is attempted. */
export const MAILER_NOT_CONFIGURED =
  "Falta configurar el correo saliente: define SMTP_USER y SMTP_PASSWORD en el entorno.";

const HOST = process.env.SMTP_HOST ?? "smtp.gmail.com";
const PORT = Number(process.env.SMTP_PORT ?? 465);
const FROM_NAME = process.env.SMTP_FROM_NAME ?? "Capitalia";

/**
 * Credentials are shared between the machine you develop on and the deployment,
 * so this switch keeps a local run — a test, a curious press of "Enviar ahora" —
 * from writing to real borrowers. It is ignored in production, where the whole
 * point is that the mail goes out.
 */
function isDryRunForced(): boolean {
  return process.env.MAILER_DRY_RUN === "true" && process.env.NODE_ENV !== "production";
}

/** Whether a real message would leave this process. */
export function isMailerConfigured(): boolean {
  if (isDryRunForced()) return false;
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

let transporter: Transporter | null = null;

/** One transport per process: opening a connection per email is wasteful and slow. */
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,
      // A batch is sent one message after another; without the pool each one
      // opens its own TLS handshake and login, and fifty of those do not fit in
      // the time the scheduled run is given.
      pool: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  return transporter;
}

/**
 * Sends one plain-text email from the send-only mailbox. Without credentials
 * outside production it logs the message instead, so local work and end-to-end
 * tests run without secrets; in production the absence is an error, never a
 * silent no-op.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  if (!isMailerConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new ServiceError(MAILER_NOT_CONFIGURED);
    }
    console.info(`[mailer:dry-run] Para: ${message.to}\nAsunto: ${message.subject}\n${message.text}`);
    return;
  }

  await getTransporter().sendMail({
    from: `"${FROM_NAME}" <${process.env.SMTP_USER}>`,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
}
