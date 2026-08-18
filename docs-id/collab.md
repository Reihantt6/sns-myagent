# Sesi Kolaboratif (Collab)

## Tujuan

Membagikan sesi agen live dengan orang lain - tamu menonton transkrip dan entri sesi secara real-time, dan (kecuali link read-only) dapat mem-prompt dan membatalkan sesi. Mesin host menjalankan agen dan semua tools.

## Cara kerjanya

- `/collab` (atau `/collab start`) menjadi host: `src/collab/host.ts` menyadap stream event sesi + chokepoint append dan menyiarkan entri/state ke tamu melalui relay. `src/collab/guest.ts` adalah sisi tamu.
- Frame disegel AES-256-GCM (`crypto.ts`); relay hanya melihat amplop terenkripsi plus pesan kontrol - tanpa data sesi (`src/collab/protocol.ts`).
- `/collab view` membagikan link read-only (tamu bisa menonton, bukan mem-prompt); `/join <link>` bergabung; `/leave` keluar.
- Ekosistem subagent juga dicerminkan: traffic task EventBus, snapshot agent-registry (tabel Agent Hub), perintah hub chat/kill/revive.
- Relay default: `wss://my.omp.sh` (dari `@oh-my-pi/pi-wire`).

## Konfigurasi

```text
/collab [start|view|status|stop] [relayUrl]
/collab status         # link + jumlah partisipan
/join <link>
/leave
```

## Contoh nyata

```text
> /collab
  → "hosting (0 guests)" + link berbagi
> bagikan link ke rekan tim
> /collab status
  → hosting (2 guests)
> /collab stop
```

## Perilaku yang diharapkan

- Link read-only (`/collab view`) tidak pernah mengizinkan prompt tamu.
- Pesan tamu masuk melalui agen host sebagai steering; host melihat penambahan partisipan di `/collab status`.

## Perilaku kegagalan

- URL relay yang buruk dinormalisasi/ditolak oleh `protocol.ts` (`normalizeRelayUrl`).
- Jika relay tidak dapat dijangkau, hosting gagal dengan error koneksi; sesi yang ada tidak terpengaruh.

## Batasan

- Membutuhkan relay yang dapat dijangkau; relay default adalah layanan pihak ketiga yang dihosting (`wss://my.omp.sh`), jadi bertindaklah sesuai jika Anda peduli kerahasiaan untuk pekerjaan produksi (frame terenkripsi, tetapi relay adalah endpoint bersama).
- Berbagi sesi adalah streaming real-time, bukan fork; tamu tidak bisa menjalankan tools mereka sendiri.

## Status pengujian

**UNTESTED** - diimplementasikan (`src/collab/`, 5 file) tetapi belum ada file test yang menjalankan alur host/guest. Bukti: `src/collab/*`, entri registry `/collab`, docs/screenshots/comm-mode.png.
