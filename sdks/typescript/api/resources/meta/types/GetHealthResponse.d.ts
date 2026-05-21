export interface GetHealthResponse {
    status: GetHealthResponse.Status;
    version: string;
    uptime_seconds: number;
}
export declare namespace GetHealthResponse {
    const Status: {
        readonly Ok: "ok";
    };
    type Status = (typeof Status)[keyof typeof Status];
}
//# sourceMappingURL=GetHealthResponse.d.ts.map