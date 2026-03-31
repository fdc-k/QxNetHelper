import type { NormalizeProxyOptions, VmessProxy } from './normalize.js';
type ParsedVmessShareLink = {
    readonly server: string;
    readonly port: number;
    readonly uuid: string;
    readonly alterId: number;
    readonly cipher: string;
    readonly tls: boolean;
    readonly servername?: string;
    readonly clientFingerprint?: string;
    readonly realityPublicKey?: string;
    readonly network: 'tcp';
};
export declare const parseVmessUri: (nodeUrl: string) => ParsedVmessShareLink;
export declare const normalizeVmessUri: (nodeUrl: string, options: NormalizeProxyOptions) => VmessProxy;
export {};
//# sourceMappingURL=vmess.d.ts.map