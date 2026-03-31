const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const DECIMAL_PORT_PATTERN = /^\d+$/u;
const ENV_ID_PATTERN = /^\d+$/u;

export class ProxyValidationError extends Error {
  public readonly code = 'validation_failed';

  public constructor(message: string) {
    super(message);
    this.name = 'ProxyValidationError';
  }
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

export const ensureNonEmpty = (value: string, fieldName: string): string => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new ProxyValidationError(`${fieldName} is required`);
  }

  return trimmed;
};

export const decodeUriComponentStrict = (value: string, fieldName: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new ProxyValidationError(`${fieldName} contains malformed percent-encoding`);
  }
};

export const parseStrictQuery = (query: string): ReadonlyMap<string, string> => {
  const entries = new Map<string, string>();

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

export const assertExactKeys = (values: ReadonlyMap<string, string>, allowedKeys: readonly string[]): void => {
  const allowedKeySet = new Set(allowedKeys);

  for (const key of values.keys()) {
    if (!allowedKeySet.has(key)) {
      throw new ProxyValidationError(`unsupported query parameter "${key}"`);
    }
  }
};

export const parseUuid = (value: string): string => {
  const normalized = ensureNonEmpty(value, 'uuid');

  if (!UUID_PATTERN.test(normalized)) {
    throw new ProxyValidationError('uuid must be a valid UUID');
  }

  return normalized.toLowerCase();
};

export const parsePort = (value: string): number => {
  if (!DECIMAL_PORT_PATTERN.test(value)) {
    throw new ProxyValidationError('port must be a valid integer between 1 and 65535');
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ProxyValidationError('port must be a valid integer between 1 and 65535');
  }

  return port;
};

export const parseBooleanFlag = (value: string | undefined, fieldName: string): boolean => {
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

export const getProxyName = (envId: string, existingNames: readonly string[] = []): string => {
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

export const ensureTcpNetwork = (value: string | undefined, fieldName: string): 'tcp' => {
  if (value === undefined || value === 'tcp') {
    return 'tcp';
  }

  throw new ProxyValidationError(`${fieldName} must be "tcp"`);
};

export const assertSupportedProxyScheme = (nodeUrl: string): 'vless' | 'vmess' => {
  if (nodeUrl.startsWith('vless://')) {
    return 'vless';
  }

  if (nodeUrl.startsWith('vmess://')) {
    return 'vmess';
  }

  throw new ProxyValidationError('unsupported proxy URI format: only vless:// and base64-JSON vmess:// are supported');
};
