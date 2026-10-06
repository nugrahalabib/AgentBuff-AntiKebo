# Arsitektur AntiKebo

Dasar: salin pola `referensi/template-tuya/` (lihat `05-INTEGRASI-AGENTBUFF.md` untuk bagian
AgentBuff). Dokumen ini menjelaskan apa yang **baru** untuk AntiKebo. Kalau ada konflik antara
dokumen ini dan kode template, ikuti konvensi template kecuali disebut lain di sini.

## 1. Komponen

| Kontainer | Isi |
|---|---|
| `antikebo-web` | Next.js 16 (App Router, `output: "standalone"`): halaman, API `/api/app/*`, `/mcp`, `/auth/agentbuff/*`, `/api/agentbuff/mcp-token`, webhook Telegram, SSE `/api/peristiwa` |
| `antikebo-worker` | Proses Node terpisah (dibundel esbuild): penjadwal, Tangga Bangun, pengirim saluran, sinkron perangkat Tuya, detak jantung, pembersihan |
| `antikebo-db` | Postgres 16, data di `/opt/antikebo/data/pg` |

Stack sama dengan template: TypeScript ketat, Tailwind v4, Radix, Lucide, zustand, zod 4,
Drizzle 0.45 (`postgres`), `openid-client`, `jose`, `@modelcontextprotocol/server` stateless,
`pino`, Vitest 4, `@electric-sql/pglite`, `fast-check`. Tambahan: `web-push`, pustaka zona waktu
yang teruji (`date-fns` v4 + `@date-fns/tz`), pustaka pindai QR/barcode untuk cadangan iPhone.

## 2. Model data (ringkas)

Nama tabel/kolom bahasa Indonesia, `snake_case`. Semua tabel yang punya `pengguna_id` wajib RLS
ENABLE + FORCE dan lolos guard `rls`. Waktu disimpan `timestamptz` (UTC).

| Tabel | Isi penting |
|---|---|
| `pengguna` | `agentbuff_sub` (unik), zona waktu, bahasa, tingkat bawaan, status hak terakhir |
| `sesi`, `token_mcp`, `jti_terpakai`, `audit` | Sama dengan template |
| `sambungan_tuya` | kunci `sk-` tersandi amplop (AAD `tuya:<pengguna_id>`), wilayah, status, nomor telepon tujuan |
| `perangkat_tuya` | Cermin perangkat: id Tuya, nama, kategori, kemampuan, online, status terakhir |
| `sambungan_telegram` | `chat_id`, status, kode tautan sekali pakai (hash + kedaluwarsa) |
| `langganan_push` | endpoint, kunci p256dh/auth tersandi, nama perangkat, terakhir berhasil |
| `alarm` | label, jam lokal, zona waktu, aturan pengulangan (JSON tervalidasi zod), tingkat, suara, tantangan, tangga (JSON), opsi libur, aktif |
| `lewati_alarm` | tanggal lokal yang dilewati per alarm |
| `kejadian_alarm` | satu baris per bunyi: `alarm_id`, `jadwal_utc`, status (`menunggu`, `berbunyi`, `ditunda`, `bangun`, `cek_bangun`, `selesai`, `terlewat`, `dibatalkan`), jumlah tunda, waktu bangun, metode tantangan, terlambat (detik) |
| `langkah_kejadian` | langkah tangga terjadwal per kejadian: `jatuh_tempo_utc`, jenis, parameter, status, hasil. Unik `(kejadian_id, urutan, ulangan)` |
| `kiriman_saluran` | jejak tiap kiriman (saluran, id pesan Telegram untuk dihapus, hasil, kode galat) |
| `tantangan` | per kejadian: jenis, tingkat, soal (tanpa jawaban), hash jawaban, kedaluwarsa, percobaan |
| `kode_bangun` | benda terdaftar: nama, hash isi kode |
| `rutinitas`, `jadwal_rutinitas` | aksi berurutan, pengulangan |
| `pengingat` | judul, waktu, pengulangan, prioritas |
| `mode_malam` | perangkat yang sedang Mode Malam: id perangkat, detak terakhir, alarm berikutnya yang diketahui |
| `detak_worker` | detak jantung worker |

Migrasi: SQL aditif saja (`src/lib/db/migrasi/*.sql`), jangan regenerasi jurnal drizzle,
jangan `drizzle-kit push`.

## 3. Mesin pengulangan

Modul murni `src/lib/jadwal/pengulangan.ts` tanpa akses DB:

- `kejadianBerikutnya(aturan, zonaWaktu, setelahUtc, opsi)` mengembalikan waktu UTC berikutnya
  dengan memperhitungkan hari terpilih, tanggal bulanan (31 ke hari terakhir), hari ke-N,
  tiap N minggu, tanggal dilewati, dan libur nasional.
