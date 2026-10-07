import { NextResponse } from "next/server";
import { dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { riwayatPengguna } from "@/lib/layanan/riwayat";

export const dynamic = "force-dynamic";

/** Riwayat + statistik 30 hari (tab Riwayat, PRD K1/K2). */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json(await riwayatPengguna(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
