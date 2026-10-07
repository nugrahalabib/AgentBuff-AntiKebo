import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { KLIEN, siapkanTiruan } from "./lingkungan";

// Kontrak pintu AgentBuff (docs/05-INTEGRASI-AGENTBUFF.md §2, §4, §5) diuji LEWAT klien asli
// src/lib/agentbuff/pintu.ts terhadap server tiruan. Bila AgentBuff asli (paket L1) dibangun,
// tes yang sama menjadi acuan "AntiKebo lolos tes yang sama terhadap pintu asli".

let t: AgentBuffTiruan;
let jam = Date.parse("2026-10-07T21:00:00Z");
const SUB = "ab_kontrak_1";
const P = () => import("@/lib/agentbuff/pintu");

beforeAll(async () => {
  t = await siapkanTiruan({ sekarang: () => jam });
});
afterAll(async () => {
  await t?.tutup();
});
beforeEach(() => {
  t.keadaan.gangguan = false;
  t.atur(SUB, { hak: "ok", izin: { kabar: true, suara: true }, agenAktif: true, penyediaGagal: false, kuotaSuaraHarian: 300 });
});

const basic = (id = KLIEN.id, rahasia = KLIEN.rahasia) => `Basic ${Buffer.from(`${id}:${rahasia}`).toString("base64")}`;
async function mentah(jalur: string, badan: unknown, auth = basic()) {
  const r = await fetch(`${t.issuer}${jalur}`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: typeof badan === "string" ? badan : JSON.stringify(badan),
  });
  return { status: r.status, badan: (await r.json().catch(() => null)) as Record<string, unknown> | null };
}

describe("galat umum semua pintu", () => {
  for (const jalur of ["/kanal", "/kabar", "/suara/daftar", "/suara"]) {
    it(`${jalur}: 401 klien bila kredensial salah`, async () => {
      expect(await mentah(jalur, { sub: SUB }, basic(KLIEN.id, "salah"))).toEqual({ status: 401, badan: { alasan: "klien" } });
    });
    it(`${jalur}: 404 tidak_dikenal, 403 tidak_berhak, 403 belum_diizinkan`, async () => {
      expect((await mentah(jalur, { sub: "ab_asing" })).badan?.alasan).toBe("tidak_dikenal");
      t.atur(SUB, { hak: "akses_berakhir" });
      expect(await mentah(jalur, { sub: SUB })).toMatchObject({ status: 403, badan: { alasan: "tidak_berhak" } });
      t.atur(SUB, { hak: "ok", izin: { kabar: false, suara: false } });
      expect(await mentah(jalur, { sub: SUB })).toMatchObject({ status: 403, badan: { alasan: "belum_diizinkan" } });
    });
    it(`${jalur}: 400 permintaan_tidak_sah bila badan bukan objek JSON`, async () => {
      expect(await mentah(jalur, "bukan json")).toMatchObject({ status: 400, badan: { alasan: "permintaan_tidak_sah" } });
    });
  }

  it("klien tidak pernah melempar: AgentBuff mati = tidak_terjangkau", async () => {
    const { daftarKanal, kirimKabar } = await P();
    t.keadaan.gangguan = true;
    expect(await daftarKanal(SUB)).toMatchObject({ ok: false, alasan: "tidak_terjangkau", status: 503 });
    const asal = process.env.AGENTBUFF_TIRUAN_URL;
    process.env.AGENTBUFF_TIRUAN_URL = "http://127.0.0.1:9/masuk"; // port yang pasti menolak
    expect(await kirimKabar(SUB, { kanal: "k", teks: "a", kunci: "a" })).toMatchObject({ ok: false, alasan: "tidak_terjangkau", status: 0 });
    process.env.AGENTBUFF_TIRUAN_URL = asal;
  });
});

describe("§4.1 /masuk/kanal", () => {
  it("daftar kanal: platform, label, agen, siap + alasan", async () => {
    const { daftarKanal } = await P();
    const r = await daftarKanal(SUB);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.kanal.map((k) => k.platform)).toEqual(["telegram", "whatsapp", "discord"]);
    expect(r.kanal[1]).toMatchObject({ siap: false, alasan: expect.any(String) });
    expect(r.kanal.every((k) => k.id && k.label && k.agen)).toBe(true);
  });

  it("kanal berbentuk janggal (platform tak dikenal) dibuang klien, bukan menggagalkan", async () => {
    const { daftarKanal } = await P();
    t.atur(SUB, {
      kanal: [
        { id: "k1", platform: "telegram", label: "TG", agen: "Buff", siap: true },
        { id: "k2", platform: "line" as never, label: "LINE", agen: "Buff", siap: true },
      ],
    });
    const r = await daftarKanal(SUB);
    expect(r.ok && r.kanal.map((k) => k.id)).toEqual(["k1"]);
  });
});

