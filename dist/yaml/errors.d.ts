export declare const YAML_ERROR_EXIT_CODE = 4;
export type YamlPreconditionErrorCode = 'yaml_missing_config_file' | 'yaml_parse_failed' | 'yaml_multi_document' | 'yaml_expected_map' | 'yaml_expected_sequence' | 'yaml_duplicate_proxy_name' | 'yaml_duplicate_listener_name' | 'yaml_listener_proxy_reference_missing' | 'yaml_proxy_group_member_reference_missing' | 'yaml_missing_traffic_reset' | 'yaml_duplicate_traffic_reset';
type YamlPreconditionErrorOptions = {
    readonly code: YamlPreconditionErrorCode;
    readonly message: string;
};
export declare class YamlPreconditionError extends Error {
    readonly code: YamlPreconditionErrorCode;
    readonly exitCode = 4;
    constructor(options: YamlPreconditionErrorOptions);
}
export {};
//# sourceMappingURL=errors.d.ts.map