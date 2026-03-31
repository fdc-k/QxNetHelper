import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { YamlPreconditionError } from './errors.js';
const MULTI_DOCUMENT_ERROR_PATTERN = /multiple documents/iu;
const TRAFFIC_RESET_PROXY_NAME = 'Traffic Reset';
const throwSequenceError = (key) => {
    throw new YamlPreconditionError({
        code: 'yaml_expected_sequence',
        message: `Expected top-level \`${key}\` to be a YAML sequence`,
    });
};
const requireTopLevelMap = (document) => {
    if (!isMap(document.contents)) {
        throw new YamlPreconditionError({
            code: 'yaml_expected_map',
            message: 'Expected YAML document root to be a mapping',
        });
    }
    return document.contents;
};
const requireTopLevelSequence = (document, key) => {
    const root = requireTopLevelMap(document);
    const node = root.get(key, true);
    if (!node || !isSeq(node)) {
        return throwSequenceError(key);
    }
    return node;
};
const getOptionalTopLevelSequence = (document, key) => {
    const root = requireTopLevelMap(document);
    const node = root.get(key, true);
    if (!node) {
        return null;
    }
    if (!isSeq(node)) {
        return throwSequenceError(key);
    }
    return node;
};
const getNamedProxyItems = (proxies) => {
    return proxies.items.flatMap((item, index) => {
        if (!isMap(item)) {
            return [];
        }
        const nameNode = item.get('name', true);
        if (!nameNode || !isScalar(nameNode) || typeof nameNode.value !== 'string') {
            return [];
        }
        return [{ index, item, name: nameNode.value }];
    });
};
export const parseSingleYamlDocument = (source) => {
    const document = parseDocument(source, { uniqueKeys: true });
    if (document.errors.length === 0) {
        return document;
    }
    const firstError = document.errors[0];
    const isMultiDocument = document.errors.some((error) => MULTI_DOCUMENT_ERROR_PATTERN.test(error.message));
    throw new YamlPreconditionError({
        code: isMultiDocument ? 'yaml_multi_document' : 'yaml_parse_failed',
        message: firstError?.message ?? (isMultiDocument ? 'YAML source must contain exactly one document' : 'Failed to parse YAML document'),
    });
};
export const getListenersSequence = (document) => {
    return requireTopLevelSequence(document, 'listeners');
};
export const getProxiesSequence = (document) => {
    return requireTopLevelSequence(document, 'proxies');
};
export const getProxyGroupsSequence = (document) => {
    return getOptionalTopLevelSequence(document, 'proxy-groups');
};
export const assertUniqueProxyNames = (proxies) => {
    const seenNames = new Set();
    for (const proxy of getNamedProxyItems(proxies)) {
        if (seenNames.has(proxy.name)) {
            throw new YamlPreconditionError({
                code: 'yaml_duplicate_proxy_name',
                message: `Found duplicate proxy name \`${proxy.name}\` in top-level \`proxies\``,
            });
        }
        seenNames.add(proxy.name);
    }
};
export const findTrafficResetProxy = (proxies) => {
    const matches = getNamedProxyItems(proxies).filter((proxy) => proxy.name === TRAFFIC_RESET_PROXY_NAME);
    if (matches.length === 0) {
        throw new YamlPreconditionError({
            code: 'yaml_missing_traffic_reset',
            message: 'Expected exactly one proxy named `Traffic Reset` in top-level `proxies`',
        });
    }
    if (matches.length > 1) {
        throw new YamlPreconditionError({
            code: 'yaml_duplicate_traffic_reset',
            message: 'Expected exactly one proxy named `Traffic Reset` in top-level `proxies`',
        });
    }
    const match = matches[0];
    return {
        index: match.index,
        item: match.item,
    };
};
//# sourceMappingURL=document.js.map