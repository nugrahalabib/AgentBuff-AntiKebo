# Tuya MCP - Smart Home Connector

Produk Marketplace AgentBuff (Rp29.000 sekali bayar). Menyambungkan perangkat Smart Life / Tuya ke agen AgentBuff lewat MCP, plus aplikasi web kendali rumah ala Apple Home di https://tuya.agentbuff.id.

- Rancangan & keputusan: `docs/PRD.md`
- Laporan perubahan: `docs/LAPORAN-PERUBAHAN.md`
- Skill pendamping agen: `skill/SKILL.md`

## Pengembangan

```
pnpm install
pnpm test        # unit + integrasi (PGlite + server Tuya tiruan)
pnpm jaga        # penjaga
pnpm lint && pnpm tsc
```

## Deploy

`bash deploy/deploy.sh` dari clone lokal sesudah commit di-push (cadangan -> hitung baris -> build -> migrasi -> uji RLS -> nyalakan -> hitung ulang). Pemasangan pertama: `deploy/pasang-pertama.sh` di VPS.
