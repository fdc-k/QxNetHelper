import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { fetchSubscriptionTail } from '../../src/subscription/fetch.js';
import { YamlPreconditionError } from '../../src/yaml/errors.js';

const SUBSCRIPTION_URL = 'https://example.test/subscription.yaml';

const expectYamlError = async (
  callback: () => Promise<unknown>,
  expected: { code: string; message: string },
): Promise<void> => {
  try {
    await callback();
  } catch (error) {
    expect(error).toBeInstanceOf(YamlPreconditionError);
    expect(error).toMatchObject(expected);

    return;
  }

  throw new Error(`Expected callback to throw ${expected.code}`);
};

beforeEach(() => {
  nock.disableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
  nock.enableNetConnect();
});

describe('fetchSubscriptionTail', () => {
  test('returns the deep-cloned proxy tail starting at Traffic Reset', async () => {
    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(
        200,
        [
          'proxies:',
          '  - name: Keep Me',
          '    type: direct',
          '  - name: Traffic Reset',
          '    type: select',
          '    proxies:',
          '      - Worker A',
          '      - Worker B',
          '  - name: Worker A',
          '    type: direct',
          '  - name: Worker B',
          '    type: direct',
          '',
        ].join('\n'),
        { 'Content-Type': 'application/yaml' },
      );

    const tail = await fetchSubscriptionTail(SUBSCRIPTION_URL);

    expect(tail).toEqual([
      {
        name: 'Traffic Reset',
        type: 'select',
        proxies: ['Worker A', 'Worker B'],
      },
      {
        name: 'Worker A',
        type: 'direct',
      },
      {
        name: 'Worker B',
        type: 'direct',
      },
    ]);
  });

  test('fails when Traffic Reset is missing', async () => {
    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(200, ['proxies:', '  - name: Worker A', '    type: direct', ''].join('\n'), {
        'Content-Type': 'application/yaml',
      });

    await expectYamlError(
      () => fetchSubscriptionTail(SUBSCRIPTION_URL),
      {
        code: 'yaml_missing_traffic_reset',
        message: 'Expected exactly one proxy named `Traffic Reset` in top-level `proxies`',
      },
    );
  });

  test('fails when Traffic Reset appears more than once', async () => {
    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(
        200,
        [
          'proxies:',
          '  - name: Traffic Reset',
          '    type: direct',
          '  - name: Traffic Reset',
          '    type: direct',
          '',
        ].join('\n'),
        { 'Content-Type': 'application/yaml' },
      );

    await expectYamlError(
      () => fetchSubscriptionTail(SUBSCRIPTION_URL),
      {
        code: 'yaml_duplicate_traffic_reset',
        message: 'Expected exactly one proxy named `Traffic Reset` in top-level `proxies`',
      },
    );
  });
});
