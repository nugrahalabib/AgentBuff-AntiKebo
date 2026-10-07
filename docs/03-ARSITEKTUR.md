# Arsitektur AntiKebo (versi 2)

Dasar: pola `referensi/template-tuya/` (Next.js 16, worker terpisah, Postgres 16 ber-RLS, MCP
stateless, OIDC AgentBuff, deploy compose). Dokumen ini menjelaskan apa yang **baru atau
berbeda**. Bila bertentangan dengan kode template, ikuti template kecuali disebut lain di sini.

## 1. Komponen

| Komponen | Isi |
|---|---|
| `antikebo-web` | Next.js 16 standalone: halaman, API `/api/app/*`, `/mcp`, `/auth/agentbuff/*`, `/api/agentbuff/mcp-token`, API perangkat `/api/perangkat/*`, SSE `/api/peristiwa`, unduhan `/unduh/*` |
| `antikebo-worker` | Proses Node terpisah: penjadwal kejadian, langkah alarm (spam, Tuya, notifikasi), pembuat klip suara (antrean), pengingat malam, pengawas perangkat siaga, sinkron Tuya, detak, pembersihan |
| `antikebo-db` | Postgres 16 |
| AntiKebo untuk PC | Aplikasi Tauri v2 di Windows (repo yang sama, folder `pc/`). Spesifikasi `09-APLIKASI-PC.md` |
| AgentBuff (luar) | Masuk, cek hak, MCP otomatis, **daftar kanal, kirim pesan, buat suara** (kontrak `05-INTEGRASI-AGENTBUFF.md`) |

Stack sama dengan template, ditambah: `web-push`, `@date-fns/tz` (zona waktu), pustaka pindai QR
untuk peramban tanpa `BarcodeDetector` (mis. `jsqr`), `qrcode` untuk membuat kode, Tauri v2 +
Rust untuk aplikasi PC.

## 2. Model data

Nama tabel/kolom bahasa Indonesia, `snake_case`, waktu `timestamptz` (UTC). Semua tabel ber-
`pengguna_id`: RLS ENABLE + FORCE, lolos guard `rls`, peran tanpa BYPASSRLS. Migrasi SQL aditif.

| Tabel | Isi penting |
|---|---|
| `pengguna` | `agentbuff_sub` (unik), `nama_panggilan`, `zona_waktu`, `bahasa`, `jam_tidur`, `bawaan` (JSON alarm baru), `izin_kabar`, `izin_suara` (cermin izin AgentBuff terakhir) |
| `sesi`, `token_mcp`, `jti_terpakai`, `audit` | Sama dengan template |
| `perangkat_siaga` | `jenis` (`pc`/`web`), nama, hash token perangkat, versi aplikasi, `terakhir_terlihat`, `kemampuan` (JSON), `siap_sampai`, dicabut |
| `kode_sambung` | kode sambung PC: hash kode, `kedaluwarsa` (10 menit), status, perangkat hasil |
| `langganan_push` | endpoint, kunci tersandi, perangkat, terakhir berhasil |
| `alarm` | jam lokal, zona, `pengulangan` (JSON zod), `agenda_judul`, `agenda_detail`, `karakter`, `suara_id`, `bunyi`, `soal` (JSON), `tunda` (JSON), `spam` (JSON: kanal + jeda + batas waktu), `tuya` (JSON aturan), `komitmen` (bool), `masih_bangun` (JSON), `libur_nasional` (bool), aktif |
| `lewati_alarm` | tanggal lokal dilewati |
| `template_alarm` | nama, isi alarm (JSON), bawaan/buatan |
| `kejadian_alarm` | satu baris per bunyi: `jadwal_utc`, status (`menunggu`, `berbunyi`, `ditunda`, `cek_bangun`, `bangun`, `tidak_bangun`, `terlewat`, `dibatalkan`), jumlah tunda, waktu bangun, soal terakhir, terlambat (dtk), `uji` (bool) |
| `langkah_kejadian` | langkah terjadwal per kejadian (`jatuh_tempo_utc`, jenis, parameter, status, hasil), unik `(kejadian_id, jenis, urutan)` |
| `kiriman_kanal` | per pesan spam: kanal, status, alasan, id kiriman AgentBuff |
| `soal_kejadian` | jenis, tingkat, soal tampil (tanpa jawaban), hash jawaban + garam, percobaan, benar beruntun |
| `kode_qr` | nama tempat, hash isi kode (isi acak 128 bit), dibuat |
| `naskah_suara` | sumber (karakter/pribadi/agenda), teks, hash (teks + suara + gaya), status |
| `klip_suara` | `audio` (bytea), mime, durasi, penyedia, hash, dipakai terakhir |
| `sambungan_tuya`, `perangkat_tuya` | Salin dari template |
| `potret_tuya` | keadaan perangkat sebelum alarm per kejadian (untuk dikembalikan) |
| `detak_worker` | detak worker |

Klip disimpan bytea (pola `foto_kamera` template) supaya ikut cadangan DB. Klip yang tidak
dipakai alarm mana pun selama 30 hari dihapus.

## 3. Mesin pengulangan

