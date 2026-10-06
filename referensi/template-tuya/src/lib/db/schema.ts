import { sql } from "drizzle-orm";
import { bigserial, boolean, char, customType, index, integer, jsonb, pgTable, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Skema Tuya MCP. Nama tabel & kolom bahasa Indonesia snake_case.
// Setiap tabel ber-`pengguna_id` milik pemilik WAJIB punya RLS ENABLE+FORCE
// + kebijakan di migrasi (dijaga scripts/jaga.mjs). Hanya skema di sini.

const citext = customType<{ data: string }>({ dataType: () => "citext" });
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });
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
    locale: text("locale").notNull().default("id"),
    zonaWaktu: text("zona_waktu").notNull().default("Asia/Jakarta"),
    tema: text("tema").notNull().default("sistem"), // sistem | terang | gelap
    terakhirMasuk: waktu("terakhir_masuk"),
    dihapusPada: waktu("dihapus_pada"),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("pengguna_agentbuff_sub_unik").on(t.agentbuffSub)],
);

export const sesi = pgTable(
  "sesi",
  {
    idHash: char("id_hash", { length: 64 }).primaryKey(),
    penggunaId: uuid("pengguna_id").notNull().references(() => pengguna.id),
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

/** Hak pemakaian dari AgentBuff `/masuk/status` (cache 10 menit, toleransi saat tak terjangkau). */
export const statusHak = pgTable("status_hak", {
  penggunaId: uuid("pengguna_id").primaryKey().references(() => pengguna.id),
  aktif: boolean("aktif").notNull(),
  alasan: text("alasan").notNull(),
  pesan: text("pesan"),
  diperiksaPada: waktu("diperiksa_pada"),
  terakhirBaikPada: waktu("terakhir_baik_pada"),
  cobaLagiSetelah: waktu("coba_lagi_setelah"),
  gagalBeruntun: integer("gagal_beruntun").notNull().default(0),
});

export const jtiTerpakai = pgTable("jti_terpakai", {
  jti: text("jti").primaryKey(),
  kedaluwarsa: waktu("kedaluwarsa").notNull(),
});

export const tokenMcp = pgTable(
  "token_mcp",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id").notNull().references(() => pengguna.id),
    label: text("label").notNull(),
    hash: char("hash", { length: 64 }).notNull(), // sha256(token); token mentah tidak pernah disimpan
    awalan: char("awalan", { length: 9 }).notNull(), // "tuya_xxxx"
    sumber: text("sumber").notNull(), // manual | agentbuff_otomatis
    kedaluwarsa: waktu("kedaluwarsa"),
    terakhirDipakai: waktu("terakhir_dipakai"),
    dicabutPada: waktu("dicabut_pada"),
    dibuat: dibuat(),
  },
  (t) => [uniqueIndex("token_mcp_hash_unik").on(t.hash), index("token_mcp_pengguna_idx").on(t.penggunaId)],
);

/** Detak worker (jadwal, WebSocket, sinkron) - dibaca /api/health. Tanpa data pengguna. */
export const detakPekerja = pgTable("detak_pekerja", {
  nama: text("nama").primaryKey(),
  terakhir: waktu("terakhir").notNull(),
  catatan: text("catatan"),
});

// ------------------------------------------------------------ rumah

/**
 * Satu sambungan Tuya per pemilik. Kunci `sk-...` disimpan terenkripsi
 * (amplop AES-256-GCM, AAD terikat pengguna) dan TIDAK PERNAH dikirim ke peramban.
 */
export const sambunganTuya = pgTable("sambungan_tuya", {
  penggunaId: uuid("pengguna_id").primaryKey().references(() => pengguna.id),
  kunciSandi: text("kunci_sandi").notNull(),
  kunciSamar: text("kunci_samar").notNull(), // sk-SG••••7a2f (untuk tampilan)
  wilayah: char("wilayah", { length: 2 }).notNull(),
  status: text("status").notNull().default("aktif"), // aktif | kunci_bermasalah
  statusPesan: text("status_pesan"),
  rumahUtamaId: text("rumah_utama_id"),
  struktur: jsonb("struktur"), // rumah + ruangan terakhir dari Tuya
  strukturDiperbarui: waktu("struktur_diperbarui"),
  tersambungPada: waktu("tersambung_pada").notNull().defaultNow(),
  diperiksaPada: waktu("diperiksa_pada"),
  wsTersambungPada: waktu("ws_tersambung_pada"),
  diubah: waktu("diubah").notNull().defaultNow(),
});

/** Cermin perangkat dari Tuya + keadaan terakhir. Kunci = (pengguna, device_id). */
export const perangkat = pgTable(
  "perangkat",
  {
    penggunaId: uuid("pengguna_id").notNull().references(() => pengguna.id),
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
    sensitifManual: boolean("sensitif_manual"), // null = ikuti bawaan jenis
    disembunyikan: boolean("disembunyikan").notNull().default(false),
    urutan: integer("urutan").notNull().default(0),
    hilangPada: waktu("hilang_pada"), // tidak lagi muncul di akun Tuya
    /** AC lewat remote IR: kode pustaka yang dipilih pengguna + pemancar yang mengirimnya (lihat src/lib/ir/kode-ac.ts). */
    kodeIr: jsonb("kode_ir").$type<{ pustaka: string; merek: string; pemancar: string; dipasang: string; templat?: string }>(),
    diubah: waktu("diubah").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.penggunaId, t.deviceId] }), index("perangkat_rumah_idx").on(t.penggunaId, t.homeId, t.roomId)],
);

