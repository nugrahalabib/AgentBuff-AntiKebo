# Buff Your Money (BYM) — Sistem Desain & Pola Layar

> Bagian dari PRD BYM. Baca `README.md` dulu untuk urutan baca.
> Dokumen ini = kontrak visual + interaksi. Kalau kode dan dokumen ini berbeda,
> perbarui dokumennya dengan alasan — jangan biarkan menyimpang diam-diam.

---

## 1. Arah desain

**Satu kalimat:** *aplikasi keuangan yang terasa seperti aplikasi bawaan iPhone dan Mac —
tenang, jernih, cepat — tapi berbicara bahasa keuangan orang Indonesia.*

Acuan utama (dipelajari, bukan disalin):

| Acuan | Yang diambil |
|---|---|
| Aplikasi bawaan iOS/macOS (Pengaturan, Dompet, Kesehatan, Mail) | daftar berkelompok ber-inset, judul besar yang mengecil saat digulir, bilah tembus pandang, lembar (sheet) dari bawah, sidebar ala macOS |
| Copilot Money (finalis Apple Design Awards 2024) | kotak masuk "Perlu ditinjau", grafik laju (garis putus-putus ideal vs garis aktual), status batang 3 warna, carousel tagihan mendatang, lencana jenis transaksi |
| Apple Card | kategori berwarna yang konsisten di semua tempat, **roda pembayaran** yang menampilkan akibat secara langsung (kita pakai untuk utang, target, dan FI) |
| Monarch | cip status target (Sesuai jalur / Lebih cepat / Berisiko), diagram Sankey arus uang |

### 1.1 Prinsip (urutan = prioritas bila bertabrakan)

1. **Satu angka yang bisa ditindaklanjuti di atas segalanya.** Tiap layar punya satu angka
   utama yang besar (mis. "Aman dibelanjakan Rp1.240.000 · Rp72.900/hari"). Detail menyusul.
2. **Mencatat harus lebih cepat daripada lupa.** Pengeluaran umum tercatat dalam **3 ketukan**
   (＋, kategori, Simpan — mengetik angka tidak dihitung) dan **median ≤ 6 detik** di ponsel. Ini
   metrik desain, diuji (lihat §10).
3. **Tenang, tidak menghakimi.** Pengeluaran BUKAN merah. Merah hanya untuk "melewati batas" dan
   saldo minus. Tidak ada kalimat yang mempermalukan. Kemenangan kecil dirayakan.
4. **Jujur.** Angka yang ditampilkan wajib bisa dijelaskan (ketuk angka → "Dari mana angka ini?").
   Harga aset yang basi diberi tanda. Estimasi selalu ditandai "perkiraan".
5. **Sama baiknya di ponsel dan desktop.** Bukan "desktop dikecilkan". Ponsel = satu tangan,
   bilah tab bawah. Desktop = sidebar + panel detail + pintasan papan ketik.
6. **Dua tema setara.** Terang dan gelap sama-sama dirancang, bukan dibalik otomatis.
7. **Aksesibel sejak awal.** WCAG 2.2 AA minimum; teks bisa diperbesar sampai 200% tanpa rusak.

### 1.2 Yang DILARANG

- Kartu seragam dengan bayangan tebal di semua tempat (gaya template dasbor).
- Gradien neon / glow di kerangka UI (gradien merek hanya untuk logo & momen perayaan).
- Merah untuk setiap pengeluaran. Hijau untuk setiap tombol.
- Iklan, spanduk upsell di dalam aplikasi, dark pattern pada pembatalan.
- Ikon tanpa label untuk aksi penting (ikon sendirian = teka-teki).
- Emoji sebagai satu-satunya ikon kategori bawaan (emoji boleh sebagai pilihan pengguna).
- Angka proporsional di kolom uang (wajib `tabular-nums`).

---

## 2. Token warna

Semua warna didefinisikan sebagai variabel CSS di `:root` (terang) lalu didefinisikan ulang
untuk gelap. Komponen **hanya** memakai token, tidak pernah heks langsung.
Nama token berbahasa Indonesia supaya konsisten dengan domain.

### 2.1 Netral & permukaan

| Token | Terang | Gelap | Dipakai untuk |
|---|---|---|---|
| `--latar` | `#F2F2F7` | `#000000` | latar halaman (grouped background) |
| `--permukaan` | `#FFFFFF` | `#1C1C1E` | kartu, grup daftar, lembar |
| `--permukaan-2` | `#F7F7FA` | `#2C2C2E` | permukaan bertingkat (inspector, popover) |
| `--isi` | `rgba(120,120,128,0.12)` | `rgba(120,120,128,0.24)` | isian kontrol (segmented, input, cip) |
| `--isi-kuat` | `rgba(120,120,128,0.20)` | `rgba(120,120,128,0.36)` | isian tekan/aktif |
| `--label` | `#1C1C1E` | `#FFFFFF` | teks utama |
| `--label-2` | `#6E6E73` | `#AEAEB2` | teks sekunder & **placeholder** (≥ 4.5:1 di atas `--latar`, `--permukaan`, `--permukaan-2`) |
| `--label-3` | `#86868B` | `#98989D` | **bukan untuk teks**: glif dekoratif, ikon keadaan kosong, garis tebal (≥ 3:1 di atas semua permukaan) |
| `--pemisah` | `rgba(60,60,67,0.18)` | `rgba(84,84,88,0.55)` | garis rambut 0.5px |
| `--bayang` | `0 8px 28px rgba(0,0,0,0.10)` | `0 8px 28px rgba(0,0,0,0.55)` | hanya lapisan melayang |

### 2.2 Aksen & semantik

