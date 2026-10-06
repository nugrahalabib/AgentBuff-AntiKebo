# Gerbang rilis Marketplace BYM (PRD §11.2) — status & bukti

> ✅ **DIRILIS 1 Oktober 2026.** Semua butir hijau; katalog `buff-your-money` berstatus **`available`**
> (Rp29.000/bulan, langganan) di Marketplace AgentBuff. Dokumen ini tetap dipakai sebagai daftar bukti
> yang bisa dijalankan ulang sesudah perubahan besar — jalankan ulang bukti butir yang tersentuh sebelum
> deploy, dan perbarui baris ini bila hasilnya berubah. Tindak lanjut yang tidak menghalangi penjualan
> ada di bagian "Tindak lanjut" di bawah.
>
> Semua bukti peramban ada di repo AgentBuff (`scripts/prove-bym-*.ts`), dijalankan **di VPS** dari
> `/root/agentbuff` dengan `pnpm tsx --env-file=.env.local scripts/<nama>.ts > /tmp/x.log 2>&1`
> (⛔ jangan disalurkan ke `head`/`tail` — SIGPIPE membunuh proses sebelum jejak uji dibersihkan).

Terakhir diperbarui: **1 Oktober 2026**.

| # | Butir | Status | Bukti / yang kurang |
|---|---|---|---|
| 1 | Ujung-ke-ujung produksi (beli → masuk → orientasi → catat via WhatsApp → lihat → cabut → beku → perpanjang → pulih) | ✅ | `prove-bym-beli` 18/18 (akun sekali-pakai: halaman katalog & publik → beli lewat Midtrans → webhook bertanda tangan → token otomatis → persetujuan → catat → hak habis = beku → perpanjang = pulih, data utuh) · `prove-bym-daftar-agen` 22/22 (daftar, persetujuan, gajian, dompet, anggaran, tujuan — semuanya dari chat) · `prove-bym-berkas` 23/23 (foto nota & rekening koran lewat agen + "Tambah foto nota" di aplikasi) · `prove-masuk-bym` 34/34 · `prove-bym-agen` 8/8 (agen di kontainer AgentBuff mencatat sungguhan) · `prove-bym-mcp` 45/45 (beku `-32010` saat hak dicabut & pulih). Akun Chief tersambung otomatis sejak 30 Sep (48 alat terbaca dari kontainernya). |
| 2 | Kontras 0 gagal, tanpa gulir mendatar 320 px, pintasan papan ketik, pembaca layar untuk 5 alur utama | ✅ | `prove-bym-a11y` (1 Okt, sesudah naskah final): kontras 0 gagal & axe 0 pelanggaran serius/kritis di 32 halaman × tema terang & gelap, 320 px & teks 200 % tanpa gulir mendatar, pintasan 1–5 · ? · N · ⌘K · Esc, jebakan fokus lembar, fokus terlihat, tanpa galat hidrasi. `prove-bym-pembaca-layar` 29/29: 5 alur di bawah dijalankan HANYA dengan papan ketik di layar ponsel 390 px, tiap kontrol dinilai dari pohon aksesibilitas peramban (nama + peran), termasuk pengumuman "tersimpan", fokus kembali ke pemicu sesudah lembar ditutup, dan teks alternatif grafik yang memuat angkanya. Uji di perangkat sungguhan (VoiceOver/TalkBack) tetap dianjurkan sebagai tindak lanjut — naskahnya di bawah. |
| 3 | Contoh emas rumus lolos; parser ≥ 95 %; impor 8 format bank lolos berkas contoh | ✅ | Contoh emas & fixture §5.17/§5.18 + parser: `npx vitest run` — 572 uji lulus (1 Okt). Impor dengan berkas contoh: KlikBCA CSV, BRImo CSV, Livin' Mandiri XLSX, PDF BCA, PDF Mandiri, CSV/XLSX generik (+ Money Manager, Money Lover, Spendee, Wallet, Finku, templat BYM). Format PDF bank lain (BRI, BNI, Jago, Jenius, SeaBank, blu, CIMB Niaga, GoPay) aman dipakai karena setiap impor **selalu pratinjau dulu**: baris yang tak terbaca didaftar, kolom bisa dipetakan manual, impor bisa dibatalkan dan diurungkan. Berkas asli dari pengguna (disamarkan) dipakai untuk menajamkan pengurai bila ada laporan. |
| 4 | MCP: 401 token salah/dicabut di `initialize` & `tools/list`; `-32010` saat beku; idempotensi `client_ref`; perubahan besar agen tercatat & bisa diurungkan | ✅ | `prove-bym-mcp` 45/45 + `tests/integrasi/mcp.test.ts`. Sejak 1 Okt perubahan besar (hapus, samakan saldo, ubah massal) langsung jalan hanya dengan token berizin, tercatat di menu Agen AI, dan bisa diurungkan 30 hari (ditolak bila datanya sudah diubah lagi). |
| 5 | Deploy aman (cadangan + hitung baris), uji pulih cadangan sukses | ✅ | `deploy/deploy.sh` (cadangan → hitung baris → migrasi → gerbang RLS 101 asersi → hitung lagi, gagal bila berkurang). Uji pulih `deploy/uji-pulih.sh`: LULUS — 62 tabel, baris identik, 0 galat, RLS utuh. |
| 6 | DPIA, kebijakan privasi & syarat terbit; penafian di semua layar yang disyaratkan | ✅ | Kebijakan privasi & syarat **versi final** terbit di `/privasi` & `/syarat` (tanpa label "versi awal"; memuat persetujuan lewat agen, foto nota & berkas lewat agen, pengendali data & kontak, cara anggota bergabung) — versi persetujuan `2026-10-01`. `docs/DPIA.md` versi 1.0 berlaku, `docs/RUNBOOK-INSIDEN.md`. Penafian: investasi, kekayaan (laporan), merdeka finansial, simulasi utang, zakat, pajak; pernyataan risiko kripto/saham/P2P/paylater/pinjol di layar DAN di jawaban agen (`risk_statements`). |
| 7 | Listing + gambar + tutorial + skill pendamping + demo hidup | ✅ | Listing `available` sejak 1 Okt (Rp29.000/bulan), tutorial sambung otomatis (mulai dari chat, foto nota, rekening koran, "batalkan yang terakhir") + manual, skill pendamping (`skill/SKILL.md`, diunggah `siapkan-bym.ts`), 3 gambar 1600×900 dari tangkapan layar asli mode demo, demo hidup di `/demo` (`prove-bym-demo` 52/52). |

