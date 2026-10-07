import * as oidc from "openid-client";
import { env, modeTiruan } from "@/lib/env";
import { bukaSegel, segel } from "@/lib/kripto";

// Klien "Masuk dengan AgentBuff". Kontrak (referensi/standar-agentbuff/PORTAL-MASUK-DENGAN-AGENTBUFF.md):
// issuer https://agentbuff.id/masuk, authorization code + PKCE S256, client_secret_basic,
// ID token ES256 dengan `sub` pairwise permanen. Tidak ada refresh token.
// AntiKebo meminta dua izin tambahan (docs/05-INTEGRASI-AGENTBUFF.md §1, PRD A3):
// `agentbuff:kabar` (kirim pesan lewat agen) dan `agentbuff:suara` (buat suara omelan).

export const NAMA_COOKIE_OIDC = "__Host-antikebo_oidc";
export const UMUR_COOKIE_OIDC_DTK = 10 * 60;
const INFO_SEGEL = "oidc-v1";

export const SCOPE_DASAR = "openid email profile";
export const SCOPE_KABAR = "agentbuff:kabar";
export const SCOPE_SUARA = "agentbuff:suara";
const SCOPE_PENUH = `${SCOPE_DASAR} ${SCOPE_KABAR} ${SCOPE_SUARA}`;

let _konfig: Promise<oidc.Configuration> | null = null;
let _gagalSampai = 0;

/** Konfigurasi dari discovery, dicache per proses. Gagal: jangan ulangi 30 dtk. */
export function konfigurasi(): Promise<oidc.Configuration> {
  if (_konfig) return _konfig;
  if (Date.now() < _gagalSampai) return Promise.reject(new Error("discovery AgentBuff baru saja gagal"));
  const issuer = new URL(env("AGENTBUFF_ISSUER"));
  // Server tiruan berjalan di http://127.0.0.1 (hanya pengembangan; env.ts menolak tiruan di luar localhost).
  const jalankan = modeTiruan() ? [oidc.enableNonRepudiationChecks, oidc.allowInsecureRequests] : [oidc.enableNonRepudiationChecks];
  _konfig = oidc
    .discovery(issuer, env("AGENTBUFF_MASUK_CLIENT_ID"), { id_token_signed_response_alg: "ES256" }, oidc.ClientSecretBasic(env("AGENTBUFF_MASUK_CLIENT_SECRET")), {
      timeout: 10,
      execute: jalankan,
    })
    .catch((e) => {
      _konfig = null;
      _gagalSampai = Date.now() + 30_000;
      throw e;
    });
  return _konfig;
}

/** Hanya untuk uji: lupakan konfigurasi discovery yang tersimpan. */
export function lupakanKonfigurasi() {
  _konfig = null;
  _gagalSampai = 0;
}

export function alamatCallback(): string {
  return `${env("APP_ORIGIN")}/auth/agentbuff/callback`;
}

export type IsiCookieOidc = {
  state: string;
  nonce: string;
  verifier: string;
  senyap: boolean;
  lanjut: string;
  /** Cakupan yang diminta: penuh (dengan izin kabar/suara) atau dasar (cadangan bila AgentBuff menolak scope). */
  cakupan: "penuh" | "dasar";
  dibuat: number;
};

