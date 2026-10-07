import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from "jose";
import { buatKlipTiruan } from "./suara";

// Server TIRUAN AgentBuff untuk pengembangan (`pnpm tiruan`, AGENTBUFF_TIRUAN=1) dan tes.
// Meniru kontrak publik, BUKAN kode AgentBuff:
//   * Masuk dengan AgentBuff (OIDC): discovery, authorize (layar pilih akun + izin), token,
//     userinfo, jwks. referensi/standar-agentbuff/PORTAL-MASUK-DENGAN-AGENTBUFF.md
//   * POST /masuk/status (cek hak).
//   * Pintu BARU persis docs/05-INTEGRASI-AGENTBUFF.md §4-§5: /masuk/kanal, /masuk/kabar,
//     /masuk/suara/daftar, /masuk/suara (audio = MP3 buatan skrip, ./suara.ts).
//   * Asersi sambung MCP otomatis (typ mcp-token+jwt) untuk menguji /api/agentbuff/mcp-token.
// Tambahan khusus tiruan di /_tiruan/* untuk mengatur keadaan dari tes peramban.
// Hanya untuk mesin pengembang dan tes: tidak pernah dibundel ke web/worker.

export const SCOPE_TAMBAHAN = ["agentbuff:kabar", "agentbuff:suara"] as const;
const SCOPE_DASAR = ["openid", "email", "profile"];

export type AlasanHakTiruan = "ok" | "akses_berakhir" | "belum_aktif" | "belum_beli" | "diblokir" | "dicabut";
export type PlatformTiruan = "telegram" | "whatsapp" | "discord" | "slack" | "google_chat";
export type KanalTiruan = { id: string; platform: PlatformTiruan; label: string; agen: string; siap: boolean; alasan?: string };

export type PenggunaTiruan = {
  sub: string;
  email: string;
  nama: string;
  foto: string | null;
  hak: AlasanHakTiruan;
  /** Izin yang sudah diberi pengguna di layar persetujuan AgentBuff. */
  izin: { kabar: boolean; suara: boolean };
  /** Mesin agen pengguna menyala (kalau tidak: 503 agen_tidak_aktif di kabar/suara). */
  agenAktif: boolean;
  kanal: KanalTiruan[];
  /** Penyedia suara menurut pengaturan suara pengguna (sama dengan Telepon Agent). */
  penyediaSuara: string;
  /** Layanan suara menolak (502 penyedia_gagal). */
  penyediaGagal: boolean;
  kuotaSuaraHarian: number;
};

export type KirimanTiruan = { id: string; sub: string; kanal: string; platform: PlatformTiruan; teks: string; kunci: string; waktu: number };
export type PermintaanSuaraTiruan = { sub: string; teks: string; gaya: string; suara: string; bahasa: string; waktu: number };

/** Batas minimal antar pesan per kanal (§4.2), ditegakkan AgentBuff. */
export const JEDA_MINIMAL_MS: Record<PlatformTiruan, number> = { telegram: 5_000, discord: 15_000, slack: 15_000, google_chat: 15_000, whatsapp: 30_000 };

const SUARA: Record<"id" | "en", Array<{ id: string; nama: string; gender: "perempuan" | "laki-laki" }>> = {
  id: [
    { id: "id-ID-GadisNeural", nama: "Gadis", gender: "perempuan" },
    { id: "id-ID-ArdiNeural", nama: "Ardi", gender: "laki-laki" },
  ],
  en: [
    { id: "en-US-JennyNeural", nama: "Jenny", gender: "perempuan" },
    { id: "en-US-GuyNeural", nama: "Guy", gender: "laki-laki" },
  ],
};

/** Akun contoh di layar masuk tiruan (sub pairwise tetap supaya data dev bertahan antar sesi). */
export const PERSONA: Array<Pick<PenggunaTiruan, "sub" | "nama" | "email" | "hak">> = [
  { sub: "ab_tiruan_nugi", nama: "Nugi Pratama", email: "nugi@contoh.id", hak: "ok" },
  { sub: "ab_tiruan_rani", nama: "Rani Belum Beli", email: "rani@contoh.id", hak: "belum_beli" },
  { sub: "ab_tiruan_dodi", nama: "Dodi Langganan Habis", email: "dodi@contoh.id", hak: "akses_berakhir" },
];

const PESAN_HAK: Record<AlasanHakTiruan | "tidak_dikenal", string> = {
  ok: "",
  akses_berakhir: "Langganan atau masa coba sudah berakhir.",
  belum_aktif: "Akun belum memulai masa coba atau langganan.",
  belum_beli: "Pengguna belum memiliki produk ini.",
  diblokir: "Akun diblokir.",
  dicabut: "Pemilik memutus sambungan aplikasi ini.",
  tidak_dikenal: "Sub tidak dikenal.",
};

