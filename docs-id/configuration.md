# Referensi Konfigurasi

snsagent memiliki tiga permukaan konfigurasi:

1. Agen interaktif menggunakan `~/.omp/agent/config.yml` dan `~/.omp/agent/models.yml`.
2. Instalasi yang sudah ada mungkin juga memiliki `~/.omp/agent/config.json` dengan nilai provider dan model kompatibilitas.
3. Router legacy kecil `init`, `setup`, dan `config` menggunakan `.sns-myagent/config.json` di direktori proyek saat ini.

Sebagian besar pengguna sebaiknya menggunakan konfigurasi agen interaktif yang dijelaskan pertama.

## Konfigurasi agen interaktif

Direktori agen normalnya adalah `~/.omp/agent`. Ia dapat dipindahkan oleh pengaturan environment direktori upstream. Agen menyimpan pengaturan di:

| File | Fungsi |
|------|--------|
| `~/.omp/agent/config.yml` | Pengaturan persisten seperti model roles, memory, tools, dan preferensi UI |
| `~/.omp/agent/config.json` | Konfigurasi kompatibilitas, termasuk nilai provider dan model pada instalasi lama |
| `~/.omp/agent/models.yml` | Definisi provider dan model |
| `~/.omp/agent/agent.db` | State SQLite dan pengaturan yang dimigrasi, dikelola aplikasi |

> **Peringatan**: jangan edit `agent.db` saat agen berjalan. Hentikan snsagent dulu, lalu edit atau backup file.

## Setup provider dan model

Jalur tercepat:

```text
snsagent
/setup
```

Untuk provider kustom, gunakan alur setup BYOK. Entri provider yang ditulis manual di `~/.omp/agent/models.yml` terlihat seperti ini:

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

Tipe API yang didukung meliputi:

| Tipe API | Penggunaan umum |
|----------|-----------------|
| `openai-completions` | Endpoint kompatibel OpenAI, OpenRouter, Ollama, vLLM, dan LM Studio |
| `openai-responses` | OpenAI Responses API |
| `anthropic-messages` | Anthropic Claude |
| `google-generative-ai` | Google Gemini |
| `azure-openai-responses` | Azure OpenAI |

Loader model mengharapkan nilai API key lokal yang konkret saat provider membutuhkannya. Jaga file ini tetap privat, atau gunakan mekanisme kredensial yang didukung setup provider Anda.

> **Pitfall**: jangan pernah commit API key ke git. Utamakan environment variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ...) atau file config lokal yang di-gitignore daripada menempelkan key asli ke `models.yml` di repo bersama.

## Model roles

Penugasan role disimpan di bawah `modelRoles` di `config.yml`. Contoh:

```yaml
modelRoles:
  default: nine-router/combo1
```

Perintah `orchestrate` menyelesaikan role `modelRoles.default` yang tersimpan untuk agent run-nya.

## Pengaturan

Skema pengaturan didefinisikan di `src/config/settings-schema.ts`. Contoh umum meliputi:

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

ID backend memory yang didukung adalah `mnemopi`, `hindsight`, `mnemosyne`, `mem0`, `lcm`, `local`, dan `off`. Database mnemopi normalnya berada di bawah direktori agen, di `memories/mnemopi/` atau path bank yang di-scope.

> **Tip**: gunakan `/settings` untuk perubahan pengaturan interaktif. Gunakan perintah `snsagent config ...` hanya saat bekerja dengan router legacy `.sns-myagent/config.json`. Ini adalah permukaan konfigurasi yang terpisah, jadi perubahan di satu tempat tidak berlaku di tempat lain.

## Konfigurasi proyek legacy

Router legacy membuat `.sns-myagent/config.json` di direktori saat ini. Skemanya didefinisikan di `src/config/schema.ts` dan mencakup field `agentName`, `model`, `telegram`, dan `memory`. Identitas default-nya adalah `sns-myagent`.

Contoh:

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

Router legacy mendukung:

```bash
snsagent init
snsagent setup
snsagent config show
snsagent config get model.provider
snsagent config set model.model gpt-4o
```

## Environment variables

Variabel API key khusus provider didukung oleh konfigurasi provider. Contoh umum:

```bash
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"
```

Adapter Telegram menggunakan:

```bash
export SNS_TELEGRAM_BOT_TOKEN="your-bot-token-here"
export SNS_TELEGRAM_AUTOSTART=0
```

## Konfigurasi percakapan

Agen dapat membantu mengedit pengaturan provider dan fitur melalui alur setup interaktif. Verifikasi konfigurasi provider, model, dan API key yang dihasilkan sebelum mengirim request.
