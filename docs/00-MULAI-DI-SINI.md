# Mulai di sini

## Status terkini

- **2026-10-07:** **Semua paket cloud (P0 sampai P13) selesai**: kerangka + server tiruan (P0),
  rancangan semua layar (P1), data alarm, pengulangan, libur, Komitmen (P2), penjadwal tepat detik,
  SSE, perangkat siaga, sambung PC (P3), soal, tunda, Masih bangun, Misi QR, anti curang (P4), bunyi,
  naskah karakter, antrean suara lewat AgentBuff (P5), spam kanal, notifikasi web, pengingat malam
  (P6), rumah pintar Tuya (P7), layar inti tersambung API (P8), PWA dan Mode Jam Meja (P9), aplikasi
  PC Tauri (P10), perkenalan, Siaga, Riwayat, Pengaturan lengkap, hapus data (P11), 48 alat MCP dengan
  penjaga paritas dan halaman Agen (P12), lalu mutu (P13): halaman Privasi dan Ketentuan, audit
  aksesibilitas axe 0 pelanggaran + papan ketik, aturan beku K-07 benar-benar dijalankan (tenggang 3
  hari, kabar, jalur bangun tidak pernah dibekukan), batas laju di semua rute, Komitmen mengunci putus
  perangkat/rumah, anggaran performa, dan bahan `integrasi-portal/`.
  Berikutnya: paket **laptop** L1 (pintu kanal, pesan, suara di AgentBuff), L2 (rilis uji, uji PC dan
  HP asli, naskah pembaca layar `AKSESIBILITAS.md` §2), L3 (gerbang rilis, terbitkan). Acuan L1:
  `tests/integrasi/tiruan-kontrak.test.ts`.
- Menunggu Chief: K-07 (angka tenggang beku), K-114a (badan hukum pengendali data, tinjauan hukum)
  (`KEPUTUSAN.md`).

(Perbarui bagian ini di akhir setiap sesi: tanggal, paket yang selesai, paket berikutnya.)

## Peta dokumen

| Berkas | Isi | Kapan dibaca |
|---|---|---|
| `../CLAUDE.md` | Aturan wajib setiap sesi | Selalu, otomatis |
| `01-KONSEP.md` | Janji produk, cara kerja, batas yang diakui | Sesi pertama, dan setiap ragu soal arah |
| `02-PRD.md` | Kebutuhan berkode (A1, B2, ...) dengan kriteria lulus | Saat mengerjakan fitur |
| `03-ARSITEKTUR.md` | Komponen, data, penjadwal, perangkat siaga, suara, spam, keamanan, env | Saat menulis backend |
| `04-DESAIN.md` | Aturan desain Chief, bahasa visual, rancangan tiap layar, gaya bahasa | Saat menulis UI |
| `05-INTEGRASI-AGENTBUFF.md` | Masuk, cek hak, MCP, **kontrak pintu kanal/pesan/suara**, deploy | P0, P3, P5, P6, P12 |
| `06-RENCANA-KERJA.md` | Paket kerja berurutan dan statusnya | Setiap awal dan akhir sesi |
| `07-SESI-CLOUD.md` | Menyiapkan dan memakai sesi cloud | Chief sekali; Claude bagian 5 |
| `08-REFERENSI-LAMA.md` | Cara shila-wake membunyikan alarm dan pemetaan fitur | Saat ingin tahu "dulu bagaimana" |
| `09-APLIKASI-PC.md` | Aplikasi Windows: perilaku, sambung, pengaturan Windows, distribusi, uji | P10, L2 |
| `10-SUARA.md` | Bunyi alarm, karakter omelan, pola jeda 3 detik, pembuatan suara | P5, P9, P10 |
| `11-ALAT-MCP.md` | Alat MCP paritas penuh, pengecualian, `SKILL.md` | P12 |
| `GERBANG-RILIS.md` | Syarat sebelum dijual | P13, L3 |
| `AKSESIBILITAS.md` | Bukti audit aksesibilitas otomatis + naskah uji pembaca layar di perangkat asli | P13, L2 |
| `../integrasi-portal/` | Bahan listing id/en dan draf skrip bukti untuk sesi laptop | L2, L3 |
| `KEPUTUSAN.md` | Keputusan dan yang menunggu Chief | Saat ragu dan saat memutuskan hal baru |
| `LAPORAN-PERUBAHAN.md` | Catatan perubahan untuk Chief | Akhir setiap sesi |
| `../referensi/README.md` | Isi folder referensi | Sebelum menyalin dari template |

## Istilah

| Istilah | Arti |
|---|---|
| Kejadian | Satu kali alarm berbunyi (alarm berulang punya banyak kejadian) |
| Perangkat siaga | PC dengan aplikasi AntiKebo, atau HP/tablet dalam Mode Jam Meja |
| Mode Jam Meja | HP/tablet membuka AntiKebo di charger, layar redup, siap berbunyi |
| AntiKebo untuk PC | Aplikasi Windows yang memutar alarm dan tidak bisa ditutup saat berbunyi |
| Omelan | Kalimat galak yang diucapkan, diputar bersamaan dengan bunyi alarm |
| Karakter | Gaya naskah omelan (Ibu Galak, Pelatih Tentara, ...) |
| Klip | Berkas suara satu kalimat omelan, dibuat AgentBuff pengguna |
| Soal | Tantangan untuk mematikan alarm: hitungan, ingat angka, ketik kalimat, Misi QR |
| Misi QR | Kode QR yang ditempel jauh dari kasur dan harus dipindai |
| Masih bangun? | Pemeriksaan beberapa menit sesudah bangun |
| Mode Komitmen | Alarm dikunci antara jam tidur dan jam alarm |
| Pintu AgentBuff | Endpoint `/masuk/kanal`, `/masuk/kabar`, `/masuk/suara` untuk aplikasi mitra |
| Hak | Boleh-tidaknya pengguna memakai AntiKebo menurut AgentBuff |
| Chief | Pemilik AgentBuff |
