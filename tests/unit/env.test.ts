import { afterEach, describe, expect, it } from "vitest";
import { modeTiruan, periksaEnv } from "@/lib/env";

// Aplikasi MENOLAK menyala bila env wajib kosong, dan menolak server tiruan di luar localhost.

const SAH = {
  DATABASE_URL: "postgres://a:b@127.0.0.1/antikebo",
  APP_ORIGIN: "https://antikebo.agentbuff.id",
  SESSION_SECRET: "x".repeat(40),
  ENCRYPTION_KEK: Buffer.alloc(32, 1).toString("base64"),
  AGENTBUFF_ISSUER: "https://agentbuff.id/masuk",
  AGENTBUFF_ORIGIN: "https://agentbuff.id",
  AGENTBUFF_PRODUCT_KEY: "antikebo",
  AGENTBUFF_MASUK_CLIENT_ID: "antikebo",
  AGENTBUFF_MASUK_CLIENT_SECRET: "rahasia",
  AGENTBUFF_TIRUAN: "",
};
const asli = { ...process.env };
const pasang = (ubah: Record<string, string>) => Object.assign(process.env, SAH, ubah);

afterEach(() => {
  process.env = { ...asli };
});

describe("periksaEnv", () => {
  it("lengkap: menyala", () => {
    pasang({});
    expect(() => periksaEnv("web")).not.toThrow();
    expect(() => periksaEnv("worker")).not.toThrow();
  });
  it("wajib kosong: menolak dengan nama env, tanpa nilai", () => {
    pasang({ ENCRYPTION_KEK: "", AGENTBUFF_MASUK_CLIENT_SECRET: " " });
    expect(() => periksaEnv("web")).toThrow(/ENCRYPTION_KEK, AGENTBUFF_MASUK_CLIENT_SECRET/);
  });
  it("SESSION_SECRET < 32 karakter ditolak (web)", () => {
    pasang({ SESSION_SECRET: "pendek" });
    expect(() => periksaEnv("web")).toThrow(/SESSION_SECRET/);
  });
  it("server tiruan hanya dengan APP_ORIGIN localhost", () => {
    pasang({ AGENTBUFF_TIRUAN: "1" });
    expect(modeTiruan()).toBe(true);
    expect(() => periksaEnv("web")).toThrow(/AGENTBUFF_TIRUAN/);
    pasang({ AGENTBUFF_TIRUAN: "1", APP_ORIGIN: "http://localhost:3100", AGENTBUFF_ISSUER: "http://127.0.0.1:3199/masuk" });
    expect(() => periksaEnv("web")).not.toThrow();
  });
  it("issuer http tanpa mode tiruan ditolak", () => {
    pasang({ AGENTBUFF_ISSUER: "http://agentbuff.id/masuk" });
    expect(() => periksaEnv("worker")).toThrow(/https/);
  });
});
