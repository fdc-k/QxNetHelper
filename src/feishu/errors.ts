export const FEISHU_RETRYABLE_ERROR_CODE = 1061045;
export const REMOTE_ERROR_EXIT_CODE = 3;

export type FeishuRemoteErrorCode = 'remote_failed' | 'remote_forbidden' | 'remote_not_found';

export type FeishuRemoteErrorOptions = {
  readonly code: FeishuRemoteErrorCode;
  readonly message: string;
  readonly status?: number;
  readonly feishuCode?: number;
  readonly retryable?: boolean;
};

export class FeishuRemoteError extends Error {
  public readonly code: FeishuRemoteErrorCode;
  public readonly exitCode = REMOTE_ERROR_EXIT_CODE;
  public readonly status?: number;
  public readonly feishuCode?: number;
  public readonly retryable: boolean;

  public constructor(options: FeishuRemoteErrorOptions) {
    super(options.message);
    this.name = 'FeishuRemoteError';
    this.code = options.code;
    this.status = options.status;
    this.feishuCode = options.feishuCode;
    this.retryable = options.retryable ?? false;
  }
}

const sanitizeMessage = (message: string | undefined, fallback: string): string => {
  const normalized = message?.trim();

  return normalized && normalized.length > 0 ? normalized : fallback;
};

export const isRetryableStatus = (status: number): boolean => {
  return status === 429 || status >= 500;
};

export const isRetryableFeishuCode = (code: number | undefined): boolean => {
  return code === FEISHU_RETRYABLE_ERROR_CODE;
};

export const createFeishuRemoteError = (options: {
  readonly status?: number;
  readonly feishuCode?: number;
  readonly message?: string;
  readonly fallbackMessage: string;
}): FeishuRemoteError => {
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