| Token | Terang (teks) | Terang (isi) | Gelap (teks & isi) | Arti |
|---|---|---|---|---|
| `--aksen` | `#0066CC` | `#0A72E8` (+ teks putih) | `#409CFF` | tombol utama, tautan, pilihan aktif |
| `--masuk` | `#1A7F37` | `#34C759` | `#30D158` | pemasukan (selalu dengan tanda "+") |
| `--keluar` | = `--label` | — | = `--label` | pengeluaran (netral, dengan tanda "−") |
| `--pindah` | `--label-2` | — | `--label-2` | transfer antar dompet (ikon ⇄) |
| `--waspada` | `#A15C00` | `#FF9500` | `#FF9F0A` | mendekati batas (≥ 80%), harga basi |
| `--bahaya` | `#D70015` | `#FF3B30` | `#FF6961` | melewati batas, saldo minus, gagal |
| `--target` | `#8944AB` | `#AF52DE` | `#CC80F7` | target & tabungan |
| `--investasi` | `#4B49C9` | `#5856D6` | `#9391FF` | investasi & kekayaan |
| `--utang` | `#B03A00` | `#FF6B35` | `#FF7A45` | utang (bukan bahaya — sekadar kelas) |

Aturan:
- Kontras teks semantik **diukur**, bukan ditebak (penjaga kontras otomatis, §10). Nilai di tabel
  sudah diukur: semua token teks ≥ 4.5:1 di atas `--latar`, `--permukaan`, **dan** `--permukaan-2`
  pada temanya (kolom gelap sengaja lebih terang dari warna sistem Apple karena `#2C2C2E` menurunkan
  kontras — mis. `--investasi` gelap `#5E5CE6` hanya 2.75:1 di atas `--permukaan-2`).
- Kolom "Terang (isi)" = isian latar tombol/grafik, bukan warna teks. Teks di atasnya: `--aksen` isi
  `#0A72E8` + putih = 4.58:1 (lolos); isian lain hanya dipakai untuk grafik yang selalu disertai
  angka/teks.
- Warna tidak pernah jadi satu-satunya pembawa arti: pemasukan = hijau **dan** "+";
  melewati batas = merah **dan** ikon ⚠ **dan** teks "lewat Rp…".
- `--isi` warna semantik = warna itu dengan alfa 12% (terang) / 20% (gelap) untuk latar lencana.

### 2.3 Warna kategori (12 rona, dipakai kotak ikon kategori)

`merah #FF3B30 · oranye #FF9500 · kuning #FFCC00 · hijau #34C759 · mint #00C7BE · teal #30B0C7 ·
sian #32ADE6 · biru #007AFF · nila #5856D6 · ungu #AF52DE · merah muda #FF2D55 · cokelat #A2845E ·
abu #8E8E93`

Ikon kategori = glif di dalam persegi bundar (squircle) berwarna, seperti ikon di aplikasi
Pengaturan iOS. Warna kategori **konsisten** di baris daftar, grafik, legenda, dan laporan (satu
sumber: tabel `kategori.warna`). Di mode gelap rona dinaikkan kecerahannya (varian gelap Apple) —
simpan dua nilai per rona di token.

**Warna glif per rona (diukur, syarat ≥ 3:1 untuk elemen grafis):** glif **gelap `#1C1C1E`** di atas
oranye, kuning, hijau, mint, teal, sian (kedua tema) dan abu (tema gelap) — glif putih di atas rona
terang itu hanya 1.4–2.6:1; glif **putih** di atas merah, biru, nila, ungu, merah muda, cokelat, dan abu
(tema terang). Simpan pasangan `{latar, glif}` per rona per tema sebagai token; penjaga kontras
mengukurnya.

### 2.4 Merek BYM

- Gradien merek (turunan AgentBuff, dijinakkan): `#22D3EE → #6366F1 → #A855F7`.
  **Hanya** untuk: logo, ikon aplikasi, layar pembuka pertama, perayaan target tercapai,
  kenaikan "Level Buff". Tidak pernah di tombol, bilah, atau latar kartu biasa.
- Ikon aplikasi: squircle, gradien biru-nila lembut, glif putih "koin dengan panah naik"
  yang membentuk huruf **B**. Dibuat sebagai SVG (+ PNG 192/512/maskable + apple-touch-icon 180).

---

## 3. Tipografi

### 3.1 Keluarga huruf

```css
--font-teks: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
--font-angka-besar: ui-rounded, "SF Pro Rounded", -apple-system, "Inter", sans-serif;
--font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace;
```

- Di perangkat Apple huruf sistem = SF Pro (legal: kita tidak mengirim berkas SF, hanya
  memanggil huruf sistem). Di Windows/Android jatuh ke **Inter** yang di-host sendiri
  (lisensi OFL; subset Latin; `font-display: swap`; hanya 2 bobot variabel ≤ 60 KB).
- **Angka besar** (saldo utama, angka hero) memakai varian bundar (`ui-rounded`) di Safari —
  sentuhan khas Apple Wallet/Kesehatan. Browser lain jatuh ke huruf teks biasa.
- Semua angka uang: `font-variant-numeric: tabular-nums;` (kolom rata).

### 3.2 Skala (mengikuti Dynamic Type iOS ukuran "Large")

| Gaya | Ponsel (px/leading) | Desktop (px/leading) | Bobot | Dipakai untuk |
|---|---|---|---|---|
| Judul Besar | 34/41 | 30/36 | 700 | judul halaman (mengecil ke 17 saat digulir di ponsel) |
| Judul 1 | 28/34 | 26/32 | 700 | angka hero di kartu utama |
| Judul 2 | 22/28 | 20/26 | 700 | judul bagian |
| Judul 3 | 20/25 | 18/24 | 600 | judul kartu |
| Kepala | 17/22 | 15/20 | 600 | label baris penting, tombol |
| Isi | 17/22 | 15/20 | 400 | teks isi, baris daftar |
| Keterangan | 16/21 | 14/19 | 400 | penjelasan bawah kontrol |
| Subjudul | 15/20 | 13/18 | 400 | teks sekunder baris |
| Catatan kaki | 13/18 | 12/16 | 400 | keterangan kecil, stempel waktu |
| Kapsi | 12/16 | 11/14 | 500 | lencana, label sumbu grafik |

