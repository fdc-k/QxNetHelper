import { getProxiesSequence, parseSingleYamlDocument, } from '../yaml/document.js';
const URI_LIST_ENTRY_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:\/\/\S+/u;
const getFirstMeaningfulLine = (source) => {
    return source
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
};
export class SubscriptionSourceError extends Error {
    code;
    constructor(options) {
        super(options.message);
        this.name = 'SubscriptionSourceError';
        this.code = options.code;
    }
}
export const parseSubscriptionYaml = (source) => {
    const firstMeaningfulLine = getFirstMeaningfulLine(source);
    if (firstMeaningfulLine && URI_LIST_ENTRY_PATTERN.test(firstMeaningfulLine)) {
        throw new SubscriptionSourceError({
            code: 'subscription_uri_list_unsupported',
            message: 'Subscription body must be YAML with top-level `proxies`; URI-list subscriptions are not supported in v1',
        });
    }
    return getProxiesSequence(parseSingleYamlDocument(source));
};
//# sourceMappingURL=parseYaml.js.map