import nodemailer from "nodemailer";

export interface SendEmailOptions {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  messageId: string;
  inReplyTo?: string | null;
  references?: string[];
  extraHeaders?: Record<string, unknown>;
}

function buildTransport() {
  const host = process.env.CLOUDMAILIN_SMTP_HOST;
  const port = parseInt(process.env.CLOUDMAILIN_SMTP_PORT ?? "587", 10);
  const user = process.env.CLOUDMAILIN_SMTP_USER;
  const pass = process.env.CLOUDMAILIN_SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing CLOUDMAILIN_SMTP_HOST, CLOUDMAILIN_SMTP_USER, or CLOUDMAILIN_SMTP_PASS");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const transport = buildTransport();

  const headers: Record<string, string> = { "Message-ID": opts.messageId };
  if (opts.inReplyTo) headers["In-Reply-To"] = opts.inReplyTo;
  if (opts.references && opts.references.length > 0) {
    headers["References"] = opts.references.join(" ");
  }
  if (opts.extraHeaders) {
    for (const [k, v] of Object.entries(opts.extraHeaders)) {
      if (typeof v === "string") headers[k] = v;
    }
  }

  await transport.sendMail({
    from: opts.from,
    to: opts.to,
    cc: opts.cc?.length ? opts.cc : undefined,
    bcc: opts.bcc?.length ? opts.bcc : undefined,
    subject: opts.subject ?? undefined,
    text: opts.text ?? undefined,
    html: opts.html ?? undefined,
    headers,
  });
}
