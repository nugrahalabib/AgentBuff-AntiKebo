# AntiKebo untuk PC (Windows)

Aplikasi kecil yang membuat alarm di PC **tidak bisa dihentikan tanpa menjawab soal**. Penerus
cara kerja shila-wake (bunyi diputar program, bukan halaman), dibuat jauh lebih kuat.

## 1. Janji ke pengguna

- Pasang sekali, sambung sekali klik, sesudah itu lupakan.
- Pada jam alarm: layar alarm muncul di atas semua jendela, volume maksimal, bunyi + omelan, dan
  tidak bisa ditutup sampai soal terjawab.
- Tetap berbunyi walau internet putus saat jam alarm.
- Ringan: tidak terasa saat dipakai kerja.

## 2. Teknologi

| Hal | Pilihan |
|---|---|
| Kerangka | **Tauri v2** (Rust + WebView2 bawaan Windows 10/11) |
| Letak kode | Workspace `pc/`: `inti` (logika murni, dites di Linux), `klien` (HTTP + SSE, dites ujung ke ujung), `src-tauri` (aplikasi), `ui` (jendela pengaturan, alarm, lapisan) |
| Target | Windows 10 (1809+) dan 11, x64. ARM64 dan macOS nanti. |
| Pemasang | NSIS, **per pengguna** (tanpa hak admin), ke `%LOCALAPPDATA%` |
| Suara | `rodio`/`cpal` (WASAPI), mencampur bunyi alarm + klip omelan; cadangan omelan = suara bawaan Windows (`Windows.Media.SpeechSynthesis`) |
| Volume | Windows Core Audio (`IAudioEndpointVolume`) lewat crate `windows` |
| Daya | `SetThreadExecutionState` |
| Mulai otomatis | `tauri-plugin-autostart` (kunci Run di HKCU, tanpa admin) |
| Satu instans | `tauri-plugin-single-instance` |
| Pembaruan | `tauri-plugin-updater` dengan tanda tangan ed25519 milik AntiKebo (gratis, terpisah dari tanda tangan kode Windows) |
| Penyimpanan token | Windows Credential Manager (`CredWriteW` lewat crate `windows`, K-93) |

## 3. Bagian aplikasi

1. **Proses utama** (baki sistem): klien SSE ke server, salinan jadwal 24 jam, pengatur waktu
   lokal, pemutar suara, pengendali volume dan daya, pengunduh klip.
2. **Jendela alarm:** tampilan bawaan aplikasi (`pc/ui/alarm.html`, gaya sama dengan layar berbunyi
   web), satu tampilan untuk daring dan luring. Soal diambil lewat proses utama yang memegang
   token; WebView tidak pernah melihat token dan hanya boleh memanggil jalur soal kejadian (K-86).
3. **Penjaga** (`AntiKebo.exe --penjaga`, proses kecil terpisah tanpa jendela): saling mengawasi
   dengan proses utama selama siaga; bila salah satu mati, yang lain menyalakannya lagi dalam
   ±1 detik (K-88).
4. **Jendela pengaturan** kecil: sambung, daftar periksa, tes bunyi, versi.

## 4. Sambung PC (sekali)

