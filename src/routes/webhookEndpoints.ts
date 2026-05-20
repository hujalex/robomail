import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { webhookEndpoints } from "../db/schema.js";
import type { AuthVariables } from "../lib/auth.js";
import { readJson, requireString, parseStringArray } from "../lib/parsers.js";

const router = new Hono<{ Variables: AuthVariables }>();

const serializeEndpoint = (endpoint: typeof webhookEndpoints.$inferSelect) => ({
  id: endpoint.id,
  url: endpoint.url,
  description: endpoint.description,
  subscribed_events: endpoint.subscribedEvents,
  is_enabled: endpoint.isEnabled,
  created_at: endpoint.createdAt,
});

router.post("/", async (c) => {
  const bodyResult = await readJson<{
    url?: unknown;
    description?: unknown;
    subscribed_events?: unknown;
  }>(c);
  if (!bodyResult.ok) return c.json({ error: bodyResult.error }, 400);

  const urlError = requireString(bodyResult.value.url, "url");
  if (urlError) return c.json({ error: urlError }, 400);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(bodyResult.value.url as string);
  } catch {
    return c.json({ error: "url must be a valid URL" }, 400);
  }
  if (parsedUrl.protocol !== "https:") return c.json({ error: "url must be https" }, 400);

  if (
    bodyResult.value.description !== undefined &&
    bodyResult.value.description !== null &&
    typeof bodyResult.value.description !== "string"
  ) {
    return c.json({ error: "description must be a string" }, 400);
  }

  const subscribedResult = parseStringArray(bodyResult.value.subscribed_events, "subscribed_events");
  if (!subscribedResult.ok) return c.json({ error: subscribedResult.error }, 400);

  const signingSecret = randomBytes(32).toString("hex");
  const [created] = await db
    .insert(webhookEndpoints)
    .values({
      accountId: c.get("accountId"),
      url: bodyResult.value.url as string,
      description: bodyResult.value.description ?? null,
      subscribedEvents: subscribedResult.value.length ? subscribedResult.value : null,
      signingSecret,
      isEnabled: true,
    })
    .returning();

  return c.json({ ...serializeEndpoint(created), signing_secret: signingSecret }, 201);
});

router.get("/", async (c) => {
  const rows = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.accountId, c.get("accountId")))
    .orderBy(desc(webhookEndpoints.createdAt));

  return c.json({ object: "list", data: rows.map(serializeEndpoint) });
});

router.get("/:id", async (c) => {
  const endpoint = await db.query.webhookEndpoints.findFirst({
    where: and(
      eq(webhookEndpoints.id, c.req.param("id")),
      eq(webhookEndpoints.accountId, c.get("accountId")),
    ),
  });
  if (!endpoint) return c.json({ error: "Webhook endpoint not found" }, 404);
  return c.json(serializeEndpoint(endpoint));
});

router.patch("/:id", async (c) => {
  const bodyResult = await readJson<{
    url?: unknown;
    description?: unknown;
    subscribed_events?: unknown;
    is_enabled?: unknown;
  }>(c);
  if (!bodyResult.ok) return c.json({ error: bodyResult.error }, 400);

  const updates: Partial<typeof webhookEndpoints.$inferInsert> = {};

  if (bodyResult.value.url !== undefined) {
    if (typeof bodyResult.value.url !== "string") return c.json({ error: "url must be a string" }, 400);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(bodyResult.value.url);
    } catch {
      return c.json({ error: "url must be a valid URL" }, 400);
    }
    if (parsedUrl.protocol !== "https:") return c.json({ error: "url must be https" }, 400);
    updates.url = bodyResult.value.url;
  }

  if (bodyResult.value.description !== undefined) {
    if (bodyResult.value.description !== null && typeof bodyResult.value.description !== "string") {
      return c.json({ error: "description must be a string" }, 400);
    }
    updates.description = bodyResult.value.description ?? null;
  }

  if (bodyResult.value.subscribed_events !== undefined) {
    const subscribedResult = parseStringArray(bodyResult.value.subscribed_events, "subscribed_events");
    if (!subscribedResult.ok) return c.json({ error: subscribedResult.error }, 400);
    updates.subscribedEvents = subscribedResult.value.length ? subscribedResult.value : null;
  }

  if (bodyResult.value.is_enabled !== undefined) {
    if (typeof bodyResult.value.is_enabled !== "boolean") {
      return c.json({ error: "is_enabled must be a boolean" }, 400);
    }
    updates.isEnabled = bodyResult.value.is_enabled;
  }

  if (Object.keys(updates).length === 0) return c.json({ error: "No valid fields to update" }, 400);

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

  if (!updated) return c.json({ error: "Webhook endpoint not found" }, 404);
  return c.json(serializeEndpoint(updated));
});

router.delete("/:id", async (c) => {
  const [deleted] = await db
    .delete(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, c.req.param("id")),
        eq(webhookEndpoints.accountId, c.get("accountId")),
      ),
    )
    .returning({ id: webhookEndpoints.id });

  if (!deleted) return c.json({ error: "Webhook endpoint not found" }, 404);
  return c.json({ deleted: true, id: deleted.id });
});

router.post("/:id/rotate_secret", async (c) => {
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

  if (!updated) return c.json({ error: "Webhook endpoint not found" }, 404);
  return c.json({ id: updated.id, signing_secret: signingSecret });
});

export default router;
