import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { arahkanDbAplikasi, buatPengguna, siapkanBasisData, type Ujian } from "./harness";
import { JPEG_UJI, MP4_UJI, mulaiTuyaTiruan, type Tiruan } from "./tuya-tiruan";

// Foto/klip kamera: disalin dari awan Tuya ke penyimpanan 7 hari, dibuka lewat
// tautan rahasia (tanpa sesi), dipakai agen, app, dan otomasi.

let u: Ujian;
let tuya: Tiruan;
let A: string;
let B: string;

beforeAll(async () => {
  process.env.ENCRYPTION_KEK = randomBytes(32).toString("base64");
  process.env.APP_ORIGIN = "https://tuya.contoh";
  tuya = await mulaiTuyaTiruan();
  process.env.TUYA_BASIS_UJI = tuya.url;
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
  A = await buatPengguna(u, "Pemilik Kamera");
  B = await buatPengguna(u, "Orang Lain");
  const { simpanKunci } = await import("@/lib/layanan/sambungan");
  await simpanKunci(A, "sk-AZujiKunciFotoKamera12");
}, 60_000);

afterAll(async () => {
  await tuya?.tutup();
});

const konteks = async (pemilik = A) => {
  const [token] = await u.superuser.insert(schema.tokenMcp).values({ penggunaId: pemilik, label: "uji", hash: randomBytes(32).toString("hex"), awalan: "tuya_ujif", sumber: "manual" }).returning();
  return { penggunaId: pemilik, token, zona: "Asia/Jakarta", asal: "https://tuya.contoh" };
};

/** Panggil rute publik /api/foto/[nama] apa adanya. */
async function buka(url: string, header: Record<string, string> = {}) {
  const { GET } = await import("@/app/api/foto/[nama]/route");
  const nama = url.split("/").pop()!;
  return GET(new Request(`https://tuya.contoh/api/foto/${nama}`, { headers: header }), { params: Promise.resolve({ nama }) });
}

const URL_FOTO = /^https:\/\/tuya\.contoh\/api\/foto\/[A-Za-z0-9_-]{32}\.(jpg|mp4)$/;

