/**
 * @example
 *     {}
 */
export interface ListInboxesRequest {
    limit?: number;
    /** Cursor for pagination (inbox ID of the last item on the previous page). */
    starting_after?: string;
    /** Filter by exact email address. */
    address?: string;
}
//# sourceMappingURL=ListInboxesRequest.d.ts.map