// Bentuk data yang dipakai komponen layar (src/components/layar). Prototipe P1 mengisinya dengan
// data contoh (src/lib/prototipe/contoh.ts); P8/P11 mengisinya dari API. Teks yang sudah
// diformat (mis. uraian pengulangan) dikirim jadi supaya komponen tidak menghitung jadwal.

export type IdKarakter = "ibu_galak" | "pelatih_tentara" | "bos_killer" | "teman_nyolot" | "pacar_bawel" | "kustom";

export const DAFTAR_KARAKTER: readonly IdKarakter[] = ["ibu_galak", "pelatih_tentara", "bos_killer", "teman_nyolot", "pacar_bawel", "kustom"];

/** Warna khas tiap karakter (latar kotak ikon). */
export const WARNA_KARAKTER: Record<IdKarakter, string> = {
  ibu_galak: "#e11d48",
  pelatih_tentara: "#4d7c0f",
  bos_killer: "#1f2937",
  teman_nyolot: "#7c3aed",
  pacar_bawel: "#db2777",
  kustom: "#0369a1",
};

export type IdBunyi = "klasik" | "digital" | "sirene" | "lonceng" | "kebakaran" | "ayam" | "nuklir" | "naik";
export const DAFTAR_BUNYI: readonly IdBunyi[] = ["klasik", "digital", "sirene", "lonceng", "kebakaran", "ayam", "nuklir", "naik"];

export type StatusSuara = { status: "siap" } | { status: "dibuat"; n: number; total: number } | { status: "belum"; alasan?: string };

export type RingkasAlarm = {
  id: string;
  /** "05:00" waktu lokal pengguna. */
  jam: string;
  judul: string;
  detail?: string;
  /** Uraian pengulangan siap tampil ("Sen-Jum", "Sekali, besok"). */
  uraianUlang: string;
  aktif: boolean;
  karakter: IdKarakter;
  jumlahKanal: number;
  tuya: boolean;
  /** Mode Komitmen sedang mengunci alarm ini sampai jam tersebut. */
  terkunciSampai?: string;
  suara: StatusSuara;
};

export type RingkasPerangkat = {
  id: string;
  jenis: "pc" | "web";
  nama: string;
  siapMalamIni: boolean;
  /** Teks relatif siap tampil ("2 menit lalu"). */
  terakhirTerlihat: string;
  dicas?: boolean | null;
  baterai?: number | null;
};

export type KanalTampil = { id: string; platform: "telegram" | "whatsapp" | "discord" | "slack" | "google_chat"; label: string; siap: boolean; alasan?: string; dipilih: boolean };

export type KejadianRiwayat = {
  id: string;
  tanggal: string;
  jam: string;
  judul: string;
  status: "bangun" | "tidak_bangun" | "terlewat";
  skor: number | null;
  tunda: number;
  menitSampaiBangun: number;
  pesanKanal: number;
};
