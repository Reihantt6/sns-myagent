# Token Budget Manager (TBM)

## Ringkasan

Token Budget Manager (`src/tbm/`) mengelola penggunaan konteks di dalam lifecycle turn agen. Ia terintegrasi ke main agent loop: `createAgentSession` (`src/sdk.ts`) membangun `TbmManager` dari settings dan memberikannya ke `transformContext` agen (pre-model) dan `AgentSession` (`session.tbm`, post-tool / post-turn).

## Wiring lifecycle turn

| Fase | Subsistem | Hook |
|---|---|---|
| pre-model | direktif comm-mode | `transformContext` → `applyTbmPreModel` |
| pre-model | tombstone (pesan teks polos lama) | `transformContext` → `applyTbmPreModel` |
| pre-model | accounting context-delta | `transformContext` → `applyTbmPreModel` |
| pre-model | level pyramid | `transformContext` → `applyTbmPreModel` |
| pre-model | lazy skills | `transformContext` → `applyTbmPreModel` |
| post-tool | kompresi output tool | `Agent.afterToolCall` → `applyTbmToolCompression` |
| post-turn | store response-cache | `Agent.setOnTurnEnd` → `cacheTbmTurnResponse` |

Semua hook berada di `src/tbm/session-hooks.ts` sebagai fungsi murni dari `(TbmManager, messages)` sehingga dapat diuji dengan bentuk `AgentMessage` yang nyata.

## Konfigurasi

Key `tbm.*` dideklarasikan di `src/config/settings-schema.ts` dan dijembatani ke `TbmConfig` oleh `src/tbm/settings-bridge.ts` (`resolveTbmConfigFromSettings`). Set blok `tbm:` di config.yml:

```yaml
tbm:
  enabled: true
  commMode: caveman
  compressTerminal: 500
```

Sakelar master **default-nya OFF**, jadi loop yang ada tidak berubah sampai Anda mengaktifkannya. Saat nonaktif, setiap hook adalah pass-through.

## Penghitungan token

`estimateTokens` di `src/tbm/context-delta.ts` mendelegasikan ke `countTokens` dari `@oh-my-pi/pi-agent-core` - estimator berbasis byte yang sama yang dipakai sesi untuk compaction.

## Yang tidak dilakukan TBM

- **Response cache hanya store-only.** `cacheTbmTurnResponse` merekam pasangan (query → response), tetapi cache hit tidak memotong panggilan model - loop terstruktur belum bisa melewati turn dengan aman di sini.
- **Context delta hanya accounting.** `processTurn` melakukan hash pada split statis/dinamis dan melaporkan token yang dihemat, tetapi tidak pernah menghapus prefix statis dari wire. Provider prompt cache sudah menangani prefix caching nyata; TBM hanya mengukurnya.
- **Tombstone hanya menyentuh pesan `user`/`assistant` teks polos.** Pesan dengan tool call, gambar, atau thinking block dilewati agar pasangan tool-call ↔ tool-result tetap utuh.

## Benchmark harness

`bun scripts/tbm-benchmark.ts` menggerakkan `TbmManager` langsung pada percakapan sintetis 20 turn yang deterministik (tanpa jaringan/model). Token output dan latensi model nyata karenanya tidak diukur di sini.

| Metrik | TBM OFF | TBM ON |
|---|---:|---:|
| token input (konten) | 28,510 | 1,836 |
| token direktif | 0 | 890 |
| total token (input + direktif) | 28,510 | 2,726 |
| panggilan model simulasi (turn) | 20 | 20 |
| cache hit context-delta | 0/20 | 19/20 |
| output tool dikompresi | 0/20 | 20/20 |
| response cache hit | 0/20 | 10/20 |
| pesan di-tombstone | 0 | 700 |
| latensi (hanya panggilan subsistem) | ~1 ms | ~8 ms |

Pengurangan harness terukur: **93.6% lebih sedikit token konten on-wire** di harness sintetis ini, didominasi oleh cache context-delta yang membuang prefix yang sebagian besar statis. Ini pengukuran harness, bukan klaim tentang sesi nyata.

## Pengujian

```bash
bun test src/tbm/__tests__/tbm.test.ts
bun test src/tbm/__tests__/tbm-audit.test.ts
bun test src/tbm/__tests__/tbm-session-integration.test.ts   # hook turn nyata (12 test)
bun test src/tbm/__tests__/tbm-agent-loop.test.ts            # loop pi-agent-core nyata (4 test)
bun scripts/tbm-benchmark.ts
```

`tbm-session-integration.test.ts` menegaskan efek payload yang dapat diamati pada turn nyata: direktif comm-mode disuntikkan, pesan lama diganti tombstone (aslinya tidak masuk ulang verbatim, pesan tool-call dilewati), output tool yang terlalu besar dipotong, dan pasangan query/response turn yang selesai masuk ke response cache. Ia juga membuktikan config `tbm.*` dikonsumsi dan default skema adalah OFF.

`tbm-agent-loop.test.ts` menggerakkan loop `Agent.prompt` pi-agent-core nyata melalui `composeTransformContext` (seam persis yang dipakai `createAgentSession`) dan menegaskan efek TBM dapat diamati di payload model-request yang dirakit. Injeksi lazy-skills juga dicakup di sini - hook pre-model menyuntikkan indeks nama plus konten penuh dari skill yang direferensikan saja.