/** Jalur tujuan sesudah masuk: hanya jalur internal /app... (anti open redirect). */
export function jalurLanjutAman(lanjut: string | null | undefined): string {
  if (!lanjut) return "/app";
  if (lanjut.startsWith("//") || lanjut.includes("\\")) return "/app";
  // Hanya halaman aplikasi sendiri: /app... dan "Sambungkan PC ini" (dibuka dari aplikasi PC).
  if (!/^\/app(?:[/?#]|$)/.test(lanjut) && !/^\/sambung-pc(?:[?#]|$)/.test(lanjut)) return "/app";
  return lanjut.slice(0, 500);
}

export async function mulaiMasuk(opsi: {
  senyap: boolean;
  lanjut: string | null;
  pilihAkun?: boolean;
  /** Ulangi persetujuan supaya pengguna bisa memberi izin kabar/suara yang dulu ditolak. */
  mintaIzin?: boolean;
  cakupan?: "penuh" | "dasar";
  bahasa?: "id" | "en";
}): Promise<{
  url: string;
  cookie: string;
}> {
  const konfig = await konfigurasi();
  const verifier = oidc.randomPKCECodeVerifier();
  const cakupan = opsi.cakupan ?? "penuh";
  const isi: IsiCookieOidc = {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verifier,
    senyap: opsi.senyap,
    lanjut: jalurLanjutAman(opsi.lanjut),
    cakupan,
    dibuat: Date.now(),
  };
  const param: Record<string, string> = {
    redirect_uri: alamatCallback(),
    scope: cakupan === "penuh" ? SCOPE_PENUH : SCOPE_DASAR,
    state: isi.state,
    nonce: isi.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    ui_locales: opsi.bahasa ?? "id",
  };
  if (opsi.senyap) param.prompt = "none";
  else if (opsi.mintaIzin) param.prompt = "consent";
  else if (opsi.pilihAkun) param.prompt = "select_account";
  return { url: oidc.buildAuthorizationUrl(konfig, param).toString(), cookie: segel(isi, INFO_SEGEL) };
}

export function bacaCookieOidc(nilai: string | undefined): IsiCookieOidc | null {
  if (!nilai) return null;
  const isi = bukaSegel<IsiCookieOidc>(nilai, INFO_SEGEL);
  if (!isi || Date.now() - isi.dibuat > UMUR_COOKIE_OIDC_DTK * 1000) return null;
  return isi;
}

export type KlaimAgentBuff = {
  sub: string;
  email: string | null;
  nama: string | null;
  foto: string | null;
};

export type IzinAgentBuff = { kabar: boolean; suara: boolean };

export type HasilCallback =
  | { jenis: "ok"; klaim: KlaimAgentBuff; izin: IzinAgentBuff }
  | { jenis: "ditolak"; alasan: string }
  | { jenis: "perlu_interaktif" }
  | { jenis: "cakupan_ditolak" }
  | { jenis: "galat"; kode: string };

const ALASAN_TOLAK = new Set(["diblokir", "belum_aktif", "akses_berakhir", "belum_beli", "dibatalkan"]);

/**
 * Izin dari `scope` jawaban token. RFC 6749 §5.1: `scope` boleh tidak ada bila sama
 * dengan yang diminta, jadi kosong = sama dengan permintaan.
 */
export function tafsirIzin(scopeJawaban: string | undefined, cakupanDiminta: "penuh" | "dasar"): IzinAgentBuff {
  const diberi = new Set((scopeJawaban ?? (cakupanDiminta === "penuh" ? SCOPE_PENUH : SCOPE_DASAR)).split(/\s+/).filter(Boolean));
  return { kabar: diberi.has(SCOPE_KABAR), suara: diberi.has(SCOPE_SUARA) };
}

/**
 * Proses callback. `state` dan `iss` DIPERIKSA SEBELUM `error` apa pun dibaca
 * (openid-client/oauth4webapi: validateAuthResponse), jadi galat palsu dari
 * pihak lain tidak bisa menggerakkan UI.
 */
export async function selesaikanMasuk(urlIni: URL, isi: IsiCookieOidc): Promise<HasilCallback> {
  const konfig = await konfigurasi();
  try {
    const token = await oidc.authorizationCodeGrant(konfig, urlIni, {
      pkceCodeVerifier: isi.verifier,
      expectedState: isi.state,
      expectedNonce: isi.nonce,
      idTokenExpected: true,
    });
    const k = token.claims();
    if (!k || typeof k.sub !== "string" || !k.sub) return { jenis: "galat", kode: "tanpa_sub" };
    const email = typeof k.email === "string" && k.email_verified === true ? k.email.toLowerCase() : null;
    return {
      jenis: "ok",
      klaim: {
        sub: k.sub,
        email,
        nama: typeof k.name === "string" ? k.name.slice(0, 120) : null,
        foto: typeof k.picture === "string" ? k.picture : null,
      },
      izin: tafsirIzin(typeof token.scope === "string" ? token.scope : undefined, isi.cakupan ?? "penuh"),
    };
  } catch (e) {
    if (e instanceof oidc.AuthorizationResponseError) {
      if (e.error === "access_denied") {
        const alasan = e.error_description ?? "";
        return { jenis: "ditolak", alasan: ALASAN_TOLAK.has(alasan) ? alasan : "tidak_diketahui" };
      }
      if (e.error === "login_required" || e.error === "consent_required" || e.error === "interaction_required") {
        return { jenis: "perlu_interaktif" };
      }
      // AgentBuff yang belum mengenal izin kabar/suara: masuk tetap jalan dengan cakupan dasar.
      if (e.error === "invalid_scope" && isi.cakupan !== "dasar") return { jenis: "cakupan_ditolak" };
      return { jenis: "galat", kode: /^[a-z_]{1,40}$/.test(e.error) ? e.error : "galat_otorisasi" };
    }
    const kode = (e as { code?: string })?.code;
    return { jenis: "galat", kode: typeof kode === "string" && /^[A-Z_]{1,60}$/.test(kode) ? kode.toLowerCase() : "galat_tukar_kode" };
  }
}
