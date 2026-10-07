import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { berkasKamusPc } from "../src/lib/i18n/kamus-pc";

// Salin potongan kamus ke aplikasi PC: `pnpm exec tsx scripts/kamus-pc.ts`.
const b = berkasKamusPc();
const ui = join(import.meta.dirname, "..", "pc", "ui");
writeFileSync(join(ui, "kamus.js"), b.js);
writeFileSync(join(ui, "kamus.json"), b.json);
console.log("pc/ui/kamus.js dan kamus.json diperbarui");
