import { Buffer } from 'node:buffer';
import { type ConfigFileLike } from '../yaml/configFiles.js';
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
export type UpdateEnvWorkflowInput = {
    readonly configRoot: string;
    readonly folderToken: string;
    readonly envId: string;
    readonly region: string;
    readonly ip: string;
    readonly nodeUrl: string;
};
export type UpdateEnvWorkflowResult = {
    readonly ok: true;
    readonly command: 'update-env';
    readonly configRoot: string;
    readonly folderToken: string;
    readonly sourceFile: string;
    readonly outputFile: string;
    readonly envId: string;
    readonly proxyName: string;
    readonly region: string;
    readonly ip: string;
    readonly diff: string;
};
export type UpdateEnvWorkflowDependencies = {
    readonly driveClient: DriveClientLike;
    readonly now?: () => Date;
};
export declare const runUpdateEnvWorkflow: (input: UpdateEnvWorkflowInput, dependencies: UpdateEnvWorkflowDependencies) => Promise<UpdateEnvWorkflowResult>;
export {};
//# sourceMappingURL=updateEnv.d.ts.map