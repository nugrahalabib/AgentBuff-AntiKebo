-- Isolasi data dua lapis. Lapis pertama = helper db (SET LOCAL app.pengguna_id),
-- lapis kedua = RLS di sini. Kunci rumah orang lain tidak boleh terbaca walau
-- satu kueri lupa WHERE.
--
--   * ENABLE + FORCE ROW LEVEL SECURITY (pemilik tabel pun terkena);
--   * konteks kosong -> NULL -> tidak ada baris. `nullif(..., '')` WAJIB: sesudah
--     SET LOCAL berakhir GUC kustom kembali ke '' (bukan NULL) dan ''::uuid
--     akan melempar galat alih-alih menolak diam-diam.
--   * tuya_worker (jadwal + WebSocket) melayani semua pemilik -> kebijakan
--     terpisah TO tuya_worker. Web (tuya_app) hanya melihat pemilik konteks.

CREATE OR REPLACE FUNCTION app_pengguna() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.pengguna_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_token_hash() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.token_hash', true), '') $$;
--> statement-breakpoint

ALTER TABLE token_mcp ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE token_mcp FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Satu baris boleh terbaca lewat hash token (otentikasi MCP sebelum pemilik diketahui).
CREATE POLICY token_mcp_baca ON token_mcp FOR SELECT TO tuya_app
  USING (pengguna_id = app_pengguna() OR hash = app_token_hash());
--> statement-breakpoint
CREATE POLICY token_mcp_tulis ON token_mcp FOR ALL TO tuya_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY token_mcp_pekerja ON token_mcp FOR ALL TO tuya_worker USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE sambungan_tuya ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sambungan_tuya FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sambungan_tuya_baca ON sambungan_tuya FOR SELECT TO tuya_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY sambungan_tuya_tulis ON sambungan_tuya FOR ALL TO tuya_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY sambungan_tuya_pekerja ON sambungan_tuya FOR ALL TO tuya_worker USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE perangkat ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE perangkat FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY perangkat_baca ON perangkat FOR SELECT TO tuya_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY perangkat_tulis ON perangkat FOR ALL TO tuya_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY perangkat_pekerja ON perangkat FOR ALL TO tuya_worker USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE suasana ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE suasana FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY suasana_baca ON suasana FOR SELECT TO tuya_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY suasana_tulis ON suasana FOR ALL TO tuya_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY suasana_pekerja ON suasana FOR ALL TO tuya_worker USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE jadwal ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE jadwal FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY jadwal_baca ON jadwal FOR SELECT TO tuya_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY jadwal_tulis ON jadwal FOR ALL TO tuya_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY jadwal_pekerja ON jadwal FOR ALL TO tuya_worker USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE aktivitas ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE aktivitas FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY aktivitas_baca ON aktivitas FOR SELECT TO tuya_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY aktivitas_tulis ON aktivitas FOR INSERT TO tuya_app WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY aktivitas_hapus ON aktivitas FOR DELETE TO tuya_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY aktivitas_pekerja ON aktivitas FOR ALL TO tuya_worker USING (true) WITH CHECK (true);
--> statement-breakpoint

-- Perubahan keadaan perangkat -> peramban (SSE). Muatan hanya id pengguna;
-- isi dibaca ulang lewat kueri ber-RLS, jadi NOTIFY tidak membocorkan apa pun.
CREATE OR REPLACE FUNCTION beri_tahu_perubahan() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('tuya_perubahan', coalesce(NEW.pengguna_id, OLD.pengguna_id)::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER perangkat_beri_tahu AFTER INSERT OR UPDATE OR DELETE ON perangkat
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
--> statement-breakpoint
CREATE TRIGGER sambungan_beri_tahu AFTER INSERT OR UPDATE OR DELETE ON sambungan_tuya
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
--> statement-breakpoint
CREATE TRIGGER suasana_beri_tahu AFTER INSERT OR UPDATE OR DELETE ON suasana
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
--> statement-breakpoint
CREATE TRIGGER jadwal_beri_tahu AFTER INSERT OR UPDATE OR DELETE ON jadwal
  FOR EACH ROW EXECUTE FUNCTION beri_tahu_perubahan();
