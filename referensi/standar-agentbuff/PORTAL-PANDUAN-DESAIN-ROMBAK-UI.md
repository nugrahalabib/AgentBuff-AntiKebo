# Panduan Desain Rombak UI — "Inti Hidup"

Berlaku untuk SEMUA layar selain landing: `/app/*`, checkout/billing, onboarding,
masuk/daftar/akses. Cabang `rombak-ui`, situs uji `baru.agentbuff.id`.
Purwarupa acuan: https://claude.ai/artifact/E7aq7jFDeMhhV8QftGqs2S

## 1. Rasa yang dituju

Terang, tenang, premium, bergaya Apple — **bukan** produk developer. Target
pengguna: UMKM, solopreneur, mahasiswa, pekerja, profesional. Bahasa sehari-hari,
tanpa istilah gaming (kecuali nama agen "Buff"), tanpa jargon teknis di layar utama.

## 2. Aturan warna (WAJIB)

- **Teal (`bg-inti`, `text-inti-teks`) HANYA untuk yang sedang hidup**: agen
  bekerja, pesan masuk, rutinitas berjalan, koneksi aktif. Bukan untuk hiasan,
  bukan untuk tombol utama.
- **Amber (`bg-perlu-lembut`, `text-perlu`)** = butuh keputusan pengguna.
- **Merah (`text-galat`, `bg-galat-lembut`)** = gagal / tindakan berbahaya.
- **Tombol utama = graphite** (`bg-grafit text-grafit-teks`). Tombol kedua =
  `bg-permukaan ring-1 ring-inset ring-garis-kuat text-tinta`. Tombol teks =
  `text-inti-teks font-semibold`.
- Teks: `text-tinta` (utama), `text-tinta-2` (kedua), `text-tinta-3` (keterangan).
  Teal terang (`bg-inti`) TIDAK BOLEH jadi warna teks (kontras gagal).
- Permukaan: halaman `bg-kanvas` (sudah di akar), kartu `bg-permukaan`, kartu
  tenang `bg-permukaan-2`, lekuk/segmen `bg-kanvas-2`, garis `ring-garis` /
  `border-garis`. Bayangan: `shadow-lembut` (kartu biasa), `shadow-kartu`
  (kartu utama), `shadow-kaca` (panel melayang).
- **Kaca hanya untuk bingkai** (menu samping, bilah tab, bilah atas, panel
  melayang, dialog). Kartu isi tetap padat.
- Kelas lama `cyan-*` otomatis jadi teal, `indigo/violet/fuchsia/purple-*` jadi
  graphite (dipetakan di globals.css). Saat merombak sebuah layar, GANTI dengan
  token di atas — jangan andalkan pemetaan otomatis untuk elemen utama.
- ⚠️ `* { border-color: var(--border) }` tidak berlapis → utilitas `border-<warna>`
  KALAH. Tepi bernada pakai `ring-*`.
- Warna literal putih untuk teks di atas gradien terang dilarang (penjaga
  `cek-kelas-tema`). Pakai `text-slate-950` atau token.

## 3. Huruf & ukuran

- Geist (otomatis di akar). Judul halaman 28/36px bold, `tracking-[-0.03em]`.
  Judul bagian 20–22px semibold. Isi 15–16px. Keterangan 13–14px.
  **Minimal 13px** untuk teks (lencana angka boleh 11–12px).
- JANGAN membuat label kapital + jarak huruf lebar + mono (gaya terminal).
  Kalimat biasa.

## 4. Bentuk & jarak

- Sudut: kartu 20–24px (`rounded-[20px]`), tombol 12–14px, pil penuh untuk
  pilihan jawaban. Jarak antarbagian 28–32px, padding kartu 16–20px.
- Target sentuh minimal 40px (44px di HP).
- Kepala halaman: `SectionHeader` (judul besar + keterangan + aksi). Halaman
  yang dikelompokkan memakai prop `grup` (`tim`, `tugas`, `percakapan`,
  `pengaturan`) → sub-menu bersegmen.
- Tampilan kosong: `EmptyState` dengan `gambar` Buff dari `/images/buff/*`.

## 5. Ilustrasi Buff yang tersedia (`/images/buff/<nama>.webp`, ada versi `-kecil`)

`depan` (berdiri), `menyapa` (melambai), `siap` (tangan di dada), `bekerja`
(panel kaca), `senang` (melompat), `bertanya` (telapak terbuka), `paket` (membawa
kotak), `hp` (memegang HP), `istirahat` (duduk santai), `adegan-core.webp`
(Buff + Core di ruangan, opaque). Bila butuh ilustrasi lain → pakai yang paling
dekat sebagai TAMBALAN dan CATAT di `ASET-DIBUTUHKAN.md`.

## 6. Larangan keras (merusak produk / build)

- JANGAN ubah logika, pemanggilan RPC/API, store, atau perilaku. Hanya tampilan
  (className, struktur JSX tata letak, teks lewat kamus).
- Semua teks yang tampil lewat kamus `src/lib/i18n/dictionaries/{id,en}.ts` +
  tipe `src/lib/i18n/types.ts` (penjaga `cek-naskah-keras`, BATAS 0). Termasuk
  `placeholder`, `title`, `aria-label`, `alt`.
- Pertahankan semua `data-tur="…"`, `id="agent-tab-*"`, `id="set-nav-*"`,
  `aria-label="Buka menu navigasi"` / `"Buka daftar chat"`, `data-komposer-ruang`,
  `data-daftar-ruang`, `data-tur-tutup` — dipakai tur & panduan.
- Komponen spanduk (`ConnectionBanner`, `ErrorBanner`, `NoProviderBanner`,
  `TrialBanner`, `ApprovalsBanner`, `ImpersonationBanner`,
  `AttachmentWarningBanner`, `AdminApprovalBar`) hanya boleh dirender di SATU
  tempat (penjaga `cek-spanduk-dobel`).
- `useEffect` yang memanggil `.focus()` tidak boleh punya callback `on*` di
  deps (penjaga `cek-fokus-dialog`; pakai `useTerbaru`).
- Kartu berkendali (sub-agen, izin) di chat tidak boleh dilipat.
- `hover:text-X dark:text-Y` wajib jadi `dark:hover:text-…`.
- Tetap dukung mode gelap lewat token (jangan pakai warna literal tanpa `dark:`).
- Nilai awal `useState` tidak boleh membaca `window`/`localStorage` (galat hidrasi).

## 7. Pemeriksaan sebelum selesai

`pnpm tsc --noEmit` (tanpa galat), `pnpm exec eslint <berkas yang diubah>`,
`node scripts/jaga.mjs` (HIJAU). JANGAN `pnpm build`, JANGAN commit (yang
mengoordinasi yang commit).
