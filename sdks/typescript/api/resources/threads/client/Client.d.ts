import type { BaseClientOptions, BaseRequestOptions } from "../../../../BaseClient.js";
import { type NormalizedClientOptionsWithAuth } from "../../../../BaseClient.js";
import * as core from "../../../../core/index.js";
import * as AgentmailDemoApi from "../../../index.js";
export declare namespace ThreadsClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class ThreadsClient {
    protected readonly _options: NormalizedClientOptionsWithAuth<ThreadsClient.Options>;
    constructor(options?: ThreadsClient.Options);
    /**
     * Returns threads for a given inbox, ordered by most recent activity.
     *
     * @param {AgentmailDemoApi.ListThreadsRequest} request
     * @param {ThreadsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.threads.listThreads({
     *         inbox_email_address: "inbox_email_address"
     *     })
     */
    listThreads(request: AgentmailDemoApi.ListThreadsRequest, requestOptions?: ThreadsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.ThreadList>;
    private __listThreads;
    /**
     * Retrieve a thread with all its messages.
     *
     * @param {AgentmailDemoApi.GetThreadRequest} request
     * @param {ThreadsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.threads.getThread({
     *         id: "id"
     *     })
     */
    getThread(request: AgentmailDemoApi.GetThreadRequest, requestOptions?: ThreadsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.Thread>;
    private __getThread;
    /**
     * Performs vector similarity search across thread messages using pgvector embeddings (Xenova/all-MiniLM-L6-v2). Requires embeddings to be enabled.
     *
     * @param {AgentmailDemoApi.SearchThreadsRequest} request
     * @param {ThreadsClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.BadRequestError}
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.threads.searchThreads({
     *         query: "query"
     *     })
     */
    searchThreads(request: AgentmailDemoApi.SearchThreadsRequest, requestOptions?: ThreadsClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.ThreadSearchList>;
    private __searchThreads;
}
//# sourceMappingURL=Client.d.ts.map