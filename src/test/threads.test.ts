import { vi, describe, it, expect, beforeEach } from "vitest";
import { makeTestApp, mockInbox, mockThread, mockMessage, json } from "./helpers.js";

// makeChain returns a thenable chain so queries that end at .orderBy() or .where()
// (rather than .limit()) still resolve correctly when awaited.
const { mockDb, makeChain } = vi.hoisted(() => {
  function makeChain(terminalValue: unknown[] = []) {
    const c: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const m of ["from", "where", "set", "values", "orderBy", "groupBy"]) {
      c[m] = vi.fn().mockImplementation(() => c);
    }
    c.limit = vi.fn().mockResolvedValue(terminalValue);
    c.returning = vi.fn().mockResolvedValue(terminalValue);
    // Make the chain itself awaitable so terminal .orderBy() / .where() calls work
    (c as any).then = (resolve: (v: unknown) => unknown) => Promise.resolve(terminalValue).then(resolve);
    return c;
  }

  const mockDb = {
    query: {
      inboxes: { findFirst: vi.fn().mockResolvedValue(null) },
      threads: { findFirst: vi.fn().mockResolvedValue(null) },
      messages: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    select: vi.fn().mockReturnValue(makeChain()),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  };

  return { mockDb, makeChain };
});

vi.mock("../db/client.js", () => ({ db: mockDb }));
vi.mock("../lib/embeddings.js", () => ({
  embeddingsEnabled: vi.fn().mockReturnValue(true),
  createEmbedding: vi.fn().mockResolvedValue(new Array(384).fill(0)),
}));

import threadsRouter from "../routes/threads.js";

const app = makeTestApp(threadsRouter as any);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.query.inboxes.findFirst.mockResolvedValue(null);
  mockDb.query.threads.findFirst.mockResolvedValue(null);
  mockDb.select.mockReturnValue(makeChain());
  mockDb.execute.mockResolvedValue({ rows: [] });
});

describe("GET /", () => {
  it("returns 400 when inbox_email_address is missing", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/inbox_email_address/);
  });

  it("returns 404 when inbox not found", async () => {
    const res = await app.request("/?inbox_email_address=ghost@test.com");
    expect(res.status).toBe(404);
  });

  it("returns list of threads with nested messages", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    mockDb.select
      .mockReturnValueOnce(makeChain([mockThread]))    // threads query (ends at .limit)
      .mockReturnValueOnce(makeChain([mockMessage]));  // messages query (ends at .orderBy)

    const res = await app.request("/?inbox_email_address=alice@test.com");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.object).toBe("list");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("thread_abc123");
    expect(body.data[0].messages).toHaveLength(1);
  });

  it("returns empty list when inbox has no threads", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    mockDb.select.mockReturnValueOnce(makeChain([]));

    const res = await app.request("/?inbox_email_address=alice@test.com");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(0);
    expect(body.has_more).toBe(false);
  });

  it("returns 400 for invalid cursor", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);
    mockDb.query.threads.findFirst.mockResolvedValue(null);

    const res = await app.request(
      "/?inbox_email_address=alice@test.com&starting_after=bad-cursor",
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /:id", () => {
  it("returns a thread with its messages", async () => {
    mockDb.query.threads.findFirst.mockResolvedValue(mockThread);
    mockDb.select.mockReturnValueOnce(makeChain([mockMessage]));

    const res = await app.request("/thread_abc123");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe("thread_abc123");
    expect(body.messages).toHaveLength(1);
  });

  it("returns 404 when thread not found", async () => {
    const res = await app.request("/thread_nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("POST /search", () => {
  it("returns 400 when query is missing", async () => {
    const res = await app.request("/search", json({}));
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/query/);
  });

  it("returns matching threads ordered by similarity", async () => {
    mockDb.execute.mockResolvedValue({
      rows: [{ threadId: "thread_abc123", similarity: 0.95 }],
    });
    mockDb.select
      .mockReturnValueOnce(makeChain([mockThread]))    // threads fetch (ends at .where)
      .mockReturnValueOnce(makeChain([mockMessage]));  // messages fetch (ends at .orderBy)

    const res = await app.request("/search", json({ query: "hello world" }));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.object).toBe("list");
    expect(body.data[0].similarity).toBe(0.95);
    expect(body.data[0].id).toBe("thread_abc123");
  });

  it("returns empty list when no matches", async () => {
    const res = await app.request("/search", json({ query: "xyz no match" }));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(0);
  });

  it("returns 404 when scoped inbox not found", async () => {
    const res = await app.request(
      "/search",
      json({ query: "hello", inbox_email_address: "ghost@test.com" }),
    );
    expect(res.status).toBe(404);
  });
});
