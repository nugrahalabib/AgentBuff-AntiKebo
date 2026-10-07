import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { JEDA_BAWAAN_DTK, JEDA_MINIMAL_DTK, jedaKanalMs, jedaTerlaluCepatMs } from "@/lib/kanal/aturan";
import { malamTerakhir } from "@/lib/layanan/pengingat";
import { benihDari, MAKS_TEKS, notifBunyi, notifSelesai, pesanCek, pesanPenutup, pesanPengingat, pesanSpam, pesanTerlewat, pesanUji, pilihKe } from "@/lib/pesan";
import { TEKS_PESAN } from "@/lib/pesan/teks";
import { endpointSah } from "@/lib/push";

const dasar = {
  bahasa: "id" as const,
  nama: "Nugi",
  ke: 1,
  menit: 0,
  jam: "05.00",
  agenda: "Presentasi klien",
  omelan: ["BANGUN, Nugi! Ini bukan hari libur!", "Kasur bukan medan perang, Nugi! Berdiri!", "Ingat cicilan motor!"],
  tautan: "https://antikebo.agentbuff.id/app/bunyi/abc",
  benih: benihDari("kej-1|k_tg"),
};

describe("pilihan bervariasi tanpa kalimat sama berturut-turut (PRD G3)", () => {
  it("deterministik dari benih", () => {
    expect([1, 2, 3, 4, 5, 6].map((n) => pilihKe(n, 5, 42))).toEqual([1, 2, 3, 4, 5, 6].map((n) => pilihKe(n, 5, 42)));
  });
  it("properti: tiap putaran memakai semua bahan sekali; tidak pernah sama dua kali berturut", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 15 }), fc.integer({ min: 0, max: 0xffffffff }), (n, benih) => {
        const urut = Array.from({ length: n * 4 }, (_, i) => pilihKe(i + 1, n, benih));
        for (let r = 0; r < 4; r++) expect(new Set(urut.slice(r * n, (r + 1) * n)).size).toBe(n);
        for (let i = 1; i < urut.length; i++) expect(urut[i]).not.toBe(urut[i - 1]);
      }),
      { numRuns: 200 },
    );
  });
  it("satu bahan: selalu bahan itu", () => {
    expect([1, 2, 3].map((n) => pilihKe(n, 1, 7))).toEqual([0, 0, 0]);
  });
});

