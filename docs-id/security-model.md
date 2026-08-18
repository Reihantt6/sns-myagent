# Model Keamanan

Halaman ini menjelaskan bagaimana snsagent melindungi mesin Anda saat menjalankan tools atas nama Anda.

## Bagaimana eksekusi tool dijaga

Agen menjalankan tools (bash, edit/write, browser, ssh, MCP, dan lainnya) di balik kebijakan persetujuan:

- **Mode default adalah `always-ask`.** Tool read-only disetujui otomatis; tool write dan exec meminta konfirmasi sebelum dijalankan.
- **Auto-approve ("yolo") bersifat opt-in.** Aktifkan secara eksplisit dengan `--approval-mode yolo` / `--yolo` atau `tools.approvalMode: yolo` di config. Subagent berjalan headless di belakang batas persetujuan parent-task.
- **Adapter Telegram** juga mematuhi gerbang allowlist (lihat di bawah).

Memory di-scope per-proyek (`mnemopi.scoping`), jadi memori tiap proyek tetap terisolasi. Tidak ada secret yang di-commit ke repository (`.env*` dan `.sns-myagent/` di-gitignore).

## Fitur keamanan per permukaan

| Permukaan | Perlindungan |
|---|---|
| **Kebijakan persetujuan** | Tool read-only disetujui otomatis; tool write/exec meminta konfirmasi. Default `always-ask`, yolo opt-in |
| **bash** | Kebijakan persetujuan + `clampTimeout` |
| **eval (py/js/jl/rb)** | Allowlist environment per-runtime |
| **write/edit** | Kebijakan persetujuan + guard path-escape di `src/tools/write.ts` |
| **read** | Kebijakan persetujuan + `resolveReadPath` menolak escape `../` relatif |
| **ssh** | Persetujuan + direktori ssh-control |
| **browser (puppeteer)** | Direktori sandbox `~/.omp/puppeteer` |
| **Telegram** | Allowlist numerik opt-in `SNS_TELEGRAM_ALLOWED_USERS` |
| **MCP** | Server yang dikonfigurasi pengguna; instruksi server ditandai belum terverifikasi |
| **plugins** | `~/.omp/plugins` + npm install; kepercayaan supply-chain ada di pengguna |
| **cron** | Job persisten via settings |
| **goals** | Budget token `src/goals/runtime.ts` |
| **subagents** | Budget `src/task/executor.ts` + spawn allowlist |
| **secrets** | AuthStorage / resolver api-key; tidak pernah di-log |
| **memory** | Scoping per-proyek |
| **GitHub** | Read-only via gh CLI / cache |

## Otorisasi Telegram

Bridge Telegram adalah permukaan yang terlihat jaringan. Agar aman:

1. Set `SNS_TELEGRAM_ALLOWED_USERS` ke ID pengguna Telegram numerik Anda.
2. Hanya ID pengguna yang terdaftar (dan group chat yang mereka buat) yang dilayani; semua yang lain ditolak sebelum agen dikonsultasikan.
3. Saat tidak di-set, peringatan di-log dan bot melayani pengirim mana pun.

> **Peringatan**: jaga `SNS_TELEGRAM_ALLOWED_USERS` tetap ter-set. Deployment tanpa itu adalah permukaan eksekusi jarak jauh tanpa autentikasi.

Sesi Telegram menjalankan tools dengan `autoApprove: true`, jadi allowlist mempersempit *siapa* yang bisa berbicara ke agen, bukan *tindakan apa* yang disetujui. Tinjau batas ini sebelum mengekspos bot di jaringan bersama.

## Penanganan secret

- API key dan token tidak pernah di-log. Situs log untuk token dan key mencetak status atau path, tidak pernah nilainya.
- Simpan key di environment variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ...) atau config lokal yang di-gitignore. Jangan pernah commit key asli.

## Observabilitas

Panggilan `logger.debug/warn` terstruktur tersebar di `src/`, termasuk log gerbang auth (`userId`, `chatId`) untuk bridge Telegram.

## Path file yang penting

| Perhatian | Tempat melihat |
|---|---|
| Guard path read/write | `src/tools/write.ts`, `src/tools/read.ts` |
| Kebijakan persetujuan | `src/config/settings-schema.ts` (`tools.approvalMode`) |
| Allowlist Telegram | `src/adapters/telegram/handler.ts` |
| Budget subagent | `src/task/executor.ts` |
| Budget token goal | `src/goals/runtime.ts` |
