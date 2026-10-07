import { NextResponse } from "next/server";
import { bearer, dariGalat, galat } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { jadwalPerangkat, perangkatDariToken } from "@/lib/layanan/perangkat";

// Salinan jadwal 24 jam untuk pengatur waktu lokal perangkat siaga (arsitektur §4, "perangkat juga
// memegang jadwal"). Ditarik ulang saat peristiwa `jadwal` dan tiap 5 menit.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const token = bearer(req);
    let penggunaId: string;
    if (token) {
      const p = await perangkatDariToken(token);
      if (!p) return galat(401, "token_tidak_berlaku", "Perangkat ini sudah diputus. Sambungkan lagi.");
      penggunaId = p.penggunaId;
    } else {
      const s = await sesiSaatIni();
      if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
      penggunaId = s.pengguna.id;
    }
    const sekarang = new Date();
    return NextResponse.json({ waktuServer: sekarang.toISOString(), kejadian: await jadwalPerangkat(penggunaId, sekarang) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
