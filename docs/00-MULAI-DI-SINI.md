# Mulai di sini

## Status terkini

- **2026-10-07:** **P0 sampai P7 selesai**: kerangka + server tiruan (P0), rancangan semua layar
  (P1), data alarm, pengulangan, libur, Komitmen (P2), penjadwal tepat detik, SSE, perangkat
  siaga, sambung PC (P3), soal, tunda, Masih bangun, Misi QR, anti curang (P4), 8 bunyi buatan
  sendiri, naskah 5 karakter, antrean suara lewat AgentBuff, pemutar web (P5), spam kanal, pesan
  penutup, notifikasi web, pengingat malam, pesan uji (P6), rumah pintar Tuya: wizard sambung,
  perangkat per ruangan, aksi alarm (naik bertahap, kedip, tunda, sesudah bangun), lapisan darurat
  (P7). Paket cloud berikutnya: **P8** (layar inti tersambung API). Paket laptop L1 (pintu
  AgentBuff) bisa jalan paralel; acuannya `tests/integrasi/tiruan-kontrak.test.ts`.
- Menunggu Chief: K-07 (`KEPUTUSAN.md`).

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
