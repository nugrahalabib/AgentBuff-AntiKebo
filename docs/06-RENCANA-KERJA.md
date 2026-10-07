# Rencana kerja AntiKebo (versi 2)

Urutan = urutan ketergantungan, **bukan** pemangkasan fitur: semua paket wajib selesai sebelum
dijual. Ambil **paket cloud pertama yang belum selesai**. Satu sesi = satu paket (paket besar boleh
dibagi, status diperbarui). Centang butir dan perbarui status di akhir sesi.

**Cloud** = sesi claude.ai/code di repo ini. **Laptop** = sesi Claude di laptop Chief (punya VPS,
repo AgentBuff, PC Windows asli). Paket laptop tidak menghalangi paket cloud karena AgentBuff
ditiru (`AGENTBUFF_TIRUAN=1`).

| Paket | Isi | Tempat | Status |
|---|---|---|---|
| P0 | Kerangka dari template Tuya + server tiruan AgentBuff | Cloud | Selesai 2026-10-07 |
| P1 | Prototipe desain semua layar (untuk dinilai Chief) | Cloud | Selesai 2026-10-07 |
| P2 | Data, pengulangan, layanan alarm, template, Komitmen | Cloud | Selesai 2026-10-07 |
| P3 | Penjadwal, kejadian, SSE, perangkat siaga | Cloud | Selesai 2026-10-07 |
| P4 | Soal, tunda, Masih bangun, Misi QR, anti curang | Cloud | Selesai 2026-10-07 |
| P5 | Suara dan bunyi | Cloud | Selesai |
| P6 | Spam kanal, pengingat malam, notifikasi web | Cloud | Selesai |
| P7 | Rumah pintar Tuya | Cloud | Selesai |
| P8 | Layar inti tersambung API | Cloud | Selesai |
| P9 | Mode Jam Meja dan PWA | Cloud | Selesai |
| P10 | Aplikasi PC (Tauri) | Cloud | Belum |
| P11 | Orientasi, Siaga, Riwayat, Pengaturan, Template | Cloud | Belum |
| P12 | MCP paritas penuh + SKILL.md | Cloud | Belum |
| P13 | Mutu, keamanan, aksesibilitas, Inggris, legal | Cloud | Belum |
| L1 | Pintu kanal, pesan, suara di AgentBuff | Laptop | Belum |
| L2 | Rilis uji + uji PC dan HP asli | Laptop | Belum |
| L3 | Gerbang rilis dan terbitkan | Laptop | Belum |

---

## P0 Kerangka dari template Tuya

**Status: selesai 2026-10-07.** Bukti di cloud dan di klon bersih: jaga (12 penjaga), tsc, lint,
format, 65 tes vitest, build, 14 uji Playwright (desktop + 390 px) hijau; `deploy/uji-rls.sql`
lulus di PGlite dan Postgres 16 sungguhan. CI GitHub Actions menjalankan langkah yang sama di PR P0
dan PR digabung hanya bila hijau.

Tujuan: aplikasi kosong yang sudah lolos standar (masuk, cek hak, MCP kosong, worker, DB, deploy,
guard, tes, CI) dengan nama AntiKebo.

- [x] Salin kerangka `referensi/template-tuya/`: konfigurasi, `src/lib/{env,kripto,log}.ts`,
      `src/lib/agentbuff/*`, `src/lib/auth/*`, `src/lib/agen/*`, `src/lib/mcp/{server,dasar}.ts`,
      `src/lib/db/*` (tabel dasar: pengguna, sesi, token_mcp, jti_terpakai, audit), `src/proxy.ts`,
      halaman masuk, auth, mcp, health, hak, keluar, `src/worker/index.ts` (detak), `scripts/{jaga.mjs,
      migrasi.ts}`, `tests/integrasi/harness.ts`, `deploy/*`, `globals.css`, komponen UI dasar, i18n.
      (Tambahan: `status_hak`, `detak_worker`; tabel `aktivitas` template menjadi `audit`.)
- [x] Ganti semua `tuya` → `antikebo` (kuki, prefiks token, peran DB, kontainer, product key).
      Modul Tuya disalin lagi di P7.
- [x] Scope OIDC tambahan `agentbuff:kabar agentbuff:suara`, izin dicermin di `pengguna.izin_*`,
      tombol "Beri izin" (`prompt=consent`), cadangan otomatis ke scope dasar bila AgentBuff menjawab
      `invalid_scope` (K-24).
- [x] `tests/tiruan/agentbuff.ts`: server tiruan pintu `/masuk/kanal`, `/masuk/kabar`,
      `/masuk/suara`, `/masuk/suara/daftar` persis kontrak `05-INTEGRASI-AGENTBUFF.md` (suara tiruan =
      MP3 buatan skrip `tests/tiruan/suara.ts`), plus `/status` **dan OIDC lengkap** (K-23). Dipakai
      dev (`pnpm tiruan`, `AGENTBUFF_TIRUAN=1`) dan tes. Klien asli: `src/lib/agentbuff/pintu.ts`.
- [x] Kecualikan `referensi/` dari tsconfig, ESLint, Vitest, Prettier, `jaga`, build (dijaga penjaga
      `referensi-terkecuali`). Cargo: belum ada `pc/`; P10 wajib memakai workspace yang tidak
      menyentuh `referensi/`.
- [x] CI `.github/workflows/ci.yml`: jaga, tsc, lint, format, test, migrasi + uji RLS di Postgres 16,
      build, Playwright.
- [x] Lengkapi `scripts/sesi-cloud.sh`: peran + DB pengembangan, migrasi, `.env.local` acak (lewat
      `scripts/siapkan-lokal.sh`, juga dipakai CI).
