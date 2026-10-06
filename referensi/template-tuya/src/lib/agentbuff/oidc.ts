import * as oidc from "openid-client";
import { env } from "@/lib/env";
import { bukaSegel, segel } from "@/lib/kripto";

// Klien "Masuk dengan AgentBuff". Kontrak (AgentBuff Docs/MASUK-DENGAN-AGENTBUFF.md): issuer
// https://agentbuff.id/masuk, authorization code + PKCE S256, client_secret_basic,
// ID token ES256 dengan `sub` pairwise permanen. Tidak ada refresh token.

export const NAMA_COOKIE_OIDC = "__Host-tuya_oidc";
export const UMUR_COOKIE_OIDC_DTK = 10 * 60;
const INFO_SEGEL = "oidc-v1";

let _konfig: Promise<oidc.Configuration> | null = null;
let _gagalSampai = 0;

/** Konfigurasi dari discovery, dicache per proses. Gagal: jangan ulangi 30 dtk. */
export function konfigurasi(): Promise<oidc.Configuration> {
  if (_konfig) return _konfig;
  if (Date.now() < _gagalSampai) return Promise.reject(new Error("discovery AgentBuff baru saja gagal"));
  const issuer = new URL(env("AGENTBUFF_ISSUER"));
  _konfig = oidc
    .discovery(
      issuer,
      env("AGENTBUFF_MASUK_CLIENT_ID"),
      { id_token_signed_response_alg: "ES256" },
      oidc.ClientSecretBasic(env("AGENTBUFF_MASUK_CLIENT_SECRET")),
      { timeout: 10, execute: [oidc.enableNonRepudiationChecks] },
    )
    .catch((e) => {
      _konfig = null;
      _gagalSampai = Date.now() + 30_000;
      throw e;
    });
  return _konfig;
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
  dibuat: number;
};

/** Jalur tujuan sesudah masuk: hanya jalur internal /app... (anti open redirect). */
export function jalurLanjutAman(lanjut: string | null | undefined): string {
  if (!lanjut) return "/app";
  if (!lanjut.startsWith("/app") || lanjut.startsWith("//") || lanjut.includes("\\")) return "/app";
  return lanjut.slice(0, 500);
}

export async function mulaiMasuk(opsi: { senyap: boolean; lanjut: string | null; pilihAkun?: boolean }): Promise<{
  url: string;
  cookie: string;
}> {
  const konfig = await konfigurasi();
  const verifier = oidc.randomPKCECodeVerifier();
  const isi: IsiCookieOidc = {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    verifier,
    senyap: opsi.senyap,
    lanjut: jalurLanjutAman(opsi.lanjut),
    dibuat: Date.now(),
  };
  const param: Record<string, string> = {
    redirect_uri: alamatCallback(),
    scope: "openid email profile",
    state: isi.state,
    nonce: isi.nonce,
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    ui_locales: "id",
  };
  if (opsi.senyap) param.prompt = "none";
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

export type HasilCallback =
  | { jenis: "ok"; klaim: KlaimAgentBuff }
  | { jenis: "ditolak"; alasan: string }
  | { jenis: "perlu_interaktif" }
  | { jenis: "galat"; kode: string };

const ALASAN_TOLAK = new Set(["diblokir", "belum_aktif", "akses_berakhir", "belum_beli", "dibatalkan"]);

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
      return { jenis: "galat", kode: /^[a-z_]{1,40}$/.test(e.error) ? e.error : "galat_otorisasi" };
    }
    const kode = (e as { code?: string })?.code;
    return { jenis: "galat", kode: typeof kode === "string" && /^[A-Z_]{1,60}$/.test(kode) ? kode.toLowerCase() : "galat_tukar_kode" };
  }
}
