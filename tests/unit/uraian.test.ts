import { describe, expect, it } from "vitest";
import { kamusUntuk } from "@/lib/i18n/kamus-server";
import { tanggalPendek, uraiPengulangan } from "@/lib/tampilan/uraian";

// Uraian pengulangan siap tampil (kartu alarm, lembar ubah) dalam dua bahasa.

const id = kamusUntuk("id");
const en = kamusUntuk("en");
const HARI_INI = "2026-10-07"; // Rabu

describe("uraian pengulangan", () => {
  it.each([
    [{ jenis: "sekali", tanggal: "2026-10-07" }, "Sekali, hari ini", "Once, today"],
    [{ jenis: "sekali", tanggal: "2026-10-08" }, "Sekali, besok", "Once, tomorrow"],
    [{ jenis: "sekali", tanggal: "2026-10-12" }, "Sekali, Sen 12 Okt", "Once, Mon, Oct 12"],
    [{ jenis: "harian" }, "Setiap hari", "Every day"],
    [{ jenis: "hari_kerja" }, "Hari kerja", "Weekdays"],
    [{ jenis: "akhir_pekan" }, "Akhir pekan", "Weekends"],
    [{ jenis: "hari", hari: [5, 1, 3] }, "Sen, Rab, Jum", "Mon, Wed, Fri"],
    [{ jenis: "hari", hari: [0, 1, 2, 3, 4, 5, 6] }, "Setiap hari", "Every day"],
    [{ jenis: "hari", hari: [1, 2, 3, 4, 5] }, "Hari kerja", "Weekdays"],
    [{ jenis: "hari", hari: [6, 0] }, "Akhir pekan", "Weekends"],
    [{ jenis: "hari", hari: [0, 6, 1] }, "Sen, Sab, Min", "Mon, Sat, Sun"],
    [{ jenis: "tiap_minggu", setiap: 2, hari: [4, 1], mulai: "2026-10-05" }, "Tiap 2 minggu: Sen, Kam", "Every 2 weeks: Mon, Thu"],
    [{ jenis: "bulanan_tanggal", tanggal: 31 }, "Tiap tanggal 31", "Monthly on day 31"],
    [{ jenis: "bulanan_hari_ke", ke: 1, hari: 1 }, "Senin pertama tiap bulan", "First Monday of every month"],
    [{ jenis: "bulanan_hari_ke", ke: -1, hari: 5 }, "Jumat terakhir tiap bulan", "Last Friday of every month"],
  ] as const)("%j", (p, teksId, teksEn) => {
    expect(uraiPengulangan(p as never, id, "id", HARI_INI)).toBe(teksId);
    expect(uraiPengulangan(p as never, en, "en", HARI_INI)).toBe(teksEn);
  });

  it("tanggal pendek", () => {
    expect(tanggalPendek("2026-12-31", id, "id")).toBe("Kam 31 Des");
    expect(tanggalPendek("2026-12-31", en, "en")).toBe("Thu, Dec 31");
  });
});
