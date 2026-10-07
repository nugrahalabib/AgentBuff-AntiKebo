import { bearer, galat, lolosLaju } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { perangkatDariToken } from "@/lib/layanan/perangkat";
import { ambilKlip } from "@/lib/layanan/suara";

// Unduh klip omelan untuk perangkat siaga (docs/10-SUARA.md §6): PC lewat token, peramban lewat
// sesi. Kunci klip = hash isinya, jadi boleh disimpan selamanya di perangkat (immutable).
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ hash: string }> }) {
  const { hash } = await ctx.params;
  const token = bearer(req);
  let penggunaId: string | null = null;
  if (token) penggunaId = (await perangkatDariToken(token))?.penggunaId ?? null;
  else penggunaId = (await sesiSaatIni())?.pengguna.id ?? null;
  if (!penggunaId) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  if (!lolosLaju(`klip:${penggunaId}`, 300)) return galat(429, "terlalu_sering", "Terlalu sering.");
  const k = await ambilKlip(penggunaId, hash);
  if (!k) return galat(404, "tidak_ditemukan", "Klip tidak ditemukan.");
  return new Response(new Uint8Array(k.audio), {
    headers: { "Content-Type": k.mime, "Content-Length": String(k.audio.length), "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
