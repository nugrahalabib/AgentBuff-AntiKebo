import { sql } from "drizzle-orm";
import { bigserial, boolean, char, customType, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AturanTuya, Bawaan, IsiTemplate, MasihBangun, Soal, Spam, Tunda } from "@/lib/alarm/isi";
import type { Pengulangan } from "@/lib/jadwal/pengulangan";

// Skema AntiKebo. Nama tabel & kolom bahasa Indonesia snake_case, waktu timestamptz (UTC).
// Setiap tabel ber-`pengguna_id` milik pemilik WAJIB punya RLS ENABLE+FORCE + kebijakan
// di migrasi (dijaga scripts/jaga.mjs). Hanya skema di sini; SQL-nya di src/lib/db/migrasi.
// P0 = tabel dasar; P2 = alarm, lewati, template, kejadian, langkah, preferensi; P3 = perangkat
// siaga, kode sambung; P4 = soal kejadian, kode QR; P5 = naskah dan klip suara; P6 = kiriman
// kanal, langganan push; P7 = sambungan, perangkat, dan potret Tuya. Impor dari src/lib hanya `import type` (drizzle-kit
// memuat berkas ini tanpa alias jalur).

const citext = customType<{ data: string }>({ dataType: () => "citext" });
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v)),
});
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
    /** Tanggal lokal malam terakhir pengingat terkirim (P6): satu pengingat per malam. */
    pengingatTerkirim: date("pengingat_terkirim", { mode: "string" }),
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
    /** Kalimat omelan pribadi (PRD F3): maks 10, maks 150 huruf, lewat penyaring. */
    kalimatPribadi: jsonb("kalimat_pribadi").$type<string[]>().notNull().default([]),
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

export type PerangkatBerbunyi = { id: string; nama: string; jenis: string };

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
    // --- P4: "Masih bangun?" dan penutup
    /** Kapan "Masih bangun?" tampil (status cek_bangun). */
    cekPada: waktu("cek_pada"),
    /** Batas mengetuk "Masih!"; lewat = alarm kembali penuh. */
    cekBatas: waktu("cek_batas"),
    /** Tunda dimatikan (sesudah gagal "Masih bangun?", PRD E2). */
    tanpaTunda: boolean("tanpa_tunda").notNull().default(false),
    /** Siapa yang menghentikan: sesi | perangkat | luring | batas. */
    selesaiOleh: text("selesai_oleh"),
    perangkatSelesai: uuid("perangkat_selesai"),
    /** P11: perangkat siaga (detak < 2 menit) saat mulai berbunyi, salinan nama untuk Riwayat (PRD K1). */
    perangkatBerbunyi: jsonb("perangkat_berbunyi").$type<PerangkatBerbunyi[]>().notNull().default([]),
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

// ------------------------------------------------------------ soal & kode QR (P4)

/** Isi yang boleh tampil di layar alarm untuk satu soal (TANPA jawaban hitungan). */
export type TampilSoal = { teks: string; sembunyiSetelahMs?: number; tempat?: string[] };

/**
 * Satu soal yang ditampilkan untuk sebuah kejadian (PRD D1 sampai D7). Satu baris per soal;
 * hitungan beruntun dibawa dari soal sebelumnya. Jawaban hanya disimpan sebagai HMAC dengan garam
 * per soal, tidak pernah dikirim ke peramban, tidak pernah dicatat.
 */
export const soalKejadian = pgTable(
  "soal_kejadian",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    kejadianId: uuid("kejadian_id")
      .notNull()
      .references(() => kejadianAlarm.id, { onDelete: "cascade" }),
    /** bangun | tunda */
    tujuan: text("tujuan").notNull(),
    /** hitungan | ingat | ketik | qr */
    jenis: text("jenis").notNull(),
    tingkat: text("tingkat").notNull(),
    /** Jawaban benar berturut-turut yang dibutuhkan tahap ini. */
    target: integer("target").notNull(),
    /** Gabungan: tahap ke berapa (0 = hitungan, 1 = QR). */
    tahap: integer("tahap").notNull().default(0),
    tampil: jsonb("tampil").$type<TampilSoal>().notNull(),
    hashJawaban: char("hash_jawaban", { length: 64 }),
    garam: text("garam").notNull(),
    /** Kode QR yang diterima (Misi QR). */
    kodeQr: jsonb("kode_qr").$type<string[]>().notNull().default([]),
    benarBeruntun: integer("benar_beruntun").notNull().default(0),
    salahBeruntun: integer("salah_beruntun").notNull().default(0),
    /** aktif | benar | salah | diganti */
    status: text("status").notNull().default("aktif"),
    dijawabPada: waktu("dijawab_pada"),
    dibuat: dibuat(),
  },
  (t) => [
    index("soal_kejadian_idx").on(t.kejadianId, t.tujuan, t.status),
    uniqueIndex("soal_aktif_unik")
      .on(t.kejadianId, t.tujuan)
      .where(sql`status = 'aktif'`),
  ],
);

