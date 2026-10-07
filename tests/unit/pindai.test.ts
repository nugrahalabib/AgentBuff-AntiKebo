import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { bacaQrPiksel } from "@/lib/soal/pindai";

// Misi QR: kode yang DICETAK aplikasi (qrcode) terbaca oleh pembaca cadangan (jsQR) yang dipakai
// peramban tanpa BarcodeDetector. Gambar dibuat dari matriks modul QR, termasuk versi terbalik
// warnanya dan versi kecil.

function gambar(teks: string, skala: number, balik = false) {
  const qr = QRCode.create(teks, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const tepi = 4;
  const w = (n + tepi * 2) * skala;
  const data = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++)
    for (let x = 0; x < w; x++) {
      const mx = Math.floor(x / skala) - tepi;
      const my = Math.floor(y / skala) - tepi;
      const gelap = mx >= 0 && my >= 0 && mx < n && my < n && qr.modules.get(my, mx) === 1;
      const v = gelap !== balik ? 0 : 255;
      const i = (y * w + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  return { data, width: w, height: w };
}

describe("pindai Misi QR", () => {
  const ISI = "antikebo-qr:Q2vV3k0kq7m2b5X1rJm0Bg";

  it("kode cetakan terbaca utuh", () => {
    expect(bacaQrPiksel(gambar(ISI, 6))).toBe(ISI);
  });

  it("kode kecil dan warna terbalik (layar gelap) tetap terbaca", () => {
    expect(bacaQrPiksel(gambar(ISI, 3))).toBe(ISI);
    expect(bacaQrPiksel(gambar(ISI, 5, true))).toBe(ISI);
  });

  it("gambar tanpa kode = null", () => {
    const w = 120;
    expect(bacaQrPiksel({ data: new Uint8ClampedArray(w * w * 4).fill(255), width: w, height: w })).toBeNull();
  });
});
