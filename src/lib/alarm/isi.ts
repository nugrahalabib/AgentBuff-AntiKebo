import { z } from "zod";
import { SkemaJam, SkemaPengulangan } from "@/lib/jadwal/pengulangan";

/**
 * Isi sebuah alarm (PRD B2). Satu skema dipakai web, MCP, template, dan bawaan pengguna, supaya
 * aturan batas sama di semua pintu. Masukan dari luar SELALU lewat `z.strictObject`. Pesan
 * kustom berupa kunci (`judul_wajib`, ...) yang diterjemahkan lewat kamus `galat.isian`.
 */

export const KARAKTER = ["ibu_galak", "pelatih_tentara", "bos_killer", "teman_nyolot", "pacar_bawel", "kustom"] as const;
export const BUNYI = ["klasik", "digital", "sirene", "lonceng", "kebakaran", "ayam", "nuklir", "naik"] as const;
export const JENIS_SOAL = ["hitungan", "ingat", "ketik", "qr", "gabungan"] as const;
export const TINGKAT = ["ringan", "sedang", "berat"] as const;
export const MENIT_TUNDA = [5, 10, 15] as const;

/** Panjang dalam huruf yang terlihat (emoji = 1), bukan unit UTF-16. */
const panjang = (s: string) => Array.from(s).length;
const teks = (maks: number) =>
  z
    .string()
    .trim()
    .refine((s) => panjang(s) <= maks, "terlalu_panjang");

const SkemaSoalDasar = z.strictObject({
  jenis: z.enum(JENIS_SOAL),
  tingkat: z.enum(TINGKAT),
  /** Jawaban benar berturut-turut yang dibutuhkan (PRD D1). */
  benar: z.int().min(1).max(5),
  /** Kode QR yang boleh dipindai (Misi QR dan gabungan). */
  kodeQr: z.array(z.uuid()).max(5),
});

export const SkemaSoal = SkemaSoalDasar.refine((s) => (s.jenis === "qr" || s.jenis === "gabungan" ? s.kodeQr.length > 0 : true), { message: "kode_qr_wajib", path: ["kodeQr"] });

export const SkemaTunda = z.strictObject({
  jatah: z.int().min(0).max(5),
  menit: z.union([z.literal(5), z.literal(10), z.literal(15)]),
});

export const SkemaSpam = z.strictObject({
  /** Id kanal dari AgentBuff pengguna. */
  kanal: z.array(z.string().min(1).max(100)).max(10),
  /** Jeda pilihan pengguna (detik). Null = bawaan platform; tidak pernah lebih cepat dari batas minimal platform (PRD G2). */
  jedaDtk: z.int().min(5).max(600).nullable(),
  /** Berhenti mengirim sesudah X menit. Null = selama berbunyi. */
  batasMenit: z.int().min(1).max(240).nullable(),
});

export const SkemaMasihBangun = z.strictObject({
  aktif: z.boolean(),
  /** Muncul N menit sesudah lolos (PRD E2). */
  menit: z.int().min(3).max(15),
  /** Batas mengetuk sebelum alarm kembali penuh. */
  batasDtk: z.int().min(60).max(180),
});

/** Aturan satu perangkat rumah pintar per alarm (PRD I3). Dipakai worker di P7. */
export const SkemaAturanTuya = z.strictObject({
  perangkatId: z.string().min(1).max(64),
  kapan: z.enum(["sebelum", "bareng", "tunda", "sesudah"]),
  /** Untuk `sebelum`: mulai X menit sebelum alarm, naik bertahap. */
  menitSebelum: z.int().min(1).max(60).nullable(),
  aksi: z.strictObject({
    nyala: z.boolean().optional(),
    terang: z.int().min(1).max(100).optional(),
    warna: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    suhuPutih: z.int().min(0).max(100).optional(),
    suhuAc: z.int().min(16).max(30).optional(),
    modeAc: z.enum(["dingin", "panas", "kipas", "kering", "otomatis"]).optional(),
  }),
  kedip: z.boolean(),
  sesudahBangun: z.enum(["kembalikan", "suasana_pagi", "biarkan"]),
});

