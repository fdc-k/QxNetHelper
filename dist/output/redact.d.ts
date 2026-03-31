type JsonLike = null | boolean | number | string | JsonLike[] | {
    readonly [key: string]: JsonLike;
};
export type OutputRedactionOptions = {
    readonly secrets?: readonly string[];
};
export declare const redactText: (value: string, options?: OutputRedactionOptions) => string;
export declare const redactJsonValue: (value: JsonLike, options?: OutputRedactionOptions) => JsonLike;
export declare const formatCommandOutput: (value: JsonLike | string, json: boolean, options?: OutputRedactionOptions) => string;
export {};
//# sourceMappingURL=redact.d.ts.map