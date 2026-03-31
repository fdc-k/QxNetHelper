import { type YamlSequenceNode } from '../yaml/document.js';
export type SubscriptionSourceErrorCode = 'subscription_html_response' | 'subscription_uri_list_unsupported';
type SubscriptionSourceErrorOptions = {
    readonly code: SubscriptionSourceErrorCode;
    readonly message: string;
};
export declare class SubscriptionSourceError extends Error {
    readonly code: SubscriptionSourceErrorCode;
    constructor(options: SubscriptionSourceErrorOptions);
}
export declare const parseSubscriptionYaml: (source: string) => YamlSequenceNode;
export {};
//# sourceMappingURL=parseYaml.d.ts.map