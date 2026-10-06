# Aplikasi lama (shila-wake) dan peningkatannya

Kode lama ada di `referensi/aplikasi-lama/shila-wake/` (sudah dibersihkan dari data pribadi).
**Jangan salin kodenya.** Tabel ini sudah merangkum semua fitur dari pembacaan lengkap setiap
berkas, supaya tidak perlu dibongkar lagi.

## Bentuk lama

- Plugin "skill" untuk platform agen OpenClaw dengan persona "Shila". Python 3, FastAPI,
  HTML Jinja2, JS polos, data di berkas JSON. Hanya Windows (PowerShell, winsound, TTS Windows).
- Server web di PC port 3000, penjadwal cek tiap 5 detik. PC harus menyala dan masuk desktop;
  server bunuh diri bila gateway OpenClaw mati sekitar 30 detik.
- Saat alarm: buka tab peramban `/alarm-active`, putar suara di speaker PC, jalankan perangkat
  Tuya paralel, jalankan aksi berurutan (memblokir alarm lain).

## Pemetaan fitur

| Fitur lama | Keadaan sebenarnya | AntiKebo baru |
|---|---|---|
| Pengulangan: sekali, harian, hari kerja, akhir pekan, mingguan, bulanan, kustom | Hanya sekali dan harian yang jalan; sisanya bunyi sekali lalu mati | B2: semua pengulangan benar + tes contoh emas |
| Mode gentle / normal / nuclear | Tidak ada bedanya selain warna lencana dan daftar suara | B7 + konsep: tingkat Lembut/Normal/Nuklir yang benar-benar beda (tunda, tantangan, tangga) |
| 32 suara MP3 (gentle 8, nuclear 9, normal 15) | Diputar di PC; nama suara bawaan di konfigurasi tidak ada filenya | B8: pustaka suara berlisensi jelas, diputar di HP/laptop lewat Mode Malam dan layar berbunyi |
| Layar alarm aktif: jam besar, tunda 5/10/15 mnt, soal hitungan | Bisa terlempar ke halaman login saat setengah sadar; watchdog membuka tab baru tiap 30 detik | Layar Berbunyi + Tantangan tanpa login ulang (sesi panjang), satu tab |
| Tunda | Tak terbatas walau nuclear; hilang bila server restart; mengirim ulang aksi tapi tidak perangkat | F6: batas per tingkat, tersimpan di DB, tangga diulang lengkap |
| Soal hitungan "kelas 6" (4 bentuk) | Satu jawaban benar langsung mati, salah tanpa hukuman, jawaban tercetak di konsol | F1: 3 tingkat, harus benar berturut-turut, salah ada hukuman, jawaban tidak pernah bocor |
| Spam (pesan berulang di TTS/Telegram/WhatsApp tiap ~15 dtk) | Lewat agen AI: tiap pesan makan token, penerima tidak pasti, tanpa batas | D2: bot Telegram langsung, tanpa LLM, berbatas, dihapus otomatis setelah bangun |
| TTS Gemini di speaker PC | Butuh kunci Gemini dan PC | D3 telepon suara Tuya + D6 suara ucapan di layar berbunyi |
| WhatsApp | Lewat agen, nomor penerima tertanam di kode | Tidak dibuat (lihat konsep); diganti telepon + Telegram |
| Cuaca (wttr.in) | Bila gagal mengarang cuaca palsu | Cuaca pagi dari API cuaca Tuya, tidak pernah palsu |
| Kutipan penyemangat (5 kalimat tetap) | | Kumpulan kalimat bervariasi tanpa LLM (id/en) |
| Musik pagi | Hanya placeholder | Tidak dibuat; diganti rutinitas setelah bangun (mis. colokan speaker menyala) |
| Tuya: 5 lampu warna, 2 colokan, AC IR | Lewat skrip skill lain di PC, alamat perangkat lewat nama | E1 sampai E7: kunci `sk-` milik pengguna, perangkat lewat ID, konfirmasi aksi. AC IR tidak bisa (batas kunci `sk-`) |
| Kontrol cepat semua lampu / AC | Hanya API | Rutinitas dan uji perangkat |
| Rutinitas (preset) | Tidak pernah jalan otomatis; "Jalankan" membuat alarm yang sering jatuh di masa lalu | H1 sampai H5: rutinitas benar-benar terjadwal dan bisa dipasang ke alarm |
| Pengingat | Hanya API/CLI, tanpa UI, suara tidak ada filenya | I1: UI lengkap dengan prioritas |
| Lewati alarm berikutnya | Mematikan alarm berulang selamanya | B3: lewati sekali tanpa mematikan |
| Ubah alarm | Menghapus lalu membuat baru (ID dan riwayat hilang) | B1: ID dan riwayat tetap |
| Analitik: skor, beruntun, peta tunda, waktu bangun terbaik | Jumlah tunda selalu 0, hari pada progres mingguan tertulis mati | J1 sampai J4 dengan rumus tertulis dan tes |
| Log kejadian | Tumbuh tanpa batas, ditulis tanpa kunci (balapan data) | Tabel DB dengan RLS dan pembersihan berkala |
| Login satu pengguna | SHA-256 tanpa garam, header kunci internal menembus login dari IP mana pun, API dari localhost tanpa login | A1: Masuk dengan AgentBuff, tanpa jalan pintas |
| Tangkapan layar PC jarak jauh, bisukan PC | Endpoint berbahaya | Dibuang |
| Agen membuat alarm dari chat ("bangunin", "set alarm") | Lewat impor fungsi Python | K1: alat MCP resmi; agen tidak bisa mematikan alarm |

## Kebiasaan pemakaian nyata (Feb sampai Mar 2026)

51 kali berbunyi, 38 kali dimatikan, 13 kali ditunda. Paling sering nuclear dengan spam di
semua saluran, sering siang hari sebagai pengingat kuliah ("INGAT ADA KELAS"). Rutinitas
"Brutal Morning" dijalankan 29 kali sebagai akal-akalan karena alarm berulang tidak jalan.

Pelajaran untuk produk: pengingat penting (kuliah, rapat) sama pentingnya dengan alarm pagi,
dan tingkat paling keras adalah yang paling dipakai.
