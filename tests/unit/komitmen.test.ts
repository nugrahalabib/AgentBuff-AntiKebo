import { describe, expect, it } from "vitest";
import { BAWAAN_SISTEM, type IsiAlarm } from "@/lib/alarm/isi";
import { jendelaKunci, keadaanKunci, periksaKomitmen, type KeadaanKunci } from "@/lib/alarm/komitmen";

// Contoh emas Mode Komitmen (PRD E3, K-34). Zona Asia/Jakarta (UTC+7), jam tidur 22:00.
const Z = "Asia/Jakarta";
const wib = (s: string) => new Date(`${s}+07:00`);

describe("jendela kunci", () => {
  it.each([
    ["alarm pagi: dari jam tidur malam sebelumnya", "2026-10-08T05:00:00", "22:00", "2026-10-07T22:00:00"],
    ["alarm 23.00: dari jam tidur hari yang sama", "2026-10-07T23:00:00", "22:00", "2026-10-07T22:00:00"],
    ["alarm tepat di jam tidur: jendela kosong", "2026-10-07T22:00:00", "22:00", "2026-10-07T22:00:00"],
    ["alarm 21.00: dari jam tidur kemarin (23 jam)", "2026-10-07T21:00:00", "22:00", "2026-10-06T22:00:00"],
    ["jam tidur lewat tengah malam", "2026-10-08T05:00:00", "00:30", "2026-10-08T00:30:00"],
    ["alarm siang dari jam tidur semalam", "2026-10-08T13:00:00", "22:00", "2026-10-07T22:00:00"],
  ])("%s", (_, jadwal, jamTidur, mulai) => {
    const j = jendelaKunci(wib(jadwal), jamTidur, Z);
    expect(j.mulai.toISOString()).toBe(wib(mulai).toISOString());
    expect(j.sampai.toISOString()).toBe(wib(jadwal).toISOString());
  });
});

describe("keadaan kunci", () => {
  const jadwal = wib("2026-10-08T05:00:00");
  const ya = { komitmen: true, aktif: true };
  it.each([
    ["sebelum jam tidur: bebas", ya, "2026-10-07T21:59:00", false],
    ["tepat jam tidur: terkunci", ya, "2026-10-07T22:00:00", true],
    ["tengah malam: terkunci", ya, "2026-10-08T01:00:00", true],
    ["semenit sebelum alarm: terkunci", ya, "2026-10-08T04:59:00", true],
    ["tepat jam alarm: kunci selesai (alarm sudah berbunyi)", ya, "2026-10-08T05:00:00", false],
    ["tanpa Komitmen: bebas", { komitmen: false, aktif: true }, "2026-10-08T01:00:00", false],
    ["nonaktif: bebas", { komitmen: true, aktif: false }, "2026-10-08T01:00:00", false],
  ] as const)("%s", (_, a, sekarang, terkunci) => {
    expect(keadaanKunci(a, jadwal, "22:00", Z, wib(sekarang)).terkunci).toBe(terkunci);
  });

  it("tanpa kejadian menunggu: bebas", () => {
    expect(keadaanKunci({ komitmen: true, aktif: true }, null, "22:00", Z, wib("2026-10-08T01:00:00")).terkunci).toBe(false);
  });
});

describe("periksa perubahan saat terkunci", () => {
  const sampai = wib("2026-10-08T05:00:00");
  const kunci: KeadaanKunci = { terkunci: true, sampai };
  const lama: IsiAlarm = {
    ...BAWAAN_SISTEM,
    jam: "05:00",
    pengulangan: { jenis: "harian" },
    agendaJudul: "Presentasi",
    agendaDetail: null,
    tuya: [],
    komitmen: true,
    aktif: true,
    spam: { kanal: ["tg-1", "wa-1"], jedaDtk: null, batasMenit: null },
  };
  const ubah = (u: Partial<IsiAlarm>, jadwalBaru: Date | null = sampai, aksi: "ubah" | "hapus" | "aktif" | "lewati" = "ubah") =>
    periksaKomitmen({ kunci, aksi, lama, baru: { ...lama, ...u }, jadwalBaru });

  it.each([
    ["hapus", () => periksaKomitmen({ kunci, aksi: "hapus", lama, baru: null, jadwalBaru: null }), "hapus"],
    ["matikan", () => ubah({ aktif: false }, null, "aktif"), "matikan"],
    ["matikan Komitmen", () => ubah({ komitmen: false }), "komitmen_mati"],
    ["mundurkan jam", () => ubah({ jam: "05:30" }, wib("2026-10-08T05:30:00")), "mundur"],
    ["ganti hari sampai malam ini terlewati", () => ubah({ pengulangan: { jenis: "akhir_pekan" } }, wib("2026-10-10T05:00:00")), "mundur"],
    ["lewati malam ini", () => ubah({}, wib("2026-10-09T05:00:00"), "lewati"), "lewati"],
    ["soal lebih ringan", () => ubah({ soal: { ...lama.soal, tingkat: "ringan" } }), "lemahkan"],
    ["jumlah benar dikurangi", () => ubah({ soal: { ...lama.soal, benar: 1 } }), "lemahkan"],
    ["jenis soal diganti", () => ubah({ soal: { ...lama.soal, jenis: "ketik" } }), "lemahkan"],
    ["jatah tunda ditambah", () => ubah({ tunda: { jatah: 3, menit: 5 } }), "lemahkan"],
    ["tunda diperpanjang", () => ubah({ tunda: { jatah: 2, menit: 15 } }), "lemahkan"],
    ["Masih bangun dimatikan", () => ubah({ masihBangun: { ...lama.masihBangun, aktif: false } }), "lemahkan"],
    ["kanal spam dikurangi", () => ubah({ spam: { ...lama.spam, kanal: ["tg-1"] } }), "lemahkan"],
    ["batas berhenti sendiri ditambahkan", () => ubah({ batasMenit: 10 }), "lemahkan"],
  ] as const)("ditolak: %s", (_, f, alasan) => {
    expect(f()).toBe(alasan);
  });

  it.each([
    ["majukan jam", () => ubah({ jam: "04:30" }, wib("2026-10-08T04:30:00"))],
    ["ganti judul dan karakter", () => ubah({ agendaJudul: "Presentasi klien", karakter: "pelatih_tentara" })],
    ["soal lebih berat", () => ubah({ soal: { ...lama.soal, tingkat: "berat", benar: 3 } })],
    ["jatah tunda dikurangi", () => ubah({ tunda: { jatah: 0, menit: 5 } })],
    ["kanal spam ditambah", () => ubah({ spam: { ...lama.spam, kanal: ["tg-1", "wa-1", "dc-1"] } })],
    ["ganti bunyi", () => ubah({ bunyi: "nuklir" })],
  ] as const)("boleh: %s", (_, f) => {
    expect(f()).toBeNull();
  });

  it("tidak terkunci: semua boleh", () => {
    expect(periksaKomitmen({ kunci: { terkunci: false }, aksi: "hapus", lama, baru: null, jadwalBaru: null })).toBeNull();
  });
});
