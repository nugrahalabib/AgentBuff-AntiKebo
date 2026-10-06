# Bekerja lewat sesi cloud

Bagian 1 sampai 4 untuk Chief (sekali saja). Bagian 5 untuk Claude.

## 1. Sambungkan GitHub (sekali)

1. Buka `claude.ai/code`, sambungkan GitHub, lalu pasang **Claude GitHub App** di akun
   **nugrahalabib** dengan akses ke repo `nugrahalabib/AgentBuff-AntiKebo`.
2. **Jangan** memakai `/web-setup` dari laptop: GitHub CLI di laptop sedang login sebagai akun
   lain, jadi tokennya salah orang.

## 2. Buat environment "AntiKebo" (sekali)

Di pemilih environment (ikon awan di atas kotak pesan):

**Akses jaringan:** pilih **Custom**, centang opsi tetap memakai daftar bawaan, lalu tambahkan:

```
api.telegram.org
*.tuyacn.com
*.tuyaus.com
*.tuyaeu.com
*.tuyain.com
*.iotbing.com
*.iot-wus.com
*.iot-eus.com
*.iot-eu.com
*.iot-weu.com
*.iot-ap.com
*.iot-sea.com
cdn.playwright.dev
playwright.download.prss.microsoft.com
playwright.azureedge.net
agentbuff.id
```

**Variabel lingkungan:** tidak ada yang wajib. Pengembangan dan tes memakai server tiruan.
Kalau ingin Claude menguji dengan perangkat asli, isi variabel uji di bawah. Nilainya bisa
dibaca Claude di sesi, jadi **pakai kunci khusus uji yang bisa dicabut**, jangan kunci utama:

```
TUYA_KUNCI_UJI=sk-...        # buat kunci baru bernama "AntiKebo-uji" di Hey Tuya
TELEGRAM_BOT_TOKEN_UJI=...   # bot uji terpisah dari BotFather
TELEGRAM_CHAT_ID_UJI=...     # chat id Telegram Chief
```

**Skrip setup:** kosongkan. Node 22, pnpm, Postgres 16, Docker, dan Chromium sudah ada di VM.
Persiapan proyek dijalankan hook `SessionStart` di repo (`scripts/sesi-cloud.sh`).

## 3. Memulai sesi

Pilih repo `nugrahalabib/AgentBuff-AntiKebo`, cabang `main`, environment `AntiKebo`, lalu
kirim pesan ini:

> Baca CLAUDE.md dan docs/00-MULAI-DI-SINI.md. Kerjakan paket kerja berikutnya di
> docs/06-RENCANA-KERJA.md sampai memenuhi kriteria selesainya. Di akhir, perbarui rencana
> kerja, laporan perubahan, dan keputusan, lalu buka PR dan gabungkan bila semua pemeriksaan
> hijau.

Satu paket per sesi sudah cukup. Untuk paket besar, sesi boleh berhenti di tengah selama status
di rencana kerja diperbarui.

Sesi bisa dipindah ke laptop dengan `claude --teleport` dari folder repo di laptop.

## 4. Kredit

Kredit sesi cloud Chief: **$250, kedaluwarsa 5 November 2026 pukul 14.59 WIB**. Ada 11 paket
cloud di rencana kerja. Sisakan kredit untuk perbaikan setelah uji di HP asli (P8).

## 5. Untuk Claude: batasan di cloud

- Tidak ada SSH ke VPS, tidak ada DB produksi, tidak ada repo portal. Jangan mencoba deploy.
  Tugas yang butuh itu ada di paket "Laptop".
- `CLAUDE_CODE_REMOTE=true` menandakan cloud. Hook `SessionStart` menyalakan Postgres dan
  memasang dependensi.
- Perintah latar maksimal 30 menit, perintah biasa 2 menit (bisa diminta sampai 10 menit).
- Plugin dan memori laptop Chief tidak ada di sini. Semua aturan ada di `CLAUDE.md` dan `docs/`.
- Variabel `*_UJI` hanya untuk uji manual yang dicatat hasilnya; jangan dipakai di tes otomatis,
  jangan dicetak, jangan disimpan.
- Lampirkan tangkapan layar UI (Playwright) di PR supaya Chief bisa menilai tanpa membuka kode.
