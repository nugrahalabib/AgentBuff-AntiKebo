import { sql } from "drizzle-orm";
import { bigserial, boolean, char, customType, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AturanTuya, Bawaan, IsiTemplate, MasihBangun, Soal, Spam, Tunda } from "@/lib/alarm/isi";
import type { Pengulangan } from "@/lib/jadwal/pengulangan";

// Skema AntiKebo. Nama tabel & kolom bahasa Indonesia snake_case, waktu timestamptz (UTC).
// Setiap tabel ber-`pengguna_id` milik pemilik WAJIB punya RLS ENABLE+FORCE + kebijakan
// di migrasi (dijaga scripts/jaga.mjs). Hanya skema di sini; SQL-nya di src/lib/db/migrasi.
// P0 = tabel dasar; P2 = alarm, lewati, template, kejadian, langkah, preferensi; P3 = perangkat
// siaga, kode sambung. Suara, kanal, Tuya menyusul (P4 sampai P7). Impor dari src/lib hanya `import type` (drizzle-kit
// memuat berkas ini tanpa alias jalur).

const citext = customType<{ data: string }>({ dataType: () => "citext" });
const waktu = (nama: string) => timestamp(nama, { withTimezone: true, mode: "date" });
const dibuat = () => waktu("dibuat").notNull().defaultNow();

// ------------------------------------------------------------ identitas

export const pengguna = pgTable(
  "pengguna",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentbuffSub: text("agentbuff_sub").notNull(),
    email: citext("email"),
    nama: text("nama"),
    foto: text("foto"),
    bahasa: text("bahasa").notNull().default("id"), // id | en
    zonaWaktu: text("zona_waktu").notNull().default("Asia/Jakarta"),
    tema: text("tema").notNull().default("sistem"), // sistem | terang | gelap
    /** Cermin izin AgentBuff terakhir (scope `agentbuff:kabar` / `agentbuff:suara`). Kebenaran tetap di AgentBuff. */
    izinKabar: boolean("izin_kabar").notNull().default(false),
    izinSuara: boolean("izin_suara").notNull().default(false),
    izinDiperbarui: waktu("izin_diperbarui"),
    terakhirMasuk: waktu("terakhir_masuk"),
    dihapusPada: waktu("dihapus_pada"),
    dibuat: dibuat(),
    // --- preferensi (P2, PRD M)
    /** Nama yang dipakai omelan dan sapaan. Null = nama dari AgentBuff. */
    namaPanggilan: text("nama_panggilan"),
    /** Jam tidur lokal "HH:MM": awal kunci Mode Komitmen dan jam pengingat malam. */
    jamTidur: text("jam_tidur").notNull().default("22:00"),
    /** Bawaan alarm baru (sebagian isian alarm, divalidasi `SkemaBawaan`). */
    bawaan: jsonb("bawaan").$type<Bawaan>().notNull().default({}),
    pengingatMalam: boolean("pengingat_malam").notNull().default(true),
    orientasiSelesai: waktu("orientasi_selesai"),
  },
  (t) => [uniqueIndex("pengguna_agentbuff_sub_unik").on(t.agentbuffSub)],
);

/** Sesi web. Hanya HASH id yang disimpan; dicari sebelum pemilik diketahui (tabel global, tanpa RLS). */
export const sesi = pgTable(
  "sesi",
  {
    idHash: char("id_hash", { length: 64 }).primaryKey(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    dibuat: dibuat(),
    terakhirAktif: waktu("terakhir_aktif").notNull().defaultNow(),
    kedaluwarsaDiam: waktu("kedaluwarsa_diam").notNull(),
    kedaluwarsaMutlak: waktu("kedaluwarsa_mutlak").notNull(),
    ip: text("ip"),
    ua: text("ua"),
    dicabutPada: waktu("dicabut_pada"),
  },
  (t) => [index("sesi_pengguna_idx").on(t.penggunaId)],
);

/** Hak pemakaian dari AgentBuff `/masuk/status` (singgahan 10 menit, toleransi 72 jam saat tak terjangkau, K-12). */
export const statusHak = pgTable("status_hak", {
  penggunaId: uuid("pengguna_id")
    .primaryKey()
    .references(() => pengguna.id),
  aktif: boolean("aktif").notNull(),
  alasan: text("alasan").notNull(),
  pesan: text("pesan"),
  diperiksaPada: waktu("diperiksa_pada"),
  terakhirBaikPada: waktu("terakhir_baik_pada"),
  cobaLagiSetelah: waktu("coba_lagi_setelah"),
  gagalBeruntun: integer("gagal_beruntun").notNull().default(0),
});

/** `jti` asersi mcp-token yang sudah dipakai (anti putar ulang). */
export const jtiTerpakai = pgTable("jti_terpakai", {
  jti: text("jti").primaryKey(),
  kedaluwarsa: waktu("kedaluwarsa").notNull(),
});

/** Token MCP: `antikebo_` + 43 karakter. Hanya sha256 yang disimpan. */
export const tokenMcp = pgTable(
  "token_mcp",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    label: text("label").notNull(),
    hash: char("hash", { length: 64 }).notNull(), // sha256(token); token mentah tidak pernah disimpan
    awalan: char("awalan", { length: 13 }).notNull(), // "antikebo_xxxx" untuk tampilan
    sumber: text("sumber").notNull(), // manual | agentbuff_otomatis
    kedaluwarsa: waktu("kedaluwarsa"),
    terakhirDipakai: waktu("terakhir_dipakai"),
    dicabutPada: waktu("dicabut_pada"),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("token_mcp_hash_unik").on(t.hash), index("token_mcp_pengguna_idx").on(t.penggunaId)],
);

