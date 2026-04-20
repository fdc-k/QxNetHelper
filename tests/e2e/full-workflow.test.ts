import { Buffer } from 'node:buffer';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { run } from '../../src/cli.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..', '..');
const artifactsDir = join(projectRoot, 'artifacts', 'e2e', 'full-workflow');
const configRoot = join(projectRoot, 'artifacts', 'tmp', 'full-workflow');
const baseYamlPath = join(projectRoot, 'tests', 'fixtures', 'e2e', 'base-config.yaml');
const subscriptionYamlPath = join(projectRoot, 'tests', 'fixtures', 'e2e', 'subscription.yaml');
const sampleVlessUrl = 'vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-%E5%BE%B7%E5%9B%BD-sing1';
const subscriptionUrl = 'https://example.test/subscription.yaml?token=e2e-secret-token';
const feishuSecret = 'secret_123';
const FIXED_NOW = new Date('2026-03-31T12:00:00+08:00');

type CliRunResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

type MockFile = {
  readonly token: string;
  readonly name: string;
  readonly modifiedTime: string;
  content: string;
};

const createRecorder = (): {
  restore: () => void;
  stdout: string[];
  stderr: string[];
} => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const createWriteInterceptor = (sink: string[]) => {
    return (
      chunk: string | Uint8Array,
      encodingOrCallback?: string | ((err?: Error | null) => void),
      callback?: (err?: Error | null) => void,
    ): boolean => {
      sink.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));

      if (typeof encodingOrCallback === 'function') {
        encodingOrCallback();
      }

      if (typeof callback === 'function') {
        callback();
      }

      return true;
    };
  };

  process.stdout.write = createWriteInterceptor(stdout);
  process.stderr.write = createWriteInterceptor(stderr);

  return {
    restore: () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    },
    stdout,
    stderr,
  };
};

const runCli = async (run: (argv: string[]) => Promise<void>, argv: string[]): Promise<CliRunResult> => {
  const recorder = createRecorder();
  process.exitCode = 0;

  try {
    await run(argv);

    return {
      exitCode: process.exitCode ?? 0,
      stdout: recorder.stdout.join('').trim(),
      stderr: recorder.stderr.join('').trim(),
    };
  } finally {
    recorder.restore();
  }
};

const extractMultipartValue = (body: string, fieldName: string): string => {
  const match = body.match(new RegExp(`name="${fieldName}"\\r\\n\\r\\n([^\\r]+)`, 'u'));

  if (!match) {
    throw new Error(`Missing multipart field ${fieldName}`);
  }

  return match[1];
};

const extractUploadedYaml = (body: string): string => {
  const match = body.match(/name="file"[\s\S]*?\r\n\r\n([\s\S]*?)\r\n--/u);

  if (!match) {
    throw new Error('Missing multipart file payload');
  }

  return match[1];
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FIXED_NOW);
  nock.disableNetConnect();
});

afterEach(() => {
  vi.useRealTimers();
  nock.cleanAll();
  nock.enableNetConnect();
});

