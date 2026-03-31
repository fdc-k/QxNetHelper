import { type FeishuDriveClient } from '../feishu/driveClient.js';
import { type UpdateEnvWorkflowResult } from '../workflows/updateEnv.js';
export type UpdateEnvCommandOptions = {
    readonly envId: string;
    readonly region: string;
    readonly ip: string;
    readonly nodeUrl: string;
    readonly configRoot: string;
    readonly json?: boolean;
};
type UpdateEnvCommandDependencies = {
    readonly writeOutput: (line: string) => void;
    readonly writeError: (line: string) => void;
    readonly now?: () => Date;
    readonly createDriveClient?: (input: {
        readonly appId: string;
        readonly appSecret: string;
    }) => FeishuDriveClient;
};
export declare const runUpdateEnvCommand: (options: UpdateEnvCommandOptions, dependencies?: Partial<UpdateEnvCommandDependencies>) => Promise<UpdateEnvWorkflowResult>;
export declare const updateEnvCommand: (options: UpdateEnvCommandOptions) => Promise<void>;
export {};
//# sourceMappingURL=updateEnv.d.ts.map