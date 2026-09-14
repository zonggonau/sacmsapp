"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

/**
 * Batas error area terautentikasi.
 *
 * Pengguna TIDAK PERNAH melihat pesan teknis — hanya satu kalimat yang bisa
 * ditindaklanjuti (docs/08 §8.4). Detailnya masuk ke log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("ui.app_error", { digest: error.digest, reason: error.message });
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center">
      <div className="bg-destructive/15 grid size-12 place-items-center rounded-full">
        <AlertTriangle className="text-destructive size-6" />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Terjadi kesalahan</h1>
        <p className="text-muted-foreground text-sm">
          Halaman ini gagal dimuat. Tim kami sudah diberi tahu. Silakan coba lagi.
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={reset}>Coba Lagi</Button>
        <Button variant="outline" asChild>
          <a href="/dashboard">Kembali ke Dashboard</a>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-muted-foreground font-mono text-xs">Kode: {error.digest}</p>
      ) : null}
    </div>
  );
}
