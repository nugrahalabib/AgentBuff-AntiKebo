import { useId } from "react";

/**
 * Merek AntiKebo: jam weker bertanduk kerbau. Id gradasi unik per logo: bila beberapa logo
 * memakai id yang sama dan yang pertama ada di elemen tersembunyi (bilah samping di HP),
 * Chrome tidak menggambar gradasinya sama sekali.
 */
export function Logo({ ukuran = 32 }: { ukuran?: number }) {
  const id = `logo-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg width={ukuran} height={ukuran} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id})`} />
      <path d="M22.5 25.5C15.5 25 11.5 19.5 13 12.5c2.6 4.6 6.6 7 12.2 8.3Z" fill="#fff" />
      <path d="M41.5 25.5c7-.5 11-6 9.5-13-2.6 4.6-6.6 7-12.2 8.3Z" fill="#fff" />
      <circle cx="32" cy="37" r="14" fill="none" stroke="#fff" strokeWidth="3.6" />
      <path d="M32 37v-8M32 37l6 3.5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  );
}
