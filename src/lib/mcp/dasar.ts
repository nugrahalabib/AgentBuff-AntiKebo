import { z } from "zod";
import type { BarisToken } from "@/lib/agen/token";
import type { Bahasa, Kamus } from "@/lib/i18n";

/** Konteks satu panggilan alat: pemilik token, zona + bahasa + kamus pengguna (teks jawaban), asal web. */
export type KonteksAlat = { penggunaId: string; agentbuffSub: string; token: BarisToken; zona: string; asal: string; bahasa: Bahasa; t: Kamus };

export type HasilAlat = { data: Record<string, unknown>; teks: string };

export type DefinisiAlat<S extends z.ZodObject = z.ZodObject> = {
  nama: string;
  judul: string;
  /** baca = tidak mengubah apa pun; tulis = menyimpan atau mengubah sesuatu. */
  kelas: "baca" | "tulis";
  merusak?: boolean;
  /**
   * Alat yang membuat sesuatu menerima `client_ref` (opsional): panggilan ulang dengan rujukan sama
   * mengembalikan hasil pertama, tidak membuat dobel (disimpan 30 hari, `idempotensi_mcp`).
   */
  idempoten?: boolean;
  deskripsi: string;
  masukan: S;
  jalankan(k: KonteksAlat, a: z.infer<S>): Promise<HasilAlat>;
};

export function alat<S extends z.ZodObject>(d: DefinisiAlat<S>): DefinisiAlat<S> {
  return d;
}

const SkemaRujukan = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._:-]+$/)
  .describe("Optional idempotency key, unique per intended action. Retrying with the same client_ref returns the first result instead of creating a duplicate.");

/** Skema masukan yang diumumkan dan diperiksa (alat idempoten mendapat `client_ref`). */
export function skemaMasukan(a: DefinisiAlat): z.ZodObject {
  return a.idempoten ? a.masukan.extend({ client_ref: SkemaRujukan.optional() }) : a.masukan;
}

export function deskriptor(a: DefinisiAlat) {
  const js = z.toJSONSchema(skemaMasukan(a), { io: "input" }) as Record<string, unknown>;
  delete js.$schema;
  return {
    name: a.nama,
    title: a.judul,
    description: a.deskripsi,
    inputSchema: js as { type: "object"; [k: string]: unknown },
    annotations: { title: a.judul, readOnlyHint: a.kelas === "baca", destructiveHint: !!a.merusak, idempotentHint: a.kelas === "baca" || !!a.idempoten, openWorldHint: true },
  };
}
