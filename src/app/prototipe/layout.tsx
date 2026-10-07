import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Galeri prototipe P1: hanya di pengembangan atau mode tiruan, tidak pernah di produksi. */
export default function TataLetakPrototipe({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.AGENTBUFF_TIRUAN !== "1") notFound();
  return children;
}
