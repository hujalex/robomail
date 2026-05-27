CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"hashed_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"address" "citext" NOT NULL,
	"display_name" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"inbox_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"message_id_header" text NOT NULL,
	"in_reply_to" text,
	"from_address" "citext" NOT NULL,
	"to_addresses" "citext"[] DEFAULT '{}'::citext[] NOT NULL,
	"cc_addresses" "citext"[] DEFAULT '{}'::citext[] NOT NULL,
	"bcc_addresses" "citext"[] DEFAULT '{}'::citext[] NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"headers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"embedding" vector(384),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_direction_check" CHECK ("messages"."direction" in ('inbound', 'outbound')),
	CONSTRAINT "messages_status_check" CHECK ("messages"."status" in ('queued', 'sent', 'delivered', 'bounced', 'received'))
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" text PRIMARY KEY NOT NULL,
	"inbox_id" text NOT NULL,
	"account_id" uuid NOT NULL,
	"subject" text,
	"root_message_id_header" text NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"inbox_id" text,
	"url" text NOT NULL,
	"description" text,
	"subscribed_events" text[],
	"signing_secret" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inboxes" ADD CONSTRAINT "inboxes_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_inbox_id_inboxes_id_fk" FOREIGN KEY ("inbox_id") REFERENCES "public"."inboxes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hashed_key_unique" ON "api_keys" USING btree ("hashed_key");--> statement-breakpoint
CREATE INDEX "api_keys_account_idx" ON "api_keys" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inboxes_address_unique" ON "inboxes" USING btree ("address");--> statement-breakpoint
CREATE INDEX "inboxes_account_idx" ON "inboxes" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_inbox_idx" ON "messages" USING btree ("inbox_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_account_idx" ON "messages" USING btree ("account_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_message_id_header_idx" ON "messages" USING btree ("message_id_header");--> statement-breakpoint
CREATE INDEX "threads_inbox_idx" ON "threads" USING btree ("inbox_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "threads_account_idx" ON "threads" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "threads_root_message_id_idx" ON "threads" USING btree ("root_message_id_header");--> statement-breakpoint
CREATE INDEX "webhook_endpoints_account_idx" ON "webhook_endpoints" USING btree ("account_id");