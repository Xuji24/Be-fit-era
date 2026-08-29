import nodemailer, { type Transporter } from "nodemailer";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Configured lazily (not at module scope) so a build/static-analysis pass
// with no SMTP env vars set doesn't try to construct a transporter — same
// pattern as ensureVapidConfigured() in app/api/cron/coach-proactive/route.ts.
let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: true,
    auth: { user, pass },
  });
  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  message: string;
}): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    console.log(`Mock Email Sent to ${options.to}: ${options.subject}`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? `Fitra <${process.env.SMTP_USER}>`,
    to: options.to,
    subject: options.subject,
    html: `<p>${escapeHtml(options.message)}</p>`,
  });
}
