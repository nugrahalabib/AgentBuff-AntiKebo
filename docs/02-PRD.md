# PRD AntiKebo (versi 2)

Konsep dan alasannya: `01-KONSEP.md`. Dokumen ini daftar kebutuhan rilis. Setiap kebutuhan punya
kode supaya bisa dirujuk dari rencana kerja, tes, dan PR. **Semua kebutuhan di sini masuk cakupan
rilis**; tidak ada "nanti saja" kecuali yang tertulis di §17.

## 1. Ringkasan

| | |
|---|---|
| Nama | AntiKebo |
| Janji | "Alarm yang tidak berhenti sampai kamu benar-benar bangun." |
| Harga | Rp29.000 sekali bayar, Marketplace AgentBuff |
| Syarat | Akses AgentBuff pengguna aktif + memiliki produk AntiKebo |
| Alamat | `https://antikebo.agentbuff.id` |
| Bahasa | Indonesia (utama) dan Inggris |
| Perangkat | Web/PWA (HP, tablet, laptop), aplikasi Windows "AntiKebo untuk PC" |
| Sasaran | Mahasiswa, pekerja, siapa pun yang sering kesiangan atau lupa agenda penting |

## 2. Akun, akses, izin (A)

- **A1 Masuk dengan AgentBuff** (OIDC, pola template Tuya). Satu-satunya cara masuk.
- **A2 Cek hak** di setiap pintu: halaman, API, MCP, worker, perangkat PC. Alasan tolak tampil
  ramah dengan tautan perbaikan.
- **A3 Izin AgentBuff.** Saat masuk pertama kali, layar persetujuan AgentBuff meminta dua izin
  tambahan: "Kirim pesan lewat agenmu" (spam kanal) dan "Buat suara memakai pengaturan suaramu"
  (omelan). Bila ditolak, AntiKebo tetap jalan dan menjelaskan fitur yang mati, dengan tombol
  untuk memberi izin.
- **A4 Saat hak berakhir** (lihat K-07). Malam sebelumnya pengguna diberi tahu terang-terangan
  bahwa alarm tidak akan berbunyi; data tetap tersimpan.
- **A5 Hapus semua data** dari Pengaturan, dengan konfirmasi ketik. Termasuk kunci Tuya,
  perangkat siaga, klip suara, riwayat.

**Lulus bila:** beli, masuk, izin diberi/ditolak, beku, perpanjang terbukti dengan skrip bukti.

## 3. Alarm (B)

- **B1 Buat, ubah, hapus.** Ubah mempertahankan ID dan riwayat.
- **B2 Isi alarm:** jam, pengulangan, **judul agenda** (wajib, maks 60 huruf, bawaan "Bangun"),
  **deskripsi agenda** (opsional, maks 200 huruf), karakter suara, soal, tunda, spam kanal,
  aturan perangkat Tuya, Mode Komitmen, "Masih bangun?", aktif/nonaktif.
- **B3 Pengulangan** yang semuanya benar-benar jalan: sekali (tanggal), harian, hari kerja,
  akhir pekan, hari pilihan, tiap N minggu, bulanan tanggal X (31 jatuh ke hari terakhir),
  bulanan hari ke-N (mis. Senin pertama).
- **B4 Lewati sekali** dan **lewati tanggal**, bisa dibatalkan, tanpa mematikan alarm.
- **B5 Libur nasional Indonesia:** opsi "jangan bunyi saat libur nasional", data bertahun dengan
  sumber resmi tercatat.
- **B6 Zona waktu** per pengguna (bawaan `Asia/Jakarta`), disimpan UTC.
- **B7 Alarm berikutnya** dengan hitung mundur di beranda.
- **B8 Alarm bersamaan** tidak saling menimpa. Bila dua alarm berbunyi bersamaan, layar
  menampilkan keduanya bergantian; soal yang dijawab mematikan satu per satu.
- **B9 Uji alarm:** bunyi 1 menit lagi di semua perangkat siaga, versi singkat (spam dan Tuya
  ikut bila dicentang), tetap dengan soal Ringan.
