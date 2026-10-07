import type { Db } from "@/lib/db";
import { log } from "@/lib/log";
import {
  bangunkanTundaHabis,
  catatHasilLangkah,
  cariSaluran,
  jadwalTerdekat,
  klaimJatuhTempo,
  klaimLangkah,
  langkahPantas,
  lengkapiMaterialisasi,
  pulihkanLangkahMacet,
  rencanakanPra,
} from "./mesin";
import type { HasilLangkah, IsiKejadian } from "./saluran";

/**
 * Penjadwal di worker (arsitektur §4.2 sampai §4.8). Dua putaran terpisah supaya saluran lambat
 * (jaringan) tidak pernah menunda bunyi alarm:
 *
 *  - **putaran kejadian** (hanya DB, cepat): pulihkan langkah macet, klaim kejadian jatuh tempo,
 *    bangunkan tunda yang habis. Dipicu `setTimeout` tepat ke jadwal terdekat, ketukan pengaman
 *    tiap 1 dtk, dan NOTIFY `antikebo_peristiwa` (jadwal berubah).
 *  - **putaran langkah**: klaim langkah jatuh tempo lalu jalankan paralel (paling banyak
 *    `maksJalan` sekaligus), masing-masing berbatas waktu.
 *
 * Tahan restart: semua keadaan ada di DB. Worker baru melanjutkan kejadian `berbunyi` yang sama
 * (langkahnya baris DB), dan langkah `jalan` yang ditinggal worker mati diulang.
 */

export type OpsiPenjadwal = {
  db: () => Db;
  jam?: () => Date;
  /** Berlangganan NOTIFY `antikebo_peristiwa`; mengembalikan fungsi berhenti. */
  dengar?: (cb: (muatan: string) => void) => Promise<() => unknown>;
  ketukanMs?: number;
  batasLangkahMs?: number;
  maksJalan?: number;
};

export type RingkasPutaran = { berbunyi: number; terlewat: number; bangunDariTunda: number; pulih: number };

function denganBatas<T>(ms: number, p: Promise<T>): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<T>((_, tolak) => (t = setTimeout(() => tolak(new Error(`batas waktu ${ms} ms`)), ms)))]).finally(() => clearTimeout(t));
}

export class Penjadwal {
  private readonly o: Required<Omit<OpsiPenjadwal, "dengar">> & Pick<OpsiPenjadwal, "dengar">;
  private pewaktu: ReturnType<typeof setTimeout> | null = null;
  private ketukan: ReturnType<typeof setInterval> | null = null;
  private lepasDengar: (() => unknown) | null = null;
  private putaranJalan: Promise<RingkasPutaran> | null = null;
  private ulangi = false;
  private readonly jalan = new Set<Promise<void>>();
  private hidup = false;

  constructor(o: OpsiPenjadwal) {
    this.o = { jam: () => new Date(), ketukanMs: 1_000, batasLangkahMs: 15_000, maksJalan: 50, ...o };
  }

  async mulai(): Promise<void> {
    this.hidup = true;
    const n = await this.o.db().transaction((tx) => lengkapiMaterialisasi(tx, this.o.jam()));
    if (n) log.warn({ n }, "penjadwal: alarm aktif tanpa kejadian menunggu dimaterialisasi ulang");
    await this.putar();
    this.ketukan = setInterval(() => void this.putar().catch((e) => log.warn({ err: (e as Error)?.message }, "putaran penjadwal gagal")), this.o.ketukanMs);
    if (this.o.dengar) {
      this.lepasDengar = await this.o.dengar((muatan) => {
        const j = (() => {
          try {
            return (JSON.parse(muatan) as { j?: string }).j;
          } catch {
            return undefined;
          }
        })();
        if (j === "jadwal" || j === "tunda" || j === "berbunyi") void this.aturPewaktu();
      });
    }
  }

