import { z } from "zod";
import { rute } from "@/lib/app/rute";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { aturAktifOtomasi, hapusOtomasi } from "@/lib/layanan/otomasi";

export const dynamic = "force-dynamic";
type Param = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = z.object({ aktif: z.boolean() }).safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Tidak sah.");
    await aturAktifOtomasi(pengguna.id, id, p.data.aktif, "web");
    return { ok: true };
  });
}

export async function DELETE(req: Request, { params }: Param) {
  const { id } = await params;
  return rute(req, { mutasi: true, bolehBeku: true }, async ({ pengguna }) => {
    await hapusOtomasi(pengguna.id, id, "web");
    return { ok: true };
  });
}