export const SkemaIsiAlarm = z.strictObject({
  /** Jam lokal "HH:MM" di zona pengguna. */
  jam: SkemaJam,
  pengulangan: SkemaPengulangan,
  agendaJudul: teks(60).pipe(z.string().min(1, "judul_wajib")),
  agendaDetail: teks(200).nullable(),
  karakter: z.enum(KARAKTER),
  /** Id suara AgentBuff pengguna. Null = suara bawaan AgentBuff. */
  suaraId: z.string().min(1).max(100).nullable(),
  bunyi: z.enum(BUNYI),
  soal: SkemaSoal,
  tunda: SkemaTunda,
  spam: SkemaSpam,
  tuya: z.array(SkemaAturanTuya).max(20),
  komitmen: z.boolean(),
  masihBangun: SkemaMasihBangun,
  /** Jangan bunyi saat libur nasional (PRD B5). */
  liburNasional: z.boolean(),
  /** Berhenti sendiri sesudah X menit dan dicatat "tidak bangun" (PRD C4). Null = tanpa batas. */
  batasMenit: z.int().min(5).max(240).nullable(),
  aktif: z.boolean(),
});

export type IsiAlarm = z.infer<typeof SkemaIsiAlarm>;
export type Soal = IsiAlarm["soal"];
export type Tunda = IsiAlarm["tunda"];
export type Spam = IsiAlarm["spam"];
export type MasihBangun = IsiAlarm["masihBangun"];
export type AturanTuya = z.infer<typeof SkemaAturanTuya>;
export type IdKarakter = IsiAlarm["karakter"];
export type IdBunyi = IsiAlarm["bunyi"];

/**
 * Bawaan pengguna untuk alarm baru (Pengaturan, PRD M). Hanya isian yang wajar dijadikan bawaan;
 * jam, pengulangan, dan agenda selalu milik alarm itu sendiri.
 */
export const SkemaBawaan = z
  .strictObject({
    karakter: SkemaIsiAlarm.shape.karakter,
    suaraId: SkemaIsiAlarm.shape.suaraId,
    bunyi: SkemaIsiAlarm.shape.bunyi,
    soal: SkemaSoal,
    tunda: SkemaTunda,
    spam: SkemaSpam,
    komitmen: z.boolean(),
    masihBangun: SkemaMasihBangun,
    liburNasional: z.boolean(),
    batasMenit: SkemaIsiAlarm.shape.batasMenit,
  })
  .partial();
export type Bawaan = z.infer<typeof SkemaBawaan>;

/** Bawaan sistem bila pengguna belum mengatur (PRD D1, E1, E2). */
export const BAWAAN_SISTEM: Required<Bawaan> = {
  karakter: "ibu_galak",
  suaraId: null,
  bunyi: "klasik",
  soal: { jenis: "hitungan", tingkat: "sedang", benar: 2, kodeQr: [] },
  tunda: { jatah: 2, menit: 5 },
  spam: { kanal: [], jedaDtk: null, batasMenit: null },
  komitmen: false,
  masihBangun: { aktif: true, menit: 5, batasDtk: 60 },
  liburNasional: false,
  batasMenit: null,
};

/**
 * Masukan buat/ubah dari web dan MCP: semua isian opsional (yang kosong memakai template,
 * lalu bawaan pengguna, lalu bawaan sistem). `pengulangan` boleh `{ jenis: "sekali" }` tanpa
 * tanggal = kemunculan jam itu berikutnya (hari ini bila belum lewat, selain itu besok).
 */
export const SkemaPengulanganMasukan = z.union([SkemaPengulangan, z.strictObject({ jenis: z.literal("sekali") })]);

export const SkemaMasukanAlarm = SkemaIsiAlarm.extend({
  pengulangan: SkemaPengulanganMasukan,
  // Isian bersarang boleh sebagian ("soal: { tingkat: 'berat' }"); digabung ke nilai lama lalu diperiksa utuh.
  soal: SkemaSoalDasar.partial(),
  tunda: SkemaTunda.partial(),
  spam: SkemaSpam.partial(),
  masihBangun: SkemaMasihBangun.partial(),
}).partial();
export type MasukanAlarm = z.infer<typeof SkemaMasukanAlarm>;

/** Isi template: sama dengan masukan, tanpa `aktif`. */
export const SkemaIsiTemplate = SkemaMasukanAlarm.omit({ aktif: true });
export type IsiTemplate = z.infer<typeof SkemaIsiTemplate>;

export const MAKS_ALARM = 50;
export const MAKS_TEMPLATE = 20;
