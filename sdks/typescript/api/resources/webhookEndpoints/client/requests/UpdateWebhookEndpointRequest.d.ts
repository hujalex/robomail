/**
 * @example
 *     {
 *         id: "id"
 *     }
 */
export interface UpdateWebhookEndpointRequest {
    id: string;
    url?: string;
    description?: string | null;
    subscribed_events?: string[];
    is_enabled?: boolean;
}
//# sourceMappingURL=UpdateWebhookEndpointRequest.d.ts.map