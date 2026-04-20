import { isMap, isScalar } from 'yaml';
import type { SubscriptionProxy } from '../subscription/extractTail.js';
import type { ParsedYamlDocument, YamlSequenceNode } from '../yaml/document.js';

const MITCE_NODE_PATTERN = /^(JP|SG)\d*-/;

const getProxyName = (item: YamlSequenceNode['items'][number]): string | null => {
  if (!isMap(item)) {
    return null;
  }

  const nameNode = item.get('name', true);

  if (!isScalar(nameNode) || (typeof nameNode.value !== 'string' && typeof nameNode.value !== 'number')) {
    return null;
  }

  return String(nameNode.value);
};

const isMitceNode = (proxyName: string): boolean => {
  return MITCE_NODE_PATTERN.test(proxyName);
};

export const replaceMitceNodes = (
  document: ParsedYamlDocument,
  proxies: YamlSequenceNode,
  mitceNodes: readonly SubscriptionProxy[],
): number => {
  const mitceNodeMap = new Map<string, SubscriptionProxy>();

  for (const node of mitceNodes) {
    const name = node.name;
    if (typeof name === 'string') {
      mitceNodeMap.set(name, node);
    }
  }

  const indicesToRemove: number[] = [];
  let replacedCount = 0;

  for (let i = 0; i < proxies.items.length; i++) {
    const proxyName = getProxyName(proxies.items[i]);

    if (!proxyName || !isMitceNode(proxyName)) {
      continue;
    }

    const mitceNode = mitceNodeMap.get(proxyName);

    if (mitceNode) {
      proxies.items[i] = document.createNode(mitceNode) as YamlSequenceNode['items'][number];
      mitceNodeMap.delete(proxyName);
      replacedCount++;
    } else {
      indicesToRemove.push(i);
    }
  }

  for (let i = indicesToRemove.length - 1; i >= 0; i--) {
    proxies.items.splice(indicesToRemove[i], 1);
  }

  for (const [, newNode] of mitceNodeMap) {
    proxies.items.push(document.createNode(newNode) as YamlSequenceNode['items'][number]);
    replacedCount++;
  }

  return replacedCount;
};
