import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { bekuSejakBaru } from "./aturan-beku";
import { type AlasanBeku, type AlasanHak, jedaCobaLagiMs, melewatiToleransi, singgahanBasi, tafsirJawabanStatus } from "./tafsir";

// Gerbang hak: "pemilik ini masih berhak memakai AntiKebo?" Dipanggil di setiap
// pintu masuk (halaman, API, MCP, mcp-token, perangkat PC, worker) dengan singgahan
// 10 menit, dan KETAT (tanpa singgahan) saat masuk. Gangguan AgentBuff TIDAK boleh
// membuat alarm diam: hanya jawaban 200 yang jelas "tidak berhak" yang membekukan;
// tak terjangkau ditoleransi 72 jam (K-12).

export type HasilHak = {
  aktif: boolean;
  alasan: AlasanHak | AlasanBeku;
  pesan: string | null;
  /** AgentBuff sedang tak terjangkau tapi masih dalam toleransi: spanduk kecil. */
  tidakTerjangkau: boolean;
};

type PemilikMinimal = { id: string; agentbuffSub: string };

// Token bucket per proses: di bawah batas AgentBuff 600/menit.
const LAJU_PER_DTK = Number(process.env.ANTIKEBO_HAK_LAJU_PER_DTK ?? 4);
let token = LAJU_PER_DTK;
let isiTerakhir = Date.now();
function ambilToken(): boolean {
  const sekarang = Date.now();
  token = Math.min(LAJU_PER_DTK, token + ((sekarang - isiTerakhir) / 1000) * LAJU_PER_DTK);
  isiTerakhir = sekarang;
  if (token < 1) return false;
  token -= 1;
  return true;
}

async function tanyaAgentBuff(sub: string): Promise<ReturnType<typeof tafsirJawabanStatus>> {
  const id = encodeURIComponent(env("AGENTBUFF_MASUK_CLIENT_ID"));
  const rahasia = encodeURIComponent(env("AGENTBUFF_MASUK_CLIENT_SECRET"));
  const basic = Buffer.from(`${id}:${rahasia}`).toString("base64");
  try {
    const res = await fetch(`${env("AGENTBUFF_ISSUER")}/status`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ sub }).toString(),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    let badan: unknown = null;
    try {
      badan = await res.json();
    } catch {
      badan = null;
    }
    return tafsirJawabanStatus(res.status, badan);
  } catch (e) {
    log.warn({ err: (e as Error)?.name }, "status AgentBuff tidak terjangkau");
    return { jenis: "tidak_terjangkau", kredensialDitolak: false };
  }
}

const sedangBerjalan = new Map<string, Promise<HasilHak>>();

function dariBaris(b: typeof schema.statusHak.$inferSelect, sekarang: number, tidakTerjangkau: boolean): HasilHak {
  if (!b.aktif) return { aktif: false, alasan: b.alasan as AlasanBeku, pesan: b.pesan, tidakTerjangkau: false };
  if (tidakTerjangkau && melewatiToleransi(b.terakhirBaikPada, sekarang)) {
    return { aktif: false, alasan: "tidak_terjangkau", pesan: null, tidakTerjangkau: false };
  }
  return { aktif: true, alasan: "ok", pesan: null, tidakTerjangkau };
}

/**
 * Hak pemilik saat ini. `ketat` = abaikan singgahan (dipakai saat masuk).
 * Tidak pernah melempar karena jaringan: gangguan = jawaban terakhir.
 */
export async function cekHak(pemilik: PemilikMinimal, opsi: { ketat?: boolean } = {}): Promise<HasilHak> {
  const berjalan = sedangBerjalan.get(pemilik.id);
  if (berjalan) return berjalan;
  const janji = cekHakInti(pemilik, opsi.ketat ?? false).finally(() => sedangBerjalan.delete(pemilik.id));
  sedangBerjalan.set(pemilik.id, janji);
  return janji;
}

async function cekHakInti(pemilik: PemilikMinimal, ketat: boolean): Promise<HasilHak> {
  const sekarang = Date.now();
  const [baris] = await db().select().from(schema.statusHak).where(eq(schema.statusHak.penggunaId, pemilik.id)).limit(1);
  const tertahanGagal = baris?.cobaLagiSetelah && baris.cobaLagiSetelah.getTime() > sekarang;

  if (baris && !ketat) {
    if (tertahanGagal) return dariBaris(baris, sekarang, true);
    if (!singgahanBasi(baris.diperiksaPada, pemilik.id, sekarang)) return dariBaris(baris, sekarang, false);
  }
  if (!ambilToken()) {
    if (baris) return dariBaris(baris, sekarang, false);
    return { aktif: false, alasan: "tidak_terjangkau", pesan: null, tidakTerjangkau: false };
  }

  const t = await tanyaAgentBuff(pemilik.agentbuffSub);

  if (t.jenis === "tidak_terjangkau") {
    if (t.kredensialDitolak) log.error("AgentBuff menolak kredensial klien di /masuk/status: periksa AGENTBUFF_MASUK_CLIENT_ID/SECRET");
    if (!baris) return { aktif: false, alasan: "tidak_terjangkau", pesan: null, tidakTerjangkau: false };
    const gagal = baris.gagalBeruntun + 1;
    await db()
      .update(schema.statusHak)
      .set({ gagalBeruntun: gagal, cobaLagiSetelah: new Date(sekarang + jedaCobaLagiMs(gagal)) })
      .where(eq(schema.statusHak.penggunaId, pemilik.id));
    return dariBaris(baris, sekarang, true);
  }

  const kini = new Date(sekarang);
  const dasar = { diperiksaPada: kini, terakhirBaikPada: kini, gagalBeruntun: 0, cobaLagiSetelah: null };
  // Masa beku (K-07): dihitung dari jawaban "tidak berhak" pertama; pulih = kosong lagi.
  const bekuSejak = bekuSejakBaru(baris, t.aktif, kini);
  const bekuDikabari = t.aktif ? null : (baris?.bekuDikabari ?? null);
  const isi = { aktif: t.aktif, alasan: t.alasan, pesan: t.aktif ? null : t.pesan, bekuSejak, bekuDikabari, ...dasar };
  await db()
    .insert(schema.statusHak)
    .values({ penggunaId: pemilik.id, ...isi })
    .onConflictDoUpdate({ target: schema.statusHak.penggunaId, set: isi });
  if (!t.aktif) log.info({ alasan: t.alasan }, "pemilik tidak berhak: akses dibekukan");
  return t.aktif ? { aktif: true, alasan: "ok", pesan: null, tidakTerjangkau: false } : { aktif: false, alasan: t.alasan, pesan: t.pesan, tidakTerjangkau: false };
}
