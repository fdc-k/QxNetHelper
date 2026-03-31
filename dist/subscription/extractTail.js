import { findTrafficResetProxy } from '../yaml/document.js';
import { YamlPreconditionError } from '../yaml/errors.js';
const toSubscriptionProxy = (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value;
    }
    return {};
};
const getProxyName = (value) => {
    const name = value.name;
    if (name === undefined || name === null) {
        return undefined;
    }
    return String(name);
};
const assertUniqueTailProxyNames = (proxies) => {
    const seenNames = new Set();
    for (const proxy of proxies) {
        const name = getProxyName(proxy);
        if (!name) {
            continue;
        }
        if (seenNames.has(name)) {
            throw new YamlPreconditionError({
                code: 'yaml_duplicate_proxy_name',
                message: `Found duplicate proxy name \`${name}\` in extracted subscription tail`,
            });
        }
        seenNames.add(name);
    }
};
export const extractSubscriptionTail = (proxies) => {
    const { index: trafficResetIndex } = findTrafficResetProxy(proxies);
    const clonedTail = globalThis.structuredClone(proxies.toJSON().slice(trafficResetIndex));
    const tail = clonedTail.map((proxy) => toSubscriptionProxy(proxy));
    assertUniqueTailProxyNames(tail);
    return tail;
};
//# sourceMappingURL=extractTail.js.map