import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { inboxes, messages, threads } from "../db/schema.js";
import type { AuthVariables } from "../lib/auth.js";
import {
  extractDomain,
  generateMessageId,
  generateThreadId,
  normalizeEmail,
  normalizeEmailList,
  normalizeMessageId,
} from "../lib/email.js";
import { createEmbedding, embeddingsEnabled } from "../lib/embeddings.js";
import { finalizeList, parseLimit } from "../lib/pagination.js";
import {
  readJson,
  requireString,
  parseStringArray,
  parseMetadata,
} from "../lib/parsers.js";
import { serializeMessage } from "../lib/serializers.js";
import { deliverEvent } from "../lib/webhooks.js";

const router = new Hono<{ Variables: AuthVariables }>();

router.post("/", async (c) => {
  const bodyResult = await readJson<{
    inbox_email_address?: unknown;
    to?: unknown;
    cc?: unknown;
    bcc?: unknown;
    subject?: unknown;
    text?: unknown;
    html?: unknown;
    in_reply_to_thread_id?: unknown;
    headers?: unknown;
  }>(c);
  if (!bodyResult.ok) return c.json({ error: bodyResult.error }, 400);

  const inboxError = requireString(bodyResult.value.inbox_email_address, "inbox_email_address");
  if (inboxError) return c.json({ error: inboxError }, 400);

  const toResult = parseStringArray(bodyResult.value.to, "to", { required: true });
  if (!toResult.ok) return c.json({ error: toResult.error }, 400);
  const toAddresses = normalizeEmailList(toResult.value);
  if (toAddresses.length === 0) return c.json({ error: "to must include at least one address" }, 400);

  const ccResult = parseStringArray(bodyResult.value.cc, "cc");
  if (!ccResult.ok) return c.json({ error: ccResult.error }, 400);
  const ccAddresses = normalizeEmailList(ccResult.value);

  const bccResult = parseStringArray(bodyResult.value.bcc, "bcc");
  if (!bccResult.ok) return c.json({ error: bccResult.error }, 400);
  const bccAddresses = normalizeEmailList(bccResult.value);

  const subject = typeof bodyResult.value.subject === "string" ? bodyResult.value.subject : null;
  const text = typeof bodyResult.value.text === "string" ? bodyResult.value.text : null;
  const html = typeof bodyResult.value.html === "string" ? bodyResult.value.html : null;
  if (!text && !html) return c.json({ error: "Either text or html body is required" }, 400);

  const headersResult = parseMetadata(bodyResult.value.headers, "headers");
  if (!headersResult.ok) return c.json({ error: headersResult.error }, 400);

  const inbox = await db.query.inboxes.findFirst({
    where: and(
      eq(inboxes.address, normalizeEmail(bodyResult.value.inbox_email_address as string)),
      eq(inboxes.accountId, c.get("accountId")),
    ),
  });
  if (!inbox) return c.json({ error: "Inbox not found" }, 404);

  let thread = null as typeof threads.$inferSelect | null;
  const threadIdInput = bodyResult.value.in_reply_to_thread_id;
  if (threadIdInput !== undefined && threadIdInput !== null) {
    if (typeof threadIdInput !== "string") {
      return c.json({ error: "in_reply_to_thread_id must be a string" }, 400);
    }
    thread =
      (await db.query.threads.findFirst({
        where: and(
          eq(threads.id, threadIdInput),
          eq(threads.accountId, c.get("accountId")),
          eq(threads.inboxId, inbox.id),
        ),
      })) ?? null;
    if (!thread) return c.json({ error: "Thread not found" }, 404);
  }

  const messageId = normalizeMessageId(generateMessageId(extractDomain(inbox.address)));
  let threadId = thread?.id ?? generateThreadId();
  let threadCreated = false;

  if (!thread) {
    const [createdThread] = await db
      .insert(threads)
      .values({
        id: threadId,
        inboxId: inbox.id,
        accountId: c.get("accountId"),
        subject,
        rootMessageIdHeader: messageId,
        lastMessageAt: new Date(),
      })
      .returning();
    thread = createdThread;
    threadCreated = true;
  }

  let inReplyTo: string | null = null;
  if (!threadCreated) {
    const lastMessage = await db.query.messages.findFirst({
      where: and(eq(messages.threadId, threadId), eq(messages.accountId, c.get("accountId"))),
      orderBy: desc(messages.createdAt),
    });
    inReplyTo = lastMessage?.messageIdHeader ?? null;
  }

  const embedding = embeddingsEnabled() && text ? await createEmbedding(text) : null;

  const [createdMessage] = await db
    .insert(messages)
    .values({
      id: messageId,
      threadId,
      inboxId: inbox.id,
      accountId: c.get("accountId"),
      direction: "outbound",
      status: "sent",
      messageIdHeader: messageId,
      inReplyTo,
      fromAddress: inbox.address,
      toAddresses,
      ccAddresses,
      bccAddresses,
      subject,
      bodyText: text,
      bodyHtml: html,
      headers: headersResult.value,
      embedding: embedding ?? undefined,
    })
    .returning();

  await db.update(threads).set({ lastMessageAt: new Date() }).where(eq(threads.id, threadId));
  await deliverEvent(c.get("accountId"), "message.sent", serializeMessage(createdMessage));
  return c.json(serializeMessage(createdMessage), 201);
});

