# Desain AntiKebo (versi 2)

Arah: **modern, minimalis, gaya Apple, nyaman dipakai saat setengah sadar.** Seperti aplikasi Jam
dan Home di iPhone bertemu visionOS: kaca lembut di atas cahaya yang hidup, angka jam besar, alur
pendek. Satu pengecualian yang disengaja: **layar berbunyi** gelap, keras, dan mendesak.

Acuan wajib: `referensi/template-tuya/src/app/globals.css` (token kaca, latar ambient per waktu,
komponen `ui/dasar.tsx`), `referensi/standar-agentbuff/BYM-DESAIN.md`,
`referensi/standar-agentbuff/PORTAL-PANDUAN-DESAIN-ROMBAK-UI.md`.

## 1. Aturan Chief (tidak boleh dilanggar)

1. **Kaca selalu butuh cahaya di belakangnya.** Kaca di atas latar polos hanya jadi kartu putih.
2. Jangan gabungkan utilitas kaca dengan ring/shadow/bg di elemen yang sama. Pembungkus ber-
   `transform` mematikan `backdrop-filter`.
3. **Teks pendek.** Keterangan maksimal satu baris pendek. Huruf minimal 13 px. Tidak ada label
   kapital berjarak gaya kode.
4. **Tidak ada tanda pisah panjang** di teks UI (guard `tanda-pisah`).
5. **Popup:** laptop = dialog di tengah, HP = lembar dari bawah. Bukan panel kanan.
6. Warna bermakna: toska hanya untuk yang **hidup/aktif**, amber untuk "butuh kamu", merah hanya
   untuk galat dan tombol bahaya. Tombol utama grafit berbentuk pil.
7. Setiap aksi yang mengubah data punya keadaan proses, galat, dan selesai yang terlihat. Bedakan
   "memuat" dan "kosong". Target sentuh ≥ 44 px. WCAG 2.2 AA di kedua tema.
8. Pesan galat mentah tidak pernah tampil.
9. Hormati `prefers-reduced-motion`.
10. Setiap layar utama: prototipe, tangkapan layar di PR (desktop dan 390 px, kedua tema) untuk
    Chief, baru dibangun penuh.

## 2. Bahasa visual

| Unsur | Keputusan |
|---|---|
| Huruf | SF Pro di perangkat Apple, cadangan Inter (self-host). Angka jam `ui-rounded`, `tabular-nums`, tebal ringan, sangat besar. |
| Latar | `latar-ambient` per waktu (pagi/siang/sore/malam) dari template, disetel di server supaya tidak berkedip. |
| Kaca | Token dan kelas kaca template (`.kaca`, `.kaca-kuat`, `.kaca-nyala`), dengan cadangan tanpa `backdrop-filter`. |
| Warna khas | **Bara**: gradasi merah-jingga menyala, hanya di layar berbunyi. **Fajar**: jingga-merah muda lembut untuk "Selamat pagi". Toska untuk alarm aktif dan perangkat siaga. |
| Bentuk | Lembar 28, kartu 22, kontrol 14, tombol pil. Pemisah lewat nada, bukan bayangan tebal. |
| Ikon | Lucide, garis 1,75. |
| Gerak | Pegas halus, tekan mengecil sedikit, 150 sampai 300 md. Layar berbunyi berdenyut mengikuti suara. |
| Maskot | **Kebo**, kerbau kecil lucu: tidur di layar kosong, kaget di layar berbunyi, segar di Selamat pagi. Hemat, tidak dibungkus panel. Dibuat sebagai SVG di repo. |
| Tema | Terang dan gelap dirancang terpisah. Layar berbunyi dan Jam Meja selalu gelap. |

## 3. Navigasi

- **HP:** bilah tab kaca bawah: **Alarm**, **Siaga**, **Riwayat**, **Pengaturan**, tombol `+`
  besar di kanan atas Alarm.