describe('full mocked workflow', () => {
  test('runs init, update-env, and refresh-base sequentially and records deterministic artifacts', async () => {
    await rm(artifactsDir, { recursive: true, force: true });
    await rm(configRoot, { recursive: true, force: true });
    await mkdir(artifactsDir, { recursive: true });

    const baseYaml = await readFile(baseYamlPath, 'utf8');
    const subscriptionYaml = await readFile(subscriptionYamlPath, 'utf8');
    const files = new Map<string, MockFile>();
    const uploads: Array<{ fileName: string; body: string; yaml: string }> = [];
    const requests: Array<{ method: string; path: string; query?: Record<string, string> }> = [];

    files.set('source-file', {
      token: 'source-file',
      name: 'config_0331.yaml',
      modifiedTime: '2026-03-31T01:00:00Z',
      content: baseYaml,
    });

    nock.disableNetConnect();

    nock('https://example.test')
      .persist()
      .get('/subscription.yaml')
      .query({ token: 'e2e-secret-token' })
      .reply(() => {
        requests.push({ method: 'GET', path: '/subscription.yaml', query: { token: 'e2e-secret-token' } });

        return [200, subscriptionYaml, { 'Content-Type': 'application/yaml' }];
      });

    nock('https://app.mitce.net')
      .persist()
      .get('/')
      .query({ sid: '564180', token: 'srvyubgg' })
      .reply(() => {
        requests.push({ method: 'GET', path: '/', query: { sid: '564180', token: 'srvyubgg' } });

        return [200, 'proxies:\n  - name: US-1\n    type: direct\n', { 'Content-Type': 'application/yaml' }];
      });

    nock('https://open.feishu.cn')
      .persist()
      .post('/open-apis/auth/v3/tenant_access_token/internal', {
        app_id: 'cli_app_123',
        app_secret: feishuSecret,
      })
      .reply(() => {
        requests.push({ method: 'POST', path: '/open-apis/auth/v3/tenant_access_token/internal' });

        return [200, { tenant_access_token: 'tenant-token-1', expire: 120 }];
      });

    nock('https://open.feishu.cn')
      .persist()
      .get('/open-apis/drive/v1/files/fldcnQaFolder123/children')
      .query(true)
      .reply((_, __, callback) => {
        callback(null, [
          200,
          {
            code: 0,
            data: {
              files: [...files.values()].map((file) => ({
                token: file.token,
                name: file.name,
                type: 'file',
                modified_time: file.modifiedTime,
              })),
              has_more: false,
            },
          },
        ]);
      })
      .on('request', function (_request, _interceptor) {
        const query = this.queries ?? {};
        requests.push({
          method: 'GET',
          path: '/open-apis/drive/v1/files/fldcnQaFolder123/children',
          query: Object.fromEntries(Object.entries(query).map(([key, value]) => [key, String(value)])),
        });
      });

    nock('https://open.feishu.cn')
      .persist()
      .get(/\/open-apis\/drive\/v1\/files\/[^/]+\/download/u)
      .reply((uri) => {
        const fileToken = uri.split('/')[5];
        const file = files.get(fileToken);

        if (!file) {
          return [404, 'missing file'];
        }

        requests.push({ method: 'GET', path: `/open-apis/drive/v1/files/${fileToken}/download` });

        return [200, file.content];
      });

    nock('https://open.feishu.cn')
      .persist()
      .post('/open-apis/drive/v1/files/upload_all', (body: string | Buffer) => {
        const serializedBody = Buffer.isBuffer(body) ? body.toString('utf8') : body;
        const fileName = extractMultipartValue(serializedBody, 'file_name');
        const yaml = extractUploadedYaml(serializedBody);
        const token = `uploaded-${uploads.length + 1}`;

        uploads.push({ fileName, body: serializedBody, yaml });
        files.set(token, {
          token,
          name: fileName,
          modifiedTime: `2026-03-31T0${uploads.length + 1}:00:00Z`,
          content: yaml,
        });
        requests.push({ method: 'POST', path: '/open-apis/drive/v1/files/upload_all' });

        return true;
      })
      .reply(200, { code: 0, data: { file_token: 'uploaded-file-token' } });

    const initResult = await runCli(run, [
      'node',
      'qxnethelper',
      'init',
      '--app-id',
      'cli_app_123',
      '--app-secret',
      feishuSecret,
      '--config-dir',
      'fldcnQaFolder123',
      '--sub-link',
      subscriptionUrl,
      '--config-root',
      configRoot,
      '--json',
    ]);
    const updateResult = await runCli(run, [
      'node',
      'qxnethelper',
      'update-env',
      '--env-id',
      '95830',
      '--region',
      '美国',
      '--ip',
      '192.89.1.42',
      '--node-url',
      sampleVlessUrl,
      '--config-root',
      configRoot,
      '--json',
    ]);
    const refreshResult = await runCli(run, [
      'node',
      'qxnethelper',
      'refresh-base',
      '--config-root',
      configRoot,
      '--json',
    ]);

    expect(initResult.exitCode).toBe(0);
    expect(updateResult.exitCode).toBe(0);
    expect(refreshResult.exitCode).toBe(0);
    expect(initResult.stdout).not.toContain(feishuSecret);
    expect(updateResult.stdout).not.toContain(feishuSecret);
    expect(refreshResult.stdout).not.toContain(feishuSecret);
    expect(refreshResult.stdout).toContain('token=[REDACTED]');
    expect(refreshResult.stdout).not.toContain('e2e-secret-token');
    expect(uploads).toHaveLength(2);
    expect(uploads[0]?.fileName).toBe('config_0331_1.yaml');
    expect(uploads[1]?.fileName).toBe('config_0331_2.yaml');
    expect(uploads[0]?.yaml).toContain('name: mixed830');
    expect(uploads[0]?.yaml).toContain('proxy: 830');
    expect(uploads[1]?.yaml).toContain('name: mixed830');
    expect(uploads[1]?.yaml).toContain('  - name: Traffic Reset');
    expect(uploads[1]?.yaml).toContain('      - Worker A');
    expect(uploads[1]?.yaml).toContain('      - Worker B');
    expect(uploads[1]?.yaml).not.toContain('Legacy A');
    expect(uploads[1]?.yaml).not.toContain('Legacy B');

    await writeFile(join(artifactsDir, 'init.stdout.json'), `${initResult.stdout}\n`);
    await writeFile(join(artifactsDir, 'update-env.stdout.json'), `${updateResult.stdout}\n`);
    await writeFile(join(artifactsDir, 'refresh-base.stdout.json'), `${refreshResult.stdout}\n`);
    await writeFile(join(artifactsDir, 'uploaded-bodies.json'), JSON.stringify(uploads, null, 2));
    await writeFile(join(artifactsDir, 'requests.json'), JSON.stringify(requests, null, 2));
    await writeFile(join(artifactsDir, 'final-uploaded.yaml'), uploads[1]?.yaml ?? '');
  });
});
