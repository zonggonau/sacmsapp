import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import * as systemService from "@/services/system.service";

export const metadata: Metadata = {
  title: "Sedang Pemeliharaan",
  robots: { index: false, follow: false },
};

// Status maintenance dibaca saat permintaan. Tanpa ini halaman dirender statis
// ketika build dan selamanya menampilkan keadaan saat build.
export const dynamic = "force-dynamic";

/**
 * Halaman pemberitahuan maintenance mode — docs/10 §10.8.
 *
 * Publik (lihat proxy.ts): pengguna yang dialihkan ke sini tidak boleh
 * dipantulkan balik ke halaman masuk.
 */
export default async function MaintenancePage() {
  const active = await systemService.isMaintenanceMode();

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="bg-muted grid size-12 place-items-center rounded-full">
          <Wrench className="text-muted-foreground size-6" />
        </div>

        {active ? (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight">
              SaCMS sedang dalam pemeliharaan
            </h1>
            <p className="text-muted-foreground text-sm">
              Kami sedang melakukan perbaikan agar layanan lebih baik. Website yang
              sudah Anda terbitkan tetap bisa diakses pengunjung. Silakan kembali
              beberapa saat lagi.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">
                Pemeliharaan sudah selesai
              </h1>
              <p className="text-muted-foreground text-sm">
                Terima kasih sudah menunggu. SaCMS bisa dipakai kembali.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard">Buka Dashboard</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
