import { z } from "zod";
import { KARAKTER } from "@/lib/alarm/isi";
import { denganPengguna } from "@/lib/db";
import { isi } from "@/lib/i18n";
import { daftarAlarm } from "@/lib/layanan/alarm";
import { buatKodeQr, daftarKodeQr, hapusKodeQr, ubahNamaKodeQr } from "@/lib/layanan/kode-qr";
import { konteksPengguna } from "@/lib/layanan/konteks";
import { buatUlangSuara, contohSuara, pilihanSuara } from "@/lib/layanan/suara";
import { buatTemplate, daftarTemplate, hapusTemplate, simpanAlarmSebagaiTemplate, ubahTemplate } from "@/lib/layanan/template";
import { alat, type KonteksAlat } from "../dasar";
import { dariIsi, keMasukanAlarm, SkemaAlarmMcp } from "../peta";
import { SkemaId, tautan } from "./umum";

// Template (PRD B10), suara dan karakter (PRD F), kode QR Misi (PRD D4).

const SkemaIsiTemplateMcp = SkemaAlarmMcp.omit({ enabled: true });
const NamaTemplate = z.string().min(1).max(40);

function isiTemplateInternal(m: z.infer<typeof SkemaIsiTemplateMcp>) {
  const x = keMasukanAlarm(m);
  delete x.aktif;
  return x;
}

const listTemplates = alat({
  nama: "list_templates",
  judul: "List alarm templates",
  kelas: "baca",
  deskripsi: "Built-in templates (ids start with 'bawaan:') and the user's own templates, with their settings. Pass a template id to create_alarm to start from it.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const d = await daftarTemplate(k.penggunaId);
    return {
      data: { templates: d.map((x) => ({ id: x.id, name: x.nama, built_in: x.bawaan, description: x.keterangan, settings: dariIsi(x.isi) })) },
      teks: isi(k.t.mcp.templateDaftar, { n: d.length, isi: d.map((x) => (x.bawaan ? `${x.nama} (${k.t.mcp.templateBawaan})` : x.nama)).join(", ") }),
    };
  },
});

const createTemplate = alat({
  nama: "create_template",
  judul: "Create a template",
  kelas: "tulis",
  idempoten: true,
  deskripsi: "Save a reusable set of alarm settings under a name (max 20 own templates). Use save_alarm_as_template to copy an existing alarm instead.",
  masukan: z.strictObject({ name: NamaTemplate, settings: SkemaIsiTemplateMcp }),
  async jalankan(k, m) {
    const t = await buatTemplate(k.penggunaId, { nama: m.name, isi: isiTemplateInternal(m.settings) }, "agen");
    return { data: { template: { id: t.id, name: t.nama, settings: dariIsi(t.isi) } }, teks: isi(k.t.mcp.templateDibuat, { nama: t.nama }) };
  },
});

const saveAlarmAsTemplate = alat({
  nama: "save_alarm_as_template",
  judul: "Save an alarm as a template",
  kelas: "tulis",
  idempoten: true,
  deskripsi: "Copy all settings of an existing alarm into a new template with the given name.",
  masukan: z.strictObject({ alarm_id: SkemaId, name: NamaTemplate }),
  async jalankan(k, m) {
    const t = await simpanAlarmSebagaiTemplate(k.penggunaId, m.alarm_id, m.name, "agen");
    return { data: { template: { id: t.id, name: t.nama, settings: dariIsi(t.isi) } }, teks: isi(k.t.mcp.templateDibuat, { nama: t.nama }) };
  },
});

const updateTemplate = alat({
  nama: "update_template",
  judul: "Update a template",
  kelas: "tulis",
  deskripsi: "Rename one of the user's own templates and/or replace its settings. Built-in templates cannot be changed.",
  masukan: z.strictObject({ template_id: z.string().min(1).max(80), name: NamaTemplate.optional(), settings: SkemaIsiTemplateMcp.optional() }),
  async jalankan(k, m) {
    const t = await ubahTemplate(k.penggunaId, m.template_id, { ...(m.name ? { nama: m.name } : {}), ...(m.settings ? { isi: isiTemplateInternal(m.settings) } : {}) }, "agen");
    return { data: { template: { id: t.id, name: t.nama, settings: dariIsi(t.isi) } }, teks: isi(k.t.mcp.templateDiubah, { nama: t.nama }) };
  },
});

