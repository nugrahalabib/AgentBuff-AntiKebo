import { NextResponse } from "next/server";
import { cekHak, type HasilHak } from "@/lib/agentbuff/status";
import { tautanPerpanjang } from "@/lib/agentbuff/tautan-beku";
import { asalSama, bacaJson, galat, lolosLaju } from "@/lib/api";
import { sesiSaatIni, type Pengguna } from "@/lib/auth/sesi";
import { env } from "@/lib/env";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { log } from "@/lib/log";

// Pembungkus rute API aplikasi: sesi, CSRF (mutasi), batas laju, hak, jalankan,
// lalu galat layanan jadi {galat, pesan} + status HTTP tepat. Pesan galat mentah tidak pernah keluar.

const STATUS_GALAT: Record<string, number> = {
  tidak_ditemukan: 404,
  masukan: 400,
  batas_laju: 429,
  perlu_izin: 409,
  perlu_perangkat: 409,
};

export type KonteksRute = { pengguna: Pengguna; hak: HasilHak; json<T>(): Promise<T | null> };

export async function rute(req: Request, opsi: { mutasi?: boolean; bolehBeku?: boolean }, fn: (k: KonteksRute) => Promise<unknown>): Promise<NextResponse> {
  if (opsi.mutasi && !asalSama(req)) return galat(403, "asal_ditolak", "Permintaan ditolak.");
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  if (!lolosLaju(`u:${s.pengguna.id}`, opsi.mutasi ? 120 : 300)) return galat(429, "terlalu_sering", "Terlalu banyak permintaan. Coba lagi sebentar lagi.");
  const hak = await cekHak({ id: s.pengguna.id, agentbuffSub: s.pengguna.agentbuffSub });
  if (!hak.aktif && !opsi.bolehBeku) {
    return galat(403, "akses_beku", "Akses sedang dibekukan.", {
      alasan: hak.alasan,
      perpanjang: tautanPerpanjang(hak.alasan, env("AGENTBUFF_ORIGIN"), env("AGENTBUFF_PRODUCT_KEY")),
    });
  }
  try {
    const hasil = await fn({ pengguna: s.pengguna, hak, json: <T>() => bacaJson<T>(req) });
    if (hasil instanceof NextResponse) return hasil;
    return NextResponse.json(hasil ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof GalatLayanan) return galat(STATUS_GALAT[e.kode] ?? 400, e.kode, e.message, e.tambahan);
    log.error({ err: (e as Error)?.message }, "rute app gagal");
    return galat(500, "galat_server", "Ada yang tidak beres. Coba lagi sebentar.");
  }
}
