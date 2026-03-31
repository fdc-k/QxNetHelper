const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const DECIMAL_PORT_PATTERN = /^\d+$/u;
const ENV_ID_PATTERN = /^\d+$/u;
export class ProxyValidationError extends Error {
    code = 'validation_failed';
    constructor(message) {
        super(message);
        this.name = 'ProxyValidationError';
    }
}
export const ensureNonEmpty = (value, fieldName) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        throw new ProxyValidationError(`${fieldName} is required`);
    }
    return trimmed;
};
export const decodeUriComponentStrict = (value, fieldName) => {
    try {
        return decodeURIComponent(value);
    }
    catch {
        throw new ProxyValidationError(`${fieldName} contains malformed percent-encoding`);
    }
};
export const parseStrictQuery = (query) => {
    const entries = new Map();
    if (query.length === 0) {
        return entries;
    }
    for (const pair of query.split('&')) {
        if (pair.length === 0) {
            throw new ProxyValidationError('query contains an empty parameter');
        }
        const separatorIndex = pair.indexOf('=');
        const rawKey = separatorIndex === -1 ? pair : pair.slice(0, separatorIndex);
        const rawValue = separatorIndex === -1 ? '' : pair.slice(separatorIndex + 1);
        const key = decodeUriComponentStrict(rawKey, 'query parameter name');
        if (entries.has(key)) {
            throw new ProxyValidationError(`duplicate query parameter "${key}" is not allowed`);
        }
        entries.set(key, decodeUriComponentStrict(rawValue, `query parameter "${key}"`));
    }
    return entries;
};
export const assertExactKeys = (values, allowedKeys) => {
    const allowedKeySet = new Set(allowedKeys);
    for (const key of values.keys()) {
        if (!allowedKeySet.has(key)) {
            throw new ProxyValidationError(`unsupported query parameter "${key}"`);
        }
    }
};
export const parseUuid = (value) => {
    const normalized = ensureNonEmpty(value, 'uuid');
    if (!UUID_PATTERN.test(normalized)) {
        throw new ProxyValidationError('uuid must be a valid UUID');
    }
    return normalized.toLowerCase();
};
export const parsePort = (value) => {
    if (!DECIMAL_PORT_PATTERN.test(value)) {
        throw new ProxyValidationError('port must be a valid integer between 1 and 65535');
    }
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ProxyValidationError('port must be a valid integer between 1 and 65535');
    }
    return port;
};
export const parseBooleanFlag = (value, fieldName) => {
    if (value === undefined) {
        return false;
    }
    if (value === 'tls') {
        return true;
    }
    if (value === 'none') {
        return false;
    }
    throw new ProxyValidationError(`${fieldName} must be "tls" or "none"`);
};
export const getProxyName = (envId, existingNames = []) => {
    const normalizedEnvId = envId.trim();
    if (!ENV_ID_PATTERN.test(normalizedEnvId)) {
        throw new ProxyValidationError('env-id must contain only digits');
    }
    const name = normalizedEnvId.slice(-3).padStart(3, '0');
    if (existingNames.includes(name)) {
        throw new ProxyValidationError(`duplicate proxy name "${name}" is not allowed`);
    }
    return name;
};
export const ensureTcpNetwork = (value, fieldName) => {
    if (value === undefined || value === 'tcp') {
        return 'tcp';
    }
    throw new ProxyValidationError(`${fieldName} must be "tcp"`);
};
export const assertSupportedProxyScheme = (nodeUrl) => {
    if (nodeUrl.startsWith('vless://')) {
        return 'vless';
    }
    if (nodeUrl.startsWith('vmess://')) {
        return 'vmess';
    }
    throw new ProxyValidationError('unsupported proxy URI format: only vless:// and base64-JSON vmess:// are supported');
};
//# sourceMappingURL=normalize.js.map