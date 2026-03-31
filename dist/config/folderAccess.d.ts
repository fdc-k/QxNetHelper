export type ValidateFolderAccessInput = {
    readonly appId: string;
    readonly appSecret: string;
    readonly folderToken: string;
};
export interface FolderAccessValidator {
    validate(input: ValidateFolderAccessInput): Promise<void>;
}
export declare class FeishuFolderAccessValidator implements FolderAccessValidator {
    validate(input: ValidateFolderAccessInput): Promise<void>;
}
export declare const defaultFolderAccessValidator: FeishuFolderAccessValidator;
//# sourceMappingURL=folderAccess.d.ts.map