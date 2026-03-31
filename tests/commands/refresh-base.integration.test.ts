import { Buffer } from 'node:buffer';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { refreshBaseCommand, runRefreshBaseCommand } from '../../src/commands/refreshBase.js';
import { persistConfig } from '../../src/config/store.js';

const SUBSCRIPTION_URL = 'https://example.test/subscription.yaml';

const SOURCE_YAML = [
  'proxy-groups:',
  '  - name: Worker Group',
  '    type: select',
  '    proxies:',
  '      - Traffic Reset',
  '      - Keep Me',
  'listeners:',
  '  - name: mixed111',
  '    type: mixed',
  '    port: 42111',
  '    proxy: Keep Me',
  '  - name: mixedgroup',
  '    type: mixed',
  '    port: 42112',
  '    proxy: Worker Group',
  'proxies:',
  '  - name: Keep Me',
  '    type: direct',
  '  - name: Traffic Reset',
  '    type: select',
  '    proxies:',
  '      - Legacy A',
  '      - Legacy B',
  '  - name: Legacy A',
  '    type: direct',
  '  - name: Legacy B',
  '    type: direct',
  '',
].join('\n');

const SUBSCRIPTION_YAML = [
  'proxies:',
  '  - name: Keep Original Elsewhere',
  '    type: direct',
  '  - name: Traffic Reset',
  '    type: select',
  '    proxies:',
  '      - Worker A',
  '      - Worker B',
  '  - name: Worker A',
  '    type: direct',
  '  - name: Worker B',
  '    type: direct',
  '',
].join('\n');

const tempDirs: string[] = [];

const createConfigRoot = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'qxnethelper-refresh-base-'));
  tempDirs.push(directory);

  await persistConfig(
    directory,
    {
      folderUrl: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
      folderToken: 'fldcnTestFolder123',
      subLink: SUBSCRIPTION_URL,
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

describe('runRefreshBaseCommand', () => {
  test('replaces the proxy tail from Traffic Reset and uploads the next dated file', async () => {
    const configRoot = await createConfigRoot();
    let uploadBody = '';

    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(200, SUBSCRIPTION_YAML, { 'Content-Type': 'application/yaml' });

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
      .post('/open-apis/drive/v1/files/upload_all', (body: string | Buffer) => {
        uploadBody = Buffer.isBuffer(body) ? body.toString('utf8') : body;

        return true;
      })
      .reply(200, { code: 0, data: { file_token: 'uploaded-file-token' } });

    const result = await runRefreshBaseCommand(
      {
        configRoot,
        json: true,
      },
      {
        now: () => new Date('2026-03-31T12:00:00+08:00'),
      },
    );

    expect(result).toEqual({
      ok: true,
      command: 'refresh-base',
      configRoot,
      folderToken: 'fldcnTestFolder123',
      sourceFile: 'config_0331.yaml',
      outputFile: 'config_0331_1.yaml',
      subscriptionUrl: SUBSCRIPTION_URL,
      replacedProxyCount: 3,
      trafficResetIndex: 1,
    });
    expect(uploadScope.isDone()).toBe(true);
    expect(uploadBody).toContain('name="file_name"\r\n\r\nconfig_0331_1.yaml');
    expect(uploadBody).toContain('  - name: Keep Me\n    type: direct\n  - name: Traffic Reset');
    expect(uploadBody).toContain('      - Worker A\n      - Worker B');
    expect(uploadBody).toContain('  - name: Worker A\n    type: direct');
    expect(uploadBody).toContain('  - name: Worker B\n    type: direct');
    expect(uploadBody).not.toContain('Legacy A');
    expect(uploadBody).not.toContain('Legacy B');
    expect(uploadBody).toContain('proxy: Keep Me');
    expect(uploadBody).toContain('proxy: Worker Group');
  });

  test('maps subscription non-2xx responses to exit code 3 with deterministic JSON output', async () => {
    const configRoot = await createConfigRoot();
    const stderr: string[] = [];

    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(502, '<html><body>upstream unavailable</body></html>', {
        'Content-Type': 'text/html; charset=utf-8',
      });

    const exitSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

      return true;
    });

    await expect(
      refreshBaseCommand({
        configRoot,
        json: true,
      }),
    ).rejects.toMatchObject({
      exitCode: 3,
      code: 'refresh-base.remote_failed',
      message: 'Subscription request failed with status 502',
    });

    expect(stderr.join('').trim()).toBe(
      '{"ok":false,"command":"refresh-base","error":{"code":"remote_failed","message":"Subscription request failed with status 502"}}',
    );

    exitSpy.mockRestore();
  });
});
