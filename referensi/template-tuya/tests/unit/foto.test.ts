import { describe, expect, it } from "vitest";
import { jenisBerkas, markdownFoto, POLA_NAMA_FOTO, tautanPublik } from "@/lib/layanan/foto";

describe("foto kamera: jenis berkas dari isinya", () => {
  it("mengenali JPEG, PNG, WEBP, MP4; menolak HTML/teks", () => {
    expect(jenisBerkas(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(jenisBerkas(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(jenisBerkas(Buffer.from("RIFF0000WEBPVP8 "))).toBe("image/webp");
    expect(jenisBerkas(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom")]))).toBe("video/mp4");
    expect(jenisBerkas(Buffer.from("<html>bukan gambar</html>"))).toBeNull();
    expect(jenisBerkas(new Uint8Array())).toBeNull();
  });

  it("hanya mengambil tautan https publik (cegah SSRF)", () => {
    expect(tautanPublik("https://ty-us-storage.s3.amazonaws.com/a/0.jpg?x=1")).toBe(true);
    for (const u of ["http://contoh.com/a.jpg", "https://127.0.0.1/a.jpg", "https://localhost/a.jpg", "https://[::1]/a.jpg", "https://nas.local/a.jpg", "https://u:p@contoh.com/a.jpg", "file:///etc/passwd", "bukan url"]) {
      expect(tautanPublik(u), u).toBe(false);
    }
  });

  it("nama berkas publik ketat: 32 karakter acak + ekstensi dikenal", () => {
    expect(POLA_NAMA_FOTO.test(`${"a".repeat(32)}.jpg`)).toBe(true);
    expect(POLA_NAMA_FOTO.test(`${"a".repeat(32)}.mp4`)).toBe(true);
    for (const n of [`${"a".repeat(31)}.jpg`, `${"a".repeat(32)}.svg`, `../${"a".repeat(29)}.jpg`, `${"a".repeat(32)}.jpg.html`]) expect(POLA_NAMA_FOTO.test(n), n).toBe(false);
  });

  it("baris markdown: label foto/klip, kurung siku di nama dibuang", () => {
    expect(markdownFoto({ url: "https://x/a.jpg", jenis: "foto", perangkat: "CCTV [Garasi]" })).toBe("![Foto CCTV Garasi](https://x/a.jpg)");
    expect(markdownFoto({ url: "https://x/a.mp4", jenis: "video", perangkat: "Teras" })).toBe("![Klip Teras](https://x/a.mp4)");
  });
});