- Angka hero saldo: 40–56px (`clamp(40px, 9vw, 56px)`), bobot 700, `--font-angka-besar`.
- Semua ukuran dalam `rem` (1rem = 16px) → hormati pembesaran teks peramban.
- Label huruf kapital kecil (mis. "BULAN INI") hanya di Kapsi, `letter-spacing: 0.04em`.
- Judul: `text-wrap: balance`. Paragraf penjelasan maks ±65 karakter.
- ⛔ Pelajaran AgentBuff (§0.40 CLAUDE.md): **jangan pernah** menyamaratakan semua ukuran ke satu
  angka. Jenjang di atas adalah kontraknya.

---

## 4. Ruang, bentuk, material

- **Kisi 4px.** Skala spasi: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64.
- **Margin tepi:** ponsel 16px; tablet 24px; desktop kolom isi maks 880px (daftar) / 1200px (dasbor).
- **Radius:** cip 999px · input 10px · grup daftar & kartu 12px (ponsel) / 14px (desktop) ·
  kartu hero 20px · lembar 14px (atas) · dialog 16px · tombol besar 12px · kotak ikon kategori
  28px→7px, 32px→8px, 40px→10px (≈ 22–25% sisi, meniru squircle).
- **Pemisahan lewat nada latar, bukan bayangan.** Kartu di atas `--latar` tanpa bayangan.
  Bayangan hanya untuk yang melayang (popover, lembar, menu konteks, toast).
- **Material tembus pandang** untuk bilah atas, bilah tab, bilah alat, sidebar:
  ```css
  background: color-mix(in srgb, var(--permukaan) 78%, transparent);
  backdrop-filter: saturate(180%) blur(20px);
  ```
  Fallback tanpa `backdrop-filter`: warna solid `--permukaan`.
- **Garis rambut:** 0.5px di layar ≥ 2x (`box-shadow: inset 0 -0.5px 0 var(--pemisah)`), 1px di 1x.
  Pemisah baris daftar menjorok (mulai sejajar teks, bukan ikon) — pola iOS.
- **Ikon:** Lucide (garis 1.75, ujung bundar) — paling dekat dengan SF Symbols dan legal di web.
  Ukuran 17/20/22px; di bilah tab 24px. SF Symbols TIDAK boleh dipakai (lisensi Apple).

---

## 5. Gerak & umpan balik

| Momen | Perilaku |
|---|---|
| Lembar muncul | naik dari bawah 320ms `cubic-bezier(0.32,0.72,0,1)`; latar meredup 0→40% |
| Tutup lembar | geser turun (bisa diseret di ponsel, ambang 30% tinggi atau kecepatan) |
| Simpan transaksi | tombol → centang 250ms; baris baru masuk dari atas dengan fade + geser 8px |
| Angka berubah | angka hero "menggulung" ke nilai baru 400ms (tween), hanya angka utama |
| Tekan | skala 0.97 + isi `--isi-kuat` 100ms (pengganti haptik di web) |
| Target tercapai / naik Level | konfeti halus sekali (≤ 1,2 dtk) + gradien merek; bisa dimatikan |
| Hapus | baris hilang + toast "Dihapus · Urungkan" 6 dtk |

- `prefers-reduced-motion: reduce` → semua gerak diganti fade 150ms, tanpa konfeti, tanpa gulung angka.
- Getar (`navigator.vibrate(10)`) hanya bila tersedia (Android); tidak dianggap wajib.
- Tidak ada animasi berjalan sendiri terus-menerus (tidak ada kilau/denyut dekoratif).

---

## 6. Komponen inti

Dibangun di atas primitif Radix (aksesibilitas, fokus, portal) lalu diberi gaya sendiri.
Jangan memakai tampilan bawaan shadcn apa adanya.

| Komponen | Spesifikasi |
|---|---|
| **GrupDaftar** (inset grouped list) | latar `--permukaan`, radius 12, baris min 44px (ponsel 52px bila 2 baris), pemisah menjorok, judul grup Kapsi di atas, catatan kaki grup di bawah |
| **BarisTransaksi** | kiri: kotak ikon kategori 36px; tengah: penerima/catatan (Isi) + kategori · dompet (Subjudul `--label-2`); kanan: jumlah (Kepala, tabular) + lencana kecil (Agen 🤖 / Berulang ↻ / Transfer ⇄ / Split) + titik biru "perlu ditinjau" |
| **KartuHero** | radius 20, padding 20; label Kapsi, angka hero, baris konteks, mini-grafik opsional |
| **CipSegmen** (segmented control) | wadah `--isi` radius 9, pilihan aktif = `--permukaan` + bayangan tipis; 2–5 opsi |
| **Tombol** | Utama: isi `--aksen` teks putih, tinggi 50 (ponsel) / 36 (desktop). Sekunder: `--isi` teks `--aksen`. Tersier: teks saja. Merusak: teks `--bahaya`. Kapsul untuk aksi di bilah. |
| **Lembar** (sheet) | ponsel: dari bawah, pegangan 36×5, bisa diseret; desktop: dialog tengah 560px atau popover tertambat |
| **PapanAngka** (keypad kalkulator) | 4×4: 7 8 9 ÷ / 4 5 6 × / 1 2 3 − / 000 0 ⌫ +; tombol "rb" & "jt" pintas; tombol "=" muncul bila ada operator |
| **BatangLaju** (budget bar) | batang 8px radius penuh; isi terpakai; garis tipis penanda "seharusnya sampai hari ini"; batang bergaris (outline) = tagihan terjadwal yang belum dibayar; warna: normal `--label-2`→ aman `--masuk`, diproyeksikan lewat `--waspada`, lewat `--bahaya` |
| **CincinProgres** | cincin 8–14px garis, ujung bundar, warna `--target`/`--investasi`, angka persen di tengah |
| **CipStatus** | "Sesuai jalur" (hijau) · "Lebih cepat" (biru) · "Berisiko" (oranye) · "Tertinggal" (merah) — selalu teks + warna |
| **Toast** | kapsul bawah-tengah, 6 dtk, satu aksi (Urungkan/Lihat), `aria-live="polite"` |
| **Kosong** (empty state) | glif garis 48px `--label-3`, judul Kepala, satu kalimat, **tepat satu** tombol aksi |
| **Kerangka** (skeleton) | balok `--isi` berkedip halus 1.2 dtk (dimatikan untuk reduced-motion) |
| **RodaAkibat** (consequence dial) | penggeser/roda yang menampilkan akibat langsung: "Bayar Rp X lagi/bulan → lunas Mar 2027, hemat bunga Rp Y" — dipakai di Utang, Target, FI |
| **AngkaUang** | komponen tunggal pemformat uang (lihat §8); mendukung mode privasi (●●●) |

