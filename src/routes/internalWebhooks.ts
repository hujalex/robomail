import { Hono } from "hono";
import { Webhook } from "svix";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { inboxes, messages, threads } from "../db/schema.js";
import {
  extractDomain,
  extractEmailAddress,
  generateMessageId,
  generateThreadId,
  normalizeMessageId,
  parseAddressList,
  splitReferences,
} from "../lib/email.js";
import { createEmbedding, embeddingsEnabled } from "../lib/embeddings.js";
import { serializeMessage, serializeThread } from "../lib/serializers.js";
import { deliverEvent } from "../lib/webhooks.js";
import { timingSafeEqual } from "../lib/crypto.js";

const router = new Hono();

function verifyResendWebhook(secret: string, rawBody: string, headers: Record<string, string | undefined>): boolean {
  try {
    const wh = new Webhook(secret);
    wh.verify(rawBody, headers as Record<string, string>);
    return true;
  } catch {
    return false;
  }
}

// Resend inbound email headers come as [{name, value}] array — convert to flat map
function parseResendHeaders(headers: unknown): Record<string, string> {
  if (!Array.isArray(headers)) return {};
  const result: Record<string, string> = {};
  for (const h of headers) {
    if (h && typeof h === "object" && "name" in h && "value" in h) {
      result[(h as { name: string }).name] = (h as { value: string }).value;
    }
  }
  return result;
}

router.post("/inbound", async (c) => {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "RESEND_INBOUND_WEBHOOK_SECRET is not configured" }, 500);

  const rawBody = await c.req.raw.text();

  if (!verifyResendWebhook(secret, rawBody, {
    "svix-id": c.req.header("svix-id"),
    "svix-timestamp": c.req.header("svix-timestamp"),
    "svix-signature": c.req.header("svix-signature"),
  })) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Resend wraps email data in { type: "email.received", data: { ... } }
  const payload = (
    envelope.type === "email.received" && envelope.data && typeof envelope.data === "object"
      ? envelope.data
      : envelope
  ) as Record<string, unknown>;

  const headerMap = parseResendHeaders(payload.headers);

  const messageIdCandidate =
    (payload.message_id as string | undefined) ??
    headerMap["Message-Id"] ??
    headerMap["Message-ID"] ??
    headerMap["message-id"];

  const inReplyToCandidate =
    (payload.in_reply_to as string | undefined) ??
    headerMap["In-Reply-To"] ??
    headerMap["in-reply-to"];

  const referencesCandidate =
    (payload.references as string | undefined) ??
    headerMap["References"] ??
    headerMap["references"];

  const fromCandidate = payload.from as string | undefined;
  const toCandidate = payload.to;
  const ccCandidate = payload.cc;
  const bccCandidate = payload.bcc;
  const subject = (payload.subject as string | undefined) ?? null;
  const text = (payload.text as string | undefined) ?? null;
  const html = (payload.html as string | undefined) ?? null;
  const rawMessage = (payload.raw as string | undefined) ?? null;

  if (!fromCandidate) return c.json({ error: "Missing from address" }, 400);

  const toList = parseAddressList(toCandidate)
    .map(extractEmailAddress)
    .filter((entry) => entry.length > 0);
  if (toList.length === 0) return c.json({ error: "Missing to address" }, 400);

  const inbox = await db.query.inboxes.findFirst({ where: inArray(inboxes.address, toList) });
  if (!inbox) return c.json({ error: "Inbox not found" }, 404);

  const messageId = messageIdCandidate
    ? normalizeMessageId(messageIdCandidate)
    : normalizeMessageId(generateMessageId(extractDomain(inbox.address)));

  const existingMessage = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
  if (existingMessage) return c.json({ received: true });

  const inReplyTo = inReplyToCandidate ? normalizeMessageId(inReplyToCandidate) : null;
  const references = splitReferences(referencesCandidate);

  let threadId: string;
  let threadCreated = false;
  let threadRecord: typeof threads.$inferSelect | null = null;

  let referencedMessage: typeof messages.$inferSelect | undefined;
  if (inReplyTo) {
    referencedMessage = await db.query.messages.findFirst({
      where: and(eq(messages.messageIdHeader, inReplyTo), eq(messages.accountId, inbox.accountId)),
    });
  }
  if (!referencedMessage && references.length > 0) {
    referencedMessage = await db.query.messages.findFirst({
      where: and(
        inArray(messages.messageIdHeader, references),
        eq(messages.accountId, inbox.accountId),
      ),
      orderBy: desc(messages.createdAt),
    });
  }

  if (referencedMessage) {
    threadId = referencedMessage.threadId;
    threadRecord = (await db.query.threads.findFirst({ where: eq(threads.id, threadId) })) ?? null;
  } else {
    threadId = generateThreadId();
    threadCreated = true;
    const [createdThread] = await db
      .insert(threads)
      .values({
        id: threadId,
        inboxId: inbox.id,
        accountId: inbox.accountId,
        subject,
        rootMessageIdHeader: messageId,
        lastMessageAt: new Date(),
      })
      .returning();
    threadRecord = createdThread;
  }

  const embedding = embeddingsEnabled() && text ? await createEmbedding(text) : null;

  const [createdMessage] = await db
    .insert(messages)
    .values({
      id: messageId,
      threadId,
      inboxId: inbox.id,
      accountId: inbox.accountId,
      direction: "inbound",
      status: "received",
      messageIdHeader: messageId,
      inReplyTo,
      fromAddress: extractEmailAddress(fromCandidate),
      toAddresses: toList,
      ccAddresses: parseAddressList(ccCandidate).map(extractEmailAddress).filter((e) => e.length > 0),
      bccAddresses: parseAddressList(bccCandidate).map(extractEmailAddress).filter((e) => e.length > 0),
      subject,
      bodyText: text,
      bodyHtml: html,
      headers: headerMap,
      raw: rawMessage,
      embedding: embedding ?? undefined,
    })
    .returning();

  await db.update(threads).set({ lastMessageAt: new Date() }).where(eq(threads.id, threadId));

  if (threadCreated && threadRecord) {
    await deliverEvent(inbox.accountId, inbox.id, "thread.created", serializeThread(threadRecord, [createdMessage]));
  }
  await deliverEvent(inbox.accountId, inbox.id, "message.received", serializeMessage(createdMessage));

  return c.json({ received: true });
});

