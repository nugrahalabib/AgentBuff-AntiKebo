# Laporan perubahan AntiKebo

Entri terbaru di paling atas. Ditulis dari sisi pengguna dengan bahasa sehari-hari. Kelompok:
Baru, Diperbaiki, Diubah, Dihapus, Keputusan, Kesalahan, Masih butuh Chief, Untuk teknisi.

## 2026-10-07 (P10): AntiKebo untuk PC, alarm yang tidak bisa ditutup

**Baru**
- **Aplikasi AntiKebo untuk PC (Windows 10 dan 11).** Pasang sekali, tekan **Sambungkan PC ini**,
  browser terbuka, tekan **Sambungkan**, selesai. Sesudah itu aplikasi diam di baki dan menyala
  sendiri saat Windows hidup.
- **Saat alarm:** layar alarm muncul menutupi layar, selalu di depan, tidak bisa ditutup, Alt+F4
  tidak mempan. Bunyi alarm + omelan diputar ke semua speaker (speaker laptop tetap bunyi walau
  headset tersambung) dan volume dinaikkan ke penuh terus selama berbunyi. Monitor tambahan ditutup
  layar gelap "Lihat layar utama".
- **Berhenti hanya dengan soal.** Jawab di PC, atau di HP/web: begitu soal terjawab di mana pun,
  PC ikut berhenti ("Soalnya sudah dijawab di perangkat lain"). Ada tunda (kalau jatahnya masih ada)
  dan "Masih bangun?".
- **Internet putus?** PC tetap berbunyi tepat waktu dari jadwal yang dipegangnya, dan memberi soal
  hitungan dari PC sendiri. Jawabannya dikirim dan diperiksa ulang server begitu internet kembali.
- PC tidak tidur selama ada alarm malam itu (layar boleh mati). Keluar dari aplikasi dikunci selama
  alarm berbunyi dan selama Mode Komitmen aktif.
- Kalau proses AntiKebo ditutup paksa saat siaga, ia menyala lagi sendiri dalam sekitar 1 detik.
- Jendela pengaturan kecil: status sambung, alarm berikutnya, daftar periksa (menyala saat Windows
  hidup, tidak tidur, laptop ditutup sambil dicas dengan tombol **Perbaiki**, speaker, dicas), tes
  bunyi "Kamu dengar? Ya / Tidak".
- **Halaman unduh** (Pengaturan, AntiKebo untuk PC): tombol unduh, panduan layar biru Windows 3
  langkah, dan sidik SHA-256 untuk memastikan berkasnya asli. Selama pemasang belum dirilis,
  halaman ini jujur bilang sedang disiapkan.

**Diubah**
- Jadwal yang dibaca perangkat siaga kini membawa info Mode Komitmen, awal siaga, nama sapaan, dan
  bahasa (dipakai aplikasi PC).
- Gambar layar biru di halaman unduh dirapikan (teks tidak lagi bertumpuk dengan tombol) dan memakai
  nama berkas yang benar.

**Diperbaiki**
- Alarm lama yang disimpan sebelum ada kalimat omelan pribadi tidak lagi membuat layar alarm galat.

**Keputusan**
- K-86 sampai K-95 (`KEPUTUSAN.md`). Yang terasa pengguna: layar alarm PC adalah tampilan bawaan
  aplikasi, jadi tetap muncul walau internet putus (K-86); Misi QR di PC disarankan dipindai lewat HP
  atau diganti soal hitungan (K-89).

**Masih butuh Chief**
- K-07 masih menunggu.
- **Wajib diuji di PC Windows asli (L2):** daftar `09-APLIKASI-PC.md` §9 (layar terkunci, volume 10%
  dan bisu, Alt+F4, cabut internet, matikan satu proses, headset Bluetooth, laptop ditutup, dua
  monitor, buka dua kali, suara bawaan Windows).
- **L3:** buat kunci pembaruan aplikasi PC dan simpan sebagai rahasia repo, lalu rilis `pc-v0.1.0`.

