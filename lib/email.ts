import { Resend } from "resend";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  message: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`Mock Email Sent to ${options.to}: ${options.subject}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: "Be Fit Era <onboarding@resend.dev>",
    to: [options.to],
    subject: options.subject,
    html: `<p>${escapeHtml(options.message)}</p>`,
  });
}
