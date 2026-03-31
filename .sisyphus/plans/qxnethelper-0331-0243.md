# QxNetHelper Skill + CLI Plan

## TL;DR
> **Summary**: Build a greenfield Node.js + TypeScript CLI that owns all Feishu, YAML, and proxy-mutation logic, plus a thin skill wrapper that only detects supported prompts and shells out to the CLI.
> **Deliverables**:
> - Headless `init`, `update-env`, and `refresh-base` CLI commands
> - Feishu Drive integration using `tenant_access_token`
> - AST-based Clash/Mihomo YAML mutation pipeline
> - Thin project-local skill trigger wrapper
> - Automated tests, CI, and agent-executed QA evidence plan
> **Effort**: Large
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 Bootstrap -> 2 Init/config -> 3 Feishu client -> 4 YAML mutation core -> 6 `update-env` -> 7 subscription parser -> 8 `refresh-base` -> 9 skill wrapper -> 10 CI/QA hardening

## Context
### Original Request
Create a skill that:
- initializes with Feishu `appId`, `appSecret`, shared-folder address `configDir`, and Clash subscription URL `SubLink`
- updates or adds environment network config when the conversation contains input like `更新或者添加网络配置：95830，美国，IP地址：192.89.1.42，vless://...`
- downloads the newest `config_MMdd[_N].yaml` file from the Feishu shared folder
- appends a `listeners` entry and a `proxies` entry derived from the provided environment and proxy URI
- uploads a newly named `config_MMdd[_N].yaml` file back to the same shared folder
- refreshes the base proxy block by copying the `proxies` tail from `Traffic Reset` to the end from the subscription YAML into the latest config YAML
- keeps the skill thin and pushes almost all logic into CLI code

### Interview Summary
- The current workspace is empty, so the plan assumes a greenfield implementation.
- The implementation stack is fixed to Node.js + TypeScript.
- Initialization persists configuration locally using `.env` plus a config file.
- Testing strategy is `tests-after` with mandatory agent-executed QA scenarios in every task.
- `listeners.proxy` always uses the environment identifier's last three digits.
- CLI scope is fixed to one executable with `init`, `update-env`, and `refresh-base` subcommands.
- `refresh-base` replaces the `proxies` tail beginning at the item whose `name` is exactly `Traffic Reset`.

### Metis Review (gaps addressed)
- Fixed the Feishu auth decision: v1 is headless custom-app mode using `tenant_access_token`; no user OAuth flow is planned.
- Fixed file-discovery ambiguity: scan every folder page, filter by `config_MMdd[_N].ya?ml`, then sort deterministically by effective calendar date, sequence suffix, `modified_time`, and `file_token`.
- Fixed YAML risk: use the `yaml` AST `Document` API, reject parse errors / duplicate keys / multi-document input, and preserve untouched structure/comments where practical instead of raw string replacement.
- Fixed subscription scope: `refresh-base` only accepts YAML responses with a top-level `proxies` sequence; raw URI lists, base64 subscription blobs, HTML panels, and mixed formats are hard failures.
- Fixed execution guardrails: keep one atomic commit per vertical slice, keep the skill declarative, redact secrets, and make all required verification runnable without live Feishu credentials.

## Work Objectives
### Core Objective
Deliver a production-oriented CLI + thin skill wrapper that can initialize Feishu/shared-folder access, deterministically mutate Clash/Mihomo YAML configs for environment updates and base refreshes, and prove behavior through mocked automated tests plus agent-run QA.

### Deliverables
- Single-package Node.js + TypeScript CLI project rooted at `src/`, `tests/`, and `.github/workflows/`
- CLI commands:
  - `qxnethelper init --app-id <id> --app-secret <secret> --config-dir <folder-url-or-token> --sub-link <https-url> [--config-root <dir>] [--json]`
  - `qxnethelper update-env --env-id <digits> --region <text> --ip <ipv4> --node-url <vless|vmess> [--config-root <dir>] [--json]`
  - `qxnethelper refresh-base [--config-root <dir>] [--json]`
- Config persistence contract:
  - `.qxnethelper/.env` -> `FEISHU_APP_ID`, `FEISHU_APP_SECRET`
  - `.qxnethelper/config.json` -> `folderUrl`, `folderToken`, `subLink`, `timezone`, `authMode`, `schemaVersion`
- Feishu Drive client for list/download/upload with token caching, retries, and permission-aware error mapping
- YAML mutation library for listeners/proxies edits and `Traffic Reset` tail replacement
- Project-local skill descriptor that maps Chinese trigger phrases to the CLI without re-implementing business logic
- Test suite, lint/typecheck scripts, and CI workflow

### Definition of Done (verifiable conditions with commands)
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `node dist/cli.js --help`
- `node dist/cli.js init --app-id cli_app_123 --app-secret secret_123 --config-dir "https://feishu.cn/drive/folder/fldcnTestFolder123" --sub-link "https://example.test/subscription.yaml" --config-root ./artifacts/tmp/init --json`
- `node dist/cli.js update-env --env-id 95830 --region "美国" --ip 192.89.1.42 --node-url "vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-%E5%BE%B7%E5%9B%BD-sing1" --config-root ./artifacts/tmp/update-env --json`
- `node dist/cli.js refresh-base --config-root ./artifacts/tmp/refresh-base --json`

