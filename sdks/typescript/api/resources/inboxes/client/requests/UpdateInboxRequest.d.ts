/**
 * @example
 *     {
 *         id: "id"
 *     }
 */
export interface UpdateInboxRequest {
    /** Inbox ID (email address). */
    id: string;
    display_name?: string | null;
    metadata?: Record<string, unknown>;
}
//# sourceMappingURL=UpdateInboxRequest.d.ts.map