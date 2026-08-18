# Advisor (Review Model Kedua)

## Tujuan

Model kedua secara pasif me-review setiap turn dan menyuntikkan catatan singkat - pemeriksaan kewarasan murah atas output model aktif tanpa mengubah loop utama.

## Cara kerjanya

- `src/advisor/runtime.ts` mengorkestrasi review; `transcript-recorder.ts` menangkap transkrip turn; `watchdog.ts` membatasi pekerjaan review yang tidak terkendali.
- Model advisor diambil dari model role `advisor`; saat aktif, transkrip setiap turn dikirim ke advisor dan catatannya disuntikkan sebagai pesan follow-up/steering tersembunyi (lihat `src/session/agent-session.ts` onTurnEnd).
- `/advisor [on|off|status|dump [raw]]` mengontrol dan memeriksanya.

## Konfigurasi

```yaml
advisor:
  enabled: true        # sakelar master
  subagents: false     # juga review subagent task/eval yang di-spawn
  syncBacklog: ...     # sinkronkan review yang tertunda
```

## Contoh nyata

```text
> /advisor on
  (setiap turn: model kedua me-review, catatan disuntikkan)
> /advisor status
> /advisor dump
> /advisor off
```

## Perilaku kegagalan

- Kegagalan advisor tidak memutus turn utama - review terjadi setelah turn berakhir; error di-log dan turn tetap berlaku.
- `/advisor status` mencerminkan state runtime aktual; model role advisor yang salah konfigurasi tampil seperti itu.

## Batasan

- Menambah latensi dan panggilan model ekstra per turn (pengganda biaya).
- Review adalah catatan injektif; mereka tidak bisa memveto output model utama.

## Status pengujian

**VERIFIED** - `src/advisor/` dikirim dengan `advisor.test.ts`; test wiring membuktikan jalur review. Bukti: `src/advisor/__tests__/`.
