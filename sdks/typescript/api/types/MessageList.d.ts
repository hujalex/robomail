import type * as AgentmailDemoApi from "../index.js";
export interface MessageList {
    object: MessageList.Object_;
    data: AgentmailDemoApi.Message[];
    has_more: boolean;
    next_cursor?: (string | null) | undefined;
}
export declare namespace MessageList {
    const Object_: {
        readonly List: "list";
    };
    type Object_ = (typeof Object_)[keyof typeof Object_];
}
//# sourceMappingURL=MessageList.d.ts.map