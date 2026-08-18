# Pemecahan Masalah

## Periksa versi yang terpasang

```bash
snsagent --version
snsagent --help
```

Versi yang diharapkan untuk rilis ini:

```text
snsagent 0.3.9
```

## Biner terkompilasi menampilkan TUI kosong / "JS-only mode"

Biner terkompilasi (`./bin/snsagent-linux-x64`, dan biner yang diinstal npm) mencetak:

```text
[pi-natives] JS-only mode: native addon unavailable for linux-x64 (modern)
[pi-natives] Native features (grep, pty, shell, clipboard, syntax highlighting, etc.) are disabled.
```

dan TUI interaktif tidak tampil. Bundle terkompilasi tidak menyematkan addon native `.node`, jadi fitur terminal native nonaktif.

> **Catatan**: ini batasan yang diketahui dari biner terkompilasi, bukan crash. Biner yang diinstal npm berperilaku sama karena bundle tidak menyematkan addon native.

Solusi: jalankan dari source dengan Bun, yang memuat addon native secara normal:

```bash
bun install
bun run src/cli/entry.ts
```

## `command not found: snsagent`

Periksa apakah paket terinstal secara global:

```bash
npm ls -g --depth=0
command -v snsagent
```

Instal dengan:

```bash
npm install -g @sns-myagent/cli
```

> **Tip**: jika Anda menggunakan shell installer, muat ulang shell (atau jalankan `export PATH="$HOME/.local/bin:$PATH"`) agar `~/.local/bin` ada di PATH.

## Error provider atau model

Jalankan `/setup` di agen interaktif, lalu verifikasi Base URL, tipe API, ID model, dan kredensial. Untuk setup manual, periksa `~/.omp/agent/models.yml` tanpa mencetak nilai rahasia.

## Tidak ada model yang dipilih

Periksa definisi provider dan penugasan role:

```text
/model
```

Jika orkestrasi terlibat, verifikasi `modelRoles.default` di `~/.omp/agent/config.yml`.

## Permission denied untuk biner hasil build source

Hanya untuk biner yang dibangun dari source:

```bash
chmod +x bin/snsagent-linux-x64
./bin/snsagent-linux-x64 --version
```

## Bun tidak ada

Bun diperlukan untuk eksekusi source dan build, tetapi tidak untuk instalasi npm normal. Instal Bun saat menggunakan mode source:

```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

## Database memory terkunci

> **Peringatan**: hentikan snsagent sebelum menyalin atau memperbaiki state SQLite, dan jangan hapus file journal saat proses lain berjalan. Periksa proses aktif dulu:

```bash
pgrep -af snsagent
```

Agen interaktif menyimpan state di bawah `~/.omp/agent`. Database mnemopi berada di bawah pohon `memories/` direktori tersebut.

## Telegram tidak merespons

Periksa status adapter dan sumber token:

```bash
snsagent telegram status
```

Untuk service, verifikasi `SNS_TELEGRAM_BOT_TOKEN` di `/etc/snsagent/secrets.env` dan periksa:

```bash
sudo systemctl status snsagent
journalctl -u snsagent -e
```

## Masalah build

```bash
bun install
bun run check
bun run build
```

Jika dependency native opsional gagal saat instalasi, coba lagi dengan versi Bun yang didukung repository dan periksa error modul native pertama sebelum menghapus file.

## Masih buntu?

Buka issue di https://github.com/Reihantt6/sns-myagent/issues dengan perintah persis, output, sistem operasi, versi Node atau Bun, dan ringkasan konfigurasi yang di-redaksi.
