# Catatan keputusan

Format: kode, tanggal, keputusan, alasan. Keputusan baru ditambah di bawah. Keputusan yang butuh
Chief ditaruh di "Menunggu Chief" sampai dijawab, sementara pekerjaan lain tetap jalan.

## Menunggu Chief

- **K-07 (2026-10-06) Perilaku saat hak AgentBuff berakhir.** Rekomendasi: data tetap, mengubah
  dikunci, alarm yang sudah ada tetap berbunyi 3 hari masa tenggang, pemberitahuan H-3 dan malam
  sebelum alarm berhenti. Alasan: alarm yang tiba-tiba diam bisa membuat orang telat kerja atau
  kuliah, lebih parah dari aplikasi biasa yang sekadar terkunci. Sampai dijawab, kode memakai
  rekomendasi ini di satu modul aturan supaya mudah diubah (dijalankan sejak P13, lihat K-110 dan
  `src/lib/agentbuff/aturan-beku.ts`).
- **K-114a (2026-10-07, P13) Pengendali data dan tinjauan hukum.** Halaman Privasi dan Ketentuan menyebut
  "AntiKebo di Marketplace AgentBuff" dan kontak support@agentbuff.id tanpa nama badan hukum.
  Rekomendasi: Chief mengisi nama badan hukum pengendali data dan meminta tinjauan ahli hukum sebelum
  terbit (naskah sudah sesuai kenyataan sistem). Sampai dijawab, naskah tetap seperti sekarang.
- **K-116 (2026-10-08) Kabar beku lewat kanal untuk akun yang haknya berakhir.** Kabar "aksesmu
  berakhir" dan peringatan malam sebelum alarm ditahan dikirim lewat `/masuk/kabar`, tetapi kontrak
  (05 §4, urutan K-25) memeriksa hak lebih dulu sehingga pintu asli akan menjawab `tidak_berhak` dan
  hanya notifikasi web yang sampai. Rekomendasi: `/masuk/kabar` tetap menerima pesan selama 96 jam
  sesudah hak berakhir (tenggang 3 hari + malam sebelumnya) dengan izin dan batas jeda yang sama;
  diputuskan dan dibangun saat L1, lalu 05 §4, tiruan, dan `tests/integrasi/beku.test.ts` disesuaikan
  (`SISA-PEKERJAAN.md` §2).

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
- **K-61 (2026-10-07, P6) Isi pesan spam:** pembuka bervariasi (12 kalimat id/en, semua terpakai
  sebelum ada yang diulang) + satu kalimat omelan karakter/agenda/pribadi (sama dengan naskah suara,
  sudah berisi nama) + baris agenda + menit sejak berbunyi + tautan `/app/bunyi/<kejadian>`.
  Deterministik per kejadian, kanal, dan nomor pesan, jadi langkah yang diulang sesudah worker mati
  mengirim teks yang sama dengan kunci idempoten yang sama. Paling panjang 1000 huruf.
- **K-62 (2026-10-07, P6) Pesan penutup** hanya ke kanal yang sempat menerima spam, sesudah status
  benar-benar `bangun` (bila "Masih bangun?" aktif: sesudah "Masih!" diketuk). Bila AgentBuff minta
  menunggu jeda kanal, penutup dicoba lagi sesudah jeda itu. Tidak ada penutup untuk tidak bangun.
- **K-63 (2026-10-07, P6) Aturan langkah spam:** platform kanal (untuk jeda) diambil dari daftar
  kanal AgentBuff sekali per kejadian lalu dibawa ke ulangan; gagal diambil = jeda paling aman 45 dtk.
  Galat yang menghentikan kanal untuk kejadian itu: kanal tidak siap, belum diizinkan, tidak berhak,
  tidak dikenal, klien, teks tidak sah, permintaan tidak sah. Galat lain dicoba lagi pada jeda
  berikutnya. `terlalu_cepat` menggeser sesuai `ulangiSetelahMs` (1 dtk sampai 10 menit) dan dicatat
  "ditunda". Batas spam dihitung dari mulai berbunyi pertama (masa tunda ikut terhitung). Penghitung
  pesan berlanjut sesudah tunda.
