CREATE TABLE "otomasi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"pemicu" jsonb NOT NULL,
	"aksi" jsonb NOT NULL,
	"hanya_antara" jsonb,
	"jeda_menit" integer DEFAULT 5 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"terakhir_jalan" timestamp with time zone,
	"terakhir_hasil" text,
	"dibuat_oleh" text NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "otomasi" ADD CONSTRAINT "otomasi_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "otomasi_pengguna_idx" ON "otomasi" USING btree ("pengguna_id");--> statement-breakpoint
ALTER TABLE otomasi ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE otomasi FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY otomasi_baca ON otomasi FOR SELECT TO tuya_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY otomasi_tulis ON otomasi FOR ALL TO tuya_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY otomasi_pekerja ON otomasi FOR ALL TO tuya_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE TRIGGER otomasi_beri_tahu AFTER INSERT OR UPDATE OR DELETE ON otomasi
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
