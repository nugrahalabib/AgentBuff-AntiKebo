import { describe, expect, it } from "vitest";
import { rakitKemampuan } from "@/lib/tuya/kemampuan";
import { bandingkanLaporan } from "@/lib/tuya/konfirmasi";
import type { ModelPerangkat, PropertiModel } from "@/lib/tuya/tipe";

const p = (code: string, typeSpec: PropertiModel["typeSpec"], accessMode = "rw"): PropertiModel => ({ code, accessMode, typeSpec });
const STRIP: ModelPerangkat = {
  services: [
    {
      code: "",
      properties: [
        p("switch_led", { type: "bool" }),
        p("work_mode", { type: "enum", range: ["white", "colour", "scene", "music"] }),
        p("bright_value", { type: "value", min: 10, max: 1000, step: 1, scale: 0 }),
        p("colour_data", { type: "string", maxlen: 255 }),
        p("countdown", { type: "value", min: 0, max: 86400, step: 1, scale: 0 }),
        p("music_data", { type: "string", maxlen: 255 }, "wr"),
      ],
    },
  ],
};
const k = rakitKemampuan(STRIP, { colour_data: "00f003e803e8" });

describe("bandingkanLaporan: 'berhasil' hanya bila perangkat melapor", () => {
  it("cocok bila perangkat melaporkan nilai yang dikirim", () => {
    expect(bandingkanLaporan(k, STRIP, { switch_led: true, bright_value: 500 }, { switch_led: true, bright_value: 500, work_mode: "white" }).status).toBe("cocok");
  });

  it("beda bila perangkat masih melaporkan keadaan lama", () => {
    const r = bandingkanLaporan(k, STRIP, { switch_led: false }, { switch_led: true });
    expect(r).toEqual({ status: "beda", beda: ["switch_led"] });
  });

  it("toleransi pembulatan angka kecil", () => {
    expect(bandingkanLaporan(k, STRIP, { bright_value: 782 }, { bright_value: 780 }).status).toBe("cocok");
    expect(bandingkanLaporan(k, STRIP, { bright_value: 782 }, { bright_value: 500 }).status).toBe("beda");
  });

  it("warna dibandingkan sebagai warna (format lapor boleh beda)", () => {
    expect(bandingkanLaporan(k, STRIP, { colour_data: "000003e803e8" }, { colour_data: "000103e803e8" }).status).toBe("cocok");
    expect(bandingkanLaporan(k, STRIP, { colour_data: "000003e803e8" }, { colour_data: "00f003e803e8" }).status).toBe("beda");
  });

  it("timer berjalan mundur tetap dianggap cocok; tulis-saja tidak terukur", () => {
    expect(bandingkanLaporan(k, STRIP, { countdown: 1800 }, { countdown: 1795 }).status).toBe("cocok");
    expect(bandingkanLaporan(k, STRIP, { music_data: "x" }, { switch_led: true }).status).toBe("tak_terukur");
    expect(bandingkanLaporan(k, STRIP, { switch_led: true }, null).status).toBe("tak_terukur");
  });
});
