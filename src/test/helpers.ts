import { Hono } from "hono";
import type { AuthVariables } from "../lib/auth.js";

export const ACCOUNT_ID = "account-123";
export const NOW = new Date("2024-01-01T00:00:00.000Z");

export const mockInbox = {
  id: "alice@test.com",
  accountId: ACCOUNT_ID,
  address: "alice@test.com",
  displayName: "Alice Agent",
  metadata: {},
  createdAt: NOW,
};

export const mockThread = {
  id: "thread_abc123",
  inboxId: "alice@test.com",
  accountId: ACCOUNT_ID,
  subject: "Hello",
  rootMessageIdHeader: "<abc@test.com>",
  lastMessageAt: NOW,
  createdAt: NOW,
};

export const mockMessage = {
  id: "<abc@test.com>",
  threadId: "thread_abc123",
  inboxId: "alice@test.com",
  accountId: ACCOUNT_ID,
  direction: "outbound" as const,
  messageIdHeader: "<abc@test.com>",
  inReplyTo: null,
  fromAddress: "alice@test.com",
  toAddresses: ["bob@external.com"],
  ccAddresses: [],
  bccAddresses: [],
  subject: "Hello",
  bodyText: "Hello world",
  bodyHtml: null,
  headers: {},
  raw: null,
  status: "sent",
  embedding: null,
  createdAt: NOW,
};

export const mockAccount = {
  id: ACCOUNT_ID,
  name: "Test Account",
  createdAt: NOW,
};

export const mockWebhookEndpoint = {
  id: "endpoint-uuid-123",
  accountId: ACCOUNT_ID,
  url: "https://example.com/webhook",
  description: "Test webhook",
  subscribedEvents: ["message.received"],
  signingSecret: "secret123",
  isEnabled: true,
  createdAt: NOW,
};

export function makeTestApp(router: Hono<{ Variables: AuthVariables }>) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use("*", async (c, next) => {
    c.set("accountId", ACCOUNT_ID);
    c.set("apiKeyId", "key-id");
    c.set("apiKeyName", "Test Key");
    c.set("apiKeyPrefix", "sk_test_");
    await next();
  });
  app.route("/", router);
  return app;
}

export function json(body: unknown, method = "POST") {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
