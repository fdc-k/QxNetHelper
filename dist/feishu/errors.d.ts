export declare const FEISHU_RETRYABLE_ERROR_CODE = 1061045;
export declare const REMOTE_ERROR_EXIT_CODE = 3;
export type FeishuRemoteErrorCode = 'remote_failed' | 'remote_forbidden' | 'remote_not_found';
export type FeishuRemoteErrorOptions = {
    readonly code: FeishuRemoteErrorCode;
    readonly message: string;
    readonly status?: number;
    readonly feishuCode?: number;
    readonly retryable?: boolean;
};
export declare class FeishuRemoteError extends Error {
    readonly code: FeishuRemoteErrorCode;
    readonly exitCode = 3;
    readonly status?: number;
    readonly feishuCode?: number;
    readonly retryable: boolean;
    constructor(options: FeishuRemoteErrorOptions);
}
export declare const isRetryableStatus: (status: number) => boolean;
export declare const isRetryableFeishuCode: (code: number | undefined) => boolean;
export declare const createFeishuRemoteError: (options: {
    readonly status?: number;
    readonly feishuCode?: number;
    readonly message?: string;
    readonly fallbackMessage: string;
}) => FeishuRemoteError;
//# sourceMappingURL=errors.d.ts.map