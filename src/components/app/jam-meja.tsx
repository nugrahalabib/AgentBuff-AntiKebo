"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayarAlarmHidup } from "@/components/app/alarm-hidup";
import { LayarBerbunyiBersuara } from "@/components/layar/berbunyi-suara";
import { LayarJamMejaSebelum, LayarJamMejaSiaga } from "@/components/layar/jam-meja";
import { berkasBunyi } from "@/lib/bunyi/berkas";
import { useKamus } from "@/lib/i18n/klien";
import { alarmBerikutnyaLokal, asetSiaga, jagaanBerikutnya, type ItemLokal } from "@/lib/jam-meja/jadwal-lokal";
import { panggilApi } from "@/lib/klien/api";
import { useDetik } from "@/lib/klien/jam";
import { usePeristiwa } from "@/lib/klien/peristiwa";
import { aturSesiAudio, pratinjauBunyi } from "@/lib/suara/pemutar";
import type { LayarKejadianKlien } from "@/lib/tampilan/alarm-klien";

type Fase = { jenis: "sebelum" } | { jenis: "siaga" } | { jenis: "server"; awal: LayarKejadianKlien } | { jenis: "lokal"; item: ItemLokal };
type Aktif = { id: string; status: string; jadwalUtc: string };
type Baterai = { charging: boolean; level: number; addEventListener: (j: string, f: () => void) => void; removeEventListener: (j: string, f: () => void) => void };
type KunciLayar = { release: () => Promise<void>; addEventListener: (j: string, f: () => void) => void };

const SIMPAN_ID = "antikebo:jam-meja";
const DETAK_MS = 30_000;
const SEGAR_JADWAL_MS = 5 * 60_000;

function namaPerangkat(): string {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "HP Android" : "Tablet Android";
  return "Peramban";
}

