# Gerbang rilis AntiKebo

AntiKebo baru boleh diterbitkan (`--terbitkan`) bila semua butir di bawah hijau dan buktinya
tercatat. Acuan: `referensi/standar-agentbuff/BYM-GERBANG-RILIS.md`.

| # | Butir | Bukti yang diminta | Status |
|---|---|---|---|
| 1 | **Ujung ke ujung di produksi:** beli, masuk, orientasi, buat alarm dari aplikasi dan dari chat agen, berbunyi, tantangan, bangun, cabut hak, beku, perpanjang, pulih | `prove-antikebo-beli` dan skrip bukti alarm di VPS, semua lulus | Belum |
| 2 | **Ketepatan:** p95 keterlambatan berbunyi < 2 dtk selama 24 jam uji dengan ≥ 200 kejadian, tidak ada dobel, restart worker di tengah tangga pulih benar | Laporan metrik N3 | Belum |
| 3 | **Bukti perangkat asli:** enam butir "Harus dibuktikan" di `01-KONSEP.md` dicoba di iPhone dan Android, hasil dicatat di `KEPUTUSAN.md`, listing hanya menjanjikan yang terbukti | Catatan + video/tangkapan layar | Belum |
| 4 | **Anti curang:** tidak ada jalur mematikan/menunda tanpa sesi pengguna; jawaban tidak bocor | Guard `jaga` + tes + tinjauan | Belum |
| 5 | **Aksesibilitas:** 0 kegagalan kontras dan axe di semua halaman kedua tema, 320 px, teks 200%, keyboard, pembaca layar untuk 5 alur | Laporan audit | Belum |
| 6 | **Contoh emas:** mesin pengulangan, skor bangun, aturan tantangan | Tes hijau di CI | Belum |
| 7 | **MCP:** 401 untuk token salah/dicabut di `initialize` dan `tools/list`, `access_frozen` saat beku, idempotensi, tidak ada alat mematikan alarm | Skrip bukti MCP | Belum |
| 8 | **Deploy aman:** cadangan + hitung baris + gerbang RLS + tes pulih lolos | Log `deploy.sh` dan `uji-pulih.sh` | Belum |
| 9 | **Legal:** kebijakan privasi, ketentuan, pernyataan "bukan jaminan" | Halaman tayang | Belum |
| 10 | **Listing:** teks id/en, 3 gambar 1600×900 dari layar asli, tutorial, `SKILL.md` | Halaman Marketplace | Belum |

Target non-fungsional di `02-PRD.md` §17 juga wajib terpenuhi.
