import type { BaseClientOptions, BaseRequestOptions } from "../../../../BaseClient.js";
import { type NormalizedClientOptionsWithAuth } from "../../../../BaseClient.js";
import * as core from "../../../../core/index.js";
import * as AgentmailDemoApi from "../../../index.js";
export declare namespace InboxesClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class InboxesClient {
    protected readonly _options: NormalizedClientOptionsWithAuth<InboxesClient.Options>;
    constructor(options?: InboxesClient.Options);
    /**
     * Returns all inboxes for the authenticated account, newest first.
     *
     * @param {AgentmailDemoApi.ListInboxesRequest} request
     * @param {InboxesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     *
     * @example
     *     await client.inboxes.listInboxes()
     */
    listInboxes(request?: AgentmailDemoApi.ListInboxesRequest, requestOptions?: InboxesClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.InboxList>;
    private __listInboxes;
    /**
     * Provisions a new inbox (email address) for the authenticated account.
     *
     * @param {AgentmailDemoApi.CreateInboxRequest} request
     * @param {InboxesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.ConflictError}
     *
     * @example
     *     await client.inboxes.createInbox({
     *         username: "alice",
     *         domain: "yourdomain.com"
     *     })
     */
    createInbox(request: AgentmailDemoApi.CreateInboxRequest, requestOptions?: InboxesClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.Inbox>;
    private __createInbox;
    /**
     * @param {AgentmailDemoApi.GetInboxRequest} request
     * @param {InboxesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.inboxes.getInbox({
     *         id: "id"
     *     })
     */
    getInbox(request: AgentmailDemoApi.GetInboxRequest, requestOptions?: InboxesClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.Inbox>;
    private __getInbox;
    /**
     * Hard-deletes the inbox and stops accepting mail at that address.
     *
     * @param {AgentmailDemoApi.DeleteInboxRequest} request
     * @param {InboxesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.inboxes.deleteInbox({
     *         id: "id"
     *     })
     */
    deleteInbox(request: AgentmailDemoApi.DeleteInboxRequest, requestOptions?: InboxesClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.DeletedResource>;
    private __deleteInbox;
    /**
     * Update display_name or metadata. Address is immutable.
     *
     * @param {AgentmailDemoApi.UpdateInboxRequest} request
     * @param {InboxesClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.inboxes.updateInbox({
     *         id: "id"
     *     })
     */
    updateInbox(request: AgentmailDemoApi.UpdateInboxRequest, requestOptions?: InboxesClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.Inbox>;
    private __updateInbox;
}
//# sourceMappingURL=Client.d.ts.map