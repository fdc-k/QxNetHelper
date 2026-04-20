import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { runRefreshBaseCommand } from '../../src/commands/refreshBase.js';
import { persistConfig } from '../../src/config/store.js';

const SUBSCRIPTION_URL = 'https://example.test/subscription.yaml';

const SOURCE_YAML = [
  'listeners:',
  '  - name: mixedlegacy',
  '    type: mixed',
  '    port: 42111',
  '    proxy: Legacy A',
  'proxies:',
  '  - name: Keep Me',
  '    type: direct',
  '  - name: Traffic Reset',
  '    type: direct',
  '  - name: Legacy A',
  '    type: direct',
  '',
].join('\n');

const SOURCE_YAML_WITH_PROXY_GROUP_REFERENCE = [
  'listeners:',
  '  - name: mixedsafe',
  '    type: mixed',
  '    port: 42111',
  '    proxy: Keep Me',
  'proxy-groups:',
  '  - name: Group A',
  '    type: select',
  '    proxies:',
  '      - Keep Me',
  '      - Legacy A',
  'proxies:',
  '  - name: Keep Me',
  '    type: direct',
  '  - name: Traffic Reset',
  '    type: direct',
  '  - name: Legacy A',
  '    type: direct',
  '',
].join('\n');

const SUBSCRIPTION_YAML = [
  'proxies:',
  '  - name: Traffic Reset',
  '    type: direct',
  '  - name: Worker A',
  '    type: direct',
  '',
].join('\n');

const MITCE_YAML = [
  'proxies:',
  '  - name: US-1',
  '    type: direct',
  '',
].join('\n');

const tempDirs: string[] = [];

const createConfigRoot = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'qxnethelper-refresh-base-ref-failure-'));
  tempDirs.push(directory);

  await persistConfig(
    directory,
    {
      folderUrl: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
      folderToken: 'fldcnTestFolder123',
      subLink: SUBSCRIPTION_URL,
      mitceLink: 'https://app.mitce.net/?sid=564180&token=srvyubgg',
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

beforeEach(() => {
  nock.disableNetConnect();
});

afterEach(async () => {
  nock.cleanAll();
  nock.enableNetConnect();
  await Promise.all(tempDirs.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runRefreshBaseCommand listener reference validation', () => {
  test('fails with exit-class 4 when a listener proxy reference is removed by the replacement tail', async () => {
    const configRoot = await createConfigRoot();

    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(200, SUBSCRIPTION_YAML, { 'Content-Type': 'application/yaml' });

    nock('https://app.mitce.net')
      .get('/')
      .query({ sid: '564180', token: 'srvyubgg' })
      .reply(200, MITCE_YAML, { 'Content-Type': 'application/yaml' });

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
      .reply(200, SOURCE_YAML);

    const uploadScope = nock('https://open.feishu.cn')
      .post('/open-apis/drive/v1/files/upload_all')
      .reply(200, { code: 0, data: { file_token: 'should-not-upload' } });

    await expect(
      runRefreshBaseCommand({
        configRoot,
      }),
    ).rejects.toMatchObject({
      code: 'yaml_listener_proxy_reference_missing',
      exitCode: 4,
      message: 'Listener `mixedlegacy` references missing proxy `Legacy A`',
    });
    expect(uploadScope.isDone()).toBe(false);
  });

  test('fails with exit-class 4 when a proxy-group member reference is removed by the replacement tail', async () => {
    const configRoot = await createConfigRoot();

    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(200, SUBSCRIPTION_YAML, { 'Content-Type': 'application/yaml' });

    nock('https://app.mitce.net')
      .get('/')
      .query({ sid: '564180', token: 'srvyubgg' })
      .reply(200, MITCE_YAML, { 'Content-Type': 'application/yaml' });

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
      .reply(200, SOURCE_YAML_WITH_PROXY_GROUP_REFERENCE);

    const uploadScope = nock('https://open.feishu.cn')
      .post('/open-apis/drive/v1/files/upload_all')
      .reply(200, { code: 0, data: { file_token: 'should-not-upload' } });

    await expect(
      runRefreshBaseCommand({
        configRoot,
      }),
    ).rejects.toMatchObject({
      code: 'yaml_proxy_group_member_reference_missing',
      exitCode: 4,
      message: 'Proxy group `Group A` references missing proxy target `Legacy A`',
    });
    expect(uploadScope.isDone()).toBe(false);
  });
});
