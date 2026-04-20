import { Buffer } from 'node:buffer';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { runUpdateEnvCommand } from '../../src/commands/updateEnv.js';
import { persistConfig } from '../../src/config/store.js';

const SAMPLE_VLESS_URL =
  'vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-%E5%BE%B7%E5%9B%BD-sing1';

const BASE_YAML = [
  'listeners:',
  '  - name: mixed111',
  '    type: mixed',
  '    port: 42111',
  '    proxy: 111',
  'proxies:',
  '  - name: Keep Me',
  '    type: direct',
  '  - name: Traffic Reset',
  '    type: direct',
  '',
].join('\n');

const tempDirs: string[] = [];

const createConfigRoot = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'qxnethelper-update-env-'));
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

beforeEach(() => {
  nock.disableNetConnect();
});

afterEach(async () => {
  nock.cleanAll();
  nock.enableNetConnect();
  await Promise.all(tempDirs.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runUpdateEnvCommand', () => {
  test('downloads the latest config, upserts listener/proxy entries, and uploads the next dated file', async () => {
    const configRoot = await createConfigRoot();
    let uploadBody = '';

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
          files: [
            { token: 'older-file', name: 'config_0330.yaml', type: 'file', modified_time: '2026-03-30T01:00:00Z' },
            { token: 'latest-file', name: 'config_0331.yaml', type: 'file', modified_time: '2026-03-31T01:00:00Z' },
          ],
          has_more: false,
        },
      });

    nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/latest-file/download')
      .reply(200, BASE_YAML);

    const uploadScope = nock('https://open.feishu.cn')
      .post('/open-apis/drive/v1/files/upload_all', (body: string | Buffer) => {
        uploadBody = Buffer.isBuffer(body) ? body.toString('utf8') : body;

        return true;
      })
      .reply(200, { code: 0, data: { file_token: 'uploaded-file-token' } });

    const result = await runUpdateEnvCommand(
      {
        envId: '95830',
        region: '美国',
        ip: '192.89.1.42',
        nodeUrl: SAMPLE_VLESS_URL,
        configRoot,
        json: true,
      },
      {
        now: () => new Date('2026-03-31T12:00:00+08:00'),
      },
    );

    expect(result).toEqual({
      ok: true,
      command: 'update-env',
      configRoot,
      folderToken: 'fldcnTestFolder123',
      sourceFile: 'config_0331.yaml',
      outputFile: 'config_0331_1.yaml',
      envId: '95830',
      proxyName: '830',
      region: '美国',
      ip: '192.89.1.42',
      diff: expect.any(String),
    });
    expect(uploadScope.isDone()).toBe(true);
    expect(uploadBody).toContain('name="file_name"\r\n\r\nconfig_0331_1.yaml');
    expect(uploadBody.match(/name: mixed830/gmu)).toHaveLength(1);
    expect(uploadBody).toContain('port: 42830');
    expect(uploadBody).toContain('proxy: 830');
    expect(uploadBody.match(/name: ['"]?830['"]?/gmu)).toHaveLength(1);
    expect(uploadBody).toContain('type: vless');
    expect(uploadBody).toContain('server: zdegeuy2.bia3.top');
    expect(uploadBody).toContain('uuid: d7baecff-1956-46ce-c89c-bd81098d7223');
    expect(uploadBody).toContain('flow: xtls-rprx-vision');
    expect(uploadBody).toContain('servername: ndl.certainteed.com');
    expect(uploadBody).toContain('client-fingerprint: chrome');
    expect(uploadBody).toContain('public-key: W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg');
  });
});
