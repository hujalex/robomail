import type { BaseClientOptions, BaseRequestOptions } from "../../../../BaseClient.js";
import { type NormalizedClientOptions } from "../../../../BaseClient.js";
import * as core from "../../../../core/index.js";
import * as AgentmailDemoApi from "../../../index.js";
export declare namespace InternalWebhooksClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class InternalWebhooksClient {
    protected readonly _options: NormalizedClientOptions<InternalWebhooksClient.Options>;
    constructor(options?: InternalWebhooksClient.Options);
    /**
     * Internal endpoint called by the inbound mail provider (e.g. CloudMailin) when external mail arrives at one of your inboxes. Verified via HMAC signature in the X-AgentMail-Signature header.
     *
     * @param {Record<string, unknown>} request
     * @param {InternalWebhooksClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.UnauthorizedError}
     *
     * @example
     *     await client.internalWebhooks.receiveInboundMail({
     *         "key": "value"
     *     })
     */
    receiveInboundMail(request: Record<string, unknown>, requestOptions?: InternalWebhooksClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.ReceiveInboundMailResponse>;
    private __receiveInboundMail;
    /**
     * Internal endpoint called by the outbound provider with delivery/bounce status updates.
     *
     * @param {Record<string, unknown>} request
     * @param {InternalWebhooksClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.UnauthorizedError}
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.internalWebhooks.receiveOutboundStatus({
     *         "key": "value"
     *     })
     */
    receiveOutboundStatus(request: Record<string, unknown>, requestOptions?: InternalWebhooksClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.ReceiveOutboundStatusResponse>;
    private __receiveOutboundStatus;
}
//# sourceMappingURL=Client.d.ts.map