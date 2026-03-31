import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { runUpdateEnvCommand } from '../../src/commands/updateEnv.js';
import { persistConfig } from '../../src/config/store.js';

const SAMPLE_VLESS_URL =
  'vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-%E5%BE%B7%E5%9B%BD-sing1';

const tempDirs: string[] = [];

const createConfigRoot = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'qxnethelper-update-env-dupes-'));
  tempDirs.push(directory);

  await persistConfig(
    directory,
    {
      folderUrl: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
      folderToken: 'fldcnTestFolder123',
      subLink: 'https://example.test/subscription.yaml',
      timezone: 'Asia/Shanghai',
      authMode: 'tenant_access_token',
      schemaVersion: 1,
    },
    {
      FEISHU_APP_ID: 'cli_app_123',
      FEISHU_APP_SECRET: 'secret_123',
    },
  );

  return directory;
};

const mockListAndDownload = (yaml: string): void => {
  nock('https://open.feishu.cn')
    .post('/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: 'cli_app_123',
      app_secret: 'secret_123',
    })
    .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 });

  nock('https://open.feishu.cn')
    .get('/open-apis/drive/v1/files/fldcnTestFolder123/children')
    .query({ page_size: '200' })
    .reply(200, {
      code: 0,
      data: {
        files: [{ token: 'latest-file', name: 'config_0331.yaml', type: 'file', modified_time: '2026-03-31T01:00:00Z' }],
        has_more: false,
      },
    });

  nock('https://open.feishu.cn')
    .get('/open-apis/drive/v1/files/latest-file/download')
    .reply(200, yaml);
};

beforeEach(() => {
  nock.disableNetConnect();
});

afterEach(async () => {
  nock.cleanAll();
  nock.enableNetConnect();
  await Promise.all(tempDirs.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runUpdateEnvCommand duplicate target validation', () => {
  test('fails with exit-class 4 when mixed830 appears more than once', async () => {
    const configRoot = await createConfigRoot();

    mockListAndDownload([
      'listeners:',
      '  - name: mixed830',
      '    type: mixed',
      '    port: 42830',
      '    proxy: 830',
      '  - name: mixed830',
      '    type: mixed',
      '    port: 42831',
      '    proxy: 831',
      'proxies:',
      '  - name: Traffic Reset',
      '    type: direct',
      '',
    ].join('\n'));

    await expect(
      runUpdateEnvCommand({
        envId: '95830',
        region: '美国',
        ip: '192.89.1.42',
        nodeUrl: SAMPLE_VLESS_URL,
        configRoot,
      }),
    ).rejects.toMatchObject({ code: 'yaml_duplicate_listener_name', exitCode: 4, message: 'Found duplicate entry named `mixed830`' });
  });

  test('fails with exit-class 4 when proxy 830 appears more than once and does not upload', async () => {
    const configRoot = await createConfigRoot();

    mockListAndDownload([
      'listeners: []',
      'proxies:',
      '  - name: 830',
      '    type: direct',
      '  - name: 830',
      '    type: direct',
      '  - name: Traffic Reset',
      '    type: direct',
      '',
    ].join('\n'));

    const uploadScope = nock('https://open.feishu.cn')
      .post('/open-apis/drive/v1/files/upload_all')
      .reply(200, { code: 0, data: { file_token: 'should-not-upload' } });

    await expect(
      runUpdateEnvCommand({
        envId: '95830',
        region: '美国',
        ip: '192.89.1.42',
        nodeUrl: SAMPLE_VLESS_URL,
        configRoot,
      }),
    ).rejects.toMatchObject({ code: 'yaml_duplicate_proxy_name', exitCode: 4, message: 'Found duplicate entry named `830`' });
    expect(uploadScope.isDone()).toBe(false);
  });
});
