export interface GetMeResponse {
    account: GetMeResponse.Account;
    api_key: GetMeResponse.ApiKey;
}
export declare namespace GetMeResponse {
    interface Account {
        id: string;
        name: string;
        created_at: string;
    }
    interface ApiKey {
        id: string;
        name: string;
        prefix: string;
    }
}
//# sourceMappingURL=GetMeResponse.d.ts.map