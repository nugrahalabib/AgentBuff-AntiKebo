# Buff Your Money (BYM) — Spesifikasi Teknis

> Bagian dari PRD BYM. Produk & kriteria penerimaan ada di `PRD.md`, visual di `DESAIN.md`.
> Semua rumus di sini disertai **contoh emas** (angka pasti) yang WAJIB jadi uji unit.
> Kontrak integrasi AgentBuff di §6 & §10 diturunkan dari kode AgentBuff per 28 Sep 2026
> (`Docs/MASUK-DENGAN-AGENTBUFF.md`, `src/lib/masuk/*`) — bila berbeda dengan kode AgentBuff
> terbaru, **kode AgentBuff yang benar**; perbarui dokumen ini.

---

## 1. Arsitektur

```
                 ┌─────────────────────── agentbuff.id ───────────────────────┐
 Pengguna ──────▶│ Marketplace (beli/voucher) · OIDC /masuk · /masuk/status    │
 (web/PWA)       │ Agen Hermes (WA/Telegram/web) ── konektor MCP "bym" ──┐     │
    │            └───────────────────────────────────────────────────────┼─────┘
    │  HTTPS (NPM + Cloudflare)                                          │ Bearer token
    ▼                                                                    ▼
┌──────────────────────────── bym.agentbuff.id (VPS, docker compose) ─────────────┐
│ bym-web  (Next.js 16, Node 22)                                                  │
│   ├─ halaman aplikasi (RSC + klien)      ├─ /api/*  (JSON untuk aplikasi)        │
│   ├─ /auth/agentbuff/* (OIDC klien)      ├─ /mcp    (server MCP Streamable HTTP) │
│   └─ /api/agentbuff/mcp-token (dipanggil AgentBuff)                              │
│ bym-worker (Node 22, pg-boss): berulang, pengingat, harga, kurs, snapshot,       │
│   wawasan, level, deteksi langganan, verifikasi saldo, status hak, bersih-bersih │
│ bym-db (PostgreSQL 16, volume bind /opt/bym/data/pg, RLS aktif)                  │
│ berkas lampiran terenkripsi: /opt/bym/data/lampiran                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Prinsip:
- **Satu sumber kebenaran = Postgres.** Semua perhitungan finansial di server (modul `src/lib/uang/*`,
  murni & teruji). Klien hanya menampilkan. Pengecualian: Monte Carlo (Web Worker, benih tetap,
  modul sama dipakai server untuk uji).
- **Tenant = ruang.** Setiap tabel data pengguna punya `ruang_id`; akses dibatasi di dua lapis:
  helper kueri ber-ruang + **Row Level Security** Postgres (§12.3).
- Operasi yang bisa > 60 dtk (impor besar, ekspor ZIP, terapkan aturan ke riwayat) = **pekerjaan
  latar** dengan status yang di-poll — tidak pernah permintaan HTTP panjang (pelajaran AgentBuff:
  `proxy_read_timeout` nginx 90 dtk).

---

## 2. Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack), React 19, TypeScript strict | sama dengan AgentBuff (pengetahuan & jebakan sudah terdokumentasi) — ⚠ baca `node_modules/next/dist/docs/` sebelum menulis kode Next |
| Gaya | Tailwind CSS v4 (konfigurasi CSS-only, token di `globals.css`), Radix primitives, Motion (framer-motion) seperlunya | token desain = variabel CSS (DESAIN §2) |
| Data klien | TanStack Query 5 (keadaan server), Zustand (keadaan UI kecil) | pola AgentBuff |
| DB | PostgreSQL 16 + **Drizzle ORM** + migrasi SQL berversi (`drizzle-kit generate`, ditinjau manusia) | ⛔ **tidak pernah `drizzle push` di produksi**; migrasi aditif |
| Antrean | **pg-boss** (antrean di Postgres) | tanpa Redis; satu basis data |
| OIDC | `openid-client` v6 | PKCE, discovery, validasi ID token |
| JWT | `jose` (`createRemoteJWKSet`, `jwtVerify`) | verifikasi assertion mcp-token |
| MCP | `@modelcontextprotocol/server` v2 `createMcpHandler` (stateless, respons JSON) | acuan: `src/lib/admin-mcp/http.ts` di repo AgentBuff |
| Validasi | zod v4 | skema input API & tool |
| Angka | integer (satuan terkecil) + `decimal.js` untuk kuantitas & harga investasi | §5.1 |
| Grafik | visx (d3-scale/d3-shape) + d3-sankey, gaya sendiri | gaya bawaan pustaka grafik tidak "Apple" |
| Hash | `@node-rs/argon2` (argon2id) | sandi anggota & PIN |
| Passkey | `@simplewebauthn/server` + `/browser` | kunci perangkat |
| PWA | Serwist (`@serwist/next`) — ⚠ verifikasi kompatibilitas Next 16; bila tidak, service worker tulis tangan | luring & push |
| Push | `web-push` (VAPID) | notifikasi |
| Email | Nodemailer (SMTP, opsional) | ringkasan |
| OCR | `tesseract.js` (ind+eng) di Web Worker, dimuat malas | struk/tangkapan layar di perangkat |
| PDF | `pdfjs-dist` di perangkat | e-statement berpassword dibuka lokal |
| Excel | `exceljs` (baca XLSX impor, tulis ekspor) | |
| Uji | Vitest, fast-check (properti), Playwright (+ axe-core), uji kontrak MCP | |
| Log | pino (JSON, redaksi) | |
| Runtime | Node 22 LTS, Docker, compose | pola `/opt/agentbuff-pos` |

---

## 3. Struktur repo

```
bym/
├─ src/
│  ├─ app/
│  │  ├─ (publik)/            page.tsx (beranda publik), demo/, syarat/, privasi/
│  │  ├─ (auth)/masuk/        halaman masuk (tombol AgentBuff + form anggota)
│  │  ├─ auth/agentbuff/      start/route.ts, callback/route.ts
│  │  ├─ app/                 layout.tsx (gerbang sesi + beku), beranda, transaksi, rencana/*,
│  │  │                       kekayaan/*, laporan/*, zakat-pajak, agen, impor-ekspor, pengaturan/*
│  │  ├─ ops/                 panel operator
│  │  ├─ api/                 REST JSON aplikasi (§13), health, agentbuff/mcp-token
│  │  └─ mcp/route.ts         server MCP
│  ├─ proxy.ts                ⛔ di src/ (bukan akar repo) — CSP nonce, matcher LITERAL
│  ├─ lib/
│  │  ├─ uang/                rumus murni: format, periode, aman, amplop, target, utang,
│  │  │                       investasi, fi, zakat, pajak, berulang, wawasan, level
│  │  ├─ parser/              bahasa alami (tokenizer, jumlah, tanggal, dompet, kategori)
│  │  ├─ aturan/              mesin aturan
│  │  ├─ impor/               parser CSV/XLSX/PDF per bank + dedupe
│  │  ├─ agentbuff/           oidc.ts, status.ts (gerbang hak + singgahan), mcp-token.ts
│  │  ├─ mcp/                 server.ts, alat/*.ts (satu berkas per kelompok), cakupan.ts, draf.ts
│  │  ├─ db/                  schema.ts, rls.ts (SET LOCAL), kueri ber-ruang, migrasi/
│  │  ├─ auth/                sesi, anggota, pin, passkey
│  │  ├─ enkripsi/            amplop kunci lampiran
│  │  ├─ notifikasi/          push, email, jadwal jam tenang
│  │  ├─ harga/               indodax, kurs, operator
│  │  └─ i18n/                kamus id/en
│  ├─ components/             ui/ (komponen inti DESAIN §6), per-fitur
│  └─ worker/                 index.ts (pg-boss), pekerjaan/*
├─ scripts/                   jaga.mjs (penjaga), prove-*.ts (bukti produksi), seed-*.ts
├─ deploy/                    docker-compose.yml, deploy.sh, backup.sh, Dockerfile
├─ tests/                     unit/, properti/, e2e/, mcp/, fixtures/ (contoh emas, berkas bank)
└─ docs/                      salinan PRD ini + catatan perubahan (LAPORAN-PERUBAHAN.md)
```

`package.json` → `"build": "node scripts/jaga.mjs && next build"` (penjaga WAJIB di dalam build,
bukan `prebuild` — pnpm tidak menjalankan pre-script secara bawaan).

---

## 4. Model data

Konvensi: nama tabel & kolom bahasa Indonesia snake_case; `id uuid default gen_random_uuid()`;
`dibuat timestamptz default now()`, `diubah timestamptz`; uang = `bigint` satuan terkecil (§5.1);
kuantitas/harga investasi = `numeric(38,18)`; semua tabel data pengguna punya `ruang_id uuid not null`
+ indeks + kebijakan RLS; hapus lunak lewat `dihapus_pada timestamptz` di tabel yang bisa diurungkan.

### 4.1 Identitas & ruang

```sql
pengguna(id, jenis text check (jenis in ('pemilik','anggota')),
         agentbuff_sub text unique,            -- pemilik saja; 'abs_…' pairwise, permanen
         email citext, nama text, foto_url text,
         sandi_hash text,                       -- anggota saja (argon2id)
         pin_hash text, pin_gagal int default 0, pin_kunci_sampai timestamptz,
         locale text default 'id', zona_waktu text default 'Asia/Jakarta',
         setuju_data_keuangan_pada timestamptz,  -- persetujuan UU PDP terpisah
         terakhir_masuk timestamptz, dihapus_pada timestamptz, dibuat)
ruang(id, pemilik_id → pengguna, nama, mata_uang_dasar char(3) default 'IDR',
      hari_gajian smallint null,                -- 1..31; null = tidak tetap
      aturan_gajian text default 'tanggal',     -- 'tanggal' | 'akhir_bulan' | 'hari_kerja_terakhir' | 'tidak_tetap'
      geser_gajian text default 'mundur_hari_kerja', -- 'tetap' | 'mundur_hari_kerja' | 'maju_hari_kerja'
      jenis_periode text default 'gajian',      -- 'gajian' | 'kalender' | 'mingguan' | 'dua_mingguan'
      metode_anggaran text default 'sederhana', -- 'sederhana' | '50_30_20' | '40_30_20_10' | 'amplop'
      awal_minggu smallint default 1, zona_waktu text,
      beku_alasan text, beku_pesan text, beku_sejak timestamptz,
      demo boolean default false, dihapus_pada, dibuat)
anggota_ruang(ruang_id, pengguna_id, peran text check (peran in ('pemilik','pengelola','pencatat','pengamat')),
              setuju_agen_pada timestamptz null,   -- anggota membaca pemberitahuan agen AI pemilik (§12.3)
              sertakan_di_mcp bool default false,  -- catatan anggota ini boleh dibaca agen pemilik
              dikeluarkan_pada timestamptz null, dibuat, primary key (ruang_id, pengguna_id))
riwayat_periode(ruang_id, berlaku_mulai date, jenis_periode, hari_gajian, aturan_gajian, geser_gajian,
                primary key (ruang_id, berlaku_mulai))   -- §5.2.1: ganti setelan periode = baris baru
undangan(id, ruang_id, email, peran, token_hash, kedaluwarsa, dipakai_pada, dibuat_oleh)
sesi(id_hash pk, pengguna_id, dibuat, kedaluwarsa_diam, kedaluwarsa_mutlak, ip, ua, dicabut_pada)
kunci_perangkat(id, pengguna_id, credential_id bytea unique, public_key bytea, counter bigint,
                transports text[], nama text, dibuat, terakhir_dipakai)
status_hak(pengguna_id pk, aktif bool, alasan text, pesan text,
           diperiksa_pada timestamptz, terakhir_baik_pada timestamptz,
           tidak_dikenal_sejak timestamptz null,  -- hanya dari jawaban 200 alasan 'tidak_dikenal' (§6.2.3)
           pemberitahuan_hapus jsonb)             -- {h30, h60, h83} waktu terkirim
```

Kolom `ruang.hari_gajian … geser_gajian` = setelan **yang berlaku sekarang** (cermin baris
`riwayat_periode` terakhir); perhitungan periode selalu membaca `riwayat_periode`.

### 4.2 Dompet, kategori, penerima, tag

```sql
institusi(kode pk, nama, jenis, logo_path, alias text[])     -- referensi global, di-seed
mata_uang(kode char(3) pk, eksponen smallint, simbol)        -- ISO 4217 (IDR eksponen 2)
dompet(id, ruang_id, nama, jenis text,       -- tunai|bank|ewallet|kartu_kredit|paylater|pinjaman|investasi|aset|piutang|arisan|lainnya
       institusi_kode, mata_uang, saldo_awal_minor bigint, tanggal_saldo_awal date,
       saldo_cache_minor bigint,              -- dijaga transaksional + verifikasi malam
       ikut_anggaran bool, ikut_kekayaan bool, ikut_fi bool default true,  -- aset: false untuk rumah tinggal
       limit_kredit_minor bigint, tgl_cetak smallint, tgl_jatuh_tempo smallint,
       bunga_bps int, basis_bunga text, min_bayar_bps int,
       pemilik_anggota_id uuid null, visibilitas text default 'bersama', -- 'bersama'|'pribadi'
       ikut_total_rumah_tangga bool default false,  -- dompet pribadi: jumlahnya boleh ikut total (§12.3)
       kode_spt text null, tahun_perolehan smallint null, harga_perolehan_minor bigint null,  -- aset (§5.20)
       terkunci_sampai date null,             -- rekonsiliasi dikunci: ubah sebelum tanggal ini = konfirmasi
       alias text[],                          -- untuk parser: 'gpay','gopay'
       warna, ikon, urutan real, tercocok_pada timestamptz, diarsipkan_pada, dibuat)
-- Rumah kanonik (§5.17): kas/tabungan/e-wallet = tunai|bank|ewallet; utang = pinjaman|kartu_kredit|paylater;
-- piutang per pihak = piutang; setoran arisan = arisan; properti/kendaraan/bisnis/barang berharga/polis
-- bernilai tunai = aset (+ nilai_aset); emas, saham, RD, kripto, SBN, deposito, P2P, JHT/DPLK = kepemilikan
-- di dompet investasi. Tidak ada aset yang tercatat di dua rumah.
kategori(id, ruang_id, induk_id null, nama, jenis text,  -- keluar|masuk
         kelompok text null,                  -- kebutuhan|keinginan|tabungan (50/30/20) ; hidup|cicilan|tabungan|zis (40/30/20/10)
         sistem text null,                    -- transfer|penyesuaian|biaya_admin|selisih_kurs|belum
         ikon, warna, urutan, tahunan bool default false, kata_kunci text[], diarsipkan_pada)
penerima(id, ruang_id, nama, kategori_bawaan_id, pola_mentah text[], logo_path, dibuat)
tag(id, ruang_id, nama unique per ruang)
```

### 4.3 Transaksi & terkait

```sql
transaksi(id uuid,                -- boleh dibuat klien (luring) → idempoten
  ruang_id, dompet_id,
  jenis text,                     -- keluar|masuk|transfer_keluar|transfer_masuk|penyesuaian
  jumlah_minor bigint,            -- BERTANDA: keluar negatif, masuk positif
  mata_uang char(3), kurs numeric(28,12), jumlah_dasar_minor bigint,  -- ke mata uang dasar ruang
  tanggal date, waktu timestamptz null,
  kategori_id null, penerima_id null, penerima_mentah text,  -- teks asli impor
  catatan text, orang text null,
  pasangan_transfer_id uuid null, induk_split_id uuid null, adalah_induk_split bool,
  berulang_id null, kejadian_id null, utang_id null, target_id null, investasi_tx_id null,
  refund_dari_id uuid null, reimburse bool default false,
  status_tinjau text default 'ditinjau',  -- perlu_ditinjau|ditinjau
  kepercayaan_kategori real null,
  sumber text,                    -- manual|catat_cepat|agen|impor|berulang|struk|sistem
  sumber_ref text null,           -- JEJAK saja (tidak unik): 'client_ref#urutan' agen / id baris impor
  sidik_impor char(64) null,      -- §5.16: unik per (ruang_id, dompet_id) bila terisi
  ditangkap_pada timestamptz null, zona_tangkap text null,  -- luring: waktu & zona saat diketik (§16)
  impor_id uuid null, token_id uuid null, grup_hapus_id uuid null,  -- §5.18
  dibuat_oleh uuid, versi int default 1,
  dihapus_pada timestamptz null, dibuat, diubah)
-- indeks: (ruang_id, tanggal desc), (ruang_id, dompet_id, tanggal), (ruang_id, kategori_id, tanggal),
--         (ruang_id, status_tinjau) where status_tinjau='perlu_ditinjau', GIN pg_trgm (catatan, penerima_mentah),
--         unique (ruang_id, dompet_id, sidik_impor) where sidik_impor is not null
-- id buatan klien: INSERT … ON CONFLICT (id) DO NOTHING RETURNING id; tak ada baris kembali →
--   SELECT id di bawah RLS → terlihat = ulangan sah (kembalikan baris itu); tak terlihat = 409 'id_bentrok'.
--   TIDAK PERNAH ON CONFLICT DO UPDATE (bisa menimpa baris ruang lain).
idempotensi(ruang_id, alat text,      -- nama tool MCP / 'app:catat_cepat' / 'app:luring'
            client_ref text,          -- ≤ 100 karakter
            hash_argumen char(64),    -- sha256 JSON argumen yang dikanonkan (tanpa client_ref)
            hasil jsonb, dibuat,      -- disimpan 30 hari (bersih-bersih)
            primary key (ruang_id, alat, client_ref))
transaksi_tag(transaksi_id, tag_id)
lampiran(id, ruang_id, transaksi_id, mime, ukuran, sha256, path_terenkripsi, dek_versi, dibuat)
riwayat_transaksi(id, transaksi_id, ruang_id, aktor_jenis, aktor_id, sebelum jsonb, sesudah jsonb, dibuat)
aturan(id, ruang_id, tahap text, prioritas int, kondisi jsonb, aksi jsonb, hentikan bool,
       aktif bool, asal text,              -- pengguna|belajar
       jumlah_kena int, dibuat)
```

### 4.4 Rencana

```sql
anggaran(ruang_id, kategori_id, periode_mulai date, jumlah_minor bigint, rollover bool,
         templat jsonb, catatan, primary key (ruang_id, kategori_id, periode_mulai))
alokasi_pindah(id, ruang_id, periode_mulai, dari_kategori_id, ke_kategori_id, jumlah_minor, dibuat_oleh, dibuat)
target(id, ruang_id, nama, jenis text, jumlah_target_minor, tanggal_target date null,
       foto_lampiran_id null, ikon, warna, prioritas, cara text,   -- dompet_khusus|kantong_virtual
       dana_darurat bool default false,        -- maks satu per ruang (indeks unik parsial) — dipakai Level Buff
       terkumpul_awal_minor bigint default 0,  -- terkumpul saat target dibuat (dasar status, §5.9)
       imbal_hasil_bps int default 0, status text, tercapai_pada, dibuat)
target_dompet(target_id, dompet_id, porsi_bps int)  -- untuk dompet_khusus (porsi saldo)
alokasi_target(id, ruang_id, target_id, dompet_id, jumlah_minor bigint,  -- + sisih / − ambil
               tanggal, transaksi_id null, catatan, sumber, dibuat_oleh, dibuat)
berulang(id, ruang_id, jenis text,        -- tagihan|langganan|pemasukan|transfer|cicilan|arisan
         nama, jumlah_minor, perkiraan bool, toleransi_bps int default 750,
         rrule text, jangkar date,             -- tanggal mulai; acuan hitung 'dua_mingguan' & 'mingguan'
         tanggal_berikut date,
         geser text default 'tetap',           -- 'tetap'|'mundur_hari_kerja'|'maju_hari_kerja' (§5.8.1)
         dompet_id, ke_dompet_id null, kategori_id, penerima_pola text,
         otomatis_catat bool, ingatkan_hari int[] default '{3,0}',
         utang_id null, arisan_id null, terdeteksi bool, dikonfirmasi bool,
         berakhir date null, aktif bool, dibuat)
kejadian_berulang(id, berulang_id, ruang_id, tanggal_jatuh date, jumlah_minor,
                  status text,            -- akan|lunas|dilewati|terlambat
                  transaksi_id null, diingatkan jsonb, unique (berulang_id, tanggal_jatuh))
```

### 4.5 Utang, arisan

```sql
utang(id, ruang_id, arah text,           -- saya_berutang|orang_berutang
      jenis text,                         -- pribadi|kartu_kredit|paylater|pinjol|kta|kpr|kkb|cicilan_barang|koperasi|lainnya
      pihak text, kontak_wa text null, pokok_awal_minor, tanggal_mulai,
      bunga_bps int, basis_bunga text,    -- efektif_tahunan|flat_bulanan|harian|nol
      jadwal_bunga jsonb null,            -- KPR fixed→floating: [{mulai_bulan:1,bunga_bps:450,basis},{mulai_bulan:37,bunga_bps:1100,…}]
      penalti_lunas_bps int null,         -- denda pelunasan dipercepat (KPR/KTA)
      biaya_admin_minor bigint null,      -- cicilan 0%: biaya admin/konversi di muka
      tenor_bulan int null, cicilan_minor bigint null, hari_jatuh_tempo smallint,
      dompet_id not null,                 -- dompet LIABILITAS (pinjaman/kartu_kredit/paylater) atau PIUTANG (§5.17)
      status text, catatan, dibuat)
-- sisa pokok TIDAK disimpan: = −saldo dompet liabilitas (atau saldo dompet piutang) → tak pernah menyimpang
pembayaran_utang(id, utang_id, ruang_id, transaksi_pokok_id,  -- transfer ke dompet liabilitas
                 transaksi_bunga_id null,                     -- pengeluaran kategori "Bunga & denda"
                 tanggal, pokok_minor, bunga_minor, denda_minor)
arisan(id, ruang_id, dompet_id,           -- dompet jenis 'arisan' (saldo = posisi bersih, §5.17)
       nama, iuran_minor, rrule, peserta int, giliran_saya int null,
       tanggal_mulai, status, dibuat)
putaran_arisan(arisan_id, ke int, tanggal, penerima text, saya_menerima bool, transaksi_setor_id, transaksi_terima_id)
```

### 4.6 Investasi & kekayaan

```sql
instrumen(id, kelas text,  -- saham_idx|reksa_dana|emas|kripto|sbn|obligasi|deposito|saham_asing|etf|p2p|pensiun|lainnya
                           -- (properti/kendaraan/bisnis TIDAK di sini — rumahnya dompet 'aset', §4.2)
          kode text, nama, mata_uang, satuan text, lot int null, merek text null,  -- emas: antam|ubs|galeri24|pegadaian
          sumber_harga text,       -- indodax|operator|pengguna|kurs
          global bool,             -- true = referensi bersama; false = buatan ruang (ruang_id terisi)
          ruang_id null)
harga(instrumen_id, tanggal date, harga numeric(38,18), harga_buyback numeric(38,18) null,
      sumber text, diambil_pada timestamptz, primary key (instrumen_id, tanggal, sumber))
kepemilikan(id, ruang_id, dompet_id, instrumen_id, metode_biaya text default 'rata_rata',
            -- deposito/SBN:
            pokok_minor null, bunga_bps null, pajak_bps null, tanggal_buka null, jatuh_tempo null, aro bool,
            harga_manual numeric null, harga_manual_pada timestamptz null, dibuat)
transaksi_investasi(id, ruang_id, kepemilikan_id, jenis text,  -- beli|jual|dividen|dividen_saham|bunga|kupon|biaya|split|bonus|penyesuaian
                    tanggal, kuantitas numeric(38,18), harga numeric(38,18),
                    biaya_minor bigint, pajak_minor bigint, bersih_minor bigint,
                    transaksi_kas_id null, catatan, sumber, sumber_ref, dibuat)
nilai_aset(id, ruang_id, dompet_id, tanggal, nilai_minor, sumber)   -- aset manual (properti, kendaraan)
snapshot_kekayaan(ruang_id, tanggal, aset_minor, liabilitas_minor, per_kelas jsonb, per_pemilik jsonb,
                  dikunci_pada timestamptz null,   -- 31 Des dikunci saat daftar SPT disalin/diekspor
                  primary key (ruang_id, tanggal))
snapshot_item(ruang_id, tanggal, jenis text,        -- aset|utang — rincian per pos (dasar daftar SPT §5.20)
              ref_jenis text, ref_id uuid, nama, kode_spt text null, tahun_perolehan smallint null,
              harga_perolehan_minor bigint null, nilai_minor bigint, mata_uang char(3), pemilik_anggota_id null,
              primary key (ruang_id, tanggal, ref_jenis, ref_id))
kurs(dari char(3), ke char(3), tanggal date, nilai numeric(28,12), sumber, primary key (dari, ke, tanggal, sumber))
profil_fi(ruang_id pk, pengeluaran_tahunan_minor null, swr_bps int default 400, inflasi_bps int,
          imbal_riil_bps int default 400, usia int null, usia_pensiun int null,
          penghasilan_pasif_minor bigint default 0, asumsi jsonb)
level_buff(ruang_id pk, level smallint, syarat jsonb, dihitung_pada, naik_pada)
```

### 4.7 Agen, notifikasi, operasi

```sql
token_mcp(id, ruang_id, pengguna_id, label, hash char(64) unique, awalan char(8),
          cakupan text,                   -- baca|catat
          boleh_usulan bool, sumber text, -- manual|agentbuff_otomatis
          kedaluwarsa timestamptz null, terakhir_dipakai, dicabut_pada, dibuat)
draf_agen(id, ruang_id, token_id, alat text, argumen jsonb, ringkasan text, pratinjau jsonb,
          status text,                    -- menunggu|disetujui|ditolak|kedaluwarsa|gagal
          diputuskan_oleh, diputuskan_pada, kedaluwarsa, hasil jsonb, dibuat)
aksi_agen(id, ruang_id, token_id, alat, target_jenis, target_id, sebelum jsonb, sesudah jsonb,
          diurungkan_pada, dibuat)       -- untuk "Urungkan" per item (30 hari)
jti_terpakai(jti pk, kedaluwarsa)         -- replay store assertion (≥ 5 menit)
notifikasi(id, ruang_id, pengguna_id, jenis, judul, isi, tautan, dibaca_pada, dibuat)
langganan_push(id, pengguna_id, endpoint unique, p256dh, auth, ua, dibuat)
preferensi_notifikasi(pengguna_id, jenis, kanal text[], aktif bool,
                      jam_tenang_mulai time default '21:00', jam_tenang_akhir time default '07:00',
                      -- mulai > akhir = melewati tengah malam (21:00→07:00); sama = tanpa jam tenang
                      tampilkan_jumlah bool default false)   -- jumlah di notifikasi layar kunci (bawaan: tidak)
unggahan_struk(id, ruang_id, token_id, path_sementara, mime, ukuran, sha256,
               kedaluwarsa timestamptz, dipakai_transaksi_id null, dibuat)  -- §9.3 create_receipt_upload
impor(id, ruang_id, dompet_id, format, nama_berkas, sha256, status, baris, baru, duplikat,
      pemetaan jsonb, dibuat_oleh, dibatalkan_pada, dibuat)
pekerjaan_pengguna(id, ruang_id, jenis, status, progres, hasil_path, galat, dibuat)  -- ekspor/terapkan aturan
jejak_audit(id, ruang_id, aktor_jenis, aktor_id, aksi, target_jenis, target_id, detail jsonb, ip, dibuat)
wawasan(id, ruang_id, jenis, kunci_unik, data jsonb, dibuat, ditutup_pada)
permintaan_hapus(id, ruang_id null, pengguna_id, jenis,   -- permintaan_pengguna|tidak_dikenal_90h|anggota_dikeluarkan
                 dijadwalkan_pada, dibatalkan_pada,
                 butuh_setuju_operator bool,             -- true untuk 'tidak_dikenal_90h' (§6.2.3)
                 disetujui_operator_oleh null, disetujui_operator_pada null, selesai_pada)
setelan_operator(kunci pk, nilai jsonb, diubah_oleh, diubah)   -- nisab, CPI, TBP LPS, libur, isbat
hari_libur(tanggal pk, nama, jenis)                            -- libur nasional & cuti bersama
```

### 4.8 Seed kategori bawaan (Indonesia)

Keluar (induk → sub; `kelompok` 50/30/20):
- **Makan & Minum** (kebutuhan): Makan di luar · Pesan antar (GoFood/GrabFood/ShopeeFood) · Kopi & jajan
  (keinginan) · Belanja dapur/pasar · Air galon
- **Transportasi** (kebutuhan): Bensin/BBM · Ojol · Parkir · Tol & e-toll · Angkutan umum (KRL/MRT/TransJakarta) · Servis & pajak kendaraan (tahunan)
- **Tagihan** (kebutuhan): Listrik/Token PLN · Air PDAM · Internet & TV · Pulsa & paket data · Gas/LPG · BPJS Kesehatan (mandiri) · IPL/iuran RT & keamanan
- **Tempat tinggal** (kebutuhan): Sewa/kos · Perabot & perbaikan · Kebersihan & ART
- **Belanja** (keinginan): Belanja online · Pakaian · Elektronik & gadget · Kebutuhan rumah tangga (kebutuhan)
- **Kesehatan** (kebutuhan): Dokter & obat · Asuransi (tahunan opsional) · Olahraga (keinginan)
- **Pendidikan** (kebutuhan): SPP & uang sekolah · Kursus & les · Buku
- **Keluarga** (kebutuhan): Kiriman orang tua · Kebutuhan anak · Hewan peliharaan
- **Sosial & Ibadah** (zis di 40/30/20/10): Zakat · Infak & sedekah · Kondangan & hadiah · Qurban
  (arisan BUKAN kategori belanja/pemasukan — setoran & giliran = transfer ke/dari dompet arisan, §5.17)
- **Hiburan & Gaya hidup** (keinginan): Langganan digital · Nongkrong · Liburan & mudik · Hobi & game · Perawatan diri · Rokok
- **Keuangan** (kebutuhan): Biaya admin (sistem) · Bunga & denda (cicilan di 40/30/20/10) · Pajak ·
  Cicilan tanpa rincian (cicilan di 40/30/20/10 — hanya untuk pengguna yang tidak membuat catatan utang;
  begitu utangnya dibuat, pembayaran memakai aturan §5.17)
- **Usaha** (opsional, untuk ruang usaha): Bahan baku · Operasional · Gaji karyawan

Masuk: Gaji · THR & bonus · Gaji ke-13 · Usaha & freelance · Hasil investasi (dividen/bunga/kupon) ·
Sewa diterima · Hadiah & angpao · Cashback & promo · Pengembalian (refund) · Lainnya.

Sistem: Transfer · Penyesuaian saldo · Selisih kurs · Belum dikategorikan.

Setiap kategori bawaan membawa `kata_kunci` untuk parser (§5.3.4) dan ikon Lucide + warna rona.

### 4.9 Institusi bawaan (untuk logo & alias parser)

Bank: BCA, Mandiri, BRI, BNI, BSI, BTN, CIMB Niaga, Permata, Danamon, OCBC, Maybank, Panin, Mega,
Jago, Jenius (SMBC), SeaBank, blu (BCA Digital), Allo, Superbank, Krom, Neo, Line Bank, Bank Saqu.
E-wallet: GoPay, OVO, DANA, ShopeePay, LinkAja, iSaku, Sakuku. Paylater: Kredivo, Akulaku, SPayLater,
GoPayLater, Atome, Indodana. Investasi: Bibit, Ajaib, Stockbit, Pluang, IPOT, Mirae (NHKSI), Bareksa,
Indodax, Pintu, Tokocrypto, Pegadaian (tabungan emas), Treasury, Tanamduit.
Logo = aset milik sendiri (SVG/PNG dari laman resmi, tidak dimodifikasi, dipakai sebagai penanda —
pola `public/images/connectors/` AgentBuff), dengan jatuh ke huruf berwarna bila tidak ada.

---

## 5. Rumus & algoritma (semua murni, di `src/lib/uang/*`)

### 5.1 Uang & presisi

- Semua uang = **integer satuan terkecil** mata uangnya (ISO 4217; **IDR eksponen 2**, jadi
  Rp25.000 disimpan `2500000`). Alasan: e-statement bank memuat ",00"; konsisten untuk multi-mata uang.
- TypeScript: `number` aman untuk nilai ≤ 9×10¹⁵ satuan (= Rp90 triliun) — cukup untuk keuangan
  pribadi. Kuantitas & harga investasi → `Decimal` (string di JSON).
- **Kurs**: `kurs` = nilai 1 unit mata uang transaksi dalam mata uang dasar ruang;
  `jumlah_dasar_minor = round_half_up(jumlah_minor × kurs × 10^(eksponen_dasar − eksponen_transaksi))`
  (mata uang ber-eksponen 0 seperti JPY ikut tabel `mata_uang`).
  - **Arus** (laporan belanja/pemasukan, anggaran, arus kas) memakai `jumlah_dasar_minor` = kurs
    **tanggal transaksi**; laporan arus tidak pernah menghitung ulang kurs lampau.
  - **Posisi** (saldo dompet valas dalam mata uang dasar, kekayaan bersih, Aman dibelanjakan) memakai
    **kurs terbaru** (revaluasi harian); snapshot harian menyimpan hasilnya sehingga riwayat tetap.
  - **Transfer lintas mata uang**: tiap kaki menyimpan jumlah & mata uangnya sendiri; selisih
    `jumlah_dasar` kedua kaki dicatat sebagai baris kategori sistem **Selisih kurs** (laba/rugi kurs,
    dikecualikan dari laporan belanja/pemasukan).
  - Dompet valas bawaan `ikut_anggaran = false` (bisa diubah).
  - **Ganti mata uang dasar ruang** (Pengaturan): pekerjaan latar menghitung ulang `jumlah_dasar_minor`
    semua transaksi memakai kurs historis tanggal masing-masing (kurs hilang → kurs terdekat, baris
    ditandai); pratinjau jumlah baris & peringatan sebelum jalan; anggaran periode berjalan ikut
    dikonversi kurs hari ini, periode lampau tidak.
- Pembulatan: *half-up* ke satuan terkecil, hanya di batas penyimpanan/tampilan; hitungan antara
  memakai Decimal. **Jumlahkan dulu, baru bulatkan untuk tampilan**: IDR disimpan dengan sen tetapi
  ditampilkan tanpa sen, jadi total = pembulatan dari Σ nilai tersimpan (bukan Σ nilai yang sudah
  dibulatkan).
- Jumlah IDR dari MCP/API wajib bilangan bulat rupiah (galat validasi bila ada desimal); mata uang
  lain mengikuti eksponennya.
- Invarian (uji properti): Σ kaki transfer = 0 (mata uang sama); Σ anak split = induk;
  saldo dompet = saldo awal + Σ transaksi non-hapus bertanggal ≥ `tanggal_saldo_awal` (§5.4).

### 5.2 Periode anggaran

```
periodeUntuk(tanggal, ruang) -> [mulai, akhir]
  bila jenis_periode = 'kalender': [awal bulan, akhir bulan]
  bila 'mingguan'/'dua_mingguan': dari awal_minggu
  bila 'gajian':
     -- tanggal gajian SESUDAH digeser bisa pindah bulan (1 Nov Minggu → 30 Okt), jadi jangan
     -- menganggap "gajian bulan m ada di bulan m". Kumpulkan kandidat 5 bulan di sekitarnya:
     K = { tanggalGajian(bulan(tanggal) + d) : d ∈ −2..+2 }        -- terurut, unik
     mulai = maks{ g ∈ K : g ≤ tanggal }
     akhir = min{ g ∈ K : g > tanggal } − 1 hari
tanggalGajian(th, bl):
  dasar = aturan 'akhir_bulan' ? hari terakhir bulan
        : aturan 'hari_kerja_terakhir' ? hari kerja terakhir bulan
        : min(hari_gajian, hari terakhir bulan)          -- 31 di Februari → 28/29
  geser 'tetap':             dasar
  geser 'mundur_hari_kerja': selama dasar Sabtu/Minggu/libur → dasar − 1 hari
  geser 'maju_hari_kerja':   selama dasar Sabtu/Minggu/libur → dasar + 1 hari (boleh masuk bulan berikut)
'tidak_tetap' -> perlakukan sebagai 'kalender' (pengguna memakai amplop "hidup dari bulan lalu")
```
⚠ Nama teknis = arah TANGGAL; naskah UI = bahasa sehari-hari yang berlawanan kata:
`mundur_hari_kerja` (tanggal mundur ke hari kerja sebelumnya) ditulis di UI **"dimajukan ke hari kerja
sebelumnya"**; `maju_hari_kerja` ditulis **"diundur ke hari kerja berikutnya"**. Jangan menyamakan kata
"maju" di UI dengan `maju_hari_kerja`.

Uji properti wajib: untuk setiap tanggal dalam 10 tahun × setiap kombinasi setelan, **tepat satu**
periode memuat tanggal itu (tanpa celah, tanpa tumpang tindih) dan `mulai ≤ tanggal ≤ akhir`.

**Contoh emas** (setiap contoh menyebut `geser`; bawaan = `mundur_hari_kerja`. Hari: 25 Sep 2026 Jumat ·
28 Sep Senin · 1 Okt Kamis · 25 Okt Minggu · 1 Nov Minggu · 1 Des Selasa · 28 Feb 2027 Minggu ·
29 Feb 2028 Selasa):
- hari_gajian 25, `tetap`: periode yang memuat 8 Okt 2026 = **25 Sep – 24 Okt 2026**.
- hari_gajian 25, `mundur_hari_kerja`: 25 Okt (Minggu) → **23 Okt (Jumat)**; periode yang memuat 8 Okt =
  **25 Sep – 22 Okt 2026**, berikutnya mulai 23 Okt.
- hari_gajian 1, `mundur_hari_kerja` (umum untuk ASN & pensiunan): 1 Nov 2026 (Minggu) → **30 Okt**;
  periode yang memuat 29 Okt = **1 Okt – 29 Okt**; yang memuat 30 Okt = **30 Okt – 30 Nov 2026**
  (1 Des Selasa tidak bergeser). Kasus ini yang dulu berlubang — wajib jadi fixture.
- hari_gajian 31: `tetap` → gajian **28 Feb 2027** dan **29 Feb 2028**; `mundur_hari_kerja` →
  **26 Feb 2027** (28 Feb Minggu) dan **29 Feb 2028** (Selasa, tidak bergeser).
- Libur nasional dari tabel `hari_libur` (diisi operator per tahun, termasuk cuti bersama).

#### 5.2.1 Mengganti setelan periode
Setelan periode (jenis, hari gajian, aturan, geser) disimpan sebagai riwayat (`riwayat_periode`),
bukan ditimpa:
- Perubahan **berlaku mulai B** = awal periode berikutnya menurut setelan lama (periode berjalan tidak
  berubah; pengguna diberi tahu tanggal B sebelum menyimpan).
- Untuk tanggal ≥ B dipakai setelan baru, dengan batas bawah B: periode peralihan = [B, gajian baru
  pertama sesudah B − 1 hari]; bila panjangnya < 7 hari, digabung ke periode sesudahnya.
- Anggaran periode peralihan disalin dari periode sebelumnya (pengguna bisa mengubah); rollover dan
  saldo amplop berlanjut menurut **urutan `periode_mulai`**, bukan aritmetika tanggal — tidak ada
  anggaran atau saldo amplop yang yatim.

### 5.3 Parser bahasa alami (Catat Cepat & `quick_record`)

Deterministik, tanpa LLM, dipakai di klien (pratinjau) dan server (kebenaran). Keluaran per item:
`{ jenis, jumlah, mata_uang, dompet?, ke_dompet?, kategori?, penerima?, tanggal, waktu?, tag[], orang?,
niat: 'transaksi'|'transfer'|'utang'|'piutang'|'split', kepercayaan: {jumlah, kategori, dompet},
tak_dikenal: string[] }`.

#### 5.3.1 Pemecahan item
Pisah pada `,` `;` baris baru ` dan ` ` + ` bila kedua sisi punya jumlah. Dompet/tanggal yang disebut
di **akhir kalimat** berlaku ke semua item yang tak menyebut sendiri ("bensin 50rb, parkir 5rb cash").

#### 5.3.2 Jumlah
| Bentuk | Nilai |
|---|---|
| `25rb` `25 rb` `25ribu` `25k` `25K` | 25.000 |
| `25.000` `25,000`* `Rp25.000` `Rp 25.000` `rp25000` `IDR 25000` | 25.000 |
| `25,5rb` `25.5rb` | 25.500 |
| `1,5jt` `1.5jt` `1,5 juta` `1.5m`† | 1.500.000 |
| `1jt 250rb` `1 juta 250 ribu` | 1.250.000 |
| `2M` `2 miliar` | 2.000.000.000 (M = **miliar**) |
| `setengah juta` `sejuta` `seratus ribu` `lima puluh ribu` (terbilang dasar) | 500.000 / 1.000.000 / 100.000 / 50.000 |
| `seceng` `goceng` `ceban` `goban` `gopek` | 1.000 / 5.000 / 10.000 / 50.000 / 500 — **kepercayaan rendah → konfirmasi** |
| `US$12` `12 usd` `$12` `SGD 20` `€9,99` | mata uang asing |

\* `25,000` (koma sebagai pemisah ribuan, gaya Inggris) diterima bila tepat 3 digit sesudah koma **dan
angka itu TANPA akhiran**. Angka berakhiran (`rb`, `ribu`, `k`, `jt`, `juta`, `m`, `M`, `miliar`) selalu
membaca koma/titik sebagai **desimal**: `1,500jt` = 1.500.000 (bukan 1,5 miliar); `2.5rb` = 2.500.
† Peka huruf besar-kecil: `M` besar = miliar; `m` kecil = juta HANYA bila menempel pada angka desimal
(`1.5m`) dan tidak ambigu; `m` kecil pada bilangan bulat (`2m`) → konfirmasi. Jumlah ≥ Rp1 miliar
selalu dikonfirmasi.
Tanpa jumlah → `needs_clarification: 'jumlah'`. Dua jumlah untuk satu item → konfirmasi.

#### 5.3.3 Jenis & niat
- **Masuk**: gaji, gajian, terima, dapat, masuk, transfer masuk, dikasih, jual, cashback, refund,
  pengembalian, THR, bonus, dividen, bunga, angpao.
- **Transfer**: `top up X dari Y`, `topup`, `tf ke X`, `pindah ke X`, `isi saldo X`, `tarik tunai`
  (bank → tunai), `setor tunai` (tunai → bank); `admin 2500` / `biaya 2,5rb` → biaya admin.
- **Utang**: `pinjam ke Budi`, `ngutang ke Budi`, `dipinjami Budi` → saya berutang;
  `Budi pinjam`, `minjemin Budi`, `talangin Budi` → piutang; `bayar utang ke Budi` → pembayaran utang.
  Niat utang **selalu** dikembalikan sebagai usulan konfirmasi (agen bertanya ke pengguna dulu).
- **Split**: `bagi 2`, `patungan 3 orang`, `split sama Rina` → bagian tiap orang lain =
  ⌊total/n⌋ dibulatkan ke bawah ke Rp1; **bagianku = total − Σ bagian orang lain** (sisa pembulatan
  selalu ke pengguna sendiri, jadi Σ selalu = total); bagian orang lain = piutang (konfirmasi).
  Contoh: 100.000 bertiga → orang lain 33.333 × 2, aku **33.334**.
- **Refund**: `refund`/`pengembalian`/`dikembalikan` → masuk; `refund_dari_id` diisi hanya bila tepat
  SATU pengeluaran cocok (penerima sama/mirip, ≤ 60 hari ke belakang, jumlah ≥ refund, belum pernah
  di-refund penuh); nol atau > 1 kandidat → tanpa tautan, kategori asal = kategori penerima itu (bila
  diketahui) atau "Pengembalian (refund)", status **perlu ditinjau** dengan daftar kandidat.
- Bawaan: keluar.

#### 5.3.4 Dompet, kategori, tanggal, tag
- **Dompet**: cocokkan token dengan `dompet.alias` + nama + alias institusi (`gopay|gpay`,
  `spay|shopeepay`, `cc|kartu kredit|kk`, `cash|tunai|kes`); bila ruang punya 2 dompet BCA → konfirmasi.
  Tanpa dompet → dompet terakhir untuk kategori itu → dompet bawaan ruang; kepercayaan dompet = rendah.
- **Kategori** berurutan: aturan pengguna → memori penerima → `kata_kunci` kategori (kamus bawaan:
  kopi/ngopi/kopken→Kopi & jajan; makan/nasi/bakso/mie/warteg/padang/sarapan→Makan di luar;
  gofood/grabfood/shopeefood→Pesan antar; grab/gojek/gocar/goride/maxim/ojol→Ojol;
  bensin/pertalite/pertamax/bbm/solar→Bensin; parkir; tol/etoll; krl/mrt/busway/transjakarta;
  pulsa/kuota/paket data→Pulsa & data; token/listrik/pln; pdam/air; indihome/wifi/internet/biznet/firstmedia;
  netflix/spotify/youtube premium/disney/vidio/icloud/google one/chatgpt→Langganan digital;
  indomaret/alfamart/superindo/hypermart→Kebutuhan rumah tangga; shopee/tokopedia/tiktok shop/lazada→Belanja online;
  apotek/obat/dokter/klinik/rs→Dokter & obat; kos/sewa/kontrakan; spp/sekolah/les/kursus;
  ortu/orang tua/mamah/bapak/ibu→Kiriman orang tua; zakat; sedekah/infaq/infak/jumat berkah;
  kondangan/nikahan/kado; arisan; rokok; bpjs) → pola waktu (05–10 sarapan/kopi, 11–14 makan siang) →
  paling sering 30 hari. Kepercayaan < 0,7 → `perlu_ditinjau`.
- **Tanggal & waktu**: "sekarang" = `ditangkap_pada` (waktu diketik, §16) di zona ruang — BUKAN waktu
  sinkron. Hari ini (bawaan) · kemarin · kemarin lusa · tadi pagi/siang/sore/malam (waktu 07/12/16/20) ·
  kata makan berwaktu tanpa "tadi": sarapan (07:00), makan siang (12:00), makan malam (19:00) ·
  nama hari (terdekat ke belakang, tidak pernah masa depan) · `tgl 3`/`tanggal 3` (terdekat ke belakang) ·
  `3/9`, `3-9-2026`, `3 sep`. Tanggal masa depan hanya dengan kata "besok/nanti/jadwalkan" → tawarkan
  sebagai tagihan/berulang, bukan transaksi.
- **Tag**: `#kata`. **Orang**: `sama X`, `@X`.
- **Penerima**: sisa token bermakna setelah jumlah/dompet/tanggal/tag diambil ("indomaret", "grab").

#### 5.3.5 Keluaran ke pengguna
Bagian yang dikenali digarisbawahi di UI; `tak_dikenal` ditampilkan tipis; tidak pernah menyimpan
item dengan kepercayaan jumlah rendah tanpa konfirmasi.

#### 5.3.6 Korpus uji (jadikan fixture, target ≥ 95% benar, 100% untuk jumlah)

Tabel di bawah = **35 kalimat inti** (jawaban pasti). Pembangun menambah sampai **≥ 50 kalimat**
(syarat PRD M5 & gerbang rilis) dengan pola yang sama, lalu 200 kalimat tambahan di CI (§14).

| Masukan | Hasil yang diharapkan |
|---|---|
| `kopi 25rb` | keluar 25.000 · Kopi & jajan · dompet bawaan (kepercayaan dompet rendah) |
| `makan siang 35rb pakai gopay` | keluar 35.000 · Makan di luar · GoPay · waktu 12:00 |
| `bensin 50rb, parkir 5rb cash` | 2 item: 50.000 Bensin Tunai; 5.000 Parkir Tunai |
| `gajian 8,5jt bca` | masuk 8.500.000 · Gaji · BCA |
| `top up gopay 100rb dari bca` | transfer BCA → GoPay 100.000 |
| `tf ke mandiri 1jt dari bca admin 2500` | transfer 1.000.000 + biaya admin 2.500 (BCA) |
| `grab 23.500 kemarin` | keluar 23.500 · Ojol · kemarin |
| `token listrik 200rb` | keluar 200.000 · Listrik/Token PLN |
| `netflix 186rb kartu kredit` | keluar 186.000 · Langganan digital · Kartu kredit |
| `belanja indomaret 87.650 #bulanan` | keluar 87.650 · Kebutuhan rumah tangga · tag bulanan |
| `1jt 250rb sewa kos` | keluar 1.250.000 · Sewa/kos |
| `pinjem ke budi 200rb` | niat utang (saya berutang ke Budi) 200.000 → konfirmasi |
| `budi pinjam 300rb` | niat piutang (Budi) 300.000 → konfirmasi |
| `refund shopee 150rb` | masuk 150.000 · refund · bila tepat satu belanja Shopee ≥ 150.000 dalam 60 hari → tertaut & mengurangi Belanja online; selain itu perlu ditinjau + kandidat |
| `kirim ortu 2jt` | keluar 2.000.000 · Kiriman orang tua |
| `sedekah jumat 50rb` | keluar 50.000 · Infak & sedekah |
| `goceng parkir` | keluar 5.000 · Parkir · **konfirmasi jumlah** |
| `Rp 45.000 obat` | keluar 45.000 · Dokter & obat |
| `tgl 3 bayar internet 400rb` | keluar 400.000 · Internet & TV · tanggal 3 terdekat ke belakang |
| `kopi` | needs_clarification: jumlah |
| `25rb` | keluar 25.000 · kategori belum (perlu ditinjau) |
| `dapat THR 8jt` | masuk 8.000.000 · THR & bonus |
| `cashback ovo 12rb` | masuk 12.000 · Cashback · OVO |
| `15k ojol` | keluar 15.000 · Ojol |
| `US$12 icloud` | keluar 12 USD (kurs hari ini) · Langganan digital |
| `makan 90rb bagi 3 sama rina dan dodi` | niat split: keluar 90.000, bagianku 30.000, piutang Rina 30.000 & Dodi 30.000 → konfirmasi |
| `tadi pagi sarapan 18rb` | keluar 18.000 · Makan di luar · hari ini 07:00 |
| `setengah juta kado nikahan` | keluar 500.000 · Kondangan & hadiah |
| `tarik tunai 500rb bni` | transfer BNI → Tunai 500.000 |
| `jual hp bekas 1,2jt` | masuk 1.200.000 · Lainnya |
| `besok bayar kos 1,5jt` | tawarkan tagihan terjadwal (bukan transaksi) |
| `2M dp rumah` | 2.000.000.000 → konfirmasi (≥ Rp1 miliar); disarankan sebagai transfer ke dompet aset "Rumah", bukan belanja (§5.17) |
| `1,500jt tv` | keluar 1.500.000 · Elektronik & gadget (koma = desimal karena berakhiran) |
| `patungan 100rb bertiga sama rina dan dodi` | niat split: bagianku 33.334, piutang Rina 33.333 & Dodi 33.333 → konfirmasi |
| `makan malam 60rb` | keluar 60.000 · Makan di luar · hari ini 19:00 |

Aturan tambahan: jumlah > 20× median transaksi 90 hari → minta konfirmasi (salah ketik "250000rb").

### 5.4 Saldo & rekonsiliasi

- `saldo(dompet) = saldo_awal_minor + Σ jumlah_minor (dihapus_pada is null AND tanggal ≥ tanggal_saldo_awal)`.
  `saldo_awal_minor` adalah saldo **pada awal hari `tanggal_saldo_awal`** (sebelum transaksi hari itu).
- **Transaksi bertanggal sebelum `tanggal_saldo_awal`** (paling sering: pengguna mengisi "saldo sekarang"
  saat orientasi lalu mengimpor mutasi 3 bulan lalu). Tanpa aturan ini setiap baris impor terhitung dua
  kali. Saat impor/pencatatan menyentuh tanggal itu, tampilkan pilihan (bawaan pertama):
  1. **"Saldo sekarang sudah benar — hitung mundur saldo awal"** (bawaan): `tanggal_saldo_awal` =
     tanggal transaksi paling awal; `saldo_awal_minor` = saldo_awal lama − Σ transaksi baru yang
     jatuh di [tanggal baru, tanggal lama). Saldo hari ini **tidak berubah**; laporan lampau lengkap.
  2. "Catat sebagai riwayat saja": transaksi masuk laporan tetapi tidak menggeser saldo (karena
     tanggalnya < `tanggal_saldo_awal`), ditandai "sebelum saldo awal".
  Contoh emas: saldo awal 5.000.000 per 1 Sep; impor mutasi 1–31 Agu berisi gaji +8.000.000 dan
  belanja total −6.500.000 → pilihan 1: `tanggal_saldo_awal` = 1 Agu, `saldo_awal` =
  5.000.000 − (8.000.000 − 6.500.000) = **3.500.000**; saldo 1 Sep tetap **5.000.000**, saldo hari ini
  tidak berubah. Bila hasil hitung mundur negatif pada dompet tunai/bank/e-wallet, tampilkan
  peringatan "mutasi mungkin tidak lengkap — periksa lagi" (tetap boleh disimpan).
- `saldo_cache_minor` diperbarui dalam **transaksi DB yang sama** dengan perubahan transaksi
  (`UPDATE dompet SET saldo_cache_minor = saldo_cache_minor + Δ`), dengan `SELECT … FOR UPDATE` dompet.
- Pekerjaan malam menghitung ulang semua saldo; selisih ≠ 0 → perbaiki + catat `jejak_audit` + notifikasi operator
  (angka harus 0 di semua bukti).
- **Cocokkan saldo**: Δ = saldo_bank − saldo_aplikasi; bila Δ ≠ 0 → transaksi `penyesuaian` jumlah Δ, kategori
  sistem Penyesuaian saldo, `tercocok_pada = now()`. Penyesuaian dikecualikan dari laporan belanja/pemasukan.
- Kartu kredit: saldo negatif = utang berjalan. `tagihan_berjalan` = Σ transaksi sejak cetak terakhir;
  `jatuh_tempo` = tgl_jatuh_tempo setelah cetak; `min_bayar = max(min_bayar_bps × tagihan, batas minimum operator)`.

### 5.5 Mesin aturan & kategorisasi

- Tahap: `pra` (normalisasi penerima: hapus awalan prosesor/bank seperti `TRSF E-BANKING DB`, `QRIS`,
  nomor referensi, kode kota) → `normal` → `pasca`. Dalam satu tahap: urut **spesifisitas** (`is` >
  `one_of` > `contains` > `regex`) lalu `prioritas`; `hentikan` menghentikan aturan berikutnya di tahap itu.
- Kondisi (`kondisi` jsonb): `{semua:[…]}`/`{salah_satu:[…]}` dari `{bidang, op, nilai}`;
  bidang: `penerima`, `penerima_mentah`, `catatan`, `jumlah`, `dompet`, `jenis`, `tanggal.hari`, `mata_uang`;
  op: `is`, `is_not`, `contains`, `not_contains`, `one_of`, `matches` (regex, dibatasi 200 karakter,
  timeout), `gt`, `lt`, `between`. Tanpa peka huruf.
- Aksi: `set_kategori`, `set_penerima`, `tambah_tag`, `set_catatan`, `split` (persen/nominal),
  `tandai_ditinjau`, `tandai_berulang`, `lewati_perlu_ditinjau`.
- Urutan kategorisasi akhir: aturan → memori penerima (kategori terbanyak 90 hari, kepercayaan =
  porsi) → kata kunci → pola waktu → paling sering. Kepercayaan < 0,7 → `perlu_ditinjau`.
- **Belajar**: 2 koreksi pada penerima sama ke kategori sama → tawarkan aturan (sekali; tolakan diingat).
- **Terapkan ke riwayat**: pekerjaan latar; pratinjau jumlah terdampak; simpan `sebelum` untuk urungkan.

### 5.6 Aman dibelanjakan & laju

```
P = periode berjalan [mulai, akhir]; H = hari tersisa termasuk hari ini = akhir − hariIni + 1
Fleksibel = kategori keluar yang BUKAN tagihan/berulang, BUKAN tabungan/cicilan/bunga, BUKAN transfer.
Sisa_k = Anggaran_k + Rollover_k − Terpakai_k            -- BOLEH negatif (lewat)

A. Bila anggaran aktif — per metode (lewat di satu kategori MENGURANGI yang lain; tidak ada max(0,…) per kategori):
   Sederhana:   Aman_A = Σ_{k∈Fleksibel beranggaran} Sisa_k − Σ_{k∈Fleksibel TANPA anggaran} Terpakai_k
   50/30/20:    Batas_g = persen_g × PenghasilanNeto(p)   (§5.7.2; aktual + pemasukan terjadwal yang belum masuk)
                Aman_A = (Batas_kebutuhan − TagihanKebutuhan_p(dibayar + terjadwal) − TerpakaiFleksibel_kebutuhan)
                       + (Batas_keinginan − Terpakai_keinginan)
   40/30/20/10: Aman_A = Batas_hidup − TagihanHidup_p(dibayar + terjadwal) − TerpakaiFleksibel_hidup
   Amplop:      Aman_A = Σ_{k∈Fleksibel} Tersedia(k,p)      -- negatif ikut; Siap dialokasikan TIDAK ikut
                (ditampilkan sebagai petunjuk "Rp… belum ditugaskan")
B. Tanpa anggaran:
   Aman_B = PemasukanPeriode(aktual + berulang pemasukan terjadwal yang belum masuk)
          − TagihanPeriode(sudah dibayar + terjadwal belum dibayar)
          − RencanaSisihPeriode(setoran target + investasi rutin terjadwal)
          − PengeluaranFleksibelPeriode − Penyangga
   Penyangga = setelan (bawaan 0)
C. Batas kas (selalu):
   KasLikuid = Σ saldo dompet ikut_anggaran berjenis tunai/bank/ewallet (valas: kurs terbaru; tanpa kartu kredit/paylater)
             − Σ alokasi kantong virtual aktif dari dompet-dompet itu      -- uang yang sudah disisihkan bukan uang belanja
   Wajib = Σ tagihan + cicilan + setoran target terjadwal dari hariIni s/d akhir (belum dibayar)
   Batas = KasLikuid − Wajib − Penyangga
Aman = min(A atau B, Batas)            -- boleh negatif → tampil "Lewat Rp…" (merah + kalimat)
Harian = ⌊ max(0, Aman) / H ⌋ dibulatkan KE BAWAH ke Rp100
```
Rumah tangga: angka rumah tangga dihitung **hanya dari dompet & anggaran bersama** (sama untuk semua
anggota, tidak membocorkan dompet pribadi — §12.3); tiap orang boleh melihat tambahan "Aman pribadi"
dari dompet pribadinya sendiri.

**Contoh emas** (geser `tetap`: periode 25 Sep–24 Okt, hari ini 8 Okt → H = 17; metode Sederhana):
1. Makan 2.000.000 (terpakai 1.100.000), Transport 800.000 (300.000), Hiburan 500.000 (450.000) →
   A = 900.000 + 500.000 + 50.000 = **1.450.000**. KasLikuid 3.200.000 (tanpa kantong virtual), Wajib
   1.200.000 (internet 400.000 + cicilan 800.000) + setoran target 500.000 → Batas = **1.500.000**.
   Aman = min = **Rp1.450.000**; Harian = ⌊1.450.000/17⌋ = 85.294 → **Rp85.200**.
2. Sama, tetapi Hiburan terpakai 650.000 (lewat 150.000) → A = 900.000 + 500.000 − 150.000 =
   **1.250.000**; Harian **Rp73.500**.
3. Sama dengan (1), plus kategori fleksibel "Hobi" tanpa anggaran terpakai 100.000 → A = **1.350.000**.
4. Sama dengan (1), plus Rp300.000 di dompet BCA disisihkan ke kantong virtual "Liburan" →
   KasLikuid 2.900.000 → Batas = **1.200.000** → Aman = **Rp1.200.000**; Harian **Rp70.500**.
Angka contoh di layar lain (DESAIN §9.3, MCP §9.5) wajib memenuhi Harian = ⌊Aman/H⌋ ke Rp100.

**Laju (per kategori & total fleksibel):**
```
d = hari ke- dalam periode (1..D); D = panjang periode
ideal(d) = Anggaran × d / D
proyeksi = Terpakai + (Terpakai / d) × (D − d) + BerulangBelumDibayar_k
status: Terpakai > Anggaran → 'lewat' ; proyeksi > Anggaran → 'diproyeksikan_lewat' ; selain itu 'aman'
```
Rata-rata harian untuk proyeksi memakai median harian 7 hari terakhir bila d ≥ 7 (tahan lonjakan).

### 5.7 Anggaran

#### 5.7.1 Sederhana
Anggaran per kategori per periode; rollover opsional: `Rollover_k(p) = max(0, Anggaran_k(p−1) + Rollover_k(p−1) − Terpakai_k(p−1))`
(kategori `tahunan` selalu rollover; sisa negatif tidak digulirkan kecuali setelan "bawa minus").

#### 5.7.2 Persentase (50/30/20 dan 40/30/20/10)
```
PenghasilanNeto(p) = Σ pemasukan kategori Gaji/THR/Usaha/… periode p (atau perkiraan pengguna bila belum masuk)
Batas_kelompok = persen × PenghasilanNeto
Aktual_kelompok = Σ pengeluaran kategori dengan kelompok itu
  + kelompok tabungan: transfer ke dompet investasi + setoran target (alokasi kantong virtual & transfer ke dompet khusus)
  + kelompok cicilan (40/30/20/10) / tabungan (50/30/20): Σ pembayaran utang (pokok = transfer ke dompet
    liabilitas, + bunga & denda) + kategori "Cicilan tanpa rincian" (§5.17)
```
Kategori tanpa kelompok → tampil "belum dikelompokkan" (1 ketuk untuk memilih).

#### 5.7.3 Amplop (zero-based)
```
SiapDialokasikan(p) = Σ pemasukan ke dompet ikut_anggaran s/d p
                    − Σ Dialokasikan(semua kategori, s/d p)
                    − Σ minus tunai yang tidak ditutup di periode sebelumnya
Tersedia(k,p) = max(Tersedia(k,p−1),0)* + Dialokasikan(k,p) + Aktivitas(k,p)    -- aktivitas negatif untuk belanja
  * minus TUNAI periode lalu: di-nol-kan dan mengurangi SiapDialokasikan(p)
  * minus dari KARTU KREDIT: menjadi utang kartu (tidak mengurangi SiapDialokasikan)
Kartu kredit: belanja X dengan kartu dari kategori k yang Tersedia ≥ X:
  Tersedia(k) −= X ; Tersedia(BayarKartu_[kartu]) += X      -- amplop pembayaran kartu otomatis
Pindah dana: alokasi_pindah (k1 → k2) mengubah Dialokasikan kedua kategori
"Hidup dari bulan lalu": pemasukan periode p ditandai untuk periode p+1 (setelan)
```
**Contoh emas**: pemasukan 10.000.000; alokasi Makan 3.000.000, Sewa 2.500.000, Transport 1.000.000,
Dana darurat 1.500.000 → SiapDialokasikan = **2.000.000**. Belanja Makan 3.200.000 tunai → Tersedia Makan
−200.000 → periode berikut Makan mulai 0 dan SiapDialokasikan berkurang 200.000.

#### 5.7.4 Isi otomatis & templat
- Rata-rata 3 periode lengkap (bukan berjalan), dibulatkan ke Rp10.000 terdekat ke atas.
- Salin periode lalu.
- Templat per kategori: `{jenis:'tetap', jumlah}` · `{jenis:'rata', periode:3, naik_bps}` ·
  `{jenis:'persen_pemasukan', bps}` · `{jenis:'tagihan', berulang_id}` · `{jenis:'target_tahunan', jumlah, bulan_jatuh}`
  (sinking fund: `jumlah / sisa periode sampai bulan jatuh`).
- **Seimbangkan ulang**: pindahkan sisa dari kategori dengan proyeksi < 70% anggaran ke kategori
  `diproyeksikan_lewat`, proporsional kekurangan, total tetap. Selalu pratinjau.

### 5.8 Deteksi berulang & langganan

```
1. kunci_penerima = normalisasi(penerima_mentah | penerima)
2. kelompokkan pengeluaran 400 hari terakhir per (kunci_penerima, ember jumlah ±7,5%)
3. selang Δ antar tanggal berurutan; median Δ; klasifikasi:
   mingguan 7±1 · dua mingguan 14±2 · setengah bulanan 15±3 · bulanan 28–31 ±3 · 3 bulanan 91±7 · tahunan 365±10
4. syarat: ≥ 3 kejadian dan koefisien variasi Δ < 0,25 ; ATAU 2 kejadian + penerima di daftar langganan dikenal
   (netflix, spotify, youtube, disney+, vidio, apple/icloud, google one, chatgpt, canva, microsoft 365, indihome, …)
5. tanggal_berikut = terakhir + periode (geser hari kerja bila kebiasaan historis begitu);
   jumlah_perkiraan = median 3 terakhir
6. sinyal: kenaikan harga (terakhir > median × 1,05) · terlewat (hariIni > tanggal_berikut + 2) · langganan baru
7. SELALU saran (kartu), tidak pernah menambah diam-diam; "Bukan berulang" diingat per kunci
```
Pencocokan transaksi ke kejadian berulang: tanggal ±2 hari (±5 untuk tahunan), jumlah dalam toleransi.

#### 5.8.1 Jadwal berulang (aturan pasti)
- Jadwal disimpan sebagai RRULE, tetapi **tanggal yang tidak ada di bulan itu DIJEPIT ke hari terakhir**
  (bukan dilewati seperti RRULE murni): bulanan tgl 31 → 30 Apr, 28/29 Feb; tahunan 29 Feb → 28 Feb di
  tahun bukan kabisat. Implementasi: bangkitkan dengan `BYMONTHDAY` lalu jepit sendiri — uji fixture
  untuk 12 bulan × tgl 29/30/31.
- `mingguan`/`dua_mingguan` dihitung dari `jangkar` (tanggal mulai), bukan dari awal minggu.
- `geser` (`tetap` | `mundur_hari_kerja` | `maju_hari_kerja`) diterapkan sesudah penjepitan, dengan
  tabel `hari_libur` yang sama dengan §5.2.
- **Catat otomatis + jumlah perkiraan**: transaksi dibuat dengan jumlah perkiraan, `status_tinjau =
  perlu_ditinjau`, catatan "jumlah perkiraan". Bila kemudian impor/pencatatan menemukan transaksi
  sungguhan yang cocok (§5.16 langkah 4), tawarkan **ganti** jumlah perkiraan dengan jumlah sungguhan
  (bukan dua transaksi).
- Kejadian yang jatuh saat ruang **beku** tidak dicatat otomatis; saat beku terangkat, kejadian itu
  muncul sebagai "terlewat saat dibekukan" dengan tombol Tandai lunas / Lewati (tidak diposting diam-diam).

### 5.9 Target

```
Terkumpul = dompet_khusus ? Σ porsi × saldo dompet : Σ alokasi_target
Sisa = max(0, Target − Terkumpul); n = sisa periode bulanan sampai tanggal target (termasuk berjalan)
Tanpa imbal hasil:  PerBulan = Sisa / n
Dengan imbal hasil i = r_tahunan/12 (setor akhir bulan):
  PerBulan = (FV − PV·(1+i)^n) · i / ((1+i)^n − 1)
Perkiraan tercapai (setoran S tetap): cari n minimal dengan PV·(1+i)^n + S·((1+i)^n −1)/i ≥ FV
Status (hanya untuk target BERTANGGAL; toleransi 5%):
  Awal = terkumpul_awal_minor (terkumpul saat target dibuat)
  harapan = Awal + (Target − Awal) × (hari berjalan sejak dibuat / total hari sampai tanggal target)
  Terkumpul ≥ Target → 'tercapai'; ≥ harapan×1,05 → 'lebih_cepat'; ≥ harapan×0,95 → 'sesuai_jalur';
  ≥ harapan×0,75 → 'berisiko'; selain itu 'tertinggal'
Target TANPA tanggal: tanpa status jalur — tampil persen + "dengan setoran rata-rata 3 bulan terakhir,
  perkiraan tercapai <bulan tahun>" (atau "belum ada setoran").
Dana darurat: Target = kelipatan × pengeluaran pokok bulanan (rata-rata 3 periode kategori kelompok 'kebutuhan' + tagihan + cicilan)
  kelipatan bawaan: lajang 3 · menikah tanpa anak 6 · 1 anak 9 · ≥2 anak 12 ;
  penghasilan tidak tetap (pekerja lepas/usaha): +3 dari kelipatan status, maksimum 12
```
**Contoh emas**: target 50.000.000, terkumpul 10.000.000, 24 bulan, tanpa imbal hasil → **Rp1.666.667/bulan**;
dengan 4%/tahun → **Rp1.570.330/bulan** (nilai pasti 1.570.330,22; toleransi ±Rp1).
Validasi kantong virtual: Σ alokasi aktif dari sebuah dompet ≤ saldo dompet itu **saat disisihkan**
(tolak dengan pesan). Bila kemudian belanja membuat saldo < Σ alokasi, alokasi TIDAK dikurangi diam-diam:
dompet diberi tanda "kantong melebihi saldo Rp…" + dua tombol (ambil dari target / tambah saldo), dan
Aman dibelanjakan sudah memperhitungkannya lewat KasLikuid (§5.6).

### 5.10 Utang

#### 5.10.1 Anuitas (efektif)
```
M = P·i / (1 − (1+i)^−n) ; i = bunga_tahunan/12
Sisa setelah k: B_k = P(1+i)^k − M·((1+i)^k − 1)/i
Bunga cicilan ke-k = B_{k−1}·i ; Pokok = M − bunga
Bulan sampai lunas dengan bayar M: n = −ln(1 − i·P/M)/ln(1+i)   (syarat M > i·P)
```
**Contoh emas**: P = 100.000.000, 12%/tahun, 12 bulan → **M = Rp8.884.879** (pasti 8.884.878,87).
Jadwal dibulatkan per bulan (bunga = pembulatan half-up dari sisa × i; pokok = M − bunga); **cicilan
terakhir menyerap selisih pembulatan** sehingga sisa tepat 0 → cicilan ke-12 = **Rp8.884.876**, total
bunga jadwal = **Rp6.618.545** (tanpa pembulatan: 6.618.546,41).

#### 5.10.2 Flat (leasing/KTA)
```
Cicilan = P/n + P·r_flat_bulanan
Bunga efektif per bulan r_eff: solusi dari P = Cicilan·(1 − (1+r)^−n)/r (Newton, tebakan awal 2·r_flat)
```
**Contoh emas**: P = 100.000.000, flat 1%/bulan, 12 bulan → cicilan **Rp9.333.333**; efektif ≈ **1,79%/bulan**
(1,7881% × 12 = **21,46%/tahun nominal**; efektif tahunan (1+r)¹² − 1 = **23,70%**) — tampilkan flat & efektif.

#### 5.10.2a Bunga berjenjang (KPR fixed → floating) & cicilan 0%
- `jadwal_bunga` = daftar tahap `{mulai_bulan, bunga_bps, basis}`. Jadwal anuitas dihitung ulang di
  awal tiap tahap dari **sisa pokok** dan **sisa tenor** (cara bank menghitung ulang cicilan saat
  floating); tahap floating yang belum diketahui memakai bunga isian pengguna berlabel "perkiraan".
- Simulasi pelunasan dipercepat menambahkan `penalti_lunas_bps × sisa pokok` bila diisi.
- **Cicilan 0%** (kartu kredit/paylater): basis `nol`, `cicilan = pokok / tenor`, `biaya_admin_minor`
  dicatat sekali sebagai pengeluaran "Bunga & denda". Pembukuannya di §5.17 (dompet liabilitas
  "Cicilan 0% — <kartu>"), sehingga tagihan kartu hanya memuat cicilan bulan berjalan.

#### 5.10.3 Harian (pinjol) & kartu kredit
```
Biaya pinjol = pokok × bunga_harian × hari ; batas OJK konsumtif 2026: 0,1%/hari ; total biaya + denda ≤ 100% pokok
Kartu kredit: bunga ≈ rata-rata saldo harian × (bunga_bulanan×12)/365 × hari siklus ; batas BI 1,75%/bulan [verifikasi]
```
**Contoh emas**: pinjol Rp1.000.000, 30 hari, 0,1%/hari → biaya maks **Rp30.000**. Kartu kredit saldo
bergulir Rp5.000.000 × 1,75% → ≈ **Rp87.500/bulan**.
Batas regulasi = `setelan_operator` (bukan konstanta kode).

#### 5.10.4 Snowball & avalanche
```
urutan: snowball = sisa terkecil dulu ; avalanche = bunga efektif tertinggi dulu ; kustom = urutan pengguna
per bulan: bunga dibebankan ke semua → bayar minimum semua → dana tambahan + minimum yang "dibebaskan"
           dari utang yang sudah lunas → utang fokus ; ulangi sampai semua 0 (maks 600 bulan)
keluaran: jadwal per utang, tanggal lunas tiap utang & terakhir, total bunga, total bayar
```
Aturan pasti (supaya hasil bisa diuji persis): per bulan, (1) bunga tiap utang terbuka =
pembulatan half-up dari sisa × bunga_tahunan/12, ditambahkan ke sisa; (2) anggaran bulanan tetap =
Σ minimum SEMUA utang awal + tambahan (minimum utang yang lunas "dibebaskan" ke fokus); (3) bayar
minimum tiap utang terbuka `min(minimum, sisa)`; (4) sisa anggaran ke utang fokus menurut urutan,
meluber ke fokus berikutnya di bulan yang sama bila fokus lunas.

Uji properti: total bunga avalanche ≤ snowball (untuk bunga efektif yang sama basisnya); tambahan bayar
lebih besar tidak pernah memperlama. **Fixture** (angka pasti hasil aturan di atas): A 8.000.000 @24%/th
min 300.000 · B 2.000.000 @12% min 100.000 · C 5.000.000 @18% min 200.000 · tambahan 500.000
(anggaran 1.100.000/bulan):

| Strategi | Urutan | Lunas per utang (bulan ke-) | Bebas utang | Total bunga | Total bayar |
|---|---|---|---|---|---|
| Snowball | B, C, A | B 4 · C 10 · A 16 | bulan 16 | **Rp2.421.714** | Rp17.421.714 |
| Avalanche | A, C, B | A 12 · C 15 · B 16 | bulan 16 | **Rp2.086.203** | Rp17.086.203 |

Avalanche menghemat **Rp335.511**. Tanpa tambahan (anggaran 600.000, snowball): bebas utang bulan 34,
total bunga Rp4.909.304.

#### 5.10.5 DSR
`DSR = Σ cicilan bulanan (utang aktif + minimum kartu + paylater) / penghasilan neto bulanan` → peringatan > 30%.
Penghasilan neto bulanan = rata-rata 3 periode lengkap (atau perkiraan dari orientasi). Penghasilan 0 /
belum ada: DSR **tidak dihitung** ("belum ada penghasilan tercatat") — syarat Level Buff tentang DSR
dianggap terpenuhi hanya bila tidak ada cicilan sama sekali.

### 5.11 Investasi

#### 5.11.1 Biaya rata-rata & realisasi
```
beli:  qty += q ; biaya += q·harga + fee
jual:  basis = q_jual × (biaya/qty) ; realisasi = (q_jual·harga − fee − pajak) − basis ; biaya −= basis ; qty −= q_jual
FIFO (opsi): kurangi lot tertua dulu
split k:1 → qty ×k, biaya tetap ; dividen saham → qty bertambah, biaya tetap
```
**Contoh emas**: beli 100 lembar @9.000 fee 13.500; beli 200 @8.500 fee 25.500 → qty 300, biaya
2.639.000, rata-rata **Rp8.796,67**. Jual 150 @9.500 fee 3.563 → basis 1.319.500, realisasi **Rp101.937**;
sisa 150 lembar, biaya 1.319.500.

#### 5.11.2 Nilai
```
Nilai = qty × harga_kini (emas: harga_buyback merek; reksa dana: NAB/UP terakhir; kripto: last IDR; valas → kurs hari ini)
Deposito: nilai = pokok + pokok × bunga × hari/365 × (1 − pajak) ; pajak final 20%, KECUALI jumlah
          seluruh deposito + tabungan + giro nasabah **di bank yang sama** ≤ Rp7.500.000 (agregat per bank,
          bukan per bilyet) → 0%. BYM menjumlahkan dompet ber-institusi sama; bila ragu, pakai 20% + catatan.
SBN: nilai = pokok (harga pasar opsional) ; kupon bulanan × (1 − 10%)
Tidak ada harga ≤ 7 hari (saham/RD) atau ≤ 30 hari (manual) → lencana basi, nilai tetap memakai harga terakhir
```
**Contoh emas**: deposito Rp10.000.000, 5%/tahun, 30 hari → bunga bruto 41.096, pajak 8.219, neto **Rp32.877**.
Emas 10 g Antam, buyback Rp2.422.000/g → **Rp24.220.000**.

#### 5.11.3 Kinerja
```
Sederhana = (Nilai_akhir − Nilai_awal − SetoranBersih + Pendapatan) / Nilai_awal
            (Nilai_awal = 0, mis. periode yang dimulai dari nol → tidak ditampilkan; pakai XIRR)
XIRR: cari r dengan Σ CF_k / (1+r)^((d_k − d_0)/365) = 0   (setoran negatif, penarikan & nilai akhir positif)
      Newton-Raphson dari 0,1, jatuh ke biseksi [−0,99; 10] bila tidak konvergen; toleransi 1e−7
TWR:  pecah di setiap arus kas eksternal: r_j = (V_akhir_j − V_awal_j − CF_j) / (V_awal_j + CF_j) (arus di awal sub-periode)
      TWR = Π(1+r_j) − 1 ; tahunan = (1+TWR)^(365/hari) − 1 (hanya bila ≥ 365 hari; selain itu tampil periode)
CAGR = (V_akhir/V_awal)^(1/tahun) − 1
Yield on cost = dividen 12 bulan / biaya ; Dividend yield = dividen 12 bulan / nilai
Drift_i = bobot_i − target_i ; penanda bila |drift| > min(5%, 25%·target_i)
Selisih terhadap target alokasi MILIK PENGGUNA: selisih_i = target_i·(Total + dana_baru) − nilai_i
  ditampilkan sebagai angka netral ("Emas: kurang Rp1,2 jt dari target alokasimu") — TANPA kata kerja
  perintah (beli/setor/jual), tanpa nama produk. Bila pengguna tidak mengisi target alokasi, fitur ini
  tidak tampil. (Termasuk dalam tinjauan hukum K5.)
```
**Contoh emas** (arus sama untuk keduanya): 1 Jan 2025 setor 10.000.000; 1 Jul 2025 nilai sebelum setor
10.600.000 lalu setor 5.000.000; 1 Jan 2026 nilai 16.500.000 →
**XIRR ≈ 12,05%** · **TWR = 1,06 × (16,5/15,6) − 1 = 12,12%** (toleransi 0,01%).

### 5.12 Merdeka finansial

```
PengeluaranTahunan = profil.pengeluaran_tahunan ?? Σ pengeluaran 12 bulan lengkap terakhir (tanpa transfer/penyesuaian/pokok utang)
AngkaMerdeka = max(0, PengeluaranTahunan − PenghasilanPasif) / SWR
AsetInvestasi = Σ nilai kelas investasi + kas di atas target dana darurat (opsi) — properti tempat tinggal TIDAK dihitung
Progres = AsetInvestasi / AngkaMerdeka
Hemat/Lega/Mewah: PengeluaranTahunan pokok (kelompok kebutuhan) / aktual / × faktor pengguna
Coast(hari ini) = AngkaMerdeka / (1 + r_riil)^(usia_pensiun − usia) ; tercapai bila AsetInvestasi ≥ Coast
Tahun menuju merdeka (setor S/tahun, awal P, riil r, target T):
   n = ln((T·r + S)/(P·r + S)) / ln(1+r)          (r ≠ 0) ; r = 0 → n = (T − P)/S
Dari nol dengan rasio menabung s dan w = SWR:  n = ln(1 + (r/w)·(1−s)/s) / ln(1+r)
RasioMenabung = (PemasukanNeto − Pengeluaran) / PemasukanNeto   (setelan: pokok utang dihitung tabungan)
```
**Contoh emas**:
- Pengeluaran 120.000.000/tahun, SWR 4% → **AngkaMerdeka Rp3.000.000.000**; dengan penghasilan pasif
  12.000.000/tahun → **Rp2.700.000.000**.
- Coast: 3 M, usia 30 → pensiun 55, riil 4% → 3.000.000.000 / 1,04²⁵ (= 2,665836) = 1.125.350.407 ≈
  **Rp1.125.350.000**.
- P = 100 jt, S = 60 jt/tahun, T = 3 M, r = 4% → **n = 26,37 ≈ 26,4 tahun**.
- Tabel rasio menabung (r = 5% riil, w = 4%, mulai 0) — WAJIB cocok ±0,1:

| s | 5% | 10% | 15% | 20% | 25% | 30% | 40% | 50% | 60% | 70% | 80% | 90% |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tahun | 65,8 | 51,4 | 42,8 | 36,7 | 31,9 | 28,0 | 21,6 | 16,6 | 12,4 | 8,8 | 5,6 | 2,7 |

#### 5.12.4 Monte Carlo
- 1.000 percobaan (setelan 500–5.000), horizon sampai usia 90 (atau 50 tahun).
- **PRNG pasti** (hasil klien = server): `mulberry32`, benih = 32 bit pertama sha256(`ruang_id` + tanggal
  ISO); normal baku lewat Box–Muller (pakai kedua keluaran berurutan); urutan tarikan: per percobaan →
  per tahun → per kelas menurut urutan tetap kelas di bawah. Tanpa korelasi antar kelas (asumsi tertulis).
- μ/σ di bawah = rata-rata & simpangan baku **imbal hasil riil tahunan sederhana** R. Konversi ke
  lognormal: σ_ln² = ln(1 + σ²/(1+μ)²), μ_ln = ln(1+μ) − σ_ln²/2, R = exp(μ_ln + σ_ln·Z) − 1.
- Tiap tahun: imbal hasil portofolio = Σ bobot_kelas × R_kelas; akumulasi (+ setoran tahunan) sampai usia
  pensiun, lalu tarik PengeluaranTahunan − PenghasilanPasif; berhasil bila tidak pernah < 0.
- Fixture: benih tetap + 10 percobaan kecil dengan keluaran tahunan tercatat → klien (Web Worker) dan
  server wajib identik sampai sen.
- Asumsi riil bawaan (konservatif, dapat diubah, tertulis di UI sebagai asumsi): kas & RD pasar uang
  μ 0,5% σ 1% · obligasi/SBN/RD pendapatan tetap μ 2,5% σ 5% · saham IDX/RD saham μ 5% σ 22% ·
  emas μ 1,5% σ 15% · kripto μ 0% σ 70% (bawaan diperlakukan sebagai 0 bobot pertumbuhan, bisa diubah) ·
  properti investasi μ 2% σ 10%.
- Keluaran: peluang berhasil, P10/P50/P90 kekayaan per tahun, usia merdeka P50. Jalankan di Web Worker;
  modul yang sama dipakai uji server (hasil identik untuk benih sama).

### 5.13 Zakat

```
ZakatMal:
  Harta = Σ pos zakatable dicentang (kas, tabungan, deposito, emas simpanan*, investasi nilai kini, piutang lancar)
  Bersih = Harta − utang jatuh tempo ≤ 12 bulan (setelan)
  Nisab = 85 × harga emas acuan per gram (merek & buyback/jual dipilih pengguna)
  Wajib bila Bersih ≥ Nisab dan haul terpenuhi (lihat Haul)
  Zakat = 2,5% × Bersih
  * emas perhiasan yang dipakai: dikecualikan bawaan (opsi masukkan)
Haul (1 tahun Hijriah, kalender Umm al-Qura + penimpaan operator):
  mulai_haul = tanggal snapshot harian pertama dengan Bersih ≥ Nisab (nisab harga emas hari itu)
  jatuh_haul = mulai_haul + 1 tahun Hijriah
  mode (pilihan pengguna, dijelaskan netral di UI — ada dua pendapat fikih; [verifikasi redaksi dengan
  rujukan BAZNAS sebelum rilis]):
    'awal_akhir' (bawaan): hanya dinilai di mulai & jatuh haul; turun di bawah nisab di tengah tidak memutus
    'sepanjang': bila ada snapshot dengan Bersih < Nisab, haul putus → mulai lagi saat kembali ≥ nisab
  Tanpa riwayat snapshot (pengguna baru): pengguna mengisi tanggal mulai haul sendiri (boleh Hijriah).
ZakatPenghasilan (DIJUMLAHKAN per bulan kalender, bukan per transaksi):
  dasar_bulan = Σ pemasukan kategori penghasilan bulan itu — bruto (bawaan, acuan BAZNAS) | neto (− kebutuhan pokok, opsi)
  wajib bila dasar_bulan ≥ nisab_bulanan ; zakat = 2,5% × dasar_bulan
  opsi tahunan: Σ setahun ≥ nisab_tahunan → 2,5% × Σ setahun (untuk penghasilan tak teratur)
  Catatan: nisab penghasilan BAZNAS (setara 85 g emas pada harga acuan SK BAZNAS, 2026: Rp91.681.728/tahun)
  SENGAJA berbeda dengan nisab zakat mal yang memakai harga emas terkini — jangan "diseragamkan".
ZakatFitrah = jiwa × nilai_per_jiwa (setelan: 2026 nasional Rp50.000) ; Fidyah = hari × nilai (2026 Rp65.000)
```
**Contoh emas**: harga buyback Rp2.422.000/g → nisab **Rp205.870.000**; harta 250.000.000, utang jatuh
tempo 10.000.000 → bersih 240.000.000 ≥ nisab → zakat **Rp6.000.000**. Gaji bruto 10.000.000 (nisab 2026
Rp7.640.144) → **Rp250.000**; gaji 7.000.000 → tidak wajib (tawarkan sedekah). Pekerja lepas dengan 4 bayaran
Rp3.000.000 di bulan yang sama → dasar_bulan **12.000.000** ≥ nisab → **Rp300.000** (bukan "tidak wajib"
karena tiap bayaran di bawah nisab).

### 5.14 Wawasan & proyeksi kas

Setiap wawasan = `{jenis, kunci_unik, data, tautan}`; kunci_unik mencegah ganda per periode.

| Jenis | Pemicu |
|---|---|
| `kategori_naik` | Terpakai_k(periode berjalan, dinormalisasi hari) > 1,3 × rata-rata 3 periode & selisih ≥ Rp100.000 |
| `transaksi_tak_biasa` | jumlah > 2 × median penerima (≥ 3 riwayat) atau > persentil 99 ruang |
| `langganan_baru` / `harga_naik` | §5.8 |
| `tagihan_terlewat` | kejadian `akan` lewat 2 hari |
| `saldo_minus_diproyeksikan` | proyeksi kas harian: saldo_dompet + pemasukan terjadwal − tagihan terjadwal − rata-rata belanja fleksibel harian dompet itu, s/d gajian; bila < 0 di hari X |
| `target_tertinggal` | status berisiko/tertinggal |
| `rasio_menabung` | akhir periode: nilai + perbandingan periode lalu |
| `streak` | 7/30/100 hari berturut mencatat |
| `utang_jatuh_tempo` | ≤ 3 hari |
| `deposito_di_atas_lps` | bunga deposito > TBP LPS (setelan operator) |
| `harga_basi` | kepemilikan dengan harga basi |
| `dividen_kupon` | pendapatan investasi masuk |
| `kas_menganggur` | kas likuid > target dana darurat + 3 × pengeluaran bulanan (edukatif, tanpa produk) |

Batas: maks 3 tampil di Beranda (prioritas: saldo minus > tagihan terlewat > kategori naik > lainnya).

### 5.15 Level Buff

Evaluator murni `evaluasiLevel(ruang, data) -> {level, syarat: [{level, kunci, terpenuhi, nilai, ambang}]}`
sesuai tabel PRD M15. Dijalankan malam + saat data relevan berubah (debounce 5 menit).
- **Kumulatif**: level = L tertinggi sehingga SEMUA syarat level 1..L terpenuhi (level 5 mensyaratkan
  syarat 1–4 juga).
- **Dana darurat** = target bertanda `dana_darurat` (satu per ruang). Tidak ada → syarat level 3 & 5
  "belum terpenuhi" dengan tombol **Buat target Dana Darurat** (bukan tebakan dari saldo).
- **Level 7 (Coast)** butuh `usia` & `usia_pensiun` di profil FI (ditanya di layar Merdeka Finansial,
  bukan di orientasi); kosong → syarat "Isi usia & usia pensiun" dengan tautan.
- **"Rasio menabung+investasi"** = RasioMenabung §5.12 dengan transfer ke dompet investasi, setoran
  target, dan pokok utang dihitung sebagai tabungan; periode = periode anggaran lengkap.
- **"Tidak ada tagihan/cicilan terlambat 90 hari"** = dalam 90 hari terakhir tidak ada `kejadian_berulang`
  (jenis tagihan/cicilan) yang berstatus `terlambat` lebih dari 7 hari.
- **DSR** dengan penghasilan 0: lihat §5.10.5.
- "Utang mahal" = kartu kredit dengan saldo bergulir melewati jatuh tempo, paylater, pinjol, atau utang
  dengan bunga efektif > 12%/tahun (cicilan 0% bukan utang mahal).
- Level turun bila syarat gagal 2 evaluasi berturut (hindari kedip).

### 5.16 Deduplikasi impor & pencocokan transfer

```
1. SIDIK PASTI per baris (deterministik, tidak butuh nomor referensi bank):
     deskripsi_normal = huruf kecil, spasi dirapatkan, angka referensi panjang (≥ 6 digit) dihapus
     urutan = kemunculan ke-n baris dengan (tanggal, jumlah, deskripsi_normal) yang sama DI BERKAS ITU
     sidik_impor = sha256(dompet_id | tanggal | jumlah_minor | deskripsi_normal | saldo_berjalan? | urutan)
     (saldo_berjalan ikut bila berkas memuatnya; nomor referensi bank ikut bila ada)
   sidik sudah ada di dompet itu → duplikat pasti (dilewati). Dua parkir Rp5.000 di hari yang sama =
   urutan 1 & 2 → dua sidik berbeda → keduanya masuk. Impor ulang berkas yang sama → 0 baru.
2. samar (hanya terhadap transaksi yang TIDAK berasal dari impor: manual/agen/catat cepat/berulang):
   |tanggal| ≤ 2 hari AND jumlah sama AND kemiripan penerima (trigram) ≥ 0,4 → kandidat duplikat →
   pratinjau "sepertinya sudah kamu catat" (gabung/lewati/simpan). Satu transaksi manual hanya boleh
   dipasangkan dengan SATU baris impor.
3. transfer antar dompet milik ruang: keluar di dompet A & masuk di dompet B, jumlah sama (± biaya admin ≤ Rp10.000),
   |tanggal| ≤ 2 hari → tawarkan jadikan pasangan transfer (hindari dihitung belanja+pemasukan)
4. berulang tercatat otomatis (sumber='berulang', jumlah perkiraan) yang cocok dengan baris impor →
   tawarkan GANTI dengan baris impor (jumlah sungguhan), bukan tambah.
Hash berkas (sha256) sama dengan impor sebelumnya → peringatan "berkas ini sudah pernah diimpor".
Baris bertanggal sebelum `tanggal_saldo_awal` → pilihan §5.4.
```

### 5.17 Aturan pembukuan (satu cara mencatat setiap peristiwa)

Prinsip: **belanja & pemasukan hanya untuk uang yang benar-benar habis/diperoleh**. Pinjam-meminjam,
cicilan pokok, arisan, talangan, dan pembelian aset adalah **perpindahan** antar dompet (transfer),
sehingga laporan belanja/pemasukan dan saldo tidak pernah dobel. Setiap tool & layar memakai aturan
ini; contoh emas di bawah wajib jadi fixture (saldo akhir tiap dompet + total belanja/pemasukan).

| Peristiwa | Pembukuan | Contoh emas |
|---|---|---|
| Berutang uang tunai ("pinjam ke Budi 200rb", uang diterima) | dompet liabilitas `pinjaman` "Utang Budi" (dibuat otomatis); **transfer** Utang Budi → Tunai 200.000 | Tunai +200.000; Utang Budi −200.000; belanja 0, pemasukan 0 |
| Bayar cicilan utang berbunga (M 8.884.879, bunga 1.000.000) | **transfer** BCA → dompet liabilitas sebesar **pokok** 7.884.879 + **pengeluaran** "Bunga & denda" 1.000.000 dari BCA; satu baris `pembayaran_utang` menaut keduanya | BCA −8.884.879; liabilitas +7.884.879; belanja +1.000.000 |
| Belanja pakai kartu kredit / paylater | **pengeluaran** dari dompet kartu/paylater (saldo kartu makin negatif) | kartu −500.000; belanja +500.000 |
| Bayar tagihan kartu | **transfer** bank → kartu | bank −2.000.000; kartu +2.000.000; belanja 0 |
| Bunga/denda kartu | **pengeluaran** "Bunga & denda" dari dompet kartu | |
| Cicilan 0% 6.000.000 × 6 bln di kartu | saat beli: **pengeluaran** 6.000.000 (kategori barangnya) dari dompet liabilitas "Cicilan 0% — Kartu BCA"; tiap bulan: **transfer** kartu → liabilitas cicilan 1.000.000 (muncul di tagihan kartu); biaya admin = pengeluaran "Bunga & denda" | belanja tercatat SEKALI 6.000.000 di bulan pembelian |
| Meminjamkan ke teman / menalangi (reimburse) | **transfer** bank → dompet `piutang` per pihak ("Piutang Rina", "Piutang Kantor"); pelunasan = transfer piutang → bank | bank −300.000; Piutang Rina +300.000; belanja 0 |
| Patungan (split) 90.000 bertiga, aku bayar semua | induk 90.000 dari dompet; anak: **pengeluaran** 30.000 (bagianku) + **transfer** 30.000 ke Piutang Rina + 30.000 ke Piutang Dodi | belanja +30.000 |
| Arisan: setor iuran | **transfer** bank → dompet `arisan` grup itu | saldo dompet arisan = setor − terima = posisi bersih (M12) |
| Arisan: dapat giliran | **transfer** dompet arisan → bank | tidak dihitung pemasukan |
| Beli rumah/kendaraan/barang berharga | **transfer** ke dompet `aset` (nilai awal = harga beli); nilai berikutnya lewat `nilai_aset`; KPR/KKB = dompet liabilitas dengan saldo awal −pokok | uang muka tidak dihitung belanja |
| Beli investasi | **transfer** bank → dompet investasi (kas RDN/akun) + `transaksi_investasi` jenis beli | belanja 0 |
| Refund | **pemasukan** bertaut `refund_dari_id` → laporan mengurangi kategori asal | |
| Pengguna tanpa catatan utang mengetik "bayar cicilan motor 800rb" | **pengeluaran** kategori "Cicilan tanpa rincian" (kelompok cicilan) + saran "Buat catatan utangnya supaya sisa pokok terlihat?" | |

Utang lama yang dibuat dengan saldo sisa (bukan dari nol): dompet liabilitas dengan
`saldo_awal = −sisa pokok` per tanggal dibuat — tidak ada transaksi pemasukan palsu.

### 5.18 Hapus, urungkan, dan tautan (kaskade)

Semua kaskade berjalan dalam **satu transaksi DB**; semua baris yang ikut terhapus diberi
`grup_hapus_id` yang sama, dan **Urungkan** memulihkan seluruh grup persis (saldo cache ikut dihitung
ulang). Tidak ada tautan yang menunjuk baris terhapus tanpa keadaan yang jelas.

| Yang dihapus | Akibat | Urungkan |
|---|---|---|
| Satu kaki transfer | kedua kaki ikut terhapus; biaya admin yang tertaut ditanyakan (bawaan: ikut) | pulihkan semuanya |
| Induk split | semua anak ikut | pulihkan semuanya |
| Satu anak split | tidak boleh langsung — ubah split (sisa pindah ke anak lain atau "sisa") | — |
| Transaksi pelunas `kejadian_berulang` | kejadian kembali `akan` (atau `terlambat` bila lewat), `transaksi_id` dikosongkan | kejadian kembali `lunas` |
| Transaksi pokok/bunga `pembayaran_utang` | baris `pembayaran_utang` + pasangannya ikut terhapus; sisa pokok otomatis benar (dihitung dari saldo dompet liabilitas) | pulihkan |
| Transaksi yang dirujuk `alokasi_target.transaksi_id` | alokasi itu ikut | pulihkan |
| Transaksi asal refund | refund tetap ada, tautan diputus, refund jadi pemasukan "Pengembalian (refund)" + perlu ditinjau | tautan dipulihkan |
| Transaksi refund | asal tidak berubah | — |
| Transaksi kas investasi (`transaksi_kas_id`) ↔ `transaksi_investasi` | pasangannya ikut (ditanyakan dulu, bawaan: ikut) | pulihkan |
| Transaksi setor/terima arisan | `putaran_arisan` kembali "belum" | pulihkan |
| Dompet dengan riwayat | **tidak bisa dihapus — hanya diarsipkan** (riwayat & laporan tetap). `request_deletion {entity:"account", mode:"delete"}` untuk dompet bertransaksi dikembalikan sebagai draf **arsip** dengan penjelasan | batal arsip |
| Dompet tanpa riwayat | hapus biasa | pulihkan |
| Kategori | wajib pilih pengganti (transaksi dipindah) atau "Belum dikategorikan"; anggarannya ikut dipindah/dihapus | pulihkan kategori + kembalikan transaksi ke kategori semula |
| Target | alokasi kantong virtual dilepas (uang "bebas" lagi); dompet khusus tidak berubah | pulihkan |
| Utang tanpa pembayaran | hapus + dompet liabilitas otomatisnya (bila tanpa transaksi lain) | pulihkan |
| Utang dengan pembayaran | tidak bisa dihapus — "Tandai lunas/tutup" atau arsip | — |
| Batch impor | semua transaksi batch itu (termasuk yang sudah disunting) — pratinjau jumlah dulu | pulihkan batch |

Tombstone disimpan 30 hari ("Baru dihapus"), lalu dihapus permanen oleh `bersih-bersih`.

### 5.19 Kunci periode (sesudah rekonsiliasi)

Saat pengguna **Cocokkan saldo** dan menyetujui "Kunci sampai tanggal ini", `dompet.terkunci_sampai`
diisi. Menambah/mengubah/menghapus transaksi dompet itu bertanggal ≤ tanggal kunci meminta konfirmasi
eksplisit ("Ini mengubah saldo yang sudah kamu cocokkan") di aplikasi, dan **selalu menjadi draf**
bila datang dari agen. Impor yang menyentuh tanggal terkunci ditandai di pratinjau.

### 5.20 Daftar harta & utang SPT (pemetaan kode)

Sumber: `snapshot_item` per 31 Des (bukan hanya total per kelas), mencakup **semua** dompet/aset/utang —
termasuk yang `ikut_kekayaan = false` (tetap wajib dilaporkan); pengguna bisa mengecualikan per baris
dengan alasan (mis. "milik orang tua, hanya dicatat"). Kode bawaan (pengguna bisa mengubah per baris;
**[verifikasi seluruh daftar terhadap lampiran PER-11/PJ/2025 sebelum rilis]**):

| Pos BYM | Kode | Keterangan |
|---|---|---|
| Tunai | 011 | uang tunai |
| Rekening tabungan | 012 | tabungan |
| Giro | 013 | giro |
| Deposito | 014 | deposito |
| E-wallet, saldo lain setara kas | **019** | setara kas lainnya (bukan 015) |
| Piutang (teman, talangan, P2P lending sebagai pendana) | 021 / 029 | piutang / piutang lainnya [verifikasi untuk P2P] |
| Saham | 032 | saham |
| Obligasi korporasi | 033 | |
| SBN ritel (ORI/SR/ST/SBR) | 034 | obligasi pemerintah |
| Reksa dana | 036 | reksa dana |
| Kripto, JHT/DPLK, lainnya | 039 | investasi lainnya [verifikasi] |
| Sepeda motor / mobil / kendaraan lain | 042 / 043 / 049 | |
| Emas batangan, tabungan emas digital | 051 | logam mulia [verifikasi untuk emas digital] |
| Elektronik & perabot bernilai | 055 | |
| Rumah tinggal / tanah-bangunan usaha / tanah | 061 / 062 / 063 | |
| Utang bank/lembaga pembiayaan (KPR, KKB, KTA, paylater, pinjol) | 101 | [verifikasi untuk paylater/pinjol] |
| Kartu kredit | 102 | |
| Utang ke afiliasi (keluarga) | 103 | |
| Utang lainnya (teman, arisan negatif) | 109 | |

- Tiap baris membawa **tahun perolehan** & **harga perolehan**: dompet bank = tahun dibuka (isian),
  aset = `tahun_perolehan`/`harga_perolehan_minor`, investasi = tahun beli pertama & biaya rata-rata
  total; kosong → baris ditandai "perlu dilengkapi".
- Nilai: kas/tabungan = saldo 31 Des; saham = harga penutupan terakhir; reksa dana = NAB terakhir;
  valas = kurs 31 Des (§5.1 posisi); aset = nilai terakhir.
- **Snapshot 31 Des dihitung ulang otomatis** bila ada transaksi/harga bertanggal ≤ 31 Des yang datang
  kemudian, SAMPAI pengguna menyalin/mengekspor daftar (lalu `dikunci_pada`). Perubahan sesudah dikunci
  → spanduk "ada perubahan sesudah kamu menyalin daftar ini" + tombol hitung ulang (versi baru).

---

## 6. Integrasi AgentBuff

### 6.1 Masuk dengan AgentBuff (OIDC)

Konstanta (dari discovery `https://agentbuff.id/masuk/.well-known/openid-configuration`):
issuer `https://agentbuff.id/masuk` · authorize `/masuk/authorize` · token `/masuk/token` ·
userinfo `/masuk/userinfo` · jwks `/masuk/jwks` · status `/masuk/status`. ID token ES256, `sub` pairwise
`abs_…` permanen, klaim `email`, `email_verified`, `name`, `picture`. **Tidak ada refresh token.**

Alur (`openid-client` v6):
1. `GET /auth/agentbuff/start` → buat `state` (acak 32 byte), `nonce`, `code_verifier` (43–128 char) →
   simpan di cookie terenkripsi berumur 10 menit (`__Host-bym_oidc`) → redirect ke authorize dengan
   `response_type=code`, `client_id`, `redirect_uri=https://bym.agentbuff.id/auth/agentbuff/callback`
   (sama persis dengan yang didaftarkan), `scope=openid email profile`, `state`, `nonce`,
   `code_challenge` (S256), `ui_locales=id`.
2. `GET /auth/agentbuff/callback`:
   - **Verifikasi `state` (cookie) dan `iss` di query = issuer SEBELUM membaca `error` apa pun**
     (galat palsu dari pihak lain tidak boleh menggerakkan UI).
   - `error=access_denied` → ke `/masuk?alasan=<error_description>` (alasan: `diblokir | belum_aktif |
     akses_berakhir | belum_beli | dibatalkan`) — kalimat manusia + CTA sesuai tabel §6.3.1.
   - `error=login_required` (hanya terjadi pada percobaan senyap `prompt=none`) → ulangi `start` TANPA
     `prompt=none` (interaktif).
   - `error` lain (`invalid_request`, `invalid_scope`, `unsupported_response_type`, `server_error`,
     `temporarily_unavailable`, tak dikenal) → layar "Masuk dengan AgentBuff belum berhasil" + tombol
     **Coba lagi** + kode galat kecil untuk dukungan; `error_description` tidak ditampilkan mentah & tidak
     di-log utuh. Cookie OIDC dihapus di semua cabang.
   - Tukar kode: `POST /masuk/token` dengan `Authorization: Basic base64(urlenc(id):urlenc(secret))`,
     `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier`.
   - Validasi ID token: `iss`, `aud == client_id`, `exp`, `nonce`, tanda tangan ES256 via JWKS
     (unduh ulang saat `kid` tak dikenal; bila gagal unduh, jangan coba lagi selama 30 dtk).
   - **Pemeriksaan hak ketat** (§6.2, tanpa singgahan). Tidak berhak → layar alasan.
   - Upsert `pengguna` berdasarkan `agentbuff_sub = sub` (email/nama diperbarui untuk tampilan; foto
     `picture` diunduh sekali di server — https, ≤ 1 MB, image/* — dan disimpan lokal, jadi CSP tidak
     perlu host luar dan peramban pengguna tidak memanggil Google).
   - Belum punya ruang → **buat ruang bawaan SEKETIKA di callback ini** ("Keuangan <nama depan>",
     IDR, kategori bawaan, dompet Tunai) SEBELUM orientasi. Alasannya: AgentBuff mulai meminta token MCP
     ±1 menit sesudah masuk dan menjawab 404 dengan jeda yang makin panjang (2 → 4 → 8 menit …); ruang
     yang baru dibuat di akhir orientasi (yang bisa ditinggalkan) membuat sambungan otomatis terlambat
     bermenit-menit atau berjam-jam. Orientasi kemudian **mengubah** ruang itu, bukan membuatnya.
   - Buat sesi → redirect `/app` (orientasi bila belum selesai).
3. Pendaftaran klien di sisi AgentBuff (§10.2). Env BYM: `AGENTBUFF_MASUK_CLIENT_ID`,
   `AGENTBUFF_MASUK_CLIENT_SECRET` (tidak pernah dicetak/di-log).

### 6.2 Gerbang hak (`/masuk/status`)

```
POST https://agentbuff.id/masuk/status
Authorization: Basic <client_id:secret>
Content-Type: application/x-www-form-urlencoded
sub=abs_…
→ { aktif: bool, alasan: 'ok'|'akses_berakhir'|'belum_aktif'|'belum_beli'|'diblokir'|'dicabut'|'tidak_dikenal', pesan: string, sub? }
```
#### 6.2.1 Kapan diperiksa
- **Ketat** (tanpa singgahan) saat masuk.
- **Saat dipakai** (tanpa pekerjaan polling massal): `cekHak(pemilik)` dengan singgahan `status_hak`
  10 menit (+ jitter 0–60 dtk, *single-flight* per pemilik) di: middleware halaman aplikasi, setiap
  panggilan MCP, endpoint mcp-token, dan **setiap pekerjaan latar sebelum bertindak atas nama ruang**
  (posting berulang, pengingat, ringkasan). Karena semua pintu masuk memeriksa, pencabutan terasa
  ≤ 10 menit pada pemakaian berikutnya — tanpa memeriksa pemilik yang tidak memakai apa pun.
- **Sapuan harian** (untuk statistik `/ops` & penghitung `tidak_dikenal`): setiap pemilik yang aktif
  30 hari terakhir diperiksa sekali per 24 jam, disebar merata (10.000 pemilik ≈ 7/menit).
- **Pembatas laju global** klien BYM ke AgentBuff: token bucket **8/detik (480/menit)**, di bawah batas
  AgentBuff 600/menit. Bila habis: pakai singgahan terakhir (tidak dianggap galat).
- Ketergantungan yang diminta ke AgentBuff (README): `POST /masuk/status` **batch** (`subs[]` ≤ 100) atau
  webhook "hak berubah" — memotong beban lebih jauh; BYM tetap jalan tanpa itu.

#### 6.2.2 Menafsirkan jawaban
- **Hanya HTTP 200 dengan badan valid** yang dianggap jawaban hak. `aktif:false` → set `ruang.beku_*`
  untuk SEMUA ruang milik pemilik; `aktif:true` → kosongkan.
- **Apa pun selain itu** (jaringan, timeout, 5xx, 429, **401 `invalid_client`**, 400, badan rusak) =
  `tidak_terjangkau` → pakai jawaban baik terakhir. 401/400 juga memicu **peringatan operator seketika**
  ("kredensial klien BYM ditolak AgentBuff") — itu salah konfigurasi kita, bukan pengguna yang berhenti.
- `tidak_terjangkau` terus-menerus **≤ 72 jam** sejak `terakhir_baik_pada`: aplikasi tetap jalan
  normal + spanduk kecil "Tidak bisa memeriksa langgananmu ke AgentBuff — kamu tetap bisa memakai BYM".
  (Prinsip PRD §4.1: pencatatan tidak diblokir karena gangguan kita/AgentBuff.)
- Lebih dari 72 jam: beku dengan alasan `tidak_terjangkau` dan kalimat netral ("Kami belum bisa memeriksa
  langgananmu; data aman") — BUKAN "langganan berakhir".

#### 6.2.3 Pengaman massal & penghapusan
- **Pemutus sirkuit**: bila dalam 1 jam > 5% pemilik (atau > 20 pemilik) berpindah ke `aktif:false`
  atau `tidak_dikenal`, SEMUA transisi beku & penghitung hapus **ditahan** (keadaan lama dipertahankan)
  dan operator diperingatkan; dilepas manual dari `/ops`. Melindungi dari pemulihan DB AgentBuff,
  rahasia klien terputar, atau bug.
- `tidak_dikenal` hanya dihitung dari jawaban 200 dengan alasan itu; `tidak_dikenal_sejak` diisi saat
  pertama kali dan **direset** oleh jawaban lain apa pun.
- Hapus permanen hanya bila: `tidak_dikenal` konsisten **≥ 90 hari** dengan ≥ 1 pemeriksaan sukses per
  hari, pemberitahuan terkirim di hari ke-30, ke-60, dan ke-83 (email bila ada + dalam aplikasi), lalu
  masuk **antrean persetujuan operator** di `/ops` (`permintaan_hapus.butuh_setuju_operator`). Operator
  menyetujui per batch; tanpa persetujuan tidak ada yang terhapus. Cadangan terakhir sebelum hapus
  mengikuti siklus retensi (§11.2).

### 6.3 Keadaan beku

| Permukaan | Perilaku |
|---|---|
| Halaman `/app/*` | layar beku (DESAIN §9.20); rute yang tetap boleh: `/app/impor-ekspor` (bagian ekspor saja), `/app/pengaturan/akun`, keluar |
| API `/api/*` (mutasi) | 403 `{galat:'ruang_beku', alasan, pesan, tautan}` |
| API ekspor | tetap jalan (hak akses data) — untuk pemilik DAN anggota (masing-masing data yang boleh ia lihat) |
| MCP | JSON-RPC error `-32010` `{ message:'company_frozen', data:{ reason, message, renew_url } }` — `renew_url` = tautan tabel §6.3.1 |
| mcp-token | 403 `{ error:'tidak_berhak', reason }` |
| Pekerjaan latar | tidak memposting berulang/pengingat untuk ruang beku; snapshot tetap (data tak berubah); kejadian yang terlewat muncul sesudah beku terangkat (§5.8.1) |
| Antrean luring di perangkat | sinkron ditolak 403 → item **tetap di antrean** bertanda "tertunda — ruang dibekukan" (tidak dibuang), terkirim otomatis sesudah beku terangkat |

#### 6.3.1 Kalimat & tombol per alasan

| `alasan` | Kalimat (ringkas) | Tombol utama |
|---|---|---|
| `belum_beli` | "Langganan BYM-mu sudah berakhir / belum ada." | **Perpanjang BYM** → `https://agentbuff.id/app/shop?produk=buff-your-money` |
| `akses_berakhir` | "Akses AgentBuff-mu sedang berakhir, jadi BYM ikut berhenti." | **Aktifkan AgentBuff** → `https://agentbuff.id/checkout` |
| `belum_aktif` | "Akun AgentBuff-mu belum aktif." | **Buka AgentBuff** → `https://agentbuff.id/app` |
| `dicabut` | "Izin BYM di akun AgentBuff-mu dicabut." | **Masuk lagi dengan AgentBuff** → `/auth/agentbuff/start` (masuk ulang menghidupkan izin) |
| `diblokir` | "Akun AgentBuff pemilik sedang diblokir." | **Hubungi dukungan AgentBuff** → `https://agentbuff.id/bantuan` |
| `tidak_dikenal` | "Akun AgentBuff pemilik tidak ditemukan." + tanggal rencana hapus (bila penghitung berjalan) | **Unduh semua dataku** (utama) |
| `tidak_terjangkau` (> 72 jam) | "Kami belum bisa memeriksa langgananmu ke AgentBuff. Datamu aman." | **Coba periksa lagi** |

Anggota (bukan pemilik) melihat kalimat "Akses pemilik ruang ini sedang berakhir" + tombol unduh data
miliknya; tombol perpanjang hanya untuk pemilik. `pesan` dari AgentBuff ditampilkan di bawahnya apa adanya.

### 6.4 Endpoint `POST /api/agentbuff/mcp-token` (sambung MCP otomatis)

Dipanggil AgentBuff (batas tunggu 20 dtk) dengan `Authorization: Bearer <assertion>`, body `{}`.

Verifikasi assertion (semua wajib; gagal apa pun → **401** `{error:'assertion_invalid'}`):
| Bagian | Nilai |
|---|---|
| header `alg` | `ES256` (tolak lainnya) |
| header `typ` | `mcp-token+jwt` |
| header `kid` | ada di JWKS AgentBuff (unduh ulang bila tak dikenal) |
| `iss` | `https://agentbuff.id/masuk` |
| `aud` | client_id BYM (string) |
| `purpose` | `mcp_token` (ID token biasa tidak punya → ditolak) |
| `exp − iat` | ≤ 120 dtk; toleransi jam ±60 dtk |
| `jti` | belum ada di `jti_terpakai` → simpan (kedaluwarsa ≥ 5 menit) |

Lalu:
1. Cari pemilik: `pengguna.agentbuff_sub = sub` — **HANYA lewat `sub`, tanpa jalur email**. BYM tidak
   punya pemilik pra-OIDC, dan mencocokkan email bisa menautkan akun AgentBuff yang dibuat ulang (sub baru,
   email Google sama) ke data yatim milik akun lama. Tak ada pemilik atau belum punya ruang → **404**
   `{error:'belum_ada_akun'}` (AgentBuff mencoba lagi; ruang dibuat saat callback masuk, §6.1, jadi 404
   hanya terjadi bila pengguna belum pernah masuk ke BYM).
2. `cekHak` (singgahan boleh) → tidak aktif → **403** `{error:'tidak_berhak', reason}`.
3. Batas 10/menit per pemilik → **429** `{error:'terlalu_sering'}`.
4. Pilih ruang: ruang utama pemilik (ruang non-demo tertua yang tidak dihapus; setelan "Ruang untuk agen"
   bila pemilik punya beberapa). Mengganti "Ruang untuk agen" kemudian **memperbarui `ruang_id` token
   otomatis yang aktif seketika** (token sama, tidak perlu menunggu AgentBuff) + jejak audit.
5. Terbitkan token acak 32 byte (`bym_` + base64url), label **`AgentBuff (otomatis)`**, cakupan `catat`,
   `boleh_usulan=true`, `sumber='agentbuff_otomatis'`, `pengguna_id` = pemilik, kedaluwarsa **90 hari**;
   token otomatis sebelumnya milik pemilik itu diberi `kedaluwarsa = now() + 10 menit` (bukan dicabut
   seketika — panggilan agen yang sedang berjalan tidak jatuh 401 saat AgentBuff menukar header). Simpan
   hanya sha256.
6. `jejak_audit` aktor "AgentBuff otomatis". Jangan pernah me-log token.
7. **200** `{ token, expires_at: ISO, tenant_name: ruang.nama }` (AgentBuff memperbarui 14 hari sebelum kedaluwarsa).

### 6.5 Pendaftaran & produk di AgentBuff
Lihat §10.

---

## 7. Harga & data referensi

| Data | Sumber | Pekerjaan | Catatan |
|---|---|---|---|
| Kripto IDR | **Indodax publik** `GET https://indodax.com/api/ticker_all` (tanpa kunci, 180 req/menit) | tiap 15 menit, satu panggilan untuk semua pasangan | cadangan: CoinGecko Demo `simple/price?vs_currencies=idr` (wajib atribusi "Data provided by CoinGecko" + tautan) |
| Kurs | **Frankfurter** `https://api.frankfurter.dev/v1/latest?from=USD&to=IDR` (ECB, tanpa kunci) · cadangan ER-API open (atribusi, tanpa redistribusi) · BI JISDOR (SOAP, best-effort) | harian 17.00 WIB | hari libur ECB → pakai kurs terakhir |
| Emas (Antam/UBS/Galeri24/Pegadaian) | **input operator** harian (jual & buyback per merek) | — | ⛔ jangan mengikis logammulia.com (anti-bot & ToS) |
| NAB reksa dana | input pengguna / impor AKSes KSEI / input operator untuk RD populer | — | OJK hanya bulanan; belum ada API harian publik |
| Saham IDX | input pengguna / input operator harga penutupan terpilih | — | ⛔ jangan mengikis idx.co.id; ⛔ yfinance tidak untuk produk berbayar; siap untuk vendor berlisensi (EODHD enterprise / vendor lokal berizin) |
| CPI (inflasi) | **input operator** bulanan dari rilis BPS | — | BPS WebAPI dilarang untuk komersial |
| TBP LPS, nisab zakat, nilai fitrah/fidyah, batas bunga BI/OJK, libur nasional, tanggal isbat | **setelan operator** (dengan tanggal berlaku) | — | semua angka regulasi = data, bukan konstanta kode |

Setiap harga menyimpan `sumber` + `diambil_pada`; UI menampilkan keduanya. Atribusi sumber ditampilkan
di kaki halaman investasi bila memakai CoinGecko/ER-API. Antarmuka `PenyediaHarga` (`ambil(instrumen[],
tanggal)`) supaya feed berlisensi bisa ditambah tanpa ubah model data.

---

## 8. Server MCP

### 8.1 Transport & identitas
- `POST https://bym.agentbuff.id/mcp`, **Streamable HTTP, stateless, respons JSON** (`createMcpHandler`
  dengan `legacy:"stateless"` supaya klien lama & baru sama-sama bisa). `GET /mcp` boleh 405.
- Server: `name: "bym"`, `title: "Buff Your Money"`, `version` = versi aplikasi, `instructions`
  (ringkas, Inggris, ±800 karakter): semua jumlah dalam rupiah kecuali disebut; jangan mengarang angka,
  selalu pakai tool; tulis ringan langsung jalan & bisa diurungkan; perubahan besar = draf; tidak memberi
  rekomendasi beli/jual efek/reksa dana/kripto; jawab pengguna dalam Bahasa Indonesia; kirim `client_ref`
  unik untuk setiap pencatatan.
- **Autentikasi**: `Authorization: Bearer <token>` → cari `token_mcp.hash = sha256(token)`, belum dicabut,
  belum kedaluwarsa. **Token tidak sah/dicabut → HTTP 401 + `WWW-Authenticate: Bearer` SEBELUM JSON-RPC
  diurai — termasuk untuk `initialize` & `tools/list`** (AgentBuff menilai sambungan dari `mcp.test` =
  initialize + tools/list; 200 dengan daftar kosong akan tercatat "tersambung" palsu).
- Setiap panggilan: `cekHak(pemilik ruang)` (singgahan) → beku → `-32010`.
- `SET LOCAL app.ruang_id` + `app.pengguna_id` = **`token_mcp.pengguna_id`** (pembuat token), BUKAN
  otomatis pemilik: token manual buatan anggota berjalan dengan peran & visibilitas anggota itu
  (matriks §12.3); token otomatis milik pemilik. Dompet pribadi anggota lain tidak pernah terlihat oleh
  token siapa pun, dan catatan anggota yang `sertakan_di_mcp = false` disaring dari hasil baca MCP
  (angka agregat tetap memuatnya tanpa rincian).
- `token_mcp.terakhir_dipakai` diperbarui (maks sekali/menit).

### 8.2 Cakupan & daftar tool
- `tools/list` hanya mengembalikan tool yang diizinkan cakupan token: `baca` → Baca + Hitung;
  `catat` → + Catat; `boleh_usulan` → + Usulan.
- Anotasi MCP per tool: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint:false`.

### 8.3 Konvensi masukan/keluaran
- Nama tool & parameter: **snake_case Inggris** (konvensi aplikasi mitra AgentBuff); deskripsi Inggris
  dengan contoh Indonesia.
- Uang masuk: `amount` = angka **satuan utama** (25000 untuk Rp25.000; 12.5 untuk US$12,50) + `currency`
  opsional (bawaan mata uang dompet). Uang keluar:
  `{ "amount": 25000, "currency": "IDR", "text": "Rp25.000" }`.
- Tanggal `YYYY-MM-DD` (zona ruang). Periode: `period` ∈ `today|yesterday|this_week|last_week|
  this_period|last_period|this_month|last_month|last_7_days|last_30_days|this_year|last_year|custom`
  (+ `date_from`/`date_to` untuk custom). `this_period` = siklus gajian.
- Referensi entitas: `account`, `category`, `goal`, `debt` menerima **id atau nama/alias**; ambigu →
  hasil galat dengan `candidates`.
- Hasil: `structuredContent` (JSON terstruktur) + `content[0].text` ringkasan Indonesia siap dibacakan
  (≤ 2.000 karakter). Daftar: bawaan 50, maks 200, `next_cursor`.
- **Idempotensi** (satu `client_ref` per PANGGILAN, bukan per baris): setiap tool Catat menerima
  `client_ref` (string ≤ 100). Server menyimpan `(ruang_id, alat, client_ref) → hash_argumen + hasil`
  di tabel `idempotensi` (§4.3) dalam transaksi DB yang sama dengan penulisannya, disimpan **30 hari**:
  - ref sama + argumen sama → kembalikan hasil tersimpan persis + `duplicate: true` (tanpa menulis apa pun);
  - ref sama + argumen BERBEDA → hasil `isError` `client_ref_reused` (agen wajib membuat ref baru);
  - panggilan yang menulis banyak baris (2 item `quick_record`, transfer 2 kaki + biaya admin,
    `items[]` ≤ 20, anak split) tetap SATU ref; tiap baris diberi `sumber_ref = client_ref#urutan`
    sebagai jejak (tidak unik).
  - Berlaku juga untuk tool yang tidak membuat transaksi (`record_debt`, `add_goal_contribution`,
    `mark_bill_paid`, `create_goal`, …) — idempotensinya ada di tabel ini, bukan di kolom transaksi.
  - Tanpa `client_ref` → galat validasi (tool Catat).
- Jumlah IDR wajib bilangan bulat rupiah (`25000`, bukan `25000.5`) → selain itu galat validasi.
- Setiap hasil Catat membawa `action_id` + `app_link`. Urungkan lewat `undo_recent_action {action_id}`
  atau menu Agen AI di aplikasi (tidak ada token urungkan terpisah).

### 8.4 Galat
| Situasi | Bentuk |
|---|---|
| token tidak sah / dicabut | HTTP 401 (sebelum JSON-RPC) |
| cakupan tidak cukup | JSON-RPC `-32003` `{message:'forbidden_scope', data:{required:'catat'}}` |
| ruang beku | JSON-RPC `-32010` `{message:'company_frozen', data:{reason, message, renew_url}}` |
| batas laju | JSON-RPC `-32029` `{data:{retry_after_seconds}}` |
| galat internal | JSON-RPC `-32000` pesan umum + `error_id` (detail hanya di log) |
| validasi bisnis / tidak ditemukan / ambigu / butuh klarifikasi | **hasil tool** `isError: true` + `structuredContent {error_code, message, field?, candidates?, needs_clarification?}` — supaya model bisa membaca & bertanya ke pengguna |

### 8.5 Batas laju (per token)
120 panggilan/menit total · 30 tulis/menit · `quick_record` 30/menit · item per panggilan tulis ≤ 20
(`record_transaction`) / ≤ 50 (`review_transactions`).

### 8.6 Draf (kelas Usulan)
Tool Usulan tidak mengubah data. Mereka membuat `draf_agen` (kedaluwarsa 7 hari) dan mengembalikan:
```json
{ "status": "pending_approval", "draft_id": "…", "summary": "Hapus 3 transaksi (total Rp145.000) dari 12–14 Sep",
  "preview": { … }, "approve_url": "https://bym.agentbuff.id/app/agen?draf=…", "expires_at": "…" }
```
Pemilik menyetujui di aplikasi (butuh PIN/passkey bila diaktifkan; wajib masuk ulang bila tidak). Eksekusi
memvalidasi ulang (data bisa berubah) → `hasil` disimpan → notifikasi. Agen bisa memeriksa via
`list_pending_drafts`.

### 8.7 Urungkan
Setiap tool Catat menulis `aksi_agen` (sebelum/sesudah). `undo_recent_action {action_id}` langsung jalan bila
aksi dibuat oleh **pengguna & sumber token yang sama** (mis. token otomatis milik pemilik yang sama —
tetap berlaku walau token otomatis sudah diputar) ≤ 24 jam lalu dan target belum diubah pihak lain
sesudahnya; selain itu → draf. Urungkan memakai kaskade §5.18. Menu Agen AI di aplikasi bisa mengurungkan
aksi agen ≤ 30 hari.

---

## 9. Katalog tool MCP

Kolom: **C** = cakupan (B baca · H hitung · T catat/tulis · U usulan/draf). Parameter bertanda `?` opsional.

### 9.1 Baca (B)
| Tool | Parameter | Mengembalikan |
|---|---|---|
| `get_overview` | — | Aman dibelanjakan + harian + hari ke gajian, perlu ditinjau (jumlah), tagihan 7 hari, 3 anggaran terpanas, target utama, kekayaan bersih + Δ30h, Level Buff, periode berjalan |
| `list_accounts` | `type?`, `include_archived?` | dompet: id, nama, jenis, institusi, saldo, mata uang, ikut anggaran, tercocok_pada; total per jenis |
| `list_categories` | `type?` (`expense`/`income`) | kategori + sub + id + kelompok |
| `list_transactions` | `period?`, `date_from?`, `date_to?`, `account?`, `category?`, `type?`, `search?`, `min_amount?`, `max_amount?`, `tag?`, `source?`, `needs_review?`, `limit?`, `cursor?` | transaksi ringkas + total keluar/masuk dari hasil |
| `get_spending_summary` | `period?`/`date_*`, `group_by` (`category`/`payee`/`tag`/`day`/`account`/`member`), `compare_previous?` | agregasi + persen + perbandingan periode lalu & rata-rata 3 periode |
| `get_cashflow` | `periods?` (1–24), `granularity?` (`period`/`month`/`week`) | per periode: masuk, keluar, bersih, rasio menabung |
| `get_budget_status` | `period?` (`this_period`/`last_period`), `category?` | metode, Siap dialokasikan (amplop), per kategori: anggaran, rollover, terpakai, sisa, proyeksi, status laju; ringkasan kelompok untuk metode persentase |
| `list_goals` | `status?` | target: jumlah, terkumpul, %, butuh/bulan, perkiraan tercapai, status |
| `list_upcoming_bills` | `days?` (bawaan 14, maks 90), `include_overdue?` | kejadian berulang akan/terlambat + total |
| `list_subscriptions` | — | langganan aktif, jumlah/bulan & /tahun, kenaikan harga, saran terdeteksi |
| `list_debts` | `direction?` (`owe`/`owed`) | utang/piutang: sisa, cicilan, jatuh tempo, bunga (label jenis), DSR |
| `get_net_worth` | `range?` (`1m`/`3m`/`1y`/`all`) | aset, liabilitas, bersih, per kelas, per pemilik, tren, penjelasan perubahan |
| `get_portfolio` | `account?`, `asset_class?` | kepemilikan, alokasi vs target, XIRR/TWR/total, belum/terealisasi, dividen 12 bln, harga basi |
| `get_fi_progress` | — | Angka Merdeka (varian), aset investasi, progres, perkiraan tahun/usia merdeka, Coast, rasio menabung, Level Buff + syarat |
| `get_review_inbox` | `limit?` | transaksi perlu ditinjau + saran kategori |
| `get_insights` | — | wawasan aktif |
| `get_weekly_summary` | `week_offset?` (0 = minggu lalu) | ringkasan siap kirim (teks ≤ 1.200 karakter + data) |
| `get_logging_status` | — | transaksi terakhir (waktu), hari tanpa catatan, streak, jumlah hari ini |
| `list_pending_drafts` | — | draf menunggu persetujuan |

### 9.2 Hitung (H) — tanpa mengubah data
| Tool | Parameter | Mengembalikan |
|---|---|---|
| `parse_quick_entry` | `text` | hasil parser (§5.3) tanpa menyimpan |
| `simulate_debt_payoff` | `strategy` (`snowball`/`avalanche`/`custom`), `extra_monthly`, `order?`, `debts?` (bawaan semua utang aktif) | jadwal ringkas, tanggal lunas per utang & akhir, total bunga, selisih vs strategi lain |
| `simulate_goal` | `goal?` atau `target_amount`+`saved`, `monthly`, `annual_return?` | tanggal tercapai / setoran per bulan yang dibutuhkan |
| `simulate_fi` | `savings_rate?`, `annual_expenses?`, `real_return?`, `swr?`, `extra_monthly?` | tahun/usia merdeka, Angka Merdeka, perubahan vs sekarang (deterministik; Monte Carlo hanya di aplikasi) |
| `calculate_zakat` | `type` (`mal`/`income`/`fitrah`), `gold_reference?` (`antam_buyback` …), `income_basis?` (`gross`/`net`), `persons?` | rincian, nisab, wajib/tidak, jumlah; penafian |
| `get_tax_asset_list` | `year` | daftar harta & utang per 31 Des dengan kode SPT, tahun & harga perolehan, nilai saat ini; aset tanpa kode ditandai |
| `get_app_link` | `view` (`home`/`transactions`/`budget`/`goals`/`bills`/`debts`/`net_worth`/`investments`/`fi`/`reports`/`review`/`drafts`), `filters?` | URL tampilan tersaring di BYM |

### 9.3 Catat (T) — langsung, tercatat di aksi agen, bisa diurungkan
| Tool | Parameter | Catatan |
|---|---|---|
| `create_receipt_upload` | `mime` (`image/jpeg`/`image/png`/`image/webp`), `size_bytes` (≤ 5 MB) | `{ upload_url, upload_id, expires_at }` — URL PUT bertanda tangan berumur **10 menit**, sekali pakai, untuk agen yang bisa mengunggah berkas (mis. `curl -T`). Lebih baik daripada base64 di argumen: foto 3 MB = ±1 juta token bila ditulis model |
| `record_transaction` | `items[]` (≤ 20): `{type` (`expense`/`income`), `amount`, `currency?`, `account?`, `category?`, `payee?`, `date?`, `time?`, `note?`, `tags?`, `line_items?[] {description, amount, category?}`, `receipt_upload_id?` **atau** `receipt_url?` (https publik, diambil server: ≤ 5 MB, image/*, 10 dtk, tanpa alihan ke IP privat/loopback — penjaga SSRF), `reimbursable?`}, `client_ref` | kategori tidak ada/ragu → pakai saran + `perlu_ditinjau`; struk tanpa lampiran tetap tercatat (lampiran opsional); mengembalikan transaksi, saldo baru, Aman dibelanjakan terbaru |
| `quick_record` | `text`, `client_ref`, `default_account?` | parser server; kepercayaan jumlah rendah/ambigu/niat utang/split → **tidak menyimpan**, `needs_clarification` + pilihan; selain itu simpan |
| `record_transfer` | `from_account`, `to_account`, `amount`, `fee?`, `date?`, `note?`, `client_ref` | dua kaki + biaya admin |
| `update_transaction` | `id`, `fields{category?, note?, tags?, payee?, account?, amount?, date?}`, `client_ref` | ubah `amount/date/account` → otomatis jadi **draf** bila transaksi berumur > 30 hari, ATAU bukan buatan agen, ATAU di dalam periode terkunci (§5.19). Kategori/catatan/tag/penerima selalu langsung |
| `review_transactions` | `ids[]` (≤ 50), `category?`, `mark_reviewed?` | |
| `undo_recent_action` | `action_id` | §8.7 |
| `set_budget` | `category`, `amount`, `period?` (`this_period`/`next_period`), `rollover?` | amplop: validasi Siap dialokasikan (boleh minus dengan peringatan) |
| `move_budget_funds` | `from_category`, `to_category`, `amount`, `period?` | |
| `create_goal` | `name`, `target_amount`, `target_date?`, `type?`, `saving_method?` (`virtual`/`account`), `account?`, `annual_return?` | |
| `add_goal_contribution` | `goal`, `amount` (negatif = ambil), `account?`, `date?`, `client_ref` | validasi saldo sumber |
| `create_recurring` | `kind` (`bill`/`subscription`/`income`/`transfer`), `name`, `amount`, `approximate?`, `schedule` (`monthly_day:25` / `weekly:1` / `yearly:03-15` / RRULE), `account`, `category?`, `remind_days?`, `auto_post?` | |
| `mark_bill_paid` | `bill` (id/nama), `amount?`, `date?`, `account?`, `client_ref` | membuat transaksi & menandai kejadian lunas |
| `record_debt` | `direction`, `counterparty`, `amount`, `kind?`, `interest?{rate, basis}`, `term_months?`, `installment?`, `due_day?`, `start_date?`, `cash_account?` (dompet penerima/pemberi uang; kosong = catat utang lama tanpa uang berpindah), `note?`, `client_ref` | niat dari `quick_record` masuk ke sini setelah pengguna konfirmasi di chat; pembukuan §5.17 (dompet liabilitas/piutang dibuat otomatis) |
| `record_debt_payment` | `debt`, `amount`, `date?`, `account?`, `client_ref` | pokok/bunga dihitung otomatis; transfer pokok + pengeluaran bunga (§5.17) |
| `record_investment_transaction` | `holding?` atau `{account, asset_class, code, name?}`, `kind` (`buy`/`sell`/`dividend`/`interest`/`coupon`/`fee`/`split`), `quantity?`, `price?`, `fee?`, `tax?`, `date?`, `cash_account?`, `client_ref` | tidak pernah menilai "bagus/jelek" |
| `update_asset_value` | `holding` atau `account`, `price?` (per unit) atau `value?`, `date?` | untuk NAB/harga manual/aset manual |
| `create_account` | `name`, `type`, `institution?`, `opening_balance?`, `currency?`, `include_in_budget?` | |
| `create_rule` | `conditions`, `actions`, `apply_to_history?` (false bawaan; true → pratinjau & pekerjaan latar) | |

### 9.4 Usulan (U) — selalu draf
| Tool | Parameter |
|---|---|
| `request_deletion` | `entity` (`transaction`/`goal`/`recurring`/`debt`/`account`/`rule`), `ids[]`, `mode` (`delete`/`archive`), `reason?` — dompet bertransaksi & utang berpembayaran otomatis menjadi draf **arsip/tutup** (§5.18); pratinjau draf menyebut semua yang ikut terhapus |
| `adjust_account_balance` | `account`, `actual_balance`, `reason?` (membuat penyesuaian setelah disetujui) |
| `bulk_update_transactions` | `filter{…}` atau `ids[]` (> 50), `set{category?, tags_add?, account?}` |

### 9.5 Contoh sesi (acuan uji kontrak)
```
→ tools/call quick_record {"text":"bensin 50rb, parkir 5rb cash","client_ref":"wa-8f1c-001"}
← structuredContent: { created:[{id, type:"expense", amount:{amount:50000,currency:"IDR",text:"Rp50.000"},
                        category:"Bensin", account:"Tunai"}, {… 5000 Parkir …}],
                       safe_to_spend:{ amount:1100000, per_day:73300, days_left:15 }, action_id:"…",
                       app_link:"https://bym.agentbuff.id/app/transaksi?sumber=agen" }
   text: "Tercatat 2 transaksi dari Tunai: Bensin Rp50.000 dan Parkir Rp5.000. Aman dibelanjakan sampai
          gajian: Rp1,1 jt (± Rp73 rb/hari)."
   (1.100.000 / 15 = 73.333 → dibulatkan ke bawah ke Rp100 = 73.300; 15 hari = 8→22 Okt, geser bawaan)
→ (ulang dengan client_ref sama) ← duplicate:true, hasil sama, tidak ada transaksi baru
→ tools/call quick_record {"text":"pinjem ke budi 200rb","client_ref":"wa-8f1c-002"}
← isError:true, structuredContent:{ error_code:"needs_confirmation", intent:"debt_owe",
     proposal:{direction:"owe", counterparty:"Budi", amount:200000}, message:"Konfirmasi ke pengguna, lalu panggil record_debt." }
```

---

## 10. Penyiapan di sisi AgentBuff

### 10.1 Katalog
- Kunci **`buff-your-money`** (permanen — slug pasang & SKU transaksi). Seed lama `pencatat-keuangan`
  (`src/lib/billing/skill-catalog.ts`, `coming_soon`) dihapus setelah verifikasi SQL 0 transaksi & 0
  `skill_entitlement`.
- Skrip `scripts/siapkan-bym.ts` di repo AgentBuff, mencontoh `scripts/siapkan-kasir-pos.ts` (idempoten,
  lewat rute admin, sesi admin tempaan `_sesi-tempaan.ts`):
  1. `POST /api/admin/catalog` — `key`, `title`, `tagline` (≤ 120), `description` (≤ 2000), `priceRp: 29000`
     (keputusan K1), `category: "produktivitas"`, `icon: "Wallet"`, `unlock: "app"`, `status: "available"`
     (dibuka 1 Okt 2026 sesudah gerbang rilis; semula `coming_soon`), `billing: "subscription"`, `coverEmoji: "💰"`, `accent: "cyan"`, `featured`,
     `capabilities` (≤ 12 × ≤ 160) + versi Inggris.
  2. `POST /api/admin/catalog/buff-your-money/mcp` — `{ name:"bym", transport:"http",
     url:"https://bym.agentbuff.id/mcp", tokenHeader:"Authorization", tokenPrefix:"Bearer ",
     tokenLabel:"Token BYM", tutorial:<§10.3 manual> }` (host harus resolvable publik, https).
  3. `POST /api/admin/catalog/buff-your-money/package` — body `{ slug: "bym", version: "<semver>",
     files: [{ path: "SKILL.md", contentB64: <isi berkas dalam base64> }] }` (bentuk persis: skema zod di
     `src/app/api/admin/catalog/[key]/package/route.ts`); unggah hanya bila sha256 berubah, `version`
     dinaikkan tiap perubahan.
  4. `POST /api/admin/media` × 3 gambar → `coverImageUrl` + `galleryImages` (pola gambar produk §0.62:
     dibuat sendiri, diperiksa dengan mata di lembar kontak).
  5. `PATCH …` konten + `status:"available"` **hanya setelah gerbang rilis PRD §11.2**.
- **Harus ada di `ICONS` shop-tab**: `Wallet` sudah tersedia.
- **Dogfooding sebelum `available`** (G2–G7): katalog hanya punya status `available|coming_soon`, dan
  `coming_soon` membuat `/masuk/status` menjawab `belum_beli` — jadi Chief & akun `@uji.internal`
  butuh **hak produk yang diberikan admin**. Buat skrip kecil di AgentBuff
  `scripts/hibah-produk.ts <email> buff-your-money <bulan>` (idempoten, menulis `skill_entitlement`
  lewat modul billing yang sama dengan pembelian, tercatat di `audit_log`, menolak email di luar daftar
  izin) — jangan menyetel `available` lebih awal.

### 10.2 OIDC & sambung otomatis
```
pnpm tsx --env-file=.env.local scripts/masuk-daftar-aplikasi.ts \
  --client-id bym --nama "Buff Your Money" --produk buff-your-money \
  --beranda https://bym.agentbuff.id \
  --redirect https://bym.agentbuff.id/auth/agentbuff/callback \
  --simpan-rahasia /root/masuk-rahasia/bym.env
# klien PENGEMBANGAN terpisah (jangan pernah mendaftarkan localhost pada klien produksi):
pnpm tsx --env-file=.env.local scripts/masuk-daftar-aplikasi.ts \
  --client-id bym-dev --nama "Buff Your Money (dev)" --produk buff-your-money \
  --beranda http://localhost:3000 \
  --redirect http://localhost:3000/auth/agentbuff/callback \
  --simpan-rahasia /root/masuk-rahasia/bym-dev.env
# setelah BYM hidup dan endpoint mcp-token lolos uji:
pnpm tsx --env-file=.env.local scripts/masuk-mcp-otomatis-url.ts bym https://bym.agentbuff.id/api/agentbuff/mcp-token
```
(`client-id` `^[a-z0-9-]{3,40}$`; baris katalog harus ada dulu; rahasia hanya ke berkas 600, tidak dicetak.)

### 10.3 Naskah listing (draf, disunting saat rilis)

**Tagline:** "Catat keuangan lewat chat, pantau anggaran, target, utang & investasi dengan tenang — sampai
merdeka finansial."

**Kemampuan (≤ 160 karakter):**
1. Catat pemasukan & pengeluaran cukup lewat chat ke agenmu: "makan siang 35rb pakai GoPay" langsung tercatat.
2. "Aman dibelanjakan": tahu sisa uang untuk belanja per hari sampai tanggal gajianmu.
3. Anggaran 4 cara: sederhana, 50/30/20, 40/30/20/10, atau amplop "setiap rupiah punya tugas".
4. Tagihan & langganan diingatkan sebelum jatuh tempo, langganan baru & kenaikan harga terdeteksi.
5. Target tabungan (dana darurat, DP rumah, haji, pendidikan) lengkap dengan setoran per bulan yang dibutuhkan.
6. Utang, cicilan, paylater & piutang teman — plus simulasi lunas lebih cepat (snowball/avalanche).
7. Portofolio saham, reksa dana, emas, kripto, SBN & deposito dengan imbal hasil XIRR dan alokasi.
8. Kekayaan bersih & jalan menuju merdeka finansial, dipandu 9 Level Buff.
9. Impor mutasi bank (PDF/CSV) — dibuka di perangkatmu, password tidak pernah disimpan.
10. Kalkulator zakat & daftar harta-utang siap salin ke SPT Coretax.
11. Berbagi dengan keluarga (sampai 6 orang) dengan dompet pribadi yang tetap privat.
12. Rapi di HP & laptop, bisa dipasang seperti aplikasi, data bisa diunduh kapan saja.

**Tutorial (≤ 4000, format TutorialTeks):**
```
## Syarat
- Akun AgentBuff yang aktif (trial atau berlangganan).
- Tidak perlu kunci atau token apa pun — BYM tersambung otomatis ke agenmu.

## Cara menghubungkan
- Buka https://bym.agentbuff.id lalu pilih "Masuk dengan AgentBuff" (akun yang sama).
- Ikuti 5 langkah singkat (boleh dilewati).
- Dalam beberapa menit, kartu BYM di tab Konektor AgentBuff berubah jadi "Tersambung otomatis"
  (tidak mau menunggu? tekan "Sambungkan otomatis" di kartu itu).
- Coba chat agenmu: "tadi makan siang 35rb pakai GoPay".

## Contoh perintah
- "Berapa sisa uang aman sampai gajian?"
- "Catat gajian 8,5 juta ke BCA"
- "Tagihan apa saja minggu ini?"
- "Kalau aku tambah bayar 500 ribu per bulan, kapan semua utangku lunas?"
- "Ringkas pengeluaranku bulan lalu per kategori"

## Catatan penting
- Perubahan besar (hapus data, ubah banyak transaksi) dari agen menunggu persetujuanmu di menu Agen AI BYM.
- BYM tidak pernah meminta password, PIN, atau OTP bank/e-wallet.
- Informasi di BYM bersifat edukasi, bukan nasihat investasi atau pajak.
- Kalau langganan berakhir, BYM dibekukan tetapi datamu aman dan bisa diunduh.
```
**Tutorial manual (mcpConfig, cadangan):** "1. Buka https://bym.agentbuff.id, pilih Masuk dengan AgentBuff.
2. Menu Agen AI → Buat token koneksi → pilih 'Baca & catat' dan centang 'Boleh membuat usulan'.
3. Salin token, tempel di sini, klik Sambungkan."

---

## 11. Operasi

### 11.1 Deploy
- Direktori `/opt/bym`, `docker compose` (pola `/opt/agentbuff-pos` — **baca compose & deploy POS dulu**
  untuk cara NPM menjangkau layanan, jaringan, dan port loopback):
  - `bym-web` (Next standalone, `node server.js`), `bym-worker` (`node dist/worker.js`, image sama),
    `bym-db` (`postgres:16-alpine`, **bind volume `/opt/bym/data/pg`**, tidak dipublikasikan).
  - Lampiran: bind `/opt/bym/data/lampiran`.
  - Env: `/opt/bym/.env` (600). Ganti env → `docker compose up -d <layanan>` (restart tidak memuat env).
- NPM Proxy Host `bym.agentbuff.id` + Let's Encrypt; jangan bind 80/443.
- `deploy/deploy.sh` (dari repo BYM): git pull → **cadangan DB** (pg_dump gz + verifikasi "dump complete")
  → **hitung baris per tabel** → build image → migrasi (aditif) → `up -d` → health `/api/health` → hitung
  baris lagi → **gagal bila ada tabel yang berkurang** (+ petunjuk pulih) → uji asap.
- Tidak ada layanan lain di VPS yang disentuh.

### 11.2 Cadangan & pulih
- `pg_dump` tiap 6 jam → `/var/lib/bym/backups` (simpan 14 hari) + lampiran tar harian; salinan harian
  terenkripsi (age) ke off-site (keputusan K4).
- `.env` ikut dicadangkan terpisah (kunci enkripsi lampiran & sesi — tanpa itu cadangan setengah berguna).
- Uji pulih bulanan ke DB sementara + bandingkan hitungan baris (skrip `prove-pulih.ts`).

### 11.3 Pekerjaan terjadwal (pg-boss, WIB)
| Pekerjaan | Jadwal |
|---|---|
| `status-hak-harian` | sapuan harian tersebar (pemilik aktif 30 hari; §6.2.1) — pemeriksaan utama terjadi saat dipakai |
| `berulang-posting` | 00:05 harian + saat ruang dibuka (periksa hak dulu; ruang beku dilewati) |
| `pengingat` | tiap 15 menit (jam tenang dihormati, termasuk rentang yang melewati tengah malam) |
| `harga-kripto` | tiap 15 menit |
| `kurs` | 17:00 harian |
| `snapshot-kekayaan` | 23:55 harian |
| `deteksi-berulang`, `wawasan`, `level-buff`, `verifikasi-saldo` | 02:00–04:00 bertahap |
| `ringkasan-mingguan` | Senin 07:00 |
| `bersih-bersih` | 03:30 (tombstone > 30 hari, draf kedaluwarsa, jti, sesi, pekerjaan) |
| `hapus-terjadwal` | 04:30 (permintaan hapus pengguna lewat tenggang 14 hari; `tidak_dikenal` ≥ 90 hari HANYA sesudah disetujui operator §6.2.3; pemutus sirkuit menahan semuanya) |
Setiap pekerjaan: batas waktu, idempoten, detak tercatat (`/ops` menampilkan terakhir sukses).

### 11.4 Env
`DATABASE_URL`, `APP_ORIGIN=https://bym.agentbuff.id`, `SESSION_SECRET`, `ENCRYPTION_KEK` (32 byte base64),
`AGENTBUFF_ISSUER=https://agentbuff.id/masuk`, `AGENTBUFF_ORIGIN=https://agentbuff.id`,
`AGENTBUFF_PRODUCT_KEY=buff-your-money`, `AGENTBUFF_MASUK_CLIENT_ID`, `AGENTBUFF_MASUK_CLIENT_SECRET`,
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SMTP_*` (opsional), `OPERATOR_SUBS`,
`LOG_LEVEL`, `BACKUP_DIR`. Aplikasi menolak menyala bila env wajib kosong (pesan jelas, tanpa mencetak nilai).

### 11.5 Pemantauan
`/api/health` (DB, antrean, detak worker), log JSON tanpa jumlah/catatan/token, tampilan `/ops`
(galat 5xx per jam, pekerjaan gagal, feed harga, jumlah beku), peringatan operator (notifikasi/email) bila
pekerjaan gagal 3× atau selisih saldo ≠ 0.

---

## 12. Keamanan & privasi (rekayasa)

### 12.1 Header & CSP
- CSP **ber-nonce** untuk semua halaman aplikasi lewat **`src/proxy.ts`** (⛔ bukan akar repo; `matcher`
  literal): `script-src 'self' 'nonce-…' 'wasm-unsafe-eval'` (tesseract.js butuh WASM; **tanpa**
  `'unsafe-eval'`); `worker-src 'self' blob:` (Web Worker OCR, pdf.js, Monte Carlo);
  `img-src 'self' data: blob:`; `connect-src 'self'`; `frame-ancestors 'none'`;
  `form-action 'self' https://agentbuff.id`.
- **Semua aset pustaka disajikan sendiri** (tidak dari CDN — `connect-src 'self'` akan memblokirnya
  diam-diam): tesseract core `.wasm` + worker + data bahasa `ind.traineddata` & `eng.traineddata` di
  `/vendor/tesseract/…`, `pdf.worker.mjs` di `/vendor/pdfjs/…`; opsi `workerPath`/`corePath`/`langPath`
  menunjuk ke sana. Uji e2e OCR & PDF berjalan dengan CSP produksi aktif (tanpa `bypassCSP`).
- Foto profil AgentBuff disimpan lokal saat masuk (§6.1), jadi tidak ada host gambar luar di CSP.
- HSTS 2 tahun, nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (kamera hanya
  untuk pindai struk: `camera=(self)`).

### 12.2 Sesi & kredensial
- Cookie `__Host-bym_s` (httpOnly, Secure, SameSite=Lax, Path=/), id acak 32 byte, DB menyimpan hash.
  Diam 14 hari, mutlak 30 hari; pemilik masuk ulang via AgentBuff (senyap bila izin masih ada).
- Mutasi: cek `Origin`/`Sec-Fetch-Site` = same-origin (CSRF); tanpa itu 403.
- argon2id (m=19 MiB, t=2, p=1) untuk sandi anggota & PIN; PIN: 5 gagal → kunci 5 menit, bertingkat.
- Passkey (WebAuthn) sebagai kunci aplikasi & penyetuju draf.
- Batas laju: masuk anggota 10/menit/IP; API 300/menit/pengguna; MCP §8.5; mcp-token 10/menit/pemilik.

### 12.3 Isolasi data (dua lapis) & rumah tangga
1. Semua kueri lewat helper `denganRuang(ruangId, penggunaId, fn)` yang menjalankan transaksi dengan
   `SET LOCAL app.ruang_id`, `app.pengguna_id` (untuk MCP: `token_mcp.pengguna_id`, §8.1).
2. **RLS** — dan jebakannya ditutup, bukan diasumsikan:
   - Peran DB terpisah: `bym_migrasi` (pemilik tabel, hanya dipakai migrasi) · `bym_app` (web, **bukan**
     pemilik, tanpa BYPASSRLS) · `bym_worker` (pekerjaan latar: juga lewat `denganRuang` per ruang;
     hanya tabel global — `harga`, `kurs`, `hari_libur`, `setelan_operator` — yang ditulis tanpa konteks
     ruang). Tidak ada peran aplikasi yang memiliki BYPASSRLS.
   - `ALTER TABLE … ENABLE ROW LEVEL SECURITY` **dan** `FORCE ROW LEVEL SECURITY` di setiap tabel
     ber-`ruang_id` (pemilik tabel pun terkena).
   - Kebijakan terpisah untuk SELECT/UPDATE/DELETE (`USING`) dan INSERT/UPDATE (`WITH CHECK`), keduanya
     `ruang_id = current_setting('app.ruang_id', true)::uuid`; konteks kosong → `NULL` → tidak ada baris.
   - Dompet `pribadi` + transaksinya: tambahan `visibilitas = 'bersama' OR pemilik_anggota_id =
     current_setting('app.pengguna_id', true)::uuid`. **Tidak ada pengecualian untuk pemilik ruang** —
     setelan "lihat dompet pribadi anggota" DIHAPUS (bertentangan dengan PRD M18).
   - Penjaga `jaga.mjs`: setiap tabel ber-`ruang_id` di skema wajib punya ENABLE+FORCE+2 kebijakan.
3. **Agregat & kebocoran tak langsung**:
   - Angka rumah tangga (Aman dibelanjakan, kekayaan bersih rumah tangga, laporan) dihitung dari dompet
     bersama saja. Dompet pribadi ikut total **hanya** bila pemilik dompet menyalakan
     `ikut_total_rumah_tangga`, dan tampil satu baris "Pribadi — <nama> (tersembunyi)" tanpa rincian.
   - Transfer pribadi ↔ bersama: kaki bersama terlihat; kaki pribadi tampil sebagai "Dompet pribadi
     (<nama>)" tanpa saldo/penerima.
   - Wawasan & notifikasi yang berasal dari dompet pribadi dihitung per pengguna dan hanya dikirim ke
     pemiliknya; wawasan rumah tangga hanya dari data bersama.
4. **Matriks peran** (API menolak — bukan cuma UI menyembunyikan):

| Tindakan | Pemilik | Pengelola | Pencatat | Pengamat |
|---|---|---|---|---|
| Lihat dompet/transaksi bersama, saldo, anggaran, target | ✓ | ✓ | ✓ | ✓ |
| Lihat kekayaan bersih, investasi, utang bersama, laporan | ✓ | ✓ | – (hanya anggaran & transaksinya) | ✓ |
| Catat transaksi di dompet bersama | ✓ | ✓ | ✓ | – |
| Ubah/hapus transaksi orang lain | ✓ | ✓ | – (hanya miliknya ≤ 30 hari) | – |
| Atur anggaran, target, tagihan, aturan, kategori | ✓ | ✓ | – | – |
| Setujui draf agen | ✓ | ✓ (draf dari token miliknya sendiri saja) | – | – |
| Buat token MCP manual | ✓ | ✓ (berjalan sebagai dirinya) | ✓ (cakupan maks `catat`, sebagai dirinya) | ✓ (`baca` saja) |
| Undang/keluarkan anggota, ubah peran | ✓ | – | – | – |
| Keamanan ruang, hapus ruang, langganan | ✓ | – | – | – |
| Unduh data | ZIP ruang lengkap | data yang boleh ia lihat | data yang ia catat + dompet pribadinya | data yang boleh ia lihat |
| Dompet pribadi sendiri | ✓ | ✓ | ✓ | ✓ |

5. **Siklus anggota**:
   - **Bergabung**: layar persetujuan anggota memuat pemberitahuan tertulis bahwa pemilik ruang dapat
     menyambungkan **agen AI** (AgentBuff) yang membaca data BERSAMA ruang lewat MCP, dan agen itu memakai
     penyedia AI pilihan pemilik yang **bisa berada di luar Indonesia**; anggota memilih
     `sertakan_di_mcp` (bawaan **tidak** sampai ia memilih). Dicatat `setuju_agen_pada`.
   - **Lupa sandi tanpa SMTP** (K6 opsional): pemilik membuat tautan atur-ulang sekali pakai (24 jam)
     dan menyerahkannya sendiri; dengan SMTP, anggota bisa meminta sendiri. PIN yang terlupa = masuk
     ulang dengan sandi lalu atur PIN baru.
   - **Dikeluarkan/keluar**: akses dicabut seketika (sesi & token miliknya dicabut). Transaksi bersama
     yang ia catat tetap (atribusi "mantan anggota"). **Dompet pribadinya** & transaksinya: anggota
     mendapat tautan unduh 14 hari, lalu dihapus permanen (`permintaan_hapus` jenis
     `anggota_dikeluarkan`) — pemilik tidak pernah mendapatkannya.
   - **Pindah kepemilikan ruang**: tidak didukung (pemilik terikat akun AgentBuff yang membayar). Jalan
     keluar tertulis di bantuan: anggota yang membeli BYM sendiri dapat mengimpor ZIP ekspor ruang ke
     ruang barunya.
6. Uji otomatis: dua ruang uji; setiap endpoint API & setiap tool MCP dipanggil dengan kredensial ruang A
   untuk id milik ruang B → wajib 404/tidak terlihat; dompet pribadi anggota tidak muncul di API, laporan,
   cari, ekspor, MCP, wawasan, maupun sebagai kaki transfer; setiap sel matriks peran diuji (izin & tolak);
   uji "FORCE RLS aktif" membuka koneksi sebagai `bym_migrasi` tanpa konteks → 0 baris.

### 12.4 Enkripsi lampiran
Amplop kunci: per ruang **DEK** acak (AES-256-GCM) dibungkus **KEK** dari env (`ENCRYPTION_KEK`); berkas
disimpan terenkripsi; unduh lewat URL bertanda tangan 5 menit; rotasi KEK didukung (`dek_versi`).
Foto struk dikecilkan di perangkat (maks 2.000 px, JPEG 80) sebelum unggah.

### 12.5 Privasi & kepatuhan operasional
- Persetujuan data keuangan (terpisah dari S&K) dicatat `setuju_data_keuangan_pada`; tanpa itu aplikasi
  tidak menyimpan transaksi.
- **Ekspor swalayan** (ZIP, pekerjaan latar, tautan 24 jam) & **hapus** (tenggang 14 hari → hapus permanen
  baris + lampiran + token; cadangan hilang sesuai siklus retensi).
- **DPIA** (templat): tujuan, jenis data (spesifik: keuangan), subjek, alur data (termasuk agen AI pihak
  pengguna via MCP), risiko (kebocoran, akses anggota, salah catat agen, penyimpanan lampiran), mitigasi
  (bagian 12 ini), lokasi server & dasar transfer, retensi, hak subjek. Wajib selesai sebelum rilis.
- **Runbook insiden** (≤ 3×24 jam): deteksi → isolasi (cabut token, putar kunci) → penilaian lingkup →
  notifikasi pengguna terdampak & otoritas (isi minimum: data apa, kapan, cara, upaya penanganan) → catat.
- Log tidak pernah memuat: jumlah, catatan, nama penerima, token, sandi, isi berkas — termasuk
  **URL**: jangan pernah menaruh jumlah/catatan di query string (tercatat di log NPM/Cloudflare & riwayat
  peramban). Pintasan catat memakai **fragmen** `…/catat#teks=…` yang dibaca di klien (§13).
- Notifikasi push: isi bawaan **tanpa jumlah** ("Tagihan internet jatuh tempo besok"); jumlah hanya bila
  pengguna menyalakan `tampilkan_jumlah` — layar kunci ponsel bisa dilihat orang lain.
- DPIA juga mencakup anggota rumah tangga: pemberitahuan agen AI & kemungkinan pemrosesan di luar negeri
  oleh penyedia AI pilihan pemilik (UU PDP Ps. 56), dengan pilihan anggota `sertakan_di_mcp`.
- Operator tidak punya akses isi transaksi; "akses dukungan" hanya dengan izin pengguna, berbatas 24 jam,
  tercatat di jejak audit yang terlihat pengguna.

---

## 13. API aplikasi (ringkas)

REST JSON di `/api/*`, sesi cookie, zod di batas, galat `{galat, pesan}` (Indonesia) + kode HTTP tepat,
optimistic concurrency via `versi` (409 bila bentrok). Kelompok:
`/api/ruang` · `/api/dompet` · `/api/transaksi` (+ `/cari`, `/massal`, `/split`, `/transfer`) ·
`/api/kategori` · `/api/aturan` (+ `/terapkan`) · `/api/tinjau` · `/api/anggaran` (+ `/pindah`, `/isi-otomatis`) ·
`/api/target` · `/api/berulang` (+ `/kejadian`, `/saran`) · `/api/utang` (+ `/simulasi`) · `/api/arisan` ·
`/api/investasi` (+ `/harga`) · `/api/kekayaan` · `/api/fi` · `/api/laporan/*` · `/api/wawasan` ·
`/api/zakat` · `/api/pajak/daftar-harta` · `/api/impor` (+ `/pratinjau`, `/batal`) · `/api/ekspor` ·
`/api/notifikasi` (+ `/push`) · `/api/anggota` (+ `/undangan`) · `/api/agen/token` · `/api/agen/draf` ·
`/api/agen/aksi` · `/api/keamanan/*` · `/api/agentbuff/mcp-token` · `/api/health` · `/api/ops/*`.
Operasi > 10 dtk (impor, ekspor, terapkan aturan) mengembalikan `202 {pekerjaan_id}` + `GET /api/pekerjaan/:id`.

**Pembaruan hidup** (syarat PRD M22 "< 3 detik" & alur 2 "Beranda langsung berubah"):
`GET /api/peristiwa` = **Server-Sent Events** per sesi: `{jenis:'transaksi'|'anggaran'|'draf'|'beku'|…,
ids}` — hanya id & jenis, tanpa jumlah; pengirim menyaring menurut visibilitas pengguna (dompet pribadi
orang lain tidak pernah memicu peristiwa). Klien meng-invalidasi kueri TanStack terkait. Sumber peristiwa:
`LISTEN/NOTIFY` Postgres dari transaksi yang sudah commit (web & worker). **Denyut komentar SSE tiap
25 dtk** (di balik nginx/NPM `proxy_read_timeout` 90 dtk — pelajaran AgentBuff §0.17) + `X-Accel-Buffering: no`.
Cadangan bila SSE putus: refetch saat fokus jendela + polling 30 dtk di Beranda.

**Pintasan catat**: `…/catat#teks=kopi%2025rb` — fragmen dibaca klien lalu dihapus dari URL
(`history.replaceState`), tidak pernah sampai ke server/log; query `?teks=` diabaikan.

Klien: TanStack Query, kunci kueri per sumber daya, keadaan awal **memuat** (bukan kosong) — pelajaran
AgentBuff "kosong palsu"; nilai awal `useState` tidak pernah membaca `window`/`localStorage` saat render
(galat hidrasi #418) — baca di efek atau lewat prop server.

---

## 14. Pengujian & penjaga

| Jenis | Isi | Kapan |
|---|---|---|
| Unit rumus | semua contoh emas §5 (fixture) | CI & `build` |
| Properti (fast-check) | invarian saldo, transfer, split, impor idempoten (sidik), anggaran total tetap saat seimbangkan ulang, avalanche ≤ snowball, **tepat satu periode per tanggal** (§5.2), hapus→urungkan mengembalikan seluruh keadaan persis (§5.18), `client_ref` sama+argumen sama = 0 tulisan baru & argumen beda = galat | CI |
| Pembukuan | setiap baris tabel §5.17 = fixture: saldo akhir tiap dompet + total belanja/pemasukan persis | CI |
| Parser | korpus §5.3.6 + 200 kalimat tambahan | CI |
| Impor | berkas contoh per bank (disamarkan) → hasil baris yang diharapkan | CI |
| API | per endpoint: auth, peran, isolasi, validasi, beku | CI (DB uji) |
| MCP kontrak | 401 pada token salah di initialize & tools/list; `-32010` beku; cakupan; idempotensi `client_ref`; draf tidak mengubah data; semua tool punya skema & contoh | CI |
| E2E (Playwright) | masuk AgentBuff (mock OIDC di CI; nyata di produksi), orientasi, catat 3 ketukan, transfer + admin, anggaran & aman, target, tagihan, utang simulasi, investasi, impor, ekspor-impor pulang-pergi, rumah tangga & dompet pribadi, beku & pulih, luring→daring | CI + produksi (akun uji) |
| Aksesibilitas | axe tanpa pelanggaran serius; **penjaga kontras** dari `getComputedStyle` (termasuk di atas gradien: stop terburuk) di 2 tema; papan ketik; 320 px tanpa gulir mendatar; teks 200% | CI |
| Visual | 320/375/768/1024/1440/1920 × 2 tema untuk layar utama | per rilis |
| Kinerja | Lighthouse CI budget; kueri dengan 50.000 transaksi | per rilis |
| Hidrasi | tidak ada galat React #418/#419/#422/#423/#425 di semua rute | CI |
| Bukti produksi (`scripts/prove-*.ts`) | alur AgentBuff sungguhan (beli → masuk → sambung otomatis `tersambung` → chat WA → BYM), dengan akun uji sekali-pakai dan pembersihan; data ruang lain identik sebelum/sesudah | per rilis |

**`scripts/jaga.mjs`** (dipanggil `build`): naskah-keras (teks tanpa kamus = gagal), kontras statis kelas
tema, pola uang (`toFixed`/float untuk uang dilarang), `server-only` tidak diimpor modul yang dipakai
worker/tsx, matcher proxy literal, semua tool MCP terdaftar punya deskripsi & skema & contoh, semua
angka regulasi dibaca dari setelan (bukan literal). **Setiap penjaga wajib punya uji-diri yang membuktikan
ia bisa gagal** (pelajaran AgentBuff: penjaga yang tak bisa gagal lebih buruk daripada tidak ada).

---

## 15. Impor — rincian format

- **CSV/XLSX generik**: deteksi pemisah & encoding (UTF-8/Windows-1252), deteksi kolom tanggal
  (`dd/mm/yyyy`, `dd-mm-yy`, `yyyy-mm-dd`, `dd MMM yyyy` Indonesia/Inggris), jumlah (`1.250.000,00` /
  `1,250,000.00` / kolom debit-kredit terpisah / akhiran `DB`/`CR`), keterangan → penerima_mentah;
  pemetaan tersimpan per dompet.
- **Preset**: BRImo CSV, Livin' Mandiri XLSX, KlikBCA CSV (bila tersedia), GoPay laporan (bila tersedia),
  aplikasi lain (Money Lover, Money Manager, Spendee, Wallet, Finku) — masing-masing dengan berkas contoh
  di `tests/fixtures/impor/` (data disamarkan) dan versi parser.
- **PDF e-statement** (di perangkat, pdf.js): ekstraksi teks per halaman → deteksi bank dari header →
  parser bank berversi (BCA, BRI, Mandiri, BNI, Jago, Jenius, SeaBank, blu, CIMB Niaga) → baris.
  Password diminta di perangkat, dipakai di memori, tidak dikirim/disimpan. PDF hasil pindai (gambar) →
  "format tidak didukung, coba CSV/Excel atau kirim ke agen".
- **AKSes KSEI** (portofolio): laporan bulanan → kepemilikan (kode efek, jumlah, nilai) sebagai
  penyesuaian kepemilikan per tanggal.
- Semua impor berakhir di pratinjau → simpan → `perlu_ditinjau`, satu batch = satu `impor` yang bisa dibatalkan.
- Setiap baris mendapat `sidik_impor` (§5.16) — itulah yang membuat "impor ulang berkas yang sama = 0
  transaksi baru" deterministik walau bank tidak mencantumkan nomor referensi.
- Baris bertanggal sebelum `tanggal_saldo_awal` dompet → pilihan hitung-mundur saldo awal (§5.4) di
  langkah pratinjau.

---

## 16. Luring & sinkron

- Service worker menyimpan cangkang aplikasi + data terakhir (Beranda, dompet, kategori, 200 transaksi
  terakhir) di IndexedDB perangkat pengguna. Data ini tidak dienkripsi terpisah; perlindungannya adalah
  kunci aplikasi (PIN/passkey) + tombol "Hapus data di perangkat ini" saat keluar (otomatis saat
  "Keluar dari semua perangkat").
- Catat Cepat luring → antrean IndexedDB dengan `id` UUID buatan klien + `client_ref`, teks asli,
  hasil parse klien, **`ditangkap_pada` (waktu perangkat) + zona waktu perangkat**; sinkron saat daring
  (latar/saat dibuka). Server mengurai ulang teksnya dengan "sekarang" = `ditangkap_pada` (jadi
  "kemarin" yang diketik Senin malam tetap Minggu walau baru sinkron Rabu); bila jam perangkat meleset
  > 24 jam dari waktu terima, pakai waktu terima + tandai perlu ditinjau. Server idempoten (tabel
  `idempotensi`, alat `app:luring`) → tidak pernah dobel; konflik (dompet dihapus) → masuk Perlu ditinjau
  dengan catatan; ruang beku → tetap di antrean (§6.3).
- Indikator "Luring · 3 catatan menunggu sinkron" di bilah atas.

---

## 17. Pelajaran AgentBuff yang WAJIB dibawa

1. Next 16: berkas proxy di **`src/proxy.ts`**, `matcher` literal; baca docs lokal Next sebelum menulis pola Next.
2. Jangan `import "server-only"` di modul yang dijalankan tsx/worker.
3. Nilai awal `useState` jangan membaca `window`/`localStorage` (hidrasi #418).
4. Keadaan awal data = memuat, bukan kosong ("kosong palsu").
5. Permintaan HTTP > 60 dtk dilarang di balik proxy (504 walau sukses) → pekerjaan latar.
6. Tidak ada `drizzle push` di produksi; migrasi aditif; hitung baris sebelum/sesudah deploy.
7. Penjaga harus bisa gagal (uji-diri); asersi UI dwibahasa; bukti di peramban sungguhan, bukan menembak API saja.
8. Akun/ruang uji sekali-pakai untuk uji perusak; bersihkan jejak (termasuk transaksi uji).
9. Berkas yang dieksekusi Linux (skrip shell, Dockerfile) wajib LF (`.gitattributes`).
10. Batas waktu + SIGKILL + `exec` untuk proses anak (tidak ada proses yatim).
11. Ganti env container = `up -d`, bukan `restart`.
12. Warna teks tanpa varian tema hanya benar di satu tema → kontras diukur di kedua tema.
13. Catatan perubahan berbahasa sehari-hari di `docs/LAPORAN-PERUBAHAN.md` setiap perubahan yang dirasakan pengguna.
