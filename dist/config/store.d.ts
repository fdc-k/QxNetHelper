import { type PersistedConfig, type PersistedSecrets } from './schema.js';
export type StoredConfigPaths = {
    readonly baseDir: string;
    readonly envFile: string;
    readonly configFile: string;
};
export declare const resolveConfigPaths: (configRoot: string) => StoredConfigPaths;
export declare const persistConfig: (configRoot: string, config: PersistedConfig, secrets: PersistedSecrets) => Promise<StoredConfigPaths>;
export declare const readStoredEnv: (envFile: string) => Promise<string | null>;
export declare const readStoredConfig: (configFile: string) => Promise<string | null>;
export declare const loadPersistedState: (configRoot: string) => Promise<{
    readonly paths: StoredConfigPaths;
    readonly config: PersistedConfig;
    readonly secrets: PersistedSecrets;
}>;
//# sourceMappingURL=store.d.ts.map