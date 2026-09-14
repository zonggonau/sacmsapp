"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <TriangleAlert className="text-destructive size-8" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Halaman admin gagal dimuat</h1>
          <p className="text-muted-foreground text-sm">
            Terjadi kesalahan saat mengambil data. Detailnya sudah tercatat di log
            server.
          </p>
        </div>
        <Button onClick={reset}>Coba Lagi</Button>
      </div>
    </div>
  );
}
