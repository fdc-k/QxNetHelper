import {
  getProxiesSequence,
  parseSingleYamlDocument,
  type YamlSequenceNode,
} from '../yaml/document.js';

export type SubscriptionSourceErrorCode = 'subscription_html_response' | 'subscription_uri_list_unsupported';

type SubscriptionSourceErrorOptions = {
  readonly code: SubscriptionSourceErrorCode;
  readonly message: string;
};

const URI_LIST_ENTRY_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+/u;

const getFirstMeaningfulLine = (source: string): string | undefined => {
  return source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
};

export class SubscriptionSourceError extends Error {
  public readonly code: SubscriptionSourceErrorCode;

  public constructor(options: SubscriptionSourceErrorOptions) {
    super(options.message);
    this.name = 'SubscriptionSourceError';
    this.code = options.code;
  }
}

export const parseSubscriptionYaml = (source: string): YamlSequenceNode => {
  const firstMeaningfulLine = getFirstMeaningfulLine(source);

  if (firstMeaningfulLine && URI_LIST_ENTRY_PATTERN.test(firstMeaningfulLine)) {
    throw new SubscriptionSourceError({
      code: 'subscription_uri_list_unsupported',
      message: 'Subscription body must be YAML with top-level `proxies`; URI-list subscriptions are not supported in v1',
    });
  }

  return getProxiesSequence(parseSingleYamlDocument(source));
};
