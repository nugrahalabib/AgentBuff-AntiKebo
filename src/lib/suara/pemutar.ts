import { berikutnya, JEDA_MS, mulaiUrutan, REDAM_KE, REDAM_MS, type Bahan, type KeadaanUrutan, type Waktu } from "./urutan";

/**
 * Pemutar alarm di peramban (docs/10-SUARA.md §3 dan §5, PRD C3). Dua lapisan yang diputar
 * bersamaan lewat Web Audio:
 *
 *  bunyi alarm (berulang tanpa celah) ─► naik ─► redam ─┐
 *  omelan (klip AgentBuff / suara perangkat) ──► omelan ─┴─► speaker
 *
 *  - Bunyi alarm TIDAK pernah bergantung pada omelan: bila berkas bunyi gagal dimuat, pemutar
 *    membuat nada bip sendiri (osilator), jadi alarm tidak pernah diam.
 *  - Selama omelan diucapkan bunyi dikecilkan ke 30% dalam 150 md lalu naik lagi; jeda 3 detik
 *    bunyi saja di antara omelan. Urutan dari `urutan.ts` (sama dengan aplikasi PC).
 *  - Klip belum ada atau gagal: kalimat yang sama dibacakan `speechSynthesis` (suara bahasa yang
 *    sama, sedikit lebih cepat); bila perangkat tidak punya suara bahasa itu, teksnya ditampilkan
 *    besar (`saatOmelan(..., "teks")`).
 *  - Peramban hanya mengizinkan audio sesudah ketukan: panggil `ketuk()` di setiap ketukan atau
 *    tombol. iPhone: `navigator.audioSession.type = "playback"` supaya tetap bunyi walau saklar
 *    senyap (wajib diuji di iPhone asli).
 */

export type JenisOmelan = "umum" | "waktu" | "agenda" | "pribadi" | "cek" | "penutup";
export type OmelanPutar = { jenis: JenisOmelan; menit?: number; teks: string; klip: string | null };
export type CaraUcap = "klip" | "tts" | "teks";

export type PeristiwaPemutar =
  | { j: "bunyi"; cara: "berkas" | "nada"; t: number }
  | { j: "omelan"; i: number; cara: CaraUcap; teks: string; t: number }
  | { j: "omelan_selesai"; i: number; t: number }
  | { j: "redam"; ke: number; t: number }
  | { j: "berhenti"; t: number };

export type OpsiPemutar = {
  bunyi: { url: string; naikDtk: number | null };
  omelan: readonly OmelanPutar[];
  /** Benih urutan (dari kejadian), supaya web dan PC memutar urutan yang sama. */
  benih: number;
  /** Saat alarm mulai berbunyi (epoch md). Menentukan kalimat waktu dan tingkat naik. */
  mulaiMs: number;
  bahasa: "id" | "en";
  urlKlip?: (hash: string) => string;
  sekarang?: () => number;
  saatOmelan?: (teks: string | null, cara: CaraUcap | null) => void;
  /** Audio jalan atau ditahan peramban (tampilkan ajakan ketuk bila false). */
  saatKeadaan?: (berjalan: boolean) => void;
  catat?: (p: PeristiwaPemutar) => void;
};

type SesiAudio = { type: string };
type NavigatorAudio = Navigator & { audioSession?: SesiAudio };

/** iPhone (Safari 17+): putar walau saklar senyap. Diam saja di peramban lain. */
export function aturSesiAudio(): void {
  try {
    const s = (navigator as NavigatorAudio).audioSession;
    if (s && s.type !== "playback") s.type = "playback";
  } catch {
    // Tidak didukung: abaikan.
  }
}

/** Bahan urutan: umum + agenda + pribadi; waktu: kalimat menit ke-n. Id = indeks omelan. */
export function bahanUrutan(omelan: readonly OmelanPutar[]): { bahan: Bahan[]; waktu: Waktu[] } {
  const bahan: Bahan[] = [];
  const waktu: Waktu[] = [];
  omelan.forEach((o, i) => {
    if (o.jenis === "waktu" && o.menit) waktu.push({ id: String(i), menit: o.menit });
    else if (o.jenis === "umum" || o.jenis === "agenda" || o.jenis === "pribadi") bahan.push({ id: String(i) });
  });
  return { bahan, waktu };
}

