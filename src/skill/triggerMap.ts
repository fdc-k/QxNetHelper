import { spawn } from 'node:child_process';
import path from 'node:path';

export type TriggerType = 'init' | 'update-env' | 'refresh-base' | 'unsupported';

export type TriggerResult =
  | { readonly type: 'init'; readonly argv: readonly string[] }
  | { readonly type: 'update-env'; readonly argv: readonly string[] }
  | { readonly type: 'refresh-base'; readonly argv: readonly string[] }
  | { readonly type: 'unsupported'; readonly reason: string };

export type SkillResponse =
  | { readonly ok: true; readonly command: string; readonly output: unknown }
  | { readonly ok: false; readonly error: string; readonly message: string };

const CLI_PATH = path.resolve(process.cwd(), 'dist/cli.js');

const PROXY_URL_PATTERN = /(vless|vmess):\/\/[^\s，,]+/iu;

const INIT_PATTERNS = [/初始化\s*qxnethelper/ui, /设置\s*qxnethelper\s*配置/ui, /配置\s*Feishu/ui];

const UPDATE_ENV_PATTERNS = [
  /更新或者添加网络配置/ui,
  /更新网络配置/ui,
  /添加网络配置/ui,
  /更新环境配置/ui,
];

const REFRESH_BASE_PATTERNS = [/更新基础网络配置/ui, /刷新基础配置/ui, /刷新订阅配置/ui];

const extractAppId = (prompt: string): string | null => {
  const match = prompt.match(/app[-_]?id\s*(?:是|为|=|:)\s*([a-zA-Z0-9_-]+)/ui);

  return match?.[1] ?? null;
};

const extractAppSecret = (prompt: string): string | null => {
  const match = prompt.match(/app[-_]?secret\s*(?:是|为|=|:)\s*([a-zA-Z0-9_-]+)/ui);

  return match?.[1] ?? null;
};

const extractConfigDir = (prompt: string): string | null => {
  const match = prompt.match(
    /config[-_]?dir\s*(?:是|为|=|:)\s*(https:\/\/[^\s，,]+|fldcn[a-zA-Z0-9]+)/ui,
  );

  return match?.[1] ?? null;
};

const extractSubLink = (prompt: string): string | null => {
  const match = prompt.match(/sub[-_]?link\s*(?:是|为|=|:)\s*(https:\/\/[^\s，,]+)/ui);

  return match?.[1] ?? null;
};

const extractEnvId = (prompt: string): string | null => {
  const match = prompt.match(/(?:配置|环境)[:：]\s*(\d{3,})\s*[，,]/u);

  return match?.[1] ?? null;
};

const extractRegion = (prompt: string): string | null => {
  const match = prompt.match(/[:：]\s*\d+[，,]\s*([^，,]+?)\s*[，,]/u);
  const region = match?.[1]?.trim();

  if (!region || region.startsWith('IP地址') || region.startsWith('IP')) {
    return null;
  }

  return region;
};

const extractIp = (prompt: string): string | null => {
  const match = prompt.match(/IP地址[:：]\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/ui);

  return match?.[1] ?? null;
};

const extractNodeUrl = (prompt: string): string | null => {
  const match = prompt.match(PROXY_URL_PATTERN);

  return match?.[0] ?? null;
};

export const parseTrigger = (prompt: string): TriggerResult => {
  const normalizedPrompt = prompt.trim();

  for (const pattern of INIT_PATTERNS) {
    if (pattern.test(normalizedPrompt)) {
      const appId = extractAppId(normalizedPrompt);
      const appSecret = extractAppSecret(normalizedPrompt);
      const configDir = extractConfigDir(normalizedPrompt);
      const subLink = extractSubLink(normalizedPrompt);

      if (!appId || !appSecret || !configDir || !subLink) {
        return {
          type: 'unsupported',
          reason: 'init trigger detected but missing required fields (app-id, app-secret, config-dir, sub-link)',
        };
      }

      return {
        type: 'init',
        argv: [
          'init',
          '--app-id',
          appId,
          '--app-secret',
          appSecret,
          '--config-dir',
          configDir,
          '--sub-link',
          subLink,
          '--json',
        ],
      };
    }
  }

  for (const pattern of UPDATE_ENV_PATTERNS) {
    if (pattern.test(normalizedPrompt)) {
      const envId = extractEnvId(normalizedPrompt);
      const region = extractRegion(normalizedPrompt);
      const ip = extractIp(normalizedPrompt);
      const nodeUrl = extractNodeUrl(normalizedPrompt);

      if (!envId) {
        return {
          type: 'unsupported',
          reason: 'update-env trigger detected but missing env-id',
        };
      }

      if (!region) {
        return {
          type: 'unsupported',
          reason: 'update-env trigger detected but missing region',
        };
      }

      if (!ip) {
        return {
          type: 'unsupported',
          reason: 'update-env trigger detected but missing IP address',
        };
      }

      if (!nodeUrl) {
        return {
          type: 'unsupported',
          reason: 'update-env trigger detected but missing node URL (vless:// or vmess://)',
        };
      }

      return {
        type: 'update-env',
        argv: [
          'update-env',
          '--env-id',
          envId,
          '--region',
          region,
          '--ip',
          ip,
          '--node-url',
          nodeUrl,
          '--json',
        ],
      };
    }
  }

  for (const pattern of REFRESH_BASE_PATTERNS) {
    if (pattern.test(normalizedPrompt)) {
      return {
        type: 'refresh-base',
        argv: ['refresh-base', '--json'],
      };
    }
  }

  return {
    type: 'unsupported',
    reason: 'prompt does not match any supported trigger pattern',
  };
};

export const invokeCli = (argv: readonly string[]): Promise<SkillResponse> => {
  return new Promise((resolve) => {
    const child = spawn('node', [CLI_PATH, ...argv], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const output = stdout.trim() || stderr.trim();

      try {
        const parsed = JSON.parse(output) as unknown;

        if (code === 0) {
          resolve({
            ok: true,
            command: argv[0] ?? 'unknown',
            output: parsed,
          });
        } else {
          resolve({
            ok: false,
            error: 'command_failed',
            message: typeof parsed === 'object' && parsed !== null && 'error' in parsed
              ? String((parsed as { error?: { message?: string } }).error?.message ?? 'Command failed')
              : 'Command failed',
          });
        }
      } catch {
        if (code === 0) {
          resolve({
            ok: true,
            command: argv[0] ?? 'unknown',
            output: output,
          });
        } else {
          resolve({
            ok: false,
            error: 'command_failed',
            message: output || 'Command failed',
          });
        }
      }
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        error: 'spawn_failed',
        message: error.message,
      });
    });
  });
};

export const handleTrigger = async (prompt: string): Promise<SkillResponse> => {
  const trigger = parseTrigger(prompt);

  if (trigger.type === 'unsupported') {
    return {
      ok: false,
      error: 'unsupported_trigger',
      message: trigger.reason,
    };
  }

  return invokeCli(trigger.argv);
};
