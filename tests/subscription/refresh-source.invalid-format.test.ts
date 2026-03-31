import nock from 'nock';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { fetchSubscriptionTail } from '../../src/subscription/fetch.js';
import { SubscriptionSourceError } from '../../src/subscription/parseYaml.js';

const SUBSCRIPTION_URL = 'https://example.test/subscription.yaml';

const expectSubscriptionError = async (
  callback: () => Promise<unknown>,
  expected: { code: string; message: string },
): Promise<void> => {
  try {
    await callback();
  } catch (error) {
    expect(error).toBeInstanceOf(SubscriptionSourceError);
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

describe('fetchSubscriptionTail invalid formats', () => {
  test('rejects HTML subscription responses', async () => {
    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(200, '<html><body>blocked</body></html>', {
        'Content-Type': 'text/html; charset=utf-8',
      });

    await expectSubscriptionError(
      () => fetchSubscriptionTail(SUBSCRIPTION_URL),
      {
        code: 'subscription_html_response',
        message: 'Subscription response must be YAML, not HTML',
      },
    );
  });

  test('rejects plain-text URI-list subscriptions', async () => {
    nock('https://example.test')
      .get('/subscription.yaml')
      .reply(
        200,
        [
          'vless://d7baecff-1956-46ce-c89c-bd81098d7223@example.test:443?encryption=none#node-a',
          'vmess://eyJ2IjoiMiIsInBzIjoibm9kZS1iIn0=',
          '',
        ].join('\n'),
        { 'Content-Type': 'text/plain; charset=utf-8' },
      );

    await expectSubscriptionError(
      () => fetchSubscriptionTail(SUBSCRIPTION_URL),
      {
        code: 'subscription_uri_list_unsupported',
        message: 'Subscription body must be YAML with top-level `proxies`; URI-list subscriptions are not supported in v1',
      },
    );
  });
});
