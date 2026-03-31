export const YAML_ERROR_EXIT_CODE = 4;
export class YamlPreconditionError extends Error {
    code;
    exitCode = YAML_ERROR_EXIT_CODE;
    constructor(options) {
        super(options.message);
        this.name = 'YamlPreconditionError';
        this.code = options.code;
    }
}
//# sourceMappingURL=errors.js.map