/** Detak worker per putaran, dibaca /api/health dan pemantau operator. Tanpa data pengguna. */
export const detakWorker = pgTable("detak_worker", {
  nama: text("nama").primaryKey(),
  terakhir: waktu("terakhir").notNull(),
  catatan: text("catatan"),
});

/** Jejak audit: siapa (web, agen, perangkat, worker, sistem) melakukan apa. Tanpa rahasia dan isi pribadi. */
export const audit = pgTable(
  "audit",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    sumber: text("sumber").notNull(), // web | agen | perangkat | worker | sistem
    jenis: text("jenis").notNull(), // masuk | token | izin | alarm | kejadian | perangkat | pengaturan | lainnya
    ringkasan: text("ringkasan").notNull(),
    detail: jsonb("detail"),
    berhasil: boolean("berhasil").notNull().default(true),
    galat: text("galat"),
    dibuat: dibuat(),
  },
  (t) => [index("audit_pengguna_idx").on(t.penggunaId, t.dibuat)],
);

// ------------------------------------------------------------ alarm (P2)

/** Satu alarm. ID tetap seumur hidup (ubah tidak membuat baris baru). Isi divalidasi `SkemaIsiAlarm`. */
export const alarm = pgTable(
  "alarm",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    /** Jam lokal "HH:MM". */
    jam: text("jam").notNull(),
    /** Zona IANA saat jam itu berlaku (ikut zona pengguna; diganti bersama bila pengguna pindah zona). */
    zona: text("zona").notNull(),
    pengulangan: jsonb("pengulangan").$type<Pengulangan>().notNull(),
    agendaJudul: text("agenda_judul").notNull(),
    agendaDetail: text("agenda_detail"),
    karakter: text("karakter").notNull(),
    suaraId: text("suara_id"),
    bunyi: text("bunyi").notNull(),
    soal: jsonb("soal").$type<Soal>().notNull(),
    tunda: jsonb("tunda").$type<Tunda>().notNull(),
    spam: jsonb("spam").$type<Spam>().notNull(),
    tuya: jsonb("tuya").$type<AturanTuya[]>().notNull().default([]),
    komitmen: boolean("komitmen").notNull().default(false),
    masihBangun: jsonb("masih_bangun").$type<MasihBangun>().notNull(),
    liburNasional: boolean("libur_nasional").notNull().default(false),
    /** Berhenti sendiri sesudah X menit (PRD C4). Null = tanpa batas. */
    batasMenit: integer("batas_menit"),
    aktif: boolean("aktif").notNull().default(true),
    /** Template asal ("bawaan:..." atau id template pengguna), hanya catatan. */
    dariTemplate: text("dari_template"),
    dibuat: dibuat(),
    diubah: waktu("diubah").notNull().defaultNow(),
  },
  (t) => [index("alarm_pengguna_idx").on(t.penggunaId)],
);

/** Tanggal lokal yang dilewati sebuah alarm (PRD B4). Bisa dibatalkan. */
export const lewatiAlarm = pgTable(
  "lewati_alarm",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    alarmId: uuid("alarm_id")
      .notNull()
      .references(() => alarm.id, { onDelete: "cascade" }),
    tanggal: date("tanggal", { mode: "string" }).notNull(),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("lewati_alarm_unik").on(t.alarmId, t.tanggal), index("lewati_alarm_pengguna_idx").on(t.penggunaId)],
);

/** Template buatan pengguna (PRD B10). Template bawaan ada di kode (`src/lib/alarm/template-bawaan.ts`). */
export const templateAlarm = pgTable(
  "template_alarm",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    nama: text("nama").notNull(),
    isi: jsonb("isi").$type<IsiTemplate>().notNull(),
    dibuat: dibuat(),
    diubah: waktu("diubah").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("template_alarm_nama_unik").on(t.penggunaId, sql`lower(${t.nama})`)],
);

/**
 * Satu bunyi alarm. Setiap alarm aktif punya TEPAT SATU kejadian `menunggu` (indeks unik parsial)
 * untuk jadwal berikutnya, dibuat di transaksi yang sama dengan perubahan alarm (arsitektur §4).
 * Judul dan jam disalin supaya riwayat tetap utuh walau alarmnya dihapus.
 */
