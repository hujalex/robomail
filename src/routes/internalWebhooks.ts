import { Hono } from "hono";
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
import { deliverEvent, verifySignature } from "../lib/webhooks.js";

const router = new Hono();

router.post("/inbound", async (c) => {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "INBOUND_WEBHOOK_SECRET is not configured" }, 500);

  const rawBody = await c.req.raw.text();
  // CloudMailin sends HMAC SHA256 hex (no sha256= prefix) in X-Cloudmailin-Signature
  const rawSig = c.req.header("x-cloudmailin-signature");
  const signature = rawSig ? `sha256=${rawSig}` : undefined;
  if (!verifySignature(secret, rawBody, signature)) return c.json({ error: "Invalid signature" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const headers =
    typeof payload.headers === "object" && payload.headers !== null
      ? (payload.headers as Record<string, unknown>)
      : {};

  const messageIdCandidate =
    (payload.message_id as string | undefined) ??
    (payload.messageId as string | undefined) ??
    (payload["message-id"] as string | undefined) ??
    (headers["Message-ID"] as string | undefined) ??
    (headers["message-id"] as string | undefined);

  const inReplyToCandidate =
    (payload.in_reply_to as string | undefined) ??
    (payload.inReplyTo as string | undefined) ??
    (headers["In-Reply-To"] as string | undefined) ??
    (headers["in-reply-to"] as string | undefined);

  const referencesCandidate =
    (payload.references as string | undefined) ??
    (headers["References"] as string | undefined) ??
    (headers["references"] as string | undefined);

  const fromCandidate =
    (payload.from as string | undefined) ??
    (payload.sender as string | undefined) ??
    (headers["From"] as string | undefined) ??
    (headers["from"] as string | undefined);

  const toCandidate = payload.to ?? payload.recipients ?? headers["To"] ?? headers["to"];
  const ccCandidate = payload.cc ?? headers["Cc"] ?? headers["cc"];
  const bccCandidate = payload.bcc ?? headers["Bcc"] ?? headers["bcc"];

  const subject =
    (payload.subject as string | undefined) ??
    (headers["Subject"] as string | undefined) ??
    (headers["subject"] as string | undefined) ??
    null;

  const text =
    (payload.plain as string | undefined) ??
    (payload.text as string | undefined) ??
    (payload["body-text"] as string | undefined) ??
    (payload.body && typeof payload.body === "object"
      ? (payload.body as { text?: string }).text
      : undefined) ??
    null;

  const html =
    (payload.html as string | undefined) ??
    (payload.body && typeof payload.body === "object"
      ? (payload.body as { html?: string }).html
      : undefined) ??
    null;

  const rawMessage =
    (payload.raw as string | undefined) ??
    (payload.raw_message as string | undefined) ??
    (payload.rawMessage as string | undefined) ??
    null;

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
      headers: headers as Record<string, unknown>,
      raw: rawMessage,
      embedding: embedding ?? undefined,
    })
    .returning();

  await db.update(threads).set({ lastMessageAt: new Date() }).where(eq(threads.id, threadId));

  if (threadCreated && threadRecord) {
    await deliverEvent(inbox.accountId, "thread.created", serializeThread(threadRecord, [createdMessage]));
  }
  await deliverEvent(inbox.accountId, "message.received", serializeMessage(createdMessage));

  return c.json({ received: true });
});

router.post("/outbound-status", async (c) => {
  const secret = process.env.OUTBOUND_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: "OUTBOUND_WEBHOOK_SECRET is not configured" }, 500);

  const rawBody = await c.req.raw.text();
  // CloudMailin sends HMAC SHA256 hex (no sha256= prefix) in X-Cloudmailin-Signature
  const rawSig = c.req.header("x-cloudmailin-signature");
  const signature = rawSig ? `sha256=${rawSig}` : undefined;
  if (!verifySignature(secret, rawBody, signature)) return c.json({ error: "Invalid signature" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const messageId =
    (payload.message_id as string | undefined) ??
    (payload.messageId as string | undefined) ??
    (payload.id as string | undefined);
  if (!messageId) return c.json({ error: "Missing message_id" }, 400);

  const status =
    (payload.status as string | undefined) ?? (payload.event as string | undefined);

  let normalizedStatus: "delivered" | "bounced" | null = null;
  if (status === "delivered" || status === "message.delivered") normalizedStatus = "delivered";
  if (status === "bounced" || status === "message.bounced") normalizedStatus = "bounced";
  if (!normalizedStatus) return c.json({ error: "Unsupported status" }, 400);

  const [updated] = await db
    .update(messages)
    .set({ status: normalizedStatus })
    .where(eq(messages.id, normalizeMessageId(messageId)))
    .returning();

  if (!updated) return c.json({ error: "Message not found" }, 404);

  await deliverEvent(
    updated.accountId,
    normalizedStatus === "delivered" ? "message.delivered" : "message.bounced",
    serializeMessage(updated),
  );

  return c.json({ received: true });
});

export default router;
