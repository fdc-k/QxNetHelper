export const FEISHU_RETRYABLE_ERROR_CODE = 1061045;
export const REMOTE_ERROR_EXIT_CODE = 3;
export class FeishuRemoteError extends Error {
    code;
    exitCode = REMOTE_ERROR_EXIT_CODE;
    status;
    feishuCode;
    retryable;
    constructor(options) {
        super(options.message);
        this.name = 'FeishuRemoteError';
        this.code = options.code;
        this.status = options.status;
        this.feishuCode = options.feishuCode;
        this.retryable = options.retryable ?? false;
    }
}
const sanitizeMessage = (message, fallback) => {
    const normalized = message?.trim();
    return normalized && normalized.length > 0 ? normalized : fallback;
};
export const isRetryableStatus = (status) => {
    return status === 429 || status >= 500;
};
export const isRetryableFeishuCode = (code) => {
    return code === FEISHU_RETRYABLE_ERROR_CODE;
};
export const createFeishuRemoteError = (options) => {
    const status = options.status;
    const feishuCode = options.feishuCode;
    if (status === 403) {
        return new FeishuRemoteError({
            code: 'remote_forbidden',
            message: 'Feishu denied access to the requested folder or file',
            status,
        });
    }
    if (status === 404) {
        return new FeishuRemoteError({
            code: 'remote_not_found',
            message: 'Feishu could not find the requested folder or file',
            status,
        });
    }
    return new FeishuRemoteError({
        code: 'remote_failed',
        message: sanitizeMessage(options.message, options.fallbackMessage),
        status,
        feishuCode,
        retryable: (status !== undefined && isRetryableStatus(status)) || isRetryableFeishuCode(feishuCode),
    });
};
//# sourceMappingURL=errors.js.map