- **Laptop:** bilah samping kaca dengan menu yang sama, konten di tengah lebar terbatas (720 px).
- Layar berbunyi, soal, Selamat pagi, Masih bangun, dan Jam Meja tampil **penuh layar** tanpa
  navigasi.

## 4. Layar

### 4.1 Beranda (tab Alarm)

```
┌──────────────────────────────────────┐
│  Selamat malam, Nugi                 │
│ ┌──────────────────────────────────┐ │
│ │ Alarm berikutnya                 │ │
│ │   05.00                          │ │  ← angka sangat besar
│ │   Presentasi klien               │ │  ← judul agenda
│ │   6 jam 12 menit lagi            │ │
│ │   ● PC siaga  ○ HP belum siaga   │ │  ← toska = siaga, abu = belum
│ └──────────────────────────────────┘ │
│  Alarm lainnya                       │
│ ┌──────────────────────────────────┐ │
│ │ 06.30  Kuliah pagi   Sen-Jum  [●]│ │  ← sakelar gaya iOS
│ │ 13.00  Ingat ada kelas  Rabu  [●]│ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- Kartu alarm: jam, judul agenda, pengulangan, ikon kecil (karakter suara, kanal, Tuya, gembok
  Komitmen), status suara ("Suara siap" atau amber "Suara belum siap").
- HP: geser kartu untuk "Lewati sekali" dan "Hapus" (dikunci bila Komitmen aktif, dengan alasan).
- Kosong: Kebo tidur + "Belum ada alarm. Pasang satu biar besok nggak kebo." + tombol.
- Spanduk amber bila ada masalah yang butuh pengguna (tidak ada perangkat siaga, izin AgentBuff
  belum diberi, kunci Tuya bermasalah), masing-masing dengan tombol penyelesai.

### 4.2 Ubah alarm (lembar HP / dialog laptop)

Urutan dari atas, bagian lanjutan dilipat:

1. Roda pemilih jam besar seperti iOS.
2. **Agenda:** judul (wajib, placeholder "Mau bangun buat apa?") + deskripsi.
3. Ulangi (chip hari + pilihan lanjutan).
4. **Karakter suara:** baris kartu karakter dengan tombol dengar ▶. Status suara di bawahnya.
5. **Soal:** jenis + tingkat + jumlah benar.
6. **Tunda:** jatah (0 sampai 5) + durasi.
7. **Spam chat:** daftar kanal dari AgentBuff dengan centang; kanal tidak siap redup + alasan.
8. **Rumah pintar:** daftar aturan perangkat (tampil hanya bila Tuya tersambung, selain itu satu
   baris "Sambungkan lampu rumah" yang membuka wizard).
9. Lanjutan (dilipat): Komitmen, Masih bangun, bunyi alarm, libur nasional, batas waktu spam.

Tombol "Simpan" pil grafit. Sesudah simpan: toast "Alarm tersimpan. Suara omelan sedang dibuat."

### 4.3 Berbunyi (penuh layar, selalu gelap)

```
┌──────────────────────────────────────┐
│ ░░░░ cahaya Bara berdenyut ░░░░░░░░░ │
│              05.00                   │
│      PRESENTASI KLIEN                │  ← judul agenda raksasa (bukan kapital paksa;
│   Jam 9 di kantor klien, bawa laptop │     ukuran besar, tebal)
│                                      │
│ ┌──────────────────────────────────┐ │
│ │      7 × 8 + 13 = ?              │ │  ← soal langsung tampil
│ │      [ 6 9 ]                     │ │
│ │  1 2 3                           │ │
│ │  4 5 6      ● ○  benar beruntun  │ │
│ │  7 8 9                           │ │
│ │  ⌫ 0 ✓                           │ │
│ └──────────────────────────────────┘ │
│   Tunda 5 menit (sisa 2)             │  ← hanya bila jatah ada, butuh soal ringan
└──────────────────────────────────────┘
```

- Papan angka sendiri yang besar (bukan papan ketik HP).
- Salah: kartu bergetar sekali + "Salah, soal baru ya".
- Kebo kaget kecil di pojok. Teks omelan yang sedang diputar tampil sebagai teks berjalan kecil.
- Misi QR: kamera penuh dengan bingkai + "Pindai kode di kamar mandi".
- Dua alarm bersamaan: penanda "1 dari 2".

### 4.4 Selamat pagi

Gradasi Fajar, Kebo segar, "Kamu bangun 05.07", agenda hari ini, skor, tunda, lalu tombol "Oke".
Bila Masih bangun aktif: baris kecil "Aku cek lagi 5 menit lagi ya".

### 4.5 Masih bangun?

Penuh layar gelap, satu tombol sangat besar "Masih!" dengan cincin hitung mundur 60 detik.

### 4.6 Mode Jam Meja (HP/tablet)

- Sebelum mulai: kartu penjelasan singkat (3 baris: biarkan di charger, jangan tutup halaman,
  volume besar) + tombol "Mulai siaga" (membuka kunci suara, layar tetap menyala, layar penuh) +
  "Tes bunyi".
- Saat siaga: hitam pekat, jam besar sangat redup (warna hangat, bisa diatur), pil "Siaga untuk
  05.00 ✓" dan ikon dicas. Ketuk = terang 5 detik. Geser ke atas = keluar (dengan konfirmasi bila
  ada alarm < 8 jam lagi).
- Peringatan amber bila tidak dicas atau koneksi putus ("Masih bisa berbunyi, suara sudah
  tersimpan").

### 4.7 Tab Siaga

Daftar perangkat siaga (PC, HP) dengan status malam ini. Tombol "Pasang di PC ini" (bila
Windows) dan "Jadikan perangkat ini jam meja". Halaman unduh PC dengan panduan layar biru Windows
bergambar (3 langkah).

### 4.8 Aplikasi PC

- Jendela kecil pengaturan (sekali di awal): logo, "Sambungkan PC ini" → browser terbuka →
  kembali dengan centang hijau, lalu daftar periksa otomatis (menyala saat Windows hidup ✓, tidak
  tidur saat ada alarm ✓, tes bunyi "Kamu dengar?").
- Ikon baki: status, alarm berikutnya, buka AntiKebo, tes bunyi, keluar (dikunci saat Komitmen
  atau berbunyi).
- Jendela berbunyi: tampilan sama dengan 4.3 (halaman web yang sama di dalam aplikasi).

### 4.9 Riwayat

Cincin skor hari ini, hari beruntun, grafik 7/30 hari (ikut sistem desain), daftar kejadian
dengan rincian (tunda, soal, kiriman kanal, perangkat yang berbunyi).

### 4.10 Pengaturan

Daftar bergrup gaya iOS: Kamu (nama panggilan, zona, bahasa, jam tidur), Bawaan alarm baru,
Pengingat malam, Kanal, Suara, Rumah pintar, Kode QR, Agen, Privasi, Hapus data.

### 4.11 Orientasi

Halaman bergeser satu ide per halaman (urutan PRD J), titik kemajuan, "Nanti" di langkah
opsional, langkah terakhir uji coba alarm 1 menit.

## 5. Gaya bahasa

Santai, hangat, sedikit jenaka khas "kebo", tidak lebay. Kalimat pendek. Contoh:

- Kosong: "Belum ada alarm. Pasang satu biar besok nggak kebo."
- Komitmen: "Alarm ini dikunci sampai 05.00. Kamu sendiri yang minta."
- Spam: "Bangun, Nugi! (3) Presentasi jam 9, kasurnya nggak ke mana-mana."
- Galat Tuya: "Lampu kamar nggak bisa dihubungi. Alarm tetap jalan."
- Suara belum siap: "Suara omelan belum siap. Alarm tetap bunyi pakai suara bawaan."

Semua teks lewat kamus i18n (id dan en).
