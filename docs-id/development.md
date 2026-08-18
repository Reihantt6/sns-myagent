# Pengembangan - `node_modules` kustom & mekanisme instalasi

Repo ini menggunakan **`postinstall` kustom** yang berbeda dari `bun install` biasa. Halaman ini mendokumentasikan persis apa yang dilakukannya, cara mereproduksi instalasi dari nol, dan drift dependency saat ini terhadap upstream.

## Runtime

- **Runtime**: Bun `>= 1.3.14` (`engines.bun`).
- **Lockfile**: `bun.lock` (Bun, terlacak) dan `package-lock.json` (npm, terlacak). Tidak ada **`bun.lockb`** - lockfile teks Bun adalah yang dibaca `bun install`.
- **Nama paket**: `@sns-myagent/cli` (v0.3.9). Tidak ada **dependency eksternal `@sns-myagent/*`** - scope itu hanya muncul sebagai identitas paket itu sendiri, dipakai oleh checker versi/update (`src/cli/update-cli.ts`, `src/tui/splash.ts`, `src/main.ts`).

## Pipeline `postinstall`

`scripts.postinstall` di `package.json`:

```sh
node scripts/fetch-binary.mjs && node scripts/apply-pi-natives-patch.js
```

### 1. `scripts/fetch-binary.mjs` - unduh biner prebuilt

- Query `GET https://api.github.com/repos/Reihantt6/sns-myagent/releases/latest`.
- Memilih aset untuk platform/arch saat ini (glibc → `snsagent-linux-{x64,arm64}`, fallback musl, `snsagent-macos-*`, `snsagent-windows-x64.exe`).
- Mengunduhnya ke `bin/` dan menulis shim `bin/snsagent.js` yang me-`spawn` biner platform (shim itulah yang ditunjuk `"bin"` di `package.json`, sehingga `npm install -g @sns-myagent/cli` global menempatkan `snsagent` yang berfungsi di `PATH`).
- **Tidak pernah merusak instalasi**: kegagalan GitHub/network/rate-limit apa pun mencetak peringatan dan keluar 0 (jatuh kembali ke build dari source). Hanya error *internal tak terduga* yang keluar 1.

### 2. `scripts/apply-pi-natives-patch.js` - fallback JS-only

- `@oh-my-pi/pi-natives` mengirim addon native `.node` (`grep`, `pty`, `shell`, clipboard, syntax highlighting, dll.).
- Biner Bun terkompilasi (`bun build --compile`) **tidak** menyematkan addon itu, jadi loader `pi-natives` akan `throw` dan biner akan crash saat startup.
- Patch menulis ulang `throw new Error("Failed to load pi_natives …")` di akhir `node_modules/@oh-my-pi/pi-natives/native/loader-state.js` menjadi kondisional: saat `ctx.isCompiledBinary`, kembalikan stub `Proxy` no-op dan cetak `[pi-natives] JS-only mode: …`; di Node biasa ia tetap throw.
- **Idempoten**: ia mendeteksi penanda yang sudah di-patch (`JS-only mode: native addon unavailable`) dan melewatinya. Cache global Bun me-hard-link paket ke `node_modules`, jadi file yang sudah di-patch dapat menyebar lewat cache saat instal ulang - tidak berbahaya, dan postinstall tetap berjalan ulang dan memverifikasi ulang.

### Direktori `patches/`

`patches/pi-natives-js-only-fallback.patch` adalah patch gaya git asli yang disimpan untuk referensi. Mekanisme **aktif** adalah `scripts/apply-pi-natives-patch.js` (penggantian string, idempoten), yang dijalankan `postinstall`.

## Mereproduksi instalasi dari nol

```sh
rm -rf node_modules          # simpan bun.lock + package-lock.json (pin-nya)
bun install
```

Hasil terukur (bun 1.3.14, linux/x64, terdeteksi musl):

- **Durasi**: ~6 dtk (5.53 dtk resolusi paket; termasuk unduhan biner ~112 MB).
- **Paket**: 288 terinstal (jumlah dedupe Bun; 361 file `package.json` di disk).
- **Output postinstall**:
  ```
  info  target: linux/x64 (musl)
  info  downloading snsagent-linux-x64 (111.93 MB)
  ok    snsagent-linux-x64 ready (111.93 MB) → bin/snsagent.js
  [patch] loader-state.js already fully patched, skipping.
  ```
- **Lockfile tidak berubah** setelah instalasi (`git status` bersih untuk `bun.lock` / `package-lock.json`) - instalasi dapat direproduksi dari pin yang di-commit.
- **Verifikasi pasca-instalasi**: `./bin/snsagent-linux-x64 --version` mencetak `snsagent v0.3.9` (biner rilis), dan `bun run build` memproduksi ulang `bin/snsagent-linux-x64` lokal (117 MB) yang juga bisa start; `bun test src/tbm` (74 test) dan `bunx tsc --noEmit` sama-sama lolos di `node_modules` baru.

## Drift dependency

### `@sns-myagent/*`

| Paket | Lockfile | Upstream (npm terbaru) | Dampak | Tindakan |
|---|---|---|---|---|
| `@sns-myagent/cli` | 0.3.9 (sendiri) | 0.3.9 (repo ini) | tidak ada | n/a - ini paketnya |

### `@oh-my-pi/*`

Semua sebelas paket `@oh-my-pi/*` di-pin lockfile ke **16.1.18**. Upstream `latest` adalah **17.3.5**.

| Paket | Lockfile | Upstream terbaru | Drift |
|---|---|---|---|
| `@oh-my-pi/hashline` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/omp-stats` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/pi-agent-core` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/pi-ai` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/pi-catalog` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/pi-mnemopi` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/pi-natives` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/pi-tui` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/pi-utils` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/pi-wire` | 16.1.18 | 17.3.5 | satu major |
| `@oh-my-pi/snapcompact` | 16.1.18 | 17.3.5 | satu major |

**Catatan**

- `package.json` mendeklarasikan `^16.1.18` untuk semuanya, yang menyelesaikan ke `>=16.1.18 <17.0.0` - jadi instalasi yang mengabaikan lockfile akan melompat ke **16.x** terbaru (16.5.2 saat ini) atau ke 17.x, **bukan** bertahan di 16.1.18. `bun.lock` yang di-commit itulah yang menahan 16.1.18.
- Bump 16.x → 17.x berisiko tinggi: harus memvalidasi ulang patch JS-only `pi-natives` terhadap loader baru dan menjalankan ulang seluruh permukaan test memory/TBM/Telegram.
- Lihat `docs/upstream.md` untuk perbandingan lini yang lebih luas dengan `can1357/oh-my-pi`.

## Menjaga bagian kustom tetap utuh

- Jangan **hapus** `scripts/fetch-binary.mjs`, `scripts/apply-pi-natives-patch.js`, atau `patches/` - itu bagian dari kontrak instalasi.
- Jangan **hapus** skrip `postinstall` dari `package.json`.
- Saat menaikkan `@oh-my-pi/*`, jalankan ulang `node scripts/apply-pi-natives-patch.js` secara manual dan konfirmasi biner masih start (`--version`) sebelum commit.
