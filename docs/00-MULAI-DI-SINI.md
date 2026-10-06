# Mulai di sini

## Status terkini

- **2026-10-06:** repo dan dokumen disiapkan. Belum ada kode aplikasi. Paket berikutnya: **P0**.
- Menunggu Chief: K-07 dan K-11 di `KEPUTUSAN.md`, pemasangan GitHub App dan environment cloud.

(Perbarui bagian ini di akhir setiap sesi: tanggal, paket yang selesai, paket berikutnya.)

## Peta dokumen

| Berkas | Isi | Kapan dibaca |
|---|---|---|
| `../CLAUDE.md` | Aturan wajib setiap sesi | Selalu, otomatis |
| `01-KONSEP.md` | Kenapa dan bagaimana AntiKebo membangunkan orang | Sesi pertama, dan setiap ragu soal arah produk |
| `02-PRD.md` | Daftar kebutuhan berkode (A1, B2, ...) dengan kriteria lulus | Saat mengerjakan fitur |
| `03-ARSITEKTUR.md` | Komponen, data, penjadwal, saluran, MCP, skor, keamanan, env | Saat menulis kode backend |
| `04-DESAIN.md` | Aturan desain Chief, bahasa visual, layar, gaya bahasa | Saat menulis UI |
| `05-INTEGRASI-AGENTBUFF.md` | Masuk, cek hak, MCP, langkah portal, deploy | P0, P8, P10, P12 |
| `06-RENCANA-KERJA.md` | Paket kerja berurutan dan statusnya | Setiap awal dan akhir sesi |
| `07-SESI-CLOUD.md` | Menyiapkan dan memakai sesi cloud | Chief sekali; Claude bagian 5 |
| `08-REFERENSI-LAMA.md` | Fitur aplikasi lama dan peningkatannya | Saat ingin tahu "dulu ada apa" |
| `GERBANG-RILIS.md` | Syarat sebelum dijual | P11, P12 |
| `KEPUTUSAN.md` | Keputusan dan yang menunggu Chief | Saat ragu, dan saat memutuskan hal baru |
| `LAPORAN-PERUBAHAN.md` | Catatan perubahan untuk Chief | Akhir setiap sesi |
| `../referensi/README.md` | Isi folder referensi | Sebelum menyalin dari template |

## Istilah

| Istilah | Arti |
|---|---|
| Kejadian | Satu kali alarm berbunyi (alarm berulang punya banyak kejadian) |
| Tangga Bangun | Urutan langkah yang makin keras sampai pengguna bangun |
| Tingkat | Lembut, Normal, Nuklir, atau Kustom |
| Tantangan | Bukti bangun: hitungan, Kode Bangun, ketik kalimat, goyang HP |
| Kode Bangun | QR/barcode benda yang harus dipindai untuk mematikan alarm |
| Mode Malam | HP dibiarkan membuka AntiKebo di charger supaya bisa berbunyi keras |
| Cek Masih Bangun | Pertanyaan beberapa menit setelah bangun untuk mencegah tidur lagi |
| Rutinitas | Kumpulan aksi perangkat bernama |
| Hak | Status boleh-tidaknya pengguna memakai AntiKebo menurut portal AgentBuff |
| Portal | Aplikasi utama AgentBuff (`agentbuff.id`, repo AgentBuff-Final) |
| Chief | Pemilik AgentBuff |