describe("§4.2 /masuk/kabar", () => {
  it("kirim, idempoten 24 jam, jeda minimal per platform", async () => {
    const { daftarKanal, kirimKabar } = await P();
    const kanal = await daftarKanal(SUB);
    if (!kanal.ok) throw new Error("kanal gagal");
    const tg = kanal.kanal.find((k) => k.platform === "telegram")!;
    const awal = t.kiriman.length;

    const a = await kirimKabar(SUB, { kanal: tg.id, teks: "Bangun, Nugi! (1)", kunci: "kej_1:spam:1" });
    expect(a).toMatchObject({ ok: true, id: expect.stringMatching(/^msg_/) });
    const ulang = await kirimKabar(SUB, { kanal: tg.id, teks: "Bangun, Nugi! (1)", kunci: "kej_1:spam:1" });
    expect(ulang).toEqual(a);
    expect(t.kiriman.length).toBe(awal + 1);

    const cepat = await kirimKabar(SUB, { kanal: tg.id, teks: "Bangun! (2)", kunci: "kej_1:spam:2" });
    expect(cepat).toMatchObject({ ok: false, status: 429, alasan: "terlalu_cepat", ulangiSetelahMs: 5_000 });
    jam += 5_000;
    expect(await kirimKabar(SUB, { kanal: tg.id, teks: "Bangun! (2)", kunci: "kej_1:spam:2" })).toMatchObject({ ok: true });
    expect(t.kiriman.at(-1)).toMatchObject({ platform: "telegram", teks: "Bangun! (2)" });
  });

  it("WhatsApp 30 dtk, Discord 15 dtk", async () => {
    const { kirimKabar } = await P();
    const { JEDA_MINIMAL_MS } = await import("../tiruan/agentbuff");
    expect(JEDA_MINIMAL_MS).toMatchObject({ telegram: 5_000, discord: 15_000, slack: 15_000, google_chat: 15_000, whatsapp: 30_000 });
    t.atur(SUB, { kanal: [{ id: "k_dc", platform: "discord", label: "DC", agen: "Buff", siap: true }] });
    expect(await kirimKabar(SUB, { kanal: "k_dc", teks: "a", kunci: "dc1" })).toMatchObject({ ok: true });
    expect(await kirimKabar(SUB, { kanal: "k_dc", teks: "b", kunci: "dc2" })).toMatchObject({ ok: false, ulangiSetelahMs: 15_000 });
    jam += 15_000;
  });

  it("kanal tidak siap / hilang = 409 kanal_tidak_siap; agen mati = 503", async () => {
    const { kirimKabar } = await P();
    t.atur(SUB, { kanal: [{ id: "k_wa", platform: "whatsapp", label: "WA", agen: "Rani", siap: false, alasan: "Belum pernah ada chat" }] });
    expect(await kirimKabar(SUB, { kanal: "k_wa", teks: "a", kunci: "wa1" })).toMatchObject({ ok: false, status: 409, alasan: "kanal_tidak_siap", pesan: "Belum pernah ada chat" });
    expect(await kirimKabar(SUB, { kanal: "k_hilang", teks: "a", kunci: "x1" })).toMatchObject({ ok: false, status: 409, alasan: "kanal_tidak_siap" });
    t.atur(SUB, { agenAktif: false });
    expect(await kirimKabar(SUB, { kanal: "k_wa", teks: "a", kunci: "wa2" })).toMatchObject({ ok: false, status: 503, alasan: "agen_tidak_aktif" });
  });

  it("batas teks 1000 dan kunci 64: klien menolak sebelum mengirim, server juga", async () => {
    const { kirimKabar } = await P();
    expect(await kirimKabar(SUB, { kanal: "k", teks: "x".repeat(1001), kunci: "a" })).toMatchObject({ ok: false, status: 0, alasan: "teks_tidak_sah" });
    expect(await kirimKabar(SUB, { kanal: "k", teks: "a", kunci: "k".repeat(65) })).toMatchObject({ ok: false, alasan: "teks_tidak_sah" });
    expect(await mentah("/kabar", { sub: SUB, kanal: "k", teks: "x".repeat(1001), kunci: "a" })).toMatchObject({ status: 422, badan: { alasan: "teks_tidak_sah" } });
    expect(await mentah("/kabar", { sub: SUB, teks: "a" })).toMatchObject({ status: 400, badan: { alasan: "permintaan_tidak_sah" } });
  });
});

