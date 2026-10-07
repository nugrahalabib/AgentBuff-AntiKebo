import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { berkasKamusPc, kamusPc } from "@/lib/i18n/kamus-pc";

// Aplikasi PC memakai salinan kamus web (aturan teknis 8). Bila gagal: `pnpm exec tsx scripts/kamus-pc.ts`.
describe("kamus aplikasi PC", () => {
  it("salinan di pc/ui sama dengan kamus web", () => {
    const b = berkasKamusPc();
    const ui = join(process.cwd(), "pc", "ui");
    expect(readFileSync(join(ui, "kamus.js"), "utf8")).toBe(b.js);
    expect(readFileSync(join(ui, "kamus.json"), "utf8")).toBe(b.json);
  });

  it("id dan en punya kunci yang sama, tanpa tanda pisah panjang", () => {
    const k = kamusPc();
    const kunci = (o: unknown, awal = ""): string[] =>
      typeof o === "object" && o !== null && !Array.isArray(o) ? Object.entries(o).flatMap(([x, v]) => kunci(v, `${awal}${x}.`)) : [awal];
    expect(kunci(k.en)).toEqual(kunci(k.id));
    expect(JSON.stringify(k)).not.toMatch(/[–—]/);
  });
});
