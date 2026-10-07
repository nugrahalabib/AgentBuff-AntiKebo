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
- **K-40 (2026-10-07, P3) Peristiwa waktu nyata dipicu DB.** Pemicu di `kejadian_alarm`, `alarm`,
  dan `perangkat_siaga` mengirim NOTIFY ke satu kanal `antikebo_peristiwa` berisi id saja
  (pengguna, jenis, kejadian, perangkat). Web menyebarkannya ke SSE, worker memakainya untuk
  memasang ulang pewaktu. Alasan: setiap jalur (web, MCP, worker, aplikasi PC) pasti mengabari
  tanpa harus ingat memanggil fungsi kabar; isi tetap dibaca lewat API ber-RLS.
- **K-41 (2026-10-07, P3) Sambung PC = kode + rahasia tunggu, token dibuat saat diambil.** Aplikasi
  PC menerima kode (8 huruf tanpa 0/O/1/I, 10 menit) dan rahasia 256 bit; pengguna menyetujui kode
  di peramban; token perangkat dibuat dan diantar SEKALI kepada pemegang rahasia, hanya hash yang
  disimpan. `kode_sambung` tabel global tanpa RLS (hanya hash, dicari sebelum pemilik diketahui),
  dikecualikan di penjaga `rls` dan `uji-rls.sql` seperti `sesi`.
- **K-42 (2026-10-07, P3) Siaga = detak < 2 menit.** Jam Meja (web) memakai sesi peramban, tanpa
  token perangkat. "Siap malam ini" sementara sama dengan siaga sekarang; P11 boleh memperhalus
  (mis. memakai `siap_sampai` dari PC) bila uji L2 menunjukkan perlu.
- **K-43 (2026-10-07, P3) Kejadian terlambat > 30 menit dicatat terlewat** (dengan langkah kabar),
  dan kejadian berikutnya dihitung dari SEKARANG, bukan dari jadwal yang terlewat, supaya server
  yang mati berhari-hari tidak menumpuk kabar terlewat untuk tiap hari.
- **K-44 (2026-10-07, P3) Uji alarm (PRD B9) versi singkat:** 1 menit lagi, soal Ringan 1 kali,
  tanpa tunda dan tanpa Komitmen, berhenti sendiri sesudah 5 menit, spam dan rumah pintar hanya
  bila dicentang, tidak menggeser jadwal asli, satu uji aktif per pengguna.
- **K-45 (2026-10-07, P3) Tes Postgres sungguhan ikut `pnpm test`** (`tests/pg`, memakai DB
  pengembangan dari `.env.local`, data uji dihapus lagi). Dilewati bila DB tidak ada, kecuali
  `WAJIB_PG_ASLI=1` (CI menyiapkan DB sebelum tes). Alasan: PGlite satu koneksi tidak bisa
  membuktikan SKIP LOCKED dan LISTEN lintas koneksi.
- **K-46 (2026-10-07, P4) Soal deterministik dari benih.** Soal = fungsi(jenis, tingkat, benih)
  dengan PRNG mulberry32 32 bit; urutan tarikan acak di `src/lib/soal/soal.ts` adalah spesifikasi
  untuk port Rust. Contoh emas dibuat oracle Python terpisah. Server memakai benih acak kripto.
  Bentuk pengurangan dibuat tanpa coba ulang (b dulu, lalu a > b) supaya hasil selalu ≥ 1.
- **K-47 (2026-10-07, P4) Jawaban luring diperiksa ulang.** Soal ke-i untuk PC luring memakai benih
  4 bait pertama SHA-256("antikebo-luring:" + kunci kejadian + ":" + i); server menghitung ulang
  soal yang sama dan aturan turun tingkat, menerima bila target benar berturut tercapai, dan hanya
  dalam 6 jam sesudah jadwal. PC tidak bisa memilih soal gampang.
- **K-48 (2026-10-07, P4) Kode QR: isi tersandi amplop + hash.** Hash untuk mencocokkan pindaian,
  isi tersandi supaya halaman cetak bisa dibuka lagi kapan saja. Maks 10 kode per pengguna; kode
  yang masih dipakai alarm tidak bisa dihapus; kode milik orang lain ditolak saat menyimpan alarm.
- **K-49 (2026-10-07, P4) Jawaban disimpan sebagai HMAC-SHA256 bergaram** dengan kunci turunan
  `SESSION_SECRET` (tidak bisa ditebak dari salinan DB). Bila rahasia diputar saat alarm berbunyi,
  soal aktif tidak bisa dicocokkan; sesudah 3 salah soal baru dibuat dengan kunci baru (tidak buntu).
- **K-50 (2026-10-07, P4) "Masih bangun?"**: sesudah soal terjawab alarm langsung diam (status
  `cek_bangun`), waktu bangun dicatat saat itu; pertanyaan muncul N menit kemudian dan bisa diketuk
  sampai batasnya (diterima 5 dtk lebih awal untuk selisih jam). Tidak diketuk = berbunyi lagi penuh,
  tunda dimatikan, soal baru. Uji alarm tidak memakai "Masih bangun?".
