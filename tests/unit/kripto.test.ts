import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { acakBase64Url, bukaRahasia, bukaSegel, samaWaktuTetap, sandikanRahasia, segel, sha256Hex } from "@/lib/kripto";

beforeAll(() => {
  process.env.SESSION_SECRET = randomBytes(32).toString("hex");
  process.env.ENCRYPTION_KEK = randomBytes(32).toString("base64");
});

describe("segel (cookie sementara OIDC)", () => {
  it("pulang-pergi, info lain gagal, isi diubah gagal", () => {
    const s = segel({ state: "abc", n: 1 }, "oidc-v1");
    expect(bukaSegel(s, "oidc-v1")).toEqual({ state: "abc", n: 1 });
    expect(bukaSegel(s, "lain")).toBeNull();
    const rusak = Buffer.from(s, "base64url");
    rusak[rusak.length - 1] ^= 1;
    expect(bukaSegel(rusak.toString("base64url"), "oidc-v1")).toBeNull();
    expect(bukaSegel("pendek", "oidc-v1")).toBeNull();
  });
});

describe("enkripsi amplop rahasia di kolom", () => {
  it("awalan AK1, terikat pemilik lewat AAD, tidak memuat teks asli", () => {
    const sandi = sandikanRahasia("kunci-palsu-rahasiaUji123", "tuya:pengguna-a");
    expect(Buffer.from(sandi, "base64url").subarray(0, 3).toString()).toBe("AK1");
    expect(sandi).not.toContain("rahasiaUji");
    expect(bukaRahasia(sandi, "tuya:pengguna-a")).toBe("kunci-palsu-rahasiaUji123");
    expect(() => bukaRahasia(sandi, "tuya:pengguna-b")).toThrow();
    expect(sandikanRahasia("x", "a")).not.toBe(sandikanRahasia("x", "a")); // IV/DEK acak
  });

  it("KEK salah panjang ditolak", () => {
    const asal = process.env.ENCRYPTION_KEK;
    process.env.ENCRYPTION_KEK = Buffer.alloc(16).toString("base64");
    expect(() => sandikanRahasia("x", "a")).toThrow(/32 byte/);
    process.env.ENCRYPTION_KEK = asal;
  });
});

describe("pembantu", () => {
  it("sha256Hex, acakBase64Url, samaWaktuTetap", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(acakBase64Url(32)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(samaWaktuTetap("a", "a")).toBe(true);
    expect(samaWaktuTetap("a", "b")).toBe(false);
    expect(samaWaktuTetap("a", "aa")).toBe(false);
  });
});
