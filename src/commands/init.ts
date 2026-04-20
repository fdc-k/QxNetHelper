import { CommanderError } from 'commander';
import process from 'node:process';

import { defaultFolderAccessValidator } from '../config/folderAccess.js';
import type { FolderAccessValidator } from '../config/folderAccess.js';
import { normalizeInitInput, ValidationError } from '../config/normalize.js';
import type { NormalizedInitConfig } from '../config/normalize.js';
import { persistConfig } from '../config/store.js';
import { FeishuRemoteError } from '../feishu/errors.js';
import { formatCommandOutput } from '../output/redact.js';

export type InitCommandOptions = {
  readonly appId: string;
  readonly appSecret: string;
  readonly configDir: string;
  readonly subLink: string;
  readonly mitceLink?: string;
  readonly configRoot: string;
  readonly json?: boolean;
};

export type InitCommandDependencies = {
  readonly folderAccessValidator: FolderAccessValidator;
  readonly writeOutput: (line: string) => void;
  readonly writeError: (line: string) => void;
};

export type InitCommandResult = {
  readonly ok: true;
  readonly command: 'init';
  readonly configRoot: string;
  readonly folderToken: string;
  readonly subLink: string;
  readonly mitceLink: string;
  readonly secrets: 'redacted';
};

export type CommandFailureResult = {
  readonly ok: false;
  readonly command: 'init';
  readonly error: {
    readonly code: 'validation_failed' | 'remote_failed' | 'remote_forbidden' | 'remote_not_found';
    readonly message: string;
  };
};

const defaultDependencies: InitCommandDependencies = {
  folderAccessValidator: defaultFolderAccessValidator,
  writeOutput: (line: string) => {
    process.stdout.write(`${line}\n`);
  },
  writeError: (line: string) => {
    process.stderr.write(`${line}\n`);
  },
};

const formatSuccessText = (result: InitCommandResult): string => {
  return `Initialized qxnethelper config at ${result.configRoot} for folder ${result.folderToken}`;
};

const formatErrorText = (result: CommandFailureResult): string => {
  return `Error: ${result.error.message}`;
};

const printSuccess = (result: InitCommandResult, json: boolean, dependencies: InitCommandDependencies): void => {
  dependencies.writeOutput(formatCommandOutput(json ? result : formatSuccessText(result), json, { secrets: [] }));
};

const printFailure = (result: CommandFailureResult, json: boolean, dependencies: InitCommandDependencies): void => {
  dependencies.writeError(formatCommandOutput(json ? result : formatErrorText(result), json, { secrets: [] }));
};

const toFailureResult = (message: string): CommandFailureResult => {
  return {
    ok: false,
    command: 'init',
    error: {
      code: 'validation_failed',
      message,
    },
  };
};

const toRemoteFailureResult = (error: FeishuRemoteError): CommandFailureResult => {
  return {
    ok: false,
    command: 'init',
    error: {
      code: error.code,
      message: error.message,
    },
  };
};

const executeInit = async (
  normalized: NormalizedInitConfig,
  dependencies: InitCommandDependencies,
): Promise<InitCommandResult> => {
  await dependencies.folderAccessValidator.validate({
    appId: normalized.secrets.FEISHU_APP_ID,
    appSecret: normalized.secrets.FEISHU_APP_SECRET,
    folderToken: normalized.config.folderToken,
  });
  await persistConfig(normalized.configRoot, normalized.config, normalized.secrets);

  return {
    ok: true,
    command: 'init',
    configRoot: normalized.configRoot,
    folderToken: normalized.config.folderToken,
    subLink: normalized.config.subLink,
    mitceLink: normalized.config.mitceLink,
    secrets: 'redacted',
  };
};

export const runInitCommand = async (
  options: InitCommandOptions,
  dependencies: Partial<InitCommandDependencies> = {},
): Promise<InitCommandResult> => {
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };
  const normalized = normalizeInitInput({
    appId: options.appId,
    appSecret: options.appSecret,
    configDir: options.configDir,
    subLink: options.subLink,
    mitceLink: options.mitceLink,
    configRoot: options.configRoot,
    json: options.json ?? false,
  });

  return executeInit(normalized, resolvedDependencies);
};

export const initCommand = async (options: InitCommandOptions): Promise<void> => {
  try {
    const result = await runInitCommand(options);
    printSuccess(result, options.json ?? false, defaultDependencies);
  } catch (error) {
    if (error instanceof ValidationError) {
      const result = toFailureResult(error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(2, 'init.validation_failed', result.error.message);
    }

    if (error instanceof FeishuRemoteError) {
      const result = toRemoteFailureResult(error);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(error.exitCode, `init.${result.error.code}`, result.error.message);
    }

    throw error;
  }
};
