import { CommanderError } from 'commander';
import process from 'node:process';

import { loadPersistedState } from '../config/store.js';
import { createTenantAccessTokenProvider } from '../feishu/auth.js';
import { getFeishuBaseUrl } from '../feishu/baseUrl.js';
import { createFeishuDriveClient, type FeishuDriveClient } from '../feishu/driveClient.js';
import { FeishuRemoteError } from '../feishu/errors.js';
import { formatCommandOutput } from '../output/redact.js';
import { fetchSubscriptionTail, SubscriptionRemoteError } from '../subscription/fetch.js';
import { SubscriptionSourceError } from '../subscription/parseYaml.js';
import { type RefreshBaseWorkflowResult, runRefreshBaseWorkflow } from '../workflows/refreshBase.js';
import { YamlPreconditionError } from '../yaml/errors.js';

export type RefreshBaseCommandOptions = {
  readonly configRoot: string;
  readonly json?: boolean;
};

type FailureCode =
  | 'validation_failed'
  | 'remote_failed'
  | 'remote_forbidden'
  | 'remote_not_found'
  | SubscriptionSourceError['code']
  | YamlPreconditionError['code'];

type RefreshBaseCommandDependencies = {
  readonly writeOutput: (line: string) => void;
  readonly writeError: (line: string) => void;
  readonly now?: () => Date;
  readonly createDriveClient?: (input: { readonly appId: string; readonly appSecret: string }) => FeishuDriveClient;
  readonly fetchTail?: (url: string) => ReturnType<typeof fetchSubscriptionTail>;
};

type RefreshBaseCommandFailure = {
  readonly ok: false;
  readonly command: 'refresh-base';
  readonly error: {
    readonly code: FailureCode;
    readonly message: string;
  };
};

const defaultDependencies: RefreshBaseCommandDependencies = {
  writeOutput: (line: string) => {
    process.stdout.write(`${line}\n`);
  },
  writeError: (line: string) => {
    process.stderr.write(`${line}\n`);
  },
  createDriveClient: ({ appId, appSecret }) => {
    const baseUrl = getFeishuBaseUrl();
    const tokenProvider = createTenantAccessTokenProvider({ appId, appSecret, baseUrl });

    return createFeishuDriveClient({ tokenProvider, baseUrl });
  },
  fetchTail: (url: string) => fetchSubscriptionTail(url),
};

const formatSuccessText = (result: RefreshBaseWorkflowResult): string => {
  return `Refreshed ${result.sourceFile} -> ${result.outputFile} from ${result.subscriptionUrl}`;
};

const formatErrorText = (result: RefreshBaseCommandFailure): string => {
  return `Error: ${result.error.message}`;
};

const printSuccess = (result: RefreshBaseWorkflowResult, json: boolean, dependencies: RefreshBaseCommandDependencies): void => {
  dependencies.writeOutput(formatCommandOutput(json ? result : formatSuccessText(result), json, { secrets: [] }));
};

const printFailure = (result: RefreshBaseCommandFailure, json: boolean, dependencies: RefreshBaseCommandDependencies): void => {
  dependencies.writeError(formatCommandOutput(json ? result : formatErrorText(result), json, { secrets: [] }));
};

const toFailureResult = (code: FailureCode, message: string): RefreshBaseCommandFailure => {
  return {
    ok: false,
    command: 'refresh-base',
    error: {
      code,
      message,
    },
  };
};

const normalizeCommandOptions = (options: RefreshBaseCommandOptions): RefreshBaseCommandOptions => {
  const configRoot = options.configRoot.trim();

  if (configRoot.length === 0) {
    throw new Error('config-root is required');
  }

  return {
    ...options,
    configRoot,
  };
};

export const runRefreshBaseCommand = async (
  options: RefreshBaseCommandOptions,
  dependencies: Partial<RefreshBaseCommandDependencies> = {},
): Promise<RefreshBaseWorkflowResult> => {
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };
  const normalized = normalizeCommandOptions(options);
  const storedState = await loadPersistedState(normalized.configRoot);
  const driveClient = resolvedDependencies.createDriveClient?.({
    appId: storedState.secrets.FEISHU_APP_ID,
    appSecret: storedState.secrets.FEISHU_APP_SECRET,
  });

  if (!driveClient) {
    throw new Error('Could not create Feishu drive client');
  }

  const subscriptionTail = await resolvedDependencies.fetchTail?.(storedState.config.subLink);

  if (!subscriptionTail) {
    throw new Error('Could not fetch subscription tail');
  }

  return runRefreshBaseWorkflow(
    {
      configRoot: normalized.configRoot,
      folderToken: storedState.config.folderToken,
      subscriptionUrl: storedState.config.subLink,
      subscriptionTail,
    },
    {
      driveClient,
      now: resolvedDependencies.now,
    },
  );
};

export const refreshBaseCommand = async (options: RefreshBaseCommandOptions): Promise<void> => {
  try {
    const result = await runRefreshBaseCommand(options);
    printSuccess(result, options.json ?? false, defaultDependencies);
  } catch (error) {
    if (
      error instanceof TypeError
      || (error instanceof Error && error.message === 'config-root is required')
      || (error instanceof Error && error.message === 'qxnethelper is not initialized in the requested config-root')
    ) {
      const result = toFailureResult('validation_failed', error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(2, `refresh-base.${result.error.code}`, result.error.message);
    }

    if (error instanceof SubscriptionSourceError) {
      const result = toFailureResult(error.code, error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(4, `refresh-base.${result.error.code}`, result.error.message);
    }

    if (error instanceof SubscriptionRemoteError) {
      const result = toFailureResult(error.code, error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(error.exitCode, `refresh-base.${result.error.code}`, result.error.message);
    }

    if (error instanceof FeishuRemoteError) {
      const result = toFailureResult(error.code, error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(error.exitCode, `refresh-base.${error.code}`, result.error.message);
    }

    if (error instanceof YamlPreconditionError) {
      const result = toFailureResult(error.code, error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(error.exitCode, `refresh-base.${error.code}`, result.error.message);
    }

    throw error;
  }
};