export const kejadianAlarm = pgTable(
  "kejadian_alarm",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    alarmId: uuid("alarm_id").references(() => alarm.id, { onDelete: "set null" }),
    jadwalUtc: waktu("jadwal_utc").notNull(),
    tanggalLokal: date("tanggal_lokal", { mode: "string" }).notNull(),
    jamLokal: text("jam_lokal").notNull(),
    judul: text("judul").notNull(),
    /** menunggu | berbunyi | ditunda | cek_bangun | bangun | tidak_bangun | terlewat | dibatalkan */
    status: text("status").notNull().default("menunggu"),
    /** Uji alarm (PRD B9): tidak dihitung skor, tidak menggeser kejadian menunggu. */
    uji: boolean("uji").notNull().default(false),
    jumlahTunda: integer("jumlah_tunda").notNull().default(0),
    tundaSampai: waktu("tunda_sampai"),
    berbunyiPada: waktu("berbunyi_pada"),
    bangunPada: waktu("bangun_pada"),
    terlambatDtk: integer("terlambat_dtk"),
    /** Salinan isi alarm saat mulai berbunyi (P3). */
    isi: jsonb("isi"),
    dibuat: dibuat(),
    diubah: waktu("diubah").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("kejadian_menunggu_unik")
      .on(t.alarmId)
      .where(sql`status = 'menunggu' and not uji`),
    index("kejadian_jadwal_idx").on(t.status, t.jadwalUtc),
    index("kejadian_pengguna_idx").on(t.penggunaId, t.jadwalUtc),
  ],
);

/** Langkah terjadwal per kejadian (spam, notifikasi, Tuya, batas waktu). Diisi worker mulai P3. */
export const langkahKejadian = pgTable(
  "langkah_kejadian",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    kejadianId: uuid("kejadian_id")
      .notNull()
      .references(() => kejadianAlarm.id, { onDelete: "cascade" }),
    jenis: text("jenis").notNull(),
    urutan: integer("urutan").notNull().default(0),
    jatuhTempoUtc: waktu("jatuh_tempo_utc").notNull(),
    parameter: jsonb("parameter"),
    /** menunggu | jalan | selesai | gagal | dibatalkan */
    status: text("status").notNull().default("menunggu"),
    hasil: jsonb("hasil"),
    percobaan: integer("percobaan").notNull().default(0),
    dibuat: dibuat(),
    diubah: waktu("diubah").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("langkah_kejadian_unik").on(t.kejadianId, t.jenis, t.urutan), index("langkah_jatuh_tempo_idx").on(t.status, t.jatuhTempoUtc)],
);

// ------------------------------------------------------------ perangkat siaga (P3)

/** Kemampuan dan keadaan yang dilaporkan perangkat lewat detak. */
export type KemampuanPerangkat = { dicas?: boolean | null; baterai?: number | null; suara?: boolean | null; layarMenyala?: boolean | null };

/**
 * Perangkat yang membunyikan alarm (PRD H1): aplikasi PC (`pc`, token perangkat) dan Mode Jam Meja
 * (`web`, sesi peramban). Token perangkat hanya disimpan hash-nya; dicari lewat hash sebelum
 * pemilik diketahui (kebijakan RLS khusus, pola token MCP).
 */
export const perangkatSiaga = pgTable(
  "perangkat_siaga",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    jenis: text("jenis").notNull(), // pc | web
    nama: text("nama").notNull(),
    tokenHash: char("token_hash", { length: 64 }),
    versiAplikasi: text("versi_aplikasi"),
    terakhirTerlihat: waktu("terakhir_terlihat"),
    kemampuan: jsonb("kemampuan").$type<KemampuanPerangkat>().notNull().default({}),
    /** Perangkat menyatakan memegang jadwal lokal sampai waktu ini. */
    siapSampai: waktu("siap_sampai"),
    dicabutPada: waktu("dicabut_pada"),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("perangkat_token_unik").on(t.tokenHash), index("perangkat_pengguna_idx").on(t.penggunaId)],
);

/**
 * Kode sambung PC (berlaku 10 menit). Tabel GLOBAL tanpa RLS (seperti `sesi`): aplikasi PC
 * mencarinya lewat hash kode + hash rahasia tunggu sebelum pemilik diketahui. Token perangkat
 * TIDAK pernah disimpan di sini; dibuat saat diambil dan langsung disimpan hash-nya.
 */
export const kodeSambung = pgTable(
  "kode_sambung",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kodeHash: char("kode_hash", { length: 64 }).notNull(),
    rahasiaHash: char("rahasia_hash", { length: 64 }).notNull(),
    namaPerangkat: text("nama_perangkat").notNull(),
    versiAplikasi: text("versi_aplikasi"),
    /** menunggu | disetujui | diambil */
    status: text("status").notNull().default("menunggu"),
    penggunaId: uuid("pengguna_id").references(() => pengguna.id),
    perangkatId: uuid("perangkat_id").references(() => perangkatSiaga.id),
    kedaluwarsa: waktu("kedaluwarsa").notNull(),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("kode_sambung_hash_unik").on(t.kodeHash)],
);