describe("foto kamera tersimpan 7 hari", () => {
  it("capture_camera lewat agen: foto disalin, baris markdown siap tampil, tautan publik menyajikan isinya", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    tuya.tangkapanBelumSiap.sisa = 0;
    const a = cariAlat("capture_camera")!;
    const r = await a.jalankan(await konteks(), a.masukan.parse({ device: "CCTV Garasi" }));
    const d = r.data as { url: string; markdown: string; image_url: string; expires_at: string; source: string };
    expect(d.url).toMatch(URL_FOTO);
    expect(d.image_url).toBe(d.url);
    expect(d.markdown).toBe(`![Foto CCTV Garasi](${d.url})`);
    expect(d.source).toBe("agen");
    expect(r.teks).toContain(d.markdown);
    const sisaHari = (new Date(d.expires_at).getTime() - Date.now()) / 86_400_000;
    expect(sisaHari).toBeGreaterThan(6.9);
    expect(sisaHari).toBeLessThanOrEqual(7);

    const res = await buka(d.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toMatch(/^private/);
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(Buffer.from(await res.arrayBuffer()).equals(JPEG_UJI)).toBe(true);
  }, 30_000);

  it("klip video disalin sebagai mp4 dan bisa diputar per potongan (Range)", async () => {
    const { tangkapKamera } = await import("@/lib/layanan/ekstra");
    tuya.tangkapanBelumSiap.sisa = 0;
    const h = await tangkapKamera(A, "CCTV Garasi", "video", 3, async () => {}, "web");
    expect(h.tersimpan?.jenis).toBe("video");
    expect(h.tersimpan?.url).toMatch(/\.mp4$/);
    expect(h.tersimpan?.jalur.startsWith("/api/foto/")).toBe(true);
    const penuh = await buka(h.tersimpan!.url);
    expect(penuh.headers.get("content-type")).toBe("video/mp4");
    expect(Buffer.from(await penuh.arrayBuffer()).equals(MP4_UJI)).toBe(true);
    const potong = await buka(h.tersimpan!.url, { range: "bytes=4-11" });
    expect(potong.status).toBe(206);
    expect(potong.headers.get("content-range")).toBe(`bytes 4-11/${MP4_UJI.length}`);
    expect(Buffer.from(await potong.arrayBuffer()).toString()).toBe("ftypisom");
  }, 30_000);

  it("awan menyajikan isi yang bukan gambar: tidak disimpan, agen diberi tautan Tuya + keterangan jujur", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    tuya.tangkapanBelumSiap.sisa = 0;
    tuya.awanRusak.aktif = true;
    try {
      const a = cariAlat("capture_camera")!;
      const r = await a.jalankan(await konteks(), a.masukan.parse({ device: "CCTV Garasi" }));
      expect((r.data as { stored: boolean }).stored).toBe(false);
      expect(r.teks).toContain("tidak bisa disimpan");
      expect(r.teks).not.toContain("![");
    } finally {
      tuya.awanRusak.aktif = false;
    }
  }, 30_000);

  it("list_camera_photos: terbaru dulu, dengan markdown; pemilik lain tidak melihatnya", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const l = cariAlat("list_camera_photos")!;
    const r = await l.jalankan(await konteks(), l.masukan.parse({ device: "CCTV Garasi" }));
    const fotos = (r.data as { photos: Array<{ kind: string; markdown: string; source: string }> }).photos;
    expect(fotos.length).toBe(2);
    expect(fotos[0].kind).toBe("video");
    expect(fotos[1].kind).toBe("photo");
    expect(r.teks).toContain(fotos[1].markdown);
    const { daftarFoto } = await import("@/lib/layanan/foto");
    expect(await daftarFoto(B)).toHaveLength(0);
  });

  it("tautan: kunci salah 404, sesudah kedaluwarsa 404, lalu dibersihkan worker", async () => {
    const { daftarFoto, hapusFotoKedaluwarsa } = await import("@/lib/layanan/foto");
    const [f] = await daftarFoto(A, { batas: 1 });
    const palsu = f.url.replace(/[A-Za-z0-9_-]{32}(?=\.)/, "a".repeat(32));
    expect((await buka(palsu)).status).toBe(404);
    expect((await buka("https://tuya.contoh/api/foto/../../etc.jpg")).status).toBe(404);
    await u.superuser.update(schema.fotoKamera).set({ kedaluwarsa: new Date(Date.now() - 60_000) }).where(eq(schema.fotoKamera.id, f.id));
    expect((await buka(f.url)).status).toBe(404);
    expect(await hapusFotoKedaluwarsa()).toBe(1);
    const [{ n }] = (await u.superuser.execute(sql`select count(*)::int as n from foto_kamera where id = ${f.id}`)).rows as Array<{ n: number }>;
    expect(n).toBe(0);
  });
});

