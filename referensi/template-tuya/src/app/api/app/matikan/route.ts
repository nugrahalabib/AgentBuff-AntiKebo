import { z } from "zod";
import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { kendalikanBanyak } from "@/lib/layanan/rumah";

export const dynamic = "force-dynamic";

/** Matikan banyak perangkat sekaligus (tombol "Matikan semua" per ruangan). */
export async function POST(req: Request) {
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = z.object({ ids: z.array(z.string().max(80)).min(1).max(50) }).safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Daftar perangkat tidak sah.");
    return kendalikanBanyak(pengguna.id, p.data.ids, { nyala: false }, { sumber: "web", konfirmasi: true });
  });
}
