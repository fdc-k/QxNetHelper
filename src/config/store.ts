import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { persistedConfigSchema, persistedSecretsSchema, type PersistedConfig, type PersistedSecrets } from './schema.js';

export type StoredConfigPaths = {
  readonly baseDir: string;
  readonly envFile: string;
  readonly configFile: string;
};

type ErrorWithCode = {
  readonly code?: string;
};

const ENV_FILE_MODE = 0o600;
const CONFIG_DIR_NAME = '.qxnethelper';

const buildEnvContent = (secrets: PersistedSecrets): string => {
  const parsedSecrets = persistedSecretsSchema.parse(secrets);

  return [
    `FEISHU_APP_ID=${parsedSecrets.FEISHU_APP_ID}`,
    `FEISHU_APP_SECRET=${parsedSecrets.FEISHU_APP_SECRET}`,
  ].join('\n').concat('\n');
};

const buildConfigContent = (config: PersistedConfig): string => {
  const parsedConfig = persistedConfigSchema.parse(config);

  return JSON.stringify(parsedConfig, null, 2).concat('\n');
};

const writeAtomic = async (filePath: string, content: string, mode?: number): Promise<void> => {
  const directory = dirname(filePath);
  const tempFilePath = join(directory, `.${randomUUID()}.tmp`);

  await mkdir(directory, { recursive: true });
  await writeFile(tempFilePath, content, mode === undefined ? undefined : { mode });
  await rename(tempFilePath, filePath);
};

export const resolveConfigPaths = (configRoot: string): StoredConfigPaths => {
  const baseDir = join(configRoot, CONFIG_DIR_NAME);

  return {
    baseDir,
    envFile: join(baseDir, '.env'),
    configFile: join(baseDir, 'config.json'),
  };
};

export const persistConfig = async (configRoot: string, config: PersistedConfig, secrets: PersistedSecrets): Promise<StoredConfigPaths> => {
  const paths = resolveConfigPaths(configRoot);
  const envContent = buildEnvContent(secrets);
  const configContent = buildConfigContent(config);

  await mkdir(paths.baseDir, { recursive: true });
  await writeAtomic(paths.envFile, envContent, ENV_FILE_MODE);
  await writeAtomic(paths.configFile, configContent);

  return paths;
};

export const readStoredEnv = async (envFile: string): Promise<string | null> => {
  try {
    return await readFile(envFile, 'utf8');
  } catch (error) {
    if ((error as ErrorWithCode).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

export const readStoredConfig = async (configFile: string): Promise<string | null> => {
  try {
    return await readFile(configFile, 'utf8');
  } catch (error) {
    if ((error as ErrorWithCode).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

const parseEnvContent = (content: string): PersistedSecrets => {
  const values: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return persistedSecretsSchema.parse(values);
};

export const loadPersistedState = async (configRoot: string): Promise<{
  readonly paths: StoredConfigPaths;
  readonly config: PersistedConfig;
  readonly secrets: PersistedSecrets;
}> => {
  const paths = resolveConfigPaths(configRoot);
  const [envContent, configContent] = await Promise.all([
    readStoredEnv(paths.envFile),
    readStoredConfig(paths.configFile),
  ]);

  if (envContent === null || configContent === null) {
    throw new Error('qxnethelper is not initialized in the requested config-root');
  }

  return {
    paths,
    config: persistedConfigSchema.parse(JSON.parse(configContent) as unknown),
    secrets: parseEnvContent(envContent),
  };
};
