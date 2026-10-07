import { describe, expect, it } from "vitest";
import { buatKlipTiruan } from "../tiruan/suara";

// Suara tiruan = MP3 buatan skrip: sah, deterministik, makin panjang teks makin panjang klip.

describe("suara tiruan", () => {
  it("MP3 sah, deterministik, durasi mengikuti teks dan gaya", async () => {
    const a = await buatKlipTiruan({ teks: "Bangun! Sudah jam lima.", suara: "id-ID-ArdiNeural", gaya: "galak", perempuan: false });
    const b = await buatKlipTiruan({ teks: "Bangun! Sudah jam lima.", suara: "id-ID-ArdiNeural", gaya: "galak", perempuan: false });
    expect(a.audio.equals(b.audio)).toBe(true);
    expect(a.audio[0]).toBe(0xff);
    expect(a.audio[1] & 0xe0).toBe(0xe0);
    const panjang = await buatKlipTiruan({ teks: "Bangun! ".repeat(12), suara: "id-ID-ArdiNeural", gaya: "galak", perempuan: false });
    expect(panjang.durasiMs).toBeGreaterThan(a.durasiMs);
    const biasa = await buatKlipTiruan({ teks: "Bangun! Sudah jam lima.", suara: "id-ID-ArdiNeural", gaya: "biasa", perempuan: false });
    expect(biasa.durasiMs).toBeGreaterThan(a.durasiMs); // gaya galak lebih cepat
    expect(panjang.durasiMs).toBeLessThanOrEqual(15_000);
  });
});
