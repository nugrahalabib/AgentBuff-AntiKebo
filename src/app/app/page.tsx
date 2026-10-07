import { AlarmClock } from "lucide-react";
import { redirect } from "next/navigation";
import { Kosong, Spanduk, TautanTombol } from "@/components/ui/dasar";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { waktuHari } from "@/lib/waktu/suasana-hari";

export const dynamic = "force-dynamic";

/** Beranda (tab Alarm). Daftar alarm, kartu alarm berikutnya, dan pembuatnya dibangun di P2/P8. */
export default async function HalamanAlarm() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const { t } = await kamusServer();
  const nama = (s.pengguna.nama ?? "").split(" ")[0];
  const sapaan = `${t.waktu[waktuHari(s.pengguna.zonaWaktu)]}${nama ? `, ${nama}` : ""}`;
  const izinKurang = !s.pengguna.izinKabar || !s.pengguna.izinSuara;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-judul-besar muncul pt-2">{sapaan}</h1>
      {izinKurang ? (
        <Spanduk
          judul={t.izin.judul}
          isi={t.izin.isi}
          aksi={
            <TautanTombol href="/auth/agentbuff/start?izin=1&lanjut=/app" ukuran="sedang">
              {t.izin.tombol}
            </TautanTombol>
          }
        />
      ) : null}
      <Kosong ikon={<AlarmClock size={28} strokeWidth={1.75} />} judul={t.beranda.kosongJudul} isi={`${t.beranda.kosongIsi} ${t.beranda.segera}`} />
    </div>
  );
}
