import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const artifactsDir = join(projectRoot, 'artifacts', 'e2e', 'update-env');
const configRoot = join(projectRoot, 'artifacts', 'tmp', 'update-env');
const distCliPath = join(projectRoot, 'dist', 'cli.js');
const sampleVlessUrl = 'vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-%E5%BE%B7%E5%9B%BD-sing1';
const baseYaml = [
  'listeners:',
  '  - name: mixed111',
  '    type: mixed',
  '    port: 42111',
  '    proxy: 111',
  'proxies:',
  '  - name: Keep Me',
  '    type: direct',
  '  - name: Traffic Reset',
  '    type: direct',
  '',
].join('\n');

const runNode = (args, env) => {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: projectRoot,
      env: {
        ...process.env,
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
};

const ensureBuilt = async () => {
  await readFile(distCliPath, 'utf8');
};

const main = async () => {
  await ensureBuilt();
  await rm(artifactsDir, { recursive: true, force: true });
  await rm(configRoot, { recursive: true, force: true });
  await mkdir(artifactsDir, { recursive: true });

  let uploadedBody = '';
  const requests = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    const body = await new Promise((resolve) => {
      const chunks = [];

      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    requests.push({ method: request.method ?? 'GET', path: url.pathname, query: Object.fromEntries(url.searchParams.entries()) });

    if (request.method === 'POST' && url.pathname === '/open-apis/auth/v3/tenant_access_token/internal') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ tenant_access_token: 'tenant-token-1', expire: 120 }));

      return;
    }

    if (request.method === 'GET' && url.pathname === '/open-apis/drive/v1/files/fldcnQaFolder123/children') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({
        code: 0,
        data: {
          files: [{ token: 'source-file', name: 'config_0331.yaml', type: 'file', modified_time: '2026-03-31T01:00:00Z' }],
          has_more: false,
        },
      }));

      return;
    }

    if (request.method === 'GET' && url.pathname === '/open-apis/drive/v1/files/source-file/download') {
      response.setHeader('content-type', 'application/octet-stream');
      response.end(baseYaml);

      return;
    }

    if (request.method === 'POST' && url.pathname === '/open-apis/drive/v1/files/upload_all') {
      uploadedBody = body;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ code: 0, data: { file_token: 'uploaded-file' } }));

      return;
    }

    response.statusCode = 404;
    response.end('not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not determine QA mock server address');
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const sharedEnv = { QXNETHELPER_FEISHU_BASE_URL: baseUrl };
    const initResult = await runNode([
      distCliPath,
      'init',
      '--app-id',
      'cli_app_123',
      '--app-secret',
      'secret_123',
      '--config-dir',
      'fldcnQaFolder123',
      '--sub-link',
      'https://example.test/subscription.yaml',
      '--config-root',
      configRoot,
      '--json',
    ], sharedEnv);
    const updateResult = await runNode([
      distCliPath,
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
    ], sharedEnv);

    if (initResult.code !== 0) {
      throw new Error(`init failed: ${initResult.stderr || initResult.stdout}`);
    }

    if (updateResult.code !== 0) {
      throw new Error(`update-env failed: ${updateResult.stderr || updateResult.stdout}`);
    }

    if (!uploadedBody.includes('name="file_name"\r\n\r\nconfig_0331_1.yaml')) {
      throw new Error('Uploaded multipart body did not contain the expected output filename');
    }

    for (const expected of [
      'name: mixed830',
      'port: 42830',
      'proxy: 830',
      'type: vless',
      'server: zdegeuy2.bia3.top',
      'client-fingerprint: chrome',
    ]) {
      if (!uploadedBody.includes(expected)) {
        throw new Error(`Uploaded YAML is missing expected content: ${expected}`);
      }
    }

    if (!/name: ['"]?830['"]?/u.test(uploadedBody)) {
      throw new Error('Uploaded YAML is missing expected content: proxy node named 830');
    }

    await writeFile(join(artifactsDir, 'init.stdout.json'), initResult.stdout);
    await writeFile(join(artifactsDir, 'update-env.stdout.json'), updateResult.stdout);
    await writeFile(join(artifactsDir, 'uploaded.multipart.txt'), uploadedBody);
    await writeFile(join(artifactsDir, 'requests.json'), JSON.stringify(requests, null, 2));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve(undefined))));
  }
};

await main();
