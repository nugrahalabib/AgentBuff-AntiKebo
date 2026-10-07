import { NextResponse } from "next/server";
import { dariGalat, mutasiPengguna, sesiBaca } from "@/lib/api";
import { daftarPerangkatRumah, sinkronkanPengguna } from "@/lib/layanan/tuya";

export const dynamic = "force-dynamic";

/** Perangkat per ruangan + status online + aksi alarm yang didukung (PRD I2). */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await daftarPerangkatRumah(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Muat ulang daftar perangkat dari Tuya. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    await sinkronkanPengguna(k.pengguna.id);
    return NextResponse.json(await daftarPerangkatRumah(k.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
