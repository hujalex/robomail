## **RobotMail Spec**

### **Features**

We are designing an application that enables agents to have their own emailing inbox including for sending, replying, and having conversations in threads. 

### **Tech Stack**

- **NeonDB** \- Postgres Database  
- **Hono** \- API Framework  
- **Vercel** \- Deployment  
- **Drizzle** \- ORM  
- **OpenAPI** \- SDK Generation  
- **Cloudmailin** \- Inbound service for receiving emails as well as sending emails through Cloudmailin SMTP relay

### **Functions/Routes**

**Inboxes**

- Create an inbox  
- Retrieve an inbox ID (the email address)

**Messages**

- Send a message to the provided recipient’s email  
  - Provide the current inbox’s email address  
  - Provide the recipient’s email  
  - Subject  
  - Text or html body  
- List all messages within a given inbox with the inbox email address provided  
- Replying to a message  
  - Provide the Message ID, (Ex: \<[123@gmail.com](mailto:123@gmail.com)\>)  
  - The current inbox’s email address  
  - Text or html body  
- Retrieving a specific message  
  - Provide the email address of the inbox and the message id to fetch a message object

**Threads**

- Thread Object \- List of all associated message objects and their ids  
- Listing threads from an inbox  
  - Given an inbox ID (Inbox email address), return a list of thread objects  
- Listing thread from an organization  
  - Fetch all threads from all inboxes based on your API\_KEY  
- Fetch a specific thread   
  - Given a thread ID, return the corresponding thread object

### **API Endpoints**

### **Authentication**

All /v1/\* endpoints require: Authorization: Bearer sk\_live\_...

Webhook endpoints (/webhooks/\*) are unauthenticated but verified via HMAC signature in headers.

---

### **Inboxes — /v1/inboxes**

The core primitive. One email address an agent owns.

#### **POST /v1/inboxes**

Create a new inbox

* Body: domain name (string required), username (string required)  
* Returns: full inbox object with id, address, created\_at  
* Status: 201 Created

#### **GET /v1/inboxes**

List all inboxes for the authenticated account.

* Query: limit (1-100, default 20), starting\_after (cursor), address (filter by address)  
* Returns: { object: "list", data: Inbox\[\], has\_more, next\_cursor }

#### **GET /v1/inboxes/:id**

Retrieve a single inbox.

* Returns: full inbox object  
* 404 if not found or belongs to a different account

#### **PATCH /v1/inboxes/:id**

Update the display name or metadata. Address is immutable.

* Body: display\_name (optional), metadata (optional, replaces or merges)  
* Returns: updated inbox object

#### **DELETE /v1/inboxes/:id**

Delete an inbox. Stops accepting mail at that address.

* Returns: { deleted: true, id }  
* Decision to make: hard delete or soft delete with deleted\_at. For MVP, hard delete is fine.

---

### **Threads — /v1/threads**

Conversations within an inbox.

#### **GET /v1/threads**

List threads, scoped by inbox.

* Query: inbox\_email\_address (required), limit, starting\_after, participant (filter by email address in thread)  
* Returns: { object: "list", data: Thread\[\], has\_more, next\_cursor }

#### **GET /v1/threads/:id**

Retrieve a thread with all its messages.

* Returns: thread object with messages: Message\[\] array nested inside  
* 404 if not found

#### **POST /v1/threads/search**

Semantic search across threads (uses pgvector embeddings on messages). Embedding done with OpenAI text-embedding-3-small / ada-002

* Body: query (string, required), inbox\_email\_address (optional, filters scope), limit (1-50, default 10\)  
* Returns: { object: "list", data: Array\<Thread & { similarity: number }\> }

---

### **Messages — /v1/messages**

Individual emails (inbound and outbound).

#### **POST /v1/messages**

Send an outbound email. Either starts a new thread or replies in an existing one.

* Body:  
  * inbox\_email\_address (required) — which inbox sends from  
  * to (string\[\] of emails, required)  
  * cc (string\[\], optional)  
  * bcc (string\[\], optional)  
  * subject (string, optional but recommended)  
  * text (string) and/or html (string) — at least one required  
  * in\_reply\_to\_thread\_id (optional) — if set, reply in that thread  
  * headers (object, optional) — custom headers to inject  
* Returns: created message object with id, thread\_id, message\_id\_header, created\_at  
* Status: 201 Created

#### **GET /v1/messages**

List messages with filters.

* Query: inbox\_email\_address, thread\_id, direction ('inbound' | 'outbound'), from, to, limit, starting\_after  
* Returns: { object: "list", data: Message\[\], has\_more, next\_cursor }

#### **GET /v1/messages/:id**

Retrieve a single message.

* Returns: full message object including body\_text, body\_html, headers  
* 404 if not found

#### **GET /v1/messages/:id/raw**

Retrieve the raw RFC 822 source of a message. Useful for debugging.

* Returns: text/plain with the raw .eml contents  
* Not all stored messages may have this — return 404 if not preserved

---

### **Webhook Endpoints — /v1/webhook\_endpoints**

Customer-registered URLs where you deliver events.

#### **POST /v1/webhook\_endpoints**

Register a new webhook URL.

* Body: url (required, must be HTTPS), description (optional), subscribed\_events (string\[\], optional — defaults to all)  
* Returns: webhook endpoint object including a signing\_secret (shown once, used to verify HMAC on deliveries)  
* Status: 201 Created

#### **GET /v1/webhook\_endpoints**

List all webhook endpoints for the account.

* Returns: { object: "list", data: WebhookEndpoint\[\] }