/**
 * Kode QR Misi QR (PRD D4). Isi acak 128 bit: hash-nya untuk memeriksa pindaian, isinya tersandi
 * amplop (kripto.ts) supaya halaman cetak bisa dibuka lagi.
 */
export const kodeQr = pgTable(
  "kode_qr",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    nama: text("nama").notNull(),
    isiHash: char("isi_hash", { length: 64 }).notNull(),
    isiTersandi: text("isi_tersandi").notNull(),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("kode_qr_hash_unik").on(t.isiHash), index("kode_qr_pengguna_idx").on(t.penggunaId)],
);

// ------------------------------------------------------------ suara (P5)

/**
 * Kalimat omelan yang perlu dibuatkan suara lewat AgentBuff pengguna (docs/10-SUARA.md §4). Satu
 * baris per kunci (`hash` = teks + suara + gaya + bahasa) per pengguna: dipakai ulang lintas alarm.
 * Teks kalimat bukan rahasia tetapi pribadi: tidak pernah dicatat di log.
 */
export const naskahSuara = pgTable(
  "naskah_suara",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    hash: char("hash", { length: 64 }).notNull(),
    teks: text("teks").notNull(),
    bahasa: text("bahasa").notNull(),
    suaraId: text("suara_id"),
    gaya: text("gaya").notNull(),
    /** menunggu | dibuat | siap | gagal */
    status: text("status").notNull().default("menunggu"),
    /** Alasan gagal dari pintu suara (kode kontrak, bukan pesan mentah). */
    alasan: text("alasan"),
    percobaan: integer("percobaan").notNull().default(0),
    cobaLagiSetelah: waktu("coba_lagi_setelah").notNull().defaultNow(),
    klipId: uuid("klip_id"),
    dibuat: dibuat(),
    diubah: waktu("diubah").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("naskah_suara_unik").on(t.penggunaId, t.hash), index("naskah_suara_antre_idx").on(t.status, t.cobaLagiSetelah)],
);

/** Audio omelan dari AgentBuff pengguna (bytea, ikut cadangan DB). */
export const klipSuara = pgTable(
  "klip_suara",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    hash: char("hash", { length: 64 }).notNull(),
    audio: bytea("audio").notNull(),
    mime: text("mime").notNull(),
    durasiMs: integer("durasi_ms").notNull(),
    penyedia: text("penyedia").notNull(),
    suara: text("suara").notNull(),
    dibuat: dibuat(),
    dipakaiTerakhir: waktu("dipakai_terakhir").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("klip_suara_unik").on(t.penggunaId, t.hash)],
);

// ------------------------------------------------------------ kanal dan notifikasi (P6)

/**
 * Jejak setiap pesan kanal (PRD G6): spam, penutup, cek, terlewat, pengingat malam, uji. Isi
 * pesan TIDAK disimpan. `kunci` = kunci idempoten ke AgentBuff (unik per pengguna: langkah yang
 * diulang sesudah worker mati tidak tercatat dua kali).
 */
export const kirimanKanal = pgTable(
  "kiriman_kanal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    kejadianId: uuid("kejadian_id").references(() => kejadianAlarm.id, { onDelete: "set null" }),
    kanalId: text("kanal_id").notNull(),
    platform: text("platform"),
    jenis: text("jenis").notNull(), // spam | penutup | cek | terlewat | pengingat | uji
    ke: integer("ke"),
    status: text("status").notNull(), // terkirim | gagal | ditunda
    alasan: text("alasan"),
    idKiriman: text("id_kiriman"),
    kunci: text("kunci").notNull(),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("kiriman_kanal_unik").on(t.penggunaId, t.kunci), index("kiriman_kanal_kejadian_idx").on(t.kejadianId)],
);

/**
 * Langganan Web Push (PRD G5). Endpoint + kunci browser = rahasia: disimpan tersandi amplop
 * (`data`), dicari lewat hash endpoint. Tidak pernah dikirim balik ke peramban.
 */
