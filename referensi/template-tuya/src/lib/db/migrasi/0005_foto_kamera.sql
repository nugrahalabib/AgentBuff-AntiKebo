CREATE TABLE "foto_kamera" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"kunci" text NOT NULL,
	"device_id" text NOT NULL,
	"nama_perangkat" text NOT NULL,
	"jenis" text NOT NULL,
	"mime" text NOT NULL,
	"isi" "bytea" NOT NULL,
	"ukuran" integer NOT NULL,
	"sumber" text NOT NULL,
	"otomasi_id" uuid,
	"catatan" text,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"kedaluwarsa" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "foto_kamera" ADD CONSTRAINT "foto_kamera_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "foto_kamera_kunci_unik" ON "foto_kamera" USING btree ("kunci");--> statement-breakpoint
CREATE INDEX "foto_kamera_pengguna_idx" ON "foto_kamera" USING btree ("pengguna_id","dibuat");--> statement-breakpoint
CREATE INDEX "foto_kamera_kedaluwarsa_idx" ON "foto_kamera" USING btree ("kedaluwarsa");--> statement-breakpoint
-- Tautan foto publik: konteks `app.foto_kunci` membuat SATU baris terlihat tanpa sesi
-- (pola yang sama dengan app.token_hash untuk otentikasi MCP).
CREATE OR REPLACE FUNCTION app_foto_kunci() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.foto_kunci', true), '') $$;
--> statement-breakpoint
ALTER TABLE foto_kamera ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE foto_kamera FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY foto_kamera_baca ON foto_kamera FOR SELECT TO tuya_app
  USING (pengguna_id = app_pengguna() OR kunci = app_foto_kunci());
--> statement-breakpoint
CREATE POLICY foto_kamera_tulis ON foto_kamera FOR ALL TO tuya_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY foto_kamera_pekerja ON foto_kamera FOR ALL TO tuya_worker USING (true) WITH CHECK (true);
