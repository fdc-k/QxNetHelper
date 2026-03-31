const REDACTED = '[REDACTED]';
const TOKEN_QUERY_PATTERN = /([?&]token=)([^&#\s]+)/giu;

type JsonLike = null | boolean | number | string | JsonLike[] | { readonly [key: string]: JsonLike };

export type OutputRedactionOptions = {
  readonly secrets?: readonly string[];
};

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
};

export const redactText = (value: string, options: OutputRedactionOptions = {}): string => {
  let redacted = value.replace(TOKEN_QUERY_PATTERN, `$1${REDACTED}`);

  for (const secret of options.secrets ?? []) {
    if (secret.length === 0) {
      continue;
    }

    redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'gu'), REDACTED);
  }

  return redacted;
};

export const redactJsonValue = (value: JsonLike, options: OutputRedactionOptions = {}): JsonLike => {
  if (typeof value === 'string') {
    return redactText(value, options);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactJsonValue(entry, options));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactJsonValue(entry as JsonLike, options)]),
    );
  }

  return value;
};

export const formatCommandOutput = (
  value: JsonLike | string,
  json: boolean,
  options: OutputRedactionOptions = {},
): string => {
  if (json) {
    return JSON.stringify(redactJsonValue(value as JsonLike, options));
  }

  return redactText(String(value), options);
};
