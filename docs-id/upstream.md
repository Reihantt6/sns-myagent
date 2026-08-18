# Lini Upstream & Drift Dependency

## Lini

SNS-MyAgent (`@sns-myagent/cli`, v0.3.9) adalah kustomisasi dari [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi) ("omp"). Ia bergantung pada paket upstream `@oh-my-pi/*` dan melapisi CLI kustom, adapter Telegram, modul token-budget `src/tbm/`, dan abstraksi memory-backend yang diperluas di atasnya.

| Dimensi | Status SNS | Catatan |
|---|---|---|
| agent loop | diadaptasi | bergantung pada `@oh-my-pi/pi-agent-core` + `pi-ai` |
| eksekusi tool | diadaptasi | kebijakan persetujuan diwarisi; bridge Telegram memakai `autoApprove: true` |
| persetujuan/keamanan | diadaptasi | lihat `docs/security-model.md` |
| penanganan konteks / compaction | diadaptasi | compaction berada di `agent-session.ts` |
| memory | diperluas | abstraksi backend mnemopi/hindsight/mem0/lcm/mnemosyne/local/off |
| subagents | diadaptasi | `src/task/`, `src/agents/` |
| dukungan provider | diwarisi | `@oh-my-pi/pi-catalog` / `pi-ai` |
| MCP | diadaptasi | `src/mcp/` |
| browser | diwarisi/diadaptasi | sandbox puppeteer `~/.omp/puppeteer` |
| LSP/DAP | diwarisi | `@oh-my-pi/*` + `src/lsp`, `src/dap` |
| Telegram | **khusus SNS** | tidak ada padanan upstream (issue #436 meminta remote control) |
| TUI | diwarisi | `@oh-my-pi/pi-tui` + `src/tui` |
| persistensi sesi | diadaptasi | `src/session/` |

Telegram adalah permukaan khusus SNS yang paling jelas: upstream oh-my-pi punya permintaan terbuka untuk remote control (#436) alih-alih adapter yang dikirim.

## Drift dependency

| Paket | SNS (lockfile) | Upstream terbaru | Status |
|---|---|---|---|
| `@oh-my-pi/pi-agent-core` | 16.1.18 | 17.3.5 | tertinggal (major) |
| `@oh-my-pi/pi-ai` | 16.1.18 | 17.3.5 | tertinggal (major) |
| `@oh-my-pi/pi-mnemopi` | 16.1.18 | 17.3.5 | tertinggal (major) |
| `@oh-my-pi/pi-natives` | 16.1.18 | 17.3.5 | tertinggal (major) |
| `@oh-my-pi/pi-tui` | 16.1.18 | 17.3.5 | tertinggal (major) |
| `@oh-my-pi/pi-catalog`, `pi-utils`, `pi-wire`, `hashline`, `omp-stats`, `snapcompact` | 16.1.18 | 17.3.5 | tertinggal (major) |
| dependency scoped `@sns-myagent/*` | tidak ada | - | proyek itu sendiri adalah `@sns-myagent/cli`; tidak ada scoped dep |

`package.json` mendeklarasikan `^16.1.18` untuk setiap paket `@oh-my-pi/*`, yang sengaja dibatasi di bawah v17. Upgrade ke lini v17 adalah perubahan **major** dan tidak boleh di-merge membabi buta: ia akan menyentuh agent core, stack embeddings mnemopi, dan loader compiled-native yang di-patch SNS (lihat di bawah).

## Postinstall kustom

`postinstall` di `package.json` menjalankan dua langkah:

1. `scripts/fetch-binary.mjs` - mengunduh biner prebuilt `snsagent-<platform>` (~112 MB) dari rilis GitHub terbaru `Reihantt6/sns-myagent` ke `bin/`, dengan fallback musl di Linux. Kegagalan non-fatal (memperingatkan dan keluar 0) sehingga `npm install` tidak pernah rusak.
2. `scripts/apply-pi-natives-patch.js` - menerapkan `patches/pi-natives-js-only-fallback.patch` ke `@oh-my-pi/pi-natives/native/loader-state.js`, mengubah `throw` tanpa syarat menjadi re-throw bersyarat sehingga biner Bun terkompilasi (tanpa addon native tertanam) mulai dalam mode JS-only alih-alih crash. Idempoten.

## Rekomendasi backport

| Perubahan upstream | Status SNS | Dampak | Tindakan |
|---|---|---|---|
| lini paket v17.x (17.3.5) | tertinggal (16.1.18) | tinggi | evaluasi setelah compat spike; jangan blind-merge |
| remote-control / Telegram (#436) | SNS punya adapter sendiri | rendah | abaikan upstream (SNS sengaja divergen) |
| memory hindsight | ada (diadaptasi) | rendah | pantau |
| embeddings mnemopi | ada (diadaptasi + natives yang di-patch) | sedang | validasi ulang patch terhadap v17 sebelum upgrade |
