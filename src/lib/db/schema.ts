import { bigserial, boolean, char, customType, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Skema AntiKebo. Nama tabel & kolom bahasa Indonesia snake_case, waktu timestamptz (UTC).
// Setiap tabel ber-`pengguna_id` milik pemilik WAJIB punya RLS ENABLE+FORCE + kebijakan
// di migrasi (dijaga scripts/jaga.mjs). Hanya skema di sini; SQL-nya di src/lib/db/migrasi.
// P0 = tabel dasar. Tabel alarm, kejadian, perangkat siaga, suara, kanal, Tuya menyusul (P2 sampai P7).

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
