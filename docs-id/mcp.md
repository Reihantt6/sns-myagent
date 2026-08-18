# MCP (Model Context Protocol)

## Tujuan

Menghubungkan server tool eksternal ke agen - filesystem, GitHub, database, web search - melalui Model Context Protocol, sehingga model dapat memanggil tool yang tidak dikirim sendiri oleh agen.

## Cara kerjanya

- Config berada di `.mcp.json` per-proyek plus sumber tingkat pengguna, dimuat melalui sistem capability (`src/mcp/config.ts` → `loadCapability`).
- Server berjalan melalui dua transport: **stdio** (`command`) dan **HTTP** (`url`); `src/mcp/json-rpc.ts` menyediakan jalur HTTP JSON-RPC ringan dan parsing SSE.
- Dukungan OAuth: `src/mcp/oauth-discovery.ts`, `oauth-flow.ts`, `oauth-credentials.ts`, plus auth Smithery (`smithery-auth.ts`).
- Tool bridge + cache mengekspos tool MCP ke loop agen (`src/mcp/tool-bridge.ts`, `tool-cache.ts`).
- Filter Exa/browser dapat mengecualikan server yang fungsinya sudah disediakan tool builtin.

## Konfigurasi

Server ditambahkan melalui percakapan, `/mcp add`, atau edit manual:

```bash
/mcp add <name> [--scope project|user] [--url <url>] [-- <command...>]
/mcp list
/mcp remove <name> [--scope project|user]
/mcp test <name>            # verifikasi koneksi
/mcp reauth <name>          # jalankan ulang alur OAuth
/mcp disable <name>; /mcp enable <name>
/mcp smithery-search <keyword> [--scope project|user] [--limit n] [--semantic]
```

Melalui percakapan:

```text
> add MCP filesystem for /home/user/projects
> add MCP github
```

Agen menulis server ke `.mcp.json` via `src/mcp/config-writer.ts`.

## Contoh nyata

```text
> add MCP filesystem for /home/user/projects
> list my files (agen memanggil tool server MCP filesystem)
> /mcp list
  • filesystem (stdio, project)
> /mcp test filesystem
```

## Perilaku kegagalan

- Server yang gagal start atau autentikasi dilaporkan oleh `/mcp test`; agen menurun dengan anggun (tool server itu hilang dari tool cache).
- Kredensial OAuth yang hilang diarahkan ke alur OAuth (`/mcp reauth`), atau mengembalikan error auth untuk server HTTP.

## Batasan

- Tool server hanya tersedia saat server aktif dan dapat dijangkau saat sesi dimulai; reconnect dinamis tidak dijamin.
- Tidak semua server menyertakan alur OAuth manual; server berbasis Smithery memakai jalur auth sendiri.

## Status pengujian

**PARTIAL** - diimplementasikan (`src/mcp/`, 22 file) dengan permukaan `/mcp` terverifikasi interaktif; file OAuth dan JSON-RPC belum punya test server end-to-end yang di-commit. Bukti: `src/mcp/*` + `docs/screenshots/mcp.png`.
