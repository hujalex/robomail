import { vi, describe, it, expect, beforeEach } from "vitest";
import { makeTestApp, mockInbox, json } from "./helpers.js";

const { mockDb, chain } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["from", "where", "set", "values", "orderBy", "groupBy"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.returning = vi.fn().mockResolvedValue([]);

  const mockDb = {
    query: { inboxes: { findFirst: vi.fn().mockResolvedValue(null) } },
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
  };
  return { mockDb, chain };
});

vi.mock("../db/client.js", () => ({ db: mockDb }));
vi.mock("../lib/webhooks.js", () => ({ deliverEvent: vi.fn().mockResolvedValue(undefined) }));

import inboxesRouter from "../routes/inboxes.js";

const app = makeTestApp(inboxesRouter as any);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.query.inboxes.findFirst.mockResolvedValue(null);
  chain.limit.mockResolvedValue([]);
  chain.returning.mockResolvedValue([]);
  for (const m of ["from", "where", "set", "values", "orderBy", "groupBy"]) {
    chain[m].mockReturnValue(chain);
  }
  mockDb.select.mockReturnValue(chain);
  mockDb.insert.mockReturnValue(chain);
  mockDb.update.mockReturnValue(chain);
  mockDb.delete.mockReturnValue(chain);
});

describe("POST /", () => {
  it("creates an inbox", async () => {
    chain.returning.mockResolvedValueOnce([mockInbox]);

    const res = await app.request("/", json({ username: "alice", domain: "test.com" }));
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.address).toBe("alice@test.com");
    expect(body.display_name).toBe("Alice Agent");
  });

  it("returns 400 when username is missing", async () => {
    const res = await app.request("/", json({ domain: "test.com" }));
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/username/);
  });

  it("returns 400 when domain is missing", async () => {
    const res = await app.request("/", json({ username: "alice" }));
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/domain/);
  });

  it("returns 409 when inbox already exists", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);

    const res = await app.request("/", json({ username: "alice", domain: "test.com" }));
    expect(res.status).toBe(409);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /", () => {
  it("returns a list of inboxes", async () => {
    chain.limit.mockResolvedValueOnce([mockInbox]);

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.object).toBe("list");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].address).toBe("alice@test.com");
  });

  it("returns empty list when no inboxes", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(0);
    expect(body.has_more).toBe(false);
  });

  it("returns 400 for invalid cursor", async () => {
    const res = await app.request("/?starting_after=nonexistent");
    expect(res.status).toBe(400);
  });
});

describe("GET /:id", () => {
  it("returns the inbox", async () => {
    mockDb.query.inboxes.findFirst.mockResolvedValue(mockInbox);

    const res = await app.request("/alice@test.com");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe("alice@test.com");
  });

  it("returns 404 when not found", async () => {
    const res = await app.request("/nobody@test.com");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /:id", () => {
  it("updates display_name", async () => {
    chain.returning.mockResolvedValueOnce([{ ...mockInbox, displayName: "Updated Name" }]);

    const res = await app.request("/alice@test.com", json({ display_name: "Updated Name" }, "PATCH"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.display_name).toBe("Updated Name");
  });

  it("returns 400 when no fields provided", async () => {
    const res = await app.request("/alice@test.com", json({}, "PATCH"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when not found", async () => {
    chain.returning.mockResolvedValueOnce([]);

    const res = await app.request("/nobody@test.com", json({ display_name: "X" }, "PATCH"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /:id", () => {
  it("deletes the inbox", async () => {
    chain.returning.mockResolvedValueOnce([{ id: "alice@test.com" }]);

    const res = await app.request("/alice@test.com", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.deleted).toBe(true);
    expect(body.id).toBe("alice@test.com");
  });

  it("returns 404 when not found", async () => {
    chain.returning.mockResolvedValueOnce([]);

    const res = await app.request("/nobody@test.com", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
