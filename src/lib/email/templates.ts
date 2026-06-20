import { env } from "@/config/env";

/** Minimal, inline-styled HTML email templates (no external assets). */

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
      <h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
      ${body}
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="font-size:12px;color:#64748b;margin:0">Infra Sub — Subscription Platform</p>
    </div>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${label}</a>`;
}

export function verifyEmailTemplate(token: string): {
  subject: string;
  html: string;
} {
  const url = `${env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;
  return {
    subject: "Verify your email address",
    html: layout(
      "Confirm your email",
      `<p>Welcome to Infra Sub. Please confirm your email address to activate your account.</p>
       <p style="margin:24px 0">${button(url, "Verify email")}</p>
       <p style="font-size:13px;color:#64748b">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>`,
    ),
  };
}

export function resetPasswordTemplate(token: string): {
  subject: string;
  html: string;
} {
  const url = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
  return {
    subject: "Reset your password",
    html: layout(
      "Reset your password",
      `<p>We received a request to reset your password. Click below to choose a new one.</p>
       <p style="margin:24px 0">${button(url, "Reset password")}</p>
       <p style="font-size:13px;color:#64748b">This link expires in 1 hour. If you didn't request this, no action is needed.</p>`,
    ),
  };
}

export function paymentReceiptTemplate(params: {
  invoiceNumber: string;
  amount: string;
  planName: string;
}): { subject: string; html: string } {
  return {
    subject: `Payment received — ${params.invoiceNumber}`,
    html: layout(
      "Payment received",
      `<p>Thank you. We've received your payment for <strong>${params.planName}</strong>.</p>
       <p>Invoice: <strong>${params.invoiceNumber}</strong><br/>Amount: <strong>${params.amount}</strong></p>
       <p style="margin:24px 0">${button(`${env.NEXT_PUBLIC_APP_URL}/dashboard/invoices`, "View invoices")}</p>`,
    ),
  };
}
