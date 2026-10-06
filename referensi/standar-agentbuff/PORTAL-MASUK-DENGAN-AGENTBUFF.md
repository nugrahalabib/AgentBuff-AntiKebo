# Masuk dengan AgentBuff

Penyedia identitas OpenID Connect milik AgentBuff untuk aplikasi mitra (KostCloud, Absentra, Kasir POS).

- **Pemilik usaha** masuk ke aplikasi mitra dengan akun AgentBuff-nya. Ia hanya boleh masuk selama akunnya tidak diblokir, langganan atau trialnya aktif, dan ia memiliki produk aplikasi itu di Marketplace.
- **Karyawan dan admin** yang dibuat pemilik tetap masuk dengan akun buatan pemilik di aplikasinya. Mereka tidak lewat AgentBuff.

Dibangun 2026-09-28. Issuer-nya sengaja terpisah dari authorization server MCP admin (`/oauth/*`), sehingga sambungan ChatGPT/Claude ke panel admin tidak tersentuh.

## Alamat

| | |
|---|---|
| Issuer | `https://agentbuff.id/masuk` |
| Discovery | `https://agentbuff.id/masuk/.well-known/openid-configuration` |
| Authorize | `https://agentbuff.id/masuk/authorize` |
| Token | `https://agentbuff.id/masuk/token` |
| Userinfo | `https://agentbuff.id/masuk/userinfo` |
| JWKS | `https://agentbuff.id/masuk/jwks` |
| Status (khusus mitra) | `https://agentbuff.id/masuk/status` |

## Alur login (authorization code + PKCE)

1. Aplikasi mengalihkan ke `/masuk/authorize` dengan parameter berikut:
   - `response_type=code`
   - `client_id`
   - `redirect_uri`, yang harus **persis** sama dengan yang terdaftar
   - `scope=openid email profile`
   - `state`, wajib diisi
   - `code_challenge` dan `code_challenge_method=S256`, wajib diisi
   - `nonce`, disarankan
2. AgentBuff menjalankan urutan ini:
   - Pengguna yang belum masuk AgentBuff dibawa ke `/login` lebih dulu.
   - Pengguna yang tidak berhak melihat layar penjelasan beserta tombol untuk memperbaikinya (beli produk / perpanjang / aktifkan). Tautan "Kembali ke aplikasi" membawa `error=access_denied&error_description=<alasan>`.
   - Pada kunjungan pertama ke aplikasi itu, AgentBuff menampilkan layar konfirmasi "Masuk ke X sebagai email".
   - Sesudahnya, pengguna langsung dikembalikan dengan `?code=…&state=…&iss=…`.
   - `prompt=select_account` memaksa layar konfirmasi muncul lagi, termasuk tombol "Pakai akun lain".
3. Aplikasi menukar kodenya di `POST /masuk/token`:
   - Autentikasi aplikasi memakai `client_secret_basic` (disarankan) atau `client_secret_post`.
   - Parameter badannya: `grant_type=authorization_code`, `code`, `redirect_uri`, dan `code_verifier`.
   - Jawabannya berisi `id_token`, `access_token` (15 menit), `expires_in`, dan `scope`. Tidak ada refresh token.
4. Aplikasi memeriksa `id_token`. Token ini diterima langsung dari token endpoint lewat TLS (OIDC Core §3.1.3.7), jadi yang wajib diperiksa adalah `iss`, `aud == client_id`, `exp`, dan `nonce`. Pemeriksaan tanda tangan ES256 lewat JWKS disarankan.

### Klaim id_token

| Klaim | Isi |
|---|---|
| `sub` | Identitas **pairwise** acak per (pengguna, aplikasi), misalnya `abs_…`. Nilainya tetap selamanya. **Simpan ini sebagai kunci akun pemilik.** |
| `email` | Selalu email Google yang terverifikasi. |
| `email_verified` | Selalu `true`. |
| `name`, `picture` | Nama dan foto akun. |

Uid AgentBuff tidak pernah dikirim ke aplikasi mitra.

## Pemeriksaan berkala: `POST /masuk/status`

Endpoint ini dipakai untuk membekukan usaha ketika pemiliknya berhenti berlangganan. Panggilannya server-ke-server dengan autentikasi aplikasi yang sama seperti token endpoint.

- Badan permintaan: `{ "sub": "abs_…" }`. Untuk pemilik lama yang belum pernah masuk lewat AgentBuff, pakai `{ "email": "…" }`.
- Jawaban: `{ aktif, alasan, pesan, sub? }`.

| `alasan` | Arti |
|---|---|
| `ok` | Berhak |
| `akses_berakhir` | Langganan atau trial habis |
| `belum_aktif` | Belum pernah memulai trial/langganan |
| `belum_beli` | Tidak memiliki produk ini |
| `diblokir` | Akun diblokir admin |
| `dicabut` | Pemilik memutus sambungan aplikasi ini dari AgentBuff |
| `tidak_dikenal` | `sub`/email tidak dikenal |

- Jalur `email` hanya mengembalikan `sub` bila pemiliknya berhak. Simpan `sub` itu, lalu pakai `sub` untuk pemeriksaan berikutnya.
- Rekomendasi cache: 10 menit, dengan toleransi 1 jam kalau AgentBuff tidak terjangkau. Pola ini sama dengan gerbang lama.
- **Data tidak pernah dihapus** karena status. Aplikasi hanya menahan akses.

## Sambung MCP otomatis: `POST <aplikasi>/api/agentbuff/mcp-token`

