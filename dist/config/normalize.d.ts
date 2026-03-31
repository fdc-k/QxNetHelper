import { type InitInput, type PersistedConfig, type PersistedSecrets } from './schema.js';
export declare class ValidationError extends Error {
    readonly code = "validation_failed";
    constructor(message: string);
}
export type NormalizedInitConfig = {
    readonly config: PersistedConfig;
    readonly secrets: PersistedSecrets;
    readonly configRoot: string;
    readonly json: boolean;
};
export declare const normalizeInitInput: (input: InitInput) => NormalizedInitConfig;
//# sourceMappingURL=normalize.d.ts.map