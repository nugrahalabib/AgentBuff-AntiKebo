import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TabSiaga, type PerangkatKlien } from "@/components/app/tab-siaga";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { alarmBerikutnyaUtc, daftarAlarm } from "@/lib/layanan/alarm";
import { daftarPerangkat } from "@/lib/layanan/perangkat";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.siaga.judul };
}

/** Tab Siaga (PRD H1, docs/04-DESAIN.md §4.7): perangkat yang membunyikan alarm + cara menambah. */
export default async function HalamanSiaga() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const [perangkat, alarm] = await Promise.all([daftarPerangkat(s.pengguna.id), daftarAlarm(s.pengguna.id)]);
  const berikutnya = alarmBerikutnyaUtc(alarm);
  return <TabSiaga awal={JSON.parse(JSON.stringify(perangkat)) as PerangkatKlien[]} alarmBerikutnya={berikutnya?.toISOString() ?? null} waktuServer={new Date().getTime()} />;
}
