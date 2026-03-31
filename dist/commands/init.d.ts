import type { FolderAccessValidator } from '../config/folderAccess.js';
export type InitCommandOptions = {
    readonly appId: string;
    readonly appSecret: string;
    readonly configDir: string;
    readonly subLink: string;
    readonly configRoot: string;
    readonly json?: boolean;
};
export type InitCommandDependencies = {
    readonly folderAccessValidator: FolderAccessValidator;
    readonly writeOutput: (line: string) => void;
    readonly writeError: (line: string) => void;
};
export type InitCommandResult = {
    readonly ok: true;
    readonly command: 'init';
    readonly configRoot: string;
    readonly folderToken: string;
    readonly subLink: string;
    readonly secrets: 'redacted';
};
export type CommandFailureResult = {
    readonly ok: false;
    readonly command: 'init';
    readonly error: {
        readonly code: 'validation_failed' | 'remote_failed' | 'remote_forbidden' | 'remote_not_found';
        readonly message: string;
    };
};
export declare const runInitCommand: (options: InitCommandOptions, dependencies?: Partial<InitCommandDependencies>) => Promise<InitCommandResult>;
export declare const initCommand: (options: InitCommandOptions) => Promise<void>;
//# sourceMappingURL=init.d.ts.map