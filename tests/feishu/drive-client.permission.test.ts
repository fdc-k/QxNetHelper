import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createTenantAccessTokenProvider } from '../../src/feishu/auth.js';
import { createFeishuDriveClient } from '../../src/feishu/driveClient.js';

describe('FeishuDriveClient permission handling', () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('surfaces 403 folder access as a typed remote error without retries', async () => {
    const tokenProvider = createTenantAccessTokenProvider({
      appId: 'cli_app_123',
      appSecret: 'secret_123',
    });
    const driveClient = createFeishuDriveClient({ tokenProvider, sleep: async () => Promise.resolve() });

    const tokenScope = nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal')
      .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 });
    const folderScope = nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnFolder123/children')
      .query({ page_size: '200' })
      .reply(403, { code: 99991663, msg: 'forbidden' });

    await expect(driveClient.listFolder('fldcnFolder123')).rejects.toMatchObject({
      name: 'FeishuRemoteError',
      code: 'remote_forbidden',
      exitCode: 3,
      status: 403,
      message: 'Feishu denied access to the requested folder or file',
    });
    expect(tokenScope.isDone()).toBe(true);
    expect(folderScope.isDone()).toBe(true);
  });
});
