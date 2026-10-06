# Desain AntiKebo

Arah: **modern, minimalis, gaya Apple, nyaman dipakai saat setengah sadar.** Rasanya seperti
aplikasi Jam dan Home di iPhone yang bertemu visionOS: kaca lembut di atas cahaya yang hidup,
angka jam besar, alur pendek, dan tidak ada yang membingungkan jam 5 pagi.

Acuan yang wajib dibaca: `referensi/template-tuya/src/app/globals.css` (token kaca, latar ambient
per waktu), `referensi/standar-agentbuff/BYM-DESAIN.md` (skala huruf, material, aksesibilitas),
`referensi/standar-agentbuff/PORTAL-PANDUAN-DESAIN-ROMBAK-UI.md`.

## 1. Aturan Chief yang sudah tetap (jangan dilanggar)

1. **Kaca selalu butuh cahaya di belakangnya.** Kaca di atas latar polos hanya jadi kartu putih.
   Untuk setiap permukaan baru tanya: (1) ini kaca? (2) ada cahaya di belakangnya? "Tenang"
   artinya cahaya latar lembut dan aksen hemat, **bukan** kartu yang makin padat.
2. Jangan gabungkan utilitas kaca dengan ring/shadow/bg di elemen yang sama. Pembungkus yang
   memakai `transform` mematikan `backdrop-filter`. Hover pakai `:not([aria-pressed=true])`.
3. **Teks pendek.** Keterangan maksimal satu baris pendek. Kartu: alasan 3 sampai 4 kata plus
   data utama. Huruf minimal 13 px. Tidak ada label huruf kapital berjarak gaya kode.
4. **Tidak ada tanda pisah panjang** (em dash/en dash) di teks UI. Guard `tanda-pisah` template.
5. **Popup:** di laptop dialog di tengah layar, di HP lembar dari bawah. Bukan panel di kanan.
6. Warna bermakna: hijau toska hanya untuk yang **hidup/aktif**, kuning amber untuk "butuh kamu",
   merah hanya untuk galat. Tombol utama grafit berbentuk pil (`rounded-full`).
7. Setiap aksi yang mengubah data punya label sedang proses, penanganan galat, dan tanda selesai
   yang terlihat. Bedakan "memuat" dan "kosong". Target sentuh ≥ 44 px. WCAG 2.2 AA.
8. Pesan galat mentah tidak pernah tampil ke pengguna.
9. Animasi: hormati `prefers-reduced-motion`. Jangan animasi `layout` framer di kotak berisi
   teks; ukur dengan ResizeObserver lalu animasikan tinggi lewat CSS.
10. Proses per layar utama: prototipe, tangkapan layar di PR (desktop dan 390 px, kedua tema)
    untuk dicek Chief, bangun, lalu bukti.

## 2. Bahasa visual

| Unsur | Keputusan |
|---|---|
| Huruf | SF Pro di perangkat Apple, cadangan Inter yang di-host sendiri. Angka jam pakai `ui-rounded`, `tabular-nums`, tebal ringan, sangat besar. |
| Latar | `latar-ambient` dengan `data-waktu` = pagi/siang/sore/malam (dari template Tuya), disetel di server supaya tidak berkedip. Cahaya lembut berwarna di belakang kaca. |
| Kaca | Token `--kaca`, `--kaca-kuat`, kelas `.kaca`, `.kaca-kuat`, `.kaca-nyala` dari template. Cadangan tanpa `backdrop-filter`. |
| Warna khas AntiKebo | **Fajar**: gradasi jingga ke merah muda lembut, hanya untuk layar berbunyi dan matahari terbit. Toska untuk alarm aktif. |
| Bentuk | Sudut besar dan konsisten bertingkat (lembar 28, kartu 22, kontrol 14, pil penuh). Pemisah lewat nada latar, bukan bayangan tebal. |
| Ikon | Lucide, garis 1,75. |
| Gerak | Pegas halus (`--ease-pegas`), tekan mengecil sedikit (`.tekan`), transisi 150 sampai 300 md. |
| Maskot | "Kebo", kerbau kecil yang lucu, dipakai hemat (layar kosong, orientasi, bangun berhasil). Tidak pernah dibungkus panel. |
| Tema | Terang dan gelap dirancang terpisah, sama-sama lolos kontras AA. |

