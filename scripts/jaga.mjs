#!/usr/bin/env node
// Penjaga AntiKebo (pola BYM, disalin dari template Tuya): dipanggil `pnpm build` SEBELUM
// `next build` (bukan prebuild: pnpm tidak menjalankan pre-script secara bawaan) dan di CI.
// Setiap penjaga punya UJI-DIRI: dijalankan pada contoh buruk dan WAJIB menemukan
// pelanggaran; penjaga yang tidak bisa gagal lebih buruk daripada tidak ada (pelajaran
// AgentBuff). Gagal satu = build gagal. `referensi/` tidak pernah diperiksa (hanya dibaca).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const AKAR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");

function semuaBerkas(dir, cocok) {
  const hasil = [];
  if (!existsSync(dir)) return hasil;
  for (const nama of readdirSync(dir)) {
    const p = path.join(dir, nama);
    if (statSync(p).isDirectory()) hasil.push(...semuaBerkas(p, cocok));
    else if (cocok(p)) hasil.push(p);
  }
  return hasil;
}
const baca = (p) => readFileSync(p, "utf8");
const rel = (p) => path.relative(AKAR, p).replaceAll("\\", "/");

// ------------------------------------------------------------ naskah keras
// Teks layar WAJIB lewat kamus. Pelanggaran: JsxText berhuruf, atau atribut
// teks (title/placeholder/aria-label/alt/label) berisi literal berhuruf.
const ATRIBUT_TEKS = new Set(["title", "placeholder", "aria-label", "alt", "label", "aria-description"]);
function periksaNaskah(sumber, nama = "contoh.tsx") {
  const sf = ts.createSourceFile(nama, sumber, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const temuan = [];
  const baris = sumber.split("\n");
  const dibolehkan = (node) => {
    const n = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    return /naskah-boleh/.test(baris[n] ?? "") || /naskah-boleh/.test(baris[n - 1] ?? "");
  };
  const kunjungi = (node) => {
    if (ts.isJsxText(node)) {
      const teks = node.getText(sf).trim();
      if (/\p{L}{2,}/u.test(teks) && !dibolehkan(node)) temuan.push(`teks "${teks.slice(0, 40)}"`);
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const nm = node.name.getText(sf);
      if (ATRIBUT_TEKS.has(nm) && /\p{L}{2,}/u.test(node.initializer.text) && !dibolehkan(node)) temuan.push(`${nm}="${node.initializer.text.slice(0, 40)}"`);
    }
    ts.forEachChild(node, kunjungi);
  };
  kunjungi(sf);
  return temuan;
}

// ------------------------------------------------------------------ proxy
function periksaProxy(sumberProxy, adaDiAkar) {
  const temuan = [];
  if (adaDiAkar) temuan.push("proxy.ts/middleware.ts di akar repo TIDAK dikompilasi: pindahkan ke src/proxy.ts");
  if (sumberProxy === null) return [...temuan, "src/proxy.ts tidak ada"];
  if (!/"Cache-Control",\s*"[^"]*no-transform/.test(sumberProxy))
    temuan.push("src/proxy.ts wajib memasang Cache-Control ber-no-transform (Cloudflare menyisipkan skrip analitik ke HTML)");
  const sf = ts.createSourceFile("proxy.ts", sumberProxy, ts.ScriptTarget.Latest, true);
  let matcher = null;
  sf.forEachChild((n) => {
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) {
        if (d.name.getText(sf) === "config" && d.initializer && ts.isObjectLiteralExpression(d.initializer)) {
          for (const p of d.initializer.properties) if (p.name?.getText(sf) === "matcher") matcher = p.initializer;
        }
      }
    }
  });
  if (!matcher) return [...temuan, "config.matcher tidak ditemukan"];
  const literalMurni = (n) =>
    ts.isStringLiteral(n) ||
    ts.isNoSubstitutionTemplateLiteral(n) ||
    (ts.isArrayLiteralExpression(n) && n.elements.every(literalMurni)) ||
    (ts.isObjectLiteralExpression(n) && n.properties.every((p) => ts.isPropertyAssignment(p) && literalMurni(p.initializer))) ||
    n.kind === ts.SyntaxKind.TrueKeyword ||
    n.kind === ts.SyntaxKind.FalseKeyword;
  if (!literalMurni(matcher)) temuan.push("config.matcher WAJIB literal (Next membaca lewat AST; variabel diabaikan diam-diam)");
  return temuan;
}

