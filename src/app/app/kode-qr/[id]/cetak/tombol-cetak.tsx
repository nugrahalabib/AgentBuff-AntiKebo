"use client";

import { Printer } from "lucide-react";
import { Tombol } from "@/components/ui/dasar";

export function TombolCetak({ label }: { label: string }) {
  return (
    <Tombol ukuran="kecil" onClick={() => window.print()}>
      <Printer size={16} />
      {label}
    </Tombol>
  );
}
