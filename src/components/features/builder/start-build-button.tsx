"use client";

import { useAction } from "next-safe-action/hooks";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { startBuild } from "@/actions/builder.actions";
import { Button } from "@/components/ui/button";

export function StartBuildButton({
  projectId,
  label = "Bangun Sekarang",
}: {
  projectId: string;
  label?: string;
}) {
  const { execute, isPending } = useAction(startBuild, {
    onSuccess: () => toast.success("Pembuatan dimulai."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal memulai pembuatan."),
  });

  return (
    <Button disabled={isPending} onClick={() => execute({ projectId })}>
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Sparkles className="size-4" />
      )}
      {isPending ? "Memulai…" : label}
    </Button>
  );
}
