import { z } from "zod";
import { terbitkanToken } from "@/lib/agen/token";
import { rute } from "@/lib/app/rute";
import { denganPengguna } from "@/lib/db";
import { catatAktivitas } from "@/lib/layanan/aktivitas";
import { GalatLayanan } from "@/lib/layanan/dasar";

export const dynamic = "force-dynamic";

/** Token manual untuk klien MCP lain. Ditampilkan SEKALI di jawaban ini. */
export async function POST(req: Request) {
  return rute(req, { mutasi: true }, async ({ pengguna, json }) => {
    const p = z.object({ label: z.string().min(1).max(60) }).safeParse(await json());
    if (!p.success) throw new GalatLayanan("masukan", "Beri label token.");
    const kedaluwarsa = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const { token } = await denganPengguna(pengguna.id, (tx) => terbitkanToken(tx, { penggunaId: pengguna.id, label: p.data.label, sumber: "manual", kedaluwarsa }));
    await catatAktivitas(pengguna.id, { sumber: "web", jenis: "token", ringkasan: `Token MCP dibuat: ${p.data.label}` });
    return { token };
  });
}
