"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { AlertTriangle, Check, Loader2, Minus, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { cancelBuild, getBuildStatus, retryBuild } from "@/actions/builder.actions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { BuildStatus } from "@/services/build.service";

const POLL_INTERVAL_MS = 2000;
const FINAL_STATUSES = ["SUCCEEDED", "FAILED", "CANCELLED"];

function isFinal(status: string) {
  return FINAL_STATUSES.includes(status);
}

/**
 * Progres build — docs/09-AI-BUILDER-PIPELINE.md §9.9.
 *
 * Polling, bukan SSE. Alasannya di ADR-005: nol infrastruktur baru, status
 * terlihat di database, dan mudah didebug. Tiga aturan yang membuat polling
 * tidak membebani:
 * - berhenti begitu status final,
 * - berhenti saat tab tidak terlihat,
 * - interval tetap 2 detik, tidak pernah lebih rapat.
 */
export function BuildProgress({
  initial,
  onFinished,
}: {
  initial: BuildStatus;
  onFinished?: (status: string) => void;
}) {
  const [state, setState] = useState<BuildStatus>(initial);
  // Hanya PERUBAHAN menjadi final yang memicu onFinished. Job yang sudah final
  // saat komponen dipasang tidak boleh memicu router.refresh() di setiap render.
  const notified = useRef(isFinal(initial.status));

  const { executeAsync } = useAction(getBuildStatus);

  const cancel = useAction(cancelBuild, {
    onSuccess: () => toast.success("Proses dibatalkan. Kredit Anda dikembalikan."),
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal membatalkan."),
  });

  const retry = useAction(retryBuild, {
    onSuccess: () => toast.success("Mencoba lagi…"),
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal mengulang."),
  });

  const poll = useCallback(async () => {
    const res = await executeAsync({ jobId: state.jobId });
    if (res?.data) setState(res.data);
  }, [executeAsync, state.jobId]);

  useEffect(() => {
    if (isFinal(state.status)) {
      if (!notified.current) {
        notified.current = true;
        onFinished?.(state.status);
      }
      return;
    }

    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => void poll(), POLL_INTERVAL_MS);
    };

    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };

    // Tab tersembunyi tidak perlu di-poll — pengguna tidak melihatnya, dan
    // email akan memberi tahu saat selesai.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void poll();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state.status, poll, onFinished]);

  const running = !isFinal(state.status);
  const failed = state.status === "FAILED";
  const cancelled = state.status === "CANCELLED";

  return (
    <div className="border-border bg-card space-y-5 rounded-lg border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            {running ? (
              <>
                <Loader2 className="text-primary-text size-4 animate-spin" />
                Membangun website Anda…
              </>
            ) : failed ? (
              <>
                <AlertTriangle className="text-destructive size-4" />
                Pembuatan gagal
              </>
            ) : cancelled ? (
              <>
                <X className="text-muted-foreground size-4" />
                Dibatalkan
              </>
            ) : (
              <>
                <Check className="text-success size-4" />
                Website Anda sudah siap
              </>
            )}
          </h3>
          {running ? (
            <p className="text-muted-foreground text-xs">
              Biasanya selesai dalam 2–4 menit. Anda boleh menutup halaman ini — kami
              kirim email saat selesai.
            </p>
          ) : null}
        </div>

        {running ? (
          <Button
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => cancel.execute({ jobId: state.jobId })}
          >
            {cancel.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Batalkan
          </Button>
        ) : null}
      </div>

      <ol className="space-y-1.5">
        {state.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <StepIcon status={s.status} />
            <span
              className={cn(
                "flex-1",
                s.status === "DONE" && "text-muted-foreground",
                s.status === "RUNNING" && "text-foreground font-medium",
                s.status === "PENDING" && "text-muted-foreground/60",
                s.status === "SKIPPED" && "text-muted-foreground/60 line-through",
                s.status === "FAILED" && "text-destructive font-medium",
              )}
            >
              {s.label}
            </span>
            {s.durationMs != null ? (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {(s.durationMs / 1000).toFixed(1)} dtk
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="space-y-2">
        <Progress value={state.progress} aria-label="Kemajuan pembuatan website" />
        <p className="text-muted-foreground text-right font-mono text-xs tabular-nums">
          {state.progress}%
        </p>
      </div>

      {failed || cancelled ? (
        <div className="border-border space-y-3 border-t pt-4">
          {state.errorMessage ? (
            <p className="text-sm wrap-anywhere">{state.errorMessage}</p>
          ) : null}
          <Button
            size="sm"
            disabled={retry.isPending}
            onClick={() => retry.execute({ jobId: state.jobId })}
          >
            {retry.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}
            Coba Lagi
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StepIcon({ status }: { status: string }) {
  if (status === "DONE") {
    return <Check className="text-success size-4 shrink-0" aria-label="Selesai" />;
  }
  if (status === "RUNNING") {
    return (
      <Loader2
        className="text-primary-text size-4 shrink-0 animate-spin"
        aria-label="Sedang berjalan"
      />
    );
  }
  if (status === "FAILED") {
    return <X className="text-destructive size-4 shrink-0" aria-label="Gagal" />;
  }
  if (status === "SKIPPED") {
    return (
      <Minus
        className="text-muted-foreground/60 size-4 shrink-0"
        aria-label="Dilewati"
      />
    );
  }
  return (
    <span
      className="border-border ml-0.5 size-3 shrink-0 rounded-full border"
      aria-label="Menunggu"
    />
  );
}
