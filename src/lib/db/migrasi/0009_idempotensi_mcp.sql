CREATE TABLE "idempotensi_mcp" (
	"pengguna_id" uuid NOT NULL,
	"alat" text NOT NULL,
	"rujukan" text NOT NULL,
	"hasil" jsonb,
	"dibuat" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotensi_mcp_pengguna_id_alat_rujukan_pk" PRIMARY KEY("pengguna_id","alat","rujukan")
);
--> statement-breakpoint
ALTER TABLE "idempotensi_mcp" ADD CONSTRAINT "idempotensi_mcp_pengguna_id_pengguna_id_fk" FOREIGN KEY ("pengguna_id") REFERENCES "public"."pengguna"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idempotensi_mcp_dibuat_idx" ON "idempotensi_mcp" USING btree ("dibuat");--> statement-breakpoint
ALTER TABLE idempotensi_mcp ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE idempotensi_mcp FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY idempotensi_mcp_pemilik ON idempotensi_mcp FOR ALL TO antikebo_app USING (pengguna_id = app_pengguna()) WITH CHECK (pengguna_id = app_pengguna());
--> statement-breakpoint
CREATE POLICY idempotensi_mcp_pekerja ON idempotensi_mcp FOR ALL TO antikebo_worker USING (true) WITH CHECK (true);
