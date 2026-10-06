# PRD AntiKebo

Konsep dan alasannya ada di `01-KONSEP.md`. Dokumen ini daftar kebutuhan yang harus dipenuhi
untuk rilis. Setiap fitur punya kode (mis. `B2`) supaya bisa dirujuk dari rencana kerja, tes,
dan PR. Semua fitur di sini masuk cakupan rilis.

## 1. Ringkasan produk

| | |
|---|---|
| Nama | AntiKebo |
| Janji | "Alarm yang tidak berhenti sampai kamu benar-benar bangun." |
| Harga | Rp29.000 sekali bayar di Marketplace AgentBuff (`billing: one_time`) |
| Syarat platform | Akses AgentBuff pengguna harus aktif (aturan semua produk Marketplace) |
| Alamat | `https://antikebo.agentbuff.id` |
| Bahasa | Indonesia (utama) dan Inggris |
| Pengguna sasaran | Mahasiswa dan pekerja yang sering kesiangan, pemilik perangkat Tuya/Smart Life, pengguna AgentBuff yang ingin mengatur alarm dari chat |

## 2. Akun dan akses (A)

- **A1 Masuk dengan AgentBuff.** Satu-satunya cara masuk. Pola persis template Tuya (OIDC + PKCE,
  `sub` per aplikasi sebagai kunci akun). Tombol ke `/auth/...` memakai `<a>` biasa.
- **A2 Cek hak.** Dicek di setiap pintu (halaman, API, MCP, worker). Alasan tolak tampil ramah di
  `/masuk` dengan tautan perpanjang.
- **A3 Saat hak beku.** Lihat `KEPUTUSAN.md` K-07 (menunggu Chief). Rekomendasi: data tetap,
  ubah-ubah dikunci, alarm yang sudah ada tetap berbunyi selama 3 hari masa tenggang dengan
  pemberitahuan jelas, malam sebelum alarm berhenti pengguna diberi tahu.
- **A4 Orientasi pertama kali** (wizard, bisa dilewati per langkah, bisa diulang dari Pengaturan):
  1. Selamat datang dan janji produk.
  2. Pasang ke HP (panduan per platform) dan izinkan notifikasi.
  3. Sambungkan Tuya (opsional): tempel kunci `sk-`, pilih perangkat untuk membangunkan, isi
     nomor HP yang terdaftar di Tuya untuk telepon.
  4. Sambungkan Telegram (opsional).
  5. Uji coba: alarm 1 menit lagi, rasakan Tangga Bangun versi singkat, jawab tantangan.
- **A5 Hapus semua data.** Dari Pengaturan, dengan konfirmasi ketik. Menghapus kunci Tuya,
  tautan Telegram, langganan push, dan semua alarm.

**Lulus bila:** alur beli, masuk, orientasi, beku, dan perpanjang terbukti dengan skrip bukti
seperti `prove-tuya-beli`.

## 3. Alarm (B)

- **B1 Buat, ubah, hapus.** Mengubah alarm mempertahankan ID dan riwayatnya.
- **B2 Pengulangan** (semua benar-benar jalan): sekali (tanggal tertentu), harian, hari kerja
  (Sen-Jum), akhir pekan, hari pilihan, tiap N minggu, bulanan pada tanggal X (tanggal 31 di bulan
  pendek jatuh ke hari terakhir), bulanan pada hari ke-N (mis. Senin pertama).
- **B3 Lewati.** "Lewati sekali" hanya melewati kejadian berikutnya tanpa mematikan alarm.
  "Lewati tanggal" untuk tanggal tertentu. Bisa dibatalkan.
- **B4 Hari libur nasional Indonesia.** Opsi per alarm "jangan bunyi saat libur nasional".
  Data libur disimpan sebagai berkas data bertahun-tahun dengan sumber tercatat, plus tes.
- **B5 Zona waktu.** Per pengguna (bawaan `Asia/Jakarta`), bisa per alarm. Semua perhitungan
  memakai zona waktu yang benar, disimpan UTC.
- **B6 Label dan catatan** pendek, tampil saat berbunyi dan dibacakan suara.
- **B7 Tingkat.** Lembut, Normal, Nuklir (tabel di `01-KONSEP.md`), plus "Kustom" yang bisa
  mengubah tangga, tunda, dan tantangan dalam batas aman.
- **B8 Suara.** Pustaka suara dengan lisensi jelas (CC0 atau buatan sendiri dengan Web Audio).
  Lisensi dicatat di `public/suara/LISENSI.md`. Pratinjau 5 detik. Suara lama (MP3 di aplikasi
  lama) tidak boleh dipakai karena asalnya tidak jelas.
