# Sistem Memory

## Tujuan

snsagent menyimpan apa yang dipelajarinya lintas sesi dan menyuntikkan kembali memori yang relevan ke konteks model pada turn baru. Ada tujuh ID backend, diselesaikan oleh `src/memory-backend/resolve.ts`: `mnemopi`, `hindsight`, `mnemosyne`, `mem0`, `lcm`, `local`, dan `off`.

> **Penting**: hanya `mnemopi` dan `hindsight` yang terhubung ke recall/injeksi otomatis. Backend lain menyimpan dan me-recall secara manual tetapi tidak pernah mengembalikan memori ke konteks model secara otomatis.

## Cara kerjanya

- Backend dipilih oleh pengaturan `memory.backend`. Default skema adalah **`off`** (tanpa subsistem memory), bukan `mnemopi`.
- `mnemopi` (backend lokal yang terintegrasi penuh) menyimpan memori di SQLite di bawah direktori agen dan menyuntikkan fakta yang diingat ke turn pertama sesi melalui `agent-session.ts` (`beforeAgentStartPrompt` → `agent.setSystemPrompt`).
- `autoRetain` menyimpan fakta yang dipelajari secara berkala; `autoRecall` menyuntikkannya kembali di sesi baru; `injectionTokenLimit` membatasi seberapa banyak memori yang diingat masuk ke payload.
- Jalur penuh - `input pengguna → retain → penyimpanan persisten → proses baru → recall → injeksi konteks → model` - dibuktikan oleh `src/memory-backend/__tests__/memory-integration.test.ts` (30 test).

## Backend

| Backend | Penyimpanan | Auto-recall / auto-retain | Status |
|---------|-------------|---------------------------|--------|
| `mnemopi` | SQLite lokal + embeddings + graph | Disuntikkan di turn pertama + auto-retain | VERIFIED |
| `hindsight` | Layanan remote (`hindsight.apiUrl`, default `http://localhost:8888`) | Disuntikkan (saat layanan dikonfigurasi) | PARTIAL |
| `local` | Ringkasan rollout + pelajaran `learned.md` | Simpan manual saja | PARTIAL |
| `mem0` | SQLite lokal + fakta semantik FTS5 | Simpan/cari manual saja | PARTIAL |
| `lcm` | SQLite lokal, konteks delta-encoded | Simpan/cari manual saja | PARTIAL |
| `mnemosyne` | SQLite tiga lapis legacy | Manual | KOMPATIBILITAS SAJA |
| `off` | tidak ada | Tidak ada | VERIFIED (no-op) |

Memilih `mnemosyne` dimigrasi ke `mnemopi` saat config dimuat. Ia tetap menjadi nilai enum yang dapat dipilih hanya untuk kompatibilitas.

## Konfigurasi

```yaml
memory:
  backend: mnemopi            # off | mnemopi | hindsight | mem0 | lcm | local | mnemosyne
mnemopi:
  autoRecall: true
  autoRetain: true
  recallLimit: 8
  recallContextTurns: 3
  injectionTokenLimit: 5000   # budget untuk memori yang diingat dan disuntikkan
  retainEveryNTurns: 4
```

## Contoh nyata

```text
> remember that this project uses pnpm, not npm
> (sesi baru, beberapa hari kemudian)
> which package manager should I use here?
  # agen me-recall fakta tersimpan dan menjawab "pnpm" tanpa membaca ulang repo
```

## Perilaku yang diharapkan

- Dengan `mnemopi`, fakta yang disimpan bertahan saat proses restart dan di-recall secara semantik (query yang diparafrase tetap cocok).
- Memori yang di-recall disuntikkan di turn pertama dan dipotong agar muat `injectionTokenLimit`.
- Dengan `off`, tidak ada memori yang ditulis atau dibaca.

## Perilaku kegagalan

- `hindsight` secara diam-diam menurun ke "tanpa memori" jika layanannya tidak dapat dijangkau.
- `mem0`/`lcm`/`local` menyimpan tetapi **tidak** menyuntikkan otomatis - agen tidak akan "mengingat" lintas sesi kecuali kode aplikasi secara eksplisit memanggil save/search mereka.

## Batasan

- Hanya `mnemopi` (dan `hindsight`, saat layanannya aktif) yang memberi konteks model secara otomatis. Backend manual hanya save/search.
- Memori di-scope per-proyek: handle SQLite dikunci berdasarkan `agentDir` yang diselesaikan, jadi memori tiap proyek tetap terisolasi.

## Pengujian

```bash
bun test src/memory-backend/__tests__/memory-integration.test.ts
```

30 test mencakup retain eksplisit, persistensi restart lintas proses, recall semantik, auto-retain, injeksi auto-recall, invarian budget injeksi, clear/delete, backend `off`, pergantian backend, dan isolasi scope - di semua backend.
