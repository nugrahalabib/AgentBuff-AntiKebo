# Integrasi AgentBuff (versi 2)

Sumber pola: `referensi/template-tuya/` dan `referensi/standar-agentbuff/`
(`PORTAL-MASUK-DENGAN-AGENTBUFF.md`, `PORTAL-ALUR-PEMBAYARAN.md`).

| Identitas | Nilai |
|---|---|
| product key / client id | `antikebo` (produksi), `antikebo-dev` (redirect localhost) |
| Domain | `antikebo.agentbuff.id` |
| Harga | Rp29.000, sekali bayar |
| Prefiks token MCP | `antikebo_` |
| Issuer | `https://agentbuff.id/masuk` (env `AGENTBUFF_ISSUER`) |

## 1. Masuk dengan AgentBuff (sudah ada di AgentBuff)

- OIDC kode otorisasi + PKCE S256, `client_secret_basic`, id_token ES256, tanpa refresh token.
- `sub` berpasangan per (pengguna, aplikasi), permanen = kunci akun (`agentbuff_sub`).
- Salin dari template: `src/lib/agentbuff/oidc.ts`, `src/app/auth/agentbuff/{start,callback}`,
  `src/lib/auth/sesi.ts`. Kuki `__Host-antikebo_oidc`, `__Host-antikebo_s`. Sesi panjang (30 hari
  bergulir) supaya pengguna tidak dilempar ke login saat setengah sadar.
- **Scope:** `openid email profile agentbuff:kabar agentbuff:suara`. Dua scope terakhir tampil di
  layar persetujuan AgentBuff sebagai izin (lihat PRD A3). Bila belum diberi, pintu §4 dan §5
  menjawab `belum_diizinkan`; tombol "Beri izin" di AntiKebo mengulang login dengan
  `prompt=consent`.

## 2. Cek hak (sudah ada)

- `POST ${AGENTBUFF_ISSUER}/status` (Basic auth klien, badan `{sub}`). Salin
  `src/lib/agentbuff/{status,tafsir,tautan-beku}.ts` dari template.
- Status disimpan 10 menit + jitter. Bila AgentBuff tidak terjangkau, keputusan terakhir dipakai
  sampai 72 jam (K-12): alarm tidak boleh gagal hanya karena AgentBuff sedang gangguan.
- Dicek di: halaman, API, MCP, token perangkat PC, worker (sebelum membunyikan; hasil negatif
  pasti = tidak berbunyi + pemberitahuan malam sebelumnya, lihat K-07).

## 3. MCP dan sambung otomatis (sudah ada polanya)

- `/mcp` stateless, 401 + `WWW-Authenticate` sebelum JSON-RPC diurai, batas laju, badan maks
  256 KB, `error_code` terstruktur (pola `src/lib/mcp/{server,dasar,alat}.ts`).
- `POST /api/agentbuff/mcp-token`: asersi ES256 dari AgentBuff (`typ=mcp-token+jwt`,
  `aud=antikebo`, `purpose=mcp_token`, umur ≤ 120 dtk, `jti` sekali pakai) → token 90 hari
  "AgentBuff (otomatis)". Pola `src/lib/agen/otomatis.ts`.
- `skill/SKILL.md` pendamping. Agen yang sudah berjalan baru melihat alat baru setelah dimuat
  ulang; skrip siapkan di AgentBuff mengurusnya saat deploy.

## 4. Pintu BARU: daftar kanal dan kirim pesan