function penggunaBawaan(sub: string, isi: Partial<PenggunaTiruan> = {}): PenggunaTiruan {
  const akhiran = createHash("sha256").update(sub).digest("hex").slice(0, 4);
  return {
    sub,
    email: `${sub}@contoh.id`,
    nama: "Pengguna Tiruan",
    foto: null,
    hak: "ok",
    izin: { kabar: true, suara: true },
    agenAktif: true,
    kanal: [
      { id: `k_tg${akhiran}`, platform: "telegram", label: "Telegram · bot Buff", agen: "Buff", siap: true },
      { id: `k_wa${akhiran}`, platform: "whatsapp", label: "WhatsApp · Rani", agen: "Rani", siap: false, alasan: "Belum pernah ada chat masuk dari kamu" },
      { id: `k_dc${akhiran}`, platform: "discord", label: "Discord · Buff", agen: "Buff", siap: true },
    ],
    penyediaSuara: "edge",
    penyediaGagal: false,
    kuotaSuaraHarian: 300,
    ...isi,
  };
}

export type OpsiTiruan = {
  clientId: string;
  clientSecret: string;
  /** redirect_uri yang terdaftar (persis). Kosong: semua http://localhost|127.0.0.1/auth/agentbuff/callback. */
  redirectUris?: string[];
  port?: number;
  host?: string;
  /** Alamat aplikasi AntiKebo (untuk /_tiruan/sambung-mcp). */
  appOrigin?: string;
  /** `sub` asing otomatis dikenal sebagai pengguna aktif (pengembangan dengan masuk AgentBuff asli). */
  kenalSemua?: boolean;
  /** Jam yang bisa diatur tes (jeda kanal, kuota, umur kode). */
  sekarang?: () => number;
};

export type AgentBuffTiruan = {
  url: string;
  issuer: string;
  /** Atur/buat pengguna. */
  atur(sub: string, ubah?: Partial<Omit<PenggunaTiruan, "sub">>): PenggunaTiruan;
  pengguna(sub: string): PenggunaTiruan | undefined;
  kiriman: KirimanTiruan[];
  permintaanSuara: PermintaanSuaraTiruan[];
  /** gangguan = semua pintu 503 (AgentBuff tidak terjangkau); scopeTambahan=false = AgentBuff belum mengenal izin kabar/suara. */
  keadaan: { gangguan: boolean; scopeTambahan: boolean };
  /** Asersi ES256 untuk POST <app>/api/agentbuff/mcp-token. */
  asersiMcp(sub: string, ubah?: { aud?: string; purpose?: string; umurDtk?: number; jti?: string; typ?: string }): Promise<string>;
  /** Tanda tangani JWT bebas dengan kunci Masuk (untuk menguji penolakan). */
  tandatangani(klaim: Record<string, unknown>, header?: { typ?: string }): Promise<string>;
  tutup(): Promise<void>;
};

// ------------------------------------------------------------ pembantu HTTP

function kirimJson(res: ServerResponse, status: number, badan: unknown, header: Record<string, string> = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...header });
  res.end(JSON.stringify(badan));
}

function alihkan(res: ServerResponse, ke: string, header: Record<string, string> = {}) {
  res.writeHead(303, { Location: ke, "Cache-Control": "no-store", ...header });
  res.end();
}

async function bacaBadan(req: IncomingMessage, batas = 64 * 1024): Promise<string> {
  const potong: Buffer[] = [];
  let n = 0;
  for await (const p of req) {
    n += (p as Buffer).length;
    if (n > batas) throw new Error("badan terlalu besar");
    potong.push(p as Buffer);
  }
  return Buffer.concat(potong).toString("utf8");
}

