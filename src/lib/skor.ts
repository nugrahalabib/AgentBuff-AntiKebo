/**
 * Skor bangun (PRD K2, arsitektur §10). Modul murni, dites dengan contoh emas
 * (`tests/emas/skor.json`). Dipakai layar Selamat pagi (P8) dan Riwayat (P11).
 *
 * Per kejadian (bukan uji): mulai 100; -10 per tunda; -1 per menit penuh dari berbunyi sampai soal
 * terjawab, sesudah 2 menit pertama (maks -40); -30 bila pernah gagal "Masih bangun?"; tidak bangun
 * = 0; terlewat karena server dan dibatalkan tidak dihitung; minimal 0.
 */

export type DataSkor = {
  status: string;
  uji: boolean;
  berbunyiPada: Date | string | null;
  /** Saat soal terjawab (lolos). */
  bangunPada: Date | string | null;
  jumlahTunda: number;
  /** Pernah gagal "Masih bangun?" (kolom `tanpa_tunda`). */
  gagalCek: boolean;
};

export const SKOR_AWAL = 100;
export const POTONG_TUNDA = 10;
export const MENIT_BEBAS = 2;
export const POTONG_MENIT_MAKS = 40;
export const POTONG_GAGAL_CEK = 30;
/** Hari dihitung beruntun bila semua kejadiannya paling sedikit segini. */
export const SKOR_BERUNTUN = 70;

const ms = (x: Date | string) => (typeof x === "string" ? new Date(x) : x).getTime();

/** Menit penuh dari berbunyi sampai soal terjawab (0 bila data tidak lengkap). */
export function menitSampaiBangun(d: Pick<DataSkor, "berbunyiPada" | "bangunPada">): number {
  if (!d.berbunyiPada || !d.bangunPada) return 0;
  return Math.max(0, Math.floor((ms(d.bangunPada) - ms(d.berbunyiPada)) / 60_000));
}

/** Skor satu kejadian, atau null bila tidak dihitung (uji, terlewat, dibatalkan, belum selesai). */
export function skorKejadian(d: DataSkor): number | null {
  if (d.uji) return null;
  if (d.status === "tidak_bangun") return 0;
  // cek_bangun: soal sudah terjawab, skor sementara (Selamat pagi sebelum "Masih bangun?").
  if (d.status !== "bangun" && d.status !== "cek_bangun") return null;
  const potongMenit = Math.min(POTONG_MENIT_MAKS, Math.max(0, menitSampaiBangun(d) - MENIT_BEBAS));
  const skor = SKOR_AWAL - POTONG_TUNDA * d.jumlahTunda - potongMenit - (d.gagalCek ? POTONG_GAGAL_CEK : 0);
  return Math.max(0, skor);
}

/** Skor harian = rata-rata skor kejadian yang dihitung (hasil `skorKejadian`), dibulatkan; null bila tidak ada. */
export function skorHarian(skor: readonly (number | null)[]): number | null {
  const s = skor.filter((x): x is number => x !== null);
  return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
}

/**
 * Hari beruntun: dihitung mundur dari hari terbaru yang punya kejadian terhitung. Hari tanpa
 * kejadian terhitung (tanpa alarm, libur) dilewati, tidak memutus. Hari dengan satu kejadian di
 * bawah 70 memutus. `perHari` = tanggal lokal "YYYY-MM-DD" -> skor kejadian hari itu.
 */
export function hariBeruntun(perHari: ReadonlyMap<string, readonly (number | null)[]>): number {
  const tanggal = [...perHari.keys()].sort().reverse();
  let n = 0;
  for (const t of tanggal) {
    const s = (perHari.get(t) ?? []).filter((x): x is number => x !== null);
    if (!s.length) continue;
    if (s.some((x) => x < SKOR_BERUNTUN)) break;
    n++;
  }
  return n;
}
