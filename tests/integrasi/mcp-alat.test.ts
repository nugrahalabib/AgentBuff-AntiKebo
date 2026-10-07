import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { AgentBuffTiruan } from "../tiruan/agentbuff";
import { arahkanDbAplikasi, siapkanBasisData, type Ujian } from "./harness";
import { ASAL_APP, siapkanTiruan } from "./lingkungan";

// P12: alat MCP lewat server sungguhan (layaniMcp): paritas penuh dengan web, idempotensi
// client_ref, Mode Komitmen (commitment_locked + locked_until), access_frozen, alarm_ringing,
// tidak ada alat untuk mematikan alarm, tautan unduh CSV berumur pendek, bawaan alarm baru.

let t: AgentBuffTiruan;
let u: Ujian;
const SUB = "ab_mcp_alat";
const M = () => import("@/lib/mcp/server");

beforeAll(async () => {
  t = await siapkanTiruan();
  u = await siapkanBasisData();
  arahkanDbAplikasi(u);
}, 60_000);
afterAll(async () => {
  await t?.tutup();
});
beforeEach(() => {
  t.atur(SUB, { hak: "ok", nama: "Sari Pratiwi", email: "sari.mcp@contoh.id", izin: { kabar: true, suara: true } });
});

let urut = 10;
async function rpc(token: string, method: string, params: Record<string, unknown> = {}) {
  const { layaniMcp } = await M();
  const res = await layaniMcp(
    new Request(`${ASAL_APP}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: urut++, method, params }),
    }),
  );
  const teks = await res.text();
  return {
    status: res.status,
    json: teks.trim().startsWith("{")
      ? JSON.parse(teks)
      : JSON.parse(
          teks
            .split("\n")
            .filter((b) => b.startsWith("data:"))
            .map((b) => b.slice(5))
            .join(""),
        ),
  };
}

type Hasil = { isError?: boolean; structuredContent: Record<string, unknown> & { error_code?: string }; content: Array<{ text: string }> };
async function panggil(token: string, name: string, args: Record<string, unknown> = {}): Promise<Hasil> {
  const r = await rpc(token, "tools/call", { name, arguments: args });
  expect(r.status).toBe(200);
  if (r.json.error) throw new Error(`${name}: ${JSON.stringify(r.json.error)}`);
  return r.json.result as Hasil;
}

let tokenSari: string | null = null;
async function token(): Promise<string> {
  if (tokenSari) return tokenSari;
  const { tanganiMintaToken } = await import("@/lib/agen/otomatis");
  const r = await tanganiMintaToken(await t.asersiMcp(SUB));
  tokenSari = (r.badan as { token: string }).token;
  return tokenSari;
}
async function pengguna() {
  const [p] = await u.superuser.select().from(schema.pengguna).where(eq(schema.pengguna.agentbuffSub, SUB));
  return p;
}

/** Jam lokal Jakarta `menit` dari sekarang, "HH:MM". */
function jamNanti(menit: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(Date.now() + menit * 60_000));
}

describe("alarm lewat agen", () => {
  it("create_alarm dari satu kalimat: isian Inggris dipetakan, teks menyebut jadwal + zona; client_ref mencegah dobel", async () => {
    const tk = await token();
    const masukan = {
      time: "05:30",
      repeat: { type: "weekdays" },
      agenda_title: "Kuliah pagi",
      character: "bos_killer",
      challenge: { type: "math", level: "hard", correct_in_a_row: 3 },
      snooze: { count: 1, minutes: 10 },
      skip_holidays: true,
      client_ref: "alarm-kuliah-1",
    };
    const a = await panggil(tk, "create_alarm", masukan);
    expect(a.isError).toBeFalsy();
    const alarm = a.structuredContent.alarm as Record<string, unknown>;
    expect(alarm).toMatchObject({
      time: "05:30",
      repeat: { type: "weekdays" },
      agenda_title: "Kuliah pagi",
      character: "bos_killer",
      challenge: { type: "math", level: "hard", correct_in_a_row: 3 },
      snooze: { count: 1, minutes: 10 },
      skip_holidays: true,
      enabled: true,
      time_zone: "Asia/Jakarta",
    });
    expect(a.content[0].text).toMatch(/^Alarm Kuliah pagi dipasang: Hari kerja, berbunyi berikutnya .+ 05\.30 \(zona Asia\/Jakarta\)\.$/);

    // Agen mengulang panggilan yang sama (jaringan putus): hasil sama, tidak ada alarm kedua.
    const ulang = await panggil(tk, "create_alarm", masukan);
    expect((ulang.structuredContent.alarm as { id: string }).id).toBe(alarm.id);
    expect(ulang.structuredContent.replayed).toBe(true);
    const daftar = await panggil(tk, "list_alarms");
    expect((daftar.structuredContent.alarms as unknown[]).filter((x) => (x as { agenda_title: string }).agenda_title === "Kuliah pagi")).toHaveLength(1);

    // Isian yang salah: validasi dengan pesan, rujukan dilepas sehingga boleh dicoba lagi.
    const salah = await panggil(tk, "create_alarm", { time: "25:00", client_ref: "alarm-salah" });
    expect(salah.structuredContent.error_code).toBe("validation");
    const benar = await panggil(tk, "create_alarm", { time: "06:00", repeat: { type: "once" }, agenda_title: "Sekali", client_ref: "alarm-salah" });
    expect(benar.isError).toBeFalsy();

    // Ubah sebagian: yang tidak disebut tetap.
    const ubah = await panggil(tk, "update_alarm", { alarm_id: alarm.id, challenge: { level: "medium" }, custom_lines: ["Bangun woy, cicilan nunggu!"] });
    expect(ubah.structuredContent.alarm).toMatchObject({
      challenge: { type: "math", level: "medium", correct_in_a_row: 3 },
      custom_lines: ["Bangun woy, cicilan nunggu!"],
      character: "bos_killer",
    });

    const lewat = await panggil(tk, "skip_alarm_date", { alarm_id: alarm.id, date: "2030-01-07" });
    expect((lewat.structuredContent.alarm as { skipped_dates: string[] }).skipped_dates).toContain("2030-01-07");
    const batal = await panggil(tk, "unskip_alarm", { alarm_id: alarm.id, date: "2030-01-07" });
    expect((batal.structuredContent.alarm as { skipped_dates: string[] }).skipped_dates).not.toContain("2030-01-07");

    const salin = await panggil(tk, "duplicate_alarm", { alarm_id: alarm.id });
    expect(salin.structuredContent.alarm).toMatchObject({ enabled: false, commitment: false, agenda_title: "Kuliah pagi" });
    const hapusTanpaYakin = await panggil(tk, "delete_alarm", { alarm_id: (salin.structuredContent.alarm as { id: string }).id });
    expect(hapusTanpaYakin.structuredContent.error_code).toBe("validation");
    const hapus = await panggil(tk, "delete_alarm", { alarm_id: (salin.structuredContent.alarm as { id: string }).id, confirm: true });
    expect(hapus.content[0].text).toBe("Alarm Kuliah pagi dihapus.");

    const besok = await panggil(tk, "get_next_alarm");
    expect(besok.content[0].text).toMatch(/^Alarm berikutnya: /);
  });

  it("Mode Komitmen ditegakkan: hapus/matikan ditolak commitment_locked dengan locked_until", async () => {
    const tk = await token();
    const p = await pengguna();
    // Sekarang di dalam jendela kunci: jam tidur 2 jam lalu, alarm 3 jam lagi.
    await u.superuser
      .update(schema.pengguna)
      .set({ jamTidur: jamNanti(-120) })
      .where(eq(schema.pengguna.id, p.id));
    const a = await panggil(tk, "create_alarm", { time: jamNanti(180), repeat: { type: "daily" }, agenda_title: "Subuh", commitment: true });
    const id = (a.structuredContent.alarm as { id: string }).id;
    expect(a.structuredContent.alarm).toHaveProperty("commitment_locked_until");
    const g = await panggil(tk, "delete_alarm", { alarm_id: id, confirm: true });
    expect(g).toMatchObject({ isError: true, structuredContent: { error_code: "commitment_locked", reason: "delete" } });
    expect(typeof g.structuredContent.locked_until).toBe("string");
    expect((await panggil(tk, "set_alarm_enabled", { alarm_id: id, enabled: false })).structuredContent).toMatchObject({ error_code: "commitment_locked", reason: "turn_off" });
    expect((await panggil(tk, "update_alarm", { alarm_id: id, challenge: { level: "easy" } })).structuredContent).toMatchObject({
      error_code: "commitment_locked",
      reason: "weaker",
    });
    // Memperberat tetap boleh.
    expect((await panggil(tk, "update_alarm", { alarm_id: id, challenge: { level: "hard" } })).isError).toBeFalsy();
    await u.superuser.update(schema.pengguna).set({ jamTidur: "22:00" }).where(eq(schema.pengguna.id, p.id));
    await u.superuser.update(schema.alarm).set({ komitmen: false }).where(eq(schema.alarm.id, id));
  });

  it("alarm berbunyi: hanya status + tautan; ubah ditolak alarm_ringing; tidak ada alat mematikan", async () => {
    const tk = await token();
    const p = await pengguna();
    const a = await panggil(tk, "create_alarm", { time: "07:00", repeat: { type: "daily" }, agenda_title: "Rapat" });
    const id = (a.structuredContent.alarm as { id: string }).id;
    await u.superuser.update(schema.kejadianAlarm).set({ status: "berbunyi", berbunyiPada: new Date() }).where(eq(schema.kejadianAlarm.alarmId, id));
    const aktif = await panggil(tk, "get_active_alarm");
    expect(aktif.structuredContent.active).toEqual([expect.objectContaining({ title: "Rapat", status: "ringing", alarm_screen_url: expect.stringMatching(/\/app\/bunyi\//) })]);
    expect(aktif.content[0].text).toContain("hanya bisa dihentikan dengan menjawab soal di layar alarm");
    expect((await panggil(tk, "update_alarm", { alarm_id: id, time: "07:30" })).structuredContent.error_code).toBe("alarm_ringing");
    for (const nama of ["stop_alarm", "snooze_alarm", "answer_challenge", "dismiss_alarm"]) {
      const r = await rpc(tk, "tools/call", { name: nama, arguments: {} });
      expect(r.json.error?.code).toBe(-32602);
    }
    await u.superuser.update(schema.kejadianAlarm).set({ status: "dibatalkan" }).where(eq(schema.kejadianAlarm.penggunaId, p.id));
  });

  it("akses dibekukan: alat apa pun selain get_setup_status menjawab access_frozen", async () => {
    const tk = await token();
    const p = await pengguna();
    const { cekHak } = await import("@/lib/agentbuff/status");
    t.atur(SUB, { hak: "akses_berakhir" });
    await cekHak({ id: p.id, agentbuffSub: SUB }, { ketat: true });
    for (const nama of ["list_alarms", "create_alarm", "get_history"]) {
      const r = await panggil(tk, nama, nama === "create_alarm" ? { time: "05:00" } : {});
      expect(r.structuredContent).toMatchObject({ error_code: "access_frozen", reason: "akses_berakhir" });
    }
    expect((await panggil(tk, "get_setup_status")).structuredContent.access).toBe("frozen");
    t.atur(SUB, { hak: "ok" });
    await cekHak({ id: p.id, agentbuffSub: SUB }, { ketat: true });
  });
});

describe("pengaturan, template, kode QR, riwayat lewat agen", () => {
  it("update_preferences menggabungkan bawaan alarm baru; alarm baru memakainya", async () => {
    const tk = await token();
    const r = await panggil(tk, "update_preferences", { nickname: "Sasa", bedtime: "23:00", new_alarm_defaults: { character: "pacar_bawel", snooze: { count: 0 } } });
    expect(r.structuredContent.preferences).toMatchObject({
      nickname: "Sasa",
      bedtime: "23:00",
      new_alarm_defaults: { character: "pacar_bawel", snooze: { count: 0, minutes: 5 } },
    });
    const a = await panggil(tk, "create_alarm", { time: "04:30", repeat: { type: "daily" } });
    expect(a.structuredContent.alarm).toMatchObject({ character: "pacar_bawel", snooze: { count: 0, minutes: 5 }, agenda_title: "Bangun" });
    const karakter = await panggil(tk, "list_characters");
    expect(karakter.content[0].text).toContain("Sasa");
  });

  it("template dan kode QR: buat (idempoten), pakai, ganti nama, hapus", async () => {
    const tk = await token();
    const tpl = await panggil(tk, "create_template", {
      name: "Gym",
      settings: { time: "05:15", repeat: { type: "days", days: ["mon", "wed", "fri"] }, agenda_title: "Gym" },
      client_ref: "tpl-gym",
    });
    const idTpl = (tpl.structuredContent.template as { id: string }).id;
    expect(tpl.structuredContent.template).toMatchObject({ name: "Gym", settings: { time: "05:15", repeat: { type: "days", days: ["mon", "wed", "fri"] } } });
    const a = await panggil(tk, "create_alarm", { template: idTpl });
    expect(a.structuredContent.alarm).toMatchObject({ time: "05:15", agenda_title: "Gym" });
    expect((await panggil(tk, "update_template", { template_id: idTpl, name: "Gym sore" })).content[0].text).toBe("Template Gym sore diubah.");
    expect((await panggil(tk, "delete_template", { template_id: idTpl, confirm: true })).content[0].text).toBe("Template Gym sore dihapus.");
    expect((await panggil(tk, "update_template", { template_id: "bawaan:nuklir", name: "X" })).structuredContent.error_code).toBe("validation");

    const qr = await panggil(tk, "create_wake_code", { name: "Kamar mandi", client_ref: "qr-1" });
    const kode = qr.structuredContent.wake_code as { id: string; print_url: string };
    expect(kode.print_url).toBe(`${ASAL_APP}/app/kode-qr/${kode.id}/cetak`);
    const misi = await panggil(tk, "create_alarm", { time: "05:45", repeat: { type: "daily" }, agenda_title: "Misi", challenge: { type: "qr", qr_code_ids: [kode.id] } });
    expect(misi.structuredContent.alarm).toMatchObject({ challenge: { type: "qr", qr_code_ids: [kode.id] } });
    const tolak = await panggil(tk, "delete_wake_code", { wake_code_id: kode.id, confirm: true });
    expect(tolak.structuredContent.error_code).toBe("validation");
    expect(tolak.content[0].text).toContain("masih dipakai alarm Misi");
  });

  it("riwayat + ekspor CSV lewat tautan berumur pendek", async () => {
    const tk = await token();
    const p = await pengguna();
    await u.superuser.insert(schema.kejadianAlarm).values({
      penggunaId: p.id,
      jadwalUtc: new Date("2026-10-06T22:00:00Z"),
      tanggalLokal: "2026-10-07",
      jamLokal: "05:00",
      judul: "Kuliah",
      status: "bangun",
      berbunyiPada: new Date("2026-10-06T22:00:00Z"),
      bangunPada: new Date("2026-10-06T22:03:00Z"),
    });
    const h = await panggil(tk, "get_history");
    expect(h.structuredContent.events).toEqual(expect.arrayContaining([expect.objectContaining({ title: "Kuliah", result: "woke_up", minutes_to_wake: 3 })]));
    const ekspor = await panggil(tk, "export_history");
    const url = new URL(ekspor.structuredContent.download_url as string);
    expect(url.pathname).toBe("/unduh/riwayat");
    const { GET } = await import("@/app/unduh/riwayat/route");
    const res = await GET(new Request(`${ASAL_APP}${url.pathname}${url.search}`));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Kuliah");
    // Token diubah = ditolak.
    const palsu = await GET(new Request(`${ASAL_APP}/unduh/riwayat?t=${url.searchParams.get("t")!.slice(0, -2)}xx`));
    expect(palsu.status).toBe(404);
  });
});

describe("paritas", () => {
  it("setiap alat yang dirujuk paritas ada, dan setiap alat punya deskripsi + skema ketat", async () => {
    const { PARITAS } = await import("@/lib/mcp/paritas");
    const { SEMUA_ALAT } = await import("@/lib/mcp/alat");
    const nama = new Set(SEMUA_ALAT.map((a) => a.nama));
    for (const x of PARITAS) if ("alat" in x) for (const n of x.alat) expect(nama.has(n), `${x.metode} ${x.rute}: ${n}`).toBe(true);
    for (const a of SEMUA_ALAT) {
      expect(a.deskripsi.length, a.nama).toBeGreaterThan(40);
      expect(a.masukan.safeParse({ __tak_dikenal: 1 }).success, a.nama).toBe(false);
    }
  });
});
