import { z } from "zod";
import { jamTampil } from "@/lib/layanan/konteks";
import type { KonteksAlat } from "../dasar";

/** Pembantu bersama alat MCP: format waktu dalam bahasa + zona pengguna, tautan layar web. */

export const SkemaId = z.uuid();

/** "Kamis, 8 Oktober 05.00" (id) atau "Thursday, October 8, 05:00" (en), di zona pengguna. */
export function kapan(k: KonteksAlat, instan: Date | string, zona = k.zona): string {
  const d = typeof instan === "string" ? new Date(instan) : instan;
  const tgl = new Intl.DateTimeFormat(k.bahasa === "id" ? "id-ID" : "en-US", { timeZone: zona, weekday: "long", day: "numeric", month: "long" }).format(d);
  return `${tgl} ${jamTampil(d, zona, k.bahasa)}`;
}

export const jam = (k: KonteksAlat, instan: Date | string, zona = k.zona) => jamTampil(typeof instan === "string" ? new Date(instan) : instan, zona, k.bahasa);

/** Tautan layar AntiKebo untuk diberikan agen ke pengguna. */
export const tautan = {
  app: (k: KonteksAlat) => `${k.asal}/app`,
  alarm: (k: KonteksAlat, kejadianId?: string) => (kejadianId ? `${k.asal}/app/bunyi/${kejadianId}` : `${k.asal}/app`),
  pengaturan: (k: KonteksAlat) => `${k.asal}/app/pengaturan`,
  izin: (k: KonteksAlat) => `${k.asal}/auth/agentbuff/start?izin=1&lanjut=${encodeURIComponent("/app/pengaturan")}`,
  rumah: (k: KonteksAlat) => `${k.asal}/app/rumah`,
  siaga: (k: KonteksAlat) => `${k.asal}/app/siaga`,
  unduhPc: (k: KonteksAlat) => `${k.asal}/app/unduh-pc`,
  jamMeja: (k: KonteksAlat) => `${k.asal}/app/jam-meja`,
  riwayat: (k: KonteksAlat) => `${k.asal}/app/riwayat`,
  cetakQr: (k: KonteksAlat, id: string) => `${k.asal}/app/kode-qr/${id}/cetak`,
  klip: (k: KonteksAlat, hash: string) => `${k.asal}/api/perangkat/klip/${hash}`,
};
