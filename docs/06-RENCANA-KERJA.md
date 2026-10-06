# Rencana kerja AntiKebo

Urutan ini urutan ketergantungan, bukan pemangkasan fitur: semua paket wajib selesai sebelum
dijual. Ambil **paket pertama yang belum selesai**. Satu sesi cloud sebaiknya satu paket (atau
sebagian paket besar) supaya konteks tetap segar. Perbarui status dan centang di akhir sesi.

Tempat kerja: **Cloud** = sesi claude.ai/code. **Laptop** = sesi Claude di laptop Chief (punya
SSH ke VPS dan repo portal).

| Paket | Isi | Tempat | Status |
|---|---|---|---|
| P0 | Kerangka dari template Tuya | Cloud | Belum |
| P1 | Data dan mesin pengulangan | Cloud | Belum |
| P2 | Penjadwal dan Tangga Bangun | Cloud | Belum |
| P3 | Saluran: push, Telegram, Tuya | Cloud | Belum |
| P4 | Tantangan, tunda, Cek Masih Bangun | Cloud | Belum |
| P5 | Sistem desain dan prototipe layar | Cloud | Belum |
| P6 | Layar inti alarm | Cloud | Belum |
| P7 | Mode Malam dan PWA | Cloud | Belum |
| P8 | Rilis uji pertama dan bukti di HP asli | Laptop | Belum |
| P9 | Rutinitas, pengingat, perangkat, riwayat, pengaturan, orientasi | Cloud | Belum |
| P10 | MCP dan agen | Cloud | Belum |
| P11 | Mutu, keamanan, aksesibilitas, bahasa Inggris, legal | Cloud | Belum |
| P12 | Gerbang rilis dan terbitkan | Laptop | Belum |

---

## P0 Kerangka dari template Tuya

Tujuan: repo berisi aplikasi kosong yang sudah lolos standar (masuk, cek hak, MCP kosong,
worker, DB, deploy, guard, tes, CI) dengan nama AntiKebo.

- [ ] Salin kerangka dari `referensi/template-tuya/`: konfigurasi (package.json, tsconfig,
      eslint, vitest, next.config, postcss), `src/lib/{env,kripto,log}.ts`,
      `src/lib/agentbuff/*`, `src/lib/auth/*`, `src/lib/agen/*`, `src/lib/mcp/{server,dasar}.ts`,
      `src/lib/db/*` (skema kosong + tabel dasar: pengguna, sesi, token_mcp, jti_terpakai, audit),
      `src/proxy.ts`, `src/app/{layout,masuk,auth,mcp,api/health,api/agentbuff,api/hak,api/keluar}`,
      `src/worker/index.ts` (kosong tapi hidup, detak jantung), `scripts/{jaga.mjs,migrasi.ts}`,
      `tests/integrasi/harness.ts`, `deploy/*`, `globals.css`, komponen UI dasar, i18n.
- [ ] Ganti semua nama `tuya` jadi `antikebo` (kuki, prefiks token, peran DB, kontainer, folder
      VPS, product key). Buang kode khusus Tuya yang belum dipakai (modul `src/lib/tuya/` akan
      disalin lagi di P3).
- [ ] Kecualikan `referensi/` dari tsconfig, ESLint, Vitest, Prettier, `jaga`, dan build.
- [ ] `.github/workflows/ci.yml` (pola BYM): jaga, tsc, lint, test, build.
- [ ] Lengkapi `scripts/sesi-cloud.sh`: buat peran dan database pengembangan di Postgres VM,
      jalankan migrasi, isi `.env.local` pengembangan dengan nilai acak (bukan rahasia asli).
- [ ] Isi bagian "Perintah" di `CLAUDE.md`.
- [ ] `.env.example` lengkap (nama variabel di `03-ARSITEKTUR.md` §10).

Selesai bila: `pnpm install`, `node scripts/jaga.mjs`, `pnpm exec tsc --noEmit`, `pnpm lint`,
`pnpm test`, `pnpm build` hijau di cloud dan di CI; `/api/health` menjawab `ok`; halaman
`/masuk` tampil; tes integrasi harness jalan dengan peran non-bypass.

