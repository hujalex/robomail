import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import {
  accounts,
  inboxes,
  messages,
  threads,
  webhookEndpoints,
} from "./db/schema.js";
import { authMiddleware, type AuthVariables } from "./lib/auth.js";
import {
  buildAddress,
  extractDomain,
  generateMessageId,
  generateThreadId,
  normalizeEmail,
  normalizeEmailList,
  normalizeMessageId,
  splitReferences,
} from "./lib/email.js";
import { createEmbedding, embeddingsEnabled } from "./lib/embeddings.js";
import { finalizeList, parseLimit } from "./lib/pagination.js";
import { deliverEvent, verifySignature } from "./lib/webhooks.js";

type JsonResult<T> = { ok: true; value: T } | { ok: false; error: string };

const app = new Hono<{ Variables: AuthVariables }>();

const readJson = async <T>(
  c: { req: { json: () => Promise<unknown> } },
): Promise<JsonResult<T>> => {
  try {
    return { ok: true, value: (await c.req.json()) as T };
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }
};

const requireString = (value: unknown, field: string): string | null => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return `${field} is required`;
  }
  return null;
};

const parseStringArray = (
  value: unknown,
  field: string,
  { required = false }: { required?: boolean } = {},
): JsonResult<string[]> => {
  if (value === undefined || value === null) {
    if (required) {
      return { ok: false, error: `${field} is required` };
    }
    return { ok: true, value: [] };
  }
  if (Array.isArray(value)) {
    if (!value.every((entry) => typeof entry === "string")) {
      return { ok: false, error: `${field} must be an array of strings` };
    }
    return { ok: true, value };
  }
  if (typeof value === "string") {
    return { ok: true, value: [value] };
  }
  return { ok: false, error: `${field} must be a string or array of strings` };
};

const parseMetadata = (value: unknown, field: string): JsonResult<Record<string, unknown>> => {
  if (value === undefined || value === null) {
    return { ok: true, value: {} };
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: `${field} must be an object` };
  }
  return { ok: true, value: value as Record<string, unknown> };
};

const extractEmailAddress = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return normalizeEmail(match ? match[1] : trimmed);
};

const parseAddressList = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) =>
      typeof entry === "string" ? entry.split(",") : [],
    );
  }
  if (typeof value === "string") {
    return value.split(",");
  }
  return [];
};

const serializeInbox = (inbox: typeof inboxes.$inferSelect) => ({
  id: inbox.id,
  address: inbox.address,
  display_name: inbox.displayName,
  metadata: inbox.metadata,
  created_at: inbox.createdAt,
});

const serializeMessage = (message: typeof messages.$inferSelect) => ({
  id: message.id,
  thread_id: message.threadId,
  inbox_email_address: message.inboxId,
  direction: message.direction,
  message_id_header: message.messageIdHeader,
  in_reply_to: message.inReplyTo,
  from: message.fromAddress,
  to: message.toAddresses,
  cc: message.ccAddresses,
  bcc: message.bccAddresses,
  subject: message.subject,
  body_text: message.bodyText,
  body_html: message.bodyHtml,
  headers: message.headers,
  status: message.status,
  created_at: message.createdAt,
});

const serializeThread = (
  thread: typeof threads.$inferSelect,
  threadMessages: Array<typeof messages.$inferSelect>,
) => ({
  id: thread.id,
  inbox_email_address: thread.inboxId,
  subject: thread.subject,
  root_message_id_header: thread.rootMessageIdHeader,
  last_message_at: thread.lastMessageAt,
  created_at: thread.createdAt,
  messages: threadMessages.map(serializeMessage),
});

app.get("/", (c) =>
  c.text("AgentMail API. See SPEC.md for available endpoints."),
);

app.get("/health", (c) =>
  c.json({
    status: "ok",
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
    uptime_seconds: Math.floor(process.uptime()),
  }),
);

app.use("/v1/*", authMiddleware);

