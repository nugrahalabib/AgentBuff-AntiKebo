"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Cip, Penghitung, Segmen } from "@/components/ui/dasar";
import { cn } from "@/lib/cn";
import { isi } from "@/lib/i18n";
import { useKamus } from "@/lib/i18n/klien";
import { seninPekan } from "@/lib/jadwal/tanggal";
import type { FormAlarm } from "@/lib/tampilan/alarm-klien";
import { URUTAN_HARI, uraiPengulangan } from "@/lib/tampilan/uraian";

type P = FormAlarm["pengulangan"];
type Mode = "pekan" | "tanggal" | "tiap" | "bulanan";

/** Hari yang dinyalakan chip untuk aturan mingguan biasa; null = bukan aturan mingguan biasa. */
function hariChip(p: P): number[] | null {
  switch (p.jenis) {
    case "sekali":
      return [];
    case "harian":
      return [0, 1, 2, 3, 4, 5, 6];
    case "hari_kerja":
      return [1, 2, 3, 4, 5];
    case "akhir_pekan":
      return [0, 6];
    case "hari":
      return [...p.hari];
    default:
      return null;
  }
}

/** Hari terpilih -> aturan paling ringkas (7 hari = harian, Sen-Jum = hari kerja). */
function dariHari(hari: number[]): P {
  const h = [...new Set(hari)].sort();
  if (!h.length) return { jenis: "sekali" };
  if (h.length === 7) return { jenis: "harian" };
  if (h.join() === "1,2,3,4,5") return { jenis: "hari_kerja" };
  if (h.join() === "0,6") return { jenis: "akhir_pekan" };
  return { jenis: "hari", hari: h };
}

function modeDari(p: P): Mode {
  if (p.jenis === "tiap_minggu") return "tiap";
  if (p.jenis === "bulanan_tanggal" || p.jenis === "bulanan_hari_ke") return "bulanan";
  if (p.jenis === "sekali" && "tanggal" in p) return "tanggal";
  return "pekan";
}

/**
 * Ulangi (PRD B3): chip hari untuk yang paling sering dipakai; pilihan lanjutan untuk tanggal
 * tertentu, tiap N minggu, dan bulanan (tanggal X atau hari ke-N). Tanpa hari terpilih = sekali,
 * pada kemunculan jam itu berikutnya.
 */
