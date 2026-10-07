# Bekerja lewat sesi cloud

Bagian 1 sampai 4 untuk Chief (sekali saja). Bagian 5 untuk Claude.

## 1. Sambungkan GitHub (sekali)

1. Buka `claude.ai/code`, sambungkan GitHub, pasang **Claude GitHub App** di akun **nugrahalabib**
   dengan akses ke repo `nugrahalabib/AgentBuff-AntiKebo`.
2. **Jangan** memakai `/web-setup` dari laptop: GitHub CLI di laptop sedang login sebagai akun
   lain.

## 2. Buat environment "AntiKebo" (sekali)

Di pemilih environment (ikon awan di atas kotak pesan):

**Akses jaringan:** pilih **Custom**, centang opsi tetap memakai daftar bawaan, lalu tambahkan:

```
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
sh.rustup.rs
static.rust-lang.org
index.crates.io
static.crates.io
agentbuff.id
```

**Variabel lingkungan:** tidak ada yang wajib. Pengembangan memakai server tiruan AgentBuff dan
Tuya. Opsional, untuk uji perangkat Tuya asli (nilainya terbaca Claude, jadi pakai kunci khusus uji
yang bisa dicabut):

```
TUYA_KUNCI_UJI=sk-...   # buat kunci baru "AntiKebo-uji" di Hey Tuya
```

**Skrip setup:** kosongkan. Persiapan dijalankan hook `SessionStart` (`scripts/sesi-cloud.sh`).

## 3. Memulai sesi

Pilih repo `nugrahalabib/AgentBuff-AntiKebo`, cabang `main`, environment `AntiKebo`, lalu kirim:

> Baca CLAUDE.md dan docs/00-MULAI-DI-SINI.md. Kerjakan paket kerja cloud berikutnya di
> docs/06-RENCANA-KERJA.md sampai memenuhi kriteria selesainya. Di akhir, perbarui rencana kerja,
> laporan perubahan, dan keputusan, lalu buka PR dan gabungkan bila semua pemeriksaan hijau.

Satu paket per sesi. Paket besar boleh berhenti di tengah selama status diperbarui. Sesi bisa
dipindah ke laptop dengan `claude --teleport` dari folder repo di laptop.

## 4. Kredit

Kredit cloud Chief: **$250, kedaluwarsa 5 November 2026 pukul 14.59 WIB**. Ada 14 paket cloud
(P0 sampai P13). Sisakan kredit untuk perbaikan sesudah uji PC dan HP asli (L2).

## 5. Untuk Claude: batasan di cloud

- Tidak ada SSH ke VPS, DB produksi, repo AgentBuff, atau PC Windows. **Jangan mencoba deploy.**
  Pekerjaan itu ada di paket L1 sampai L3.
- `CLAUDE_CODE_REMOTE=true` menandakan cloud. Hook `SessionStart` menyalakan Postgres dan memasang
  dependensi (paket P0 melengkapi: DB pengembangan, migrasi, `.env.local` acak, Rust bila ada `pc/`).
- AgentBuff selalu lewat server tiruan (`AGENTBUFF_TIRUAN=1`), mengikuti kontrak
  `05-INTEGRASI-AGENTBUFF.md`.
- Aplikasi PC: VM cloud adalah Linux. Taruh logika di crate `pc/inti` tanpa ketergantungan Tauri
  supaya `cargo test` jalan di VM tanpa pustaka sistem. Build Windows dan tes khusus Windows
  dijalankan GitHub Actions (`windows-latest`).
- Perintah latar maks 30 menit, perintah biasa 2 menit (bisa sampai 10).
- Memori laptop Chief tidak ada di sini. Semua aturan ada di `CLAUDE.md` dan `docs/`.
- `TUYA_KUNCI_UJI` hanya untuk uji manual yang dicatat hasilnya; jangan dipakai di tes otomatis,
  jangan dicetak, jangan disimpan.
- Lampirkan tangkapan layar UI (Playwright) di PR supaya Chief bisa menilai tanpa membuka kode.
