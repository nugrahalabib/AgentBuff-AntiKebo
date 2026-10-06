import { rute } from "@/lib/app/rute";
import { sinkronkanPengguna } from "@/lib/layanan/rumah";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return rute(req, { mutasi: true }, ({ pengguna }) => sinkronkanPengguna(pengguna.id));
}
