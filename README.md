# Robomail

Programmatic email infrastructure for agents. Create inboxes, send messages, and manage threads via a simple HTTP API.

## Installation
```
npm install robomail-sdk@latest
```

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

## Caveat
- **Only Domain** that currently works with RoboMail is a spare domain from a past project `connectmecybersecurity.org`

## Stack

- **API** — Hono on Node.js
- **Database** — NeonDB (Postgres) via Drizzle ORM
- **Inbound email** — Resend webhook
- **Outbound email** — Resend
- **SDK** — Auto-generated via Fern from `openapi.yaml`

## Database

We leverage NeonDB to store information including registered accounts, their corresponding API Keys, inboxes, along with any threads, messages pertaining to each inbox.

## Schema

![Schema diagram](schema.jpg)

<!-- 


**accounts**
- `id` — UUID, PK
- `name` — TEXT NOT NULL
- `created_at` — TIMESTAMPTZ NOT NULL DEFAULT now()

**api_keys**
- `id` — UUID, PK
- `account_id` — UUID NOT NULL → accounts(id) CASCADE
- `name` — TEXT NOT NULL
- `prefix` — TEXT NOT NULL
- `hashed_key` — TEXT NOT NULL UNIQUE
- `created_at` — TIMESTAMPTZ NOT NULL DEFAULT now()

**inboxes**
- `id` — TEXT, PK
- `account_id` — UUID NOT NULL → accounts(id) CASCADE
- `address` — CITEXT NOT NULL UNIQUE
- `display_name` — TEXT
- `metadata` — JSONB NOT NULL DEFAULT `{}`
- `created_at` — TIMESTAMPTZ NOT NULL DEFAULT now()

**threads**
- `id` — TEXT, PK
- `inbox_id` — TEXT NOT NULL → inboxes(id) CASCADE
- `account_id` — UUID NOT NULL → accounts(id) CASCADE
- `subject` — TEXT
- `root_message_id_header` — TEXT NOT NULL
- `last_message_at` — TIMESTAMPTZ
- `created_at` — TIMESTAMPTZ NOT NULL DEFAULT now()

**messages**
- `id` — TEXT, PK
- `thread_id` — TEXT NOT NULL → threads(id) CASCADE
- `inbox_id` — TEXT NOT NULL → inboxes(id) CASCADE
- `account_id` — UUID NOT NULL → accounts(id) CASCADE
- `direction` — TEXT NOT NULL CHECK (`inbound` | `outbound`)
- `status` — TEXT NOT NULL DEFAULT `sent` CHECK (`queued` | `sent` | `delivered` | `bounced` | `received`)
- `message_id_header` — TEXT NOT NULL
- `in_reply_to` — TEXT
- `from_address` — CITEXT NOT NULL
- `to_addresses` — CITEXT[] NOT NULL DEFAULT `{}`
- `cc_addresses` — CITEXT[] NOT NULL DEFAULT `{}`
- `bcc_addresses` — CITEXT[] NOT NULL DEFAULT `{}`
- `subject` — TEXT
- `body_text` — TEXT
- `body_html` — TEXT
- `headers` — JSONB NOT NULL DEFAULT `{}`
- `raw` — TEXT
- `embedding` — VECTOR(384)
- `created_at` — TIMESTAMPTZ NOT NULL DEFAULT now()

**webhook_endpoints**
- `id` — UUID, PK
- `account_id` — UUID NOT NULL → accounts(id) CASCADE
- `url` — TEXT NOT NULL
- `description` — TEXT
- `subscribed_events` — TEXT[]
- `signing_secret` — TEXT NOT NULL
- `is_enabled` — BOOLEAN NOT NULL DEFAULT true
- `created_at` — TIMESTAMPTZ NOT NULL DEFAULT now() -->

## Sending and Receiving Emails
We take advantage of the Resend Email API to send outbound emails in addition to processing incoming emails. Resend very cleanly manages sending outbound emails. As for inbound emails, when an email address with a configured domain receives an email. Receiving an email triggers Resend makes a post request to our API Server with critical information stored in the POST request payload enabling our API Server to process the message as needed.

## SDK releases

```bash
git tag vx.x.x && git push --tags
```

Pushing a tag triggers CI to regenerate and publish the SDK to npm via Fern.
