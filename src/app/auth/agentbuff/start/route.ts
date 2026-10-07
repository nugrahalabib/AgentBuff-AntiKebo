import { NextResponse } from "next/server";
import { mulaiMasuk, NAMA_COOKIE_OIDC, UMUR_COOKIE_OIDC_DTK } from "@/lib/agentbuff/oidc";
import { env } from "@/lib/env";
import { bahasaSaatIni } from "@/lib/i18n/server";
import { log } from "@/lib/log";

// Mulai "Masuk dengan AgentBuff". `?senyap=1` = prompt=none (masuk ulang tanpa layar
// bila izin masih ada); `?pilih=1` = prompt=select_account; `?izin=1` = prompt=consent
// (memberi izin kabar/suara yang dulu ditolak); `?cakupan=dasar` = tanpa izin tambahan
// (cadangan otomatis bila AgentBuff menolak scope); `?lanjut=` hanya jalur /app... (anti open redirect).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const asal = env("APP_ORIGIN");
  try {
    const { url, cookie } = await mulaiMasuk({
      senyap: q.get("senyap") === "1",
      pilihAkun: q.get("pilih") === "1",
      mintaIzin: q.get("izin") === "1",
      cakupan: q.get("cakupan") === "dasar" ? "dasar" : "penuh",
      lanjut: q.get("lanjut"),
      bahasa: await bahasaSaatIni(),
    });
    const res = NextResponse.redirect(url, 303);
    res.cookies.set(NAMA_COOKIE_OIDC, cookie, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: UMUR_COOKIE_OIDC_DTK,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    log.error({ err: (e as Error)?.message }, "gagal memulai masuk AgentBuff");
    return NextResponse.redirect(new URL("/masuk?galat=agentbuff_tak_terjangkau", asal), 303);
  }
}
