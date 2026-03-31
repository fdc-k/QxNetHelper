import { URL } from 'node:url';

import { REMOTE_ERROR_EXIT_CODE } from '../feishu/errors.js';
import { extractSubscriptionTail, type SubscriptionProxy } from './extractTail.js';
import { parseSubscriptionYaml, SubscriptionSourceError } from './parseYaml.js';

type FetchLike = typeof fetch;

export type FetchSubscriptionOptions = {
  readonly fetchFn?: FetchLike;
};

type SubscriptionRemoteErrorOptions = {
  readonly message: string;
  readonly status?: number;
};

const HTML_CONTENT_TYPE_FRAGMENT = 'text/html';

const isHtmlBody = (source: string): boolean => {
  return source.trimStart().startsWith('<');
};

export const fetchSubscriptionSource = async (url: string, options: FetchSubscriptionOptions = {}): Promise<string> => {
  const fetchFn = options.fetchFn ?? fetch;
  const requestUrl = new URL(url);

  if (requestUrl.protocol !== 'https:') {
    throw new TypeError('Subscription URL must use HTTPS');
  }

  let response: Response;

  try {
    response = await fetchFn(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/yaml, application/x-yaml, text/yaml, text/plain;q=0.9, */*;q=0.1',
      },
    });
  } catch (error) {
    const message = error instanceof Error && error.message.length > 0
      ? `Subscription request failed: ${error.message}`
      : 'Subscription request failed';

    throw new SubscriptionRemoteError({ message });
  }

  const body = await response.text();
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    throw new SubscriptionRemoteError({
      status: response.status,
      message: `Subscription request failed with status ${response.status}`,
    });
  }

  if (contentType.includes(HTML_CONTENT_TYPE_FRAGMENT) || isHtmlBody(body)) {
    throw new SubscriptionSourceError({
      code: 'subscription_html_response',
      message: 'Subscription response must be YAML, not HTML',
    });
  }

  return body;
};

export class SubscriptionRemoteError extends Error {
  public readonly code = 'remote_failed';
  public readonly exitCode = REMOTE_ERROR_EXIT_CODE;
  public readonly status?: number;

  public constructor(options: SubscriptionRemoteErrorOptions) {
    super(options.message);
    this.name = 'SubscriptionRemoteError';
    this.status = options.status;
  }
}

export const fetchSubscriptionTail = async (url: string, options: FetchSubscriptionOptions = {}): Promise<SubscriptionProxy[]> => {
  const source = await fetchSubscriptionSource(url, options);

  return extractSubscriptionTail(parseSubscriptionYaml(source));
};
