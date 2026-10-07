# Draf skrip bukti AntiKebo (untuk repo AgentBuff, sesi laptop)

Skrip bukti dijalankan di lingkungan produksi dengan akun sekali pakai, pola skrip bukti produk
Marketplace yang sudah ada di repo AgentBuff. Draf ini hanya daftar langkah dan asersi; kode dan
rincian internal AgentBuff (rute admin, nama RPC, lokasi server) ditulis di repo AgentBuff yang
privat, bukan di sini. Nomor butir merujuk `docs/GERBANG-RILIS.md`.

## prove-antikebo-beli (butir 1)

Akun sekali pakai, peramban sungguhan, `https://antikebo.agentbuff.id`.

| # | Langkah | Asersi |
|---|---|---|
| 1 | Buka halaman depan dan `/privasi`, `/ketentuan` | 200, judul tampil, tautan Privasi dan Ketentuan ada di kaki halaman |
| 2 | Masuk dengan AgentBuff sebelum membeli | Kembali ke `/masuk?alasan=belum_beli` dengan tautan perbaikan |
| 3 | Beli AntiKebo (Rp29.000) lewat alur bayar Marketplace | Hak produk aktif |
| 4 | Masuk lagi, izinkan kirim pesan dan suara | Sampai `/app/orientasi` |
| 5 | Selesaikan perkenalan sampai alarm uji 1 menit | Alarm uji berbunyi, soal dijawab, Selamat pagi |
| 6 | Buat alarm dari web (lembar Ubah alarm) | Muncul di Beranda |
| 7 | Tunggu sambung MCP otomatis, panggil `create_alarm` dari agen di kontainer AgentBuff | Alarm muncul di Beranda < 3 dtk (SSE) |
| 8 | Majukan alarm (alat uji) sampai berbunyi | Notifikasi, pesan kanal, layar berbunyi |
| 9 | Tunda dengan soal ringan, lalu jawab soal bangun | Status `bangun`, skor tercatat |
| 10 | Masih bangun tiba, ketuk Masih | Selesai, skor akhir |
| 11 | Cabut hak produk (hibah dicabut atau langganan berakhir) | Pengaturan beku, API ubah 403 `akses_beku`, MCP `access_frozen`, alarm terpasang tetap berbunyi selama tenggang 3 hari (K-07) |
| 12 | Perpanjang | Pulih, data utuh, alarm kembali berbunyi |
| 13 | Hapus semua data | Semua tabel pengguna kosong untuk akun itu, sesi dicabut |

## prove-antikebo-mcp (butir 8)

Memakai `skill/SKILL.md` dan token manual dari halaman Agen.

| # | Langkah | Asersi |
|---|---|---|
| 1 | `initialize` dan `tools/list` tanpa token, token salah, token dicabut | 401 + `WWW-Authenticate` sebelum JSON-RPC diurai |
| 2 | `tools/list` dengan token sah | Semua alat `docs/11-ALAT-MCP.md` ada; tidak ada alat untuk mematikan, menunda, atau menjawab alarm berbunyi |
| 3 | `create_alarm` dua kali dengan `client_ref` sama | Satu alarm, panggilan kedua `replayed: true` |
| 4 | `delete_alarm` tanpa `confirm` | Ditolak |
| 5 | Alarm Komitmen di dalam jendela kunci: `delete_alarm`, `set_alarm_enabled` false, `skip_next_alarm` | `commitment_locked` + `locked_until` |
| 6 | Hak dicabut | `access_frozen` + `renew_url`, `get_setup_status` tetap menjawab |
| 7 | Hak pulih | Alat kembali jalan |

## Bukti lain yang wajib di produksi

- Butir 2 (ketepatan): 24 jam, minimal 200 kejadian, p95 terlambat < 2 dtk dari `kejadian_alarm.terlambat_dtk`,
  restart worker di tengah alarm.
- Butir 5 dan 6: suara dan pesan kanal lewat pintu AgentBuff asli (L1).
- Butir 9: audit otomatis sudah lulus di cloud (`tests/e2e/aksesibilitas.spec.ts`); di perangkat asli
  jalankan naskah pembaca layar `docs/AKSESIBILITAS.md` §2.