const KECEPATAN_TTS = 1.1;
const LAMA_TEKS_MS = (teks: string) => Math.min(6_000, Math.max(2_500, teks.length * 70));

export class PemutarAlarm {
  private ctx: AudioContext | null = null;
  private gNaik: GainNode | null = null;
  private gRedam: GainNode | null = null;
  private gOmelan: GainNode | null = null;
  private sumber: AudioScheduledSourceNode[] = [];
  private hidup = false;
  private berputar = false;
  private keadaan: KeadaanUrutan = mulaiUrutan();
  private readonly klip = new Map<string, Promise<AudioBuffer | null>>();
  private readonly pewaktu = new Set<ReturnType<typeof setTimeout>>();
  private sedang: AudioBufferSourceNode | null = null;
  private suaraTts: SpeechSynthesisVoice | null | undefined;
  private readonly jam: () => number;

  constructor(private readonly o: OpsiPemutar) {
    this.jam = o.sekarang ?? (() => Date.now());
  }

  /** Audio benar-benar jalan (bukan ditahan kebijakan putar otomatis). */
  get berjalan(): boolean {
    return this.ctx?.state === "running";
  }

  /**
   * Mulai: siapkan konteks audio dan bunyi. Bila peramban menahan audio sampai ada ketukan,
   * `berjalan` = false dan pemanggil menampilkan ajakan ketuk; omelan dimulai begitu audio jalan.
   */
  async mulai(): Promise<boolean> {
    if (this.hidup) return this.berjalan;
    this.hidup = true;
    aturSesiAudio();
    const Konteks = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Konteks) return false;
    const ctx = new Konteks({ latencyHint: "playback" });
    this.ctx = ctx;
    this.gNaik = ctx.createGain();
    this.gRedam = ctx.createGain();
    this.gOmelan = ctx.createGain();
    this.gNaik.connect(this.gRedam).connect(ctx.destination);
    this.gOmelan.connect(ctx.destination);
    ctx.addEventListener("statechange", () => {
      if (this.ctx === ctx) this.o.saatKeadaan?.(this.berjalan);
      this.sesudahJalan();
    });
    await this.pasangBunyi();
    await ctx.resume().catch(() => {});
    this.sesudahJalan();
    return this.berjalan;
  }

  /** Panggil di setiap ketukan/tombol: membuka audio yang ditahan dan menegaskan sesi iPhone. */
  ketuk(): void {
    aturSesiAudio();
    if (this.ctx && this.ctx.state !== "running" && this.ctx.state !== "closed") void this.ctx.resume().catch(() => {});
  }

  berhenti(): void {
    if (!this.hidup) return;
    this.hidup = false;
    for (const p of this.pewaktu) clearTimeout(p);
    this.pewaktu.clear();
    for (const s of this.sumber) {
      try {
        s.stop();
      } catch {
        // Sudah berhenti.
      }
    }
    this.sumber = [];
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // Tidak didukung.
    }
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.o.saatOmelan?.(null, null);
    this.o.catat?.({ j: "berhenti", t: this.jam() });
  }

  private sesudahJalan(): void {
    if (!this.hidup || !this.berjalan || this.berputar) return;
    this.berputar = true;
    this.aturNaik();
    // Klip dimuat sesudah audio jalan, berurutan, supaya omelan pertama siap secepatnya.
    void this.muatSemuaKlip();
    void this.putarOmelan();
  }

  private async pasangBunyi(): Promise<void> {
    const ctx = this.ctx!;
    let buffer: AudioBuffer | null = null;
    try {
      const r = await fetch(this.o.bunyi.url);
      if (r.ok) buffer = await ctx.decodeAudioData(await r.arrayBuffer());
    } catch {
      buffer = null;
    }
    if (!this.hidup || this.ctx !== ctx) return;
    if (buffer) {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.connect(this.gNaik!);
      s.start();
      this.sumber.push(s);
      this.o.catat?.({ j: "bunyi", cara: "berkas", t: this.jam() });
      return;
    }
    // Cadangan: bip kotak 880 Hz berdenyut 2x per detik, dibuat langsung oleh peramban.
    const nada = ctx.createOscillator();
    nada.type = "square";
    nada.frequency.value = 880;
    const denyut = ctx.createOscillator();
    denyut.type = "square";
    denyut.frequency.value = 2;
    const gDenyut = ctx.createGain();
    gDenyut.gain.value = 0.5;
    const gNada = ctx.createGain();
    gNada.gain.value = 0.5;
    denyut.connect(gDenyut).connect(gNada.gain);
    nada.connect(gNada).connect(this.gNaik!);
    nada.start();
    denyut.start();
    this.sumber.push(nada, denyut);
    this.o.catat?.({ j: "bunyi", cara: "nada", t: this.jam() });
  }

  /** Bunyi "naik perlahan": dari 10% ke 100% selama `naikDtk`, dilanjutkan dari posisi sekarang. */
  private aturNaik(): void {
    const ctx = this.ctx!;
    const g = this.gNaik!.gain;
    const naik = this.o.bunyi.naikDtk;
    if (!naik) {
      g.setValueAtTime(1, ctx.currentTime);
      return;
    }
    const berlalu = Math.max(0, (this.jam() - this.o.mulaiMs) / 1000);
    const awal = Math.min(1, 0.1 + 0.9 * (berlalu / naik));
    g.setValueAtTime(awal, ctx.currentTime);
    if (awal < 1) g.linearRampToValueAtTime(1, ctx.currentTime + (naik - berlalu));
  }

  private redam(ke: number): void {
    if (!this.ctx || !this.gRedam) return;
    const g = this.gRedam.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(ke, t + REDAM_MS / 1000);
    this.o.catat?.({ j: "redam", ke, t: this.jam() });
  }

  private tunggu(ms: number): Promise<void> {
    return new Promise((ok) => {
      const p = setTimeout(() => {
        this.pewaktu.delete(p);
        ok();
      }, ms);
      this.pewaktu.add(p);
    });
  }

  private ambilKlip(hash: string): Promise<AudioBuffer | null> {
    let p = this.klip.get(hash);
    if (!p) {
      const ctx = this.ctx;
      p = (async () => {
        if (!ctx) return null;
        try {
          const r = await fetch((this.o.urlKlip ?? ((h) => `/api/perangkat/klip/${h}`))(hash), { credentials: "same-origin" });
          if (!r.ok) return null;
          return await ctx.decodeAudioData(await r.arrayBuffer());
        } catch {
          return null;
        }
      })();
      this.klip.set(hash, p);
    }
    return p;
  }

  private async muatSemuaKlip(): Promise<void> {
    for (const o of this.o.omelan) {
      if (!this.hidup) return;
      if (o.klip) await this.ambilKlip(o.klip);
    }
  }

  private async putarOmelan(): Promise<void> {
    const { bahan, waktu } = bahanUrutan(this.o.omelan);
    if (!bahan.length && !waktu.length) return;
    // Pembuka: bunyi alarm saja dulu, lalu omelan bergantian dengan jeda 3 detik.
    await this.tunggu(JEDA_MS);
    while (this.hidup) {
      const h = berikutnya(bahan, waktu, this.o.benih, this.keadaan, this.jam() - this.o.mulaiMs);
      this.keadaan = h.keadaan;
      if (h.id === null) {
        await this.tunggu(JEDA_MS);
        continue;
      }
      await this.ucapkan(Number(h.id));
      if (!this.hidup) return;
      await this.tunggu(JEDA_MS);
    }
  }

  private async ucapkan(i: number): Promise<void> {
    const o = this.o.omelan[i];
    const buffer = o.klip ? await this.ambilKlip(o.klip) : null;
    if (!this.hidup) return;
    if (buffer && this.ctx) {
      this.mulaiUcap(i, o.teks, "klip");
      const ctx = this.ctx;
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.connect(this.gOmelan!);
      this.sedang = s;
      await new Promise<void>((ok) => {
        const batas = setTimeout(ok, buffer.duration * 1000 + 2_000);
        s.onended = () => {
          clearTimeout(batas);
          ok();
        };
        s.start();
      });
      this.sedang = null;
      this.selesaiUcap(i, true);
      return;
    }
    const suara = await this.suaraPerangkat();
    if (!this.hidup) return;
    if (suara) {
      this.mulaiUcap(i, o.teks, "tts");
      await new Promise<void>((ok) => {
        const u = new SpeechSynthesisUtterance(o.teks);
        u.voice = suara;
        u.lang = suara.lang;
        u.rate = KECEPATAN_TTS;
        u.volume = 1;
        const batas = setTimeout(ok, Math.max(8_000, o.teks.length * 150));
        u.onend = u.onerror = () => {
          clearTimeout(batas);
          ok();
        };
        window.speechSynthesis.speak(u);
      });
      this.selesaiUcap(i, true);
      return;
    }
    // Tanpa suara perangkat: bunyi alarm saja + teks omelan tampil besar.
    this.mulaiUcap(i, o.teks, "teks", false);
    await this.tunggu(LAMA_TEKS_MS(o.teks));
    this.selesaiUcap(i, false);
  }

  private mulaiUcap(i: number, teks: string, cara: CaraUcap, redam = true): void {
    if (redam) this.redam(REDAM_KE);
    this.o.saatOmelan?.(teks, cara);
    this.o.catat?.({ j: "omelan", i, cara, teks, t: this.jam() });
  }

  private selesaiUcap(i: number, redam: boolean): void {
    if (redam) this.redam(1);
    this.o.catat?.({ j: "omelan_selesai", i, t: this.jam() });
  }

  /** Suara bawaan perangkat dengan bahasa yang sama, atau null. Daftar suara bisa telat dimuat. */
  private async suaraPerangkat(): Promise<SpeechSynthesisVoice | null> {
    if (this.suaraTts !== undefined) return this.suaraTts;
    const ss = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!ss || typeof SpeechSynthesisUtterance === "undefined") return (this.suaraTts = null);
    let daftar = ss.getVoices();
    if (!daftar.length) {
      await new Promise<void>((ok) => {
        const batas = setTimeout(ok, 1_500);
        ss.addEventListener?.(
          "voiceschanged",
          () => {
            clearTimeout(batas);
            ok();
          },
          { once: true },
        );
      });
      daftar = ss.getVoices();
    }
    const awalan = this.o.bahasa === "id" ? ["id", "in"] : ["en"];
    const cocok = daftar.filter((v) => awalan.some((a) => v.lang.toLowerCase().replace("_", "-").startsWith(`${a}-`) || v.lang.toLowerCase() === a));
    this.suaraTts = cocok.find((v) => v.localService) ?? cocok[0] ?? null;
    return this.suaraTts;
  }
}

