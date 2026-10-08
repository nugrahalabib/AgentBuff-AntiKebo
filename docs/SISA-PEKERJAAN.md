# Sisa pekerjaan AntiKebo (serah terima ke sesi laptop)

Ditulis 2026-10-08, sesudah semua paket cloud (P0 sampai P13) selesai dan tergabung di `main`.
Untuk sesi Claude di laptop Chief yang punya akses ke repo AgentBuff, VPS, dan PC Windows. Baca
berkas ini dulu, lalu `CLAUDE.md`, `05-INTEGRASI-AGENTBUFF.md`, dan `GERBANG-RILIS.md`.

Repo ini publik: rincian internal AgentBuff (lokasi server, nama RPC, desain keamanan rinci) dan
rahasia tetap ditulis di repo AgentBuff atau di server, bukan di sini.

## 0. Ringkasan

| # | Pekerjaan | Tempat | Jenis | Selesai bila |
|---|---|---|---|---|
| 1 | Pintu kanal, kabar, suara (L1) | Repo AgentBuff | **Bangun** | Skrip bukti AgentBuff hijau dan AntiKebo jalan terhadap pintu asli (§2) |
| 2 | Siapkan produk di AgentBuff | Repo AgentBuff | Konfigurasi | Klien OIDC, katalog `coming_soon`, MCP otomatis, hibah ke akun Chief (§3) |
| 3 | Pasang VPS dan deploy | VPS + laptop | Konfigurasi | `antikebo.agentbuff.id` tayang, deploy aman berjalan (§4) |
| 4 | Uji di perangkat asli (L2) | PC Chief, iPhone, Android | Uji | Semua butir §5 tercatat di `KEPUTUSAN.md`, yang gagal diperbaiki |
| 5 | Bukti produksi (L3) | Produksi | Uji | 13 butir `GERBANG-RILIS.md` hijau (§6) |
| 6 | Terbitkan | Repo AgentBuff | Rilis | Gambar listing, tutorial, status terbit, laporan perubahan (§6) |
| 7 | Keputusan Chief | Chief | Keputusan | K-07, K-114a, K-116 kabar beku lewat kanal (§7) |

Urutan yang disarankan: 1 dan 2 dulu (bisa paralel), lalu 3, 4, 5, 6. Uji suara dan pesan kanal di
langkah 4 dan 5 baru bisa jalan setelah pintu langkah 1 ada.

## 1. Yang sudah jadi (jangan dikerjakan ulang)

- Seluruh AntiKebo sisi repo ini: web/PWA, worker penjadwal, Mode Jam Meja, aplikasi PC (Tauri),
  48 alat MCP, rumah pintar Tuya, privasi dan ketentuan, aksesibilitas, aturan beku. Semua diuji
  terhadap server tiruan: 671 tes vitest, 127 uji Playwright mode produksi, `cargo test`, CI hijau
  (web, pc-linux, pc-windows).
- Sisi AntiKebo dari integrasi AgentBuff sudah ada: klien OIDC (`src/lib/agentbuff/oidc.ts`), cek
  hak (`status.ts`), MCP + penerima token otomatis (`POST /api/agentbuff/mcp-token`), dan klien
  pintu baru (`src/lib/agentbuff/pintu.ts`, tidak pernah melempar galat, `alasan` asing dianggap
  "tidak terjangkau").
- Bahan untuk AgentBuff: `integrasi-portal/listing.md` (isian katalog, deskripsi, tutorial id/en),
  `integrasi-portal/bukti.md` (draf langkah skrip bukti), `skill/SKILL.md`.

## 2. L1: pintu baru di AgentBuff (satu-satunya yang masih harus dibangun)

**Sumber kebenaran:** `docs/05-INTEGRASI-AGENTBUFF.md` §4 dan §5. Perilaku yang diharapkan juga
bisa dibaca dari server tiruan `tests/tiruan/agentbuff.ts` (meniru kontrak persis).

Yang dibangun:
- `POST /masuk/kanal`: daftar kanal chat pribadi pemilik (Telegram, WhatsApp, Discord, Slack,
  Google Chat) dengan `id` stabil, `siap`, dan `alasan` bila belum siap.
