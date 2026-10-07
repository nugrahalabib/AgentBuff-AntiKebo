import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

// public/sw.js dijalankan di "self" palsu: memastikan notifikasi alarm (PRD G5) tampil dengan tag,
// renotify, requireInteraction, getar, dan tautan yang benar, serta mengetuknya membuka layar alarm.

type Pendengar = (e: Record<string, unknown>) => void;

function muatSw() {
  const pendengar: Record<string, Pendengar> = {};
  const tampil: Array<{ judul: string; opsi: Record<string, unknown> }> = [];
  const dibuka: string[] = [];
  const difokus: string[] = [];
  let jendela: Array<{ url: string; focus: () => Promise<unknown>; navigate?: (u: string) => Promise<unknown> }> = [];
  const simpanan = new Map<string, string>();
  const diambil: string[] = [];
  let jaringanPutus = false;
  const caches = {
    open: async () => ({
      match: async (u: string) => (simpanan.has(u) ? { dari: "simpanan", isi: simpanan.get(u) } : undefined),
      put: async (u: string, r: { isi: string }) => void simpanan.set(u, r.isi),
      keys: async () => [...simpanan.keys()].map((u) => ({ url: `https://antikebo.agentbuff.id${u}` })),
      delete: async (r: { url: string }) => simpanan.delete(new URL(r.url).pathname),
    }),
    delete: async () => {
      simpanan.clear();
      return true;
    },
  };
  const fetch = async (u: string | { url: string }) => {
    const url = typeof u === "string" ? u : u.url;
    diambil.push(url);
    if (jaringanPutus) throw new Error("putus");
    return { ok: !url.includes("tidak-ada"), isi: `isi:${url}`, dari: "jaringan" };
  };
  const self = {
    caches,
    location: { origin: "https://antikebo.agentbuff.id" },
    addEventListener: (j: string, f: Pendengar) => (pendengar[j] = f),
    skipWaiting: () => Promise.resolve(),
    registration: {
      showNotification: async (judul: string, opsi: Record<string, unknown>) => {
        tampil.push({ judul, opsi });
      },
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: async () => jendela,
      openWindow: async (u: string) => {
        dibuka.push(u);
        return null;
      },
    },
  };
  vm.runInNewContext(readFileSync(path.resolve(import.meta.dirname, "../../public/sw.js"), "utf8"), { self, URL, Promise, fetch });
  const tunggu: Array<Promise<unknown>> = [];
  const kirim = (jenis: string, e: Record<string, unknown>) => {
    pendengar[jenis]({ ...e, waitUntil: (p: Promise<unknown>) => tunggu.push(p) });
    return Promise.all(tunggu);
  };
  return {
    tampil,
    dibuka,
    difokus,
    aturJendela: (j: typeof jendela) => (jendela = j),
    push: (data: unknown) => kirim("push", { data: data === undefined ? null : { json: () => (typeof data === "string" ? JSON.parse(data) : data) } }),
    ketuk: (url: string) => kirim("notificationclick", { notification: { data: { url }, close: () => {} } }),
    fokus: (url: string) => ({ url, focus: async () => difokus.push(url) }),
    simpanan,
    diambil,
    putus: (v: boolean) => (jaringanPutus = v),
    pesan: async (data: unknown) => {
      const balas: unknown[] = [];
      await kirim("message", { data, source: { postMessage: (m: unknown) => balas.push(m) } });
      return balas;
    },
    ambil: async (url: string, method = "GET") => {
      let jawab: Promise<unknown> | null = null;
      pendengar.fetch({ request: { url, method }, respondWith: (p: Promise<unknown>) => (jawab = p) });
      return jawab ? await jawab : "tidak-dicegat";
    },
  };
}

