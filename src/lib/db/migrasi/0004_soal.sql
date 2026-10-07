CREATE TABLE "kode_qr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"isi_hash" char(64) NOT NULL,
	"isi_tersandi" text NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "soal_kejadian" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"kejadian_id" uuid NOT NULL,
	"tujuan" text NOT NULL,
	"jenis" text NOT NULL,
	"tingkat" text NOT NULL,
	"target" integer NOT NULL,
	"tahap" integer DEFAULT 0 NOT NULL,
	"tampil" jsonb NOT NULL,
	"hash_jawaban" char(64),
	"garam" text NOT NULL,
	"kode_qr" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benar_beruntun" integer DEFAULT 0 NOT NULL,
	"salah_beruntun" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'aktif' NOT NULL,
	"dijawab_pada" timestamp with time zone,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kejadian_alarm" ADD COLUMN "cek_pada" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kejadian_alarm" ADD COLUMN "cek_batas" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kejadian_alarm" ADD COLUMN "tanpa_tunda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "kejadian_alarm" ADD COLUMN "selesai_oleh" text;--> statement-breakpoint
ALTER TABLE "kejadian_alarm" ADD COLUMN "perangkat_selesai" uuid;--> statement-breakpoint
ALTER TABLE "kode_qr" ADD CONSTRAINT "kode_qr_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soal_kejadian" ADD CONSTRAINT "soal_kejadian_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "soal_kejadian" ADD CONSTRAINT "soal_kejadian_kejadian_id_kejadian_alarm_id_fk" FOREIGN KEY ("kejadian_id") REFERENCES "public"."kejadian_alarm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kode_qr_hash_unik" ON "kode_qr" USING btree ("isi_hash");--> statement-breakpoint
CREATE INDEX "kode_qr_pengguna_idx" ON "kode_qr" USING btree ("pengguna_id");--> statement-breakpoint
CREATE INDEX "soal_kejadian_idx" ON "soal_kejadian" USING btree ("kejadian_id","tujuan","status");--> statement-breakpoint
CREATE UNIQUE INDEX "soal_aktif_unik" ON "soal_kejadian" USING btree ("kejadian_id","tujuan") WHERE status = 'aktif';--> statement-breakpoint
-- RLS tabel P4. soal_kejadian hanya dibaca layanan jawab (sesi pemilik atau token perangkatnya);
-- worker boleh semua (riwayat, pembersihan).
ALTER TABLE soal_kejadian ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE soal_kejadian FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY soal_kejadian_pemilik ON soal_kejadian FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY soal_kejadian_pekerja ON soal_kejadian FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE kode_qr ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kode_qr FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY kode_qr_pemilik ON kode_qr FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY kode_qr_pekerja ON kode_qr FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