### Must Have
- Headless Feishu access via `tenant_access_token` obtained from `app_id` + `app_secret`
- Explicit preflight validation that the supplied folder is reachable by the app identity
- Deterministic `config_MMdd[_N].ya?ml` discovery and output naming in `Asia/Shanghai`
- Direct input support for URL-form `vless://` and base64-JSON `vmess://`
- Subscription refresh support only for YAML payloads with top-level `proxies`
- Exact replacement of `proxies[trafficResetIndex..end]`
- Exit-code contract:
  - `0` success
  - `2` local validation / CLI contract failure
  - `3` remote auth / Feishu / HTTP failure
  - `4` YAML or mutation precondition failure
- Machine-readable `--json` output for all commands

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No user OAuth flow in v1
- No GUI prompts, daemon mode, background sync, or multi-folder orchestration
- No raw string slicing or regex-only YAML mutation
- No live-network dependency in required tests or acceptance criteria
- No support in v1 for URL-form VMess, Trojan, Shadowsocks, HTML panel scraping, or mixed-format subscriptions
- No automatic deletion of historical Feishu config files in v1
- No secret values written to stdout, test snapshots, or logs

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: `tests-after` using Node.js + TypeScript with `vitest`, plus CLI integration tests that spawn `node dist/cli.js`
- QA policy: Every task includes an executable happy path and at least one failure path with concrete commands and evidence targets
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}` plus runtime artifacts under `artifacts/test-results/` and `artifacts/e2e/`
- Mocking policy: required verification uses fixture YAML files, mocked Feishu endpoints, and mocked subscription responses; live Feishu validation is optional-only and excluded from Definition of Done
- Static checks: `eslint`, `tsc --noEmit`, and `vitest --run`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: bootstrap/contracts/core libraries
- 1. Project bootstrap + quality gates
- 2. Config model + `init` command contract
- 3. Feishu auth + Drive client
- 4. YAML document model + filename selection/naming
- 5. Direct proxy URI parsers + Mihomo normalization

Wave 2: command workflows + packaging/QA
- 6. `update-env` workflow
- 7. Subscription YAML parser + `Traffic Reset` tail extractor
- 8. `refresh-base` workflow
- 9. Thin skill wrapper + trigger grammar
- 10. CI, release scripts, fixtures, and QA hardening

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | none | 2,3,4,5,10 |
| 2 | 1 | 6,8,9 |
| 3 | 1,2 | 6,8 |
| 4 | 1 | 6,7,8 |
| 5 | 1 | 6 |
| 6 | 2,3,4,5 | 9,10 |
| 7 | 4 | 8,10 |
| 8 | 2,3,4,7 | 9,10 |
| 9 | 2,6,8 | 10 |
| 10 | 1,6,7,8,9 | F1-F4 |

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 -> 5 tasks -> `quick`, `unspecified-high`, `deep`
- Wave 2 -> 5 tasks -> `unspecified-high`, `writing`, `deep`
- Final Verification -> 4 tasks -> `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Bootstrap the single-package CLI workspace

  **What to do**: Create a conventional Node.js + TypeScript package with `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint` config, `src/`, `tests/`, `artifacts/`, and `bin/`/CLI entry wiring. Add scripts for `lint`, `typecheck`, `test`, `build`, and one smoke command that runs the built CLI. Pin `yaml@2`, `zod`, `commander`, `vitest`, `tsx`, and HTTP mocking dependencies. Standardize on `npm` and `dist/cli.js` as the built executable.
  **Must NOT do**: Do not introduce a monorepo, `pnpm`, runtime transpilation in production, or any package manager abstraction beyond `npm`.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: bootstrap is deterministic and mostly project scaffolding.
  - Skills: [`code-simplifier`] — why needed: keep generated config minimal and readable.
  - Omitted: [`git-master`] — why not needed: this task is implementation/bootstrap, not git analysis.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2, 3, 4, 5, 10 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — source of required features, greenfield assumption, and locked technical decisions.
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — use the Context and Work Objectives sections as the canonical contract for stack, auth mode, command set, and persistence.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm ci` completes successfully from repo root.
  - [ ] `npm run lint` exits `0` on the initial scaffold.
  - [ ] `npm run typecheck` exits `0` on the initial scaffold.
  - [ ] `npm run test` exits `0` with at least one bootstrap smoke test.
  - [ ] `npm run build` emits `dist/cli.js`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Bootstrap smoke pass
    Tool: Bash
    Steps: npm ci && npm run lint && npm run typecheck && npm run test && npm run build
    Expected: All commands exit 0 and dist/cli.js exists
    Evidence: .sisyphus/evidence/task-1-bootstrap.txt

  Scenario: Missing script regression
    Tool: Bash
    Steps: npm run does-not-exist
    Expected: Command exits non-zero and shell reports missing script rather than silently succeeding
    Evidence: .sisyphus/evidence/task-1-bootstrap-error.txt
  ```

  **Commit**: YES | Message: `chore(cli): bootstrap qxnethelper workspace` | Files: `package.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.js`, `src/cli.ts`, `tests/bootstrap.test.ts`

