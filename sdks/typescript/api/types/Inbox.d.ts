export interface Inbox {
    /** Inbox ID (same as address) */
    id: string;
    address: string;
    display_name?: (string | null) | undefined;
    metadata: Record<string, unknown>;
    created_at: string;
}
//# sourceMappingURL=Inbox.d.ts.map