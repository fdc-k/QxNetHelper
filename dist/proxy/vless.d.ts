import type { NormalizeProxyOptions, VlessProxy } from './normalize.js';
type ParsedVlessShareLink = {
    readonly uuid: string;
    readonly server: string;
    readonly port: number;
    readonly flow?: string;
    readonly tls: boolean;
    readonly servername?: string;
    readonly clientFingerprint?: string;
    readonly realityPublicKey?: string;
    readonly network: 'tcp';
};
export declare const parseVlessUri: (nodeUrl: string) => ParsedVlessShareLink;
export declare const normalizeVlessUri: (nodeUrl: string, options: NormalizeProxyOptions) => VlessProxy;
export {};
//# sourceMappingURL=vless.d.ts.map