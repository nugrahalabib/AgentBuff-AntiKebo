/**
 * Penyaring kalimat omelan (docs/10-SUARA.md §2, PRD F3). Kata kasar RINGAN khas tongkrongan
 * boleh (anjir, kampret, bego); yang ditolak: kata seksual, hinaan SARA dan orientasi, serta
 * ancaman kekerasan nyata. Dipakai untuk naskah bawaan (tes) dan kalimat pribadi pengguna/agen.
 * Pencocokan setelah dinormalkan: huruf kecil, tanpa aksen, angka/simbol pengganti huruf
 * (k0nt0l), huruf berulang (kontooool), dan huruf yang dipisah spasi (k o n t o l).
 */

/** Kata tunggal terlarang (dicocokkan sebagai kata utuh atau awalan kata bila ≥ 5 huruf). */
const KATA = [
  // seksual
  "kontol",
  "memek",
  "ngentot",
  "entot",
  "pepek",
  "jembut",
  "coli",
  "bokep",
  "porno",
  "bugil",
  "sange",
  "perkosa",
  "fuck",
  "pussy",
  "dick",
  "cock",
  "horny",
  "rape",
  // hinaan SARA dan orientasi
  "kafir",
  "kadrun",
  "cebong",
  "nigger",
  "nigga",
  "chink",
  "faggot",
  "maho",
  "bencong",
  "banci",
  // kasar berat (bukan tongkrongan ringan)
  "bangsat",
  "anjing",
  "babi",
  "lonte",
  "pelacur",
  "jancok",
  "jancuk",
  "asu",
  // ancaman kekerasan
  "bunuh",
  "kubunuh",
  "dibunuh",
  "membunuh",
  "bacok",
  "kubacok",
  "murder",
];

/** Frasa terlarang (dicocokkan pada teks yang sudah dinormalkan). */
const FRASA = ["kill you", "i will kill", "mati kau", "mati lu", "mati kamu", "bakar rumah", "tusuk kamu", "tembak kamu", "gorok"];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" };

export function normalkanTeks(teks: string): string {
  return teks
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z\s]/g, " ")
    .replace(/([a-z])\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

function kataTerlarang(token: string): boolean {
  const tunggal = token.replace(/([a-z])\1+/g, "$1");
  return KATA.some((k) => token === k || tunggal === k || (k.length >= 5 && (token.startsWith(k) || tunggal.startsWith(k))));
}

/** Null bila boleh; selain itu kata/frasa yang ditemukan (tidak ditampilkan ke pengguna). */
export function temukanTerlarang(teks: string): string | null {
  const n = normalkanTeks(teks);
  const token = n.split(" ").filter(Boolean);
  for (const t of token) if (kataTerlarang(t)) return t;
  // Huruf yang dipisah spasi: gabungkan deret token satu huruf.
  let deret = "";
  for (const t of [...token, ""]) {
    if (t.length === 1) deret += t;
    else {
      if (deret.length >= 3 && kataTerlarang(deret)) return deret;
      deret = "";
    }
  }
  const gabung = ` ${n} `;
  for (const f of FRASA) if (gabung.includes(` ${f} `)) return f;
  return null;
}

export function bolehDiucapkan(teks: string): boolean {
  return temukanTerlarang(teks) === null;
}
