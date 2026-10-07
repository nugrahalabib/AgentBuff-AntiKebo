import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LayarAlarmHidup } from "@/components/app/alarm-hidup";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { GalatLayanan } from "@/lib/layanan/dasar";
import { layarKejadian } from "@/lib/layanan/kejadian";
import type { LayarKejadianKlien } from "@/lib/tampilan/alarm-klien";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await sesiSaatIni();
  if (!s) return {};
  const k = await layarKejadian(s.pengguna.id, (await params).id).catch(() => null);
  return { title: k ? `${k.jam} ${k.judul}` : undefined };
}

/**
 * Layar alarm penuh (docs/04-DESAIN.md §4.3 sampai §4.5): tujuan tautan di setiap notifikasi dan
 * pesan spam (`/app/bunyi/<id kejadian>`). Tanpa kerangka aplikasi.
 */
export default async function HalamanBunyi({ params }: Props) {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const { id } = await params;
  let awal: LayarKejadianKlien;
  try {
    awal = JSON.parse(JSON.stringify(await layarKejadian(s.pengguna.id, id))) as LayarKejadianKlien;
  } catch (e) {
    if (e instanceof GalatLayanan && e.kode === "tidak_ditemukan") redirect("/app");
    throw e;
  }
  return <LayarAlarmHidup awal={awal} />;
}
