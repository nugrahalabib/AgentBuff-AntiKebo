import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Kesehatan: DB + detak worker terakhir. Tanpa data pengguna apa pun.
// `ok` = basis data terjangkau. Basinya detak worker dipantau worker/operator (N1),
// tidak membuat web dianggap mati (web tetap harus melayani layar alarm).
export const dynamic = "force-dynamic";

export async function GET() {
  const hasil: { ok: boolean; db: boolean; worker: string | null; versi: string } = { ok: false, db: false, worker: null, versi: process.env.ANTIKEBO_VERSI ?? "dev" };
  try {
    await db().execute(sql`select 1`);
    hasil.db = true;
    const [detak] = await db()
      .select({ t: sql<Date | null>`max(${schema.detakWorker.terakhir})` })
      .from(schema.detakWorker);
    hasil.worker = detak?.t ? new Date(detak.t).toISOString() : null;
  } catch {
    hasil.db = false;
  }
  hasil.ok = hasil.db;
  return Response.json(hasil, { status: hasil.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