- [x] 2. Implement config schema and `init` command

  **What to do**: Define the persisted config contract and build `init` as a non-interactive command. `init` must accept `--app-id`, `--app-secret`, `--config-dir`, `--sub-link`, optional `--config-root`, and optional `--json`. Support `--config-dir` as either a Feishu folder URL or a raw `folderToken`; normalize to both `folderUrl` and `folderToken`. Store secrets in `.qxnethelper/.env`, non-secret state in `.qxnethelper/config.json`, set `timezone` to `Asia/Shanghai`, `authMode` to `tenant_access_token`, and `schemaVersion` to `1`. Define a `FolderAccessValidator` interface that `init` calls before persistence so task 3 can plug in the real Feishu preflight without changing the command contract. Re-running `init` with identical data must be idempotent; re-running with changed values must overwrite stored config atomically.
  **Must NOT do**: Do not prompt interactively, do not persist raw secrets in JSON, and do not proceed if the config directory URL cannot be normalized to a folder token.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: this task defines long-lived command contracts and config persistence semantics.
  - Skills: [] — why needed: no special skill is required beyond careful CLI/data design.
  - Omitted: [`code-simplifier`] — why not needed: clarity matters, but the main work is contract enforcement and tests.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6, 8, 9 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Original Request defines the required init inputs.
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Work Objectives lock persistence and command decisions.
  - External: `https://open.feishu.cn/document/server-docs/api-call-guide/calling-process/get-access-token` — official token acquisition flow for custom apps.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test -- tests/config/init-command.test.ts` exits `0`.
  - [ ] `node dist/cli.js init --app-id cli_app_123 --app-secret secret_123 --config-dir "https://feishu.cn/drive/folder/fldcnTestFolder123" --sub-link "https://example.test/subscription.yaml" --config-root ./artifacts/tmp/init --json` exits `0` and writes `./artifacts/tmp/init/.qxnethelper/.env` and `./artifacts/tmp/init/.qxnethelper/config.json`.
  - [ ] Re-running the same command does not duplicate keys or append duplicate lines to `.env`.
  - [ ] Invalid `--config-dir` input exits `2` with a deterministic JSON/text error.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Init persists normalized config
    Tool: Bash
    Steps: npm run build && node dist/cli.js init --app-id cli_app_123 --app-secret secret_123 --config-dir "https://feishu.cn/drive/folder/fldcnTestFolder123" --sub-link "https://example.test/subscription.yaml" --config-root ./artifacts/tmp/init --json
    Expected: Exit 0; ./artifacts/tmp/init/.qxnethelper/config.json contains folderToken "fldcnTestFolder123" and timezone "Asia/Shanghai"; .env contains FEISHU_APP_ID and FEISHU_APP_SECRET exactly once
    Evidence: .sisyphus/evidence/task-2-init.txt

  Scenario: Init rejects malformed folder input
    Tool: Bash
    Steps: node dist/cli.js init --app-id cli_app_123 --app-secret secret_123 --config-dir "not-a-feishu-folder" --sub-link "https://example.test/subscription.yaml" --config-root ./artifacts/tmp/init-bad --json
    Expected: Exit 2; JSON error code is validation_failed and no config files are created
    Evidence: .sisyphus/evidence/task-2-init-error.txt
  ```

  **Commit**: YES | Message: `feat(config): add init command and local config store` | Files: `src/commands/init.ts`, `src/config/schema.ts`, `src/config/store.ts`, `tests/config/init-command.test.ts`

