# Gerbang rilis AntiKebo

AntiKebo baru boleh diterbitkan bila semua butir hijau dan buktinya tercatat. Acuan:
`referensi/standar-agentbuff/BYM-GERBANG-RILIS.md`.

| # | Butir | Bukti | Status |
|---|---|---|---|
| 1 | **Ujung ke ujung di produksi:** beli, masuk, izin, orientasi, buat alarm dari web dan dari chat agen, berbunyi, soal, bangun, Masih bangun, cabut hak, beku, perpanjang | Skrip bukti di VPS, semua lulus | Belum |
| 2 | **Ketepatan:** p95 keterlambatan < 2 dtk selama 24 jam uji (≥ 200 kejadian), tidak dobel, restart worker di tengah alarm pulih benar, berhenti ≤ 2 dtk di semua perangkat | Laporan metrik | Belum |
| 3 | **Aplikasi PC:** 8 uji manual `09-APLIKASI-PC.md` §9 lulus di PC Chief | Catatan + video | Belum |
| 4 | **Jam Meja di HP asli:** iPhone (saklar senyap, layar redup) dan Android (layar redup, tab di latar, baterai) diuji; listing hanya menjanjikan yang terbukti | Catatan di `KEPUTUSAN.md` | Belum |
| 5 | **Suara:** klip dibuat lewat pintu AgentBuff asli untuk pengguna tanpa kunci (suara gratis) dan dengan kunci penyedia; cadangan suara perangkat jalan saat pintu gagal | Skrip bukti + rekaman | Belum |
| 6 | **Spam kanal:** pesan sampai di Telegram dan WhatsApp asli lewat bot agen, jeda dipatuhi, berhenti saat bangun | Bukti kanal asli | Belum |
| 7 | **Anti curang:** tidak ada jalur mematikan/menunda/menjawab tanpa sesi atau token perangkat; jawaban tidak bocor; Komitmen ditegakkan di web, PC, MCP | Guard `jaga` + tes + tinjauan | Belum |
| 8 | **MCP:** paritas penuh (guard), 401 token salah/dicabut, `access_frozen`, `commitment_locked`, idempotensi | Skrip bukti MCP | Belum |
| 9 | **Aksesibilitas:** 0 kegagalan kontras dan axe semua halaman kedua tema, 320 px, teks 200%, keyboard, pembaca layar 5 alur | Laporan audit | Belum |
| 10 | **Contoh emas:** pengulangan, soal (TS dan Rust), skor, urutan putar suara | Tes hijau di CI | Belum |
| 11 | **Deploy aman:** cadangan + hitung baris + gerbang RLS + tes pulih | Log deploy | Belum |
| 12 | **Legal:** privasi, ketentuan, "bukan jaminan", panduan layar biru Windows | Halaman tayang | Belum |
| 13 | **Listing:** teks id/en, 3 gambar dari layar asli, tutorial, `SKILL.md` | Halaman Marketplace | Belum |

Target non-fungsional di `02-PRD.md` §18 juga wajib terpenuhi.
