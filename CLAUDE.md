# AntiKebo: panduan wajib untuk setiap sesi Claude

Berkas ini dibaca otomatis di setiap sesi, baik di cloud (claude.ai/code) maupun di laptop.
Sesi cloud TIDAK membawa memori laptop. Semua konteks proyek ada di repo ini. Jangan minta
pemilik bercerita ulang; baca dokumennya.

## 1. Proyek ini apa

**AntiKebo** ("anti tidur kayak kebo") adalah aplikasi alarm anti kesiangan untuk
Marketplace AgentBuff. Dijual **Rp29.000 sekali bayar**, tayang di `https://antikebo.agentbuff.id`,
dan minimal setara standar aplikasi BYM (Buff Your Money) dan Tuya milik AgentBuff.

- **Otaknya di server (VPS), bukan di PC atau HP pengguna.** Jadwal, tangga bangun, perangkat
  Tuya, telepon, Telegram, dan notifikasi semua dijalankan worker di server 24 jam.
- Aplikasinya berupa web app yang bisa dipasang di HP (PWA). Konsep lengkap: `docs/01-KONSEP.md`.
- Integrasi AgentBuff: masuk lewat "Masuk dengan AgentBuff" (OIDC), cek hak beli, dan alat MCP
  supaya agen AgentBuff pengguna bisa mengatur alarm dari chat.

## 2. Pemilik dan cara kerja yang dia mau

- Pemilik dipanggil **Chief**. Balas selalu dalam **Bahasa Indonesia sehari-hari**.
- **Jangan pakai tanda pisah panjang** (em dash/en dash) di teks UI, pesan, maupun balasan.
- Beri **satu rekomendasi**, bukan daftar opsi A/B/C. Kalau ada keputusan yang benar-benar milik
  Chief, tulis di `docs/KEPUTUSAN.md` bagian "Menunggu Chief" lalu lanjutkan bagian lain.
- **Tidak ada pola "MVP dulu".** Semua fitur di `docs/02-PRD.md` adalah cakupan rilis. Urutan
  di `docs/06-RENCANA-KERJA.md` hanya urutan ketergantungan, bukan pemangkasan fitur.
- Selesai artinya terbukti jalan (tes hijau, tangkapan layar, bukti), bukan "kodenya sudah ditulis".
- **Wajib** menambah entri di `docs/LAPORAN-PERUBAHAN.md` (paling atas, bahasa sehari-hari dari
  sisi pengguna) setiap sesi yang mengubah sesuatu.
- Pelajari kode dan dokumen yang ada sebelum menyimpulkan. Jangan menyimpulkan "tidak ada" hanya
  dari satu kali grep.
- Teks untuk pengguna: pendek, ramah, tanpa istilah teknis. Pesan galat mentah tidak boleh tampil.

## 3. Urutan baca di awal sesi

1. Berkas ini.
2. `docs/00-MULAI-DI-SINI.md` (peta dokumen dan status terkini).
3. `docs/06-RENCANA-KERJA.md`: ambil **paket kerja pertama yang belum selesai**.
4. Dokumen yang dirujuk paket itu (konsep, PRD, arsitektur, desain, integrasi).
5. Entri teratas `docs/LAPORAN-PERUBAHAN.md` (pekerjaan terakhir).

## 4. Referensi: apa yang boleh dan tidak boleh ditiru

| Folder | Isinya | Cara memakai |
|---|---|---|
| `referensi/template-tuya/` | Salinan repo AgentBuff-Tuya (commit `937aa8a`), aplikasi Marketplace Rp29.000 yang sudah lolos standar | **Cetakan utama.** Salin kerangkanya (auth OIDC, cek hak, MCP, kripto, worker, deploy, jaga, harness tes, gaya kaca) lalu sesuaikan. |
| `referensi/standar-agentbuff/` | Dokumen BYM (README, desain, teknis, gerbang rilis) dan dokumen/skrip portal AgentBuff | Acuan standar dan kontrak integrasi. Skrip portal disimpan `.ts.txt`, hanya untuk dibaca. |
| `referensi/aplikasi-lama/` | Kode AntiKebo lama ("shila-wake"), sudah dibersihkan dari data pribadi | **Sampah.** Hanya untuk melihat fitur apa saja yang dulu ada. Jangan salin kodenya. Ringkasannya di `docs/08-REFERENSI-LAMA.md`. |

