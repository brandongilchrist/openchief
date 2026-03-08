# Multi-Provider LLM Setup for OpenChief

OpenChief now supports multiple LLM providers beyond just Anthropic Claude. This guide explains how to configure and use different providers for your agents.

## Supported Providers

### 1. **Anthropic Claude** (Default)
- **Type:** `anthropic`
- **Auth:** API key or OAuth (OAuth planned)
- **Environment:** Works everywhere (local dev + Cloudflare Workers)
- **Models:** claude-opus-4-6, claude-sonnet-4-6, claude-sonnet-4-5, claude-haiku-4

### 2. **Z.ai GLM**
- **Type:** `glm`
- **Auth:** API key (subscription-based)
- **Environment:** Works everywhere (local dev + Cloudflare Workers)
- **Models:** glm-5, glm-4.7, glm-4.6v
- **URL:** https://api.zai.chat

### 3. **Google Gemini CLI**
- **Type:** `gemini`
- **Auth:** Google subscription (via CLI)
- **Environment:** **Local dev only** (CLI not available in Workers)
- **Models:** gemini-3-pro-preview, gemini-3-flash-preview, gemini-2.5-pro
- **Requires:** `google-gemini-cli` installed locally

### 4. **OpenAI Codex CLI**
- **Type:** `openai-codex`
- **Auth:** OpenAI subscription (via CLI)
- **Environment:** **Local dev only** (CLI not available in Workers)
- **Models:** gpt-5.2-codex-mini, gpt-5.2-codex-full, gpt-5.2
- **Requires:** `openai-codex` CLI installed locally

## Configuration

### Option 1: Environment Variables (Recommended for Cloudflare)

Set these secrets in your Workers:

```bash
# For Anthropic (default)
wrangler secret put ANTHROPIC_API_KEY

# For GLM
wrangler secret put LLM_PROVIDER_TYPE
# Enter: glm

wrangler secret put LLM_PROVIDER_CONFIG
# Enter: {"apiKey":"your-glm-api-key","model":"glm-5"}
```

### Option 2: Config File (For Local Dev)

Edit `openchief.config.ts`:

```typescript
const config: OpenChiefConfig = {
  // ... other config
  
  runtime: {
    defaultModel: "glm-5", // or "claude-sonnet-4-6", "gemini-3-pro-preview"
    reportTimezone: "America/Chicago",
    reportTimeUtcHour: 14,
    
    // LLM Provider configuration
    llmProvider: {
      type: "glm", // or "anthropic", "gemini", "openai-codex"
      config: {
        apiKey: "your-glm-api-key",
        // For Gemini CLI:
        // cliPath: "/usr/local/bin/gemini",
        // For GLM with custom endpoint:
        // baseUrl: "https://api.zai.chat/v1"
      },
    },
  },
};
```

## Provider-Specific Setup

### Anthropic Claude (Default)

**API Key mode:**
```bash
# Get your API key from https://console.anthropic.com/
wrangler secret put ANTHROPIC_API_KEY
```

**OAuth mode** (planned):
```typescript
llmProvider: {
  type: "anthropic",
  config: {
    oauth: {
      clientId: "your-client-id",
      clientSecret: "your-client-secret",
      refreshToken: "your-refresh-token",
    },
  },
}
```

### Z.ai GLM

1. Sign up for Z.ai subscription: https://zai.chat
2. Get your API key from account settings
3. Configure:

```bash
wrangler secret put LLM_PROVIDER_TYPE
# Enter: glm

wrangler secret put LLM_PROVIDER_CONFIG
# Enter: {"apiKey":"your-zai-api-key"}
```

**Available models:**
- `glm-5` - Latest model (recommended)
- `glm-4.7` - Previous generation
- `glm-4.6v` - Vision-capable

### Google Gemini CLI

**⚠️ Local dev only** — CLI providers don't work in Cloudflare Workers.

1. Install google-gemini-cli:
```bash
npm install -g google-gemini-cli
```

2. Authenticate with your Google subscription:
```bash
gemini auth login
```

3. Configure in `openchief.config.ts`:
```typescript
llmProvider: {
  type: "gemini",
  config: {
    cliPath: "gemini", // or "/usr/local/bin/gemini"
  },
}
```

4. Run in local dev mode only:
```bash
pnpm dev
```

### OpenAI Codex CLI

**⚠️ Local dev only** — CLI providers don't work in Cloudflare Workers.

1. Install openai-codex CLI:
```bash
npm install -g openai-codex
```

2. Authenticate:
```bash
codex auth login
```

