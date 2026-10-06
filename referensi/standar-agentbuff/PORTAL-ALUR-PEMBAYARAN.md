# Alur Pembayaran AgentBuff — semua jalur, dari sisi pelanggan sampai pemilik

> Dokumen resmi "uangnya lewat mana, apa yang terjadi, siapa melakukan apa".
> Ditulis 28 September 2026 atas permintaan Chief ("semua flow semua alur baik
> dari sisi admin, owner, hingga customer pastikan benar-benar clear").
> Aturan kodenya ada di berkas yang disebut di tiap bagian — kalau dokumen ini
> dan kode berbeda, **kode yang benar** dan dokumen ini wajib diperbarui.

## 0. Prinsip

| Prinsip | Artinya |
|---|---|
| **Pembayaran final** | Uang yang sudah masuk tidak dikembalikan, **kecuali gangguan sistem** (sudah bayar tapi tidak bisa dipakai, tertagih dobel, nominal salah) atau diwajibkan hukum. Diajukan lewat email. |
| **Tidak ada tagihan otomatis** | Tidak ada kartu tersimpan, tidak ada potongan diam-diam. OP Buff & produk bulanan diperpanjang sendiri; pengingat dikirim sebelum habis. |
| **Satu pintu uang** | Semua pembayaran lewat Midtrans Snap → satu tabel `transaction` → satu webhook + satu penyapu rekonsiliasi. |
| **Yang dijanjikan layar = yang ditagih = yang dicatat** | Harga, jumlah bulan, kupon, dan tanggal "aktif sampai" dihitung aturan yang sama di layar dan di server (`period.ts`, `langganan-produk.ts`). |
| **Seperti semula** | Pengembalian dana mengembalikan akses, kupon, dan trial ke keadaan sebelum pembayaran itu. |
| ⚠️ **Midtrans masih mode uji (sandbox)** | Belum ada uang sungguhan yang masuk sampai kunci produksi dipasang. |

---

## 1. Sisi PELANGGAN

### 1.1 Langganan OP Buff (Rp99.000/bulan · Rp990.000/tahun)
1. `/checkout` → pilih bulanan/tahunan → (opsional) kode promo → **Lanjut ke Bayar** → widget Midtrans (kartu, VA semua bank, QRIS, GoPay/OVO/DANA/ShopeePay, gerai).
2. Lunas → langganan aktif. Kalau masih ada sisa masa (langganan aktif **atau trial yang sedang berjalan**), masa baru **disambung sesudahnya** — tidak ada hari yang hangus.
3. Pelanggan menerima: notifikasi, **email struk + PDF**, dan baris di **Riwayat**.
4. Sebelum habis: pengingat H-7, H-3, H-1, dan hari-H. Habis → /app terkunci, agen berhenti, **data tetap aman**; bayar lagi = aktif lagi.
5. Batalkan perpanjangan: akses tetap sampai tanggal habisnya.

### 1.2 Produk Marketplace
| Cara jual | Contoh | Yang terjadi |
|---|---|---|
| **Langganan bulanan** | Kasir POS Rp49.000/bln | Pembeli memilih 1–36 bulan; total = harga × bulan; perpanjang disambung dari akhir masa; pengingat H-7/3/1/0; habis → aplikasi & konektor agen berhenti, data aman. |
| **Sekali bayar** | KostCloud, Absentra | Milik selamanya. Tidak bisa dibeli dua kali. |
| **Gratis** | (harga Rp0) | Langsung diklaim tanpa pembayaran, milik selamanya. |

- Detail produk: tombol **Berlangganan / Beli / Klaim** → layar bayar di tempat (tanpa pindah halaman).
- Tautan langsung ke produk: `agentbuff.id/marketplace?produk=<kunci>` (sesudah login kembali ke produk yang sama).
- **Sesudah membeli produk aplikasi (KostCloud / Absentra / Kasir POS):** agen **tersambung otomatis** ke aplikasinya — tidak perlu menempel token. Kalau pemilik belum punya usaha di aplikasinya: buka aplikasinya → **Masuk dengan AgentBuff** → buat usahanya; agen tersambung sendiri dalam beberapa menit. Token cadangan manual tetap bisa ditempel.

### 1.3 Kode promo & voucher
| Jenis | Di mana dipakai | Hasil |
|---|---|---|
| Diskon persen / potongan Rp | Checkout OP Buff atau Marketplace | Harga turun; kupon Marketplace bisa khusus satu produk. |
| **OP Buff gratis N bulan/tahun** | Checkout OP Buff | Langganan aktif tanpa bayar. |
| **Voucher gratis produk Marketplace** | Layar bayar produk itu | Produk bulanan: gratis N bulan/tahun (maks 10 tahun). Produk sekali bayar: milik selamanya. |
- Setiap orang hanya bisa menebus **satu kode sekali**.
- Voucher bisa dibagikan sebagai tautan: `agentbuff.id/marketplace?produk=<kunci>&voucher=<KODE>` — kodenya terisi dan dicek otomatis, tinggal **Aktifkan gratis**.
- Voucher & kupon tidak bisa ditukar uang.

### 1.4 Donasi (`/app/dukung`)
Sukarela, tidak memberi fitur apa pun. Tercatat di Riwayat + struk + email terima kasih.

### 1.5 Pembayaran yang belum selesai
- Menutup widget sebelum bayar → pesanan tetap bisa dilanjutkan (tombol yang sama membuka pesanan yang sama, tidak ditagih dua kali).
- Mengganti jumlah bulan/kupon → pesanan lama dibatalkan, dibuat yang baru.
- **Transfer VA**: pesanan tetap bisa dibayar selama Midtrans masih membukanya (sampai 7 hari).
- **Bayar terlambat** (sesudah pesanan sempat ditandai gagal): AgentBuff mengecek langsung ke Midtrans; kalau benar lunas, pembelian tetap diberikan.

### 1.6 Ada kendala → pengembalian dana
1. Di **Riwayat**, tiap pembayaran punya **"Ada kendala?"**: kebijakan + nomor pesanan (bisa disalin) + tombol email ke **support@agentbuff.id**.
2. Pelanggan mengirim email (paling lambat 14 hari sejak bayar) dengan nomor pesanan.
3. Bila disetujui (lihat 2.3), pelanggan menerima notifikasi + email:
   - **Midtrans otomatis**: "Dana sudah dikembalikan ke GoPay/kartu/QRIS …" (waktu terlihat tergantung penyedia: e-wallet menit, kartu s/d 14 hari kerja).
   - **Transfer manual**: "Disetujui, kami transfer ke rekening BCA •••• 1234 paling lambat 3 hari kerja", lalu "Sudah ditransfer, ref …".
4. Riwayat menampilkan status **Dikembalikan** + ke mana dan kapan. Akses yang dibeli pembayaran itu kembali seperti semula.

---

## 2. Sisi PEMILIK / ADMIN

### 2.1 Harga & produk
- OP Buff: `/admin/tiering` (harga efektif). Produk: `/admin/marketplace` → Katalog 1P → **Cara jual** (Sekali bayar / Langganan bulanan; langganan tidak boleh Rp0 — gratis = Sekali bayar Rp0).
- Harga yang diubah di tengah checkout → pembeli ditolak "harga berubah" dan melihat harga baru, tidak pernah ditagih angka lain.

### 2.2 Kupon & voucher (`/admin/tiering` → Kupon Promo & Voucher Gratis)
1. **Berlaku untuk**: Langganan (OP Buff) / Marketplace / Semua.
2. **Tipe**: Persen · Potongan Rp · **Gratis / voucher**.
   - Gratis + Langganan = OP Buff gratis N bulan/tahun.
   - Gratis + Marketplace = **wajib pilih satu produk**; produk bulanan → isi lama (bulan/tahun, maks 10 tahun); produk sekali bayar → otomatis "milik selamanya".
3. Kupon gratis wajib punya **batas pakai** dan **kadaluarsa**.
4. Voucher Marketplace punya tombol **Salin link** → bagikan ke calon pembeli.
5. Pemakaian terlihat di kolom **Pakai** (mis. 12 / 50).

### 2.3 Pengembalian dana (hanya gangguan sistem)
Masuk dari email pelanggan → cari transaksinya di `/admin/billing` (cari nomor pesanan) → buka rincian → **Kembalikan dana**.

Dialog menampilkan:
- kebijakan (final kecuali gangguan sistem),
- ringkasan pembayaran (nominal, metode, tanggal, pembeli),
- **"Dikembalikan seperti semula"** — daftar persis apa yang berubah (dihitung server dengan aturan yang sama dengan eksekusinya), mis. "Langganan OP Buff dibatalkan, trial aktif lagi sampai 3 Okt", "Kasir POS dikurangi 3 bulan", "Kuota kupon HEMAT10 dikembalikan",
- **"Dana kembali lewat"** — ditentukan otomatis:

| Metode bayar pelanggan | Dana kembali lewat |
|---|---|
| Kartu, GoPay, ShopeePay, DANA, OVO, QRIS, Kredivo, Akulaku — **dalam batas waktunya** | **Midtrans otomatis** ke metode asal (tombol "Pakai transfer manual saja" tetap ada) |
| Transfer VA, gerai (Indomaret/Alfamart), lewat batas waktu, atau metode tak tercatat | **Transfer manual** oleh pemilik — isi bank, no. rekening, atas nama (dari email pelanggan) |

Isian wajib: **penyebab** (tidak bisa dipakai / tertagih dobel / nominal salah / gangguan lain) + **rujukan email**. Lalu konfirmasi.

- **Midtrans otomatis**: uang dikembalikan saat itu juga → status **Selesai** → pelanggan diberi tahu. Kalau Midtrans menolak, **tidak ada yang berubah** dan dialog menawarkan transfer manual.
- **Transfer manual**: akses langsung dikembalikan + pelanggan diberi tahu "menunggu transfer" → **pemilik transfer dari rekening usaha** → di rincian transaksi isi **nomor referensi + tanggal** → **Sudah ditransfer** → pelanggan menerima email "dana sudah ditransfer".
- Yang belum ditransfer muncul di daftar kerja **"Pengembalian menunggu transfer"** di `/admin/billing` sampai ditandai.
- **Refund langsung dari dasbor Midtrans** (atau chargeback bank): webhook Midtrans memicu hal yang sama — dicatat sebagai "Dasbor Midtrans", akses dikembalikan seperti semula, pelanggan diberi tahu.
- ⛔ Tombol lama "Tandai refunded" (hanya menandai tanpa memindahkan uang) **sudah dihapus**.
- **Siapa boleh apa**: memproses pengembalian dan menandai "Sudah ditransfer" = **admin penuh** saja. Staf **support** boleh melihat statusnya, tapi nomor rekening pembeli tampil tersamar (**•••• 1234**) — nomor lengkap hanya untuk yang mentransfer.

### 2.4 Rekonsiliasi & pantauan
- `/admin/billing` → daftar kerja: pending lama, pengembalian menunggu transfer, install gagal, langganan hampir habis, dst.
- Transaksi pending bisa **Cek status** (tarik status dari Midtrans).
- Donasi punya lensa sendiri; setiap donasi memberi notifikasi ke staf.

---

## 3. Yang berjalan OTOMATIS

| Proses | Kapan | Yang dilakukan |
|---|---|---|
| Webhook Midtrans | Tiap perubahan status | Lunas → berikan hak + struk + email. Gagal/kedaluwarsa → tandai gagal + kembalikan kuota kupon. Refund → kembalikan seperti semula. |
| Penyapu rekonsiliasi | Berkala | Tanya Midtrans untuk pesanan pending; VA yang masih bisa dibayar ditunggu (≤7 hari). |
| Pengingat | Tiap 30 menit | OP Buff & produk bulanan: H-7, H-3, H-1, hari-H (sekali per titik). |
| Sapuan masa habis | Tiap 30 detik | Produk bulanan yang habis → konektor/skill dilepas + pemberitahuan. Perpanjangan yang masuk bersamaan tidak ikut dimatikan. |
| **Sambung MCP otomatis** | Sesudah beli, sesudah pemilik masuk ke aplikasi, dan tiap 5 menit | Minta token ke aplikasi, pasang di konektor agen; perbarui token 14 hari sebelum habis; tidak menimpa token manual; tidak menyambung ulang aplikasi yang diputus pemilik. |
| Pasang ulang tiap rilis | Tiap kontainer dibuat ulang | Produk dipasang lagi **tanpa** menambah masa langganan dan **tanpa** menghapus token konektor. |

---

## 4. Keadaan transaksi

| Status | Arti |
|---|---|
| `pending` | Menunggu dibayar |
| `completed` | Lunas (OP Buff / donasi / produk sebelum terpasang) |
| `installed` | Lunas, produk sudah terpasang di agen |
| `install_failed` | Lunas tapi pemasangan gagal berkali-kali → pelanggan diarahkan email support (gangguan sistem = boleh dikembalikan) |
| `failed` | Tidak jadi dibayar / dibatalkan / kedaluwarsa |
| `refunded` | Dana dikembalikan; rincian di tabel `pengembalian_dana` |

## 5. Peta kode

| Bagian | Berkas |
|---|---|
| Aturan bulan produk | `src/lib/billing/langganan-produk.ts` |
| Masa OP Buff | `src/lib/billing/period.ts` |
| Settlement | `src/lib/billing/settle.ts` |
| Kupon/voucher | `src/lib/billing/coupon.ts`, `kupon-produk.ts`, `src/app/api/billing/skill/route.ts` |
| Pengembalian dana | `src/lib/billing/pengembalian-dana.ts`, `metode-pengembalian.ts`, `kembali-op-buff.ts`, `refund.ts` |
| Sambung MCP otomatis | `src/lib/masuk/mcp-otomatis.ts` + kontrak `Docs/MASUK-DENGAN-AGENTBUFF.md` |
| Kebijakan di layar | `src/components/billing/kebijakan-bayar.tsx`, Syarat & Ketentuan Pasal 4 |
| Penjaga | `scripts/cek-langganan-produk.ts`, `scripts/cek-pengembalian-dana.ts` (di `jaga`) |
