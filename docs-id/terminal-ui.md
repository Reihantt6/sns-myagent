# Desain Terminal UI - snsagent

> Pengalaman terminal ber-brand khusus untuk SNS-MyAgent.

## Status

Ini adalah panduan desain dan perilaku untuk pengalaman terminal snsagent saat ini. Warna dan layout yang tepat dapat berubah mengikuti tema aktif.

## Identitas visual

Identitas yang tampil ke pengguna adalah `snsagent`. Implementasi di bawahnya menggunakan paket dari lini Pi Agent dan oh-my-pi, tetapi nama paket tersebut bukan identitas produk.

## Tipografi

```text
snsagent v0.3.9
  model       nine-router/combo1
  dir         /path/to/project

  chat to configure - /help for commands
```

## Startup dan chat

Splash startup menggunakan logo SNS, aksen oranye, versi, model, direktori, platform, dan hint shortcut singkat. Prompt interaktif menggunakan identitas snsagent dan model aktif. `/help` adalah shortcut TUI untuk daftar shortcut.

![UI chat utama](screenshots/main-tui.png)

Status bar menampilkan model aktif, direktori kerja, git branch, dan penggunaan konteks. Ikon glyph di status bar membutuhkan Nerd Font; terminal tanpa itu menampilkan kotak fallback.

Titik masuk interaktif yang berguna meliputi:

```text
/help
/setup
/model
/settings
```

## Prinsip UI

- Jaga tampilan startup tetap ringkas.
- Buat output tool mudah dibaca dan dipindai.
- Gunakan status line untuk model, konteks, token, dan state sesi.
- Jaga peringatan tetap actionable.
- Hormati lebar terminal dan output non-interaktif.
- Hindari menampilkan nama paket upstream sebagai nama produk.

## Mode layout

### Terminal interaktif

TUI interaktif merender komponen welcome, editor, pesan asisten, hasil tool, dan status line.

### Output ringkas atau piped

- Kurangi atau hilangkan warna saat output bukan TTY.
- Hindari spinner di CI.
- Utamakan teks polos daripada JSON mentah untuk output manusia.

### Telegram

Mode Telegram tidak menggunakan terminal UI. Ia mengirim teks terformat dan lampiran file melalui adapter Telegram.

## Inspirasi

Proyek ini mengambil ide interaksi yang berguna dari Vercel CLI, Linear CLI, Claude Code, Warp, dan tool terminal lainnya. Ini referensi desain, bukan dependency runtime atau identitas produk.

## Anti-pattern

- Teks pelangi di mana-mana.
- ASCII art raksasa.
- Pesan loading generik tanpa konteks.
- JSON mentah untuk output manusia.
- Stack trace penuh di error yang tampil ke pengguna.
- Teks berkedip atau animasi mengganggu.
- Lebih dari tiga warna aktif.
- Progress bar tanpa label atau konteks.