- `POST /masuk/kabar`: kirim teks (maks 1000 huruf) ke kanal, idempoten 24 jam lewat `kunci`
  (maks 64 huruf), jeda minimal per kanal (Telegram 5 dtk, Discord/Slack/Google Chat 15 dtk,
  WhatsApp 30 dtk, jawab `429 terlalu_cepat` + `ulangiSetelahMs`).
- `POST /masuk/suara/daftar` dan `POST /masuk/suara`: suara omelan dari pengaturan suara pengguna
  di AgentBuff (sama dengan Telepon Agent), gaya `galak`/`biasa`, maks 300 huruf, kuota 300 klip
  per hari per pengguna, jawaban berkas audio + header `X-AgentBuff-Penyedia`, `X-AgentBuff-Suara`,
  `X-AgentBuff-Durasi-Ms`. AntiKebo tidak pernah menerima kunci API suara pengguna.
- Scope `agentbuff:kabar` dan `agentbuff:suara` di layar persetujuan (tanpa izin = `403
  belum_diizinkan`).
- Urutan pemeriksaan wajib (K-25): kredensial klien, badan, `sub`, hak, izin, lalu aturan pintu.
  Tabel galat lengkap di 05 §4.

Cara membuktikan:
- `tests/integrasi/tiruan-kontrak.test.ts` adalah daftar perilaku yang harus sama. Tes ini
  **belum bisa diarahkan langsung ke pintu asli** karena mengatur keadaan tiruan lewat `t.atur(...)`
  (hak, izin, agen mati, penyedia gagal, kuota). Untuk pintu asli: tulis skrip bukti di repo
  AgentBuff dengan akun uji di tiap keadaan, mengikuti kasus-kasus di tes itu.
- Lalu jalankan AntiKebo lokal tanpa `AGENTBUFF_TIRUAN`, dengan `AGENTBUFF_ISSUER` ke AgentBuff asli
  dan klien `antikebo-dev`: pilih kanal di Pengaturan, kirim pesan uji, buat klip suara, bunyikan
  alarm uji. Pesan harus sampai di Telegram dan WhatsApp asli.

Bila kontrak perlu diubah: perbarui 05 lebih dulu, lalu tiruan, lalu tes kontrak di repo ini.

**Celah yang harus diputuskan saat L1 (ditemukan saat menyusun catatan ini):** kabar "aksesmu
berakhir" dan peringatan malam sebelum alarm ditahan (`src/lib/layanan/beku.ts`,
`src/lib/layanan/pengingat.ts`) dikirim lewat `/masuk/kabar`. Menurut kontrak, pintu memeriksa hak
lebih dulu, jadi untuk akun yang haknya sudah berakhir pintu asli akan menjawab `403 tidak_berhak`
dan pesan kanal tidak pernah sampai. Hanya notifikasi web yang terkirim. Tes cloud lolos karena
tiruannya masih menganggap hak aktif saat itu. Rekomendasi: `/masuk/kabar` tetap menerima pesan
selama 96 jam sesudah hak berakhir (tenggang 3 hari + malam sebelumnya), dengan izin dan batas jeda
yang sama. Tulis di 05 §4, lalu sesuaikan tiruan dan `tests/integrasi/beku.test.ts` supaya tiruan
juga menganggap hak berakhir.

## 3. Siapkan produk di AgentBuff (repo AgentBuff)

Dari 05 §1, §3, §6 dan 06 L2:
- Klien OIDC `antikebo` (redirect `https://antikebo.agentbuff.id/auth/agentbuff/callback`) dan
  `antikebo-dev` (redirect `http://localhost:3100/auth/agentbuff/callback`). Scope `openid email
  profile agentbuff:kabar agentbuff:suara`. Berkas rahasia klien dipakai `pasang-pertama.sh`.
- Katalog: product key `antikebo`, kategori `produktivitas`, Rp29.000 sekali bayar, status
  `coming_soon` dulu. Isi dari `integrasi-portal/listing.md`.
