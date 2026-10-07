import { NextResponse } from "next/server";
import { bacaJson, dariGalat, mutasiPengguna } from "@/lib/api";
import { NAMA_COOKIE_SESI } from "@/lib/auth/sesi";
import { hapusSemuaData } from "@/lib/layanan/hapus-data";

/** Hapus semua data (PRD A5), dengan konfirmasi ketik. Semua sesi dicabut; kuki sesi dihapus. */
export async function POST(req: Request) {
  const k = await mutasiPengguna(req, { bolehBeku: true });
  if (k instanceof NextResponse) return k;
  try {
    await hapusSemuaData(k.pengguna.id, await bacaJson(req, 1_024), "web");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(NAMA_COOKIE_SESI, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    return dariGalat(e);
  }
}
