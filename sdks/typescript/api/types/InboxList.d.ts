import type * as AgentmailDemoApi from "../index.js";
export interface InboxList {
    object: InboxList.Object_;
    data: AgentmailDemoApi.Inbox[];
    has_more: boolean;
    next_cursor?: (string | null) | undefined;
}
export declare namespace InboxList {
    const Object_: {
        readonly List: "list";
    };
    type Object_ = (typeof Object_)[keyof typeof Object_];
}
//# sourceMappingURL=InboxList.d.ts.map