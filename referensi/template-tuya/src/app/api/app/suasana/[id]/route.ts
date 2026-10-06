import { rute } from "@/lib/app/rute";
import { hapusSuasana } from "@/lib/layanan/suasana";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rute(req, { mutasi: true, bolehBeku: true }, async ({ pengguna }) => {
    await hapusSuasana(pengguna.id, id, "web");
    return { ok: true };
  });
}
