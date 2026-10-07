import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { riwayatPengguna } from "@/lib/layanan/riwayat";

export const dynamic = "force-dynamic";

/** Riwayat + statistik 30 hari (tab Riwayat, PRD K1/K2). */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await riwayatPengguna(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