- **K-64 (2026-10-07, P6) Notifikasi web:** Web Push standar (aes128gcm + VAPID); pustaka `web-push`
  hanya untuk enkripsi dan tanda tangan, pengirimannya `fetch` sendiri (batas waktu 10 dtk).
  Endpoint hanya boleh ke layanan push peramban yang dikenal (Google/Android, Mozilla, Windows, Apple)
  supaya server tidak bisa disuruh memanggil alamat sembarang; maks 10 peramban per pengguna;
  dijawab 404/410 = langganan dilepas; keluar = langganan peramban itu dilepas. Selama berbunyi
  notifikasi diulang tiap 30 dtk dengan tag kejadian (diganti, bergetar lagi, ditahan); sesudah
  berhenti diganti "Alarm sudah mati" tanpa bunyi, karena Chrome mewajibkan setiap push menampilkan
  notifikasi (menutup diam-diam tidak bisa diandalkan).
- **K-65 (2026-10-07, P6) Kunci VAPID wajib di web dan worker** sejak P6. Dibuat otomatis sekali oleh
  `scripts/siapkan-lokal.sh` (pengembangan, CI) dan `deploy/pasang-pertama.sh` (VPS, dari openssl) dan
  tidak pernah diganti: mengganti kunci memutus semua langganan notifikasi pengguna.
- **K-66 (2026-10-07, P6) Pengingat malam:** dikirim ke kanal bawaan di Pengaturan; bila kosong, ke
  kanal alarm berikutnya; plus notifikasi web. Hanya bila ada alarm dalam 24 jam; satu per malam
  (`pengguna.pengingat_terkirim`); tidak dikirim bila worker baru menyala lebih dari 2 jam sesudah
  jam tidur. Perangkat dianggap siaga bila detak < 2 menit (sama dengan P3).
- **K-67 (2026-10-07, P6) Rute `GET/PATCH /api/app/preferensi`** dibuat sekarang (kanal bawaan dan
  pengingat malam di Pengaturan), dipakai juga P11. Bagian kanal, notifikasi, dan pengingat malam
  tampil di halaman Pengaturan yang sekarang; P11 memindahkannya ke rancangan P1.
- **K-68 (2026-10-07, P6, dicatat di P7) Playwright di CI memakai Chromium penuh** (`channel:
  "chromium"`, mode headless baru), bukan "headless shell" bawaan: shell tidak mendukung notifikasi
  dan push Service Worker, jadi uji notifikasi alarm tidak nyata. Sesi cloud memakai Chromium
  bawaan sesi. Uji push menunggu Service Worker benar-benar `activated` supaya tidak berpacu.
- **K-69 (2026-10-07, P7) Sambungan rumah pintar:** kunci `sk-` diuji ke Tuya (`homes/all`) sebelum
  disimpan, tersandi amplop (AAD terikat pengguna), yang tampil hanya samaran (`sk-SG••••3456`),
  tidak pernah dikirim ke peramban, agen, atau log. Tuya menolak kunci (kapan pun: uji perangkat,
  muat ulang, langkah alarm) = sambungan ditandai `kunci_bermasalah`, aksi alarm berhenti dengan
  catatan, spanduk perbaikan di Beranda dan Rumah pintar; kunci baru yang lolos uji memulihkannya.
  Putuskan = kunci dan cermin perangkat dihapus, aturan di alarm tetap (berlaku lagi bila disambung
  ulang). Alamat Tuya tiruan (`TUYA_BASIS_UJI`) hanya dipakai bila `AGENTBUFF_TIRUAN=1`.
- **K-70 (2026-10-07, P7) Aturan rumah pintar per alarm diperiksa saat disimpan:** perangkat harus
  ada di akun dan sanggup melakukan aksinya (dari model Tuya), maks 20 aturan. Saat alarm diubah,
  pemeriksaan hanya bila isian `tuya` ikut diubah, supaya rumah yang sedang bermasalah tidak
  menghalangi mengubah jam atau soal. Sensor dan perangkat hanya-baca tampil "Hanya dipantau",
  tanpa tombol uji.
