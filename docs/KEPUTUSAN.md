# Catatan keputusan

Format: kode, tanggal, keputusan, alasan. Keputusan baru ditambah di bawah. Keputusan yang butuh
Chief ditaruh di "Menunggu Chief" sampai dijawab, sementara pekerjaan lain tetap jalan.

## Menunggu Chief

- **K-07 (2026-10-06) Perilaku saat hak AgentBuff berakhir.** Rekomendasi: data tetap, mengubah
  dikunci, alarm yang sudah ada tetap berbunyi 3 hari masa tenggang, pemberitahuan H-3 dan malam
  sebelum alarm berhenti. Alasan: alarm yang tiba-tiba diam bisa membuat orang telat kerja atau
  kuliah, lebih parah dari aplikasi biasa yang sekadar terkunci. Sampai dijawab, kode memakai
  rekomendasi ini di satu modul aturan supaya mudah diubah.

## Sudah diputuskan

- **K-01 (2026-10-06) Otak di server VPS.** Jadwal dan semua kiriman dijalankan worker di server.
  Alasan: versi lama gagal karena bergantung PC yang menyala 24 jam.
- **K-02 (diubah 2026-10-07) Web/PWA + aplikasi Windows, tanpa aplikasi HP native.** Chief setuju
  web dulu + Mode Jam Meja; aplikasi Android dibuat nanti bila uji nyata membuktikan perlu.
  Aplikasi Windows dibutuhkan karena web tidak bisa membuka ulang browser yang ditutup.
- **K-03 (diubah 2026-10-07) Tuya opsional, disambung langsung di AntiKebo** dengan kunci `sk-`
  milik pengguna, alur meniru tuya.agentbuff.id (wizard 3 langkah atau tempel di chat), kode dari
  template. Tuya bukan fitur inti; semua fitur inti jalan tanpa Tuya. Telepon/SMS Tuya hanya opsi
  tersembunyi.
- **K-04 (dibatalkan 2026-10-07):** "Telegram lewat bot AntiKebo sendiri, WhatsApp tidak dibuat"
  diganti K-15.
- **K-05 (diubah 2026-10-07) Tidak ada AI di dalam AntiKebo, dan agen tidak bisa mematikan
  alarm.** Suara omelan dibuat oleh AgentBuff milik pengguna (K-16), bukan oleh AntiKebo.
- **K-06 (2026-10-06) Cetakan = repo AgentBuff-Tuya commit `937aa8a`.**
- **K-08 (diubah 2026-10-07) Bunyi alarm disintesis sendiri lewat skrip di repo.** MP3 aplikasi
  lama tidak dipakai karena lisensinya tidak jelas.
- **K-09 (2026-10-06) Identitas:** domain `antikebo.agentbuff.id`, product key/client id
  `antikebo`, kategori `produktivitas`.
- **K-10 (2026-10-06) Dibangun di cloud, dirilis dari laptop.**
- **K-12 (2026-10-07) Bila AgentBuff tidak terjangkau, status hak terakhir dipakai sampai 72 jam**
  (sama dengan aplikasi Tuya). Alasan: alarm tidak boleh gagal hanya karena AgentBuff gangguan.
  Kontrak AgentBuff menyarankan 1 jam untuk login biasa; alarm adalah pengecualian yang disengaja.
- **K-13 (2026-10-07) Microsoft Store nanti, bila peminat banyak.** Aplikasi PC diunduh langsung
  dari situs tanpa tanda tangan kode; layar biru Windows dijelaskan dengan panduan bergambar.
  (Pendaftaran developer perorangan Microsoft Store gratis sejak September 2025 dan aplikasi MSIX
  ditandatangani Microsoft, jadi jalan ini tetap terbuka tanpa biaya.)
- **K-14 (2026-10-07) Pengingat terpisah dan rutinitas tidak dibuat.** Diganti template alarm
  (mis. "Pengingat penting siang"). Agen AgentBuff sudah punya Rutinitas untuk pengingat biasa.
- **K-15 (2026-10-07) Spam ke semua kanal agen AgentBuff pengguna, tanpa AI.** AntiKebo meminta
  AgentBuff mengirim langsung lewat bot agen (Telegram, WhatsApp, Discord, Slack, Google Chat).
  Teks saja, tanpa voice note. Jeda WhatsApp lebih longgar. Alasan: cepat, nol token, kalimat pasti,
  ingatan agen bersih, tetap jalan walau kuota AI habis.
- **K-16 (2026-10-07) Suara omelan lewat jalur suara Telepon Agent milik masing-masing pengguna.**
  AntiKebo meminta AgentBuff pengguna itu membuat suara dengan pengaturan suaranya (gratis tanpa
  kunci, atau penyedia berbayar milik pengguna). Platform tidak menanggung biaya suara; usulan
  Gemini TTS ditanggung platform **ditolak Chief**.
- **K-17 (2026-10-07) Pola suara:** omelan dengan jeda 3 detik, diputar bersamaan dengan bunyi
  alarm; klip dibuat sekali dan langsung galak.
- **K-18 (2026-10-07) Tunda:** jatah terbatas, tiap tunda butuh soal ringan; sesudah jatah habis
  tidak ada jalan lain selain menyelesaikan soal.
- **K-19 (2026-10-07) Spam tanpa batas waktu** sebagai bawaan, bisa diatur pengguna.
- **K-20 (2026-10-07) Misi QR, "Masih bangun?", dan Mode Komitmen dibuat.**
- **K-21 (2026-10-07) Aplikasi PC memakai Tauri v2** (pemasang kecil, tanpa admin, WebView2
  bawaan Windows, pembaruan bertanda tangan sendiri).