router.post("/outbound-status", async (c) => {
  const deliveredSecret = process.env.RESEND_DELIVERED_WEBHOOK_SECRET;
  const bouncedSecret = process.env.RESEND_BOUNCED_WEBHOOK_SECRET;
  if (!deliveredSecret) return c.json({ error: "RESEND_DELIVERED_WEBHOOK_SECRET is not configured" }, 500);
  if (!bouncedSecret) return c.json({ error: "RESEND_BOUNCED_WEBHOOK_SECRET is not configured" }, 500);

  const rawBody = await c.req.raw.text();

  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const eventType = envelope.type as string | undefined;

  const secret =
    eventType === "email.delivered" ? deliveredSecret :
    eventType === "email.bounced" || eventType === "email.delivery_delayed" ? bouncedSecret :
    null;

  if (!secret) return c.json({ error: "Unsupported event type" }, 400);

  if (!verifyResendWebhook(secret, rawBody, {
    "svix-id": c.req.header("svix-id"),
    "svix-timestamp": c.req.header("svix-timestamp"),
    "svix-signature": c.req.header("svix-signature"),
  })) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const data = (envelope.data ?? {}) as Record<string, unknown>;

  const messageId =
    (data.message_id as string | undefined) ??
    (data.email_id as string | undefined) ??
    (data.id as string | undefined);
  if (!messageId) return c.json({ error: "Missing message_id" }, 400);

  const normalizedStatus = eventType === "email.delivered" ? "delivered" : "bounced";

  const [updated] = await db
    .update(messages)
    .set({ status: normalizedStatus })
    .where(eq(messages.id, normalizeMessageId(messageId)))
    .returning();

  if (!updated) return c.json({ error: "Message not found" }, 404);

  await deliverEvent(
    updated.accountId,
    updated.inboxId,
    normalizedStatus === "delivered" ? "message.delivered" : "message.bounced",
    serializeMessage(updated),
  );

  return c.json({ received: true });
});

export default router;
