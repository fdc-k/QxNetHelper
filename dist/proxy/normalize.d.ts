export declare class ProxyValidationError extends Error {
    readonly code = "validation_failed";
    constructor(message: string);
}
export type VlessProxy = {
    readonly name: string;
    readonly type: 'vless';
    readonly server: string;
    readonly port: number;
    readonly uuid: string;
    readonly flow?: string;
    readonly tls: boolean;
    readonly servername?: string;
    readonly 'client-fingerprint'?: string;
    readonly 'reality-opts'?: {
        readonly 'public-key': string;
    };
    readonly network: 'tcp';
    readonly udp: true;
};
export type VmessProxy = {
    readonly name: string;
    readonly type: 'vmess';
    readonly server: string;
    readonly port: number;
    readonly uuid: string;
    readonly alterId: number;
    readonly cipher: string;
    readonly tls: boolean;
    readonly servername?: string;
    readonly 'client-fingerprint'?: string;
    readonly 'reality-opts'?: {
        readonly 'public-key': string;
    };
    readonly network: 'tcp';
    readonly udp: true;
};
export type MihomoProxy = VlessProxy | VmessProxy;
export type NormalizeProxyOptions = {
    readonly envId: string;
    readonly existingNames?: readonly string[];
};
export type NormalizeProxyInput = NormalizeProxyOptions & {
    readonly nodeUrl: string;
};
export declare const ensureNonEmpty: (value: string, fieldName: string) => string;
export declare const decodeUriComponentStrict: (value: string, fieldName: string) => string;
export declare const parseStrictQuery: (query: string) => ReadonlyMap<string, string>;
export declare const assertExactKeys: (values: ReadonlyMap<string, string>, allowedKeys: readonly string[]) => void;
export declare const parseUuid: (value: string) => string;
export declare const parsePort: (value: string) => number;
export declare const parseBooleanFlag: (value: string | undefined, fieldName: string) => boolean;
export declare const getProxyName: (envId: string, existingNames?: readonly string[]) => string;
export declare const ensureTcpNetwork: (value: string | undefined, fieldName: string) => "tcp";
export declare const assertSupportedProxyScheme: (nodeUrl: string) => "vless" | "vmess";
//# sourceMappingURL=normalize.d.ts.map