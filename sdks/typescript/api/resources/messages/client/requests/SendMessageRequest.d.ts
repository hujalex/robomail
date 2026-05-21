/**
 * @example
 *     {
 *         inbox_email_address: "inbox_email_address",
 *         to: "to"
 *     }
 */
export interface SendMessageRequest {
    /** Sending inbox. */
    inbox_email_address: string;
    to: SendMessageRequest.To;
    cc?: SendMessageRequest.Cc;
    bcc?: SendMessageRequest.Bcc;
    subject?: string;
    /** Plain-text body. At least one of text or html is required. */
    text?: string;
    /** HTML body. At least one of text or html is required. */
    html?: string;
    /** Reply in this thread instead of starting a new one. */
    in_reply_to_thread_id?: string;
    /** Custom RFC headers to inject. */
    headers?: Record<string, unknown>;
}
export declare namespace SendMessageRequest {
    type To = string | string[];
    type Cc = string | string[];
    type Bcc = string | string[];
}
//# sourceMappingURL=SendMessageRequest.d.ts.map