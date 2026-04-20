import { Buffer } from 'node:buffer';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { run } from '../../src/cli.js';
import { persistConfig } from '../../src/config/store.js';

const tempDirs: string[] = [];
const originalExitCode = process.exitCode;

const createConfigRoot = async (subLink: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'qxnethelper-redaction-'));
  tempDirs.push(directory);

  await persistConfig(
    directory,
    {
      folderUrl: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
      folderToken: 'fldcnTestFolder123',
      subLink,
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

afterEach(async () => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await Promise.all(tempDirs.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('CLI output redaction', () => {
  test('does not print FEISHU_APP_SECRET in init validation failures', async () => {
    const stderr: string[] = [];

    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

      return true;
    });

    await expect(
      run([
        'node',
        'qxnethelper',
        'init',
        '--app-id',
        'cli_app_123',
        '--app-secret',
        'secret_123',
        '--config-dir',
        'not-a-feishu-folder',
        '--sub-link',
        'https://example.test/subscription.yaml',
        '--config-root',
        '/tmp/unused',
        '--json',
      ]),
    ).resolves.toBeUndefined();

    expect(process.exitCode).toBe(2);
    expect(stderr.join('')).not.toContain('secret_123');
  });

  test('redacts token query params in refresh-base output', async () => {
    const configRoot = await createConfigRoot('https://example.test/subscription.yaml?token=refresh-secret-token');
    const stdout: string[] = [];

    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stdout.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

      return true;
    });
    vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: { method?: string }) => {
      const url = String(input);

      if (url === 'https://example.test/subscription.yaml?token=refresh-secret-token') {
        return new globalThis.Response(
          [
            'proxies:',
            '  - name: Traffic Reset',
            '    type: direct',
            '',
          ].join('\n'),
          { status: 200, headers: { 'content-type': 'application/yaml' } },
        );
      }

      if (url === 'https://app.mitce.net/?sid=564180&token=srvyubgg') {
        return new globalThis.Response(
          [
            'proxies:',
            '  - name: US-1',
            '    type: direct',
            '',
          ].join('\n'),
          { status: 200, headers: { 'content-type': 'application/yaml' } },
        );
      }

      if (url === 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal') {
        return new globalThis.Response(JSON.stringify({ tenant_access_token: 'tenant-token-1', expire: 120 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url === 'https://open.feishu.cn/open-apis/drive/v1/files/fldcnTestFolder123/children?page_size=200') {
        return new globalThis.Response(JSON.stringify({
          code: 0,
          data: {
            files: [{ token: 'latest-file', name: 'config_0331.yaml', type: 'file', modified_time: '2026-03-31T01:00:00Z' }],
            has_more: false,
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url === 'https://open.feishu.cn/open-apis/drive/v1/files/latest-file/download') {
        return new globalThis.Response(
          [
            'listeners: []',
            'proxy-groups: []',
            'proxies:',
            '  - name: Traffic Reset',
            '    type: direct',
            '',
          ].join('\n'),
          { status: 200, headers: { 'content-type': 'application/octet-stream' } },
        );
      }

      if (url === 'https://open.feishu.cn/open-apis/drive/v1/files/upload_all' && init?.method === 'POST') {
        return new globalThis.Response(JSON.stringify({ code: 0, data: { file_token: 'uploaded-file-token' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      throw new Error(`Unexpected fetch ${url}`);
    }));

    await expect(
      run([
        'node',
        'qxnethelper',
        'refresh-base',
        '--config-root',
        configRoot,
        '--json',
      ]),
    ).resolves.toBeUndefined();

    expect(process.exitCode).toBeUndefined();
    expect(stdout.join('')).toContain('token=[REDACTED]');
    expect(stdout.join('')).not.toContain('refresh-secret-token');
  });
});
