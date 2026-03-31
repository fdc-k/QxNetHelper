import { Buffer } from 'node:buffer';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { initCommand, runInitCommand } from '../../src/commands/init.js';
import type { FolderAccessValidator, ValidateFolderAccessInput } from '../../src/config/folderAccess.js';
import { resolveConfigPaths } from '../../src/config/store.js';

type TestContext = {
  readonly rootDir: string;
  readonly validator: FolderAccessValidator;
};

const tempDirs: string[] = [];

const createTestContext = async (): Promise<TestContext> => {
  const rootDir = await mkdtemp(join(tmpdir(), 'qxnethelper-init-test-'));
  tempDirs.push(rootDir);

    return {
      rootDir,
      validator: {
        validate: vi.fn(async (_input: ValidateFolderAccessInput) => Promise.resolve()),
      },
    };
};

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (directory) => rm(directory, { recursive: true, force: true })));
});

describe('runInitCommand', () => {
  test('persists normalized config and redacts secrets in result', async () => {
    const context = await createTestContext();
    const result = await runInitCommand(
      {
        appId: 'cli_app_123',
        appSecret: 'secret_123',
        configDir: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
        subLink: 'https://example.test/subscription.yaml',
        configRoot: context.rootDir,
        json: true,
      },
      { folderAccessValidator: context.validator },
    );
    const paths = resolveConfigPaths(context.rootDir);
    const envContents = await readFile(paths.envFile, 'utf8');
    const configContents = await readFile(paths.configFile, 'utf8');

    expect(result).toEqual({
      ok: true,
      command: 'init',
      configRoot: context.rootDir,
      folderToken: 'fldcnTestFolder123',
      subLink: 'https://example.test/subscription.yaml',
      secrets: 'redacted',
    });
    expect(context.validator.validate).toHaveBeenCalledWith({
      appId: 'cli_app_123',
      appSecret: 'secret_123',
      folderToken: 'fldcnTestFolder123',
    });
    expect(envContents).toBe('FEISHU_APP_ID=cli_app_123\nFEISHU_APP_SECRET=secret_123\n');
    expect(configContents).toBe(
      '{\n' +
        '  "folderUrl": "https://feishu.cn/drive/folder/fldcnTestFolder123",\n' +
        '  "folderToken": "fldcnTestFolder123",\n' +
        '  "subLink": "https://example.test/subscription.yaml",\n' +
        '  "timezone": "Asia/Shanghai",\n' +
        '  "authMode": "tenant_access_token",\n' +
        '  "schemaVersion": 1\n' +
        '}\n',
    );
  });

  test('accepts a raw folder token and stores a null folderUrl', async () => {
    const context = await createTestContext();
    const result = await runInitCommand(
      {
        appId: 'cli_app_123',
        appSecret: 'secret_123',
        configDir: 'fldcnRawToken123',
        subLink: 'https://example.test/subscription.yaml',
        configRoot: context.rootDir,
      },
      { folderAccessValidator: context.validator },
    );
    const configContents = await readFile(resolveConfigPaths(context.rootDir).configFile, 'utf8');

    expect(result.folderToken).toBe('fldcnRawToken123');
    expect(configContents).toContain('"folderUrl": null');
  });

  test('is idempotent on rerun and overwrites changed values', async () => {
    const context = await createTestContext();
    const options = {
      appId: 'cli_app_123',
      appSecret: 'secret_123',
      configDir: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
      subLink: 'https://example.test/subscription.yaml',
      configRoot: context.rootDir,
    };

    await runInitCommand(options, { folderAccessValidator: context.validator });

    const paths = resolveConfigPaths(context.rootDir);
    const firstEnv = await readFile(paths.envFile, 'utf8');
    const firstConfig = await readFile(paths.configFile, 'utf8');

    await runInitCommand(options, { folderAccessValidator: context.validator });

    expect(await readFile(paths.envFile, 'utf8')).toBe(firstEnv);
    expect(await readFile(paths.configFile, 'utf8')).toBe(firstConfig);
    expect((await readFile(paths.envFile, 'utf8')).match(/^FEISHU_APP_ID=/gmu)).toHaveLength(1);
    expect((await readFile(paths.envFile, 'utf8')).match(/^FEISHU_APP_SECRET=/gmu)).toHaveLength(1);

    await runInitCommand(
      {
        ...options,
        appId: 'cli_app_456',
        appSecret: 'secret_456',
        subLink: 'https://example.test/changed.yaml',
      },
      { folderAccessValidator: context.validator },
    );

    expect(await readFile(paths.envFile, 'utf8')).toBe('FEISHU_APP_ID=cli_app_456\nFEISHU_APP_SECRET=secret_456\n');
    expect(await readFile(paths.configFile, 'utf8')).toContain('"subLink": "https://example.test/changed.yaml"');
  });
});

describe('initCommand', () => {
  test('throws commander error with deterministic JSON payload on invalid config-dir', async () => {
    const stderr: string[] = [];
    const exitSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

      return true;
    });

    await expect(
      initCommand({
        appId: 'cli_app_123',
        appSecret: 'secret_123',
        configDir: 'not-a-feishu-folder',
        subLink: 'https://example.test/subscription.yaml',
        configRoot: '/tmp/unused',
        json: true,
      }),
    ).rejects.toMatchObject({ exitCode: 2, code: 'init.validation_failed', message: 'config-dir must be a Feishu folder URL or folder token' });

    const payload = stderr.join('').trim();

    expect(payload).toBe(
      '{"ok":false,"command":"init","error":{"code":"validation_failed","message":"config-dir must be a Feishu folder URL or folder token"}}',
    );

    exitSpy.mockRestore();
  });

  test('rejects non-https sub-link values during validation', async () => {
    const stderr: string[] = [];
    const exitSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

      return true;
    });

    await expect(
      initCommand({
        appId: 'cli_app_123',
        appSecret: 'secret_123',
        configDir: 'https://feishu.cn/drive/folder/fldcnTestFolder123',
        subLink: 'http://example.test/subscription.yaml',
        configRoot: '/tmp/unused',
        json: true,
      }),
    ).rejects.toMatchObject({ exitCode: 2, code: 'init.validation_failed', message: 'sub-link must be a valid HTTPS URL' });

    expect(stderr.join('').trim()).toBe(
      '{"ok":false,"command":"init","error":{"code":"validation_failed","message":"sub-link must be a valid HTTPS URL"}}',
    );

    exitSpy.mockRestore();
  });
});