#### **GET /v1/webhook\_endpoints/:id**

Retrieve a single webhook endpoint.

* Returns: webhook endpoint object (signing\_secret is NOT included after creation)

#### **PATCH /v1/webhook\_endpoints/:id**

Update URL, description, subscribed events, or enabled state.

* Body: url, description, subscribed\_events, is\_enabled (all optional)  
* Returns: updated webhook endpoint

#### **DELETE /v1/webhook\_endpoints/:id**

Remove a webhook endpoint.

* Returns: { deleted: true, id }

#### **POST /v1/webhook\_endpoints/:id/rotate\_secret**

Generate a new signing secret. Returns the new secret once.

* Returns: { id, signing\_secret }  
* Useful for credential rotation

---

### **Incoming webhooks (you call the customer) — for documentation only**

Not endpoints your API exposes, but the events you deliver to customer-registered URLs. Worth listing because they're part of the API contract.

* message.received — inbound email arrived in an inbox  
* message.sent — outbound email accepted by the upstream SMTP provider  
* message.delivered — confirmed delivered to recipient's mail server  
* message.bounced — hard or soft bounce  
* thread.created — first message of a new thread arrived (fires alongside the first message.received)  
* inbox.created — inbox provisioned (mostly useful for audit pipelines)

Each delivery includes:

* Headers: X-AgentMail-Signature: sha256=..., X-AgentMail-Event-Id, X-AgentMail-Event-Type, X-AgentMail-Delivery-Attempt  
* Body: JSON with id, type, created\_at, data (the event-specific payload), account\_id

---

### **Inbound mail webhook (called by your inbound provider) — /webhooks/inbound**

Not part of the customer API. This is where CloudMailin/Postmark/etc. POSTs when external mail arrives at one of your inboxes.

#### **POST /webhooks/inbound**

Receive parsed email from your inbound provider.

* Auth: HMAC signature from the provider, verified server-side  
* Body: provider-specific payload (CloudMailin JSON, etc.)  
* What happens: parse → find inbox by recipient → find-or-create thread (walk the chain) → insert message → fire customer webhook if subscribed  
* For Walking the Chain  
  * Check reply to against stored message\_id header values first  
  * Walk references headers  
  * Create new thread  
* Returns: 200 OK quickly so the provider doesn't retry

---

### **Outbound delivery webhook — /webhooks/outbound-status**

Also internal. Your outbound provider posts here with delivery/bounce status.

#### **POST /webhooks/outbound-status**

Receive delivery status updates from your outbound provider.

* Auth: HMAC signature from the provider  
* Body: provider-specific delivery event  
* What happens: update message status → fire customer webhook (message.delivered or message.bounced)  
* Returns: 200 OK

---

### **Health and meta**

#### **GET /health**

Unauthenticated health check.

* Returns: { status: "ok", version: "...", uptime\_seconds }

#### **GET /v1/me *(nice-to-have)***

Returns info about the authenticated account. Useful for SDK debugging.

* Returns: { account: { id, name, created\_at }, api\_key: { id, name, prefix } }

### **Database Schema**

#### **accounts — your customers (tenants); the unit of data isolation**

* id uuid PK  
* name text — display name  
* created\_at timestamptz

#### **account\_members — joins Neon Auth users to accounts; how humans access the dashboard**

* account\_id uuid FK → accounts.id  
* user\_id uuid FK → auth.users.id  
* role text — 'owner' | 'member'  
* created\_at timestamptz  
* PK (account\_id, user\_id)

#### **api\_keys — programmatic credentials your customers use to call your API**

* id uuid PK  
* account\_id uuid FK → accounts.id  
* name text — "Production", "Local dev"  
* prefix text — first \~12 chars ("sk\_live\_abc1") for display  
* hashed\_key text unique — sha256 of plaintext key  
* created\_at timestamptz

#### **inboxes — the core primitive; one email address an agent owns**

* id text PK — (inbox email address)  
* account\_id uuid FK → accounts.id  
* address citext unique — full address ("sarah@yourdomain.com")  
* display\_name text — "Sarah Agent"  
* metadata jsonb — agent persona, goals, anything the customer attaches  
* created\_at timestamptz

#### **threads — conversation grouping; messages sharing an In-Reply-To/References chain**

* id text PK — "thread\_..."  
* inbox\_email\_address text FK → inboxes.id  
* account\_id uuid FK → accounts.id  
* subject text — denormalized from first message  
* root\_message\_id\_header text — original RFC 5322 Message-ID, used to match replies  
* last\_message\_at timestamptz  
* created\_at timestamptz

#### **messages — individual emails (inbound and outbound)**

* id text PK — in message header section \- Ex: Message-ID: \<1234567890.abcdef.12345@smtp.sender.com\>  
* thread\_id text FK → threads.id  
* Inbox\_email\_address text FK → inboxes.id  
* account\_id uuid FK → accounts.id  
* direction text — 'inbound' | 'outbound'  
* message\_id\_header text — RFC 5322 Message-ID  
* in\_reply\_to text — In-Reply-To header (for threading)  
* from\_address citext  
* to\_addresses citext\[\]  
* subject text  
* body\_text text  
* body\_html text  
* embedding vector(1536) — pgvector for semantic search  
* created\_at timestamptz

#### **webhook\_endpoints — where to deliver inbound message events**

* id uuid PK  
* account\_id uuid FK → accounts.id  
* url text — customer's HTTPS endpoint  
* is\_enabled boolean  
* created\_at timestamptz  
* description \-   
* subscribed\_events-   
* signing\_secret \- 

