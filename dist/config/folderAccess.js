import { createTenantAccessTokenProvider } from '../feishu/auth.js';
import { getFeishuBaseUrl } from '../feishu/baseUrl.js';
import { createFeishuDriveClient } from '../feishu/driveClient.js';
export class FeishuFolderAccessValidator {
    async validate(input) {
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
//# sourceMappingURL=folderAccess.js.map