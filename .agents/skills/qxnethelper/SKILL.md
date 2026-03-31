# qxnethelper Skill

A thin skill wrapper that maps Chinese natural-language triggers to the `qxnethelper` CLI.

## Purpose

This skill provides a declarative interface for the qxnethelper CLI tool. It parses supported Chinese prompts, extracts arguments, and invokes the CLI with exact flags. All business logic (YAML mutation, Feishu API calls, proxy normalization) lives in the CLI, not here.

## Supported Triggers

### 1. Initialize (`qxnethelper init`)

**Trigger patterns:**
- "初始化 qxnethelper"
- "设置 qxnethelper 配置"
- "配置 Feishu"

**Required fields:**
- `appId` / `app-id`: Feishu application ID
- `appSecret` / `app-secret`: Feishu application secret
- `configDir` / `config-dir`: Feishu folder URL or folder token
- `subLink` / `sub-link`: Clash/Mihomo subscription URL

**Example:**
```
初始化 qxnethelper，app-id 是 cli_app_123，app-secret 是 secret_123，
config-dir 是 https://feishu.cn/drive/folder/fldcnTestFolder123，
sub-link 是 https://example.test/subscription.yaml
```

**CLI mapping:**
```
qxnethelper init --app-id <appId> --app-secret <appSecret> --config-dir <configDir> --sub-link <subLink> [--json]
```

### 2. Update Environment (`qxnethelper update-env`)

**Trigger patterns:**
- "更新网络配置"
- "添加网络配置"
- "更新或者添加网络配置"
- "更新环境配置"

**Required fields:**
- `env-id`: Environment identifier (digits only, e.g., "95830")
- `region`: Region name (e.g., "美国", "德国", "日本")
- `IP地址` / `ip`: IPv4 address (e.g., "192.89.1.42")
- `vless://` or `vmess://` node URL

**Example (canonical):**
```
更新或者添加网络配置：95830，美国，IP地址：192.89.1.42，vless://d7baecff-1956-46ce-c89c-bd81098d7223@zdegeuy2.bia3.top:21375?encryption=none&flow=xtls-rprx-vision&security=reality&sni=ndl.certainteed.com&fp=chrome&pbk=W9BjX6YmCIVsjhKMlz233Yoe0xcf0SVHfvPKqbf3vCg&type=tcp&headerType=none#A8320-德国-sing1
```

**CLI mapping:**
```
qxnethelper update-env --env-id <envId> --region <region> --ip <ip> --node-url <nodeUrl> [--json]
```

**Note:** The proxy node name is derived from the last three digits of `env-id`.

### 3. Refresh Base Configuration (`qxnethelper refresh-base`)

**Trigger patterns:**
- "更新基础网络配置"
- "刷新基础配置"
- "刷新订阅配置"

**Example:**
```
更新基础网络配置
```

**CLI mapping:**
```
qxnethelper refresh-base [--json]
```

## Unsupported Triggers

The skill returns `unsupported_trigger` for:
- Prompts missing required fields (env-id, region, IP, node URL)
- Prompts with unsupported proxy schemes (not vless:// or vmess://)
- Ambiguous or incomplete configuration requests
- Requests for unsupported operations (delete, list, query status)

## Error Handling

- **Exit code 0**: Success
- **Exit code 2**: Validation failure (missing/invalid arguments)
- **Exit code 3**: Remote failure (Feishu API, network)
- **Exit code 4**: YAML/mutation precondition failure

When the skill detects an unsupported trigger, it returns:
```json
{
  "ok": false,
  "error": "unsupported_trigger",
  "message": "The prompt does not match any supported trigger pattern"
}
```

## Security

- Secrets (`app-secret`) are never logged or returned in output
- The skill never embeds credentials
- All sensitive operations are delegated to the CLI

## Dependencies

- `qxnethelper` CLI must be built and available at `dist/cli.js`
- Node.js runtime environment