**Untuk teknisi**
- Workspace `pc/`: `inti` (logika murni + contoh emas yang sama dengan TypeScript), `klien` (HTTP +
  SSE + penguji `uji-pc`), `src-tauri` (aplikasi), `ui` (jendela). `cd pc && cargo test --workspace`.
- `tests/e2e/pc.spec.ts` menjalankan `pc/target/debug/uji-pc` melawan server + worker sungguhan
  (dilewati bila belum dibangun: `cd pc && cargo build -p antikebo-klien --bin uji-pc`).
- CI baru `.github/workflows/pc.yml` (Linux + Windows, pemasang NSIS sebagai artefak, terjemahan
  pemasang Bahasa Indonesia sendiri karena NSIS Tauri tidak punya); env `PC_UPDATE_PUBKEY` diganti
  `UNDUH_DIR` (folder pemasang, dipasang ke kontainer web).
- Bukti: 613 tes vitest, 29 tes Rust, 99 uji Playwright mode produksi (desktop + 390 px), aplikasi
  Tauri asli dijalankan di layar virtual Linux melawan server + worker lokal.

## 2026-10-07 (P9): HP jadi jam meja yang bisa membangunkan

**Baru**
- **Mode Jam Meja:** buka Pengaturan, Mode Jam Meja (atau tombol Siapkan di spanduk Beranda), lalu
  ketuk **Mulai siaga**. HP atau tablet jadi jam meja: jam besar redup berwarna hangat, pil "Siaga
  untuk 05.00", layar tetap menyala, ketuk untuk terang 5 detik, geser ke atas untuk keluar (ditanya
  dulu kalau alarm sudah dekat). Ada **Tes bunyi**.
- Saat alarm berbunyi, layar alarm muncul di HP itu juga, langsung bersuara tanpa perlu diketuk lagi.
  Sesudah Selamat pagi, HP kembali siaga.
- **Koneksi putus?** Bunyi alarm dan suara omelan sudah tersimpan di HP, jadi alarm tetap berbunyi
  tepat waktu. Soalnya muncul begitu koneksi kembali.
- Peringatan kalau HP tidak dicas, koneksi putus, atau layar tidak bisa ditahan menyala.
- HP yang siaga muncul di Beranda sebagai perangkat siaga.
- **Pasang ke layar utama:** AntiKebo kini bisa dipasang seperti aplikasi (ikon sendiri, tanpa bilah
  peramban), dengan panduan untuk iPhone, Android, dan laptop.

**Keputusan**
- K-80 sampai K-85 (`KEPUTUSAN.md`). Yang terasa pengguna: alarm saat koneksi putus tetap berbunyi
  tapi baru bisa dimatikan dengan soal begitu koneksi kembali (K-83).

**Masih butuh Chief**
- K-07 masih menunggu.
- **Wajib diuji di HP asli (L2):** iPhone dengan saklar senyap, layar tetap menyala, status dicas,
  pasang ke layar utama.

**Untuk teknisi**
- `src/app/manifest.ts`, ikon `scripts/bangun-ikon.ts`, simpanan di `public/sw.js`, jadwal lokal
  `src/lib/jam-meja/jadwal-lokal.ts`, pemutar bisa memakai konteks audio bersama.
- Bukti: 608 tes vitest, 87 uji Playwright mode produksi (termasuk koneksi putus).

## 2026-10-07 (P8): Pasang alarm sendiri dan matikan dengan soal

**Baru**
- **Pasang alarm dari Beranda.** Tombol + membuka lembar alarm: putar jam, tulis agenda, pilih hari
  (atau tanggal tertentu, tiap 2 minggu, tanggal tiap bulan, Senin pertama tiap bulan), karakter
  omelan (bisa didengar dulu), kalimat omelanmu sendiri, jenis soal, tunda, chat yang dispam, lampu
  dan AC, Mode Komitmen, Masih bangun, bunyi alarm (bisa didengar 5 detik), dan batas waktu.
