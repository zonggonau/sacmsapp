import type { Metadata } from "next";
import { Ban } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Akun Ditangguhkan",
  robots: { index: false, follow: false },
};

/**
 * Ditampilkan bagi pengguna berstatus SUSPENDED.
 *
 * Sengaja memberi jalan keluar yang jelas (hubungi dukungan) alih-alih pesan
 * error samar — pengguna yang ditangguhkan tetap pelanggan sampai terbukti
 * sebaliknya. docs/07 §7.5
 */
export default function AkunDitangguhkanPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="bg-warning/15 grid size-12 place-items-center rounded-full">
          <Ban className="text-warning size-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Akun ditangguhkan</h1>
          <p className="text-muted-foreground text-sm">
            Akun Anda sementara dinonaktifkan. Hubungi tim dukungan kami untuk
            mengetahui alasannya dan cara mengaktifkannya kembali.
          </p>
        </div>

        <Button asChild>
          <a href="mailto:dukungan@sacms.id">Hubungi Dukungan</a>
        </Button>
      </div>
    </div>
  );
}
