import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { JamMejaHidup } from "@/components/app/jam-meja";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.jamMeja.judul };
}

/** Mode Jam Meja (PRD H2): layar penuh tanpa kerangka aplikasi. */
export default async function HalamanJamMeja() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  return <JamMejaHidup zona={s.pengguna.zonaWaktu} waktuServer={new Date().getTime()} />;
}
