import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiKeys } from "../db/schema.js";
import { sha256 } from "./crypto.js";

export type AuthVariables = {
  accountId: string;
  apiKeyId: string;
  apiKeyName: string;
  apiKeyPrefix: string;
};

const bearerPrefix = "bearer ";

export const authMiddleware: MiddlewareHandler<{
  Variables: AuthVariables;
}> = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }
  const value = header.toLowerCase();
  if (!value.startsWith(bearerPrefix)) {
    return c.json({ error: "Invalid Authorization scheme" }, 401);
  }
  const token = header.slice(bearerPrefix.length).trim();
  if (!token.startsWith("sk_")) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  const hashedKey = sha256(token);
  const apiKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.hashedKey, hashedKey),
  });

  if (!apiKey) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  c.set("accountId", apiKey.accountId);
  c.set("apiKeyId", apiKey.id);
  c.set("apiKeyName", apiKey.name);
  c.set("apiKeyPrefix", apiKey.prefix);

  await next();
};