export function EditorPengulangan({ nilai, ubah, hariIni }: { nilai: P; ubah: (p: P) => void; hariIni: string }) {
  const { t, b } = useKamus();
  const U = t.ulang;
  const [lanjutan, setLanjutan] = useState(() => modeDari(nilai) !== "pekan");
  const mode = modeDari(nilai);
  const chip = hariChip(nilai);
  const hariTiap = nilai.jenis === "tiap_minggu" ? nilai.hari : (chip ?? [1]);

  const pilihMode = (m: Mode) => {
    if (m === mode) return;
    if (m === "pekan") ubah({ jenis: "hari_kerja" });
    else if (m === "tanggal") ubah({ jenis: "sekali", tanggal: hariIni });
    else if (m === "tiap") ubah({ jenis: "tiap_minggu", setiap: 2, hari: hariTiap.length ? hariTiap : [1], mulai: seninPekan(hariIni) });
    else ubah({ jenis: "bulanan_tanggal", tanggal: Number(hariIni.slice(8, 10)) });
  };

  const chips = (dipilih: readonly number[], ganti: (h: number[]) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {URUTAN_HARI.map((h) => (
        <Cip key={h} nyala={dipilih.includes(h)} label={t.hari.panjang[h]} ubah={(n) => ganti(n ? [...dipilih, h] : dipilih.filter((x) => x !== h))}>
          {t.hari.pendek[h]}
        </Cip>
      ))}
    </div>
  );

  const uraian = nilai.jenis === "sekali" && !("tanggal" in nilai) ? U.sekaliBerikutnya : uraiPengulangan(nilai as never, t, b, hariIni);

  return (
    <div className="flex flex-col gap-2">
      {mode === "pekan" && chip ? chips(chip, (h) => ubah(dariHari(h))) : null}
      <p className="t-keterangan text-label-2" aria-live="polite">
        {uraian}
      </p>
      <button
        type="button"
        aria-expanded={lanjutan}
        onClick={() => setLanjutan(!lanjutan)}
        className="tekan flex h-10 items-center gap-1 self-start text-[15px] font-semibold text-aksen"
      >
        {U.lanjutan}
        <ChevronDown size={16} className={cn("transition-transform", lanjutan && "rotate-180")} />
      </button>
      {lanjutan ? (
        <div className="flex flex-col gap-3 rounded-[18px] bg-kaca-isi p-3">
          <Segmen
            label={U.jenis}
            nilai={mode}
            ubah={pilihMode}
            pilihan={[
              { nilai: "pekan", label: U.mode.pekan },
              { nilai: "tanggal", label: U.mode.tanggal },
              { nilai: "tiap", label: U.mode.tiap },
              { nilai: "bulanan", label: U.mode.bulanan },
            ]}
          />
          {nilai.jenis === "sekali" && "tanggal" in nilai ? (
            <label className="flex items-center justify-between gap-3 text-[15px]">
              {U.tanggal}
              <input
                type="date"
                value={nilai.tanggal}
                min={hariIni}
                onChange={(e) => e.target.value && ubah({ jenis: "sekali", tanggal: e.target.value })}
                className="h-11 rounded-[12px] bg-kaca-isi px-3 text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-aksen-isi"
              />
            </label>
          ) : null}
          {nilai.jenis === "tiap_minggu" ? (
            <>
              <div className="flex items-center justify-between gap-3 text-[15px]">
                {U.setiap}
                <Penghitung
                  nilai={nilai.setiap}
                  min={2}
                  maks={12}
                  ubah={(n) => ubah({ ...nilai, setiap: n })}
                  label={U.setiap}
                  labelKurang={t.umum.kurangi}
                  labelTambah={t.umum.tambah}
                  satuan={isi(U.mingguN, { n: nilai.setiap })}
                />
              </div>
              {chips(nilai.hari, (h) => h.length && ubah({ ...nilai, hari: [...new Set(h)].sort() }))}
            </>
          ) : null}
          {nilai.jenis === "bulanan_tanggal" || nilai.jenis === "bulanan_hari_ke" ? (
            <>
              <Segmen
                label={U.bulanan}
                nilai={nilai.jenis}
                ubah={(j) =>
                  j === nilai.jenis
                    ? undefined
                    : ubah(j === "bulanan_tanggal" ? { jenis: "bulanan_tanggal", tanggal: Number(hariIni.slice(8, 10)) } : { jenis: "bulanan_hari_ke", ke: 1, hari: 1 })
                }
                pilihan={[
                  { nilai: "bulanan_tanggal", label: U.mode.tanggalBulan },
                  { nilai: "bulanan_hari_ke", label: U.mode.hariKe },
                ]}
              />
              {nilai.jenis === "bulanan_tanggal" ? (
                <div className="flex items-center justify-between gap-3 text-[15px]">
                  {U.tanggal}
                  <Penghitung
                    nilai={nilai.tanggal}
                    min={1}
                    maks={31}
                    ubah={(n) => ubah({ jenis: "bulanan_tanggal", tanggal: n })}
                    label={U.tanggal}
                    labelKurang={t.umum.kurangi}
                    labelTambah={t.umum.tambah}
                  />
                </div>
              ) : (
                <>
                  <Segmen
                    label={U.mode.hariKe}
                    nilai={String(nilai.ke) as "1" | "2" | "3" | "4" | "-1"}
                    ubah={(k) => ubah({ ...nilai, ke: Number(k) as 1 | 2 | 3 | 4 | -1 })}
                    pilihan={(["1", "2", "3", "4", "-1"] as const).map((k) => ({ nilai: k, label: U.kePendek[k] }))}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {URUTAN_HARI.map((h) => (
                      <Cip key={h} nyala={nilai.hari === h} label={t.hari.panjang[h]} ubah={() => ubah({ ...nilai, hari: h })}>
                        {t.hari.pendek[h]}
                      </Cip>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
