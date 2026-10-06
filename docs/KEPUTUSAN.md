# Catatan keputusan

Format: kode, tanggal, keputusan, alasan. Keputusan baru ditambah di bawah. Keputusan yang
butuh Chief ditaruh di bagian "Menunggu Chief" sampai dijawab.

## Menunggu Chief

- **K-07 (2026-10-06) Perilaku saat hak beku.** Rekomendasi: data tetap, ubah-ubah dikunci,
  alarm yang sudah ada tetap berbunyi 3 hari masa tenggang dengan pemberitahuan, dan pengguna
  diberi tahu malam sebelum alarm berhenti. Alasan: alarm yang tiba-tiba tidak berbunyi bisa
  merugikan pengguna (telat kerja/kuliah), lebih parah daripada aplikasi biasa yang sekadar
  terkunci. Perlu dipastikan tidak bertentangan dengan aturan platform AgentBuff.
- **K-11 (2026-10-06) Nama bot Telegram.** Rekomendasi `@AntiKeboBot` (atau terdekat yang
  tersedia di BotFather). Chief yang membuat bot karena butuh akun Telegram Chief.

## Sudah diputuskan

- **K-01 (2026-10-06) Otak di server VPS.** Jadwal dan semua saluran dijalankan worker di VPS,
  bukan di PC atau HP. Alasan: versi lama gagal karena bergantung PC yang harus menyala 24 jam.
- **K-02 (2026-10-06) Web app (PWA), bukan aplikasi native.** Alasan: sama dengan produk
  Marketplace lain, tanpa biaya dan proses toko aplikasi, bisa dipakai di HP dan laptop. Batasan
  web di HP terkunci ditutup oleh telepon suara Tuya, Mode Malam, push, dan Telegram.
- **K-03 (2026-10-06) Tuya diintegrasikan langsung di AntiKebo** dengan kunci `sk-` milik
  pengguna (kunci khusus "AntiKebo"), menyalin modul dari aplikasi Tuya AgentBuff. Alasan: `sub`
  OIDC berbeda per aplikasi sehingga AntiKebo tidak bisa memakai sambungan aplikasi Tuya, dan
  alarm tidak boleh bergantung pada agen AI yang harus dibangunkan dulu.
- **K-04 (2026-10-06) Telegram lewat bot AntiKebo sendiri, tanpa LLM. WhatsApp tidak dibuat.**
  Alasan: deterministik, gratis, tidak memakan token; WhatsApp tidak punya API resmi gratis dan
  API tidak resmi berisiko memblokir nomor.
- **K-05 (2026-10-06) Tidak ada LLM di aplikasi, dan agen tidak bisa mematikan alarm.** Alasan:
  standar produk AgentBuff (pola BYM) dan inti anti kesiangan.
- **K-06 (2026-10-06) Cetakan = repo AgentBuff-Tuya commit `937aa8a`.** Alasan: produk Rp29.000
  sekali bayar yang sudah lolos standar, sepersepuluh ukuran BYM, sudah berisi integrasi Tuya.
- **K-08 (2026-10-06) Suara MP3 aplikasi lama tidak dipakai.** Alasan: asal dan lisensinya tidak
  jelas, sedangkan produk ini dijual.
- **K-09 (2026-10-06) Identitas:** domain `antikebo.agentbuff.id`, product key dan client id
  `antikebo`, kategori `produktivitas`.
- **K-10 (2026-10-06) Pembangunan di cloud, rilis dari laptop.** Alasan: sesi cloud tidak bisa
  SSH ke VPS; pola deploy produk lain juga dari laptop (`deploy/deploy.sh`).
