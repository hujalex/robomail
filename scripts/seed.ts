import { randomBytes, createHash } from "node:crypto";
import { db } from "../src/db/client.js";
import { accounts, apiKeys } from "../src/db/schema.js";

const name = process.argv[2] ?? "My Account";

const plainKey = `sk_live_${randomBytes(24).toString("hex")}`;
const prefix = plainKey.slice(0, 12);
const hashedKey = createHash("sha256").update(plainKey).digest("hex");

const [account] = await db.insert(accounts).values({ name }).returning();
await db.insert(apiKeys).values({
  accountId: account.id,
  name: "Default",
  prefix,
  hashedKey,
});

console.log("Account ID :", account.id);
console.log("API Key    :", plainKey);
console.log("\nAdd to .env:");
console.log(`API_KEY=${plainKey}`);
