# Konsep AntiKebo

## Masalah versi lama

AntiKebo lama (shila-wake) hidup di PC Windows. Jadwal, suara, lampu Tuya, dan spam semuanya
dijalankan PC itu. Akibatnya:

- PC harus menyala, tidak tidur, dan masuk ke desktop 24 jam. Kalau PC tidur saat jam alarm,
  alarm **hilang tanpa kabar**.
- Suara hanya keluar dari speaker PC. Kalau tidur di kamar lain, tidak terdengar.
- Spam dikirim lewat agen AI, jadi setiap pesan memakan token dan kadang salah kirim.
- Tidak bisa dipakai orang lain, tidak bisa dijual.

## Jawaban: otaknya pindah ke server

AntiKebo baru adalah aplikasi web di `antikebo.agentbuff.id`. **Semua yang penting berjalan di
server AgentBuff (VPS) yang menyala 24 jam**, bukan di PC atau HP pengguna:

```
                       ┌─────────────────────────────────────┐
                       │  Server AntiKebo (VPS, 24 jam)       │
  HP / laptop  ◄──────►│  - simpan jadwal semua pengguna      │
  (atur alarm,         │  - worker penjadwal (tepat ±2 detik) │
   jawab tantangan)    │  - tangga bangun (eskalasi)          │
                       └──────┬──────────┬──────────┬────────┘
                              │          │          │
                     Tuya Cloud     Telegram     Web Push
                     (lampu, colokan,  (spam      (notifikasi
                      sirene, telepon   pesan)     ke HP/laptop)
                      ke HP pengguna)
```

PC tidak perlu menyala sama sekali. HP boleh terkunci. Server yang membangunkan, lewat banyak
jalur sekaligus, sampai pengguna membuktikan dia benar-benar bangun.

## Bagaimana HP ikut berbunyi (jujur soal batasan)

Aplikasi web punya batasan: di HP yang terkunci, halaman web **tidak bisa** memutar suara
alarm terus-menerus seperti aplikasi Jam bawaan, apalagi di iPhone. Karena itu AntiKebo tidak
bergantung pada satu jalur. HP dibangunkan lewat jalur yang memang bisa menembus HP terkunci:

| Jalur | Cara kerja | Kekuatan |
|---|---|---|
| **Telepon suara Tuya** | Server meminta Tuya menelepon nomor HP pengguna (fitur `voice/self-send` di kunci `sk-` pengguna). HP berdering seperti telepon biasa. | Paling kuat. Batas Tuya: 15 telepon per hari per nomor, pesan sama maks 2 per 50 detik. Kalau nomor penelepon Tuya selalu sama, dua telepon dalam 3 menit menembus mode Fokus iPhone (fitur "Panggilan Berulang"). |
| **Mode Malam** | Sebelum tidur, pengguna membuka AntiKebo dan menaruh HP di charger. Layar redup menampilkan jam. Saat alarm, halaman yang terbuka ini **berbunyi keras** seperti alarm sungguhan. | Kuat dan gratis. Aplikasi menjaga layar tetap hidup (Wake Lock) dan punya pengatur waktu cadangan di HP sendiri kalau internet putus. |
| **Notifikasi push** | Notifikasi web (PWA) ke HP dan laptop, diulang selama alarm berbunyi. | Sedang. Di iPhone hanya jalan kalau AntiKebo dipasang ke Layar Utama (iOS 16.4+). Bunyinya bunyi notifikasi biasa. |
| **Spam Telegram** | Bot Telegram AntiKebo mengirim pesan beruntun dengan bunyi notifikasi. Pesan dihapus otomatis setelah pengguna bangun supaya chat tetap bersih. | Sedang, gratis, tanpa token AI. |
| **Push aplikasi Smart Life** | Notifikasi dari aplikasi Smart Life/Tuya di HP (`push/self-send`). | Sedang. Notifikasi asli aplikasi HP. |
| **Perangkat kamar** | Lampu menyala perlahan seperti matahari terbit, colokan menyalakan kipas/speaker, sirene Tuya berbunyi. | Kuat untuk yang punya perangkat Tuya. Tidak butuh HP sama sekali. |

Pengguna tanpa perangkat Tuya sama sekali tetap bisa memakai AntiKebo lewat Mode Malam,
notifikasi push, dan Telegram. Telepon suara butuh akun Smart Life/Tuya (gratis) dan kunci `sk-`.

## Tangga Bangun

Setiap alarm punya **Tangga Bangun**: urutan langkah yang makin keras sampai pengguna lolos
tantangan. Contoh tingkat Normal:

| Waktu | Langkah |
|---|---|
| 10 menit sebelum | Lampu kamar menyala perlahan dari 1% ke 100%, warna hangat ke putih (matahari terbit). |
| Jam alarm | Mode Malam berbunyi, notifikasi push, push Smart Life, colokan kipas/speaker menyala. |
| +2 menit | Spam Telegram mulai (tiap 20 detik). Suara Mode Malam makin keras. |
| +4 menit | Telepon suara Tuya. Sirene Tuya menyala. |
| +6 menit | Telepon kedua (menembus mode Fokus), semua lampu 100% putih dingin. |
| Seterusnya | Ulangi spam dan telepon sampai batas harian, lalu tetap spam Telegram dan push. |

Tiga tingkat bawaan, bisa diatur per alarm:

