# Aplikasi lama (shila-wake) dan pelajarannya

Kode lama di `referensi/aplikasi-lama/shila-wake/` (sudah dibersihkan dari data pribadi).
**Jangan salin kodenya.** Dokumen ini merangkum apa yang perlu diketahui.

## 1. Bentuk lama

Plugin "skill" untuk platform agen OpenClaw (persona "Shila"). Python + FastAPI + HTML Jinja2, data
di berkas JSON, hanya Windows. Server web di PC port 3000, penjadwal cek tiap 5 detik. PC harus
menyala dan masuk desktop 24 jam.

## 2. Cara membunyikan alarm (inti yang ditiru, `scripts/wake_system.py`)

| Bagian | Cara lama | AntiKebo |
|---|---|---|
| Mulai | `start_active_alarm`: buat soal, volume maks, buka browser, jalankan pengawas browser, utas bunyi, utas spam | Server + perangkat siaga, `09-APLIKASI-PC.md` §6 |
| Bunyi | Diputar **program PC** lewat PowerShell `MediaPlayer`, diulang tanpa jeda (`sound_loop_worker`). Menutup browser tidak menghentikan bunyi. | Sama prinsipnya: aplikasi PC memutar sendiri |
| Volume | `SendKeys` tombol volume naik 50 kali | Core Audio langsung, diulang tiap 2 dtk, buka bisu |
| Browser | `webbrowser.open` saat mulai, lalu pengawas membuka lagi **tiap 30 dtk** | Jendela milik aplikasi, tidak bisa ditutup, muncul lagi ±1 dtk |
| Suara omelan | Gemini TTS (`gemini-2.5-flash-preview-tts`, suara "Kore"), cadangan suara Windows; diputar di sela spam | Lewat AgentBuff pengguna (`10-SUARA.md`), jeda 3 dtk, bersamaan dengan bunyi |
| Soal | Kelas 6: `a×b+c`, `a×b−c`, `(a+b)×c`, `a²+b`; salah = soal baru; satu benar langsung mati | Tiga tingkat, N benar berturut-turut, turun tingkat bila salah 3× |
| Tunda | 5/10/15 menit **tanpa soal**, menghentikan bunyi dan spam, tak terbatas | Jatah terbatas, tiap tunda butuh soal ringan |
| Spam | Tiap 15 dtk, TTS + menyuruh agen (LLM) mengirim Telegram/WhatsApp lewat `/v1/responses` | Lewat AgentBuff langsung tanpa AI (`01-KONSEP.md` §8) |
| Perangkat | Semua lampu 100% + AC mati, lewat skrip skill Tuya lain | Aturan per perangkat per alarm (`02-PRD.md` I3) |

## 3. Pemetaan fitur lain

| Fitur lama | Keadaan sebenarnya | AntiKebo |
|---|---|---|
| Pengulangan sekali/harian/hari kerja/akhir pekan/mingguan/bulanan/kustom | Hanya sekali dan harian yang jalan | PRD B3 dengan tes contoh emas |
| Mode gentle/normal/nuclear | Tidak ada bedanya selain warna | Diganti pengaturan per alarm + template |
| 32 MP3 | Lisensi tidak jelas | Bunyi disintesis sendiri (K-08) |
| Rutinitas (preset) | Tidak pernah jalan otomatis | Template alarm |
| Pengingat | Hanya API/CLI | Alarm dengan template "Pengingat penting siang" (K-14) |
| Lewati alarm berikutnya | Mematikan alarm berulang selamanya | Lewati sekali tanpa mematikan |
| Ubah alarm | Hapus lalu buat baru | ID dan riwayat tetap |
| Analitik | Jumlah tunda selalu 0 | Rumus tertulis + tes |
| Login | SHA-256 tanpa garam, kunci internal menembus login | Masuk dengan AgentBuff, tanpa jalan pintas |
| Tangkapan layar PC jarak jauh, bisukan PC | Endpoint berbahaya | Dibuang |
| Cuaca | Mengarang cuaca palsu bila gagal | Tidak dibuat |

## 4. Kebiasaan pemakaian nyata (Feb sampai Mar 2026)

51 kali berbunyi, 38 dimatikan, 13 ditunda. Paling sering mode paling keras dengan spam di semua
saluran, sering **siang hari sebagai pengingat kuliah** ("INGAT ADA KELAS"). Pelajaran: alarm untuk
agenda siang sama pentingnya dengan alarm pagi (karena itu judul agenda besar di layar), dan mode
paling keras paling dipakai.
