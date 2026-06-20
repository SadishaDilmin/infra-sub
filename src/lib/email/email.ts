import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

/**
 * Transactional email via SMTP (nodemailer). Used for email verification and
 * password reset. If SMTP is not configured (local dev), emails are logged to
 * the console instead of being sent, so flows remain testable.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return transporter;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const tx = getTransporter();
  if (!tx) {
    logger.warn("SMTP not configured — email not sent (logging instead)", {
      to: params.to,
      subject: params.subject,
    });
    logger.info("DEV EMAIL", { to: params.to, subject: params.subject, html: params.html });
    return;
  }
  await tx.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
}