3. Configure in `openchief.config.ts`:
```typescript
llmProvider: {
  type: "openai-codex",
  config: {
    cliPath: "codex", // or "/usr/local/bin/codex"
  },
}
```

4. Run in local dev mode only:
```bash
pnpm dev
```

## Testing Your Provider

After configuration, test the provider:

```bash
# Local dev
pnpm dev

# Open dashboard and trigger a test report from any agent
# Check the logs for provider name and model used
```

Or test programmatically:

```typescript
import { callLLM } from "./workers/runtime/src/llm-client";

const result = await callLLM(
  env,
  "You are a helpful assistant.",
  [{ role: "user", content: "Say hello" }],
  undefined, // use default model
  100
);

console.log("Provider:", result.provider);
console.log("Model:", result.model);
console.log("Response:", result.text);
```

## Migration from Claude-only

If you're upgrading from the original OpenChief (Claude-only):

1. **No breaking changes** — Anthropic with API key is still the default
2. Your existing `ANTHROPIC_API_KEY` secret will continue to work
3. To switch providers, add `LLM_PROVIDER_TYPE` and `LLM_PROVIDER_CONFIG` secrets
4. The old `claude-client.ts` is replaced by `llm-client.ts` (backwards compatible export)

## Deployment Considerations

### For Cloudflare Workers (Production)

**✅ Supported:**
- Anthropic (API key or OAuth)
- GLM (API key)
- Any HTTP API-based provider

**❌ Not supported:**
- Gemini CLI
- OpenAI Codex CLI
- Any provider requiring local process execution

### For Local Development

**All providers supported** including CLI-based ones.

## Cost Comparison

Based on subscription pricing (March 2026):

| Provider | Plan | Price/month | Context | Output |
|----------|------|-------------|---------|--------|
| Anthropic Pro | Subscription | $20 | 200k | Unlimited |
| OpenAI Codex | Subscription | $20 | 1M | ~100k tokens |
| Google Gemini | Subscription | $20 | 2M | Unlimited |
| Z.ai GLM | Subscription | $10 | 500k | Unlimited |

**Recommendation for OpenChief:**
- **Production (Cloudflare):** Use GLM (cheapest) or Anthropic (best quality)
- **Local dev:** Use Gemini CLI or Codex CLI (can use subscription tokens)

## Troubleshooting

### "Provider type not supported"
- Check that `LLM_PROVIDER_TYPE` matches exactly: "anthropic", "glm", "gemini", or "openai-codex"
- Verify the type is supported in your environment (Workers vs local dev)

### "CLI command not found"
- For CLI providers (Gemini, Codex), ensure the CLI is installed globally
- Check the path with `which gemini` or `which codex`
- Only use CLI providers in local dev mode

### "API key invalid"
- Verify your API key is correct
- For Anthropic: https://console.anthropic.com/
- For GLM: https://zai.chat/account/api-keys

### "LLM_PROVIDER_CONFIG parse error"
- Ensure the JSON is valid
- Use double quotes for keys and values
- Escape special characters

## Architecture

The multi-provider system is built with a provider abstraction:

```
llm-client.ts (entry point)
    ↓
llm-providers/
    ├── base.ts         (abstract LLMProvider class)
    ├── anthropic.ts    (Anthropic implementation)
    ├── glm.ts          (Z.ai GLM implementation)
    ├── gemini.ts       (Google Gemini CLI wrapper)
    ├── openai-codex.ts (OpenAI Codex CLI wrapper)
    └── index.ts        (provider factory)
```

All providers implement the same interface:
- `call(systemPrompt, messages, options)` → `{ text, inputTokens, outputTokens }`
- `validate()` → `boolean`
- `getName()` → `string`
- `getAvailableModels()` → `string[]`

## Adding Custom Providers

To add a new provider:

1. Create `workers/runtime/src/llm-providers/your-provider.ts`
2. Extend `LLMProvider` base class
3. Implement `call()`, `validate()`, `getName()`, `getAvailableModels()`
4. Register in `llm-providers/index.ts`
5. Update `LLMProviderConfig` type in `packages/shared/src/types/config.ts`

Example:

```typescript
import { LLMProvider, type LLMProviderConfig } from "./base";

export class MyCustomProvider extends LLMProvider {
  async call(systemPrompt, messages, options) {
    // Your implementation
    return { text, inputTokens, outputTokens, model, provider: "custom" };
  }
  
  async validate() { /* ... */ }
  getName() { return "My Custom Provider"; }
  async getAvailableModels() { return ["model-1", "model-2"]; }
}
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/brandongilchrist/openchief/issues
- Provider docs: See each provider's official documentation

