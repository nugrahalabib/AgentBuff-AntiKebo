import { rute } from "@/lib/app/rute";
import { pemakaianListrik } from "@/lib/layanan/ekstra";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tanggal = new URL(req.url).searchParams.get("tanggal");
  return rute(req, {}, ({ pengguna }) => pemakaianListrik(pengguna.id, id, tanggal, pengguna.zonaWaktu));
}
