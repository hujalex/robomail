import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// =====================================================
// Custom column types
// =====================================================

// citext — case-insensitive text (for email addresses)
const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

// vector(1536) — pgvector embedding column
const vector = (dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      return JSON.parse(value);
    },
  });

// =====================================================
// accounts — your customers (tenants); unit of data isolation
// =====================================================

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

// =====================================================
// api_keys — programmatic credentials
// =====================================================

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    hashedKey: text("hashed_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    hashedKeyUnique: uniqueIndex("api_keys_hashed_key_unique").on(t.hashedKey),
    accountIdx: index("api_keys_account_idx").on(t.accountId),
  }),
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// =====================================================
// inboxes — the core primitive (one email address per agent)
// =====================================================

export const inboxes = pgTable(
  "inboxes",
  {
    id: text("id").primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    address: citext("address").notNull(),
    displayName: text("display_name"),
    metadata: jsonb("metadata")
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    addressUnique: uniqueIndex("inboxes_address_unique").on(t.address),
    accountIdx: index("inboxes_account_idx").on(t.accountId),
  }),
);

export type Inbox = typeof inboxes.$inferSelect;
export type NewInbox = typeof inboxes.$inferInsert;

// =====================================================
// threads — conversation grouping
// =====================================================

export const threads = pgTable(
  "threads",
  {
    id: text("id").primaryKey(),
    inboxId: text("inbox_id")
      .notNull()
      .references(() => inboxes.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    subject: text("subject"),
    rootMessageIdHeader: text("root_message_id_header").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    inboxIdx: index("threads_inbox_idx").on(t.inboxId, t.lastMessageAt.desc()),
    accountIdx: index("threads_account_idx").on(t.accountId),
    rootMessageIdIdx: index("threads_root_message_id_idx").on(
      t.rootMessageIdHeader,
    ),
  }),
);

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;

// =====================================================
// messages — individual emails (inbound and outbound)
// =====================================================

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    inboxId: text("inbox_id")
      .notNull()
      .references(() => inboxes.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    messageIdHeader: text("message_id_header").notNull(),
    inReplyTo: text("in_reply_to"),
    fromAddress: citext("from_address").notNull(),
    toAddresses: citext("to_addresses")
      .array()
      .notNull()
      .default(sql`'{}'::citext[]`),
    ccAddresses: citext("cc_addresses")
      .array()
      .notNull()
      .default(sql`'{}'::citext[]`),
    bccAddresses: citext("bcc_addresses")
      .array()
      .notNull()
      .default(sql`'{}'::citext[]`),
    subject: text("subject"),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    headers: jsonb("headers")
      .notNull()
      .default(sql`'{}'::jsonb`),
    raw: text("raw"),
    status: text("status").notNull().default("sent"),
    embedding: vector(384)("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    threadIdx: index("messages_thread_idx").on(t.threadId, t.createdAt),
    inboxIdx: index("messages_inbox_idx").on(t.inboxId, t.createdAt.desc()),
    accountIdx: index("messages_account_idx").on(
      t.accountId,
      t.createdAt.desc(),
    ),
    messageIdHeaderIdx: index("messages_message_id_header_idx").on(
      t.messageIdHeader,
    ),
    directionCheck: check(
      "messages_direction_check",
      sql`${t.direction} in ('inbound', 'outbound')`,
    ),
    statusCheck: check(
      "messages_status_check",
      sql`${t.status} in ('queued', 'sent', 'delivered', 'bounced', 'received')`,
    ),
    // HNSW vector index — defined here but Drizzle's index DSL doesn't fully
    // support HNSW operator classes yet. The raw SQL migration handles this:
    //   create index messages_embedding_hnsw_idx on messages using hnsw (embedding vector_cosine_ops);
  }),
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// =====================================================
// webhook_endpoints — where to deliver inbound message events
// =====================================================

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    description: text("description"),
    subscribedEvents: text("subscribed_events").array(),
    signingSecret: text("signing_secret").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    accountIdx: index("webhook_endpoints_account_idx").on(t.accountId),
  }),
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;

// =====================================================
// Relations (optional, but nice for typed joins)
// =====================================================

export const accountsRelations = relations(accounts, ({ many }) => ({
  apiKeys: many(apiKeys),
  inboxes: many(inboxes),
  webhookEndpoints: many(webhookEndpoints),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  account: one(accounts, {
    fields: [apiKeys.accountId],
    references: [accounts.id],
  }),
}));

export const inboxesRelations = relations(inboxes, ({ one, many }) => ({
  account: one(accounts, {
    fields: [inboxes.accountId],
    references: [accounts.id],
  }),
  threads: many(threads),
  messages: many(messages),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
  inbox: one(inboxes, {
    fields: [threads.inboxId],
    references: [inboxes.id],
  }),
  account: one(accounts, {
    fields: [threads.accountId],
    references: [accounts.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
  inbox: one(inboxes, {
    fields: [messages.inboxId],
    references: [inboxes.id],
  }),
  account: one(accounts, {
    fields: [messages.accountId],
    references: [accounts.id],
  }),
}));

export const webhookEndpointsRelations = relations(
  webhookEndpoints,
  ({ one }) => ({
    account: one(accounts, {
      fields: [webhookEndpoints.accountId],
      references: [accounts.id],
    }),
  }),
);