Supaya pemilik **tidak menempel token MCP manual**: sesudah pembelian (atau
sesudah pemilik masuk ke aplikasi lewat AgentBuff), SERVER AgentBuff meminta
token MCP biasa ke aplikasi, lalu memasangnya sendiri di konektor agen pemilik.
Token itu token aplikasi yang biasa (tabel token MCP aplikasi, audit, batas
laju, cabut dari UI aplikasi tetap berlaku) — AgentBuff hanya perantara.

**Permintaan** (server-ke-server, dari AgentBuff):

```
POST https://<aplikasi>/api/agentbuff/mcp-token
Authorization: Bearer <assertion>
Content-Type: application/json

{}
```

**Assertion** = JWT ES256 yang ditandatangani kunci Masuk AgentBuff (kunci yang
sama dengan id_token; kunci publik di `https://agentbuff.id/masuk/jwks`).

| Bagian | Nilai | Wajib diperiksa aplikasi |
|---|---|---|
| header `alg` | `ES256` | ya (tolak selainnya) |
| header `typ` | `mcp-token+jwt` | ya |
| header `kid` | dari JWKS | ya (ambil JWKS bila kid tak dikenal) |
| `iss` | `https://agentbuff.id/masuk` | ya |
| `aud` | client_id aplikasi (`kostcloud` / `absentra` / `pos`) | ya |
| `purpose` | `mcp_token` | ya — **id_token biasa tidak punya klaim ini dan WAJIB ditolak** |
| `sub` | sub pairwise pemilik (`abs_…`) | cocokkan `agentbuff_sub` |
| `email` + `email_verified: true` | email akun AgentBuff | cadangan untuk pemilik lama yang belum punya `agentbuff_sub` (lalu simpan `sub`) |
| `iat` / `exp` | umur ≤ 120 detik | ya (toleransi jam ±60 dtk) |
| `jti` | acak | tolak yang sudah pernah dipakai (simpan ≥ 5 menit) |

**Yang dilakukan aplikasi:**
1. Verifikasi seluruh tabel di atas.
2. Cari PEMILIK: `agentbuff_sub = sub`, lalu email (hanya akun berperan pemilik). Cocok lewat email → simpan `sub`.
3. Periksa hak lewat gerbang yang sudah ada (`/masuk/status`, cache boleh). Tidak berhak → 403.
4. Terbitkan token MCP biasa untuk usaha pemilik itu dengan label **`AgentBuff (otomatis)`**, cakupan penuh (termasuk izin membuat draf — draf tetap menunggu persetujuan pemilik di aplikasi). Token otomatis sebelumnya milik pemilik yang sama **dicabut** (satu token otomatis per pemilik).
5. Catat di jejak audit aplikasi (siapa: AgentBuff otomatis).

**Jawaban:**

| Status | Badan | Arti |
|---|---|---|
| 200 | `{ "token": "…", "expires_at": "ISO" \| null, "tenant_name": "…" }` | berhasil |
| 401 | `{ "error": "assertion_invalid" }` | tanda tangan/klaim salah, kedaluwarsa, jti diputar ulang |
| 403 | `{ "error": "tidak_berhak", "reason": "<alasan status>" }` | hak pemilik tidak aktif |
| 404 | `{ "error": "belum_ada_akun" }` | pemilik belum pernah membuka aplikasi / belum punya usaha — AgentBuff mencoba lagi nanti |
| 429 | `{ "error": "terlalu_sering" }` | batas laju (cukup 10/menit per pemilik) |

- Token dari jawaban **tidak pernah dicatat** di log aplikasi maupun AgentBuff.
- Absentra (satu pemilik bisa punya beberapa perusahaan): pilih perusahaan AKTIF terbaru tempat ia pemilik; `tenant_name` memberi tahu pengguna perusahaan mana yang tersambung.
- Kasir POS: toko lama (gerbang_agentbuff = false) boleh dilayani hanya bila pemiliknya cocok lewat sub/email — hanya MENAMBAH satu token, tidak mengubah data toko.
- Alamat endpoint disimpan per aplikasi di `masuk_aplikasi.mcp_token_url`.

## Pendaftaran aplikasi

```bash
pnpm tsx --env-file=.env.local scripts/masuk-daftar-aplikasi.ts \
  --client-id kostcloud --nama "KostCloud" --produk kostcloud \
  --beranda https://kos.agentbuff.id \
  --redirect https://kos.agentbuff.id/auth/agentbuff/callback \
  --simpan-rahasia /root/masuk-rahasia/kostcloud.env
```

- Rahasia klien hanya ditulis ke berkas `--simpan-rahasia` (mode 600). Nilainya tidak pernah dicetak.
- `--putar-rahasia` mengganti rahasia lama.
- Kunci penanda tangan dibuat sekali dengan `scripts/masuk-buat-kunci.ts .env.local`.

## Keamanan

- Aplikasi atau redirect yang tidak dikenal menampilkan galat **di tempat**. Pengguna tidak pernah dialihkan, supaya tidak ada open redirect.
- Kode otorisasi berlaku 5 menit, sekali pakai (klaim atomik), dan terikat pada aplikasi, redirect, dan PKCE.
- Hak diperiksa di pintu, diperiksa lagi saat konfirmasi, lalu diperiksa berkala lewat status.
- CSP halaman konfirmasi membawa `form-action` untuk origin `redirect_uri`, karena Chrome menegakkannya pada 303 (§0.48).
- Penjaga: `scripts/cek-masuk-agentbuff.ts` (masuk `jaga`). Bukti hidup: `scripts/prove-masuk-agentbuff.ts`.