- **Beranda hidup:** alarm berikutnya dengan hitung mundur, alarm lainnya dengan sakelar, geser
  kartu di HP untuk lewati sekali atau hapus. Ubah, gandakan, lewati, hapus, dan uji alarm ada di
  lembar alarm. Alarm yang dikunci Mode Komitmen menjelaskan sampai jam berapa.
- **Uji alarm:** berbunyi 1 menit lagi dengan soal ringan; boleh ikut spam chat dan lampu bila dicentang.
- **Layar alarm penuh:** judul agenda besar, bunyi dan omelan, soal langsung tampil: hitungan, ingat
  angka (tampil 3 detik), ketik kalimat, atau pindai kode QR (kamera ditolak? ganti soal hitungan).
  Jawaban salah = soal baru. Ada tombol tunda selama jatahnya masih ada, dengan soal ringan.
- Saat ditunda: layar tenang dengan hitung mundur, lalu berbunyi lagi sendiri.
- **Selamat pagi:** jam bangun, agenda hari ini, skor bangun, jumlah tunda, berapa menit sampai bangun.
- **Masih bangun?** muncul beberapa menit kemudian dengan tombol besar dan cincin hitung mundur.
- Dua alarm berbunyi bersamaan: dikerjakan satu per satu ("1 dari 2").
- Begitu alarm berbunyi, AntiKebo yang sedang terbuka langsung pindah ke layar alarm.

**Keputusan**
- K-74 sampai K-79 (`KEPUTUSAN.md`). Yang terasa pengguna: skor sementara di Selamat pagi dan hari
  libur tidak memutus hari beruntun (K-75), dua alarm satu per satu (K-76), alarm baru bawaan 06.00
  (K-77).

**Masih butuh Chief**
- K-07 masih menunggu.
- **Wajib diuji di perangkat asli (L2):** pindai kode QR dengan kamera HP, suara saat HP terkunci.

**Untuk teknisi**
- Rute web alarm, uji, dan kejadian; halaman `/app/bunyi/[id]`; grup `(utama)`; skor `src/lib/skor.ts`
  dengan contoh emas; uraian pengulangan `src/lib/tampilan/uraian.ts`; jam bersama tanpa beda hidrasi.
- Uji ujung ke ujung menyalakan worker sungguhan.
- Bukti: 598 tes vitest, 81 uji Playwright mode produksi.

## 2026-10-07 (P7): Lampu dan AC ikut membangunkan

**Baru**
- **Sambungkan rumah pintar** (Smart Life atau Tuya) di Pengaturan, Rumah pintar: tiga langkah,
  sekitar 3 menit, tanpa akun developer. Kunci yang ditempel langsung diperiksa ke Tuya; kunci salah
  ditolak dengan penjelasan, bukan galat.
- **Perangkatmu per ruangan** dengan status online. Tombol **Uji** menyalakan perangkat sebentar
  lalu mengembalikannya, dan memberi tahu apakah perangkat benar-benar merespons atau cuma "diterima
  tapi belum melapor". Sensor tampil "Hanya dipantau". Ada tombol muat ulang dan putuskan.
- **Aturan per alarm** (sudah bekerja di server; layar untuk mengaturnya menyusul di P8 dan alat
  agennya di P12): lampu menyala pelan
  dari redup ke terang mulai X menit sebelum alarm, perangkat menyala bareng alarm, lampu berkedip
  terang dan redup tiap 3 detik sampai kamu bangun, aksi saat tunda, dan sesudah bangun:
  kembalikan seperti semula, suasana pagi (lampu terang putih), atau biarkan. AC bisa diatur suhu
  dan modenya.
- Saat kamu menunda atau sudah menjawab soal dan menunggu "Masih bangun?", lampu berhenti berkedip
  tapi tetap terang, tidak ditinggal redup.
