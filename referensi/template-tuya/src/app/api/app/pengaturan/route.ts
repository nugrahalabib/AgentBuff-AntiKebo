import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { rute } from "@/lib/app/rute";
import { db, schema } from "@/lib/db";
import { NAMA_COOKIE_BAHASA } from "@/lib/i18n";
import { GalatLayanan } from "@/lib/layanan/dasar";

export const dynamic = "force-dynamic";

const SKEMA = z.object({
  tema: z.enum(["sistem", "terang", "gelap"]).optional(),
  locale: z.enum(["id", "en"]).optional(),
  zonaWaktu: z.enum(["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"]).optional(),
});

export async function PATCH(req: Request) {
  return rute(req, { mutasi: true, bolehBeku: true }, async ({ pengguna, json }) => {
    const p = SKEMA.safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Pengaturan tidak sah.");
    await db().update(schema.pengguna).set(p.data).where(eq(schema.pengguna.id, pengguna.id));
    const res = NextResponse.json({ ok: true });
    if (p.data.locale) res.cookies.set(NAMA_COOKIE_BAHASA, p.data.locale, { path: "/", maxAge: 365 * 24 * 3600, sameSite: "lax", secure: true });
    return res;
  });
}
