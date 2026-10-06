import { rute } from "@/lib/app/rute";
import { cuacaRumah } from "@/lib/layanan/ekstra";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rumah = new URL(req.url).searchParams.get("rumah");
  return rute(req, {}, ({ pengguna }) => cuacaRumah(pengguna.id, rumah));
}
