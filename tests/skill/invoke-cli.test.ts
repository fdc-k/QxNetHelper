import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { syncBuiltinESMExports } from 'node:module';
import { PassThrough } from 'node:stream';

import { afterEach, describe, expect, test, vi } from 'vitest';

class MockChildProcess extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
}

const createSpawnMock = () => {
  const child = new MockChildProcess();
  const spawnSpy = vi
    .spyOn(childProcess, 'spawn')
    .mockReturnValue(child as unknown as ReturnType<typeof childProcess.spawn>);

  syncBuiltinESMExports();

  return { child, spawnSpy };
};

const loadInvokeCli = async () => {
  const { invokeCli } = await import('../../src/skill/triggerMap.js');

  return invokeCli;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  syncBuiltinESMExports();
});

describe('invokeCli failure modes', () => {
  test('returns command_failed with JSON error message on non-zero exit', async () => {
    const { child, spawnSpy } = createSpawnMock();
    const invokeCli = await loadInvokeCli();
    const resultPromise = invokeCli(['refresh-base', '--json']);

    process.nextTick(() => {
      child.stderr.write('{"error":{"message":"Refresh failed"}}');
      child.stderr.end();
      child.emit('close', 1);
    });

    const result = await resultPromise;

    expect(spawnSpy).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: false,
      error: 'command_failed',
      message: 'Refresh failed',
    });
  });

  test('returns command_failed with raw stderr text on non-zero exit', async () => {
    const { child } = createSpawnMock();
    const invokeCli = await loadInvokeCli();
    const resultPromise = invokeCli(['update-env', '--json']);

    process.nextTick(() => {
      child.stderr.write('network update failed');
      child.stderr.end();
      child.emit('close', 2);
    });

    const result = await resultPromise;

    expect(result).toEqual({
      ok: false,
      error: 'command_failed',
      message: 'network update failed',
    });
  });

  test('returns spawn_failed when spawn emits an error', async () => {
    const { child } = createSpawnMock();
    const invokeCli = await loadInvokeCli();
    const resultPromise = invokeCli(['init', '--json']);
    const error = new Error('spawn node ENOENT');

    await Promise.resolve();
    child.emit('error', error);

    const result = await resultPromise;

    expect(result).toEqual({
      ok: false,
      error: 'spawn_failed',
      message: 'spawn node ENOENT',
    });
  });
});
