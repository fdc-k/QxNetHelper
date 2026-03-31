import { Buffer } from 'node:buffer';

import { assertSupportedProxyScheme, getProxyName, type MihomoProxy } from '../proxy/normalize.js';
import { normalizeVlessUri } from '../proxy/vless.js';
import { normalizeVmessUri } from '../proxy/vmess.js';
import { getNextConfigFileName, selectLatestConfigFile, type ConfigFileLike } from '../yaml/configFiles.js';
import { isMap, isScalar } from 'yaml';

import {
  parseSingleYamlDocument,
  getListenersSequence,
  getProxiesSequence,
  type ParsedYamlDocument,
  type YamlSequenceNode,
} from '../yaml/document.js';
import { YamlPreconditionError } from '../yaml/errors.js';

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

export type UpdateEnvWorkflowInput = {
  readonly configRoot: string;
  readonly folderToken: string;
  readonly envId: string;
  readonly region: string;
  readonly ip: string;
  readonly nodeUrl: string;
};

export type UpdateEnvWorkflowResult = {
  readonly ok: true;
  readonly command: 'update-env';
  readonly configRoot: string;
  readonly folderToken: string;
  readonly sourceFile: string;
  readonly outputFile: string;
  readonly envId: string;
  readonly proxyName: string;
  readonly region: string;
  readonly ip: string;
};

export type UpdateEnvWorkflowDependencies = {
  readonly driveClient: DriveClientLike;
  readonly now?: () => Date;
};

const LISTENER_PREFIX = 'mixed';
const LISTENER_TYPE = 'mixed';
const LISTENER_PORT_OFFSET = 42000;

const findNamedItems = (sequence: YamlSequenceNode, targetName: string): number[] => {
  return sequence.items.flatMap((item, index) => {
    if (!isMap(item)) {
      return [];
    }

    const nameNode = item.get('name', true);

    if (!isScalar(nameNode) || (typeof nameNode.value !== 'string' && typeof nameNode.value !== 'number')) {
      return [];
    }

    return String(nameNode.value) === targetName ? [index] : [];
  });
};

const upsertNamedItem = (
  document: ParsedYamlDocument,
  sequence: YamlSequenceNode,
  targetName: string,
  value: Record<string, unknown>,
  duplicateCode: YamlPreconditionError['code'],
): void => {
  const matches = findNamedItems(sequence, targetName);

  if (matches.length > 1) {
    throw new YamlPreconditionError({
      code: duplicateCode,
      message: `Found duplicate entry named \`${targetName}\``,
    });
  }

  const node = document.createNode(value) as YamlSequenceNode['items'][number];

  if (matches.length === 1) {
    sequence.items[matches[0]] = node;

    return;
  }

  sequence.items.push(node);
};

const toProxyName = (envId: string): string => {
  return getProxyName(envId);
};

const buildProxy = (nodeUrl: string, envId: string): MihomoProxy => {
  const scheme = assertSupportedProxyScheme(nodeUrl);

  if (scheme === 'vless') {
    return normalizeVlessUri(nodeUrl, { envId });
  }

  return normalizeVmessUri(nodeUrl, { envId });
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

export const runUpdateEnvWorkflow = async (
  input: UpdateEnvWorkflowInput,
  dependencies: UpdateEnvWorkflowDependencies,
): Promise<UpdateEnvWorkflowResult> => {
  const files = await dependencies.driveClient.listFolder(input.folderToken);
  const sourceFile = selectLatestConfigFile(files);

  if (sourceFile === null) {
    throw new YamlPreconditionError({
      code: 'yaml_missing_config_file',
      message: 'Could not find a config_MMdd[_N].yaml file in the configured Feishu folder',
    });
  }

  const proxyName = toProxyName(input.envId);
  const listenerName = `${LISTENER_PREFIX}${proxyName}`;
  const document = parseSingleYamlDocument((await dependencies.driveClient.downloadFile(sourceFile.token)).toString('utf8'));
  const listeners = getListenersSequence(document);
  const proxies = getProxiesSequence(document);
  const proxy = buildProxy(input.nodeUrl, input.envId);

  upsertNamedItem(
    document,
    listeners,
    listenerName,
    {
      name: listenerName,
      type: LISTENER_TYPE,
      port: LISTENER_PORT_OFFSET + Number(proxyName),
      proxy: Number(proxyName),
    },
    'yaml_duplicate_listener_name',
  );
  upsertNamedItem(document, proxies, proxyName, proxy as unknown as Record<string, unknown>, 'yaml_duplicate_proxy_name');

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
    command: 'update-env',
    configRoot: input.configRoot,
    folderToken: input.folderToken,
    sourceFile: sourceFile.name,
    outputFile,
    envId: input.envId,
    proxyName,
    region: input.region,
    ip: input.ip,
  };
};
