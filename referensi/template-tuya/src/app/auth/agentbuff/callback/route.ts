import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { bacaCookieOidc, NAMA_COOKIE_OIDC, selesaikanMasuk } from "@/lib/agentbuff/oidc";
import { cekHak } from "@/lib/agentbuff/status";
import { catatAktivitas } from "@/lib/layanan/aktivitas";
import { buatSesi, NAMA_COOKIE_SESI, OPSI_COOKIE_SESI } from "@/lib/auth/sesi";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
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
  // URL publik yang dilihat AgentBuff - di balik proxy req.url bisa berupa
  // alamat internal kontainer; openid-client membandingkan redirect_uri persis.
  const urlPublik = new URL(`${env("APP_ORIGIN")}${url.pathname}${url.search}`);
  const isi = bacaCookieOidc(req.cookies.get(NAMA_COOKIE_OIDC)?.value);
  if (!isi) return ke("/masuk?galat=sesi_masuk_kedaluwarsa");

  const hasil = await selesaikanMasuk(urlPublik, isi);
  if (hasil.jenis === "ditolak") return ke(`/masuk?alasan=${encodeURIComponent(hasil.alasan)}`);
  if (hasil.jenis === "perlu_interaktif") {
    return ke(`/auth/agentbuff/start?lanjut=${encodeURIComponent(isi.lanjut)}`, false);
  }
  if (hasil.jenis === "galat") {
    log.warn({ kode: hasil.kode }, "masuk AgentBuff gagal");
    return ke(`/masuk?galat=${encodeURIComponent(hasil.kode)}`);
  }

  const { klaim } = hasil;
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

  await db()
    .update(schema.pengguna)
    .set({
      email: klaim.email ?? ada?.email ?? null,
      nama: ada?.nama ?? klaim.nama ?? null,
      foto: klaim.foto,
      terakhirMasuk: new Date(),
      dihapusPada: null,
    })
    .where(eq(schema.pengguna.id, idPengguna));

  await catatAktivitas(idPengguna, { sumber: "web", jenis: "lainnya", ringkasan: "Masuk dengan AgentBuff" });

  const token = await buatSesi(idPengguna);
  const res = ke(isi.lanjut);
  res.cookies.set(NAMA_COOKIE_SESI, token, OPSI_COOKIE_SESI);
  return res;
}
