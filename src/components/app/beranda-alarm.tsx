"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LayarBeranda } from "@/components/layar/beranda";
import { LembarUbahAlarm, type AksiAlarm, type DataUbah } from "@/components/layar/ubah-alarm";
import { tampilToast } from "@/components/ui/toast";
import { useKamus } from "@/lib/i18n/klien";
import { panggilApi } from "@/lib/klien/api";
import { useDetik } from "@/lib/klien/jam";
import { usePeristiwa } from "@/lib/klien/peristiwa";
import { alarmPalingDulu, bedaForm, formDari, ringkasAlarm, type AlarmKlien, type FormAlarm } from "@/lib/tampilan/alarm-klien";
import type { KanalTampil, RingkasPerangkat } from "@/lib/tampilan/jenis";
import type { PerangkatAturan } from "@/components/layar/ubah-rumah";

type Lembar = { id: string | null; kunci: number };
const DATA_AWAL: DataUbah = { kanal: { status: "memuat" }, rumah: { status: "memuat" }, kodeQr: { status: "memuat" }, suara: { status: "memuat" } };

/**
 * Beranda yang tersambung API (PRD B1 sampai B9, docs/04-DESAIN.md §4.1 dan §4.2): kartu alarm
 * berikutnya dengan hitung mundur, alarm lainnya, sakelar, geser untuk lewati/hapus, lembar Ubah
 * alarm, uji alarm. Daftar dimuat ulang saat server mengabarkan jadwal berubah (SSE).
 */
