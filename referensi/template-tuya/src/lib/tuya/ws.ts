import WebSocket from "ws";
import { bacaKunci } from "./wilayah";
import type { PesanWs } from "./tipe";

/**
 * Langganan peristiwa perangkat Tuya (wsmsgs.*). Kontrak resmi:
 * tuya-openclaw-skills/scripts/tuya_device_mq_client.py - header
 * `Authorization: <kunci>` (TANPA "Bearer"), pesan {eventType, data}.
 * Kode tutup fatal (1002/1003/1008/1011) = berhenti, jangan ulangi terus.
 * HANYA di server: kunci tidak boleh sampai peramban (aturan Tuya).
 */
export const KODE_FATAL = new Set([1002, 1003, 1008, 1011]);

export type PengamatWs = {
  pesan(p: PesanWs): void;
  tersambung(): void;
  terputus(info: { kode: number; fatal: boolean; alasan: string }): void;
};

export function sambungWs(kunci: string, pengamat: PengamatWs, opsi: { uri?: string } = {}): { tutup(): void } {
  const baca = bacaKunci(kunci);
  if (!baca.ok) throw new Error("kunci tidak sah");
  const ws = new WebSocket(opsi.uri ?? baca.wilayah.ws, { headers: { Authorization: baca.kunci }, handshakeTimeout: 15_000 });
  let hidup: ReturnType<typeof setInterval> | null = null;
  let selesai = false;

  ws.on("open", () => {
    pengamat.tersambung();
    hidup = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30_000);
  });
  ws.on("message", (data) => {
    try {
      const o = JSON.parse(String(data)) as Record<string, unknown>;
      // Bingkai galat dari server (bukan peristiwa perangkat).
      if (o.success === false || o.errorCode || o.errorMsg) return;
      if (o.eventType === "devicePropertyChange" || o.eventType === "onlineStatusChange") pengamat.pesan(o as unknown as PesanWs);
    } catch {
      /* bingkai bukan JSON: abaikan */
    }
  });
  const akhiri = (kode: number, alasan: string) => {
    if (selesai) return;
    selesai = true;
    if (hidup) clearInterval(hidup);
    pengamat.terputus({ kode, fatal: KODE_FATAL.has(kode), alasan: alasan.slice(0, 120) });
  };
  ws.on("close", (kode, alasan) => akhiri(kode, String(alasan ?? "")));
  ws.on("unexpected-response", (_req, res) => {
    akhiri(res.statusCode === 401 || res.statusCode === 403 ? 1008 : 1011, `HTTP ${res.statusCode}`);
    ws.terminate();
  });
  ws.on("error", (e) => akhiri(1006, e.message));
  return {
    tutup() {
      selesai = true;
      if (hidup) clearInterval(hidup);
      ws.terminate();
    },
  };
}
