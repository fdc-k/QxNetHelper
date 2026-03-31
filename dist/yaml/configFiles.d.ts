export type ConfigFileLike = {
    readonly name: string;
    readonly modifiedTime?: string | null;
    readonly fileToken?: string | null;
};
export type ParsedConfigFileName = {
    readonly name: string;
    readonly month: number;
    readonly day: number;
    readonly sequence: number;
    readonly extension: 'yaml' | 'yml';
};
export declare const parseConfigFileName: (fileName: string) => ParsedConfigFileName | null;
export declare const selectLatestConfigFile: <T extends ConfigFileLike>(files: readonly T[], now?: Date) => T | null;
export declare const getNextConfigFileName: (files: readonly ConfigFileLike[], now?: Date) => string;
export declare const getConfigTimezone: () => string;
//# sourceMappingURL=configFiles.d.ts.map