- **K-51 (2026-10-07, P4) Selama ditunda, soal bangun tetap bisa dijawab** untuk mematikan alarm lebih
  awal. Soal tunda selalu Ringan 1 kali (PRD §15).
- **K-52 (2026-10-07, P4) Misi QR:** kode lain (termasuk kode milik sendiri yang tidak dipilih alarm)
  dihitung salah; 3 salah berturut atau kamera ditolak = diganti hitungan Berat 3 soal (PRD D6).
  Ketik kalimat memakai judul agenda bila paling sedikit 8 huruf, selain itu kalimat penyemangat.
- **K-53 (2026-10-07, P4) Penjaga `jalur-alarm`**: fungsi berhenti/tunda/lolos hanya boleh dipakai
  `mesin.ts` dan `layanan/jawab.ts`; rute yang memakai layanan jawab wajib lewat `penjawabDari`
  (sesi pemilik + cek asal, atau token perangkatnya); modul MCP dilarang mengimpor layanan jawab
  atau mesin status dan dilarang punya alat bernama mematikan/menunda/menjawab.
- **K-54 (2026-10-07, P5) Bunyi alarm berformat WAV PCM 16 bit mono 22,05 kHz**, bukan OGG Opus +
  MP3 seperti rencana awal `10-SUARA.md`. Alasan: MP3/Opus menambah bantalan senyap di awal dan
  akhir sehingga putaran ulang terdengar bercelah; WAV bisa diulang tanpa celah di semua peramban dan
  rodio. Ukuran total 8 bunyi sekitar 1 MB, kecil untuk cache Service Worker. Kekerasan −14 LUFS
  (ITU-R BS.1770 dengan pembobotan K dan gerbang), puncak sampel ≤ −1,5 dBFS (sisa 0,5 dB untuk
  puncak antar-sampel supaya ≤ −1 dBTP). Berkas di repo wajib sama persis dengan sintesis ulang (tes).
- **K-55 (2026-10-07, P5) Kunci klip = sha256 dari versi, bahasa, gaya, id suara, dan teks yang
  sudah diisi**, tanpa nama penyedia. Alasan: penyedia ditentukan AgentBuff pengguna dan baru
  diketahui sesudah klip dibuat; mengganti penyedia di AgentBuff tanpa mengganti id suara tetap
  memakai klip lama sampai teks atau suara berubah. Klip sama dipakai lintas alarm (PRD F7).
- **K-56 (2026-10-07, P5) Antrean suara:** galat tetap = `belum_diizinkan`, `teks_tidak_sah`,
  `permintaan_tidak_sah`, `tidak_dikenal`, `klien` (berhenti dan tampil di status alarm); galat lain
  diulang dengan jeda 1, 2, 4, ... menit, paling lama 6 jam, dan `ulangiSetelahMs` dari AgentBuff
  dihormati. Begitu izin suara diberi, naskah yang gagal karena belum diizinkan diantre ulang
  otomatis. Naskah yang ditinggal worker mati lebih dari 5 menit dikembalikan ke antrean.
- **K-57 (2026-10-07, P5) Isi naskah:** nama sapaan = nama panggilan, atau nama depan dari
  AgentBuff, atau "kamu". Kalimat agenda hanya dibuat bila judul bukan judul bawaan ("Bangun").
  Karakter Kustom wajib punya paling sedikit satu kalimat pribadi dan hanya memutar kalimat pribadi
  (tanpa kalimat waktu, cek, penutup karakter). Hanya alarm aktif yang dimintakan suara.
- **K-58 (2026-10-07, P5) Pemutar web:** 3 detik pertama bunyi alarm saja, lalu omelan bergantian
  dengan jeda 3 detik. Bila layar dibuka terlambat dan beberapa menit waktu terlewat sekaligus, hanya
  kalimat menit terbaru yang diputar. Klip diunduh di depan begitu audio jalan. Klip tidak ada =
  suara bawaan perangkat berbahasa sama (kecepatan 1,1); tanpa suara perangkat = teks omelan tampil
  besar dan bunyi tidak diredam. Berkas bunyi gagal dimuat = nada bip 880 Hz dari peramban, jadi
  alarm tidak pernah diam. Bila peramban menahan audio, tampil ajakan "Ketuk layar"; ketukan apa pun
  (termasuk papan angka soal) membuka audio.
- **K-59 (2026-10-07, P5) Klip diunduh lewat `/api/perangkat/klip/[hash]`** dengan token perangkat
  atau sesi pemilik, `Cache-Control: private, immutable` karena isi klip untuk satu hash tidak pernah
  berubah. Klip pengguna lain tidak bisa diunduh (RLS + uji).
- **K-60 (2026-10-07, P5) Bersih-bersih suara:** naskah dan klip yang tidak dibutuhkan alarm mana
  pun dan tidak dipakai 30 hari dihapus worker.
