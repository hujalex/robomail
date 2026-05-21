import { InboxesClient } from "./api/resources/inboxes/client/Client.js";
import { InternalWebhooksClient } from "./api/resources/internalWebhooks/client/Client.js";
import { MessagesClient } from "./api/resources/messages/client/Client.js";
import { MetaClient } from "./api/resources/meta/client/Client.js";
import { ThreadsClient } from "./api/resources/threads/client/Client.js";
import { WebhookEndpointsClient } from "./api/resources/webhookEndpoints/client/Client.js";
import type { BaseClientOptions, BaseRequestOptions } from "./BaseClient.js";
import { type NormalizedClientOptionsWithAuth } from "./BaseClient.js";
import * as core from "./core/index.js";
export declare namespace AgentmailDemoApiClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class AgentmailDemoApiClient {
    protected readonly _options: NormalizedClientOptionsWithAuth<AgentmailDemoApiClient.Options>;
    protected _meta: MetaClient | undefined;
    protected _inboxes: InboxesClient | undefined;
    protected _threads: ThreadsClient | undefined;
    protected _messages: MessagesClient | undefined;
    protected _webhookEndpoints: WebhookEndpointsClient | undefined;
    protected _internalWebhooks: InternalWebhooksClient | undefined;
    constructor(options?: AgentmailDemoApiClient.Options);
    get meta(): MetaClient;
    get inboxes(): InboxesClient;
    get threads(): ThreadsClient;
    get messages(): MessagesClient;
    get webhookEndpoints(): WebhookEndpointsClient;
    get internalWebhooks(): InternalWebhooksClient;
    /**
     * Make a passthrough request using the SDK's configured auth, retry, logging, etc.
     * This is useful for making requests to endpoints not yet supported in the SDK.
     * The input can be a URL string, URL object, or Request object. Relative paths are resolved against the configured base URL.
     *
     * @param {Request | string | URL} input - The URL, path, or Request object.
     * @param {RequestInit} init - Standard fetch RequestInit options.
     * @param {core.PassthroughRequest.RequestOptions} requestOptions - Per-request overrides (timeout, retries, headers, abort signal).
     * @returns {Promise<Response>} A standard Response object.
     */
    fetch(input: Request | string | URL, init?: RequestInit, requestOptions?: core.PassthroughRequest.RequestOptions): Promise<Response>;
}
//# sourceMappingURL=Client.d.ts.map