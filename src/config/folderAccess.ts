import { createTenantAccessTokenProvider } from '../feishu/auth.js';
import { getFeishuBaseUrl } from '../feishu/baseUrl.js';
import { createFeishuDriveClient } from '../feishu/driveClient.js';

export type ValidateFolderAccessInput = {
  readonly appId: string;
  readonly appSecret: string;
  readonly folderToken: string;
};

export interface FolderAccessValidator {
  validate(input: ValidateFolderAccessInput): Promise<void>;
}

export class FeishuFolderAccessValidator implements FolderAccessValidator {
  public async validate(input: ValidateFolderAccessInput): Promise<void> {
    const baseUrl = getFeishuBaseUrl();
    const tokenProvider = createTenantAccessTokenProvider({
      appId: input.appId,
      appSecret: input.appSecret,
      baseUrl,
    });
    const driveClient = createFeishuDriveClient({ tokenProvider, baseUrl });

    await driveClient.listFolder(input.folderToken, 1);
  }
}

export const defaultFolderAccessValidator = new FeishuFolderAccessValidator();
