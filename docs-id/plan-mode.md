# Mode Plan

## Tujuan

Membuat agen menghasilkan dan berkomitmen pada rencana sebelum mulai mengeksekusi tools, sehingga pekerjaan multi-langkah ditinjau di awal alih-alih diimprovisasi turn demi turn.

## Cara kerjanya

- `/plan [prompt]` mengaktifkan mode plan; entri registry juga melaporkan status di autocomplete: `Plan: on (plan-file)` / `Plan: off` / `Plan: disabled in settings` / `Plan: blocked by goal mode`.
- State berada di `src/plan-mode/state.ts`: `enabled`, `planFilePath`, `workflow` opsional (`parallel` | `iterative`), dan `reentry`.
- `src/plan-mode/approved-plan.ts` + `plan-protection.ts` mengimplementasikan konsep rencana yang disetujui - setelah rencana disetujui, agen diprompt untuk tetap berada di dalamnya; `plan-handoff.ts` menyimpannya ke `planFilePath`.
- `/plan-review` membuka ulang review untuk rencana terbaru (khusus mode plan).

## Konfigurasi

```yaml
plan:
  enabled: true    # sakelar master (key skema plan.enabled)
```

## Contoh nyata

```text
> /plan
  (agen menghasilkan file rencana; Anda menyetujui atau mengiterasi)
> make cli refactor plan
> /plan-review
> (setujui → agen mengeksekusi di dalam rencana)
```

## Perilaku yang diharapkan

- Dengan mode plan aktif dan rencana tersedia, prompt/steering lebih memilih merencanakan pekerjaan sebelum panggilan tool, dan `/plan-review` dapat membuka ulang file untuk ditinjau.
- `workflow: parallel` vs `iterative` mengubah cara rencana dieksekusi (fase fuzzy-matched ada di sistem todo untuk alur paralel).

## Perilaku kegagalan

- Goal mode diutamakan: plan mode melaporkan "blocked by goal mode" saat keduanya aktif.
- Perlindungan rencana bersifat advisory; tidak ada blok keras untuk panggilan tool di luar rencana.

## Batasan

- Belum ada test end-to-end yang menjalankan siklus penuh plan → setujui → eksekusi dengan loop agen nyata.
- File rencana adalah artefak markdown; penegakan bergantung pada model mengikuti rencana yang disetujui.

## Status pengujian

**PARTIAL** - diimplementasikan (`src/plan-mode/`, `plan.enabled`, entri registry `/plan`, `/plan-review`). Bukti: `src/plan-mode/*` dan wiring registry di atas.
