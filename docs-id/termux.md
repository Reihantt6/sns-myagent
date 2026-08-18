# Panduan Instalasi Termux

Jalankan snsagent di Android melalui Termux.

## Prasyarat

| Kebutuhan | Instal | Verifikasi |
|---|---|---|
| **Termux** | [F-Droid](https://f-droid.org/en/packages/com.termux/) atau [GitHub releases](https://github.com/termux/termux-app/releases) | Buka aplikasi |
| **Node.js** | `pkg install nodejs-lts` | `node --version` |
| **Bun** | Opsi source-build di bawah | `bun --version` |
| **Git** | `pkg install git` | `git --version` |

Gunakan rilis Termux F-Droid atau GitHub yang terbaru. Build Play Store yang lama tidak dipelihara.

## Mengapa biner npm / prebuilt tidak berjalan di Android

Postinstall `@sns-myagent/cli` dan `install.sh` sama-sama mengunduh aset prebuilt `snsagent-linux-arm64` yang dikompilasi di runner `ubuntu-latest` GitHub. Artefak itu **terhubung glibc** dan tidak akan dieksekusi di bawah bionic libc Android, jadi `snsagent --version` gagal di Termux.

Installer (`curl ... | bash`) mendeteksi Termux dan melewati jalur prebuilt, beralih ke build dari source. Gunakan jalur source di bawah.

### Perilaku installer di Termux

- **Deteksi**: env var `TERMUX_VERSION`, keberadaan `/data/data/com.termux`, atau `uname -o` = `Android` menetapkan `IS_TERMUX=true`.
- **Jalur**: unduhan prebuilt dilewati sepenuhnya dengan pesan `Termux: prebuilt glibc binary is incompatible with Android - building from source.`
- **Build fallback**: memasang `git curl unzip` via `pkg` (best effort), memasang Bun jika belum ada, lalu `git clone --depth 1` + `bun install` + `bun run build` dan menyalin `bin/snsagent` ke `$INSTALL_DIR` (default `~/.local/bin`, timpa dengan `SNS_INSTALL_DIR=/some/path bash install.sh`).
- **Hasil**: biner source-built yang berfungsi penuh terpasang bahkan saat GitHub API tidak dapat dijangkau.

Jalur clone manual di bawah setara - installer hanya mengotomatiskannya.

## Menjalankan dari source (direkomendasikan)

```bash
pkg install -y nodejs-lts git
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run src/cli/entry.ts --version
```

## Setup pertama kali

Dari repo yang di-clone:

```bash
bun run src/cli/entry.ts
```

Gunakan `/setup` untuk mengonfigurasi provider, atau edit `~/.omp/agent/models.yml`. Untuk endpoint lokal yang kompatibel dengan Ollama, gunakan URL endpoint dan pilih `openai-completions`. Jangan tempatkan key asli di dokumen ini atau file yang di-commit.

## Tips khusus Termux

### Akses storage

```bash
termux-setup-storage
```

### Server SSH

```bash
sshd
# Hubungkan dari laptop dengan: ssh -p 8022 phone-ip-address
```

### Sesi latar belakang

Termux dapat menghentikan proses latar belakang. Untuk alur kerja boot, pasang Termux:Boot dan buat skrip di bawah `~/.termux/boot/` yang memulai perintah yang Anda butuhkan, misalnya:

```bash
mkdir -p ~/.termux/boot
echo 'cd ~/sns-myagent && bun run src/cli/entry.ts telegram start --token YOUR_TOKEN' > ~/.termux/boot/snsagent.sh
chmod +x ~/.termux/boot/snsagent.sh
```

Ganti `YOUR_TOKEN` dengan token bot (jauhkan dari file yang di-commit).

## Pemecahan Masalah

| Masalah | Solusi |
|---------|--------|
| `bun: command not found` | `export PATH="$HOME/.bun/bin:$PATH"` atau mulai ulang Termux |
| `npm install fails` | `pkg install nodejs-lts git` lalu coba lagi |
| `Permission denied` | Jalankan entrypoint source dengan Bun (`bun run src/cli/entry.ts`) |
| `Out of memory` | Gunakan LLM yang dihosting dan hindari inferensi model lokal |
| `Keyboard lacks Esc` | Pasang Hacker's Keyboard, atau gunakan Ctrl+[ sebagai Esc |
| `Termux crashes` | Perbarui Termux dari F-Droid atau GitHub |

## Spesifikasi minimum ponsel

| Komponen | Minimum | Direkomendasikan |
|-----------|---------|------------------|
| **Android** | 7.0+ | 10+ |
| **RAM** | 2 GB bebas | 4 GB+ |
| **Storage** | 500 MB bebas | 2 GB+ |
| **Jaringan** | Diperlukan untuk LLM yang dihosting | WiFi direkomendasikan |