1. Pengguna mengunduh dari halaman unduh (`/app/unduh-pc`, dari Pengaturan dan tab Siaga) berkas
   `/unduh/pc/antikebo-pc-setup.exe`, memasang (panduan layar biru Windows bergambar: "Info
   selengkapnya", lalu "Tetap jalankan"), dan bisa mencocokkan sidik SHA-256 yang tampil.
2. Aplikasi terbuka, meminta kode sambung ke server (`POST /api/perangkat/kode` {nama, versi} →
   {kode, rahasia, kedaluwarsa, tautan}), menampilkan kodenya, lalu membuka browser ke `tautan`
   (`https://antikebo.agentbuff.id/sambung-pc?kode=XXXX-XXXX`). `rahasia` hanya disimpan di
   memori aplikasi dan dipakai mengambil token (K-41).
3. Di browser (sudah login AntiKebo), pengguna melihat "Sambungkan PC ini?" + nama PC, menekan
   **Sambungkan**.
4. Aplikasi (menanti dengan polling 2 dtk ke `POST /api/perangkat/kode/ambil` {kode, rahasia},
   kode berlaku 10 menit) menerima token perangkat SEKALI, menyimpannya di Credential Manager.
   Selesai, browser menampilkan centang hijau. Sesudahnya semua panggilan memakai
   `Authorization: Bearer <token>`: detak `POST /api/perangkat/detak`, jadwal
   `GET /api/perangkat/jadwal`, SSE `GET /api/peristiwa`.
5. Daftar periksa otomatis (lihat §7), lalu tes bunyi 5 detik: "Kamu dengar? Ya / Tidak".

Putus sambung dari web (tab Siaga) mencabut token; aplikasi kembali ke layar "Sambungkan".

## 5. Malam hari

- **Siaga** dimulai pada jam tidur atau 8 jam sebelum alarm terdekat (mana yang lebih awal),
  sampai alarm selesai.
- Selama siaga: `SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)` supaya PC tidak
  tidur (layar boleh mati), klip omelan dan bunyi sudah diunduh, detak ke server tiap 30 detik.
- Bila PC dengan baterai tidak dicas pada jam tidur: notifikasi Windows + kabar ke web
  "PC belum dicas".
- Keluar aplikasi dari baki dikunci selama siaga dengan Mode Komitmen aktif.

## 6. Saat berbunyi

1. Pengatur waktu lokal ATAU peristiwa server `berbunyi` (yang lebih dulu; tidak dobel karena
   memakai id kejadian).
2. `SetThreadExecutionState(ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED)` + input tiruan kecil untuk
   menyalakan layar.
3. Volume: setiap 2 detik selama berbunyi, volume utama 100% dan bisu dibuka di **semua perangkat
   keluaran aktif**. Bila pengguna mengecilkan, dinaikkan lagi.
4. Suara diputar ke semua perangkat keluaran aktif (speaker laptop tetap bunyi walau headset
   Bluetooth tersambung). Pola suara sesuai `10-SUARA.md`.
5. Jendela alarm: layar penuh, selalu di atas, tanpa bingkai, tidak bisa diminimalkan; tutup
   (tombol, Alt+F4) dicegat; fokus direbut kembali tiap 1 detik. Monitor tambahan ditutup lapisan
   gelap bertulisan "Lihat layar utama".
6. Berhenti hanya bila server mengirim `berhenti` (soal terjawab di perangkat mana pun) atau soal
   luring terjawab di PC.

Batas yang diakui:
- Bila Windows **terkunci**, jendela tidak bisa tampil di atas layar kunci (aturan keamanan
  Windows). Suara tetap berbunyi; pengguna membuka kunci lalu langsung melihat soal.
- PC yang dimatikan total tidak bisa berbunyi.
- Mematikan paksa kedua proses sekaligus lewat Task Manager menghentikan bunyi PC; spam dan
  notifikasi tetap berjalan sampai soal terjawab di perangkat lain.

## 7. Pengaturan Windows yang disesuaikan otomatis

Pengguna tidak disuruh membuka Pengaturan Windows. Aplikasi memeriksa dan memperbaiki sendiri;
bila Windows mewajibkan izin, pengguna cukup menekan "Izinkan".

| Hal | Cara |
|---|---|
| Menyala saat Windows hidup | Diaktifkan saat pertama jalan. Bila pengguna mematikannya lewat Task Manager, aplikasi memberi tahu di web dan baki. |
| PC tidak tidur saat siaga | `SetThreadExecutionState`, tanpa mengubah pengaturan daya |
| Laptop ditutup | Bila aksi "tutup laptop saat dicas" = tidur, tawarkan satu klik "Jangan tidur saat ditutup dan dicas" (`powercfg`, mungkin minta izin admin; **wajib diuji**) |
| Volume dan bisu | Diatur saat berbunyi (§6) |
| Mode fokus / Jangan ganggu | Tidak berpengaruh, karena suara diputar langsung, bukan lewat notifikasi |
| Perangkat suara tidak ada | Peringatan di daftar periksa + web |

## 8. Distribusi dan pembaruan

- Unduhan langsung dari situs (Microsoft Store menyusul bila peminat banyak, K-13).
- Belum ada tanda tangan kode Windows: layar biru "Windows melindungi PC Anda" muncul sekali saat
  memasang. Halaman unduh menampilkan panduan 3 langkah bergambar + sidik SHA-256 berkas.
- Pembaruan otomatis lewat updater bertanda tangan ed25519 (kunci privat hanya di mesin rilis
  Chief; kunci publik di aplikasi). Periksa saat mulai dan sehari sekali. **Tidak pernah**
  memperbarui saat berbunyi atau < 1 jam sebelum alarm.
- Build: `.github/workflows/pc.yml`. Linux: format, clippy, tes `inti` + `klien`. Windows
  (`windows-latest`, setiap PR yang menyentuh `pc/` dan setiap tag `pc-v*`): clippy + tes seluruh
  workspace, pemasang NSIS per pengguna, tanda tangan pembaruan, lalu `scripts/rilis-pc.mjs`
  menulis `antikebo-pc.json` (versi, ukuran, SHA-256 untuk halaman unduh) dan `pembaruan.json`
  (manifest updater). Hasilnya artefak workflow.
- Rilis (sesi laptop): unggah isi artefak ke `UNDUH_DIR/pc/` di server (dipasang ke kontainer web,
  `/unduh/pc/*`). Alamat tetap `antikebo-pc-setup.exe` selalu menyajikan pemasang terbaru.
- Kunci pembaruan (L3): `tauri signer generate`, kunci privat ke rahasia repo
  `TAURI_SIGNING_PRIVATE_KEY` (+ kata sandi), kunci publik ditulis ke `tauri.conf.json`
  `plugins.updater.pubkey`. Sebelum itu aplikasi tidak memeriksa pembaruan (K-87).

## 9. Pengujian

- Logika (jadwal lokal, mesin alarm, pemilihan klip, soal luring, urutan omelan, aturan siaga,
  pengurai SSE, aksi tutup laptop, penjaga) dites di Linux: `cd pc && cargo test --workspace`,
  dengan contoh emas yang sama dengan TypeScript.
- Ujung ke ujung (`tests/e2e/pc.spec.ts`): `uji-pc` memakai klien + mesin yang sama dengan aplikasi,
  tersambung lewat kode yang disetujui di peramban, menerima alarm dari worker sungguhan lewat
  SSE, menjawab soal server, dan mengirim soal luring yang diperiksa ulang server.
- Tampilan (`tests/e2e/pc-ui.spec.ts`): jendela pengaturan dan alarm dengan proses utama ditiru.
- Aplikasi Tauri asli juga dijalankan di Linux (layar virtual) saat pengembangan: tersambung,
  alarm berbunyi dengan soal server, dijawab di web lalu PC berhenti, penjaga menyalakan ulang.
- Kode khusus Windows di balik `cfg(windows)`, dicek tipe untuk target Windows dan dibangun penuh di
  CI Windows (build + tes yang tidak butuh speaker).
- **Uji manual wajib di PC Chief** (paket L2), hasil dicatat di `KEPUTUSAN.md`:
  1. Pasang dari situs, layar biru, sambung, daftar periksa hijau.
  2. Alarm 2 menit lagi dengan PC terkunci, layar mati, volume 10% dan dibisukan.
  3. Coba tutup jendela, Alt+F4, minimalkan, kecilkan volume, cabut internet.
  4. Matikan satu proses lewat Task Manager.
  5. Headset Bluetooth tersambung.
  6. Laptop ditutup sambil dicas (setelah perbaikan satu klik).
  7. Dua monitor.
  8. Pembaruan otomatis dari versi lama.
  9. Membuka aplikasi dua kali (satu instans: jendela yang ada muncul).
  10. Omelan tanpa klip dibacakan suara bawaan Windows berbahasa Indonesia (bila ada), atau teks
      saja; catatan `antikebo.log` di `%LOCALAPPDATA%\id.agentbuff.antikebo` dilampirkan bila gagal.
