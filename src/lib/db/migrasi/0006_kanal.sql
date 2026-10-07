CREATE TABLE "kiriman_kanal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"kejadian_id" uuid,
	"kanal_id" text NOT NULL,
	"platform" text,
	"jenis" text NOT NULL,
	"ke" integer,
	"status" text NOT NULL,
	"alasan" text,
	"id_kiriman" text,
	"kunci" text NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "langganan_push" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"perangkat_id" uuid,
	"endpoint_hash" char(64) NOT NULL,
	"data" text NOT NULL,
	"terakhir_berhasil" timestamp with time zone,
	"gagal_beruntun" integer DEFAULT 0 NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pengguna" ADD COLUMN "pengingat_terkirim" date;--> statement-breakpoint
ALTER TABLE "kiriman_kanal" ADD CONSTRAINT "kiriman_kanal_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kiriman_kanal" ADD CONSTRAINT "kiriman_kanal_kejadian_id_kejadian_alarm_id_fk" FOREIGN KEY ("kejadian_id") REFERENCES "public"."kejadian_alarm"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "langganan_push" ADD CONSTRAINT "langganan_push_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "langganan_push" ADD CONSTRAINT "langganan_push_perangkat_id_perangkat_siaga_id_fk" FOREIGN KEY ("perangkat_id") REFERENCES "public"."perangkat_siaga"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kiriman_kanal_unik" ON "kiriman_kanal" USING btree ("pengguna_id","kunci");--> statement-breakpoint
CREATE INDEX "kiriman_kanal_kejadian_idx" ON "kiriman_kanal" USING btree ("kejadian_id");--> statement-breakpoint
CREATE UNIQUE INDEX "langganan_push_unik" ON "langganan_push" USING btree ("pengguna_id","endpoint_hash");--> statement-breakpoint
-- RLS tabel P6 (pola sama): web hanya pemilik konteks, worker (spam, pengingat, push) semua pemilik.
ALTER TABLE kiriman_kanal ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE kiriman_kanal FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY kiriman_kanal_pemilik ON kiriman_kanal FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY kiriman_kanal_pekerja ON kiriman_kanal FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE langganan_push ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE langganan_push FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY langganan_push_pemilik ON langganan_push FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY langganan_push_pekerja ON langganan_push FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
