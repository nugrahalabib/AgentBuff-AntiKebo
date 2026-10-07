import jsQR from "jsqr";

/**
 * Pembaca kode QR di peramban (Misi QR, PRD D4). `BarcodeDetector` bila peramban punya (Chrome
 * Android), selain itu jsQR dari bingkai video. Hanya membaca isi; pemeriksaannya di server
 * (hash). Dipakai layar alarm (P8) dan Jam Meja (P9).
 */

export type Gambar = { data: Uint8ClampedArray; width: number; height: number };

/** Baca QR dari piksel RGBA (cadangan tanpa BarcodeDetector, juga dipakai uji). */
export function bacaQrPiksel(g: Gambar): string | null {
  const r = jsQR(g.data, g.width, g.height, { inversionAttempts: "attemptBoth" });
  return r?.data || null;
}

type Pendeteksi = { detect(sumber: CanvasImageSource): Promise<Array<{ rawValue: string }>> };

/** Baca QR dari bingkai video kamera sekarang. Null bila belum terlihat kode. */
export async function bacaQrVideo(video: HTMLVideoElement, kanvas: HTMLCanvasElement): Promise<string | null> {
  const BD = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Pendeteksi }).BarcodeDetector;
  if (BD) {
    try {
      const [h] = await new BD({ formats: ["qr_code"] }).detect(video);
      if (h?.rawValue) return h.rawValue;
    } catch {
      /* jatuh ke jsQR */
    }
  }
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  kanvas.width = w;
  kanvas.height = h;
  const ctx = kanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, w, h);
  return bacaQrPiksel(ctx.getImageData(0, 0, w, h));
}
