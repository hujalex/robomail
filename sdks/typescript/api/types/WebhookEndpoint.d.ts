export interface WebhookEndpoint {
    id: string;
    url: string;
    description?: (string | null) | undefined;
    subscribed_events?: (string[] | null) | undefined;
    is_enabled: boolean;
    created_at: string;
}
//# sourceMappingURL=WebhookEndpoint.d.ts.map