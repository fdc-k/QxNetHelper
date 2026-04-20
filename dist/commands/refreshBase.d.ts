import { type FeishuDriveClient } from '../feishu/driveClient.js';
import { fetchSubscriptionTail } from '../subscription/fetch.js';
import { type RefreshBaseWorkflowResult } from '../workflows/refreshBase.js';
export type RefreshBaseCommandOptions = {
    readonly configRoot: string;
    readonly json?: boolean;
};
type RefreshBaseCommandDependencies = {
    readonly writeOutput: (line: string) => void;
    readonly writeError: (line: string) => void;
    readonly now?: () => Date;
    readonly createDriveClient?: (input: {
        readonly appId: string;
        readonly appSecret: string;
    }) => FeishuDriveClient;
    readonly fetchTail?: (url: string) => ReturnType<typeof fetchSubscriptionTail>;
    readonly fetchMitceSource?: (url: string) => Promise<string>;
};
export declare const runRefreshBaseCommand: (options: RefreshBaseCommandOptions, dependencies?: Partial<RefreshBaseCommandDependencies>) => Promise<RefreshBaseWorkflowResult>;
export declare const refreshBaseCommand: (options: RefreshBaseCommandOptions) => Promise<void>;
export {};
//# sourceMappingURL=refreshBase.d.ts.map