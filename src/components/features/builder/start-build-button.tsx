"use client";

import { useAction } from "next-safe-action/hooks";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { startBuild } from "@/actions/builder.actions";
import { BlockedTooltip } from "@/components/features/quota/blocked-tooltip";
import { Button } from "@/components/ui/button";
import { toastActionError } from "@/lib/notify";

export function StartBuildButton({
  projectId,
  label = "Bangun Sekarang",
  blocker = null,
}: {
  projectId: string;
  label?: string;
  /** docs/11 §11.6: alasan tombol nonaktif (mis. kredit habis). */
  blocker?: string | null;
}) {
  const { execute, isPending } = useAction(startBuild, {
    onSuccess: () => toast.success("Pembuatan dimulai."),
    onError: ({ error }) =>
      toastActionError(error.serverError, "Gagal memulai pembuatan."),
  });

  return (
    <BlockedTooltip reason={blocker}>
      <Button
        disabled={isPending || blocker !== null}
        onClick={() => execute({ projectId })}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {isPending ? "Memulai…" : label}
      </Button>
    </BlockedTooltip>
  );
}
