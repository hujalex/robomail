/**
 * @example
 *     {
 *         inbox_email_address: "inbox_email_address"
 *     }
 */
export interface ListThreadsRequest {
    inbox_email_address: string;
    limit?: number;
    /** Cursor for pagination (thread ID of the last item). */
    starting_after?: string;
    /** Filter threads by an email address that appears as sender or recipient. */
    participant?: string;
}
//# sourceMappingURL=ListThreadsRequest.d.ts.map