- [x] 3. Build the Feishu tenant-token Drive client

  **What to do**: Implement a Feishu API layer with `getTenantAccessToken`, `listFolderFiles`, `downloadFile`, and `uploadFile`. Cache `tenant_access_token` in memory per process with expiry awareness; refresh before use when near expiry. Require the shared folder to be accessible by the app identity and map API errors into typed remote failures. `listFolderFiles` must paginate until exhaustion, return mixed metadata, and leave filtering to higher layers. `uploadFile` must use `upload_all` semantics and treat uploads as new files, not overwrites. Add retry logic with bounded exponential backoff for transient failures and documented retryable codes. Wire the concrete folder-access preflight into `init` through the `FolderAccessValidator` interface so `init` fails fast when the app cannot list the supplied folder.
  **Must NOT do**: Do not use `app_access_token`, do not plan user OAuth, do not silently swallow 403/404 permission errors, and do not assume Feishu folder listing is recursive.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: API semantics, retries, token expiry, and error mapping need careful boundary design.
  - Skills: [] — why needed: the task is API-contract heavy and benefits from focused implementation.
  - Omitted: [`browser-automation`] — why not needed: all required verification is mocked HTTP, not browser-driven.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6, 8 | Blocked By: 1, 2

  **References** (executor has NO interview context — be exhaustive):
  - External: `https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal` — headless custom-app token endpoint and expiry behavior.
  - External: `https://open.feishu.cn/document/server-docs/docs/drive-v1/folder/list` — folder listing contract, pagination, `type`, and sort fields.
  - External: `https://open.feishu.cn/document/server-docs/docs/drive-v1/download/download` — ordinary file download contract and download caveats.
  - External: `https://open.feishu.cn/document/server-docs/docs/drive-v1/upload/upload_all` — ordinary file upload contract and 20 MB limit.
  - External: `https://open.feishu.cn/document/server-docs/docs/drive-v1/faq` — shared-folder access requirements for app identity.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test -- tests/feishu/drive-client.test.ts` exits `0`.
  - [ ] `npm run test -- tests/config/init-preflight.test.ts` exits `0`.
  - [ ] Token refresh tests verify cached-token reuse and refresh-before-expiry behavior.
  - [ ] Pagination tests verify that two mocked pages become one combined result set.
  - [ ] Permission failures map to exit-class `3` and preserve remote error codes/messages in structured form.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Paginated folder list and upload pass
    Tool: Bash
    Steps: npm run test -- tests/feishu/drive-client.test.ts
    Expected: Exit 0; mocked page-1 and page-2 responses are both consumed; upload_all mock receives multipart file_name, parent_type=explorer, and parent_node=fldcnTestFolder123
    Evidence: .sisyphus/evidence/task-3-feishu.txt

  Scenario: Permission denial is surfaced cleanly
    Tool: Bash
    Steps: npm run test -- tests/feishu/drive-client.permission.test.ts
    Expected: Exit 0; 403 download/list responses are converted to typed remote errors without retries beyond configured policy
    Evidence: .sisyphus/evidence/task-3-feishu-error.txt

  Scenario: Init preflight blocks inaccessible folder
    Tool: Bash
    Steps: npm run test -- tests/config/init-preflight.test.ts
    Expected: Exit 0; mocked list-folder 403 causes init to fail with exit-class 3 and no config files are written
    Evidence: .sisyphus/evidence/task-3-feishu-init-error.txt
  ```

  **Commit**: YES | Message: `feat(feishu): add tenant-token drive client` | Files: `src/feishu/auth.ts`, `src/feishu/driveClient.ts`, `src/feishu/errors.ts`, `tests/feishu/drive-client.test.ts`, `tests/config/init-preflight.test.ts`

- [x] 4. Implement YAML document primitives and deterministic config-file selection

  **What to do**: Build the YAML core using `yaml@2` document APIs. Require exactly one YAML document, reject parse errors and duplicate keys, and keep untouched AST nodes intact. Implement helpers for: loading top-level `listeners` and `proxies` as sequences, validating uniqueness of proxy names, locating the unique `Traffic Reset` item, parsing `config_MMdd[_N].ya?ml`, computing the effective calendar date in `Asia/Shanghai`, choosing the latest source file, and computing the next upload filename for today. Preserve comments/blank lines where the library preserves untouched nodes, but do not promise byte-identical output.
  **Must NOT do**: Do not use raw string replacement, do not accept multi-document YAML, and do not mutate YAML through plain-object stringify cycles.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: AST mutation, year-rollover filename ranking, and structural validation are high-risk core logic.
  - Skills: [] — why needed: no special skill beats careful direct implementation here.
  - Omitted: [`code-simplifier`] — why not needed: correctness and invariants matter more than stylistic cleanup.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6, 7, 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Original Request and Must Have sections define filename-selection and renaming requirements.
  - External: `https://eemeli.org/yaml/` — `Document` API, preserved comments, parse errors, and duplicate-key safety defaults.
  - External: `https://wiki.metacubex.one/en/config/inbound/listeners/` — listener structure and `proxy` validity expectations.
  - External: `https://wiki.metacubex.one/en/config/proxies/` — top-level proxy sequence and unique-name requirement.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test -- tests/yaml/config-document.test.ts` exits `0`.
  - [ ] `npm run test -- tests/yaml/config-selection.test.ts` exits `0`.
  - [ ] Given fixture files `config_1231.yaml`, `config_0101.yaml`, and `config_0101_2.yaml` with a mocked current date of `2026-01-01` in `Asia/Shanghai`, the selector chooses `config_0101_2.yaml`.
  - [ ] Duplicate keys or multiple `Traffic Reset` items fail with mutation exit-class `4`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: YAML AST mutation helpers preserve untouched structure
    Tool: Bash
    Steps: npm run test -- tests/yaml/config-document.test.ts
    Expected: Exit 0; tests confirm comments survive on untouched nodes, one-document parsing is enforced, and duplicate keys fail fast
    Evidence: .sisyphus/evidence/task-4-yaml.txt

  Scenario: Filename ranking handles year rollover and duplicates
    Tool: Bash
    Steps: npm run test -- tests/yaml/config-selection.test.ts
    Expected: Exit 0; selector returns config_0101_2.yaml for 2026-01-01 and rejects invalid names like config_13AA.yaml
    Evidence: .sisyphus/evidence/task-4-yaml-error.txt
  ```

  **Commit**: YES | Message: `feat(yaml): add deterministic config selection and mutation primitives` | Files: `src/yaml/document.ts`, `src/yaml/configFiles.ts`, `src/yaml/errors.ts`, `tests/yaml/config-document.test.ts`, `tests/yaml/config-selection.test.ts`

