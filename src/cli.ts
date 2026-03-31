#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

import { Command, CommanderError } from 'commander';

import { initCommand } from './commands/init.js';
import { refreshBaseCommand } from './commands/refreshBase.js';
import { updateEnvCommand } from './commands/updateEnv.js';

export const buildProgram = (): Command => {
  const program = new Command();

  program
    .name('qxnethelper')
    .description('CLI tool for managing QX Network configurations')
    .version('0.1.0')
    .exitOverride();

  program
    .command('init')
    .description('Initialize qxnethelper configuration')
    .requiredOption('--app-id <id>', 'Feishu app ID')
    .requiredOption('--app-secret <secret>', 'Feishu app secret')
    .requiredOption('--config-dir <dir>', 'Feishu folder URL or folder token')
    .requiredOption('--sub-link <url>', 'Clash subscription URL')
    .option('--config-root <dir>', 'Configuration root directory', '.')
    .option('--json', 'Output in JSON format')
    .action(initCommand);

  program
    .command('update-env')
    .description('Update environment configuration')
    .requiredOption('--env-id <id>', 'Environment identifier (digits)')
    .requiredOption('--region <text>', 'Region name')
    .requiredOption('--ip <ipv4>', 'IP address')
    .requiredOption('--node-url <url>', 'Proxy node URL (vless:// or vmess://)')
    .option('--config-root <dir>', 'Configuration root directory', '.')
    .option('--json', 'Output in JSON format')
    .action(updateEnvCommand);

  program
    .command('refresh-base')
    .description('Refresh base configuration from subscription')
    .option('--config-root <dir>', 'Configuration root directory', '.')
    .option('--json', 'Output in JSON format')
    .action(refreshBaseCommand);

  return program;
};

export const run = async (argv: string[]): Promise<void> => {
  try {
    await buildProgram().parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode === 1 ? 2 : error.exitCode;

      return;
    }

    throw error;
  }
};

const isMainModule = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  void run(process.argv);
}
