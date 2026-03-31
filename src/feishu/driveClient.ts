import { Buffer } from 'node:buffer';

import type { TenantAccessTokenProvider } from './auth.js';
import { createFeishuRemoteError, FeishuRemoteError } from './errors.js';

type FetchLike = typeof fetch;

type SleepFn = (milliseconds: number) => Promise<void>;

type FeishuEnvelope<T> = {
  readonly code?: number;
  readonly msg?: string;
  readonly data?: T;
};

type FolderChildrenResponse = {
  readonly files?: readonly RawDriveItem[];
  readonly has_more?: boolean;
  readonly next_page_token?: string;
};

type UploadResponse = {
  readonly file_token?: string;
};

type RawDriveItem = {
  readonly token: string;
  readonly name: string;
  readonly type?: string;
  readonly modified_time?: string;
};

export type DriveItem = {
  readonly token: string;
  readonly name: string;
  readonly type?: string;
  readonly modifiedTime?: string;
};

export type UploadFileInput = {
  readonly folderToken: string;
  readonly fileName: string;
  readonly content: Uint8Array;
  readonly contentType?: string;
};

export type UploadFileResult = {
  readonly fileToken: string;
};

export type FeishuDriveClientOptions = {
  readonly tokenProvider: TenantAccessTokenProvider;
  readonly baseUrl?: string;
  readonly fetchFn?: FetchLike;
  readonly sleep?: SleepFn;
  readonly maxAttempts?: number;
};

const DEFAULT_BASE_URL = 'https://open.feishu.cn';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 200;

const sleepFor = async (milliseconds: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const getBackoffMs = (attempt: number): number => {
  return Math.min(100 * 2 ** (attempt - 1), 1_000);
};

export class FeishuDriveClient {
  private readonly tokenProvider: TenantAccessTokenProvider;
  private readonly baseUrl: string;
  private readonly fetchFn: FetchLike;
  private readonly sleep: SleepFn;
  private readonly maxAttempts: number;

  public constructor(options: FeishuDriveClientOptions) {
    this.tokenProvider = options.tokenProvider;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = options.fetchFn ?? fetch;
    this.sleep = options.sleep ?? sleepFor;
    this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  }

  public async listFolder(folderToken: string, pageSize = DEFAULT_PAGE_SIZE): Promise<readonly DriveItem[]> {
    const files: DriveItem[] = [];
    let nextPageToken: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const query = new URLSearchParams({
        page_size: String(pageSize),
      });

      if (nextPageToken) {
        query.set('page_token', nextPageToken);
      }

      const payload = await this.requestJson<FolderChildrenResponse>(
        `/open-apis/drive/v1/files/${folderToken}/children?${query.toString()}`,
      );

      const pageFiles = (payload.data?.files ?? []).map<DriveItem>((file) => {
        return {
          token: file.token,
          name: file.name,
          type: file.type,
          modifiedTime: file.modified_time,
        };
      });
      files.push(...pageFiles);
      hasMore = payload.data?.has_more ?? false;
      nextPageToken = payload.data?.next_page_token;

      if (hasMore && !nextPageToken) {
        throw new FeishuRemoteError({
          code: 'remote_failed',
          message: 'Feishu folder listing indicated more pages but did not provide a next_page_token',
        });
      }
    }

    return files;
  }

  public async downloadFile(fileToken: string): Promise<Buffer> {
    return this.withRetries(async () => {
      const response = await this.fetchWithAuth(`/open-apis/drive/v1/files/${fileToken}/download`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw await this.toRemoteError(response, 'Feishu file download failed');
      }

      return Buffer.from(await response.arrayBuffer());
    });
  }

  public async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const formData = new FormData();
    formData.append('file_name', input.fileName);
    formData.append('parent_type', 'explorer');
    formData.append('parent_node', input.folderToken);
    formData.append('size', String(input.content.byteLength));
    formData.append('file', new Blob([input.content], { type: input.contentType ?? 'application/octet-stream' }), input.fileName);

    const payload = await this.requestJson<UploadResponse>('/open-apis/drive/v1/files/upload_all', {
      method: 'POST',
      body: formData,
    });
    const fileToken = payload.data?.file_token;

    if (!fileToken) {
      throw new FeishuRemoteError({
        code: 'remote_failed',
        message: 'Feishu upload response was missing the file token',
      });
    }

    return { fileToken };
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<FeishuEnvelope<T>> {
    return this.withRetries(async () => {
      const response = await this.fetchWithAuth(path, init);
      const responseText = await response.text();
      let payload: FeishuEnvelope<T>;

      try {
        payload = JSON.parse(responseText) as FeishuEnvelope<T>;
      } catch {
        throw createFeishuRemoteError({
          status: response.status,
          message: responseText,
          fallbackMessage: 'Feishu request failed',
        });
      }

      if (!response.ok) {
        throw createFeishuRemoteError({
          status: response.status,
          feishuCode: payload.code,
          message: payload.msg,
          fallbackMessage: 'Feishu request failed',
        });
      }

      if (payload.code !== undefined && payload.code !== 0) {
        throw createFeishuRemoteError({
          feishuCode: payload.code,
          message: payload.msg,
          fallbackMessage: 'Feishu request failed',
        });
      }

      return payload;
    });
  }

  private async fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
    const token = await this.tokenProvider.getToken();
    const headers = new Headers(init?.headers ?? {});
    headers.set('Authorization', `Bearer ${token}`);

    return this.fetchFn(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });
  }

  private async withRetries<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.shouldRetry(error) || attempt === this.maxAttempts) {
          throw error;
        }

        await this.sleep(getBackoffMs(attempt));
      }
    }

    throw lastError;
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof FeishuRemoteError) {
      return error.retryable;
    }

    return true;
  }

  private async toRemoteError(response: Response, fallbackMessage: string): Promise<FeishuRemoteError> {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as FeishuEnvelope<unknown>;

      return createFeishuRemoteError({
        status: response.status,
        feishuCode: payload.code,
        message: payload.msg,
        fallbackMessage,
      });
    }

    const message = await response.text();

    return createFeishuRemoteError({
      status: response.status,
      message,
      fallbackMessage,
    });
  }
}

export const createFeishuDriveClient = (options: FeishuDriveClientOptions): FeishuDriveClient => {
  return new FeishuDriveClient(options);
};
