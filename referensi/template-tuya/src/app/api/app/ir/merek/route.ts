import { rute } from "@/lib/app/rute";
import { daftarMerek } from "@/lib/layanan/ir";

export const dynamic = "force-dynamic";

/** Merek AC yang punya kode remote di pustaka (urut: yang umum di Indonesia dulu). */
export async function GET(req: Request) {
  return rute(req, {}, async () => ({ merek: daftarMerek() }));
}