- **B9 Alarm berikutnya.** Kartu utama berisi hitung mundur ("Bangun 6 jam 12 menit lagi").
- **B10 Banyak alarm** berbunyi bersamaan tidak saling menimpa; masing-masing punya kejadian sendiri.
- **B11 Uji coba alarm** dari daftar alarm: bunyi 1 menit lagi dengan tangga singkat.
- **B12 Batas wajar:** maks 50 alarm, 30 rutinitas, 100 pengingat per pengguna.

**Lulus bila:** mesin pengulangan punya tes contoh emas (zona waktu, akhir bulan, tahun kabisat,
libur, lewati) dan tes properti (`fast-check`): kejadian berikutnya selalu di masa depan dan
konsisten.

## 4. Tangga Bangun (C)

- **C1 Preset** per tingkat sesuai `01-KONSEP.md`.
- **C2 Kustom:** daftar langkah, masing-masing punya waktu relatif (menit sebelum/sesudah),
  jenis (perangkat, push, Telegram, telepon, suara Mode Malam, rutinitas), dan parameter.
- **C3 Matahari terbit:** kecerahan dan suhu warna lampu naik bertahap sebelum jam alarm.
- **C4 Terus naik** sampai pengguna lolos tantangan. Ulangan punya batas (lihat C5).
- **C5 Batas:** telepon Tuya maks 15/hari/nomor dan pesan sama maks 2 per 50 detik; spam Telegram
  maks 1 pesan per 3 detik dan maks 120 pesan per kejadian; push diulang tiap 30 detik.
- **C6 Jejak pengiriman:** setiap langkah tercatat (terkirim, gagal, dilewati karena offline/batas)
  dan terlihat di riwayat kejadian.

## 5. Saluran (D)

- **D1 Notifikasi push (PWA).** Banyak perangkat per pengguna. Notifikasi alarm memakai `tag` yang
  sama, `renotify`, `requireInteraction`, getar, dan tombol "Buka". Langganan yang mati dibersihkan.
- **D2 Telegram.** Bot AntiKebo. Tautkan lewat tautan `t.me/<bot>?start=<kode sekali pakai>`.
  Spam berisi penghitung dan kalimat bervariasi (tanpa LLM), tombol "Buka tantangan". Setelah
  bangun, pesan spam dihapus otomatis dan diganti satu ringkasan. Bisa diputus dari aplikasi.
- **D3 Telepon suara Tuya** (`voice/self-send`) dengan pesan pendek berisi label alarm.
- **D4 Push Smart Life** (`push/self-send`).
- **D5 Mode Malam.** Layar jam redup (hemat layar OLED, warna hangat), Wake Lock, status "siap
  membangunkan", suara keras saat berbunyi (lewat `<audio>` dan audio session playback), pengatur
  waktu cadangan lokal kalau sambungan putus, peringatan bila baterai lemah atau tidak dicas.
- **D6 Suara ucapan** di layar berbunyi: membacakan label dan kalimat penyemangat (Web Speech API
  bahasa Indonesia), dengan cadangan bila tidak tersedia.

## 6. Perangkat Tuya (E)

- **E1 Sambungkan kunci `sk-`** milik pengguna (buat kunci khusus "AntiKebo" di Hey Tuya).
  Validasi, wilayah dari dua huruf setelah `sk-`, disimpan tersandi. Panduan bergambar.
- **E2 Daftar perangkat** dan status (cermin lokal, disegarkan berkala).
- **E3 Aksi per jenis:** lampu (nyala/mati, kecerahan, warna, suhu warna), colokan, tirai,
  sirene, AC Wi-Fi, perangkat lain sesuai kemampuan yang dilaporkan Tuya.
- **E4 Konfirmasi** bahwa perangkat benar-benar berubah (pola `konfirmasi` di template).
- **E5 Perangkat offline** dilewati, dicatat, dan pengguna diberi tahu sekali.
- **E6 Uji perangkat** dari aplikasi.
- **E7 Masalah kunci** (kedaluwarsa, dicabut) memberi status jelas dan panduan memperbarui.

## 7. Tantangan dan tunda (F)

- **F1 Hitungan:** 3 tingkat, soal dibuat dan diperiksa di server, jawaban tidak pernah dikirim
  ke peramban, batas waktu per soal, harus benar berturut-turut. Salah: hitungan ulang dan suara
  lebih keras.
- **F2 Kode Bangun:** daftarkan benda dengan memindai QR/barcode (atau cetak stiker QR dari
  aplikasi). Saat berbunyi harus memindai benda itu. Kamera lewat `BarcodeDetector` dengan
  cadangan pustaka untuk iPhone.
- **F3 Ketik kalimat** persis sama.
- **F4 Goyang HP** sejumlah kali (sensor gerak, minta izin di iPhone).
- **F5 Gabungan** untuk Nuklir (mis. hitungan lalu Kode Bangun).
- **F6 Tunda** dengan batas per tingkat; di Normal tunda kedua butuh satu soal.
- **F7 Anti curang:** hanya sesi pengguna yang bisa mematikan; tantangan terikat ke kejadian;
  tidak ada alat MCP atau API kunci-internal untuk mematikan.
