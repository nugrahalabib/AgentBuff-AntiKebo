ALTER TABLE "status_hak" ADD COLUMN "beku_sejak" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "status_hak" ADD COLUMN "beku_dikabari" timestamp with time zone;--> statement-breakpoint
-- Pemilik yang sudah beku sebelum kolom ini ada: tenggang dihitung dari pemeriksaan terakhir.
UPDATE "status_hak" SET "beku_sejak" = coalesce("diperiksa_pada", now()) WHERE "aktif" = false AND "beku_sejak" IS NULL;
