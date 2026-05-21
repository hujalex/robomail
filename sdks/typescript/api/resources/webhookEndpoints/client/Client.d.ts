import type { BaseClientOptions, BaseRequestOptions } from "../../../../BaseClient.js";
import { type NormalizedClientOptionsWithAuth } from "../../../../BaseClient.js";
import * as core from "../../../../core/index.js";
import * as AgentmailDemoApi from "../../../index.js";
export declare namespace WebhookEndpointsClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class WebhookEndpointsClient {
    protected readonly _options: NormalizedClientOptionsWithAuth<WebhookEndpointsClient.Options>;
    constructor(options?: WebhookEndpointsClient.Options);
    /**
     * @param {WebhookEndpointsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @example
     *     await client.webhookEndpoints.listWebhookEndpoints()
     */
    listWebhookEndpoints(requestOptions?: WebhookEndpointsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.WebhookEndpointList>;
    private __listWebhookEndpoints;
    /**
     * Register a URL to receive event deliveries. The signing_secret is returned only on creation — store it securely.
     *
     * @param {AgentmailDemoApi.CreateWebhookEndpointRequest} request
     * @param {WebhookEndpointsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     *
     * @example
     *     await client.webhookEndpoints.createWebhookEndpoint({
     *         url: "url"
     *     })
     */
    createWebhookEndpoint(request: AgentmailDemoApi.CreateWebhookEndpointRequest, requestOptions?: WebhookEndpointsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.WebhookEndpointWithSecret>;
    private __createWebhookEndpoint;
    /**
     * Returns the endpoint. signing_secret is NOT included.
     *
     * @param {AgentmailDemoApi.GetWebhookEndpointRequest} request
     * @param {WebhookEndpointsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.webhookEndpoints.getWebhookEndpoint({
     *         id: "id"
     *     })
     */
    getWebhookEndpoint(request: AgentmailDemoApi.GetWebhookEndpointRequest, requestOptions?: WebhookEndpointsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.WebhookEndpoint>;
    private __getWebhookEndpoint;
    /**
     * @param {AgentmailDemoApi.DeleteWebhookEndpointRequest} request
     * @param {WebhookEndpointsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.webhookEndpoints.deleteWebhookEndpoint({
     *         id: "id"
     *     })
     */
    deleteWebhookEndpoint(request: AgentmailDemoApi.DeleteWebhookEndpointRequest, requestOptions?: WebhookEndpointsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.DeletedResource>;
    private __deleteWebhookEndpoint;
    /**
     * @param {AgentmailDemoApi.UpdateWebhookEndpointRequest} request
     * @param {WebhookEndpointsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.webhookEndpoints.updateWebhookEndpoint({
     *         id: "id"
     *     })
     */
    updateWebhookEndpoint(request: AgentmailDemoApi.UpdateWebhookEndpointRequest, requestOptions?: WebhookEndpointsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.WebhookEndpoint>;
    private __updateWebhookEndpoint;
    /**
     * Generates a new signing secret. Returns the new value once — store it immediately.
     *
     * @param {AgentmailDemoApi.RotateWebhookSecretRequest} request
     * @param {WebhookEndpointsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.webhookEndpoints.rotateWebhookSecret({
     *         id: "id"
     *     })
     */
    rotateWebhookSecret(request: AgentmailDemoApi.RotateWebhookSecretRequest, requestOptions?: WebhookEndpointsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.RotateWebhookSecretResponse>;
    private __rotateWebhookSecret;
}
//# sourceMappingURL=Client.d.ts.map