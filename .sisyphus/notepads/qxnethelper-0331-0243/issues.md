# Issues

## Task F2: Code Quality Review

- `src/subscription/fetch.ts:42` throws a generic `Error` for non-2xx subscription responses, but `src/commands/refreshBase.ts:143` only maps `TypeError` and `SubscriptionSourceError`; a 4xx/5xx subscription failure will escape as an uncaught exception instead of a stable CLI error/exit code.
- `src/feishu/driveClient.ts:160` assumes every Drive JSON endpoint returns valid JSON; invalid/non-JSON bodies raise `SyntaxError`, get retried as unknown errors, and ultimately bypass `FeishuRemoteError` mapping.
- `src/workflows/refreshBase.ts:117` validates listener proxy references after tail replacement, but it does not validate proxy-group member references; replacing the tail can leave `proxy-groups[].proxies[]` pointing at removed proxies with no guardrail or test.
- `src/feishu/driveClient.ts:113` trusts `has_more` without requiring `next_page_token`; a malformed Feishu response can loop forever on the first page.

## Task F1: Plan Compliance Audit (rerun)

- `src/subscription/fetch.ts:52` classifies HTML before checking `response.ok`; a non-2xx HTML error page becomes `subscription_html_response` and exits 4 via `src/commands/refreshBase.ts:153`, but the plan's refreshed contract requires all non-2xx subscription responses to exit 3.
