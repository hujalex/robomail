import type { BaseClientOptions, BaseRequestOptions } from "../../../../BaseClient.js";
import { type NormalizedClientOptionsWithAuth } from "../../../../BaseClient.js";
import * as core from "../../../../core/index.js";
import * as AgentmailDemoApi from "../../../index.js";
export declare namespace MessagesClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class MessagesClient {
    protected readonly _options: NormalizedClientOptionsWithAuth<MessagesClient.Options>;
    constructor(options?: MessagesClient.Options);
    /**
     * List messages with optional filters. Returns newest first.
     *
     * @param {AgentmailDemoApi.ListMessagesRequest} request
     * @param {MessagesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.messages.listMessages()
     */
    listMessages(request?: AgentmailDemoApi.ListMessagesRequest, requestOptions?: MessagesClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.MessageList>;
    private __listMessages;
    /**
     * Send an outbound email. Creates a new thread unless in_reply_to_thread_id is provided, in which case the message is appended to that thread.
     *
     * @param {AgentmailDemoApi.SendMessageRequest} request
     * @param {MessagesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.messages.sendMessage({
     *         inbox_email_address: "inbox_email_address",
     *         to: "to"
     *     })
     */
    sendMessage(request: AgentmailDemoApi.SendMessageRequest, requestOptions?: MessagesClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.Message>;
    private __sendMessage;
    /**
     * @param {AgentmailDemoApi.GetMessageRequest} request
     * @param {MessagesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.messages.getMessage({
     *         id: "id"
     *     })
     */
    getMessage(request: AgentmailDemoApi.GetMessageRequest, requestOptions?: MessagesClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.Message>;
    private __getMessage;
    /**
     * Returns the raw RFC 822 (.eml) source of a message.
     *
     * @param {AgentmailDemoApi.GetRawMessageRequest} request
     * @param {MessagesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.messages.getRawMessage({
     *         id: "id"
     *     })
     */
    getRawMessage(request: AgentmailDemoApi.GetRawMessageRequest, requestOptions?: MessagesClient.RequestOptions): core.HttpResponsePromise<string>;
    private __getRawMessage;
}
//# sourceMappingURL=Client.d.ts.map