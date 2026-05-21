import { vi, describe, it, expect, beforeEach } from "vitest";
import { makeTestApp, mockInbox, mockThread, mockMessage, json } from "./helpers.js";

const { mockDb, chain } = vi.hoisted(() => {
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
  return { mockDb, chain };
});

vi.mock("../db/client.js", () => ({ db: mockDb }));
vi.mock("../lib/webhooks.js", () => ({ deliverEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/smtp.js", () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../lib/embeddings.js", () => ({
  embeddingsEnabled: vi.fn().mockReturnValue(false),
  createEmbedding: vi.fn(),
}));

import messagesRouter from "../routes/messages.js";

const app = makeTestApp(messagesRouter as any);

beforeEach(() => {
  vi.clearAllMocks();
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

describe("POST /", () => {
  it("sends a message and creates a new thread", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    chain.returning
      .mockResolvedValueOnce([mockThread])
      .mockResolvedValueOnce([mockMessage]);

    const res = await app.request(
      "/",
      json({
        inbox_email_address: "alice@test.com",
        to: "bob@external.com",
        subject: "Hello",
        text: "Hello world",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.direction).toBe("outbound");
    expect(body.thread_id).toBe("thread_abc123");
  });

  it("sends a reply into an existing thread", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    mockDb.query.threads.findFirst.mockResolvedValue(mockThread);
    mockDb.query.messages.findFirst.mockResolvedValue(mockMessage);
    chain.returning.mockResolvedValueOnce([mockMessage]);

    const res = await app.request(
      "/",
      json({
        inbox_email_address: "alice@test.com",
        to: "bob@external.com",
        text: "Reply",
        in_reply_to_thread_id: "thread_abc123",
      }),
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 when inbox_email_address is missing", async () => {
    const res = await app.request("/", json({ to: "bob@external.com", text: "Hi" }));
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/inbox_email_address/);
  });

  it("returns 400 when to is missing", async () => {
    const res = await app.request(
      "/",
      json({ inbox_email_address: "alice@test.com", text: "Hi" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when neither text nor html is provided", async () => {
    const res = await app.request(
      "/",
      json({ inbox_email_address: "alice@test.com", to: "bob@test.com", subject: "Hi" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/body/);
  });

  it("returns 404 when inbox not found", async () => {
    const res = await app.request(
      "/",
      json({ inbox_email_address: "ghost@test.com", to: "bob@test.com", text: "Hi" }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when reply thread not found", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);

    const res = await app.request(
      "/",
      json({
        inbox_email_address: "alice@test.com",
        to: "bob@test.com",
        text: "Reply",
        in_reply_to_thread_id: "thread_missing",
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /", () => {
  it("returns a list of messages", async () => {
    chain.limit.mockResolvedValueOnce([mockMessage]);

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.object).toBe("list");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("<abc@test.com>");
  });

  it("filters by inbox_email_address", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    chain.limit.mockResolvedValueOnce([mockMessage]);

    const res = await app.request("/?inbox_email_address=alice@test.com");
    expect(res.status).toBe(200);
  });

  it("returns 404 when inbox filter does not match", async () => {
    const res = await app.request("/?inbox_email_address=ghost@test.com");
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid direction filter", async () => {
    const res = await app.request("/?direction=sideways");
    expect(res.status).toBe(400);
  });
});

describe("GET /:id", () => {
  it("returns a message", async () => {
    mockDb.query.messages.findFirst.mockResolvedValue(mockMessage);

    const res = await app.request("/%3Cabc%40test.com%3E");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.direction).toBe("outbound");
  });

  it("returns 404 when not found", async () => {
    const res = await app.request("/unknown-id");
    expect(res.status).toBe(404);
  });
});

describe("GET /:id/raw", () => {
  it("returns raw message source", async () => {
    mockDb.query.messages.findFirst.mockResolvedValue({
      ...mockMessage,
      raw: "From: alice@test.com\r\nSubject: Hello\r\n\r\nHello world",
    });

    const res = await app.request("/%3Cabc%40test.com%3E/raw");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("From: alice@test.com");
  });

  it("returns 404 when raw is not stored", async () => {
    mockDb.query.messages.findFirst.mockResolvedValue({ ...mockMessage, raw: null });

    const res = await app.request("/%3Cabc%40test.com%3E/raw");
    expect(res.status).toBe(404);
  });
});
