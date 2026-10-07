import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BerandaAlarm } from "@/components/app/beranda-alarm";
import { Spanduk, TautanTombol } from "@/components/ui/dasar";
import { BAWAAN_SISTEM } from "@/lib/alarm/isi";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { kamusServer } from "@/lib/i18n/server";
import { daftarAlarm } from "@/lib/layanan/alarm";
import { daftarPerangkat } from "@/lib/layanan/perangkat";
import { ambilPreferensi } from "@/lib/layanan/preferensi";
import { statusRumah } from "@/lib/layanan/tuya";
import type { AlarmKlien, FormAlarm } from "@/lib/tampilan/alarm-klien";
import { waktuHari } from "@/lib/waktu/suasana-hari";

export const dynamic = "force-dynamic";

/** Beranda (tab Alarm, PRD B7): alarm berikutnya, alarm lainnya, spanduk masalah, lembar Ubah alarm. */
export default async function HalamanAlarm() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const { t } = await kamusServer();
  const [alarm, perangkat, rumah, pref] = await Promise.all([
    daftarAlarm(s.pengguna.id),
    daftarPerangkat(s.pengguna.id),
    statusRumah(s.pengguna.id),
    ambilPreferensi(s.pengguna.id),
  ]);
  const nama = (s.pengguna.namaPanggilan ?? s.pengguna.nama ?? "").trim().split(/\s+/)[0] ?? "";
  const sapaan = `${t.waktu[waktuHari(s.pengguna.zonaWaktu)]}${nama ? `, ${nama}` : ""}`;
  const hariIni = new Intl.DateTimeFormat("en-CA", { timeZone: s.pengguna.zonaWaktu }).format(new Date());
  const izinKurang = !s.pengguna.izinKabar || !s.pengguna.izinSuara;
  const formBaru: FormAlarm = {
    ...BAWAAN_SISTEM,
    ...pref.bawaan,
    jam: "06:00",
    pengulangan: { jenis: "sekali" },
    agendaJudul: t.alarmBaru.judulBawaan,
    agendaDetail: null,
    tuya: [],
    kalimatPribadi: [],
    aktif: true,
  };

  const spanduk = (
    <>
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
      {rumah.tersambung && rumah.bermasalah ? (
        <Spanduk
          nada="bahaya"
          judul={t.rumah.spanduk.judul}
          isi={t.rumah.spanduk.isi}
          aksi={
            <TautanTombol href="/app/rumah?perbarui=1" ukuran="sedang">
              {t.rumah.perbarui}
            </TautanTombol>
          }
        />
      ) : null}
    </>
  );

  return (
    <Suspense>
      <BerandaAlarm
        sapaan={sapaan}
        nama={nama || t.umum.kamu}
        hariIni={hariIni}
        awal={JSON.parse(JSON.stringify(alarm)) as AlarmKlien[]}
        perangkat={perangkat.map((p) => ({ id: p.id, jenis: p.jenis, nama: p.nama, siapMalamIni: p.siaga, terakhirTerlihat: "" }))}
        formBaru={formBaru}
        spanduk={spanduk}
        waktuServer={new Date().getTime()}
      />
    </Suspense>
  );
}
