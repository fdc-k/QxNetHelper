import { z } from 'zod';
export declare const CONFIG_SCHEMA_VERSION = 1;
export declare const CONFIG_TIMEZONE = "Asia/Shanghai";
export declare const CONFIG_AUTH_MODE = "tenant_access_token";
export declare const folderTokenSchema: z.ZodString;
export declare const folderUrlSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const subLinkSchema: z.ZodEffects<z.ZodString, string, string>;
export declare const DEFAULT_MITCE_LINK = "https://app.mitce.net/?sid=564180&token=srvyubgg";
export declare const initInputSchema: z.ZodObject<{
    appId: z.ZodString;
    appSecret: z.ZodString;
    configDir: z.ZodString;
    subLink: z.ZodEffects<z.ZodString, string, string>;
    mitceLink: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    configRoot: z.ZodString;
    json: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    appId: string;
    appSecret: string;
    configDir: string;
    subLink: string;
    configRoot: string;
    json: boolean;
    mitceLink?: string | undefined;
}, {
    appId: string;
    appSecret: string;
    configDir: string;
    subLink: string;
    configRoot: string;
    json: boolean;
    mitceLink?: string | undefined;
}>;
export declare const persistedConfigSchema: z.ZodObject<{
    folderUrl: z.ZodNullable<z.ZodString>;
    folderToken: z.ZodString;
    subLink: z.ZodEffects<z.ZodString, string, string>;
    mitceLink: z.ZodDefault<z.ZodEffects<z.ZodString, string, string>>;
    timezone: z.ZodLiteral<"Asia/Shanghai">;
    authMode: z.ZodLiteral<"tenant_access_token">;
    schemaVersion: z.ZodLiteral<1>;
}, "strip", z.ZodTypeAny, {
    subLink: string;
    mitceLink: string;
    folderUrl: string | null;
    folderToken: string;
    timezone: "Asia/Shanghai";
    authMode: "tenant_access_token";
    schemaVersion: 1;
}, {
    subLink: string;
    folderUrl: string | null;
    folderToken: string;
    timezone: "Asia/Shanghai";
    authMode: "tenant_access_token";
    schemaVersion: 1;
    mitceLink?: string | undefined;
}>;
export declare const persistedSecretsSchema: z.ZodObject<{
    FEISHU_APP_ID: z.ZodString;
    FEISHU_APP_SECRET: z.ZodString;
}, "strip", z.ZodTypeAny, {
    FEISHU_APP_ID: string;
    FEISHU_APP_SECRET: string;
}, {
    FEISHU_APP_ID: string;
    FEISHU_APP_SECRET: string;
}>;
export type InitInput = z.infer<typeof initInputSchema>;
export type PersistedConfig = z.infer<typeof persistedConfigSchema>;
export type PersistedSecrets = z.infer<typeof persistedSecretsSchema>;
//# sourceMappingURL=schema.d.ts.map