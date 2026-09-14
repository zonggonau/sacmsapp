"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Loader2, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

import { adminCancelBuild, adminRetryBuild } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";

/** Batalkan (job berjalan) dan Ulangi (job gagal) — docs/10 §10.5. */
export function BuildAdminActions({
  jobId,
  status,
}: {
  jobId: string;
  status: string;
}) {
  const router = useRouter();

  const cancel = useAction(adminCancelBuild, {
    onSuccess: () => toast.success("Build dibatalkan. Kredit pemilik dikembalikan."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal membatalkan build."),
  });

  const retry = useAction(adminRetryBuild, {
    onSuccess: ({ data }) => {
      toast.success("Build baru dibuat dan dijalankan.");
      if (data?.jobId) router.push(`/admin/build/${data.jobId}`);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal mengulang build."),
  });

  const running = status === "QUEUED" || status === "RUNNING";
  const retryable = status === "FAILED" || status === "CANCELLED";

  if (!running && !retryable) return null;

  return running ? (
    <Button
      variant="outline"
      size="sm"
      disabled={cancel.isPending}
      onClick={() => cancel.execute({ jobId })}
    >
      {cancel.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <X className="size-4" />
      )}
      Batalkan
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      disabled={retry.isPending}
      onClick={() => retry.execute({ jobId })}
    >
      {retry.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RotateCcw className="size-4" />
      )}
      Ulangi
    </Button>
  );
}
