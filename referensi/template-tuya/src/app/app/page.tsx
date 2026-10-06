import { redirect } from "next/navigation";
import { Rumah } from "@/components/app/rumah";
import { dataRumah } from "@/lib/app/data";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { waktuHari } from "@/lib/waktu/suasana-hari";

export const dynamic = "force-dynamic";

export default async function HalamanRumah() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const [data, { t }] = await Promise.all([dataRumah(s.pengguna.id), kamusServer()]);
  if (!data.sambungan) redirect("/app/sambungkan");
  const nama = (s.pengguna.nama ?? "").split(" ")[0];
  const sapaan = `${t.waktu[waktuHari(s.pengguna.zonaWaktu)]}${nama ? `, ${nama}` : ""}`;
  return <Rumah awal={data} sapaan={sapaan} />;
}
