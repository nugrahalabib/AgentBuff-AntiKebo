"use client";

import { Bell, BellOff, MessageCircle, Moon, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Cip, Saklar, TautanTombol, Tombol } from "@/components/ui/dasar";
import { Grup, KotakIkon } from "@/components/ui/grup";
import { tampilToast } from "@/components/ui/toast";
import { useKamus } from "@/lib/i18n/klien";

type Kanal = { id: string; platform: string; label: string; agen: string; siap: boolean; alasan?: string };
type Spam = { kanal: string[]; jedaDtk: number | null; batasMenit: number | null };

async function kirim(url: string, metode: string, isi?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const r = await fetch(url, {
    method: metode,
    headers: isi === undefined ? undefined : { "Content-Type": "application/json" },
    body: isi === undefined ? undefined : JSON.stringify(isi),
  });
  const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: r.ok, data };
}

/**
 * Kanal pesan (PRD G1, G2, G7): daftar kanal dari AgentBuff, kanal bawaan alarm baru (dipakai juga
 * pengingat malam), dan pesan uji. Kebenaran daftar kanal ada di AgentBuff.
 */
export function PengaturanKanal({ spamBawaan }: { spamBawaan: Spam }) {
  const { t } = useKamus();
  const K = t.kanal;
  const [keadaan, setKeadaan] = useState<{ jenis: "memuat" } | { jenis: "ada"; kanal: Kanal[] } | { jenis: "izin"; pesan: string } | { jenis: "galat"; pesan: string }>({
    jenis: "memuat",
  });
  const [bawaan, setBawaan] = useState<string[]>(spamBawaan.kanal);
  const [menguji, setMenguji] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    void kirim("/api/app/kanal", "GET").then(({ ok, data }) => {
      if (!hidup) return;
      if (ok) setKeadaan({ jenis: "ada", kanal: (data.kanal as Kanal[]) ?? [] });
      else if (data.galat === "perlu_izin") setKeadaan({ jenis: "izin", pesan: String(data.pesan ?? K.gagalMuat) });
      else setKeadaan({ jenis: "galat", pesan: String(data.pesan ?? K.gagalMuat) });
    });
    return () => {
      hidup = false;
    };
  }, [K.gagalMuat]);

  const aturBawaan = async (id: string, pakai: boolean) => {
    const baru = pakai ? [...new Set([...bawaan, id])] : bawaan.filter((x) => x !== id);
    const lama = bawaan;
    setBawaan(baru);
    const { ok, data } = await kirim("/api/app/preferensi", "PATCH", { bawaan: { spam: { ...spamBawaan, kanal: baru } } });
    if (!ok) {
      setBawaan(lama);
      tampilToast(String(data.pesan ?? K.alasan.umum), "galat");
    }
  };

  const uji = async (id: string) => {
    setMenguji(id);
    const { ok, data } = await kirim("/api/app/kanal/uji", "POST", { kanal: id });
    setMenguji(null);
    tampilToast(String(data.pesan ?? (ok ? K.ujiTerkirim : K.alasan.umum)), ok ? "ok" : "galat");
  };

  return (
    <section aria-labelledby="judul-kanal" className="flex flex-col gap-2">
      <h2 id="judul-kanal" className="t-subjudul px-4 font-semibold text-label-2">
        {K.judul}
      </h2>
      <div className="kaca rounded-[22px]">
        {keadaan.jenis === "memuat" ? (
          <p className="t-subjudul px-4 py-4 text-label-2">{t.umum.memuat}</p>
        ) : keadaan.jenis === "izin" ? (
          <div className="flex flex-col gap-3 px-4 py-4">
            <p className="text-[16px]">{keadaan.pesan}</p>
            <TautanTombol href="/auth/agentbuff/start?izin=1&lanjut=/app/pengaturan" ukuran="sedang">
              {t.pengaturan.beriIzin}
            </TautanTombol>
          </div>
        ) : keadaan.jenis === "galat" ? (
          <p className="px-4 py-4 text-[16px] text-waspada">{keadaan.pesan}</p>
        ) : keadaan.kanal.length === 0 ? (
          <p className="px-4 py-4 text-[16px] text-label-2">{K.kosong}</p>
        ) : (
          <ul className="divide-y divide-pemisah">
            {keadaan.kanal.map((k) => (
              <li key={k.id} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <KotakIkon ikon={MessageCircle} warna={k.siap ? "#0284c7" : "#64748b"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px]">{k.label}</span>
                    <span className={k.siap ? "t-keterangan block text-toska" : "t-keterangan block text-waspada"}>{k.siap ? K.siap : (k.alasan ?? K.belumSiap)}</span>
                  </span>
                </div>
                {k.siap ? (
                  <div className="flex items-center gap-2 pl-[42px] sm:pl-0">
                    <Cip nyala={bawaan.includes(k.id)} ubah={(v) => void aturBawaan(k.id, v)} label={`${K.pakai}: ${k.label}`}>
                      {K.pakai}
                    </Cip>
                    <Tombol varian="kaca" ukuran="sedang" disabled={menguji === k.id} onClick={() => void uji(k.id)}>
                      <Send size={16} />
                      {menguji === k.id ? t.umum.memuat : K.uji}
                    </Tombol>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="t-keterangan px-4 text-label-2">{`${K.ket} ${K.bawaanKet}`}</p>
    </section>
  );
}

type KeadaanNotif = "memuat" | "tidak_didukung" | "iphone" | "ditolak" | "mati" | "menyala";

function kunciKeBait(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const s = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Keadaan notifikasi peramban ini; langganan yang ada diselaraskan ke server (mis. sesudah masuk lagi). */
async function keadaanNotifikasi(): Promise<KeadaanNotif> {
  const didukung = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!didukung) return /iPhone|iPad|iPod/.test(navigator.userAgent) ? "iphone" : "tidak_didukung";
  if (Notification.permission === "denied") return "ditolak";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return "mati";
  await kirim("/api/app/push", "POST", { langganan: sub.toJSON() });
  return "menyala";
}

/** Notifikasi alarm di peramban ini (PRD G5): Service Worker + Web Push. */
export function PengaturanNotifikasi({ kunciPublik }: { kunciPublik: string }) {
  const { t } = useKamus();
  const N = t.notifikasi;
  const [keadaan, setKeadaan] = useState<KeadaanNotif>("memuat");
  const [proses, setProses] = useState(false);

  useEffect(() => {
    let hidup = true;
    void keadaanNotifikasi()
      .catch((): KeadaanNotif => "tidak_didukung")
      .then((k) => {
        if (hidup) setKeadaan(k);
      });
    return () => {
      hidup = false;
    };
  }, []);

  const nyalakan = async () => {
    setProses(true);
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setKeadaan(izin === "denied" ? "ditolak" : "mati");
        return;
      }
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunciKeBait(kunciPublik) }));
      const { ok } = await kirim("/api/app/push", "POST", { langganan: sub.toJSON() });
      if (!ok) throw new Error("simpan");
      setKeadaan("menyala");
    } catch {
      tampilToast(N.gagal, "galat");
    } finally {
      setProses(false);
    }
  };

  const matikan = async () => {
    setProses(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await kirim("/api/app/push", "DELETE", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setKeadaan("mati");
    } finally {
      setProses(false);
    }
  };

  const uji = async () => {
    setProses(true);
    const { ok, data } = await kirim("/api/app/push/uji", "POST");
    setProses(false);
    tampilToast(String(data.pesan ?? (ok ? N.ujiTerkirim : N.gagal)), ok ? "ok" : "galat");
  };

  const pesan: Partial<Record<KeadaanNotif, string>> = { tidak_didukung: N.tidakDidukung, iphone: N.iphone, ditolak: N.ditolak };
  return (
    <Grup judul={N.judul} id="judul-notifikasi" catatan={N.ket}>
      <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <KotakIkon ikon={keadaan === "menyala" ? Bell : BellOff} warna={keadaan === "menyala" ? "#e11d48" : "#64748b"} />
          <span className="min-w-0 flex-1 text-[17px]">{keadaan === "menyala" ? N.menyala : keadaan === "memuat" ? t.umum.memuat : (pesan[keadaan] ?? N.mati)}</span>
        </div>
        {keadaan === "mati" ? (
          <Tombol ukuran="sedang" disabled={proses} onClick={() => void nyalakan()}>
            <Bell size={16} />
            {N.nyalakan}
          </Tombol>
        ) : keadaan === "menyala" ? (
          <div className="flex items-center gap-2 pl-[42px] sm:pl-0">
            <Tombol varian="kaca" ukuran="sedang" disabled={proses} onClick={() => void uji()}>
              {N.uji}
            </Tombol>
            <Tombol varian="kaca" ukuran="sedang" disabled={proses} onClick={() => void matikan()}>
              {N.matikan}
            </Tombol>
          </div>
        ) : null}
      </li>
    </Grup>
  );
}

/** Pengingat malam (PRD G4) nyala/mati. */
export function PengaturanPengingat({ nyala: awal }: { nyala: boolean }) {
  const { t } = useKamus();
  const [nyala, setNyala] = useState(awal);
  const ubah = async (v: boolean) => {
    setNyala(v);
    const { ok, data } = await kirim("/api/app/preferensi", "PATCH", { pengingatMalam: v });
    if (!ok) {
      setNyala(!v);
      tampilToast(String(data.pesan ?? t.kanal.alasan.umum), "galat");
    }
  };
  return (
    <Grup judul={t.pengingat.judul} id="judul-pengingat" catatan={t.pengingat.ket}>
      <li className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
        <KotakIkon ikon={Moon} warna="#4f46e5" />
        <span className="min-w-0 flex-1 text-[17px]">{t.pengingat.aktif}</span>
        <Saklar nyala={nyala} ubah={(v) => void ubah(v)} label={t.pengingat.aktif} />
      </li>
    </Grup>
  );
}
