# Panduan Instalasi

snsagent v0.3.9 tersedia di npm dan rilis GitHub v0.3.9. Panduan ini mencakup semua jalur instalasi yang didukung, dari perintah npm satu baris hingga build dari source.

## Instalasi yang direkomendasikan dengan npm

Membutuhkan Node.js 18 atau lebih baru.

```bash
npm install -g @sns-myagent/cli
snsagent --version
```

Output yang diharapkan:

```text
snsagent 0.3.9
```

Skrip postinstall npm mengunduh biner yang cocok untuk platform Anda dari rilis GitHub terbaru. Jika unduhan tidak tersedia, npm tetap selesai dan Anda dapat mencoba lagi dengan:

```bash
npm rebuild @sns-myagent/cli
```

## Installer satu baris

Di Linux, macOS, WSL, dan lingkungan Termux yang didukung:

```bash
curl -fsSL https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.sh | bash
```

Installer mengunduh aset rilis `snsagent` terbaru jika tersedia, memverifikasinya dengan `snsagent --version`, dan beralih ke build dari source dengan Bun saat dibutuhkan. Installer memasang ke `$INSTALL_DIR` (default `~/.local/bin`, timpa dengan `SNS_INSTALL_DIR=/some/path`), dan mencetak perintah PATH jika shell Anda perlu dimuat ulang. Variabel `GITHUB_TOKEN` didukung untuk lingkungan yang dibatasi rate-limit.

> **Tip**: setelah menggunakan shell installer, muat ulang shell Anda atau jalankan `export PATH="$HOME/.local/bin:$PATH"` agar `snsagent` ada di PATH.

## Windows PowerShell

Membutuhkan Node.js 18 atau lebih baru.

```powershell
irm https://raw.githubusercontent.com/Reihantt6/sns-myagent/main/install.ps1 | iex
```

Skrip ini memasang `@sns-myagent/cli` dengan npm dan memverifikasi `snsagent --version`. Gunakan `-UseBun` jika Anda sudah memiliki Bun dan ingin memakai jalur installer Bun.

## Instalasi dengan Bun

```bash
bun add -g @sns-myagent/cli
snsagent --version
```

Untuk menjalankan sekali tanpa instalasi global, gunakan nama paket:

```bash
bunx @sns-myagent/cli --version
```

## Menjalankan dari source

Membutuhkan Bun 1.3.14 atau lebih baru dan Git.

```bash
git clone https://github.com/Reihantt6/sns-myagent.git
cd sns-myagent
bun install
bun run src/cli/entry.ts --version
```

Build biner Linux x64 standalone:

```bash
bun run build
./bin/snsagent-linux-x64 --version
```

`bun run build` menghasilkan `bin/snsagent-linux-x64` dan menyalinnya ke `bin/snsagent`. Biner hasil build adalah artefak rilis dan tidak diperlukan untuk pengembangan source biasa.

## Menjalankan pertama kali

Mulai agen interaktif:

```bash
snsagent
```

Gunakan `/setup` untuk mengonfigurasi provider, atau konfigurasi provider di `~/.omp/agent/models.yml`. Alur setup menerima Base URL, API key bila diperlukan, tipe API, dan pilihan model.

Langkah pertama dari wizard setup mengumpulkan detail provider (Tab berpindah antar kolom, Enter menghubungkan):

![Wizard setup provider](screenshots/setup-wizard.png)

> Catatan: screenshot menggunakan font cadangan. Di terminal dengan Nerd Font terpasang, status bar dan ikon tampil dengan glyph yang dimaksud.

## Memverifikasi instalasi

```bash
snsagent --version
snsagent --help
```

## Menghapus instalasi

Untuk npm:

```bash
npm uninstall -g @sns-myagent/cli
```

Untuk Bun:

```bash
bun remove -g @sns-myagent/cli
```

Pengaturan runtime dan sesi terpisah dari paket. Lihat [configuration.md](configuration.md) sebelum menghapus `~/.omp/agent` atau `.sns-myagent`.