- [x] 5. Add direct proxy URI parsers and Mihomo-node normalization

  **What to do**: Implement parser/normalizer functions for the direct node URL passed to `update-env`. Support URL-form `vless://` and base64-JSON `vmess://` only. Normalize parsed values into Mihomo-compatible proxy objects using `uuid`, `server`, `port`, `flow`, `tls`, `servername`, `client-fingerprint`, `reality-opts.public-key`, `network`, `udp`, and VMess cipher fields as applicable. Enforce strict validation for ports, UUIDs, query duplication, percent-decoding, unsupported transport/security combos, and duplicate proxy names. Use the environment last three digits as the normalized `name` value.
  **Must NOT do**: Do not support URL-form VMess, Trojan, Shadowsocks, or partially parsed unknown query params in v1.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: the logic is isolated but protocol parsing details are easy to get subtly wrong.
  - Skills: [] — why needed: direct protocol parsing is the core work.
  - Omitted: [`browser-automation`] — why not needed: this is pure parsing and normalization.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Original Request defines the proxy insertion requirement.
  - External: `https://wiki.metacubex.one/en/config/proxies/vless/` — Mihomo VLESS fields.
  - External: `https://wiki.metacubex.one/en/config/proxies/vmess/` — Mihomo VMess fields.
  - External: `https://xtls.github.io/en/config/outbounds/vless.html` — authoritative VLESS semantic field mapping.
  - External: `https://github.com/XTLS/Xray-core/issues/91` — URL-form VLESS / AEAD VMess share-link constraints and duplicate-query prohibition.
  - External: `https://wiki.metacubex.one/en/config/proxy-providers/content/` — Mihomo provider-content examples including base64-JSON VMess.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test -- tests/proxy/vless-parser.test.ts` exits `0`.
  - [ ] `npm run test -- tests/proxy/vmess-parser.test.ts` exits `0`.
  - [ ] The sample VLESS URL from the request normalizes into a Mihomo node named `830` with `type: vless`, `tls: true`, `network: tcp`, `flow: xtls-rprx-vision`, and `reality-opts.public-key` populated.
  - [ ] Unsupported direct inputs exit with validation class `2` and identify the unsupported format.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: VLESS sample normalizes correctly
    Tool: Bash
    Steps: npm run test -- tests/proxy/vless-parser.test.ts
    Expected: Exit 0; normalized node has name 830, server zdegeuy2.bia3.top, port 21375, flow xtls-rprx-vision, and servername ndl.certainteed.com
    Evidence: .sisyphus/evidence/task-5-proxy.txt

  Scenario: Unsupported VMess form is rejected
    Tool: Bash
    Steps: npm run test -- tests/proxy/vmess-parser.test.ts
    Expected: Exit 0; URL-form vmess:// payloads fail with validation_failed while base64-JSON fixtures pass
    Evidence: .sisyphus/evidence/task-5-proxy-error.txt
  ```

  **Commit**: YES | Message: `feat(proxy): add vless and vmess normalization` | Files: `src/proxy/vless.ts`, `src/proxy/vmess.ts`, `src/proxy/normalize.ts`, `tests/proxy/vless-parser.test.ts`, `tests/proxy/vmess-parser.test.ts`

