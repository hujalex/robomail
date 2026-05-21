/**
 * @example
 *     {
 *         username: "alice",
 *         domain: "yourdomain.com"
 *     }
 */
export interface CreateInboxRequest {
    /** Local part of the email address. */
    username: string;
    /** Domain for the inbox. */
    domain: string;
    display_name?: string | null;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=CreateInboxRequest.d.ts.map