# Rencana kerja AntiKebo (versi 2)

Urutan = urutan ketergantungan, **bukan** pemangkasan fitur: semua paket wajib selesai sebelum
dijual. Ambil **paket cloud pertama yang belum selesai**. Satu sesi = satu paket (paket besar boleh
dibagi, status diperbarui). Centang butir dan perbarui status di akhir sesi.

**Cloud** = sesi claude.ai/code di repo ini. **Laptop** = sesi Claude di laptop Chief (punya VPS,
repo AgentBuff, PC Windows asli). Paket laptop tidak menghalangi paket cloud karena AgentBuff
ditiru (`AGENTBUFF_TIRUAN=1`).

| Paket | Isi | Tempat | Status |
|---|---|---|---|
| P0 | Kerangka dari template Tuya + server tiruan AgentBuff | Cloud | Belum |
| P1 | Prototipe desain semua layar (untuk dinilai Chief) | Cloud | Belum |
| P2 | Data, pengulangan, layanan alarm, template, Komitmen | Cloud | Belum |
| P3 | Penjadwal, kejadian, SSE, perangkat siaga | Cloud | Belum |
| P4 | Soal, tunda, Masih bangun, Misi QR, anti curang | Cloud | Belum |
| P5 | Suara dan bunyi | Cloud | Belum |
| P6 | Spam kanal, pengingat malam, notifikasi web | Cloud | Belum |
| P7 | Rumah pintar Tuya | Cloud | Belum |
| P8 | Layar inti tersambung API | Cloud | Belum |
| P9 | Mode Jam Meja dan PWA | Cloud | Belum |
| P10 | Aplikasi PC (Tauri) | Cloud | Belum |
| P11 | Orientasi, Siaga, Riwayat, Pengaturan, Template | Cloud | Belum |
| P12 | MCP paritas penuh + SKILL.md | Cloud | Belum |
| P13 | Mutu, keamanan, aksesibilitas, Inggris, legal | Cloud | Belum |
| L1 | Pintu kanal, pesan, suara di AgentBuff | Laptop | Belum |
| L2 | Rilis uji + uji PC dan HP asli | Laptop | Belum |
| L3 | Gerbang rilis dan terbitkan | Laptop | Belum |

---

## P0 Kerangka dari template Tuya

Tujuan: aplikasi kosong yang sudah lolos standar (masuk, cek hak, MCP kosong, worker, DB, deploy,
guard, tes, CI) dengan nama AntiKebo.

- [ ] Salin kerangka `referensi/template-tuya/`: konfigurasi, `src/lib/{env,kripto,log}.ts`,
      `src/lib/agentbuff/*`, `src/lib/auth/*`, `src/lib/agen/*`, `src/lib/mcp/{server,dasar}.ts`,
      `src/lib/db/*` (tabel dasar: pengguna, sesi, token_mcp, jti_terpakai, audit), `src/proxy.ts`,
      halaman masuk, auth, mcp, health, hak, keluar, `src/worker/index.ts` (detak), `scripts/{jaga.mjs,
      migrasi.ts}`, `tests/integrasi/harness.ts`, `deploy/*`, `globals.css`, komponen UI dasar, i18n.
- [ ] Ganti semua `tuya` → `antikebo` (kuki, prefiks token, peran DB, kontainer, product key).
      Modul Tuya disalin lagi di P7.
- [ ] Scope OIDC tambahan `agentbuff:kabar agentbuff:suara` (diabaikan server tiruan bila belum ada).
- [ ] `tests/tiruan/agentbuff.ts`: server tiruan pintu `/masuk/kanal`, `/masuk/kabar`,
      `/masuk/suara`, `/masuk/suara/daftar` persis kontrak `05-INTEGRASI-AGENTBUFF.md` (suara tiruan =
      berkas audio pendek buatan skrip), plus `/status`. Dipakai dev (`AGENTBUFF_TIRUAN=1`) dan tes.
- [ ] Kecualikan `referensi/` dari tsconfig, ESLint, Vitest, Prettier, `jaga`, build.
- [ ] CI `.github/workflows/ci.yml`: jaga, tsc, lint, test, build.
- [ ] Lengkapi `scripts/sesi-cloud.sh`: peran + DB pengembangan, migrasi, `.env.local` acak.
- [ ] Isi bagian "Perintah" di `CLAUDE.md`; `.env.example` lengkap (`03-ARSITEKTUR.md` §12).

Selesai bila: install, jaga, tsc, lint, test, build hijau di cloud dan CI; `/api/health` = `ok`;
`/masuk` tampil; tes harness jalan dengan peran non-bypass; server tiruan menjawab sesuai kontrak.

## P1 Prototipe desain semua layar

Rujukan: `04-DESAIN.md` seluruhnya.

- [ ] Token, kaca, latar ambient, Bara, Fajar, skala huruf, komponen dasar (tombol, kartu, lembar,
      sakelar, segmen, roda jam, papan angka, daftar bergrup, toast, spanduk), maskot Kebo (SVG).
- [ ] Layar statis dengan data contoh: Beranda, Ubah alarm, Berbunyi (hitungan dan QR), Selamat
      pagi, Masih bangun, Jam Meja (sebelum dan saat siaga), tab Siaga + halaman unduh PC,
      Riwayat, Pengaturan, Orientasi, jendela pengaturan aplikasi PC.
- [ ] Tangkapan layar desktop dan 390 px, terang dan gelap, dilampirkan di PR.

Selesai bila: PR berisi semua tangkapan layar. Lanjut ke P2 tanpa menunggu; masukan Chief
dikerjakan di P8/P11 (catat di `KEPUTUSAN.md`).

