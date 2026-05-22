import { Hono } from "hono";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { inboxes, messages, threads } from "../db/schema.js";
import type { AuthVariables } from "../lib/auth.js";
import { normalizeEmail } from "../lib/email.js";
import { createEmbedding, embeddingsEnabled } from "../lib/embeddings.js";
import { parseLimit } from "../lib/pagination.js";
import { readJson, requireString } from "../lib/parsers.js";
import { serializeThread } from "../lib/serializers.js";

const router = new Hono<{ Variables: AuthVariables }>();

router.get("/", async (c) => {
  const inboxAddress = c.req.query("inbox_email_address");
  if (!inboxAddress)
    return c.json({ error: "inbox_email_address is required" }, 400);

  const inbox = await db.query.inboxes.findFirst({
    where: and(
      eq(inboxes.address, normalizeEmail(inboxAddress)),
      eq(inboxes.accountId, c.get("accountId")),
    ),
  });
  if (!inbox) return c.json({ error: "Inbox not found" }, 404);

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
      return c.json({
        object: "list",
        threads: [],
        has_more: false,
        next_cursor: null,
      });
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
    if (!cursor) return c.json({ error: "Invalid cursor" }, 400);
    const cursorTime = cursor.lastMessageAt ?? cursor.createdAt;
    conditions.push(
      sql`coalesce(${threads.lastMessageAt}, ${threads.createdAt}) < ${cursorTime}`,
    );
  }

  const rows = await db
    .select()
    .from(threads)
    .where(and(...conditions))
    .orderBy(
      desc(sql`coalesce(${threads.lastMessageAt}, ${threads.createdAt})`),
    )
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

  const messagesByThread = new Map<
    string,
    Array<typeof messages.$inferSelect>
  >();
  for (const message of messageRows) {
    if (!messagesByThread.has(message.threadId))
      messagesByThread.set(message.threadId, []);
    messagesByThread.get(message.threadId)?.push(message);
  }

  const threadObjects = pageRows.map((thread) =>
    serializeThread(thread, messagesByThread.get(thread.id) ?? []),
  );

  return c.json({
    object: "list",
    threads: threadObjects,
    has_more: hasMore,
    next_cursor: hasMore
      ? (threadObjects[threadObjects.length - 1]?.id ?? null)
      : null,
  });
});

router.get("/:id", async (c) => {
  const thread = await db.query.threads.findFirst({
    where: and(
      eq(threads.id, c.req.param("id")),
      eq(threads.accountId, c.get("accountId")),
    ),
  });
  if (!thread) return c.json({ error: "Thread not found" }, 404);

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

router.post("/search", async (c) => {
  const bodyResult = await readJson<{
    query?: unknown;
    inbox_email_address?: unknown;
    limit?: unknown;
  }>(c);
  if (!bodyResult.ok) return c.json({ error: bodyResult.error }, 400);

  const queryError = requireString(bodyResult.value.query, "query");
  if (queryError) return c.json({ error: queryError }, 400);

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
        eq(
          inboxes.address,
          normalizeEmail(bodyResult.value.inbox_email_address),
        ),
        eq(inboxes.accountId, c.get("accountId")),
      ),
    });
    if (!inbox) return c.json({ error: "Inbox not found" }, 404);
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
      threads: [],
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

  const messagesByThread = new Map<
    string,
    Array<typeof messages.$inferSelect>
  >();
  for (const message of messageRows) {
    if (!messagesByThread.has(message.threadId))
      messagesByThread.set(message.threadId, []);
    messagesByThread.get(message.threadId)?.push(message);
  }

  const threadsById = new Map(threadRows.map((thread) => [thread.id, thread]));
  const resultData = rows
    .map((row) => {
      const thread = threadsById.get(row.threadId);
      if (!thread) return null;
      return {
        ...serializeThread(thread, messagesByThread.get(thread.id) ?? []),
        similarity: row.similarity,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return c.json({
    object: "list",
    threads: resultData,
    has_more: false,
    next_cursor: null,
  });
});

export default router;
