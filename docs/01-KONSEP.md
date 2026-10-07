# Konsep AntiKebo (versi 2, disepakati Chief 2026-10-07)

Versi 1 (2026-10-06) ada di riwayat git berkas ini dan **sudah tidak berlaku**. Kebutuhan
berkode ada di `02-PRD.md`; keputusan dan alasannya di `KEPUTUSAN.md`.

## 1. Janji produk

**"Alarm yang tidak berhenti sampai kamu benar-benar bangun."**

Saat berbunyi, AntiKebo menyerang dari semua arah sekaligus: bunyi alarm keras, suara omelan
galak yang diputar bersamaan, judul agenda raksasa di layar, spam chat ke kanal agen AgentBuff
pengguna, notifikasi HP, dan (opsional) lampu rumah pintar. Semua itu **baru berhenti saat soal
tantangan terjawab** di perangkat mana pun.

Dijual Rp29.000 sekali bayar di Marketplace AgentBuff. Semua yang bisa diatur di web bisa
juga diatur lewat chat ke agen AgentBuff pengguna.

## 2. Pelajaran dari aplikasi lama (shila-wake)

Rahasia shila-wake: bunyi alarm diputar oleh **program di PC**, bukan oleh halaman web. Browser
cuma layar soal; menutupnya tidak menghentikan bunyi, dan program membukanya lagi tiap 30 detik.

| Dipertahankan (dibuat lebih kuat) | Kelemahan yang diperbaiki |
|---|---|
| Bunyi diputar program, berulang tanpa jeda | Tunda tanpa soal, dan tunda menghentikan semua bunyi dan spam |
| Volume PC dipaksa maksimal | Caranya "tekan tombol volume 50 kali", bisa gagal |
| Layar alarm muncul lagi bila ditutup | Baru muncul lagi tiap 30 detik |
| Suara omelan buatan AI (Gemini "Kore") | Butuh kunci Gemini di PC |
| Soal hitungan setara kelas 6, salah = soal baru | Bisa buntu bila salah terus; hanya hitungan |
| Spam tiap 15 detik ke Telegram dan WhatsApp | Lewat agen yang berpikir tiap pesan: boros token, lambat, bisa menolak |
| Lampu menyala, AC mati | PC harus menyala 24 jam dengan platform lama |

Rincian lengkap di `08-REFERENSI-LAMA.md`.

## 3. Bentuk produk: empat bagian

1. **Server AntiKebo** (otak, 24 jam di VPS AgentBuff). Jadwal tepat sampai detik, status
   setiap kejadian alarm, spam kanal, lampu Tuya, menyiapkan suara omelan, mengawasi perangkat
   siaga.
2. **Web app `antikebo.agentbuff.id`** (bisa dipasang di HP sebagai PWA). Tempat mengatur
   semuanya, layar alarm berbunyi, dan **Mode Jam Meja** untuk HP/tablet.
3. **AntiKebo untuk PC** (aplikasi kecil Windows, diunduh dari situs AntiKebo). Satu-satunya
   cara memenuhi "kalau ditutup, alarm muncul lagi": bunyi diputar aplikasi, jendela alarm tidak
   bisa ditutup selama berbunyi. Spesifikasi di `09-APLIKASI-PC.md`.
4. **Agen AgentBuff pengguna lewat chat (MCP).** Paritas penuh dengan web, kecuali yang sengaja
   dilarang (mematikan alarm yang berbunyi, menjawab soal). Daftar alat di `11-ALAT-MCP.md`.

Tidak ada aplikasi Android/iPhone di versi ini (keputusan Chief). Aplikasi Android dibuat nanti
bila uji nyata membuktikan Mode Jam Meja tidak cukup. Microsoft Store juga nanti, bila peminat
banyak.

## 4. Di mana alarm berbunyi, dan seberapa kuat

| Tempat | Cara | Bisa dihentikan tanpa soal? |
|---|---|---|
| PC dengan AntiKebo untuk PC | Bunyi dari aplikasi. Jendela alarm menempel di atas semua jendela, tidak bisa ditutup, muncul lagi ±1 detik bila dipaksa. Volume dipaksa maksimal. Suara sudah diunduh sejak malam, jadi tetap bunyi walau internet putus. | Hanya dengan mematikan paksa dua proses sekaligus di Task Manager. Spam dan notifikasi tetap jalan. |
| HP/tablet dengan Mode Jam Meja | Bunyi dari halaman web yang dibiarkan terbuka di charger, layar tetap menyala redup. | Ya, bila tab ditutup (batas web). Tapi notifikasi dan spam chat terus datang; mengetuknya membuka layar alarm yang berbunyi lagi. |
| Tanpa perangkat siaga | Spam chat + notifikasi HP + lampu Tuya | Tidak ada bunyi alarm. AntiKebo mengingatkan di malam hari bila tidak ada perangkat siaga. |

