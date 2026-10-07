CREATE EXTENSION IF NOT EXISTS citext;
--> statement-breakpoint
CREATE TABLE "audit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"sumber" text NOT NULL,
	"jenis" text NOT NULL,
	"ringkasan" text NOT NULL,
	"detail" jsonb,
	"berhasil" boolean DEFAULT true NOT NULL,
	"galat" text,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detak_worker" (
	"nama" text PRIMARY KEY NOT NULL,
	"terakhir" timestamp with time zone NOT NULL,
	"catatan" text
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
	"bahasa" text DEFAULT 'id' NOT NULL,
	"zona_waktu" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"tema" text DEFAULT 'sistem' NOT NULL,
	"izin_kabar" boolean DEFAULT false NOT NULL,
	"izin_suara" boolean DEFAULT false NOT NULL,
	"izin_diperbarui" timestamp with time zone,
	"terakhir_masuk" timestamp with time zone,
	"dihapus_pada" timestamp with time zone,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "token_mcp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"label" text NOT NULL,
	"hash" char(64) NOT NULL,
	"awalan" char(13) NOT NULL,
	"sumber" text NOT NULL,
	"kedaluwarsa" timestamp with time zone,
	"terakhir_dipakai" timestamp with time zone,
	"dicabut_pada" timestamp with time zone,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit" ADD CONSTRAINT "audit_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesi" ADD CONSTRAINT "sesi_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_hak" ADD CONSTRAINT "status_hak_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_mcp" ADD CONSTRAINT "token_mcp_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_pengguna_idx" ON "audit" USING btree ("pengguna_id","dibuat");--> statement-breakpoint
CREATE UNIQUE INDEX "pengguna_agentbuff_sub_unik" ON "pengguna" USING btree ("agentbuff_sub");--> statement-breakpoint
CREATE INDEX "sesi_pengguna_idx" ON "sesi" USING btree ("pengguna_id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_mcp_hash_unik" ON "token_mcp" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "token_mcp_pengguna_idx" ON "token_mcp" USING btree ("pengguna_id");