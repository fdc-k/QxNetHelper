const REDACTED = '[REDACTED]';
const TOKEN_QUERY_PATTERN = /([?&]token=)([^&#\s]+)/giu;
const escapeRegExp = (value) => {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
};
export const redactText = (value, options = {}) => {
    let redacted = value.replace(TOKEN_QUERY_PATTERN, `$1${REDACTED}`);
    for (const secret of options.secrets ?? []) {
        if (secret.length === 0) {
            continue;
        }
        redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'gu'), REDACTED);
    }
    return redacted;
};
export const redactJsonValue = (value, options = {}) => {
    if (typeof value === 'string') {
        return redactText(value, options);
    }
    if (Array.isArray(value)) {
        return value.map((entry) => redactJsonValue(entry, options));
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactJsonValue(entry, options)]));
    }
    return value;
};
export const formatCommandOutput = (value, json, options = {}) => {
    if (json) {
        return JSON.stringify(redactJsonValue(value, options));
    }
    return redactText(String(value), options);
};
//# sourceMappingURL=redact.js.map