/**
 * Pratinjau bunyi 5 detik (Ubah alarm). Bunyi "naik" dipercepat: 10% ke 100% dalam 5 detik.
 * Mengembalikan fungsi berhenti. Harus dipanggil dari ketukan.
 */
export async function pratinjauBunyi(url: string, naik: boolean, lamaMs = 5_000): Promise<() => void> {
  aturSesiAudio();
  const ctx = new AudioContext();
  const g = ctx.createGain();
  g.connect(ctx.destination);
  let s: AudioBufferSourceNode | null = null;
  const berhenti = () => {
    try {
      s?.stop();
    } catch {
      // Sudah berhenti.
    }
    void ctx.close().catch(() => {});
  };
  try {
    const r = await fetch(url);
    const b = await ctx.decodeAudioData(await r.arrayBuffer());
    s = ctx.createBufferSource();
    s.buffer = b;
    s.loop = true;
    s.connect(g);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(naik ? 0.1 : 1, t);
    if (naik) g.gain.linearRampToValueAtTime(1, t + lamaMs / 1000 - 0.3);
    g.gain.setValueAtTime(1, t + lamaMs / 1000 - 0.3);
    g.gain.linearRampToValueAtTime(0, t + lamaMs / 1000);
    s.start();
    s.stop(t + lamaMs / 1000);
    s.onended = () => void ctx.close().catch(() => {});
  } catch {
    berhenti();
  }
  return berhenti;
}
