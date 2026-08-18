# Telegram

## Tujuan

Jalankan snsagent sebagai bot Telegram: setiap pesan menggerakkan sesi agen nyata (pesan → handler → sesi → agen → model → tool → respons → Telegram). Adapter berada di `src/adapters/telegram/` dan dibangun di atas [grammY](https://grammy.dev/).

## Cara kerjanya

- Bot melakukan polling Telegram saat `SNS_TELEGRAM_BOT_TOKEN` di-set (auto-boot), atau saat dimulai secara eksplisit dengan `snsagent telegram`.
- Setiap chat dipetakan ke sesi agen; teks masuk menjadi turn pengguna, dan balasan agen dikirim kembali melalui bot.
- Sebelas slash command terhubung: `/start /help /chat /reset /status /memory /cron /model /code /review /task`. Upload/download file didukung.

## Konfigurasi

```bash
export SNS_TELEGRAM_BOT_TOKEN="your-bot-token-here"
export SNS_TELEGRAM_ALLOWED_USERS="123456789"   # ID pengguna Telegram numerik Anda
export SNS_TELEGRAM_AUTOSTART=0                 # opsional: nonaktifkan auto-boot
snsagent
```

## Contoh nyata

```text
Anda (Telegram):  file apa yang berubah sejak kemarin?
Bot:              Menjalankan `git diff` … 3 file berubah.
Anda (Telegram):  /status
Bot:              Session: active · model: claude-sonnet · backend: mnemopi
```

## Screenshot

![Status Telegram (disanitasi)](screenshots/telegram.png)

`snsagent telegram status` menampilkan state adapter dan **tanpa** secret: field token tampil sebagai `unset`/`empty`. Screenshot percakapan nyata tidak di-commit karena akan memuat token bot / isi chat yang dikonfigurasi.

## Otorisasi

- Saat `SNS_TELEGRAM_ALLOWED_USERS` di-set, hanya ID pengguna yang terdaftar (dan group chat yang mereka buat) yang dilayani; semua yang lain ditolak **sebelum** agen dikonsultasikan.
- Saat tidak di-set, peringatan di-log dan bot melayani pengirim mana pun.

> **Peringatan**: allowlist bersifat opt-in. Deployment tanpa itu adalah permukaan eksekusi jarak jauh tanpa autentikasi. Jaga `SNS_TELEGRAM_ALLOWED_USERS` tetap ter-set.

Sesi menjalankan tools dengan `autoApprove: true`, jadi allowlist mempersempit *siapa* yang bisa berbicara ke agen, bukan *tindakan apa* yang disetujui otomatis. Tinjau batasnya di [security-model.md](./security-model.md) sebelum mengekspos bot.

## Perilaku kegagalan

- Tanpa token → adapter tidak start (atau `snsagent telegram` error).
- Error jaringan/polling dicoba ulang oleh grammY; kegagalan transien tidak mematikan proses agen.

## Pengujian

```bash
bun test test/telegram-audit.test.ts   # cakupan handler + gerbang auth
bun test test/telegram.test.ts
```

Test suite mencakup jalur pesan → handler → sesi dan gerbang otorisasi `SNS_TELEGRAM_ALLOWED_USERS` (penolakan pengguna tak terdaftar, peringatan saat tidak di-set).