- **K-71 (2026-10-07, P7) Urutan aksi alarm:** aturan "sebelum X menit" direncanakan saat jadwal
  tinggal ≤ 61 menit; lampu naik satu langkah per menit dari 1% sampai terang tujuan (perangkat
  tanpa terang: sekali saat X menit sebelum). Kedip = 100% dan 10% bergantian tiap 3 dtk; saat
  tunda dan saat soal terjawab menunggu "Masih bangun?" kedip berhenti dengan lampu terang tetap
  (bukan tertinggal redup). Kedip tidak menunggu konfirmasi dan naik bertahap hanya dikonfirmasi di
  langkah pertama dan terakhir (hemat batas laju Tuya); aksi lain dikonfirmasi lewat laporan
  perangkat. Perangkat offline dilewati dan dicatat.
- **K-72 (2026-10-07, P7) Sesudah bangun:** "kembalikan" memakai potret keadaan sebelum aksi pertama
  kejadian, dipulihkan sekali per perangkat per kejadian; "suasana pagi" = lampu nyala 100%, putih
  60% (perangkat bukan lampu dilewati); "biarkan" mengembalikan lampu yang dikedipkan ke terang
  tujuannya. Suasana pagi dan aturan "sesudah" hanya untuk kejadian yang benar-benar `bangun`
  (sesudah "Masih!" bila Masih bangun aktif); dibatalkan atau tidak bangun tidak menjalankannya.
  Uji perangkat di web = nyala (terang 100% bila lampu) lalu dikembalikan sesudah 2 dtk.
- **K-73 (2026-10-07, P7) Lapisan darurat:** mati bawaannya, tersembunyi di bagian Lanjutan Rumah
  pintar; pilihan telepon atau SMS, sesudah 10/15/20/30 menit (server menerima 5 sampai 60). Bila
  belum bangun, Tuya menghubungi nomor akun Smart Life pengguna sendiri tiap 5 menit, maks 15 dalam
  24 jam terakhir per pengguna, berhenti saat tunda, tidak untuk uji alarm. AntiKebo tidak pernah menyimpan
  nomor telepon.
- **K-74 (2026-10-07, P8) Susunan halaman aplikasi:** gerbang sesi dan hak di `src/app/app/layout.tsx`;
  halaman berkerangka (Beranda, Pengaturan, Rumah pintar, cetak kode QR) di grup `(utama)` beserta
  pengawas SSE; layar alarm penuh di `/app/bunyi/<id kejadian>` tanpa kerangka. Pengawas membuka
  layar alarm saat ada yang berbunyi atau saat "Masih bangun?" tiba, juga sesudah koneksi pulih.
- **K-75 (2026-10-07, P8) Rincian skor bangun:** potongan menit memakai menit penuh dari berbunyi
  sampai soal terjawab; skor sementara ditampilkan saat menunggu "Masih bangun?"; hari beruntun
  dihitung mundur dari hari terbaru, hari tanpa kejadian terhitung (libur, tanpa alarm) dilewati,
  satu kejadian di bawah 70 memutus. Uji alarm menampilkan "Uji", bukan skor.
- **K-76 (2026-10-07, P8) Dua alarm bersamaan** (PRD B8 "bergantian") dikerjakan satu per satu:
  layar menandai "1 dari 2", sesudah satu lolos langsung pindah ke yang lain tanpa Selamat pagi;
  Selamat pagi muncul sesudah yang terakhir.
- **K-77 (2026-10-07, P8) Lembar Ubah alarm:** alarm baru bawaan 06.00, sekali (kemunculan jam itu
  berikutnya), isi lain dari bawaan pengguna. Menyimpan perubahan hanya mengirim isian yang berubah,
  supaya pemeriksaan yang tidak perlu (rumah pintar) tidak menghalangi. Tombol dengar karakter
  memakai suara bawaan perangkat (contoh instan); contoh suara AgentBuff lewat antrean biasa. Uji
  alarm dari lembar dengan pilihan ikut spam chat dan rumah pintar (bawaannya tidak). Ketik kalimat
  menolak tempel. Geser kartu (lewati/hapus) hanya di layar sentuh; aksi yang sama ada di lembar.
- **K-78 (2026-10-07, P8) Hitung mundur** (tunda, Masih bangun, Beranda) memakai jam server saat
  halaman dibuat untuk render pertama, lalu jam perangkat, supaya teks server dan peramban sama.
