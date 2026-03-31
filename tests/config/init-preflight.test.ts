import { Buffer } from 'node:buffer';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { run } from '../../src/cli.js';
import { resolveConfigPaths } from '../../src/config/store.js';

const tempDirs: string[] = [];
const originalExitCode = process.exitCode;

const createTempRoot = async (): Promise<string> => {
  const rootDir = await mkdtemp(join(tmpdir(), 'qxnethelper-init-preflight-'));
  tempDirs.push(rootDir);

  return rootDir;
};

afterEach(async () => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('init preflight', () => {
  beforeEach(() => {
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  test('returns exit class 3 JSON and skips config writes on remote folder denial', async () => {
    const configRoot = await createTempRoot();
    const stderr: string[] = [];

    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

      return true;
    });

    nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal', {
        app_id: 'cli_app_123',
        app_secret: 'super-secret-value',
      })
      .reply(200, { tenant_access_token: 'tenant-token-1', expire: 120 });

    nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnDenied123/children')
      .query({ page_size: '1' })
      .reply(403, { code: 99991663, msg: 'forbidden' });

    await expect(
      run([
        'node',
        'qxnethelper',
        'init',
        '--app-id',
        'cli_app_123',
        '--app-secret',
        'super-secret-value',
        '--config-dir',
        'fldcnDenied123',
        '--sub-link',
        'https://example.test/subscription.yaml',
        '--config-root',
        configRoot,
        '--json',
      ]),
    ).resolves.toBeUndefined();

    expect(process.exitCode).toBe(3);
    expect(stderr.join('').trim()).toBe(
      '{"ok":false,"command":"init","error":{"code":"remote_forbidden","message":"Feishu denied access to the requested folder or file"}}',
    );
    expect(stderr.join('')).not.toContain('super-secret-value');

    const paths = resolveConfigPaths(configRoot);

    await expect(access(paths.baseDir)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