- [x] Isi bagian "Perintah" di `CLAUDE.md`; `.env.example` lengkap (`03-ARSITEKTUR.md` §12, dijaga
      penjaga `env-contoh`).

Selesai bila: install, jaga, tsc, lint, test, build hijau di cloud dan CI; `/api/health` = `ok`;
`/masuk` tampil; tes harness jalan dengan peran non-bypass; server tiruan menjawab sesuai kontrak.

Catatan untuk paket berikutnya:
- P1/P8/P11: shell P0 hanya punya tab Alarm dan Pengaturan; tab Siaga, Riwayat, bilah samping
  laptop, Bara, Fajar, dan maskot Kebo menyusul. Tombol utama sudah grafit pil, toska untuk aktif.
- P3: K-07 (tenggang hak) butuh kolom "tidak aktif sejak" di `status_hak` dan satu modul aturan.
  SSE `/api/peristiwa` dan `LISTEN/NOTIFY` belum disalin (dibangun bersama token perangkat).
- P5/P6: pakai `src/lib/agentbuff/pintu.ts` (tidak pernah melempar; `ulangiSetelahMs` sudah dibaca).
- P12: `src/lib/mcp/alat.ts` baru berisi `get_setup_status`; `paritas.ts` + penjaganya belum ada.

## P1 Prototipe desain semua layar

**Status: selesai 2026-10-07.** 15 layar di galeri `/prototipe` (hanya pengembangan/tiruan,
K-30), 60 tangkapan layar (desktop + 390 px, terang + gelap) di PR P1. Bukti: 36 uji Playwright
prototipe (tiap layar tanpa galat konsol di kedua ukuran, interaksi soal salah/benar, roda jam
papan ketik) + seluruh uji P0 hijau dalam mode produksi.

Rujukan: `04-DESAIN.md` seluruhnya.

- [x] Token, kaca, latar ambient, Bara, Fajar, skala huruf, komponen dasar (tombol, kartu, lembar,
      sakelar, segmen, roda jam, papan angka, daftar bergrup, toast, spanduk), maskot Kebo (SVG).
      (Tambahan: `Penghitung`, `Cip`, `Cincin`, `KotakIkon`; maskot 4 pose: tidur, kaget, segar,
      netral.)
- [x] Layar statis dengan data contoh: Beranda (berisi + kosong), Ubah alarm, Berbunyi (hitungan dan
      QR), Selamat pagi, Masih bangun, Jam Meja (sebelum dan saat siaga), tab Siaga + halaman unduh
      PC, Riwayat, Pengaturan, Orientasi, jendela pengaturan aplikasi PC.
- [x] Tangkapan layar desktop dan 390 px, terang dan gelap, dilampirkan di PR.

Selesai bila: PR berisi semua tangkapan layar. Lanjut ke P2 tanpa menunggu; masukan Chief
dikerjakan di P8/P11 (catat di `KEPUTUSAN.md`).

Catatan untuk paket berikutnya:
- Layar adalah komponen presentasional murni di `src/components/layar/*` (data lewat props, tipe
  di `src/lib/tampilan/jenis.ts`). P8/P9/P11 **menyambungkan komponen yang sama** ke API, bukan
  membuat ulang: P8 = beranda, ubah-alarm, berbunyi, pagi-cek; P9 = jam-meja; P11 = siaga
  (+ unduh), riwayat, pengaturan-orientasi. Data contoh: `src/lib/prototipe/contoh.ts`.
- `Shell` sudah 4 tab + bilah samping laptop + tombol "Alarm baru"; `/app` masih memberi tab Alarm
  dan Pengaturan saja (prop `tab`) sampai halaman Siaga/Riwayat ada.
- Berbunyi: `periksa` masih lokal di prototipe; P4/P8 wajib mengirim jawaban ke server (kebenaran
  di server, K-20). Tombol tunda hanya tampil bila jatah ada.
- P10: jendela Tauri meniru `JendelaPc` (judul, daftar periksa, "Kamu dengar?").
- Grafik Riwayat memakai token `--grafik` (K-31); P11 tinggal mengisi skor 7/30 hari.

## P2 Data, pengulangan, layanan alarm, template, Komitmen