app.get("/v1/me", async (c) => {
  const accountId = c.get("accountId");
  const account = await db.query.accounts.findFirst({
    where: eq(accounts.id, accountId),
  });
  if (!account) {
    return c.json({ error: "Account not found" }, 404);
  }
  return c.json({
    account: {
      id: account.id,
      name: account.name,
      created_at: account.createdAt,
    },
    api_key: {
      id: c.get("apiKeyId"),
      name: c.get("apiKeyName"),
      prefix: c.get("apiKeyPrefix"),
    },
  });
});

app.post("/v1/inboxes", async (c) => {
  const bodyResult = await readJson<{
    domain?: unknown;
    username?: unknown;
    display_name?: unknown;
    metadata?: unknown;
  }>(c);
  if (!bodyResult.ok) {
    return c.json({ error: bodyResult.error }, 400);
  }

  const { domain, username, display_name, metadata } = bodyResult.value;
  const domainError = requireString(domain, "domain");
  if (domainError) {
    return c.json({ error: domainError }, 400);
  }
  const usernameError = requireString(username, "username");
  if (usernameError) {
    return c.json({ error: usernameError }, 400);
  }
  if (
    display_name !== undefined &&
    display_name !== null &&
    typeof display_name !== "string"
  ) {
    return c.json({ error: "display_name must be a string" }, 400);
  }

  const metadataResult = parseMetadata(metadata, "metadata");
  if (!metadataResult.ok) {
    return c.json({ error: metadataResult.error }, 400);
  }

  const address = buildAddress(username as string, domain as string);
  const existing = await db.query.inboxes.findFirst({
    where: eq(inboxes.address, address),
  });
  if (existing) {
    return c.json({ error: "Inbox already exists" }, 409);
  }

  const [created] = await db
    .insert(inboxes)
    .values({
      id: address,
      accountId: c.get("accountId"),
      address,
      displayName: display_name ?? null,
      metadata: metadataResult.value,
    })
    .returning();

  await deliverEvent(c.get("accountId"), "inbox.created", serializeInbox(created));

  return c.json(serializeInbox(created), 201);
});

app.get("/v1/inboxes", async (c) => {
  const limit = parseLimit(c.req.query("limit"), { max: 100, fallback: 20 });
  const startingAfter = c.req.query("starting_after");
  const addressFilter = c.req.query("address");

  const conditions = [eq(inboxes.accountId, c.get("accountId"))];

  if (addressFilter) {
    conditions.push(eq(inboxes.address, normalizeEmail(addressFilter)));
  }

  if (startingAfter) {
    const cursor = await db.query.inboxes.findFirst({
      where: and(
        eq(inboxes.id, startingAfter),
        eq(inboxes.accountId, c.get("accountId")),
      ),
    });
    if (!cursor) {
      return c.json({ error: "Invalid cursor" }, 400);
    }
    conditions.push(sql`${inboxes.createdAt} < ${cursor.createdAt}`);
  }

  const rows = await db
    .select()
    .from(inboxes)
    .where(and(...conditions))
    .orderBy(desc(inboxes.createdAt))
    .limit(limit + 1);

  return c.json(finalizeList(rows.map(serializeInbox), limit));
});

app.get("/v1/inboxes/:id", async (c) => {
  const inbox = await db.query.inboxes.findFirst({
    where: and(
      eq(inboxes.id, c.req.param("id")),
      eq(inboxes.accountId, c.get("accountId")),
    ),
  });
  if (!inbox) {
    return c.json({ error: "Inbox not found" }, 404);
  }
  return c.json(serializeInbox(inbox));
});

