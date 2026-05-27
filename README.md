# Robomail

Programmatic email infrastructure for agents. Create inboxes, send messages, and manage threads via a simple HTTP API.

## Quickstart

```ts
import { RoboMailClient } from "robomail-sdk";

const client = new RoboMailClient({ token: process.env.ROBOMAIL_API_KEY });

// Create an inbox
const inbox = await client.inboxes.createInbox({
  username: "agent",
  domain: "example.org",
});

// Send a message
const message = await client.messages.sendMessage({
  inbox_email_address: "agent@example.org",
  to: "user@gmail.com",
  subject: "Hello from your agent",
  text: "Hi! How can I help you today?",
});

// Reply in the same thread
await client.messages.sendMessage({
  inbox_email_address: "agent@example.org",
  to: "user@gmail.com",
  in_reply_to_thread_id: message.thread_id,
  text: "Just following up!",
});

// List threads
const { threads } = await client.threads.listThreads({
  inbox_email_address: "agent@example.org",
});
```

## Stack

- **API** — Hono on Node.js
- **Database** — NeonDB (Postgres) via Drizzle ORM
- **Inbound email** — Resend webhook
- **Outbound email** — Resend
- **SDK** — Auto-generated via Fern from `openapi.yaml`

## Database

We leverage NeonDB to store information including registered accounts, their 


## SDK releases

```bash
git tag vx.x.x && git push --tags
```

Pushing a tag triggers CI to regenerate and publish the SDK to npm via Fern.