const deleteTemplate = alat({
  nama: "delete_template",
  judul: "Delete a template",
  kelas: "tulis",
  merusak: true,
  deskripsi: "Delete one of the user's own templates (alarms made from it are not changed). Confirm with the user first, then call with confirm:true.",
  masukan: z.strictObject({ template_id: z.string().min(1).max(80), confirm: z.literal(true) }),
  async jalankan(k, m) {
    const nama = (await daftarTemplate(k.penggunaId)).find((x) => x.id === m.template_id)?.nama ?? m.template_id;
    await hapusTemplate(k.penggunaId, m.template_id, "agen");
    return { data: { deleted: true, template_id: m.template_id }, teks: isi(k.t.mcp.templateDihapus, { nama }) };
  },
});

// ------------------------------------------------------------------ suara

async function namaSapaan(k: KonteksAlat): Promise<string> {
  return denganPengguna(k.penggunaId, async (tx) => (await konteksPengguna(tx, k.penggunaId)).namaSapaan);
}

const listCharacters = alat({
  nama: "list_characters",
  judul: "Scolding characters",
  kelas: "baca",
  deskripsi: "The scolding characters with a sample line each (already using the user's nickname). 'kustom' speaks only the user's personal lines.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const nama = await namaSapaan(k);
    const daftar = KARAKTER.map((id) => ({ id, name: k.t.karakter[id].nama, style: k.t.karakter[id].rasa, sample: isi(k.t.karakter[id].contoh, { nama }) }));
    return { data: { characters: daftar }, teks: isi(k.t.mcp.karakter, { isi: daftar.map((x) => `${x.name} (${x.id}): "${x.sample}"`).join("; ") }) };
  },
});

const listVoices = alat({
  nama: "list_voices",
  judul: "Voices from AgentBuff",
  kelas: "baca",
  deskripsi: "Voices the user's AgentBuff can speak the scolding with (the user's own voice settings). Use an id as voice_id in an alarm; null = AgentBuff default.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const d = await pilihanSuara(k.penggunaId);
    return {
      data: { provider: d.penyedia, default_voice: d.bawaan, voices: d.suara.map((x) => ({ id: x.id, name: x.nama, gender: x.gender })) },
      teks: isi(k.t.mcp.suaraDaftar, { penyedia: d.penyedia, isi: d.suara.map((x) => `${x.nama} (${x.id})`).join(", ") }),
    };
  },
});

const previewVoice = alat({
  nama: "preview_voice",
  judul: "Voice sample",
  kelas: "tulis",
  deskripsi:
    "Ask the user's AgentBuff to speak one short sample with a voice. When ready, returns an audio link the user can open (signed in to AntiKebo); if still being made, call again in a few seconds.",
  masukan: z.strictObject({ voice_id: z.string().min(1).max(120).nullable().describe("null = AgentBuff default voice") }),
  async jalankan(k, m) {
    const h = await contohSuara(k.penggunaId, m.voice_id);
    const siap = h.status === "siap";
    return {
      data: { status: siap ? "ready" : h.status === "gagal" ? "failed" : "making", audio_url: siap ? tautan.klip(k, h.hash) : null },
      teks: siap ? isi(k.t.mcp.contohSiap, { tautan: tautan.klip(k, h.hash) }) : k.t.mcp.contohDibuat,
    };
  },
});

const getVoiceStatus = alat({
  nama: "get_voice_status",
  judul: "Scolding voice status",
  kelas: "baca",
  deskripsi:
    "Whether the scolding voice clips of each active alarm are ready, being made, or blocked (with the reason, e.g. permission not granted). Alarms always ring even without clips.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const d = (await daftarAlarm(k.penggunaId)).filter((a) => a.aktif);
    const M = k.t.mcp;
    const teksStatus = (s: (typeof d)[number]["suara"]) =>
      s.status === "siap" ? M.suaraSiap : s.status === "dibuat" ? isi(M.suaraDibuat, { n: s.n, total: s.total }) : isi(M.suaraBelum, { alasan: s.alasan });
    return {
      data: { alarms: d.map((a) => ({ alarm_id: a.id, title: a.agendaJudul, voice: a.suara })) },
      teks: d.length ? isi(M.suaraStatus, { isi: d.map((a) => `${a.agendaJudul}: ${teksStatus(a.suara)}`).join("; ") }) : M.alarmKosong,
    };
  },
});

