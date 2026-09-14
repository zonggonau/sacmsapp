import Link from "next/link";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Halaman 403. Dipicu oleh forbidden() di lib/auth-guard.ts.
 *
 * Sengaja TIDAK menjelaskan apa yang ada di balik halaman terlarang —
 * konfirmasi keberadaan sebuah rute juga merupakan kebocoran informasi.
 */
export default function Forbidden() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="bg-destructive/15 grid size-12 place-items-center rounded-full">
          <ShieldX className="text-destructive size-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Akses ditolak</h1>
          <p className="text-muted-foreground text-sm">
            Akun Anda tidak punya izin untuk membuka halaman ini.
          </p>
        </div>

        <Button asChild>
          <Link href="/dashboard">Kembali ke Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