function benihDari(teks: string): number {
  let h = 2166136261;
  for (const c of teks) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

/** Tanya server dengan batas waktu (koneksi putus jangan sampai menunda bunyi lokal). */
async function aktifDiServer(ms = 2_500): Promise<Aktif[] | null> {
  const r = await Promise.race([panggilApi<{ kejadian: Aktif[] }>("/api/app/kejadian/aktif"), new Promise<null>((ok) => setTimeout(() => ok(null), ms))]);
  return r && r.ok ? r.data.kejadian : null;
}

/**
 * Mode Jam Meja (PRD H2, docs/04-DESAIN.md §4.6): HP/tablet di samping kasur jadi perangkat siaga.
 * "Mulai siaga" (ketukan) membuka audio, menahan layar tetap menyala, dan layar penuh. Selama siaga:
 * detak tiap 30 detik, salinan jadwal 24 jam, bunyi + klip tersimpan di perangkat (Service Worker).
 * Alarm berbunyi di layar ini juga (tanpa ketukan lagi); bila server diam sesudah jadwal (koneksi
 * putus), perangkat berbunyi sendiri dari simpanan sampai koneksi kembali dan soal dijawab.
 */
export function JamMejaHidup({ zona, waktuServer }: { zona: string; waktuServer: number }) {
  const { t, b } = useKamus();
  const J = t.jamMeja;
  const [fase, setFase] = useState<Fase>({ jenis: "sebelum" });
  const [jadwal, setJadwal] = useState<ItemLokal[]>([]);
  const [daring, setDaring] = useState(true);
  const [dicas, setDicas] = useState<boolean | null>(null);
  const [layarDitahan, setLayarDitahan] = useState<boolean | null>(null);
  const [siap, setSiap] = useState<{ total: number; tersimpan: number } | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const konteks = useRef<AudioContext | null>(null);
  // Salinan untuk render (ref tidak boleh dibaca saat render).
  const [audio, setAudio] = useState<AudioContext | null>(null);
  const kunciLayar = useRef<KunciLayar | null>(null);
  const perangkatId = useRef<string | null>(null);
  const sudah = useRef(new Set<string>());
  const faseRef = useRef(fase);
  useEffect(() => {
    faseRef.current = fase;
  }, [fase]);
  const siagaAktif = fase.jenis !== "sebelum";
  const detik = useDetik(waktuServer, 15);

  // ------------------------------------------------------------ jadwal + simpanan

  const muatJadwal = useCallback(async () => {
    const r = await panggilApi<{ kejadian: ItemLokal[] }>("/api/perangkat/jadwal");
    if (!r.ok) return;
    setJadwal(r.data.kejadian);
    const reg = await navigator.serviceWorker?.ready.catch(() => null);
    reg?.active?.postMessage({ jenis: "simpan-siaga", url: asetSiaga(r.data.kejadian) });
  }, []);

  useEffect(() => {
    if (!siagaAktif || !navigator.serviceWorker) return;
    const f = (e: MessageEvent<{ jenis?: string; total?: number; tersimpan?: number }>) => {
      if (e.data?.jenis === "siaga-tersimpan") setSiap({ total: e.data.total ?? 0, tersimpan: e.data.tersimpan ?? 0 });
    };
    navigator.serviceWorker.addEventListener("message", f);
    return () => navigator.serviceWorker.removeEventListener("message", f);
  }, [siagaAktif]);

  useEffect(() => {
    if (!siagaAktif) return;
    const h = setInterval(() => void muatJadwal(), SEGAR_JADWAL_MS);
    return () => clearInterval(h);
  }, [siagaAktif, muatJadwal]);

  // ------------------------------------------------------------ detak

  const daftarkan = useCallback(async () => {
    const r = await panggilApi<{ perangkat: { id: string } }>("/api/app/perangkat", "POST", { nama: namaPerangkat() });
    if (!r.ok) return null;
    perangkatId.current = r.data.perangkat.id;
    try {
      localStorage.setItem(SIMPAN_ID, r.data.perangkat.id);
    } catch {
      /* penyimpanan dimatikan: didaftarkan ulang lain kali */
    }
    return r.data.perangkat.id;
  }, []);

  const detak = useCallback(async () => {
    const id = perangkatId.current ?? (await daftarkan());
    if (!id) return;
    const siapPenuh = siap && siap.total > 0 && siap.tersimpan === siap.total;
    const r = await panggilApi("/api/perangkat/detak", "POST", {
      perangkatId: id,
      versi: "web",
      kemampuan: { dicas, suara: konteks.current?.state === "running", layarMenyala: layarDitahan },
      ...(siapPenuh ? { siapSampai: new Date(Date.now() + 24 * 3_600_000).toISOString() } : {}),
    });
    if (!r.ok && r.status === 404) {
      perangkatId.current = null;
      await daftarkan();
    }
  }, [daftarkan, dicas, layarDitahan, siap]);

  const detakTerbaru = useRef(detak);
  useEffect(() => {
    detakTerbaru.current = detak;
  });
  useEffect(() => {
    if (!siagaAktif) return;
    void detakTerbaru.current();
    const h = setInterval(() => void detakTerbaru.current(), DETAK_MS);
    return () => clearInterval(h);
  }, [siagaAktif]);

  // ------------------------------------------------------------ alarm dari server

  const bukaKejadian = useCallback(
    async (id: string) => {
      const r = await panggilApi<{ kejadian: LayarKejadianKlien }>(`/api/app/kejadian/${id}`);
      if (!r.ok) return;
      const item = jadwal.find((x) => x.kejadianId === id);
      if (item) sudah.current.add(item.kunci);
      setFase({ jenis: "server", awal: r.data.kejadian });
    },
    [jadwal],
  );

  const periksaServer = useCallback(async () => {
    const aktif = await aktifDiServer(5_000);
    if (!aktif) return;
    setDaring(true);
    const berbunyi = aktif.find((x) => x.status === "berbunyi");
    const f = faseRef.current;
    if (berbunyi && (f.jenis === "siaga" || f.jenis === "lokal")) return void bukaKejadian(berbunyi.id);
    // Berbunyi sendiri tapi server sudah tidak menganggapnya berbunyi (dijawab di perangkat lain).
    if (f.jenis === "lokal" && !aktif.some((x) => x.id === f.item.kejadianId)) setFase({ jenis: "siaga" });
  }, [bukaKejadian]);

  usePeristiwa(
    {
      halo: () => {
        setDaring(true);
        void muatJadwal();
        void periksaServer();
      },
      berbunyi: (d) => {
        const f = faseRef.current;
        if (d.k && (f.jenis === "siaga" || f.jenis === "lokal")) void bukaKejadian(d.k);
      },
      jadwal: () => void muatJadwal(),
      klip_siap: () => void muatJadwal(),
    },
    siagaAktif,
    () => setDaring(false),
  );

  // ------------------------------------------------------------ pengatur waktu lokal (cadangan)

  useEffect(() => {
    if (fase.jenis !== "siaga") return;
    const j = jagaanBerikutnya(jadwal, Date.now(), sudah.current);
    if (!j) return;
    const h = setTimeout(
      async () => {
        if (faseRef.current.jenis !== "siaga") return;
        const aktif = await aktifDiServer();
        if (aktif) {
          const berbunyi = aktif.find((x) => x.status === "berbunyi");
          if (berbunyi) return void bukaKejadian(berbunyi.id);
          // Server hidup dan alarm ini tidak berbunyi (dilewati, dihapus, atau sudah selesai).
          sudah.current.add(j.item.kunci);
          return void muatJadwal();
        }
        sudah.current.add(j.item.kunci);
        setDaring(false);
        setFase({ jenis: "lokal", item: j.item });
      },
      Math.min(Math.max(0, j.pada - Date.now()), 2 ** 31 - 1),
    );
    return () => clearTimeout(h);
  }, [fase.jenis, jadwal, bukaKejadian, muatJadwal]);

  // Saat berbunyi sendiri: coba sambung lagi tiap 5 detik.
  useEffect(() => {
    if (fase.jenis !== "lokal") return;
    const h = setInterval(() => void periksaServer(), 5_000);
    return () => clearInterval(h);
  }, [fase.jenis, periksaServer]);

  // Peramban tahu jaringan putus/pulih lebih cepat daripada SSE.
  useEffect(() => {
    if (!siagaAktif) return;
    const putus = () => setDaring(false);
    const pulih = () => void periksaServer();
    window.addEventListener("offline", putus);
    window.addEventListener("online", pulih);
    return () => {
      window.removeEventListener("offline", putus);
      window.removeEventListener("online", pulih);
    };
  }, [siagaAktif, periksaServer]);

  // ------------------------------------------------------------ baterai, kunci layar

  useEffect(() => {
    if (!siagaAktif) return;
    let bat: Baterai | null = null;
    const ubah = () => bat && setDicas(bat.charging);
    void (navigator as Navigator & { getBattery?: () => Promise<Baterai> })
      .getBattery?.()
      .then((x) => {
        bat = x;
        ubah();
        x.addEventListener("chargingchange", ubah);
      })
      .catch(() => {});
    return () => bat?.removeEventListener("chargingchange", ubah);
  }, [siagaAktif]);

  const tahanLayar = useCallback(async () => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (j: "screen") => Promise<KunciLayar> } }).wakeLock;
    if (!wl) return setLayarDitahan(false);
    try {
      const k = await wl.request("screen");
      kunciLayar.current = k;
      setLayarDitahan(true);
      k.addEventListener("release", () => setLayarDitahan(false));
    } catch {
      setLayarDitahan(false);
    }
  }, []);

  useEffect(() => {
    if (!siagaAktif) return;
    // Kunci layar lepas saat halaman tersembunyi; minta lagi begitu tampil.
    const f = () => {
      if (document.visibilityState === "visible") {
        void tahanLayar();
        void konteks.current?.resume().catch(() => {});
        void periksaServer();
      }
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [siagaAktif, tahanLayar, periksaServer]);

  // ------------------------------------------------------------ mulai / keluar

  const mulai = async () => {
    setGalat(null);
    // Di dalam ketukan: sesi audio iPhone, konteks audio, layar penuh, kunci layar.
    aturSesiAudio();
    const Konteks = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Konteks && !konteks.current) {
      const ctx = new Konteks({ latencyHint: "playback" });
      const sunyi = ctx.createBufferSource();
      sunyi.buffer = ctx.createBuffer(1, 1, 22_050);
      sunyi.connect(ctx.destination);
      sunyi.start();
      konteks.current = ctx;
      setAudio(ctx);
    }
    void konteks.current?.resume().catch(() => {});
    void document.documentElement.requestFullscreen?.().catch(() => {});
    await tahanLayar();
    try {
      perangkatId.current = localStorage.getItem(SIMPAN_ID);
    } catch {
      perangkatId.current = null;
    }
    if (!perangkatId.current && !(await daftarkan())) return setGalat(t.umum.galatUmum);
    await navigator.serviceWorker?.register("/sw.js", { scope: "/" }).catch(() => null);
    setFase({ jenis: "siaga" });
    void muatJadwal();
  };

  const keluar = () => {
    void kunciLayar.current?.release().catch(() => {});
    kunciLayar.current = null;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setFase({ jenis: "sebelum" });
  };

  const tesBunyi = async () => {
    aturSesiAudio();
    const id = (alarmBerikutnyaLokal(jadwal, Date.now())?.bunyi ?? "klasik") as Parameters<typeof berkasBunyi>[0];
    const bk = berkasBunyi(id);
    await pratinjauBunyi(bk.url, bk.naikDtk !== null);
  };

  // ------------------------------------------------------------ tampilan

  if (fase.jenis === "server")
    return (
      <LayarAlarmHidup
        key={fase.awal.id}
        awal={fase.awal}
        konteks={audio ?? undefined}
        pindah={(id) => void bukaKejadian(id)}
        selesai={() => {
          setFase({ jenis: "siaga" });
          void muatJadwal();
        }}
      />
    );

  if (fase.jenis === "lokal") {
    const i = fase.item;
    return (
      <LayarBerbunyiBersuara
        suara={{
          bunyi: berkasBunyi(i.bunyi as Parameters<typeof berkasBunyi>[0]),
          omelan: i.omelan,
          benih: benihDari(i.kunci),
          mulaiMs: Date.parse(i.jadwalUtc),
          bahasa: b,
          urlKlip: (h) => `/api/perangkat/klip/${h}`,
          konteks: audio ?? undefined,
        }}
        jam={b === "id" ? i.jam.replace(":", ".") : i.jam}
        judul={i.judul}
        detail={i.detail ?? undefined}
        perluBenar={1}
        benarBeruntun={0}
        tunda={null}
        kartu={
          <section role="status" className="kaca-gelap rounded-[32px] p-6 text-center">
            <p className="t-judul-2">{J.lokalJudul}</p>
            <p className="mt-2 text-[16px] text-white/80">{J.lokalIsi}</p>
            <p className="mt-5 inline-flex items-center gap-2 text-[14px] text-white/60">
              <span className="putar size-4 rounded-full border-2 border-white/30 border-t-white" />
              {J.menyambung}
            </p>
          </section>
        }
      />
    );
  }

  if (fase.jenis === "siaga") {
    const berikut = alarmBerikutnyaLokal(jadwal, detik * 1000);
    const jamSekarang = new Intl.DateTimeFormat("en-GB", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(detik * 1000));
    const sampaiAlarm = berikut ? Date.parse(berikut.jadwalUtc) - detik * 1000 : null;
    return (
      <LayarJamMejaSiaga
        jam={b === "id" ? jamSekarang.replace(":", ".") : jamSekarang}
        alarm={berikut ? (b === "id" ? berikut.jam.replace(":", ".") : berikut.jam) : null}
        dicas={dicas !== false}
        daring={daring}
        layarDitahan={layarDitahan !== false}
        siap={siap ? siap.total > 0 && siap.tersimpan === siap.total : null}
        perluYakin={sampaiAlarm !== null && sampaiAlarm < 8 * 3_600_000}
        keluar={keluar}
      />
    );
  }

  return <LayarJamMejaSebelum mulai={() => void mulai()} tesBunyi={() => void tesBunyi()} galat={galat} />;
}
