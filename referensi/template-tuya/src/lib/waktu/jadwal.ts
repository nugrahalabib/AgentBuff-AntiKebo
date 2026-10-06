/**
 * Hitung waktu jalan berikutnya sebuah jadwal - MURNI (diuji di tests/unit/jadwal.test.ts).
 * Zona waktu lewat Intl (tanpa pustaka). Indonesia tidak memakai DST, tetapi
 * perhitungan tetap benar untuk zona ber-DST karena offset dihitung per instan.
 */

export type JenisJadwal = "sekali" | "harian" | "mingguan";

const POLA_JAM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function jamSah(hhmm: string): boolean {
  return POLA_JAM.test(hhmm);
}

/** Bagian tanggal-waktu lokal dari sebuah instan di `zona`. */
export function bagianLokal(instan: Date, zona: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(instan).map((x) => [x.type, x.value]));
  const hari = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { tahun: +p.year, bulan: +p.month, tanggal: +p.day, jam: +p.hour % 24, menit: +p.minute, detik: +p.second, hari };
}

/** Selisih zona terhadap UTC (menit) pada instan tertentu. */
function offsetMenit(instan: Date, zona: string): number {
  const b = bagianLokal(instan, zona);
  const sebagaiUtc = Date.UTC(b.tahun, b.bulan - 1, b.tanggal, b.jam, b.menit, b.detik);
  return Math.round((sebagaiUtc - Math.floor(instan.getTime() / 1000) * 1000) / 60000);
}

/** Instan untuk tanggal lokal (y,m,d) jam hh:mm di `zona`. */
export function instanLokal(tahun: number, bulan: number, tanggal: number, jam: number, menit: number, zona: string): Date {
  const tebakan = Date.UTC(tahun, bulan - 1, tanggal, jam, menit);
  const off1 = offsetMenit(new Date(tebakan), zona);
  const hasil = tebakan - off1 * 60000;
  const off2 = offsetMenit(new Date(hasil), zona);
  return new Date(off2 === off1 ? hasil : tebakan - off2 * 60000);
}

/**
 * Waktu jalan berikutnya SESUDAH `dari` (tidak sama dengan). `hari`: 0=Minggu..6=Sabtu.
 * Mengembalikan null bila jadwal tidak pernah jalan lagi.
 */
export function berikutnya(j: { jenis: JenisJadwal; waktuLokal?: string | null; hari?: number[] | null; zona: string; pada?: Date | null }, dari: Date): Date | null {
  if (j.jenis === "sekali") return j.pada && j.pada.getTime() > dari.getTime() ? j.pada : null;
  if (!j.waktuLokal || !jamSah(j.waktuLokal)) return null;
  const [jam, menit] = j.waktuLokal.split(":").map(Number);
  const hariBoleh = j.jenis === "mingguan" ? new Set((j.hari ?? []).filter((h) => h >= 0 && h <= 6)) : null;
  if (hariBoleh && hariBoleh.size === 0) return null;
  const awal = bagianLokal(dari, j.zona);
  for (let tambah = 0; tambah <= 8; tambah++) {
    // Tanggal kalender lokal + tambah hari (lewat UTC tengah hari supaya tidak tergelincir).
    const d = new Date(Date.UTC(awal.tahun, awal.bulan - 1, awal.tanggal + tambah, 12));
    const kandidat = instanLokal(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), jam, menit, j.zona);
    if (kandidat.getTime() <= dari.getTime()) continue;
    if (hariBoleh && !hariBoleh.has(bagianLokal(kandidat, j.zona).hari)) continue;
    return kandidat;
  }
  return null;
}

const NAMA_HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "Setiap hari 23:00", "Sen, Rab, Jum 06:30", "Sekali, 4 Okt 23:00". */
export function uraikanJadwal(j: { jenis: JenisJadwal; waktuLokal?: string | null; hari?: number[] | null; zona: string; pada?: Date | null }): string {
  if (j.jenis === "sekali") {
    if (!j.pada) return "Sekali";
    const b = bagianLokal(j.pada, j.zona);
    const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][b.bulan - 1];
    return `Sekali, ${b.tanggal} ${bulan} ${String(b.jam).padStart(2, "0")}:${String(b.menit).padStart(2, "0")}`;
  }
  if (j.jenis === "harian") return `Setiap hari ${j.waktuLokal}`;
  const hari = [...(j.hari ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (hari.length === 5 && [1, 2, 3, 4, 5].every((h) => hari.includes(h))) return `Hari kerja ${j.waktuLokal}`;
  if (hari.length === 2 && hari.includes(0) && hari.includes(6)) return `Akhir pekan ${j.waktuLokal}`;
  return `${hari.map((h) => NAMA_HARI[h].slice(0, 3)).join(", ")} ${j.waktuLokal}`;
}
