import { describe, expect, test } from 'vitest';
import { Document } from 'yaml';

import {
  assertUniqueProxyNames,
  findTrafficResetProxy,
  getListenersSequence,
  getProxiesSequence,
  parseSingleYamlDocument,
} from '../../src/yaml/document.js';
import { YamlPreconditionError } from '../../src/yaml/errors.js';

const expectYamlError = (callback: () => unknown, code: string): void => {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(YamlPreconditionError);
    expect(error).toMatchObject({ code, exitCode: 4 });

    return;
  }

  throw new Error(`Expected callback to throw ${code}`);
};

describe('parseSingleYamlDocument', () => {
  test('loads a single YAML document and exposes top-level sequences', () => {
    const document = parseSingleYamlDocument(
      'listeners:\n'
        + '  - name: listener-a\n'
        + 'proxies:\n'
        + '  - name: Traffic Reset\n'
        + '  - name: Worker A\n',
    );

    expect(getListenersSequence(document).items).toHaveLength(1);
    expect(getProxiesSequence(document).items).toHaveLength(2);
  });

  test('fails closed when yaml parsing reports errors', () => {
    expectYamlError(() => parseSingleYamlDocument('listeners:\n  - name: a\nlisteners:\n  - name: b\n'), 'yaml_parse_failed');
  });

  test('rejects multi-document YAML', () => {
    expectYamlError(() => parseSingleYamlDocument('listeners: []\n---\nproxies: []\n'), 'yaml_multi_document');
  });

  test('requires listeners and proxies to be top-level sequences', () => {
    const document = parseSingleYamlDocument('listeners: {}\nproxies: []\n');

    expectYamlError(() => getListenersSequence(document), 'yaml_expected_sequence');
  });

  test('requires a top-level mapping root', () => {
    const document = parseSingleYamlDocument('- name: not-a-map\n');

    expectYamlError(() => getProxiesSequence(document), 'yaml_expected_map');
  });
});

describe('proxy helpers', () => {
  test('enforces unique proxy names', () => {
    const document = new Document({
      listeners: [],
      proxies: [{ name: 'dup' }, { name: 'dup' }],
    });

    expectYamlError(() => assertUniqueProxyNames(getProxiesSequence(document as ReturnType<typeof parseSingleYamlDocument>)), 'yaml_duplicate_proxy_name');
  });

  test('locates exactly one Traffic Reset proxy', () => {
    const document = parseSingleYamlDocument('listeners: []\nproxies:\n  - name: A\n  - name: Traffic Reset\n  - name: B\n');
    const trafficReset = findTrafficResetProxy(getProxiesSequence(document));

    expect(trafficReset.index).toBe(1);
    expect(trafficReset.item.get('name')).toBe('Traffic Reset');
  });

  test('fails when Traffic Reset is missing', () => {
    const document = parseSingleYamlDocument('listeners: []\nproxies:\n  - name: A\n');

    expectYamlError(() => findTrafficResetProxy(getProxiesSequence(document)), 'yaml_missing_traffic_reset');
  });

  test('fails when Traffic Reset appears more than once', () => {
    const document = new Document({
      listeners: [],
      proxies: [{ name: 'Traffic Reset' }, { name: 'Traffic Reset' }],
    });

    expectYamlError(() => findTrafficResetProxy(getProxiesSequence(document as ReturnType<typeof parseSingleYamlDocument>)), 'yaml_duplicate_traffic_reset');
  });
});