- **K-79 (2026-10-07, P8) Uji ujung ke ujung memakai worker sungguhan** (`pnpm worker` dinyalakan
  uji). Uji alarm ditunggu 60 detik penuh (jalur asli); alarm lain dimajukan jadwalnya, batas tunda,
  dan waktu "Masih bangun?" langsung di DB pengembangan supaya uji tidak menunggu menit. Uji
  membersihkan alarm akun contoh sesudahnya.
- **K-80 (2026-10-07, P9) PWA:** manifest dari Next (`src/app/manifest.ts`), mulai di `/app`, tampil
  `standalone`, pintasan ke Mode Jam Meja. Ikon dibuat skrip dari logo: 192/512 bersudut (any),
  512 latar penuh dengan zona aman 72% (maskable), ikon iPhone 180 latar penuh tanpa sudut.
- **K-81 (2026-10-07, P9) Simpanan Jam Meja:** Service Worker hanya menyimpan bunyi alarm
  (`/bunyi/*.wav`) dan klip omelan pengguna (`/api/perangkat/klip/<hash>`), paling banyak 300 berkas,
  disamakan dengan jadwal 24 jam ke depan setiap jadwal berubah (yang tidak diminta lagi dibuang),
  dan disajikan dari simpanan dulu. Halaman lain tidak pernah disimpan. Keluar menghapus simpanan.
- **K-82 (2026-10-07, P9) Jam Meja membunyikan alarm di halaman yang sama**, memakai satu konteks
  audio yang dibuka ketukan "Mulai siaga" (dipakai bersama pemutar, tidak ditutup), supaya alarm
  bersuara tanpa ketukan lagi (iPhone hanya membuka audio di dalam ketukan). Sesudah Selamat pagi
  kembali siaga.
- **K-83 (2026-10-07, P9) Cadangan lokal Jam Meja:** server diberi 5 detik sesudah jadwal; bila kabar
  `berbunyi` tidak datang dan server tidak terjangkau, perangkat berbunyi sendiri dari simpanan.
  Alarm lokal tidak bisa dimatikan di perangkat (aturan teknis 2, beda dengan soal luring PC K-47):
  soal muncul begitu koneksi kembali; bila ternyata sudah dimatikan di perangkat lain, berhenti.
  Jadwal yang lewat lebih dari 30 menit tidak dibunyikan lokal.
- **K-84 (2026-10-07, P9) Detak Jam Meja** tiap 30 detik dengan kemampuan (dicas, suara jalan, layar
  ditahan menyala); `siapSampai` hanya dikirim bila semua bunyi + klip sudah tersimpan. Id perangkat
  disimpan di peramban dan didaftarkan ulang bila perangkat dicabut; nama dari jenis perangkat
  (iPhone, iPad, HP Android, Tablet Android, Peramban), bisa diganti di tab Siaga (P11).
- **K-85 (2026-10-07, P9) Keluar dari Jam Meja:** geser ke atas atau tombol saat layar terang;
  konfirmasi bila alarm tinggal kurang dari 8 jam. Peringatan amber berurutan: koneksi putus, tidak
  dicas, layar tidak bisa ditahan menyala.
- **K-86 (2026-10-07, P10) Jendela alarm PC = tampilan bawaan aplikasi (`pc/ui`), bukan halaman web
  yang dimuat dengan token.** Menyimpang dari docs/09 §3 butir 2 yang semula memuat halaman web.
  Alasan: satu tampilan yang sama untuk daring dan luring (tidak perlu dua jalur), token perangkat
  tidak pernah masuk WebView (hanya proses utama Rust yang memegangnya), dan jendela tetap muncul
  walau server sedang tidak terjangkau. Jendela hanya boleh meminta jalur soal kejadian lewat
  proses utama (`jalur_jendela_sah`: lihat soal, jawab, tunda, ganti soal, Masih bangun).
- **K-87 (2026-10-07, P10) Pembaruan PC:** kunci publik ed25519 tertanam di aplikasi
  (`pc/src-tauri/tauri.conf.json`, kosong sampai L3), bukan env server; env `PC_UPDATE_PUBKEY`
  diganti `UNDUH_DIR` (folder pemasang yang disajikan `/unduh/pc/*`). Selama kunci publik kosong,
  aplikasi tidak memeriksa pembaruan. CI Windows memakai kunci sekali pakai bila rahasia repo
  `TAURI_SIGNING_PRIVATE_KEY` belum ada, supaya jalur tanda tangan terbukti; tag `pc-v*` menolak
  jalan tanpa kunci asli. Kunci privat hanya di mesin rilis Chief (L3).
