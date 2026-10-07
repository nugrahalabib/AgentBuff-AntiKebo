# Mulai di sini

## Status terkini

- **2026-10-07:** konsep versi 2 disepakati Chief; semua dokumen ditulis ulang. Belum ada kode
  aplikasi. Paket cloud berikutnya: **P0**. Paket laptop L1 (pintu AgentBuff) bisa jalan paralel.
- Menunggu Chief: K-07 (`KEPUTUSAN.md`), pemasangan GitHub App dan environment cloud
  (`07-SESI-CLOUD.md`).

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