export const langgananPush = pgTable(
  "langganan_push",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    perangkatId: uuid("perangkat_id").references(() => perangkatSiaga.id),
    endpointHash: char("endpoint_hash", { length: 64 }).notNull(),
    data: text("data").notNull(),
    terakhirBerhasil: waktu("terakhir_berhasil"),
    gagalBeruntun: integer("gagal_beruntun").notNull().default(0),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("langganan_push_unik").on(t.penggunaId, t.endpointHash)],
);

// ------------------------------------------------------------ rumah pintar Tuya (P7)

/**
 * Satu sambungan Tuya per pemilik (pola template). Kunci `sk-...` tersandi amplop (AAD terikat
 * pengguna), tidak pernah dikirim ke peramban. `darurat` = lapisan darurat tersembunyi (PRD I6):
 * telepon/SMS Tuya ke nomor akun sendiri bila belum bangun sesudah X menit. Mati bawaannya.
 */
export const sambunganTuya = pgTable("sambungan_tuya", {
  penggunaId: uuid("pengguna_id")
    .primaryKey()
    .references(() => pengguna.id),
  kunciSandi: text("kunci_sandi").notNull(),
  kunciSamar: text("kunci_samar").notNull(),
  wilayah: char("wilayah", { length: 2 }).notNull(),
  status: text("status").notNull().default("aktif"), // aktif | kunci_bermasalah
  statusPesan: text("status_pesan"),
  rumahUtamaId: text("rumah_utama_id"),
  struktur: jsonb("struktur"),
  strukturDiperbarui: waktu("struktur_diperbarui"),
  darurat: jsonb("darurat").$type<{ aktif: boolean; menit: number; cara: "telepon" | "sms" }>().notNull().default({ aktif: false, menit: 15, cara: "telepon" }),
  tersambungPada: waktu("tersambung_pada").notNull().defaultNow(),
  diperiksaPada: waktu("diperiksa_pada"),
  diubah: waktu("diubah").notNull().defaultNow(),
});

/** Cermin perangkat Tuya pemilik + keadaan terakhir (pola template `perangkat`). */
export const perangkatTuya = pgTable(
  "perangkat_tuya",
  {
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    deviceId: text("device_id").notNull(),
    homeId: text("home_id"),
    roomId: text("room_id"),
    nama: text("nama").notNull(),
    kategori: text("kategori").notNull(),
    kategoriNama: text("kategori_nama"),
    produkNama: text("produk_nama"),
    online: boolean("online").notNull().default(false),
    properti: jsonb("properti").$type<Record<string, unknown>>(),
    propertiDiperbarui: waktu("properti_diperbarui"),
    model: jsonb("model"),
    modelDiperbarui: waktu("model_diperbarui"),
    hilangPada: waktu("hilang_pada"),
    diubah: waktu("diubah").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("perangkat_tuya_unik").on(t.penggunaId, t.deviceId)],
);

/** Keadaan perangkat sebelum aksi alarm pertama per kejadian, untuk "kembalikan" sesudah bangun (PRD I3). */
export const potretTuya = pgTable(
  "potret_tuya",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    kejadianId: uuid("kejadian_id")
      .notNull()
      .references(() => kejadianAlarm.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    properti: jsonb("properti").$type<Record<string, unknown>>().notNull(),
    dipulihkan: waktu("dipulihkan"),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("potret_tuya_unik").on(t.kejadianId, t.deviceId)],
);

// ------------------------------------------------------------ MCP (P12)

/**
 * Idempotensi alat MCP yang membuat sesuatu (docs/11-ALAT-MCP.md): satu `client_ref` per panggilan.
 * Agen yang mengulang panggilan (jaringan putus) mendapat hasil yang sama, bukan alarm dobel.
 * `hasil` kosong = panggilan pertama masih berjalan. Dihapus worker sesudah 30 hari.
 */
export const idempotensiMcp = pgTable(
  "idempotensi_mcp",
  {
    penggunaId: uuid("pengguna_id")
      .notNull()
      .references(() => pengguna.id),
    alat: text("alat").notNull(),
    rujukan: text("rujukan").notNull(),
    hasil: jsonb("hasil").$type<{ data: Record<string, unknown>; teks: string }>(),
    dibuat: dibuat(),
  },
  (t) => [primaryKey({ columns: [t.penggunaId, t.alat, t.rujukan] }), index("idempotensi_mcp_dibuat_idx").on(t.dibuat)],
);