- [x] 6. Implement the `update-env` end-to-end workflow

  **What to do**: Wire `update-env` from CLI input to Feishu read/write. Load persisted config, validate `env-id`, `region`, `ip`, and `node-url`, fetch the latest config YAML from Feishu, parse it via the YAML AST layer, append or replace the `listeners` entry named `mixed<suffix>` with `port = 42000 + suffix` and `proxy = <suffix>`, append or replace the proxy node named `<suffix>`, ensure unrelated sections remain untouched, compute the next dated output filename for today, upload the new file, and emit structured JSON/text output containing `sourceFile`, `outputFile`, `folderToken`, `envId`, `proxyName`, `region`, and `ip`. Treat `region` and `ip` as validated audit fields surfaced in output, not YAML keys.
  **Must NOT do**: Do not mutate non-target sections, do not silently ignore existing duplicate `mixed<suffix>` or proxy-name conflicts, and do not write temp files outside the configured working area.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: this is the main cross-layer workflow tying together CLI, config, Feishu, YAML, and proxy parsing.
  - Skills: [] — why needed: integrated orchestration is the hard part.
  - Omitted: [`code-simplifier`] — why not needed: task needs correctness across boundaries more than style work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 9, 10 | Blocked By: 2, 3, 4, 5

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Context captures the exact user-facing update-env trigger example.
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Must Have locks the listener naming, port, and proxy insertion rules.
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Deliverables define the CLI contract that this workflow must honor.
  - External: `https://wiki.metacubex.one/en/config/inbound/listeners/` — listener semantics.
  - External: `https://open.feishu.cn/document/server-docs/docs/drive-v1/upload/upload_all` — upload semantics for the generated YAML.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test -- tests/commands/update-env.integration.test.ts` exits `0`.
  - [ ] `npm run qa:update-env` exits `0` and archives its fixture setup and uploaded-output assertions under `artifacts/e2e/update-env/`.
  - [ ] Running the built CLI against mocked Feishu fixtures produces `config_0331.yaml`, `config_0331_1.yaml`, or the correct next filename for the mocked date in `Asia/Shanghai`.
  - [ ] The resulting YAML contains exactly one `listeners` item named `mixed830` with `port: 42830` and `proxy: 830`.
  - [ ] The resulting YAML contains exactly one proxy item named `830` with normalized VLESS/VMess fields.
  - [ ] Invalid `env-id` or malformed `node-url` exits `2`; missing target sections or duplicate target names exit `4`; Feishu failures exit `3`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Update-env writes new dated config
    Tool: Bash
    Steps: npm run qa:update-env
    Expected: Exit 0; the harness creates ./artifacts/tmp/update-env/.qxnethelper config files, starts mocked Feishu list/download/upload handlers, invokes the CLI with env-id 95830, and proves the uploaded YAML contains mixed830/42830/830 plus the normalized VLESS proxy node
    Evidence: .sisyphus/evidence/task-6-update-env.txt

  Scenario: Update-env fails on duplicate target names
    Tool: Bash
    Steps: npm run test -- tests/commands/update-env.duplicates.test.ts
    Expected: Exit 0; fixture YAML containing duplicate mixed830 or duplicate proxy name 830 fails with exit-class 4 and no upload attempt
    Evidence: .sisyphus/evidence/task-6-update-env-error.txt
  ```

  **Commit**: YES | Message: `feat(update-env): implement environment config workflow` | Files: `src/commands/updateEnv.ts`, `src/workflows/updateEnv.ts`, `tests/commands/update-env.integration.test.ts`, `tests/commands/update-env.duplicates.test.ts`, `scripts/qa-update-env.mjs`

- [x] 7. Build subscription-YAML parsing and `Traffic Reset` tail extraction

  **What to do**: Implement the `refresh-base` source parser around the configured `SubLink`. Fetch the subscription over HTTPS, require a successful non-HTML response, parse exactly one YAML document, verify a top-level `proxies` sequence exists, locate exactly one item whose `name` is `Traffic Reset`, and return a deep-cloned tail slice from that item through the end of the sequence. Before returning, validate unique proxy names inside the replacement slice. Any raw URI list, base64 blob, HTML response, or missing/duplicate `Traffic Reset` item must fail deterministically.
  **Must NOT do**: Do not auto-detect or decode base64/URI subscription formats in v1, and do not partially import malformed proxy items.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: the logic is isolated but defines the exact scope boundary for refresh behavior.
  - Skills: [] — why needed: careful parser/validator work is sufficient.
  - Omitted: [`browser-automation`] — why not needed: subscription verification is HTTP + YAML, not browser work.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8, 10 | Blocked By: 4

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Original Request defines the base refresh requirement and exact `Traffic Reset` source rule.
  - External: `https://wiki.metacubex.one/en/config/proxy-providers/content/` — authoritative note that Mihomo provider content types must not be mixed.
  - External: `https://eemeli.org/yaml/` — YAML document parsing and error handling.
  - External: `https://wiki.metacubex.one/en/config/proxies/` — proxy structure and unique-name expectations.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test -- tests/subscription/refresh-source.test.ts` exits `0`.
  - [ ] YAML subscription fixtures with a valid `Traffic Reset` item return the tail slice unchanged except for deep-clone isolation.
  - [ ] HTML fixtures, URI-list fixtures, missing `Traffic Reset`, and duplicate `Traffic Reset` fixtures all fail with exit-class `4` or `3` according to where the failure occurs.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Subscription YAML tail is extracted cleanly
    Tool: Bash
    Steps: npm run test -- tests/subscription/refresh-source.test.ts
    Expected: Exit 0; fixture subscription returns tail beginning with name Traffic Reset and includes every later proxy entry exactly once
    Evidence: .sisyphus/evidence/task-7-refresh-source.txt

  Scenario: Non-YAML subscription is rejected
    Tool: Bash
    Steps: npm run test -- tests/subscription/refresh-source.invalid-format.test.ts
    Expected: Exit 0; HTML and URI-list fixtures fail with deterministic invalid_subscription_format errors and no mutation output
    Evidence: .sisyphus/evidence/task-7-refresh-source-error.txt
  ```

  **Commit**: YES | Message: `feat(refresh-base): add subscription tail extraction` | Files: `src/subscription/fetch.ts`, `src/subscription/parseYaml.ts`, `src/subscription/extractTail.ts`, `tests/subscription/refresh-source.test.ts`, `tests/subscription/refresh-source.invalid-format.test.ts`

