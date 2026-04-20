import { Buffer } from 'node:buffer';
import type { SubscriptionProxy } from '../subscription/extractTail.js';
import type { ConfigFileLike } from '../yaml/configFiles.js';
type DriveFile = ConfigFileLike & {
    readonly token: string;
    readonly modifiedTime?: string;
};
type DriveClientLike = {
    listFolder(folderToken: string): Promise<readonly DriveFile[]>;
    downloadFile(fileToken: string): Promise<Buffer>;
    uploadFile(input: {
        readonly folderToken: string;
        readonly fileName: string;
        readonly content: Uint8Array;
        readonly contentType?: string;
    }): Promise<{
        readonly fileToken: string;
    }>;
};
export type RefreshBaseWorkflowInput = {
    readonly configRoot: string;
    readonly folderToken: string;
    readonly subscriptionUrl: string;
    readonly subscriptionTail: readonly SubscriptionProxy[];
    readonly mitceSubscriptionUrl: string;
    readonly mitceNodes: readonly SubscriptionProxy[];
};
export type RefreshBaseWorkflowResult = {
    readonly ok: true;
    readonly command: 'refresh-base';
    readonly configRoot: string;
    readonly folderToken: string;
    readonly sourceFile: string;
    readonly outputFile: string;
    readonly subscriptionUrl: string;
    readonly replacedProxyCount: number;
    readonly trafficResetIndex: number;
    readonly mitceSubscriptionUrl: string;
    readonly mitceReplacedCount: number;
    readonly diff: string;
};
export type RefreshBaseWorkflowDependencies = {
    readonly driveClient: DriveClientLike;
    readonly now?: () => Date;
};
export declare const runRefreshBaseWorkflow: (input: RefreshBaseWorkflowInput, dependencies: RefreshBaseWorkflowDependencies) => Promise<RefreshBaseWorkflowResult>;
export {};
//# sourceMappingURL=refreshBase.d.ts.map