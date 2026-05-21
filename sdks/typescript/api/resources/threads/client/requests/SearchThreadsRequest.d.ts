/**
 * @example
 *     {
 *         query: "query"
 *     }
 */
export interface SearchThreadsRequest {
    /** Natural-language search query. */
    query: string;
    /** Optional — restrict search to a single inbox. */
    inbox_email_address?: string;
    limit?: number;
}
//# sourceMappingURL=SearchThreadsRequest.d.ts.map