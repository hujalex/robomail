import type { BaseClientOptions, BaseRequestOptions } from "../../../../BaseClient.js";
import { type NormalizedClientOptionsWithAuth } from "../../../../BaseClient.js";
import * as core from "../../../../core/index.js";
import * as AgentmailDemoApi from "../../../index.js";
export declare namespace MetaClient {
    type Options = BaseClientOptions;
    interface RequestOptions extends BaseRequestOptions {
    }
}
export declare class MetaClient {
    protected readonly _options: NormalizedClientOptionsWithAuth<MetaClient.Options>;
    constructor(options?: MetaClient.Options);
    /**
     * Unauthenticated liveness probe.
     *
     * @param {MetaClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @example
     *     await client.meta.getHealth()
     */
    getHealth(requestOptions?: MetaClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.GetHealthResponse>;
    private __getHealth;
    /**
     * Returns info about the authenticated account and API key.
     *
     * @param {MetaClient.RequestOptions} requestOptions - Request-specific configuration.
     *
     * @throws {@link AgentmailDemoApi.NotFoundError}
     *
     * @example
     *     await client.meta.getMe()
     */
    getMe(requestOptions?: MetaClient.RequestOptions): core.HttpResponsePromise<AgentmailDemoApi.GetMeResponse>;
    private __getMe;
}
//# sourceMappingURL=Client.d.ts.map