- **Lapisan darurat** (tersembunyi di Lanjutan, mati bawaannya): kalau sesudah sekian menit kamu belum
  bangun, Tuya menelepon atau SMS ke nomor akun Smart Life-mu sendiri, paling banyak 15 kali sehari.
- **Kunci kedaluwarsa atau dicabut**: muncul spanduk "Kunci rumah pintar bermasalah" di Beranda dan
  Rumah pintar, dengan tombol Perbarui kunci. Alarm tetap berbunyi seperti biasa.
- **Agenmu bisa** menyambungkan rumah dari kunci yang kamu tempel di chat, melihat perangkat, dan
  memutus rumah (harus dikonfirmasi).

**Diperbaiki**
- Uji ujung ke ujung notifikasi dan Misi QR kini stabil saat diulang (tidak lagi berpacu dengan
  Service Worker atau kehabisan jatah 10 kode QR).

**Keputusan**
- K-68 sampai K-73 (`KEPUTUSAN.md`). Yang terasa pengguna: kunci tidak pernah tampil lagi utuh
  (K-69), suasana pagi hanya bila benar-benar bangun (K-72), darurat mati bawaannya dan tidak
  menyimpan nomor teleponmu (K-73).

**Masih butuh Chief**
- K-07 masih menunggu.
- **Wajib diuji dengan perangkat asli (L2):** lampu, AC, dan colokan Tuya sungguhan; telepon/SMS
  darurat ke nomor asli.

**Untuk teknisi**
- Modul `src/lib/tuya/*` disalin dari template (`937aa8a`); tabel `sambungan_tuya`, `perangkat_tuya`,
  `potret_tuya` dengan RLS + uji 51/51. Saluran worker `src/lib/penjadwal/saluran-tuya.ts`; mesin
  mendapat fase `pra`/`tunda`, `rencanakanPra`, dan kait `rencanaCek`.
- Server Tuya tiruan ikut `pnpm tiruan` (port 3198, `TUYA_BASIS_UJI`).
- Bukti: 557 tes vitest, 72 uji Playwright mode produksi.

## 2026-10-07 (P6): Chat terus sampai bangun, notifikasi, dan pengingat malam

**Baru**
- **Spam chat saat alarm berbunyi.** Agenmu mengirim pesan terus ke Telegram, WhatsApp, Discord,
  Slack, atau Google Chat yang kamu pilih: Telegram tiap 15 detik, Discord/Slack/Google Chat tiap 20
  detik, WhatsApp tiap 45 detik (boleh diperlambat, tidak bisa lebih cepat dari batas aman). Isinya
  galak dan beda-beda, ada nomor pesan, judul agenda, sudah berapa menit, dan tautan ke layar alarm.
- Saat kamu menunda, pesannya berhenti dan lanjut lagi begitu tunda habis. Bisa juga diatur berhenti
  sendiri sesudah sekian menit.
- **Pesan penutup** sesudah kamu bangun: "Kamu bangun 05.07 (7 menit, tunda 1 kali). Selamat pagi!"
- **Notifikasi alarm di peramban**: muncul dan bergetar terus selama berbunyi walau AntiKebo tidak
  dibuka; diketuk langsung ke layar alarm; sesudah mati diganti "Alarm sudah mati".
- **Pengingat malam** di jam tidurmu: alarm besok, agendanya, dan apakah perangkat siaga sudah siap.
- **Pengaturan**: daftar kanal dari AgentBuff (yang belum siap tampil dengan alasannya), tombol
  **Kirim pesan uji**, pilih kanal bawaan, nyalakan notifikasi di peramban ini, nyala/mati pengingat
  malam.
- "Masih bangun?" juga dikabari lewat notifikasi dan satu pesan chat. Alarm yang terlewat karena
  server terganggu dikabari juga.

**Keputusan**
- K-61 sampai K-67 (`KEPUTUSAN.md`). Yang terasa pengguna: pesan penutup hanya ke chat yang sempat
  dispam (K-62), pengingat malam ke kanal bawaan (K-66).

