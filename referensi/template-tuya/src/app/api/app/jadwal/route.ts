import { z } from "zod";
import { dataJadwal } from "@/lib/app/data";
import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { buatJadwal } from "@/lib/layanan/jadwal";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return rute(req, { bolehBeku: true }, ({ pengguna }) => dataJadwal(pengguna.id));
}

const SKEMA = z.object({
  nama: z.string().max(80).optional(),
  dalamMenit: z.number().int().min(1).max(10080).optional(),
  jam: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  hari: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  perangkat: z.string().max(80).optional(),
  nyala: z.boolean().optional(),
  suasana: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = SKEMA.safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Jadwal belum lengkap.");
    const d = p.data;
    if (!!d.perangkat === !!d.suasana) throw new GalatLayanan("masukan", "Pilih perangkat atau suasana.");
    const target = d.suasana
      ? { suasana: d.suasana }
      : { perangkat: d.perangkat!, perintah: { nyala: d.nyala ?? false }, ringkasan: d.nyala ? "nyalakan" : "matikan" };
    const j = await buatJadwal(pengguna.id, { nama: d.nama, dalamMenit: d.dalamMenit, jam: d.jam, hari: d.hari, zona: pengguna.zonaWaktu, target }, "web");
    return { id: j.id };
  });
}
