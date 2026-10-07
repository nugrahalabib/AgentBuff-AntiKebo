import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TabRiwayat } from "@/components/app/tab-riwayat";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { riwayatPengguna } from "@/lib/layanan/riwayat";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.riwayat.judul };
}

/** Tab Riwayat (PRD K, docs/04-DESAIN.md §4.9). */
export default async function HalamanRiwayat() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  return <TabRiwayat ringkasan={await riwayatPengguna(s.pengguna.id)} />;
}
