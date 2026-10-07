import { Check, CircleAlert, House, Monitor, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PengaturanKanal, PengaturanNotifikasi, PengaturanPengingat } from "@/components/app/pengaturan-kanal";
import { TombolKeluar } from "@/components/app/tombol-keluar";
import { TautanTombol } from "@/components/ui/dasar";
import { BarisGrup, Grup } from "@/components/ui/grup";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { isi } from "@/lib/i18n";
import { kamusServer } from "@/lib/i18n/server";
import { ambilPreferensi } from "@/lib/layanan/preferensi";
import { statusRumah } from "@/lib/layanan/tuya";
import { kunciPublikVapid } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await kamusServer();
  return { title: t.pengaturan.judul };
}

/** Pengaturan: akun, izin AgentBuff, kanal pesan + notifikasi + pengingat malam (P6), keluar. Pengaturan lengkap (PRD M) di P11. */
export default async function HalamanPengaturan() {
  const s = await sesiSaatIni();
  if (!s) redirect("/masuk");
  const { t } = await kamusServer();
  const P = t.pengaturan;
  const izin = [
    { label: P.izinKabar, diberi: s.pengguna.izinKabar },
    { label: P.izinSuara, diberi: s.pengguna.izinSuara },
  ];
  const kurang = izin.some((i) => !i.diberi);
  const [pref, rumah] = await Promise.all([ambilPreferensi(s.pengguna.id), statusRumah(s.pengguna.id)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="t-judul-besar muncul pt-2">{P.judul}</h1>

      <section aria-labelledby="judul-akun" className="flex flex-col gap-2">
        <h2 id="judul-akun" className="t-subjudul px-4 font-semibold text-label-2">
          {P.akun}
        </h2>
        <div className="kaca rounded-[22px] px-4 py-3.5">
          <p className="t-kepala">{s.pengguna.nama ?? t.merek.nama}</p>
          {s.pengguna.email ? <p className="t-subjudul mt-0.5 text-label-2">{isi(P.masukSebagai, { email: s.pengguna.email })}</p> : null}
        </div>
      </section>

      <section aria-labelledby="judul-izin" className="flex flex-col gap-2">
        <h2 id="judul-izin" className="t-subjudul px-4 font-semibold text-label-2">
          {P.izinJudul}
        </h2>
        <ul className="kaca divide-y divide-pemisah rounded-[22px]">
          {izin.map((i) => (
            <li key={i.label} className="flex min-h-[52px] items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 text-[17px]">{i.label}</span>
              <span className={i.diberi ? "flex items-center gap-1.5 text-[15px] font-semibold text-toska" : "flex items-center gap-1.5 text-[15px] font-semibold text-waspada"}>
                {i.diberi ? <Check size={16} strokeWidth={2.6} /> : <CircleAlert size={16} strokeWidth={2.4} />}
                {i.diberi ? P.diberi : P.belum}
              </span>
            </li>
          ))}
        </ul>
        <p className="t-keterangan px-4 text-label-2">{P.izinKet}</p>
        {kurang ? (
          <TautanTombol href="/auth/agentbuff/start?izin=1&lanjut=/app/pengaturan" ukuran="besar" className="mt-2">
            {P.beriIzin}
          </TautanTombol>
        ) : null}
      </section>

      <PengaturanKanal spamBawaan={pref.bawaan.spam} />
      <PengaturanNotifikasi kunciPublik={kunciPublikVapid()} />
      <PengaturanPengingat nyala={pref.pengingatMalam} />

      <Grup judul={t.siaga.judul} id="judul-siaga" catatan={t.siaga.sub}>
        <BarisGrup ikon={Smartphone} warnaIkon="#14b8a6" label={t.jamMeja.judul} sub={t.siaga.jadikanJamMeja} href="/app/jam-meja" />
        <BarisGrup ikon={Monitor} warnaIkon="#4338ca" label={t.unduh.judul} sub={t.unduh.sub} href="/app/unduh-pc" />
      </Grup>

      <Grup judul={t.rumah.judul} id="judul-rumah" catatan={t.rumah.ket}>
        <BarisGrup
          ikon={House}
          warnaIkon={rumah.tersambung && rumah.bermasalah ? "#dc2626" : "#f59e0b"}
          label={t.rumah.judul}
          sub={!rumah.tersambung ? t.rumah.belum : rumah.bermasalah ? t.rumah.spanduk.judul : isi(t.rumah.jumlah, { n: rumah.perangkat })}
          href="/app/rumah"
        />
      </Grup>

      <TombolKeluar />
    </div>
  );
}
