import type { Bahasa, Kamus } from "@/lib/i18n";
import { isi } from "@/lib/i18n";
import type { Pengulangan } from "@/lib/jadwal/pengulangan";
import { hariPekan, tambahHari, uraiTanggal } from "@/lib/jadwal/tanggal";

/** Urutan hari tampil: Senin dulu, Minggu terakhir (kebiasaan Indonesia). */
export const URUTAN_HARI = [1, 2, 3, 4, 5, 6, 0] as const;

const sama = (a: readonly number[], b: readonly number[]) => a.length === b.length && b.every((x) => a.includes(x));

/** "Sen 12 Okt" / "Mon 12 Oct". */
export function tanggalPendek(tanggal: string, t: Kamus, b: Bahasa): string {
  const { bulan, tanggal: h } = uraiTanggal(tanggal);
  const hari = t.hari.pendek[hariPekan(tanggal)];
  return b === "id" ? `${hari} ${h} ${t.ulang.bulanPendek[bulan - 1]}` : `${hari}, ${t.ulang.bulanPendek[bulan - 1]} ${h}`;
}

function daftarHari(hari: readonly number[], t: Kamus): string {
  return URUTAN_HARI.filter((h) => hari.includes(h))
    .map((h) => t.hari.pendek[h])
    .join(", ");
}

/**
 * Uraian pengulangan siap tampil (kartu alarm, lembar ubah): "Hari kerja", "Sen, Rab, Jum",
 * "Sekali, besok", "Tiap 2 minggu: Sen, Kam", "Senin pertama tiap bulan". `hariIni` = tanggal
 * lokal pengguna sekarang (YYYY-MM-DD).
 */
export function uraiPengulangan(p: Pengulangan, t: Kamus, b: Bahasa, hariIni: string): string {
  const U = t.ulang;
  switch (p.jenis) {
    case "sekali": {
      const kapan = p.tanggal === hariIni ? U.hariIni : p.tanggal === tambahHari(hariIni, 1) ? U.besok : tanggalPendek(p.tanggal, t, b);
      return isi(U.sekaliPada, { tanggal: kapan });
    }
    case "harian":
      return U.harian;
    case "hari_kerja":
      return U.hariKerja;
    case "akhir_pekan":
      return U.akhirPekan;
    case "hari":
      if (p.hari.length === 7) return U.harian;
      if (sama(p.hari, [1, 2, 3, 4, 5])) return U.hariKerja;
      if (sama(p.hari, [0, 6])) return U.akhirPekan;
      return daftarHari(p.hari, t);
    case "tiap_minggu":
      return isi(U.tiapMingguHari, { n: p.setiap, hari: daftarHari(p.hari, t) });
    case "bulanan_tanggal":
      return isi(U.bulananTanggal, { n: p.tanggal });
    case "bulanan_hari_ke":
      return isi(U.bulananHariKe, { hari: t.hari.panjang[p.hari], ke: U.ke[String(p.ke) as keyof typeof U.ke] });
  }
}
