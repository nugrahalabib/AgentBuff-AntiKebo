"use client";

import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { TautanTombol, Tombol } from "@/components/ui/dasar";
import { useKamus } from "@/lib/i18n/klien";

/** Tombol "Sambungkan" + tanda centang hijau sesudah berhasil. */
export function KonfirmasiSambung({ kode, sudah }: { kode: string; sudah: boolean }) {
  const { t } = useKamus();
  const S = t.sambung;
  const [keadaan, setKeadaan] = useState<"siap" | "proses" | "berhasil" | "gagal">(sudah ? "berhasil" : "siap");
  const [pesan, setPesan] = useState<string | null>(null);

  const sambungkan = async () => {
    setKeadaan("proses");
    setPesan(null);
    try {
      const r = await fetch("/api/app/perangkat/sambung", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kode }) });
      const j = (await r.json().catch(() => null)) as { pesan?: string } | null;
      if (r.ok) setKeadaan("berhasil");
      else {
        setKeadaan("gagal");
        setPesan(j?.pesan ?? S.gagal);
      }
    } catch {
      setKeadaan("gagal");
      setPesan(S.gagal);
    }
  };

  if (keadaan === "berhasil")
    return (
      <div role="status" className="mt-7 flex flex-col items-center gap-2">
        <CheckCircle2 size={44} className="text-berhasil" />
        <p className="t-judul-3">{S.berhasil}</p>
        <p className="t-subjudul text-label-2">{S.berhasilSub}</p>
        <TautanTombol href="/app" varian="kaca" ukuran="sedang" className="mt-3">
          {S.keSiaga}
        </TautanTombol>
      </div>
    );

  return (
    <div className="mt-7 flex flex-col gap-2.5">
      {pesan ? (
        <p role="alert" className="text-[14px] font-semibold text-bahaya">
          {pesan}
        </p>
      ) : null}
      <Tombol ukuran="besar" className="w-full" disabled={keadaan === "proses"} onClick={() => void sambungkan()}>
        {keadaan === "proses" ? S.menyambung : S.tombol}
      </Tombol>
    </div>
  );
}
