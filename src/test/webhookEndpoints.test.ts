import { vi, describe, it, expect, beforeEach } from "vitest";
import { makeTestApp, mockWebhookEndpoint, json } from "./helpers.js";

const { mockDb, chain } = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["from", "where", "set", "values", "orderBy", "groupBy"]) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.returning = vi.fn().mockResolvedValue([]);

  const mockDb = {
    query: { webhookEndpoints: { findFirst: vi.fn().mockResolvedValue(null) } },
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
  };
  return { mockDb, chain };
});

vi.mock("../db/client.js", () => ({ db: mockDb }));

import webhookEndpointsRouter from "../routes/webhookEndpoints.js";

const app = makeTestApp(webhookEndpointsRouter as any);

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.query.webhookEndpoints.findFirst.mockResolvedValue(null);
  for (const m of ["from", "where", "set", "values", "orderBy", "groupBy"]) {
    chain[m].mockReturnValue(chain);
  }
  chain.limit.mockResolvedValue([]);
  chain.returning.mockResolvedValue([]);
  mockDb.select.mockReturnValue(chain);
  mockDb.insert.mockReturnValue(chain);
  mockDb.update.mockReturnValue(chain);
  mockDb.delete.mockReturnValue(chain);
});

describe("POST /", () => {
  it("creates an endpoint and returns signing_secret", async () => {
    chain.returning.mockResolvedValueOnce([mockWebhookEndpoint]);

    const res = await app.request(
      "/",
      json({ url: "https://example.com/hook", subscribed_events: ["message.received"] }),
    );
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.url).toBe("https://example.com/webhook");
    expect(typeof body.signing_secret).toBe("string");
    expect(body.signing_secret).toHaveLength(64);
  });

  it("returns 400 when url is missing", async () => {
    const res = await app.request("/", json({ description: "no url" }));
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/url/);
  });

  it("returns 400 for non-https url", async () => {
    const res = await app.request("/", json({ url: "http://example.com/hook" }));
    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toMatch(/https/);
  });

  it("returns 400 for invalid url", async () => {
    const res = await app.request("/", json({ url: "not-a-url" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /", () => {
  it("returns list of webhook endpoints", async () => {
    chain.orderBy.mockResolvedValue([mockWebhookEndpoint]);

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.object).toBe("list");
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("endpoint-uuid-123");
  });

  it("returns empty list when none registered", async () => {
    chain.orderBy.mockResolvedValue([]);

    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data).toHaveLength(0);
  });
});

describe("GET /:id", () => {
  it("returns the endpoint without signing_secret", async () => {
    mockDb.query.webhookEndpoints.findFirst.mockResolvedValue(mockWebhookEndpoint);

    const res = await app.request("/endpoint-uuid-123");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe("endpoint-uuid-123");
    expect(body.signing_secret).toBeUndefined();
  });

  it("returns 404 when not found", async () => {
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("PATCH /:id", () => {
  it("updates is_enabled", async () => {
    chain.returning.mockResolvedValueOnce([{ ...mockWebhookEndpoint, isEnabled: false }]);

    const res = await app.request("/endpoint-uuid-123", json({ is_enabled: false }, "PATCH"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.is_enabled).toBe(false);
  });

  it("returns 400 when no valid fields provided", async () => {
    const res = await app.request("/endpoint-uuid-123", json({}, "PATCH"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-https url", async () => {
    const res = await app.request(
      "/endpoint-uuid-123",
      json({ url: "http://example.com" }, "PATCH"),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 when not found", async () => {
    chain.returning.mockResolvedValueOnce([]);

    const res = await app.request("/nonexistent", json({ is_enabled: true }, "PATCH"));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /:id", () => {
  it("deletes the endpoint", async () => {
    chain.returning.mockResolvedValueOnce([{ id: "endpoint-uuid-123" }]);

    const res = await app.request("/endpoint-uuid-123", { method: "DELETE" });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.deleted).toBe(true);
  });

  it("returns 404 when not found", async () => {
    chain.returning.mockResolvedValueOnce([]);

    const res = await app.request("/nonexistent", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("POST /:id/rotate_secret", () => {
  it("returns a new signing secret", async () => {
    chain.returning.mockResolvedValueOnce([{ id: "endpoint-uuid-123" }]);

    const res = await app.request("/endpoint-uuid-123/rotate_secret", { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe("endpoint-uuid-123");
    expect(typeof body.signing_secret).toBe("string");
    expect(body.signing_secret).toHaveLength(64);
  });

  it("returns 404 when not found", async () => {
    chain.returning.mockResolvedValueOnce([]);

    const res = await app.request("/nonexistent/rotate_secret", { method: "POST" });
    expect(res.status).toBe(404);
  });
});