**Kebenaran tunggal ada di server.** Soal yang terjawab di satu perangkat menghentikan semua
perangkat, spam, dan lampu bersamaan.

## 5. Saat alarm berbunyi

**Detik 0, semua serentak:**

- Layar alarm muncul langsung dengan **judul agenda raksasa** dan deskripsinya ("Presentasi ke
  klien jam 9"), dan **soal langsung tampil**, tanpa ketukan tambahan.
- Bunyi alarm berulang tanpa jeda + suara omelan, di semua perangkat siaga.
- Spam chat ke kanal yang dipilih, notifikasi HP, lampu dan perangkat Tuya sesuai aturan.

**Pola suara:** omelan, lalu 3 detik bunyi alarm saja, lalu omelan berikutnya, terus begitu.
Bunyi alarm tetap berjalan di bawah suara omelan (dikecilkan sebentar supaya kata-katanya jelas,
lalu keras lagi). Kalimat omelan diacak tanpa pengulangan berturut-turut. Rincian di `10-SUARA.md`.

**Tidak berhenti** sampai soal terjawab. Spam tanpa batas waktu sebagai bawaan; pengguna boleh
mengatur batasnya.

**Tunda:** maksimal N kali (bawaan 2, bisa 0 sampai 5), tiap tunda butuh satu soal ringan.
Selama tunda: bunyi, omelan, dan spam berhenti; lampu tetap menyala. Sesudah jatah habis, tombol
tunda hilang dan satu-satunya jalan adalah menyelesaikan soal.

**Sesudah lolos:**

1. Layar "Selamat pagi" + agenda + ringkasan (bangun jam berapa, tunda berapa kali).
2. Lampu ke keadaan semula, ke "suasana pagi", atau dibiarkan (sesuai aturan).
3. **"Masih bangun?"** N menit kemudian (bawaan 5). Bila tidak diketuk dalam 60 detik, alarm
   kembali penuh tanpa pilihan tunda.
4. Satu pesan penutup ke kanal: rekap singkat.

## 6. Soal: bikin mikir, tapi pasti bisa diselesaikan

- **Hitungan** tiga tingkat (Ringan `47 + 38`, Sedang `7 × 8 + 13`, Berat `(6 + 9) × 4 − 17`),
  harus benar N kali berturut-turut (bawaan 2).
- **Ingat angka:** 6 digit tampil 3 detik, lalu diketik ulang.
- **Ketik kalimat:** salin kalimat yang tampil (bisa judul agenda).
- **Misi QR:** cetak kode QR dari AntiKebo, tempel di kamar mandi; alarm hanya mati bila kode
  itu dipindai kamera HP.
- **Aturan adil:** jawaban selalu bilangan bulat, tanpa batas waktu, papan angka besar. Salah =
  soal baru di tingkat yang sama. Salah 3 kali berturut-turut = turun satu tingkat. Kamera ditolak
  atau gagal pindai 3 kali = diganti hitungan Berat. Tidak pernah buntu.

## 7. Suara omelan: dibuat oleh AgentBuff milik pengguna

Suara omelan memakai **jalur suara yang sama dengan Telepon Agent di AgentBuff**:

1. Alarm disimpan (web atau chat). AntiKebo menyusun naskah: kalimat karakter + nama panggilan
   + agenda. Kalimat umum dibuat sekali per pengguna per karakter; kalimat agenda per alarm.
2. Server AntiKebo meminta **AgentBuff milik pengguna itu** membuat suaranya, memakai
   pengaturan suara pengguna di AgentBuff. Agen tidak berpikir, jadi nol token chat.
3. Pengguna tanpa kunci suara mendapat suara gratis berbahasa Indonesia. Pengguna yang punya
   kunci Gemini, OpenAI, atau ElevenLabs di AgentBuff otomatis mendapat suara itu (biaya di kunci
   pengguna sendiri). Platform tidak menanggung biaya apa pun.
4. Supaya galak: AntiKebo meminta gaya "galak"; AgentBuff menerjemahkannya ke setelan penyedia
   (suara gratis: lebih cepat, nada lebih tinggi, volume maksimal; penyedia berbayar: instruksi
   nada marah).
5. Suara disimpan AntiKebo, diunduh ke perangkat siaga sebelum malam, diputar ulang tiap pagi.
   Dibuat ulang hanya bila naskah, karakter, atau pilihan suara berubah.
6. Bila AgentBuff belum bisa membuat suara (kontainer mati sementara, layanan gagal), alarm tetap
   mengomel dengan suara bawaan perangkat membaca naskah yang sama.

Jalur ini dibangun di AgentBuff (sesi laptop). Selama belum ada, AntiKebo dikembangkan memakai
server tiruan yang mengikuti kontrak di `05-INTEGRASI-AGENTBUFF.md`.

## 8. Spam chat: lewat bot agen pengguna, tanpa AI

Di mata pengguna, pesan datang dari bot agennya sendiri (Telegram, WhatsApp, Discord, Slack,
Google Chat). Bedanya dengan shila-wake: AntiKebo **tidak menyuruh agen berpikir**, tapi meminta
AgentBuff mengirim pesannya langsung lewat bot agen.

| | Cara lama (suruh agen) | Cara AntiKebo |
|---|---|---|
| Kecepatan | 5 sampai 30 detik per pesan | 1 sampai 2 detik |
| Biaya | Token kunci AI pengguna tiap pesan | Nol |
| Kalimat | Bisa diubah atau ditolak agen | Persis seperti yang diatur |
| Ingatan agen | Penuh pesan spam | Bersih |
| Kuota AI habis jam 5 pagi | Spam mati | Tetap jalan |

Pengguna tidak perlu mengatur apa pun: kanal yang sudah tersambung ke agennya otomatis muncul di
AntiKebo, tinggal dicentang. Jeda bawaan: Telegram 15 detik, Discord/Slack/Google Chat 20 detik,
WhatsApp 45 detik (lebih jarang supaya nomor agen tidak diblokir). Tiap pesan membawa tautan
ke layar alarm. Teksnya saja, tanpa voice note (suara diputar di perangkat siaga).

## 9. Rumah pintar (opsional, bukan inti)

Tanpa Tuya semua fitur inti tetap jalan penuh. Bagi yang punya Tuya/Smart Life:

- **Cara sambung meniru tuya.agentbuff.id:** wizard 3 langkah (siapkan app Smart Life, pindai QR
  di Hey Tuya untuk ambil kunci `sk-`, tempel), wilayah terbaca otomatis dari kunci, kunci diuji
  dulu baru disimpan. Bisa juga dengan menempel kunci di chat ke agen. Kode diambil dari
  `referensi/template-tuya/`.
- **Aturan per perangkat per alarm:** kapan (X menit sebelum dengan terang naik bertahap,
  bareng alarm, saat tunda, sesudah bangun), apa (nyala, mati, terang, warna, suhu dan mode AC),
  efek (berkedip sampai bangun), dan sesudah bangun (kembalikan seperti semula, suasana pagi,
  atau biarkan).
- Telepon/SMS Tuya ke nomor akun Smart Life sendiri hanya opsi tersembunyi, mati bawaannya.

## 10. Agen lewat chat

Contoh: *"Bangunin aku jam 5 besok, ada presentasi jam 9, pakai karakter pelatih tentara, lampu
kamar nyala bareng, spam Telegram."* Jadi dalam satu pesan.

Sengaja **tidak bisa** lewat chat: mematikan atau menunda alarm yang sedang berbunyi, menjawab
soal, dan melanggar Mode Komitmen. Bila pengguna minta "matikan alarm", agen mengirim tautan ke
layar soal. Hal yang memang harus di perangkat (memasang aplikasi PC, menyalakan Mode Jam Meja,
memindai QR) dijawab agen dengan tautan.

## 11. Mode Komitmen

Per alarm (bisa dijadikan bawaan). Antara **jam tidur** dan jam alarm, alarm itu **tidak bisa
dihapus, dimatikan, dilewati, atau dimundurkan**, dari web, PC, maupun chat. Menambah alarm atau
memajukan jamnya tetap boleh. Jam tidur diatur pengguna (bawaan 22.00).

## 12. Malam hari

- Pengingat ke kanal dan notifikasi pada jam tidur: "Alarm besok 05.00, Presentasi klien. PC
  siaga ✓, HP belum siaga."
- Bila tidak ada perangkat siaga sama sekali, pengingat menyebutnya terang-terangan.
- Aplikasi PC mencegah PC tertidur selama ada alarm malam itu.

## 13. Batas yang diakui terang-terangan

- Halaman web di HP tidak bisa berbunyi bila tab ditutup atau browser dimatikan sistem.
- PC yang dimatikan total tidak bisa berbunyi. Membangunkan PC dari mode tidur tidak dijanjikan
  (tidak andal di banyak laptop baru); karena itu aplikasi mencegah PC tidur.
- Suara gratis memakai layanan Microsoft Edge yang tidak resmi; bila gagal, suara bawaan perangkat
  dipakai.
- Aplikasi PC belum bertanda tangan digital: saat pertama dipasang Windows memunculkan layar
  "Windows melindungi PC Anda" yang dilewati lewat "Info selengkapnya, Tetap jalankan". Panduan
  bergambar disediakan.
- AntiKebo membantu bangun, bukan jaminan. Untuk hal sangat penting, pasang juga alarm cadangan.
