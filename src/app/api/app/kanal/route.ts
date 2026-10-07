import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { daftarKanalPengguna } from "@/lib/layanan/kanal";

export const dynamic = "force-dynamic";

/** Daftar kanal agen dari AgentBuff pengguna (PRD G1). */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return NextResponse.json(await daftarKanalPengguna(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
