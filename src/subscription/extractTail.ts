import { findTrafficResetProxy, type YamlSequenceNode } from '../yaml/document.js';
import { YamlPreconditionError } from '../yaml/errors.js';

export type SubscriptionProxy = Record<string, unknown>;

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

const assertUniqueTailProxyNames = (proxies: readonly SubscriptionProxy[]): void => {
  const seenNames = new Set<string>();

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

export const extractSubscriptionTail = (proxies: YamlSequenceNode): SubscriptionProxy[] => {
  const { index: trafficResetIndex } = findTrafficResetProxy(proxies);
  const clonedTail = globalThis.structuredClone(proxies.toJSON().slice(trafficResetIndex) as unknown[]);
  const tail = clonedTail.map((proxy: unknown) => toSubscriptionProxy(proxy));

  assertUniqueTailProxyNames(tail);

  return tail;
};
