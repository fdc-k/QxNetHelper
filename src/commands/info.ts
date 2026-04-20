import { CommanderError } from 'commander';
import process from 'node:process';

import { loadPersistedState } from '../config/store.js';
import { formatCommandOutput } from '../output/redact.js';

export type InfoCommandOptions = {
  readonly configRoot: string;
  readonly json?: boolean;
};

type InfoCommandDependencies = {
  readonly writeOutput: (line: string) => void;
  readonly writeError: (line: string) => void;
};

export type InfoCommandResult = {
  readonly ok: true;
  readonly command: 'info';
  readonly configRoot: string;
  readonly folderToken: string;
  readonly folderUrl: string | null;
  readonly kuromisSubscription: string;
  readonly mitceSubscription: string;
  readonly timezone: string;
  readonly authMode: string;
  readonly schemaVersion: number;
};

type InfoCommandFailure = {
  readonly ok: false;
  readonly command: 'info';
  readonly error: {
    readonly code: 'validation_failed';
    readonly message: string;
  };
};

const defaultDependencies: InfoCommandDependencies = {
  writeOutput: (line: string) => {
    process.stdout.write(`${line}\n`);
  },
  writeError: (line: string) => {
    process.stderr.write(`${line}\n`);
  },
};

const formatSuccessText = (result: InfoCommandResult): string => {
  return [
    'QxNetHelper Configuration',
    '========================',
    '',
    `Config Root: ${result.configRoot}`,
    `Feishu Folder: ${result.folderToken}`,
    result.folderUrl ? `Folder URL: ${result.folderUrl}` : '',
    '',
    'Subscription Sources:',
    `  Kuromis: ${result.kuromisSubscription}`,
    `  Mitce:   ${result.mitceSubscription}`,
    '',
    `Timezone: ${result.timezone}`,
    `Auth Mode: ${result.authMode}`,
    `Schema Version: ${result.schemaVersion}`,
  ].filter(Boolean).join('\n');
};

const formatErrorText = (result: InfoCommandFailure): string => {
  return `Error: ${result.error.message}`;
};

const printSuccess = (result: InfoCommandResult, json: boolean, dependencies: InfoCommandDependencies): void => {
  dependencies.writeOutput(formatCommandOutput(json ? result : formatSuccessText(result), json, { secrets: [] }));
};

const printFailure = (result: InfoCommandFailure, json: boolean, dependencies: InfoCommandDependencies): void => {
  dependencies.writeError(formatCommandOutput(json ? result : formatErrorText(result), json, { secrets: [] }));
};

const toFailureResult = (message: string): InfoCommandFailure => {
  return {
    ok: false,
    command: 'info',
    error: {
      code: 'validation_failed',
      message,
    },
  };
};

const normalizeCommandOptions = (options: InfoCommandOptions): InfoCommandOptions => {
  const configRoot = options.configRoot.trim();

  if (configRoot.length === 0) {
    throw new Error('config-root is required');
  }

  return {
    ...options,
    configRoot,
  };
};

export const runInfoCommand = async (
  options: InfoCommandOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dependencies: Partial<InfoCommandDependencies> = {},
): Promise<InfoCommandResult> => {
  const normalized = normalizeCommandOptions(options);
  const storedState = await loadPersistedState(normalized.configRoot);

  return {
    ok: true,
    command: 'info',
    configRoot: normalized.configRoot,
    folderToken: storedState.config.folderToken,
    folderUrl: storedState.config.folderUrl,
    kuromisSubscription: storedState.config.subLink,
    mitceSubscription: storedState.config.mitceLink,
    timezone: storedState.config.timezone,
    authMode: storedState.config.authMode,
    schemaVersion: storedState.config.schemaVersion,
  };
};

export const infoCommand = async (options: InfoCommandOptions): Promise<void> => {
  try {
    const result = await runInfoCommand(options);
    printSuccess(result, options.json ?? false, defaultDependencies);
  } catch (error) {
    if (
      error instanceof TypeError
      || (error instanceof Error && error.message === 'config-root is required')
      || (error instanceof Error && error.message === 'qxnethelper is not initialized in the requested config-root')
    ) {
      const result = toFailureResult(error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(2, `info.${result.error.code}`, result.error.message);
    }

    throw error;
  }
};
