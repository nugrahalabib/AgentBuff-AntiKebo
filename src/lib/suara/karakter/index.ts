import { bosKiller } from "./bos-killer";
import { ibuGalak } from "./ibu-galak";
import type { NaskahKarakter } from "./jenis";
import { pacarBawel } from "./pacar-bawel";
import { pelatihTentara } from "./pelatih-tentara";
import { temanNyolot } from "./teman-nyolot";

export type { MenitWaktu, Naskah, NaskahKarakter } from "./jenis";
export { MENIT_WAKTU } from "./jenis";

/** Naskah lima karakter bawaan. `kustom` hanya memakai kalimat pribadi (tidak ada di sini). */
export const NASKAH_KARAKTER: Record<"ibu_galak" | "pelatih_tentara" | "bos_killer" | "teman_nyolot" | "pacar_bawel", NaskahKarakter> = {
  ibu_galak: ibuGalak,
  pelatih_tentara: pelatihTentara,
  bos_killer: bosKiller,
  teman_nyolot: temanNyolot,
  pacar_bawel: pacarBawel,
};
