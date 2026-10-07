# Laporan perubahan AntiKebo

Entri terbaru di paling atas. Ditulis dari sisi pengguna dengan bahasa sehari-hari. Kelompok:
Baru, Diperbaiki, Diubah, Dihapus, Keputusan, Kesalahan, Masih butuh Chief, Untuk teknisi.

## 2026-10-07: Konsep versi 2 disepakati, semua dokumen ditulis ulang

**Diubah**
- Alarm kini **tidak berhenti sampai soal terjawab** di perangkat mana pun: bunyi alarm keras +
  suara omelan galak (jeda 3 detik), judul agenda besar di layar, spam chat, notifikasi, dan lampu
  (opsional) berjalan bersamaan.
- Spam chat kini bisa ke **semua kanal agen AgentBuff** (Telegram, WhatsApp, Discord, Slack,
  Google Chat), dikirim langsung tanpa AI. Bot Telegram sendiri tidak dibuat.
- Suara omelan dibuat oleh **AgentBuff milik masing-masing pengguna** memakai pengaturan suaranya
  (sama dengan Telepon Agent). Tidak ada biaya suara untuk platform.
- Ditambah **AntiKebo untuk PC** (aplikasi Windows): jendela alarm tidak bisa ditutup, volume
  dipaksa maksimal, tetap bunyi walau internet putus.
- HP memakai **Mode Jam Meja** (halaman dibiarkan terbuka di charger). Aplikasi HP native nanti.
- Rumah pintar Tuya jadi **opsional**, alur sambungnya meniru tuya.agentbuff.id.

**Baru**
- Misi QR (pindai kode di kamar mandi), "Masih bangun?", Mode Komitmen (alarm dikunci di malam
  hari), tunda berjatah dengan soal ringan, karakter suara omelan.
- Semua yang bisa diatur di web bisa lewat chat ke agen, kecuali mematikan alarm dan menjawab soal.

**Dihapus**
- Bot Telegram AntiKebo sendiri, pengingat terpisah, rutinitas (diganti template alarm), telepon
  Tuya sebagai fitur utama.

**Keputusan**
- K-02, K-03, K-05, K-08 diubah; K-04 dibatalkan; K-12 sampai K-21 baru. Lihat `KEPUTUSAN.md`.

**Masih butuh Chief**
- Pasang Claude GitHub App dan environment cloud (`docs/07-SESI-CLOUD.md`).
- Jawab K-07 (alarm saat langganan berakhir).

**Untuk teknisi**
- Kontrak pintu AgentBuff baru (`/masuk/kanal`, `/masuk/kabar`, `/masuk/suara`,
  `/masuk/suara/daftar`) di `05-INTEGRASI-AGENTBUFF.md`; dibangun di repo AgentBuff (paket L1),
  sementara itu dipakai server tiruan.
- Dokumen baru: `09-APLIKASI-PC.md`, `10-SUARA.md`, `11-ALAT-MCP.md`. Rencana kerja jadi 14 paket
  cloud (P0 sampai P13) + 3 paket laptop (L1 sampai L3).

## 2026-10-06: Persiapan proyek

**Baru**
- Repo AntiKebo dibuat sebagai tempat membangun ulang alarm anti kesiangan untuk Marketplace
  AgentBuff (Rp29.000 sekali bayar).
- Dokumen konsep versi 1 (kini diganti versi 2), referensi template Tuya, standar AgentBuff, dan
  kode aplikasi lama yang sudah dibersihkan.

**Untuk teknisi**
- `referensi/template-tuya/` = AgentBuff-Tuya `937aa8a`. `referensi/standar-agentbuff/` berisi
  dokumen BYM (`890ff94`), portal (`f3707a02`), dan panduan desain rombak UI (`28149e65`).
- `referensi/aplikasi-lama/` = kode shila-wake yang sudah dibersihkan. Folder asli
  `Referensi Project/` hanya ada di laptop Chief dan diabaikan git.
