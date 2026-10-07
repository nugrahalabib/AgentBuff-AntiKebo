import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { akhirTenggang, alarmDitahan, bekuSejakBaru, TENGGANG_BEKU_MS, type StatusBeku } from "@/lib/agentbuff/aturan-beku";

// Contoh emas aturan beku K-07 (tests/emas/beku.json).

type StatusJson = { aktif: boolean; bekuSejak: string | null } | null;
const emas = JSON.parse(readFileSync(path.resolve(__dirname, "../emas/beku.json"), "utf8")) as {
  tenggangJam: number;
  kasus: Array<{ nama: string; status: StatusJson; jadwal: string; ditahan: boolean; akhir: string | null }>;
  transisi: Array<{ nama: string; lama: StatusJson; aktifSekarang: boolean; sekarang: string; hasil: string | null }>;
};

const status = (s: StatusJson): StatusBeku | null => (s ? { aktif: s.aktif, bekuSejak: s.bekuSejak ? new Date(s.bekuSejak) : null } : null);

describe("aturan beku (contoh emas)", () => {
  it("tenggang sesuai berkas emas", () => {
    expect(TENGGANG_BEKU_MS).toBe(emas.tenggangJam * 3_600_000);
  });

  it.each(emas.kasus)("$nama", (k) => {
    expect(alarmDitahan(status(k.status), new Date(k.jadwal))).toBe(k.ditahan);
    expect(akhirTenggang(status(k.status))?.toISOString() ?? null).toBe(k.akhir);
  });

  it.each(emas.transisi)("$nama", (k) => {
    expect(bekuSejakBaru(status(k.lama), k.aktifSekarang, new Date(k.sekarang))?.toISOString() ?? null).toBe(k.hasil);
  });
});
