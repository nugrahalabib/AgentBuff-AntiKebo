# Folder referensi (hanya dibaca)

Jangan ubah isi folder ini. Kecualikan dari tsconfig, ESLint, Vitest, Prettier, `jaga`, dan build.

| Folder | Sumber | Pakai untuk |
|---|---|---|
| `template-tuya/` | Repo `nugrahalabib/Agentbuff-Tuya`, commit `937aa8a` (3 Okt 2026), hanya berkas ter-commit | Cetakan utama AntiKebo: salin lalu sesuaikan |
| `standar-agentbuff/BYM-*.md` | Repo BYM `890ff94` dan dokumen produk BYM di portal | Standar mutu, desain, teknis, gerbang rilis |
| `standar-agentbuff/PORTAL-*.md` | Portal AgentBuff-Final `f3707a02`, rombak UI `28149e65` | Kontrak Masuk dengan AgentBuff, alur pembayaran, panduan desain |
| `standar-agentbuff/portal-*.ts.txt` | Skrip portal (`siapkan-tuya.ts`, `prove-tuya-beli.ts`, `masuk-daftar-aplikasi.ts`) | Contoh untuk `siapkan-antikebo.ts` dan `prove-antikebo-beli.ts`. Disimpan `.txt` supaya tidak ikut dicek tipe |
| `aplikasi-lama/shila-wake/` | AntiKebo lama, dibersihkan: nomor HP dan kunci internal disamarkan, tanpa berkas data, log, login, cache Python, dan MP3 | Hanya melihat fitur. Ringkasan lengkap di `docs/08-REFERENSI-LAMA.md`. Jangan salin kodenya |

Kunci `sk-` di tes `template-tuya/` adalah kunci palsu untuk tes.
