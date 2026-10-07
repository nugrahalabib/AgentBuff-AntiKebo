import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { REDAKSI } from "@/lib/log";

// Jaring pengaman log: rahasia di tingkat mana pun yang lazim tidak pernah tertulis.

describe("redaksi log", () => {
  it("token, rahasia, langganan push, jawaban, dan teks disembunyikan", () => {
    let keluar = "";
    const tujuan = new Writable({
      write(c, _e, cb) {
        keluar += String(c);
        cb();
      },
    });
    const l = pino({ redact: REDAKSI }, tujuan);
    l.info(
      {
        token: "t0",
        a: { token: "t1", b: { token: "t2" } },
        rahasia: "r",
        p: { endpoint: "https://push/x", keys: { p256dh: "k", auth: "s" } },
        s: { jawaban: "42", teks: "halo" },
      },
      "uji",
    );
    for (const r of ["t0", "t1", "t2", '"r"', "https://push/x", '"42"', "halo"]) expect(keluar).not.toContain(r);
    expect(keluar).toContain("[disembunyikan]");
  });
});
