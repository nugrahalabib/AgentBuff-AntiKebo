CREATE TABLE "klip_suara" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"hash" char(64) NOT NULL,
	"audio" "bytea" NOT NULL,
	"mime" text NOT NULL,
	"durasi_ms" integer NOT NULL,
	"penyedia" text NOT NULL,
	"suara" text NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"dipakai_terakhir" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "naskah_suara" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"hash" char(64) NOT NULL,
	"teks" text NOT NULL,
	"bahasa" text NOT NULL,
	"suara_id" text,
	"gaya" text NOT NULL,
	"status" text DEFAULT 'menunggu' NOT NULL,
	"alasan" text,
	"percobaan" integer DEFAULT 0 NOT NULL,
	"coba_lagi_setelah" timestamp with time zone DEFAULT now() NOT NULL,
	"klip_id" uuid,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alarm" ADD COLUMN "kalimat_pribadi" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "klip_suara" ADD CONSTRAINT "klip_suara_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "naskah_suara" ADD CONSTRAINT "naskah_suara_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "klip_suara_unik" ON "klip_suara" USING btree ("pengguna_id","hash");--> statement-breakpoint
CREATE UNIQUE INDEX "naskah_suara_unik" ON "naskah_suara" USING btree ("pengguna_id","hash");--> statement-breakpoint
CREATE INDEX "naskah_suara_antre_idx" ON "naskah_suara" USING btree ("status","coba_lagi_setelah");--> statement-breakpoint
-- RLS tabel P5 (pola sama): web hanya pemilik konteks, worker suara melayani semua pemilik.
ALTER TABLE naskah_suara ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE naskah_suara FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY naskah_suara_pemilik ON naskah_suara FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY naskah_suara_pekerja ON naskah_suara FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE klip_suara ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE klip_suara FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY klip_suara_pemilik ON klip_suara FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY klip_suara_pekerja ON klip_suara FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