## P1 Data dan mesin pengulangan

Rujukan: PRD B1 sampai B5, B12; arsitektur §2, §3.

- [ ] Migrasi tabel alarm, lewati_alarm, kejadian_alarm, langkah_kejadian, kiriman_saluran,
      preferensi pengguna, dengan RLS dan uji RLS (`deploy/uji-rls.sql` diperbarui).
- [ ] `src/lib/jadwal/pengulangan.ts` + tes contoh emas (≥ 40 kasus) + tes properti.
- [ ] Data libur nasional Indonesia (tahun berjalan dan berikutnya) dengan sumber resmi.
- [ ] Layanan alarm (buat, ubah dengan ID tetap, hapus, aktif/nonaktif, lewati) yang selalu
      menjaga satu kejadian `menunggu` per alarm aktif.

Selesai bila: semua tes hijau, guard `rls` hijau, tidak ada pengulangan yang "cuma sekali jalan".

## P2 Penjadwal dan Tangga Bangun

Rujukan: konsep "Tangga Bangun"; PRD C1 sampai C6, N1, N4; arsitektur §4.

- [ ] Worker: pemicu tepat waktu (timer + ketukan 1 detik + LISTEN/NOTIFY), klaim
      `FOR UPDATE SKIP LOCKED`, eksekusi langkah paralel dengan batas waktu per saluran.
- [ ] Preset tangga per tingkat dan tangga kustom tervalidasi zod.
- [ ] Pulih setelah restart (terlambat < 30 mnt dibunyikan, selebihnya `terlewat`).
- [ ] Detak jantung dan pemberitahuan operator.
- [ ] Saluran masih tiruan di paket ini (antarmuka `Saluran` dengan implementasi palsu).

Selesai bila: tes integrasi membuktikan tepat waktu (selisih tercatat), tidak dobel saat dua
worker berebut, restart di tengah tangga melanjutkan dengan benar, alarm bersamaan tidak saling
menimpa.

## P3 Saluran: push, Telegram, Tuya

Rujukan: konsep "Bagaimana HP ikut berbunyi"; PRD D1 sampai D4, E1 sampai E7; arsitektur §5.

- [ ] Web Push (VAPID) + service worker notifikasi alarm.
- [ ] Bot Telegram: webhook bertanda rahasia, tautan `/start`, spam bervariasi tanpa LLM,
      hapus pesan setelah bangun, putus tautan.
- [ ] Salin modul Tuya dari template (`klien`, `wilayah`, `kemampuan`, `kamus-dp`,
      `konfirmasi`, `sambungan`), sinkron perangkat, aksi per jenis, matahari terbit,
      telepon `voice/self-send`, push `push/self-send`, cuaca.
- [ ] Server tiruan untuk ketiganya dan tes integrasi.
- [ ] Bila `TUYA_KUNCI_UJI` tersedia: uji telepon ke nomor Chief dan catat hasilnya (berdering
      atau tidak, jeda, nomor penelepon) di `KEPUTUSAN.md`. Ini butir 1 "Harus dibuktikan".

Selesai bila: semua saluran lolos tes tiruan, batas laju (C5) dipatuhi, kegagalan satu saluran
tidak menghentikan saluran lain.

## P4 Tantangan, tunda, Cek Masih Bangun

Rujukan: PRD F1 sampai F8, G1; arsitektur §6.

- [ ] Hitungan 3 tingkat (aturan + tes contoh emas), Kode Bangun (daftar dan pindai), ketik
      kalimat, goyang HP, gabungan Nuklir, jalan keluar aman.
- [ ] Tunda dengan batas per tingkat.
- [ ] Cek Masih Bangun.
- [ ] Guard `jaga`: tidak ada alat MCP atau rute tanpa sesi yang bisa mematikan/menunda alarm.

Selesai bila: jawaban tidak pernah keluar ke peramban/log (tes), tantangan terikat ke kejadian,
semua tes hijau.

## P5 Sistem desain dan prototipe layar

Rujukan: `04-DESAIN.md` seluruhnya.

