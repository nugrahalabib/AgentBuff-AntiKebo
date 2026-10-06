import { cabutToken } from "@/lib/agen/token";
import { rute } from "@/lib/app/rute";
import { catatAktivitas } from "@/lib/layanan/aktivitas";
import { GalatLayanan } from "@/lib/layanan/dasar";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rute(req, { mutasi: true, bolehBeku: true }, async ({ pengguna }) => {
    if (!(await cabutToken(pengguna.id, id))) throw new GalatLayanan("tidak_ditemukan", "Token tidak ditemukan.");
    await catatAktivitas(pengguna.id, { sumber: "web", jenis: "token", ringkasan: "Token MCP dicabut" });
    return { ok: true };
  });
}
