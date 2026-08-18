# Plugin & Skill (Ekstensibilitas)

## Tujuan

Memperluas agen tanpa menyentuh kode inti: memasang plugin dari marketplace, menambah custom slash command, custom tool, hook, dan skill markdown yang dapat dimuat agen sesuai permintaan.

## Cara kerjanya

- `src/extensibility/` adalah payungnya:
  - `plugins/` - lifecycle plugin: `manager.ts`, `loader.ts`, `installer.ts`, `parser.ts`, `git-url.ts`, `doctor.ts`, `marketplace/` (sumber + marketplace-auto-update), dan kompatibilitas pi legacy.
  - `custom-commands/`, `custom-tools/`, `extensions/`, `hooks/` - tambahan pengguna yang didaftarkan ke sesi.
  - `skills.ts` - memuat skill markdown dari direktori yang dikonfigurasi; skill berada di bawah pohon `~/.omp/agent/` (pengguna) dan `.omp/` (proyek) dan dipindai dengan `scanSkillsFromDir`.
  - `slash-commands.ts`, `tool-proxy.ts` - wiring untuk hal di atas ke registry dan loop tool.
- `/plugins` `[list|enable|disable]` mengelola plugin terpasang; `/marketplace` mengelola sumber marketplace dan instalasi.

## Konfigurasi

```yaml
skills:
  enabled: true                # sakelar master (default skema: true)
  enableSkillCommands: ...     # izinkan pemanggilan `/skill:<name>`
  enableAgentsUser: true       # baca skill .agents tingkat pengguna
  enableAgentsProject: true    # baca skill .agents tingkat proyek
  enablePiUser: true           # baca skill .pi tingkat pengguna
  enablePiProject: true        # baca skill .pi tingkat proyek
marketplace:
  autoUpdate: ...              # auto-update marketplace plugin
```

Penemuan skill mencerminkan sistem capability yang dipakai MCP dan agen: `scanSkillsFromDir` + `compareSkillOrder` di `src/discovery/helpers.ts`.

## Contoh nyata

```text
> /plugins list
> /marketplace search <term>
> load coding skill           # agen memuat skill berdasarkan nama sesuai permintaan
```

## Perilaku kegagalan

- Paket plugin yang rusak menampilkan error dari `doctor.ts`/`loader.ts` alih-alih merusak sesi.
- Kegagalan auto-update marketplace meninggalkan versi yang terpasang saat ini.

## Batasan

- Ekosistem plugin/skill opiniated tentang layout direktori; skill di pohon yang salah tidak ditemukan.
- Fitur marketplace diimplementasikan tetapi belum punya test yang di-commit.

## Status pengujian

**UNTESTED** - diimplementasikan (`src/extensibility/`), belum ada file test untuk pemuatan plugin atau skill. Bukti: `src/extensibility/*` + entri registry `/plugins`, `/marketplace`.
