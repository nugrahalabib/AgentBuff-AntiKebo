CREATE TABLE "alarm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"jam" text NOT NULL,
	"zona" text NOT NULL,
	"pengulangan" jsonb NOT NULL,
	"agenda_judul" text NOT NULL,
	"agenda_detail" text,
	"karakter" text NOT NULL,
	"suara_id" text,
	"bunyi" text NOT NULL,
	"soal" jsonb NOT NULL,
	"tunda" jsonb NOT NULL,
	"spam" jsonb NOT NULL,
	"tuya" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"komitmen" boolean DEFAULT false NOT NULL,
	"masih_bangun" jsonb NOT NULL,
	"libur_nasional" boolean DEFAULT false NOT NULL,
	"batas_menit" integer,
	"aktif" boolean DEFAULT true NOT NULL,
	"dari_template" text,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kejadian_alarm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"alarm_id" uuid,
	"jadwal_utc" timestamp with time zone NOT NULL,
	"tanggal_lokal" date NOT NULL,
	"jam_lokal" text NOT NULL,
	"judul" text NOT NULL,
	"status" text DEFAULT 'menunggu' NOT NULL,
	"uji" boolean DEFAULT false NOT NULL,
	"jumlah_tunda" integer DEFAULT 0 NOT NULL,
	"tunda_sampai" timestamp with time zone,
	"berbunyi_pada" timestamp with time zone,
	"bangun_pada" timestamp with time zone,
	"terlambat_dtk" integer,
	"isi" jsonb,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "langkah_kejadian" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"kejadian_id" uuid NOT NULL,
	"jenis" text NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"jatuh_tempo_utc" timestamp with time zone NOT NULL,
	"parameter" jsonb,
	"status" text DEFAULT 'menunggu' NOT NULL,
	"hasil" jsonb,
	"percobaan" integer DEFAULT 0 NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lewati_alarm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"alarm_id" uuid NOT NULL,
	"tanggal" date NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_alarm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"nama" text NOT NULL,
	"isi" jsonb NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pengguna" ADD COLUMN "nama_panggilan" text;--> statement-breakpoint
ALTER TABLE "pengguna" ADD COLUMN "jam_tidur" text DEFAULT '22:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "pengguna" ADD COLUMN "bawaan" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pengguna" ADD COLUMN "pengingat_malam" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "pengguna" ADD COLUMN "orientasi_selesai" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alarm" ADD CONSTRAINT "alarm_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kejadian_alarm" ADD CONSTRAINT "kejadian_alarm_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kejadian_alarm" ADD CONSTRAINT "kejadian_alarm_alarm_id_alarm_id_fk" FOREIGN KEY ("alarm_id") REFERENCES "public"."alarm"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "langkah_kejadian" ADD CONSTRAINT "langkah_kejadian_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "langkah_kejadian" ADD CONSTRAINT "langkah_kejadian_kejadian_id_kejadian_alarm_id_fk" FOREIGN KEY ("kejadian_id") REFERENCES "public"."kejadian_alarm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lewati_alarm" ADD CONSTRAINT "lewati_alarm_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lewati_alarm" ADD CONSTRAINT "lewati_alarm_alarm_id_alarm_id_fk" FOREIGN KEY ("alarm_id") REFERENCES "public"."alarm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_alarm" ADD CONSTRAINT "template_alarm_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alarm_pengguna_idx" ON "alarm" USING btree ("pengguna_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kejadian_menunggu_unik" ON "kejadian_alarm" USING btree ("alarm_id") WHERE status = 'menunggu' and not uji;--> statement-breakpoint
CREATE INDEX "kejadian_jadwal_idx" ON "kejadian_alarm" USING btree ("status","jadwal_utc");--> statement-breakpoint
CREATE INDEX "kejadian_pengguna_idx" ON "kejadian_alarm" USING btree ("pengguna_id","jadwal_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "langkah_kejadian_unik" ON "langkah_kejadian" USING btree ("kejadian_id","jenis","urutan");--> statement-breakpoint
CREATE INDEX "langkah_jatuh_tempo_idx" ON "langkah_kejadian" USING btree ("status","jatuh_tempo_utc");--> statement-breakpoint
CREATE UNIQUE INDEX "lewati_alarm_unik" ON "lewati_alarm" USING btree ("alarm_id","tanggal");--> statement-breakpoint
CREATE INDEX "lewati_alarm_pengguna_idx" ON "lewati_alarm" USING btree ("pengguna_id");--> statement-breakpoint
CREATE UNIQUE INDEX "template_alarm_nama_unik" ON "template_alarm" USING btree ("pengguna_id",lower("nama"));--> statement-breakpoint
-- RLS tabel P2 (pola 0001_rls.sql): web hanya pemilik konteks, worker melayani semua pemilik.
ALTER TABLE alarm ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE alarm FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY alarm_pemilik ON alarm FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY alarm_pekerja ON alarm FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE lewati_alarm ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE lewati_alarm FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY lewati_alarm_pemilik ON lewati_alarm FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY lewati_alarm_pekerja ON lewati_alarm FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE template_alarm ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE template_alarm FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY template_alarm_pemilik ON template_alarm FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY template_alarm_pekerja ON template_alarm FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE kejadian_alarm ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kejadian_alarm FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY kejadian_alarm_pemilik ON kejadian_alarm FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY kejadian_alarm_pekerja ON kejadian_alarm FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE langkah_kejadian ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE langkah_kejadian FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY langkah_kejadian_pemilik ON langkah_kejadian FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY langkah_kejadian_pekerja ON langkah_kejadian FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
