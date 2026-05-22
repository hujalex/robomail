import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockDb, mockAuthMiddleware } = vi.hoisted(() => {
  const mockAuthMiddleware = vi.fn().mockImplementation(async (c: any, next: any) => {
    c.set("accountId", "account-123");
    c.set("apiKeyId", "key-id");
    c.set("apiKeyName", "Test Key");
    c.set("apiKeyPrefix", "sk_test_");
    await next();
  });

  return {
    mockAuthMiddleware,
    mockDb: {
      query: {
        accounts: { findFirst: vi.fn().mockResolvedValue(null) },
        apiKeys: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    },
  };
});

vi.mock("../db/client.js", () => ({ db: mockDb }));
vi.mock("../lib/auth.js", () => ({ authMiddleware: mockAuthMiddleware }));
vi.mock("../lib/embeddings.js", () => ({
  embeddingsEnabled: vi.fn().mockReturnValue(false),
  createEmbedding: vi.fn(),
}));

import app from "../index.js";
import { ACCOUNT_ID, mockAccount } from "./helpers.js";

describe("GET /", () => {
  it("returns welcome text", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("RoboMail");
  });
});

describe("GET /health", () => {
  it("returns ok status with version and uptime", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe("ok");
    expect(typeof body.uptime_seconds).toBe("number");
    expect(typeof body.version).toBe("string");
  });
});

describe("GET /v1/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthMiddleware.mockImplementation(async (c: any, next: any) => {
      c.set("accountId", "account-123");
      c.set("apiKeyId", "key-id");
      c.set("apiKeyName", "Test Key");
      c.set("apiKeyPrefix", "sk_test_");
      await next();
    });
    mockDb.query.accounts.findFirst.mockResolvedValue(null);
  });

  it("returns account and api_key info", async () => {
    mockDb.query.accounts.findFirst.mockResolvedValue(mockAccount);

    const res = await app.request("/v1/me");
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.account.id).toBe(ACCOUNT_ID);
    expect(body.account.name).toBe("Test Account");
    expect(body.api_key.id).toBe("key-id");
  });

  it("returns 404 when account not found", async () => {
    const res = await app.request("/v1/me");
    expect(res.status).toBe(404);
  });
});