// ------------------------------------------------------------ server-only
function periksaServerOnly(sumber) {
  return /^\s*import\s+["']server-only["']/m.test(sumber) ? ["import 'server-only' di modul bersama (dipakai worker/tsx → melempar)"] : [];
}

// ---------------------------------------------------------------------- RLS
// Tabel milik pemilik = ber-kolom pengguna_id, KECUALI tabel global yang dibaca
// tanpa konteks (sesi & status hak: dicari lewat hash/sub sebelum pemilik diketahui).
// Tabel ber-pengguna_id yang SENGAJA global (dicari sebelum pemilik diketahui): sesi (hash sesi),
// status_hak (cek hak), kode_sambung (kode sambung PC, P3).
const TABEL_GLOBAL = new Set(["sesi", "status_hak", "kode_sambung"]);
function tabelBerRuang(schemaTs) {
  const hasil = new Set();
  const re = /pgTable\(\s*"([a-z_]+)"[\s\S]*?\n\s*(?:\},\s*\(t\)|\}\);)/g;
  let m;
  while ((m = re.exec(schemaTs))) if (/uuid\("pengguna_id"\)/.test(m[0]) && !TABEL_GLOBAL.has(m[1])) hasil.add(m[1]);
  return [...hasil];
}
function periksaRls(tabel, sqlGabung) {
  const t = [];
  for (const nm of tabel) {
    if (!new RegExp(`ALTER TABLE ${nm} ENABLE ROW LEVEL SECURITY`).test(sqlGabung)) t.push(`${nm}: ENABLE ROW LEVEL SECURITY tidak ada`);
    if (!new RegExp(`ALTER TABLE ${nm} FORCE ROW LEVEL SECURITY`).test(sqlGabung)) t.push(`${nm}: FORCE ROW LEVEL SECURITY tidak ada`);
    const n = (sqlGabung.match(new RegExp(`CREATE POLICY \\w+ ON ${nm}\\b`, "g")) ?? []).length;
    if (n < 2) t.push(`${nm}: butuh ≥ 2 kebijakan (baca & tulis), ada ${n}`);
  }
  return t;
}

