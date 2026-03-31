import { Buffer } from 'node:buffer';
import { createFeishuRemoteError, FeishuRemoteError } from './errors.js';
const DEFAULT_BASE_URL = 'https://open.feishu.cn';
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_PAGE_SIZE = 200;
const sleepFor = async (milliseconds) => {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
};
const getBackoffMs = (attempt) => {
    return Math.min(100 * 2 ** (attempt - 1), 1_000);
};
export class FeishuDriveClient {
    tokenProvider;
    baseUrl;
    fetchFn;
    sleep;
    maxAttempts;
    constructor(options) {
        this.tokenProvider = options.tokenProvider;
        this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
        this.fetchFn = options.fetchFn ?? fetch;
        this.sleep = options.sleep ?? sleepFor;
        this.maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    }
    async listFolder(folderToken, pageSize = DEFAULT_PAGE_SIZE) {
        const files = [];
        let nextPageToken;
        let hasMore = true;
        while (hasMore) {
            const query = new URLSearchParams({
                page_size: String(pageSize),
            });
            if (nextPageToken) {
                query.set('page_token', nextPageToken);
            }
            const payload = await this.requestJson(`/open-apis/drive/v1/files/${folderToken}/children?${query.toString()}`);
            const pageFiles = (payload.data?.files ?? []).map((file) => {
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
    async downloadFile(fileToken) {
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
    async uploadFile(input) {
        const formData = new FormData();
        formData.append('file_name', input.fileName);
        formData.append('parent_type', 'explorer');
        formData.append('parent_node', input.folderToken);
        formData.append('size', String(input.content.byteLength));
        formData.append('file', new Blob([input.content], { type: input.contentType ?? 'application/octet-stream' }), input.fileName);
        const payload = await this.requestJson('/open-apis/drive/v1/files/upload_all', {
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
    async requestJson(path, init) {
        return this.withRetries(async () => {
            const response = await this.fetchWithAuth(path, init);
            const responseText = await response.text();
            let payload;
            try {
                payload = JSON.parse(responseText);
            }
            catch {
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
    async fetchWithAuth(path, init) {
        const token = await this.tokenProvider.getToken();
        const headers = new Headers(init?.headers ?? {});
        headers.set('Authorization', `Bearer ${token}`);
        return this.fetchFn(`${this.baseUrl}${path}`, {
            ...init,
            headers,
        });
    }
    async withRetries(operation) {
        let lastError;
        for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                if (!this.shouldRetry(error) || attempt === this.maxAttempts) {
                    throw error;
                }
                await this.sleep(getBackoffMs(attempt));
            }
        }
        throw lastError;
    }
    shouldRetry(error) {
        if (error instanceof FeishuRemoteError) {
            return error.retryable;
        }
        return true;
    }
    async toRemoteError(response, fallbackMessage) {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
            const payload = (await response.json());
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
export const createFeishuDriveClient = (options) => {
    return new FeishuDriveClient(options);
};
//# sourceMappingURL=driveClient.js.map