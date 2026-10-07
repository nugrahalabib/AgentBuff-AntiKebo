import { cn } from "@/lib/cn";

/**
 * Maskot Kebo: kerbau kecil lucu (docs/04-DESAIN.md §2). Hemat, tanpa panel:
 * tidur di layar kosong, kaget di layar berbunyi, segar di Selamat pagi.
 * Ilustrasi berwarna tetap (bukan token tema) dengan garis tepi supaya terbaca di
 * latar terang maupun gelap. Dekoratif: beri `label` hanya bila Kebo membawa arti.
 */
export type PoseKebo = "tidur" | "kaget" | "segar" | "netral";

const KULIT = "#7c8aa3";
const KULIT_GELAP = "#5d6a82";
const TANDUK = "#f3e6cc";
const MONCONG = "#d9c4b0";
const GARIS = "#2b2f3a";

export function Kebo({ pose = "netral", ukuran = 96, label, className }: { pose?: PoseKebo; ukuran?: number; label?: string; className?: string }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 120 120"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 overflow-visible", className)}
    >
      {/* Tanduk */}
      <path d="M33 44c-12-2-20-11-19-24 5 8 12 12 23 13" fill={TANDUK} stroke={GARIS} strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M87 44c12-2 20-11 19-24-5 8-12 12-23 13" fill={TANDUK} stroke={GARIS} strokeWidth="2.4" strokeLinejoin="round" />
      {/* Telinga */}
      <ellipse cx="22" cy="58" rx="11" ry="6.5" transform="rotate(-24 22 58)" fill={KULIT_GELAP} stroke={GARIS} strokeWidth="2.2" />
      <ellipse cx="98" cy="58" rx="11" ry="6.5" transform="rotate(24 98 58)" fill={KULIT_GELAP} stroke={GARIS} strokeWidth="2.2" />
      <ellipse cx="23" cy="58" rx="6" ry="2.8" transform="rotate(-24 23 58)" fill="#e8a7a7" />
      <ellipse cx="97" cy="58" rx="6" ry="2.8" transform="rotate(24 97 58)" fill="#e8a7a7" />
      {/* Kepala */}
      <path d="M60 30c22 0 34 13 34 32 0 20-14 36-34 36S26 82 26 62c0-19 12-32 34-32Z" fill={KULIT} stroke={GARIS} strokeWidth="2.6" />
      {/* Jambul */}
      <path d="M52 33c2-6 6-8 9-8-1 3 0 5 3 6 2-3 5-4 8-3-3 2-4 5-3 8" fill={KULIT_GELAP} stroke={GARIS} strokeWidth="2.2" strokeLinejoin="round" />
      {/* Moncong */}
      <ellipse cx="60" cy="80" rx="23" ry="15" fill={MONCONG} stroke={GARIS} strokeWidth="2.4" />
      <ellipse cx="51" cy="79" rx="3.4" ry="4.2" fill={GARIS} />
      <ellipse cx="69" cy="79" rx="3.4" ry="4.2" fill={GARIS} />
      <Wajah pose={pose} />
    </svg>
  );
}

function Wajah({ pose }: { pose: PoseKebo }) {
  if (pose === "tidur") {
    return (
      <g>
        <path d="M40 60q6 5 12 0M68 60q6 5 12 0" fill="none" stroke={GARIS} strokeWidth="2.8" strokeLinecap="round" />
        <path d="M54 89q6 3 12 0" fill="none" stroke={GARIS} strokeWidth="2.4" strokeLinecap="round" />
        {/* z z melayang (digambar sebagai garis, bukan teks) */}
        <path d="M92 26h8l-8 9h8M104 12h6l-6 7h6" fill="none" stroke={GARIS} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      </g>
    );
  }
  if (pose === "kaget") {
    return (
      <g>
        <path d="M37 47l12-3M71 44l12 3" fill="none" stroke={GARIS} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="46" cy="58" r="8" fill="#fff" stroke={GARIS} strokeWidth="2.4" />
        <circle cx="74" cy="58" r="8" fill="#fff" stroke={GARIS} strokeWidth="2.4" />
        <circle cx="46" cy="58" r="2.6" fill={GARIS} />
        <circle cx="74" cy="58" r="2.6" fill={GARIS} />
        <ellipse cx="60" cy="90" rx="4" ry="4.6" fill={GARIS} />
        {/* Tetes keringat */}
        <path d="M92 40c3 4 4 7 2 9a3.2 3.2 0 0 1-5-2c0-2 1-4 3-7Z" fill="#7dd3fc" stroke={GARIS} strokeWidth="1.6" />
      </g>
    );
  }
  if (pose === "segar") {
    return (
      <g>
        <path d="M40 61q6-6 12 0M68 61q6-6 12 0" fill="none" stroke={GARIS} strokeWidth="2.8" strokeLinecap="round" />
        <ellipse cx="37" cy="70" rx="5" ry="3" fill="#f4a3a3" opacity="0.8" />
        <ellipse cx="83" cy="70" rx="5" ry="3" fill="#f4a3a3" opacity="0.8" />
        <path d="M52 88q8 7 16 0" fill="none" stroke={GARIS} strokeWidth="2.6" strokeLinecap="round" />
        {/* Kilau pagi */}
        <path d="M100 30v8M96 34h8M18 26v6M15 29h6" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <circle cx="46" cy="59" r="4.2" fill={GARIS} />
      <circle cx="74" cy="59" r="4.2" fill={GARIS} />
      <circle cx="47.4" cy="57.6" r="1.3" fill="#fff" />
      <circle cx="75.4" cy="57.6" r="1.3" fill="#fff" />
      <path d="M54 89q6 3 12 0" fill="none" stroke={GARIS} strokeWidth="2.4" strokeLinecap="round" />
    </g>
  );
}
