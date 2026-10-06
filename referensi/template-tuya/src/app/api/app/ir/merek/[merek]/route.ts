import { rute } from "@/lib/app/rute";
import { modelUntukMerek } from "@/lib/layanan/ir";

export const dynamic = "force-dynamic";
type Param = { params: Promise<{ merek: string }> };

export async function GET(req: Request, { params }: Param) {
  const { merek } = await params;
  return rute(req, {}, async () => modelUntukMerek(decodeURIComponent(merek)));
}
