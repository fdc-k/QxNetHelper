import { URL } from 'node:url';
import { CONFIG_AUTH_MODE, CONFIG_SCHEMA_VERSION, CONFIG_TIMEZONE, folderTokenSchema, folderUrlSchema, initInputSchema, persistedConfigSchema, persistedSecretsSchema, } from './schema.js';
export class ValidationError extends Error {
    code = 'validation_failed';
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}
const fromZodError = (error) => {
    const issue = error.issues[0];
    const message = issue?.message ?? 'validation failed';
    return new ValidationError(message);
};
const normalizeFolder = (configDir) => {
    const folderTokenAttempt = folderTokenSchema.safeParse(configDir);
    if (folderTokenAttempt.success) {
        return {
            folderUrl: null,
            folderToken: folderTokenAttempt.data,
        };
    }
    let url;
    try {
        url = new URL(configDir);
    }
    catch {
        throw new ValidationError('config-dir must be a Feishu folder URL or folder token');
    }
    const folderUrlAttempt = folderUrlSchema.safeParse(url.toString());
    if (!folderUrlAttempt.success) {
        throw new ValidationError('config-dir must be a Feishu folder URL or folder token');
    }
    const folderToken = url.pathname.split('/').filter(Boolean).at(-1);
    const folderTokenResult = folderTokenSchema.safeParse(folderToken);
    if (!folderTokenResult.success) {
        throw fromZodError(folderTokenResult.error);
    }
    return {
        folderUrl: folderUrlAttempt.data,
        folderToken: folderTokenResult.data,
    };
};
export const normalizeInitInput = (input) => {
    const parsedInput = initInputSchema.safeParse(input);
    if (!parsedInput.success) {
        throw fromZodError(parsedInput.error);
    }
    const folder = normalizeFolder(parsedInput.data.configDir);
    const config = persistedConfigSchema.parse({
        folderUrl: folder.folderUrl,
        folderToken: folder.folderToken,
        subLink: parsedInput.data.subLink,
        timezone: CONFIG_TIMEZONE,
        authMode: CONFIG_AUTH_MODE,
        schemaVersion: CONFIG_SCHEMA_VERSION,
    });
    const secrets = persistedSecretsSchema.parse({
        FEISHU_APP_ID: parsedInput.data.appId,
        FEISHU_APP_SECRET: parsedInput.data.appSecret,
    });
    return {
        config,
        secrets,
        configRoot: parsedInput.data.configRoot,
        json: parsedInput.data.json,
    };
};
//# sourceMappingURL=normalize.js.map