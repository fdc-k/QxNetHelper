import { Buffer } from 'node:buffer';
import { assertSupportedProxyScheme, getProxyName } from '../proxy/normalize.js';
import { normalizeVlessUri } from '../proxy/vless.js';
import { normalizeVmessUri } from '../proxy/vmess.js';
import { getNextConfigFileName, selectLatestConfigFile } from '../yaml/configFiles.js';
import { isMap, isScalar } from 'yaml';
import { parseSingleYamlDocument, getListenersSequence, getProxiesSequence, } from '../yaml/document.js';
import { YamlPreconditionError } from '../yaml/errors.js';
const LISTENER_PREFIX = 'mixed';
const LISTENER_TYPE = 'mixed';
const LISTENER_PORT_OFFSET = 42000;
const findNamedItems = (sequence, targetName) => {
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
const upsertNamedItem = (document, sequence, targetName, value, duplicateCode) => {
    const matches = findNamedItems(sequence, targetName);
    if (matches.length > 1) {
        throw new YamlPreconditionError({
            code: duplicateCode,
            message: `Found duplicate entry named \`${targetName}\``,
        });
    }
    const node = document.createNode(value);
    if (matches.length === 1) {
        sequence.items[matches[0]] = node;
        return;
    }
    sequence.items.push(node);
};
const toProxyName = (envId) => {
    return getProxyName(envId);
};
const buildProxy = (nodeUrl, envId) => {
    const scheme = assertSupportedProxyScheme(nodeUrl);
    if (scheme === 'vless') {
        return normalizeVlessUri(nodeUrl, { envId });
    }
    return normalizeVmessUri(nodeUrl, { envId });
};
const toConfigFileCandidates = (files) => {
    return files.map((file) => {
        return {
            name: file.name,
            modifiedTime: file.modifiedTime,
            fileToken: file.token,
        };
    });
};
export const runUpdateEnvWorkflow = async (input, dependencies) => {
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
    upsertNamedItem(document, listeners, listenerName, {
        name: listenerName,
        type: LISTENER_TYPE,
        port: LISTENER_PORT_OFFSET + Number(proxyName),
        proxy: Number(proxyName),
    }, 'yaml_duplicate_listener_name');
    upsertNamedItem(document, proxies, proxyName, proxy, 'yaml_duplicate_proxy_name');
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
//# sourceMappingURL=updateEnv.js.map