- Gunakan pustaka zona waktu, bukan hitung offset sendiri.
- Tes: contoh emas (minimal 40 kasus tertulis) dan tes properti `fast-check` (hasil selalu
  setelah `setelahUtc`, tidak pernah jatuh di tanggal dilewati, idempoten).
- Data libur nasional: `src/lib/jadwal/libur/<tahun>.json` dengan sumber resmi tercatat di berkas.

## 4. Penjadwal (bagian terpenting)

Tujuan: berbunyi p95 < 2 detik dari jadwal, tidak pernah dobel, tahan restart.

1. **Materialisasi.** Setiap alarm aktif selalu punya tepat satu `kejadian_alarm` berstatus
   `menunggu` untuk jadwal berikutnya. Dibuat/diperbarui dalam transaksi yang sama saat alarm
   dibuat, diubah, dilewati, atau setelah kejadian sebelumnya selesai.
2. **Pemicu tepat waktu.** Worker menyimpan jadwal terdekat di memori dan memasang `setTimeout`
   tepat ke jadwal itu, ditambah ketukan pengaman tiap 1 detik. Perubahan jadwal dikabarkan
   lewat `LISTEN/NOTIFY` supaya worker menghitung ulang seketika.
3. **Klaim aman.** Ambil kejadian jatuh tempo dengan
   `SELECT ... WHERE status='menunggu' AND jadwal_utc <= now() FOR UPDATE SKIP LOCKED`, ubah
   ke `berbunyi`, lalu buat baris `langkah_kejadian` sesuai tangga. Semua dalam satu transaksi.
4. **Eksekusi langkah.** Loop yang sama mengambil `langkah_kejadian` jatuh tempo (juga
   `SKIP LOCKED`), menjalankan kiriman secara paralel dengan batas waktu per saluran, mencatat
   hasil. Satu saluran lambat tidak boleh menahan alarm lain.
5. **Berhenti.** Saat tantangan lolos, kejadian jadi `bangun`, semua langkah yang belum jalan
   dibatalkan, rutinitas "setelah bangun" dijadwalkan, pesan spam Telegram dihapus, lalu
   langkah Cek Masih Bangun dijadwalkan.
6. **Tunda.** Kejadian jadi `ditunda`, langkah dibatalkan, kejadian dibangunkan lagi pada waktu
   tunda dengan tangga diulang dari langkah pertama yang "keras".
7. **Pulih.** Saat worker mulai: kejadian `menunggu` yang terlewat kurang dari 30 menit langsung
   dibunyikan dengan tanda terlambat; lebih dari itu ditandai `terlewat` dan pengguna diberi tahu.
   Kejadian `berbunyi` yang tertinggal dilanjutkan dari langkah yang belum selesai.
8. **Detak jantung.** Worker menulis `detak_worker` tiap 10 detik. Pemantau (di web) memberi tahu
   operator lewat Telegram bila detak lebih tua dari 60 detik.

Rutinitas terjadwal dan pengingat memakai mesin yang sama dengan jenis kejadian berbeda.

## 5. Saluran

| Saluran | Implementasi |
|---|---|
| Push PWA | `web-push` + VAPID. Service worker menampilkan notifikasi alarm (tag per kejadian, `renotify`, `requireInteraction`, getar). Status 404/410 menghapus langganan. |
| Telegram | Bot API lewat webhook `POST /api/telegram/webhook` dengan header `X-Telegram-Bot-Api-Secret-Token`. Tautan `/start <kode>`. Kirim `sendMessage` dengan tombol URL ke tantangan, simpan `message_id`, hapus dengan `deleteMessage` setelah bangun. Hormati batas laju Telegram. |
| Tuya | Salin `src/lib/tuya/*` dari template: `klien`, `wilayah`, `kemampuan`, `kamus-dp`, `konfirmasi`. Pakai `voice/self-send`, `push/self-send`, `shadow/properties/issue`, cuaca. Penjadwal Tuya template (20 detik) **tidak** dipakai; AntiKebo memakai penjadwal di atas. |
| Mode Malam | Halaman `/app/malam` membuka SSE `/api/peristiwa` dan mengirim detak tiap 30 detik ke `mode_malam`. Server mengirim peristiwa `berbunyi`. Halaman juga tahu jadwal berikutnya dan punya pengatur waktu lokal sebagai cadangan bila SSE putus. |

## 6. Tantangan

- Soal dibuat di server (`src/lib/tantangan/`), jawaban disimpan sebagai hash, tidak pernah
  dikirim ke peramban atau dicatat di log.
