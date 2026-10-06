import { z } from "zod";
import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { POLA_ID_KODE } from "@/lib/ir/kode-ac";
import { hapusKodeAc, pemancarUntuk, simpanKodeAc, ujiKodeAc } from "@/lib/layanan/ir";

export const dynamic = "force-dynamic";
type Param = { params: Promise<{ id: string }> };

/** Pemancar IR yang bisa dipakai AC ini. */
export async function GET(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, {}, async ({ pengguna }) => ({ pemancar: await pemancarUntuk(pengguna.id, id) }));
}

const SKEMA = z.discriminatedUnion("aksi", [
  z.strictObject({ aksi: z.literal("uji"), pustaka: z.string().regex(POLA_ID_KODE).nullable().optional(), uji: z.enum(["nyala", "mati", "lengkap"]), pemancar: z.string().max(80).nullable().optional() }),
  z.strictObject({ aksi: z.literal("simpan"), pustaka: z.string().regex(POLA_ID_KODE), pemancar: z.string().max(80).nullable().optional() }),
  z.strictObject({ aksi: z.literal("hapus") }),
]);

export async function POST(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = SKEMA.safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Permintaan tidak sah.");
    const d = p.data;
    if (d.aksi === "uji") return ujiKodeAc(pengguna.id, id, d.pustaka ?? null, d.uji, d.pemancar ?? null, "web");
    if (d.aksi === "simpan") return simpanKodeAc(pengguna.id, id, d.pustaka, d.pemancar ?? null, "web");
    await hapusKodeAc(pengguna.id, id, "web");
    return { ok: true };
  });
}
