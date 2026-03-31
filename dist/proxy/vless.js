import { assertExactKeys, decodeUriComponentStrict, ensureNonEmpty, ensureTcpNetwork, getProxyName, parsePort, parseStrictQuery, parseUuid, ProxyValidationError, } from './normalize.js';
const VLESS_PROTOCOL = 'vless://';
const ALLOWED_QUERY_KEYS = ['encryption', 'flow', 'security', 'sni', 'fp', 'pbk', 'type', 'headerType'];
const parseAuthority = (authority) => {
    const atIndex = authority.indexOf('@');
    if (atIndex === -1 || authority.indexOf('@', atIndex + 1) !== -1) {
        throw new ProxyValidationError('vless URI must contain exactly one "@" separator');
    }
    const uuid = parseUuid(decodeUriComponentStrict(authority.slice(0, atIndex), 'uuid'));
    const hostPort = authority.slice(atIndex + 1);
    const colonIndex = hostPort.lastIndexOf(':');
    if (colonIndex <= 0 || colonIndex === hostPort.length - 1) {
        throw new ProxyValidationError('vless URI must include server and port');
    }
    const server = ensureNonEmpty(hostPort.slice(0, colonIndex), 'server');
    const port = parsePort(hostPort.slice(colonIndex + 1));
    return { uuid, server, port };
};
export const parseVlessUri = (nodeUrl) => {
    if (!nodeUrl.startsWith(VLESS_PROTOCOL)) {
        throw new ProxyValidationError('unsupported proxy URI format: expected vless:// URL form');
    }
    const withoutProtocol = nodeUrl.slice(VLESS_PROTOCOL.length);
    const hashIndex = withoutProtocol.indexOf('#');
    const withoutFragment = hashIndex === -1 ? withoutProtocol : withoutProtocol.slice(0, hashIndex);
    const queryIndex = withoutFragment.indexOf('?');
    const authority = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
    const query = queryIndex === -1 ? '' : withoutFragment.slice(queryIndex + 1);
    const { uuid, server, port } = parseAuthority(authority);
    const parameters = parseStrictQuery(query);
    assertExactKeys(parameters, ALLOWED_QUERY_KEYS);
    const encryption = parameters.get('encryption');
    if (encryption !== 'none') {
        throw new ProxyValidationError('vless encryption must be "none"');
    }
    const network = ensureTcpNetwork(parameters.get('type'), 'vless type');
    const headerType = parameters.get('headerType');
    if (headerType !== undefined && headerType !== 'none') {
        throw new ProxyValidationError('vless headerType must be "none" when provided');
    }
    const security = parameters.get('security');
    if (security === undefined) {
        throw new ProxyValidationError('vless security is required');
    }
    if (security !== 'tls' && security !== 'reality') {
        throw new ProxyValidationError('vless security must be "tls" or "reality"');
    }
    const servername = parameters.get('sni');
    const clientFingerprint = parameters.get('fp');
    const realityPublicKey = parameters.get('pbk');
    if (security === 'reality') {
        if (servername === undefined) {
            throw new ProxyValidationError('vless reality security requires sni');
        }
        if (clientFingerprint === undefined) {
            throw new ProxyValidationError('vless reality security requires fp');
        }
        if (realityPublicKey === undefined) {
            throw new ProxyValidationError('vless reality security requires pbk');
        }
    }
    return {
        uuid,
        server,
        port,
        flow: parameters.get('flow'),
        tls: true,
        servername,
        clientFingerprint,
        realityPublicKey,
        network,
    };
};
export const normalizeVlessUri = (nodeUrl, options) => {
    const parsed = parseVlessUri(nodeUrl);
    return {
        name: getProxyName(options.envId, options.existingNames),
        type: 'vless',
        server: parsed.server,
        port: parsed.port,
        uuid: parsed.uuid,
        flow: parsed.flow,
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
//# sourceMappingURL=vless.js.map