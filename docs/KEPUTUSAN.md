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
- **K-22 (2026-10-07, P0) Sesi web 30 hari bergulir, paling lama 90 hari.** Template memakai 14/30
  hari. Alasan: `05-INTEGRASI` §1 meminta sesi panjang supaya pengguna tidak dilempar ke layar masuk
  saat setengah sadar; sesudah 90 hari masuk ulang senyap (`prompt=none`) biasanya tanpa layar.
- **K-23 (2026-10-07, P0) Server tiruan AgentBuff juga meniru Masuk dengan AgentBuff (OIDC).**
  Discovery, authorize (layar pilih akun contoh + centang izin), token (PKCE, id_token ES256), JWKS,
  userinfo, `/status`, keempat pintu baru, asersi `mcp-token`, dan kendali `/_tiruan/*` untuk tes.
  Alasan: sesi cloud tidak punya klien OIDC AgentBuff asli, padahal P1 sampai P13 butuh masuk untuk
  tangkapan layar dan uji ujung ke ujung. Tiruan hanya boleh dengan `APP_ORIGIN` localhost
  (`env.ts` menolak selain itu).
- **K-24 (2026-10-07, P0) Cadangan scope.** Bila AgentBuff menjawab `invalid_scope` untuk izin
  `agentbuff:kabar`/`agentbuff:suara`, masuk diulang otomatis dengan scope dasar dan izin dicatat
  belum diberi. Alasan: L1 bisa belum selesai saat AntiKebo dicoba dengan AgentBuff asli; masuk tidak
  boleh rusak karenanya.
- **K-25 (2026-10-07, P0) Rincian kontrak pintu yang sebelumnya belum tertulis** (ditambahkan ke
  `05-INTEGRASI-AGENTBUFF.md`, wajib diikuti L1): urutan pemeriksaan klien, badan, `sub`, hak, izin;
  400 `permintaan_tidak_sah`; `/masuk/kabar` teks kosong atau > 1000 = 422 `teks_tidak_sah`; kanal
  tak dikenal = 409 `kanal_tidak_siap`; kunci idempoten yang sama = 200 dengan `id` yang sama;
  `agen_tidak_aktif` hanya di kabar dan suara; suara tak dikenal = suara bawaan.
- **K-26 (2026-10-07, P0) Tangkapan layar PR tidak masuk `main`.** Disimpan di commit khusus pada
  cabang kerja, ditautkan di badan PR lewat SHA commit, dihapus di commit berikutnya, PR digabung
  squash. Alasan: 14 paket x 28 gambar akan membengkakkan repo; tautan tetap hidup lewat ref PR.
- **K-27 (2026-10-07, P0) `agentRules: false` di `next.config.ts`.** Next 16.3 `next dev` menulis
  blok aturan agen (dengan tanda pisah panjang) ke `CLAUDE.md`; aturan yang sama sudah ada di §5.5.
- **K-28 (2026-10-07, P0) Deploy berparameter.** Alias SSH VPS, folder, dan perintah penyegaran alat
  di AgentBuff diisi di `deploy/.env.deploy` (diabaikan git), bukan ditulis di repo publik.
- **K-29 (2026-10-07, P0) Suara tiruan dibuat skrip, dikode MP3 murni JS** (`@breezystack/lamejs`,
  hanya devDependency): deterministik (isi sama = berkas sama) dan durasinya mengikuti panjang teks,
  jadi P5 bisa menguji pakai ulang klip dan urutan putar tanpa layanan suara sungguhan.
- **K-30 (2026-10-07, P1) Prototipe = layar asli.** Setiap layar dibuat sebagai komponen
  presentasional di `src/components/layar/*` yang menerima data lewat props; galeri `/prototipe`
  hanya merender komponen itu dengan data contoh. Galeri 404 di produksi kecuali
  `AGENTBUFF_TIRUAN=1` dan selalu `noindex`. Alasan: masukan Chief langsung berlaku di aplikasi
  tanpa menulis ulang layar di P8/P11, dan tangkapan layar tidak butuh masuk.