  async berhenti(): Promise<void> {
    this.hidup = false;
    if (this.ketukan) clearInterval(this.ketukan);
    if (this.pewaktu) clearTimeout(this.pewaktu);
    this.ketukan = this.pewaktu = null;
    await this.lepasDengar?.();
    await this.tenang();
  }

  /** Tunggu sampai putaran dan langkah yang sedang jalan selesai (uji dan berhenti rapi). */
  async tenang(): Promise<void> {
    while (this.putaranJalan || this.jalan.size) {
      await this.putaranJalan;
      await Promise.all([...this.jalan]);
    }
  }

  /** Satu putaran kejadian, lalu putaran langkah. Panggilan bertumpuk digabung. */
  async putar(): Promise<RingkasPutaran> {
    if (this.putaranJalan) {
      this.ulangi = true;
      return this.putaranJalan;
    }
    this.putaranJalan = (async () => {
      const total: RingkasPutaran = { berbunyi: 0, terlewat: 0, bangunDariTunda: 0, pulih: 0 };
      try {
        do {
          this.ulangi = false;
          const sekarang = this.o.jam();
          total.pulih += await this.o.db().transaction((tx) => pulihkanLangkahMacet(tx, sekarang));
          const klaim = await this.o.db().transaction((tx) => klaimJatuhTempo(tx, sekarang));
          total.berbunyi += klaim.filter((k) => k.hasil === "berbunyi").length;
          total.terlewat += klaim.filter((k) => k.hasil === "terlewat").length;
          for (const k of klaim) log.info({ kejadian: k.kejadian.id, hasil: k.hasil, terlambatDtk: k.kejadian.terlambatDtk }, "kejadian diklaim");
          total.bangunDariTunda += (await this.o.db().transaction((tx) => bangunkanTundaHabis(tx, sekarang))).length;
          await this.o.db().transaction((tx) => rencanakanPra(tx, sekarang));
          await this.putarLangkah();
        } while (this.ulangi);
      } finally {
        this.putaranJalan = null;
      }
      if (this.hidup) await this.aturPewaktu();
      return total;
    })();
    return this.putaranJalan;
  }

  private async putarLangkah(): Promise<void> {
    const ruang = this.o.maksJalan - this.jalan.size;
    if (ruang <= 0) return;
    const diklaim = await this.o.db().transaction((tx) => klaimLangkah(tx, this.o.jam(), ruang));
    for (const { langkah, kejadian } of diklaim) {
      const p = (async () => {
        const s = cariSaluran(langkah.jenis);
        let h: HasilLangkah & { dilewati?: boolean };
        if (!s || !langkahPantas(langkah.jenis, kejadian.status)) {
          h = { hasil: { dilewati: kejadian.status }, dilewati: true };
        } else {
          try {
            h = await denganBatas(this.o.batasLangkahMs, s.jalankan({ kejadian, isi: kejadian.isi as IsiKejadian | null, langkah, sekarang: this.o.jam() }));
          } catch (e) {
            h = { hasil: { galat: (e as Error)?.message?.slice(0, 200) ?? "galat" }, gagal: true };
          }
        }
        await this.o.db().transaction((tx) => catatHasilLangkah(tx, langkah, h, this.o.jam()));
      })()
        .catch((e) => log.warn({ err: (e as Error)?.message, langkah: langkah.id }, "langkah gagal dicatat"))
        .finally(() => this.jalan.delete(p));
      this.jalan.add(p);
    }
  }

  /** Pasang pewaktu tepat ke jadwal terdekat (ketukan 1 dtk tetap jalan sebagai pengaman). */
  async aturPewaktu(): Promise<void> {
    if (!this.hidup) return;
    const t = await this.o.db().transaction((tx) => jadwalTerdekat(tx));
    if (this.pewaktu) clearTimeout(this.pewaktu);
    this.pewaktu = null;
    if (!t || !this.hidup) return;
    const tunda = Math.min(Math.max(0, t.getTime() - Date.now()), 2_147_000_000);
    this.pewaktu = setTimeout(() => void this.putar().catch(() => {}), tunda);
  }
}
