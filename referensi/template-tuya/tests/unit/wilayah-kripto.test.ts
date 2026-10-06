import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { bukaRahasia, sandikanRahasia } from "@/lib/kripto";
import { GalatTuya, KlienTuya } from "@/lib/tuya/klien";
import { bacaKunci, samarkanKunci } from "@/lib/tuya/wilayah";

describe("bacaKunci", () => {
  it("mengenali wilayah dari prefiks dan membuang kutip/spasi", () => {
    const r = bacaKunci('  "sk-SGabc123def456ghi"  ');
    expect(r).toMatchObject({ ok: true, kunci: "sk-SGabc123def456ghi" });
    if (r.ok) expect(r.wilayah.rest).toBe("https://openapi-sg.iotbing.com");
    expect(bacaKunci("sk-azabcdefgh12").ok).toBe(true); // huruf kecil tetap dikenali
  });
  it("menolak yang bukan kunci / wilayah asing", () => {
    expect(bacaKunci("")).toEqual({ ok: false, alasan: "kosong" });
    expect(bacaKunci("abcdef")).toEqual({ ok: false, alasan: "bukan_kunci" });
    expect(bacaKunci("sk-ZZabcdefgh12")).toEqual({ ok: false, alasan: "wilayah_tak_dikenal" });
  });
  it("menyamarkan untuk tampilan", () => {
    expect(samarkanKunci("sk-SGabc123def456ghi7a2f")).toBe("sk-SG••••7a2f");
  });
});

describe("enkripsi rahasia", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEK = randomBytes(32).toString("base64");
  });
  it("bolak-balik dan terikat pemilik (AAD)", () => {
    const s = sandikanRahasia("sk-SGrahasia123456", "tuya:A");
    expect(s).not.toContain("rahasia");
    expect(bukaRahasia(s, "tuya:A")).toBe("sk-SGrahasia123456");
    expect(() => bukaRahasia(s, "tuya:B")).toThrow();
  });
  it("dua sandi untuk isi sama berbeda (IV acak)", () => {
    expect(sandikanRahasia("x", "a")).not.toBe(sandikanRahasia("x", "a"));
  });
});

describe("KlienTuya", () => {
  const jawab = (badan: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(badan), { status, headers: { "content-type": "application/json", ...headers } });

  it("memakai Bearer + basis wilayah dan mengirim properties sebagai STRING", async () => {
    const tercatat: { url: string; init: RequestInit }[] = [];
    const k = new KlienTuya("sk-AZabcdefgh123", {
      fetcher: (async (url: URL, init: RequestInit) => {
        tercatat.push({ url: String(url), init });
        return jawab({ success: true, result: {} });
      }) as unknown as typeof fetch,
    });
    await k.kirimProperti("dev1", { switch_led: true });
    expect(tercatat[0].url).toBe("https://openapi.tuyaus.com/v1.0/end-user/devices/dev1/shadow/properties/issue");
    expect((tercatat[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk-AZabcdefgh123");
    expect(JSON.parse(tercatat[0].init.body as string)).toEqual({ properties: '{"switch_led":true}' });
  });

  it("memetakan 1010 ke kunci_tidak_sah tanpa membocorkan kunci di pesan", async () => {
    const k = new KlienTuya("sk-AZabcdefgh123", { fetcher: (async () => jawab({ success: false, code: 1010, msg: "token invalid" })) as unknown as typeof fetch });
    const e = await k.rumah().catch((x) => x);
    expect(e).toBeInstanceOf(GalatTuya);
    expect(e.jenis).toBe("kunci_tidak_sah");
    expect(String(e.message)).not.toContain("sk-AZ");
  });

  it("mencoba ulang 429 lalu berhasil", async () => {
    let n = 0;
    const k = new KlienTuya("sk-AZabcdefgh123", {
      tidur: async () => {},
      fetcher: (async () => (++n < 2 ? jawab({}, 429, { "retry-after": "1" }) : jawab({ success: true, result: { homes: [{ home_id: "1", name: "Rumah" }] } }))) as unknown as typeof fetch,
    });
    expect(await k.rumah()).toEqual([{ home_id: "1", name: "Rumah" }]);
    expect(n).toBe(2);
  });

  it("model JSON string di-parse dua kali", async () => {
    const k = new KlienTuya("sk-AZabcdefgh123", {
      fetcher: (async () => jawab({ success: true, result: { model: '{"services":[{"properties":[{"code":"switch","accessMode":"rw","typeSpec":{"type":"bool"}}]}]}' } })) as unknown as typeof fetch,
    });
    expect((await k.model("d")).services?.[0].properties?.[0].code).toBe("switch");
  });
});