export function BerandaAlarm({
  sapaan,
  nama,
  hariIni,
  awal,
  perangkat,
  formBaru,
  spanduk,
  waktuServer,
}: {
  sapaan: string;
  nama: string;
  hariIni: string;
  awal: AlarmKlien[];
  perangkat: RingkasPerangkat[];
  formBaru: FormAlarm;
  spanduk?: ReactNode;
  /** Jam server saat halaman dibuat (epoch md), untuk hitung mundur yang sama saat hidrasi. */
  waktuServer: number;
}) {
  const { t, b } = useKamus();
  const U = t.ubah;
  const router = useRouter();
  const cari = useSearchParams();
  const [daftar, setDaftar] = useState(awal);
  const [lembar, setLembar] = useState<Lembar | null>(null);
  const [lembarBuka, setLembarBuka] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<AksiAlarm["sibuk"]>(null);
  const [data, setData] = useState<DataUbah>(DATA_AWAL);
  const dataDimuat = useRef(false);
  const kini = useDetik(waktuServer, 60) * 1000;

  const muatUlang = useCallback(async () => {
    const r = await panggilApi<{ alarm: AlarmKlien[] }>("/api/app/alarm");
    if (r.ok) setDaftar(r.data.alarm);
  }, []);
  const tunda = useRef<ReturnType<typeof setTimeout> | null>(null);
  const muatUlangNanti = useCallback(() => {
    if (tunda.current) clearTimeout(tunda.current);
    tunda.current = setTimeout(() => void muatUlang(), 400);
  }, [muatUlang]);
  usePeristiwa({ jadwal: muatUlangNanti, berhenti: muatUlangNanti, halo: muatUlangNanti });

  const muatData = useCallback(async () => {
    if (dataDimuat.current) return;
    dataDimuat.current = true;
    const [kanal, rumah, qr, suara] = await Promise.all([
      panggilApi<{ kanal: Array<KanalTampil & { agen?: string }> }>("/api/app/kanal"),
      panggilApi<{ tersambung: boolean }>("/api/app/rumah"),
      panggilApi<{ kodeQr: Array<{ id: string; nama: string }> }>("/api/app/kode-qr"),
      panggilApi<{ suara: Array<{ id: string; nama: string }> }>("/api/app/suara"),
    ]);
    let dataRumah: DataUbah["rumah"] = { status: "belum" };
    if (rumah.ok && rumah.data.tersambung) {
      const p = await panggilApi<{ ruangan: Array<{ nama: string; perangkat: Array<Omit<PerangkatAturan, "ruang">> }> }>("/api/app/rumah/perangkat");
      dataRumah = p.ok
        ? { status: "ada", perangkat: p.data.ruangan.flatMap((r) => r.perangkat.map((x) => ({ id: x.id, nama: x.nama, online: x.online, bisa: x.bisa, ruang: r.nama }))) }
        : { status: "galat", pesan: p.pesan ?? t.umum.galatUmum };
    } else if (!rumah.ok) dataRumah = { status: "galat", pesan: rumah.pesan ?? t.umum.galatUmum };
    setData({
      kanal: kanal.ok
        ? { status: "ada", kanal: kanal.data.kanal.map((k) => ({ id: k.id, platform: k.platform, label: k.label, siap: k.siap, alasan: k.alasan, dipilih: false })) }
        : kanal.galat === "perlu_izin"
          ? { status: "izin", pesan: kanal.pesan ?? t.umum.galatUmum }
          : { status: "galat", pesan: kanal.pesan ?? t.umum.galatUmum },
      rumah: dataRumah,
      kodeQr: { status: "ada", kode: qr.ok ? qr.data.kodeQr.map((k) => ({ id: k.id, nama: k.nama })) : [] },
      suara: suara.ok ? { status: "ada", suara: suara.data.suara.map((s) => ({ id: s.id, nama: s.nama })) } : { status: "galat", pesan: suara.pesan ?? t.umum.galatUmum },
    });
  }, [t.umum.galatUmum]);

  const bukaLembar = useCallback(
    (id: string | null) => {
      setGalat(null);
      setLembar((l) => ({ id, kunci: (l?.kunci ?? 0) + 1 }));
      setLembarBuka(true);
      void muatData();
    },
    [muatData],
  );

  // `/app?alarm=baru` (tombol + di bilah samping) atau `/app?alarm=<id>`.
  const dariUrl = cari.get("alarm");
  useEffect(() => {
    if (!dariUrl) return;
    // Membuka lembar dari tautan adalah sinkronisasi dengan URL (sistem luar), bukan turunan state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    bukaLembar(dariUrl === "baru" ? null : dariUrl);
    router.replace("/app", { scroll: false });
  }, [dariUrl, bukaLembar, router]);

  const alarmLembar = lembar?.id ? (daftar.find((a) => a.id === lembar.id) ?? null) : null;
  const awalForm = useMemo(() => (alarmLembar ? formDari(alarmLembar) : formBaru), [alarmLembar, formBaru]);

  const ganti = (a: AlarmKlien) => setDaftar((d) => (d.some((x) => x.id === a.id) ? d.map((x) => (x.id === a.id ? a : x)) : [...d, a]));

  const simpan = async (v: FormAlarm) => {
    setMenyimpan(true);
    setGalat(null);
    const r = alarmLembar
      ? await panggilApi<{ alarm: AlarmKlien }>(`/api/app/alarm/${alarmLembar.id}`, "PATCH", bedaForm(formDari(alarmLembar), v))
      : await panggilApi<{ alarm: AlarmKlien }>("/api/app/alarm", "POST", v);
    setMenyimpan(false);
    if (!r.ok) return setGalat(r.pesan ?? t.umum.galatUmum);
    ganti(r.data.alarm);
    setLembarBuka(false);
    tampilToast(r.data.alarm.suara.status === "dibuat" ? U.tersimpan : U.tersimpanSaja);
  };

  const ubahAktif = async (id: string, aktif: boolean) => {
    setDaftar((d) => d.map((x) => (x.id === id ? { ...x, aktif } : x)));
    const r = await panggilApi<{ alarm: AlarmKlien }>(`/api/app/alarm/${id}/aktif`, "POST", { aktif });
    if (r.ok) ganti(r.data.alarm);
    else {
      setDaftar((d) => d.map((x) => (x.id === id ? { ...x, aktif: !aktif } : x)));
      tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
    }
  };

  const lewati = async (id: string) => {
    setSibuk("lewati");
    const r = await panggilApi<{ alarm: AlarmKlien }>(`/api/app/alarm/${id}/lewati`, "POST", {});
    setSibuk(null);
    if (!r.ok) return tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
    ganti(r.data.alarm);
    setLembarBuka(false);
    tampilToast(U.aksi.dilewati);
  };

  const hapus = async (id: string) => {
    setSibuk("hapus");
    const r = await panggilApi(`/api/app/alarm/${id}`, "DELETE");
    setSibuk(null);
    if (!r.ok) return tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
    setDaftar((d) => d.filter((x) => x.id !== id));
    setLembarBuka(false);
    tampilToast(U.aksi.dihapus);
  };

  const aksi: AksiAlarm | undefined = alarmLembar
    ? {
        sibuk,
        uji: async (opsi) => {
          setSibuk("uji");
          const r = await panggilApi("/api/app/uji", "POST", { alarmId: alarmLembar.id, ...opsi });
          setSibuk(null);
          if (!r.ok) return tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
          setLembarBuka(false);
          tampilToast(U.aksi.ujiDibuat);
        },
        lewati: () => void lewati(alarmLembar.id),
        gandakan: async () => {
          setSibuk("gandakan");
          const r = await panggilApi<{ alarm: AlarmKlien }>(`/api/app/alarm/${alarmLembar.id}/gandakan`, "POST");
          setSibuk(null);
          if (!r.ok) return tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
          ganti(r.data.alarm);
          setLembarBuka(false);
          tampilToast(U.aksi.digandakan);
        },
        hapus: () => void hapus(alarmLembar.id),
      }
    : undefined;

  const berikutnya = alarmPalingDulu(daftar);
  const sisaMs = berikutnya?.berikutnya ? Date.parse(berikutnya.berikutnya.utc) - kini : null;
  const sisa = sisaMs !== null && sisaMs > 0 ? { jam: Math.floor(sisaMs / 3_600_000), menit: Math.floor((sisaMs % 3_600_000) / 60_000) } : null;

  return (
    <>
      <LayarBeranda
        sapaan={sapaan}
        berikutnya={berikutnya ? ringkasAlarm(berikutnya, b) : null}
        sisa={sisa}
        lainnya={daftar.filter((a) => a.id !== berikutnya?.id).map((a) => ringkasAlarm(a, b))}
        perangkat={perangkat}
        hrefTambah="/app?alarm=baru"
        spanduk={spanduk}
        tambah={() => bukaLembar(null)}
        buka={(id) => bukaLembar(id)}
        ubahAktif={(id, v) => void ubahAktif(id, v)}
        aksiKartu={{ lewati: (id) => void lewati(id), hapus: (id) => void hapus(id) }}
      />
      {lembar ? (
        <LembarUbahAlarm
          key={lembar.kunci}
          buka={lembarBuka}
          ubahBuka={setLembarBuka}
          awal={awalForm}
          baru={!alarmLembar}
          data={data}
          suara={alarmLembar?.suara ?? null}
          terkunciJam={alarmLembar?.terkunciJam}
          hariIni={hariIni}
          nama={nama}
          simpan={(v) => void simpan(v)}
          menyimpan={menyimpan}
          galat={galat}
          aksi={aksi}
          buatKodeQr={async (namaTempat) => {
            const r = await panggilApi<{ kodeQr: { id: string; nama: string } }>("/api/app/kode-qr", "POST", { nama: namaTempat });
            if (!r.ok) {
              tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
              return null;
            }
            return { id: r.data.kodeQr.id, nama: r.data.kodeQr.nama };
          }}
          dengarSuara={async (suaraId) => {
            const r = await panggilApi<{ klip: string | null }>("/api/app/suara/contoh", "POST", { suaraId });
            if (!r.ok) return void tampilToast(r.pesan ?? t.umum.galatUmum, "galat");
            if (!r.data.klip) return void tampilToast(U.contohDibuat);
            await new Audio(r.data.klip).play().catch(() => tampilToast(t.umum.galatUmum, "galat"));
          }}
        />
      ) : null}
    </>
  );
}
