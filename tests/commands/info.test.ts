import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { runInfoCommand } from '../../src/commands/info.js';
import { persistConfig } from '../../src/config/store.js';

const tempDirs: string[] = [];

const createConfigRoot = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'qxnethelper-info-test-'));
  tempDirs.push(directory);

  await persistConfig(
    directory,
    {
      folderUrl: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
      folderToken: 'fldcnTestFolder123',
      subLink: 'https://example.test/subscription.yaml',
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
  await Promise.all(tempDirs.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runInfoCommand', () => {
  test('returns current configuration', async () => {
    const configRoot = await createConfigRoot();
    const result = await runInfoCommand({
      configRoot,
      json: true,
    });

    expect(result).toEqual({
      ok: true,
      command: 'info',
      configRoot,
      folderToken: 'fldcnTestFolder123',
      folderUrl: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
      kuromisSubscription: 'https://example.test/subscription.yaml',
      mitceSubscription: 'https://app.mitce.net/?sid=564180&token=srvyubgg',
      timezone: 'Asia/Shanghai',
      authMode: 'tenant_access_token',
      schemaVersion: 1,
    });
  });

  test('fails when config does not exist', async () => {
    const configRoot = await mkdtemp(join(tmpdir(), 'qxnethelper-info-noconfig-'));
    tempDirs.push(configRoot);

    await expect(
      runInfoCommand({
        configRoot,
      }),
    ).rejects.toThrow('qxnethelper is not initialized in the requested config-root');
  });
});
