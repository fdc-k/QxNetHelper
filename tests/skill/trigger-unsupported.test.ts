import { describe, expect, test, vi } from 'vitest';

import { handleTrigger, parseTrigger } from '../../src/skill/triggerMap.js';

const SAMPLE_VLESS_URL =
  'vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-德国-sing1';

describe('unsupported triggers', () => {
  test('returns unsupported_trigger for prompts without trigger keywords', () => {
    const result = parseTrigger('hello world');

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('does not match');
    }
  });

  test('returns unsupported_trigger when env-id is missing from update-env prompt', () => {
    const prompt = `更新网络配置：美国，IP地址：192.89.1.42，${SAMPLE_VLESS_URL}`;
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('env-id');
    }
  });

  test('returns unsupported_trigger when region is missing from update-env prompt', () => {
    const prompt = `更新网络配置：95830，IP地址：192.89.1.42，${SAMPLE_VLESS_URL}`;
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('region');
    }
  });

  test('returns unsupported_trigger when IP is missing from update-env prompt', () => {
    const prompt = `更新网络配置：95830，美国，${SAMPLE_VLESS_URL}`;
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('IP');
    }
  });

  test('returns unsupported_trigger when node URL is missing from update-env prompt', () => {
    const prompt = '更新网络配置：95830，美国，IP地址：192.89.1.42';
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('node URL');
    }
  });

  test('returns unsupported_trigger for unsupported proxy schemes', () => {
    const prompt = '更新网络配置：95830，美国，IP地址：192.89.1.42，trojan://example.com';
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('node URL');
    }
  });

  test('returns unsupported_trigger when init is missing app-id', () => {
    const prompt =
      '初始化 qxnethelper，app-secret 是 secret_123，config-dir 是 https://feishu.cn/drive/folder/fldcnTestFolder123，sub-link 是 https://example.test/subscription.yaml';
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('app-id');
    }
  });

  test('returns unsupported_trigger when init is missing app-secret', () => {
    const prompt =
      '初始化 qxnethelper，app-id 是 cli_app_123，config-dir 是 https://feishu.cn/drive/folder/fldcnTestFolder123，sub-link 是 https://example.test/subscription.yaml';
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('app-secret');
    }
  });

  test('returns unsupported_trigger when init is missing config-dir', () => {
    const prompt =
      '初始化 qxnethelper，app-id 是 cli_app_123，app-secret 是 secret_123，sub-link 是 https://example.test/subscription.yaml';
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('config-dir');
    }
  });

  test('returns unsupported_trigger when init is missing sub-link', () => {
    const prompt =
      '初始化 qxnethelper，app-id 是 cli_app_123，app-secret 是 secret_123，config-dir 是 https://feishu.cn/drive/folder/fldcnTestFolder123';
    const result = parseTrigger(prompt);

    expect(result.type).toBe('unsupported');
    if (result.type === 'unsupported') {
      expect(result.reason).toContain('sub-link');
    }
  });
});

describe('handleTrigger does not invoke CLI for unsupported triggers', () => {
  test('handleTrigger returns unsupported_trigger without calling spawn', async () => {
    const spawnMock = vi.fn();
    vi.doMock('node:child_process', () => ({ spawn: spawnMock }));

    const prompt = 'random unrelated prompt that should not match';
    const result = await handleTrigger(prompt);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('unsupported_trigger');
    }
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('handleTrigger returns unsupported_trigger for missing env-id without calling spawn', async () => {
    const spawnMock = vi.fn();
    vi.doMock('node:child_process', () => ({ spawn: spawnMock }));

    const prompt = `更新网络配置：美国，IP地址：192.89.1.42，${SAMPLE_VLESS_URL}`;
    const result = await handleTrigger(prompt);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('unsupported_trigger');
    }
    expect(spawnMock).not.toHaveBeenCalled();
  });

  test('handleTrigger returns unsupported_trigger for missing node-url without calling spawn', async () => {
    const spawnMock = vi.fn();
    vi.doMock('node:child_process', () => ({ spawn: spawnMock }));

    const prompt = '更新网络配置：95830，美国，IP地址：192.89.1.42';
    const result = await handleTrigger(prompt);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('unsupported_trigger');
    }
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
