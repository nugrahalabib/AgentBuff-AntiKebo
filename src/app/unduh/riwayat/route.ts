import { galat } from "@/lib/api";
import { csvRiwayat, pemilikTokenUnduh } from "@/lib/layanan/riwayat";

export const dynamic = "force-dynamic";

/** Unduh CSV riwayat lewat tautan berumur pendek dari agen (alat MCP `export_history`, PRD K3). */
export async function GET(req: Request) {
  const penggunaId = pemilikTokenUnduh(new URL(req.url).searchParams.get("t") ?? "");
  if (!penggunaId) return galat(404, "tidak_ditemukan", "Tautan unduh sudah tidak berlaku. Minta tautan baru.");
  return new Response(await csvRiwayat(penggunaId), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="antikebo-riwayat.csv"',
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
