import { Buffer } from 'node:buffer';

import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createTenantAccessTokenProvider } from '../../src/feishu/auth.js';
import { createFeishuDriveClient } from '../../src/feishu/driveClient.js';

describe('FeishuDriveClient', () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('caches tokens until refresh window, then fetches a new token', async () => {
    let now = 0;
    const tokenProvider = createTenantAccessTokenProvider({
      appId: 'cli_app_123',
      appSecret: 'secret_123',
      now: () => now,
    });
    const driveClient = createFeishuDriveClient({ tokenProvider, sleep: async () => Promise.resolve() });

    const tokenScope = nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal', {
        app_id: 'cli_app_123',
        app_secret: 'secret_123',
      })
      .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 })
      .post('/open-apis/auth/v3/tenant_access_token/internal', {
        app_id: 'cli_app_123',
        app_secret: 'secret_123',
      })
      .reply(200, { tenant_access_token: 'tenant-token-2', expire: 120 });

    const folderScope = nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnFolder123/children')
      .query({ page_size: '200' })
      .times(3)
      .reply(200, { code: 0, data: { files: [], has_more: false } });

    await driveClient.listFolder('fldcnFolder123');
    now = 30_000;
    await driveClient.listFolder('fldcnFolder123');
    now = 61_000;
    await driveClient.listFolder('fldcnFolder123');

    expect(tokenScope.isDone()).toBe(true);
    expect(folderScope.isDone()).toBe(true);
  });

  test('collects all folder pages using next_page_token', async () => {
    const tokenProvider = createTenantAccessTokenProvider({
      appId: 'cli_app_123',
      appSecret: 'secret_123',
    });
    const driveClient = createFeishuDriveClient({ tokenProvider, sleep: async () => Promise.resolve() });

    nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal')
      .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 });

    const scope = nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnFolder123/children')
      .query({ page_size: '200' })
      .reply(200, {
        code: 0,
        data: {
          files: [{ token: 'file-1', name: 'config_0331.yaml', type: 'file' }],
          has_more: true,
          next_page_token: 'next-page',
        },
      })
      .get('/open-apis/drive/v1/files/fldcnFolder123/children')
      .query({ page_size: '200', page_token: 'next-page' })
      .reply(200, {
        code: 0,
        data: {
          files: [{ token: 'file-2', name: 'config_0331_2.yaml', type: 'file' }],
          has_more: false,
        },
      });

    await expect(driveClient.listFolder('fldcnFolder123')).resolves.toEqual([
      { token: 'file-1', name: 'config_0331.yaml', type: 'file' },
      { token: 'file-2', name: 'config_0331_2.yaml', type: 'file' },
    ]);
    expect(scope.isDone()).toBe(true);
  });

  test('uploads files with upload_all multipart fields', async () => {
    const tokenProvider = createTenantAccessTokenProvider({
      appId: 'cli_app_123',
      appSecret: 'secret_123',
    });
    const driveClient = createFeishuDriveClient({ tokenProvider, sleep: async () => Promise.resolve() });

    nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal')
      .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 });

    const uploadScope = nock('https://open.feishu.cn', {
      reqheaders: {
        authorization: 'Bearer tenant-token-1',
      },
    })
      .post('/open-apis/drive/v1/files/upload_all', (body: string | Buffer) => {
        const payload = Buffer.isBuffer(body) ? body.toString('utf8') : body;

        return payload.includes('name="file_name"\r\n\r\nconfig_0331.yaml')
          && payload.includes('name="parent_type"\r\n\r\nexplorer')
          && payload.includes('name="parent_node"\r\n\r\nfldcnFolder123')
          && payload.includes('name="size"\r\n\r\n11')
          && payload.includes('name="file"; filename="config_0331.yaml"')
          && payload.includes('hello world');
      })
      .reply(200, { code: 0, data: { file_token: 'uploaded-file-token' } });

    await expect(
      driveClient.uploadFile({
        folderToken: 'fldcnFolder123',
        fileName: 'config_0331.yaml',
        content: Buffer.from('hello world', 'utf8'),
      }),
    ).resolves.toEqual({ fileToken: 'uploaded-file-token' });
    expect(uploadScope.isDone()).toBe(true);
  });

  test('retries retryable Feishu responses with exponential backoff', async () => {
    const delays: number[] = [];
    const tokenProvider = createTenantAccessTokenProvider({
      appId: 'cli_app_123',
      appSecret: 'secret_123',
      sleep: async () => Promise.resolve(),
    });
    const driveClient = createFeishuDriveClient({
      tokenProvider,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
    });

    nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal')
      .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 });

    const scope = nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnFolder123/children')
      .query({ page_size: '200' })
      .reply(200, { code: 1061045, msg: 'please retry later' })
      .get('/open-apis/drive/v1/files/fldcnFolder123/children')
      .query({ page_size: '200' })
      .reply(200, { code: 0, data: { files: [], has_more: false } });

    await expect(driveClient.listFolder('fldcnFolder123')).resolves.toEqual([]);
    expect(delays).toEqual([100]);
    expect(scope.isDone()).toBe(true);
  });

  test('surfaces non-JSON error responses as typed remote errors', async () => {
    const tokenProvider = createTenantAccessTokenProvider({
      appId: 'cli_app_123',
      appSecret: 'secret_123',
    });
    const delays: number[] = [];
    const driveClient = createFeishuDriveClient({
      tokenProvider,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
    });

    nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal')
      .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 });

    const scope = nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnFolder123/children')
      .query({ page_size: '200' })
      .times(3)
      .reply(502, '<html>bad gateway</html>', {
        'Content-Type': 'text/html',
      });

    await expect(driveClient.listFolder('fldcnFolder123')).rejects.toMatchObject({
      name: 'FeishuRemoteError',
      code: 'remote_failed',
      exitCode: 3,
      status: 502,
      message: '<html>bad gateway</html>',
    });
    expect(delays).toEqual([100, 200]);
    expect(scope.isDone()).toBe(true);
  });

  test('fails deterministically when pagination token is missing', async () => {
    const tokenProvider = createTenantAccessTokenProvider({
      appId: 'cli_app_123',
      appSecret: 'secret_123',
    });
    const driveClient = createFeishuDriveClient({ tokenProvider, sleep: async () => Promise.resolve() });

    nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal')
      .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 });

    const scope = nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnFolder123/children')
      .query({ page_size: '200' })
      .reply(200, {
        code: 0,
        data: {
          files: [{ token: 'file-1', name: 'config_0331.yaml', type: 'file' }],
          has_more: true,
        },
      });

    await expect(driveClient.listFolder('fldcnFolder123')).rejects.toMatchObject({
      name: 'FeishuRemoteError',
      code: 'remote_failed',
      exitCode: 3,
      message: 'Feishu folder listing indicated more pages but did not provide a next_page_token',
    });
    expect(scope.isDone()).toBe(true);
  });
});