- **F8 Jalan keluar aman:** bila kamera ditolak atau Kode Bangun hilang, setelah 3 kali gagal
  tantangan diganti hitungan tingkat sulit (tidak pernah buntu total).

## 8. Cek Masih Bangun (G)

- **G1** Pertanyaan "Masih bangun?" N menit setelah bangun (bawaan 5, bisa 3 sampai 15, bisa
  dimatikan di Lembut). Tidak dijawab dalam 2 menit: tangga mulai lagi dari langkah kedua.

## 9. Rutinitas (H)

- **H1** Buat, ubah, hapus rutinitas (nama, ikon, daftar aksi perangkat berurutan dengan jeda).
- **H2** Jalankan manual dengan hasil per perangkat.
- **H3** Jadwal sendiri yang benar-benar otomatis (memakai mesin pengulangan B2).
- **H4** Pasang ke alarm: sebelum berbunyi, saat berbunyi, atau setelah bangun.
- **H5** Rutinitas tidur: pengingat tidur dan lampu meredup hangat pada jam tidur.

## 10. Pengingat (I)

- **I1** Pengingat dengan judul, waktu, pengulangan (B2), prioritas (biasa/penting). Penting
  memakai tangga ringan (push, Telegram, lampu berkedip sekali). Ada di UI, bukan cuma API.

## 11. Riwayat dan statistik (J)

- **J1 Riwayat kejadian:** berbunyi, ditunda, bangun (dengan tantangan apa), terlewat, gagal kirim.
- **J2 Skor bangun** harian (rumus tertulis di `03-ARSITEKTUR.md` dengan tes contoh emas),
  hari beruntun, rata-rata waktu dari berbunyi sampai bangun, jumlah tunda.
- **J3 Grafik:** 7 dan 30 hari, peta tunda per jam dan hari.
- **J4 Ekspor** riwayat ke CSV.

## 12. Agen AgentBuff lewat MCP (K)

- **K1 Alat MCP** (daftar lengkap di `03-ARSITEKTUR.md`): atur alarm, rutinitas, pengingat,
  lewati, statistik, status sambungan, uji alarm. **Tidak ada** alat mematikan/menunda alarm.
- **K2 Sambung otomatis** dari portal (pola `mcp-token` template).
- **K3 Halaman Agen:** token manual, cabut token.
- **K4 `skill/SKILL.md` pendamping** dengan kata kunci Indonesia ("bangunin", "alarm", "pengingat").

## 13. PWA dan tampilan (L)

- **L1** Manifest, ikon, layar pembuka, panduan pasang per platform.
- **L2** Kerangka luring: aplikasi tetap terbuka tanpa internet, Mode Malam tetap berbunyi.
- **L3** Responsif dari 320 px sampai desktop, teks 200% tanpa geser samping.
- **L4** Tema terang dan gelap, latar ambient mengikuti waktu (pagi/siang/sore/malam).

## 14. Pengaturan (M)

Zona waktu, tingkat bawaan, saluran bawaan, jam tenang pengingat, Telegram, Tuya dan nomor HP
telepon, perangkat push terdaftar, suara bawaan, bahasa, ulang orientasi, privasi, hapus data.

## 15. Operasional (N)

- **N1** Detak jantung worker; bila berhenti lebih dari 60 detik, Chief diberi tahu (Telegram).
- **N2** Log terstruktur tanpa rahasia dan tanpa isi pesan pribadi.
- **N3** Metrik: jumlah kejadian, keterlambatan berbunyi (p50/p95), kegagalan per saluran.
- **N4** Kejadian terlewat karena gangguan: berbunyi saat pulih bila kurang dari 30 menit, dengan
  label "terlambat"; lebih dari itu, catat terlewat dan beri tahu pengguna.

## 16. Legal (O)

Kebijakan privasi, ketentuan, dan pernyataan jelas: AntiKebo membantu bangun tapi bukan jaminan;
untuk hal sangat penting pasang juga alarm cadangan di HP.

## 17. Kebutuhan non-fungsional

| Hal | Target |
|---|---|
| Ketepatan berbunyi | p95 di bawah 2 detik dari jam alarm |
| Web | LCP < 2,5 dtk, INP < 200 md, CLS < 0,1, JS awal ≤ 300 KB |
| API | p95 < 300 md |
| Aksesibilitas | WCAG 2.2 AA, kedua tema, target sentuh ≥ 44 px, `prefers-reduced-motion` |
| Keamanan | RLS di semua tabel pengguna, rahasia tersandi, CSP dengan nonce, batas laju |
| Bahasa | Semua teks lewat kamus i18n id dan en |
