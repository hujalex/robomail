import type { inboxes, messages, threads } from "../db/schema.js";

export const serializeInbox = (inbox: typeof inboxes.$inferSelect) => ({
  id: inbox.id,
  address: inbox.address,
  display_name: inbox.displayName,
  metadata: inbox.metadata,
  created_at: inbox.createdAt,
});

export const serializeMessage = (message: typeof messages.$inferSelect) => ({
  id: message.id,
  thread_id: message.threadId,
  inbox_email_address: message.inboxId,
  direction: message.direction,
  message_id_header: message.messageIdHeader,
  in_reply_to: message.inReplyTo,
  from: message.fromAddress,
  to: message.toAddresses,
  cc: message.ccAddresses,
  bcc: message.bccAddresses,
  subject: message.subject,
  body_text: message.bodyText,
  body_html: message.bodyHtml,
  headers: message.headers,
  status: message.status,
  created_at: message.createdAt,
});

export const serializeThread = (
  thread: typeof threads.$inferSelect,
  threadMessages: Array<typeof messages.$inferSelect>,
) => ({
  id: thread.id,
  inbox_email_address: thread.inboxId,
  subject: thread.subject,
  root_message_id_header: thread.rootMessageIdHeader,
  last_message_at: thread.lastMessageAt,
  created_at: thread.createdAt,
  messages: threadMessages.map(serializeMessage),
});
