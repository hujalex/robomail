export interface Message {
    /** RFC 5322 Message-ID (normalized, without angle brackets) */
    id: string;
    thread_id: string;
    inbox_email_address: string;
    direction: Message.Direction;
    message_id_header: string;
    in_reply_to?: (string | null) | undefined;
    from: string;
    to: string[];
    cc: string[];
    bcc: string[];
    subject?: (string | null) | undefined;
    body_text?: (string | null) | undefined;
    body_html?: (string | null) | undefined;
    headers: Record<string, unknown>;
    status: Message.Status;
    created_at: string;
}
export declare namespace Message {
    const Direction: {
        readonly Inbound: "inbound";
        readonly Outbound: "outbound";
    };
    type Direction = (typeof Direction)[keyof typeof Direction];
    const Status: {
        readonly Sent: "sent";
        readonly Received: "received";
        readonly Delivered: "delivered";
        readonly Bounced: "bounced";
    };
    type Status = (typeof Status)[keyof typeof Status];
}
//# sourceMappingURL=Message.d.ts.map