router.get("/", async (c) => {
  const limit = parseLimit(c.req.query("limit"), { max: 100, fallback: 20 });
  const startingAfter = c.req.query("starting_after");
  const inboxAddress = c.req.query("inbox_email_address");
  const threadId = c.req.query("thread_id");
  const direction = c.req.query("direction");
  const fromAddress = c.req.query("from");
  const toAddress = c.req.query("to");

  const conditions = [eq(messages.accountId, c.get("accountId"))];

  if (inboxAddress) {
    const inbox = await db.query.inboxes.findFirst({
      where: and(
        eq(inboxes.address, normalizeEmail(inboxAddress)),
        eq(inboxes.accountId, c.get("accountId")),
      ),
    });
    if (!inbox) return c.json({ error: "Inbox not found" }, 404);
    conditions.push(eq(messages.inboxId, inbox.id));
  }

  if (threadId) conditions.push(eq(messages.threadId, threadId));
  if (direction) {
    if (direction !== "inbound" && direction !== "outbound") {
      return c.json({ error: "direction must be inbound or outbound" }, 400);
    }
    conditions.push(eq(messages.direction, direction));
  }
  if (fromAddress) conditions.push(eq(messages.fromAddress, normalizeEmail(fromAddress)));
  if (toAddress) {
    const normalized = normalizeEmail(toAddress);
    conditions.push(sql`${messages.toAddresses} @> ARRAY[${normalized}]::citext[]`);
  }

  if (startingAfter) {
    const cursor = await db.query.messages.findFirst({
      where: and(eq(messages.id, startingAfter), eq(messages.accountId, c.get("accountId"))),
    });
    if (!cursor) return c.json({ error: "Invalid cursor" }, 400);
    conditions.push(sql`${messages.createdAt} < ${cursor.createdAt}`);
  }

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit + 1);

  return c.json(finalizeList(rows.map(serializeMessage), limit));
});

router.get("/:id", async (c) => {
  const message = await db.query.messages.findFirst({
    where: and(eq(messages.id, c.req.param("id")), eq(messages.accountId, c.get("accountId"))),
  });
  if (!message) return c.json({ error: "Message not found" }, 404);
  return c.json(serializeMessage(message));
});

router.get("/:id/raw", async (c) => {
  const message = await db.query.messages.findFirst({
    where: and(eq(messages.id, c.req.param("id")), eq(messages.accountId, c.get("accountId"))),
  });
  if (!message || !message.raw) return c.json({ error: "Raw message not found" }, 404);
  return c.text(message.raw);
});

export default router;