app.patch("/v1/inboxes/:id", async (c) => {
  const bodyResult = await readJson<{
    display_name?: unknown;
    metadata?: unknown;
  }>(c);
  if (!bodyResult.ok) {
    return c.json({ error: bodyResult.error }, 400);
  }

  const updates: Partial<typeof inboxes.$inferInsert> = {};
  if (bodyResult.value.display_name !== undefined) {
    if (
      bodyResult.value.display_name !== null &&
      typeof bodyResult.value.display_name !== "string"
    ) {
      return c.json({ error: "display_name must be a string" }, 400);
    }
    updates.displayName = bodyResult.value.display_name ?? null;
  }
  if (bodyResult.value.metadata !== undefined) {
    const metadataResult = parseMetadata(bodyResult.value.metadata, "metadata");
    if (!metadataResult.ok) {
      return c.json({ error: metadataResult.error }, 400);
    }
    updates.metadata = metadataResult.value;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  const [updated] = await db
    .update(inboxes)
    .set(updates)
    .where(
      and(
        eq(inboxes.id, c.req.param("id")),
        eq(inboxes.accountId, c.get("accountId")),
      ),
    )
    .returning();

  if (!updated) {
    return c.json({ error: "Inbox not found" }, 404);
  }

  return c.json(serializeInbox(updated));
});

app.delete("/v1/inboxes/:id", async (c) => {
  const [deleted] = await db
    .delete(inboxes)
    .where(
      and(
        eq(inboxes.id, c.req.param("id")),
        eq(inboxes.accountId, c.get("accountId")),
      ),
    )
    .returning({ id: inboxes.id });

  if (!deleted) {
    return c.json({ error: "Inbox not found" }, 404);
  }

  return c.json({ deleted: true, id: deleted.id });
});

app.get("/v1/threads", async (c) => {
  const inboxAddress = c.req.query("inbox_email_address");
  if (!inboxAddress) {
    return c.json({ error: "inbox_email_address is required" }, 400);
  }

  const inbox = await db.query.inboxes.findFirst({
    where: and(
      eq(inboxes.address, normalizeEmail(inboxAddress)),
      eq(inboxes.accountId, c.get("accountId")),
    ),
  });
  if (!inbox) {
    return c.json({ error: "Inbox not found" }, 404);
  }

  const limit = parseLimit(c.req.query("limit"), { max: 100, fallback: 20 });
  const startingAfter = c.req.query("starting_after");
  const participant = c.req.query("participant");

  const conditions = [
    eq(threads.accountId, c.get("accountId")),
    eq(threads.inboxId, inbox.id),
  ];

  if (participant) {
    const normalized = normalizeEmail(participant);
    const participantRows = await db
      .select({ threadId: messages.threadId })
      .from(messages)
      .where(
        and(
          eq(messages.accountId, c.get("accountId")),
          eq(messages.inboxId, inbox.id),
          sql`${messages.fromAddress} = ${normalized} OR ${messages.toAddresses} @> ARRAY[${normalized}]::citext[]`,
        ),
      )
      .groupBy(messages.threadId);

    const participantThreadIds = participantRows.map((row) => row.threadId);
    if (participantThreadIds.length === 0) {
      return c.json({ object: "list", data: [], has_more: false, next_cursor: null });
    }
    conditions.push(inArray(threads.id, participantThreadIds));
  }

  if (startingAfter) {
    const cursor = await db.query.threads.findFirst({
      where: and(
        eq(threads.id, startingAfter),
        eq(threads.accountId, c.get("accountId")),
      ),
    });
    if (!cursor) {
      return c.json({ error: "Invalid cursor" }, 400);
    }
    const cursorTime = cursor.lastMessageAt ?? cursor.createdAt;
    conditions.push(sql`coalesce(${threads.lastMessageAt}, ${threads.createdAt}) < ${cursorTime}`);
  }

  const rows = await db
    .select()
    .from(threads)
    .where(and(...conditions))
    .orderBy(desc(sql`coalesce(${threads.lastMessageAt}, ${threads.createdAt})`))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const threadIds = pageRows.map((row) => row.id);

  let messageRows: Array<typeof messages.$inferSelect> = [];
  if (threadIds.length > 0) {
    messageRows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.accountId, c.get("accountId")),
          inArray(messages.threadId, threadIds),
        ),
      )
      .orderBy(asc(messages.createdAt));
  }

  const messagesByThread = new Map<string, Array<typeof messages.$inferSelect>>();
  for (const message of messageRows) {
    if (!messagesByThread.has(message.threadId)) {
      messagesByThread.set(message.threadId, []);
    }
    messagesByThread.get(message.threadId)?.push(message);
  }

  const threadObjects = pageRows.map((thread) =>
    serializeThread(thread, messagesByThread.get(thread.id) ?? []),
  );

  return c.json({
    object: "list",
    data: threadObjects,
    has_more: hasMore,
    next_cursor: hasMore ? threadObjects[threadObjects.length - 1]?.id ?? null : null,
  });
});