// ------------------------------------------------------- kolom di subquery
// Di select SATU tabel drizzle menulis ${schema.t.kolom} sebagai "kolom" saja
// (tanpa nama tabel). Di dalam subquery nama itu terbaca sebagai kolom tabel
// DALAM, mis. `t.dompet_id = "id"` jadi `t.dompet_id = t.id` (hasil selalu 0,
// diam). Di dalam sql`… select …` kolom luar WAJIB ditulis berkualifikasi.
function periksaKolomSubquery(sumber, nama = "contoh.ts") {
  const sf = ts.createSourceFile(nama, sumber, ts.ScriptTarget.Latest, true, nama.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const temuan = [];
  const kunjungi = (node) => {
    if (ts.isTaggedTemplateExpression(node) && /^sql\b/.test(node.tag.getText(sf)) && ts.isTemplateExpression(node.template)) {
      const teks = [node.template.head.text, ...node.template.templateSpans.map((s) => s.literal.text)].join(" ");
      if (/\bselect\b/i.test(teks)) {
        for (const s of node.template.templateSpans) {
          const e = s.expression.getText(sf);
          if (/^schema\.\w+\.\w+$/.test(e)) temuan.push(`\${${e}} di dalam subquery (tulis "tabel"."kolom")`);
        }
      }
    }
    ts.forEachChild(node, kunjungi);
  };
  kunjungi(sf);
  return temuan;
}

// ------------------------------------------------------------------ akhir baris
function periksaLf(sumber) {
  return sumber.includes("\r") ? ["berakhir-baris CRLF (dieksekusi Linux → gagal boot)"] : [];
}

// --------------------------------------------------------- karakter kendali
// Karakter kendali tak terlihat (mis. backspace U+0008 hasil salah-escape
// "\b" di skrip penyunting) membuat regex diam-diam tidak pernah cocok.
function periksaKendali(sumber) {
  const m = sumber.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
  return m ? [`karakter kendali U+${m[0].charCodeAt(0).toString(16).padStart(4, "0")} tersembunyi`] : [];
}

// ------------------------------------------------------------ batas klien
// Modul server (page/layout/route) yang mengimpor NILAI non-komponen dari
// modul "use client" menerima REFERENSI KLIEN, bukan nilainya, mis.
// `TAB_LAPORAN.includes` melempar TypeError saat render (500), padahal tsc,
// eslint, dan uji semuanya hijau. Komponen (PascalCase) & impor tipe boleh.
const adaUseClient = (s) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(s);
function periksaBatasKlien(sumber, bacaModul) {
  if (adaUseClient(sumber)) return [];
  const sf = ts.createSourceFile("server.tsx", sumber, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const temuan = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || st.importClause.isTypeOnly) continue;
    const dari = st.moduleSpecifier.text;
    const modul = bacaModul(dari);
    if (modul === null || !adaUseClient(modul)) continue;
    const nama = [];
    if (st.importClause.name) nama.push(st.importClause.name.text);
    const ikat = st.importClause.namedBindings;
    if (ikat && ts.isNamedImports(ikat)) for (const el of ikat.elements) if (!el.isTypeOnly) nama.push(el.name.text);
    if (ikat && ts.isNamespaceImport(ikat)) nama.push(`* as ${ikat.name.text}`);
    for (const n of nama) if (!/^[A-Z][a-z0-9]/.test(n)) temuan.push(`mengimpor nilai "${n}" dari modul klien ${dari}`);
  }
  return temuan;
}
// ------------------------------------------------------------ kamus klien
// Modul klien (dan `src/lib/i18n/index.ts`, yang diimpor komponen klien lewat `isi`) dilarang
// mengimpor NILAI kamus / `kamus-server`: kalau tidak, setiap pengunjung mengunduh kedua bahasa.
// Satu-satunya pintu: import() DINAMIS di `src/lib/i18n/klien.tsx` (impor statis, bahkan di
// komponen penyedia terpisah per bahasa, tetap membundel keduanya; terukur di template).
function periksaKamusKlien(sumber, nama) {
  if (!adaUseClient(sumber) && !/src\/lib\/i18n\/index\.ts$/.test(nama)) return [];
  const sf = ts.createSourceFile("k.tsx", sumber, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const temuan = [];
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || st.importClause?.isTypeOnly) continue;
    const dari = st.moduleSpecifier.text;
    if (!/(^|\/)kamus\/(id|en)$|kamus-server$/.test(dari)) continue;
    const ikat = st.importClause?.namedBindings;
    const semuaTipe = ikat && ts.isNamedImports(ikat) && !st.importClause.name && ikat.elements.every((e) => e.isTypeOnly);
    if (!semuaTipe) temuan.push(`mengimpor isi kamus dari ${dari} di modul yang sampai ke peramban`);
  }
  return temuan;
}

function bacaModulAlias(dari) {
  if (!dari.startsWith("@/")) return null;
  const dasar = path.join(AKAR, "src", dari.slice(2));
  for (const c of [".tsx", ".ts", "/index.tsx", "/index.ts"]) if (existsSync(dasar + c)) return baca(dasar + c);
  return null;
}