function aman(teks: string): string {
  return teks.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function samaAman(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function bacaCookie(req: IncomingMessage, nama: string): string | null {
  for (const bagian of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = bagian.trim().split("=");
    if (k === nama) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Tengah malam WIB berikutnya (kuota harian suara). */
function keTengahMalamWib(kini: number): number {
  const wib = kini + 7 * 3600_000;
  const besok = Math.floor(wib / 86_400_000 + 1) * 86_400_000;
  return besok - wib;
}

function hariWib(kini: number): string {
  return new Date(kini + 7 * 3600_000).toISOString().slice(0, 10);
}

// ------------------------------------------------------------ server

export async function mulaiAgentBuffTiruan(opsi: OpsiTiruan): Promise<AgentBuffTiruan> {
  const sekarang = opsi.sekarang ?? (() => Date.now());
  const host = opsi.host ?? "127.0.0.1";
  const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
  const kid = `tiruan-${randomBytes(4).toString("hex")}`;
  const jwkPublik: JWK = { ...(await exportJWK(publicKey)), kid, alg: "ES256", use: "sig" };

  const pengguna = new Map<string, PenggunaTiruan>();
  for (const p of PERSONA) pengguna.set(p.sub, penggunaBawaan(p.sub, p));
  const kode = new Map<string, { clientId: string; redirectUri: string; sub: string; nonce: string | null; scope: string; tantangan: string; dibuat: number }>();
  const aksesToken = new Map<string, { sub: string; scope: string; sampai: number }>();
  const kiriman: KirimanTiruan[] = [];
  const permintaanSuara: PermintaanSuaraTiruan[] = [];
  const idempoten = new Map<string, { id: string; waktu: number }>();
  const terakhirKanal = new Map<string, number>();
  const pakaiSuara = new Map<string, number>();
  const keadaan = { gangguan: false, scopeTambahan: true };

  let issuer = "";
  let url = "";

  const cari = (sub: string): PenggunaTiruan | undefined => {
    const p = pengguna.get(sub);
    if (p || !opsi.kenalSemua) return p;
    const baru = penggunaBawaan(sub);
    pengguna.set(sub, baru);
    return baru;
  };

  const redirectSah = (uri: string): boolean => {
    if (opsi.redirectUris?.length) return opsi.redirectUris.includes(uri);
    try {
      const u = new URL(uri);
      return (u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.pathname === "/auth/agentbuff/callback" && !u.search && !u.hash;
    } catch {
      return false;
    }
  };

  const klienSah = (req: IncomingMessage, badanForm?: URLSearchParams): boolean => {
    const auth = req.headers.authorization ?? "";
    if (auth.startsWith("Basic ")) {
      const [id, rahasia] = Buffer.from(auth.slice(6), "base64").toString("utf8").split(":");
      return samaAman(decodeURIComponent(id ?? ""), opsi.clientId) && samaAman(decodeURIComponent(rahasia ?? ""), opsi.clientSecret);
    }
    if (badanForm) return samaAman(badanForm.get("client_id") ?? "", opsi.clientId) && samaAman(badanForm.get("client_secret") ?? "", opsi.clientSecret);
    return false;
  };

  const tandatangani = (klaim: Record<string, unknown>, header: { typ?: string } = {}) =>
    new SignJWT(klaim).setProtectedHeader({ alg: "ES256", kid, typ: header.typ ?? "JWT" }).sign(privateKey as CryptoKey);

  const buatIdToken = (p: PenggunaTiruan, aud: string, nonce: string | null) => {
    const iat = Math.floor(sekarang() / 1000);
    return tandatangani({
      iss: issuer,
      aud,
      sub: p.sub,
      email: p.email,
      email_verified: true,
      name: p.nama,
      ...(p.foto ? { picture: p.foto } : {}),
      ...(nonce ? { nonce } : {}),
      auth_time: iat,
      iat,
      exp: iat + 600,
    });
  };

  // -------------------------------------------------------------- OIDC

  const metadata = () => ({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    subject_types_supported: ["pairwise"],
    id_token_signing_alg_values_supported: ["ES256"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...SCOPE_DASAR, ...(keadaan.scopeTambahan ? SCOPE_TAMBAHAN : [])],
    claims_supported: ["sub", "email", "email_verified", "name", "picture"],
    authorization_response_iss_parameter_supported: true,
  });

  type ParamOtorisasi = { clientId: string; redirectUri: string; state: string; nonce: string | null; scope: string[]; tantangan: string; prompt: string | null };

  /** Periksa permintaan otorisasi. Galat klien/redirect ditampilkan di tempat (tidak dialihkan, anti open redirect). */
  const periksaOtorisasi = (q: URLSearchParams): { ok: true; p: ParamOtorisasi } | { ok: false; galatDiTempat: string } | { ok: false; alihkan: string } => {
    const clientId = q.get("client_id") ?? "";
    const redirectUri = q.get("redirect_uri") ?? "";
    if (!samaAman(clientId, opsi.clientId)) return { ok: false, galatDiTempat: "Aplikasi tidak dikenal." };
    if (!redirectSah(redirectUri)) return { ok: false, galatDiTempat: "Alamat kembali tidak terdaftar." };
    const state = q.get("state") ?? "";
    const balik = (error: string, deskripsi?: string) => {
      const u = new URL(redirectUri);
      u.searchParams.set("error", error);
      if (deskripsi) u.searchParams.set("error_description", deskripsi);
      if (state) u.searchParams.set("state", state);
      u.searchParams.set("iss", issuer);
      return { ok: false as const, alihkan: u.toString() };
    };
    if (q.get("response_type") !== "code") return balik("unsupported_response_type");
    if (!state) return balik("invalid_request", "state wajib");
    const tantangan = q.get("code_challenge") ?? "";
    if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(tantangan)) return balik("invalid_request", "PKCE S256 wajib");
    const scope = (q.get("scope") ?? "").split(/\s+/).filter(Boolean);
    if (!scope.includes("openid")) return balik("invalid_scope");
    const dikenal = new Set<string>([...SCOPE_DASAR, ...(keadaan.scopeTambahan ? SCOPE_TAMBAHAN : [])]);
    if (scope.some((s) => !dikenal.has(s))) return balik("invalid_scope");
    return { ok: true, p: { clientId, redirectUri, state, nonce: q.get("nonce"), scope, tantangan, prompt: q.get("prompt") } };
  };

  const terbitkanKode = (p: ParamOtorisasi, u: PenggunaTiruan): string => {
    const diberi = p.scope.filter((s) => SCOPE_DASAR.includes(s) || (s === "agentbuff:kabar" && u.izin.kabar) || (s === "agentbuff:suara" && u.izin.suara));
    const c = randomBytes(24).toString("base64url");
    kode.set(c, { clientId: p.clientId, redirectUri: p.redirectUri, sub: u.sub, nonce: p.nonce, scope: diberi.join(" "), tantangan: p.tantangan, dibuat: sekarang() });
    const ke = new URL(p.redirectUri);
    ke.searchParams.set("code", c);
    ke.searchParams.set("state", p.state);
    ke.searchParams.set("iss", issuer);
    return ke.toString();
  };

  const tolakHak = (p: ParamOtorisasi, alasan: string): string => {
    const ke = new URL(p.redirectUri);
    ke.searchParams.set("error", "access_denied");
    ke.searchParams.set("error_description", alasan);
    ke.searchParams.set("state", p.state);
    ke.searchParams.set("iss", issuer);
    return ke.toString();
  };

  const halamanMasuk = (q: URLSearchParams, p: ParamOtorisasi, subSesi: string | null): string => {
    const tersembunyi = [...q.entries()].map(([k, v]) => `<input type="hidden" name="${aman(k)}" value="${aman(v)}">`).join("");
    const pilihan = [...PERSONA.map((x) => x.sub), ...(subSesi && !PERSONA.some((x) => x.sub === subSesi) ? [subSesi] : [])];
    const dipilih = subSesi ?? PERSONA[0].sub;
    const akun = pilihan
      .map((s) => {
        const u = cari(s) ?? penggunaBawaan(s);
        return `<label class="akun"><input type="radio" name="sub" value="${aman(s)}"${s === dipilih ? " checked" : ""}> <span>${aman(u.nama)}</span> <small>${aman(u.email)}${u.hak !== "ok" ? ` · ${aman(u.hak)}` : ""}</small></label>`;
      })
      .join("");
    const izin = [
      p.scope.includes("agentbuff:kabar") ? `<label><input type="checkbox" name="izin_kabar" value="1" checked> Kirim pesan lewat agenmu</label>` : "",
      p.scope.includes("agentbuff:suara") ? `<label><input type="checkbox" name="izin_suara" value="1" checked> Buat suara memakai pengaturan suaramu</label>` : "",
    ].join("");
    return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AgentBuff (tiruan)</title>
<style>body{font-family:system-ui,sans-serif;max-width:440px;margin:40px auto;padding:0 16px;color:#111}h1{font-size:22px}.akun{display:block;padding:10px;border:1px solid #ddd;border-radius:12px;margin:8px 0}small{color:#555}fieldset{border:0;padding:0;margin:16px 0}label{display:block;margin:6px 0}button{font-size:16px;padding:10px 18px;border-radius:999px;border:0;margin-right:8px}.utama{background:#111;color:#fff}.tiruan{background:#fff4d6;padding:8px 12px;border-radius:10px;font-size:13px}</style></head>
<body><p class="tiruan">Server tiruan AgentBuff untuk pengembangan. Bukan AgentBuff asli.</p><h1>Masuk ke AntiKebo</h1>
<form method="post" action="${aman(issuer)}/authorize">${tersembunyi}<fieldset><legend>Pilih akun</legend>${akun}</fieldset>${izin ? `<fieldset><legend>Izin tambahan</legend>${izin}</fieldset>` : ""}
<button class="utama" type="submit" name="aksi" value="izinkan">Lanjutkan</button><button type="submit" name="aksi" value="batal">Batal</button></form></body></html>`;
  };

  const layaniOtorisasi = async (req: IncomingMessage, res: ServerResponse, q: URLSearchParams, kirimanForm: URLSearchParams | null) => {
    const h = periksaOtorisasi(q);
    if (!h.ok) {
      if ("alihkan" in h) return alihkan(res, h.alihkan);
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><p>${aman(h.galatDiTempat)}</p>`);
    }
    const p = h.p;
    const subSesi = bacaCookie(req, "abt_sesi");
    const uSesi = subSesi ? cari(subSesi) : undefined;

    if (kirimanForm) {
      if (kirimanForm.get("aksi") === "batal") return alihkan(res, tolakHak(p, "dibatalkan"));
      const u = cari(kirimanForm.get("sub") ?? "");
      if (!u) {
        res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
        return res.end("<!doctype html><p>Akun tidak dikenal.</p>");
      }
      const kukiSesi = { "Set-Cookie": `abt_sesi=${encodeURIComponent(u.sub)}; Path=/; HttpOnly; SameSite=Lax` };
      if (u.hak !== "ok") return alihkan(res, tolakHak(p, u.hak), kukiSesi);
      // Izin yang diminta mengikuti centang; yang tidak diminta tidak berubah.
      if (p.scope.includes("agentbuff:kabar")) u.izin.kabar = kirimanForm.get("izin_kabar") === "1";
      if (p.scope.includes("agentbuff:suara")) u.izin.suara = kirimanForm.get("izin_suara") === "1";
      return alihkan(res, terbitkanKode(p, u), kukiSesi);
    }

    if (p.prompt === "none") {
      if (!uSesi) return alihkan(res, tolakDenganGalat(p, "login_required"));
      if (uSesi.hak !== "ok") return alihkan(res, tolakHak(p, uSesi.hak));
      // Masuk senyap: kode berisi izin yang SUDAH diberi; izin yang dulu ditolak tetap ditolak
      // sampai pengguna memilih "Beri izin" (prompt=consent).
      return alihkan(res, terbitkanKode(p, uSesi));
    }
    if (uSesi && uSesi.hak === "ok" && !p.prompt) return alihkan(res, terbitkanKode(p, uSesi));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(halamanMasuk(q, p, uSesi?.sub ?? null));
  };

  const tolakDenganGalat = (p: ParamOtorisasi, error: string): string => {
    const ke = new URL(p.redirectUri);
    ke.searchParams.set("error", error);
    ke.searchParams.set("state", p.state);
    ke.searchParams.set("iss", issuer);
    return ke.toString();
  };

  const layaniToken = async (req: IncomingMessage, res: ServerResponse) => {
    const f = new URLSearchParams(await bacaBadan(req));
    if (!klienSah(req, f)) return kirimJson(res, 401, { error: "invalid_client" }, { "WWW-Authenticate": 'Basic realm="agentbuff"' });
    if (f.get("grant_type") !== "authorization_code") return kirimJson(res, 400, { error: "unsupported_grant_type" });
    const c = kode.get(f.get("code") ?? "");
    kode.delete(f.get("code") ?? ""); // sekali pakai, apa pun hasilnya
    if (!c || sekarang() - c.dibuat > 5 * 60_000) return kirimJson(res, 400, { error: "invalid_grant" });
    if (c.redirectUri !== f.get("redirect_uri") || c.clientId !== opsi.clientId) return kirimJson(res, 400, { error: "invalid_grant" });
    const tantangan = createHash("sha256")
      .update(f.get("code_verifier") ?? "")
      .digest("base64url");
    if (tantangan !== c.tantangan) return kirimJson(res, 400, { error: "invalid_grant", error_description: "PKCE" });
    const u = cari(c.sub);
    if (!u) return kirimJson(res, 400, { error: "invalid_grant" });
    const akses = randomBytes(24).toString("base64url");
    aksesToken.set(akses, { sub: u.sub, scope: c.scope, sampai: sekarang() + 15 * 60_000 });
    kirimJson(res, 200, { access_token: akses, token_type: "Bearer", expires_in: 900, id_token: await buatIdToken(u, c.clientId, c.nonce), scope: c.scope });
  };

  const layaniUserinfo = (req: IncomingMessage, res: ServerResponse) => {
    const a = aksesToken.get((req.headers.authorization ?? "").replace(/^Bearer\s+/i, ""));
    if (!a || a.sampai < sekarang()) return kirimJson(res, 401, { error: "invalid_token" });
    const u = cari(a.sub)!;
    kirimJson(res, 200, { sub: u.sub, email: u.email, email_verified: true, name: u.nama, ...(u.foto ? { picture: u.foto } : {}) });
  };

  // -------------------------------------------------------------- status hak

  const layaniStatus = async (req: IncomingMessage, res: ServerResponse) => {
    if (!klienSah(req)) return kirimJson(res, 401, { error: "invalid_client" });
    const teks = await bacaBadan(req);
    let sub: string | null = null;
    let email: string | null = null;
    if ((req.headers["content-type"] ?? "").includes("application/json")) {
      try {
        const b = JSON.parse(teks) as { sub?: unknown; email?: unknown };
        sub = typeof b.sub === "string" ? b.sub : null;
        email = typeof b.email === "string" ? b.email : null;
      } catch {
        return kirimJson(res, 400, { error: "invalid_request" });
      }
    } else {
      const f = new URLSearchParams(teks);
      sub = f.get("sub");
      email = f.get("email");
    }
    const u = sub ? cari(sub) : email ? [...pengguna.values()].find((x) => x.email === email.toLowerCase()) : undefined;
    if (!u) return kirimJson(res, 200, { aktif: false, alasan: "tidak_dikenal", pesan: PESAN_HAK.tidak_dikenal });
    const aktif = u.hak === "ok";
    // Jalur email hanya mengembalikan sub bila pemiliknya berhak (kontrak).
    kirimJson(res, 200, { aktif, alasan: u.hak, pesan: PESAN_HAK[u.hak], ...(sub || aktif ? { sub: u.sub } : {}) });
  };

  // -------------------------------------------------------------- pintu baru (§4, §5)

  type HasilGerbang = { ok: true; u: PenggunaTiruan; b: Record<string, unknown> } | { ok: false };

  /** Urutan pemeriksaan semua pintu: klien, badan, sub, hak, izin. */
  const gerbangPintu = async (req: IncomingMessage, res: ServerResponse, izin: "kabar" | "suara"): Promise<HasilGerbang> => {
    if (!klienSah(req)) {
      kirimJson(res, 401, { alasan: "klien" });
      return { ok: false };
    }
    let b: Record<string, unknown>;
    try {
      const v = JSON.parse(await bacaBadan(req)) as unknown;
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("bukan objek");
      b = v as Record<string, unknown>;
    } catch {
      kirimJson(res, 400, { alasan: "permintaan_tidak_sah", pesan: "Badan harus objek JSON." });
      return { ok: false };
    }
    const u = typeof b.sub === "string" ? cari(b.sub) : undefined;
    if (!u) {
      kirimJson(res, 404, { alasan: "tidak_dikenal" });
      return { ok: false };
    }
    if (u.hak !== "ok") {
      kirimJson(res, 403, { alasan: "tidak_berhak", pesan: PESAN_HAK[u.hak] });
      return { ok: false };
    }
    if (!u.izin[izin]) {
      kirimJson(res, 403, { alasan: "belum_diizinkan", pesan: izin === "kabar" ? "Pengguna belum memberi izin kirim pesan." : "Pengguna belum memberi izin membuat suara." });
      return { ok: false };
    }
    return { ok: true, u, b };
  };

  const agenMati = (res: ServerResponse, u: PenggunaTiruan): boolean => {
    if (u.agenAktif) return false;
    kirimJson(res, 503, { alasan: "agen_tidak_aktif", pesan: "Mesin agen pengguna sedang mati." });
    return true;
  };

  const layaniKanal = async (req: IncomingMessage, res: ServerResponse) => {
    const g = await gerbangPintu(req, res, "kabar");
    if (!g.ok) return;
    kirimJson(res, 200, { kanal: g.u.kanal.map((k) => ({ ...k })) });
  };

  const layaniKabar = async (req: IncomingMessage, res: ServerResponse) => {
    const g = await gerbangPintu(req, res, "kabar");
    if (!g.ok) return;
    const { u, b } = g;
    if (typeof b.kanal !== "string" || typeof b.kunci !== "string" || !b.kunci || b.kunci.length > 64) {
      return kirimJson(res, 400, { alasan: "permintaan_tidak_sah", pesan: "kanal dan kunci (maks 64 huruf) wajib." });
    }
    if (typeof b.teks !== "string" || !b.teks.trim() || b.teks.length > 1000) return kirimJson(res, 422, { alasan: "teks_tidak_sah" });
    const kini = sekarang();
    const ik = `${u.sub}|${b.kunci}`;
    const lama = idempoten.get(ik);
    if (lama && kini - lama.waktu < 24 * 3600_000) return kirimJson(res, 200, { ok: true, id: lama.id });
    if (agenMati(res, u)) return;
    const k = u.kanal.find((x) => x.id === b.kanal);
    if (!k) return kirimJson(res, 409, { alasan: "kanal_tidak_siap", pesan: "Kanal ini sudah tidak ada." });
    if (!k.siap) return kirimJson(res, 409, { alasan: "kanal_tidak_siap", pesan: k.alasan ?? "Kanal belum siap." });
    const kk = `${u.sub}|${k.id}`;
    const terakhir = terakhirKanal.get(kk);
    const jeda = JEDA_MINIMAL_MS[k.platform];
    if (terakhir !== undefined && kini - terakhir < jeda) return kirimJson(res, 429, { alasan: "terlalu_cepat", ulangiSetelahMs: jeda - (kini - terakhir) });
    const id = `msg_${randomBytes(6).toString("hex")}`;
    terakhirKanal.set(kk, kini);
    idempoten.set(ik, { id, waktu: kini });
    kiriman.push({ id, sub: u.sub, kanal: k.id, platform: k.platform, teks: b.teks, kunci: b.kunci, waktu: kini });
    kirimJson(res, 200, { ok: true, id });
  };

  const layaniDaftarSuara = async (req: IncomingMessage, res: ServerResponse) => {
    const g = await gerbangPintu(req, res, "suara");
    if (!g.ok) return;
    if (g.b.bahasa !== "id" && g.b.bahasa !== "en") return kirimJson(res, 400, { alasan: "permintaan_tidak_sah", pesan: "bahasa harus id atau en." });
    const daftar = SUARA[g.b.bahasa];
    kirimJson(res, 200, { penyedia: g.u.penyediaSuara, bawaan: daftar[0].id, suara: daftar });
  };

  const layaniSuara = async (req: IncomingMessage, res: ServerResponse) => {
    const g = await gerbangPintu(req, res, "suara");
    if (!g.ok) return;
    const { u, b } = g;
    if (typeof b.teks !== "string" || !b.teks.trim() || b.teks.length > 300) return kirimJson(res, 422, { alasan: "teks_tidak_sah" });
    if (b.gaya !== "galak" && b.gaya !== "biasa") return kirimJson(res, 400, { alasan: "permintaan_tidak_sah", pesan: "gaya harus galak atau biasa." });
    if (b.bahasa !== "id" && b.bahasa !== "en") return kirimJson(res, 400, { alasan: "permintaan_tidak_sah", pesan: "bahasa harus id atau en." });
    if (agenMati(res, u)) return;
    const kini = sekarang();
    const kunciKuota = `${u.sub}|${hariWib(kini)}`;
    const terpakai = pakaiSuara.get(kunciKuota) ?? 0;
    if (terpakai >= u.kuotaSuaraHarian) return kirimJson(res, 429, { alasan: "kuota", ulangiSetelahMs: keTengahMalamWib(kini) });
    if (u.penyediaGagal) return kirimJson(res, 502, { alasan: "penyedia_gagal", pesan: "Layanan suara menolak permintaan (tiruan)." });
    const daftar = SUARA[b.bahasa];
    const pilihan = daftar.find((s) => s.id === b.suara) ?? daftar[0];
    pakaiSuara.set(kunciKuota, terpakai + 1);
    permintaanSuara.push({ sub: u.sub, teks: b.teks, gaya: b.gaya, suara: pilihan.id, bahasa: b.bahasa, waktu: kini });
    const klip = await buatKlipTiruan({ teks: b.teks, suara: pilihan.id, gaya: b.gaya, perempuan: pilihan.gender === "perempuan" });
    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(klip.audio.length),
      "Cache-Control": "no-store",
      "X-AgentBuff-Penyedia": u.penyediaSuara,
      "X-AgentBuff-Suara": pilihan.id,
      "X-AgentBuff-Durasi-Ms": String(klip.durasiMs),
    });
    res.end(klip.audio);
  };

  // -------------------------------------------------------------- MCP otomatis

  const asersiMcp: AgentBuffTiruan["asersiMcp"] = (sub, ubah = {}) => {
    const u = cari(sub) ?? penggunaBawaan(sub);
    const iat = Math.floor(sekarang() / 1000);
    return tandatangani(
      {
        iss: issuer,
        aud: ubah.aud ?? opsi.clientId,
        sub,
        purpose: ubah.purpose ?? "mcp_token",
        email: u.email,
        email_verified: true,
        name: u.nama,
        jti: ubah.jti ?? randomUUID(),
        iat,
        exp: iat + (ubah.umurDtk ?? 60),
      },
      { typ: ubah.typ ?? "mcp-token+jwt" },
    );
  };

  // -------------------------------------------------------------- kendali tiruan (/_tiruan)

  const layaniKendali = async (req: IncomingMessage, res: ServerResponse, jalur: string, q: URLSearchParams) => {
    if (jalur === "/_tiruan/status") return kirimJson(res, 200, { ok: true, issuer, pengguna: pengguna.size, keadaan });
    if (jalur === "/_tiruan/kiriman") return kirimJson(res, 200, { kiriman: kiriman.filter((k) => !q.get("sub") || k.sub === q.get("sub")) });
    if (req.method !== "POST") return kirimJson(res, 405, { error: "method" });
    let b: Record<string, unknown> = {};
    try {
      b = JSON.parse((await bacaBadan(req)) || "{}") as Record<string, unknown>;
    } catch {
      return kirimJson(res, 400, { error: "json" });
    }
    if (jalur === "/_tiruan/pengguna") {
      if (typeof b.sub !== "string" || !b.sub) return kirimJson(res, 400, { error: "sub" });
      const { sub, ...ubah } = b;
      return kirimJson(res, 200, atur(sub, ubah as Partial<PenggunaTiruan>));
    }
    if (jalur === "/_tiruan/keadaan") {
      if (typeof b.gangguan === "boolean") keadaan.gangguan = b.gangguan;
      if (typeof b.scopeTambahan === "boolean") keadaan.scopeTambahan = b.scopeTambahan;
      return kirimJson(res, 200, keadaan);
    }
    if (jalur === "/_tiruan/sambung-mcp") {
      // Meniru server AgentBuff yang meminta token MCP ke aplikasi sesudah pembelian.
      if (typeof b.sub !== "string" || !opsi.appOrigin) return kirimJson(res, 400, { error: "sub/appOrigin" });
      const r = await fetch(`${opsi.appOrigin}/api/agentbuff/mcp-token`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await asersiMcp(b.sub)}`, "Content-Type": "application/json" },
        body: "{}",
      });
      return kirimJson(res, 200, { status: r.status, badan: await r.json().catch(() => null) });
    }
    kirimJson(res, 404, { error: "tidak_ada" });
  };

  const atur: AgentBuffTiruan["atur"] = (sub, ubah = {}) => {
    const lama = pengguna.get(sub) ?? penggunaBawaan(sub);
    const baru: PenggunaTiruan = { ...lama, ...ubah, izin: { ...lama.izin, ...(ubah.izin ?? {}) }, sub };
    pengguna.set(sub, baru);
    return baru;
  };

  // -------------------------------------------------------------- penyalur

  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url ?? "/", "http://tiruan");
      const jalur = u.pathname;
      if (jalur.startsWith("/_tiruan/")) return await layaniKendali(req, res, jalur, u.searchParams);
      if (keadaan.gangguan) return kirimJson(res, 503, { error: "gangguan_tiruan" });
      if (req.method === "GET" && jalur === "/masuk/.well-known/openid-configuration") return kirimJson(res, 200, metadata());
      if (req.method === "GET" && jalur === "/masuk/jwks") return kirimJson(res, 200, { keys: [jwkPublik] });
      if (jalur === "/masuk/authorize") {
        if (req.method === "GET") return await layaniOtorisasi(req, res, u.searchParams, null);
        if (req.method === "POST") {
          const f = new URLSearchParams(await bacaBadan(req));
          return await layaniOtorisasi(req, res, f, f);
        }
      }
      if (req.method === "GET" && jalur === "/masuk/userinfo") return layaniUserinfo(req, res);
      if (req.method !== "POST") return kirimJson(res, 405, { error: "method" });
      if (jalur === "/masuk/token") return await layaniToken(req, res);
      if (jalur === "/masuk/status") return await layaniStatus(req, res);
      if (jalur === "/masuk/kanal") return await layaniKanal(req, res);
      if (jalur === "/masuk/kabar") return await layaniKabar(req, res);
      if (jalur === "/masuk/suara/daftar") return await layaniDaftarSuara(req, res);
      if (jalur === "/masuk/suara") return await layaniSuara(req, res);
      kirimJson(res, 404, { error: "tidak_ada" });
    } catch (e) {
      if (!res.headersSent) kirimJson(res, 500, { error: "galat_tiruan", pesan: (e as Error)?.message });
      else res.end();
    }
  });

  await new Promise<void>((ok, gagal) => {
    server.once("error", gagal);
    server.listen(opsi.port ?? 0, host, () => ok());
  });
  const port = (server.address() as AddressInfo).port;
  url = `http://${host}:${port}`;
  issuer = `${url}/masuk`;

  return {
    url,
    issuer,
    atur,
    pengguna: (sub) => pengguna.get(sub),
    kiriman,
    permintaanSuara,
    keadaan,
    asersiMcp,
    tandatangani,
    tutup: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections?.();
        server.close(() => ok());
      }),
  };
}