- **K-88 (2026-10-07, P10) Penjaga = exe yang sama dengan argumen `--penjaga <pid> <folder>`**, proses
  terpisah tanpa jendela (bukan berkas `antikebo-penjaga.exe` tersendiri, supaya pemasang dan
  pembaruan tetap satu berkas). Hidup hanya selama siaga; saling menyalakan ulang dalam ±1 detik
  (paling banyak 5 kali per menit). Keluar sah menulis `keluar-sah`, akhir siaga menulis
  `penjaga-henti`. Terbukti di Linux: proses utama dibunuh paksa, menyala lagi sendiri.
- **K-89 (2026-10-07, P10) Misi QR di PC:** PC tidak memindai kode QR; jendela alarm menyarankan
  pindai lewat HP atau "Ganti soal hitungan" (aturan kamera tidak tersedia PRD D6: hitungan Berat
  3 kali benar). Soal luring PC selalu hitungan (K-47).
- **K-90 (2026-10-07, P10) Mesin alarm PC murni di `pc/inti` (`alarm.rs`)**: server lebih dulu atau
  jadwal lokal sesudah tenggang 5 detik (sama dengan Jam Meja), ditandai `kunci@saat` sehingga
  tidak dobel dan tunda berbunyi lagi; jadwal yang diminta sebelum peristiwa terakhir diabaikan
  (tidak membunyikan lagi alarm yang baru berhenti); aplikasi dinyalakan ulang saat server masih
  berbunyi = berbunyi lagi. Tombol Keluar dan Putuskan dikunci selama alarm hidup (berbunyi,
  ditunda, Masih bangun) dan selama jendela Komitmen (`kunciMulai` dari server).
- **K-91 (2026-10-07, P10) Jadwal perangkat membawa `komitmen`, `kunciMulai`, `siagaMulai` (jam tidur
  atau 8 jam sebelum alarm, mana yang lebih awal), `cekPada`/`cekBatas`, serta `nama` sapaan dan
  `bahasa` pengguna** (layar Selamat pagi di PC). Bentuknya dijaga contoh emas
  `tests/emas/jadwal-perangkat.json` yang dibaca tes TypeScript dan Rust.
- **K-92 (2026-10-07, P10) Klien PC dipisah ke crate `pc/klien` tanpa Tauri** dan diuji ujung ke ujung
  oleh `uji-pc` melawan server + worker sungguhan (sambung lewat kode, SSE, soal server, soal
  luring). Bagian khusus Windows (jendela terkunci, suara, volume, daya, kredensial) dicek tipe
  untuk target Windows dan dibangun penuh di CI Windows; perilakunya di PC asli diuji di L2.
- **K-93 (2026-10-07, P10) Token PC di Windows Credential Manager lewat crate `windows`**
  (`CredWriteW`, generik, per pengguna), bukan crate `keyring` (API-nya sedang berubah besar). Di
  luar Windows (pengembangan) disimpan berkas izin 600.
- **K-94 (2026-10-07, P10) Kamus PC = potongan kamus web** (`src/lib/i18n/kamus-pc.ts` ke
  `pc/ui/kamus.js` + `kamus.json`), dijaga tes supaya tidak basi. Bahasa sebelum tersambung:
  Indonesia bila Windows berbahasa atau berwilayah Indonesia; sesudahnya mengikuti pilihan pengguna.
- **K-95 (2026-10-07, P10) Catatan diagnosa PC:** `antikebo.log` (paling besar 1 MB, diputar) di folder
  data aplikasi berisi kejadian penting (mulai, SSE, berbunyi, berhenti, omelan) tanpa token,
  rahasia, atau isi soal; dipakai menelusuri uji manual L2.
