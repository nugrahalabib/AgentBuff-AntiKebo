# AntiKebo: panduan wajib untuk setiap sesi Claude

Berkas ini dibaca otomatis di setiap sesi, di cloud (claude.ai/code) maupun di laptop. Sesi cloud
TIDAK membawa memori laptop. Semua konteks ada di repo ini. Jangan minta pemilik bercerita ulang;
baca dokumennya.

## 1. Proyek ini apa

**AntiKebo** ("anti tidur kayak kebo"): alarm anti kesiangan untuk Marketplace AgentBuff,
**Rp29.000 sekali bayar**, di `https://antikebo.agentbuff.id`. Janji: **alarm tidak berhenti sampai
soal terjawab.** Konsep lengkap (versi 2, disepakati 2026-10-07): `docs/01-KONSEP.md`.

Empat bagian:
1. **Server** (web + worker + Postgres) di VPS: otak dan jadwal tepat detik.
2. **Web app/PWA:** pengaturan, layar berbunyi, **Mode Jam Meja** di HP/tablet.
3. **AntiKebo untuk PC** (Tauri, Windows): alarm yang tidak bisa ditutup. `docs/09-APLIKASI-PC.md`.
4. **Agen AgentBuff pengguna lewat MCP:** paritas penuh dengan web. `docs/11-ALAT-MCP.md`.

Integrasi AgentBuff: Masuk dengan AgentBuff (OIDC), cek hak, MCP otomatis, dan **pintu baru**
untuk daftar kanal, kirim pesan spam, dan membuat suara omelan (kontrak di
`docs/05-INTEGRASI-AGENTBUFF.md`; selama belum dibangun, pakai server tiruan).

## 2. Pemilik dan cara kerja yang dia mau

- Pemilik dipanggil **Chief**. Balas selalu dalam **Bahasa Indonesia sehari-hari**.
- **Jangan pakai tanda pisah panjang** (em dash/en dash) di teks UI, pesan, maupun balasan.
- Beri **satu rekomendasi**, bukan daftar opsi. Keputusan yang benar-benar milik Chief ditulis di
  `docs/KEPUTUSAN.md` bagian "Menunggu Chief", lalu lanjutkan bagian lain.
- **Tidak ada pola "MVP dulu".** Semua di `docs/02-PRD.md` adalah cakupan rilis. Urutan di
  `docs/06-RENCANA-KERJA.md` hanya urutan ketergantungan.
- **Jangan halu.** Yang dijanjikan harus benar-benar bisa; yang belum terbukti ditulis "wajib
  diuji". Selesai = terbukti jalan (tes hijau, tangkapan layar, bukti), bukan "kode sudah ditulis".
- **Wajib** menambah entri di `docs/LAPORAN-PERUBAHAN.md` (paling atas, bahasa sehari-hari dari sisi
  pengguna) setiap sesi yang mengubah sesuatu.
- Pelajari kode dan dokumen sebelum menyimpulkan. Jangan menyimpulkan "tidak ada" dari satu grep.
- Teks untuk pengguna: pendek, ramah, tanpa istilah teknis. Pesan galat mentah tidak boleh tampil.
- Repo ini **publik sementara**: jangan pernah commit rahasia, kunci, data pribadi, atau rincian
  internal AgentBuff (lokasi server, nama RPC internal, desain keamanan rinci).

## 3. Urutan baca di awal sesi

1. Berkas ini.
2. `docs/00-MULAI-DI-SINI.md` (peta dokumen, status terkini).
3. `docs/06-RENCANA-KERJA.md`: ambil **paket cloud pertama yang belum selesai**.
4. Dokumen yang dirujuk paket itu.
5. Entri teratas `docs/LAPORAN-PERUBAHAN.md`.

## 4. Referensi

| Folder | Isinya | Cara memakai |
|---|---|---|
| `referensi/template-tuya/` | Salinan AgentBuff-Tuya (`937aa8a`), aplikasi Marketplace yang sudah lolos standar | **Cetakan utama.** Salin kerangka (auth, cek hak, MCP, kripto, worker, deploy, jaga, harness tes, gaya kaca, modul Tuya) lalu sesuaikan. |
| `referensi/standar-agentbuff/` | Dokumen BYM dan portal AgentBuff | Acuan standar dan kontrak. Skrip `.ts.txt` hanya dibaca. |
| `referensi/aplikasi-lama/` | shila-wake (aplikasi lama), sudah dibersihkan | Hanya untuk tahu fitur dan cara lama membunyikan alarm (`docs/08-REFERENSI-LAMA.md`). Jangan salin kodenya. |

