import { rute } from "@/lib/app/rute";
import { dataRumah } from "@/lib/app/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return rute(req, { bolehBeku: true }, ({ pengguna }) => dataRumah(pengguna.id));
}
