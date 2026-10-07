import { tambahHari } from "@/lib/jadwal/tanggal";
import { bagianLokal, instanLokal } from "@/lib/jadwal/zona";
import type { IsiAlarm } from "./isi";

/**
 * Mode Komitmen (PRD E3, konsep §11, K-34). MURNI: satu-satunya tempat aturannya, dipakai web,
 * MCP, dan aplikasi PC lewat layanan alarm. Antara jam tidur dan jam alarm berikutnya, alarm
 * ber-Komitmen tidak bisa dihapus, dimatikan, dilewati, dimundurkan, Komitmennya dimatikan,
 * atau dibuat lebih mudah ditinggal tidur. Memajukan jam dan menambah alarm tetap boleh.
 */

export type Jendela = { mulai: Date; sampai: Date };

/** Jendela kunci untuk kejadian pada `jadwal`: dari jam tidur terakhir sebelum (atau tepat) jadwal, sampai jadwal. */
export function jendelaKunci(jadwal: Date, jamTidur: string, zona: string): Jendela {
  const [hh, mm] = jamTidur.split(":").map(Number);
  const tanggal = bagianLokal(jadwal, zona).tanggal;
  let mulai = instanLokal(tanggal, hh, mm, zona);
  if (mulai > jadwal) mulai = instanLokal(tambahHari(tanggal, -1), hh, mm, zona);
  return { mulai, sampai: jadwal };
}

export type KeadaanKunci = { terkunci: false } | { terkunci: true; sampai: Date };

/** Apakah alarm sedang dikunci Komitmen pada `sekarang` (untuk kejadian menunggu `jadwal`). */
export function keadaanKunci(a: { komitmen: boolean; aktif: boolean }, jadwal: Date | null, jamTidur: string, zona: string, sekarang: Date): KeadaanKunci {
  if (!a.komitmen || !a.aktif || !jadwal) return { terkunci: false };
  const j = jendelaKunci(jadwal, jamTidur, zona);
  return j.mulai <= sekarang && sekarang < j.sampai ? { terkunci: true, sampai: j.sampai } : { terkunci: false };
}

export type AlasanTolak = "hapus" | "matikan" | "lewati" | "mundur" | "komitmen_mati" | "lemahkan";

const PERINGKAT_TINGKAT = { ringan: 0, sedang: 1, berat: 2 } as const;

/** Perubahan yang membuat alarm lebih gampang ditinggal tidur. */
function melemahkan(lama: IsiAlarm, baru: IsiAlarm): boolean {
  const s0 = lama.soal;
  const s1 = baru.soal;
  if (s1.jenis !== s0.jenis || PERINGKAT_TINGKAT[s1.tingkat] < PERINGKAT_TINGKAT[s0.tingkat] || s1.benar < s0.benar) return true;
  // Kode QR ditukar = bisa dipindah ke kode yang ditempel di samping kasur.
  if ([...s0.kodeQr].sort().join() !== [...s1.kodeQr].sort().join()) return true;
  if (baru.tunda.jatah > lama.tunda.jatah || baru.tunda.menit > lama.tunda.menit) return true;
  if (lama.batasMenit !== baru.batasMenit && (lama.batasMenit === null || (baru.batasMenit !== null && baru.batasMenit < lama.batasMenit))) return true;
  if (lama.masihBangun.aktif && !baru.masihBangun.aktif) return true;
  if (lama.spam.kanal.some((k) => !baru.spam.kanal.includes(k))) return true;
  if (lama.tuya.length > baru.tuya.length) return true;
  return false;
}

/**
 * Periksa satu tindakan terhadap alarm yang sedang terkunci. `baru` null = alarm dihapus;
 * `jadwalBaru` = kejadian berikutnya sesudah tindakan (null = tidak berbunyi lagi).
 * Mengembalikan alasan penolakan, atau null bila boleh.
 */
export function periksaKomitmen(p: {
  kunci: KeadaanKunci;
  aksi: "ubah" | "hapus" | "aktif" | "lewati";
  lama: IsiAlarm;
  baru: IsiAlarm | null;
  jadwalBaru: Date | null;
}): AlasanTolak | null {
  if (!p.kunci.terkunci) return null;
  if (!p.baru || p.aksi === "hapus") return "hapus";
  if (!p.baru.aktif) return "matikan";
  if (!p.baru.komitmen) return "komitmen_mati";
  if (!p.jadwalBaru || p.jadwalBaru > p.kunci.sampai) return p.aksi === "lewati" ? "lewati" : "mundur";
  if (melemahkan(p.lama, p.baru)) return "lemahkan";
  return null;
}
