"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { getDeploymentStatus } from "@/actions/deploy.actions";
import type { DeploymentState } from "@/services/deploy.service";

const POLL_INTERVAL_MS = 3000;

function isActive(status: string) {
  return status === "QUEUED" || status === "BUILDING";
}

/**
 * Pemantau penerbitan yang sedang berjalan.
 *
 * Polling, sama seperti progres build (ADR-005): berhenti saat status final,
 * dilewati saat tab tidak terlihat. Saat selesai halaman dimuat ulang dari server
 * sehingga riwayat dan alamat live ikut diperbarui.
 */
export function DeploymentProgress({ initial }: { initial: DeploymentState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const notified = useRef(!isActive(initial.status));
  const { executeAsync } = useAction(getDeploymentStatus);

  useEffect(() => {
    if (!isActive(state.status)) {
      if (!notified.current) {
        notified.current = true;
        if (state.status === "READY") {
          toast.success("Website Anda sudah tayang.");
        } else {
          toast.error(
            state.errorMessage ??
              "Penerbitan gagal. Website Anda yang sekarang tidak berubah.",
          );
        }
        router.refresh();
      }
      return;
    }

    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await executeAsync({ deploymentId: state.id });
      if (res?.data) setState(res.data);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [state.status, state.id, state.errorMessage, executeAsync, router]);

  if (!isActive(state.status)) return null;

  return (
    <div
      className="border-border bg-card flex items-start gap-3 rounded-lg border p-4"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="text-primary-text mt-0.5 size-4 shrink-0 animate-spin" />
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {state.status === "QUEUED"
            ? "Menyiapkan penerbitan…"
            : "Sedang menerbitkan website…"}
        </p>
        <p className="text-muted-foreground text-xs">
          Biasanya selesai dalam 1–3 menit. Website yang sedang tayang tetap bisa
          diakses selama proses ini.
        </p>
      </div>
    </div>
  );
}
