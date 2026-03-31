export type TriggerType = 'init' | 'update-env' | 'refresh-base' | 'unsupported';
export type TriggerResult = {
    readonly type: 'init';
    readonly argv: readonly string[];
} | {
    readonly type: 'update-env';
    readonly argv: readonly string[];
} | {
    readonly type: 'refresh-base';
    readonly argv: readonly string[];
} | {
    readonly type: 'unsupported';
    readonly reason: string;
};
export type SkillResponse = {
    readonly ok: true;
    readonly command: string;
    readonly output: unknown;
} | {
    readonly ok: false;
    readonly error: string;
    readonly message: string;
};
export declare const parseTrigger: (prompt: string) => TriggerResult;
export declare const invokeCli: (argv: readonly string[]) => Promise<SkillResponse>;
export declare const handleTrigger: (prompt: string) => Promise<SkillResponse>;
//# sourceMappingURL=triggerMap.d.ts.map