`referensi/` wajib dikecualikan dari tsconfig, ESLint, Vitest, Prettier, `jaga`, build, dan cargo.
Jangan pernah mengubah isi `referensi/`.

## 5. Aturan teknis yang tidak boleh dilanggar

1. **Tidak ada AI di dalam AntiKebo.** Naskah, pesan spam, soal dibuat tanpa AI. Suara omelan
   dibuat oleh **AgentBuff milik pengguna** lewat pintu suara, bukan oleh AntiKebo; AntiKebo tidak
   pernah memegang kunci API suara pengguna. Platform tidak menanggung biaya suara.
2. **Tidak ada jalan mematikan, menunda, atau menjawab alarm berbunyi** selain soal di layar
   alarm (sesi pengguna atau token perangkat miliknya). Tidak ada alat MCP atau API kunci-internal
   untuk itu. Mode Komitmen ditegakkan di web, PC, dan MCP.
3. **Alarm harus berbunyi tepat waktu tanpa bergantung pada satu titik.** Penjadwal server (p95 < 2
   dtk, tahan restart) + jadwal lokal di perangkat siaga. Bunyi alarm tidak pernah bergantung pada
   klip suara (selalu ada cadangan).
4. Konvensi template: Next.js 16 App Router, TypeScript ketat, Drizzle + Postgres 16, migrasi SQL
   aditif, **RLS ENABLE + FORCE** di setiap tabel pengguna, peran DB tanpa BYPASSRLS, rahasia
   tersandi amplop (`kripto.ts`), nama tabel/kolom bahasa Indonesia.
5. Next.js 16 berbeda dari versi lama. Baca `node_modules/next/dist/docs/` sebelum memakai pola Next.
6. zod: `z.strictObject` untuk masukan.
7. Rahasia (kunci Tuya, token perangkat, langganan push) tidak pernah dikirim ke peramban, dicatat
   di log, atau di-commit.
8. Teks UI hanya lewat kamus i18n (id dan en).
9. Setiap aturan jadwal, soal, skor, dan urutan putar suara punya tes contoh emas. Aturan soal yang
   sama dipakai TypeScript dan Rust lewat satu berkas contoh emas.
10. Setiap aksi web punya alat MCP atau tercatat sebagai pengecualian di `src/lib/mcp/paritas.ts`.

## 6. Cloud atau laptop

Cek `CLAUDE_CODE_REMOTE`. Bila `true`, kamu di cloud:

- Tidak ada SSH ke VPS, DB produksi, repo AgentBuff, atau PC Windows. **Jangan mencoba deploy.**
- Postgres 16 tersedia (`service postgresql start`, dijalankan hook SessionStart).
- AgentBuff lewat server tiruan (`AGENTBUFF_TIRUAN=1`). Tuya lewat server tiruan.
- Aplikasi PC: logika di crate `pc/inti` (tanpa Tauri) supaya `cargo test` jalan di VM Linux; build
  Windows lewat GitHub Actions.
- Kerjakan di cabang sendiri, buka PR, **gabungkan sendiri ke `main`** bila jaga, tsc, lint, tes,
  build hijau. Lampirkan tangkapan layar UI di PR.

Di laptop Chief: paket L1 sampai L3 (pintu AgentBuff, rilis, uji PC dan HP asli). Chief ingin
langsung push dan deploy tanpa ditanya, kecuali tindakan yang merusak data atau memutar kunci.

## 7. Akhir setiap sesi

1. Centang dan perbarui status paket di `docs/06-RENCANA-KERJA.md`.
2. Tambah entri paling atas di `docs/LAPORAN-PERUBAHAN.md`.
3. Catat keputusan baru di `docs/KEPUTUSAN.md`.
4. Perbarui "Status terkini" di `docs/00-MULAI-DI-SINI.md`.
5. Commit, push, PR, gabungkan bila semua hijau.

## 8. Perintah

Belum ada kode aplikasi. Paket P0 membuat kerangka dari template Tuya, lalu mengisi bagian ini
dengan perintah yang benar-benar dipakai (mis. `pnpm dev`, `pnpm test`, `node scripts/jaga.mjs`,
`pnpm exec tsc --noEmit`, `pnpm build`, `cargo test -p antikebo-inti`).
