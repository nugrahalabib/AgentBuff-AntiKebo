import { z } from "zod";
import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { aturPerangkat, gantiNama, kendalikan, segarkanPerangkat } from "@/lib/layanan/rumah";

export const dynamic = "force-dynamic";
type Param = { params: Promise<{ id: string }> };

const SKEMA_PERINTAH = z.strictObject({
  nyala: z.boolean().optional(),
  saluran: z.number().int().min(1).max(8).optional(),
  terangPersen: z.number().min(0).max(100).optional(),
  warna: z.string().max(30).optional(),
  suhuPutihPersen: z.number().min(0).max(100).optional(),
  suhuTarget: z.number().min(-20).max(100).optional(),
  modeAc: z.string().max(30).optional(),
  kipas: z.union([z.string().max(20), z.number()]).optional(),
  tirai: z.enum(["buka", "tutup", "berhenti"]).optional(),
  posisiPersen: z.number().min(0).max(100).optional(),
  modeLampu: z.string().max(20).optional(),
  hitungMundurMenit: z.number().min(0).max(1440).optional(),
  properti: z.record(z.string().max(60), z.unknown()).optional(),
});

/** Ambil keadaan terbaru dari Tuya (dipakai saat lembar detail dibuka). */
export async function GET(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, {}, async ({ pengguna }) => ({ perangkat: await segarkanPerangkat(pengguna.id, id) }));
}

/** Kendali dari web. Pengguna sendiri yang menekan, jadi tidak perlu konfirmasi tambahan. */
export async function POST(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = SKEMA_PERINTAH.safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Perintah tidak sah.");
    return kendalikan(pengguna.id, id, p.data, { sumber: "web", konfirmasi: true });
  });
}

const SKEMA_ATUR = z.object({ nama: z.string().min(1).max(60).optional(), sensitif: z.boolean().nullable().optional(), disembunyikan: z.boolean().optional() });

export async function PATCH(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = SKEMA_ATUR.safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Pengaturan tidak sah.");
    if (p.data.nama) await gantiNama(pengguna.id, id, p.data.nama, "web");
    if (p.data.sensitif !== undefined || p.data.disembunyikan !== undefined) await aturPerangkat(pengguna.id, id, { sensitif: p.data.sensitif, disembunyikan: p.data.disembunyikan });
    return { ok: true };
  });
}
