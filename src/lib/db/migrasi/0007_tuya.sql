CREATE TABLE "perangkat_tuya" (
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
	"hilang_pada" timestamp with time zone,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "potret_tuya" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"kejadian_id" uuid NOT NULL,
	"device_id" text NOT NULL,
	"properti" jsonb NOT NULL,
	"dipulihkan" timestamp with time zone,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
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
	"darurat" jsonb DEFAULT '{"aktif":false,"menit":15,"cara":"telepon"}'::jsonb NOT NULL,
	"tersambung_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"diperiksa_pada" timestamp with time zone,
	"diubah" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "perangkat_tuya" ADD CONSTRAINT "perangkat_tuya_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "potret_tuya" ADD CONSTRAINT "potret_tuya_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "potret_tuya" ADD CONSTRAINT "potret_tuya_kejadian_id_kejadian_alarm_id_fk" FOREIGN KEY ("kejadian_id") REFERENCES "public"."kejadian_alarm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sambungan_tuya" ADD CONSTRAINT "sambungan_tuya_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "perangkat_tuya_unik" ON "perangkat_tuya" USING btree ("pengguna_id","device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "potret_tuya_unik" ON "potret_tuya" USING btree ("kejadian_id","device_id");--> statement-breakpoint
-- RLS tabel P7 (pola sama): web hanya pemilik konteks, worker (aksi alarm, darurat) semua pemilik.
ALTER TABLE sambungan_tuya ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sambungan_tuya FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sambungan_tuya_pemilik ON sambungan_tuya FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY sambungan_tuya_pekerja ON sambungan_tuya FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE perangkat_tuya ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE perangkat_tuya FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY perangkat_tuya_pemilik ON perangkat_tuya FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY perangkat_tuya_pekerja ON perangkat_tuya FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
ALTER TABLE potret_tuya ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE potret_tuya FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY potret_tuya_pemilik ON potret_tuya FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY potret_tuya_pekerja ON potret_tuya FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