- Sambung MCP otomatis: asersi ES256 ke `POST /api/agentbuff/mcp-token` (`typ=mcp-token+jwt`,
  `aud=antikebo`, `purpose=mcp_token`, umur maks 120 dtk, `jti` sekali pakai), token berprefiks
  `antikebo_` berumur 90 hari. Skill pendamping: `skill/SKILL.md` apa adanya.
- Hibah produk ke akun Chief untuk uji. Ikon toko bila belum ada.

## 4. Pasang di VPS dan deploy (L2)

- DNS `antikebo.agentbuff.id`.
- Clone repo ke server, jalankan `deploy/pasang-pertama.sh` sekali (perlu
  `ANTIKEBO_RAHASIA_MASUK` = berkas klien OIDC). Skrip ini idempoten, tidak pernah menimpa `.env`
  yang sudah ada, dan mengisi sendiri semua variabel wajib: alamat dan issuer, klien OIDC dari
  berkas itu, `SESSION_SECRET`, `ENCRYPTION_KEK`, kata sandi peran DB, kunci VAPID, lalu memasang
  jadwal cadangan tiap 6 jam.
- Variabel wajib (nama saja, lengkapnya `src/lib/env.ts` dan `03-ARSITEKTUR.md` §12):
  `DATABASE_URL`, `APP_ORIGIN`, `SESSION_SECRET`, `ENCRYPTION_KEK`, `AGENTBUFF_ISSUER`,
  `AGENTBUFF_ORIGIN`, `AGENTBUFF_PRODUCT_KEY`, `AGENTBUFF_MASUK_CLIENT_ID`,
  `AGENTBUFF_MASUK_CLIENT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
  Opsional: `OPERATOR_KABAR`, `UNDUH_DIR`, `LOG_LEVEL`. `AGENTBUFF_TIRUAN` tidak boleh ada di
  produksi (aplikasi menolak menyala bila `APP_ORIGIN` bukan localhost).
- Deploy rutin dari laptop sesudah push ke `main`: isi `deploy/.env.deploy` (diabaikan git), lalu
  `bash deploy/deploy.sh` (cadangan, hitung baris, migrasi aditif, gerbang RLS, cek sehat, hitung
  ulang). Kunci VAPID jangan pernah diganti (semua langganan notifikasi putus).
- Aplikasi PC: pemasang dibangun `.github/workflows/pc.yml` (tag `pc-v*`), isi artefaknya diunggah
  ke `UNDUH_DIR/pc/`. Untuk pembaruan otomatis: `tauri signer generate`, kunci privat ke rahasia
  repo `TAURI_SIGNING_PRIVATE_KEY` (+ kata sandinya), kunci publik ke `pc/src-tauri/tauri.conf.json`
  `plugins.updater.pubkey`. Sebelum itu aplikasi tidak memeriksa pembaruan (K-87). Pemasang tidak
  bertanda tangan kode, jadi muncul layar biru Windows; panduannya sudah ada di halaman Unduh (K-13).

## 5. Uji di perangkat asli (L2)

Catat hasil per butir di `KEPUTUSAN.md`. Yang gagal diperbaiki, atau kalimatnya dihapus dari
listing (lihat "Wajib diuji sebelum dipakai di listing" di `integrasi-portal/listing.md`).

- **PC Windows** (`09-APLIKASI-PC.md` §9, 10 butir): pasang dari situs, alarm saat PC terkunci dan
  dibisukan, coba tutup/Alt+F4/cabut internet, matikan proses lewat Task Manager, headset Bluetooth,
  laptop ditutup sambil dicas, dua monitor, pembaruan otomatis, buka dua kali, suara bawaan Windows.
- **HP (Mode Jam Meja dan PWA):** iPhone (bunyi saat saklar senyap, layar redup, layar tetap
  menyala, pasang ke Layar Utama), Android (tab di latar, baterai, layar redup). Notifikasi web di
  Android, iPhone (dari Layar Utama), dan Windows. Perkenalan di HP. Pindai kode QR dengan kamera.
- **Suara:** rasa 8 bunyi dan klip omelan di speaker asli.
- **Rumah pintar:** perangkat Tuya asli (lampu, AC, colokan) dan telepon/SMS darurat ke nomor asli.
- **Pembaca layar:** naskah `AKSESIBILITAS.md` §2 (VoiceOver, TalkBack, Narator/NVDA).
- **Performa:** LCP, INP, CLS di HP asli terhadap produksi (di mesin uji: JS awal 156 sampai 223 KB,
  CLS 0, LCP maks 0,4 dtk).

## 6. Bukti produksi dan terbit (L3)

Status `GERBANG-RILIS.md` per 2026-10-08:

| Butir | Status | Yang masih kurang |
|---|---|---|
| 1 Ujung ke ujung | Belum | Skrip `prove-antikebo-beli` (13 langkah di `integrasi-portal/bukti.md`) |
| 2 Ketepatan | Belum | 24 jam, minimal 200 kejadian, p95 < 2 dtk dari `kejadian_alarm.terlambat_dtk`, restart worker di tengah alarm |
| 3 Aplikasi PC | Belum | Uji manual §5 |
| 4 Jam Meja di HP | Belum | Uji manual §5 |
| 5 Suara | Belum | Pintu suara asli (§2), pengguna tanpa dan dengan kunci penyedia, cadangan saat pintu gagal |
| 6 Spam kanal | Belum | Pintu kabar asli (§2), Telegram dan WhatsApp asli |
| 7 Anti curang | Cloud lulus | Ulangi di produksi |
| 8 MCP | Cloud lulus | Skrip `prove-antikebo-mcp` (7 langkah di `bukti.md`) |
| 9 Aksesibilitas | Cloud lulus | Pembaca layar di perangkat asli |
| 10 Contoh emas | Lulus | |
| 11 Deploy aman | Belum | Log deploy pertama + tes pulih dari cadangan |
| 12 Legal | Cloud siap | Nama badan hukum dan tinjauan hukum (K-114a), tayang di produksi |
| 13 Listing | Bahan siap | 3 gambar 1600 x 900 dari layar asli, terbit |

Sesudah semua hijau: ubah status katalog dari `coming_soon` ke terbit, tulis laporan perubahan di
repo AgentBuff dan di `docs/LAPORAN-PERUBAHAN.md`.

## 7. Keputusan yang menunggu Chief

- **K-07, angka tenggang 3 hari.** Kalau diubah, ubah bersama-sama: `TENGGANG_BEKU_MS` di
  `src/lib/agentbuff/aturan-beku.ts`, `tests/emas/beku.json`, teks "3 hari" di kamus id/en
  (`src/lib/i18n/kamus/`, bagian `beku`, `mcp`, `legal`), dan `skill/SKILL.md`. Catatan: K-07 juga
  menyebut "pemberitahuan H-3" (3 hari sebelum akses berakhir). Ini belum dibuat karena cek hak
  AgentBuff tidak memberi tanggal berakhir. Untuk produk sekali bayar jarang relevan. Rekomendasi:
  hapus H-3 dari K-07, kecuali cek hak kelak memberi tanggal berakhir.
- **K-114a, badan hukum pengendali data.** Isi nama badan hukum di kamus `legal` (id dan en) dan
  minta tinjauan ahli hukum atas `/privasi` dan `/ketentuan` sebelum terbit.
- **K-116, kabar beku lewat kanal** (celah di §2). Rekomendasi ada di sana dan di `KEPUTUSAN.md`.

## 8. Pengingat aturan untuk sesi laptop

- Tidak ada AI di dalam AntiKebo. Tidak ada jalan mematikan, menunda, atau menjawab alarm selain
  soal di layar alarm. AntiKebo tidak pernah memegang kunci API suara pengguna.
- "Selesai" berarti terbukti jalan (tes, tangkapan layar, catatan uji), bukan kode sudah ditulis.
- Setiap sesi yang mengubah sesuatu menambah entri paling atas di `docs/LAPORAN-PERUBAHAN.md` dan
  memperbarui status L1 sampai L3 di `docs/06-RENCANA-KERJA.md`.
- Chief ingin langsung push dan deploy tanpa ditanya, kecuali tindakan yang merusak data atau
  memutar kunci.
