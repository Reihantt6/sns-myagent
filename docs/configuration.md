# Configuration Reference

snsagent has three configuration surfaces in this repository:

1. The interactive agent uses `~/.omp/agent/config.yml` and `~/.omp/agent/models.yml`.
2. Existing installs may also have `~/.omp/agent/config.json` with compatibility provider and model values.
3. The small legacy `init`, `setup`, and `config` router uses `.sns-myagent/config.json` in the current project directory.

Most users should use the interactive agent configuration described first.

## Interactive agent configuration

The agent directory is normally `~/.omp/agent`. It can be relocated by the upstream directory environment settings. The agent stores settings in:

| File | Purpose |
|------|---------|
| `~/.omp/agent/config.yml` | Persistent settings such as model roles, memory, tools, and UI preferences |
| `~/.omp/agent/config.json` | Compatibility configuration, including provider and model values on existing installs |
| `~/.omp/agent/models.yml` | Provider and model definitions |
| `~/.omp/agent/agent.db` | SQLite state and migrated settings, managed by the application |

Do not edit `agent.db` while the agent is running.

## Provider and model setup

The quickest path is:

```text
snsagent
/setup
```

For a custom provider, use the BYOK setup flow. A hand-written provider entry in `~/.omp/agent/models.yml` looks like this:

```yaml
providers:
  nine-router:
    baseUrl: http://127.0.0.1:20128/v1
    api: openai-completions
    auth: apiKey
    apiKey: your-local-api-key
    models:
      - id: combo1
        contextWindow: 1000000
        supportsTools: true
```

Supported API types include:

| API type | Typical use |
|----------|-------------|
| `openai-completions` | OpenAI-compatible endpoints, OpenRouter, Ollama, vLLM, and LM Studio |
| `openai-responses` | OpenAI Responses API |
| `anthropic-messages` | Anthropic Claude |
| `google-generative-ai` | Google Gemini |
| `azure-openai-responses` | Azure OpenAI |

The models loader expects a concrete local API key value when the provider requires one. Keep this file private, or use the credential mechanism supported by your provider setup. Do not commit API keys.

## Model roles

Role assignments are stored under `modelRoles` in `config.yml`. For example:

```yaml
modelRoles:
  default: nine-router/combo1
```

The `orchestrate` command resolves the persisted `modelRoles.default` role for its agent runs.

## Settings

The settings schema is defined in `src/config/settings-schema.ts`. Common examples include:

```yaml
modelRoles:
  default: nine-router/combo1
memory:
  backend: mnemopi
mnemopi:
  autoRecall: true
  autoRetain: true
  recallLimit: 8
compaction:
  enabled: true
  thresholdPercent: 80
```

Supported memory backend IDs are `mnemopi`, `hindsight`, `mnemosyne`, `mem0`, `lcm`, `local`, and `off`. The mnemopi database normally lives below the agent directory, under `memories/mnemopi/` or a scoped bank path.

Use `/settings` for interactive settings changes. Use the top-level `snsagent config ...` command when working with the legacy `.sns-myagent/config.json` router. These are separate configuration surfaces.

## Legacy project configuration

The legacy router creates `.sns-myagent/config.json` in the current directory. Its schema is defined in `src/config/schema.ts` and includes `agentName`, `model`, `telegram`, and `memory` fields. The default identity is `sns-myagent`.

Example:

```json
{
  "version": 1,
  "agentName": "sns-myagent",
  "model": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "maxTokens": 4096
  },
  "telegram": {
    "token": "",
    "allowedChatIds": [],
    "pollIntervalMs": 1000
  },
  "memory": {
    "path": "memory.jsonl",
    "maxEntries": 1000,
    "autoSummarize": true,
    "backend": "mnemopi"
  }
}
```

The legacy router supports:

```bash
snsagent init
snsagent setup
snsagent config show
snsagent config get model.provider
snsagent config set model.model gpt-4o
```

## Environment variables

Provider-specific API key variables are supported by the provider configuration. Common examples are:

```bash
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"
```

The Telegram adapter uses:

```bash
export SNS_TELEGRAM_BOT_TOKEN="your-bot-token-here"
export SNS_TELEGRAM_AUTOSTART=0
```

## Conversational configuration

The agent can help edit provider and feature settings through the interactive setup flow. Verify the resulting provider, model, and API key configuration before sending a request.