---

## 7. Navigasi & tata letak

### 7.1 Titik henti

| Nama | Lebar | Tata letak |
|---|---|---|
| Ponsel | < 768px | satu kolom, bilah tab bawah, judul besar, lembar dari bawah |
| Tablet | 768–1279px | sidebar ciut (ikon + label saat dibuka), isi satu kolom lebar |
| Desktop | ≥ 1280px | sidebar tetap 240px + isi + **panel inspektur** 360px (kanan) untuk detail item terpilih |

### 7.2 Ponsel — bilah tab (5 posisi)

`Beranda · Transaksi · [＋ Catat] · Rencana · Kekayaan`

- **＋ Catat** = tombol tengah menonjol (lingkaran `--aksen` 52px, ikon putih) → membuka
  lembar Catat Cepat. Tekan-tahan → menu: Pengeluaran / Pemasukan / Pindah / Pindai struk.
- **Rencana** = Anggaran · Target · Tagihan & Langganan · Utang & Piutang · Arisan (segmen di atas).
- **Kekayaan** = Kekayaan bersih · Dompet & Akun · Investasi · Merdeka Finansial.
- **Laporan & Wawasan** dibuka dari tombol grafik di kanan atas Beranda.
- **Pengaturan, Rumah Tangga, Agen AI, Impor/Ekspor, Zakat & Pajak** dari avatar di kanan atas Beranda.
- Bilah tab tembus pandang, tinggi 49 + safe-area bawah; lencana angka pada Transaksi = jumlah
  "perlu ditinjau".

### 7.3 Desktop — sidebar ala macOS

```
[Logo BYM · nama ruang ▾]
  Beranda
  Transaksi            (12)   ← lencana perlu ditinjau
  ─ Rencana
    Anggaran
    Target
    Tagihan & Langganan
    Utang & Piutang
    Arisan
  ─ Kekayaan
    Kekayaan Bersih
    Dompet & Akun
    Investasi
    Merdeka Finansial
  ─ Wawasan
    Laporan
    Zakat & Pajak
  ─────────
  Agen AI              (2)   ← lencana draf menunggu
  Impor & Ekspor
  Pengaturan
[avatar · nama · status AgentBuff]
```

- Sidebar tembus pandang (material), item aktif = isi `--isi-kuat` radius 8.
- Dompet bisa dipin ke sidebar (sub-daftar "Dompet" dengan saldo di kanan) — pola Finder.
- **Palet perintah ⌘K / Ctrl+K**: cari transaksi, pindah halaman, jalankan aksi
  ("catat 25rb kopi gopay" langsung jadi transaksi — parser yang sama dengan Catat Cepat).

### 7.4 Pintasan papan ketik (desktop)

| Tombol | Aksi |
|---|---|
| `N` | Catat cepat |
| `⌘K` / `Ctrl+K` | Palet perintah |
| `/` | Fokus cari |
| `↑` `↓` | Pindah baris; `Enter` buka di inspektur |
| `E` | Sunting | 
| `R` | Tandai ditinjau |
| `C` | Ganti kategori (popover cari) |
| `⌫` / `Del` | Hapus (dengan Urungkan) |
| `⌘Z` | Urungkan aksi terakhir |
| `1`–`5` | Beranda / Transaksi / Rencana / Kekayaan / Laporan |
| `?` | Daftar pintasan |

Semua pintasan juga ada di menu/tombol (pintasan tidak pernah satu-satunya jalan).

---

## 8. Angka, uang, tanggal (format Indonesia)

- Mata uang dasar IDR. Format penuh: **`Rp1.250.000`** (tanpa spasi, titik ribuan, tanpa ",00").
  Pakai `Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 })`
  lalu hapus spasi NBSP antara "Rp" dan angka supaya konsisten.
- Ringkas (grafik, cip, sumbu): `Rp1,2 jt` · `Rp250 rb` · `Rp3,4 M` (miliar) · `Rp1,1 T` (triliun).
  Aturan: < 1.000 penuh; < 1 jt → "rb" tanpa desimal bila bulat; ≥ 1 jt → 1 desimal.
- Tanda: pemasukan `+Rp500.000` (hijau), pengeluaran `−Rp25.000` (netral, pakai minus U+2212),
  transfer tanpa tanda + ikon ⇄.
- Mata uang asing: `US$12,50` · `S$20` · `€9,99` · `¥1.200`; di bawahnya ekuivalen IDR `≈ Rp203.000`.
- Kuantitas investasi: saham dalam **lot** & lembar (1 lot = 100 lembar), reksa dana 4 desimal unit,
  emas 3 desimal gram, kripto s/d 8 desimal (potong nol di ujung).
- Persen: `12,5%` (koma desimal), perubahan `▲ 3,2%` / `▼ 1,1%` + warna + kata untuk pembaca layar.
- Tanggal: "Hari ini", "Kemarin", "Sen, 22 Sep", "22 Sep 2025" (tahun hanya bila bukan tahun ini).
  Zona waktu bawaan `Asia/Jakarta`, bisa diganti (WITA/WIT).
- Periode: "25 Sep – 24 Okt" untuk siklus gajian; "September 2026" untuk kalender.
- **Mode privasi**: semua jumlah jadi `Rp ••••••` (lebar tetap), ketuk mata di bilah atas; bisa
  otomatis aktif saat aplikasi dibuka (setelan). Angka persen & grafik tetap, sumbu disembunyikan.
