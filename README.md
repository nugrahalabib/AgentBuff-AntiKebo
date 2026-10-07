# AntiKebo

Alarm anti kesiangan untuk Marketplace AgentBuff: **tidak berhenti sampai kamu benar-benar
bangun.** Bunyi alarm + suara omelan galak, judul agenda besar, spam chat ke kanal agen AgentBuff,
notifikasi, dan lampu rumah pintar (opsional), sampai soal tantangan terjawab.

- Web app (bisa dipasang di HP sebagai Mode Jam Meja) + aplikasi Windows "AntiKebo untuk PC".
- Semua bisa diatur lewat chat ke agen AgentBuff.
- Tayang di `https://antikebo.agentbuff.id` (setelah rilis), Rp29.000 sekali bayar.

Mulai dari [CLAUDE.md](CLAUDE.md) dan [docs/00-MULAI-DI-SINI.md](docs/00-MULAI-DI-SINI.md).

## Pengembangan

```
bash scripts/siapkan-lokal.sh   # .env.local acak, peran DB tanpa BYPASSRLS, migrasi (idempoten)
pnpm tiruan                     # server tiruan AgentBuff (masuk, cek hak, kanal, pesan, suara)
pnpm dev                        # http://localhost:3100
pnpm worker                     # worker (detak, bersih-bersih; penjadwal di P3)
```

Pemeriksaan yang sama dengan CI: `pnpm jaga`, `pnpm tsc`, `pnpm lint`, `pnpm format:cek`,
`pnpm test`, `pnpm build`, `pnpm test:e2e`.
