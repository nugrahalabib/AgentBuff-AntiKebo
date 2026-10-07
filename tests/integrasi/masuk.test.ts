import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { arahkanDbAplikasi, siapkanBasisData, type Ujian } from "./harness";
import { ASAL_APP, siapkanTiruan } from "./lingkungan";

// Masuk dengan AgentBuff (OIDC sungguhan: discovery, PKCE S256, id_token ES256 lewat JWKS,
// iss di jawaban otorisasi) + izin kabar/suara + cek hak (singgahan, toleransi 72 jam, K-12),
// memakai modul aplikasi asli terhadap server tiruan dan Postgres PGlite.

let t: AgentBuffTiruan;
let u: Ujian;
const NUGI = "ab_tiruan_nugi";
const O = () => import("@/lib/agentbuff/oidc");
const H = () => import("@/lib/agentbuff/status");

beforeAll(async () => {
  t = await siapkanTiruan();
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
}, 60_000);
afterAll(async () => {
  await t?.tutup();
});
beforeEach(async () => {
  t.keadaan.scopeTambahan = true;
  t.keadaan.gangguan = false;
  t.atur(NUGI, { hak: "ok", izin: { kabar: true, suara: true } });
  (await O()).lupakanKonfigurasi();
});

/** Peramban tiruan: buka URL otorisasi, pilih akun + izin di layar AgentBuff tiruan, kembalikan URL callback. */
async function setujui(urlOtorisasi: string, isi: { sub: string; kabar?: boolean; suara?: boolean; aksi?: string }): Promise<URL> {
  const q = new URL(urlOtorisasi).searchParams;
  const f = new URLSearchParams(q);
  f.set("sub", isi.sub);
  f.set("aksi", isi.aksi ?? "izinkan");
  if (isi.kabar ?? true) f.set("izin_kabar", "1");
  if (isi.suara ?? true) f.set("izin_suara", "1");
  const r = await fetch(`${t.issuer}/authorize`, { method: "POST", body: f, redirect: "manual" });
  expect(r.status).toBe(303);
  return new URL(r.headers.get("location")!);
}

async function bukaCookie(cookie: string) {
  const { bacaCookieOidc } = await O();
  const isi = bacaCookieOidc(cookie);
  expect(isi).not.toBeNull();
  return isi!;
}

