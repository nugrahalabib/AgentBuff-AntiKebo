"use client";

import { Check, House, Monitor, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { LayarOrientasi, type IsiOrientasi } from "@/components/layar/pengaturan-orientasi";
import { PanduanPasang } from "@/components/app/panduan-pasang";
import { PengaturanKanal, PengaturanNotifikasi } from "@/components/app/pengaturan-kanal";
import { TautanTombol } from "@/components/ui/dasar";
import { tampilToast } from "@/components/ui/toast";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { panggilApi } from "@/lib/klien/api";
import type { IdKarakter } from "@/lib/tampilan/jenis";

type JenisPerangkat = "windows" | "hp" | "lain";

function jenisPerangkat(): JenisPerangkat {
  const ua = navigator.userAgent;
  const ipadBaru = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod|Android/.test(ua) || ipadBaru) return "hp";
  return /Windows NT/.test(ua) ? "windows" : "lain";
}
const tanpaLangganan = () => () => {};

/** Langkah 3 (PRD J3): deteksi otomatis. Windows = pasang PC; HP = jam meja + pasang ke layar utama; semua = notifikasi. */
function SiapkanPerangkat({ kunciPublik }: { kunciPublik: string }) {
  const { t } = useKamus();
  const O = t.orientasi;
  const jenis = useSyncExternalStore(tanpaLangganan, jenisPerangkat, () => null);
  const pc = (
    <TautanTombol href="/app/unduh-pc" ukuran="besar" varian={jenis === "windows" ? undefined : "kaca"} className="w-full">
      <Monitor size={19} />
      {t.siaga.pasangPc}
    </TautanTombol>
  );
  const jamMeja = (
    <TautanTombol href="/app/jam-meja" ukuran="besar" varian={jenis === "hp" ? undefined : "kaca"} className="w-full">
      <Smartphone size={19} />
      {t.siaga.jadikanJamMeja}
    </TautanTombol>
  );
  return (
    <div className="mt-3 flex w-full flex-col items-center gap-2.5">
      <p className="t-isi max-w-[36ch] text-label-2">{O.perangkatIsi}</p>
      {jenis ? <p className="t-subjudul max-w-[36ch]">{jenis === "windows" ? O.perangkatPc : jenis === "hp" ? O.perangkatHp : O.perangkatLain}</p> : null}
      <div className="mt-3 flex w-full flex-col gap-2.5">
        {jenis === "hp" ? (
          <>
            {jamMeja}
            {pc}
          </>
        ) : (
          <>
            {pc}
            {jamMeja}
          </>
        )}
      </div>
      {jenis === "hp" ? (
        <div className="w-full">
          <PanduanPasang />
        </div>
      ) : null}
      <div className="mt-4 w-full text-left">
        <PengaturanNotifikasi kunciPublik={kunciPublik} />
      </div>
    </div>
  );
}

/**
 * Orientasi hidup (PRD J): nama panggilan dan karakter disimpan ke preferensi, kanal spam bawaan
 * lewat bagian Kanal, rumah pintar lewat wizard di /app/rumah, lalu alarm uji 1 menit lagi.
 * Selesai (atau "Nanti" di langkah terakhir) = `orientasiSelesai`, kembali ke Beranda.
 */
export function OrientasiHidup({
  nama,
  namaTersimpan,
  karakter,
  spamBawaan,
  kunciPublik,
  rumahTersambung,
}: {
  /** Isian awal (nama panggilan, atau nama depan dari AgentBuff). */
  nama: string;
  /** Nama panggilan yang sudah tersimpan (null = belum pernah diatur). */
  namaTersimpan: string | null;
  karakter: IdKarakter;
  spamBawaan: { kanal: string[]; jedaDtk: number | null; batasMenit: number | null };
  kunciPublik: string;
  rumahTersambung: boolean;
}) {
  const { t, b } = useKamus();
  const O = t.orientasi;
  const router = useRouter();
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const tersimpan = useRef<{ nama: string | null; karakter: IdKarakter }>({ nama: namaTersimpan, karakter });

  const simpan = async (langkah: number, v: IsiOrientasi) => {
    const ubah =
      langkah === 0 && v.nama !== tersimpan.current.nama
        ? { namaPanggilan: v.nama }
        : langkah === 1 && v.karakter !== tersimpan.current.karakter
          ? { bawaan: { karakter: v.karakter } }
          : null;
    setGalat(null);
    if (!ubah) return true;
    setProses(true);
    const r = await panggilApi("/api/app/preferensi", "PATCH", ubah);
    setProses(false);
    if (!r.ok) {
      setGalat(r.pesan ?? O.gagal);
      return false;
    }
    tersimpan.current = v;
    return true;
  };

  const selesai = async (uji: boolean) => {
    setProses(true);
    setGalat(null);
    const r = await panggilApi("/api/app/preferensi", "PATCH", { orientasiSelesai: true });
    if (!r.ok) {
      setProses(false);
      setGalat(r.pesan ?? O.gagal);
      return;
    }
    if (uji) {
      const u = await panggilApi<{ jadwalUtc: string }>("/api/app/uji", "POST", {});
      if (u.ok) {
        const jam = new Intl.DateTimeFormat(b === "id" ? "id-ID" : "en-US", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(u.data.jadwalUtc));
        tampilToast(isi(O.ujiTerjadwal, { jam: b === "id" ? jam.replace(":", ".") : jam }));
      } else tampilToast(u.pesan ?? t.umum.galatUmum, "galat");
    }
    router.replace("/app");
    router.refresh();
  };

  return (
    <LayarOrientasi
      nama={nama}
      karakter={karakter}
      proses={proses}
      galat={galat}
      simpan={simpan}
      selesai={(uji) => void selesai(uji)}
      ubahLangkah={() => setGalat(null)}
      perangkat={<SiapkanPerangkat kunciPublik={kunciPublik} />}
      kanal={
        <div className="mt-3 flex w-full flex-col gap-4">
          <p className="t-isi text-label-2">{O.kanalIsi}</p>
          <div className="w-full text-left">
            <PengaturanKanal spamBawaan={spamBawaan} />
          </div>
        </div>
      }
      rumah={
        <div className="mt-3 flex w-full flex-col items-center gap-4">
          <p className="t-isi max-w-[36ch] text-label-2">{O.rumahIsi}</p>
          {rumahTersambung ? (
            <p className="flex items-center gap-2 text-[17px] font-semibold text-toska">
              <Check size={18} strokeWidth={2.6} />
              {O.rumahSudah}
            </p>
          ) : (
            <TautanTombol href="/app/rumah" varian="kaca" ukuran="besar" className="w-full">
              <House size={19} />
              {t.rumah.sambungkan}
            </TautanTombol>
          )}
        </div>
      }
    />
  );
}