// ================================================================ jalankan
const PENJAGA = [
  {
    nama: "naskah-keras",
    ujiDiri: () => periksaNaskah('const A = () => <p title="Halo dunia">Halo semua</p>;').length === 2 && periksaNaskah("const A = () => <p>{t.x}</p>;").length === 0,
    jalankan: () => semuaBerkas(path.join(AKAR, "src"), (p) => p.endsWith(".tsx")).flatMap((p) => periksaNaskah(baca(p), p).map((x) => `${rel(p)}: ${x}`)),
  },
  {
    nama: "proxy",
    ujiDiri: () =>
      periksaProxy("export const config = { matcher: POLA };", false).length > 0 &&
      periksaProxy('export const config = { matcher: ["/a"] };', true).length > 0 &&
      periksaProxy('export const config = { matcher: [{ source: "/x", missing: [{ type: "header", key: "a" }] }] };', false).length === 1 &&
      periksaProxy('h.set("Cache-Control", "no-store, no-transform"); export const config = { matcher: [{ source: "/x", missing: [{ type: "header", key: "a" }] }] };', false)
        .length === 0,
    jalankan: () => {
      const p = path.join(AKAR, "src/proxy.ts");
      const akar = ["proxy.ts", "middleware.ts", "src/middleware.ts"].some((n) => existsSync(path.join(AKAR, n)));
      return periksaProxy(existsSync(p) ? baca(p) : null, akar);
    },
  },
  {
    nama: "server-only",
    ujiDiri: () => periksaServerOnly('import "server-only";').length === 1 && periksaServerOnly("import x from 'y';").length === 0,
    jalankan: () =>
      semuaBerkas(path.join(AKAR, "src/lib"), (p) => /\.tsx?$/.test(p))
        .concat(semuaBerkas(path.join(AKAR, "src/worker"), (p) => /\.tsx?$/.test(p)))
        .flatMap((p) => periksaServerOnly(baca(p)).map((x) => `${rel(p)}: ${x}`)),
  },
  {
    nama: "rls",
    ujiDiri: () =>
      tabelBerRuang(
        'export const a = pgTable(\n  "alarm",\n  {\n    penggunaId: uuid("pengguna_id"),\n  },\n  (t) => [],\n);\nexport const s = pgTable("sesi", {\n  penggunaId: uuid("pengguna_id"),\n});\n',
      ).join() === "alarm" &&
      periksaRls(["dompet"], "ALTER TABLE dompet ENABLE ROW LEVEL SECURITY;").length > 0 &&
      periksaRls(
        ["dompet"],
        "ALTER TABLE dompet ENABLE ROW LEVEL SECURITY; ALTER TABLE dompet FORCE ROW LEVEL SECURITY; CREATE POLICY a ON dompet FOR SELECT; CREATE POLICY b ON dompet FOR ALL;",
      ).length === 0,
    jalankan: () => {
      const tabel = tabelBerRuang(baca(path.join(AKAR, "src/lib/db/schema.ts")));
      const sqlGabung = semuaBerkas(path.join(AKAR, "src/lib/db/migrasi"), (p) => p.endsWith(".sql"))
        .map(baca)
        .join("\n");
      // Tabel yang pasti ada sejak P0; bila tidak terbaca berarti pengurai skema rusak.
      const wajib = ["token_mcp", "audit"].filter((n) => !tabel.includes(n));
      if (wajib.length) return [`tabel ${wajib.join(", ")} tidak terbaca dari schema.ts: pengurai skema rusak?`];
      return periksaRls(tabel, sqlGabung);
    },
  },
  {
    nama: "kolom-subquery",
    ujiDiri: () =>
      periksaKolomSubquery("const n = sql`(select count(*) from transaksi t where t.dompet_id = ${schema.dompet.id})`;").length === 1 &&
      periksaKolomSubquery('const n = sql`(select count(*) from transaksi t where t.dompet_id = "dompet"."id")`;').length === 0 &&
      periksaKolomSubquery("const w = sql`${schema.dompet.id} = ${x}`;").length === 0,
    jalankan: () => semuaBerkas(path.join(AKAR, "src"), (p) => /\.tsx?$/.test(p)).flatMap((p) => periksaKolomSubquery(baca(p), p).map((x) => `${rel(p)}: ${x}`)),
  },
  {
    nama: "batas-klien",
    ujiDiri: () => {
      const klien = (d) => (d === "@/k" ? '"use client";\nexport const TAB = [];\nexport function Klien() {}' : null);
      return (
        periksaBatasKlien('import { Klien, TAB, type T } from "@/k";', klien).length === 1 &&
        periksaBatasKlien('import { Klien, type T } from "@/k";\nimport type { U } from "@/k";', klien).length === 0 &&
        periksaBatasKlien('"use client";\nimport { TAB } from "@/k";', klien).length === 0
      );
    },
    jalankan: () =>
      semuaBerkas(path.join(AKAR, "src/app"), (p) => /(page|layout|route|template|not-found|error|loading|default)\.tsx?$/.test(p)).flatMap((p) =>
        periksaBatasKlien(baca(p), bacaModulAlias).map((x) => `${rel(p)}: ${x}`),
      ),
  },
  {
    nama: "kamus-klien",
    ujiDiri: () =>
      periksaKamusKlien('"use client";\nimport { id } from "./kamus/id";', "src/x.tsx").length === 1 &&
      periksaKamusKlien('import { en } from "./kamus/en";', "src/lib/i18n/index.ts").length === 1 &&
      periksaKamusKlien('"use client";\nimport { type Kamus } from "./kamus/id";\nimport type { K } from "@/lib/i18n/kamus/en";', "src/x.tsx").length === 0 &&
      periksaKamusKlien('"use client";\nconst m = () => import("./kamus/id");', "src/lib/i18n/klien.tsx").length === 0 &&
      periksaKamusKlien('import { id } from "./kamus/id";', "src/lib/i18n/kamus-server.ts").length === 0,
    jalankan: () => semuaBerkas(path.join(AKAR, "src"), (p) => /\.tsx?$/.test(p)).flatMap((p) => periksaKamusKlien(baca(p), rel(p)).map((x) => `${rel(p)}: ${x}`)),
  },
  {
    nama: "karakter-kendali",
    ujiDiri: () => periksaKendali("const r = /\u0008p{L}/u;").length === 1 && periksaKendali("const r = /\\b\\p{L}/u;\n\tx").length === 0,
    jalankan: () =>
      ["src", "scripts", "tests", "deploy"]
        .flatMap((d) => semuaBerkas(path.join(AKAR, d), (p) => /\.(tsx?|mjs|sql|sh|ya?ml)$/.test(p)))
        .flatMap((p) => periksaKendali(baca(p)).map((x) => `${rel(p)}: ${x}`)),
  },
  {
    nama: "akhir-baris-lf",
    ujiDiri: () => periksaLf("#!/bin/sh\r\necho").length === 1 && periksaLf("#!/bin/sh\necho").length === 0,
    jalankan: () => semuaBerkas(path.join(AKAR, "deploy"), (p) => /(\.sh|Dockerfile|\.ya?ml)$/.test(p)).flatMap((p) => periksaLf(baca(p)).map((x) => `${rel(p)}: ${x}`)),
  },
];