- `referensi/` **wajib dikecualikan** dari `tsconfig`, ESLint, Vitest, Prettier, `jaga`, dan build.
- Jangan pernah mengubah isi `referensi/`.

## 5. Aturan teknis yang tidak boleh dilanggar

1. **Tidak ada LLM di dalam aplikasi.** Semua kecerdasan datang dari agen AgentBuff pengguna yang
   memanggil alat MCP AntiKebo. Pesan spam, kata penyemangat, dan tantangan dibuat tanpa LLM.
2. **Agen tidak boleh mematikan atau menunda alarm yang sedang berbunyi.** Hanya manusia lewat
   tantangan di aplikasi. Ini inti anti kesiangan; jangan sediakan alat MCP atau API tanpa sesi
   untuk itu.
3. **Alarm harus berbunyi tepat waktu tanpa bergantung pada perangkat pengguna.** Penjadwal di
   worker server, akurasi target 2 detik, tahan restart (lihat `docs/03-ARSITEKTUR.md`).
4. Ikuti konvensi template: Next.js 16 App Router, TypeScript ketat, Drizzle + Postgres 16,
   SQL migrasi aditif saja, **RLS ENABLE + FORCE** di setiap tabel milik pengguna, peran DB tanpa
   BYPASSRLS, rahasia pengguna disandikan amplop (`kripto.ts`), nama tabel/kolom bahasa Indonesia.
5. Next.js 16 berbeda dari versi lama. Baca `node_modules/next/dist/docs/` sebelum memakai pola Next.
6. zod: pakai `z.strictObject` untuk masukan; `z.object` diam-diam membuang kolom baru.
7. Rahasia (kunci Tuya, token Telegram, langganan push) tidak pernah dikirim ke peramban, tidak
   pernah dicatat di log, tidak pernah di-commit.
8. Teks UI hanya lewat kamus i18n; tidak ada string keras di komponen (ikuti guard template).
9. Setiap rumus dan aturan jadwal punya tes contoh emas (golden test).

## 6. Cloud atau laptop

Cek `CLAUDE_CODE_REMOTE`. Kalau `true`, kamu di cloud:

- Tidak ada SSH ke VPS dan tidak ada akses ke database produksi. **Jangan mencoba deploy.**
- Postgres 16 tersedia di VM (`service postgresql start`, sudah dijalankan hook SessionStart).
- Kerjakan di cabang sendiri, buka PR, lalu **gabungkan sendiri ke `main`** bila `jaga`, `tsc`,
  lint, tes, dan build semuanya hijau. Cantumkan tangkapan layar UI di PR untuk dicek Chief.
- API luar (Tuya, Telegram, push) diuji dengan server tiruan. Uji dengan kunci asli hanya bila
  variabel lingkungan uji tersedia (lihat `docs/07-SESI-CLOUD.md`).

Kalau di laptop Chief: rilis ke VPS, pendaftaran produk di portal, dan uji produksi dikerjakan dari
sini (paket kerja Rilis). Chief ingin langsung push dan deploy tanpa ditanya, kecuali tindakan yang
merusak data atau memutar kunci.

## 7. Akhir setiap sesi

1. Centang dan perbarui status paket di `docs/06-RENCANA-KERJA.md`.
2. Tambah entri paling atas di `docs/LAPORAN-PERUBAHAN.md`.
3. Catat keputusan baru di `docs/KEPUTUSAN.md`.
4. Perbarui bagian "Status terkini" di `docs/00-MULAI-DI-SINI.md`.
5. Commit, push, PR, gabungkan bila semua hijau.

## 8. Perintah

Belum ada kode aplikasi. Paket kerja P0 membuat kerangka dari template Tuya. Sesudah itu, isi
bagian ini dengan perintah yang benar-benar dipakai (mis. `pnpm dev`, `pnpm test`,
`node scripts/jaga.mjs`, `pnpm exec tsc --noEmit`, `pnpm build`).
