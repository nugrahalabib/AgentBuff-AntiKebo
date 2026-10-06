import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HalamanPengaturan } from "@/components/app/pengaturan";
import { dataSambungan } from "@/lib/app/data";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await kamusServer()).t.pengaturan.judul };
}

export default async function Halaman() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const u = s.pengguna;
  return (
    <HalamanPengaturan
      email={u.email}
      nama={u.nama}
      tema={u.tema}
      locale={u.locale}
      zona={u.zonaWaktu}
      sambungan={await dataSambungan(u.id)}
      bantuan={`${process.env.AGENTBUFF_ORIGIN ?? "https://agentbuff.id"}/app/bantuan`}
    />
  );
}
