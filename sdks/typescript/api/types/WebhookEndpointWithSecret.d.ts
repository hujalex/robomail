import type * as AgentmailDemoApi from "../index.js";
export interface WebhookEndpointWithSecret extends AgentmailDemoApi.WebhookEndpoint {
    /** Shown only on creation and after rotation. */
    signing_secret: string;
}
//# sourceMappingURL=WebhookEndpointWithSecret.d.ts.map