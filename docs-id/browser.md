# Otomatisasi Browser

## Tujuan

Memungkinkan agen mengendarai browser nyata - navigasi, klik, isi formulir, ekstrak konten, ambil screenshot - untuk situs dan aplikasi web yang butuh lebih dari sekadar fetch.

## Cara kerjanya

- Dibangun di atas Puppeteer (`puppeteer-core` + `@puppeteer/browsers`) dengan skrip stealth (`src/puppeteer/*.txt`) untuk mengurangi deteksi bot.
- `src/tools/browser/` mengelola lifecycle: `launch.ts` (peluncuran chromium), `tab-supervisor.ts` / `tab-worker.ts` (proses worker per-tab), `tab-protocol.ts`, `cmux` (multiplexing koneksi), `aria/` (pohon ARIA untuk akses ala screen-reader), `readable.ts` (ekstraksi konten), `render.ts`.
- Dua mode: **headless** dan **visible**; `/browser` beralih di antara keduanya.

## Konfigurasi

```yaml
browser:
  enabled: true        # sakelar master (key skema browser.enabled)
  headless: true       # true = headless, false = jendela terlihat
  cmux: ...            # opsi multiplexing koneksi
  screenshotDir: ...   # lokasi penyimpanan screenshot
```

## Contoh nyata

```text
> open example.com and screenshot the hero section
> (agen meluncurkan chromium, menavigasi, menangkap docs/screenshots/...)
> /browser            # beralih headless <-> visible
```

## Screenshot

![Toggle mode browser](screenshots/browser.png)

`/browser` melaporkan mode aktif (headless atau visible) di TUI.

## Perilaku kegagalan

- Tanpa instalasi Chromium, peluncuran gagal dengan error yang jelas; tool menampilkannya alih-alih membuat sesi crash.
- Worker tab diawasi - tab yang crash di-restart atau dilaporkan alih-alih mematikan seluruh browser.

## Batasan

- Membutuhkan biner Chromium; peluncuran pertama mungkin perlu `npx puppeteer browsers install chrome`.
- Lebih berat daripada fetch HTTP biasa; gunakan untuk interaksi, bukan scraping massal.
- Helper stealth mengurangi deteksi tetapi tidak dijamin tidak terdeteksi.

## Status pengujian

**PARTIAL** - diimplementasikan (`src/tools/browser/`, ~15 file) dengan toggle mode (`browser.headless`) terverifikasi; belum ada test browser end-to-end yang mengendarai halaman nyata. Bukti: `src/tools/browser/*` + entri registry `browser`.
