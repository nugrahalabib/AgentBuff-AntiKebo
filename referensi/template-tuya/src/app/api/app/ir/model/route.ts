import { rute } from "@/lib/app/rute";
import { cariKodeModel } from "@/lib/layanan/ir";

export const dynamic = "force-dynamic";

/** Cari kode remote dari kode model di stiker unit AC / remote. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return rute(req, {}, async () => ({ hasil: cariKodeModel(q.slice(0, 40)) }));
}
