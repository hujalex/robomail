/**
 * @example
 *     {
 *         url: "url"
 *     }
 */
export interface CreateWebhookEndpointRequest {
    /** Must be HTTPS. */
    url: string;
    description?: string;
    /** Event types to receive. Defaults to all events when omitted. */
    subscribed_events?: string[];
}
//# sourceMappingURL=CreateWebhookEndpointRequest.d.ts.map