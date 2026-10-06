import { cookies } from "next/headers";
import { sesiSaatIni } from "@/lib/auth/sesi";
import { bahasaSah, NAMA_COOKIE_BAHASA, type Bahasa, type Kamus } from "./index";
import { kamusUntuk } from "./kamus-server";

/** Bahasa untuk permintaan ini: setelan akun → cookie → Indonesia. */
export async function bahasaSaatIni(): Promise<Bahasa> {
  const s = await sesiSaatIni();
  if (s) return bahasaSah(s.pengguna.locale);
  return bahasaSah((await cookies()).get(NAMA_COOKIE_BAHASA)?.value);
}

export async function kamusServer(): Promise<{ b: Bahasa; t: Kamus }> {
  const b = await bahasaSaatIni();
  return { b, t: kamusUntuk(b) };
}
