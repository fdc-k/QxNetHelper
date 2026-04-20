import type { SubscriptionProxy } from './extractTail.js';
import type { YamlSequenceNode } from '../yaml/document.js';
import { YamlPreconditionError } from '../yaml/errors.js';

const MITCE_NODE_PATTERN = /^(JP|SG)\d*-/;

const toSubscriptionProxy = (value: unknown): SubscriptionProxy => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as SubscriptionProxy;
  }

  return {};
};

const getProxyName = (value: SubscriptionProxy): string | undefined => {
  const name = value.name;

  if (name === undefined || name === null) {
    return undefined;
  }

  return String(name);
};

const isMitceNode = (proxyName: string): boolean => {
  return MITCE_NODE_PATTERN.test(proxyName);
};

const assertUniqueMitceProxyNames = (proxies: readonly SubscriptionProxy[]): void => {
  const seenNames = new Set<string>();

  for (const proxy of proxies) {
    const name = getProxyName(proxy);

    if (!name) {
      continue;
    }

    if (seenNames.has(name)) {
      throw new YamlPreconditionError({
        code: 'yaml_duplicate_proxy_name',
        message: `Found duplicate proxy name \`${name}\` in mitce subscription`,
      });
    }

    seenNames.add(name);
  }
};

export const extractMitceNodes = (proxies: YamlSequenceNode): SubscriptionProxy[] => {
  const allProxies = globalThis.structuredClone(proxies.toJSON() as unknown[]);
  const mitceNodes = allProxies
    .map((proxy: unknown) => toSubscriptionProxy(proxy))
    .filter((proxy) => {
      const name = getProxyName(proxy);
      return name && isMitceNode(name);
    });

  assertUniqueMitceProxyNames(mitceNodes);

  return mitceNodes;
};
