import { and, eq, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db, schema } from "@/lib/db";
import { acakBase64Url, sha256Hex } from "@/lib/kripto";

// Sesi cookie: `__Host-antikebo_s` httpOnly, Secure, SameSite=Lax,
// Path=/. Isinya id acak 32 byte; DB hanya menyimpan HASH-nya, jadi cadangan
// DB yang bocor tidak bisa dipakai untuk masuk.
// Sesi panjang: 30 hari bergulir sejak terakhir dipakai, paling lama 90 hari (K-22),
// supaya pengguna tidak dilempar ke layar masuk saat setengah sadar.

export const NAMA_COOKIE_SESI = "__Host-antikebo_s";
const DIAM_MS = 30 * 24 * 60 * 60 * 1000;
const MUTLAK_MS = 90 * 24 * 60 * 60 * 1000;
const GESER_SETIAP_MS = 5 * 60 * 1000;

export type Sesi = typeof schema.sesi.$inferSelect;
export type Pengguna = typeof schema.pengguna.$inferSelect;

async function asalPermintaan(): Promise<{ ip: string | null; ua: string | null }> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { ip, ua: h.get("user-agent")?.slice(0, 300) ?? null };
}

export const OPSI_COOKIE_SESI = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: Math.floor(MUTLAK_MS / 1000),
};

/** Buat baris sesi; kembalikan token mentah untuk dipasang ke cookie oleh pemanggil (Route Handler). */
export async function buatSesi(penggunaId: string, opsi: { mutlakMs?: number } = {}): Promise<string> {
  const token = acakBase64Url(32);
  const sekarang = Date.now();
  const mutlak = Math.min(opsi.mutlakMs ?? MUTLAK_MS, MUTLAK_MS);
  const { ip, ua } = await asalPermintaan();
  await db()
    .insert(schema.sesi)
    .values({
      idHash: sha256Hex(token),
      penggunaId,
      kedaluwarsaDiam: new Date(sekarang + Math.min(DIAM_MS, mutlak)),
      kedaluwarsaMutlak: new Date(sekarang + mutlak),
      ip,
      ua,
    });
  return token;
}

/** Sesi + pengguna untuk permintaan ini, atau null. Dicache per permintaan. */
export const sesiSaatIni = cache(async (): Promise<{ sesi: Sesi; pengguna: Pengguna } | null> => {
  const token = (await cookies()).get(NAMA_COOKIE_SESI)?.value;
  if (!token || token.length > 100) return null;
  const idHash = sha256Hex(token);
  const [baris] = await db()
    .select({ sesi: schema.sesi, pengguna: schema.pengguna })
    .from(schema.sesi)
    .innerJoin(schema.pengguna, eq(schema.pengguna.id, schema.sesi.penggunaId))
    .where(and(eq(schema.sesi.idHash, idHash), isNull(schema.sesi.dicabutPada), isNull(schema.pengguna.dihapusPada)))
    .limit(1);
  if (!baris) return null;
  const sekarang = Date.now();
  if (baris.sesi.kedaluwarsaDiam.getTime() <= sekarang || baris.sesi.kedaluwarsaMutlak.getTime() <= sekarang) return null;
  if (sekarang - baris.sesi.terakhirAktif.getTime() > GESER_SETIAP_MS) {
    const diamBaru = new Date(Math.min(sekarang + DIAM_MS, baris.sesi.kedaluwarsaMutlak.getTime()));
    await db()
      .update(schema.sesi)
      .set({ terakhirAktif: new Date(sekarang), kedaluwarsaDiam: diamBaru })
      .where(eq(schema.sesi.idHash, idHash));
  }
  return baris;
});

export async function hapusCookieSesi(): Promise<void> {
  (await cookies()).set(NAMA_COOKIE_SESI, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function cabutSesiIni(): Promise<void> {
  const token = (await cookies()).get(NAMA_COOKIE_SESI)?.value;
  if (token) {
    await db()
      .update(schema.sesi)
      .set({ dicabutPada: new Date() })
      .where(eq(schema.sesi.idHash, sha256Hex(token)));
  }
  await hapusCookieSesi();
}

/** "Keluar dari semua perangkat". */
export async function cabutSemuaSesi(penggunaId: string): Promise<number> {
  const hasil = await db()
    .update(schema.sesi)
    .set({ dicabutPada: new Date() })
    .where(and(eq(schema.sesi.penggunaId, penggunaId), isNull(schema.sesi.dicabutPada)))
    .returning({ idHash: schema.sesi.idHash });
  return hasil.length;
}