- **K-31 (2026-10-07, P1) Warna grafik Riwayat satu seri indigo** (`--grafik`: #5b5bd6 terang,
  #7577ef gelap), diperiksa dengan validator palet (kontras dan lightness di kedua permukaan).
  Alasan: toska sudah berarti "aktif/nyala" dan hijau/merah dipakai status bangun/tidak; grafik
  tidak boleh meminjam warna status.
- **K-32 (2026-10-07, P1) Navigasi final 4 tab: Alarm, Siaga, Riwayat, Pengaturan.** HP: bilah tab
  kaca di bawah; laptop: bilah samping kaca dengan tombol "Alarm baru". Tab untuk halaman yang belum
  ada tidak ditampilkan (bukan tab mati).
- **K-33 (2026-10-07, P2) "Jangan bunyi saat libur nasional" hanya melompati libur nasional,
  bukan cuti bersama.** Data cuti bersama tetap disimpan (untuk keterangan di layar). Alasan:
  banyak pekerja swasta tetap masuk saat cuti bersama; alarm yang diam di hari kerja lebih
  berbahaya daripada alarm yang berbunyi di hari libur. Tahun tanpa data = tidak ada yang dilompati.
- **K-34 (2026-10-07, P2) Mode Komitmen juga menolak perubahan yang melemahkan alarm** selama
  terkunci: soal lebih ringan atau jenisnya diganti, kode QR ditukar, jumlah benar dikurangi, jatah
  atau durasi tunda ditambah, batas berhenti sendiri ditambahkan atau dipersingkat, "Masih bangun?"
  dimatikan, kanal spam atau aturan rumah pintar dikurangi. Ditambah aturan PRD (hapus, matikan,
  lewati, mundurkan) dan mematikan Komitmen itu sendiri. Jam tidur dan zona juga tidak bisa diubah
  bila membuka kunci yang sedang berjalan. Jendela kunci = dari jam tidur terakhir sebelum jadwal
  sampai jadwal (alarm siang ikut terkunci sejak jam tidur malam sebelumnya). Alasan: tanpa ini
  Komitmen bisa dibobol dengan mengubah soal jadi 1 soal ringan dan tunda 5 x 15 menit. Semua di
  satu modul murni (`src/lib/alarm/komitmen.ts`), mudah dilonggarkan bila Chief mau.
- **K-35 (2026-10-07, P2) Template bawaan hidup di kode, bukan di DB.** Lima template PRD B10,
  nama dan judul ikut bahasa pengguna, tidak bisa diubah (simpan sebagai template baru). Template
  buatan pengguna di tabel `template_alarm` ber-RLS, nama unik tanpa beda huruf besar/kecil.
- **K-36 (2026-10-07, P2) Gandakan alarm menghasilkan salinan nonaktif tanpa Komitmen.** Alasan:
  salinan aktif langsung berbunyi bersamaan dengan aslinya dan bisa langsung terkunci.
- **K-37 (2026-10-07, P2) Alarm yang sedang berbunyi tidak bisa diubah, dihapus, dimatikan, atau
  dilewati dari mana pun** (`sedang_berbunyi`, MCP `alarm_ringing`). Batal lewati dan gandakan tetap
  boleh. Alasan: aturan teknis 2 (satu-satunya jalan berhenti adalah soal di layar alarm).
- **K-38 (2026-10-07, P2) Aturan jam musim panas** untuk pengguna di zona yang memakainya: jam yang
  tidak ada bergeser maju sebesar celahnya, jam yang muncul dua kali memakai kemunculan pertama
  (alarm tidak berbunyi dua kali). Dihitung sendiri dari `tzOffset` karena `TZDate` tidak konsisten
  antar zona. Indonesia tidak terdampak.
- **K-39 (2026-10-07, P2) Alarm aktif yang tidak akan pernah berbunyi lagi ditolak** (sekali yang
  sudah lewat, melewati satu-satunya tanggal). Alasan: invarian "alarm aktif = tepat satu kejadian
  menunggu" tidak boleh punya pengecualian. Menyalakan lagi alarm sekali yang sudah lewat memakai
  kemunculan jam itu berikutnya, seperti jam weker.
