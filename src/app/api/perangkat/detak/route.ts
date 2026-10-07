import { NextResponse } from "next/server";
import { asalSama, bacaJson, bearer, dariGalat, galat, lolosLaju } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { detakPerangkat, perangkatDariToken, tampilPerangkat } from "@/lib/layanan/perangkat";

// Detak perangkat siaga tiap 30 dtk (arsitektur §5): PC lewat token, Jam Meja lewat sesi + id perangkat.
export async function POST(req: Request) {
  const isi = (await bacaJson<Record<string, unknown>>(req, 4_096)) ?? {};
  try {
    const token = bearer(req);
    let penggunaId: string;
    let perangkatId: string;
    if (token) {
      const p = await perangkatDariToken(token);
      if (!p) return galat(401, "token_tidak_berlaku", "Perangkat ini sudah diputus. Sambungkan lagi.");
      [penggunaId, perangkatId] = [p.penggunaId, p.id];
    } else {
      if (!asalSama(req)) return galat(403, "asal_ditolak", "Permintaan ditolak.");
      const s = await sesiSaatIni();
      if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
      if (typeof isi.perangkatId !== "string") return galat(400, "masukan", "Perangkat tidak dikenal.");
      [penggunaId, perangkatId] = [s.pengguna.id, isi.perangkatId];
    }
    if (!lolosLaju(`detak:${perangkatId}`, 12)) return galat(429, "terlalu_sering", "Terlalu sering.");
    const { perangkatId: _abaikan, ...data } = isi;
    void _abaikan;
    const p = await detakPerangkat(penggunaId, perangkatId, data);
    return NextResponse.json({ waktuServer: new Date().toISOString(), perangkat: tampilPerangkat(p, new Date()) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
