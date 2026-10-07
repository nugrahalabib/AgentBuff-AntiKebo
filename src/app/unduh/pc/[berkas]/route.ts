import { galat } from "@/lib/api";
import { bukaBerkasUnduh } from "@/lib/unduh";

// Pemasang + pembaruan aplikasi PC (docs/09 §8). Publik: pemasang bukan rahasia, dan updater di
// PC membaca `pembaruan.json` tanpa sesi. Keasliannya dijaga tanda tangan ed25519 + SHA-256.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ berkas: string }> }) {
  const { berkas } = await ctx.params;
  const b = await bukaBerkasUnduh(berkas);
  if (!b) return galat(404, "tidak_ditemukan", "Berkas tidak ditemukan.");
  const header: Record<string, string> = { "Content-Type": b.jenis, "Content-Length": String(b.ukuran), "Cache-Control": b.simpan, "X-Content-Type-Options": "nosniff" };
  if (b.unduhan) header["Content-Disposition"] = `attachment; filename="${b.unduhan}"`;
  return new Response(b.aliran, { headers: header });
}
