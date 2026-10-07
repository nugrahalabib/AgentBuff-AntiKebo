# Lisensi bunyi alarm AntiKebo

Semua berkas di folder ini **dibuat sendiri** oleh skrip `scripts/bangun-bunyi.ts` dari gelombang
dasar (sinus, kotak, gergaji, sapuan, lonceng aditif). Tidak ada rekaman atau sampel pihak lain,
termasuk bunyi ayam (sintesis, bukan rekaman). Bebas dipakai AntiKebo tanpa royalti.

Format: WAV PCM 16 bit mono 22.050 Hz, kekerasan dinormalkan sekitar −14 LUFS (ITU-R BS.1770,
dicek silang dengan `ffmpeg ebur128`), puncak sejati di bawah −1 dBTP. Bangun ulang:
`pnpm exec tsx scripts/bangun-bunyi.ts` (hasilnya sama persis, diperiksa `tests/unit/bunyi.test.ts`).
