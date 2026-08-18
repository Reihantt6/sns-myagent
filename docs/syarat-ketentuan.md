# Syarat dan Ketentuan

Terakhir diperbarui: 18 Agustus 2025

Dengan menginstal dan menggunakan SNS-MyAgent ("snsagent", "Aplikasi"), Anda menyetujui
ketentuan berikut. Jika Anda tidak menyetujui, jangan gunakan Aplikasi ini.

## 1. Lisensi

SNS-MyAgent dirilis di bawah lisensi MIT. Kode sumber tersedia di
[GitHub](https://github.com/Reihantt6/sns-myagent). Anda bebas menggunakan, memodifikasi,
dan mendistribusikan ulang sesuai ketentuan lisensi MIT.

## 2. Sifat Aplikasi

SNS-MyAgent adalah agen CLI (Command Line Interface) yang berjalan di terminal Anda.
Aplikasi menjalankan kode (bash, eval, SSH, browser, MCP tools) atas nama Anda berdasarkan
perintah yang Anda berikan. Anda bertanggung jawab penuh atas semua perintah yang
dijalankan dan hasil yang ditimbulkan.

## 3. Bring Your Own Key (BYOK)

Aplikasi tidak menyediakan akses ke model AI. Anda wajib menyediakan kunci API (API key)
milik sendiri dari penyedia layanan pilihan Anda (OpenAI, Anthropic, Ollama, atau kustom).
Biaya penggunaan API sepenuhnya ditanggung oleh Anda. Aplikasi tidak bertanggung jawab
atas biaya yang timbul dari penggunaan kunci API Anda.

## 4. Privasi dan Data

- Konfigurasi dan data sesi disimpan lokal di `~/.omp/agent/` di perangkat Anda
- Aplikasi tidak mengirim data Anda ke server pihak ketiga selain penyedia LLM yang Anda
  pilih sendiri
- Token dan kunci API disimpan di perangkat lokal. Jangan bagikan file konfigurasi Anda

## 5. Keamanan

Aplikasi menjalankan kode atas nama Anda. Baca
[dokumen model keamanan](./security-model.md) untuk memahami batasan otorisasi dan
perilaku persetujuan tool. Aktifkan `autoApprove` hanya jika Anda memahami risikonya.

## 6. Penafian

Aplikasi disediakan "APA ADANYA" tanpa jaminan apa pun. Tidak ada jaminan bahwa Aplikasi
akan berfungsi tanpa kesalahan atau memenuhi kebutuhan spesifik Anda. Pengembang
SNS-MyAgent tidak bertanggung jawab atas kerugian yang timbul dari penggunaan Aplikasi.

## 7. Kontribusi

Kontribusi melalui pull request di GitHub diterima. Dengan berkontribusi, Anda
menyetujui bahwa kontribusi Anda dirilis di bawah lisensi MIT yang sama.

## 8. Perubahan Ketentuan

Ketentuan ini dapat berubah sewaktu-waktu. Perubahan akan dipublikasikan di halaman ini.
Penggunaan Aplikasi setelah perubahan dianggap sebagai persetujuan terhadap ketentuan
yang diperbarui.
