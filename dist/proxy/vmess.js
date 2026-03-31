import { Buffer } from 'node:buffer';
import { getProxyName, parseBooleanFlag, parsePort, parseUuid, ProxyValidationError, } from './normalize.js';
const VMESS_PROTOCOL = 'vmess://';
const ALLOWED_JSON_KEYS = ['v', 'ps', 'add', 'port', 'id', 'aid', 'scy', 'net', 'type', 'host', 'path', 'tls', 'sni', 'fp', 'pbk'];
const isPlainRecord = (value) => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};
const decodeBase64Json = (encoded) => {
    if (encoded.length === 0) {
        throw new ProxyValidationError('vmess URI payload is required');
    }
    if (/[^A-Za-z0-9+/=_-]/u.test(encoded)) {
        throw new ProxyValidationError('vmess URI must contain base64-encoded JSON');
    }
    let decoded;
    try {
        decoded = Buffer.from(encoded, 'base64').toString('utf8');
    }
    catch {
        throw new ProxyValidationError('vmess URI must contain base64-encoded JSON');
    }
    if (decoded.trim().length === 0) {
        throw new ProxyValidationError('vmess URI must contain base64-encoded JSON');
    }
    let parsed;
    try {
        parsed = JSON.parse(decoded);
    }
    catch {
        throw new ProxyValidationError('vmess URI must contain base64-encoded JSON');
    }
    if (!isPlainRecord(parsed)) {
        throw new ProxyValidationError('vmess JSON payload must be an object');
    }
    return parsed;
};
const getString = (record, key, required = false) => {
    const value = record[key];
    if (value === undefined || value === null || value === '') {
        if (required) {
            throw new ProxyValidationError(`vmess field "${key}" is required`);
        }
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new ProxyValidationError(`vmess field "${key}" must be a string`);
    }
    return value;
};
const assertAllowedKeys = (record) => {
    const allowedKeySet = new Set(ALLOWED_JSON_KEYS);
    for (const key of Object.keys(record)) {
        if (!allowedKeySet.has(key)) {
            throw new ProxyValidationError(`unsupported vmess field "${key}"`);
        }
    }
};
const parseAlterId = (value) => {
    if (value === undefined) {
        return 0;
    }
    if (!/^\d+$/u.test(value)) {
        throw new ProxyValidationError('vmess field "aid" must be a non-negative integer');
    }
    const alterId = Number(value);
    if (!Number.isInteger(alterId) || alterId < 0) {
        throw new ProxyValidationError('vmess field "aid" must be a non-negative integer');
    }
    return alterId;
};
export const parseVmessUri = (nodeUrl) => {
    if (!nodeUrl.startsWith(VMESS_PROTOCOL)) {
        throw new ProxyValidationError('unsupported proxy URI format: expected vmess:// base64 JSON form');
    }
    const payload = nodeUrl.slice(VMESS_PROTOCOL.length);
    if (payload.startsWith('{') || payload.includes('@') || payload.includes('?')) {
        throw new ProxyValidationError('unsupported vmess URI format: URL-form vmess:// links are not supported');
    }
    const record = decodeBase64Json(payload);
    assertAllowedKeys(record);
    const network = getString(record, 'net') ?? 'tcp';
    if (network !== 'tcp') {
        throw new ProxyValidationError('vmess field "net" must be "tcp"');
    }
    const headerType = getString(record, 'type');
    if (headerType !== undefined && headerType !== 'none') {
        throw new ProxyValidationError('vmess field "type" must be "none" when provided');
    }
    const cipher = getString(record, 'scy') ?? 'auto';
    return {
        server: getString(record, 'add', true) ?? '',
        port: parsePort(getString(record, 'port', true) ?? ''),
        uuid: parseUuid(getString(record, 'id', true) ?? ''),
        alterId: parseAlterId(getString(record, 'aid')),
        cipher,
        tls: parseBooleanFlag(getString(record, 'tls'), 'vmess field "tls"'),
        servername: getString(record, 'sni'),
        clientFingerprint: getString(record, 'fp'),
        realityPublicKey: getString(record, 'pbk'),
        network: 'tcp',
    };
};
export const normalizeVmessUri = (nodeUrl, options) => {
    const parsed = parseVmessUri(nodeUrl);
    return {
        name: getProxyName(options.envId, options.existingNames),
        type: 'vmess',
        server: parsed.server,
        port: parsed.port,
        uuid: parsed.uuid,
        alterId: parsed.alterId,
        cipher: parsed.cipher,
        tls: parsed.tls,
        servername: parsed.servername,
        'client-fingerprint': parsed.clientFingerprint,
        'reality-opts': parsed.realityPublicKey === undefined
            ? undefined
            : {
                'public-key': parsed.realityPublicKey,
            },
        network: parsed.network,
        udp: true,
    };
};
//# sourceMappingURL=vmess.js.map