## 3. Navigasi

- **HP:** bilah tab kaca di bawah: Alarm, Rutinitas, Riwayat, Pengaturan. Tombol `+` besar
  untuk alarm baru.
- **Laptop:** bilah samping kaca dengan menu yang sama, konten di tengah dengan lebar terbatas.

## 4. Layar dan alur

| Layar | Isi dan perilaku |
|---|---|
| **Beranda / Alarm** | Kartu utama "Alarm berikutnya": jam sangat besar, hitung mundur, chip tingkat dan ikon saluran aktif. Di bawahnya daftar alarm berupa kartu kaca dengan sakelar gaya iOS. Di HP geser kartu untuk "Lewati sekali" dan "Hapus". Layar kosong ramah dengan Kebo tidur dan satu tombol. |
| **Ubah alarm** | Lembar bawah (HP) atau dialog tengah (laptop). Roda pemilih jam besar seperti iOS. Kontrol tersegmen Lembut / Normal / Nuklir dengan satu baris penjelasan. Daftar bergrup: Ulangi, Label, Suara, Tantangan, Tangga Bangun, Perangkat, Saluran, Libur nasional. |
| **Tangga Bangun** | Garis waktu vertikal dari "10 mnt sebelum" sampai "+6 mnt", tiap langkah ikon saluran dan satu baris ringkasan. Tambah langkah lewat lembar. |
| **Berbunyi** | Layar penuh dengan gradasi Fajar yang bergerak pelan (diam bila gerak dikurangi). Jam raksasa, label, tombol kaca "Tunda 5 mnt" (sisa tunda terlihat) dan tombol utama "Aku bangun". Suara ucapan membacakan label. |
| **Tantangan** | Satu soal per kartu, papan angka sendiri yang besar (bukan papan ketik HP), titik-titik hitungan berturut-turut, cincin waktu. Salah: kartu bergetar sekali dan muncul satu baris "Salah, mulai lagi ya". |
| **Kode Bangun** | Kamera layar penuh dengan bingkai pindai dan satu baris petunjuk ("Pindai stiker di kamar mandi"). |
| **Bangun berhasil** | Kebo bangun, skor hari ini, cuaca pagi, rutinitas setelah bangun yang sedang jalan. |
| **Masih bangun?** | Lembar sederhana, satu tombol besar "Masih!" dengan hitung mundur 2 menit. |
| **Mode Malam** | Hitam pekat, angka jam kuning hangat yang sangat redup (bisa diatur), ketuk untuk terang sebentar. Pil status "Siap membangunkan 05.00" dan tanda sedang dicas. Geser ke atas untuk keluar. |
| **Rutinitas** | Ubin kaca berikon seperti adegan di Apple Home, ketuk untuk menjalankan, tahan untuk mengubah. |
| **Riwayat** | Cincin skor hari ini, hari beruntun, grafik 7/30 hari, peta tunda. Grafik ikut sistem desain, bukan bawaan pustaka. |
| **Perangkat** | Daftar perangkat Tuya per ruangan dengan status online dan tombol uji. |
| **Pengaturan** | Daftar bergrup gaya iOS. |
| **Orientasi** | Halaman bergeser, satu ide per halaman, titik kemajuan, tombol "Nanti saja" di setiap langkah opsional. |
| **Pasang ke HP** | Panduan khusus iPhone (Safari: Bagikan, Tambah ke Layar Utama) dan Android (tombol pasang), dengan gambar. |

## 5. Gaya bahasa

Santai, hangat, sedikit jenaka khas "kebo", tidak lebay. Kalimat pendek. Contoh:

- Kartu kosong: "Belum ada alarm. Pasang satu biar besok nggak kebo."
- Tingkat Nuklir: "Nggak bisa ditunda. Buat hari yang nggak boleh telat."
- Spam Telegram: "Bangun! (3) Kasurnya nggak ke mana-mana kok."
- Galat Tuya: "Lampu kamar nggak bisa dihubungi. Alarm tetap jalan lewat HP."

Semua teks lewat kamus i18n (id dan en).