app.get("/v1/threads/:id", async (c) => {
  const thread = await db.query.threads.findFirst({
    where: and(
      eq(threads.id, c.req.param("id")),
      eq(threads.accountId, c.get("accountId")),
    ),
  });
  if (!thread) {
    return c.json({ error: "Thread not found" }, 404);
  }

  const messageRows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.threadId, thread.id),
        eq(messages.accountId, c.get("accountId")),
      ),
    )
    .orderBy(asc(messages.createdAt));

  return c.json(serializeThread(thread, messageRows));
});

app.post("/v1/threads/search", async (c) => {
  const bodyResult = await readJson<{
    query?: unknown;
    inbox_email_address?: unknown;
    limit?: unknown;
  }>(c);
  if (!bodyResult.ok) {
    return c.json({ error: bodyResult.error }, 400);
  }

  const queryError = requireString(bodyResult.value.query, "query");
  if (queryError) {
    return c.json({ error: queryError }, 400);
  }

  if (!embeddingsEnabled()) {
    return c.json(
      { error: "Semantic search requires embeddings to be enabled" },
      400,
    );
  }

  const limit = parseLimit(
    typeof bodyResult.value.limit === "number" ||
      typeof bodyResult.value.limit === "string"
      ? String(bodyResult.value.limit)
      : undefined,
    { min: 1, max: 50, fallback: 10 },
  );

  let inbox: typeof inboxes.$inferSelect | undefined;
  if (bodyResult.value.inbox_email_address) {
    if (typeof bodyResult.value.inbox_email_address !== "string") {
      return c.json({ error: "inbox_email_address must be a string" }, 400);
    }
    inbox = await db.query.inboxes.findFirst({
      where: and(
        eq(inboxes.address, normalizeEmail(bodyResult.value.inbox_email_address)),
        eq(inboxes.accountId, c.get("accountId")),
      ),
    });
    if (!inbox) {
      return c.json({ error: "Inbox not found" }, 404);
    }
  }

  const embedding = await createEmbedding(bodyResult.value.query as string);
  const vectorParam = `[${embedding.join(",")}]`;

  const result = await db.execute(sql`
    select ${messages.threadId} as "threadId",
           max(1 - (${messages.embedding} <=> ${vectorParam}::vector)) as similarity
    from ${messages}
    where ${messages.accountId} = ${c.get("accountId")}
      and ${messages.embedding} is not null
      ${inbox ? sql`and ${messages.inboxId} = ${inbox.id}` : sql``}
    group by ${messages.threadId}
    order by similarity desc
    limit ${limit}
  `);

  const rows = result.rows as Array<{ threadId: string; similarity: number }>;
  if (rows.length === 0) {
    return c.json({
      object: "list",
      data: [],
      has_more: false,
      next_cursor: null,
    });
  }

  const threadIds = rows.map((row) => row.threadId);
  const threadRows = await db
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.accountId, c.get("accountId")),
        inArray(threads.id, threadIds),
      ),
    );

  const messageRows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.accountId, c.get("accountId")),
        inArray(messages.threadId, threadIds),
      ),
    )
    .orderBy(asc(messages.createdAt));

  const messagesByThread = new Map<string, Array<typeof messages.$inferSelect>>();
  for (const message of messageRows) {
    if (!messagesByThread.has(message.threadId)) {
      messagesByThread.set(message.threadId, []);
    }
    messagesByThread.get(message.threadId)?.push(message);
  }

  const threadsById = new Map(
    threadRows.map((thread) => [thread.id, thread]),
  );
  const resultData = rows
    .map((row) => {
      const thread = threadsById.get(row.threadId);
      if (!thread) {
        return null;
      }
      return {
        ...serializeThread(thread, messagesByThread.get(thread.id) ?? []),
        similarity: row.similarity,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return c.json({
    object: "list",
    data: resultData,
    has_more: false,
    next_cursor: null,
  });
});

app.post("/v1/messages", async (c) => {
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
  if (!bodyResult.ok) {
    return c.json({ error: bodyResult.error }, 400);
  }

  const inboxError = requireString(
    bodyResult.value.inbox_email_address,
    "inbox_email_address",
  );
  if (inboxError) {
    return c.json({ error: inboxError }, 400);
  }

  const toResult = parseStringArray(bodyResult.value.to, "to", { required: true });
  if (!toResult.ok) {
    return c.json({ error: toResult.error }, 400);
  }
  const toAddresses = normalizeEmailList(toResult.value);
  if (toAddresses.length === 0) {
    return c.json({ error: "to must include at least one address" }, 400);
  }

  const ccResult = parseStringArray(bodyResult.value.cc, "cc");
  if (!ccResult.ok) {
    return c.json({ error: ccResult.error }, 400);
  }
  const ccAddresses = normalizeEmailList(ccResult.value);

  const bccResult = parseStringArray(bodyResult.value.bcc, "bcc");
  if (!bccResult.ok) {
    return c.json({ error: bccResult.error }, 400);
  }
  const bccAddresses = normalizeEmailList(bccResult.value);

  const subject =
    typeof bodyResult.value.subject === "string"
      ? bodyResult.value.subject
      : null;
  const text =
    typeof bodyResult.value.text === "string" ? bodyResult.value.text : null;
  const html =
    typeof bodyResult.value.html === "string" ? bodyResult.value.html : null;

  if (!text && !html) {
    return c.json({ error: "Either text or html body is required" }, 400);
  }

  const headersResult = parseMetadata(bodyResult.value.headers, "headers");
  if (!headersResult.ok) {
    return c.json({ error: headersResult.error }, 400);
  }

  const inbox = await db.query.inboxes.findFirst({
    where: and(
      eq(inboxes.address, normalizeEmail(bodyResult.value.inbox_email_address as string)),
      eq(inboxes.accountId, c.get("accountId")),
    ),
  });
  if (!inbox) {
    return c.json({ error: "Inbox not found" }, 404);
  }

  let thread = null as typeof threads.$inferSelect | null;
  const threadIdInput = bodyResult.value.in_reply_to_thread_id;
  if (threadIdInput !== undefined && threadIdInput !== null) {
    if (typeof threadIdInput !== "string") {
      return c.json({ error: "in_reply_to_thread_id must be a string" }, 400);
    }
    thread = (await db.query.threads.findFirst({
      where: and(
        eq(threads.id, threadIdInput),
        eq(threads.accountId, c.get("accountId")),
        eq(threads.inboxId, inbox.id),
      ),
    })) ?? null;
    if (!thread) {
      return c.json({ error: "Thread not found" }, 404);
    }
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
  if (threadCreated) {
    inReplyTo = null;
  } else {
    const lastMessage = await db.query.messages.findFirst({
      where: and(
        eq(messages.threadId, threadId),
        eq(messages.accountId, c.get("accountId")),
      ),
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

  await db
    .update(threads)
    .set({ lastMessageAt: new Date() })
    .where(eq(threads.id, threadId));

  await deliverEvent(c.get("accountId"), "message.sent", serializeMessage(createdMessage));

  return c.json(serializeMessage(createdMessage), 201);
});

app.get("/v1/messages", async (c) => {
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
    if (!inbox) {
      return c.json({ error: "Inbox not found" }, 404);
    }
    conditions.push(eq(messages.inboxId, inbox.id));
  }

  if (threadId) {
    conditions.push(eq(messages.threadId, threadId));
  }
  if (direction) {
    if (direction !== "inbound" && direction !== "outbound") {
      return c.json({ error: "direction must be inbound or outbound" }, 400);
    }
    conditions.push(eq(messages.direction, direction));
  }
  if (fromAddress) {
    conditions.push(eq(messages.fromAddress, normalizeEmail(fromAddress)));
  }
  if (toAddress) {
    const normalized = normalizeEmail(toAddress);
    conditions.push(sql`${messages.toAddresses} @> ARRAY[${normalized}]::citext[]`);
  }

  if (startingAfter) {
    const cursor = await db.query.messages.findFirst({
      where: and(
        eq(messages.id, startingAfter),
        eq(messages.accountId, c.get("accountId")),
      ),
    });
    if (!cursor) {
      return c.json({ error: "Invalid cursor" }, 400);
    }
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

app.get("/v1/messages/:id", async (c) => {
  const message = await db.query.messages.findFirst({
    where: and(
      eq(messages.id, c.req.param("id")),
      eq(messages.accountId, c.get("accountId")),
    ),
  });
  if (!message) {
    return c.json({ error: "Message not found" }, 404);
  }
  return c.json(serializeMessage(message));
});

app.get("/v1/messages/:id/raw", async (c) => {
  const message = await db.query.messages.findFirst({
    where: and(
      eq(messages.id, c.req.param("id")),
      eq(messages.accountId, c.get("accountId")),
    ),
  });
  if (!message || !message.raw) {
    return c.json({ error: "Raw message not found" }, 404);
  }
  return c.text(message.raw);
});

app.post("/v1/webhook_endpoints", async (c) => {
  const bodyResult = await readJson<{
    url?: unknown;
    description?: unknown;
    subscribed_events?: unknown;
  }>(c);
  if (!bodyResult.ok) {
    return c.json({ error: bodyResult.error }, 400);
  }

  const urlError = requireString(bodyResult.value.url, "url");
  if (urlError) {
    return c.json({ error: urlError }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(bodyResult.value.url as string);
  } catch {
    return c.json({ error: "url must be a valid URL" }, 400);
  }
  if (parsedUrl.protocol !== "https:") {
    return c.json({ error: "url must be https" }, 400);
  }

  if (
    bodyResult.value.description !== undefined &&
    bodyResult.value.description !== null &&
    typeof bodyResult.value.description !== "string"
  ) {
    return c.json({ error: "description must be a string" }, 400);
  }

  const subscribedResult = parseStringArray(
    bodyResult.value.subscribed_events,
    "subscribed_events",
  );
  if (!subscribedResult.ok) {
    return c.json({ error: subscribedResult.error }, 400);
  }

  const signingSecret = randomBytes(32).toString("hex");

  const [created] = await db
    .insert(webhookEndpoints)
    .values({
      accountId: c.get("accountId"),
      url: bodyResult.value.url as string,
      description: bodyResult.value.description ?? null,
      subscribedEvents: subscribedResult.value.length
        ? subscribedResult.value
        : null,
      signingSecret,
      isEnabled: true,
    })
    .returning();

  return c.json(
    {
      id: created.id,
      url: created.url,
      description: created.description,
      subscribed_events: created.subscribedEvents,
      is_enabled: created.isEnabled,
      created_at: created.createdAt,
      signing_secret: signingSecret,
    },
    201,
  );
});

app.get("/v1/webhook_endpoints", async (c) => {
  const rows = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.accountId, c.get("accountId")))
    .orderBy(desc(webhookEndpoints.createdAt));

  return c.json({
    object: "list",
    data: rows.map((endpoint) => ({
      id: endpoint.id,
      url: endpoint.url,
      description: endpoint.description,
      subscribed_events: endpoint.subscribedEvents,
      is_enabled: endpoint.isEnabled,
      created_at: endpoint.createdAt,
    })),
  });
});

app.get("/v1/webhook_endpoints/:id", async (c) => {
  const endpoint = await db.query.webhookEndpoints.findFirst({
    where: and(
      eq(webhookEndpoints.id, c.req.param("id")),
      eq(webhookEndpoints.accountId, c.get("accountId")),
    ),
  });
  if (!endpoint) {
    return c.json({ error: "Webhook endpoint not found" }, 404);
  }
  return c.json({
    id: endpoint.id,
    url: endpoint.url,
    description: endpoint.description,
    subscribed_events: endpoint.subscribedEvents,
    is_enabled: endpoint.isEnabled,
    created_at: endpoint.createdAt,
  });
});

app.patch("/v1/webhook_endpoints/:id", async (c) => {
  const bodyResult = await readJson<{
    url?: unknown;
    description?: unknown;
    subscribed_events?: unknown;
    is_enabled?: unknown;
  }>(c);
  if (!bodyResult.ok) {
    return c.json({ error: bodyResult.error }, 400);
  }

  const updates: Partial<typeof webhookEndpoints.$inferInsert> = {};

  if (bodyResult.value.url !== undefined) {
    if (typeof bodyResult.value.url !== "string") {
      return c.json({ error: "url must be a string" }, 400);
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(bodyResult.value.url);
    } catch {
      return c.json({ error: "url must be a valid URL" }, 400);
    }
    if (parsedUrl.protocol !== "https:") {
      return c.json({ error: "url must be https" }, 400);
    }
    updates.url = bodyResult.value.url;
  }

  if (bodyResult.value.description !== undefined) {
    if (
      bodyResult.value.description !== null &&
      typeof bodyResult.value.description !== "string"
    ) {
      return c.json({ error: "description must be a string" }, 400);
    }
    updates.description = bodyResult.value.description ?? null;
  }

  if (bodyResult.value.subscribed_events !== undefined) {
    const subscribedResult = parseStringArray(
      bodyResult.value.subscribed_events,
      "subscribed_events",
    );
    if (!subscribedResult.ok) {
      return c.json({ error: subscribedResult.error }, 400);
    }
    updates.subscribedEvents = subscribedResult.value.length
      ? subscribedResult.value
      : null;
  }

  if (bodyResult.value.is_enabled !== undefined) {
    if (typeof bodyResult.value.is_enabled !== "boolean") {
      return c.json({ error: "is_enabled must be a boolean" }, 400);
    }
    updates.isEnabled = bodyResult.value.is_enabled;
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  const [updated] = await db
    .update(webhookEndpoints)
    .set(updates)
    .where(
      and(
        eq(webhookEndpoints.id, c.req.param("id")),
        eq(webhookEndpoints.accountId, c.get("accountId")),
      ),
    )
    .returning();

  if (!updated) {
    return c.json({ error: "Webhook endpoint not found" }, 404);
  }

  return c.json({
    id: updated.id,
    url: updated.url,
    description: updated.description,
    subscribed_events: updated.subscribedEvents,
    is_enabled: updated.isEnabled,
    created_at: updated.createdAt,
  });
});

app.delete("/v1/webhook_endpoints/:id", async (c) => {
  const [deleted] = await db
    .delete(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, c.req.param("id")),
        eq(webhookEndpoints.accountId, c.get("accountId")),
      ),
    )
    .returning({ id: webhookEndpoints.id });

  if (!deleted) {
    return c.json({ error: "Webhook endpoint not found" }, 404);
  }

  return c.json({ deleted: true, id: deleted.id });
});

app.post("/v1/webhook_endpoints/:id/rotate_secret", async (c) => {
  const signingSecret = randomBytes(32).toString("hex");
  const [updated] = await db
    .update(webhookEndpoints)
    .set({ signingSecret })
    .where(
      and(
        eq(webhookEndpoints.id, c.req.param("id")),
        eq(webhookEndpoints.accountId, c.get("accountId")),
      ),
    )
    .returning({ id: webhookEndpoints.id });

  if (!updated) {
    return c.json({ error: "Webhook endpoint not found" }, 404);
  }

  return c.json({ id: updated.id, signing_secret: signingSecret });
});

app.post("/webhooks/inbound", async (c) => {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: "INBOUND_WEBHOOK_SECRET is not configured" }, 500);
  }

  const rawBody = await c.req.raw.text();
  const signature = c.req.header("x-agentmail-signature");
  if (!verifySignature(secret, rawBody, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

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

  const toCandidate =
    payload.to ?? payload.recipients ?? headers["To"] ?? headers["to"];
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

  if (!fromCandidate) {
    return c.json({ error: "Missing from address" }, 400);
  }

  const toList = parseAddressList(toCandidate)
    .map(extractEmailAddress)
    .filter((entry) => entry.length > 0);
  if (toList.length === 0) {
    return c.json({ error: "Missing to address" }, 400);
  }

  const inbox = await db.query.inboxes.findFirst({
    where: inArray(inboxes.address, toList),
  });
  if (!inbox) {
    return c.json({ error: "Inbox not found" }, 404);
  }

  const messageId = messageIdCandidate
    ? normalizeMessageId(messageIdCandidate)
    : normalizeMessageId(generateMessageId(extractDomain(inbox.address)));
  const existingMessage = await db.query.messages.findFirst({
    where: eq(messages.id, messageId),
  });
  if (existingMessage) {
    return c.json({ received: true });
  }

  const inReplyTo = inReplyToCandidate
    ? normalizeMessageId(inReplyToCandidate)
    : null;
  const references = splitReferences(referencesCandidate);

  let threadId: string;
  let threadCreated = false;
  let threadRecord: typeof threads.$inferSelect | null = null;

  let referencedMessage: typeof messages.$inferSelect | undefined;
  if (inReplyTo) {
    referencedMessage = await db.query.messages.findFirst({
      where: and(
        eq(messages.messageIdHeader, inReplyTo),
        eq(messages.accountId, inbox.accountId),
      ),
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
    threadRecord =
      (await db.query.threads.findFirst({
        where: eq(threads.id, threadId),
      })) ?? null;
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
      ccAddresses: parseAddressList(ccCandidate)
        .map(extractEmailAddress)
        .filter((entry) => entry.length > 0),
      bccAddresses: parseAddressList(bccCandidate)
        .map(extractEmailAddress)
        .filter((entry) => entry.length > 0),
      subject,
      bodyText: text,
      bodyHtml: html,
      headers: headers as Record<string, unknown>,
      raw: rawMessage,
      embedding: embedding ?? undefined,
    })
    .returning();

  await db
    .update(threads)
    .set({ lastMessageAt: new Date() })
    .where(eq(threads.id, threadId));

  if (threadCreated && threadRecord) {
    await deliverEvent(
      inbox.accountId,
      "thread.created",
      serializeThread(threadRecord, [createdMessage]),
    );
  }

  await deliverEvent(
    inbox.accountId,
    "message.received",
    serializeMessage(createdMessage),
  );

  return c.json({ received: true });
});

app.post("/webhooks/outbound-status", async (c) => {
  const secret = process.env.OUTBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return c.json({ error: "OUTBOUND_WEBHOOK_SECRET is not configured" }, 500);
  }

  const rawBody = await c.req.raw.text();
  const signature = c.req.header("x-agentmail-signature");
  if (!verifySignature(secret, rawBody, signature)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

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
  if (!messageId) {
    return c.json({ error: "Missing message_id" }, 400);
  }

  const status =
    (payload.status as string | undefined) ??
    (payload.event as string | undefined);

  let normalizedStatus: "delivered" | "bounced" | null = null;
  if (status === "delivered" || status === "message.delivered") {
    normalizedStatus = "delivered";
  }
  if (status === "bounced" || status === "message.bounced") {
    normalizedStatus = "bounced";
  }
  if (!normalizedStatus) {
    return c.json({ error: "Unsupported status" }, 400);
  }

  const [updated] = await db
    .update(messages)
    .set({ status: normalizedStatus })
    .where(eq(messages.id, normalizeMessageId(messageId)))
    .returning();

  if (!updated) {
    return c.json({ error: "Message not found" }, 404);
  }

  await deliverEvent(
    updated.accountId,
    normalizedStatus === "delivered" ? "message.delivered" : "message.bounced",
    serializeMessage(updated),
  );

  return c.json({ received: true });
});

export default app;
