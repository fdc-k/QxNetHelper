import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import nock from 'nock';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const artifactsDir = join(projectRoot, 'artifacts', 'e2e', 'refresh-base');
const configRoot = join(projectRoot, 'artifacts', 'tmp', 'refresh-base');
const distCliPath = join(projectRoot, 'dist', 'cli.js');
const subscriptionUrl = 'https://example.test/subscription.yaml';

const sourceYaml = [
  'proxy-groups:',
  '  - name: Worker Group',
  '    type: select',
  '    proxies:',
  '      - Traffic Reset',
  'listeners:',
  '  - name: mixedkeep',
  '    type: mixed',
  '    port: 42111',
  '    proxy: Keep Me',
  '  - name: mixedgroup',
  '    type: mixed',
  '    port: 42112',
  '    proxy: Worker Group',
  'proxies:',
  '  - name: Keep Me',
  '    type: direct',
  '  - name: Traffic Reset',
  '    type: select',
  '    proxies:',
  '      - Legacy A',
  '  - name: Legacy A',
  '    type: direct',
  '',
].join('\n');

const subscriptionYaml = [
  'proxies:',
  '  - name: Traffic Reset',
  '    type: select',
  '    proxies:',
  '      - Worker A',
  '      - Worker B',
  '  - name: Worker A',
  '    type: direct',
  '  - name: Worker B',
  '    type: direct',
  '',
].join('\n');

const ensureBuilt = async () => {
  await readFile(distCliPath, 'utf8');
};

const createRecorder = () => {
  const stdout = [];
  const stderr = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk, _encoding, callback) => {
    stdout.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    if (typeof callback === 'function') {
      callback();
    }

    return true;
  };
  process.stderr.write = (chunk, _encoding, callback) => {
    stderr.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk));
    if (typeof callback === 'function') {
      callback();
    }

    return true;
  };

  return {
    restore: () => {
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
    },
    stdout,
    stderr,
  };
};

const runCli = async (run, argv) => {
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

const main = async () => {
  await ensureBuilt();
  await rm(artifactsDir, { recursive: true, force: true });
  await rm(configRoot, { recursive: true, force: true });
  await mkdir(artifactsDir, { recursive: true });

  nock.disableNetConnect();

  try {
    const { run } = await import(distCliPath);
    let uploadedBody = '';
    const requests = [];

    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(200, subscriptionYaml, { 'Content-Type': 'application/yaml' });

    nock('https://open.feishu.cn')
      .post('/open-apis/auth/v3/tenant_access_token/internal', {
        app_id: 'cli_app_123',
        app_secret: 'secret_123',
      })
      .times(2)
      .reply(() => {
        requests.push({ method: 'POST', path: '/open-apis/auth/v3/tenant_access_token/internal' });

        return [200, { tenant_access_token: 'tenant-token-1', expire: 120 }];
      });

    nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnQaFolder123/children')
      .query({ page_size: '1' })
      .reply(() => {
        requests.push({ method: 'GET', path: '/open-apis/drive/v1/files/fldcnQaFolder123/children', query: { page_size: '1' } });

        return [
          200,
          {
            code: 0,
            data: {
              files: [{ token: 'source-file', name: 'config_0331.yaml', type: 'file', modified_time: '2026-03-31T01:00:00Z' }],
              has_more: false,
            },
          },
        ];
      });

    nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/fldcnQaFolder123/children')
      .query({ page_size: '200' })
      .reply(() => {
        requests.push({ method: 'GET', path: '/open-apis/drive/v1/files/fldcnQaFolder123/children', query: { page_size: '200' } });

        return [
          200,
          {
            code: 0,
            data: {
              files: [{ token: 'source-file', name: 'config_0331.yaml', type: 'file', modified_time: '2026-03-31T01:00:00Z' }],
              has_more: false,
            },
          },
        ];
      });

    nock('https://open.feishu.cn')
      .get('/open-apis/drive/v1/files/source-file/download')
      .reply(() => {
        requests.push({ method: 'GET', path: '/open-apis/drive/v1/files/source-file/download' });

        return [200, sourceYaml];
      });

    nock('https://open.feishu.cn')
      .post('/open-apis/drive/v1/files/upload_all', (body) => {
        uploadedBody = typeof body === 'string' ? body : Buffer.from(body).toString('utf8');
        requests.push({ method: 'POST', path: '/open-apis/drive/v1/files/upload_all' });

        return true;
      })
      .reply(200, { code: 0, data: { file_token: 'uploaded-file' } });

    const initResult = await runCli(run, [
      'node',
      'qxnethelper',
      'init',
      '--app-id',
      'cli_app_123',
      '--app-secret',
      'secret_123',
      '--config-dir',
      'fldcnQaFolder123',
      '--sub-link',
      subscriptionUrl,
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

    if (initResult.exitCode !== 0) {
      throw new Error(`init failed: ${initResult.stderr || initResult.stdout}`);
    }

    if (refreshResult.exitCode !== 0) {
      throw new Error(`refresh-base failed: ${refreshResult.stderr || refreshResult.stdout}`);
    }

    for (const expected of [
      'name="file_name"\r\n\r\nconfig_0331_1.yaml',
      '  - name: Keep Me\n    type: direct\n  - name: Traffic Reset',
      '      - Worker A\n      - Worker B',
      '  - name: Worker A\n    type: direct',
      'proxy: Worker Group',
    ]) {
      if (!uploadedBody.includes(expected)) {
        throw new Error(`Uploaded YAML is missing expected content: ${expected}`);
      }
    }

    if (uploadedBody.includes('Legacy A')) {
      throw new Error('Uploaded YAML still contains removed proxy Legacy A');
    }

    await writeFile(join(artifactsDir, 'init.stdout.json'), `${initResult.stdout}\n`);
    await writeFile(join(artifactsDir, 'refresh-base.stdout.json'), `${refreshResult.stdout}\n`);
    await writeFile(join(artifactsDir, 'uploaded.multipart.txt'), uploadedBody);
    await writeFile(join(artifactsDir, 'requests.json'), JSON.stringify(requests, null, 2));
  } finally {
    nock.cleanAll();
    nock.enableNetConnect();
  }
};

await main();
