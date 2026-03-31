import { Buffer } from 'node:buffer';
import { isMap, isScalar, isSeq } from 'yaml';
import { getNextConfigFileName, selectLatestConfigFile } from '../yaml/configFiles.js';
import { assertUniqueProxyNames, findTrafficResetProxy, getListenersSequence, getProxyGroupsSequence, getProxiesSequence, parseSingleYamlDocument, } from '../yaml/document.js';
import { YamlPreconditionError } from '../yaml/errors.js';
const toConfigFileCandidates = (files) => {
    return files.map((file) => {
        return {
            name: file.name,
            modifiedTime: file.modifiedTime,
            fileToken: file.token,
        };
    });
};
const getNamedValue = (item, key) => {
    if (!isMap(item)) {
        return null;
    }
    const valueNode = item.get(key, true);
    if (!isScalar(valueNode) || (typeof valueNode.value !== 'string' && typeof valueNode.value !== 'number')) {
        return null;
    }
    return String(valueNode.value);
};
const collectNamedItems = (sequence) => {
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
        return [{ index, item: item, name }];
    });
};
const collectValidProxyTargets = (document) => {
    return new Set([
        ...collectNamedItems(getProxiesSequence(document)).map(({ name }) => name),
        ...collectNamedItems(getProxyGroupsSequence(document)).map(({ name }) => name),
    ]);
};
const replaceProxyTail = (document, proxies, subscriptionTail) => {
    const { index: trafficResetIndex } = findTrafficResetProxy(proxies);
    const replacementNodes = subscriptionTail.map((proxy) => document.createNode(proxy));
    proxies.items.splice(trafficResetIndex, proxies.items.length - trafficResetIndex, ...replacementNodes);
    return trafficResetIndex;
};
const validateListenerProxyReferences = (document, validProxyTargets) => {
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
const validateProxyGroupMemberReferences = (document, validProxyTargets) => {
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
export const runRefreshBaseWorkflow = async (input, dependencies) => {
    const files = await dependencies.driveClient.listFolder(input.folderToken);
    const sourceFile = selectLatestConfigFile(files);
    if (sourceFile === null) {
        throw new YamlPreconditionError({
            code: 'yaml_missing_config_file',
            message: 'Could not find a config_MMdd[_N].yaml file in the configured Feishu folder',
        });
    }
    const document = parseSingleYamlDocument((await dependencies.driveClient.downloadFile(sourceFile.token)).toString('utf8'));
    const proxies = getProxiesSequence(document);
    const trafficResetIndex = replaceProxyTail(document, proxies, input.subscriptionTail);
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
    };
};
//# sourceMappingURL=refreshBase.js.map