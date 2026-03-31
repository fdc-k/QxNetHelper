# Learnings

## Task 9: Thin Skill Wrapper - Learnings

### Regex Pattern Design for Chinese Prompt Parsing
- When extracting numeric IDs from prompts that also contain IP addresses, the regex must be specific enough to avoid matching IP address segments.
- The pattern `(?:配置|环境)[:：]\s*(\d{3,})\s*[，,]` correctly targets env-ids that appear after trigger keywords like "配置：" or "环境：" followed by a comma.
- Region extraction needs guardrails to prevent matching structural keywords like "IP地址" - added validation to reject regions starting with "IP".

### Trigger Grammar Patterns
Three categories of triggers implemented:
1. **Init triggers**: `初始化 qxnethelper`, `设置 qxnethelper 配置`, `配置 Feishu`
2. **Update-env triggers**: `更新或者添加网络配置`, `更新网络配置`, `添加网络配置`, `更新环境配置`
3. **Refresh-base triggers**: `更新基础网络配置`, `刷新基础配置`, `刷新订阅配置`

### Testing Strategy for Skill Layer
- Tests focus on `parseTrigger()` function to verify correct argument extraction from Chinese prompts.
- Tests verify the canonical example from the plan: `更新或者添加网络配置：95830，美国，IP地址：192.89.1.42，vless://...` maps correctly to `update-env` with all flags.
- Unsupported trigger tests verify that missing required fields result in `unsupported_trigger` without invoking the CLI.
- Spawn mocking in vitest is tricky; tests focus on the parsing layer rather than mocking `child_process.spawn`.

### File Structure
- Skill descriptor: `.agents/skills/qxnethelper/SKILL.md` - documents supported triggers and CLI mapping
- Trigger logic: `src/skill/triggerMap.ts` - exports `parseTrigger()`, `invokeCli()`, `handleTrigger()`
- Tests: `tests/skill/trigger-mapping.test.ts` and `tests/skill/trigger-unsupported.test.ts`

## Task 10: CI, Packaging, Fixtures, and QA Hardening

### Output Redaction
- Keep command return values unchanged for workflow/tests, but redact only at the stdout/stderr formatting layer so JSON payload contracts stay stable in-process.
- Redacting `token=` query params in plain text and JSON output is enough to protect subscription URLs without changing persisted config values.

### Mocked E2E Harness
- A single stateful local HTTP server works better than isolated mocks for full-workflow QA because uploads from `update-env` must become the downloadable latest file for `refresh-base`.
- Writing deterministic artifacts from the e2e test itself keeps `npm run test:e2e` reproducible and gives CI uploadable evidence under `artifacts/e2e/full-workflow/`.

### Packaging
- A narrow `package.json#files` allowlist is the simplest way to ensure `npm pack --dry-run` includes `dist/` plus the skill descriptor while excluding artifacts, tests, and local config secrets.

## Task F2: Code Quality Review - Learnings

- Subscription fetch failures need explicit command-level mapping; otherwise plain `Error` paths bypass `CommanderError` handling and lose deterministic exit behavior.
- Feishu client helpers should normalize invalid JSON / malformed pagination responses into domain errors instead of relying on implicit runtime exceptions.
- `refresh-base` replacement safety is broader than listeners: proxy-group member references can also become dangling after replacing the tail and need coverage.

## Final Verification Wave Fixes - Exit Codes and Subscription Failures

- Commander parse failures need `program.exitOverride()` plus a top-level `CommanderError` normalization step; otherwise missing required options still trigger `process.exit(1)` before the CLI can enforce the plan's exit-code contract.
- Subscription fetch should distinguish remote transport/status failures from content-format failures: wrap network and non-2xx responses in a typed remote error for exit `3`, while keeping HTML and URI-list rejections as typed subscription-content errors for exit `4`.
- Enforcing HTTPS in `subLinkSchema` closes both init-time contract drift and downstream ambiguity in `refresh-base`; invalid `http://` values now fail as local validation before any persistence.

## Task qxnethelper-0331-0243: Feishu Drive Hardening

- Feishu Drive JSON helpers should parse `response.text()` explicitly and convert malformed HTML/text bodies into `FeishuRemoteError` so retry/exit-code handling stays deterministic instead of leaking `SyntaxError`.
- Pagination guards need to treat `has_more=true` without a non-empty `next_page_token` as a typed remote failure; otherwise folder listing can spin forever on the same page.

## Task qxnethelper-0331-0243: Refresh-Base Reference Validation

- After replacing the `Traffic Reset` tail, `refresh-base` must revalidate both listener `proxy` targets and scalar `proxy-groups[*].proxies[*]` entries against the combined set of proxy and proxy-group names before upload.

## Task F1: Plan Compliance Audit (rerun)

- In `refresh-base` subscription fetching, evaluate `response.ok` before content-format heuristics when the contract says all non-2xx responses are remote failures; otherwise HTML error pages get mislabeled as content errors and return the wrong exit class.
- Keep HTML detection after the status gate so successful `text/html` subscription responses still fail as `subscription_html_response`, while HTML error pages consistently map to `remote_failed` for deterministic `refresh-base --json` output.