describe("otomasi: ambil foto saat kejadian lalu kirim", () => {
  const pintu = (buka: boolean) => ({ online: true, properti: { doorcontact_state: buka, battery_percentage: 80 } });

  it("pintu terbuka -> foto CCTV disimpan + tautannya dikirim ke app Smart Life", async () => {
    const { cariAlat } = await import("@/lib/mcp/alat");
    const { evaluasiPerubahan, daftarOtomasi } = await import("@/lib/layanan/otomasi");
    const { daftarFoto } = await import("@/lib/layanan/foto");
    tuya.tangkapanBelumSiap.sisa = 0;
    const c = cariAlat("create_automation")!;
    const r = await c.jalankan(await konteks(), c.masukan.parse({ when: { device: "Sensor Pintu", event: "door_opened" }, then: [{ camera_photo: "CCTV Garasi" }] }));
    expect(r.teks).toContain("ambil foto CCTV Garasi lalu kirim ke app Smart Life");
    expect((r.data as { cooldown_minutes: number }).cooldown_minutes).toBe(10);

    const n = tuya.pesan.length;
    expect(await evaluasiPerubahan(A, "pintu1", pintu(false), pintu(true))).toBe(1);
    const push = tuya.pesan.slice(n).find((p) => p.jalur === "/v1.0/end-user/services/push/self-send");
    expect(push?.badan.subject).toBe("Foto CCTV Garasi");
    expect(String(push?.badan.content)).toMatch(/Sensor Pintu terbuka\. Lihat foto \(tersimpan 7 hari\): https:\/\/tuya\.contoh\/api\/foto\/[A-Za-z0-9_-]{32}\.jpg/);

    const [f] = await daftarFoto(A, { sumber: "otomasi" });
    expect(f.catatan).toBe("Sensor Pintu terbuka");
    expect(String(push?.badan.content)).toContain(f.url);
    expect((await buka(f.url)).status).toBe(200);
    const [o] = (await daftarOtomasi(A)).filter((x) => x.nama.includes("Sensor Pintu"));
    expect(o.terakhirHasil).toBe("ok");
  }, 30_000);

  it("kirim lewat email / hanya simpan; kamera wajib kamera", async () => {
    const { buatOtomasi, evaluasiPerubahan, hapusOtomasi, daftarOtomasi } = await import("@/lib/layanan/otomasi");
    for (const o of await daftarOtomasi(A)) await hapusOtomasi(A, o.id, "web");
    tuya.tangkapanBelumSiap.sisa = 0;
    await buatOtomasi(A, { pemicu: { perangkat: "Sensor Pintu", jenis: "pintu_terbuka" }, aksi: [{ foto: { perangkat: "CCTV Garasi", kirim: "email" } }] }, "agen");
    const n = tuya.pesan.length;
    await evaluasiPerubahan(A, "pintu1", pintu(false), pintu(true));
    expect(tuya.pesan.slice(n).map((p) => p.jalur)).toEqual(["/v1.0/end-user/services/mail/self-send"]);

    for (const o of await daftarOtomasi(A)) await hapusOtomasi(A, o.id, "web");
    const s = await buatOtomasi(A, { pemicu: { perangkat: "Sensor Pintu", jenis: "pintu_terbuka" }, aksi: [{ foto: { perangkat: "CCTV Garasi", kirim: "simpan" } }], jedaMenit: 1 }, "agen");
    expect(s.jedaMenit).toBe(2); // foto butuh ~30 dtk unggah: jeda minimal 2 menit
    const m = tuya.pesan.length;
    await evaluasiPerubahan(A, "pintu1", pintu(false), pintu(true));
    expect(tuya.pesan.length).toBe(m);

    await expect(buatOtomasi(A, { pemicu: { perangkat: "Sensor Pintu", jenis: "pintu_terbuka" }, aksi: [{ foto: { perangkat: "Lampu Meja" } }] }, "agen")).rejects.toMatchObject({ kode: "tidak_didukung" });
  }, 60_000);

  it("kamera offline saat kejadian: aksi lain tetap jalan, hasil otomasi menyebut kegagalannya", async () => {
    const { buatOtomasi, evaluasiPerubahan, hapusOtomasi, daftarOtomasi } = await import("@/lib/layanan/otomasi");
    for (const o of await daftarOtomasi(A)) await hapusOtomasi(A, o.id, "web");
    await buatOtomasi(
      A,
      { pemicu: { perangkat: "Sensor Pintu", jenis: "pintu_terbuka" }, aksi: [{ foto: { perangkat: "CCTV Garasi" } }, { notifikasi: { judul: "Pintu", isi: "Pintu terbuka" } }] },
      "agen",
    );
    await u.superuser.update(schema.perangkat).set({ online: false }).where(eq(schema.perangkat.deviceId, "cctv1"));
    try {
      const n = tuya.pesan.length;
      await evaluasiPerubahan(A, "pintu1", pintu(false), pintu(true));
      expect(tuya.pesan.slice(n).map((p) => p.badan.subject)).toEqual(["Pintu"]);
      const [o] = await daftarOtomasi(A);
      expect(o.terakhirHasil).toContain("offline");
    } finally {
      await u.superuser.update(schema.perangkat).set({ online: true }).where(eq(schema.perangkat.deviceId, "cctv1"));
    }
  }, 30_000);
});