describe("isi pesan spam", () => {
  it("memuat penghitung, omelan, agenda, menit berlalu, dan tautan ke layar alarm", () => {
    const t = pesanSpam({ ...dasar, ke: 7, menit: 5 });
    expect(t).toMatch(/#7|ke-7/);
    expect(t).toContain("Nugi");
    expect(t).toContain("📌 Presentasi klien");
    expect(t).toContain("Sudah 5 menit sejak alarm 05.00 berbunyi.");
    expect(t).toContain(`Jawab soalnya untuk mematikan: ${dasar.tautan}`);
    expect(dasar.omelan.some((o) => t.includes(o))).toBe(true);
  });
  it("menit 0: kalimat sedang berbunyi; tanpa agenda: tanpa baris agenda", () => {
    const t = pesanSpam({ ...dasar, agenda: null });
    expect(t).toContain("Alarm 05.00 sedang berbunyi.");
    expect(t).not.toContain("📌");
  });
  it("12 pesan pertama: semua pembuka berbeda; pesan ke-n selalu sama (aman diulang)", () => {
    const pembuka = Array.from({ length: 12 }, (_, i) =>
      pesanSpam({ ...dasar, ke: i + 1 })
        .split("\n")[0]
        .replace(/\d+/g, "N"),
    );
    expect(new Set(pembuka).size).toBe(12);
    expect(pesanSpam({ ...dasar, ke: 9 })).toBe(pesanSpam({ ...dasar, ke: 9 }));
  });
  it("Inggris", () => {
    const t = pesanSpam({ ...dasar, bahasa: "en", jam: "05:00", menit: 3 });
    expect(t).toContain("3 minutes since your 05:00 alarm went off.");
    expect(t).toContain("Solve the challenge to turn it off:");
  });
  it("tidak pernah lebih dari 1000 huruf", () => {
    const t = pesanSpam({ ...dasar, agenda: "x".repeat(900), omelan: ["y".repeat(150)] });
    expect(Array.from(t).length).toBeLessThanOrEqual(MAKS_TEKS);
  });
});

describe("pesan lain", () => {
  it("penutup: kalimat karakter + ringkasan bangun", () => {
    expect(pesanPenutup({ bahasa: "id", nama: "Nugi", penutup: "Nah, gitu dong, Nugi.", jamBangun: "05.07", menit: 7, tunda: 1 })).toBe(
      "Nah, gitu dong, Nugi.\nKamu bangun 05.07 (7 menit, tunda 1 kali). Selamat pagi!",
    );
    expect(pesanPenutup({ bahasa: "id", nama: "Nugi", penutup: null, jamBangun: "05.02", menit: 2, tunda: 0 })).toBe(
      "Mantap, Nugi! Kamu berhasil bangun.\nKamu bangun 05.02 (2 menit, tanpa tunda). Selamat pagi!",
    );
  });
  it("cek, terlewat, uji", () => {
    expect(pesanCek({ bahasa: "id", nama: "Nugi", cek: null, tautan: "T" })).toBe("Nugi, masih bangun kan? Jangan tidur lagi!\nBuka AntiKebo dan ketuk Masih! sekarang: T");
    expect(pesanTerlewat({ bahasa: "id", nama: "Nugi", jam: "05.00", agenda: "Rapat", tautan: "T" })).toBe(
      "Alarm 05.00 (Rapat) terlewat karena AntiKebo sempat terganggu. Maaf, Nugi! Cek alarmmu: T",
    );
    expect(pesanUji({ bahasa: "en", nama: "Nugi" })).toBe("✅ Test from AntiKebo, Nugi. This channel is ready to wake you up!");
  });
  it("pengingat malam: alarm, agenda, status perangkat siaga", () => {
    expect(pesanPengingat({ bahasa: "id", nama: "Nugi", jam: "05.00", agenda: "Rapat", perangkatSiap: ["PC Kamar"], tautan: "T" })).toBe(
      "🌙 Selamat malam, Nugi!\nAlarm berikutnya: 05.00, Rapat.\nPerangkat siaga: PC Kamar. Aman, tidur sana!\nAtur alarm: T",
    );
    expect(pesanPengingat({ bahasa: "id", nama: "Nugi", jam: "05.00", agenda: null, perangkatSiap: [], tautan: "T" })).toContain("Belum ada perangkat siaga!");
  });
  it("notifikasi: berbunyi diulang dan ditahan; selesai mengganti tag sama tanpa bunyi", () => {
    expect(notifBunyi({ bahasa: "id", judul: "Rapat", omelan: "Bangun!", tag: "k1", url: "/app/bunyi/k1" })).toEqual({
      jenis: "bunyi",
      judul: "⏰ Rapat",
      isi: "Bangun!",
      tag: "k1",
      url: "/app/bunyi/k1",
      ulang: true,
      tahan: true,
    });
    expect(notifSelesai({ bahasa: "id", nama: "Nugi", tag: "k1", url: "/app" })).toMatchObject({ jenis: "selesai", tag: "k1", ulang: false, tahan: false });
  });
  it("semua teks id/en lengkap, tanpa tanda pisah panjang", () => {
    expect(Object.keys(TEKS_PESAN.en).sort()).toEqual(Object.keys(TEKS_PESAN.id).sort());
    expect(TEKS_PESAN.en.pembuka.length).toBe(TEKS_PESAN.id.pembuka.length);
    const semua = JSON.stringify(TEKS_PESAN);
    expect(semua).not.toMatch(/[–—]/);
  });
});

describe("jeda kanal per platform (PRD G2)", () => {
  it.each([
    ["telegram", null, 15],
    ["discord", null, 20],
    ["slack", null, 20],
    ["google_chat", null, 20],
    ["whatsapp", null, 45],
    ["telegram", 5, 5],
    ["telegram", 3, 5],
    ["whatsapp", 20, 30],
    ["discord", 60, 60],
    [null, null, 45],
  ] as const)("%s pilihan %s = %s dtk", (platform, pilihan, dtk) => {
    expect(jedaKanalMs(platform, pilihan)).toBe(dtk * 1000);
  });
  it("tidak pernah lebih cepat dari batas minimal AgentBuff", () => {
    for (const p of Object.keys(JEDA_BAWAAN_DTK) as Array<keyof typeof JEDA_BAWAAN_DTK>) expect(JEDA_BAWAAN_DTK[p]).toBeGreaterThanOrEqual(JEDA_MINIMAL_DTK[p]);
  });
  it("terlalu cepat: hormati ulangiSetelahMs, paling cepat 1 dtk", () => {
    expect(jedaTerlaluCepatMs(4_000)).toBe(4_000);
    expect(jedaTerlaluCepatMs(10)).toBe(1_000);
    expect(jedaTerlaluCepatMs(undefined)).toBe(5_000);
  });
});

describe("malam pengingat (PRD G4)", () => {
  const wib = (s: string) => new Date(`${s}+07:00`);
  it.each([
    ["sesudah jam tidur", "2026-10-07T22:00:30", "22:00", "2026-10-07", "2026-10-07T22:00:00"],
    ["lewat tengah malam: masih malam kemarin", "2026-10-08T00:30:00", "22:00", "2026-10-07", "2026-10-07T22:00:00"],
    ["sebelum jam tidur: malam kemarin", "2026-10-07T21:59:00", "22:00", "2026-10-06", "2026-10-06T22:00:00"],
    ["jam tidur lewat tengah malam", "2026-10-08T00:45:00", "00:30", "2026-10-08", "2026-10-08T00:30:00"],
  ])("%s", (_, sekarang, jamTidur, tanggal, mulai) => {
    const m = malamTerakhir(wib(sekarang), jamTidur, "Asia/Jakarta");
    expect(m.tanggal).toBe(tanggal);
    expect(m.mulai.toISOString()).toBe(wib(mulai).toISOString());
  });
});

describe("endpoint push hanya ke layanan push peramban", () => {
  const asli = process.env.AGENTBUFF_TIRUAN;
  afterEach(() => {
    process.env.AGENTBUFF_TIRUAN = asli;
  });
  it.each([
    ["https://fcm.googleapis.com/fcm/send/abc", true],
    ["https://updates.push.services.mozilla.com/wpush/v2/abc", true],
    ["https://wns2-par02p.notify.windows.com/w/?token=abc", true],
    ["https://web.push.apple.com/QABC", true],
    ["http://fcm.googleapis.com/fcm/send/abc", false],
    ["https://fcm.googleapis.com:8443/x", false],
    ["https://evil.example/fcm.googleapis.com", false],
    ["https://fcm.googleapis.com.evil.example/x", false],
    ["https://user:pw@fcm.googleapis.com/x", false],
    ["http://127.0.0.1:9999/push", false],
    ["bukan url", false],
  ])("%s = %s", (url, sah) => {
    process.env.AGENTBUFF_TIRUAN = "";
    expect(endpointSah(url)).toBe(sah);
  });
  it("mode tiruan (pengembangan/uji): localhost diizinkan", () => {
    process.env.AGENTBUFF_TIRUAN = "1";
    expect(endpointSah("http://127.0.0.1:9999/push")).toBe(true);
    expect(endpointSah("https://evil.example/x")).toBe(false);
  });
});
