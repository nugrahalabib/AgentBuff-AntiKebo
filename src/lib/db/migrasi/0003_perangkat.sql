CREATE TABLE "kode_sambung" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kode_hash" char(64) NOT NULL,
	"rahasia_hash" char(64) NOT NULL,
	"nama_perangkat" text NOT NULL,
	"versi_aplikasi" text,
	"status" text DEFAULT 'menunggu' NOT NULL,
	"pengguna_id" uuid,
	"perangkat_id" uuid,
	"kedaluwarsa" timestamp with time zone NOT NULL,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perangkat_siaga" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pengguna_id" uuid NOT NULL,
	"jenis" text NOT NULL,
	"nama" text NOT NULL,
	"token_hash" char(64),
	"versi_aplikasi" text,
	"terakhir_terlihat" timestamp with time zone,
	"kemampuan" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"siap_sampai" timestamp with time zone,
	"dicabut_pada" timestamp with time zone,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kode_sambung" ADD CONSTRAINT "kode_sambung_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kode_sambung" ADD CONSTRAINT "kode_sambung_perangkat_id_perangkat_siaga_id_fk" FOREIGN KEY ("perangkat_id") REFERENCES "public"."perangkat_siaga"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perangkat_siaga" ADD CONSTRAINT "perangkat_siaga_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kode_sambung_hash_unik" ON "kode_sambung" USING btree ("kode_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "perangkat_token_unik" ON "perangkat_siaga" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "perangkat_pengguna_idx" ON "perangkat_siaga" USING btree ("pengguna_id");--> statement-breakpoint
-- RLS perangkat siaga (pola token_mcp): pemilik konteks, atau SATU baris lewat hash token perangkat
-- (otentikasi aplikasi PC sebelum pemilik diketahui). kode_sambung sengaja global (seperti sesi):
-- hanya berisi hash, dicari sebelum pemilik diketahui.
ALTER TABLE perangkat_siaga ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE perangkat_siaga FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY perangkat_siaga_baca ON perangkat_siaga FOR SELECT TO antikebo_app
  USING (pengguna_id = app_pengguna() OR token_hash = app_token_hash());
--> statement-breakpoint
CREATE POLICY perangkat_siaga_tulis ON perangkat_siaga FOR ALL TO antikebo_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY perangkat_siaga_pekerja ON perangkat_siaga FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint
-- Peristiwa waktu nyata (arsitektur §5) lewat satu kanal NOTIFY `antikebo_peristiwa`. Muatan hanya
-- id (pengguna, jenis, kejadian, perangkat): isi dibaca ulang lewat kueri ber-RLS, jadi NOTIFY
-- tidak membocorkan apa pun. Dipicu di DB supaya setiap jalur (web, worker, MCP) pasti mengabari.
CREATE OR REPLACE FUNCTION kabar_kejadian() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  jenis text;
  baris kejadian_alarm;
BEGIN
  IF TG_OP = 'DELETE' THEN
    baris := OLD;
    IF OLD.status = 'menunggu' THEN jenis := 'jadwal'; END IF;
  ELSIF TG_OP = 'INSERT' THEN
    baris := NEW;
    jenis := CASE NEW.status WHEN 'menunggu' THEN 'jadwal' WHEN 'berbunyi' THEN 'berbunyi' ELSE NULL END;
  ELSE
    baris := NEW;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      jenis := CASE
        WHEN NEW.status = 'berbunyi' THEN 'berbunyi'
        WHEN NEW.status = 'ditunda' THEN 'tunda'
        WHEN NEW.status = 'cek_bangun' THEN 'cek'
        WHEN OLD.status IN ('berbunyi', 'ditunda', 'cek_bangun') THEN 'berhenti'
        WHEN OLD.status = 'menunggu' THEN 'jadwal'
        ELSE NULL END;
    ELSIF NEW.status = 'menunggu' AND (NEW.jadwal_utc IS DISTINCT FROM OLD.jadwal_utc OR NEW.judul IS DISTINCT FROM OLD.judul) THEN
      jenis := 'jadwal';
    END IF;
  END IF;
  IF jenis IS NOT NULL THEN
    PERFORM pg_notify('antikebo_peristiwa', json_build_object('p', baris.pengguna_id, 'j', jenis, 'k', baris.id)::text);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER kejadian_alarm_kabar AFTER INSERT OR UPDATE OR DELETE ON kejadian_alarm
  FOR EACH ROW EXECUTE FUNCTION kabar_kejadian();
--> statement-breakpoint
-- Isi alarm berubah (bunyi, karakter, soal, ...) = salinan jadwal di perangkat basi.
CREATE OR REPLACE FUNCTION kabar_alarm() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('antikebo_peristiwa', json_build_object('p', coalesce(NEW.pengguna_id, OLD.pengguna_id), 'j', 'jadwal')::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER alarm_kabar AFTER INSERT OR UPDATE OR DELETE ON alarm
  FOR EACH ROW EXECUTE FUNCTION kabar_alarm();
--> statement-breakpoint
-- Perangkat dicabut atau dinamai ulang: aliran SSE perangkat itu ditutup, daftar perangkat dimuat ulang.
CREATE OR REPLACE FUNCTION kabar_perangkat() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.dicabut_pada IS DISTINCT FROM OLD.dicabut_pada OR NEW.nama IS DISTINCT FROM OLD.nama THEN
    PERFORM pg_notify('antikebo_peristiwa', json_build_object('p', NEW.pengguna_id, 'j', CASE WHEN NEW.dicabut_pada IS NOT NULL THEN 'cabut' ELSE 'perangkat' END, 'd', NEW.id)::text);
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER perangkat_siaga_kabar AFTER INSERT OR UPDATE ON perangkat_siaga
  FOR EACH ROW EXECUTE FUNCTION kabar_perangkat();
