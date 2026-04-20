import { generateLineDiff } from "../diff/lineDiff.js";
import { Buffer } from 'node:buffer';

import { isMap, isScalar, isSeq } from 'yaml';

import type { SubscriptionProxy } from '../subscription/extractTail.js';
import type { ConfigFileLike } from '../yaml/configFiles.js';
import type { ParsedYamlDocument, YamlMappingNode, YamlSequenceNode } from '../yaml/document.js';
import { getNextConfigFileName, selectLatestConfigFile } from '../yaml/configFiles.js';
import {
  assertUniqueProxyNames,
  findTrafficResetProxy,
  getListenersSequence,
  getProxyGroupsSequence,
  getProxiesSequence,
  parseSingleYamlDocument,
} from '../yaml/document.js';
import { YamlPreconditionError } from '../yaml/errors.js';
import { replaceMitceNodes } from './replaceMitce.js';

type DriveFile = ConfigFileLike & {
  readonly token: string;
  readonly modifiedTime?: string;
};

type DriveClientLike = {
  listFolder(folderToken: string): Promise<readonly DriveFile[]>;
  downloadFile(fileToken: string): Promise<Buffer>;
  uploadFile(input: {
    readonly folderToken: string;
    readonly fileName: string;
    readonly content: Uint8Array;
    readonly contentType?: string;
  }): Promise<{ readonly fileToken: string }>;
};

export type RefreshBaseWorkflowInput = {
  readonly configRoot: string;
  readonly folderToken: string;
  readonly subscriptionUrl: string;
  readonly subscriptionTail: readonly SubscriptionProxy[];
  readonly mitceSubscriptionUrl: string;
  readonly mitceNodes: readonly SubscriptionProxy[];
};

export type RefreshBaseWorkflowResult = {
  readonly ok: true;
  readonly command: 'refresh-base';
  readonly configRoot: string;
  readonly folderToken: string;
  readonly sourceFile: string;
  readonly outputFile: string;
  readonly subscriptionUrl: string;
  readonly replacedProxyCount: number;
  readonly trafficResetIndex: number;
  readonly mitceSubscriptionUrl: string;
  readonly mitceReplacedCount: number;
  readonly diff: string;
};

export type RefreshBaseWorkflowDependencies = {
  readonly driveClient: DriveClientLike;
  readonly now?: () => Date;
};

const toConfigFileCandidates = (files: readonly DriveFile[]): ConfigFileLike[] => {
  return files.map((file) => {
    return {
      name: file.name,
      modifiedTime: file.modifiedTime,
      fileToken: file.token,
    };
  });
};

const getNamedValue = (item: YamlSequenceNode['items'][number] | YamlMappingNode, key: string): string | null => {
  if (!isMap(item)) {
    return null;
  }

  const valueNode = item.get(key, true);

  if (!isScalar(valueNode) || (typeof valueNode.value !== 'string' && typeof valueNode.value !== 'number')) {
    return null;
  }

  return String(valueNode.value);
};

const collectNamedItems = (sequence: YamlSequenceNode | null): Array<{ index: number; item: YamlMappingNode; name: string }> => {
  if (sequence === null) {
    return [];
  }

  return sequence.items.flatMap((item, index) => {
    if (!isMap(item)) {
      return [];
    }

    const name = getNamedValue(item, 'name');

    if (name === null) {
      return [];
    }

    return [{ index, item: item as YamlMappingNode, name }];
  });
};

const collectValidProxyTargets = (document: ParsedYamlDocument): Set<string> => {
  return new Set<string>([
    ...collectNamedItems(getProxiesSequence(document)).map(({ name }) => name),
    ...collectNamedItems(getProxyGroupsSequence(document)).map(({ name }) => name),
  ]);
};

