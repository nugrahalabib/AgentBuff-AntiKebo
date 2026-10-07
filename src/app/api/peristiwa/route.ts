import { bearer, lolosLaju } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { perangkatDariToken } from "@/lib/layanan/perangkat";
import { aliranPeristiwa, type JenisPeristiwa } from "@/lib/peristiwa";

// SSE waktu nyata (arsitektur §5): sesi web (beranda, layar berbunyi, Jam Meja) atau token
// perangkat PC (Bearer). Hanya sinyal berisi id; isi dibaca lewat API ber-RLS.
export const dynamic = "force-dynamic";

const UNTUK_PERANGKAT: ReadonlySet<JenisPeristiwa> = new Set(["jadwal", "berbunyi", "berhenti", "tunda", "cek", "klip_siap"]);

export async function GET(req: Request) {
  const token = bearer(req);
  if (token) {
    const p = await perangkatDariToken(token);
    if (!p) return new Response("token perangkat tidak berlaku", { status: 401 });
    if (!lolosLaju(`sse:${p.penggunaId}`, 60)) return new Response("terlalu sering", { status: 429 });
    return aliranPeristiwa(req, p.penggunaId, {
      saring: (e) => UNTUK_PERANGKAT.has(e.j),
      tutupBila: (e) => e.j === "cabut" && e.d === p.id,
    });
  }
  const s = await sesiSaatIni();
  if (!s) return new Response("belum masuk", { status: 401 });
  if (!lolosLaju(`sse:${s.pengguna.id}`, 60)) return new Response("terlalu sering", { status: 429 });
  return aliranPeristiwa(req, s.pengguna.id);
}
