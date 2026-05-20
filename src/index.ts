import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { accounts } from "./db/schema.js";
import { authMiddleware, type AuthVariables } from "./lib/auth.js";
import inboxesRouter from "./routes/inboxes.js";
import threadsRouter from "./routes/threads.js";
import messagesRouter from "./routes/messages.js";
import webhookEndpointsRouter from "./routes/webhookEndpoints.js";
import internalWebhooksRouter from "./routes/internalWebhooks.js";

const app = new Hono<{ Variables: AuthVariables }>();

app.get("/", (c) => c.text("AgentMail API. See SPEC.md for available endpoints."));

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
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  if (!account) return c.json({ error: "Account not found" }, 404);
  return c.json({
    account: { id: account.id, name: account.name, created_at: account.createdAt },
    api_key: {
      id: c.get("apiKeyId"),
      name: c.get("apiKeyName"),
      prefix: c.get("apiKeyPrefix"),
    },
  });
});

app.route("/v1/inboxes", inboxesRouter);
app.route("/v1/threads", threadsRouter);
app.route("/v1/messages", messagesRouter);
app.route("/v1/webhook_endpoints", webhookEndpointsRouter);
app.route("/webhooks", internalWebhooksRouter);

export default app;