- Pembaca layar: `aria-label="pengeluaran dua puluh lima ribu rupiah"` dihasilkan komponen AngkaUang.

---

## 9. Pola layar (setiap layar: ponsel + desktop)

Setiap layar di bawah wajib punya: keadaan **memuat** (kerangka), **kosong** (satu aksi),
**galat** (kalimat manusia + Coba lagi), **beku** (lihat §9.20), dan **mode privasi**.

### 9.1 Halaman publik & masuk (`/`)

- Hero singkat: "Uangmu, akhirnya rapi. Catat lewat chat, lihat semuanya di sini."
- Tangkapan layar produk nyata (bukan ilustrasi abstrak), tiga manfaat, tombol utama
  **"Masuk dengan AgentBuff"** (`data-masuk-agentbuff`, logo AgentBuff + teks) dan tombol sekunder
  **"Coba demo"** (`/demo`, data contoh, tanpa akun).
- Baris kecil: "Anggota keluarga? Masuk dengan akun yang dibuatkan pemilik." → form email/sandi.
- Galat `access_denied` dari AgentBuff ditampilkan di sini dengan kalimat per alasan
  (lihat TEKNIS.md §6.1 langkah 2) + tombol ke AgentBuff.

### 9.2 Orientasi (onboarding) — maks 5 langkah, ≤ 2 menit, semuanya bisa dilewati

1. **Halo** — nama panggilan (terisi dari AgentBuff), satu pertanyaan: "Apa yang paling ingin
   kamu capai?" (pilih satu): Rapikan pengeluaran · Lunasi utang · Menabung untuk sesuatu ·
   Mulai investasi · Merdeka finansial.
2. **Gajian** — "Tanggal berapa biasanya kamu gajian?" (roda tanggal 1–31 + "akhir bulan" +
   "tidak tetap"), "Kalau jatuh di hari libur?" (bawaan: *dimajukan ke hari kerja sebelumnya* ·
   diundur ke hari kerja berikutnya · tetap), perkiraan penghasilan per bulan (opsional, bisa dilewati).
3. **Dompetmu** — kisi logo: Tunai, BCA, Mandiri, BRI, BNI, BSI, CIMB Niaga, Permata, Danamon,
   Jago, Jenius, SeaBank, blu, Allo, GoPay, OVO, DANA, ShopeePay, LinkAja, Kartu kredit, Paylater
   (Kredivo, Akulaku, SPayLater, GoPayLater). Pilih beberapa → isi saldo sekarang (boleh nanti).
4. **Cara menganggarkan** — empat kartu dengan rekomendasi bertanda sesuai jawaban langkah 1:
   *Sederhana* (batas per kategori), *50/30/20*, *40/30/20/10* (versi lokal: hidup · cicilan ·
   tabungan · zakat/sedekah), *Setiap rupiah punya tugas* (amplop). Bisa "Nanti saja".
5. **Agenmu** — status sambungan dengan AgentBuff yang diperbarui hidup ("Agen Buff sudah tersambung ✓"
   atau "Menyambungkan… biasanya beberapa menit — kamu bisa lanjut dulu"), contoh: *"Coba chat agenmu
   di WhatsApp: 'tadi makan siang 35rb pakai GoPay'"*. Tombol utama: "Catat transaksi pertamaku".
   (Ruangnya sudah dibuat saat masuk, jadi melewati orientasi tidak menunda sambungan agen.)

Alternatif di langkah mana pun: **"Coba dengan data contoh dulu"** (ruang demo terpisah, bisa dibuang).

### 9.3 Beranda

Urutan (ponsel, atas → bawah; desktop = kisi 12 kolom dua baris):

