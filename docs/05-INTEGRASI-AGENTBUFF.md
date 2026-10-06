# Integrasi AgentBuff, rilis, dan deploy

Sumber: kode `referensi/template-tuya/`, dokumen `referensi/standar-agentbuff/`
(`PORTAL-MASUK-DENGAN-AGENTBUFF.md`, `PORTAL-ALUR-PEMBAYARAN.md`, `BYM-TEKNIS.md` §6, §8 sampai §10).
Identitas produk AntiKebo:

| | |
|---|---|
| `product_key` / client id | `antikebo` (produksi), `antikebo-dev` (redirect localhost) |
| Domain | `antikebo.agentbuff.id` |
| Harga | `priceRp: 29_000`, `billing: "one_time"`, `unlock: "app"`, `source: "mcp"` |
| Prefiks token MCP | `antikebo_` |
| Folder VPS | `/opt/antikebo` |

## 1. Masuk dengan AgentBuff (OIDC)

- Issuer `https://agentbuff.id/masuk` (discovery, authorize, token, userinfo, jwks, `/status`).
- Kode otorisasi + PKCE S256, `client_secret_basic`, id_token ES256, tanpa refresh token.
- `sub` berpasangan per (pengguna, aplikasi) dan permanen: jadikan kunci akun (`agentbuff_sub`).
- Salin dari template: `src/lib/agentbuff/oidc.ts`, `src/app/auth/agentbuff/{start,callback}`,
  `src/lib/auth/sesi.ts`. Ganti nama kuki (`__Host-antikebo_oidc`, `__Host-antikebo_s`).
- Callback: bangun ulang URL publik dari `APP_ORIGIN`, cari pengguna lewat `sub`, cek hak
  **ketat**, buat sesi, tulis audit.
- Alasan tolak di `/masuk`: `diblokir`, `belum_aktif`, `akses_berakhir`, `belum_beli`,
  `dicabut`, `tidak_dikenal`.

## 2. Cek hak beli

- Salin `src/lib/agentbuff/{status,tafsir,tautan-beku}.ts`: `POST ${AGENTBUFF_ISSUER}/status`
  dengan Basic auth, cache 10 menit + jitter, ketat saat login dan token MCP pertama, 72 jam
  bertahan kalau AgentBuff tidak bisa dihubungi, pemutus sirkuit pembekuan massal, batas laju.
- Hak = tidak diblokir + akses AgentBuff aktif + punya hak produk `antikebo`.
- Saat beku: lihat PRD A3 dan `KEPUTUSAN.md` K-07. Worker juga wajib cek hak sebelum
  membunyikan (dengan aturan masa tenggang yang diputuskan).

## 3. MCP dan sambung otomatis

- `/mcp` stateless, 401 + `WWW-Authenticate` sebelum JSON-RPC diurai, batas laju per token,
  batas badan 256 KB, `error_code` terstruktur. Pola `src/lib/mcp/{server,dasar,alat}.ts`.
- `POST /api/agentbuff/mcp-token`: terima asersi ES256 dari portal (`typ=mcp-token+jwt`,
  `aud=antikebo`, `purpose=mcp_token`, umur ≤ 120 dtk, `jti` sekali pakai), buat pengguna bila
  baru, cek hak, terbitkan token 90 hari "AgentBuff (otomatis)". Pola `src/lib/agen/otomatis.ts`.
- `skill/SKILL.md` pendamping dengan frontmatter `name` dan `description` berisi kata kunci
  Indonesia. Diunggah oleh skrip siapkan di portal.
- Agen yang sudah berjalan baru melihat alat baru setelah dimuat ulang: `deploy.sh` wajib
  menjalankan skrip siapkan di VPS (seperti langkah 6 deploy Tuya).

## 4. Yang harus dikerjakan di repo portal (AgentBuff-Final)

Dikerjakan dari **laptop Chief** pada paket kerja Rilis, karena butuh repo portal dan VPS.
Sesi cloud boleh menyiapkan berkasnya di `integrasi-portal/` di repo ini supaya tinggal disalin.

1. `scripts/siapkan-antikebo.ts`, salinan `siapkan-tuya.ts` (lihat
   `referensi/standar-agentbuff/portal-siapkan-tuya.ts.txt`): idempoten, status `coming_soon`
   kecuali `--terbitkan`, tidak pernah menurunkan produk yang sudah dijual. Isi: kategori
   `produktivitas`, aksen yang cocok (mis. `amber`), ikon, `capabilities` (≤ 12, ≤ 160 huruf),
   `tagline` (≤ 120), `description` (≤ 2000), versi Inggris `*En`, `tutorial`/`tutorialEn`.
   Urutan panggilan: katalog, lalu `/mcp` (`url: https://antikebo.agentbuff.id/mcp`,
   `tokenHeader: Authorization`, `tokenPrefix: "Bearer "`), lalu paket `SKILL.md`.
