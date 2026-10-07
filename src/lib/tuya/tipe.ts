// Disalin dari template AgentBuff-Tuya (`937aa8a`) tanpa perubahan perilaku.
/** Bentuk data API end-user Tuya (apa adanya dari kabel). */

export interface Rumah {
  home_id: string;
  name: string;
  role?: "owner" | "admin" | "member" | string;
  create_time?: number;
  latitude?: { Value?: string } | null;
  longitude?: { Value?: string } | null;
}

export interface Ruangan {
  room_id: string;
  name: string;
}

export interface PerangkatRingkas {
  device_id: string;
  name: string;
  category: string;
  category_name?: string;
  product_id?: string;
  online: boolean;
  room_id?: string;
}

export interface DetailPerangkat extends PerangkatRingkas {
  product_name?: string;
  firmware_version?: string;
  firmware_update_available?: boolean;
  properties?: Record<string, unknown>;
}

export type TypeSpec =
  | { type: "bool" }
  | { type: "value"; min: number; max: number; step?: number; scale?: number; unit?: string }
  | { type: "enum"; range: string[] }
  | { type: "string"; maxlen?: number }
  | { type: "raw" | "bitmap" | "struct" | "array" | "float" | "double" | "date"; [k: string]: unknown };

export interface PropertiModel {
  abilityId?: number;
  code: string;
  name?: string;
  description?: string;
  accessMode: "ro" | "rw" | "wr" | string;
  typeSpec: TypeSpec;
}

export interface ModelPerangkat {
  modelId?: string;
  services?: Array<{ code?: string; name?: string; description?: string; properties?: PropertiModel[] }>;
}

export interface JadwalStatistik {
  dev_id: string;
  dp_id?: number;
  dp_code: string;
  statistic_type: string;
  interval?: string;
}

/** Pesan WebSocket (wsmsgs.*) */
export type PesanWs =
  | { eventType: "devicePropertyChange"; data: { devId: string; status: Array<{ code: string; value: unknown; time?: number }> } }
  | { eventType: "onlineStatusChange"; data: { devId: string; status: "online" | "offline"; time?: number } };
