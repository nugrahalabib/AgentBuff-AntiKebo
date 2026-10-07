import type { Kamus } from "@/lib/i18n";
import type { IsiTemplate } from "./isi";

/**
 * Template bawaan (PRD B10). Hidup di kode, bukan di DB: sama untuk semua pengguna, ikut
 * bahasa pengguna, dan tidak bisa diubah (K-35). Id berawalan `bawaan:`.
 */

const ISI: Record<"bangunKerja" | "kuliahPagi" | "sholatSubuh" | "pengingatSiang" | "nuklir", Omit<IsiTemplate, "agendaJudul">> = {
  bangunKerja: {
    jam: "06:00",
    pengulangan: { jenis: "hari_kerja" },
    karakter: "bos_killer",
    soal: { jenis: "hitungan", tingkat: "sedang", benar: 2, kodeQr: [] },
    tunda: { jatah: 2, menit: 5 },
    masihBangun: { aktif: true, menit: 5, batasDtk: 60 },
    liburNasional: true,
  },
  kuliahPagi: {
    jam: "06:30",
    pengulangan: { jenis: "hari_kerja" },
    karakter: "teman_nyolot",
    soal: { jenis: "hitungan", tingkat: "sedang", benar: 2, kodeQr: [] },
    tunda: { jatah: 1, menit: 10 },
    masihBangun: { aktif: true, menit: 5, batasDtk: 60 },
    liburNasional: true,
  },
  sholatSubuh: {
    jam: "04:30",
    pengulangan: { jenis: "harian" },
    karakter: "ibu_galak",
    bunyi: "lonceng",
    soal: { jenis: "hitungan", tingkat: "ringan", benar: 1, kodeQr: [] },
    tunda: { jatah: 0, menit: 5 },
    masihBangun: { aktif: true, menit: 5, batasDtk: 60 },
    liburNasional: false,
  },
  pengingatSiang: {
    jam: "13:00",
    pengulangan: { jenis: "sekali" },
    karakter: "pacar_bawel",
    soal: { jenis: "hitungan", tingkat: "ringan", benar: 1, kodeQr: [] },
    tunda: { jatah: 1, menit: 5 },
    masihBangun: { aktif: false, menit: 5, batasDtk: 60 },
  },
  nuklir: {
    jam: "05:00",
    pengulangan: { jenis: "hari_kerja" },
    karakter: "pelatih_tentara",
    bunyi: "nuklir",
    soal: { jenis: "hitungan", tingkat: "berat", benar: 3, kodeQr: [] },
    tunda: { jatah: 0, menit: 5 },
    komitmen: true,
    masihBangun: { aktif: true, menit: 3, batasDtk: 60 },
    liburNasional: false,
  },
};

export const AWALAN_BAWAAN = "bawaan:";

export type TemplateTampil = { id: string; nama: string; keterangan: string | null; bawaan: boolean; isi: IsiTemplate };

const ID: Record<keyof typeof ISI, string> = {
  bangunKerja: "bangun_kerja",
  kuliahPagi: "kuliah_pagi",
  sholatSubuh: "sholat_subuh",
  pengingatSiang: "pengingat_siang",
  nuklir: "nuklir",
};

export function daftarTemplateBawaan(t: Kamus): TemplateTampil[] {
  return (Object.keys(ISI) as Array<keyof typeof ISI>).map((k) => ({
    id: `${AWALAN_BAWAAN}${ID[k]}`,
    nama: t.template[k].nama,
    keterangan: t.template[k].ket,
    bawaan: true,
    isi: { ...ISI[k], agendaJudul: t.template[k].judul },
  }));
}
