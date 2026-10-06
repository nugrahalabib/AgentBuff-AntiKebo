import { NextResponse } from "next/server";
import { asalSama, galat } from "@/lib/api";
import { cabutSesiIni, NAMA_COOKIE_SESI } from "@/lib/auth/sesi";

export async function POST(req: Request) {
  if (!asalSama(req)) return galat(403, "asal_ditolak", "Permintaan ditolak.");
  await cabutSesiIni();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(NAMA_COOKIE_SESI, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
