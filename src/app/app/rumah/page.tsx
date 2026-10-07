import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RumahPintar } from "@/components/app/rumah-pintar";
import { WizardRumah } from "@/components/app/wizard-rumah";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { daftarPerangkatRumah, statusRumah } from "@/lib/layanan/tuya";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.rumah.judul };
}

/** Rumah pintar (PRD I1 sampai I6): belum tersambung = wizard 3 langkah; tersambung = perangkat per ruangan. */
export default async function HalamanRumah({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const [st, cari] = await Promise.all([statusRumah(s.pengguna.id), searchParams]);
  if (!st.tersambung || cari.perbarui === "1") return <WizardRumah perbarui={st.tersambung} />;
  const { ruangan } = await daftarPerangkatRumah(s.pengguna.id);
  return (
    <RumahPintar status={{ bermasalah: st.bermasalah, kunciSamar: st.kunciSamar, wilayah: st.wilayah.nama, perangkat: st.perangkat, darurat: st.darurat }} ruanganAwal={ruangan} />
  );
}
