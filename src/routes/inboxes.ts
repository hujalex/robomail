import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { inboxes } from "../db/schema.js";
import type { AuthVariables } from "../lib/auth.js";
import { normalizeEmail } from "../lib/email.js";
import { finalizeList, parseLimit } from "../lib/pagination.js";
import { readJson, requireString, parseMetadata } from "../lib/parsers.js";
import { serializeInbox } from "../lib/serializers.js";
import { deliverEvent } from "../lib/webhooks.js";

const router = new Hono<{ Variables: AuthVariables }>();

router.post("/", async (c) => {
  const bodyResult = await readJson<{
    domain?: unknown;
    username?: unknown;
    display_name?: unknown;
    metadata?: unknown;
  }>(c);
  if (!bodyResult.ok) return c.json({ error: bodyResult.error }, 400);

  const { domain, username, display_name, metadata } = bodyResult.value;
  const resolvedDomain = (typeof domain === "string" && domain) ? domain : process.env.DEFAULT_DOMAIN;
  if (!resolvedDomain) return c.json({ error: "domain is required when DEFAULT_DOMAIN is not configured" }, 400);
  const usernameError = requireString(username, "username");
  if (usernameError) return c.json({ error: usernameError }, 400);
  if (display_name !== undefined && display_name !== null && typeof display_name !== "string") {
    return c.json({ error: "display_name must be a string" }, 400);
  }

  const metadataResult = parseMetadata(metadata, "metadata");
  if (!metadataResult.ok) return c.json({ error: metadataResult.error }, 400);

  const address = `${normalizeEmail(username as string)}@${normalizeEmail(resolvedDomain)}`;
  const existing = await db.query.inboxes.findFirst({ where: eq(inboxes.address, address) });
  if (existing) return c.json({ error: "Inbox already exists" }, 409);

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

router.get("/", async (c) => {
  const limit = parseLimit(c.req.query("limit"), { max: 100, fallback: 20 });
  const startingAfter = c.req.query("starting_after");
  const addressFilter = c.req.query("address");

  const conditions = [eq(inboxes.accountId, c.get("accountId"))];
  if (addressFilter) conditions.push(eq(inboxes.address, normalizeEmail(addressFilter)));

  if (startingAfter) {
    const cursor = await db.query.inboxes.findFirst({
      where: and(eq(inboxes.id, startingAfter), eq(inboxes.accountId, c.get("accountId"))),
    });
    if (!cursor) return c.json({ error: "Invalid cursor" }, 400);
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

router.get("/:id", async (c) => {
  const inbox = await db.query.inboxes.findFirst({
    where: and(eq(inboxes.id, c.req.param("id")), eq(inboxes.accountId, c.get("accountId"))),
  });
  if (!inbox) return c.json({ error: "Inbox not found" }, 404);
  return c.json(serializeInbox(inbox));
});

router.patch("/:id", async (c) => {
  const bodyResult = await readJson<{ display_name?: unknown; metadata?: unknown }>(c);
  if (!bodyResult.ok) return c.json({ error: bodyResult.error }, 400);

  const updates: Partial<typeof inboxes.$inferInsert> = {};
  if (bodyResult.value.display_name !== undefined) {
    if (bodyResult.value.display_name !== null && typeof bodyResult.value.display_name !== "string") {
      return c.json({ error: "display_name must be a string" }, 400);
    }
    updates.displayName = bodyResult.value.display_name ?? null;
  }
  if (bodyResult.value.metadata !== undefined) {
    const metadataResult = parseMetadata(bodyResult.value.metadata, "metadata");
    if (!metadataResult.ok) return c.json({ error: metadataResult.error }, 400);
    updates.metadata = metadataResult.value;
  }

  if (Object.keys(updates).length === 0) return c.json({ error: "No valid fields to update" }, 400);

  const [updated] = await db
    .update(inboxes)
    .set(updates)
    .where(and(eq(inboxes.id, c.req.param("id")), eq(inboxes.accountId, c.get("accountId"))))
    .returning();

  if (!updated) return c.json({ error: "Inbox not found" }, 404);
  return c.json(serializeInbox(updated));
});

router.delete("/:id", async (c) => {
  const [deleted] = await db
    .delete(inboxes)
    .where(and(eq(inboxes.id, c.req.param("id")), eq(inboxes.accountId, c.get("accountId"))))
    .returning({ id: inboxes.id });

  if (!deleted) return c.json({ error: "Inbox not found" }, 404);
  return c.json({ deleted: true, id: deleted.id });
});

export default router;
