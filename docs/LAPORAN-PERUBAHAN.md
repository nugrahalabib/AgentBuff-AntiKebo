# Laporan perubahan AntiKebo

Entri terbaru di paling atas. Ditulis dari sisi pengguna dengan bahasa sehari-hari. Kelompok:
Baru, Diperbaiki, Diubah, Dihapus, Keputusan, Kesalahan, Masih butuh Chief, Untuk teknisi.

## 2026-10-06: Persiapan proyek

**Baru**
- Repo AntiKebo dibuat sebagai tempat membangun ulang alarm anti kesiangan untuk Marketplace
  AgentBuff (Rp29.000 sekali bayar).
- Konsep baru: alarm tidak lagi butuh PC menyala 24 jam. Server AgentBuff yang membangunkan
  lewat lampu dan perangkat Tuya, telepon ke HP, Mode Malam, notifikasi, dan Telegram, sampai
  kamu benar-benar bangun dan lolos tantangan.
- Dokumen lengkap untuk sesi Claude di cloud: konsep, kebutuhan, arsitektur, desain, integrasi
  AgentBuff, rencana kerja 13 paket, panduan sesi cloud, gerbang rilis.

**Keputusan**
- Lihat `docs/KEPUTUSAN.md` K-01 sampai K-10.

**Masih butuh Chief**
- Pasang Claude GitHub App di akun nugrahalabib dan buat environment cloud (`docs/07-SESI-CLOUD.md`).
- Jawab K-07 (alarm saat langganan beku) dan K-11 (nama bot Telegram).

**Untuk teknisi**
- `referensi/template-tuya/` = AgentBuff-Tuya `937aa8a`. `referensi/standar-agentbuff/` berisi
  dokumen BYM (`890ff94`), portal (`f3707a02`), dan panduan desain rombak UI (`28149e65`).
- `referensi/aplikasi-lama/` = kode shila-wake yang sudah dibersihkan (nomor HP dan kunci
  internal disamarkan, berkas data pribadi dan MP3 tidak disertakan). Folder asli
  `Referensi Project/` hanya ada di laptop Chief dan diabaikan git.
