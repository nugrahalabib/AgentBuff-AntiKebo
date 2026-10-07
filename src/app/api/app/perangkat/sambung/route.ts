import { NextResponse } from "next/server";
import { bacaJson, dariGalat, galat, mutasiPengguna } from "@/lib/api";
import { setujuiKodeSambung } from "@/lib/layanan/perangkat";

/** "Sambungkan PC ini" (PRD H4): pengguna yang sudah masuk menyetujui kode dari aplikasi PC. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req);
  if (k instanceof NextResponse) return k;
  const isi = await bacaJson<{ kode?: unknown }>(req, 512);
  if (typeof isi?.kode !== "string") return galat(400, "masukan", "Kode tidak sah.");
  try {
    const h = await setujuiKodeSambung(k.pengguna.id, isi.kode, "web");
    return NextResponse.json({ status: h.status, namaPerangkat: h.namaPerangkat });
  } catch (e) {
    return dariGalat(e);
  }
}