**Masih butuh Chief**
- K-07 masih menunggu.
- **Wajib diuji di perangkat asli (L1/L2):** pesan lewat pintu AgentBuff asli; notifikasi di Android,
  iPhone (harus dari Layar Utama), dan Windows.

**Untuk teknisi**
- Tabel `kiriman_kanal` (jejak tanpa isi pesan) dan `langganan_push` (tersandi), RLS + uji 44/44,
  kolom `pengguna.pengingat_terkirim`.
- Saluran asli worker di `src/lib/penjadwal/saluran-asli.ts`; mesin punya fase saluran dan langkah
  sesudah selesai. Kunci VAPID kini wajib (dibuat otomatis).
- Bukti: 492 tes vitest, 68 uji Playwright mode produksi (termasuk notifikasi Service Worker dari push
  sungguhan lewat DevTools Protocol).

## 2026-10-07 (P5): Bunyi alarm dan omelan galak

**Baru**
- **8 bunyi alarm buatan sendiri** (Klasik, Digital, Sirene, Lonceng Sekolah, Alarm Kebakaran, Ayam,
  Nuklir, Naik Perlahan). Semua sama keras, berulang tanpa jeda, bebas lisensi.
- **Omelan 5 karakter** (Ibu Galak, Pelatih Tentara, Bos Killer, Teman Nyolot, Pacar Bawel) dalam
  bahasa Indonesia dan Inggris, memanggil namamu dan menyebut agendamu. Ada kalimat khusus sesudah 3,
  5, 10, 15, dan 30 menit kamu masih molor.
- **Kalimat pribadi**: sampai 10 kalimat buatanmu per alarm. Kata yang terlalu kasar ditolak.
  Karakter **Kustom** hanya memutar kalimatmu sendiri.
- **Suara dibuat oleh AgentBuff-mu** memakai pengaturan suaramu. Status di tiap alarm: "Suara siap",
  "Sedang dibuat (7 dari 22)", atau "Belum bisa dibuat" dengan alasan yang jelas (mis. beri izin suara
  dulu). Begitu izin diberi, suara dibuat ulang sendiri. Suara yang sama dipakai ulang di semua alarm,
  jadi tidak dibuat berkali-kali.
- **Saat berbunyi**: bunyi alarm terus jalan, omelan diputar bergantian dengan jeda 3 detik dan bunyi
  dikecilkan sebentar selama omelan. Belum ada suara dari AgentBuff? Omelan dibacakan suara bawaan
  HP/laptop. Tidak ada juga? Teksnya tampil besar. Berkas bunyi gagal dimuat? Alarm tetap berbunyi
  dengan bip.
- Kalau peramban menahan suara, muncul tombol "Ketuk layar untuk menyalakan suara".

**Keputusan**
- K-54 sampai K-60 (`KEPUTUSAN.md`). Yang terlihat pengguna: bunyi memakai format WAV supaya
  berulang tanpa celah (K-54); 3 detik pertama bunyi saja sebelum omelan (K-58).

**Masih butuh Chief**
- K-07 masih menunggu.
- **Wajib diuji di perangkat asli (L2):** rasa 8 bunyi di speaker HP/laptop, suara AgentBuff asli,
  iPhone dengan saklar senyap, suara bawaan HP berbahasa Indonesia.

**Untuk teknisi**
- Tabel `naskah_suara` dan `klip_suara` (RLS + uji RLS 38/38), kolom `alarm.kalimat_pribadi`.
- Worker `suara` (1 per pengguna, 4 total), jeda ulang berlipat sampai 6 jam, `klip_siap` lewat SSE.
- Pemutar `src/lib/suara/pemutar.ts`; urutan putar punya contoh emas dari oracle Python (dipakai Rust
  di P10).
- Bukti: 437 tes vitest, 62 uji Playwright mode produksi.

## 2026-10-07 (P4): Soal, tunda, "Masih bangun?", dan Misi QR