describe("Service Worker notifikasi alarm", () => {
  it("berbunyi: tag kejadian, renotify, ditahan, getar, buka layar alarm", async () => {
    const sw = muatSw();
    await sw.push({ jenis: "bunyi", judul: "⏰ Rapat", isi: "Bangun, Nugi!", tag: "kej-1", url: "/app/bunyi/kej-1", ulang: true, tahan: true });
    expect(sw.tampil).toHaveLength(1);
    const { judul, opsi } = sw.tampil[0];
    expect(judul).toBe("⏰ Rapat");
    expect(opsi).toMatchObject({ body: "Bangun, Nugi!", tag: "kej-1", renotify: true, requireInteraction: true, silent: false, data: { url: "/app/bunyi/kej-1", jenis: "bunyi" } });
    expect((opsi.vibrate as number[]).length).toBeGreaterThan(3);
  });

  it("selesai: tag sama, tanpa bunyi/getar, tidak ditahan", async () => {
    const sw = muatSw();
    await sw.push({ jenis: "selesai", judul: "Alarm sudah mati", isi: "Selamat pagi!", tag: "kej-1", url: "/app", ulang: false, tahan: false });
    expect(sw.tampil[0].opsi).toMatchObject({ tag: "kej-1", renotify: false, requireInteraction: false, silent: true, vibrate: undefined });
  });

  it("muatan rusak atau url ke situs lain: tetap tampil, tautan ke /app", async () => {
    const sw = muatSw();
    await sw.push(undefined);
    await sw.push({ judul: "x", url: "https://evil.example/" });
    await sw.push({ judul: "y", url: "//evil.example/" });
    expect(sw.tampil.map((t) => t.opsi.data)).toEqual([
      { url: "/app", jenis: "bunyi" },
      { url: "/app", jenis: "bunyi" },
      { url: "/app", jenis: "bunyi" },
    ]);
    expect(sw.tampil[0].judul).toBe("AntiKebo");
  });

  it("ketuk: fokus jendela yang sudah di layar itu, kalau tidak ada buka jendela baru", async () => {
    const sw = muatSw();
    sw.aturJendela([sw.fokus("https://antikebo.agentbuff.id/app/bunyi/kej-1")]);
    await sw.ketuk("/app/bunyi/kej-1");
    expect(sw.difokus).toEqual(["https://antikebo.agentbuff.id/app/bunyi/kej-1"]);
    const sw2 = muatSw();
    await sw2.ketuk("/app/bunyi/kej-2");
    expect(sw2.dibuka).toEqual(["https://antikebo.agentbuff.id/app/bunyi/kej-2"]);
  });
});

describe("Service Worker simpanan Mode Jam Meja (docs/10-SUARA.md §6)", () => {
  const ASAL = "https://antikebo.agentbuff.id";

  it("menyimpan bunyi + klip yang diminta saja, membalas jumlahnya, membuang yang tidak diminta lagi", async () => {
    const sw = muatSw();
    const balas = await sw.pesan({
      jenis: "simpan-siaga",
      url: ["/bunyi/klasik.wav", "/api/perangkat/klip/abcdef1234", "/app/rahasia", "https://evil.example/x.wav", "/bunyi/klasik.wav"],
    });
    expect(balas).toEqual([{ jenis: "siaga-tersimpan", total: 2, tersimpan: 2 }]);
    expect([...sw.simpanan.keys()].sort()).toEqual(["/api/perangkat/klip/abcdef1234", "/bunyi/klasik.wav"]);
    // Pesan berikutnya: yang sudah ada tidak diunduh ulang, yang tidak diminta dibuang.
    sw.diambil.length = 0;
    await sw.pesan({ jenis: "simpan-siaga", url: ["/bunyi/klasik.wav", "/bunyi/sirene.wav"] });
    expect(sw.diambil).toEqual(["/bunyi/sirene.wav"]);
    expect([...sw.simpanan.keys()].sort()).toEqual(["/bunyi/klasik.wav", "/bunyi/sirene.wav"]);
  });

  it("koneksi putus: bunyi dan klip disajikan dari simpanan; jalur lain tidak dicegat", async () => {
    const sw = muatSw();
    await sw.pesan({ jenis: "simpan-siaga", url: ["/bunyi/klasik.wav", "/api/perangkat/klip/abcdef1234"] });
    sw.putus(true);
    expect(await sw.ambil(`${ASAL}/bunyi/klasik.wav`)).toMatchObject({ dari: "simpanan" });
    expect(await sw.ambil(`${ASAL}/api/perangkat/klip/abcdef1234`)).toMatchObject({ dari: "simpanan" });
    expect(await sw.ambil(`${ASAL}/app`)).toBe("tidak-dicegat");
    expect(await sw.ambil(`${ASAL}/api/app/alarm`)).toBe("tidak-dicegat");
    expect(await sw.ambil(`${ASAL}/bunyi/klasik.wav`, "POST")).toBe("tidak-dicegat");
    sw.putus(false);
    expect(await sw.ambil(`${ASAL}/bunyi/sirene.wav`)).toMatchObject({ dari: "jaringan" });
  });

  it("keluar: simpanan dihapus", async () => {
    const sw = muatSw();
    await sw.pesan({ jenis: "simpan-siaga", url: ["/bunyi/klasik.wav"] });
    await sw.pesan({ jenis: "lupakan-siaga" });
    expect(sw.simpanan.size).toBe(0);
  });
});
