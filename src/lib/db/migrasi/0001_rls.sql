-- Isolasi data dua lapis. Lapis pertama = helper db (SET LOCAL app.pengguna_id),
-- lapis kedua = RLS di sini. Data milik orang lain tidak boleh terbaca walau
-- satu kueri lupa WHERE.
--
--   * ENABLE + FORCE ROW LEVEL SECURITY (pemilik tabel pun terkena);
--   * konteks kosong -> NULL -> tidak ada baris. `nullif(..., '')` WAJIB: sesudah
--     SET LOCAL berakhir GUC kustom kembali ke '' (bukan NULL) dan ''::uuid
--     akan melempar galat alih-alih menolak diam-diam.
--   * antikebo_worker (penjadwal, antrean, pembersihan) melayani semua pemilik ->
--     kebijakan terpisah TO antikebo_worker. Web (antikebo_app) hanya melihat pemilik konteks.
--   * Tabel global tanpa RLS: pengguna (dicari lewat sub saat masuk), sesi (lewat hash),
--     status_hak, jti_terpakai, detak_worker.

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
CREATE POLICY token_mcp_baca ON token_mcp FOR SELECT TO antikebo_app
  USING (pengguna_id = app_pengguna() OR hash = app_token_hash());
--> statement-breakpoint
CREATE POLICY token_mcp_tulis ON token_mcp FOR ALL TO antikebo_app
  USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY token_mcp_pekerja ON token_mcp FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
--> statement-breakpoint

ALTER TABLE audit ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY audit_baca ON audit FOR SELECT TO antikebo_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY audit_tulis ON audit FOR INSERT TO antikebo_app WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY audit_hapus ON audit FOR DELETE TO antikebo_app USING (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY audit_pekerja ON audit FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
