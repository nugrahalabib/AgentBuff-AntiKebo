import { rute } from "@/lib/app/rute";
import { jalankanSuasana } from "@/lib/layanan/suasana";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rute(req, { mutasi: true }, ({ pengguna }) => jalankanSuasana(pengguna.id, id, "web"));
}
