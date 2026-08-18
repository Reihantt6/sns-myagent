# Subagent & Delegasi Tugas

## Tujuan

Mendelegasikan pekerjaan ke agen anak yang terspesialisasi sehingga agen utama dapat memparalelkan subtugas independen alih-alih melakukan semuanya dalam satu konteks.

## Cara kerjanya

- Tool `task` (`src/task/index.ts`) men-spawn subagent. Ia menemukan definisi agen dari tiga tempat:
  - agen bundled yang dikirim bersama coding agent,
  - `~/.omp/agent/agents/*.md` (tingkat pengguna),
  - `.omp/agents/*.md` (tingkat proyek).
- Setiap spawn mendapat prompt subagent (`src/prompts/system/subagent-user-prompt.md`) dengan konteks baru; hasil kembali sebagai event JSON terstruktur atau artefak sesi.
- Mendukung: single spawn (paralelisme = banyak panggilan `task`), batch spawning dengan konteks bersama saat `task.batch` aktif, eksekusi latar belakang melalui `AsyncJobManager` saat `async.enabled` aktif, dan event progres.
- Slash command `/task` mengelola sisi **async background** (`/task run <description>`, `/task list`, `/task status <id>`).
- `src/task/parallel.ts` menyediakan helper parallel-fan-out yang dipakai fitur multi-agent; `src/agents/` menambah pola consensus/critic/best-of-N.

## Konfigurasi

```yaml
task:
  batch: false      # izinkan batch spawn + konteks bersama per panggilan
async:
  enabled: true      # eksekusi latar belakang melalui AsyncJobManager
```

## Contoh nyata

```text
> run three file-hunting jobs in parallel - one per directory
> (agen mengeluarkan 3 panggilan task tool; tiap subagent mengembalikan daftar kecocokannya)
> /task run "port the parser to TypeScript"      # background fire-and-forget
> /task list
> /task status <id>
```

## Screenshot

![Subagent / task manager](screenshots/task.png)

Permukaan perintah `/task` di TUI (penggunaan + daftar job async).

## Perilaku yang diharapkan

- Hasil subagent dikirim per-item; pemanggil melihat penggunaan + progres.
- Kedalaman dibatasi: `canSpawnAtDepth` mencegah spawning rekursif tanpa batas.
- Dengan async aktif, `/task` menampilkan job latar belakang live dan statusnya.

## Perilaku kegagalan

- Proses induk yang mati kehilangan state tugas latar belakang di memori kecuali task runner menyimpannya (ada modul `persisted-revive.ts` untuk kebangkitan).
- Batas spawn (`canSpawnAtDepth`) menolak nesting yang lebih dalam dengan error.

## Batasan

- Isolasi subagent bersifat logis (konteks baru), bukan tingkat OS kecuali backend isolasi PAL dikonfigurasi (`subagent.isolation: auto` → CoW/overlayfs).

## Status pengujian

**PARTIAL** - diimplementasikan (`src/task/`, `src/agents/`) dengan unit test pada bagian-bagiannya (helper executor, discovery, logika revive); belum ada test pipeline penuh yang men-spawn turn subagent nyata dan menegaskan round-trip. Bukti: `src/task/*`, `src/agents/*`, test task-runner async (`src/async/__tests__/task-runner.test.ts`).
