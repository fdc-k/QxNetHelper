import { createFeishuRemoteError, FeishuRemoteError } from './errors.js';

type FetchLike = typeof fetch;

type TokenResponse = {
  readonly code?: number;
  readonly msg?: string;
  readonly tenant_access_token?: string;
  readonly expire?: number;
};

export type TenantAccessTokenProviderOptions = {
  readonly appId: string;
  readonly appSecret: string;
  readonly baseUrl?: string;
  readonly fetchFn?: FetchLike;
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly maxAttempts?: number;
};

type CachedToken = {
  readonly value: string;
  readonly refreshAt: number;
};

const DEFAULT_BASE_URL = 'https://open.feishu.cn';
const DEFAULT_MAX_ATTEMPTS = 3;
const REFRESH_BUFFER_SECONDS = 60;

const sleepFor = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const getBackoffMs = (attempt: number): number => {
  return Math.min(100 * 2 ** (attempt - 1), 1_000);
};

const calculateRefreshAt = (now: number, expireSeconds: number): number => {
  const safeExpireSeconds = Math.max(expireSeconds, 0);
  const refreshSeconds = Math.max(0, safeExpireSeconds - REFRESH_BUFFER_SECONDS);

  return now + refreshSeconds * 1000;
};

export class TenantAccessTokenProvider {
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly maxAttempts: number;
  private cachedToken: CachedToken | null = null;

  public constructor(options: TenantAccessTokenProviderOptions) {
    this.appId = options.appId;
    this.appSecret = options.appSecret;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? sleepFor;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  }

  public async getToken(): Promise<string> {
    if (this.cachedToken !== null && this.now() < this.cachedToken.refreshAt) {
      return this.cachedToken.value;
    }

    const payload = await this.withRetries(async () => {
      const response = await this.fetchFn(`${this.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret,
        }),
      });

      let result: TokenResponse;

      try {
        result = (await response.json()) as TokenResponse;
      } catch {
        throw new FeishuRemoteError({
          code: 'remote_failed',
          message: 'Feishu returned an invalid authentication response',
        });
      }

      if (!response.ok) {
        throw createFeishuRemoteError({
          status: response.status,
          feishuCode: result.code,
          message: result.msg,
          fallbackMessage: 'Feishu authentication failed',
        });
      }

      if (result.code !== undefined && result.code !== 0) {
        throw createFeishuRemoteError({
          feishuCode: result.code,
          message: result.msg,
          fallbackMessage: 'Feishu authentication failed',
        });
      }

      if (!result.tenant_access_token || typeof result.expire !== 'number') {
        throw new FeishuRemoteError({
          code: 'remote_failed',
          message: 'Feishu authentication response was missing token fields',
        });
      }

      return result;
    });

    if (!payload.tenant_access_token || typeof payload.expire !== 'number') {
      throw new FeishuRemoteError({
        code: 'remote_failed',
        message: 'Feishu authentication response was missing token fields',
      });
    }

    const now = this.now();
    const token = payload.tenant_access_token;
    const expire = payload.expire;

    this.cachedToken = {
      value: token,
      refreshAt: calculateRefreshAt(now, expire),
    };

    return token;
  }

  private async withRetries<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!(error instanceof FeishuRemoteError) || !error.retryable || attempt === this.maxAttempts) {
          throw error;
        }

        await this.sleep(getBackoffMs(attempt));
      }
    }

    throw lastError;
  }
}

export const createTenantAccessTokenProvider = (options: TenantAccessTokenProviderOptions): TenantAccessTokenProvider => {
  return new TenantAccessTokenProvider(options);
};