| Tingkat | Tunda (snooze) | Tantangan | Tangga |
|---|---|---|---|
| **Lembut** | Maks 3 kali, 9 menit | 1 soal mudah | Pelan, tanpa telepon kecuali diaktifkan |
| **Normal** | Maks 2 kali, 5 menit | 3 soal benar berturut-turut | Seperti tabel di atas |
| **Nuklir** | Tidak bisa ditunda | 5 soal sulit berturut-turut **dan** pindai Kode Bangun | Semua jalur langsung, telepon dari menit pertama |

## Mematikan alarm: harus membuktikan bangun

Alarm hanya berhenti kalau pengguna lolos **tantangan** di aplikasi (dibuka dari notifikasi,
tautan Telegram, atau layar Mode Malam):

- **Hitungan:** soal dibuat dan diperiksa di server, tiga tingkat kesulitan, harus benar
  berturut-turut. Salah satu kali mengulang hitungan dan membuat suara makin keras.
- **Kode Bangun:** pindai kode QR atau barcode benda yang sudah didaftarkan (misalnya stiker QR
  di kamar mandi, barcode pasta gigi). Memaksa pengguna berdiri dan berjalan.
- **Ketik kalimat:** ketik ulang kalimat penyemangat persis sama.
- **Goyang HP:** goyangkan HP sejumlah kali (sensor gerak).

Agen AI, skrip, atau API tanpa sesi pengguna **tidak bisa** mematikan alarm.

## Cek Masih Bangun

Beberapa menit setelah alarm mati (bawaan 5 menit), AntiKebo bertanya "Masih bangun?" lewat push
dan Telegram. Kalau tidak dijawab dalam 2 menit, Tangga Bangun mulai lagi. Ini menutup celah
"matikan alarm lalu tidur lagi".

## Fitur lain

- **Rutinitas:** skenario perangkat bernama (Pagi Semangat, Tidur, Fokus Kerja) yang bisa
  dijalankan manual, dijadwalkan sendiri, atau dipasang ke alarm (mis. setelah bangun: lampu
  putih, colokan pemanas air menyala).
- **Pengingat:** pengingat berjadwal dengan tingkat penting (mis. "Ada kelas jam 8"), memakai
  jalur yang sama tapi lebih ringan.
- **Riwayat dan statistik:** skor bangun, hari beruntun, rata-rata waktu dari berbunyi sampai
  bangun, jumlah tunda, peta jam kesiangan. Datanya benar, bukan angka tempelan.
- **Cuaca pagi:** setelah bangun, tampilkan cuaca lokasi rumah (dari API cuaca Tuya, tanpa
  layanan tambahan).
- **Agen AgentBuff:** "bangunin aku jam 5 besok, tingkat nuklir" langsung dari chat lewat alat MCP.

## Yang sengaja tidak dibuat

- **WhatsApp:** tidak ada API resmi yang gratis; API tidak resmi berisiko nomor diblokir.
  Telepon suara dan Telegram sudah menggantikan perannya.
- **AC lewat IR blaster:** kunci `sk-` Tuya tidak bisa memancarkan IR. AC yang tersambung Wi-Fi
  langsung tetap bisa.
- **Aplikasi native di Play Store/App Store:** tidak dibutuhkan untuk rilis. Arsitektur tetap
  memungkinkan dibungkus jadi aplikasi native nanti (iOS 26 punya AlarmKit untuk alarm pihak
  ketiga).
- **Fitur sistem PC lama** (tangkapan layar jarak jauh, bisukan PC, kunci internal): dibuang
  karena berbahaya.

## Harus dibuktikan di perangkat asli

Konsep di atas memakai kemampuan yang belum pernah diuji untuk AntiKebo. Paket kerja wajib
membuktikannya dengan kunci dan HP asli Chief sebelum dijanjikan ke pembeli. Kalau ada yang
gagal, ganti janjinya di listing dan catat di `docs/KEPUTUSAN.md`:

1. Telepon `voice/self-send` Tuya benar-benar berdering di nomor Indonesia (+62), berapa lama
   jeda dari permintaan sampai berdering, dan apakah nomor peneleponnya selalu sama.
2. Dua telepon dalam 3 menit benar-benar menembus mode Fokus iPhone dan Jangan Ganggu Android.
3. Mode Malam berbunyi keras di iPhone saat sakelar senyap aktif (pakai elemen `<audio>` dan
   `navigator.audioSession.type = "playback"`), dan di Android saat mode getar.
4. Wake Lock bertahan semalaman di PWA terpasang (iPhone dan Android), dan perilaku saat HP
   dikunci manual.
5. Notifikasi push PWA berulang tetap muncul di layar kunci iPhone dan Android.
6. Tombol "Pasang alarm cadangan di HP": membuat alarm di aplikasi Jam bawaan lewat Pintasan
   iOS dan intent `SET_ALARM` Android. Kalau tidak bisa dari web, ganti dengan panduan singkat.

## Keandalan server

Karena server jadi satu-satunya otak, keandalannya wajib dijaga:

- Worker penjadwal tahan restart: jadwal tersimpan di database, bukan di memori.
- Kalau worker sempat mati dan jam alarm terlewat kurang dari 30 menit, alarm tetap dibunyikan
  saat worker hidup lagi dan pengguna diberi tahu terlambat.
- Detak jantung worker dipantau. Kalau berhenti lebih dari 60 detik, Chief diberi tahu.
- Mode Malam punya pengatur waktu cadangan di HP, jadi tetap berbunyi walau server atau
  internet bermasalah.
