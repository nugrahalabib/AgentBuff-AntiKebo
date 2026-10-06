CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TABLE "aktivitas" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"sumber" text NOT NULL,
	"jenis" text NOT NULL,
	"ringkasan" text NOT NULL,
	"device_id" text,
	"detail" jsonb,
	"berhasil" boolean DEFAULT true NOT NULL,
	"galat" text,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jadwal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"jenis" text NOT NULL,
	"waktu_lokal" char(5),
	"hari" smallint[],
	"zona" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"target" jsonb NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"berikutnya" timestamp with time zone,
	"terakhir_jalan" timestamp with time zone,
	"terakhir_hasil" text,
	"dibuat_oleh" text NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jti_terpakai" (
	"jti" text PRIMARY KEY NOT NULL,
	"kedaluwarsa" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pengguna" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agentbuff_sub" text NOT NULL,
	"email" "citext",
	"nama" text,
	"foto" text,
	"locale" text DEFAULT 'id' NOT NULL,
	"zona_waktu" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"tema" text DEFAULT 'sistem' NOT NULL,
	"terakhir_masuk" timestamp with time zone,
	"dihapus_pada" timestamp with time zone,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perangkat" (
	"pengguna_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"home_id" text,
	"room_id" text,
	"nama" text NOT NULL,
	"kategori" text NOT NULL,
	"kategori_nama" text,
	"produk_nama" text,
	"online" boolean DEFAULT false NOT NULL,
	"properti" jsonb,
	"properti_diperbarui" timestamp with time zone,
	"model" jsonb,
	"model_diperbarui" timestamp with time zone,
	"sensitif_manual" boolean,
	"disembunyikan" boolean DEFAULT false NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"hilang_pada" timestamp with time zone,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perangkat_pengguna_id_device_id_pk" PRIMARY KEY("pengguna_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "sambungan_tuya" (
	"pengguna_id" uuid PRIMARY KEY NOT NULL,
	"kunci_sandi" text NOT NULL,
	"kunci_samar" text NOT NULL,
	"wilayah" char(2) NOT NULL,
	"status" text DEFAULT 'aktif' NOT NULL,
	"status_pesan" text,
	"rumah_utama_id" text,
	"struktur" jsonb,
	"struktur_diperbarui" timestamp with time zone,
	"tersambung_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diperiksa_pada" timestamp with time zone,
	"ws_tersambung_pada" timestamp with time zone,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sesi" (
	"id_hash" char(64) PRIMARY KEY NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"terakhir_aktif" timestamp with time zone DEFAULT now() NOT NULL,
	"kedaluwarsa_diam" timestamp with time zone NOT NULL,
	"kedaluwarsa_mutlak" timestamp with time zone NOT NULL,
	"ip" text,
	"ua" text,
	"dicabut_pada" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "status_hak" (
	"pengguna_id" uuid PRIMARY KEY NOT NULL,
	"aktif" boolean NOT NULL,
	"alasan" text NOT NULL,
	"pesan" text,
	"diperiksa_pada" timestamp with time zone,
	"terakhir_baik_pada" timestamp with time zone,
	"coba_lagi_setelah" timestamp with time zone,
	"gagal_beruntun" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suasana" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"ikon" text DEFAULT 'sparkles' NOT NULL,
	"warna" text DEFAULT 'nila' NOT NULL,
	"aksi" jsonb NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"terakhir_dipakai" timestamp with time zone,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_mcp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"label" text NOT NULL,
	"hash" char(64) NOT NULL,
	"awalan" char(9) NOT NULL,
	"sumber" text NOT NULL,
	"kedaluwarsa" timestamp with time zone,
	"terakhir_dipakai" timestamp with time zone,
	"dicabut_pada" timestamp with time zone,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aktivitas" ADD CONSTRAINT "aktivitas_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jadwal" ADD CONSTRAINT "jadwal_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perangkat" ADD CONSTRAINT "perangkat_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sambungan_tuya" ADD CONSTRAINT "sambungan_tuya_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesi" ADD CONSTRAINT "sesi_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_hak" ADD CONSTRAINT "status_hak_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suasana" ADD CONSTRAINT "suasana_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_mcp" ADD CONSTRAINT "token_mcp_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aktivitas_pengguna_idx" ON "aktivitas" USING btree ("pengguna_id","dibuat");--> statement-breakpoint
CREATE INDEX "jadwal_pengguna_idx" ON "jadwal" USING btree ("pengguna_id");--> statement-breakpoint
CREATE INDEX "jadwal_berikutnya_idx" ON "jadwal" USING btree ("berikutnya") WHERE aktif;--> statement-breakpoint
CREATE UNIQUE INDEX "pengguna_agentbuff_sub_unik" ON "pengguna" USING btree ("agentbuff_sub");--> statement-breakpoint
CREATE INDEX "perangkat_rumah_idx" ON "perangkat" USING btree ("pengguna_id","home_id","room_id");--> statement-breakpoint
CREATE INDEX "sesi_pengguna_idx" ON "sesi" USING btree ("pengguna_id");--> statement-breakpoint
CREATE INDEX "suasana_pengguna_idx" ON "suasana" USING btree ("pengguna_id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_mcp_hash_unik" ON "token_mcp" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "token_mcp_pengguna_idx" ON "token_mcp" USING btree ("pengguna_id");