1. Bilah atas: sapaan + tanggal · ikon mata (privasi) · ikon grafik (Laporan) · avatar.
2. **Kartu hero "Aman dibelanjakan"** — angka besar untuk sisa periode ("Rp1.240.000"), baris
   "≈ Rp72.900/hari · 17 hari lagi ke gajian" (jatah harian = angka ÷ hari tersisa, dibulatkan ke bawah
   ke Rp100 — TEKNIS §5.6), mini-grafik laju (putus-putus ideal vs garis aktual). Ketuk → rincian
   rumus dalam kata-kata sesuai metode anggaran ("Sisa anggaran … − lewat di Hiburan … ; dibatasi kas
   yang ada … − tagihan … − uang yang sudah disisihkan untuk target …"). Di rumah tangga, judulnya
   "Aman dibelanjakan (bersama)" + baris kecil "Aman pribadimu: Rp…" bila punya dompet pribadi.
   Spanduk tipis di atas kartu hanya bila AgentBuff sedang tak terjangkau ("Tidak bisa memeriksa
   langgananmu — BYM tetap bisa dipakai").
3. **Perlu ditinjau** (bila > 0): baris ringkas "12 transaksi perlu ditinjau — 9 dari Agen, 3 dari impor"
   + tombol "Tinjau". Ditinjau massal dengan geser/centang.
4. **Tagihan mendatang** — carousel horizontal kartu kecil (logo/ikon, nama, jumlah, "3 hari lagi"),
   yang lewat jatuh tempo diberi `--bahaya`.
5. **Anggaran** — 3 kategori paling "panas" dengan BatangLaju; tautan "Semua anggaran".
6. **Target** — 2–3 CincinProgres + cip status.
7. **Kekayaan bersih** — angka + perubahan 30 hari + garis tren mini.
8. **Wawasan** — 1–3 kartu wawasan (PRD M16), bisa ditutup.
9. **Level Buff** — posisi di tangga keuangan + langkah berikutnya (satu kalimat).

### 9.4 Catat Cepat (lembar) — permata aplikasi

```
┌──────────────────────────────────────┐
│  [ Keluar | Masuk | Pindah ]          │  CipSegmen
│                                        │
│            Rp 25.000                   │  angka hero bundar, kursor berkedip
│      "kopi 25rb gopay"  ← teks bebas   │  kolom teks alami (opsional)
│  ☕ Kopi & Jajan   ▸  (saran cerdas)    │  cip kategori: 5 saran + "Lainnya"
│  💳 GoPay ▸   📅 Hari ini ▸   🏷 ▸      │  dompet · tanggal · tag
│  [ Catatan…                         ] │
│  ┌──┬──┬──┬──┐                         │
│  │ 7│ 8│ 9│ ÷│  PapanAngka             │
│  │ 4│ 5│ 6│ ×│                         │
│  │ 1│ 2│ 3│ −│                         │
│  │rb│ 0│ ⌫│ +│                         │
│  └──┴──┴──┴──┘                         │
│  [      Simpan      ]  [Simpan & lagi] │
└──────────────────────────────────────┘
```

- Fokus awal di angka. ＋ (1 ketuk) → ketik angka → pilih kategori (1 ketuk) → Simpan (1 ketuk) =
  **3 ketukan** (mengetik angka tidak dihitung).
- **Saran kategori** berurutan: aturan cocok → kategori terakhir untuk penerima itu → pola waktu
  (pagi = kopi/sarapan, 12–13 = makan siang) → paling sering 30 hari.
- **Dompet bawaan** = dompet terakhir dipakai untuk kategori itu.
- **Teks alami**: mengetik "makan siang 35rb pakai gopay kemarin #kantor" langsung mengisi jumlah,
  kategori, dompet, tanggal, tag secara hidup (parser deterministik, TEKNIS.md §5.3). Bagian yang
  dikenali digarisbawahi tipis.
- Split: tombol "Bagi" → baris-baris kategori dengan sisa otomatis.
- Pindah: dari dompet → ke dompet + **biaya admin** (kolom opsional, dicatat sebagai pengeluaran
  kategori "Biaya Admin" terhubung).
- Desktop: popover tertambat ke tombol "Catat" (atau `N`), satu baris teks alami + pratinjau hasil
  parse; `Enter` simpan, `⌘Enter` simpan & lagi.
- Setelah simpan: toast "Tercatat · Rp25.000 Kopi & Jajan · Urungkan".

### 9.5 Transaksi

- Daftar dikelompokkan per hari; kepala hari: "Sen, 22 Sep" + total bersih hari itu.
- Filter sebagai cip di atas (Semua · Perlu ditinjau · Keluar · Masuk · Dompet ▾ · Kategori ▾ ·
  Tag ▾ · Periode ▾ · Dari Agen). Cari penuh (penerima, catatan, jumlah "25.000", tag).
- Pilih banyak (tekan-tahan / Shift-klik): ganti kategori, tandai ditinjau, beri tag, hapus.
- Virtualisasi daftar (lancar di 50.000 baris).
- Ponsel: ketuk → lembar detail. Desktop: klik → panel inspektur (tanpa pindah halaman).
- **Detail transaksi**: jumlah, jenis, kategori, dompet, penerima, tanggal+jam, catatan, tag,
  lampiran (foto struk), sumber ("Dicatat Agen Buff lewat WhatsApp · 22 Sep 12.41"), riwayat
  perubahan, tautan ke tagihan/utang/target terkait, tombol "Buat aturan dari ini",
  "Tandai berulang", "Pisahkan", "Duplikat", "Hapus".

### 9.6 Dompet & Akun

- Grup: Tunai & Bank · Dompet Digital · Kartu Kredit & Paylater · Investasi · Aset · Utang ·
  Piutang. Tiap grup total di kepala grup. Dompet diarsip di bawah (terlipat).
- Baris: logo institusi (aset milik sendiri, bukan logo bank yang diunduh bebas — lihat TEKNIS §4.9), nama, saldo, lencana "Belum dicocokkan 14 hari" bila lama.
- Detail dompet: saldo besar, grafik saldo 90 hari, transaksi dompet ini, tombol
  **"Cocokkan saldo"** (masukkan saldo di aplikasi bank → selisih dicatat sebagai penyesuaian
  berlabel jelas), kartu kredit: limit, tagihan berjalan, tanggal cetak & jatuh tempo, minimum bayar.

### 9.7 Anggaran

- Kepala: periode (siklus gajian) dengan panah ← → ; metode aktif; "Aman dibelanjakan".
- Mode **Sederhana / 50-30-20 / 40-30-20-10**: daftar kategori dengan BatangLaju + "sisa Rp…"/"lewat Rp…";
  mode persentase menampilkan kelompoknya (Kebutuhan/Keinginan/Tabungan, atau Hidup/Cicilan/
  Tabungan/Zakat-Sedekah) dengan target % vs aktual.
- Mode **Amplop**: di atas pita besar **"Siap dialokasikan: Rp…"** (hijau bila > 0, merah bila < 0,
  "Semua rupiah sudah punya tugas 🎉" bila 0); tiap kategori: Dialokasikan · Terpakai · Tersedia;
  ketuk "Tersedia" untuk memindah dana antar amplop (lembar kecil dengan pencari).
- Aksi: "Isi otomatis dari rata-rata 3 bulan", "Salin dari periode lalu", "Seimbangkan ulang"
  (saran memindah sisa tanpa mengubah total), "Atur ulang periode".
- Detail kategori: grafik 6 periode, transaksi, pengaturan (rollover, template isi otomatis).

### 9.8 Target

- Kartu target: foto sampul (opsional, dari galeri pengguna), nama, CincinProgres, "Rp18 jt dari
  Rp50 jt", cip status, "Butuh Rp2,1 jt/bulan sampai Des 2027".
- Detail: RodaAkibat ("Setor Rp2,5 jt/bulan → tercapai Agu 2027, 4 bulan lebih cepat"),
  riwayat setoran, dompet terkait, pengaturan (tanggal, jumlah, asumsi imbal hasil, prioritas).
- Templat target: Dana Darurat (kalkulator 3–12× kebutuhan bulanan), DP Rumah, Haji/Umrah,
  Pendidikan Anak, Pernikahan, Liburan, Gadget, Kendaraan, Pensiun, Kustom.
- Tercapai → layar perayaan (gradien merek + konfeti) + pilihan "Jadikan target baru" / "Arsipkan".

### 9.9 Tagihan & Langganan

- Dua tampilan: **Daftar** (Akan datang / Terlambat / Lunas periode ini) dan **Kalender** bulan
  (titik per hari, ketuk hari → tagihan hari itu).
- Kartu: ikon/logo, nama, jumlah (atau "± Rp…" bila perkiraan), jatuh tempo, dompet bayar,
  tombol "Tandai lunas" (membuat transaksi) / "Lewati bulan ini".
- **Langganan terdeteksi**: kartu saran "Sepertinya kamu berlangganan Netflix Rp186.000 tiap tgl 3.
  Tambahkan?" [Ya] [Bukan langganan]. Kenaikan harga ditandai "naik 12% dari bulan lalu".
- Ringkasan: "Total langganan Rp412.000/bulan · Rp4,9 jt/tahun".

### 9.10 Utang & Piutang

- Dua segmen: **Utang saya** · **Piutang (orang berutang ke saya)**.
- Utang: kartu per utang (KPR, kartu kredit, paylater, pinjol, KTA, pribadi), sisa pokok, cicilan,
  jatuh tempo berikut, bunga (dengan label jenis: efektif/flat/harian).
- **Simulator pelunasan**: pilih Snowball (terkecil dulu) / Avalanche (bunga tertinggi dulu) /
  Kustom; RodaAkibat "Tambah Rp500 rb/bulan" → tanggal bebas utang + total bunga dihemat;
  garis waktu tiap utang lunas.
- Piutang ke teman: nama, jumlah, tanggal, tombol **"Kirim pengingat sopan"** (membuat teks siap
  salin/kirim WhatsApp lewat tautan `wa.me` — teks, bukan kirim otomatis).
- Peringatan pinjol: bila biaya harian > batas OJK (0,1%/hari untuk konsumtif sejak 2026) atau
  total biaya mendekati 100% pokok → kartu informasi netral + tautan edukasi (bukan menakut-nakuti).
- Rasio cicilan (DSR) di kepala: "Cicilanmu 34% dari penghasilan · batas sehat umumnya ≤ 30%".

### 9.11 Arisan

- Kartu arisan: nama grup, iuran, frekuensi, peserta, "Giliranmu: ke-7 (Mar 2027)" atau
  "Sudah dapat Jan 2026", posisi bersih (sudah setor vs sudah terima).
- Jadwal setoran otomatis jadi berulang yang **memindahkan** uang ke dompet arisan grup itu; "Dapat
  giliran" = pindah balik ke dompet pilihan. Tidak pernah tampil sebagai belanja/pemasukan di laporan;
  posisi bersih = saldo dompet arisan (TEKNIS §5.17).

### 9.12 Kekayaan bersih

- Angka besar + perubahan (1B/3B/1T/Semua) + grafik area bertumpuk (aset vs utang) atau garis.
- Rincian per kelas (Kas · Investasi · Aset tetap · Piutang − Utang), ketuk untuk rinci.
- Tanda "harga per 22 Sep 16.00" dan "3 aset belum diperbarui" (ambang basi sama dengan PRD M13:
  lebih dari 7 hari untuk saham/reksa dana, lebih dari 30 hari untuk harga/nilai manual).

### 9.13 Investasi

- Kepala: nilai portofolio, imbal hasil (pilih: XIRR/tahunan · total · TWR), keuntungan belum
  terealisasi, dividen 12 bulan.
- Donat alokasi per kelas (Saham IDX, Reksa dana, Emas, Kripto, SBN, Deposito, Lainnya) +
  target alokasi & drift (bila target diisi pengguna) + baris netral "selisih terhadap target
  alokasimu" per kelas (angka saja — tanpa kata beli/setor/jual, tanpa nama produk).
- Daftar kepemilikan: kode/nama, kuantitas, harga rata-rata, harga kini (+ waktu & sumber), nilai, untung/rugi.
- Harga yang dimasukkan tangan/admin diberi label "indikatif · diperbarui 22 Sep"; emas dinilai
  dengan **harga buyback merek yang dipilih** (Antam/UBS/Galeri24/Pegadaian), bukan harga jual —
  ditulis jelas di baris itu. Tombol cepat "Perbarui harga" per kepemilikan.
- Detail: grafik harga + titik beli/jual, riwayat transaksi, dividen/kupon, catatan.
- Kalender dividen & kupon (SBN, obligasi, deposito jatuh tempo).

### 9.14 Merdeka Finansial (FI)

- Kartu hero: **Angka Merdeka** ("Rp7,2 M") + progres (% dari angka merdeka yang sudah tercapai),
  **perkiraan tahun merdeka** ("2041 · usia 47").
- RodaAkibat utama: penggeser **rasio menabung** (10–80%) → tahun merdeka berubah hidup.
- Kartu: Coast FI ("Kalau berhenti menabung hari ini, kamu tetap merdeka di usia 60"),
  Merdeka Hemat/Lega (versi pengeluaran pokok vs gaya hidup), sumber penghasilan pasif (JHT/JP, sewa).
- Grafik kipas **Monte Carlo** (P10/P50/P90) + "Peluang berhasil 78%" berdampingan dengan garis
  rencana deterministik, keterangan "kedua pandangan sama-sama sah".
- Asumsi bisa diubah (imbal hasil riil, inflasi, tingkat penarikan aman) dengan penjelasan (i).
- Penafian tetap: "Simulasi edukasi, bukan nasihat investasi."

### 9.15 Level Buff (tangga keuangan)

Garis vertikal 9 anak tangga dengan posisi pengguna, syarat tiap level terukur otomatis
(PRD M15). Naik level → perayaan + satu kalimat langkah berikutnya. Tidak ada poin/koin palsu.

### 9.16 Laporan & Wawasan

Tab: **Arus kas** (batang masuk vs keluar per periode + rasio menabung) · **Kategori** (donat +
daftar + perbandingan periode lalu) · **Tren** (garis per kategori 12 periode) · **Arus uang**
(Sankey: sumber pemasukan → kategori) · **Penerima** (siapa paling banyak menerima uangmu) ·
**Kilas Balik** (tahunan, gaya "Wrapped", bisa dibagikan sebagai gambar tanpa angka sensitif).
Semua grafik punya tabel alternatif (aksesibilitas) dan ekspor CSV/PDF.

### 9.17 Zakat & Pajak

- Kalkulator zakat mal: harta dikumpulkan otomatis dari dompet/aset (bisa dicentang/tidak),
  nisab = 85 g emas × harga acuan pilihan pengguna (buyback atau jual, merek dipilih), haul
  (pelacak tanggal Hijriah), hasil 2,5%; tombol "Catat pembayaran zakat".
- Zakat penghasilan per **bulan** (semua penghasilan bulan itu dijumlahkan): metode bruto (acuan
  BAZNAS) atau neto — pengguna memilih; nisab dari setelan (2026: Rp7.640.144/bulan); opsi tahunan
  untuk penghasilan tak teratur.
- Haul: tanggal mulai & jatuh haul (Hijriah + Masehi) dari riwayat harian, dengan pilihan cara menilai
  haul dijelaskan netral dalam satu kalimat masing-masing.
- Zakat fitrah: jumlah jiwa × nilai per jiwa (2026 nasional Rp50.000; bisa diubah per daerah).
- **Daftar Harta & Utang untuk SPT**: tabel siap salin per 31 Des (kode harta, nama, tahun
  perolehan, nilai perolehan, keterangan) + ekspor CSV — dengan penafian "bantu isi, bukan
  konsultan pajak".

### 9.18 Rumah Tangga

Daftar anggota (foto, nama, peran), undang via tautan/email (anggota membuat akun lokal),
atur peran (dengan ringkasan "bisa apa" per peran dari matriks TEKNIS §12.3), tandai dompet pribadi.
Kartu "Siapa mencatat apa" per periode. Tombol "Buat tautan atur-ulang sandi" per anggota (untuk
yang tidak menerima email). Layar bergabung anggota memuat pemberitahuan agen AI + pilihan "catatanku
boleh dibaca agen pemilik" (tanpa pilihan bawaan tercentang).

### 9.19 Agen AI

- Status sambungan AgentBuff ("Tersambung otomatis · token berlaku s/d …").
- **Draf menunggu persetujuan**: kartu per draf (ringkasan manusia, pratinjau perubahan,
  [Setujui] [Tolak]) — setujui butuh PIN/kunci perangkat.
- Aktivitas agen: daftar semua yang dicatat/diubah agen 30 hari (bisa diurungkan per item).
- Token: daftar (label, cakupan, dibuat, terakhir dipakai), buat token manual (pilih cakupan),
  cabut.
- Contoh perintah untuk agen (salin satu ketuk).

### 9.20 Layar Beku (akses AgentBuff berakhir)

Kartu tenang di tengah: ikon gembok bundar `--label-2`, judul "BYM sedang dibekukan", kalimat
**sesuai alasan** (tabel TEKNIS §6.3.1 — mis. "Langganan BYM-mu sudah berakhir" vs "Akses AgentBuff-mu
sedang berakhir" vs "Kami belum bisa memeriksa langgananmu"), `pesan` dari AgentBuff apa adanya di
bawahnya, kalimat "**Datamu aman dan tidak dihapus.**", **tombol utama sesuai alasan** (Perpanjang BYM ·
Aktifkan AgentBuff · Masuk lagi dengan AgentBuff · Hubungi dukungan · Coba periksa lagi), tombol
sekunder **"Unduh semua dataku (ZIP)"**. Anggota bukan pemilik: tanpa tombol perpanjang, kalimat
"Akses pemilik ruang ini sedang berakhir". Bila ada catatan luring yang tertahan: baris kecil
"3 catatan di perangkat ini menunggu dan akan terkirim otomatis".

### 9.21 Pengaturan

Grup: Profil · Ruang (nama, mata uang dasar — mengubahnya menampilkan pratinjau & menjalankan
pekerjaan latar hitung ulang, TEKNIS §5.1; tanggal gajian — "berlaku mulai <tanggal>", TEKNIS §5.2.1;
awal minggu, zona waktu, ruang untuk agen) ·
Kategori · Aturan otomatis · Anggaran (metode) · Tampilan (tema, ikon aplikasi, mode privasi
otomatis, animasi) · Keamanan (PIN/kunci perangkat, kunci otomatis, sesi aktif) · Notifikasi ·
Data & Privasi (ekspor, impor, hapus ruang, hapus akun) · Langganan (status AgentBuff, tautan
perpanjang) · Tentang (versi, syarat, privasi).

---

## 10. Aksesibilitas & mutu (kontrak yang diuji)

- WCAG 2.2 AA: kontras teks ≥ 4.5:1 (≥ 3:1 untuk ≥ 24px/19px tebal & elemen grafis penting),
  fokus terlihat (cincin 2px `--aksen` + offset 2px), target sentuh ≥ 44×44px.
- Semua fitur bisa dipakai dengan papan ketik; urutan fokus logis; lembar menjebak fokus & Esc menutup.
- Grafik: `role="img"` + ringkasan teks + tabel alternatif.
- Teks diperbesar 200%: tidak ada teks terpotong/tumpang tindih (uji otomatis di 320px).
- Bahasa: `lang="id"`; semua teks lewat kamus (id + en).
- **Penjaga otomatis** (pelajaran AgentBuff): pengukur kontras dari `getComputedStyle` di peramban
  sungguhan (termasuk di atas gradien, ambil stop terburuk), penjaga naskah-keras (teks tanpa kamus
  = gagal build), uji "≤ 3 ketukan" Catat Cepat dengan Playwright, uji tanpa gulir mendatar di 320px.
- Uji visual di 320 · 375 · 768 · 1024 · 1440 · 1920, dua tema.