describe("§5 suara", () => {
  it("§5.1 daftar suara: penyedia, bawaan, suara per bahasa", async () => {
    const { daftarSuara } = await P();
    const id = await daftarSuara(SUB, "id");
    expect(id).toMatchObject({ ok: true, penyedia: "edge", bawaan: "id-ID-GadisNeural" });
    expect(id.ok && id.suara.map((s) => s.nama)).toEqual(["Gadis", "Ardi"]);
    const en = await daftarSuara(SUB, "en");
    expect(en.ok && en.bawaan).toBe("en-US-JennyNeural");
  });

  it("§5.2 buat suara: 200 audio/mpeg + header, MP3 sah, sama persis untuk isi sama", async () => {
    const { buatSuara } = await P();
    const a = await buatSuara(SUB, { teks: "Bangun, Nugi! Kasurnya nggak ke mana-mana.", gaya: "galak", suara: "id-ID-ArdiNeural", bahasa: "id" });
    expect(a).toMatchObject({ ok: true, mime: "audio/mpeg", penyedia: "edge", suara: "id-ID-ArdiNeural" });
    if (!a.ok) return;
    expect(a.durasiMs).toBeGreaterThan(500);
    expect(a.audio[0]).toBe(0xff);
    expect(a.audio[1] & 0xe0).toBe(0xe0); // sinkron bingkai MPEG
    const b = await buatSuara(SUB, { teks: "Bangun, Nugi! Kasurnya nggak ke mana-mana.", gaya: "galak", suara: "id-ID-ArdiNeural", bahasa: "id" });
    expect(b.ok && b.audio.equals(a.audio)).toBe(true);
    const bawaan = await buatSuara(SUB, { teks: "Halo", gaya: "biasa", suara: "suara-tak-ada", bahasa: "id" });
    expect(bawaan.ok && bawaan.suara).toBe("id-ID-GadisNeural");
  });

  it("teks > 300 = 422 teks_tidak_sah; kuota harian = 429 sampai tengah malam WIB; penyedia gagal = 502", async () => {
    const { buatSuara } = await P();
    expect(await mentah("/suara", { sub: SUB, teks: "x".repeat(301), gaya: "galak", bahasa: "id" })).toMatchObject({ status: 422, badan: { alasan: "teks_tidak_sah" } });
    expect(await buatSuara(SUB, { teks: "x".repeat(301), gaya: "galak", bahasa: "id" })).toMatchObject({ ok: false, alasan: "teks_tidak_sah" });
    expect(await mentah("/suara", { sub: SUB, teks: "a", gaya: "marah", bahasa: "id" })).toMatchObject({ status: 400, badan: { alasan: "permintaan_tidak_sah" } });

    t.atur(SUB, { kuotaSuaraHarian: 0 });
    const kuota = await buatSuara(SUB, { teks: "Bangun", gaya: "galak", bahasa: "id" });
    // jam uji 2026-10-07T21:00Z = 04.00 WIB tanggal 8; tengah malam WIB berikutnya 20 jam lagi.
    expect(kuota).toMatchObject({ ok: false, status: 429, alasan: "kuota", ulangiSetelahMs: 20 * 3600_000 - (jam - Date.parse("2026-10-07T21:00:00Z")) });

    t.atur(SUB, { kuotaSuaraHarian: 300, penyediaGagal: true });
    expect(await buatSuara(SUB, { teks: "Bangun", gaya: "galak", bahasa: "id" })).toMatchObject({ ok: false, status: 502, alasan: "penyedia_gagal", pesan: expect.any(String) });
  });
});

describe("§2 /masuk/status (cek hak)", () => {
  it("form (seperti klien template) dan JSON; alasan sesuai kontrak", async () => {
    const f = await fetch(`${t.issuer}/status`, { method: "POST", headers: { Authorization: basic(), "Content-Type": "application/x-www-form-urlencoded" }, body: `sub=${SUB}` });
    expect(await f.json()).toEqual({ aktif: true, alasan: "ok", pesan: "", sub: SUB });
    t.atur(SUB, { hak: "belum_beli" });
    expect((await mentah("/status", { sub: SUB })).badan).toMatchObject({ aktif: false, alasan: "belum_beli" });
    expect((await mentah("/status", { sub: "ab_asing" })).badan).toMatchObject({ aktif: false, alasan: "tidak_dikenal" });
    expect((await mentah("/status", { sub: SUB }, basic(KLIEN.id, "salah"))).status).toBe(401);
  });
});
