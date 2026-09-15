"use client";

import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminSendSentryTest } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";

/** docs/12 §12.8 — "Sentry aktif, sampel error terkirim". */
export function SentryTestButton() {
  const { execute, isPending } = useAction(adminSendSentryTest, {
    onSuccess: ({ data }) =>
      data?.sent
        ? toast.success("Event uji terkirim. Periksa dasbor Sentry dalam 1 menit.")
        : toast.warning("SENTRY_DSN belum diisi — event uji tidak dikirim."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal mengirim event uji."),
  });

  return (
    <Button variant="outline" size="sm" disabled={isPending} onClick={() => execute()}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
      Kirim event uji Sentry
    </Button>
  );
}
