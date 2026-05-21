import { vi, describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { ACCOUNT_ID, mockInbox, mockThread, mockMessage } from "./helpers.js";

const { mockDb, chain, mockDeliverEvent } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["from", "where", "set", "values", "orderBy", "groupBy"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.returning = vi.fn().mockResolvedValue([]);

  const mockDb = {
    query: {
      inboxes: { findFirst: vi.fn().mockResolvedValue(null) },
      threads: { findFirst: vi.fn().mockResolvedValue(null) },
      messages: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
  };

  return { mockDb, chain, mockDeliverEvent: vi.fn().mockResolvedValue(undefined) };
});

vi.mock("../db/client.js", () => ({ db: mockDb }));
vi.mock("../lib/webhooks.js", () => ({ deliverEvent: mockDeliverEvent }));
vi.mock("../lib/embeddings.js", () => ({
  embeddingsEnabled: vi.fn().mockReturnValue(false),
  createEmbedding: vi.fn(),
}));
// Bypass SVIX signature verification in tests
vi.mock("svix", () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockReturnValue(true),
  })),
}));

import internalWebhooksRouter from "../routes/internalWebhooks.js";

const app = new Hono();
app.route("/", internalWebhooksRouter);

function inboundRequest(data: Record<string, unknown> = {}, withSecret = true) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(withSecret ? {
        "svix-id": "msg_test",
        "svix-timestamp": "1234567890",
        "svix-signature": "v1,test",
      } : {}),
    },
    body: JSON.stringify({
      type: "email.received",
      data: {
        from: "bob@external.com",
        to: ["alice@test.com"],
        subject: "Hello",
        text: "Hello world",
        headers: [{ name: "Message-Id", value: "<new-msg@external.com>" }],
        ...data,
      },
    }),
  };
}

function outboundStatusRequest(eventType: string, data: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": "msg_test",
      "svix-timestamp": "1234567890",
      "svix-signature": "v1,test",
    },
    body: JSON.stringify({ type: eventType, data }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
  mockDeliverEvent.mockResolvedValue(undefined);
  mockDb.query.inboxes.findFirst.mockResolvedValue(null);
  mockDb.query.threads.findFirst.mockResolvedValue(null);
  mockDb.query.messages.findFirst.mockResolvedValue(null);
  for (const m of ["from", "where", "set", "values", "orderBy", "groupBy"]) {
    chain[m].mockReturnValue(chain);
  }
  chain.limit.mockResolvedValue([]);
  chain.returning.mockResolvedValue([]);
  mockDb.select.mockReturnValue(chain);
  mockDb.insert.mockReturnValue(chain);
  mockDb.update.mockReturnValue(chain);
});

describe("POST /inbound", () => {
  it("returns 500 when RESEND_WEBHOOK_SECRET is not set", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await app.request("/inbound", inboundRequest());
    expect(res.status).toBe(500);
  });

  it("returns 400 when from address is missing", async () => {
    const res = await app.request("/inbound", inboundRequest({ from: undefined }));
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/from/);
  });

  it("returns 400 when to address is missing", async () => {
    const res = await app.request("/inbound", inboundRequest({ to: undefined }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when no matching inbox", async () => {
    const res = await app.request("/inbound", inboundRequest());
    expect(res.status).toBe(404);
  });

  it("creates a new thread and message for a fresh inbound email", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    chain.returning
      .mockResolvedValueOnce([mockThread])
      .mockResolvedValueOnce([mockMessage]);

    const res = await app.request("/inbound", inboundRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.received).toBe(true);
    expect(mockDeliverEvent).toHaveBeenCalledWith(ACCOUNT_ID, "thread.created", expect.objectContaining({ id: "thread_abc123" }));
    expect(mockDeliverEvent).toHaveBeenCalledWith(ACCOUNT_ID, "message.received", expect.objectContaining({ id: "<abc@test.com>" }));
  });

  it("appends to an existing thread when In-Reply-To matches", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    mockDb.query.messages.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockMessage);
    mockDb.query.threads.findFirst.mockResolvedValue(mockThread);
    chain.returning.mockResolvedValueOnce([{ ...mockMessage, id: "<reply@external.com>" }]);

    const res = await app.request("/inbound", inboundRequest({
      headers: [
        { name: "Message-Id", value: "<reply@external.com>" },
        { name: "In-Reply-To", value: "<abc@test.com>" },
      ],
    }));
    expect(res.status).toBe(200);
    const threadCreatedCalls = mockDeliverEvent.mock.calls.filter(([, e]: [unknown, string]) => e === "thread.created");
    expect(threadCreatedCalls).toHaveLength(0);
  });

  it("deduplicates already-processed message IDs", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    mockDb.query.messages.findFirst.mockResolvedValue(mockMessage);

    const res = await app.request("/inbound", inboundRequest({
      headers: [{ name: "Message-Id", value: "<abc@test.com>" }],
    }));
    expect(res.status).toBe(200);
    expect(mockDeliverEvent).not.toHaveBeenCalled();
  });
});

describe("POST /outbound-status", () => {
  it("returns 500 when RESEND_WEBHOOK_SECRET is not set", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const res = await app.request("/outbound-status", outboundStatusRequest("email.delivered", { message_id: "x" }));
    expect(res.status).toBe(500);
  });

  it("marks message as delivered and fires event", async () => {
    chain.returning.mockResolvedValueOnce([mockMessage]);
    const res = await app.request("/outbound-status", outboundStatusRequest("email.delivered", { message_id: "<abc@test.com>" }));
    expect(res.status).toBe(200);
    expect(mockDeliverEvent).toHaveBeenCalledWith(ACCOUNT_ID, "message.delivered", expect.any(Object));
  });

  it("marks message as bounced and fires event", async () => {
    chain.returning.mockResolvedValueOnce([{ ...mockMessage, status: "bounced" }]);
    const res = await app.request("/outbound-status", outboundStatusRequest("email.bounced", { message_id: "<abc@test.com>" }));
    expect(res.status).toBe(200);
    expect(mockDeliverEvent).toHaveBeenCalledWith(ACCOUNT_ID, "message.bounced", expect.any(Object));
  });

  it("returns 400 for unsupported event type", async () => {
    const res = await app.request("/outbound-status", outboundStatusRequest("email.clicked", { message_id: "<abc@test.com>" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when message_id is missing", async () => {
    const res = await app.request("/outbound-status", outboundStatusRequest("email.delivered", {}));
    expect(res.status).toBe(400);
  });

  it("returns 404 when message not found", async () => {
    chain.returning.mockResolvedValueOnce([]);
    const res = await app.request("/outbound-status", outboundStatusRequest("email.delivered", { message_id: "<missing@test.com>" }));
    expect(res.status).toBe(404);
  });
});
