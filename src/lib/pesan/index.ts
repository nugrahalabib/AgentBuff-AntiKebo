import { isi } from "@/lib/i18n";
import { acakPutaran } from "@/lib/suara/urutan";
import { TEKS_PESAN } from "./teks";

/**
 * Penyusun pesan kanal dan notifikasi (PRD G3, G4, G5, G7). MURNI dan deterministik: pesan ke-n
 * sebuah kejadian selalu sama (aman bila langkah diulang sesudah worker mati), bervariasi antar
 * pesan, dan kalimat yang sama tidak muncul dua kali berturut-turut. Tanpa AI.
 */

export const MAKS_TEKS = 1000; // batas pintu /masuk/kabar (docs/05-INTEGRASI-AGENTBUFF.md §4.2)

type Bahasa = "id" | "en";

/** Benih 32 bit dari teks (FNV-1a), mis. dari id kejadian. */
export function benihDari(teks: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < teks.length; i++) {
    h ^= teks.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Indeks pilihan ke-n (mulai 1) dari `jumlah` bahan: diacak per putaran, semua terpakai sebelum
 * ada yang diulang, dan pilihan pertama putaran baru tidak sama dengan pilihan terakhir putaran
 * sebelumnya (aturan yang sama dengan urutan omelan suara).
 */
export function pilihKe(n: number, jumlah: number, benih: number): number {
  if (jumlah <= 0) return -1;
  const putaran = Math.floor((Math.max(1, n) - 1) / jumlah);
  let hindari: number | null = null;
  let urut: number[] = [];
  for (let r = 0; r <= putaran; r++) {
    urut = acakPutaran(jumlah, benih, r, hindari);
    hindari = urut[jumlah - 1];
  }
  return urut[(Math.max(1, n) - 1) % jumlah];
}

function rapikan(baris: Array<string | null | undefined | false>): string {
  const t = baris.filter(Boolean).join("\n");
  return Array.from(t).length > MAKS_TEKS
    ? `${Array.from(t)
        .slice(0, MAKS_TEKS - 1)
        .join("")}…`
    : t;
}

export type MasukanSpam = {
  bahasa: Bahasa;
  nama: string;
  /** Nomor pesan ke kanal ini untuk kejadian ini (mulai 1). */
  ke: number;
  /** Menit sejak alarm mulai berbunyi. */
  menit: number;
  /** Jam alarm untuk tampilan ("05.00" / "05:00"). */
  jam: string;
  agenda: string | null;
  /** Kalimat omelan karakter + agenda + pribadi (sudah berisi nama). */
  omelan: readonly string[];
  tautan: string;
  benih: number;
};

export function pesanSpam(m: MasukanSpam): string {
  const T = TEKS_PESAN[m.bahasa];
  const pembuka = T.pembuka[pilihKe(m.ke, T.pembuka.length, (m.benih ^ 0x5bd1e995) >>> 0)];
  return rapikan([
    isi(pembuka, { nama: m.nama, ke: m.ke }),
    m.omelan.length ? m.omelan[pilihKe(m.ke, m.omelan.length, m.benih)] : null,
    m.agenda ? isi(T.agenda, { agenda: m.agenda }) : null,
    m.menit >= 1 ? isi(T.menitBerlalu, { menit: m.menit, jam: m.jam }) : isi(T.baruBerbunyi, { jam: m.jam }),
    isi(T.tautanMatikan, { tautan: m.tautan }),
  ]);
}

export function pesanPenutup(m: { bahasa: Bahasa; nama: string; penutup: string | null; jamBangun: string; menit: number; tunda: number }): string {
  const T = TEKS_PESAN[m.bahasa];
  return rapikan([
    m.penutup ?? isi(T.penutupUmum, { nama: m.nama }),
    isi(m.tunda ? T.penutupRingkas : T.penutupTanpaTunda, { jamBangun: m.jamBangun, menit: m.menit, tunda: m.tunda }),
  ]);
}

export function pesanCek(m: { bahasa: Bahasa; nama: string; cek: string | null; tautan: string }): string {
  const T = TEKS_PESAN[m.bahasa];
  return rapikan([m.cek ?? isi(T.cekUmum, { nama: m.nama }), isi(T.cekAjak, { tautan: m.tautan })]);
}

export function pesanTerlewat(m: { bahasa: Bahasa; nama: string; jam: string; agenda: string | null; tautan: string }): string {
  const T = TEKS_PESAN[m.bahasa];
  return rapikan([isi(m.agenda ? T.terlewatAgenda : T.terlewat, { jam: m.jam, agenda: m.agenda ?? "", nama: m.nama, tautan: m.tautan })]);
}

export function pesanPengingat(m: { bahasa: Bahasa; nama: string; jam: string; agenda: string | null; perangkatSiap: readonly string[]; tautan: string }): string {
  const T = TEKS_PESAN[m.bahasa];
  return rapikan([
    isi(T.pengingatJudul, { nama: m.nama }),
    isi(m.agenda ? T.pengingatAlarmAgenda : T.pengingatAlarm, { jam: m.jam, agenda: m.agenda ?? "" }),
    m.perangkatSiap.length ? isi(T.pengingatSiap, { perangkat: m.perangkatSiap.join(", ") }) : T.pengingatTanpaSiaga,
    isi(T.pengingatTautan, { tautan: m.tautan }),
  ]);
}

export function pesanUji(m: { bahasa: Bahasa; nama: string }): string {
  return isi(TEKS_PESAN[m.bahasa].uji, { nama: m.nama });
}

// ------------------------------------------------------------------ notifikasi web (PRD G5)

export type JenisNotif = "bunyi" | "cek" | "selesai" | "terlewat" | "pengingat" | "uji";

/**
 * Isi notifikasi push (dibaca `public/sw.js`). `tag` sama = notifikasi diganti, bukan ditumpuk;
 * `ulang` = bunyi/getar lagi walau tag sama (renotify); `tahan` = tidak hilang sendiri.
 */
export type IsiNotif = { jenis: JenisNotif; judul: string; isi: string; tag: string; url: string; ulang: boolean; tahan: boolean };

export function notifBunyi(m: { bahasa: Bahasa; judul: string; omelan: string; tag: string; url: string }): IsiNotif {
  return { jenis: "bunyi", judul: isi(TEKS_PESAN[m.bahasa].notifJudulBunyi, { judul: m.judul }), isi: m.omelan, tag: m.tag, url: m.url, ulang: true, tahan: true };
}

export function notifCek(m: { bahasa: Bahasa; nama: string; tag: string; url: string }): IsiNotif {
  const T = TEKS_PESAN[m.bahasa];
  return { jenis: "cek", judul: isi(T.notifJudulCek, { nama: m.nama }), isi: T.notifCekIsi, tag: m.tag, url: m.url, ulang: true, tahan: true };
}

/** Mengganti notifikasi berbunyi (tag sama) sesudah alarm mati, tanpa bunyi dan tanpa ditahan. */
export function notifSelesai(m: { bahasa: Bahasa; nama: string; tag: string; url: string }): IsiNotif {
  const T = TEKS_PESAN[m.bahasa];
  return { jenis: "selesai", judul: T.notifJudulSelesai, isi: isi(T.notifIsiSelesai, { nama: m.nama }), tag: m.tag, url: m.url, ulang: false, tahan: false };
}

export function notifTerlewat(m: { bahasa: Bahasa; nama: string; jam: string; agenda: string | null; tag: string; url: string }): IsiNotif {
  const T = TEKS_PESAN[m.bahasa];
  return { jenis: "terlewat", judul: isi(T.notifJudulTerlewat, { jam: m.jam }), isi: pesanTerlewat({ ...m, tautan: m.url }), tag: m.tag, url: m.url, ulang: true, tahan: false };
}

export function notifPengingat(m: { bahasa: Bahasa; nama: string; jam: string; agenda: string | null; perangkatSiap: readonly string[]; url: string }): IsiNotif {
  const T = TEKS_PESAN[m.bahasa];
  const baris = [m.agenda ?? null, m.perangkatSiap.length ? isi(T.pengingatSiap, { perangkat: m.perangkatSiap.join(", ") }) : T.pengingatTanpaSiaga];
  return { jenis: "pengingat", judul: isi(T.notifJudulPengingat, { jam: m.jam }), isi: rapikan(baris), tag: "pengingat", url: m.url, ulang: false, tahan: false };
}

export function notifUji(m: { bahasa: Bahasa; url: string }): IsiNotif {
  const T = TEKS_PESAN[m.bahasa];
  return { jenis: "uji", judul: T.notifJudulUji, isi: T.notifIsiUji, tag: "uji", url: m.url, ulang: true, tahan: false };
}
