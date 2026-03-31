type FetchLike = typeof fetch;
export type TenantAccessTokenProviderOptions = {
    readonly appId: string;
    readonly appSecret: string;
    readonly baseUrl?: string;
    readonly fetchFn?: FetchLike;
    readonly now?: () => number;
    readonly sleep?: (milliseconds: number) => Promise<void>;
    readonly maxAttempts?: number;
};
export declare class TenantAccessTokenProvider {
    private readonly appId;
    private readonly appSecret;
    private readonly baseUrl;
    private readonly fetchFn;
    private readonly now;
    private readonly sleep;
    private readonly maxAttempts;
    private cachedToken;
    constructor(options: TenantAccessTokenProviderOptions);
    getToken(): Promise<string>;
    private withRetries;
}
export declare const createTenantAccessTokenProvider: (options: TenantAccessTokenProviderOptions) => TenantAccessTokenProvider;
export {};
//# sourceMappingURL=auth.d.ts.map