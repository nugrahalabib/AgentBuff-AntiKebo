import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HalamanSuasana } from "@/components/app/suasana";
import { dataRumah } from "@/lib/app/data";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await kamusServer()).t.suasana.judul };
}

export default async function Halaman() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const data = await dataRumah(s.pengguna.id);
  if (!data.sambungan) redirect("/app/sambungkan");
  return <HalamanSuasana awal={data} />;
}