const replaceProxyTail = (
  document: ParsedYamlDocument,
  proxies: YamlSequenceNode,
  subscriptionTail: readonly SubscriptionProxy[],
): number => {
  const { index: trafficResetIndex } = findTrafficResetProxy(proxies);
  const replacementNodes = subscriptionTail.map((proxy) => document.createNode(proxy) as YamlSequenceNode['items'][number]);

  proxies.items.splice(trafficResetIndex, proxies.items.length - trafficResetIndex, ...replacementNodes);

  return trafficResetIndex;
};

const validateListenerProxyReferences = (document: ParsedYamlDocument, validProxyTargets: ReadonlySet<string>): void => {
  for (const { item } of collectNamedItems(getListenersSequence(document))) {
    const proxyTarget = getNamedValue(item, 'proxy');

    if (proxyTarget === null || validProxyTargets.has(proxyTarget)) {
      continue;
    }

    const listenerName = getNamedValue(item, 'name') ?? '(unnamed listener)';

    throw new YamlPreconditionError({
      code: 'yaml_listener_proxy_reference_missing',
      message: `Listener \`${listenerName}\` references missing proxy \`${proxyTarget}\``,
    });
  }
};

const validateProxyGroupMemberReferences = (document: ParsedYamlDocument, validProxyTargets: ReadonlySet<string>): void => {
  for (const { item, name } of collectNamedItems(getProxyGroupsSequence(document))) {
    const proxiesNode = item.get('proxies', true);

    if (!proxiesNode || !isSeq(proxiesNode)) {
      continue;
    }

    for (const proxyNode of proxiesNode.items) {
      if (!isScalar(proxyNode) || (typeof proxyNode.value !== 'string' && typeof proxyNode.value !== 'number')) {
        continue;
      }

      const proxyTarget = String(proxyNode.value);

      if (validProxyTargets.has(proxyTarget)) {
        continue;
      }

      throw new YamlPreconditionError({
        code: 'yaml_proxy_group_member_reference_missing',
        message: `Proxy group \`${name}\` references missing proxy target \`${proxyTarget}\``,
      });
    }
  }
};

export const runRefreshBaseWorkflow = async (
  input: RefreshBaseWorkflowInput,
  dependencies: RefreshBaseWorkflowDependencies,
): Promise<RefreshBaseWorkflowResult> => {
  const files = await dependencies.driveClient.listFolder(input.folderToken);
  const sourceFile = selectLatestConfigFile(files);

  if (sourceFile === null) {
    throw new YamlPreconditionError({
      code: 'yaml_missing_config_file',
      message: 'Could not find a config_MMdd[_N].yaml file in the configured Feishu folder',
    });
  }

  const originalContent = (await dependencies.driveClient.downloadFile(sourceFile.token)).toString('utf8');
  const document = parseSingleYamlDocument(originalContent);
  const proxies = getProxiesSequence(document);

  const trafficResetIndex = replaceProxyTail(document, proxies, input.subscriptionTail);

  const mitceReplacedCount = replaceMitceNodes(document, proxies, input.mitceNodes);

  const validProxyTargets = collectValidProxyTargets(document);

  assertUniqueProxyNames(proxies);
  validateListenerProxyReferences(document, validProxyTargets);
  validateProxyGroupMemberReferences(document, validProxyTargets);

  const outputFile = getNextConfigFileName(toConfigFileCandidates(files), dependencies.now?.() ?? new Date());
  const rendered = document.toString();

  await dependencies.driveClient.uploadFile({
    folderToken: input.folderToken,
    fileName: outputFile,
    content: Buffer.from(rendered, 'utf8'),
    contentType: 'application/x-yaml',
  });

  return {
    ok: true,
    command: 'refresh-base',
    configRoot: input.configRoot,
    folderToken: input.folderToken,
    sourceFile: sourceFile.name,
    outputFile,
    subscriptionUrl: input.subscriptionUrl,
    replacedProxyCount: input.subscriptionTail.length,
    trafficResetIndex,
    mitceSubscriptionUrl: input.mitceSubscriptionUrl,
    mitceReplacedCount,
    diff: generateLineDiff(originalContent, rendered),
  };
};