- **K-96 (2026-10-07, P11) "Siap malam ini" = siaga (detak < 2 menit) + `siapSampai` perangkat sampai
  alarm berikutnya.** Perangkat yang tidak mengirim `siapSampai` (suara belum tersimpan semua) =
  belum siap; tanpa alarm aktif cukup siaga. Satu aturan (`src/lib/tampilan/siap.ts`) dipakai tab
  Siaga dan spanduk Beranda. Menggantikan aturan sementara K-42 ("siap = siaga sekarang").
- **K-97 (2026-10-07, P11) Riwayat "perangkat yang berbunyi" (PRD K1) = perangkat siaga saat alarm mulai
  berbunyi**, dicatat worker ke `kejadian_alarm.perangkat_berbunyi` (salinan id, nama, jenis) di
  transaksi klaim. Bukti bunyi keluar dari speaker tiap perangkat tidak ada di server, jadi layar
  menulis "Perangkat siaga saat berbunyi", bukan "berbunyi di". Perangkat yang menghentikan
  (`selesai_oleh` + `perangkat_selesai`) dan hasil aksi rumah pintar (`tuya_pra`, `tuya`:
  dijalankan, offline, gagal) ikut di rincian. Isi soal dan jawaban tidak pernah tampil di Riwayat.
- **K-98 (2026-10-07, P11) Riwayat dan skor hanya dari kejadian sungguhan yang selesai** (bangun,
  cek bangun, tidak bangun, terlewat); uji, dibatalkan, dan yang masih berjalan tidak masuk. Hari
  beruntun dihitung dari 1 tahun terakhir. Ekspor CSV memakai kolom dalam bahasa pengguna, BOM
  UTF-8 (Excel), dan sel yang diawali `= + - @` diberi kutip tunggal (cegah injeksi rumus).
- **K-99 (2026-10-07, P11) Hapus semua data (PRD A5):** konfirmasi ketik `HAPUS` (`DELETE` di bahasa
  Inggris). Ditolak selama alarm berbunyi dan selama jendela Mode Komitmen (kalau tidak, hapus data
  jadi jalan pintas mematikan alarm terkunci). Semua baris milik pengguna dihapus (termasuk kunci
  Tuya, perangkat siaga, klip suara, token agen, catatan aktivitas), semua sesi dicabut, baris
  `pengguna` tetap dengan `dihapus_pada` dan preferensi kembali bawaan, kecuali bahasa dan zona.
  Masuk lagi = akun bersih mulai dari perkenalan. Peramban ikut dibersihkan (klip Jam Meja,
  langganan notifikasi).
