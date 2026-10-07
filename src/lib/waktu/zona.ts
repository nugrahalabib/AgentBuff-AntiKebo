/** Bagian tanggal-waktu lokal sebuah instan di `zona` (IANA), lewat Intl tanpa pustaka. `hari`: 0 = Minggu. */
export function bagianLokal(instan: Date, zona: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const p = Object.fromEntries(f.formatToParts(instan).map((x) => [x.type, x.value]));
  const hari = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { tahun: +p.year, bulan: +p.month, tanggal: +p.day, jam: +p.hour % 24, menit: +p.minute, detik: +p.second, hari };
}

/** Zona IANA yang dikenal mesin ini (zona salah membuat Intl melempar). */
export function zonaSah(zona: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}
