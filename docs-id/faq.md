# Pertanyaan yang Sering Diajukan

## Umum

### Apa itu snsagent?

snsagent adalah CLI agen coding BYOK untuk satu pengguna. Ia mendukung banyak provider LLM, tools, backend memory, server MCP, Telegram, dan alur kerja terminal.

### Apa bedanya dengan CLI agen lain?

snsagent dirancang untuk setup percakapan dan kerja terminal pengguna tunggal. Anda dapat mengonfigurasi provider melalui `/setup` atau mengedit file provider lokal secara langsung.

### Bisakah saya menggunakannya tanpa API key yang dihosting?

Ya, jika Anda memiliki endpoint lokal atau no-auth yang kompatibel dengan OpenAI seperti Ollama. Konfigurasi endpoint tersebut di `/setup` atau `~/.omp/agent/models.yml`.

> **Tip**: mulai dengan endpoint lokal (misalnya Ollama di `http://127.0.0.1:11434/v1`) untuk mengevaluasi snsagent tanpa API key apa pun.

## Instalasi

### Apa saja persyaratan minimumnya?

- Node.js 18 atau lebih baru untuk paket npm
- Bun 1.3.14 atau lebih baru untuk build dari source
- Git untuk build dari source
- Koneksi jaringan untuk provider LLM yang dihosting

### Apakah saya perlu Bun untuk menginstal paket yang dipublikasikan?

Tidak. Jalur normalnya adalah:

```bash
npm install -g @sns-myagent/cli
snsagent --version
```

Bun diperlukan untuk `bun run build`, eksekusi source, dan jalur package manager Bun.

### Bisakah saya menjalankannya di Windows?

Ya. Gunakan installer PowerShell atau npm. WSL juga didukung oleh shell installer.

## Penggunaan

### Perintah apa yang memulai agen?

```bash
snsagent
```

Gunakan `snsagent --help` untuk perintah CLI tingkat atas. Di TUI interaktif, `/help` membuka daftar shortcut dan command palette menyediakan penemuan slash-command.

### Bagaimana cara mengonfigurasi provider?

Jalankan:

```text
/setup
```

Alur setup menerima Base URL, API key bila diperlukan, tipe API, dan model. Anda juga dapat mengedit `~/.omp/agent/models.yml`.

### Di mana data saya disimpan?

Agen interaktif normalnya menggunakan `~/.omp/agent` untuk `config.yml`, `models.yml`, sesi, state memory, dan SQLite `agent.db`. Router legacy dapat membuat `.sns-myagent/config.json` di proyek saat ini.

### Bisakah saya menambah skill sendiri?

Ya. Skill ditemukan melalui sistem capability dan extensibility. Lihat dokumentasi skill di repository dan gunakan direktori skills yang dikonfigurasi untuk instalasi Anda.

### Bagaimana cara mengganti model?

Gunakan `/model` atau `/switch` di agen interaktif. Untuk menetapkan role orkestrasi, set `modelRoles.default` di `~/.omp/agent/config.yml`.

### Bisakah saya memakai banyak provider sekaligus?

Sebuah sesi punya satu model aktif dalam satu waktu, tetapi definisi provider dan model dapat memuat banyak provider. Gunakan `/model` atau `/switch` untuk mengganti model aktif.

### Apakah mendukung respons streaming?

Ya. Agen interaktif melakukan streaming respons provider saat didukung oleh model dan API yang dipilih.

### Backend memory mana yang harus saya pakai?

- **mnemopi**: memory lokal berbasis SQLite dengan embeddings dan fitur graph.
- **local**: memory ringkasan rollout lokal.
- **off**: nonaktifkan memory.
- **hindsight**: layanan memory remote.
- **mnemosyne**, **mem0**, dan **lcm**: integrasi backend yang tersedia dengan kebutuhan runtime atau layanan masing-masing.

> **Tip**: `mnemopi` adalah backend lokal yang terintegrasi penuh. Ia bertahan saat proses restart dan mengembalikan fakta yang diingat ke konteks model secara otomatis. Pilih `off` jika Anda tidak ingin subsistem memory sama sekali (default skema).

## TBM

### Apa itu TBM?

Token Budget Manager (`src/tbm/`) mengelola accounting context-delta, context pyramid, lazy skills, kompresi output tool, mode komunikasi, tombstoning, dan response caching. Ia terintegrasi ke main agent loop: `createAgentSession` menghubungkannya ke `transformContext` pre-model, kompresi post-tool, dan response cache post-turn melalui `src/tbm/session-hooks.ts`. Sakelar master default-nya **OFF**, jadi sesi yang ada tidak berubah sampai Anda mengaktifkannya dengan `tbm.enabled: true`.

Lihat [tbm.md](tbm.md) untuk wiring, batasan, dan test suite.

## Memory

### Bisakah saya mem-backup memory?

Identifikasi dulu backend aktif dan path database di `~/.omp/agent/config.yml`. Untuk mnemopi, backup database SQLite yang relevan saat agen berhenti.

### Bisakah saya mengekspor memory?

Perintah ekspor dan pemeliharaan yang tersedia bergantung pada backend yang dipilih. Gunakan `/memory` dan `/memory stats` untuk memeriksa backend aktif.

## Keamanan

### Apakah data saya dikirim ke mana pun?

Konfigurasi lokal, sesi, dan memory tetap di mesin lokal kecuali Anda secara eksplisit mengonfigurasi layanan remote atau membagikan sesi. Prompt dan data tool dikirim ke provider LLM yang dipilih sesuai kebutuhan request.

### Apakah API key aman?

Simpan key di environment variable atau konfigurasi lokal yang dikecualikan oleh `.gitignore`. Jangan pernah menempel key asli ke dokumentasi atau file source yang di-commit.

### Bisakah seseorang mengakses agen saya?

CLI interaktif adalah single-user dan lokal. Lindungi mesin, direktori agen, kredensial provider, token Telegram, dan konfigurasi layanan apa pun.

> **Peringatan**: bridge Telegram dan sesi collab adalah permukaan yang terlihat jaringan. Jaga `SNS_TELEGRAM_ALLOWED_USERS` tetap ter-set, dan tinjau model keamanan sebelum mengekspos layanan apa pun di jaringan bersama.
