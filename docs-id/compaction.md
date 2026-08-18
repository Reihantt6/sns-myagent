# Context Compaction

## Tujuan

Menyusutkan percakapan panjang sebelum meluap melewati jendela konteks model, menjaga ringkasan yang berfungsi alih-alih kehilangan alur.

## Cara kerjanya

- `src/session/` (agent-session + compact-modes) menjalankan compaction pada `compaction.thresholdPercent` / `thresholdTokens` dari jendela, atau manual via `/compact`.
- Tiga mode (`src/session/compact-modes.ts`):
  - `soft` - merangkum lokal dengan model aktif (lewati endpoint remote).
  - `remote` - merangkum via endpoint remote / compaction native provider.
  - `snapcompact` - mengarsipkan riwayat ke gambar bitmap padat yang dibaca kembali model (tanpa panggilan LLM; menolak teks fokus).
- `/compact [mode] [focus...]` - mode yang dikenal di awal diperlakukan sebagai pemilih mode, jika tidak seluruh string argumen adalah instruksi fokus (kompatibel mundur).
- `compaction.strategy` memilih strategi ringkasan (mis. `context-full`) kecuali mode menimpanya.

## Konfigurasi

```yaml
compaction:
  enabled: true             # default skema: true
  strategy: ...             # strategi ringkasan (context-full, ...)
  thresholdPercent: 80      # auto-compact saat konteks mencapai 80%
  thresholdTokens: ...      # atau saat jumlah token mencapai ini
  remoteEnabled: ...        # izinkan compaction sisi provider
  reserveTokens: 16384      # token yang dijaga bebas selama compaction
  keepRecentTokens: 20000   # token terbaru disimpan verbatim
  autoContinue: true        # lanjutkan turn setelah compaction
  handoffSaveToDisk: ...    # simpan riwayat pra-compaction
```

## Contoh nyata

```text
> /compact                        # rangkum lokal, jaga fokus
> /compact soft focus on the TBM integration
> /compact remote                # compaction native provider
> /compact snapcompact           # arsip bitmap, tanpa panggilan LLM
```

## Screenshot

![Panel compaction](screenshots/compact.png)

`/compact` pada sesi kosong menampilkan pesan empty-state ("Nothing to compact").

## Perilaku kegagalan

- Mode yang menuntut jalur remote (`requiresRemote`) tanpa endpoint remote yang di-set memberi peringatan dan jatuh kembali ke ringkasan lokal.
- `snapcompact` dengan teks fokus adalah error (menolak fokus).

## Batasan

- Ringkasan kehilangan detail secara desain; `keepRecentTokens` melindungi bagian ekor.
- Pengukuran waktu/token tidak diukur end-to-end dengan sesi panjang yang nyata.

## Status pengujian

**PARTIAL** - strategi compaction diimplementasikan di `src/session/` dan parsing mode dicakup test parse (logika parse `compact-modes`); belum ada test compaction long-context full-session yang di-commit. Bukti: `src/session/compact-modes.ts` + key skema `compaction.*`.
