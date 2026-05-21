import { Resend } from "resend";

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

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY");

  const resend = new Resend(apiKey);

  const headers: Record<string, string> = { "Message-ID": opts.messageId };
  if (opts.inReplyTo) headers["In-Reply-To"] = opts.inReplyTo;
  if (opts.references?.length) headers["References"] = opts.references.join(" ");
  if (opts.extraHeaders) {
    for (const [k, v] of Object.entries(opts.extraHeaders)) {
      if (typeof v === "string") headers[k] = v;
    }
  }

  const body = opts.html
    ? { html: opts.html, text: opts.text ?? undefined }
    : { text: opts.text ?? "" };

  const { error } = await resend.emails.send({
    from: opts.from,
    to: opts.to,
    cc: opts.cc?.length ? opts.cc : undefined,
    bcc: opts.bcc?.length ? opts.bcc : undefined,
    subject: opts.subject ?? "",
    ...body,
    headers,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
