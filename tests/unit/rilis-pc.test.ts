import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
// @ts-expect-error skrip .mjs tanpa tipe
import { siapkanRilis } from "../../scripts/rilis-pc.mjs";

// Berkas rilis PC (docs/09 §8): metadata halaman unduh + manifest pembaruan Tauri.
describe("siapkan rilis PC", () => {
  const folder: string[] = [];
  afterEach(() => folder.splice(0).forEach((f) => rmSync(f, { recursive: true, force: true })));
  const sementara = () => {
    const f = mkdtempSync(join(tmpdir(), "rilis-"));
    folder.push(f);
    return f;
  };

  it("menulis antikebo-pc.json dan pembaruan.json dengan SHA-256 dan tanda tangan", () => {
    const dari = sementara();
    const ke = join(sementara(), "pc");
    const isi = Buffer.from("pemasang-uji");
    writeFileSync(join(dari, "AntiKebo_1.2.3_x64-setup.exe"), isi);
    writeFileSync(join(dari, "AntiKebo_1.2.3_x64-setup.exe.sig"), "dGFuZGE=\n");
    writeFileSync(join(dari, "lain.txt"), "x");
    const info = siapkanRilis(dari, ke, "https://contoh.test", new Date("2026-10-07T00:00:00Z"));
    const sha = createHash("sha256").update(isi).digest("hex");
    expect(info).toEqual({ versi: "1.2.3", berkas: "AntiKebo_1.2.3_x64-setup.exe", ukuran: isi.length, sha256: sha, tanggal: "2026-10-07T00:00:00.000Z" });
    expect(JSON.parse(readFileSync(join(ke, "antikebo-pc.json"), "utf8"))).toEqual(info);
    expect(JSON.parse(readFileSync(join(ke, "pembaruan.json"), "utf8"))).toEqual({
      version: "1.2.3",
      notes: "AntiKebo untuk PC 1.2.3",
      pub_date: "2026-10-07T00:00:00.000Z",
      platforms: { "windows-x86_64": { signature: "dGFuZGE=", url: "https://contoh.test/unduh/pc/AntiKebo_1.2.3_x64-setup.exe" } },
    });
    expect(readFileSync(join(ke, "AntiKebo_1.2.3_x64-setup.exe"))).toEqual(isi);
  });

  it("tanpa pemasang = galat jelas", () => {
    expect(() => siapkanRilis(sementara(), sementara())).toThrow(/pemasang NSIS tidak ditemukan/);
  });
});