- [x] 8. Implement the `refresh-base` end-to-end workflow

  **What to do**: Wire `refresh-base` to load persisted config, fetch and validate the subscription tail, fetch the latest config YAML from Feishu, replace the target config's `proxies` sequence from the unique `Traffic Reset` item through the end, verify the resulting config still has unique proxy names and that any `listeners.proxy` references remain valid, compute the next output filename for today, upload the new YAML, and emit structured JSON/text output containing `sourceFile`, `outputFile`, `subscriptionUrl`, `replacedProxyCount`, and `trafficResetIndex`. Add explicit failure mapping for missing config files, invalid subscription content, broken proxy references, and Feishu upload/download failures.
  **Must NOT do**: Do not refresh any section besides the `proxies` tail, do not silently preserve broken references, and do not fall back to provider-specific heuristics outside the locked YAML scope.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: the workflow crosses config loading, subscription parsing, YAML mutation, and upload semantics.
  - Skills: [] — why needed: integration and invariants dominate the task.
  - Omitted: [`code-simplifier`] — why not needed: correctness across subsystems is the priority.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 9, 10 | Blocked By: 2, 3, 4, 7

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Original Request defines the requested replacement behavior.
  - External: `https://wiki.metacubex.one/en/config/inbound/listeners/` — `listeners.proxy` must remain valid after replacement.
  - External: `https://open.feishu.cn/document/server-docs/docs/drive-v1/download/download` — source-file download semantics.
  - External: `https://open.feishu.cn/document/server-docs/docs/drive-v1/upload/upload_all` — output upload semantics.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test -- tests/commands/refresh-base.integration.test.ts` exits `0`.
  - [ ] `npm run qa:refresh-base` exits `0` and archives its fixture setup and uploaded-output assertions under `artifacts/e2e/refresh-base/`.
  - [ ] Successful runs replace the target config's proxy tail beginning at `Traffic Reset` and leave all earlier proxy items unchanged.
  - [ ] Broken `listeners.proxy` references after replacement fail with exit-class `4` and prevent upload.
  - [ ] HTML subscription responses or Feishu download failures exit `3` or `4` with deterministic machine-readable errors.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Refresh-base replaces proxy tail and uploads new file
    Tool: Bash
    Steps: npm run qa:refresh-base
    Expected: Exit 0; the harness creates ./artifacts/tmp/refresh-base/.qxnethelper config files, starts mocked Feishu and subscription handlers, invokes the CLI, and proves the uploaded YAML keeps proxies before Traffic Reset unchanged while swapping the tail from the subscription fixture
    Evidence: .sisyphus/evidence/task-8-refresh-base.txt

  Scenario: Refresh-base blocks broken proxy references
    Tool: Bash
    Steps: npm run test -- tests/commands/refresh-base.reference-failure.test.ts
    Expected: Exit 0; fixture where a listener points to a removed proxy fails with exit-class 4 and no upload request is issued
    Evidence: .sisyphus/evidence/task-8-refresh-base-error.txt
  ```

  **Commit**: YES | Message: `feat(refresh-base): implement subscription refresh workflow` | Files: `src/commands/refreshBase.ts`, `src/workflows/refreshBase.ts`, `tests/commands/refresh-base.integration.test.ts`, `tests/commands/refresh-base.reference-failure.test.ts`, `scripts/qa-refresh-base.mjs`

