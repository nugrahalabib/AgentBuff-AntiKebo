import { z } from "zod";
import type { BarisToken } from "@/lib/agen/token";

export type KonteksAlat = { penggunaId: string; agentbuffSub: string; token: BarisToken; zona: string; asal: string };

export type HasilAlat = { data: Record<string, unknown>; teks: string };

export type DefinisiAlat<S extends z.ZodObject = z.ZodObject> = {
  nama: string;
  judul: string;
  /** baca = tidak mengubah apa pun; tulis = menyimpan atau mengubah sesuatu. */
  kelas: "baca" | "tulis";
  merusak?: boolean;
  deskripsi: string;
  masukan: S;
  jalankan(k: KonteksAlat, a: z.infer<S>): Promise<HasilAlat>;
};

export function alat<S extends z.ZodObject>(d: DefinisiAlat<S>): DefinisiAlat<S> {
  return d;
}

export function deskriptor(a: DefinisiAlat) {
  const js = z.toJSONSchema(a.masukan, { io: "input" }) as Record<string, unknown>;
  delete js.$schema;
  return {
    name: a.nama,
    title: a.judul,
    description: a.deskripsi,
    inputSchema: js as { type: "object"; [k: string]: unknown },
    annotations: { title: a.judul, readOnlyHint: a.kelas === "baca", destructiveHint: !!a.merusak, idempotentHint: a.kelas === "baca", openWorldHint: true },
  };
}
