import { dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { csvRiwayat } from "@/lib/layanan/riwayat";

export const dynamic = "force-dynamic";

/** Ekspor CSV seluruh riwayat (PRD K3). */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return new Response(await csvRiwayat(s.pengguna.id), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="antikebo-riwayat.csv"', "Cache-Control": "no-store" },
    });
  } catch (e) {
    return dariGalat(e);
  }
}