## P2 Data, pengulangan, layanan alarm, template, Komitmen

Rujukan: PRD B1 sampai B11, E3; arsitektur §2, §3.

- [ ] Migrasi tabel alarm, lewati_alarm, template_alarm, kejadian_alarm, langkah_kejadian,
      preferensi pengguna, RLS + `deploy/uji-rls.sql`.
- [ ] `src/lib/jadwal/pengulangan.ts` + ≥ 40 contoh emas + tes properti; data libur nasional.
- [ ] Layanan alarm (buat, ubah dengan ID tetap, hapus, aktif, lewati, gandakan) menjaga satu
      kejadian `menunggu` per alarm aktif. Aturan Komitmen di satu modul murni + tes.
- [ ] Template bawaan.

Selesai bila: tes hijau, guard rls hijau, semua pengulangan benar-benar berulang.

## P3 Penjadwal, kejadian, SSE, perangkat siaga

Rujukan: PRD C1, C5, C6, H1, H4, H5; arsitektur §4, §5.

- [ ] Worker: pemicu tepat waktu, klaim `SKIP LOCKED`, langkah berulang, pulih, detak, operator.
- [ ] SSE `/api/peristiwa` (sesi web dan token perangkat), peristiwa `jadwal`, `berbunyi`,
      `berhenti`, `tunda`, `cek`, `klip_siap`.
- [ ] Tabel `perangkat_siaga`, `kode_sambung`; API kode sambung, halaman `/sambung-pc`, detak,
      jadwal 24 jam untuk perangkat, cabut perangkat.
- [ ] Jenis langkah memakai antarmuka `Saluran` dengan implementasi tiruan (diisi P5 sampai P7).

Selesai bila: tes integrasi membuktikan tepat waktu (selisih tercatat), tidak dobel saat dua worker
berebut, restart di tengah alarm melanjutkan, berhenti terkirim ke semua perangkat ≤ 2 dtk.

## P4 Soal, tunda, Masih bangun, Misi QR, anti curang

Rujukan: PRD D1 sampai D8, E1, E2; arsitektur §9.

- [ ] `src/lib/soal/`: hitungan 3 tingkat (aturan PRD §15), ingat angka, ketik kalimat, gabungan,
      turun tingkat, berkas contoh emas `tests/emas/soal.json` (dipakai juga oleh Rust di P10).
- [ ] Tunda dengan jatah, Masih bangun, kode QR (buat, halaman cetak, pindai, hash).
- [ ] Endpoint jawab ber-batas laju; jawaban tidak pernah keluar ke peramban/log (tes).
- [ ] Guard `jaga`: tidak ada rute tanpa sesi/token atau alat MCP yang mematikan/menunda/menjawab.

## P5 Suara dan bunyi

Rujukan: `10-SUARA.md`; PRD F1 sampai F7.

- [ ] `scripts/bangun-bunyi.ts` + 8 bunyi + normalisasi + `public/bunyi/LISENSI.md` ("dibuat sendiri").
- [ ] Naskah 5 karakter id/en + penyaring kata.
- [ ] Tabel `naskah_suara`, `klip_suara`; antrean worker; klien `/masuk/suara` dan `/masuk/suara/daftar`;
      status suara per alarm; unduh klip untuk perangkat.
- [ ] Pemutar web (Web Audio): lapisan bunyi + omelan, jeda 3 dtk, peredaman, acak tanpa ulang,
      kalimat waktu, cadangan `speechSynthesis`.

Selesai bila: tes antrean (ulang, galat tetap, pakai ulang klip), tes urutan putar (contoh emas),
uji Playwright layar berbunyi dengan suara tiruan.

## P6 Spam kanal, pengingat malam, notifikasi web

Rujukan: PRD G1 sampai G7; arsitektur §7.

- [ ] Klien `/masuk/kanal` dan `/masuk/kabar`; langkah spam per kanal dengan jeda dan batas waktu;
      `terlalu_cepat` menggeser jadwal; jejak `kiriman_kanal`.
- [ ] Kumpulan pesan id/en tanpa AI; pesan penutup; pengingat malam; uji kanal.
- [ ] Web Push (VAPID) + Service Worker notifikasi alarm berulang.

## P7 Rumah pintar Tuya

Rujukan: PRD I1 sampai I6; arsitektur §8.

- [ ] Salin modul Tuya + wizard sambung + `connect_home` dari template.
- [ ] Aturan per perangkat per alarm (zod), potret dan pulihkan, naik bertahap, kedip, lapisan
      darurat tersembunyi.
- [ ] Tes dengan `tuya-tiruan`.

## P8 Layar inti tersambung API

- [ ] Beranda, Ubah alarm, Berbunyi (hitungan, ingat angka, ketik, QR), Selamat pagi, Masih bangun,
      dua alarm bersamaan, spanduk masalah, keadaan proses/galat/selesai.
- [ ] Playwright: buat alarm, uji 1 menit, berbunyi, jawab, bangun, Masih bangun; tangkapan layar PR.

## P9 Mode Jam Meja dan PWA

Rujukan: PRD H2; `10-SUARA.md` §3, §6.

- [ ] Manifest, ikon, Service Worker (cache bunyi + klip 24 jam), panduan pasang per platform.
- [ ] Jam Meja: Mulai siaga (audio + Wake Lock + layar penuh), jam redup, tes bunyi, detak,
      pengatur waktu lokal, peringatan dicas/koneksi, iOS `audioSession`.

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
