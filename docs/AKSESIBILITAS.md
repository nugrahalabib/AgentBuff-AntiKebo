# Aksesibilitas AntiKebo

Acuan: WCAG 2.2 AA (PRD §18, `GERBANG-RILIS.md` butir 9). Dokumen ini mencatat apa yang sudah
dibuktikan otomatis di cloud dan naskah uji manual yang wajib dijalankan manusia di perangkat asli.

## 1. Bukti otomatis (cloud, setiap CI)

`tests/e2e/aksesibilitas.spec.ts`, dijalankan di proyek desktop (1280 px) dan HP (390 px):

| Uji | Isi | Hasil P13 |
|---|---|---|
| axe WCAG 2.2 AA | Halaman depan, Privasi, Ketentuan, Masuk (dengan pesan galat), Beranda, lembar Ubah alarm, Siaga, Riwayat, Pengaturan, Agen, Rumah pintar (belum dan sudah tersambung), Unduh PC, Jam Meja (sebelum dan sesudah Mulai siaga), cetak kode QR, Sambung PC, Perkenalan, layar berbunyi, Selamat pagi, layar beku; tema terang dan gelap | 0 pelanggaran |
| Reflow | Tanpa gulir mendatar di lebar 320 px (1.4.10) dan 640 px (setara zoom 200% di layar 1280, 1.4.4) untuk semua halaman di atas | Lolos |
| Papan ketik + pembaca layar | 5 alur hanya dengan papan ketik, setiap kontrol dicapai dengan Tab dan dikenali dari peran + nama (pohon aksesibilitas peramban) | Lolos |

Lima alur yang diuji:
1. Masuk dengan AgentBuff sampai Beranda (pilih akun dan izin dengan Spasi, Lanjutkan dengan Enter).
2. Buat alarm lewat lembar: fokus pindah ke dalam lembar saat terbuka, 40 kali Tab tidak pernah keluar
   lembar, "Alarm tersimpan" diumumkan lewat wilayah live, Esc menutup lembar dan fokus kembali ke
   tombol pemicunya.
3. Alarm berbunyi: soal dijawab hanya dengan mengetik angka lalu Enter (tanpa perlu memindah fokus),
   jawaban terbaca di `output` "Jawaban", umpan balik benar/salah lewat wilayah live.
4. Pengaturan: tema diganti dengan panah dan Spasi di kelompok radio (pola radio WAI-ARIA).
5. Riwayat: tombol "Lihat tabel" menampilkan angka grafik sebagai tabel berjudul (kolom Hari, Skor).

Yang diperbaiki di P13 karena audit ini (K-110, K-111): grafik Riwayat (label di elemen tanpa peran,
kini gambar dekoratif + tabel), struktur daftar statistik Riwayat, kontras tombol kecil di panduan
layar biru, kartu Masuk melebar di 320 px, kelompok radio buatan sendiri tanpa navigasi panah, fokus
lembar tidak masuk ke lembar, soal angka yang baru menerima ketikan sesudah fokus dipindah, dan
kontras layar siaga Jam Meja (jam redup kini tetap 3:1, teks bantu 4,5:1).

## 2. Naskah uji pembaca layar di perangkat asli (wajib, L2)

Jalankan di **VoiceOver** (iPhone Safari) dan **TalkBack** (Android Chrome), lalu NVDA atau Narator di
Windows (Chrome) untuk laptop. Pakai akun uji yang sudah membeli AntiKebo. Catat hasil per langkah
(lulus, gagal + apa yang terdengar) di `KEPUTUSAN.md` bagian hasil L2.

1. **Masuk.** Buka halaman depan. Pastikan judul "Bangun beneran, bukan tidur lagi." terbaca sebagai
   judul, tombol "Masuk dengan AgentBuff" terbaca sebagai tautan. Masuk sampai Beranda.
2. **Alarm baru.** Dari Beranda, buka "Pasang alarm" (atau tombol tambah). Pastikan pembaca layar
   mengumumkan dialog "Alarm baru" dan fokus berada di dalamnya. Ubah jam lewat roda jam (geser
   atas/bawah di VoiceOver, tombol volume di TalkBack), isi "Mau bangun buat apa?", Simpan. Pastikan
   "Alarm tersimpan" diucapkan.
3. **Alarm berbunyi.** Pakai alat uji alarm (1 menit lagi). Saat berbunyi, pastikan judul alarm dan
   soal terbaca, papan angka bisa dipakai, umpan "Benar"/"Salah" diucapkan, dan Selamat pagi terbaca
   sesudah lolos.
4. **Pengaturan.** Ganti tema dan bahasa. Pastikan pilihan terbaca sebagai tombol radio dengan keadaan
   terpilih, dan perubahan tersimpan.
5. **Riwayat.** Buka Riwayat, pastikan skor hari ini, hari beruntun, rata-rata, total tunda terbaca
   berpasangan (label dan nilainya), lalu "Lihat tabel" membaca skor per hari.

Tambahan untuk PC (aplikasi AntiKebo untuk PC): jendela alarm penuh layar bisa dijawab dengan papan
ketik saja dan Narator membaca soalnya.