**Status: rancangan, dibangun di repo AgentBuff (sesi laptop, paket L1).** Selama belum ada,
AntiKebo memakai server tiruan `tests/tiruan/agentbuff.ts` yang mengikuti kontrak ini persis
(`AGENTBUFF_TIRUAN=1`, `pnpm tiruan`). Klien AntiKebo: `src/lib/agentbuff/pintu.ts`; uji kontraknya
`tests/integrasi/tiruan-kontrak.test.ts` menjadi acuan L1 ("lolos tes yang sama terhadap pintu
asli"). Bila AgentBuff mengubah kontrak, dokumen ini diperbarui lebih dulu.

Semua pintu: `POST`, autentikasi Basic klien (sama dengan `/status`), badan JSON, jawaban JSON
kecuali disebut lain. Galat umum:

| HTTP | `alasan` | Arti |
|---|---|---|
| 400 | `permintaan_tidak_sah` | Badan bukan objek JSON, isian wajib hilang, atau `gaya`/`bahasa` tidak dikenal |
| 401 | `klien` | Kredensial klien salah |
| 403 | `tidak_berhak` | Hak AntiKebo pengguna tidak aktif |
| 403 | `belum_diizinkan` | Scope izin belum diberi pengguna (`kanal`/`kabar`: `agentbuff:kabar`; `suara`: `agentbuff:suara`) |
| 404 | `tidak_dikenal` | `sub` tidak dikenal |
| 503 | `agen_tidak_aktif` | Mesin agen pengguna sedang mati; coba lagi nanti (hanya `kabar` dan `suara`) |

Urutan pemeriksaan (K-25): kredensial klien, badan, `sub`, hak, izin, lalu aturan pintu itu.
Badan galat selalu `{ "alasan", "pesan"? }`; AntiKebo memperlakukan `alasan` yang tidak dikenal dan
jawaban yang tidak bisa dibaca sebagai "tidak terjangkau" (aman untuk dicoba lagi).

### 4.1 `POST /masuk/kanal`

Badan `{ "sub": "..." }` → 

```json
{ "kanal": [
  { "id": "k_7f3a", "platform": "telegram", "label": "Telegram · bot Buff",
    "agen": "Buff", "siap": true },
  { "id": "k_19bc", "platform": "whatsapp", "label": "WhatsApp · Rani",
    "agen": "Rani", "siap": false, "alasan": "Belum pernah ada chat masuk dari kamu" }
] }
```

`id` stabil selama kanal itu ada. `platform`: `telegram`, `whatsapp`, `discord`, `slack`,
`google_chat`. Pesan dikirim ke **chat pribadi pemilik** di kanal itu, bukan ke orang lain.

### 4.2 `POST /masuk/kabar`

Badan `{ "sub", "kanal": "k_7f3a", "teks": "...", "kunci": "kej_123:spam:7" }`.
`teks` ≤ 1000 huruf (teks polos, tautan boleh). `kunci` ≤ 64 huruf untuk idempotensi (kunci sama
dalam 24 jam = tidak dikirim dua kali).

- 200 `{ "ok": true, "id": "..." }`; kunci idempoten yang sama dalam 24 jam = 200 dengan `id` yang
  sama tanpa mengirim lagi (tidak terkena batas jeda).
- 409 `{ "alasan": "kanal_tidak_siap", "pesan": "..." }` (juga bila `kanal` sudah tidak ada)
- 422 `{ "alasan": "teks_tidak_sah" }` (teks kosong atau > 1000 huruf)
- 429 `{ "alasan": "terlalu_cepat", "ulangiSetelahMs": 4000 }`

Batas minimal antar pesan per kanal ditegakkan AgentBuff: Telegram 5 dtk, Discord/Slack/Google
Chat 15 dtk, WhatsApp 30 dtk.

## 5. Pintu BARU: suara

### 5.1 `POST /masuk/suara/daftar`

Badan `{ "sub", "bahasa": "id" }` →

```json
{ "penyedia": "edge", "bawaan": "id-ID-GadisNeural",
  "suara": [ { "id": "id-ID-GadisNeural", "nama": "Gadis", "gender": "perempuan" },
             { "id": "id-ID-ArdiNeural", "nama": "Ardi", "gender": "laki-laki" } ] }
```

`penyedia` mengikuti pengaturan suara pengguna di AgentBuff (sama dengan Telepon Agent).

### 5.2 `POST /masuk/suara`

Badan `{ "sub", "teks": "...", "gaya": "galak", "suara": "id-ID-ArdiNeural", "bahasa": "id" }`.
`teks` ≤ 300 huruf; `gaya`: `galak` atau `biasa`; `suara` opsional (bawaan pengguna; id yang tidak
dikenal juga memakai bawaan, header `X-AgentBuff-Suara` menyebut suara yang benar-benar dipakai).

- 200: badan = berkas audio (`audio/ogg` atau `audio/mpeg`), header `X-AgentBuff-Penyedia`,
  `X-AgentBuff-Suara`, `X-AgentBuff-Durasi-Ms`.
- 422 `{ "alasan": "teks_tidak_sah" }`
- 429 `{ "alasan": "kuota", "ulangiSetelahMs": ... }` (kuota harian per pengguna, bawaan 300 klip)
- 502 `{ "alasan": "penyedia_gagal", "pesan": "..." }` (mis. layanan suara menolak)

AntiKebo **tidak pernah** menerima atau menyimpan kunci API suara pengguna. Gaya `galak`
diterjemahkan AgentBuff ke setelan penyedia (kecepatan, nada, volume, atau instruksi gaya).

## 6. Tugas di repo AgentBuff (bukan sesi cloud)

Dikerjakan sesi laptop di repo AgentBuff (privat). Rinciannya ada di sana. Ringkasnya:

- L1: pintu §4 dan §5 + scope izin + batas laju + uji.
- Rilis: katalog produk (status `coming_soon` dulu), klien OIDC `antikebo` dan `antikebo-dev`,
  sambung MCP otomatis, hibah produk ke akun Chief untuk uji, ikon toko bila baru, skrip bukti
  `prove-antikebo-beli`, gambar listing, terbitkan setelah `GERBANG-RILIS.md` hijau.

Sesi cloud boleh menyiapkan bahannya di `integrasi-portal/` (teks listing id/en, `SKILL.md`,
draf skrip bukti) supaya tinggal dipakai.

## 7. Deploy

Pola persis template (`referensi/template-tuya/deploy/`): compose `antikebo-db`, `antikebo-web`,
`antikebo-worker`; `deploy/deploy.sh` dari laptop sesudah push (cadangan, hitung baris, migrasi
aditif, gerbang RLS, sehat, hitung ulang). Unduhan aplikasi PC dilayani `antikebo-web` dari
berkas rilis yang diunggah langkah deploy. Detail lokasi di server tidak ditulis di repo publik.
