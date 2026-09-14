"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("ui.project_error", { digest: error.digest, reason: error.message });
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      <div className="bg-destructive/15 grid size-12 place-items-center rounded-full">
        <AlertTriangle className="text-destructive size-6" />
      </div>

      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Project gagal dimuat</h1>
        <p className="text-muted-foreground text-sm">
          Data project ini tidak bisa ditampilkan sekarang. Silakan coba lagi.
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={reset}>Coba Lagi</Button>
        <Button variant="outline" asChild>
          <Link href="/projects">Daftar Project</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="text-muted-foreground font-mono text-xs">Kode: {error.digest}</p>
      ) : null}
    </div>
  );
}
