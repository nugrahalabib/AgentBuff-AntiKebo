import { z } from "zod";
import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { fotoKameraUntukLayar, tangkapKamera } from "@/lib/layanan/ekstra";
import { daftarFoto } from "@/lib/layanan/foto";

export const dynamic = "force-dynamic";
type Param = { params: Promise<{ id: string }> };

const SKEMA = z.strictObject({ jenis: z.enum(["foto", "video"]), detik: z.number().int().min(1).max(60).optional() });

/** Foto & klip tersimpan (7 hari) dari kamera ini: diambil di app, lewat agen, atau oleh otomasi. */
export async function GET(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { bolehBeku: true }, async ({ pengguna }) => {
    const d = await daftarFoto(pengguna.id, { deviceId: id, batas: 12 });
    return d.map((f) => ({ id: f.id, jalur: f.jalur, jenis: f.jenis, sumber: f.sumber, catatan: f.catatan, dibuat: f.dibuat.toISOString(), kedaluwarsa: f.kedaluwarsa.toISOString() }));
  });
}

/** Foto (tautan salinan 7 hari) atau klip dari kamera Tuya. */
export async function POST(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = SKEMA.safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Permintaan tidak sah.");
    if (p.data.jenis === "foto") return fotoKameraUntukLayar(pengguna.id, id);
    const h = await tangkapKamera(pengguna.id, id, "video", p.data.detik ?? 10, undefined, "web");
    return { video: h.tersimpan?.jalur ?? h.video, tersimpan: !!h.tersimpan };
  });
}
