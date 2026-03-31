import { type SubscriptionProxy } from './extractTail.js';
type FetchLike = typeof fetch;
export type FetchSubscriptionOptions = {
    readonly fetchFn?: FetchLike;
};
type SubscriptionRemoteErrorOptions = {
    readonly message: string;
    readonly status?: number;
};
export declare const fetchSubscriptionSource: (url: string, options?: FetchSubscriptionOptions) => Promise<string>;
export declare class SubscriptionRemoteError extends Error {
    readonly code = "remote_failed";
    readonly exitCode = 3;
    readonly status?: number;
    constructor(options: SubscriptionRemoteErrorOptions);
}
export declare const fetchSubscriptionTail: (url: string, options?: FetchSubscriptionOptions) => Promise<SubscriptionProxy[]>;
export {};
//# sourceMappingURL=fetch.d.ts.map