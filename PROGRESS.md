# RoboMail Progress

## Infrastructure

### Vercel
- Project: `agentmail-demo`
- Production URL: `https://agentmail-demo.vercel.app`
- Deployed and serving live traffic

### Neon (Database)
- Schema pushed and all tables live: `accounts`, `api_keys`, `inboxes`, `threads`, `messages`, `webhook_endpoints`
- `neon_auth` / `account_members` removed — Neon Auth is not enabled on this project
- Connection: pooled, `neondb_owner` role

### CloudMailin (Inbound Email)
- Address: `27561b67ba35df6f2dd1@cloudmailin.net`
- Target URL: `https://ahu:HNI0E446@agentmail-demo.vercel.app/webhooks/inbound`
- Auth: HTTP Basic (credentials embedded in target URL, forwarded as `Authorization: Basic ...` header)
- Domain MX records: **still need to be added in Namecheap** pointing to CloudMailin's mail servers
- SMTP outbound: `smtp.cloudmailin.com:587`, credentials configured in Vercel env

### Domain
- Domain: `connectmecybersecurity.org` (Namecheap)
- MX records for CloudMailin: **pending**
- SPF / DKIM / DMARC records for outbound: **pending**

---

## Vercel Environment Variables

| Variable | Status |
|---|---|
| `DATABASE_URL` | Set (neondb_owner) |
| `CLOUDMAILIN_SMTP_HOST` | Set |
| `CLOUDMAILIN_SMTP_PORT` | Set |
| `CLOUDMAILIN_SMTP_USER` | Set |
| `CLOUDMAILIN_SMTP_PASS` | Set |
| `CLOUDMAILIN_INBOUND_USER` | Set |
| `CLOUDMAILIN_INBOUND_PASS` | Set |
| `EMBEDDINGS_ENABLED` | Set to `false` |

---

## Account & API Key

- Account ID: `e1b7c4d7-8863-4309-97cc-691b68a283fa`
- API Key: stored in `.env` as `API_KEY`
- Seeded via `scripts/seed-account.sh`

---

## What's Working

- `POST /v1/inboxes` — create inbox
- `GET /v1/inboxes` — list inboxes
- `GET /v1/inboxes/:id` — get inbox
- `POST /v1/messages` — send outbound email via CloudMailin SMTP
- `GET /v1/messages` — list messages
- `GET /v1/messages/:id` — get message
- `GET /v1/threads` — list threads
- `GET /v1/threads/:id` — get thread
- `POST /v1/webhook_endpoints` — register webhook
- `GET/PATCH/DELETE /v1/webhook_endpoints/:id`
- `POST /webhooks/inbound` — receive inbound mail from CloudMailin
- `POST /webhooks/outbound-status` — receive delivery status updates
- `GET /health` — health check
- `GET /v1/me` — auth info

---

## What's Not Done

- **DNS records** — MX, SPF, DKIM, DMARC not yet added in Namecheap for `connectmecybersecurity.org`
- **Inbound email untested end-to-end** — CloudMailin will only route to your domain once MX records are live
- **Outbound SMTP untested end-to-end** — need to send a real email and confirm delivery
- **Domain allowlist** — inbox creation accepts any domain string; no validation that the domain is owned
- **Embeddings / semantic search** — disabled (`EMBEDDINGS_ENABLED=false`); `@xenova/transformers` doesn't run on Vercel without a custom setup
- **SDK** — Fern configured but not generated; `fern/generators.yml` has a duplicate `output` key bug

---

## Scripts

| Script | Usage |
|---|---|
| `scripts/seed-account.sh [name]` | Create account + API key in DB |
| `scripts/create-inbox.sh <username> <domain>` | Create an inbox |
| `scripts/send-message.sh` | (empty) |
| `scripts/list-threads.sh` | (empty) |
| `scripts/fetch-thread.sh` | (empty) |
| `scripts/fetch-message.sh` | (empty) |
| `scripts/list-messages.sh` | (empty) |
| `scripts/reply-message.sh` | (empty) |
| `scripts/get-inbox.sh` | (empty) |
