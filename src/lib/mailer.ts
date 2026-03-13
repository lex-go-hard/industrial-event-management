import nodemailer from "nodemailer";

type SendEmailArgs = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

export async function sendEmail(args: SendEmailArgs) {
  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM;

  if (!host || !user || !pass || !from) {
    return { ok: false as const, skipped: true as const };
  }

  const port = Number(process.env.EMAIL_PORT ?? 587);
  const secure = String(process.env.EMAIL_SECURE ?? "false") === "true";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  await transporter.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  });

  return { ok: true as const };
}

