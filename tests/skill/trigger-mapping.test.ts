import { describe, expect, test } from 'vitest';

import { handleTrigger, parseTrigger } from '../../src/skill/triggerMap.js';

const SAMPLE_VLESS_URL =
  'vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-德国-sing1';

describe('parseTrigger', () => {
  describe('init triggers', () => {
    test('detects "初始化 qxnethelper" pattern', () => {
      const prompt =
        '初始化 qxnethelper，app-id 是 cli_app_123，app-secret 是 secret_123，config-dir 是 https://feishu.cn/drive/folder/fldcnTestFolder123，sub-link 是 https://example.test/subscription.yaml';
      const result = parseTrigger(prompt);

      expect(result.type).toBe('init');
      if (result.type === 'init') {
        expect(result.argv).toContain('--app-id');
        expect(result.argv).toContain('cli_app_123');
        expect(result.argv).toContain('--app-secret');
        expect(result.argv).toContain('secret_123');
        expect(result.argv).toContain('--config-dir');
        expect(result.argv).toContain('https://feishu.cn/drive/folder/fldcnTestFolder123');
        expect(result.argv).toContain('--sub-link');
        expect(result.argv).toContain('https://example.test/subscription.yaml');
        expect(result.argv).toContain('--json');
      }
    });

    test('detects "设置 qxnethelper 配置" pattern', () => {
      const prompt =
        '设置 qxnethelper 配置，appId 是 test_app_456，appSecret 是 test_secret，configDir 是 fldcnFolderToken456，subLink 是 https://sub.example.com/config.yaml';
      const result = parseTrigger(prompt);

      expect(result.type).toBe('init');
      if (result.type === 'init') {
        expect(result.argv).toContain('test_app_456');
        expect(result.argv).toContain('test_secret');
      }
    });

    test('returns unsupported when init fields are missing', () => {
      const prompt = '初始化 qxnethelper';
      const result = parseTrigger(prompt);

      expect(result.type).toBe('unsupported');
    });
  });

  describe('update-env triggers', () => {
    test('maps canonical prompt to update-env with correct flags', () => {
      const prompt = `更新或者添加网络配置：95830，美国，IP地址：192.89.1.42，${SAMPLE_VLESS_URL}`;
      const result = parseTrigger(prompt);

      expect(result.type).toBe('update-env');
      if (result.type === 'update-env') {
        expect(result.argv).toEqual([
          'update-env',
          '--env-id',
          '95830',
          '--region',
          '美国',
          '--ip',
          '192.89.1.42',
          '--node-url',
          SAMPLE_VLESS_URL,
          '--json',
        ]);
      }
    });

    test('detects "更新网络配置" pattern', () => {
      const prompt = `更新网络配置：12345，德国，IP地址：10.0.0.1，${SAMPLE_VLESS_URL}`;
      const result = parseTrigger(prompt);

      expect(result.type).toBe('update-env');
      if (result.type === 'update-env') {
        expect(result.argv).toContain('--env-id');
        expect(result.argv).toContain('12345');
        expect(result.argv).toContain('--region');
        expect(result.argv).toContain('德国');
        expect(result.argv).toContain('--ip');
        expect(result.argv).toContain('10.0.0.1');
      }
    });

    test('detects "添加网络配置" pattern', () => {
      const prompt = `添加网络配置：99999，日本，IP地址：192.168.1.1，${SAMPLE_VLESS_URL}`;
      const result = parseTrigger(prompt);

      expect(result.type).toBe('update-env');
      if (result.type === 'update-env') {
        expect(result.argv).toContain('99999');
        expect(result.argv).toContain('日本');
        expect(result.argv).toContain('192.168.1.1');
      }
    });

    test('detects "更新环境配置" pattern', () => {
      const prompt = `更新环境配置：11111，英国，IP地址：172.16.0.1，${SAMPLE_VLESS_URL}`;
      const result = parseTrigger(prompt);

      expect(result.type).toBe('update-env');
    });

    test('handles vmess:// URLs', () => {
      const vmessUrl = 'vmess://eyJ2IjoiMiIsInBzIjoidGVzdCIsImFkZCI6InRlc3QuZXhhbXBsZS5jb20iLCJwb3J0IjoiNDQzIiwiaWQiOiJ0ZXN0LXV1aWQiLCJhaWQiOiIwIiwic2N5IjoiYXV0byIsIm5ldCI6InRjcCIsInR5cGUiOiJub25lIiwiaG9zdCI6IiIsInBhdGgiOiIiLCJ0bHMiOiIifQ==';
      const prompt = `更新网络配置：22222，测试，IP地址：1.2.3.4，${vmessUrl}`;
      const result = parseTrigger(prompt);

      expect(result.type).toBe('update-env');
      if (result.type === 'update-env') {
        expect(result.argv).toContain(vmessUrl);
      }
    });
  });

  describe('refresh-base triggers', () => {
    test('detects "更新基础网络配置" pattern', () => {
      const prompt = '更新基础网络配置';
      const result = parseTrigger(prompt);

      expect(result.type).toBe('refresh-base');
      if (result.type === 'refresh-base') {
        expect(result.argv).toEqual(['refresh-base', '--json']);
      }
    });

    test('detects "刷新基础配置" pattern', () => {
      const prompt = '刷新基础配置';
      const result = parseTrigger(prompt);

      expect(result.type).toBe('refresh-base');
    });

    test('detects "刷新订阅配置" pattern', () => {
      const prompt = '刷新订阅配置';
      const result = parseTrigger(prompt);

      expect(result.type).toBe('refresh-base');
    });
  });
});

describe('handleTrigger', () => {
  test('returns unsupported_trigger for unmatched prompts', async () => {
    const result = await handleTrigger('random unrelated prompt');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('unsupported_trigger');
    }
  });

  test('returns unsupported_trigger when env-id is missing', async () => {
    const prompt = `更新网络配置：美国，IP地址：192.89.1.42，${SAMPLE_VLESS_URL}`;
    const result = await handleTrigger(prompt);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('unsupported_trigger');
    }
  });

  test('returns unsupported_trigger when node URL is missing', async () => {
    const prompt = '更新网络配置：95830，美国，IP地址：192.89.1.42';
    const result = await handleTrigger(prompt);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('unsupported_trigger');
    }
  });
});
