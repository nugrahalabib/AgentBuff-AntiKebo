import { z } from "zod";
import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { aturAktifJadwal, hapusJadwal } from "@/lib/layanan/jadwal";

export const dynamic = "force-dynamic";
type Param = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = z.object({ aktif: z.boolean() }).safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Tidak sah.");
    await aturAktifJadwal(pengguna.id, id, p.data.aktif);
    return { ok: true };
  });
}

export async function DELETE(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { mutasi: true, bolehBeku: true }, async ({ pengguna }) => {
    await hapusJadwal(pengguna.id, id, "web");
    return { ok: true };
  });
}
