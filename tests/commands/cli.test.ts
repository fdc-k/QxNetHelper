import { Buffer } from 'node:buffer';

import { afterEach, describe, expect, test, vi } from 'vitest';

import { run } from '../../src/cli.js';

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe('run', () => {
  test('normalizes commander parse failures to exit code 2', async () => {
    const stderr: string[] = [];

    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      stderr.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));

      return true;
    });

    await expect(run(['node', 'qxnethelper', 'init'])).resolves.toBeUndefined();

    expect(process.exitCode).toBe(2);
    expect(stderr.join('')).toContain("required option '--app-id <id>' not specified");
    expect(stderr.join('')).not.toContain('CommanderError');
  });

  test('suppresses commander stack traces and preserves init JSON error output', async () => {
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
    expect(stderr.join('').trim()).toBe(
      '{"ok":false,"command":"init","error":{"code":"validation_failed","message":"config-dir must be a Feishu folder URL or folder token"}}',
    );
    expect(stderr.join('')).not.toContain('CommanderError');
    expect(stderr.join('')).not.toContain('at ');
  });
});
