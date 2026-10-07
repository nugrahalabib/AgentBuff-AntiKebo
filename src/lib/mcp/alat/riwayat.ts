import { z } from "zod";
import { isi } from "@/lib/i18n";
import { MENIT_UNDUH, riwayatPengguna, rincianKejadian, tokenUnduhRiwayat } from "@/lib/layanan/riwayat";
import { alat } from "../dasar";
import { SkemaId, tautan } from "./umum";

// Riwayat dan statistik (PRD K1 sampai K3). Isi soal dan jawaban tidak pernah dikirim.

const STATUS = { bangun: "woke_up", tidak_bangun: "did_not_wake", terlewat: "missed" } as const;

const getHistory = alat({
  nama: "get_history",
  judul: "Wake-up history",
  kelas: "baca",
  deskripsi:
    "Alarm events of the last 30 days, newest first: date, time, agenda, woke up / did not wake / missed, score, snoozes, minutes until the challenge was solved, spam messages sent. Use event ids with get_event_detail.",
  masukan: z.strictObject({ limit: z.int().min(1).max(100).optional().describe("Default 30") }),
  async jalankan(k, m) {
    const r = await riwayatPengguna(k.penggunaId);
    const d = r.kejadian.slice(0, m.limit ?? 30);
    return {
      data: {
        events: d.map((x) => ({
          event_id: x.id,
          date: x.tanggal,
          time: x.jam,
          title: x.judul,
          result: STATUS[x.status],
          score: x.skor,
          snoozes: x.tunda,
          minutes_to_wake: x.status === "bangun" ? x.menitSampaiBangun : null,
          spam_messages: x.pesanKanal,
        })),
      },
      teks: d.length ? d.map((x) => `${x.tanggal} ${x.jam} ${x.judul}: ${k.t.riwayat.status[x.status]}${x.skor !== null ? ` (${x.skor})` : ""}`).join("; ") : k.t.mcp.riwayatKosong,
    };
  },
});

const getWakeStats = alat({
  nama: "get_wake_stats",
  judul: "Wake-up score and streak",
  kelas: "baca",
  deskripsi: "Today's wake score (0 to 100), streak of good days, average minutes from ringing to solving the challenge, total snoozes, and daily scores for the last 30 days.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const r = await riwayatPengguna(k.penggunaId);
    const M = k.t.mcp;
    return {
      data: {
        today_score: r.skorHariIni,
        streak_days: r.beruntun,
        average_minutes_to_wake: r.rataMenit,
        snoozes_30_days: r.totalTunda,
        daily_scores: r.hari30.map((h, i) => ({ date: h, score: r.skor30[i] })),
      },
      teks: r.kejadian.length
        ? isi(M.riwayat, {
            skor: r.skorHariIni ?? M.belumAda,
            beruntun: r.beruntun,
            rata: r.rataMenit === null ? M.belumAda : isi(M.menit, { n: r.rataMenit }),
            tunda: r.totalTunda,
          })
        : M.riwayatKosong,
    };
  },
});

const getEventDetail = alat({
  nama: "get_event_detail",
  judul: "One alarm event in detail",
  kelas: "baca",
  deskripsi:
    "Details of one past alarm event: ring and solve times, challenges used (type, level, right/wrong; never their content), spam messages, devices on standby, who stopped it, and smart home results.",
  masukan: z.strictObject({ event_id: SkemaId.describe("From get_history") }),
  async jalankan(k, m) {
    const r = await rincianKejadian(k.penggunaId, m.event_id);
    return {
      data: {
        event: {
          event_id: r.id,
          title: r.judul,
          date: r.tanggal,
          time: r.jam,
          result: STATUS[r.status],
          score: r.skor,
          rang_at: r.berbunyi,
          solved_at: r.bangun,
          late_seconds: r.terlambatDtk,
          snoozes: r.tunda,
          failed_still_awake_check: r.gagalCek,
          stopped_by: r.selesaiOleh,
          stopping_device: r.perangkat,
          standby_devices: r.perangkatBerbunyi,
          challenges: r.soal.map((s) => ({ type: s.jenis, level: s.tingkat, purpose: s.tujuan === "tunda" ? "snooze" : "wake", result: s.status })),
          messages: r.kiriman.map((x) => ({ kind: x.jenis, number: x.ke, platform: x.platform, status: x.status })),
          smart_home: r.rumah.map((x) => ({ device: x.nama, result: x.hasil === "jalan" ? "done" : x.hasil })),
        },
      },
      teks: `${r.tanggal} ${r.jam} ${r.judul}: ${k.t.riwayat.status[r.status]}${r.skor !== null ? ` (${r.skor})` : ""}.`,
    };
  },
});

const exportHistory = alat({
  nama: "export_history",
  judul: "Export history as CSV",
  kelas: "baca",
  deskripsi: `A short-lived download link (valid ${MENIT_UNDUH} minutes) for the full history as a CSV file the user can open in Excel or Sheets.`,
  masukan: z.strictObject({}),
  async jalankan(k) {
    const { token, kedaluwarsa } = tokenUnduhRiwayat(k.penggunaId);
    const url = `${k.asal}/unduh/riwayat?t=${encodeURIComponent(token)}`;
    return { data: { download_url: url, expires_at: kedaluwarsa.toISOString(), history_url: tautan.riwayat(k) }, teks: isi(k.t.mcp.ekspor, { menit: MENIT_UNDUH, tautan: url }) };
  },
});

export const ALAT_RIWAYAT = [getHistory, getWakeStats, getEventDetail, exportHistory];
