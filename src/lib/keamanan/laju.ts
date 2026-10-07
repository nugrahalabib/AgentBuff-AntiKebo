/**
 * Batas laju jendela tetap per kunci, di memori proses (satu proses web, satu worker). Petanya
 * dibatasi: bila penuh, jendela yang sudah lewat dibuang dulu, lalu yang paling lama disisipkan.
 * Peta TIDAK pernah dikosongkan sekaligus: dulu penyerang bisa mengisi puluhan ribu kunci acak
 * (id kejadian atau perangkat palsu) supaya SEMUA batas, termasuk milik orang lain, terhapus.
 * Kunci dipotong supaya isian panjang tidak membengkakkan memori.
 */
export class PembatasLaju {
  private readonly jendela = new Map<string, { mulai: number; n: number }>();

  constructor(private readonly maks = 50_000) {}

  /** 0 = lolos; selain itu milidetik sampai jendela berikutnya. */
  tunggu(kunci: string, batas: number, ms = 60_000, kini = Date.now()): number {
    const k = kunci.slice(0, 160);
    const w = this.jendela.get(k);
    if (!w || kini - w.mulai >= ms) {
      if (w) this.jendela.delete(k);
      else if (this.jendela.size >= this.maks) this.rapikan(kini, ms);
      this.jendela.set(k, { mulai: kini, n: 1 });
      return 0;
    }
    w.n += 1;
    return w.n > batas ? Math.max(1, w.mulai + ms - kini) : 0;
  }

  get ukuran(): number {
    return this.jendela.size;
  }

  private rapikan(kini: number, ms: number) {
    for (const [k, w] of this.jendela) if (kini - w.mulai >= ms) this.jendela.delete(k);
    if (this.jendela.size < this.maks) return;
    // Masih penuh: buang sepersepuluh tertua (urutan sisip Map = urutan waktu mulai jendela).
    let buang = Math.ceil(this.maks / 10);
    for (const k of this.jendela.keys()) {
      if (buang-- <= 0) break;
      this.jendela.delete(k);
    }
  }
}

/** Format id (uuid) sebelum dipakai sebagai kunci batas laju atau dicari ke basis data. */
export function idSah(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
