"use client";

import { useAction } from "next-safe-action/hooks";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { markNotificationsRead } from "@/actions/notification.actions";
import { Button } from "@/components/ui/button";

export function MarkNotificationsRead({ disabled }: { disabled: boolean }) {
  const { execute, isPending } = useAction(markNotificationsRead, {
    onSuccess: () => toast.success("Semua notifikasi ditandai sudah dibaca."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal menandai notifikasi. Coba lagi."),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || isPending}
      onClick={() => execute()}
    >
      {isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <CheckCheck className="size-4" />
      )}
      Tandai semua dibaca
    </Button>
  );
}