**Baru**
- **Soal hitungan tiga tingkat** sesuai aturan (Ringan, Sedang, Berat). Salah = soal baru, salah
  tiga kali berturut-turut = turun satu tingkat, jadi tidak pernah buntu.
- **Ingat angka** (6 digit, Berat 8 digit, hilang sesudah 3 detik) dan **ketik kalimat** (judul
  agendamu atau kalimat penyemangat; huruf besar/kecil dan spasi ganda tidak dipermasalahkan).
- **Misi QR**: buat kode QR, cetak, tempel jauh dari kasur. Saat berbunyi, alarm hanya mati kalau
  kode itu dipindai. Kamera ditolak atau salah tiga kali = diganti 3 soal hitungan berat.
- **Gabungan**: hitungan dulu, lalu Misi QR.
- **Tunda** butuh satu soal ringan dan hanya selama jatahnya masih ada.
- **"Masih bangun?"**: beberapa menit sesudah lolos, ketuk "Masih!". Kalau tidak diketuk, alarm
  berbunyi lagi penuh tanpa tunda.
- **Anti curang**: hanya kamu (sesi peramban) atau perangkat siagamu yang bisa menjawab, ada batas
  kecepatan menjawab, dan jawaban soal tidak pernah dikirim ke peramban atau dicatat.
- **PC luring**: kalau internet putus, soal di PC tetap bisa dijawab dan diperiksa ulang server
  begitu tersambung.

**Keputusan**
- K-46 sampai K-53 (`KEPUTUSAN.md`).

**Masih butuh Chief**
- K-07 masih menunggu.

**Untuk teknisi**
- Tabel `soal_kejadian` (jawaban HMAC bergaram) dan `kode_qr` (isi tersandi + hash), RLS + uji
  RLS 32/32. Kolom baru kejadian: `cek_pada`, `cek_batas`, `tanpa_tunda`, `selesai_oleh`.
- `src/lib/soal/` murni dan deterministik (dipakai juga Rust di P10), contoh emas dari oracle Python.
- Penjaga baru `jalur-alarm` (13 penjaga).
- Bukti: 364 tes vitest, 58 uji Playwright.

## 2026-10-07 (P3): Alarm benar-benar berbunyi tepat waktu dan perangkat bisa disambung

**Baru**
- **Penjadwal tepat detik.** Pada jam alarm, server langsung menandai alarm berbunyi dan mengabari
  semua perangkat. Di uji dengan Postgres sungguhan, selisihnya 1 sampai 2 milidetik.
- **Tidak pernah dobel.** Dua worker yang berebut alarm yang sama tidak membunyikannya dua kali.
- **Tahan restart.** Kalau server mati di tengah alarm berbunyi, worker baru melanjutkan alarm yang
  sama. Kalau server mati lebih dari 30 menit, alarm dicatat terlewat dan kamu dikabari.
- **Berhenti serentak.** Begitu alarm berhenti, PC dan peramban menerima kabarnya dalam hitungan
  milidetik (syaratnya 2 detik).
- **Sambungkan PC ini.** Aplikasi PC cukup membuka halaman "Sambungkan PC ini?", kamu cek kodenya
  sama, tekan Sambungkan, selesai. Kalau belum masuk, kamu masuk dulu lalu langsung kembali ke
  halaman itu. PC bisa diputus dari web kapan saja.
- **Perangkat siaga** (PC dan Jam Meja) mengirim detak dan menyimpan salinan jadwal 24 jam ke
  depan, supaya tetap bisa berbunyi walau internet putus.
- **Uji alarm:** bunyi 1 menit lagi dengan soal ringan untuk mencoba semuanya. (Tombolnya di P8.)
- **Batas berhenti sendiri** bekerja: kalau diatur, alarm berhenti sesudah X menit dan dicatat
  "tidak bangun".

**Keputusan**
- K-40 sampai K-45 (`KEPUTUSAN.md`).

**Masih butuh Chief**
- K-07 masih menunggu.