Modul murni `src/lib/jadwal/pengulangan.ts` (tanpa DB): `kejadianBerikutnya(aturan, zona,
setelahUtc, opsi)` memperhitungkan hari terpilih, akhir bulan, hari ke-N, tiap N minggu, lewati,
libur nasional. Pakai pustaka zona waktu. Tes ≥ 40 contoh emas + tes properti `fast-check`.
Data libur `src/lib/jadwal/libur/<tahun>.json` dengan sumber resmi di berkas.

## 4. Penjadwal (bagian terpenting)

Tujuan: berbunyi p95 < 2 dtk, tidak dobel, tahan restart.

1. **Materialisasi.** Setiap alarm aktif selalu punya tepat satu `kejadian_alarm` `menunggu`
   untuk jadwal berikutnya (dibuat dalam transaksi yang sama dengan perubahan alarm).
2. **Pemicu.** Worker memegang jadwal terdekat di memori + `setTimeout` tepat + ketukan pengaman
   1 dtk; perubahan dikabarkan lewat `LISTEN/NOTIFY`.
3. **Klaim.** `SELECT ... WHERE status='menunggu' AND jadwal_utc <= now() FOR UPDATE SKIP
   LOCKED` → `berbunyi`, buat `langkah_kejadian` (spam per kanal, notifikasi, Tuya, batas waktu),
   kirim peristiwa `berbunyi` ke perangkat. Satu transaksi.
4. **Langkah.** Loop yang sama mengeksekusi langkah jatuh tempo (`SKIP LOCKED`), paralel dengan
   batas waktu per jenis. Langkah berulang (spam, notifikasi, kedip) menjadwalkan ulangan
   berikutnya sendiri selama kejadian masih `berbunyi`.
5. **Lolos.** Jawaban benar → `bangun` (atau `cek_bangun` bila Masih bangun aktif), langkah
   dibatalkan, peristiwa `berhenti` ke semua perangkat, Tuya dikembalikan, pesan penutup.
6. **Tunda.** → `ditunda`, langkah bunyi/spam dibatalkan (Tuya tetap), kejadian dibunyikan lagi
   saat tunda habis.
7. **Masih bangun.** `cek_bangun` → peristiwa `cek` ke perangkat; tidak dikonfirmasi 60 dtk →
   `berbunyi` lagi tanpa jatah tunda.
8. **Pulih.** Saat mulai: `menunggu` terlewat < 30 menit dibunyikan (terlambat), sisanya
   `terlewat` + beri tahu; `berbunyi` dilanjutkan.
9. **Detak** tiap 10 dtk; pemantau memberi tahu operator bila basi > 60 dtk.

**Perangkat juga memegang jadwal.** Perangkat siaga menerima daftar kejadian 24 jam ke depan
(beserta klip yang perlu diunduh) dan memasang pengatur waktu lokal. Pada jam alarm perangkat
langsung berbunyi walau peristiwa server terlambat atau internet putus; peristiwa server
menyusul sebagai konfirmasi. Tiap perubahan alarm mengirim peristiwa `jadwal` sehingga salinan
perangkat tidak basi; perangkat juga menarik ulang tiap 5 menit.

## 5. Waktu nyata ke perangkat

- Satu jalur SSE `/api/peristiwa` untuk web dan PC (PC memakai klien SSE di Rust), peristiwa:
  `halo` (jam server, untuk koreksi selisih jam perangkat), `jadwal`, `berbunyi`, `soal`, `tunda`,
  `berhenti`, `cek`, `klip_siap`, `cabut` (perangkat diputus: aliran ditutup), `perangkat` (web).
  Sumbernya pemicu DB yang mengirim NOTIFY `antikebo_peristiwa` berisi id saja (K-40).
- Urutan kunci: layanan mengunci baris pengguna lalu alarm lalu kejadian; worker mengunci kejadian
  (SKIP LOCKED) lalu alarm dengan SKIP LOCKED. Worker tidak pernah menunggu kunci layanan, jadi
  tidak ada kebuntuan; kejadian yang alarmnya sedang diubah dicoba lagi di ketukan berikutnya.
- Detak perangkat `POST /api/perangkat/detak` tiap 30 dtk (PC) atau 30 dtk (Jam Meja aktif).
  Perangkat dianggap siaga bila detak < 2 menit.
- Autentikasi: web pakai sesi; PC pakai token perangkat (Bearer, hash di `perangkat_siaga`).

## 6. Suara

Rincian `10-SUARA.md`. Ringkas arsitekturnya:

1. Simpan alarm → hitung naskah yang diperlukan → `naskah_suara` baru untuk yang belum ada klip.
2. Worker antrean suara memanggil klien AgentBuff `buatSuara(sub, teks, gaya, suara)` (batas
   paralel per pengguna 1, global 4, ulang dengan jeda bertambah bila gagal sementara).
3. Hasil masuk `klip_suara`, peristiwa `klip_siap` ke perangkat, perangkat mengunduh lewat
   `/api/perangkat/klip/:hash` (hanya klip milik pengguna).
4. Pemutar (web: Web Audio; PC: rodio) mencampur bunyi alarm berulang + klip dengan jeda 3 dtk.

