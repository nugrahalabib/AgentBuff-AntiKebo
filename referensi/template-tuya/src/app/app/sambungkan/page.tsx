import type { Metadata } from "next";
import { Wizard } from "@/components/app/wizard";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { bacaSambungan } from "@/lib/layanan/sambungan";
import { kamusServer } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.sambungkan.judul };
}

export default async function Sambungkan() {
  const s = await sesiSaatIni();
  const sambungan = s ? await bacaSambungan(s.pengguna.id) : null;
  return <Wizard perbarui={!!sambungan} />;
}