- **B10 Template alarm:** bawaan ("Bangun kerja", "Kuliah pagi", "Sholat Subuh", "Pengingat
  penting siang", "Nuklir") dan buatan pengguna. Membuat alarm dari template.
- **B11 Batas wajar:** maks 50 alarm, 20 template per pengguna.

**Lulus bila:** mesin pengulangan punya ≥ 40 tes contoh emas (zona waktu, akhir bulan, kabisat,
libur, lewati) dan tes properti.

## 4. Saat berbunyi (C)

- **C1 Serentak di detik 0:** layar alarm di semua perangkat siaga, bunyi + omelan, spam kanal,
  notifikasi, Tuya. Ketepatan p95 < 2 detik dari jadwal.
- **C2 Layar alarm:** judul agenda raksasa, deskripsi, jam, soal langsung tampil, jumlah tunda
  tersisa, tombol tunda (bila masih ada jatah).
- **C3 Pola suara:** omelan, jeda 3 detik bunyi alarm saja, omelan berikutnya. Bunyi alarm
  dikecilkan selama omelan lalu keras lagi. Urutan acak tanpa pengulangan berturut-turut.
  Kalimat hitungan waktu ("Sudah 5 menit!") disisipkan pada menit 3, 5, 10, 15, 30.
- **C4 Tidak berhenti** sampai soal terjawab (atau batas waktu yang diatur pengguna, bila ada;
  bawaan tanpa batas). Bila batas tercapai, kejadian dicatat "tidak bangun" dan pesan penutup
  dikirim.
- **C5 Kebenaran di server:** jawaban benar di satu perangkat menghentikan semua perangkat,
  spam, notifikasi, dan efek Tuya dalam ≤ 2 detik.
- **C6 Pulih:** worker restart di tengah alarm melanjutkan alarm yang sama. Kejadian terlewat
  karena gangguan server < 30 menit dibunyikan dengan label terlambat; lebih dari itu dicatat
  terlewat dan pengguna diberi tahu.

## 5. Soal (D)

- **D1 Hitungan** tiga tingkat (aturan pasti di §15), N benar berturut-turut (bawaan 2, 1 sampai
  5). Dibuat dan diperiksa di server; jawaban disimpan sebagai hash, tidak pernah dikirim ke
  peramban atau dicatat di log.
- **D2 Ingat angka:** 6 digit (Berat: 8) tampil 3 detik lalu disembunyikan.
- **D3 Ketik kalimat:** salin persis (huruf besar/kecil dan spasi ganda diabaikan). Sumber:
  judul agenda atau kalimat penyemangat.
- **D4 Misi QR:** pengguna membuat kode QR di AntiKebo (bisa dicetak atau ditampilkan di layar
  lain), menempelkannya di tempat jauh dari kasur. Saat berbunyi, kode harus dipindai kamera HP.
  Bisa lebih dari satu kode; pengguna memilih kode mana per alarm.
- **D5 Gabungan:** hitungan lalu Misi QR, dst.
- **D6 Tidak pernah buntu:** salah = soal baru tingkat sama; salah 3× berturut = turun satu
  tingkat (paling rendah Ringan). Kamera ditolak atau gagal pindai 3× = diganti hitungan Berat 3
  soal. Tidak ada batas waktu per soal.
- **D7 Anti curang:** soal terikat ke kejadian; hanya sesi pengguna atau perangkat siaga milik
  pengguna yang bisa menjawab; batas laju jawaban; tidak ada alat MCP atau API kunci-internal
  untuk mematikan, menunda, atau menjawab.
- **D8 Luring:** aplikasi PC yang kehilangan internet saat berbunyi tetap menampilkan soal yang
  dibuat lokal dan berhenti lokal bila benar; hasilnya disinkronkan begitu tersambung.

## 6. Tunda, Masih bangun, Komitmen (E)

- **E1 Tunda:** jatah 0 sampai 5 (bawaan 2), durasi 5, 10, atau 15 menit (bawaan 5). Tiap tunda
  butuh 1 soal Ringan. Selama tunda bunyi, omelan, spam berhenti; Tuya tetap pada keadaan alarm.
  Sesudah jatah habis tombol tunda tidak tampil.
- **E2 Masih bangun?** N menit sesudah lolos (bawaan 5, 3 sampai 15, bisa dimatikan). Tampil di
  semua perangkat siaga + notifikasi + satu pesan kanal. Tidak diketuk dalam 60 detik (60 sampai
  180) = alarm kembali penuh tanpa tunda, dengan soal baru.
- **E3 Mode Komitmen:** per alarm. Antara jam tidur dan jam alarm, alarm tidak bisa dihapus,
  dimatikan, dilewati, atau dimundurkan dari web, PC, maupun MCP (galat `commitment_locked`
  dengan kalimat yang menjelaskan). Memajukan jam dan menambah alarm tetap boleh. Jam tidur di
  Pengaturan (bawaan 22.00).

## 7. Suara dan bunyi (F)

Rincian di `10-SUARA.md`.

- **F1 Bunyi alarm** buatan sendiri (disintesis lewat skrip di repo, bebas lisensi), minimal 8
  pilihan, volume dinormalkan, pratinjau 5 detik.
- **F2 Karakter suara** bawaan minimal 5 (mis. Ibu Galak, Pelatih Tentara, Bos Killer, Teman
  Nyolot, Pacar Bawel) + Kustom. Tiap karakter ≥ 12 kalimat umum galak + 5 kalimat hitungan waktu,
  memakai nama panggilan. Naskah ada di repo sebagai data.
- **F3 Kalimat pribadi:** pengguna atau agen menulis sendiri (maks 10 kalimat per alarm,
  maks 150 huruf per kalimat). Disaring dari kata kasar yang melampaui batas wajar.
- **F4 Pembuatan suara lewat AgentBuff pengguna** (kontrak di `05-INTEGRASI-AGENTBUFF.md`),
  gaya galak, otomatis saat alarm disimpan. Status per alarm: "Suara siap", "Sedang dibuat",
  "Belum bisa dibuat" + alasan + tombol perbaikan.
- **F5 Pilihan suara:** daftar suara dari AgentBuff pengguna, dengan contoh dengar.
- **F6 Cadangan:** bila klip belum ada, naskah dibacakan suara bawaan perangkat. Bunyi alarm
  tidak pernah bergantung pada klip suara.
- **F7 Hemat:** klip dipakai ulang; dibuat ulang hanya bila teks, suara, atau gaya berubah.

## 8. Spam kanal dan notifikasi (G)

- **G1 Daftar kanal** diambil dari AgentBuff pengguna: platform, nama bot/agen, siap atau tidak
  + alasan.
- **G2 Pilih kanal per alarm** (bawaan dari Pengaturan). Jeda per platform: Telegram 15 dtk,
  Discord/Slack/Google Chat 20 dtk, WhatsApp 45 dtk; pengguna boleh memperlambat, tidak boleh
  lebih cepat dari batas minimal (Telegram 5, lainnya 15, WhatsApp 30).
- **G3 Isi pesan** galak bervariasi tanpa AI, dengan penghitung, judul agenda, menit berlalu, dan
  tautan ke layar alarm. Satu pesan penutup sesudah bangun.
- **G4 Pengingat malam** pada jam tidur ke kanal pilihan + notifikasi: alarm besok, agenda, status
  perangkat siaga.
- **G5 Notifikasi web** (PWA): diulang tiap 30 detik selama berbunyi (tag sama, `renotify`,
  `requireInteraction`, getar), mengetuknya membuka layar alarm.
- **G6 Jejak kiriman:** tiap pesan tercatat (terkirim, gagal + alasan, ditunda karena batas) dan
  terlihat di riwayat kejadian.
- **G7 Uji kanal:** kirim satu pesan uji dari Pengaturan.

## 9. Perangkat siaga (H)

- **H1 Daftar perangkat siaga:** PC (aplikasi) dan HP/tablet (Mode Jam Meja), nama, terakhir
  terlihat, status "siap malam ini".
- **H2 Mode Jam Meja** (web): ketuk "Mulai siaga" (membuka kunci suara + layar tetap menyala),
  jam redup, alarm berikutnya, tes bunyi, peringatan bila tidak dicas (bila peramban
  mendukung), detak ke server tiap 30 detik, pengatur waktu lokal sebagai cadangan, suara sudah
  disimpan di perangkat. iPhone: sesi audio "playback" supaya tetap bunyi walau saklar senyap
  (wajib diuji di HP asli).
- **H3 AntiKebo untuk PC:** seluruh `09-APLIKASI-PC.md`.
- **H4 Sambung PC:** aplikasi membuka browser ke halaman "Sambungkan PC ini" (sudah login), satu
  klik, selesai. Bisa diputus dari web.
- **H5 Status siaga di beranda** dan di pengingat malam.

## 10. Rumah pintar Tuya (I), opsional

- **I1 Sambung** dengan wizard 3 langkah meniru template Tuya, atau tempel kunci di chat.
- **I2 Daftar perangkat** per ruangan, status online, uji perangkat.
- **I3 Aturan per perangkat per alarm:** kapan (sebelum X menit dengan naik bertahap, bareng,
  saat tunda, sesudah bangun), aksi (nyala, mati, terang, warna, suhu putih, suhu dan mode AC),
  efek kedip (terang 100% dan 10% bergantian tiap 3 dtk sampai bangun), sesudah bangun (kembalikan
  keadaan sebelum alarm, suasana pagi, biarkan).
- **I4 Konfirmasi** perangkat benar-benar berubah (pola template); perangkat offline dilewati dan
  dicatat.
- **I5 Masalah kunci** (kedaluwarsa/dicabut) memberi spanduk perbaikan.
- **I6 Lapisan darurat** (tersembunyi, mati bawaannya): telepon/SMS Tuya ke nomor akun Smart Life
  sendiri bila belum bangun sesudah X menit, maks 15 per hari.

## 11. Orientasi pertama (J)

Satu kali sesudah masuk pertama, bisa diulang dari Pengaturan, tiap langkah opsional bisa "Nanti":

1. Sambutan + nama panggilan.
2. Pilih karakter suara (dengar contoh).
3. Siapkan perangkat: deteksi otomatis (Windows: "Pasang AntiKebo untuk PC"; HP: "Jadikan HP ini
   jam meja" + pasang ke layar utama + izinkan notifikasi).
4. Kanal spam: centang kanal dari AgentBuff (atau penjelasan cara menyambung kanal di AgentBuff).
5. Rumah pintar (opsional).
6. Uji coba: alarm 1 menit lagi, rasakan, jawab soal.

## 12. Riwayat dan statistik (K)

- **K1 Riwayat kejadian:** waktu berbunyi, tunda, soal yang dipakai, waktu bangun, Masih bangun,
  kiriman kanal, perangkat yang berbunyi.
- **K2 Skor bangun** harian (rumus di `03-ARSITEKTUR.md`), hari beruntun, rata-rata waktu sampai
  bangun, jumlah tunda. Grafik 7 dan 30 hari.
- **K3 Ekspor CSV.**

## 13. Agen lewat MCP (L)

- **L1 Paritas penuh** dengan web sesuai tabel `11-ALAT-MCP.md`. Guard `jaga` gagal bila ada fitur
  web tanpa alat MCP yang tidak tercantum sebagai pengecualian.
- **L2 Pengecualian sengaja:** mematikan/menunda alarm berbunyi, menjawab soal, melanggar
  Komitmen, aksi yang memang harus di perangkat (dijawab dengan tautan).
- **L3 Sambung otomatis** dari AgentBuff (pola `mcp-token` template) + halaman Agen (token
  manual, cabut).
- **L4 `skill/SKILL.md`** pendamping, kata kunci Indonesia ("bangunin", "alarm", "jam meja").

## 14. Pengaturan (M)

Nama panggilan, zona waktu, bahasa, jam tidur, bawaan alarm baru (karakter, suara, soal, tunda,
kanal, Komitmen, Masih bangun), pengingat malam, perangkat siaga, kanal, rumah pintar, kode QR,
token agen, ulang orientasi, privasi, hapus data.

## 15. Aturan soal hitungan (contoh emas wajib)

| Tingkat | Bentuk (dipilih acak) | Rentang |
|---|---|---|
| Ringan | `a + b`; `a − b` (hasil ≥ 1) | a, b 12 sampai 89 |
| Sedang | `a × b + c`; `a × b − c` (hasil ≥ 1) | a 3 sampai 12, b 3 sampai 9, c 5 sampai 40 |
| Berat | `(a + b) × c − d` (hasil ≥ 1); `a² + b` | a, b 2 sampai 15, c 3 sampai 9, d 1 sampai 40; untuk `a²`: a 6 sampai 15, b 5 sampai 40 |

Semua jawaban bilangan bulat positif ≤ 999. Soal tunda selalu Ringan.

## 16. Operasional dan legal (N)

- **N1** Detak worker; berhenti > 60 detik = operator diberi tahu.
- **N2** Log terstruktur tanpa rahasia, tanpa isi pesan pribadi, tanpa jawaban soal.
- **N3** Metrik: keterlambatan berbunyi p50/p95, kegagalan per kanal, klip suara gagal.
- **N4** Unduhan aplikasi PC + catatan versi + pembaruan otomatis.
- **N5** Kebijakan privasi, ketentuan, pernyataan "bukan jaminan", panduan layar biru Windows.

## 17. Di luar cakupan versi ini (keputusan Chief)

Aplikasi Android/iPhone native, Microsoft Store, aplikasi Mac, panggilan "Telepon Bangun" lewat
Telepon Agent, AI di dalam AntiKebo (selain pembuatan suara yang dilakukan AgentBuff pengguna).

## 18. Kebutuhan non-fungsional

| Hal | Target |
|---|---|
| Ketepatan berbunyi | p95 < 2 dtk dari jadwal (server dan perangkat siaga) |
| Berhenti sesudah lolos | ≤ 2 dtk di semua perangkat |
| Web | LCP < 2,5 dtk, INP < 200 md, CLS < 0,1, JS awal ≤ 300 KB |
| API | p95 < 300 md |
| Aplikasi PC | Pemasang ≤ 15 MB, RAM diam ≤ 80 MB, CPU diam ≈ 0% |
| Aksesibilitas | WCAG 2.2 AA, kedua tema, target sentuh ≥ 44 px, `prefers-reduced-motion` |
| Keamanan | RLS di semua tabel pengguna, rahasia tersandi, CSP nonce, batas laju |
| Bahasa | Semua teks lewat kamus i18n id dan en |