// Tanda pisah panjang dilarang di teks produk (keputusan Chief 2026-10).
function periksaTandaPisah(sumber) {
  return /[–—]/.test(sumber) ? ['tanda pisah panjang di teks produk; pakai "-" atau koma'] : [];
}
PENJAGA.push({
  nama: "tanda-pisah",
  ujiDiri: () => periksaTandaPisah("a \u2014 b").length === 1 && periksaTandaPisah("a \u2013 b").length === 1 && periksaTandaPisah("a - b").length === 0,
  jalankan: () =>
    // Seluruh kode sumber (teks UI, pesan galat, teks alat MCP, naskah) + panduan agen.
    semuaBerkas(path.join(AKAR, "src"), (p) => /\.(tsx?|css)$/.test(p))
      .concat(semuaBerkas(path.join(AKAR, "skill"), (p) => p.endsWith(".md")))
      .flatMap((p) => periksaTandaPisah(baca(p)).map((x) => `${rel(p)}: ${x}`)),
});

// ------------------------------------------------------------ referensi terkecuali
// `referensi/` (template, standar, aplikasi lama) hanya dibaca. Bila ikut dicek tipe, di-lint,
// diuji, atau diformat, kesalahannya ikut menggagalkan build kita (CLAUDE.md §4).
function periksaReferensi(isi) {
  const t = [];
  if (!/"exclude"\s*:\s*\[[^\]]*"referensi"/.test(isi.tsconfig ?? "")) t.push('tsconfig.json: "referensi" tidak ada di exclude');
  if (!/["']referensi\/\*\*["']/.test(isi.eslint ?? "")) t.push('eslint.config.mjs: "referensi/**" tidak diabaikan');
  if (!/["']referensi\/\*\*["']/.test(isi.vitest ?? "")) t.push('vitest.config.mts: "referensi/**" tidak dikecualikan');
  if (!/^referensi\/?\s*$/m.test(isi.prettier ?? "")) t.push(".prettierignore: referensi/ tidak diabaikan");
  return t;
}
PENJAGA.push({
  nama: "referensi-terkecuali",
  ujiDiri: () =>
    periksaReferensi({ tsconfig: '"exclude": ["node_modules"]', eslint: "[]", vitest: "", prettier: "" }).length === 4 &&
    periksaReferensi({
      tsconfig: '"exclude": ["node_modules", "referensi"]',
      eslint: 'globalIgnores(["referensi/**"])',
      vitest: 'exclude: ["referensi/**"]',
      prettier: "referensi/\n",
    }).length === 0,
  jalankan: () => {
    const bacaAman = (n) => (existsSync(path.join(AKAR, n)) ? baca(path.join(AKAR, n)) : null);
    return periksaReferensi({
      tsconfig: bacaAman("tsconfig.json"),
      eslint: bacaAman("eslint.config.mjs"),
      vitest: bacaAman("vitest.config.mts"),
      prettier: bacaAman(".prettierignore"),
    });
  },
});

// ------------------------------------------------------------ env contoh lengkap
// Setiap env yang dikenal src/lib/env.ts wajib tercantum di .env.example (docs/03-ARSITEKTUR.md §12),
// supaya pemasangan baru tidak menebak-nebak.
function namaEnvDikenal(sumberEnv) {
  const hasil = new Set();
  for (const m of sumberEnv.matchAll(/const (?:WAJIB_WEB|WAJIB_WORKER|OPSIONAL) = \[([\s\S]*?)\]/g)) for (const n of m[1].matchAll(/"([A-Z][A-Z0-9_]+)"/g)) hasil.add(n[1]);
  return [...hasil];
}
function periksaEnvContoh(nama, contoh) {
  return nama.filter((n) => !new RegExp(`^#?\\s*${n}=`, "m").test(contoh)).map((n) => `${n} tidak ada di .env.example`);
}
PENJAGA.push({
  nama: "env-contoh",
  ujiDiri: () =>
    namaEnvDikenal('const WAJIB_WEB = ["A_B", "C"] as const;\nconst OPSIONAL = ["D_E"] as const;').join() === "A_B,D_E" &&
    periksaEnvContoh(["A_B", "D_E"], "A_B=1\n").length === 1 &&
    periksaEnvContoh(["A_B", "D_E"], "A_B=1\n# D_E=\n").length === 0,
  jalankan: () => {
    const nama = namaEnvDikenal(baca(path.join(AKAR, "src/lib/env.ts")));
    if (nama.length < 10) return [`hanya ${nama.length} env terbaca dari src/lib/env.ts: pengurai rusak?`];
    const contoh = existsSync(path.join(AKAR, ".env.example")) ? baca(path.join(AKAR, ".env.example")) : "";
    return periksaEnvContoh(nama, contoh);
  },
});

let gagal = 0;
for (const p of PENJAGA) {
  if (!p.ujiDiri()) {
    console.error(`✗ ${p.nama}: UJI-DIRI GAGAL: penjaga ini tidak bisa menangkap pelanggaran`);
    gagal++;
    continue;
  }
  const temuan = p.jalankan();
  if (temuan.length) {
    console.error(`✗ ${p.nama}: ${temuan.length} pelanggaran`);
    for (const t of temuan.slice(0, 30)) console.error(`    ${t}`);
    gagal++;
  } else {
    console.log(`✓ ${p.nama}`);
  }
}
if (gagal) {
  console.error(`\njaga: ${gagal} penjaga gagal, build dihentikan.`);
  process.exit(1);
}
console.log(`\njaga: ${PENJAGA.length} penjaga lolos.`);
