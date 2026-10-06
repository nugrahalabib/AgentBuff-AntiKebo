import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { putuskan, simpanKunci } from "@/lib/layanan/sambungan";

export const dynamic = "force-dynamic";

/** Simpan / perbarui kunci rumah. Kunci diuji ke Tuya dulu; tidak pernah dikembalikan ke peramban. */
export async function POST(req: Request) {
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const b = await json<{ kunci?: unknown }>();
    if (typeof b?.kunci !== "string" || b.kunci.length > 300) throw new GalatLayanan("kunci_tidak_sah", "Tempel kuncinya dulu.");
    return simpanKunci(pengguna.id, b.kunci, "web");
  });
}

export async function DELETE(req: Request) {
  return rute(req, { mutasi: true, bolehBeku: true }, async ({ pengguna }) => {
    await putuskan(pengguna.id);
    return { ok: true };
  });
}
