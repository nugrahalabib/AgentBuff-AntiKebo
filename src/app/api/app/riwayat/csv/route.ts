import { NextResponse } from "next/server";
import { dariGalat, sesiBaca } from "@/lib/api";
import { csvRiwayat } from "@/lib/layanan/riwayat";

export const dynamic = "force-dynamic";

/** Ekspor CSV seluruh riwayat (PRD K3). */
export async function GET() {
  const s = await sesiBaca();
  if (s instanceof NextResponse) return s;
  try {
    return new Response(await csvRiwayat(s.pengguna.id), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="antikebo-riwayat.csv"', "Cache-Control": "no-store" },
    });
  } catch (e) {
    return dariGalat(e);
  }
}
