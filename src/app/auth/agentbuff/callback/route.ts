import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { bacaCookieOidc, NAMA_COOKIE_OIDC, selesaikanMasuk } from "@/lib/agentbuff/oidc";
import { cekHak } from "@/lib/agentbuff/status";
import { buatSesi, NAMA_COOKIE_SESI, OPSI_COOKIE_SESI } from "@/lib/auth/sesi";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { antreUlangSesudahIzin } from "@/lib/layanan/suara";
import { catatAudit } from "@/lib/layanan/audit";
import { log } from "@/lib/log";

// Callback "Masuk dengan AgentBuff".
export const dynamic = "force-dynamic";

function ke(jalur: string, hapusOidc = true) {
  const res = NextResponse.redirect(new URL(jalur, env("APP_ORIGIN")), 303);
  if (hapusOidc) res.cookies.set(NAMA_COOKIE_OIDC, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  // URL publik yang dilihat AgentBuff: di balik proxy req.url bisa berupa alamat
  // internal kontainer; openid-client membandingkan redirect_uri persis.
  const urlPublik = new URL(`${env("APP_ORIGIN")}${url.pathname}${url.search}`);
  const isi = bacaCookieOidc(req.cookies.get(NAMA_COOKIE_OIDC)?.value);
  if (!isi) return ke("/masuk?galat=sesi_masuk_kedaluwarsa");

  const hasil = await selesaikanMasuk(urlPublik, isi).catch((e) => {
    log.warn({ err: (e as Error)?.message }, "discovery AgentBuff gagal saat callback");
    return { jenis: "galat", kode: "agentbuff_tak_terjangkau" } as const;
  });
  if (hasil.jenis === "ditolak") return ke(`/masuk?alasan=${encodeURIComponent(hasil.alasan)}`);
  if (hasil.jenis === "perlu_interaktif") {
    return ke(`/auth/agentbuff/start?lanjut=${encodeURIComponent(isi.lanjut)}${isi.cakupan === "dasar" ? "&cakupan=dasar" : ""}`, false);
  }
  if (hasil.jenis === "cakupan_ditolak") {
    log.warn("AgentBuff menolak scope izin kabar/suara; masuk diulang dengan cakupan dasar");
    return ke(`/auth/agentbuff/start?cakupan=dasar&lanjut=${encodeURIComponent(isi.lanjut)}`, false);
  }
  if (hasil.jenis === "galat") {
    log.warn({ kode: hasil.kode }, "masuk AgentBuff gagal");
    return ke(`/masuk?galat=${encodeURIComponent(hasil.kode)}`);
  }

  const { klaim, izin } = hasil;
  const [ada] = await db().select().from(schema.pengguna).where(eq(schema.pengguna.agentbuffSub, klaim.sub)).limit(1);
  const idPengguna =
    ada?.id ??
    (
      await db()
        .insert(schema.pengguna)
        .values({ agentbuffSub: klaim.sub, email: klaim.email, nama: klaim.nama })
        .onConflictDoUpdate({ target: schema.pengguna.agentbuffSub, set: { terakhirMasuk: new Date() } })
        .returning({ id: schema.pengguna.id })
    )[0].id;

  // Pemeriksaan hak KETAT (tanpa singgahan) sebelum sesi dibuat.
  const hak = await cekHak({ id: idPengguna, agentbuffSub: klaim.sub }, { ketat: true });
  if (!hak.aktif) {
    return ke(hak.alasan === "tidak_terjangkau" ? "/masuk?galat=agentbuff_tak_terjangkau" : `/masuk?alasan=${encodeURIComponent(hak.alasan)}`);
  }

  const kini = new Date();
  await db()
    .update(schema.pengguna)
    .set({
      email: klaim.email ?? ada?.email ?? null,
      nama: ada?.nama ?? klaim.nama ?? null,
      foto: klaim.foto,
      izinKabar: izin.kabar,
      izinSuara: izin.suara,
      izinDiperbarui: kini,
      terakhirMasuk: kini,
      dihapusPada: null,
    })
    .where(eq(schema.pengguna.id, idPengguna));

  await catatAudit(idPengguna, { sumber: "web", jenis: "masuk", ringkasan: "Masuk dengan AgentBuff", detail: { izinKabar: izin.kabar, izinSuara: izin.suara } });
  // Izin suara (baru) diberi: naskah yang tertahan "belum diizinkan" dibuat lagi.
  if (izin.suara) await antreUlangSesudahIzin(idPengguna).catch(() => 0);

  const token = await buatSesi(idPengguna);
  const res = ke(isi.lanjut);
  res.cookies.set(NAMA_COOKIE_SESI, token, OPSI_COOKIE_SESI);
  return res;
}