/** Suasana = kumpulan perintah perangkat. Disimpan di kita; API end-user Tuya tidak punya scene. */
export const suasana = pgTable(
  "suasana",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id").notNull().references(() => pengguna.id),
    nama: text("nama").notNull(),
    ikon: text("ikon").notNull().default("sparkles"),
    warna: text("warna").notNull().default("nila"),
    aksi: jsonb("aksi").$type<Array<{ deviceId: string; properti: Record<string, unknown> }>>().notNull(),
    urutan: integer("urutan").notNull().default(0),
    terakhirDipakai: waktu("terakhir_dipakai"),
    dibuat: dibuat(),
    diubah: waktu("diubah").notNull().defaultNow(),
  },
  (t) => [index("suasana_pengguna_idx").on(t.penggunaId)],
);

/**
 * Jadwal & timer. `jenis`: sekali | harian | mingguan. `waktuLokal` "HH:MM" pada
 * `zona`; `hari` 0=Minggu..6=Sabtu untuk mingguan. Worker mengklaim baris
 * `berikutnya <= now()` dengan FOR UPDATE SKIP LOCKED.
 */
export const jadwal = pgTable(
  "jadwal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id").notNull().references(() => pengguna.id),
    nama: text("nama").notNull(),
    jenis: text("jenis").notNull(),
    waktuLokal: char("waktu_lokal", { length: 5 }),
    hari: smallint("hari").array(),
    zona: text("zona").notNull().default("Asia/Jakarta"),
    // Perintah RAMAH disimpan (bukan properti mentah): diterjemahkan saat jalan,
    // jadi tetap benar walau model perangkat diperbarui Tuya.
    target: jsonb("target")
      .$type<{ jenis: "perangkat"; deviceId: string; perintah: Record<string, unknown>; ringkasan: string } | { jenis: "suasana"; suasanaId: string; ringkasan: string }>()
      .notNull(),
    aktif: boolean("aktif").notNull().default(true),
    berikutnya: waktu("berikutnya"),
    terakhirJalan: waktu("terakhir_jalan"),
    terakhirHasil: text("terakhir_hasil"), // ok | gagal: <alasan>
    dibuatOleh: text("dibuat_oleh").notNull(), // web | agen
    dibuat: dibuat(),
  },
  (t) => [index("jadwal_pengguna_idx").on(t.penggunaId), index("jadwal_berikutnya_idx").on(t.berikutnya).where(sql`aktif`)],
);

/**
 * Otomasi "kalau X maka Y": pemicu dari perubahan perangkat yang dikirim
 * WebSocket Tuya (worker), aksi = perintah ramah / suasana / notifikasi.
 * Ditembak hanya pada TEPI (syarat berubah salah -> benar) dan dibatasi jeda.
 */
export const otomasi = pgTable(
  "otomasi",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id").notNull().references(() => pengguna.id),
    nama: text("nama").notNull(),
    pemicu: jsonb("pemicu").$type<Record<string, unknown>>().notNull(),
    aksi: jsonb("aksi").$type<Array<Record<string, unknown>>>().notNull(),
    hanyaAntara: jsonb("hanya_antara").$type<{ mulai: string; akhir: string } | null>(),
    jedaMenit: integer("jeda_menit").notNull().default(5),
    aktif: boolean("aktif").notNull().default(true),
    terakhirJalan: waktu("terakhir_jalan"),
    terakhirHasil: text("terakhir_hasil"),
    dibuatOleh: text("dibuat_oleh").notNull(), // web | agen
    dibuat: dibuat(),
  },
  (t) => [index("otomasi_pengguna_idx").on(t.penggunaId)],
);

/**
 * Foto/klip kamera yang diambil lewat agen, app, atau otomasi. Tautan dari Tuya
 * hanya hidup beberapa menit, jadi isinya disalin ke sini selama 7 hari dan dibuka
 * lewat `kunci` acak (tautan rahasia, tanpa sesi) supaya bisa tampil sebagai gambar
 * di chat AgentBuff, Telegram, dan notifikasi. Dibersihkan worker sesudah kedaluwarsa.
 */
export const fotoKamera = pgTable(
  "foto_kamera",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    penggunaId: uuid("pengguna_id").notNull().references(() => pengguna.id),
    kunci: text("kunci").notNull(),
    deviceId: text("device_id").notNull(),
    namaPerangkat: text("nama_perangkat").notNull(),
    jenis: text("jenis").notNull(), // foto | video
    mime: text("mime").notNull(),
    isi: bytea("isi").notNull(),
    ukuran: integer("ukuran").notNull(),
    sumber: text("sumber").notNull(), // agen | web | otomasi
    otomasiId: uuid("otomasi_id"),
    catatan: text("catatan"),
    dibuat: dibuat(),
    kedaluwarsa: waktu("kedaluwarsa").notNull(),
  },
  (t) => [
    uniqueIndex("foto_kamera_kunci_unik").on(t.kunci),
    index("foto_kamera_pengguna_idx").on(t.penggunaId, t.dibuat),
    index("foto_kamera_kedaluwarsa_idx").on(t.kedaluwarsa),
  ],
);

/** Riwayat tindakan (siapa menyuruh apa) - untuk layar Aktivitas dan tool get_activity. */
export const aktivitas = pgTable(
  "aktivitas",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    penggunaId: uuid("pengguna_id").notNull().references(() => pengguna.id),
    sumber: text("sumber").notNull(), // web | agen | jadwal | suasana | otomasi | sistem
    jenis: text("jenis").notNull(), // kendali | suasana | jadwal | otomasi | sambungan | token | lainnya
    ringkasan: text("ringkasan").notNull(),
    deviceId: text("device_id"),
    detail: jsonb("detail"),
    berhasil: boolean("berhasil").notNull().default(true),
    galat: text("galat"),
    dibuat: dibuat(),
  },
  (t) => [index("aktivitas_pengguna_idx").on(t.penggunaId, t.dibuat)],
);
