import { z } from "zod";
import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { potretKeadaan, simpanSuasana } from "@/lib/layanan/suasana";

export const dynamic = "force-dynamic";

const SKEMA = z.object({ id: z.string().uuid().optional(), nama: z.string().min(1).max(40), ikon: z.string().max(30).optional(), warna: z.string().max(20).optional(), perangkat: z.array(z.string().max(80)).min(1).max(40) });

/** Simpan suasana dari keadaan SEKARANG perangkat terpilih (buat baru atau perbarui `id`). */
export async function POST(req: Request) {
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = SKEMA.safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Isi nama dan pilih minimal satu perangkat.");
    const aksi = await potretKeadaan(pengguna.id, p.data.perangkat);
    if (!aksi.length) throw new GalatLayanan("masukan", "Perangkat terpilih belum punya keadaan yang bisa disimpan. Muat ulang dari Tuya dulu.");
    const s = await simpanSuasana(pengguna.id, { id: p.data.id, nama: p.data.nama, ikon: p.data.ikon, warna: p.data.warna, aksi }, "web");
    return { id: s.id, nama: s.nama, jumlah: aksi.length };
  });
}
