import { dataOtomasi } from "@/lib/app/data";
import { rute } from "@/lib/app/rute";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return rute(req, { bolehBeku: true }, ({ pengguna }) => dataOtomasi(pengguna.id));
}
