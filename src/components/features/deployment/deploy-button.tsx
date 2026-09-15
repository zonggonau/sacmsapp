"use client";

import { useAction } from "next-safe-action/hooks";
import { Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

import { deployProject } from "@/actions/deploy.actions";
import { BlockedTooltip } from "@/components/features/quota/blocked-tooltip";
import { Button } from "@/components/ui/button";
import { toastActionError } from "@/lib/notify";

export function DeployButton({
  projectId,
  versionNumber,
  blocker,
}: {
  projectId: string;
  versionNumber: number | null;
  /** Alasan tombol dinonaktifkan. Selalu ditampilkan — tombol mati tanpa alasan membingungkan. */
  blocker: string | null;
}) {
  const { execute, isPending } = useAction(deployProject, {
    onSuccess: () =>
      toast.success("Penerbitan dimulai. Biasanya selesai dalam 1–3 menit."),
    onError: ({ error }) =>
      toastActionError(
        error.serverError,
        "Penerbitan gagal dimulai. Silakan coba lagi.",
      ),
  });

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <BlockedTooltip reason={blocker}>
        <Button
          disabled={isPending || blocker !== null}
          onClick={() => execute({ projectId })}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Rocket className="size-4" />
          )}
          {isPending ? "Memulai…" : "Terbitkan"}
        </Button>
      </BlockedTooltip>
      <p className="text-muted-foreground text-xs">
        {blocker ??
          (versionNumber !== null ? `Versi ${versionNumber} akan diterbitkan.` : null)}
      </p>
    </div>
  );
}