- Endpoint jawab hanya menerima sesi pengguna pemilik kejadian, punya batas laju, dan memeriksa
  bahwa kejadian masih `berbunyi`.
- Kode Bangun: kamera di peramban membaca isi kode, server membandingkan hash dengan `kode_bangun`.
- Tingkat soal hitungan, jumlah benar berturut-turut, dan batas waktu ada di satu berkas aturan
  dengan tes contoh emas.

## 7. Alat MCP

Pola template (`alat()` di `mcp/dasar.ts`, zod, anotasi `readOnlyHint`/`destructiveHint`,
`error_code` terstruktur, `PETUNJUK`). Nama alat bahasa Inggris:

`get_setup_status`, `connect_home`, `disconnect_home`, `list_devices`, `test_device`,
`list_alarms`, `get_alarm`, `get_next_alarm`, `create_alarm`, `update_alarm`, `delete_alarm`,
`set_alarm_enabled`, `skip_next_alarm`, `skip_date`, `unskip_alarm`, `test_alarm`,
`list_routines`, `create_routine`, `update_routine`, `delete_routine`, `run_routine`,
`list_reminders`, `create_reminder`, `update_reminder`, `delete_reminder`,
`get_wake_stats`, `get_history`, `get_preferences`, `update_preferences`, `link_telegram`,
`list_wake_codes`.

**Sengaja tidak ada** alat untuk mematikan atau menunda alarm yang sedang berbunyi.

## 8. Skor bangun

Per kejadian (tidak termasuk uji coba):

- Mulai 100.
- Kurangi 10 per tunda.
- Kurangi 1 per menit dari berbunyi sampai lolos tantangan, setelah 2 menit pertama (maks 40).
- Kurangi 30 bila gagal Cek Masih Bangun.
- `terlewat` karena pengguna tidak bangun bernilai 0; `terlewat` karena gangguan server tidak dihitung.
- Batas bawah 0.

Skor harian = rata-rata kejadian hari itu (zona waktu pengguna). Hari beruntun = hari berturut-turut
dengan semua kejadian ≥ 70. Rumus ini wajib punya tes contoh emas.

## 9. Keamanan

- CSP dengan nonce dan `Cache-Control: no-transform` (aturan Cloudflare di template `proxy.ts`).
- Batas laju per pengguna untuk API, MCP (120/menit, tulis 40/menit), jawab tantangan, tautan Telegram.
- Rahasia pengguna tersandi amplop; kunci utama `ENCRYPTION_KEK`.
- Tidak ada endpoint yang melewati sesi (tidak ada "kunci internal" seperti aplikasi lama).
- Log tidak memuat rahasia, isi pesan, atau jawaban tantangan.

## 10. Variabel lingkungan (nama saja)

Dari template: `DATABASE_URL`, `DATABASE_URL_MIGRASI`, `APP_ORIGIN`, `SESSION_SECRET`,
`ENCRYPTION_KEK`, `AGENTBUFF_ISSUER`, `AGENTBUFF_ORIGIN`, `AGENTBUFF_PRODUCT_KEY` (`antikebo`),
`AGENTBUFF_MASUK_CLIENT_ID`, `AGENTBUFF_MASUK_CLIENT_SECRET`, `LOG_LEVEL`, kata sandi peran DB
`ANTIKEBO_SUPER_PASSWORD`, `ANTIKEBO_MIGRASI_PASSWORD`, `ANTIKEBO_APP_PASSWORD`,
`ANTIKEBO_WORKER_PASSWORD`.

Baru: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `OPERATOR_TELEGRAM_CHAT_ID`.

Khusus uji (opsional, hanya di lingkungan cloud): `TUYA_KUNCI_UJI`, `TELEGRAM_BOT_TOKEN_UJI`,
`TELEGRAM_CHAT_ID_UJI`.

Aplikasi menolak mulai bila variabel wajib kosong (pola `env.ts` template).

## 11. Pengujian

- Unit: mesin pengulangan, skor, aturan tantangan, tangga (contoh emas + properti).
- Integrasi di PGlite memakai migrasi asli dan peran non-bypass (harness template), termasuk:
  dua worker berebut kejadian yang sama (tidak dobel), restart di tengah tangga, pulih terlewat.
- Server tiruan untuk Tuya (pola `tuya-tiruan.ts`), Telegram, dan push.
- Uji peramban Playwright di cloud untuk alur UI utama dan tangkapan layar PR.
- `scripts/jaga.mjs`: bawa semua guard template, tambah guard "tidak ada alat MCP mematikan alarm".
- CI GitHub Actions: jaga, tsc, lint, test, build (pola BYM `.github/workflows/ci.yml`).