describe("Masuk dengan AgentBuff", () => {
  it("URL otorisasi: scope dengan izin kabar/suara, PKCE S256, state, nonce; lanjut hanya /app", async () => {
    const { mulaiMasuk, jalurLanjutAman } = await O();
    const { url, cookie } = await mulaiMasuk({ senyap: false, lanjut: "//jahat.example/app" });
    const q = new URL(url).searchParams;
    expect(url.startsWith(`${t.issuer}/authorize?`)).toBe(true);
    expect(q.get("scope")).toBe("openid email profile agentbuff:kabar agentbuff:suara");
    expect(q.get("code_challenge_method")).toBe("S256");
    expect(q.get("redirect_uri")).toBe(`${ASAL_APP}/auth/agentbuff/callback`);
    expect(q.get("state")).toBeTruthy();
    expect(q.get("nonce")).toBeTruthy();
    const isi = await bukaCookie(cookie);
    expect(isi.lanjut).toBe("/app");
    expect(createHash("sha256").update(isi.verifier).digest("base64url")).toBe(q.get("code_challenge"));
    expect(jalurLanjutAman("/app/pengaturan")).toBe("/app/pengaturan");
    expect(jalurLanjutAman("https://jahat.example")).toBe("/app");
    expect(jalurLanjutAman("/app\\..\\x")).toBe("/app");
    expect(jalurLanjutAman("/sambung-pc?kode=ABCD-EFGH")).toBe("/sambung-pc?kode=ABCD-EFGH");
    expect(jalurLanjutAman("/appjahat")).toBe("/app");
    expect(jalurLanjutAman("/sambung-pcx")).toBe("/app");
    const izin = new URL((await mulaiMasuk({ senyap: false, lanjut: null, mintaIzin: true })).url).searchParams;
    expect(izin.get("prompt")).toBe("consent");
    const senyap = new URL((await mulaiMasuk({ senyap: true, lanjut: null })).url).searchParams;
    expect(senyap.get("prompt")).toBe("none");
  });

  it("tukar kode: klaim + izin dari scope jawaban token", async () => {
    const { mulaiMasuk, selesaikanMasuk } = await O();
    const { url, cookie } = await mulaiMasuk({ senyap: false, lanjut: "/app" });
    const balik = await setujui(url, { sub: NUGI });
    const h = await selesaikanMasuk(balik, await bukaCookie(cookie));
    expect(h).toEqual({ jenis: "ok", klaim: { sub: NUGI, email: "nugi@contoh.id", nama: "Nugi Pratama", foto: null }, izin: { kabar: true, suara: true } });
  });

  it("izin ditolak di layar persetujuan: masuk tetap jalan, izin tercatat false", async () => {
    const { mulaiMasuk, selesaikanMasuk } = await O();
    const { url, cookie } = await mulaiMasuk({ senyap: false, lanjut: "/app" });
    const h = await selesaikanMasuk(await setujui(url, { sub: NUGI, kabar: false, suara: true }), await bukaCookie(cookie));
    expect(h).toMatchObject({ jenis: "ok", izin: { kabar: false, suara: true } });
  });

  it("kode sekali pakai, state palsu ditolak", async () => {
    const { mulaiMasuk, selesaikanMasuk } = await O();
    const { url, cookie } = await mulaiMasuk({ senyap: false, lanjut: "/app" });
    const balik = await setujui(url, { sub: NUGI });
    const isi = await bukaCookie(cookie);
    expect((await selesaikanMasuk(balik, isi)).jenis).toBe("ok");
    expect(await selesaikanMasuk(balik, isi)).toMatchObject({ jenis: "galat" });
    const lain = await mulaiMasuk({ senyap: false, lanjut: "/app" });
    const balikLain = await setujui(lain.url, { sub: NUGI });
    expect((await selesaikanMasuk(balikLain, isi)).jenis).toBe("galat");
  });

  it("belum beli / dibatalkan: ditolak dengan alasan dari AgentBuff", async () => {
    const { mulaiMasuk, selesaikanMasuk } = await O();
    const a = await mulaiMasuk({ senyap: false, lanjut: "/app" });
    expect(await selesaikanMasuk(await setujui(a.url, { sub: "ab_tiruan_rani" }), await bukaCookie(a.cookie))).toEqual({ jenis: "ditolak", alasan: "belum_beli" });
    const b = await mulaiMasuk({ senyap: false, lanjut: "/app" });
    expect(await selesaikanMasuk(await setujui(b.url, { sub: NUGI, aksi: "batal" }), await bukaCookie(b.cookie))).toEqual({ jenis: "ditolak", alasan: "dibatalkan" });
  });

  it("masuk senyap tanpa sesi AgentBuff: perlu_interaktif", async () => {
    const { mulaiMasuk, selesaikanMasuk } = await O();
    const { url, cookie } = await mulaiMasuk({ senyap: true, lanjut: "/app" });
    const r = await fetch(url, { redirect: "manual" });
    expect(await selesaikanMasuk(new URL(r.headers.get("location")!), await bukaCookie(cookie))).toEqual({ jenis: "perlu_interaktif" });
  });

  it("AgentBuff belum mengenal izin kabar/suara: invalid_scope, lalu cakupan dasar berhasil tanpa izin", async () => {
    const { mulaiMasuk, selesaikanMasuk } = await O();
    t.keadaan.scopeTambahan = false;
    const a = await mulaiMasuk({ senyap: false, lanjut: "/app" });
    const r = await fetch(a.url, { redirect: "manual" });
    expect(await selesaikanMasuk(new URL(r.headers.get("location")!), await bukaCookie(a.cookie))).toEqual({ jenis: "cakupan_ditolak" });
    const b = await mulaiMasuk({ senyap: false, lanjut: "/app", cakupan: "dasar" });
    expect(new URL(b.url).searchParams.get("scope")).toBe("openid email profile");
    expect(await selesaikanMasuk(await setujui(b.url, { sub: NUGI }), await bukaCookie(b.cookie))).toMatchObject({ jenis: "ok", izin: { kabar: false, suara: false } });
  });

  it("tafsir izin: scope kosong = sama dengan permintaan (RFC 6749 §5.1)", async () => {
    const { tafsirIzin } = await O();
    expect(tafsirIzin(undefined, "penuh")).toEqual({ kabar: true, suara: true });
    expect(tafsirIzin(undefined, "dasar")).toEqual({ kabar: false, suara: false });
    expect(tafsirIzin("openid agentbuff:suara", "penuh")).toEqual({ kabar: false, suara: true });
  });
});

describe("cek hak (K-12)", () => {
  async function penggunaBaru(sub: string) {
    const [p] = await u.superuser.insert(schema.pengguna).values({ agentbuffSub: sub }).returning();
    return { id: p.id, agentbuffSub: sub };
  }

  it("aktif lalu dicabut: ketat langsung beku, singgahan 10 menit tanpa ketat", async () => {
    const { cekHak } = await H();
    const p = await penggunaBaru("ab_hak_1");
    t.atur("ab_hak_1", { hak: "ok" });
    expect(await cekHak(p, { ketat: true })).toMatchObject({ aktif: true, alasan: "ok" });
    t.atur("ab_hak_1", { hak: "akses_berakhir" });
    expect(await cekHak(p)).toMatchObject({ aktif: true }); // masih singgahan
    expect(await cekHak(p, { ketat: true })).toMatchObject({ aktif: false, alasan: "akses_berakhir" });
  });

  it("AgentBuff gangguan: jawaban baik terakhir dipakai (spanduk), lewat 72 jam beku netral", async () => {
    const { cekHak } = await H();
    const p = await penggunaBaru("ab_hak_2");
    t.atur("ab_hak_2", { hak: "ok" });
    expect(await cekHak(p, { ketat: true })).toMatchObject({ aktif: true });
    t.keadaan.gangguan = true;
    expect(await cekHak(p, { ketat: true })).toEqual({ aktif: true, alasan: "ok", pesan: null, tidakTerjangkau: true });
    await u.superuser
      .update(schema.statusHak)
      .set({ terakhirBaikPada: new Date(Date.now() - 73 * 3600_000), cobaLagiSetelah: null })
      .where(eq(schema.statusHak.penggunaId, p.id));
    expect(await cekHak(p, { ketat: true })).toMatchObject({ aktif: false, alasan: "tidak_terjangkau" });
  });

  it("pengguna baru saat AgentBuff mati: tidak diberi akses (tidak ada jawaban baik sebelumnya)", async () => {
    const { cekHak } = await H();
    t.keadaan.gangguan = true;
    expect(await cekHak(await penggunaBaru("ab_hak_3"), { ketat: true })).toMatchObject({ aktif: false, alasan: "tidak_terjangkau" });
  });
});
