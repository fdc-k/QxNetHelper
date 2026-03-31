import { Buffer } from 'node:buffer';
import type { TenantAccessTokenProvider } from './auth.js';
type FetchLike = typeof fetch;
type SleepFn = (milliseconds: number) => Promise<void>;
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
export declare class FeishuDriveClient {
    private readonly tokenProvider;
    private readonly baseUrl;
    private readonly fetchFn;
    private readonly sleep;
    private readonly maxAttempts;
    constructor(options: FeishuDriveClientOptions);
    listFolder(folderToken: string, pageSize?: number): Promise<readonly DriveItem[]>;
    downloadFile(fileToken: string): Promise<Buffer>;
    uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
    private requestJson;
    private fetchWithAuth;
    private withRetries;
    private shouldRetry;
    private toRemoteError;
}
export declare const createFeishuDriveClient: (options: FeishuDriveClientOptions) => FeishuDriveClient;
export {};
//# sourceMappingURL=driveClient.d.ts.map