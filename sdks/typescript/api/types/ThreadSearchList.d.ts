import type * as AgentmailDemoApi from "../index.js";
export interface ThreadSearchList {
    object: ThreadSearchList.Object_;
    data: AgentmailDemoApi.ThreadWithSimilarity[];
    has_more: boolean;
    next_cursor?: (string | null) | undefined;
}
export declare namespace ThreadSearchList {
    const Object_: {
        readonly List: "list";
    };
    type Object_ = (typeof Object_)[keyof typeof Object_];
}
//# sourceMappingURL=ThreadSearchList.d.ts.map