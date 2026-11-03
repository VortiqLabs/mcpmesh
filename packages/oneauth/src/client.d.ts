export type OneAuthClientConfig = {
    issuer: string;
    clientId?: string;
};
export declare class OneAuthClient {
    private readonly config;
    constructor(config: OneAuthClientConfig);
    get issuer(): string;
}
//# sourceMappingURL=client.d.ts.map