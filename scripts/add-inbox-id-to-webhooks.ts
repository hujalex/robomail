import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

await sql`
  ALTER TABLE webhook_endpoints
  ADD COLUMN IF NOT EXISTS inbox_id text REFERENCES inboxes(id) ON DELETE CASCADE
`;

console.log("Done: inbox_id column added to webhook_endpoints");