2. Ikon: bila memakai ikon baru (mis. `AlarmClock`), tambahkan ke `ICONS` di
   `src/components/app/tabs/shop-tab.tsx` lalu deploy portal.
3. Daftarkan klien OIDC di VPS (`/root/agentbuff`), setelah baris katalog ada:
   ```
   pnpm tsx --env-file=.env.local scripts/masuk-daftar-aplikasi.ts --client-id antikebo --nama "AntiKebo" --produk antikebo --beranda https://antikebo.agentbuff.id --redirect https://antikebo.agentbuff.id/auth/agentbuff/callback --simpan-rahasia /root/masuk-rahasia/antikebo.env
   ```
   Ulangi untuk `antikebo-dev` dengan redirect `http://localhost:<port>/auth/agentbuff/callback`.
   Jangan pernah mendaftarkan localhost di klien produksi.
4. Nyalakan sambung otomatis setelah aplikasi hidup dan endpoint token lolos uji:
   `pnpm tsx --env-file=.env.local scripts/masuk-mcp-otomatis-url.ts antikebo https://antikebo.agentbuff.id/api/agentbuff/mcp-token`
5. Uji sendiri selama `coming_soon`: `scripts/hibah-produk.ts <email> antikebo <bulan>`
   (hanya akun admin atau `@uji.internal`).
6. Skrip bukti `scripts/prove-antikebo-beli.ts` meniru `prove-tuya-beli.ts`: katalog dan halaman
   publik benar, masuk ditolak sebelum beli, beli lewat sandbox + webhook bertanda tangan, masuk
   peramban sampai layar orientasi, token MCP otomatis menampilkan alat. Jalankan di VPS
   (`pnpm tsx ... > /tmp/x.log 2>&1`, jangan dipipa ke `head`/`tail`).
7. Gambar listing: 3 buah 1600×900 dari tangkapan layar demo asli (pola `gambar-bym.ts`),
   unggah lewat `/api/admin/media`, lalu PATCH `coverImageUrl` dan `galleryImages`.
8. Terbitkan dengan `--terbitkan` hanya setelah `docs/GERBANG-RILIS.md` lolos.
9. Tambah entri di `Docs/LAPORAN-PERUBAHAN.md` portal dan `docs/LAPORAN-PERUBAHAN.md` repo ini.

Catatan Chief: Midtrans masih sandbox untuk semua produk, jadi belum ada uang sungguhan masuk
sampai kunci produksi dipasang.

## 5. Deploy ke VPS

Pola persis template Tuya (`referensi/template-tuya/deploy/`):

- `/opt/antikebo/app` (clone git, kunci deploy baca-saja `~/.ssh/antikebo_deploy`),
  `/opt/antikebo/.env` (mode 600, dibuat `deploy/pasang-pertama.sh`), `/opt/antikebo/data/pg`.
- Docker compose: `antikebo-db` (postgres:16-alpine + initdb peran), `antikebo-web` (jaringan
  internal + `npm_default`, tanpa port terbuka, healthcheck `/api/health`), `antikebo-worker`.
  `restart: unless-stopped`.
- Domain: Chief menambah DNS `antikebo` di Cloudflare, proxy lewat Nginx Proxy Manager
  (`npm-app-1`), sertifikat Let's Encrypt dengan cron perpanjang dari `pasang-pertama.sh`.
- `bash deploy/deploy.sh` dari laptop **setelah push**: tolak bila HEAD bukan `origin/main`,
  cadangan DB (gagal = batal), hitung baris, build image ber-tag sha, migrasi dengan peran
  migrasi, gerbang RLS `deploy/uji-rls.sql`, nyalakan web + worker, tunggu sehat, hitung ulang
  baris (gagal bila ada tabel menyusut), jalankan `siapkan-antikebo.ts` di VPS.
- Cadangan tiap 6 jam, simpan 14 hari di `/var/lib/antikebo/backups/harian`.
- Tes pulih (`uji-pulih.sh` pola BYM).

## 6. Letak rahasia di VPS

| Apa | Di mana |
|---|---|
| Env aplikasi | `/opt/antikebo/.env` (600) |
| Rahasia klien OIDC | `/root/masuk-rahasia/antikebo.env` (600) |
| Env portal | `/root/agentbuff/.env.local` |
| Cadangan | `/var/lib/antikebo/backups/harian/` |

Rahasia tidak pernah dicetak, dicatat, atau masuk repo.
