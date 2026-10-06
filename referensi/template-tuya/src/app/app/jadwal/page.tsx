import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HalamanJadwal } from "@/components/app/jadwal";
import { dataJadwal, dataOtomasi, dataRumah } from "@/lib/app/data";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await kamusServer()).t.jadwal.judul };
}

export default async function Halaman() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const [rumah, jadwal, otomasi] = await Promise.all([dataRumah(s.pengguna.id), dataJadwal(s.pengguna.id), dataOtomasi(s.pengguna.id)]);
  if (!rumah.sambungan) redirect("/app/sambungkan");
  return <HalamanJadwal awalRumah={rumah} awalJadwal={jadwal} awalOtomasi={otomasi} />;
}