- [ ] Token, kelas kaca, latar ambient per waktu, gradasi Fajar, skala huruf, komponen dasar
      (tombol, kartu, lembar, sakelar, kontrol tersegmen, roda jam, daftar bergrup, toast).
- [ ] Prototipe statis: Beranda, Ubah alarm, Berbunyi, Tantangan, Mode Malam, Orientasi.
- [ ] Tangkapan layar desktop dan 390 px, terang dan gelap, dilampirkan di PR untuk Chief.

Selesai bila: Chief menyetujui arah lewat PR (catat di `KEPUTUSAN.md`). Kalau Chief belum
menjawab, lanjut ke paket backend yang tersisa dan kembali ke sini.

## P6 Layar inti alarm

- [ ] Beranda, Ubah alarm, Tangga Bangun, Berbunyi, Tantangan, Kode Bangun, Bangun berhasil,
      Masih bangun?, semua tersambung ke API nyata dengan keadaan proses, galat, selesai.
- [ ] Uji Playwright alur: buat alarm, uji coba 1 menit, berbunyi, jawab tantangan, bangun.

## P7 Mode Malam dan PWA

Rujukan: PRD D5, D6, L1 sampai L4.

- [ ] Manifest, ikon, service worker, kerangka luring, panduan pasang per platform.
- [ ] Mode Malam: Wake Lock, `<audio>` + audio session playback, SSE + detak, pengatur waktu
      cadangan lokal, peringatan baterai.
- [ ] Suara ucapan di layar berbunyi.
- [ ] Pustaka suara berlisensi jelas + `public/suara/LISENSI.md`.

## P8 Rilis uji pertama dan bukti di HP asli (Laptop)

Rujukan: `05-INTEGRASI-AGENTBUFF.md` §4, §5; konsep "Harus dibuktikan".

- [ ] Chief: buat bot Telegram lewat BotFather, tambah DNS `antikebo` di Cloudflare.
- [ ] Portal: `siapkan-antikebo.ts` (status `coming_soon`), klien OIDC `antikebo` dan
      `antikebo-dev`, hibah produk ke akun Chief.
- [ ] VPS: `pasang-pertama.sh`, deploy, sertifikat, webhook Telegram.
- [ ] Bersama Chief di iPhone dan Android: jalankan keenam butir "Harus dibuktikan" dan catat
      hasilnya di `KEPUTUSAN.md`. Sesuaikan konsep bila ada yang gagal.

## P9 Rutinitas, pengingat, perangkat, riwayat, pengaturan, orientasi

Rujukan: PRD A4, A5, H, I, J, M, E2, E6.

- [ ] Semua layar dan API, dengan skor bangun sesuai rumus arsitektur §8 (tes contoh emas).
- [ ] Ekspor CSV riwayat.

## P10 MCP dan agen

Rujukan: PRD K1 sampai K4; arsitektur §7.

- [ ] Semua alat MCP + `PETUNJUK`, sambung otomatis, halaman Agen, `skill/SKILL.md`.
- [ ] Tes perilaku MCP: 401 untuk token salah/dicabut, `access_frozen` saat beku, idempotensi.

## P11 Mutu, keamanan, aksesibilitas, bahasa Inggris, legal

- [ ] Audit kontras dan axe semua halaman di kedua tema, 320 px, teks 200%, keyboard, pembaca
      layar untuk 5 alur utama.
- [ ] Anggaran performa (PRD §17), batas laju, CSP, tinjauan keamanan.
- [ ] Kamus bahasa Inggris lengkap.
- [ ] Kebijakan privasi, ketentuan, pernyataan "bukan jaminan".
- [ ] Siapkan `integrasi-portal/` (draf `siapkan-antikebo.ts`, `prove-antikebo-beli.ts`,
      teks listing id/en, `SKILL.md`).

## P12 Gerbang rilis dan terbitkan (Laptop)

- [ ] Jalankan semua butir `docs/GERBANG-RILIS.md` sampai hijau.
- [ ] Gambar listing, tutorial, terbitkan dengan `--terbitkan`.
- [ ] Entri laporan perubahan di portal dan repo ini.
