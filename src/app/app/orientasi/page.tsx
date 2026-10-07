import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrientasiHidup } from "@/components/app/orientasi";
import { PengawasAlarm } from "@/components/app/pengawas-alarm";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { ambilPreferensi } from "@/lib/layanan/preferensi";
import { statusRumah } from "@/lib/layanan/tuya";
import { kunciPublikVapid } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.orientasi.sambutanJudul };
}

/** Orientasi pertama (PRD J): sesudah masuk pertama (Beranda mengarahkan ke sini), bisa diulang dari Pengaturan. */
export default async function HalamanOrientasi() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const [pref, rumah] = await Promise.all([ambilPreferensi(s.pengguna.id), statusRumah(s.pengguna.id)]);
  return (
    <>
      <PengawasAlarm />
      <OrientasiHidup
        nama={pref.namaPanggilan ?? (pref.nama ?? "").trim().split(/\s+/)[0] ?? ""}
        namaTersimpan={pref.namaPanggilan}
        karakter={pref.bawaan.karakter}
        spamBawaan={pref.bawaan.spam}
        kunciPublik={kunciPublikVapid()}
        rumahTersambung={rumah.tersambung}
      />
    </>
  );
}
