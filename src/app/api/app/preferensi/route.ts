import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, mutasiPengguna } from "@/lib/api";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { ambilPreferensi, ubahPreferensi } from "@/lib/layanan/preferensi";

export const dynamic = "force-dynamic";

/** Preferensi pengguna (PRD M): nama panggilan, zona, bahasa, jam tidur, tema, bawaan, pengingat malam. */
export async function GET() {
  const s = await sesiSaatIni();
  if (!s) return galat(401, "belum_masuk", "Sesi berakhir. Silakan masuk lagi.");
  try {
    return NextResponse.json(await ambilPreferensi(s.pengguna.id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}

/** Ubah sebagian preferensi. Mode Komitmen tetap ditegakkan (jam tidur/zona). */
export async function PATCH(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  try {
    return NextResponse.json(await ubahPreferensi(k.pengguna.id, await bacaJson(req, 8_192), "web"), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return dariGalat(e);
  }
}