- [x] 9. Create the thin skill wrapper and trigger grammar

  **What to do**: Add a project-local skill descriptor that documents the supported Chinese triggers, required initialization fields, and CLI invocation mapping. The skill must only: detect init requests, detect `更新` / `添加` 网络配置 phrases that include `env-id`, `region`, `IP地址`, and a `vless://` or `vmess://` node URL, and detect `更新基础网络配置` phrases. On match, it should invoke the built CLI with exact flags and pass through JSON/text output. Include examples and guardrails for unsupported prompts. Use the same fixed command contracts as the CLI; do not duplicate YAML or Feishu logic in the skill layer.
  **Must NOT do**: Do not re-implement parsing beyond extracting arguments from the natural-language prompt, do not embed secrets, and do not add fallback business logic in the skill file.

  **Recommended Agent Profile**:
  - Category: `writing` — Reason: this task is mostly skill-descriptor authoring plus deterministic mapping rules.
  - Skills: [] — why needed: concise, unambiguous trigger documentation is the main output.
  - Omitted: [`frontend-design`] — why not needed: there is no UI surface.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 2, 6, 8

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Context contains the required update trigger shape.
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Must NOT Have and Deliverables sections lock the thin-skill boundary and CLI contract.
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md` — Work Objectives define persistence expectations.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run test -- tests/skill/trigger-mapping.test.ts` exits `0`.
  - [ ] Skill examples map the init trigger to `qxnethelper init`, environment-update trigger to `qxnethelper update-env`, and base-refresh trigger to `qxnethelper refresh-base`.
  - [ ] Unsupported prompts fail with a deterministic `unsupported_trigger` result and do not call the CLI.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Chinese trigger maps to update-env
    Tool: Bash
    Steps: npm run test -- tests/skill/trigger-mapping.test.ts
    Expected: Exit 0; prompt "更新或者添加网络配置：95830，美国，IP地址：192.89.1.42，vless://..." maps to qxnethelper update-env with env-id 95830, region 美国, ip 192.89.1.42, and node-url preserved
    Evidence: .sisyphus/evidence/task-9-skill.txt

  Scenario: Unsupported prompt does not invoke CLI
    Tool: Bash
    Steps: npm run test -- tests/skill/trigger-unsupported.test.ts
    Expected: Exit 0; prompt lacking env-id or node-url returns unsupported_trigger and spawn mock is untouched
    Evidence: .sisyphus/evidence/task-9-skill-error.txt
  ```

  **Commit**: YES | Message: `feat(skill): add thin trigger wrapper` | Files: `.agents/skills/qxnethelper/SKILL.md`, `src/skill/triggerMap.ts`, `tests/skill/trigger-mapping.test.ts`, `tests/skill/trigger-unsupported.test.ts`

- [x] 10. Add CI, packaging, fixtures, and QA hardening

  **What to do**: Finish the project with production-facing quality gates: fixture directories for Feishu/list/download/upload and subscription/YAML samples; GitHub Actions CI; `npm pack`-safe packaging; README usage snippets if the implementation creates repo docs; redaction-safe logging; and a top-level smoke test script that runs `init`, `update-env`, and `refresh-base` against mocked fixtures in sequence. Make sure every required script stores logs/JUnit or equivalent artifacts under `artifacts/test-results/` and `artifacts/e2e/` so final verification can attach evidence. Ensure the build output and the skill descriptor both reference the same CLI binary path.
  **Must NOT do**: Do not require live Feishu or live subscription endpoints in CI, and do not leave evidence locations implicit.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: this task ties together release hygiene, reproducible verification, and artifact collection.
  - Skills: [] — why needed: careful QA and packaging discipline are the main work.
  - Omitted: [`git-master`] — why not needed: commit planning is already fixed by this plan.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: F1-F4 | Blocked By: 1, 6, 7, 8, 9

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md:72` — Definition of Done command set that CI must exercise.
  - Pattern: `.sisyphus/plans/qxnethelper-0331-0243.md:95` — required verification and artifact policy.
  - External: `https://open.feishu.cn/document/server-docs/docs/drive-v1/upload/upload_all` — fixture design must reflect upload_all multipart semantics.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `npm run lint && npm run typecheck && npm run test && npm run build` exits `0` in CI and locally.
  - [ ] `npm run test:e2e` exits `0` and writes artifacts under `artifacts/e2e/`.
  - [ ] CI workflow runs on push and pull_request and publishes test/build logs as artifacts.
  - [ ] `npm pack --dry-run` exits `0` and includes the built CLI plus skill descriptor while excluding temp artifacts and secrets.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Full mocked workflow passes end to end
    Tool: Bash
    Steps: npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e && npm pack --dry-run
    Expected: All commands exit 0; artifacts/test-results and artifacts/e2e contain logs for init, update-env, and refresh-base flows
    Evidence: .sisyphus/evidence/task-10-qa.txt

  Scenario: CI catches logging/secrets regression
    Tool: Bash
    Steps: npm run test -- tests/qa/redaction.test.ts
    Expected: Exit 0; log snapshots redact FEISHU_APP_SECRET and never print the raw subscription URL token query value
    Evidence: .sisyphus/evidence/task-10-qa-error.txt
  ```

  **Commit**: YES | Message: `feat(skill): add qa hardening and release workflow` | Files: `.github/workflows/ci.yml`, `tests/e2e/full-workflow.test.ts`, `tests/qa/redaction.test.ts`, `artifacts/.gitkeep`

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Commit 1: `chore(cli): bootstrap qxnethelper workspace`
- Commit 2: `feat(config): add init command and local config store`
- Commit 3: `feat(feishu): add tenant-token drive client`
- Commit 4: `feat(yaml): add deterministic config selection and mutation primitives`
- Commit 5: `feat(proxy): add vless and vmess normalization`
- Commit 6: `feat(update-env): implement environment config workflow`
- Commit 7: `feat(refresh-base): add subscription tail extraction`
- Commit 8: `feat(refresh-base): implement subscription refresh workflow`
- Commit 9: `feat(skill): add thin trigger wrapper`
- Commit 10: `feat(skill): add qa hardening and release workflow`

## Success Criteria
- The executor can implement every file, command, failure path, and validation step without making architectural decisions.
- Required tests and QA pass without live Feishu credentials.
- The skill never owns business logic beyond parsing supported prompts and invoking the CLI.
- Re-running `init`, `update-env`, and `refresh-base` with identical fixtures is deterministic and idempotent where expected.