## 7. Spam kanal

Klien AgentBuff `daftarKanal(sub)` dan `kirimPesan(sub, kanal, teks, kunciIdempoten)`.
Langkah spam per kanal dijadwalkan dengan jeda kanal; galat `terlalu_cepat` menggeser jadwal
sesuai `retryAfterMs`; galat `kanal_tidak_siap`/`belum_diizinkan` menghentikan kanal itu untuk
kejadian ini (dicatat, ditampilkan). Teks dari `src/lib/pesan/` (kumpulan kalimat id/en, tanpa AI).

## 8. Tuya

Salin `src/lib/tuya/*` dan layanan sambungan/rumah/suasana dari template. Penjadwal Tuya template
(20 dtk) **tidak** dipakai; aksi Tuya adalah langkah kejadian. Sebelum aksi pertama sebuah
kejadian, keadaan perangkat yang terlibat dipotret ke `potret_tuya` (pola `potretKeadaan`) supaya
bisa dikembalikan. Efek kedip = langkah berulang tiap 3 dtk dengan batas laju Tuya.

## 9. Soal

`src/lib/soal/` murni dan deterministik (benih mulberry32, K-46): pembuat soal per tingkat (aturan
PRD §15), pemeriksa, turun tingkat. Jawaban hash (HMAC-SHA256 dengan garam per soal dan kunci
turunan `SESSION_SECRET`, K-49). Satu-satunya jalan berhenti/tunda: `src/lib/layanan/jawab.ts`
lewat `src/lib/penjawab.ts` (dijaga penjaga `jalur-alarm`, K-53). Endpoint jawab: sesi atau token perangkat pemilik,
kejadian `berbunyi`, batas laju 30/menit. Misi QR: perangkat membaca isi QR, server membandingkan
hash. PC luring: soal dibuat lokal (modul Rust dengan aturan sama, dites dengan contoh emas yang
sama) dari benih turunan kunci kejadian, semua jawaban dikirim ke
`/api/perangkat/kejadian/[id]/luring` lalu server menghitung ulang soal yang sama (K-47).

## 10. Skor bangun

Per kejadian (bukan uji): mulai 100; −10 per tunda; −1 per menit dari berbunyi sampai lolos
sesudah 2 menit pertama (maks −40); −30 bila gagal Masih bangun; `tidak_bangun` = 0; terlewat
karena server tidak dihitung; minimal 0. Skor harian = rata-rata; hari beruntun = hari dengan
semua kejadian ≥ 70. Wajib tes contoh emas.

## 11. Keamanan

- CSP nonce + `Cache-Control: no-transform` (pola `proxy.ts` template).
- Batas laju: API, MCP (120/mnt, tulis 40/mnt), jawab soal, kode sambung, detak.
- Rahasia tersandi amplop (`ENCRYPTION_KEK`); token perangkat dan token MCP disimpan hash.
- Tidak ada endpoint tanpa sesi/token yang bisa mematikan, menunda, atau menjawab.
- Log tanpa rahasia, isi pesan, jawaban soal, atau teks naskah pribadi.

## 12. Variabel lingkungan (nama saja)

Dari template: `DATABASE_URL`, `DATABASE_URL_MIGRASI`, `APP_ORIGIN`, `SESSION_SECRET`,
`ENCRYPTION_KEK`, `AGENTBUFF_ISSUER`, `AGENTBUFF_ORIGIN`, `AGENTBUFF_PRODUCT_KEY` (`antikebo`),
`AGENTBUFF_MASUK_CLIENT_ID`, `AGENTBUFF_MASUK_CLIENT_SECRET`, `LOG_LEVEL`, kata sandi peran DB.

Baru: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (wajib sejak P6, K-65), `OPERATOR_KABAR` (tujuan
pemberitahuan operator), `PC_UPDATE_PUBKEY` (kunci publik pembaruan aplikasi PC), `AGENTBUFF_TIRUAN`
(`1` = pakai server tiruan untuk kanal/suara saat pengembangan).

Aplikasi menolak mulai bila variabel wajib kosong (pola `env.ts`).

## 13. Pengujian

- Unit: pengulangan, soal (TS dan Rust dengan berkas contoh emas yang sama), skor, naskah, jeda
  spam, Komitmen.
- Integrasi (PGlite + peran non-bypass): dua worker berebut kejadian, restart di tengah alarm,
  tunda, Masih bangun, berhenti di semua perangkat ≤ 2 dtk.
- Server tiruan: AgentBuff (kanal, pesan, suara), Tuya (`tuya-tiruan.ts`), push.
- Playwright: alur utama + Mode Jam Meja dengan audio tiruan; tangkapan layar di PR.
- Aplikasi PC: tes Rust di Linux untuk logika; build + tes Windows di GitHub Actions; daftar uji
  manual di laptop Chief (`09-APLIKASI-PC.md` §9).
- `scripts/jaga.mjs`: guard template + "tidak ada jalur mematikan alarm" + paritas MCP + tanpa
  tanda pisah panjang.
- CI: jaga, tsc, lint, test, build web, build PC (Windows).