**Untuk teknisi**
- Tabel `perangkat_siaga` (RLS + cari lewat hash token), `kode_sambung` (global, hanya hash);
  pemicu NOTIFY `antikebo_peristiwa`; SSE `/api/peristiwa`; API `/api/perangkat/{kode,kode/ambil,
  detak,jadwal}` dan `/api/app/perangkat`.
- Mesin status kejadian di satu modul (`src/lib/penjadwal/mesin.ts`), penjadwal di worker
  (`penjadwal.ts`), saluran langkah tiruan untuk notifikasi, spam, Tuya (diisi P5 sampai P7).
- Bug yang ketemu dan diperbaiki saat uji: langkah yang direncanakan ulang sesudah tunda bentrok
  nomor urut dengan langkah lama, jadi notifikasi tidak lanjut sesudah tunda habis.
- Bukti: 237 tes vitest (termasuk 3 tes Postgres sungguhan), 54 uji Playwright, uji RLS 28/28.

## 2026-10-07 (P2): Otak alarm: pengulangan, lewati, libur, template, Mode Komitmen

**Baru**
- AntiKebo sekarang bisa menyimpan alarm lengkap: jam, agenda, pengulangan, karakter, bunyi, soal,
  tunda, spam chat, rumah pintar, Komitmen, "Masih bangun?", libur nasional, dan batas berhenti.
  Layarnya disambungkan di P8; agen AgentBuff di P12.
- Semua pengulangan benar-benar jalan: sekali, setiap hari, hari kerja, akhir pekan, hari pilihan,
  tiap N minggu, bulanan tanggal X (tanggal 31 jatuh ke hari terakhir bulan), dan bulanan hari ke-N
  (mis. Senin pertama, Jumat terakhir).
- **Lewati sekali** atau lewati tanggal tertentu tanpa mematikan alarm, dan bisa dibatalkan.
- **Libur nasional 2026 dan 2027** sesuai SKB 3 Menteri. Kalau dicentang, alarm diam saat tanggal
  merah. Cuti bersama tetap berbunyi.
- **Lima template bawaan:** Bangun kerja, Kuliah pagi, Sholat Subuh, Pengingat penting siang,
  Nuklir. Pengguna juga bisa menyimpan template sendiri (sampai 20).
- **Mode Komitmen** bekerja: dari jam tidur sampai alarm berbunyi, alarm tidak bisa dihapus,
  dimatikan, dilewati, dimundurkan, atau dibuat lebih ringan. Memajukan jam dan menambah alarm
  tetap boleh. Pesannya menyebut jam kapan kunci terbuka.
- Alarm yang sedang berbunyi tidak bisa diubah atau dihapus dari mana pun. Satu-satunya jalan
  tetap menjawab soal.
- Pengaturan dasar tersimpan: nama panggilan, zona waktu, bahasa, jam tidur, bawaan alarm baru,
  pengingat malam. Pindah zona waktu ikut memindahkan jadwal semua alarm.
- Pesan galat sudah dalam bahasa pengguna (Indonesia atau Inggris), tanpa istilah teknis.

**Keputusan**
- K-33 sampai K-39 (`KEPUTUSAN.md`).

**Masih butuh Chief**
- Bila Mode Komitmen terasa terlalu ketat (K-34: juga menolak membuat soal lebih ringan), bilang
  saja; aturannya ada di satu tempat.
- K-07 masih menunggu.

**Untuk teknisi**
- Tabel baru: `alarm`, `lewati_alarm`, `template_alarm`, `kejadian_alarm`, `langkah_kejadian`
  (RLS ENABLE + FORCE), kolom preferensi di `pengguna`. Indeks unik parsial menjamin satu kejadian
  menunggu per alarm.
- Mesin pengulangan murni + 57 contoh emas (dicek silang Python) + tes properti fast-check.
- `@date-fns/tz` untuk zona waktu; aturan jam musim panas sendiri (K-38).
- Bukti: 213 tes vitest, uji RLS 22/22 di PGlite dan Postgres 16, build hijau.

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
