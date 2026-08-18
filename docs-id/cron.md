# Cron Scheduler

## Tujuan

Menjalankan aksi agen sesuai jadwal - prompt, perintah shell, atau skill - dari scheduler persisten berbasis SQLite di dalam proses agen.

## Cara kerjanya

- `CronScheduler` (`src/cron/cron-scheduler.ts`) berdetak setiap 60 detik (`intervalMs` dapat dikonfigurasi) dan menjalankan job yang jatuh tempo.
- Ekspresi cron adalah 5-field standar (menit jam hari-bulan bulan hari-minggu); `src/cron/cron-parser.ts` menyediakan `parseCronExpression`, `cronMatches`, `getNextCronRun`, `describeCron`.
- Job tersimpan di SQLite via `CronStore` (`cron-store.ts`).
- Tipe aksi: `prompt` (memberi prompt ke agen), `shell` (menjalankan perintah), `skill` (memanggil skill berdasarkan nama).

## Konfigurasi

```bash
/cron list                   # Daftar semua job
/cron add <name> <expr> <type> <action>   # tipe: prompt | shell | skill
/cron remove <id>
/cron run <id>               # Jalankan job segera
/cron enable | disable       # Toggle scheduler atau job
```

## Contoh nyata

```text
> /cron add daily-backup "0 2 * * *" shell "git push --tags"
> /cron list
> /cron run daily-backup
```

## Screenshot

![Job cron](screenshots/cron.png)

`/cron list` setelah menambah job (`nightly-backup`, `0 2 * * *`, aksi shell).

## Perilaku kegagalan

- Tick yang melempar error mencatat `Cron tick error:` dan scheduler tetap berjalan di interval berikutnya (lihat penanganan error `cron-scheduler.ts`).
- Job yang aksinya gagal dicatat dengan timestamp last-run-nya; scheduler tidak membuat proses crash.

## Batasan

- Scheduler berjalan hanya di dalam proses agen - jika agen tidak berjalan, job cron tidak menyala.
- Granularitas interval adalah 60 detik; jadwal sub-menit tidak didukung.

## Status pengujian

**PARTIAL** - `cron-parser` punya unit test; scheduler + store belum punya test end-to-end yang terkonfirmasi. Bukti: `src/cron/__tests__/` + `src/cron/*`.
