# Laporan perubahan AntiKebo

Entri terbaru di paling atas. Ditulis dari sisi pengguna dengan bahasa sehari-hari. Kelompok:
Baru, Diperbaiki, Diubah, Dihapus, Keputusan, Kesalahan, Masih butuh Chief, Untuk teknisi.

## 2026-10-07 (P1): Rancangan semua layar siap dinilai

**Baru**
- Semua layar AntiKebo sudah punya rupa, lengkap terang dan gelap, HP dan laptop: Beranda (ada
  alarm dan masih kosong), Ubah alarm (roda jam, agenda, ulangi, pilihan karakter omelan, soal,
  tunda, spam chat, rumah pintar), layar **berbunyi** (soal hitungan dan Misi QR), Selamat pagi,
  "Masih bangun?", Mode Jam Meja (sebelum mulai dan saat siaga), tab Siaga, halaman unduh aplikasi
  PC dengan panduan layar biru Windows, Riwayat dengan skor dan grafik, Pengaturan, perkenalan
  pertama 6 langkah, dan jendela aplikasi PC.
- Kenalan dengan **Kebo**, maskot kerbau yang tidur, kaget, segar, atau santai sesuai suasana.
- Layar berbunyi sudah bisa dicoba: jawaban salah membuat kartu bergetar, jawaban benar menambah
  titik. Roda jam bisa digeser jari atau dipakai dengan papan ketik.
- Semua layar bisa dilihat di galeri `/prototipe` saat pengembangan (tidak ada di aplikasi asli).

**Keputusan**
- K-30 (layar prototipe dipakai langsung oleh aplikasi), K-31 (warna grafik), K-32 (4 tab).

**Masih butuh Chief**
- Menilai rancangan dari tangkapan layar di PR P1. Masukan dikerjakan di P8/P11.
- K-07 masih menunggu.

**Untuk teknisi**
- Komponen baru: `RodaJam`, `PapanAngka`, `Grup`/`BarisGrup`, `Cincin`, `Penghitung`, `Cip`,
  `Kebo`; token Bara, Fajar, grafik; `Shell` 4 tab + bilah samping.
- Bukti: jaga, tsc, lint, format, 65 tes vitest, build, 50 uji Playwright mode produksi (14 P0 + 36
  prototipe) hijau.

## 2026-10-07 (P0): Kerangka aplikasi AntiKebo berdiri

**Baru**
- AntiKebo sekarang benar-benar bisa dibuka: halaman depan, halaman **Masuk dengan AgentBuff**,
  beranda (sapaan + "Belum ada alarm"), dan Pengaturan (akun, izin AgentBuff, Keluar). Pembuat
  alarm belum ada; itu paket berikutnya.
- Saat masuk, AgentBuff meminta dua izin: **kirim pesan lewat agenmu** (untuk spam chat) dan **buat
  suara omelan**. Kalau ditolak, AntiKebo tetap bisa dipakai dan menampilkan spanduk "Izin AgentBuff
  belum lengkap" dengan tombol **Beri izin**.
- Yang belum membeli atau langganannya habis mendapat penjelasan ramah + tautan perbaikan. Kalau
  akses berhenti di tengah jalan, aplikasi dibekukan dan data tetap tersimpan.
- Sesi masuk tahan lama (30 hari sejak terakhir dipakai, paling lama 90 hari) supaya tidak disuruh
  masuk lagi saat masih setengah sadar.
- Agen AgentBuff sudah bisa tersambung otomatis ke AntiKebo (alat pertama: cek status akun dan
  izin). Alat untuk membuat alarm lewat chat menyusul di P12.

**Untuk teknisi**
- Kerangka dari template Tuya: Next.js 16, Drizzle + Postgres 16 dengan RLS ENABLE + FORCE, peran
  tanpa BYPASSRLS, OIDC AgentBuff, cek hak 72 jam, MCP stateless, worker detak, penjaga `jaga`
  (12 penjaga, termasuk baru: `referensi-terkecuali`, `env-contoh`, `tanda-pisah` seluruh `src/`),
  deploy berparameter (lokasi server tidak di repo), CI GitHub Actions.
- **Server tiruan AgentBuff** (`pnpm tiruan`): masuk OIDC lengkap dengan akun contoh, cek hak,
  pintu kanal/pesan/suara persis kontrak, suara tiruan MP3 buatan skrip. Dipakai pengembangan dan
  tes; ditolak di luar localhost.
- Klien pintu `src/lib/agentbuff/pintu.ts` siap dipakai P5/P6.
- Bukti: 65 tes vitest (unit, integrasi PGlite sebagai `antikebo_app`, kontrak tiruan, MCP, OIDC),
  14 uji Playwright (desktop + 390 px), `deploy/uji-rls.sql` lulus di PGlite dan Postgres 16.

**Keputusan**
- K-22 sampai K-29 (`KEPUTUSAN.md`). Kontrak pintu diperjelas di `05-INTEGRASI-AGENTBUFF.md` (K-25).

**Masih butuh Chief**
- K-07 (alarm saat langganan berakhir) masih menunggu; kode belum memakai masa tenggang (P3).
- Menilai tampilan awal dari tangkapan layar di PR (rancangan lengkap di P1).

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
