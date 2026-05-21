import type * as AgentmailDemoApi from "../index.js";
export interface WebhookEndpointList {
    object: WebhookEndpointList.Object_;
    data: AgentmailDemoApi.WebhookEndpoint[];
}
export declare namespace WebhookEndpointList {
    const Object_: {
        readonly List: "list";
    };
    type Object_ = (typeof Object_)[keyof typeof Object_];
}
//# sourceMappingURL=WebhookEndpointList.d.ts.map