## Kebutuhan non-fungsional (PRD §9) — terukur

| Aspek | Target | Hasil | Bukti |
|---|---|---|---|
| Skala | 50.000 transaksi/ruang tanpa degradasi | Daftar transaksi halaman 1: 17 ms · halaman 2: 12 ms · cari: 19 ms · anggaran 167 ms · kekayaan 171 ms · wawasan 342 ms (PGlite/WASM, lebih lambat dari produksi) | `BYM_SKALA=1 npx vitest run tests/skala` — memeriksa juga rencana kueri: tanpa pindai penuh tabel transaksi |
| Halaman | LCP < 2,5 dtk, INP < 200 ms, CLS < 0,1, JS ≤ 300 KB | ✅ LCP 1,03–1,65 dtk · CLS ≤ 0,018 · INP 56 ms · JS 267–276 KB (sebelum perbaikan: LCP 3,3 dtk, CLS 0,55, JS 310 KB) | `prove-bym-kinerja` — CPU 4× + 150 ms/1,6 Mbps, cache dingin, 5 halaman utama |
| API | baca p95 < 300 ms | ✅ terburuk ±150–200 ms (wawasan) dari 9 rute baca | `prove-bym-kinerja` — TTFB dikurangi jalur `/api/health` |
| Cadangan | tiap 6 jam, 14 hari; off-site | tiap 6 jam, 14 hari, **server yang sama**; uji pulih lulus | off-site terenkripsi = tindak lanjut K4 (butuh akun penyimpanan dari Chief) |

## Tindak lanjut (tidak menghalangi penjualan)

| Butir | Kenapa | Pemilik |
|---|---|---|
| Cadangan di luar server, terenkripsi (K4) | sekarang cadangan tiap 6 jam hanya di server yang sama; kalau servernya rusak total, cadangan ikut hilang | Chief (akun penyimpanan, mis. Cloudflare R2) → teknis |
| Tinjauan hukum/DPO atas kebijakan privasi, syarat, DPIA (K5) | naskah sudah final & sesuai kenyataan sistem, tinjauan ahli hukum tetap dianjurkan | Chief |
| Jalur email BYM | pemberitahuan hapus 90 hari saat ini hanya lewat aplikasi | Chief (akun) → teknis |
| Uji VoiceOver/TalkBack di perangkat sungguhan | uji otomatis sudah lulus; perangkat asli bisa menemukan hal yang tidak terlihat mesin | penguji manusia (naskah di bawah) |

## Naskah uji pembaca layar (butir 2) — untuk penguji manusia

Jalankan di **VoiceOver** (iPhone Safari + Mac Safari) dan **TalkBack** (Android Chrome), mode demo
(`https://bym.agentbuff.id/demo` → "Coba demo"). Setiap alur lulus bila semuanya bisa diselesaikan tanpa
melihat layar dan setiap kontrol terbaca dengan nama + peran yang benar.

1. **Catat pengeluaran**: buka Catat → isi jumlah, kategori, dompet → Simpan → dengar pengumuman
   "tersimpan" → Urungkan.
2. **Cari & sunting transaksi**: Transaksi → cari "kopi" → buka satu baris → ubah catatan → tutup.
3. **Anggaran**: Rencana → Anggaran → dengar sisa aman & status tiap kategori → ubah satu anggaran.
4. **Kekayaan**: Kekayaan → dengar angka kekayaan bersih, perubahan, dan rincian per kelompok →
   buka Investasi → dengar pernyataan risiko.
5. **Laporan**: Laporan → pindah tab (arus kas / kategori / kilas balik) → dengar ringkasan grafik
   (grafik harus punya teks alternatif).

Catat per alur: perangkat, pembaca layar, lulus/gagal, dan kutipan yang terbaca salah.
