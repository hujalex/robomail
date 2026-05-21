import type * as AgentmailDemoApi from "../index.js";
export interface ThreadList {
    object: ThreadList.Object_;
    data: AgentmailDemoApi.Thread[];
    has_more: boolean;
    next_cursor?: (string | null) | undefined;
}
export declare namespace ThreadList {
    const Object_: {
        readonly List: "list";
    };
    type Object_ = (typeof Object_)[keyof typeof Object_];
}
//# sourceMappingURL=ThreadList.d.ts.map