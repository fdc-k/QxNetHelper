import { URL } from 'node:url';
import { z } from 'zod';
export const CONFIG_SCHEMA_VERSION = 1;
export const CONFIG_TIMEZONE = 'Asia/Shanghai';
export const CONFIG_AUTH_MODE = 'tenant_access_token';
export const folderTokenSchema = z
    .string()
    .trim()
    .regex(/^fldcn[0-9A-Za-z]+$/, 'config-dir must be a Feishu folder URL or folder token');
export const folderUrlSchema = z
    .string()
    .url()
    .refine((value) => {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        return false;
    }
    return /^https?:$/.test(url.protocol) && /(^|\.)feishu\.cn$/u.test(url.hostname) && /^\/drive\/folder\//u.test(url.pathname);
}, 'config-dir must be a Feishu folder URL or folder token');
export const subLinkSchema = z
    .string()
    .url('sub-link must be a valid URL')
    .refine((value) => new URL(value).protocol === 'https:', 'sub-link must be a valid HTTPS URL');
export const DEFAULT_MITCE_LINK = 'https://app.mitce.net/?sid=564180&token=srvyubgg';
export const initInputSchema = z.object({
    appId: z.string().trim().min(1, 'app-id is required'),
    appSecret: z.string().trim().min(1, 'app-secret is required'),
    configDir: z.string().trim().min(1, 'config-dir is required'),
    subLink: subLinkSchema,
    mitceLink: subLinkSchema.optional(),
    configRoot: z.string().trim().min(1, 'config-root is required'),
    json: z.boolean(),
});
export const persistedConfigSchema = z.object({
    folderUrl: z.string().url().nullable(),
    folderToken: folderTokenSchema,
    subLink: subLinkSchema,
    mitceLink: subLinkSchema.default(DEFAULT_MITCE_LINK),
    timezone: z.literal(CONFIG_TIMEZONE),
    authMode: z.literal(CONFIG_AUTH_MODE),
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
});
export const persistedSecretsSchema = z.object({
    FEISHU_APP_ID: z.string().min(1),
    FEISHU_APP_SECRET: z.string().min(1),
});
//# sourceMappingURL=schema.js.map