**Status: selesai 2026-10-07.** Bukti: 57 contoh emas pengulangan (dicek silang perhitungan
Python `zoneinfo` terpisah) + 6 tes properti fast-check (termasuk "semua jenis berulang 12 kali
naik"), 35 contoh emas Komitmen, 32 tes integrasi layanan di PGlite sebagai `antikebo_app`
(termasuk invarian satu kejadian menunggu pada urutan tindakan acak), `deploy/uji-rls.sql` 22/22
di PGlite dan Postgres 16 sungguhan; jaga, tsc, lint, format, 213 tes, build hijau.

Rujukan: PRD B1 sampai B11, E3; arsitektur §2, §3.

- [x] Migrasi tabel alarm, lewati_alarm, template_alarm, kejadian_alarm, langkah_kejadian,
      preferensi pengguna, RLS + `deploy/uji-rls.sql`. (`0002_alarm.sql`; preferensi = kolom
      baru di `pengguna`: nama panggilan, jam tidur, bawaan, pengingat malam, orientasi.)
- [x] `src/lib/jadwal/pengulangan.ts` + ≥ 40 contoh emas + tes properti; data libur nasional.
      (`tests/emas/pengulangan.json`; libur 2026 dan 2027 dari SKB 3 Menteri di
      `src/lib/jadwal/libur/`; aturan jam musim panas pasti untuk pengguna di luar negeri.)
- [x] Layanan alarm (buat, ubah dengan ID tetap, hapus, aktif, lewati, gandakan) menjaga satu
      kejadian `menunggu` per alarm aktif. Aturan Komitmen di satu modul murni + tes.
      (`src/lib/layanan/alarm.ts`, `src/lib/alarm/komitmen.ts`; juga layanan preferensi.)
- [x] Template bawaan. (5 template di kode + template pengguna maks 20, `src/lib/layanan/template.ts`.)

Selesai bila: tes hijau, guard rls hijau, semua pengulangan benar-benar berulang.

Catatan untuk paket berikutnya:
- P3: worker mengklaim kejadian `menunggu`, lalu WAJIB memanggil `materialisasi(tx, alarm, jadwal)`
  di transaksi yang sama supaya kejadian berikutnya langsung ada; alarm `sekali` diset
  `aktif = false` sesudah berbunyi. Kejadian `uji` tidak terkena indeks unik menunggu.
  `kejadianDalamRentang` siap untuk jadwal 24 jam perangkat siaga.
- P3/P4: selama kejadian `berbunyi`/`ditunda`/`cek_bangun`, layanan menolak ubah, hapus, matikan,
  dan lewati dengan `sedang_berbunyi` (K-37). Isi alarm disalin ke `kejadian_alarm.isi` saat mulai
  berbunyi.
- P8/P11: masukan web dan MCP lewat `SkemaMasukanAlarm` (isian bersarang boleh sebagian;
  `{ jenis: "sekali" }` tanpa tanggal = kemunculan jam berikutnya). Galat layanan sudah dalam
  bahasa pengguna (`galat.*` di kamus). Uraian pengulangan untuk layar ("Sen-Jum") belum ada:
  dibuat di P8 memakai `t.ulang` dan `t.hari`.
- P11: ganti zona memanggil `pindahZona` (sudah lewat `ubahPreferensi`); data libur 2028 wajib
  ditambah begitu SKB-nya terbit (`adaDataLibur` untuk peringatan di layar).
- P12: kode galat layanan dipetakan ke MCP: `komitmen_terkunci` → `commitment_locked` (dengan
  `terkunciSampai`), `sedang_berbunyi` → `alarm_ringing`, `masukan` → `validation`,
  `tidak_ditemukan` → `not_found`.

## P3 Penjadwal, kejadian, SSE, perangkat siaga

**Status: selesai 2026-10-07.** Bukti di Postgres 16 sungguhan (`tests/pg/penjadwal-pg.test.ts`,
dijalankan CI dengan `WAJIB_PG_ASLI=1`): dua worker berebut 40 kejadian, terbagi 19/21 tanpa
irisan; lima kejadian dibunyikan pewaktu + LISTEN dengan selisih tercatat 1 sampai 2 ms;
`berhenti` sampai ke aliran SSE PC (token) dan web dalam 6 ms. PGlite: 21 tes penjadwal (klaim,
terlewat, sekali, tunda, batas, langkah berulang, restart melanjutkan langkah yang ditinggal,
jaring pengaman materialisasi, NOTIFY per pengguna, SSE + cabut, sambung PC, Jam Meja, jadwal 24
jam, uji alarm). `deploy/uji-rls.sql` 28/28. Playwright: alur "Sambungkan PC ini?" penuh (masuk
lalu kembali ke kode, sambungkan, token sekali pakai, detak, jadwal, putus) di desktop dan 390 px.
Worker sungguhan menyala (`penjadwal menyala`) dan berhenti rapi.

Rujukan: PRD C1, C5, C6, H1, H4, H5; arsitektur §4, §5.

- [x] Worker: pemicu tepat waktu, klaim `SKIP LOCKED`, langkah berulang, pulih, detak, operator.
      (`src/lib/penjadwal/{mesin,penjadwal,saluran}.ts`; pewaktu tepat + ketukan 1 dtk + LISTEN;
      putaran kejadian terpisah dari putaran langkah supaya saluran lambat tidak menunda bunyi;
      kejadian > 30 menit terlambat = terlewat; langkah macet > 2 menit diulang; jaring pengaman
      materialisasi tiap 10 menit. Kabar operator bila detak basi: P13 bersama pemantau.)
- [x] SSE `/api/peristiwa` (sesi web dan token perangkat), peristiwa `jadwal`, `berbunyi`,
      `berhenti`, `tunda`, `cek`, `klip_siap`. (Ditambah `halo` berisi jam server, `cabut`,
      `perangkat`. Dipicu pemicu DB, K-40. `klip_siap` dikirim P5.)
- [x] Tabel `perangkat_siaga`, `kode_sambung`; API kode sambung, halaman `/sambung-pc`, detak,
      jadwal 24 jam untuk perangkat, cabut perangkat. (Juga daftar, ganti nama, daftar Jam Meja
      web; uji alarm PRD B9 sebagai layanan.)
- [x] Jenis langkah memakai antarmuka `Saluran` dengan implementasi tiruan (diisi P5 sampai P7).
      (Notifikasi, spam, Tuya, kabar terlewat = tiruan; batas berhenti sendiri PRD C4 = asli.)

Selesai bila: tes integrasi membuktikan tepat waktu (selisih tercatat), tidak dobel saat dua worker
berebut, restart di tengah alarm melanjutkan, berhenti terkirim ke semua perangkat ≤ 2 dtk.

Catatan untuk paket berikutnya:
- P4: soal benar memanggil `hentikanKejadian(tx, id, "bangun" | ...)` atau pindah ke `cek_bangun`
  (tambahkan transisi di `mesin.ts`, jangan di tempat lain); tunda memakai `tundaKejadian`.
  Penjawab sah: sesi pemilik atau token perangkat miliknya (`perangkatDariToken`).
- P5/P6/P7: ganti saluran tiruan lewat `pasangSaluran` (atau ubah `SALURAN_BAWAAN`); bentuk
  `Saluran` tetap. Spam per kanal memakai blok urutan 100000 per kanal. `klip_siap` = NOTIFY dari
  pembuat klip.
- P8/P11: rute uji alarm (`ujiAlarm`) dan `kejadianAktif` siap disambung; daftar perangkat sudah
  di `/api/app/perangkat`. "Siap malam ini" sementara = siaga sekarang (K-42).
- P9: Jam Meja mendaftar lewat `POST /api/app/perangkat`, detak `POST /api/perangkat/detak`
  dengan `perangkatId` (sesi), jadwal `GET /api/perangkat/jadwal`, SSE `/api/peristiwa`.
- P10: aplikasi PC memakai `POST /api/perangkat/kode` → buka `tautan` → polling
  `POST /api/perangkat/kode/ambil` {kode, rahasia} tiap 2 dtk; lalu Bearer token untuk detak,
  jadwal, SSE. Kunci dedup bunyi lokal = `kunci` item jadwal (`alarmId:tanggal`).
- P12: kode galat MCP untuk perangkat mengikuti layanan (`tidak_ditemukan`, `masukan`).
- P13: pemantau detak worker basi > 60 dtk dan kabar operator.

## P4 Soal, tunda, Masih bangun, Misi QR, anti curang

**Status: selesai 2026-10-07.** Bukti: contoh emas soal `tests/emas/soal.json` (77 kasus + PRNG +
benih luring) dibuat oracle Python terpisah dan cocok persis dengan TypeScript, plus tes properti
3000 benih per tingkat; 18 tes integrasi jawab (hitungan, turun tingkat, HMAC tanpa jawaban di
DB/audit/API, tunda + jatah, Masih bangun diketuk/tidak diketuk, ingat, ketik, Misi QR benar/salah
3 kali/kamera ditolak, gabungan, anti curang, rute token + batas laju 30/menit, luring); jsQR
membaca kode cetakan (termasuk kecil dan warna terbalik); `uji-rls.sql` 32/32; Playwright:
halaman cetak kode QR dan menjawab lewat sesi peramban (cek asal) di desktop dan 390 px; penjaga
baru `jalur-alarm` (13 penjaga) terbukti menangkap pelanggaran sungguhan.

Rujukan: PRD D1 sampai D8, E1, E2; arsitektur §9.

- [x] `src/lib/soal/`: hitungan 3 tingkat (aturan PRD §15), ingat angka, ketik kalimat, gabungan,
      turun tingkat, berkas contoh emas `tests/emas/soal.json` (dipakai juga oleh Rust di P10).
      (Deterministik dari benih mulberry32, K-46; luring dari benih turunan kunci kejadian, K-47.)
- [x] Tunda dengan jatah, Masih bangun, kode QR (buat, halaman cetak, pindai, hash).
      (`src/lib/layanan/{jawab,kode-qr}.ts`, `/app/kode-qr/[id]/cetak`, `src/lib/soal/pindai.ts`;
      transisi `lolosKejadian`, `konfirmasiBangun`, `bunyikanLagiDariCek` di `mesin.ts`.)
- [x] Endpoint jawab ber-batas laju; jawaban tidak pernah keluar ke peramban/log (tes).
      (`/api/kejadian/[id]/{soal,jawab,ganti-soal,masih-bangun}`, `/api/perangkat/kejadian/[id]/luring`.)
- [x] Guard `jaga`: tidak ada rute tanpa sesi/token atau alat MCP yang mematikan/menunda/menjawab.
      (Penjaga `jalur-alarm`, K-53.)

Catatan untuk paket berikutnya:
- P5: layar berbunyi memutar bunyi/omelan; soal datang dari `GET /api/kejadian/[id]/soal`.
- P6: saluran `cek_tampil` (notifikasi + satu pesan kanal saat "Masih bangun?" muncul) masih tiruan.
- P8: sambungkan `LayarBerbunyi` ke `/api/kejadian/[id]/soal` + `/jawab` (hasil `salah` = getar,
  `benar` = titik, `tahap` = ganti ke QR, `ditunda`, `selesai`), tombol tunda ke `?tujuan=tunda`,
  pemindai kamera memakai `bacaQrVideo` (impor dinamis jsQR), "Masih!" ke `/masih-bangun`.
- P10: PC luring membuat soal hitungan dengan `benihLuring(kunci, i)` dan mengirim semua jawaban ke
  `/api/perangkat/kejadian/[id]/luring`; port Rust wajib lulus `tests/emas/soal.json`.
- P11: daftar kode QR di Pengaturan memakai `/api/app/kode-qr` (buat, ganti nama, hapus, cetak);
  riwayat soal per kejadian lewat `riwayatSoal`.
- P12: MCP `create_wake_code` dkk. memakai layanan kode QR (bukan layanan jawab).

## P5 Suara dan bunyi

**Status: selesai 2026-10-07.** Bukti di cloud: jaga (13 penjaga), tsc, lint, format, 436 tes
vitest (termasuk Postgres 16 sungguhan), build, 62 uji Playwright mode produksi (desktop + 390 px);
`uji-rls.sql` 38/38 di PGlite dan Postgres 16. Kekerasan 8 bunyi dicocokkan silang dengan
`ffmpeg ebur128`. Rasa bunyi dan suara di speaker asli, iPhone saklar senyap: **wajib diuji** Chief (L2).

Rujukan: `10-SUARA.md`; PRD F1 sampai F7.

- [x] `scripts/bangun-bunyi.ts` + 8 bunyi + normalisasi + `public/bunyi/LISENSI.md` ("dibuat sendiri").
      (`src/lib/bunyi/sintesis.ts`: WAV PCM16 mono 22,05 kHz, −14 LUFS BS.1770, puncak ≤ −1,5 dBFS,
      K-54; tes memastikan berkas di repo sama persis dengan sintesis ulang.)
- [x] Naskah 5 karakter id/en + penyaring kata. (`src/lib/suara/karakter/*`, `saring.ts`,
      `naskah.ts`; kalimat pribadi maks 10 × 150 huruf lewat penyaring yang sama; Kustom wajib
      punya kalimat pribadi, K-57.)
- [x] Tabel `naskah_suara`, `klip_suara`; antrean worker; klien `/masuk/suara` dan `/masuk/suara/daftar`;
      status suara per alarm; unduh klip untuk perangkat. (`src/lib/suara/antrean.ts`,
      `src/lib/layanan/suara.ts`, `/api/perangkat/klip/[hash]`, `/api/app/suara`,
      `/api/app/suara/contoh`; omelan + hash klip ikut di jadwal perangkat; K-55, K-56, K-59, K-60.)
- [x] Pemutar web (Web Audio): lapisan bunyi + omelan, jeda 3 dtk, peredaman, acak tanpa ulang,
      kalimat waktu, cadangan `speechSynthesis`. (`src/lib/suara/pemutar.ts`,
      `src/components/layar/berbunyi-suara.tsx`; teks besar bila tanpa suara perangkat, nada bip bila
      berkas bunyi gagal, ajakan "Ketuk layar" bila peramban menahan audio, K-58.)

Selesai bila: tes antrean (ulang, galat tetap, pakai ulang klip), tes urutan putar (contoh emas),
uji Playwright layar berbunyi dengan suara tiruan. (Semua ada: `tests/integrasi/suara.test.ts`,
`tests/unit/suara.test.ts` + `tests/emas/urutan-suara.json` dari oracle Python,
`tests/e2e/suara.spec.ts` dengan MP3 suara tiruan di `/prototipe/bunyiHitungan?klip=1&berlalu=185`.)

Catatan untuk paket berikutnya:
- P6: kalimat `penutup` karakter dipakai sebagai pesan kanal; kalimat `cek` untuk "Masih bangun?".
  Ambil dari `naskahAlarm`/`kalimatAlarm` (sudah berisi nama panggilan), jangan menulis ulang.
- P8: layar berbunyi asli memakai `LayarBerbunyiBersuara` (bukan `LayarBerbunyi` polos) dengan
  `omelan` dari `omelanUntuk` (bentuknya sama dengan `jadwalPerangkat`), `benih` dari kejadian, dan
  `mulaiMs` = saat berbunyi. Ubah alarm: pilihan bunyi memakai `pratinjauBunyi` (5 dtk), pilihan
  suara `/api/app/suara` + contoh `/api/app/suara/contoh`, kalimat pribadi (galat ramah
  `kalimat_kasar`, `kalimat_kustom_wajib`). Kartu alarm menampilkan `alarm.suara` (siap / dibuat n
  dari total / belum + alasan + tombol "Beri izin" bila `belum_diizinkan`).
- P9: Service Worker menyimpan `public/bunyi/*.wav` dan klip 24 jam ke depan; siaga "siap" hanya
  bila semua klip tersimpan. `LayarBerbunyiBersuara` dipakai juga di Jam Meja (ketukan "Mulai
  siaga" sudah membuka audio, jadi ajakan ketuk tidak muncul).
- P10: rodio memutar WAV yang sama (dibundel), urutan omelan port Rust `urutan.ts` wajib lulus
  `tests/emas/urutan-suara.json`; klip diunduh dari `/api/perangkat/klip/[hash]` dengan token.
- P12: alat MCP `list_voices`, `preview_voice`, `get_voice_status`, dan `kalimatPribadi` di alat
  alarm (atau catat di `paritas.ts`).

## P6 Spam kanal, pengingat malam, notifikasi web

**Status: selesai 2026-10-07.** Bukti di cloud: jaga (13 penjaga), tsc, lint, format, 492 tes
vitest (termasuk Postgres 16 sungguhan), build, 68 uji Playwright mode produksi (desktop + 390 px);
`uji-rls.sql` 44/44 di PGlite dan Postgres 16; worker dibundel persis seperti Dockerfile lalu
dinyalakan. Notifikasi di HP/PC asli (Android, iPhone dari Layar Utama, Windows) dan pesan lewat
pintu AgentBuff asli: **wajib diuji** di L1/L2.

Rujukan: PRD G1 sampai G7; arsitektur §7.

- [x] Klien `/masuk/kanal` dan `/masuk/kabar`; langkah spam per kanal dengan jeda dan batas waktu;
      `terlalu_cepat` menggeser jadwal; jejak `kiriman_kanal`. (`src/lib/penjadwal/saluran-asli.ts`,
      `src/lib/kanal/aturan.ts`; platform kanal diambil sekali per kejadian untuk jeda; galat berhenti
      vs dicoba lagi, K-63; tabel `kiriman_kanal` tanpa isi pesan.)
- [x] Kumpulan pesan id/en tanpa AI; pesan penutup; pengingat malam; uji kanal. (`src/lib/pesan/`,
      K-61, K-62; `src/lib/layanan/pengingat.ts` dijalankan worker tiap menit, K-66; pesan uji
      `/api/app/kanal/uji`; daftar kanal `/api/app/kanal`; Pengaturan menampilkan kanal, kanal bawaan,
      pesan uji, notifikasi, pengingat malam.)
- [x] Web Push (VAPID) + Service Worker notifikasi alarm berulang. (`src/lib/push.ts`, `public/sw.js`,
      `/api/app/push`, `/api/app/push/uji`; tag per kejadian, ulang tiap 30 dtk, ditahan, diganti
      "Alarm sudah mati" sesudah berhenti, K-64, K-65. Juga notifikasi "Masih bangun?" dan kabar
      terlewat.)

Selesai bila (tidak tertulis di rencana awal; dipakai sesi ini): spam per kanal terbukti dengan jam
terkendali (jeda Telegram 15/Discord 20 dtk, kanal belum siap berhenti, `terlalu_cepat` menggeser,
batas waktu, tunda menghentikan lalu melanjutkan penghitung, penutup sesudah bangun, izin dicabut dan
agen mati), Web Push dibuka seperti peramban (aes128gcm + VAPID diverifikasi), Service Worker
menampilkan notifikasi dari push sungguhan di Chromium, pengingat malam sekali per malam.
(`tests/integrasi/kanal.test.ts`, `tests/unit/pesan.test.ts`, `tests/unit/sw.test.ts`,
`tests/e2e/kanal.spec.ts`.)

Catatan untuk paket berikutnya:
- P8: tautan di setiap pesan dan notifikasi menuju **`/app/bunyi/[id]`** (id kejadian): halaman
  layar berbunyi asli WAJIB ada di jalur itu. Saat layar itu menjawab soal dengan benar, penutup dan
  notifikasi "sudah mati" berjalan sendiri lewat mesin (`rencanaSelesai`), tidak perlu kode tambahan.
- P9: Mode Jam Meja mendaftarkan `/sw.js` yang sama (scope `/`) lalu menambah cache bunyi dan klip;
  jangan membuat Service Worker kedua. Langganan push boleh membawa `perangkatId` Jam Meja.
- P11: Riwayat memakai `GET /api/app/kejadian/[id]/kiriman` (jejak tanpa isi). Pengaturan lengkap
  memakai `GET/PATCH /api/app/preferensi` (sudah ada) dan memindahkan bagian kanal/notifikasi/pengingat
  dari `src/components/app/pengaturan-kanal.tsx` ke layar Pengaturan rancangan P1.
- P12: alat MCP `list_channels`, `send_test_message`, `get_delivery_log`, `update_preferences`
  (pengingat malam, kanal bawaan); langganan push hanya dari peramban (catat di `paritas.ts`).
- L1: pintu `/masuk/kanal` dan `/masuk/kabar` asli wajib lolos `tests/integrasi/tiruan-kontrak.test.ts`;
  sesudah itu jalankan pesan uji dari Pengaturan ke Telegram/WhatsApp asli.

## P7 Rumah pintar Tuya

**Status: selesai 2026-10-07.** Bukti di cloud: jaga (13 penjaga), tsc, lint, format, 557 tes
vitest (termasuk Postgres 16 sungguhan), build, 72 uji Playwright mode produksi (desktop + 390 px);
`uji-rls.sql` 51/51 di PGlite dan Postgres 16. Perangkat Tuya asli (lampu, AC, colokan) dan
telepon/SMS darurat ke nomor asli: **wajib diuji** di L2.

Rujukan: PRD I1 sampai I6; arsitektur §8.

- [x] Salin modul Tuya + wizard sambung + `connect_home` dari template. (`src/lib/tuya/*` disalin
      dari `937aa8a`, klien dipangkas; `src/lib/layanan/tuya.ts`; tabel `sambungan_tuya`,
      `perangkat_tuya`, `potret_tuya` + RLS; halaman `/app/rumah` (wizard 3 langkah, daftar per
      ruangan, uji perangkat, muat ulang, perbarui kunci, putuskan); rute `/api/app/rumah/*`; alat MCP
      `connect_home`, `list_home_devices`, `disconnect_home` (merusak, wajib `confirm: true`);
      `get_setup_status` menampilkan rumah pintar; server Tuya tiruan di `pnpm tiruan` port 3198.)
- [x] Aturan per perangkat per alarm (zod), potret dan pulihkan, naik bertahap, kedip, lapisan
      darurat tersembunyi. (`src/lib/penjadwal/saluran-tuya.ts`, K-68 sampai K-73; aturan diperiksa
      saat alarm disimpan: perangkat milik pengguna dan sanggup melakukan aksinya; spanduk kunci
      bermasalah di Beranda dan Rumah pintar.)
- [x] Tes dengan `tuya-tiruan`. (`tests/integrasi/tuya.test.ts` 8 kasus dengan jam terkendali,
      `tests/unit/tuya-*.test.ts`, `tests/e2e/rumah.spec.ts`.)

Selesai bila (tidak tertulis di rencana awal; dipakai sesi ini): kunci diuji ke Tuya sebelum
disimpan dan tidak pernah kembali ke peramban/agen; uji perangkat membedakan benar-benar melapor,
diterima tapi tidak dijalankan, dan offline; dengan jam terkendali terbukti naik bertahap sebelum
alarm, bareng, kedip 100/10 tiap 3 dtk, kedip berhenti terang tetap saat tunda dan saat menunggu
"Masih bangun?", aturan saat tunda, kembalikan keadaan, suasana pagi, aturan "sesudah" hanya bila
bangun, offline dilewati dan dicatat, kunci ditolak = bermasalah + spanduk, darurat mati bawaannya,
sesudah X menit, tiap 5 menit, maks 15 sehari, tidak untuk uji alarm.

Catatan untuk paket berikutnya:
- P8: layar Ubah alarm menampilkan bagian rumah pintar hanya bila tersambung; daftar perangkat dan
  aksi yang sanggup dilakukan dari `GET /api/app/rumah/perangkat` (`ruangan[].perangkat[].bisa`:
  nyala, terang, warna, suhuPutih, suhuAc {min,max}, modeAc). Simpan lewat isian `tuya` alarm yang
  sudah ada (galat `tuya_tidak_ada`/`tuya_tidak_bisa` sudah berbahasa pengguna).
- P11: Pengaturan rancangan P1 memuat baris "Rumah pintar" yang menuju `/app/rumah` (sudah ada di
  Pengaturan sekarang); orientasi langkah rumah pintar memakai wizard yang sama
  (`src/components/app/wizard-rumah.tsx`). Riwayat bisa membaca hasil langkah `tuya*`
  (`lewat: "offline"`, `status`) untuk menampilkan perangkat yang dilewati.
- P12: alat `get_home_status` dan `test_home_device` (layanan `statusRumah`, `ujiPerangkat` sudah
  ada); pengaturan lapisan darurat (`aturDarurat`) diberi alat atau dicatat sebagai pengecualian di
  `paritas.ts`; muat ulang perangkat (`sinkronkanPengguna`) juga.
- L2: uji dengan akun Smart Life dan perangkat asli: lampu naik bertahap terlihat halus, kedip tidak
  kena batas laju Tuya, AC inframerah (status mungkin tidak terbaca balik, jadi konfirmasi bisa
  hanya "terkirim"), telepon darurat benar-benar masuk.

## P8 Layar inti tersambung API

**Status: selesai 2026-10-07.** Bukti di cloud: jaga (13 penjaga), tsc, lint, format, 598 tes
vitest (termasuk Postgres 16 sungguhan dan contoh emas skor), build, 81 uji Playwright mode produksi
(desktop + 390 px) dengan worker sungguhan. Pemindaian kode QR dengan kamera HP asli, suara di HP
terkunci, dan layar alarm di aplikasi PC: **wajib diuji** di L2.

- [x] Beranda, Ubah alarm, Berbunyi (hitungan, ingat angka, ketik, QR), Selamat pagi, Masih bangun,
      dua alarm bersamaan, spanduk masalah, keadaan proses/galat/selesai. (Rute
      `/api/app/alarm` (+ `[id]`, `aktif`, `lewati`, `gandakan`), `/api/app/uji`,
      `/api/app/kejadian/aktif`, `/api/app/kejadian/[id]`; Beranda `src/components/app/beranda-alarm.tsx`
      dengan hitung mundur, sakelar, geser kartu di HP untuk lewati/hapus; lembar Ubah alarm lengkap
      `src/components/layar/ubah-alarm.tsx` (pengulangan lanjutan, karakter + dengar, kalimat pribadi,
      soal + kode QR, tunda, kanal, rumah pintar per perangkat, lanjutan, uji/lewati/gandakan/hapus);
      layar penuh `/app/bunyi/[id]` (`src/components/app/alarm-hidup.tsx`, `kartu-soal.tsx`) dengan
      suara P5; pengawas SSE yang membuka layar alarm; skor `src/lib/skor.ts` dengan contoh emas.)
- [x] Playwright: buat alarm, uji 1 menit, berbunyi, jawab, bangun, Masih bangun; tangkapan layar PR.
      (`tests/e2e/alarm.spec.ts`: uji alarm menunggu 60 detik sungguhan sampai worker
      membunyikannya; alarm biasa dimajukan jadwalnya di DB, K-79.)

Catatan untuk paket berikutnya:
- P9: Jam Meja cukup membuka `/app/bunyi/<id>` saat SSE `berbunyi` (pola `PengawasAlarm`), atau
  memasang `LayarAlarmHidup` langsung; bunyi dan soal sudah lengkap di sana. Spanduk "Belum ada
  perangkat siaga" di Beranda butuh tujuan tombol (`hrefSiaga`) begitu tab Siaga ada.
- P11: Riwayat memakai `skorKejadian`, `skorHarian`, `hariBeruntun` (`src/lib/skor.ts`, K-75).
  Tab Siaga dan Riwayat ditambahkan ke daftar tab `Shell` di `src/app/app/(utama)/layout.tsx`.
  Template: `POST /api/app/alarm?template=<id>` sudah menerima template; tinggal UI pilih template di
  lembar alarm baru. Pengaturan kode QR: lembar alarm sudah bisa membuat kode dan mencetaknya.
- P12: alat MCP untuk rute baru (`list_alarms`, `create_alarm`, `update_alarm`, `delete_alarm`,
  `set_alarm_enabled`, `skip_alarm`, `duplicate_alarm`, `test_alarm`); layar alarm (soal, tunda,
  Masih bangun) adalah pengecualian sengaja di `paritas.ts` (aturan teknis 2).
- P13: geser kartu hanya untuk sentuh; papan ketik dan pembaca layar memakai aksi yang sama di lembar
  Ubah alarm. Periksa kontras layar Bara dan Fajar dengan axe.

## P9 Mode Jam Meja dan PWA

**Status: selesai 2026-10-07.** Bukti di cloud: jaga (13 penjaga), tsc, lint, format, 608 tes
vitest, build, 87 uji Playwright mode produksi (desktop + 390 px) dengan worker sungguhan, termasuk
koneksi putus yang ditiru peramban. Di HP dan tablet asli **wajib diuji** (L2): bunyi saat saklar
senyap iPhone (`audioSession`), layar tetap menyala (Wake Lock), status dicas, dan pemasangan ke layar
utama di iPhone/Android.

Rujukan: PRD H2; `10-SUARA.md` §3, §6.

- [x] Manifest, ikon, Service Worker (cache bunyi + klip 24 jam), panduan pasang per platform.
      (`src/app/manifest.ts`, ikon dari `scripts/bangun-ikon.ts` ke `public/ikon/` dan
      `src/app/apple-icon.png`; `public/sw.js` menyimpan bunyi + klip yang diminta Jam Meja dan
      menyajikannya dari simpanan dulu, K-81; `src/components/app/panduan-pasang.tsx` untuk iPhone,
      Android, dan laptop, dengan tombol Pasang langsung di Chrome/Edge.)
- [x] Jam Meja: Mulai siaga (audio + Wake Lock + layar penuh), jam redup, tes bunyi, detak,
      pengatur waktu lokal, peringatan dicas/koneksi, iOS `audioSession`. (`/app/jam-meja`,
      `src/components/app/jam-meja.tsx`, `src/lib/jam-meja/jadwal-lokal.ts` dengan tes; alarm
      berbunyi di halaman yang sama dengan konteks audio yang dibuka "Mulai siaga", K-82; cadangan
      lokal saat koneksi putus, K-83; detak 30 detik, K-84; keluar dengan konfirmasi, K-85.)

Catatan untuk paket berikutnya:
- P10: aplikasi PC boleh memakai halaman web yang sama untuk jendela berbunyi; jadwal lokal dan soal
  luring di Rust (K-47). Pola tenggang 5 detik sebelum berbunyi sendiri ada di `jadwal-lokal.ts`.
- P11: tab Siaga (daftar perangkat, nama, terakhir terlihat, cabut, "Jadikan perangkat ini jam meja"
  menuju `/app/jam-meja`); arahkan `hrefSiaga` spanduk Beranda ke tab itu. Orientasi langkah 3
  memakai `PanduanPasang`, Jam Meja, dan izin notifikasi.
- P13: periksa aksesibilitas layar siaga (kontras jam redup sengaja rendah; teks bantu tetap AA).

## P10 Aplikasi PC (Tauri)

Rujukan: `09-APLIKASI-PC.md` seluruhnya.

- [ ] `pc/` Tauri v2: baki, sambung (kode), jadwal lokal, SSE, unduh klip, pemutar rodio ke semua
      keluaran, volume Core Audio, `SetThreadExecutionState`, jendela alarm terkunci, penjaga,
      autostart, single-instance, updater ed25519, soal luring (Rust) dengan contoh emas yang sama.
- [ ] Halaman unduh + panduan layar biru + sidik SHA-256.
- [ ] CI Windows (`.github/workflows/pc.yml`): cargo test + tauri build pada tag `pc-v*`.

Selesai bila: cargo test hijau di Linux dan Windows CI, pemasang terbentuk, daftar uji manual
§9 siap untuk L2.

## P11 Orientasi, Siaga, Riwayat, Pengaturan, Template

- [ ] Orientasi (PRD J), tab Siaga, Riwayat + skor (contoh emas) + grafik + ekspor CSV,
      Pengaturan lengkap, hapus data, UI template.

## P12 MCP paritas penuh + SKILL.md

Rujukan: `11-ALAT-MCP.md`.

- [ ] Semua alat, `paritas.ts` + guard, sambung otomatis, halaman Agen, `skill/SKILL.md`.
- [ ] Tes: 401 token salah/dicabut, `access_frozen`, `commitment_locked`, idempotensi.

## P13 Mutu, keamanan, aksesibilitas, Inggris, legal

- [ ] Audit kontras + axe semua halaman kedua tema, 320 px, teks 200%, keyboard, pembaca layar.
- [ ] Anggaran performa, batas laju, CSP, tinjauan keamanan.
- [ ] Kamus Inggris lengkap; privasi, ketentuan, "bukan jaminan".
- [ ] Bahan `integrasi-portal/`: teks listing id/en, `SKILL.md`, draf skrip bukti.

## L1 Pintu kanal, pesan, suara di AgentBuff (Laptop, repo AgentBuff)

Kontrak `05-INTEGRASI-AGENTBUFF.md` §4, §5. Rincian teknis ada di repo AgentBuff (privat). Selesai
bila skrip bukti di AgentBuff hijau dan AntiKebo lolos tes yang sama terhadap pintu asli.

## L2 Rilis uji + uji PC dan HP asli (Laptop)

- [ ] DNS `antikebo`, VPS (`pasang-pertama.sh`), deploy, klien OIDC, katalog `coming_soon`, hibah
      produk ke akun Chief, sambung MCP otomatis.
- [ ] Uji manual aplikasi PC (`09-APLIKASI-PC.md` §9) di PC Chief.
- [ ] Uji Jam Meja di iPhone dan Android (saklar senyap, layar redup, tab di latar, baterai).
- [ ] Hasil dicatat di `KEPUTUSAN.md`; perbaiki yang gagal.

## L3 Gerbang rilis dan terbitkan (Laptop)

- [ ] Semua butir `GERBANG-RILIS.md` hijau.
- [ ] Gambar listing, tutorial, terbitkan.
- [ ] Laporan perubahan di AgentBuff dan repo ini.