- **K-100 (2026-10-07, P11) Perkenalan pertama (PRD J):** Beranda mengarahkan ke `/app/orientasi`
  selama `orientasi_selesai` kosong (halaman lain tetap bisa dibuka, jadi tombol "Pasang di PC
  ini", "Jam meja", dan "Sambungkan rumah" boleh meninggalkan perkenalan). Nama panggilan diisi
  nama depan dari AgentBuff; langkah 1 dan 2 wajib, 3 sampai 6 bisa "Nanti". Langkah terakhir
  menandai selesai lalu membunyikan alarm uji 1 menit lagi dengan bawaan pengguna. Contoh karakter
  memakai suara peramban (pratinjau gaya), sama dengan lembar alarm.
- **K-101 (2026-10-07, P11) Bawaan alarm baru diatur di satu lembar** (karakter, suara AgentBuff, bunyi,
  soal, tunda, Komitmen, Masih bangun, libur, batas waktu); kanal spam bawaan tetap di bagian Kanal
  pesan (dipakai juga pengingat malam) dan tidak dikirim lembar bawaan supaya tidak saling timpa.
  Template di Pengaturan hanya buatan pengguna (ganti nama, hapus); template bawaan selalu ada di
  lembar alarm baru. Baris "Suara" rancangan P1 (§4.10) digabung ke lembar bawaan (suara
  AgentBuff + dengar contoh + bunyi), karena suara memang bagian bawaan alarm (PRD M). Baris Agen
  (token MCP) menyusul di P12, Privasi di P13.
- **K-102 (2026-10-07, P11) Akun tiruan keempat "Sari Pengguna Baru" (aktif)** untuk uji yang harus mulai
  dari nol (perkenalan, pengaturan, hapus data, Siaga, Riwayat) supaya data Nugi untuk uji lain tidak
  tersentuh.
- **K-103 (2026-10-07, P12) Isian alat MCP bahasa Inggris snake_case** (`time`, `repeat`, `agenda_title`,
  `challenge.level`, `snooze.count`, `smart_home[].when`, ...), mengikuti pola template Tuya; satu modul
  murni (`src/lib/mcp/peta.ts`, dites bolak-balik) menerjemahkan ke isian layanan. Id karakter dan bunyi
  tetap id internal (`bos_killer`, `sirene`), dijelaskan `list_characters`. Teks jawaban alat lewat
  kamus `mcp` (bahasa pengguna), tambahan galat bernama Inggris (`locked_until`, `reason`).
- **K-104 (2026-10-07, P12) Idempotensi alat pembuat lewat `client_ref`** (opsional, unik per niat):
  diklaim dulu sebelum alat jalan, hasil disimpan di `idempotensi_mcp` (RLS) 30 hari, panggilan
  ulang mendapat hasil pertama dengan `replayed: true`; panggilan yang gagal melepas rujukannya; yang
  masih berjalan dijawab `in_progress`. Alat merusak wajib `confirm: true`.
- **K-105 (2026-10-07, P12) Penjaga `paritas` membaca `src/lib/mcp/paritas.ts` sebagai teks** (satu entri
  per baris): setiap `POST/PATCH/PUT/DELETE` di `/api/app/*`, `/api/kejadian/*`, `/api/keluar` wajib
  punya alat atau pengecualian beralasan; entri tanpa rute dan alat yang tidak ada = gagal; kalimat
  deskripsi alat yang memuat "stop/snooze/answer/... the alarm" tanpa penyangkal = gagal. Rute
  protokol perangkat (`/api/perangkat/*`) dan server AgentBuff (`/api/agentbuff/*`) di luar lingkup.
- **K-106 (2026-10-07, P12) Ekspor riwayat lewat agen = tautan tersegel berlaku 15 menit**
  (`/unduh/riwayat?t=`, AES-GCM dengan kunci turunan `SESSION_SECRET`), supaya pengguna bisa membuka
  dari HP tanpa sesi; token palsu atau kedaluwarsa = 404.
- **K-107 (2026-10-07, P12) Halaman Agen** (`/app/agen`, dari Pengaturan > Lainnya): status sambung
  otomatis AgentBuff, contoh kalimat, aktivitas = catatan audit 40 terakhir (siapa: kamu, agen,
  perangkat, sistem), token manual 1 tahun untuk klien MCP lain (tampil sekali), cabut lewat lembar
  konfirmasi. Membuat dan mencabut token adalah pengecualian paritas (keputusan pemilik di web).
- **K-108 (2026-10-07, P12) Alat tambahan di luar daftar awal** karena ada aksi webnya:
  `save_alarm_as_template`, `test_notification`, `set_home_emergency`, `get_event_detail`;
  `regenerate_voice` mengantre ulang naskah suara yang gagal (layanan `buatUlangSuara`).

- **K-109 (2026-10-07, P13) Jalur bangun tidak pernah dibekukan.** Layar berbunyi, "Masih bangun?",
  Selamat pagi, dan Jam Meja tetap terbuka saat akses beku atau AgentBuff tak terjangkau; gerbang hak
  (`GerbangHak`) hanya di kerangka aplikasi dan perkenalan, dan pengawas alarm tetap jalan di layar
  beku. Alasan: dulu layout `/app` memblokir layar berbunyi padahal penjadwal tetap membunyikan alarm,
  sehingga pengguna web tidak bisa menjawab soal untuk menghentikannya.
- **K-110 (2026-10-07, P13) Rekomendasi K-07 kini benar-benar dijalankan** (sebelumnya baru tertulis):
  `status_hak.beku_sejak` dicatat dari jawaban "tidak berhak" pertama (migrasi `0010_beku`), tenggang
  72 jam di satu modul murni (`src/lib/agentbuff/aturan-beku.ts`, contoh emas `tests/emas/beku.json`).
  Selama beku: API web menolak perubahan (`403 akses_beku`), kecuali hapus semua data, cabut token agen,
  putuskan perangkat, dan notifikasi (hak privasi dan keamanan); alarm yang sudah terpasang tetap
  berbunyi sampai akhir tenggang, lalu ditahan penjadwal (kejadian `dibatalkan`, tidak masuk Riwayat,
  kejadian berikutnya tetap disiapkan) dan disaring dari jadwal perangkat siaga. Worker memeriksa hak
  pemilik yang punya alarm dalam 48 jam (basi 6 jam bila aktif, 1 jam bila beku), mengirim kabar sekali
  saat beku terdeteksi (notifikasi + kanal bawaan, dengan jam berhenti di zona pengguna), dan malam
  sebelum alarm pertama yang ditahan mengirim peringatan tegas walau pengingat malam dimatikan.
  AgentBuff tak terjangkau tidak pernah membekukan (K-12). Angka 3 hari tetap menunggu Chief (K-07).
- **K-111 (2026-10-07, P13) Perbaikan aksesibilitas dari audit axe** (0 pelanggaran WCAG 2.2 AA di semua
  halaman, kedua tema): grafik Riwayat = gambar dekoratif + tabel angka yang bisa dibuka ("Lihat
  tabel"); daftar statistik Riwayat label + nilai; semua kelompok radio buatan sendiri mendukung panah
  dan Home/End (`gerakRadio`); lembar memindah fokus ke dirinya saat terbuka (bukan ke isian pertama,
  supaya papan ketik HP tidak muncul); soal angka menerima ketikan begitu layar alarm tampil; layar
  siaga Jam Meja tetap redup tetapi jam minimal 3:1 dan teks bantu 4,5:1. Naskah uji pembaca layar di
  perangkat asli: `docs/AKSESIBILITAS.md`.
- **K-112 (2026-10-07, P13) Pembatas laju bersama dan batas untuk semua rute.** `PembatasLaju`
  (`src/lib/keamanan/laju.ts`) membuang jendela basi lalu yang tertua saat penuh, tidak pernah
  dikosongkan sekaligus (dulu banjir kunci acak bisa menghapus semua batas). Batas baru: rute baca
  600/menit/pengguna, SSE 60/menit, jadwal perangkat 120, klip 300, periksa hak 10, jawab soal 120 per
  pengguna (selain 30 per kejadian), detak 120 per pengguna; id dari klien divalidasi (uuid) sebelum
  jadi kunci batas. MCP dibatasi per PENGGUNA, bukan per token (120 perintah, 40 perubahan, 300
  permintaan per menit), token manual maksimal 10. MCP tidak dibatasi per IP karena agen AgentBuff
  semua pengguna bisa berbagi alamat IP; token 256 bit tidak bisa ditebak. Redaksi log diperluas
  (token bersarang, rahasia, langganan push). Pembungkus `rute()` yang tidak dipakai dihapus.
- **K-113 (2026-10-07, P13) Mode Komitmen juga mengunci aksi di luar alarm yang melemahkannya**: memutus
  perangkat siaga, memutus rumah pintar, dan mematikan lapisan darurat ditolak selama jendela kunci
  (web, PC, dan MCP; `commitment_locked` dengan `reason` `disconnect_device`, `disconnect_home`,
  `emergency_off`). Memperkuat tetap boleh. Melengkapi K-34.
- **K-114 (2026-10-07, P13) Halaman legal publik** `/privasi` dan `/ketentuan` (tanpa masuk, naskah di kamus
  `legal` id/en, berlaku 7 Oktober 2026), ditautkan dari halaman depan, Masuk, dan Pengaturan > Privasi.
  Isinya mengikuti kenyataan sistem (data apa, pihak lain, kuki, retensi, hak pengguna, bukan jaminan,
  Komitmen, aplikasi PC belum bertanda tangan). Kontak: support@agentbuff.id.
- **K-115 (2026-10-07, P13) Anggaran performa diukur di build produksi** (`tests/e2e/anggaran.spec.ts`,
  cache dingin per halaman): JS awal ≤ 300 KB terkirim, CLS < 0,1, LCP < 2,5 dtk di mesin uji (FCP
  dipakai bila peramban tidak melaporkan LCP; angka 0 tidak pernah lulus). Hasil P13: JS awal 156
  sampai 223 KB, CLS 0, LCP paling lama 0,4 dtk. Angka di HP asli dengan jaringan lambat tetap wajib
  diukur di produksi (L3).
