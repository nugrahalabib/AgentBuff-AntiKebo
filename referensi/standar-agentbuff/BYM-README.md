# Buff Your Money (BYM)

Aplikasi pencatat & perencana keuangan pribadi/keluarga (web + PWA) yang dijual di Marketplace
AgentBuff dan tersambung ke agen AI pengguna lewat MCP. Rencana lengkap: [`docs/prd/`](docs/prd/README.md)
(baca README → PRD → DESAIN → TEKNIS → SKILL). Catatan perubahan untuk pengguna:
[`docs/LAPORAN-PERUBAHAN.md`](docs/LAPORAN-PERUBAHAN.md).

## Aturan yang tidak boleh bergeser

- **Tidak ada LLM/AI di dalam BYM.** Parser, wawasan, saran kategori = aturan. AI hanya dari agen
  AgentBuff milik pengguna yang memanggil tool MCP BYM.
- Tidak ada sinkron login bank/e-wallet, saran beli/jual efek, perbandingan produk keuangan,
  kuota/paywall/iklan.
- Setiap rumus TEKNIS §5 punya uji dengan contoh emasnya.

## Pengembangan

```bash
pnpm install
cp .env.example .env.local      # isi nilainya
pnpm db:migrate                 # butuh Postgres + peran bym_migrasi/bym_app (deploy/initdb)
pnpm dev                        # http://localhost:3000
pnpm test                       # vitest
pnpm jaga                       # penjaga (juga dijalankan di dalam `pnpm build`)
```

Next.js 16 berbeda dari versi lama — baca `node_modules/next/dist/docs/` sebelum menulis pola Next.
Proxy (CSP ber-nonce) WAJIB di `src/proxy.ts` dengan `matcher` literal.

## Produksi

VPS AgentBuff, `docker compose` di `/opt/bym` (`bym-db`, `bym-web`, `bym-worker`), subdomain
`bym.agentbuff.id` lewat Nginx Proxy Manager. Deploy selalu lewat `bash deploy/deploy.sh`
(cadangan → hitung baris → migrasi aditif → hitung lagi; gagal bila ada yang berkurang).