const regenerateVoice = alat({
  nama: "regenerate_voice",
  judul: "Remake scolding voices",
  kelas: "tulis",
  deskripsi:
    "Queue failed scolding lines again (e.g. after the user granted the voice permission or fixed their AgentBuff agent). Clips are made by the user's AgentBuff in the background.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const n = await buatUlangSuara(k.penggunaId);
    return { data: { requeued: n }, teks: isi(k.t.mcp.suaraUlang, { n }) };
  },
});

// ------------------------------------------------------------------ kode QR

const NamaKode = z.string().min(1).max(40).describe("Where the code will be stuck, e.g. 'Kamar mandi'");

const createWakeCode = alat({
  nama: "create_wake_code",
  judul: "Create a QR wake code",
  kelas: "tulis",
  idempoten: true,
  deskripsi:
    "Make a QR code for the QR Mission challenge (max 10). Returns the print page link; the user prints it and sticks it far from the bed. Then use its id in challenge.qr_code_ids.",
  masukan: z.strictObject({ name: NamaKode }),
  async jalankan(k, m) {
    const q = await buatKodeQr(k.penggunaId, m.name, "agen");
    return {
      data: { wake_code: { id: q.id, name: q.nama, print_url: tautan.cetakQr(k, q.id) } },
      teks: isi(k.t.mcp.kodeQrDibuat, { nama: q.nama, tautan: tautan.cetakQr(k, q.id) }),
    };
  },
});

const listWakeCodes = alat({
  nama: "list_wake_codes",
  judul: "List QR wake codes",
  kelas: "baca",
  deskripsi: "The user's QR wake codes, how many alarms use each, and their print links.",
  masukan: z.strictObject({}),
  async jalankan(k) {
    const d = await daftarKodeQr(k.penggunaId);
    return {
      data: { wake_codes: d.map((q) => ({ id: q.id, name: q.nama, used_by_alarms: q.dipakai, print_url: tautan.cetakQr(k, q.id) })) },
      teks: d.length ? isi(k.t.mcp.kodeQrDaftar, { n: d.length, isi: d.map((q) => q.nama).join(", ") }) : k.t.mcp.kodeQrKosong,
    };
  },
});

const renameWakeCode = alat({
  nama: "rename_wake_code",
  judul: "Rename a QR wake code",
  kelas: "tulis",
  deskripsi: "Rename a QR wake code (the printed code keeps working).",
  masukan: z.strictObject({ wake_code_id: SkemaId, name: NamaKode }),
  async jalankan(k, m) {
    const q = await ubahNamaKodeQr(k.penggunaId, m.wake_code_id, m.name, "agen");
    return { data: { wake_code: { id: q.id, name: q.nama } }, teks: isi(k.t.mcp.kodeQrDiubah, { nama: q.nama }) };
  },
});

const deleteWakeCode = alat({
  nama: "delete_wake_code",
  judul: "Delete a QR wake code",
  kelas: "tulis",
  merusak: true,
  deskripsi: "Delete a QR wake code. Rejected while an alarm still uses it (its challenge would become impossible). Confirm first, then call with confirm:true.",
  masukan: z.strictObject({ wake_code_id: SkemaId, confirm: z.literal(true) }),
  async jalankan(k, m) {
    const nama = (await daftarKodeQr(k.penggunaId)).find((q) => q.id === m.wake_code_id)?.nama ?? "";
    await hapusKodeQr(k.penggunaId, m.wake_code_id, "agen");
    return { data: { deleted: true, wake_code_id: m.wake_code_id }, teks: isi(k.t.mcp.kodeQrDihapus, { nama }) };
  },
});

export const ALAT_TEMPLATE_SUARA = [
  listTemplates,
  createTemplate,
  saveAlarmAsTemplate,
  updateTemplate,
  deleteTemplate,
  listCharacters,
  listVoices,
  previewVoice,
  getVoiceStatus,
  regenerateVoice,
  createWakeCode,
  listWakeCodes,
  renameWakeCode,
  deleteWakeCode,
];
