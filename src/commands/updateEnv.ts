import { CommanderError } from 'commander';
import process from 'node:process';

import { ZodError } from 'zod';

import { ValidationError } from '../config/normalize.js';
import { loadPersistedState } from '../config/store.js';
import { createTenantAccessTokenProvider } from '../feishu/auth.js';
import { getFeishuBaseUrl } from '../feishu/baseUrl.js';
import { createFeishuDriveClient, type FeishuDriveClient } from '../feishu/driveClient.js';
import { FeishuRemoteError } from '../feishu/errors.js';
import { formatCommandOutput } from '../output/redact.js';
import { assertSupportedProxyScheme, ProxyValidationError } from '../proxy/normalize.js';
import { runUpdateEnvWorkflow, type UpdateEnvWorkflowResult } from '../workflows/updateEnv.js';
import { YamlPreconditionError } from '../yaml/errors.js';

export type UpdateEnvCommandOptions = {
  readonly envId: string;
  readonly region: string;
  readonly ip: string;
  readonly nodeUrl: string;
  readonly configRoot: string;
  readonly json?: boolean;
};

type FailureCode =
  | 'validation_failed'
  | 'remote_failed'
  | 'remote_forbidden'
  | 'remote_not_found'
  | YamlPreconditionError['code'];

type UpdateEnvCommandDependencies = {
  readonly writeOutput: (line: string) => void;
  readonly writeError: (line: string) => void;
  readonly now?: () => Date;
  readonly createDriveClient?: (input: { readonly appId: string; readonly appSecret: string }) => FeishuDriveClient;
};

type UpdateEnvCommandFailure = {
  readonly ok: false;
  readonly command: 'update-env';
  readonly error: {
    readonly code: FailureCode;
    readonly message: string;
  };
};

const IPV4_SEGMENT_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/u;
const ENV_ID_PATTERN = /^\d+$/u;

const defaultDependencies: UpdateEnvCommandDependencies = {
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
};

const formatSuccessText = (result: UpdateEnvWorkflowResult): string => {
  return `Updated ${result.sourceFile} -> ${result.outputFile} for env ${result.envId}`;
};

const formatErrorText = (result: UpdateEnvCommandFailure): string => {
  return `Error: ${result.error.message}`;
};

const printSuccess = (result: UpdateEnvWorkflowResult, json: boolean, dependencies: UpdateEnvCommandDependencies): void => {
  dependencies.writeOutput(formatCommandOutput(json ? result : formatSuccessText(result), json, { secrets: [] }));
};

const printFailure = (result: UpdateEnvCommandFailure, json: boolean, dependencies: UpdateEnvCommandDependencies): void => {
  dependencies.writeError(formatCommandOutput(json ? result : formatErrorText(result), json, { secrets: [] }));
};

const toFailureResult = (code: FailureCode, message: string): UpdateEnvCommandFailure => {
  return {
    ok: false,
    command: 'update-env',
    error: {
      code,
      message,
    },
  };
};

const validateIpv4 = (value: string): string => {
  const trimmed = value.trim();
  const segments = trimmed.split('.');

  if (segments.length !== 4 || segments.some((segment) => !IPV4_SEGMENT_PATTERN.test(segment))) {
    throw new ValidationError('ip must be a valid IPv4 address');
  }

  return trimmed;
};

const normalizeUpdateEnvInput = (options: UpdateEnvCommandOptions): UpdateEnvCommandOptions => {
  const envId = options.envId.trim();
  const region = options.region.trim();
  const nodeUrl = options.nodeUrl.trim();
  const configRoot = options.configRoot.trim();

  if (!ENV_ID_PATTERN.test(envId)) {
    throw new ValidationError('env-id must contain only digits');
  }

  if (region.length === 0) {
    throw new ValidationError('region is required');
  }

  if (configRoot.length === 0) {
    throw new ValidationError('config-root is required');
  }

  if (nodeUrl.length === 0) {
    throw new ValidationError('node-url is required');
  }

  assertSupportedProxyScheme(nodeUrl);

  return {
    ...options,
    envId,
    region,
    ip: validateIpv4(options.ip),
    nodeUrl,
    configRoot,
  };
};

export const runUpdateEnvCommand = async (
  options: UpdateEnvCommandOptions,
  dependencies: Partial<UpdateEnvCommandDependencies> = {},
): Promise<UpdateEnvWorkflowResult> => {
  const resolvedDependencies = { ...defaultDependencies, ...dependencies };
  const normalized = normalizeUpdateEnvInput(options);
  const storedState = await loadPersistedState(normalized.configRoot);
  const driveClient = resolvedDependencies.createDriveClient?.({
    appId: storedState.secrets.FEISHU_APP_ID,
    appSecret: storedState.secrets.FEISHU_APP_SECRET,
  });

  if (!driveClient) {
    throw new Error('Could not create Feishu drive client');
  }

  return runUpdateEnvWorkflow(
    {
      configRoot: normalized.configRoot,
      folderToken: storedState.config.folderToken,
      envId: normalized.envId,
      region: normalized.region,
      ip: normalized.ip,
      nodeUrl: normalized.nodeUrl,
    },
    {
      driveClient,
      now: resolvedDependencies.now,
    },
  );
};

export const updateEnvCommand = async (options: UpdateEnvCommandOptions): Promise<void> => {
  try {
    const result = await runUpdateEnvCommand(options);
    printSuccess(result, options.json ?? false, defaultDependencies);
  } catch (error) {
    if (
      error instanceof ValidationError
      || error instanceof ProxyValidationError
      || error instanceof SyntaxError
      || error instanceof ZodError
      || (error instanceof Error && error.message === 'qxnethelper is not initialized in the requested config-root')
    ) {
      const result = toFailureResult('validation_failed', error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(2, 'update-env.validation_failed', result.error.message);
    }

    if (error instanceof FeishuRemoteError) {
      const result = toFailureResult(error.code, error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(error.exitCode, `update-env.${error.code}`, result.error.message);
    }

    if (error instanceof YamlPreconditionError) {
      const result = toFailureResult(error.code, error.message);

      printFailure(result, options.json ?? false, defaultDependencies);
      throw new CommanderError(error.exitCode, `update-env.${error.code}`, result.error.message);
    }

    throw error;
  }
};
