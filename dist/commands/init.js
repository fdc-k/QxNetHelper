import { CommanderError } from 'commander';
import process from 'node:process';
import { defaultFolderAccessValidator } from '../config/folderAccess.js';
import { normalizeInitInput, ValidationError } from '../config/normalize.js';
import { persistConfig } from '../config/store.js';
import { FeishuRemoteError } from '../feishu/errors.js';
import { formatCommandOutput } from '../output/redact.js';
const defaultDependencies = {
    folderAccessValidator: defaultFolderAccessValidator,
    writeOutput: (line) => {
        process.stdout.write(`${line}\n`);
    },
    writeError: (line) => {
        process.stderr.write(`${line}\n`);
    },
};
const formatSuccessText = (result) => {
    return `Initialized qxnethelper config at ${result.configRoot} for folder ${result.folderToken}`;
};
const formatErrorText = (result) => {
    return `Error: ${result.error.message}`;
};
const printSuccess = (result, json, dependencies) => {
    dependencies.writeOutput(formatCommandOutput(json ? result : formatSuccessText(result), json, { secrets: [] }));
};
const printFailure = (result, json, dependencies) => {
    dependencies.writeError(formatCommandOutput(json ? result : formatErrorText(result), json, { secrets: [] }));
};
const toFailureResult = (message) => {
    return {
        ok: false,
        command: 'init',
        error: {
            code: 'validation_failed',
            message,
        },
    };
};
const toRemoteFailureResult = (error) => {
    return {
        ok: false,
        command: 'init',
        error: {
            code: error.code,
            message: error.message,
        },
    };
};
const executeInit = async (normalized, dependencies) => {
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
export const runInitCommand = async (options, dependencies = {}) => {
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
export const initCommand = async (options) => {
    try {
        const result = await runInitCommand(options);
        printSuccess(result, options.json ?? false, defaultDependencies);
    }
    catch (error) {
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
//# sourceMappingURL=init.js.map